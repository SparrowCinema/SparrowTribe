/* js/plan.js — 个人排片：场次变更提醒、专题筛选、冲突与间隔、日程行。
   网站脚本按功能拆成 js/*.js，按 index.html 里的顺序加载；部署时 tools/build-assets.js 按同样顺序合并成一个 app.js。 */

/* ===== 场次变更（2026-11-16）=====
   排片数据里删掉或改了时间 / 影厅的场次，原来会在 readSelection 时被静默丢掉。现在：
   - sparrow-plan-memo-v1：本机记下每个已选场次的影片、日期时间、影院影厅（{场次键:{f,d,t,v,h,at}}），加入或载入时更新；
   - 载入时，已选但数据里已不存在、且原定未开场（6 小时内）的场次，移到 sparrow-plan-gone-v1，个人排片页顶部列出：
     同一部影片还有别的待映场次时给出最接近的两场一键替换，否则提示「暂时没有其他场次」，可以「知道了」移除提醒。
   - 原定时间过去一天后提醒自动清除；场次键重新出现（数据改回）时也自动清除。 */
const PLAN_MEMO_KEY='sparrow-plan-memo-v1',PLAN_GONE_KEY='sparrow-plan-gone-v1',PLAN_MOVED_KEY='sparrow-plan-moved-v1';
let planMoved={};
let planGone={};
function rjson(k){try{const o=JSON.parse(localStorage.getItem(k)||'{}');return o&&typeof o==='object'&&!Array.isArray(o)?o:{};}catch{return {};}}
function wjson(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}
function planMemoFor(keys){const memo=rjson(PLAN_MEMO_KEY),byKey=new Map(SH.map(s=>[keyOf(s),s])),out={};
  keys.forEach(k=>{const s=byKey.get(k);if(s)out[k]={f:s.id,d:s.d,t:s.t,v:s.v,h:s.h,at:showDate(s).getTime()};else if(memo[k])out[k]=memo[k];});return out;}
/* 在 readSelection 之前调用（此时 validKeys 已是新数据） */
function planTrack(){let raw=[];try{const a=JSON.parse(localStorage.getItem(PLAN_KEY)||'[]');raw=Array.isArray(a)?a.filter(k=>typeof k==='string'):[];}catch{}
  const memo=rjson(PLAN_MEMO_KEY),gone=rjson(PLAN_GONE_KEY),moved=rjson(PLAN_MOVED_KEY),t=+now();
  /* 按场次变更记录（MOVES，data/changes.json）自动处理：改期 / 换厅 → 直接换成新场次并记一条「已自动更新」；取消 → 进「有变动」列表给出同片其他场次。
     旧键仍有效时只在「被别的影片占用」且本机记录的影片对不上时才迁移。迁移后写回本机并更新同步时间，其他设备随同步一起更新。 */
  let mig=false;
  raw=raw.map(k=>{const m=MOVES[k];if(!m)return k;
    if(validKeys.has(k)){const mm=memo[k],s=SH.find(x=>keyOf(x)===k);if(!(m.reused&&mm&&mm.f&&s&&s.id!==mm.f))return k;}
    const w=m.was||{},at=w.d?showDate(w).getTime():0;
    if(m.to&&validKeys.has(m.to)){moved[k]={to:m.to,f:m.f,d:w.d,t:w.t,v:w.v,h:w.h,at,seen:t};mig=true;return m.to;}
    if(!m.to){if(at>=t-6*3600e3)gone[k]={f:m.f,d:w.d,t:w.t,v:w.v,h:w.h,at,seen:t,cancel:1};mig=true;return null;}
    return k;}).filter(Boolean);
  if(mig){raw=[...new Set(raw)];try{localStorage.setItem(PLAN_KEY,JSON.stringify(raw));touchMeta('picks');}catch{}}
  Object.keys(moved).forEach(k=>{const s=SH.find(x=>keyOf(x)===moved[k].to);if(!s||isPast(s))delete moved[k];});
  planMoved=moved;wjson(PLAN_MOVED_KEY,moved);
  raw.forEach(k=>{const m=memo[k];if(validKeys.has(k)||gone[k]||!m||!m.at||m.at<t-6*3600e3)return;gone[k]=Object.assign({},m,{seen:t});});
  Object.keys(gone).forEach(k=>{const g=gone[k];if(validKeys.has(k)||!g||!g.at||g.at<t-24*3600e3)delete gone[k];});
  planGone=gone;wjson(PLAN_GONE_KEY,gone);wjson(PLAN_MEMO_KEY,planMemoFor(raw.filter(k=>validKeys.has(k))));}
