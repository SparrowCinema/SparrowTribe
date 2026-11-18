/* js/programmes.js — 专题页与影展活动、关于。
   网站脚本按功能拆成 js/*.js，按 index.html 里的顺序加载；部署时 tools/build-assets.js 按同样顺序合并成一个 app.js。 */

// 下一场优先取定位城市的场次（list 已按时间升序），没有再取最早的一场
function localFirst(list){const c=geoActiveCity();if(c){const v=VENUES.filter(x=>x.city===c).map(x=>x.id),hit=list.find(s=>v.includes(s.v));if(hit)return hit;}return list[0];}
function progFilmSub(f,pid,ended){ // 与小程序一致：版本 · 下一场日期时间，单行
  const ed=editionOf(f), mine=SH.filter(x=>x.id===f.id&&x.p===pid).sort((x,y)=>showDate(x)-showDate(y)), next=ended?null:localFirst(mine.filter(x=>!isPast(x)));
  const when=next?next.d+" "+next.t:(!mine.length&&!ended?(isInternalIn(f,PG[pid])?"内部放映":"场次待公布"):"");
  return [ed,when].filter(Boolean).map(x=>"<span>"+esc(x)+"</span>").join(""); }
function progFilmCard(f,pid,ended){ const sub=progFilmSub(f,pid,ended); return `<button class="pg-film" data-film="${f.id}">${pst(f.id)?pimg(f.id,360,'alt="" loading="lazy"'):`<span class="pg-ph" style="background:${REG[f.reg].c}">${esc(f.cn[0])}</span>`}<span class="pg-caption"><b class="pg-name">${esc(f.cn)}</b>${sub?`<span class="pg-sub1">${sub}</span>`:""}</span></button>`; }
// 专题页影片分组：即将放映（含场次待公布）按下一场先后；已结束按最近一场由近及远
function progFilmGroups(pid,films){
  const up=[], gone=[];
  films.forEach(f=>{ const mine=SH.filter(s=>s.id===f.id&&s.p===pid).sort((a,b)=>showDate(a)-showDate(b)), next=mine.find(s=>!isPast(s));
    if(next||(!mine.length&&!f.ended)) up.push({f,at:next?showDate(next):Infinity}); else gone.push({f,at:mine.length?showDate(mine[mine.length-1]):relTime(f)}); }); // f.ended：已下映、本站未收录场次的影片直接归入已结束
  up.sort((a,b)=>(a.at===b.at?0:a.at<b.at?-1:1)||filmOrder(a.f,b.f)); gone.sort((a,b)=>b.at-a.at||a.f.cn.localeCompare(b.f.cn,"zh"));
  return {up:up.map(x=>x.f), gone:gone.map(x=>x.f)};
}
function progFilmsHTML(pid,films){
  const {up,gone}=progFilmGroups(pid,films.filter(f=>!sectionFilter||PG[pid].sections?.[f.id]===sectionFilter));
  const grid=(list,ended)=>`<div class="pg-grid">${list.map(f=>progFilmCard(f,pid,ended)).join("")}</div>`;
  const upHTML=up.length?`<h3 class="blockh pg-grp" id="pg-up">即将放映 <small>UPCOMING · ${up.length} 部</small></h3>${grid(up)}`:`<h3 class="blockh pg-grp" id="pg-up">即将放映 <small>UPCOMING · 0 部</small></h3><div class="fd-noshow"><b>暂无待映场次</b><span>新场次公布后会更新到这里。</span></div>`;
  const goneHTML=gone.length?`<details class="pg-ended" id="pg-gone"${up.length?"":" open"}><summary class="blockh pg-grp">已结束 <small>ENDED · ${gone.length} 部</small></summary>${grid(gone,true)}</details>`:"";
  return upHTML+goneHTML;
}

