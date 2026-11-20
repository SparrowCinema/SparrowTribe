/* js/schedule.js — 排片首页：甘特图（时刻表）、日期条、筛选弹层、列表视图、今日我的排片。
   网站脚本按功能拆成 js/*.js，按 index.html 里的顺序加载；部署时 tools/build-assets.js 按同样顺序合并成一个 app.js。 */

const EV_RE=/^(映后活动|Post-screening event)\s*·\s*/;
function evOf(s,f){return EV_RE.test((f&&f.screeningNotes&&f.screeningNotes[keyOf(s)])||"");}
const TAG_SEG=/^(字幕机|Subtitle display)$/; // 场次备注里单独成段（以 · 分隔）的「字幕机」显示成标签
function noteHTML(n){const ev=EV_RE.test(n),parts=n.replace(EV_RE,"").split(/\s*·\s*/),tags=parts.filter(p=>TAG_SEG.test(p)),rest=parts.filter(p=>!TAG_SEG.test(p)).join(" · ");return `<p class="src${ev||tags.length?" ev":""}">${ev?'<span class="ev-tag">映后活动</span>':""}${tags.map(t=>`<span class="ev-tag sub-tag">${esc(t)}</span>`).join("")}${esc(rest)}</p>`;}
function qaForShow(s,f){return f.qaStart&&f.qaEnd&&f.qaGuest&&toMin(f.qaEnd)>toMin(f.qaStart)?{start:toMin(f.qaStart),end:toMin(f.qaEnd)}:null;}
function ganttHTML(k, rowH, labW, compact, list){
  const S = list.length?Math.max(0,Math.floor((Math.min(...list.map(x=>toMin(x.t)))-30)/30)*30):720, E = list.length?Math.max(...list.map(x=>Math.max(toMin(x.t)+durationOf(x),qaForShow(x,F[x.id])?.end||0))):1350, W = Math.round((E-S)*k);
  const allHalls = VENUES.flatMap(v=>v.halls.map(h=>({v:v.id,h:h.id})));
  const multi = new Set(list.map(x=>x.v+"/"+x.h)).size > 1;
  const step = k < 1 ? 120 : 60;
  let ruler = "";
  for(let m=S+step;m<=E;m+=step) ruler += `<span style="left:${Math.round((m-S)*k)}px">${compact?String(m/60|0):fmt(m)}</span>`;
  let rows = "";
  days.forEach(d=>{
    allHalls.forEach(hh=>{
      const hs = list.filter(x=>x.d===d && x.v===hh.v && x.h===hh.h);
      if(!hs.length) return;
      const lab = `<small class="hl">${esc(VN[hs[0].v].name)}</small><small class="hl">${esc(hallOf(hs[0]).name)}</small>`;
      rows += `<div class="g-day" style="height:${rowH}px"><b>${d}</b>${`<small>${wk(d)}</small>`}${lab}</div><div class="g-track" style="width:${W}px;height:${rowH}px">`;
      hs.forEach(x=>{
        const f=F[x.id], st=toMin(x.t), en=st+durationOf(x), w=Math.round(durationOf(x)*k);
        const inner = compact
          ? `<span class="t">${w>=0?esc(f.cn.length>4&&w<60?f.cn.slice(0,3)+"…":f.cn):""}${editionHTML(f)}</span>`
          : `<span class="t">${esc(f.cn)}${editionHTML(f)}</span><span class="m">${x.t}–${fmt(en)} · ${f.min}′</span>${langSub(f)?`<span class="l">${esc(langSub(f))}</span>`:""}`;
        const tag = compact ? "span" : "button";
        rows += `<${tag} class="blk fc${f.ev?" blk-evs":""}" ${compact?"":`data-film="${x.id}"`} data-key="${keyOf(x)}" style="--h:${fhue(x.id)};left:${Math.round((st-S)*k)}px;width:${w}px" aria-label="${d} ${x.t} ${esc(f.cn)}">${inner}</${tag}>`;const qa=qaForShow(x,f);if(qa)rows+=`<${tag} class="g-qa" ${compact?"":`data-film="${x.id}"`} style="left:${Math.round((qa.start-S)*k)}px;width:${Math.max(1,Math.round((qa.end-qa.start)*k))}px" title="映后交流 ${esc(f.qaStart)}–${esc(f.qaEnd)} · ${esc(f.qaGuest)}" aria-label="映后交流 ${esc(f.qaStart)}至${esc(f.qaEnd)}"><span>${compact?"映后":"映后交流"}</span></${tag}>`;
      });
      rows += `</div>`;
    });
  });
  return `<div class="gantt${compact?" compact":""}" id="gantt" style="--px:${k}px" ${compact?'data-open-gantt role="button" tabindex="0" aria-label="打开完整排片"':""}><div class="g-inner" style="grid-template-columns:${labW}px auto">
    <div class="g-corner">${compact?"":"日期"}</div><div class="g-ruler" style="width:${W}px">${ruler}</div>${rows}</div></div>`;
}
const SPAN = toMin("22:30")-toMin("12:00");
function fitK(labW){ const app=document.querySelector(".app"); const w=(app?app.clientWidth:window.innerWidth) - 2*Math.max(16,0) - labW - 4; return w/SPAN; }

