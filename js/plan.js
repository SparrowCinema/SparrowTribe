/* js/plan.js — 个人排片：场次变更提醒、专题筛选、冲突与间隔、日程行。
   网站脚本按功能拆成 js/*.js，按 index.html 里的顺序加载；部署时 tools/build-assets.js 按同样顺序合并成一个 app.js。 */

/* ===== 场次变更（2026-11-16）=====
   排片数据里删掉或改了时间 / 影厅的场次，原来会在 readSelection 时被静默丢掉。现在：
   - sparrow-plan-memo-v1：本机记下每个已选场次的影片、日期时间、影院影厅（{场次键:{f,d,t,v,h,at}}），加入或载入时更新；
   - 载入时，已选但数据里已不存在、且原定未开场（6 小时内）的场次，移到 sparrow-plan-gone-v1，个人排片页顶部列出：
     同一部影片还有别的待映场次时给出最接近的两场一键替换，否则提示「暂时没有其他场次」，可以「知道了」移除提醒。
   - 原定时间过去一天后提醒自动清除；场次键重新出现（数据改回）时也自动清除。 */
const PLAN_MEMO_KEY='sparrow-plan-memo-v1',PLAN_GONE_KEY='sparrow-plan-gone-v1';
let planGone={};
function rjson(k){try{const o=JSON.parse(localStorage.getItem(k)||'{}');return o&&typeof o==='object'&&!Array.isArray(o)?o:{};}catch{return {};}}
function wjson(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}
function planMemoFor(keys){const memo=rjson(PLAN_MEMO_KEY),byKey=new Map(SH.map(s=>[keyOf(s),s])),out={};
  keys.forEach(k=>{const s=byKey.get(k);if(s)out[k]={f:s.id,d:s.d,t:s.t,v:s.v,h:s.h,at:showDate(s).getTime()};else if(memo[k])out[k]=memo[k];});return out;}
/* 在 readSelection 之前调用（此时 validKeys 已是新数据） */
function planTrack(){let raw=[];try{const a=JSON.parse(localStorage.getItem(PLAN_KEY)||'[]');raw=Array.isArray(a)?a.filter(k=>typeof k==='string'):[];}catch{}
  const memo=rjson(PLAN_MEMO_KEY),gone=rjson(PLAN_GONE_KEY),t=+now();
  raw.forEach(k=>{const m=memo[k];if(validKeys.has(k)||gone[k]||!m||!m.at||m.at<t-6*3600e3)return;gone[k]=Object.assign({},m,{seen:t});});
  Object.keys(gone).forEach(k=>{const g=gone[k];if(validKeys.has(k)||!g||!g.at||g.at<t-24*3600e3)delete gone[k];});
  planGone=gone;wjson(PLAN_GONE_KEY,gone);wjson(PLAN_MEMO_KEY,planMemoFor(raw.filter(k=>validKeys.has(k))));}
function planGoneList(){return Object.keys(planGone).map(k=>Object.assign({k},planGone[k])).sort((a,b)=>a.at-b.at);}
function planGoneDrop(k){delete planGone[k];wjson(PLAN_GONE_KEY,planGone);}
function planAlts(g){return SH.filter(s=>s.id===g.f&&!isPast(s)&&!picked.has(keyOf(s))).map(s=>[s,(s.d===g.d?0:2e7)+(s.v===g.v?0:1e7)+Math.abs(showDate(s).getTime()-g.at)/6e4]).sort((a,b)=>a[1]-b[1]).slice(0,2).map(x=>x[0]);}
function planGoneHTML(){const list=planGoneList();if(!list.length)return '';
  const was=g=>{const v=VN[g.v],h=v&&v.halls.find(x=>x.id===g.h);return esc(g.d+' '+tr(wk(g.d))+' '+g.t)+(v?' · '+esc(venueLabel(v))+(h?' '+esc(h.name):''):'');};
  return '<div class="plan-gone" role="status"><b>'+tr(list.length+' 场排片有变动')+'</b><p>'+tr('这些场次在最新排片里已经找不到了，可能改了时间、换了影厅或取消。')+'</p>'+list.map(g=>{const f=F[g.f],alts=planAlts(g);
    return '<div class="pg-item"><div class="pg-was"><strong>'+(f?esc(f.cn)+(f.version?' <span class="ped">'+esc(f.version)+'</span>':''):tr('原场次'))+'</strong><span>'+tr('原定')+' '+was(g)+'</span></div>'+
      (alts.length?alts.map(s=>'<button class="pg-alt" data-gone-swap="'+esc(g.k)+'" data-to="'+esc(keyOf(s))+'"><span>'+tr('换成')+' '+esc(s.d+' '+tr(wk(s.d))+' '+s.t)+' · '+placeHTML(s)+'</span><b>＋</b></button>').join(''):'<p class="pg-none">'+tr('这部影片暂时没有其他待映场次')+'</p>')+
      '<button class="text-button pg-ok" data-gone-ok="'+esc(g.k)+'">'+tr('知道了')+'</button></div>';}).join('')+'</div>';}