function evText(p,e){const o=LANG==="en"&&p.evEn&&p.evEn[e.id];return o?{title:o.title||e.title,desc:o.desc||e.desc,lines:o.lines||e.lines}:{title:e.title,desc:e.desc,lines:e.lines};}
function evEnded(e){const d=(e.dates||[]).slice().sort().pop();return !!d&&d<todayISO();}
function todayISO(){const n=new Date(now());return n.getFullYear()+"-"+String(n.getMonth()+1).padStart(2,"0")+"-"+String(n.getDate()).padStart(2,"0");}
function evSlotsHTML(p,e){
  const ss=SH.filter(x=>x.p===p.id&&F[x.id]?.evId===e.id).sort((a,b)=>showDate(a)-showDate(b));
  if(!ss.length)return "";
  return `<div class="ev-slots"><small>${esc(tr("可加入个人行程"))}</small>${ss.map(x=>{const k=keyOf(x),on=picked.has(k),past=isPast(x);
    return `<div class="ev-slot${past?" past":""}"><span class="ev-st"><b>${esc(d2(x))}–${fmt(endMin(x))}</b><small>${esc(placeOf(x))}</small></span>${past?`<em>${esc(tr("已结束"))}</em>`:`<button class="ev-add${on?" on":""}" data-plan="${esc(k)}" aria-pressed="${on}">${esc(tr(on?"已加入行程":"加入我的行程"))}</button>`}</div>`;}).join("")}</div>`;
}
function eventsBodyHTML(p,kind){
  if(!p.events||!p.events.length)return "";
  const ks=p.eventKinds||[];
  const kn=k=>{const o=LANG==="en"&&p.kindEn&&p.kindEn[k.id];return o||k.name;};
  const body=ks.filter(k=>!kind||k.id===kind).map(k=>{const es=p.events.filter(e=>e.kind===k.id).sort((a,b)=>String((a.dates||[])[0]||"9").localeCompare(String((b.dates||[])[0]||"9")));if(!es.length)return "";
    return `<section class="ev-group"><h3 class="ev-h">${esc(kn(k))}</h3>${es.map(e=>{const t=evText(p,e);return `<article class="ev-card${evEnded(e)?" ev-done":""}"><header><b>${esc(t.title)}</b>${e.free?`<span class="ev-tag">${esc(tr("免费"))}</span>`:""}${evEnded(e)?`<span class="ev-tag ev-end">${esc(tr("已结束"))}</span>`:""}</header>${t.desc?`<p>${esc(t.desc)}</p>`:""}<dl>${(t.lines||[]).map(l=>`<dt>${esc(l[0])}</dt><dd>${esc(l[1])}</dd>`).join("")}</dl>${evSlotsHTML(p,e)}</article>`;}).join("")}</section>`;}).join("");
  return body;
}
function eventsHTML(p){
  if(!p.events||!p.events.length)return "";
  return `<a class="ev-entry" href="#events-${esc(p.id)}"><i class="ev-ic" aria-hidden="true">✦</i><span><b>${esc(tr("活动与论坛"))}</b><small>${esc(tr("大师讲堂、导演论导演、沙龙、论坛等"))}</small></span><em>${p.events.length} ${esc(tr("项"))}</em><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 6 6 6-6 6"/></svg></a>`;
}
function partsHTML(f){
  if(!f.parts||!f.parts.length)return "";
  const en=LANG==="en";
  return `<section class="fd-block"><h3 class="fd-h">${esc(tr("收录短片"))}</h3>${f.parts.map(m=>`<div class="fd-part"><b>${esc(en?m.en:m.cn)}</b><small>${esc(en?m.cn:m.en)}${m.y?" · "+m.y:""}${m.min?" · "+m.min+(en?" min":"分钟"):""}${m.c?" · "+esc(m.c):""}</small>${m.dir?`<small>${esc(tr("导演"))}：${esc(en&&m.dirO?m.dirO:m.dir)}</small>`:""}${m.printSource?`<small>${esc(tr("影片版权"))}：${esc(en&&m.printSourceEn?m.printSourceEn:m.printSource)}</small>`:""}${(en?m.synEn:m.syn)?`<p>${esc(en?m.synEn:m.syn)}</p>`:""}${(en?m.bioEn:m.bio)?`<p>${esc(tr("导演介绍"))}：${esc(en?m.bioEn:m.bio)}</p>`:""}${(m.honors||[]).length?`<ul class="fd-honors">${m.honors.map(honorHTML).join("")}</ul>`:""}</div>`).join("")}</section>`;
}