const stripCity = (name,v) => String(name||"").replace(new RegExp("^("+[v.city,tr(v.city||"")].filter(Boolean).join("|")+")\\s*[·・]?\\s*"),"");
const venueLabel = v => (v.city?tr(v.city)+" · ":"")+stripCity(v.name,v);
const vShort = v => (v.city?v.city+" · ":"")+stripCity(v.short || v.brand || v.name,v);
const hShort = h => h.short || h.name;
const pad2 = n => String(n).padStart(2,"0");
let sday = null;
function todayKey(){ const t=new Date(); return (t.getMonth()+1)+"/"+t.getDate(); }
function pickDay(ds){
  if(sday && ds.includes(sday)) return sday;
  const t=new Date(now()); t.setHours(0,0,0,0);
  const up = ds.find(d=>{const [m,dd]=d.split("/").map(Number);return new Date(year(d),m-1,dd)>=t;});
  return up || ds[0] || null;
}
function dayStripHTML(ds, list){
  let lastM="";
  return `<div class="dstrip filters" role="tablist" aria-label="选择日期">${ds.map(d=>{
    const [m,dd]=d.split("/"); const n=list.filter(x=>x.d===d).length; const mine=SH.some(x=>x.d===d&&picked.has(keyOf(x)));
    const mon = m!==lastM ? `<em>${m}月</em>` : `<em>&nbsp;</em>`; lastM=m;
    const gone=list.filter(x=>x.d===d).every(isPast);
    return `<button class="dchip${gone?" past":""}" role="tab" data-day="${d}" aria-selected="${d===sday}">${mon}<b>${dd}</b><small>${wk(d)}</small><span class="dn">${n} 场</span>${mine?'<i class="dme" title="有我的排片"></i>':''}</button>`;
  }).join("")}</div>`;
}
// 单日时刻表：纵轴为时间，横向每列一个影厅
const POST_MIN=30; // 映后活动：甘特图在影片结束后预留 30 分钟
function timetableHTML(day, list){
  const ds = list.filter(x=>x.d===day);
  if(!ds.length) return "";
  const cols=[]; VENUES.forEach(v=>v.halls.forEach(h=>{ if(ds.some(x=>x.v===v.id&&x.h===h.id)) cols.push({v,h}); }));
  let S=Math.min(...ds.map(x=>toMin(x.t))), E=Math.max(...ds.map(x=>Math.max(toMin(x.t)+durationOf(x)+(evOf(x,F[x.id])?POST_MIN:0),qaForShow(x,F[x.id])?.end||0)));
  // The current-time marker is shown only inside the screening window.
  const nowD=new Date(now()), isToday=(nowD.getMonth()+1)+"/"+nowD.getDate()===day;
  // Add a bounded lead-in, independent of the current time.
  S=Math.max(0,Math.floor((S-30)/30)*30);
  E=Math.ceil(E/60)*60; if(E-S<180) E=S+180;
  const K=1.8, H=Math.round((E-S)*K);
  let axis=""; for(let m=S;m<=E;m+=60) axis+=`<span style="top:${Math.round((m-S)*K)}px">${fmt(m)}</span>`;
  const colHTML = cols.map(({v,h})=>{
    const items = ds.filter(x=>x.v===v.id&&x.h===h.id).map(x=>{
      const f=F[x.id], st=toMin(x.t), top=Math.round((st-S)*K), ht=Math.max(78,Math.round(durationOf(x)*K)-3), mine=picked.has(keyOf(x)), gone=isPast(x);
      return `<button class="tt-b fc${f.ev?" tt-evs":""}${mine?" mine":""}${gone?" past":""}" data-film="${x.id}" data-key="${keyOf(x)}" style="--h:${fhue(x.id)};top:${top}px;height:${ht}px" aria-label="${d2(x)} ${esc(f.cn)} ${esc(placeOf(x))}"><b class="tt-s">${x.t}${evOf(x,f)?'<i class="tt-ev">映后</i>':""}</b>${f.ev?`<span class="tt-evk">${esc(tr("活动"))}</span>`:""}<span class="tt-n">${esc(f.cn)}</span>${f.version?`<span class="tt-v">${esc(f.version)}</span>`:""}${langSub(f)?`<span class="tt-l">${esc(langSub(f))}</span>`:""}<span class="tt-e">${gone?"已放映":`至 ${fmt(st+durationOf(x))}${f.minTbd?"":` · ${f.min}′`}`}</span></button>${(()=>{if(!evOf(x,f)||qaForShow(x,f))return "";const pe=st+durationOf(x),nx=Math.min(Infinity,...ds.filter(y=>y.v===v.id&&y.h===h.id&&toMin(y.t)>st).map(y=>toMin(y.t))),pm=Math.min(POST_MIN,nx-pe);if(pm<10)return "";/* 同厅下一场开场前截止，避免压住下一场 */return `<div class="tt-post" style="top:${top+Math.round(durationOf(x)*K)}px;height:${Math.round(pm*K)-3}px" aria-label="映后活动 ${fmt(pe)}至${fmt(pe+pm)}"><b>映后</b><small>${fmt(pe)}–${fmt(pe+pm)}</small></div>`;})()}${qaForShow(x,f)?`<button class="tt-qa" data-film="${x.id}" style="top:${Math.round((qaForShow(x,f).start-S)*K)}px;height:${Math.max(24,Math.round((qaForShow(x,f).end-qaForShow(x,f).start)*K)-3)}px" aria-label="映后交流 ${esc(f.qaStart)}至${esc(f.qaEnd)}"><b>映后交流</b><small>${esc(f.qaStart)}–${esc(f.qaEnd)}</small></button>`:""}${gone&&!mine?"":`<button class="tt-add fa${mine?" on":""}" data-plan="${keyOf(x)}" aria-pressed="${mine}" style="--h:${fhue(x.id)};top:${top+5}px" aria-label="${mine?"移出排片":"加入排片"} ${esc(f.cn)} ${d2(x)}">${mine?"✓":"+"}</button>`}`;
    }).join("");
    return `<div class="tt-col"><div class="tt-h" title="${esc(v.name)} · ${esc(h.name)}"><b>${esc(vShort(v))}</b><small>${esc(hShort(h))}</small></div><div class="tt-body" style="height:${H+16}px">${items}</div></div>`;
  }).join("");
  const nowLine=isToday?`<div class="tt-now" aria-hidden="true" hidden><i></i></div>`:"";
  const nowLab=isToday?`<b class="tt-nowlab" aria-hidden="true" hidden></b>`:"";
  return `<div class="tt" id="gantt" data-ttday="${day}" data-s="${S}" data-e="${E}" data-k="${K}"><div class="tt-grid" style="--n:${cols.length};--hh:${Math.round(60*K)}px;--hlf:${Math.round(30*K)}px">${nowLine}
    <div class="tt-axis"><div class="tt-h tt-corner">时间</div><div class="tt-ticks" style="height:${H+16}px">${axis}${nowLab}</div></div>${colHTML}</div></div>`;
}
const d2 = x => `${x.d} ${wk(x.d)} ${x.t}`;
// 当前时间线：像 iPhone 日历一样，在今天的时刻表上画一条红线，并每 30 秒移动一次
function updateNowLine(){
  const g=document.getElementById("gantt"); if(!g||!g.dataset.k) return;
  const line=g.querySelector(".tt-now"), lab=g.querySelector(".tt-nowlab"); if(!line||!lab) return;
  const t=new Date(now()), m=t.getHours()*60+t.getMinutes(), S=+g.dataset.s, E=+g.dataset.e, K=+g.dataset.k;
  const same=(t.getMonth()+1)+"/"+t.getDate()===g.dataset.ttday, show=same&&m>=S&&m<=E;
  line.hidden=lab.hidden=!show; if(!show) return;
  const y=Math.round((m-S)*K); line.style.top="calc(46px + "+y+"px)"; lab.style.top=y+"px"; lab.textContent=fmt(m);
}
setInterval(()=>{ if(document.visibilityState==="visible") updateNowLine(); },30000);
const filterChevron='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m4 6 4 4 4-4"/></svg>';
function scheduleFiltersHTML(){
 const fields=[["programme","专题",selLabel(pfilt,"全部专题",i=>PG[i]?.name||i,"个专题"),pfilt],["city","城市",selLabel(cityFilt,"全部城市",i=>tr(i),"座城市"),cityFilt],["venue","影院",selLabel(vfilt,"全部影院",i=>VN[i]?venueLabel(VN[i]):i,"家影院"),vfilt]];
 return `<div class="schedule-filterbar" aria-label="排片筛选">${fields.map(([type,label,value,id])=>`<button class="schedule-filter${id!=="all"?" active":""}" data-schedule-filter="${type}" aria-haspopup="dialog" aria-label="${esc(label+"："+value)}"><span><small>${label}</small><b>${esc(value||"")}</b></span>${filterChevron}</button>`).join("")}</div>${cityAuto&&cityFilt!=="all"?`<div class="filter-reset-row city-hint"><span>${tr("默认只看所在城市")} · <b>${esc(tr(cityFilt))}</b></span><button class="filter-reset" data-city-all>${tr("看全部城市")} ›</button></div>`:fields.some(x=>x[3]!=="all")?`<div class="filter-reset-row"><button class="filter-reset" data-reset-schedule>重置筛选 ↺</button></div>`:""}`;
}
function selectorOptions(type,query=""){
 const q=query.trim().toLocaleLowerCase(),matches=x=>!q||x.toLocaleLowerCase().includes(q);
 const shows=SH.filter(x=>!isPast(x));
 let rows;
 if(type==="programme")rows=[{id:"all",name:tr("全部专题"),sub:tr("查看所有专题的排片"),selected:!selList(pfilt).length},...progOrdered().filter(p=>progStatus(p)!=="ended"||selList(pfilt).includes(p.id)).map(p=>({id:p.id,name:p.name,sub:[p.city,p.period].filter(Boolean).join(" · "),selected:selList(pfilt).includes(p.id)}))];
 else if(type==="city")rows=[{id:"all",name:tr("全部城市"),sub:"",selected:!selList(cityFilt).length},...[...new Set(VENUES.map(v=>v.city).filter(Boolean))].map(c=>({id:c,name:tr(c),sub:tr(VENUES.filter(v=>v.city===c).length+" 家"),selected:selList(cityFilt).includes(c)}))];
 else rows=[{id:"all",name:tr("全部影院"),sub:!selList(cityFilt).length?tr("所有城市"):selList(cityFilt).map(tr).join(" · "),selected:!selList(vfilt).length},...VENUES.filter(v=>selHas(cityFilt,v.city)).map(v=>{const n=shows.filter(x=>x.v===v.id&&inProg(x)).length;return {id:v.id,n,name:venueLabel(v),sub:[tr(n+" 场"),...v.halls.map(h=>h.name)].filter(Boolean).join(" · "),selected:selList(vfilt).includes(v.id)};}).sort((a,b)=>Number(b.n>0)-Number(a.n>0))];
 return rows.filter(x=>matches(x.name+" "+x.sub)).map(x=>`<button class="selector-option" role="option" aria-selected="${x.selected}" data-filter-value="${esc(x.id)}"><span><b>${esc(x.name)}</b>${x.sub?`<small>${esc(x.sub)}</small>`:""}</span><span class="selector-check" aria-hidden="true">${x.selected?"✓":""}</span></button>`).join("")||`<p class="selector-empty" role="status">${type==="programme"?"没有匹配的专题":type==="city"?"没有匹配的城市":"没有匹配的影院"}</p>`;
}
function listRowsHTML(rows,q,empty){const m=q.trim().toLocaleLowerCase();return rows.filter(x=>!m||(x.name+" "+x.sub).toLocaleLowerCase().includes(m)).map(x=>`<button class="selector-option" role="option" aria-selected="${x.selected}" data-filter-value="${esc(x.id)}"><span><b>${esc(x.name)}</b>${x.sub?`<small>${esc(x.sub)}</small>`:""}</span><span class="selector-check" aria-hidden="true">${x.selected?"✓":""}</span></button>`).join("")||`<p class="selector-empty" role="status">${empty}</p>`;}
const secLabel=n=>(n||"全部单元").replace("功夫·功夫：","功夫：");
function sectionRows(pid){const p=PG[pid],sec=p.sections||{},names=[...new Set(Object.values(sec))],cnt=n=>FILMS.filter(f=>sec[f.id]===n).length;return [{id:"",name:tr("全部单元"),sub:tr(FILMS.filter(f=>sec[f.id]||f.prog===pid).length+" 部影片"),selected:sectionFilter===""},...names.map(n=>({id:n,name:tr(secLabel(n)),sub:tr(cnt(n)+" 部影片"),selected:sectionFilter===n}))];}
function evKindRows(pid){const p=PG[pid],ks=(p.eventKinds||[]).filter(k=>p.events.some(e=>e.kind===k.id)),kn=k=>(LANG==="en"&&p.kindEn&&p.kindEn[k.id])||k.name;return [{id:"",name:tr("全部活动"),sub:tr(p.events.length+" 项"),selected:evKind===""},...ks.map(k=>({id:k.id,name:kn(k),sub:tr(p.events.filter(e=>e.kind===k.id).length+" 项"),selected:evKind===k.id}))];}
function selectorContent(type,scope,q=""){return scope==="poster"?listRowsHTML(posterSelectorRows(type),q,tr("没有匹配的结果")):scope==="section"?listRowsHTML(sectionRows(sectionProgramme),q,"没有匹配的单元"):scope==="evkind"?listRowsHTML(evKindRows(evProg),q,"没有匹配的板块"):scope==="showf"?listRowsHTML(showfRows(type),q,tr("没有匹配的结果")):scope==="tyear"?listRowsHTML(tasteYearRows(),q,tr("没有匹配的结果")):scope==="tprog"?listRowsHTML(tasteProgRows(),q,tr("没有匹配的结果")):scope==="plan"?planSelectorOptions(q):scope==="films"?filmSelectorOptions(type,q):selectorOptions(type,q);}
function openScheduleSelector(type,scope="schedule"){
 document.getElementById("schedule-selector")?.remove();
 const title=scope==="tyear"?tr("观影年份"):scope==="tprog"?tr("专题"):scope==="showf"?tr(type==="date"?"选择放映日期":"选择影院"):scope==="poster"?tr({programme:"专题",mode:"海报墙",period:"观影时间"}[type]):scope==="section"?"选择单元":scope==="evkind"?"选择板块":(scope==="films"?{programme:"选择专题",year:"选择年份",city:"选择城市",region:"选择地区",length:"选择片长",personal:"我的影片"}:{programme:"选择专题",city:"选择城市",venue:"选择影院"})[type],placeholder=scope==="tyear"?tr("搜索年份"):scope==="tprog"?tr("搜索专题"):scope==="showf"?tr(type==="date"?"搜索日期":"搜索影院或城市"):scope==="poster"?tr(type==="programme"?"搜索专题":"搜索"):scope==="section"?"搜索单元":scope==="evkind"?"搜索板块":(scope==="films"?{programme:"搜索专题",year:"搜索年份",city:"搜索城市",region:"搜索地区",length:"搜索片长",personal:"搜索我的分类"}:{programme:"搜索专题",city:"搜索城市",venue:"搜索影院、城市或影厅"})[type];if(!title)return;
 const multi=scope==="showf"||scope==="schedule"||scope==="films"||scope==="plan";
 const d=document.createElement("dialog");d.id="schedule-selector";d.className="schedule-selector"+(multi?" multi":"");d.dataset.type=type;d.dataset.scope=scope;d.setAttribute("aria-labelledby","selector-title");
 d.innerHTML=`<header class="selector-head"><h2 id="selector-title">${title}</h2><button class="selector-close" aria-label="关闭筛选">×</button></header><label class="selector-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><input type="search" id="schedule-filter-search" aria-label="${placeholder}" placeholder="${placeholder}" autocomplete="off"></label><div class="selector-results" id="selector-results" role="listbox" aria-multiselectable="${multi}" aria-label="${title}">${selectorContent(type,scope)}</div>${multi?`<footer class="selector-foot"><small>可多选</small><button type="button" class="selector-done">完成</button></footer>`:""}`;
 document.body.append(d);d.querySelector('.selector-close').onclick=()=>d.close();const done=d.querySelector('.selector-done');if(done)done.onclick=()=>d.close();
 d.addEventListener('close',()=>{if(!d._dirty)return;if(scope==='schedule'){sday=null;schedule();}else if(scope==='films')films();else if(scope==='plan')route();else if(scope==='poster')posterWallPage();else if(scope==='showf')sfRerender();});/* 多选：勾选时只更新状态，关闭弹层时才重绘页面 */
d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();});
 d.addEventListener('close',()=>{d.remove();document.querySelector(scope==="showf"?`[data-showf-filter="${type}"]`:scope==="section"?"[data-section-sel]":scope==="evkind"?"[data-evkind-sel]":`[data-${scope==="poster"?"poster":scope==="plan"?"plan":scope==="films"?"film":"schedule"}-filter="${type}"]`)?.focus({preventScroll:true});});
 d.addEventListener('keydown',e=>{const opts=[...d.querySelectorAll('.selector-option')];if(!opts.length)return;if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const i=opts.indexOf(document.activeElement),next=e.key==='ArrowDown'?(i+1)%opts.length:(i<0?opts.length-1:(i-1+opts.length)%opts.length);opts[next].focus();}});
 const sy=window.scrollY,B=document.body.style,keep={p:B.position,t:B.top,w:B.width};B.position='fixed';B.top=-sy+'px';B.width='100%';/* 弹层打开时锁住底层页面与甘特图，滑动只发生在弹层内 */
 d.addEventListener('touchmove',e=>{const r=e.target.closest('.selector-results');if(!r||r.scrollHeight<=r.clientHeight+1)e.preventDefault();},{passive:false});
 d.addEventListener('close',()=>{B.position=keep.p;B.top=keep.t;B.width=keep.w;if(!d._nav)window.scrollTo({top:sy,behavior:'instant'});});
 d.showModal();if(matchMedia('(min-width:700px)').matches)d.querySelector('input').focus();
}
document.addEventListener("input",e=>{if(e.target.id!=="schedule-filter-search")return;const d=e.target.closest('dialog');d.querySelector('#selector-results').innerHTML=selectorContent(d.dataset.type,d.dataset.scope,e.target.value);});
document.addEventListener("click",e=>{
 const posterTrigger=e.target.closest('[data-poster-filter]');if(posterTrigger){openScheduleSelector(posterTrigger.dataset.posterFilter,'poster');return;}
 const mineLink=e.target.closest('[data-library-mine]');if(mineLink){fmine=mineLink.dataset.libraryMine;ffilt=fcity=fyear=freg=flen='all';fq='';go('films');return;}
 const filmTrigger=e.target.closest('[data-film-filter]');if(filmTrigger){openScheduleSelector(filmTrigger.dataset.filmFilter,'films');return;}
 const filmReset=e.target.closest('[data-reset-library]');if(filmReset){ffilt=fmine=fcity=fyear=freg=flen='all';fq='';films();return;}
 const secTrigger=e.target.closest('[data-section-sel]');if(secTrigger){openScheduleSelector('section','section');return;}
 const evTrigger=e.target.closest('[data-evkind-sel]');if(evTrigger){openScheduleSelector('evkind','evkind');return;}
 const tyT=e.target.closest('[data-tyear]');if(tyT){openScheduleSelector('year','tyear');return;}
 const tpT=e.target.closest('[data-tprog]');if(tpT){openScheduleSelector('programme','tprog');return;}
 const planTrigger=e.target.closest('[data-plan-filter]');if(planTrigger){openScheduleSelector('programme','plan');return;}
 const trigger=e.target.closest('[data-schedule-filter]');if(trigger){openScheduleSelector(trigger.dataset.scheduleFilter);return;}
 const reset=e.target.closest('[data-reset-schedule]');if(reset){pfilt=vfilt=cityFilt="all";sday=null;try{localStorage.removeItem(CITY_PREF);}catch(e){}cityInit=false;schedule();return;}
 const call=e.target.closest('[data-city-all]');if(call){cityFilt="all";cityManual(true);sday=null;schedule();return;}
 const option=e.target.closest('[data-filter-value]');if(!option)return;const d=option.closest('dialog'),type=d.dataset.type,value=option.dataset.filterValue;
 if(d.dataset.scope==='tyear'){tasteYear=value;if(value)tasteProg='';d.close();route();return;}
 if(d.dataset.scope==='tprog'){tasteProg=value;if(value)tasteYear='';d.close();route();return;}
 if(d.dataset.scope==='section'){sectionFilter=value;const y=window.scrollY;route();d.close();window.scrollTo(0,y);return;}
 if(d.dataset.scope==='evkind'){evKind=value;const y=window.scrollY;route();d.close();window.scrollTo(0,y);return;}
if(d.dataset.scope==='showf'){const f=F[FSF.id];if(f){const st=sfState(f),k=type==='date'?'d':'v';if(value==='all')st[k]=[];else{const i=st[k].indexOf(value);if(i>=0)st[k].splice(i,1);else st[k].push(value);}d._dirty=1;const sr=d.querySelector('#selector-results'),top=sr.scrollTop;sr.innerHTML=selectorContent(type,'showf',d.querySelector('#schedule-filter-search').value);sr.scrollTop=top;}return;}
if(d.dataset.scope==='poster'){if(type==='programme'){posterProgramme=value==='all'?'all':value;posterWallPage();d.close();}else{if(type==='mode'){posterMode=value;posterSelection='';}else posterSelection=value;posterWallPage();d.close();}return;}
const nx=cur=>value==='all'?'all':selToggle(cur,value);
 if(d.dataset.scope==='plan')planFilt=nx(planFilt);
 else if(d.dataset.scope==='films'){if(type==='programme'){ffilt=nx(ffilt);fyear='all';}else if(type==='year')fyear=nx(fyear);else if(type==='region')freg=nx(freg);else if(type==='length')flen=nx(flen);else if(type==='city')fcity=nx(fcity);else fmine=nx(fmine);}
 else if(type==='programme'){pfilt=nx(pfilt);vfilt=cityFilt='all';cityManual();}
 else if(type==='city'){cityFilt=nx(cityFilt);cityManual(true);const cs=selList(cityFilt);vfilt=selList(vfilt).filter(v=>!cs.length||cs.includes(VN[v]?.city)).join(',')||'all';}
 else{vfilt=nx(vfilt);cityManual();}
 d._dirty=1;const sr=d.querySelector('#selector-results'),top=sr.scrollTop;sr.innerHTML=selectorContent(type,d.dataset.scope,d.querySelector('#schedule-filter-search').value);sr.scrollTop=top;
});
window.addEventListener('hashchange',()=>{const d=document.getElementById('schedule-selector');if(d){d._nav=1;d.close();}});
// 首页顶部：今天我的排片中尚未散场的场次，按时间线排列
function myTodayHTML(){
  // 今天还有没散场的就显示今天；今天都散场后顺延到之后最近一个有排片的日子（到了当天自动变回「今日」）
  const upc=selectedRows().filter(x=>!isPast(x)); if(!upc.length) return location.hash==="#my"?`<section class="my-today today-empty"><div><h3>下一场，去哪里？</h3><p>加入场次后，这里会显示你的今日行程。</p></div><button class="secondary-button" data-tab="schedule">去选电影</button></section>`:"";
  const key=upc[0].d, t0=new Date(now()); t0.setHours(0,0,0,0); const d0=showDate(upc[0]); d0.setHours(0,0,0,0);
  const off=Math.round((d0-t0)/864e5), list=upc.filter(x=>x.d===key);
  const head=off<=0?"今日我的排片":off===1?"明日我的排片":"近期我的排片", cnt=off<=0?`接下来 ${list.length} 场`:off===1?`${list.length} 场`:`${off} 天后 · ${list.length} 场`;
  const more=list.length>1;
  const chev='<i class="tt-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></i>';
  return `<section class="my-today${more?" foldable":""}${more&&todayOpen?" open":""}"><h3 class="blockh">${head} <small>${key.replace("/","月")}日 ${wk(key)} · ${cnt}</small></h3>${planRowsHTML(list,false)}${more?`<button class="today-toggle" data-today-toggle aria-expanded="${todayOpen}"><span class="tt-txt">${todayOpen?"收起":`还有 ${list.length-1} 场 · 展开全部`}</span>${chev}</button>`:""}</section>`;
}
let todayOpen=false;
let scheduleView='gantt';try{scheduleView=localStorage.getItem('sparrow-schedule-view')||'gantt';}catch{}
const VIEW_GRID='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/></svg>',VIEW_LIST='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h3v3H3zM9 4h12v3H9zM3 10.5h3v3H3zM9 10.5h12v3H9zM3 17h3v3H3zM9 17h12v3H9z"/></svg>';
function scheduleViewsHTML(){return `<div class="schedule-tools">${mineOnlyHTML()}<div class="view-switch" role="group" aria-label="排片视图">${[['gantt','时间轴',VIEW_GRID],['list','清单',VIEW_LIST]].map(([id,name,icon])=>`<button data-schedule-view="${id}" aria-label="${name}" title="${name}" aria-pressed="${scheduleView===id}">${icon}</button>`).join('')}</div></div>`;}
function mpaBadgeHTML(f){const code=f.mpa?.rating,known=['G','PG','PG-13','R','NC-17'].includes(code);if(!known)return '';return `<abbr class="mpa-badge" title="${tr(known?'美国MPA分级，参考美国发行版本':'未查到美国MPA分级，不代表全年龄适宜')}">${known?code:'—'}</abbr>`;}
function compactScheduleHTML(list){return VENUES.filter(v=>list.some(x=>x.v===v.id)).map(v=>`<section class="cinema-list"><h3>${esc(venueLabel(v))}</h3>${v.halls.filter(h=>list.some(x=>x.v===v.id&&x.h===h.id)).map(h=>`<section class="hall-list"><h4>${esc(h.name)}</h4>${list.filter(x=>x.v===v.id&&x.h===h.id).map(x=>{const f=F[x.id];return `<div class="agenda-choice"><button class="ag-row" data-film="${x.id}"><span class="tm">${x.t}</span><span class="bar fc" style="--h:${fhue(x.id)}"></span><span class="nm"><b>${esc(f.cn)}${editionHTML(f)}</b><small>${f.mpa?.rating?'':esc(f.dir||'')+(f.dir?' · ':'')}${minText(f)}${evOf(x,f)?' · '+tr('主创映后'):''}</small></span>${mpaBadgeHTML(f)}</button>${planToggleHTML(x)}</div>`;}).join('')}</section>`).join('')}</section>`).join('')+(list.some(x=>F[x.id].mpa?.rating)?`<p class="rating-key">${tr('分级参考美国MPA发行版本，实际放映版本可能不同。')}</p>`:'');}
document.addEventListener('click',e=>{const b=e.target.closest('[data-schedule-view]');if(!b)return;scheduleView=b.dataset.scheduleView;try{localStorage.setItem('sparrow-schedule-view',scheduleView);}catch{}const y=window.scrollY;schedule();window.scrollTo(0,y);});
let onlyMine=false;try{onlyMine=localStorage.getItem('sparrow-only-mine')==='1';}catch{}
document.addEventListener("click",e=>{const b=e.target.closest("[data-today-toggle]");if(!b)return;todayOpen=!todayOpen;const sec=b.closest(".my-today");if(!sec)return;sec.classList.toggle("open",todayOpen);b.setAttribute("aria-expanded",String(todayOpen));const n=sec.querySelectorAll(".pitem").length;b.querySelector(".tt-txt").textContent=todayOpen?"收起":"还有 "+(n-1)+" 场 · 展开全部";});
function mineOnlyHTML(){const n=SH.filter(x=>inProg(x)&&!isPast(x)&&picked.has(keyOf(x))).length;
  return `<div class="mine-only"><button type="button" class="mine-chip${onlyMine?" on":""}" data-mine-only aria-pressed="${onlyMine}"><i aria-hidden="true">✓</i>只看我的排片<small>${n}</small></button>${geoChipHTML()}</div>`;}
