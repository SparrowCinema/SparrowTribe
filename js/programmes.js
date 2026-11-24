/* js/programmes.js — 专题页与影展活动、关于。
   网站脚本按功能拆成 js/*.js，按 index.html 里的顺序加载；部署时 tools/build-assets.js 按同样顺序合并成一个 app.js。 */

// 下一场优先取定位城市的场次（list 已按时间升序），没有再取最早的一场
function localFirst(list){const c=geoActiveCity();if(c){const v=VENUES.filter(x=>x.city===c).map(x=>x.id),hit=list.find(s=>v.includes(s.v));if(hit)return hit;}return list[0];}
function progFilmSub(f,pid,ended){ // 与小程序一致：版本 · 下一场日期时间，单行
  const ed=editionOf(f), mine=SH.filter(x=>x.id===f.id&&x.p===pid).sort((x,y)=>showDate(x)-showDate(y)), next=ended?null:localFirst(mine.filter(x=>!isPast(x)));
  const when=next?next.d+" "+next.t:(!mine.length&&!ended?"场次待公布":"");
  return [ed,when].filter(Boolean).map(x=>"<span>"+esc(x)+"</span>").join(""); }
function progFilmCard(f,pid,ended){ const sub=progFilmSub(f,pid,ended), title=(LANG!=="en"&&PG[pid]?.filmTitles?.[f.id])||f.cn; return `<button class="pg-film" data-film="${f.id}">${pst(f.id)?pimg(f.id,360,'alt="" loading="lazy"'):`<span class="pg-ph" style="background:${REG[f.reg].c}">${esc(title[0])}</span>`}<span class="pg-caption"><b class="pg-name">${esc(title)}</b>${sub?`<span class="pg-sub1">${sub}</span>`:""}</span></button>`; }
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
  const grid=(list,ended)=>`<div class="pg-grid${ended?" pg-gone":""}">${list.map(f=>progFilmCard(f,pid,ended)).join("")}</div>`;
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
function sectionNoteHTML(p, sec){
  if(!sec||!p||!p.sectionNotes)return "";
  const n=p.sectionNotes[sec]; if(!n)return "";
  const intro=LANG==="en"&&(n.en||n.introEn)?(n.en||n.introEn):n.intro;
  if(!intro)return "";
  const cur=LANG==="en"&&(n.curatorEn||n.curator)?(n.curatorEn||n.curator):n.curator;
  return `<aside class="sec-note"><small class="mono">CURATORIAL NOTE · ${esc(tr(secLabel(sec)))}</small><p>${esc(intro)}</p>${cur?`<footer>— ${esc(cur)}</footer>`:""}</aside>`;
}
function juryHTML(p){
  if(!p||!Array.isArray(p.jury)||!p.jury.length)return "";
  const total=p.jury.reduce((n,g)=>n+(Array.isArray(g.members)?g.members.length:0),0);
  if(!total)return "";
  return `<details class="jury-box"><summary class="ev-entry jury-sum"><i class="ev-ic" aria-hidden="true">◆</i><span><b>${esc(tr("评审团与竞赛名单"))}</b><small>${esc(p.jury.map(g=>LANG==="en"&&g.unitEn?g.unitEn:g.unit).filter(Boolean).join(" · "))}</small></span><em>${total} ${esc(tr("位"))}</em><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 6 6 6-6 6"/></svg></summary><div class="jury-body">${p.jury.map(g=>`<section class="jury-unit"><h4>${esc(LANG==="en"&&g.unitEn?g.unitEn:g.unit||"")}</h4><ul class="jury-list">${(g.members||[]).map(m=>{const nm=LANG==="en"&&m.nameEn?m.nameEn:m.name,rl=LANG==="en"&&m.roleEn?m.roleEn:m.role,bio=LANG==="en"&&m.bioEn?m.bioEn:m.bio;return `<li class="jury-mem"><span class="jury-av" aria-hidden="true">${esc(String(nm||"?")[0])}</span><div class="jury-info"><div class="jury-head"><b>${esc(nm||"")}</b>${m.president?`<em class="jury-chair">${esc(tr("评审团主席"))}</em>`:""}${rl?`<small>${esc(rl)}</small>`:""}</div>${bio?`<p>${esc(bio)}</p>`:""}</div></li>`;}).join("")}</ul></section>`).join("")}</div></details>`;
}
function progVenuesOf(pid){
  const shows=progShows(pid);
  const ids=[...new Set(shows.map(s=>s.v))];
  return VENUES.filter(v=>ids.includes(v.id)).map(v=>{
    const vs=shows.filter(s=>s.v===v.id), up=vs.filter(s=>!isPast(s));
    const hallIds=[...new Set(vs.map(s=>s.h))];
    const halls=(v.halls||[]).filter(h=>hallIds.includes(h.id));
    const hasAcc=!!(v.access?.length||halls.some(h=>h.access?.length));
    return {v, total:vs.length, up:up.length, halls, hasAcc};
  });
}
function venuesEntryHTML(p){
  const rows=progVenuesOf(p.id);
  if(!rows.length)return "";
  const accCount=rows.filter(r=>r.hasAcc).length;
  const sub=[rows.map(r=>stripCity(r.v.short||r.v.name,r.v)).slice(0,3).join(" · ")+(rows.length>3?"…":""), accCount?tr("含无障碍影厅"):""].filter(Boolean).join(" · ");
  return `<a class="ev-entry" href="#venues-${esc(p.id)}"><i class="ev-ic" aria-hidden="true">⌖</i><span><b>${esc(tr("影院地图与交通"))}</b><small>${esc(sub)}</small></span><em>${rows.length} ${esc(tr("家"))}</em><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 6 6 6-6 6"/></svg></a>`;
}
function venueMapSVG(rows){
  const pts=rows.map((r,i)=>({i:i+1,v:r.v,geo:Array.isArray(r.v.geo)&&r.v.geo.length===2?r.v.geo:null})).filter(x=>x.geo);
  if(!pts.length)return "";
  const lats=pts.map(p=>p.geo[0]), lons=pts.map(p=>p.geo[1]);
  const cLat=(Math.min(...lats)+Math.max(...lats))/2, cosLat=Math.cos(cLat*Math.PI/180)||1;
  const minLat=Math.min(...lats), maxLat=Math.max(...lats), minLon=Math.min(...lons), maxLon=Math.max(...lons);
  const spanLat=Math.max(maxLat-minLat,0.014), spanLon=Math.max((maxLon-minLon)*cosLat,0.018);
  const W=640, H=280, padX=62, padY=42;
  const scale=Math.min((W-padX*2)/spanLon,(H-padY*2)/spanLat);
  const midLon=(minLon+maxLon)/2, midLat=(minLat+maxLat)/2;
  const xy=g=>[W/2+(g[1]-midLon)*cosLat*scale, H/2-(g[0]-midLat)*scale];
  const kmPerDeg=111.32, barKm=spanLon*kmPerDeg>8?2:spanLon*kmPerDeg>2?1:0.5;
  const barPx=Math.max(36,Math.min(140,(barKm/kmPerDeg)*scale));
  const grid=[0.2,0.4,0.6,0.8].map(f=>`<line x1="${(W*f).toFixed(1)}" y1="14" x2="${(W*f).toFixed(1)}" y2="${H-14}"/><line x1="14" y1="${(H*f).toFixed(1)}" x2="${W-14}" y2="${(H*f).toFixed(1)}"/>`).join("");
  const pins=pts.map(p=>{
    const [x,y]=xy(p.geo), label=stripCity(p.v.short||p.v.name,p.v);
    const num=String(p.i).padStart(2,"0");
    return `<g class="vm-pin" data-vpin="${esc(p.v.id)}" tabindex="0" role="button" aria-label="${esc(p.v.name)}"><circle class="vm-halo" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="16"/><circle class="vm-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="11"/><text class="vm-num" x="${x.toFixed(1)}" y="${(y+3.5).toFixed(1)}" text-anchor="middle">${num}</text><text class="vm-lab" x="${x.toFixed(1)}" y="${(y+25).toFixed(1)}" text-anchor="middle">${esc(label.slice(0,12))}</text></g>`;
  }).join("");
  return `<figure class="vm-wrap"><svg class="vm-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(tr("展映影院坐标示意图"))}"><g class="vm-grid">${grid}</g>${pins}<g class="vm-scale" transform="translate(22,${H-18})"><line x1="0" y1="0" x2="${barPx.toFixed(1)}" y2="0"/><line x1="0" y1="-4" x2="0" y2="4"/><line x1="${barPx.toFixed(1)}" y1="-4" x2="${barPx.toFixed(1)}" y2="4"/><text x="${(barPx+8).toFixed(1)}" y="3.5">${barKm} km</text></g></svg><figcaption>${esc(tr("点击编号定位对应影院 · 导航按实际路况打开地图"))}</figcaption></figure>`;
}
function venueTransfersHTML(rows){
  const geoRows=rows.filter(r=>Array.isArray(r.v.geo)&&r.v.geo.length===2);
  if(geoRows.length<2||geoRows.length>6||typeof SparrowPlanner==="undefined")return "";
  const pairs=[];
  for(let i=0;i<geoRows.length;i++)for(let j=i+1;j<geoRows.length;j++){
    if(geoRows[i].v.city!==geoRows[j].v.city)continue;
    const t=SparrowPlanner.transfer(geoRows[i].v,geoRows[j].v);
    if(!t||t.km==null)continue;
    pairs.push({a:stripCity(geoRows[i].v.short||geoRows[i].v.name,geoRows[i].v),b:stripCity(geoRows[j].v.short||geoRows[j].v.name,geoRows[j].v),km:t.km,min:t.min,max:t.max});
  }
  if(!pairs.length)return "";
  return `<section class="vm-xfer"><h3 class="blockh">${esc(tr("跨影院转场参考"))} <small>TRANSFERS</small></h3><div class="vm-xlist">${pairs.map(p=>`<div class="vm-xrow"><b>${esc(p.a)} ↔ ${esc(p.b)}</b><span class="mono">${p.km.toFixed(1)} km · ${esc(tr("约"))} ${p.min}–${p.max} ${esc(tr("分钟"))}</span></div>`).join("")}</div></section>`;
}
function venuesPage(pid){
  const p=PG[pid]; if(!p){go("programmes");return;}
  const rows=progVenuesOf(pid);
  topEl.innerHTML=`<div class="row"><button class="back" data-back><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m15 6-6 6 6 6"/></svg>${esc(tr("返回"))}</button><span class="sp"></span><span class="pill">${esc(p.name)}</span></div>`;
  const cards=rows.map((r,i)=>{
    const v=r.v, num=String(i+1).padStart(2,"0"), mapUrl=typeof SparrowPlanner!=="undefined"?SparrowPlanner.mapURL(v):"";
    const trRows=v.transit?[["地铁",v.transit.metro],["公交",v.transit.bus],["停车",v.transit.parking],["提示",v.transit.note]].filter(x=>x[1]):[];
    return `<article class="vm-card" id="vc-${esc(v.id)}"><header class="vm-ch"><span class="vm-idx mono">${num}</span><div class="vm-ct"><h3>${esc(v.name)}</h3><small>${esc([v.city?tr(v.city):"",v.addr||""].filter(Boolean).join(" · "))}</small></div>${mapUrl?`<a class="secondary-button vm-nav" href="${esc(mapUrl)}" target="_blank" rel="noopener noreferrer">${esc(tr("地图导航"))} ↗</a>`:""}</header><div class="vm-halls">${r.halls.map(h=>{const acc=[...(v.access||[]),...(h.access||[])];return `<span class="vm-hall">${esc(h.name)}${acc.length?` <em>${esc(tr("无障碍"))}</em>`:""}</span>`;}).join("")}<span class="vm-cnt mono">${tr(r.total+" 场")}${r.up?` · ${tr("待映")} ${r.up}`:""}</span></div>${trRows.length?`<dl class="vm-tr">${trRows.map(([k,val])=>`<dt>${esc(tr(k))}</dt><dd>${esc(val)}</dd>`).join("")}</dl>`:""}</article>`;
  }).join("");
  main.innerHTML=`<section class="view gut vm-page"><h2 class="sec">${esc(tr("影院地图与交通"))}</h2><p class="sub">${esc(p.name)} · ${rows.length} ${esc(tr("家影院"))}</p>${venueMapSVG(rows)}<div class="vm-cards">${cards||`<div class="fd-noshow"><b>${esc(tr("暂无影院排片信息"))}</b></div>`}</div>${venueTransfersHTML(rows)}${presentersHTML()}</section>`;
}
document.addEventListener("click",e=>{
  const pin=e.target.closest("[data-vpin]");
  if(pin){const card=document.getElementById("vc-"+pin.dataset.vpin);if(card){document.querySelectorAll(".vm-card.hi").forEach(x=>x.classList.remove("hi"));card.classList.add("hi");card.scrollIntoView({behavior:"smooth",block:"center"});}}
});
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
      ${venuesEntryHTML(p)}
      ${juryHTML(p)}
      ${p.ticket&&!p.noPageTicket&&progStatus(p)!=="ended"?ticketCardHTML({ticket:p.ticket,ticketPlatform:p.ticketPlatform,ticketHint:p.ticketHint},p.name,"prog:"+p.id,""):""}
      ${p.sections?`<div class="plan-scope sec-scope"><button class="schedule-filter" data-section-sel aria-haspopup="dialog"><span><small>${esc(tr("选择单元"))}</small><b>${esc(tr(secLabel(sectionFilter)))}</b></span><span class="scope-count">${tr(FILMS.filter(f=>!sectionFilter?(p.sections[f.id]||f.prog===pid):p.sections[f.id]===sectionFilter).length+" 部")}</span>${filterChevron}</button></div>`:""}
      ${sectionNoteHTML(p,sectionFilter)}
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