let evKind="";
function eventsPage(pid){
  const p=PG[pid]; if(!p||!p.events){go("programmes");return;}
  if(evProg!==pid){evKind="";evProg=pid;}
  const ks=(p.eventKinds||[]).filter(k=>p.events.some(e=>e.kind===k.id)),kn=k=>(LANG==="en"&&p.kindEn&&p.kindEn[k.id])||k.name;
  topEl.innerHTML=`<div class="row"><button class="back" data-back><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m15 6-6 6 6 6"/></svg>${esc(tr("返回"))}</button><span class="sp"></span><span class="pill">${esc(p.name)}</span></div>`;
  main.innerHTML=`<section class="view gut ev-page"><h2 class="sec">${esc(tr("活动与论坛"))}</h2><p class="sub">${esc(p.name)} · ${esc(p.period)}</p>
  <div class="plan-scope sec-scope"><button class="schedule-filter" data-evkind-sel aria-haspopup="dialog"><span><small>${esc(tr("选择板块"))}</small><b>${esc((evKindRows(pid).find(r=>r.id===evKind)||{}).name||tr("全部活动"))}</b></span><span class="scope-count">${tr((evKind?p.events.filter(e=>e.kind===evKind).length:p.events.length)+" 项")}</span>${filterChevron}</button></div>
  ${eventsBodyHTML(p,evKind)}</section>`;
}
let evProg="";
document.addEventListener("click",e=>{const b=e.target.closest("[data-evkind]");if(!b)return;evKind=b.dataset.evkind;const y=window.scrollY;route();window.scrollTo(0,y);});
function progPage(pid){
  if(sectionProgramme!==pid){sectionFilter="";sectionProgramme=pid;}
  const p=PG[pid]; if(!p){ go("schedule"); return; }
  const shows=progShows(pid), fids=[...new Set(shows.map(x=>x.id))], films=FILMS.filter(f=>f.prog===pid||p.sections?.[f.id]||p.members?.includes(f.id)||fids.includes(f.id)).sort(filmOrder);
  topEl.innerHTML = `<div class="row"><button class="back" data-back><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m15 6-6 6 6 6"/></svg>返回</button><span class="sp"></span><span class="pill">${esc(p.kind)}</span></div>`;
  main.innerHTML = `<article class="pg">
    ${p.cover?`<div class="pg-cover"><img src="${p.cover}"${p.coverPos?` style="object-position:${p.coverPos}"`:""} alt="${esc(p.name)} 主视觉"></div>`:""}
    <div class="gut">
      <header class="pg-head"><small>${esc(p.en||"")}</small><h1>${esc(p.name)}</h1><p class="pg-sub">${statusTag(p)}${esc(p.sub)} · ${esc(p.period)}${p.city?`<span style="white-space:nowrap"> · ${esc(p.city)}</span>`:""}</p></header>
      <div class="pstats pg-stats"><div><b>${films.length}</b><small>部影片</small></div><div><b>${shows.filter(x=>!F[x.id]?.ev).length}</b><small>场放映</small></div><div><b>${new Set(shows.map(x=>x.d)).size}</b><small>个放映日</small></div><div><b>${new Set(shows.map(x=>x.v+x.h)).size}</b><small>个影厅</small></div></div>
      ${p.blurb?`<p class="pg-blurb">${esc(p.blurb)}</p>`:""}
      ${progActsHTML(p)}
      ${p.ticketUrl&&progStatus(p)!=="ended"?`<p class="pg-ticketlink"><a class="primary-button" href="${esc(p.ticketUrl)}" target="_blank" rel="noopener">${esc(tr(p.ticketLabel||"购票"))}</a></p>`:""}
      ${eventsHTML(p)}
      ${p.ticket&&!p.noPageTicket&&progStatus(p)!=="ended"?ticketCardHTML({ticket:p.ticket,ticketPlatform:p.ticketPlatform,ticketHint:p.ticketHint},p.name,"prog:"+p.id,""):""}
      ${p.sections?`<div class="plan-scope sec-scope"><button class="schedule-filter" data-section-sel aria-haspopup="dialog"><span><small>${esc(tr("选择单元"))}</small><b>${esc(tr(secLabel(sectionFilter)))}</b></span><span class="scope-count">${tr(FILMS.filter(f=>!sectionFilter?(p.sections[f.id]||f.prog===pid):p.sections[f.id]===sectionFilter).length+" 部")}</span>${filterChevron}</button></div>`:""}
      <div class="plan-toolbar"><button class="primary-button" data-prog-jump="up">即将放映</button><button class="secondary-button" data-prog-jump="gone">已结束</button></div>
      <p class="src">场次与排片表自动同步 · 页面打开时每分钟检查更新</p>${films.length?progFilmsHTML(pid,films):`<div class="fd-noshow"><b>片单与场次即将公布</b><span>公布后会第一时间更新到这里。</span></div>`}
    </div></article>`;
}
function about(){
  main.innerHTML = `<section class="view gut about"><h2 class="sec">关于影展</h2>
    <p class="sub">风格万相 · 中外经典影片展</p>
    <dl class="kv"><dt>展期</dt><dd>2026.10 – 2027.01</dd><dt>影院</dt><dd>${VENUES.map(v=>esc(v.name+(v.halls.length?"（"+v.halls.map(h=>h.name).join("、")+"）":""))).join("<br>")}</dd><dt>本页场次</dt><dd>10.30 – 11.08，共 ${SH.length} 场 / ${FILMS.length} 部</dd></dl>
    <p>从伯格曼的公路回忆到塔可夫斯基的末日祈祷，从费穆的城墙到徐克的江湖，十七部作品横跨 1947 至 2025 年，排在同一块银幕上，恰好是一份关于“风格”的地图。</p>
    <p class="src">后续场次公布后将补充至排片表。</p></section>`;
}