document.addEventListener("click",e=>{const b=e.target.closest("[data-mine-only]");if(!b)return;onlyMine=!onlyMine;try{localStorage.setItem('sparrow-only-mine',onlyMine?'1':'0');}catch{}const y=window.scrollY;schedule();window.scrollTo(0,y);});
function schedule(){
  cityDefault();
  const list = SH.filter(x=>selHas(vfilt,x.v)&&selHas(cityFilt,VN[x.v]?.city)&&inProg(x)&&!isPast(x)&&(!onlyMine||picked.has(keyOf(x))));
  const ds = days.filter(d=>list.some(x=>x.d===d));
  sday = pickDay(ds);
  const pl = SH.filter(x=>inProg(x)&&!isPast(x)), cur = selList(pfilt).length===1?PG[pfilt]:null;
  const vlist = VENUES.filter(v=>pl.some(x=>x.v===v.id)||selList(vfilt).includes(v.id));
  const dayList = list.filter(x=>x.d===sday).sort((a,b)=>toMin(a.t)-toMin(b.t));
  main.innerHTML = `<section class="view gut">
    ${myTodayHTML()}
    <h2 class="sec">排片表</h2><p class="sub">${cur?`${esc(cur.name)}${cur.city?` · ${esc(cur.city)}`:""} · `:""}${list.length?`${dateSpan(list)} · ${list.length} 场 · `:""}按日期查看，点击色块看影片</p>
    ${scheduleFiltersHTML()}
    ${scheduleViewsHTML()}
    ${ds.length?dayStripHTML(ds,list):""}
    ${sday?`<div class="tt-cap"><b>${sday.replace("/","月")}日 ${wk(sday)}</b><span>${dayList.length} 场 · ${new Set(dayList.map(x=>x.v+x.h)).size} 个影厅</span></div>
    ${scheduleView==="gantt"?'<div class="legend"><span>每部影片一种颜色 · 色块标注版本、对白语言与字幕</span></div>':''}
    ${scheduleView==="gantt"?timetableHTML(sday,list):compactScheduleHTML(dayList)}`:onlyMine?`<div class="g-empty"><b>当前筛选下还没有你加入的场次</b><span>关掉「只看我的排片」，在排片表点色块右上角的 + 加入</span></div>`:`<div class="g-empty"><b>${vfilt!=="all"&&VN[vfilt]?esc(VN[vfilt].name):"当前筛选"}暂无排片</b><span>排片公布后会更新到这里</span></div>`}
    ${presentersHTML()}</section>`;
  const strip=document.querySelector(".dstrip [aria-selected=true]"); if(strip){ const p=strip.parentElement; p.scrollLeft=Math.max(0,strip.offsetLeft-p.clientWidth/2+strip.clientWidth/2); }
  flashIn(document.getElementById("gantt"));
  updateNowLine();
  fitTools();requestAnimationFrame(fitTools);
}
function fitTools(){const el=document.querySelector(".schedule-tools .mine-only");if(!el)return;let k=1;el.style.setProperty("--k",k);while(el.scrollWidth>el.clientWidth+1&&k>0.62){k=Math.round((k-0.04)*100)/100;el.style.setProperty("--k",k);}}
{let ft;addEventListener("resize",()=>{clearTimeout(ft);ft=setTimeout(fitTools,120);});}

function flashIn(g){
  if(!pendingFlash||!g) return false;
  const bk=g.querySelector(`[data-key="${pendingFlash}"]`); pendingFlash=null;
  if(!bk) return false;
  g.scrollLeft = Math.max(0, bk.parentElement.parentElement.offsetLeft - 60); bk.scrollIntoView({block:"center"}); bk.classList.add("flash"); return true;
}