function planGoneList(){return Object.keys(planGone).map(k=>Object.assign({k},planGone[k])).sort((a,b)=>a.at-b.at);}
function planGoneDrop(k){delete planGone[k];wjson(PLAN_GONE_KEY,planGone);}
function planMovedList(){return Object.keys(planMoved).map(k=>Object.assign({k},planMoved[k])).sort((a,b)=>a.at-b.at);}
function planChangeCount(){return planGoneList().length+planMovedList().length;}
function planAlts(g){return SH.filter(s=>s.id===g.f&&!isPast(s)&&!picked.has(keyOf(s))).map(s=>[s,(s.d===g.d?0:2e7)+(s.v===g.v?0:1e7)+Math.abs(showDate(s).getTime()-g.at)/6e4]).sort((a,b)=>a[1]-b[1]).slice(0,2).map(x=>x[0]);}
function planMovedHTML(){const list=planMovedList();if(!list.length)return '';
  const when=(d,t,v,h)=>{const V=VN[v],H=V&&V.halls.find(x=>x.id===h);return esc(d+' '+tr(wk(d))+' '+t)+(V?' · '+esc(venueLabel(V))+(H?' '+esc(H.name):''):'');};
  return '<div class="plan-gone plan-moved" role="status"><b>'+tr(list.length+' 场排片已按最新排片更新')+'</b><p>'+tr('主办方调整了这些场次，你的排片已经自动换成新时间。')+'</p>'+list.map(g=>{const f=F[g.f],s=SH.find(x=>keyOf(x)===g.to);
    return '<div class="pg-item"><div class="pg-was"><strong>'+(f?esc(f.cn)+(f.version?' <span class="ped">'+esc(f.version)+'</span>':''):'')+'</strong><span class="pg-old">'+tr('原定')+' '+when(g.d,g.t,g.v,g.h)+'</span><span class="pg-new">'+tr('改为')+' '+(s?when(s.d,s.t,s.v,s.h):'')+'</span></div><button class="text-button pg-ok" data-moved-ok="'+esc(g.k)+'">'+tr('知道了')+'</button></div>';}).join('')+'</div>';}
function planGoneHTML(){const list=planGoneList();if(!list.length)return planMovedHTML();
  const was=g=>{const v=VN[g.v],h=v&&v.halls.find(x=>x.id===g.h);return esc(g.d+' '+tr(wk(g.d))+' '+g.t)+(v?' · '+esc(venueLabel(v))+(h?' '+esc(h.name):''):'');};
  return '<div class="plan-gone" role="status"><b>'+tr(list.length+' 场排片有变动')+'</b><p>'+tr('这些场次在最新排片里已经找不到了，可能改了时间、换了影厅或取消。')+'</p>'+list.map(g=>{const f=F[g.f],alts=planAlts(g);
    return '<div class="pg-item"><div class="pg-was"><strong>'+(f?esc(f.cn)+(f.version?' <span class="ped">'+esc(f.version)+'</span>':''):tr('原场次'))+'</strong><span>'+(g.cancel?tr('已取消')+' · ':'')+tr('原定')+' '+was(g)+'</span></div>'+
      (alts.length?alts.map(s=>'<button class="pg-alt" data-gone-swap="'+esc(g.k)+'" data-to="'+esc(keyOf(s))+'"><span>'+tr('换成')+' '+esc(s.d+' '+tr(wk(s.d))+' '+s.t)+' · '+placeHTML(s)+'</span><b>＋</b></button>').join(''):'<p class="pg-none">'+tr('这部影片暂时没有其他待映场次')+'</p>')+
      '<button class="text-button pg-ok" data-gone-ok="'+esc(g.k)+'">'+tr('知道了')+'</button></div>';}).join('')+'</div>'+planMovedHTML();}