document.addEventListener('click',e=>{
  const sw=e.target.closest('[data-gone-swap]');
  if(sw){const to=sw.dataset.to;if(validKeys.has(to)){picked.add(to);saveSelection();}planGoneDrop(sw.dataset.goneSwap);toast(tr('已换成新场次'));if(location.hash==='#plan')planPage();return;}
  const ok=e.target.closest('[data-gone-ok]');
  if(ok){planGoneDrop(ok.dataset.goneOk);if(location.hash==='#plan')planPage();else ok.closest('.pg-item')?.remove();}
});
const pageShareURL=(k,id)=>new URL('s/'+(LANG==='en'?'en/':'')+k+'/'+encodeURIComponent(id)+'.html',document.baseURI).href;
const calURL=id=>new URL('cal/'+(LANG==='en'?'en/':'')+encodeURIComponent(id)+'.ics',document.baseURI).href;
async function copyText(v){try{await navigator.clipboard.writeText(v);}catch{const i=document.createElement('textarea');i.value=v;i.style.cssText='position:fixed;opacity:0';document.body.appendChild(i);i.select();try{document.execCommand('copy');}catch{}i.remove();}}
function progActsHTML(p){if(!p||!p.file)return "";return `<div class="pg-acts"><button class="pg-act" type="button" data-share="p:${p.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>分享专题</button><button class="pg-act" type="button" data-sposter="p:${p.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 15l3-3 2 2 3-3"/><circle cx="9" cy="8" r="1.5"/></svg>分享海报</button><a class="pg-act" href="${calURL(p.id).replace(/^https?:/,"webcal:")}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>订阅日历</a><button class="pg-act" type="button" data-copyurl="${esc(calURL(p.id))}">复制订阅链接</button></div><p class="pg-hint">订阅后，场次有调整会自动同步到你的日历。</p>`;}
document.addEventListener('click',async e=>{
  const sh=e.target.closest('[data-share]');
  if(sh){stat('share',sh.dataset.share.split(':')[0]);const [k,id]=sh.dataset.share.split(':'),f=k==='f'?F[id]:null,p=k==='p'?PG[id]:null,title=(f?f.cn:p&&p.name)||'',url=pageShareURL(k,id);
    if(navigator.share){try{await navigator.share({title:p?title:title+' | '+tr('麻雀观影护照'),url});return;}catch(err){if(err&&err.name==='AbortError')return;}}
    await copyText(url);toast('分享链接已复制');return;}
  const cu=e.target.closest('[data-copyurl]');
  if(cu){await copyText(cu.dataset.copyurl);toast('订阅链接已复制');}
});
function toast(message){let el=document.getElementById('toast');if(!el){el=document.createElement('div');el.id='toast';el.setAttribute('role','status');document.body.appendChild(el);}el.textContent=message;el.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('visible'),2800);}
function saveSelection(){try{localStorage.setItem(PLAN_KEY,JSON.stringify([...picked]));touchMeta('picks');wjson(PLAN_MEMO_KEY,planMemoFor([...picked]));return true;}catch{toast('当前浏览器无法保存，离开页面后可能丢失');return false;}}
let planFilt="all";
function planSelectorOptions(query=''){
 const all=selectedRows(),q=query.trim().toLocaleLowerCase(),rows=[{id:'all',name:tr('全部专题'),n:all.length},...progOrdered().map(p=>({id:p.id,name:p.name,n:all.filter(x=>x.p===p.id).length}))];
 return rows.filter(x=>!q||x.name.toLocaleLowerCase().includes(q)).map(x=>`<button class="selector-option" role="option" aria-selected="${x.id==='all'?!selList(planFilt).length:selList(planFilt).includes(x.id)}" data-filter-value="${esc(x.id)}"><span><b>${esc(x.name)}</b><small>${tr(x.n?x.n+' 场':'未加入')}</small></span><span class="selector-check" aria-hidden="true">${(x.id==='all'?!selList(planFilt).length:selList(planFilt).includes(x.id))?'✓':''}</span></button>`).join('')||'<p class="selector-empty" role="status">没有匹配的专题</p>';
}
function planProgChips(all){if(!all.length)return '';const n=scopedRows().length,sl=selList(planFilt),cur=sl.length===1?PG[sl[0]]:null,curName=sl.length>1?tr(sl.length+' 个专题'):cur?cur.name:tr('全部专题');
 return `<div class="plan-scope"><button class="schedule-filter" data-plan-filter="programme" aria-haspopup="dialog"><span><small>选择专题</small><b>${esc(curName)}</b></span><span class="scope-count">${tr(n+' 场')}</span>${filterChevron}</button><p>排片、长图与分享只含所选内容</p></div>`;
}
function scopedRows(){const all=selectedRows();if(planFilt==="all")return all;return all.filter(s=>selHas(planFilt,s.p));}
function selectedRows(keys=picked){const set=new Set(keys);return SH.filter(s=>set.has(keyOf(s))).sort((a,b)=>showDate(a)-showDate(b));}
function showDate(s){const md=s.d.split('/').map(Number),tm=s.t.split(':').map(Number);return new Date(year(s.d,s.year),md[0]-1,md[1],tm[0],tm[1]);}
function planToggleHTML(s){const k=keyOf(s),yes=picked.has(k);return '<button class="plan-toggle '+(yes?'selected':'')+'" data-plan="'+esc(k)+'" aria-pressed="'+yes+'" aria-label="'+(yes?'移出排片 ':'加入排片 ')+esc(F[s.id].cn)+' '+esc(s.d)+' '+s.t+'">'+(yes?'✓ 已加入':'+ 加入排片')+'</button>';}
function showChoiceHTML(s){return '<div class="show-choice"><button class="show" data-jump="'+keyOf(s)+'"><span class="dt">'+s.d+' '+s.t+'</span><span class="x">'+wk(s.d)+' · '+placeHTML(s)+' · 散场 '+fmt(toMin(s.t)+durationOf(s))+'</span><span class="go">查看排片 ›</span></button>'+planToggleHTML(s)+'</div>';}
function conflicts(list){let out=[];for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){const a=list[i],b=list[j];if(a.d===b.d&&toMin(a.t)<toMin(b.t)+F[b.id].min-2&&toMin(b.t)<toMin(a.t)+F[a.id].min-2)out.push([a,b]);}return out;}
const regColor = f => ({cn:"#8e2a22",eu:"#2f6f6c",us:"#b26a1f",as:"#5d6b2e"})[f.reg]||"#8e2a22";
const endMin = s => toMin(s.t)+durationOf(s);
const durText = m => m<60 ? m+" 分钟" : Math.floor(m/60)+" 小时"+(m%60?" "+m%60+" 分":"");
function planStats(list){const minutes=list.reduce((n,s)=>n+F[s.id].min,0);return {n:list.length,days:new Set(list.map(s=>s.d)).size,minutes,hm:Math.floor(minutes/60)+"h"+String(minutes%60).padStart(2,"0"),clash:conflicts(list).length};}
function byDay(list){const m=new Map();list.forEach(s=>{if(!m.has(s.d))m.set(s.d,[]);m.get(s.d).push(s);});return [...m.entries()];}
function gapOf(a,b){const g=toMin(b.t)-endMin(a);if(g<0)return {cls:"clash",txt:"与上一场重叠 "+(-g)+" 分钟"};if(g<20)return {cls:"tight",txt:"间隔仅 "+g+" 分钟，留意入场时间"};return {cls:"ok",txt:"间隔 "+durText(g)};}
function thumbHTML(f){return pst(f.id)?pimg(f.id,360,'class="pthumb" alt="" loading="lazy"'):'<span class="pthumb pslate" style="background:'+REG[f.reg].c+'">'+esc(f.cn[0])+'</span>';}
function planRowsHTML(list,editable){
  return byDay(list).map(([d,items])=>{
    const first=items[0],last=items[items.length-1];
    let body='';
    items.forEach((s,i)=>{const f=F[s.id];
      if(i){const g=gapOf(items[i-1],s);body+='<li class="pgap '+g.cls+'"><span>'+g.txt+'</span></li>';}
      body+='<li class="pitem" style="--c:'+REG[f.reg].c+'"><div class="ptime"><b>'+s.t+'</b><small>'+fmt(endMin(s))+'</small></div><div class="pcard">'+thumbHTML(f)+'<div class="pinfo"><button class="ptitle" data-film="'+s.id+'"><b>'+esc(f.cn)+'</b>'+(f.version?'<span class="ped">'+esc(f.version)+'</span>':'')+'</button><small>'+(f.dir?esc(f.dir)+' · ':'')+minText(f)+'</small><span class="pvenue">'+placeHTML(s)+'</span></div>'+(editable?'<button class="premove" data-plan="'+esc(keyOf(s))+'" aria-label="移出排片 '+esc(f.cn)+' '+s.d+' '+s.t+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg></button>':'')+'</div></li>';
    });
    return '<section class="pday"><header class="pday-h"><b>'+d+'</b><span>'+wk(d)+'</span><small>'+items.length+' 场 · '+first.t+' – '+fmt(endMin(last))+'</small></header><ol class="ptl">'+body+'</ol></section>';
  }).join('');
}
function statsHTML(st){return '<div class="pstats"><div><b>'+st.n+'</b><small>场放映</small></div><div><b>'+st.days+'</b><small>天行程</small></div><div><b>'+st.hm+'</b><small>银幕时长</small></div><div class="'+(st.clash?'bad':'good')+'"><b>'+st.clash+'</b><small>时间冲突</small></div></div>';}