document.addEventListener('click',e=>{
  const sw=e.target.closest('[data-gone-swap]');
  if(sw){const to=sw.dataset.to;if(validKeys.has(to)){picked.add(to);saveSelection();}planGoneDrop(sw.dataset.goneSwap);toast(tr('已换成新场次'));if(location.hash==='#plan')planPage();return;}
  const mv=e.target.closest('[data-moved-ok]');
  if(mv){delete planMoved[mv.dataset.movedOk];wjson(PLAN_MOVED_KEY,planMoved);if(location.hash==='#plan')planPage();else mv.closest('.pg-item')?.remove();return;}
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
function showDate(s){return new Date(SparrowTZ.showMs(s,VN,PG));}
function plannerCtx(){return {F,VN,PG,keyOf,durationOf,showMs:s=>SparrowTZ.showMs(s,VN,PG),isPast,nowMs:now(),preferredCity:typeof homeCity==='function'?homeCity():''};}
function planToggleHTML(s){const k=keyOf(s),yes=picked.has(k);return '<button class="plan-toggle '+(yes?'selected':'')+'" data-plan="'+esc(k)+'" aria-pressed="'+yes+'" aria-label="'+(yes?'移出排片 ':'加入排片 ')+esc(F[s.id].cn)+' '+esc(s.d)+' '+s.t+'">'+(yes?'✓ 已加入':'+ 加入排片')+'</button>';}
function showChoiceHTML(s){return '<div class="show-choice"><button class="show" data-jump="'+keyOf(s)+'"><span class="dt">'+s.d+' '+s.t+'</span><span class="x">'+wk(s.d,s.year)+' · '+placeHTML(s)+' · 散场 '+fmt(toMin(s.t)+durationOf(s))+'</span><span class="go">查看排片 ›</span></button>'+planToggleHTML(s)+'</div>';}
function conflicts(list){return SparrowPlanner.findConflicts(list,plannerCtx());}
const regColor = f => ({cn:"#8e2a22",eu:"#2f6f6c",us:"#b26a1f",as:"#5d6b2e"})[f.reg]||"#8e2a22";
const endMin = s => toMin(s.t)+durationOf(s);
const durText = m => m<60 ? m+" 分钟" : Math.floor(m/60)+" 小时"+(m%60?" "+m%60+" 分":"");
function planStats(list){const minutes=list.reduce((n,s)=>n+F[s.id].min,0);return {n:list.length,days:new Set(list.map(s=>s.d)).size,minutes,hm:Math.floor(minutes/60)+"h"+String(minutes%60).padStart(2,"0"),clash:conflicts(list).length};}
function byDay(list){const m=new Map();list.forEach(s=>{if(!m.has(s.d))m.set(s.d,[]);m.get(s.d).push(s);});return [...m.entries()];}
function gapOf(a,b,opt){
  const trn=SparrowPlanner.transfer(a,b,plannerCtx());
  const vb=VN[b.v];
  const g=SparrowPlanner.formatGap(trn,{en:LANG==='en',toVenue:vb?vShort(vb):'',durText:m=>tr(durText(m)),warnPrefix:opt&&opt.warnPrefix});
  return {cls:g.cls,txt:g.txt,tr:trn,mapUrl:vb?SparrowPlanner.mapURL(vb):''};
}
function thumbHTML(f){return pst(f.id)?pimg(f.id,360,'class="pthumb" alt="" loading="lazy"'):'<span class="pthumb pslate" style="background:'+REG[f.reg].c+'">'+esc(f.cn[0])+'</span>';}
function planRowsHTML(list,editable){
  return byDay(list).map(([d,items])=>{
    const first=items[0],last=items[items.length-1];
    let body='';
    items.forEach((s,i)=>{const f=F[s.id];
      if(i){const g=gapOf(items[i-1],s);body+='<li class="pgap '+g.cls+'"><span>'+esc(g.txt)+'</span>'+(editable&&g.mapUrl&&g.tr&&g.tr.kind==='cross'?'<a class="pgap-map" href="'+esc(g.mapUrl)+'" target="_blank" rel="noopener noreferrer">'+tr('地图')+' ›</a>':'')+'</li>';}
      const vMap=editable?SparrowPlanner.mapURL(VN[s.v]):'';
      body+='<li class="pitem" style="--c:'+REG[f.reg].c+'"><div class="ptime"><b>'+s.t+'</b><small>'+fmt(endMin(s))+'</small></div><div class="pcard">'+thumbHTML(f)+'<div class="pinfo"><button class="ptitle" data-film="'+s.id+'"><b>'+esc(f.cn)+'</b>'+(f.version?'<span class="ped">'+esc(f.version)+'</span>':'')+'</button><small>'+(f.dir?esc(f.dir)+' · ':'')+minText(f)+'</small><span class="pvenue">'+placeHTML(s)+(vMap?' <a class="pvenue-map" href="'+esc(vMap)+'" target="_blank" rel="noopener noreferrer">📍 '+tr('地图')+'</a>':'')+'</span></div>'+(editable?'<button class="premove" data-plan="'+esc(keyOf(s))+'" aria-label="移出排片 '+esc(f.cn)+' '+s.d+' '+s.t+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg></button>':'')+'</div></li>';
    });
    return '<section class="pday"><header class="pday-h"><b>'+d+'</b><span>'+wk(d,first.year)+'</span><small>'+items.length+' 场 · '+first.t+' – '+fmt(endMin(last))+'</small></header><ol class="ptl">'+body+'</ol></section>';
  }).join('');
}
function statsHTML(st){return '<div class="pstats"><div><b>'+st.n+'</b><small>场放映</small></div><div><b>'+st.days+'</b><small>天行程</small></div><div><b>'+st.hm+'</b><small>银幕时长</small></div><div class="'+(st.clash?'bad':'good')+'"><b>'+st.clash+'</b><small>时间冲突</small></div></div>';}

/* ===== 冲突一键换场 & 基于「想看」清单的智能排片建议（2026-11-24）===== */
function conflictSwapsHTML(list){
  const swaps=SparrowPlanner.conflictSwaps(list,SH,plannerCtx());
  if(!swaps.length)return '';
  const tagOf=a=>{const ts=[];if(a.sameVenue)ts.push(tr('同影院'));else if(a.sameCity)ts.push(tr('同城'));if(a.sameDay)ts.push(tr('同日'));if(a.sameVenueAdj)ts.push(tr('顺路'));if(a.tight)ts.push(tr('转场偏紧'));return ts.length?'<em>'+ts.join(' · ')+'</em>':'';};
  return '<div class="plan-swaps"><span class="ps-label">'+tr('可一键换成无冲突场次')+'</span>'+swaps.map(sw=>{
    const f=F[sw.from.id];
    return '<div class="ps-item"><div class="ps-head"><strong>'+esc(f?f.cn:sw.from.id)+'</strong><small>'+tr('当前')+' '+esc(sw.from.d+' '+tr(wk(sw.from.d,sw.from.year))+' '+sw.from.t)+'</small></div>'+
      sw.alts.map(a=>'<button type="button" class="pg-alt ps-btn" data-conflict-swap="'+esc(sw.fromKey)+'" data-to="'+esc(a.key)+'"><span>'+tr('换成')+' '+esc(a.show.d+' '+tr(wk(a.show.d,a.show.year))+' '+a.show.t)+' · '+placeHTML(a.show)+tagOf(a)+'</span><b>⇄</b></button>').join('')+'</div>';
  }).join('')+'</div>';
}
function wantFilmIds(){return typeof isWant==='function'?FILMS.filter(f=>isWant(f.id)).map(f=>f.id):[];}
function wantUnplannedCount(){
  const ids=wantFilmIds();if(!ids.length)return 0;
  const planned=new Set(selectedRows().map(s=>s.id));
  return ids.filter(id=>!planned.has(id)&&SH.some(s=>s.id===id&&!isPast(s))).length;
}
function smartPlanButtonHTML(cls){
  const ids=wantFilmIds(),n=wantUnplannedCount();
  const lab=n?tr('想看一键排片')+' ('+n+')':tr('想看一键排片');
  return '<button type="button" class="'+(cls||'secondary-button')+'" data-smart-plan'+(ids.length?'':' data-empty="1"')+'>✦ '+esc(lab)+'</button>';
}
function openSmartPlanDialog(){
  const wantIds=wantFilmIds();
  document.getElementById('smart-plan-dialog')?.remove();
  const d=document.createElement('dialog');
  d.id='smart-plan-dialog';
  d.className='schedule-selector multi smart-plan-dialog';
  d.setAttribute('aria-labelledby','sp-title');
  if(!wantIds.length){
    d.innerHTML='<header class="selector-head"><h2 id="sp-title">'+tr('想看一键排片')+'</h2><button type="button" class="selector-close" data-sp="close" aria-label="'+tr('关闭')+'">×</button></header>'+
      '<div class="sp-empty"><p>'+tr('你的「想看」清单还是空的。在影片页点「☆ 想看」收藏几部想看的电影，这里就能自动为你避开冲突、排出一份行程建议。')+'</p><button type="button" class="primary-button" data-sp="films">'+tr('去片目挑电影')+'</button></div>';
    document.body.appendChild(d);
    d.addEventListener('click',e=>{if(e.target===d||e.target.closest('[data-sp="close"]')){d.close();return;}if(e.target.closest('[data-sp="films"]')){d.close();go('films');}});
    d.addEventListener('close',()=>d.remove());
    d.showModal();
    return;
  }
  const existing=selectedRows();
  const res=SparrowPlanner.suggestPlan(wantIds,existing,SH,plannerCtx());
  const chosen=new Set(res.picks.map(p=>p.key));
  const reasonText=r=>r==='no_upcoming'?tr('暂无待映场次'):r==='all_conflict'?tr('与你已有排片全部冲突'):tr('与其他推荐场次时间冲突');
  const renderBody=()=>{
    const picksHTML=res.picks.length?res.picks.map(p=>{
      const f=F[p.filmId],s=p.show,on=chosen.has(p.key);
      const tags=p.tags.map(tg=>'<i class="sp-tag'+(tg.includes('偏紧')?' warn':'')+'">'+esc(tr(tg))+'</i>').join('');
      return '<button type="button" class="selector-option sp-opt" role="option" aria-selected="'+on+'" data-sp-key="'+esc(p.key)+'"><span><b>'+esc(f.cn)+(f.version?' <em class="ped">'+esc(f.version)+'</em>':'')+'</b><small>'+esc(s.d+' '+tr(wk(s.d,s.year))+' '+s.t+' – '+fmt(endMin(s)))+' · '+placeHTML(s)+'</small>'+(tags?'<span class="sp-tags">'+tags+'</span>':'')+'</span><span class="selector-check" aria-hidden="true">'+(on?'✓':'')+'</span></button>';
    }).join(''):'<p class="selector-empty">'+tr('想看清单里的影片暂时没有可无冲突排入的新场次。')+'</p>';
    const unschedHTML=res.unscheduled.length?'<div class="sp-unsched"><h4>'+tr('未能排入（'+res.unscheduled.length+' 部）')+'</h4><ul>'+res.unscheduled.map(u=>'<li><b>'+esc(F[u.filmId]?.cn||u.filmId)+'</b><span>'+esc(reasonText(u.reason))+'</span></li>').join('')+'</ul></div>':'';
    const summary=res.picks.length
      ? tr('从 '+res.stats.wantTotal+' 部想看影片中，为你排入 '+res.picks.length+' 场无冲突放映')+(res.stats.alreadyCount?'（'+tr('另有 '+res.stats.alreadyCount+' 部已在排片中')+'）':'')
      : (res.stats.alreadyCount?tr('你想看的 '+res.stats.alreadyCount+' 部影片都已经在个人排片里了。'):tr('目前没有能避开冲突排入的新场次。'));
    d.innerHTML='<header class="selector-head"><h2 id="sp-title">'+tr('想看一键排片建议')+'</h2><button type="button" class="selector-close" data-sp="close" aria-label="'+tr('关闭')+'">×</button></header>'+
      '<p class="sp-summary">'+esc(summary)+'<small>'+tr('已选排片保持不变，可取消勾选不需要的场次。')+'</small></p>'+
      '<div class="selector-results" role="listbox" aria-multiselectable="true">'+picksHTML+unschedHTML+'</div>'+
      '<footer class="selector-foot"><small>'+tr('已选 '+chosen.size+' 场')+'</small><button type="button" class="selector-done" data-sp="apply"'+(chosen.size?'':' disabled')+'>'+tr(chosen.size?'加入所选 '+chosen.size+' 场':'关闭')+'</button></footer>';
  };
  renderBody();
  document.body.appendChild(d);
  d.addEventListener('click',e=>{
    if(e.target===d||e.target.closest('[data-sp="close"]')){d.close();return;}
    const opt=e.target.closest('[data-sp-key]');
    if(opt){const k=opt.dataset.spKey;if(chosen.has(k))chosen.delete(k);else chosen.add(k);const sc=d.querySelector('.selector-results')?.scrollTop||0;renderBody();const r2=d.querySelector('.selector-results');if(r2)r2.scrollTop=sc;return;}
    if(e.target.closest('[data-sp="apply"]')){
      let added=0;chosen.forEach(k=>{if(validKeys.has(k)&&!picked.has(k)){picked.add(k);added++;}});
      d.close();
      if(added){saveSelection();stat('plan_add','smart_suggest');toast(tr('已加入 '+added+' 场到个人排片'));if(location.hash==='#plan')planPage();else route();}
    }
  });
  d.addEventListener('close',()=>d.remove());
  addEventListener('hashchange',()=>{if(d.open)d.close();},{once:true});
  d.showModal();
}
document.addEventListener('click',e=>{
  const cs=e.target.closest('[data-conflict-swap]');
  if(cs){
    const from=cs.dataset.conflictSwap,to=cs.dataset.to;
    if(validKeys.has(to)){picked.delete(from);picked.add(to);saveSelection();toast(tr('已换成无冲突场次'));if(location.hash==='#plan')planPage();else route();}
    return;
  }
  if(e.target.closest('[data-smart-plan]'))openSmartPlanDialog();
});
