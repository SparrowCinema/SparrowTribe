/* js/programmes.js — 专题页与影展活动、关于。
   网站脚本按功能拆成 js/*.js，按 index.html 里的顺序加载；部署时 tools/build-assets.js 按同样顺序合并成一个 app.js。 */

// 下一场优先取定位城市的场次（list 已按时间升序），没有再取最早的一场
function localFirst(list){const c=geoActiveCity();if(c){const v=VENUES.filter(x=>x.city===c).map(x=>x.id),hit=list.find(s=>v.includes(s.v));if(hit)return hit;}return list[0];}
function programmeFilmShows(f,pid){
  const ids=[f.id,...SparrowLibrary.screeningGroups(f.id,FILMS).map(x=>x.id)];
  return SH.filter(s=>s.p===pid&&ids.includes(s.id)).sort((a,b)=>showDate(a)-showDate(b));
}
function programmeFilmInSection(f,pid,section){
  if(!section)return true;
  const sections=PG[pid].sections;
  return sections?.[f.id]===section||SparrowLibrary.screeningGroups(f.id,FILMS).some(x=>sections?.[x.id]===section);
}
function progFilmSub(f,pid,ended){ // 与小程序一致：版本 · 下一场日期时间，单行
  const ed=editionOf(f), mine=programmeFilmShows(f,pid), next=ended?null:localFirst(mine.filter(x=>!isPast(x)));
  const when=next?(next.id===f.id?next.d+" "+next.t:tr("联映场次")):(!mine.length&&!ended?"场次待公布":"");
  return [ed,when].filter(Boolean).map(x=>"<span>"+esc(x)+"</span>").join(""); }
function progFilmCard(f,pid,ended){ const sub=progFilmSub(f,pid,ended), title=(LANG!=="en"&&PG[pid]?.filmTitles?.[f.id])||f.cn; return `<button class="pg-film" data-film="${f.id}">${pst(f.id)?pimg(f.id,360,'alt="" loading="lazy"'):`<span class="pg-ph" style="background:${REG[f.reg].c}">${esc(title[0])}</span>`}<span class="pg-caption"><b class="pg-name">${esc(title)}</b>${sub?`<span class="pg-sub1">${sub}</span>`:""}</span></button>`; }
// 专题页影片分组：即将放映（含场次待公布）按下一场先后；已结束按最近一场由近及远
function progFilmGroups(pid,films){
  const up=[], gone=[];
  films.forEach(f=>{ const mine=programmeFilmShows(f,pid), next=mine.find(s=>!isPast(s));
    if(next||(!mine.length&&!endedIn(f,pid))) up.push({f,at:next?showDate(next):Infinity}); else gone.push({f,at:mine.length?showDate(mine[mine.length-1]):relTime(f)}); }); // endedIn：f.ended：已下映、本站未收录场次的影片直接归入已结束
  up.sort((a,b)=>(a.at===b.at?0:a.at<b.at?-1:1)||filmOrder(a.f,b.f)); gone.sort((a,b)=>b.at-a.at||a.f.cn.localeCompare(b.f.cn,"zh"));
  return {up:up.map(x=>x.f), gone:gone.map(x=>x.f)};
}
function progFilmsHTML(pid,films){
  const {up,gone}=progFilmGroups(pid,films.filter(f=>programmeFilmInSection(f,pid,sectionFilter)));
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
  return `<section class="fd-block"><h3 class="fd-h">${esc(tr(f.screeningParts?.length?"联映影片":"收录短片"))}</h3>${f.parts.map((m,i)=>`<div class="fd-part"><b>${esc(en?m.en:m.cn)}</b>${f.screeningParts?.[i]&&F[f.screeningParts[i]]?` <a class="text-button" href="#film-${esc(f.screeningParts[i])}">${esc(tr("查看单片详情"))}</a>`:""}<small>${esc(en?m.cn:m.en)}${m.y?" · "+m.y:""}${m.min?" · "+m.min+(en?" min":"分钟"):""}${m.c?" · "+esc(m.c):""}</small>${m.dir?`<small>${esc(tr("导演"))}：${esc(en&&m.dirO?m.dirO:m.dir)}</small>`:""}${m.printSource?`<small>${esc(tr("影片版权"))}：${esc(en&&m.printSourceEn?m.printSourceEn:m.printSource)}</small>`:""}${(en?m.synEn:m.syn)?`<p>${esc(en?m.synEn:m.syn)}</p>`:""}${(en?m.bioEn:m.bio)?`<p>${esc(tr("导演介绍"))}：${esc(en?m.bioEn:m.bio)}</p>`:""}${(m.honors||[]).length?`<ul class="fd-honors">${m.honors.map(honorHTML).join("")}</ul>`:""}</div>`).join("")}</section>`;
}

let evKind="";
function eventsPage(pid){
  const p=PG[pid]; if(!p||!p.events){go("programmes");return;}
  if(evProg!==pid){evKind="";evProg=pid;}
  const ks=(p.eventKinds||[]).filter(k=>p.events.some(e=>e.kind===k.id)),kn=k=>(LANG==="en"&&p.kindEn&&p.kindEn[k.id])||k.name;
  topEl.innerHTML=`<div class="row"><button class="back" data-back><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m15 6-6 6 6 6"/></svg>${esc(tr("返回"))}</button><span class="sp"></span><span class="pill">${esc(p.name)}</span></div>`;
  main.innerHTML=`<section class="view gut ev-page"><h1 class="sec">${esc(tr("活动与论坛"))}</h1><p class="sub">${esc(p.name)} · ${esc(p.period)}</p>
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
    const filmN=new Set(up.filter(s=>F[s.id]&&!F[s.id].ev).map(s=>s.id)).size; // 只数还有待映场次的影片
    return {v, total:vs.length, up:up.length, halls, hasAcc, filmN};
  });
}
function venuesEntryHTML(p){
  const rows=progVenuesOf(p.id);
  if(!rows.length)return "";
  const accCount=rows.filter(r=>r.hasAcc).length;
  const sub=[rows.map(r=>stripCity(r.v.short||r.v.name,r.v)).slice(0,3).join(" · ")+(rows.length>3?"…":""), accCount?tr("含无障碍影厅"):""].filter(Boolean).join(" · ");
  return `<a class="ev-entry" href="#venues-${esc(p.id)}"><i class="ev-ic" aria-hidden="true">⌖</i><span><b>${esc(tr("影院地图与交通"))}</b><small>${esc(sub)}</small></span><em>${rows.length} ${esc(tr("家"))}</em><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 6 6 6-6 6"/></svg></a>`;
}
/* 影院地图与交通（2026-11-26）：手机与平板上地图吸在顶栏下方，只有影院列表滚动；宽屏（≥900px）左右分栏，列表在左、地图在右。
   点影院卡片、地图上的编号或「看本院影片与排片」，展开这家影院在本专题的影片与排片（规则在 shared/venue-board.js，与小程序 pages/venues 一致）。
   选中的影院、筛选和地图视角按专题记在内存里：加入排片、数据自动更新时只换影院列表，地图不重建。 */
let vmState=null, vmMode="street", vmPid="", vmSel="", vmPick={film:"",day:undefined}, vmTapAt=0, vmTapId="", vmWatch=()=>{};
function vmUse(pid,rows){ if(vmPid===pid)return; vmPid=pid; vmSel=rows.length===1?rows[0].v.id:""; vmPick={film:"",day:undefined}; vmState=null; }
function vmMercX(lon,z){return ((lon+180)/360)*256*Math.pow(2,z);}
function vmMercY(lat,z){const r=lat*Math.PI/180;return (1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*256*Math.pow(2,z);}
function vmUseOverseas(pts,lat,lon,z){
  if(typeof SparrowPlanner==="undefined"||!pts||!pts.length)return false;
  const flags=pts.map(p=>SparrowPlanner.isOverseasGeo(p.v));
  if(flags.every(Boolean))return true;
  if(flags.every(x=>!x))return false;
  if(z<=10)return true;
  let best=pts[0], bestD=Infinity;
  pts.forEach(p=>{const d=Math.hypot(p.geo[0]-lat,p.geo[1]-lon);if(d<bestD){bestD=d;best=p;}});
  return SparrowPlanner.isOverseasGeo(best.v);
}
function vmTileUrl(z,x,y,overseas,mode="street"){
  const n=Math.pow(2,z), wx=((x%n)+n)%n;
  if(y<0||y>=n)return "";
  if(overseas){
    const svc=mode==="sketch"?"World_Topo_Map":"World_Street_Map";
    return `https://server.arcgisonline.com/ArcGIS/rest/services/${svc}/MapServer/tile/${z}/${y}/${wx}`;
  }
  const s=(wx+y)%4+1;
  return `https://webrd0${s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=2&style=8&x=${wx}&y=${y}&z=${z}`;
}
function vmTileFallbackUrl(z,x,y,overseas,mode="street"){
  const n=Math.pow(2,z), wx=((x%n)+n)%n;
  if(y<0||y>=n)return "";
  if(overseas){
    const svc=mode==="sketch"?"World_Street_Map":"World_Topo_Map";
    return `https://server.arcgisonline.com/ArcGIS/rest/services/${svc}/MapServer/tile/${z}/${y}/${wx}`;
  }
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/${wx}`;
}
function vmFrameSVG(W,H){
  // Subtle engraved atlas border & hand-drawn ink displacement filter (applied to real map tiles in 手绘地图 mode)
  const ticks=[0.2,0.4,0.6,0.8].map(f=>`<line x1="${(W*f).toFixed(1)}" y1="6" x2="${(W*f).toFixed(1)}" y2="12"/><line x1="${(W*f).toFixed(1)}" y1="${H-12}" x2="${(W*f).toFixed(1)}" y2="${H-6}"/><line x1="6" y1="${(H*f).toFixed(1)}" x2="12" y2="${(H*f).toFixed(1)}"/><line x1="${W-12}" y1="${(H*f).toFixed(1)}" x2="${W-6}" y2="${(H*f).toFixed(1)}"/>`).join("");
  return `<defs><filter id="vm-sketch-fx" x="-2%" y="-2%" width="104%" height="104%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.032" numOctaves="2" seed="11" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.3" xChannelSelector="R" yChannelSelector="G"/></filter></defs><g class="vm-frame" aria-hidden="true"><rect x="6" y="6" width="${Math.max(0,W-12)}" height="${Math.max(0,H-12)}" rx="8"/><rect x="10" y="10" width="${Math.max(0,W-20)}" height="${Math.max(0,H-20)}" rx="5" class="vm-frame-in"/>${ticks}</g>`;
}
function venueMapFit(pts,W,H){
  const lats=pts.map(p=>p.geo[0]), lons=pts.map(p=>p.geo[1]);
  const cLat=(Math.min(...lats)+Math.max(...lats))/2, cLon=(Math.min(...lons)+Math.max(...lons))/2;
  if(pts.length===1)return {lat:cLat,lon:cLon,z:15};
  let bestZ=11;
  for(let z=16;z>=9;z--){
    const xs=pts.map(p=>vmMercX(p.geo[1],z)), ys=pts.map(p=>vmMercY(p.geo[0],z));
    if(Math.max(...xs)-Math.min(...xs)<W-130&&Math.max(...ys)-Math.min(...ys)<H-110){bestZ=z;break;}
  }
  return {lat:cLat,lon:cLon,z:bestZ};
}
function renderVenueMap(){
  const stage=document.getElementById("vm-stage"); if(!stage||!vmState)return;
  const W=stage.clientWidth||640, H=stage.clientHeight||340;
  const {pts,z,lat,lon,activeId}=vmState;
  const overseas=vmUseOverseas(pts,lat,lon,z);
  const cx=vmMercX(lon,z), cy=vmMercY(lat,z);
  const toXY=g=>[W/2+(vmMercX(g[1],z)-cx), H/2+(vmMercY(g[0],z)-cy)];

  // 1. Real cartographic tiles in BOTH street & sketch (illustrated) modes
  const tilesEl=stage.querySelector(".vm-tiles");
  if(tilesEl){
    const tx0=Math.floor((cx-W/2)/256), tx1=Math.floor((cx+W/2)/256);
    const ty0=Math.floor((cy-H/2)/256), ty1=Math.floor((cy+H/2)/256);
    let html="";
    for(let tx=tx0;tx<=tx1;tx++)for(let ty=ty0;ty<=ty1;ty++){
      const u=vmTileUrl(z,tx,ty,overseas,vmMode); if(!u)continue;
      const fb=vmTileFallbackUrl(z,tx,ty,overseas,vmMode);
      const left=Math.round(W/2+(tx*256-cx)), top=Math.round(H/2+(ty*256-cy));
      html+=`<img class="vm-tile" src="${esc(u)}" data-fb="${esc(fb)}" alt="" draggable="false" loading="eager" style="left:${left}px;top:${top}px" onerror="if(this.dataset.fb&&this.src!==this.dataset.fb){this.src=this.dataset.fb;this.dataset.fb='';}else{this.style.opacity='0';}">`;
    }
    tilesEl.innerHTML=html; tilesEl.style.opacity="1";
  }

  // 2. Vector overlay: atlas frame + transfer arcs + non-colliding numbered pins + compass + scale
  const svg=stage.querySelector(".vm-svg"); if(!svg)return;
  svg.setAttribute("viewBox",`0 0 ${W} ${H}`);
  const coords=pts.map(p=>{const xy=toXY(p.geo);return {...p,xy,px:xy[0],py:xy[1],labPos:"bottom"};});
  // Gently separate closely clustered pins (e.g. Xinyi Vie Show & MUVIE TITAN ~120m apart) so badges & labels never overlap
  for(let i=0;i<coords.length;i++)for(let j=i+1;j<coords.length;j++){
    const a=coords[i], b=coords[j], dx=b.px-a.px, dy=b.py-a.py, dist=Math.hypot(dx,dy);
    if(dist<28){
      const ang=dist>0.1?Math.atan2(dy,dx):-Math.PI/4, push=(28-dist)/2;
      a.px-=Math.cos(ang)*push; a.py-=Math.sin(ang)*push;
      b.px+=Math.cos(ang)*push; b.py+=Math.sin(ang)*push;
    }
    if(Math.abs(b.px-a.px)<84&&Math.abs(b.py-a.py)<34){
      if(a.py<=b.py){a.labPos="top";b.labPos="bottom";}else{b.labPos="top";a.labPos="bottom";}
    }
  }
  let arcs="";
  if(coords.length>=2&&coords.length<=7){
    for(let i=0;i<coords.length-1;i++){
      const a=coords[i], b=coords[i+1];
      if(a.v.city!==b.v.city)continue;
      const mx=(a.xy[0]+b.xy[0])/2, my=(a.xy[1]+b.xy[1])/2-Math.min(28,Math.hypot(b.xy[0]-a.xy[0],b.xy[1]-a.xy[1])*0.18);
      arcs+=`<path class="vm-arc" d="M${a.xy[0].toFixed(1)},${a.xy[1].toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${b.xy[0].toFixed(1)},${b.xy[1].toFixed(1)}"/>`;
    }
  }
  const pins=coords.map(p=>{
    const x=p.px, y=p.py, label=stripCity(p.v.short||p.v.name,p.v), num=String(p.i).padStart(2,"0"), hi=activeId===p.v.id?" hi":"";
    const ly=p.labPos==="top"?y-17:y+25;
    const leader=Math.hypot(x-p.xy[0],y-p.xy[1])>2?`<line class="vm-lead" x1="${p.xy[0].toFixed(1)}" y1="${p.xy[1].toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/><circle class="vm-anchor" cx="${p.xy[0].toFixed(1)}" cy="${p.xy[1].toFixed(1)}" r="2.5"/>`:"";
    return `<g class="vm-pin${hi}" data-vpin="${esc(p.v.id)}" tabindex="0" role="button" aria-label="${esc(p.v.name)}">${leader}<circle class="vm-halo" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${hi?20:15}"/><circle class="vm-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="11.5"/><text class="vm-num" x="${x.toFixed(1)}" y="${(y+3.5).toFixed(1)}" text-anchor="middle">${num}</text><text class="vm-lab" x="${x.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle">${esc(label.slice(0,16))}</text></g>`;
  }).join("");
  const mPerPx=156543.03392*Math.cos(lat*Math.PI/180)/Math.pow(2,z);
  const targetM=mPerPx*76;
  const nice=[100,200,500,1000,2000,5000,10000,20000].find(v=>v>=targetM)||5000;
  const barPx=Math.max(34,Math.min(120,nice/mPerPx));
  const barTxt=nice>=1000?(nice/1000)+" km":nice+" m";
  const compass=`<g class="vm-compass" transform="translate(${W-32},34)" aria-hidden="true"><circle cx="0" cy="0" r="14"/><path d="M0,-10 L3,0 L0,-2 L-3,0 Z" class="vm-cn"/><path d="M0,10 L2.5,0 L0,2 L-2.5,0 Z" class="vm-cs"/><text x="0" y="-16" text-anchor="middle">N</text></g>`;
  const scale=`<g class="vm-scale" transform="translate(16,${H-16})"><rect x="-6" y="-12" width="${(barPx+52).toFixed(0)}" height="20" rx="5"/><line x1="0" y1="0" x2="${barPx.toFixed(1)}" y2="0"/><line x1="0" y1="-4" x2="0" y2="4"/><line x1="${barPx.toFixed(1)}" y1="-4" x2="${barPx.toFixed(1)}" y2="4"/><text x="${(barPx+7).toFixed(1)}" y="3.5">${barTxt}</text></g>`;
  svg.innerHTML=`${vmFrameSVG(W,H)}<g class="vm-arcs">${arcs}</g>${pins}${compass}${scale}`;
  stage.classList.toggle("sketch",vmMode==="sketch");
  stage.querySelectorAll("[data-vm-mode]").forEach(b=>b.classList.toggle("on",b.dataset.vmMode===vmMode));
}
function venueMapHTML(rows){
  const pts=rows.map((r,i)=>({i:i+1,v:r.v,geo:Array.isArray(r.v.geo)&&r.v.geo.length===2?r.v.geo:null})).filter(x=>x.geo);
  if(!pts.length){vmState=null;return "";}
  if(vmState&&vmState.pid===vmPid&&vmState.pts.length===pts.length)vmState.pts=pts; // 同一专题重新进入：保留拖动、缩放后的视角
  else{const fit=venueMapFit(pts,640,340);vmState={pid:vmPid,pts,fit,z:fit.z,lat:fit.lat,lon:fit.lon,activeId:"",fresh:true};}
  return `<div class="vm-dock"><figure class="vm-wrap"><div class="vm-stage" id="vm-stage" aria-label="${esc(tr("展映影院地图"))}"><div class="vm-tiles" aria-hidden="true"></div><div class="vm-paper" aria-hidden="true"></div><svg class="vm-svg" role="img" aria-label="${esc(tr("展映影院地图"))}"></svg><div class="vm-ctrls"><div class="vm-seg" role="group" aria-label="${esc(tr("地图风格"))}"><button type="button" data-vm-mode="street" class="${vmMode==="street"?"on":""}">${esc(tr("街道地图"))}</button><button type="button" data-vm-mode="sketch" class="${vmMode==="sketch"?"on":""}">${esc(tr("手绘地图"))}</button></div><div class="vm-zbtns"><button type="button" data-vm-act="in" aria-label="${esc(tr("放大"))}">＋</button><button type="button" data-vm-act="out" aria-label="${esc(tr("缩小"))}">－</button><button type="button" data-vm-act="fit" aria-label="${esc(tr("重置视角"))}">⌖</button></div></div></div><figcaption>${esc(tr("拖动或缩放地图 · 点击影院查看影片与排片"))}</figcaption></figure></div>`;
}
function bindVenueMapDrag(){
  const stage=document.getElementById("vm-stage"); if(!stage||stage._vmBound)return;
  stage._vmBound=true;
  let drag=null;
  let tap=null; // 点影院标记：手指抬起时就选中（iPhone / 微信内置浏览器点 SVG 有时不触发 click），随后的 click 不再重复处理
  stage.addEventListener("pointerdown",e=>{
    const pg=e.target.closest("[data-vpin]");
    if(pg){tap={id:pg.dataset.vpin,x:e.clientX,y:e.clientY};return;}
    if(e.target.closest("button"))return;
    if(!vmState)return;
    drag={id:e.pointerId,x:e.clientX,y:e.clientY,cx:vmMercX(vmState.lon,vmState.z),cy:vmMercY(vmState.lat,vmState.z)};
    stage.setPointerCapture?.(e.pointerId);
  });
  stage.addEventListener("pointermove",e=>{
    if(!drag||drag.id!==e.pointerId||!vmState)return;
    const dx=e.clientX-drag.x, dy=e.clientY-drag.y, scale=256*Math.pow(2,vmState.z);
    const nx=drag.cx-dx, ny=drag.cy-dy;
    vmState.lon=(nx/scale)*360-180;
    const n=Math.PI-2*Math.PI*(ny/scale);
    vmState.lat=Math.max(-85,Math.min(85,(180/Math.PI)*Math.atan(0.5*(Math.exp(n)-Math.exp(-n)))));
    renderVenueMap();
  });
  stage.addEventListener("pointerup",e=>{
    if(!tap)return; const t=tap; tap=null;
    if(Math.hypot(e.clientX-t.x,e.clientY-t.y)>12)return;
    vmTapAt=Date.now(); vmTapId=t.id; vmSelect(t.id);
  });
  const end=()=>{drag=null;};
  stage.addEventListener("pointerup",end);
  stage.addEventListener("pointercancel",end);
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
const vbTitle=(f,pid)=>(LANG!=="en"&&PG[pid]?.filmTitles?.[f.id])||f.cn;
const vbDay=s=>s.d+" "+wk(s.d,s.year);
const vbChevron=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;
function venueBoardOf(pid,vid){
  return SparrowVenueBoard.board(progShows(pid).filter(s=>s.v===vid),{film:id=>F[id],start:s=>showDate(s).getTime(),past:isPast,pick:vmPick});
}
function vbRowHTML(s,pid){
  const f=F[s.id],k=keyOf(s),gone=isPast(s),note=f.screeningNotes?.[k]||"",SS=window.SparrowScreenings;
  const aud=SS?SS.audienceType(s,f):"public",audLbl=(aud==="industry"||aud==="press")?SS.audienceLabel(aud,LANG==="en"):"",acc=SS?SS.accessList(s,f,VN[s.v]):[];
  const end=f.minTbd?"":fmt(toMin(s.t)+durationOf(s)),hall=hallOf(s)?.name||s.h;
  const tags=(EV_RE.test(note)?`<em class="ev-tag">${esc(tr("映后活动"))}</em>`:"")+(subOf(note)?`<em class="ev-tag sub-tag">${esc(tr("字幕机"))}</em>`:"")+(audLbl?`<em class="aud-tag">${esc(audLbl)}</em>`:"")+(acc.length?`<em class="acc-pill" title="${esc(acc.map(tr).join(" · "))}">${esc(tr("无障碍"))}</em>`:"");
  return `<div class="vb-row${gone?" past":""}"><button type="button" class="vb-go" data-film="${esc(s.id)}"><span class="vb-tm"><b>${s.t}</b>${end?`<small>${end}</small>`:""}</span><span class="vb-bar fc" style="--h:${fhue(s.id)}"></span><span class="vb-nm"><b>${esc(vbTitle(f,pid))}${editionHTML(f)}</b><small><span class="hall-tag">${esc(hall)}</span>${tags}</small></span></button>${gone?"":planToggleHTML(s)}</div>`;
}
// 一家影院的影片与排片（只显示即将放映和正在放映的）：海报条（点海报只看这部，再点取消）、日期条、待映场次（按日期分组，可加入排片）
function venueBoardHTML(pid,vid){
  const b=venueBoardOf(pid,vid),en=LANG==="en";
  if(!b.upN)return `<p class="vb-empty">${esc(tr("暂无待映场次"))}</p>`;
  const films=b.films.length?`<div class="vb-films" role="group" aria-label="${esc(tr("本院影片"))}">${b.films.map(x=>{const f=F[x.id],on=b.film===x.id,title=vbTitle(f,pid),when=x.next.d+" "+x.next.t;return `<button type="button" class="vb-film${on?" on":""}" data-vbfilm="${esc(x.id)}" aria-pressed="${on}" title="${esc(title)}">${pst(x.id)?pimg(x.id,360,`alt="" loading="lazy"`):`<span class="vb-ph fc" style="--h:${fhue(x.id)}">${esc(title.slice(0,1))}</span>`}<b>${esc(title)}</b><small>${[editionOf(f),when].filter(Boolean).map(esc).join(" · ")}</small></button>`;}).join("")}</div>`:"";
  const ft=b.film?vbTitle(F[b.film],pid):"",filt=b.film?`<div class="vb-filt"><span><i>${esc(tr("只看"))}</i><b>${esc(en?"“"+ft+"”":"《"+ft+"》")}</b></span><button type="button" class="text-button" data-vbfilm="">${esc(tr("看全部影片"))}</button></div>`:"";
  const days=b.days.length>1?`<div class="vb-days" role="group" aria-label="${esc(tr("放映日期"))}"><button type="button" class="vb-day${b.day?"":" on"}" data-vbday="" aria-pressed="${!b.day}"><b>${esc(tr("全部日期"))}</b><small>${esc(tr(b.days.reduce((n,d)=>n+d.n,0)+" 场"))}</small></button>${b.days.map(d=>`<button type="button" class="vb-day${b.day===d.key?" on":""}" data-vbday="${esc(d.key)}" aria-pressed="${b.day===d.key}"><b>${esc(vbDay(d.first))}</b><small>${esc(tr(d.n+" 场"))}</small></button>`).join("")}</div>`:"";
  const groups=gs=>gs.map(g=>`<section class="vb-dg"><h4 class="vb-dh"><b>${esc(vbDay(g.first))}</b><small>${esc(tr(g.shows.length+" 场"))}</small></h4>${g.shows.map(s=>vbRowHTML(s,pid)).join("")}</section>`).join("");
  return films+filt+days+`<div class="vb-list">${groups(b.up)}</div>`;
}
function venueCardsHTML(pid,rows){
  return rows.map((r,i)=>{
    const v=r.v, num=String(i+1).padStart(2,"0"), mapUrl=typeof SparrowPlanner!=="undefined"?SparrowPlanner.mapURL(v):"", sel=vmSel===v.id, id=esc(v.id);
    const trRows=v.transit?[["地铁",v.transit.metro],["公交",v.transit.bus],["停车",v.transit.parking],["提示",v.transit.note]].filter(x=>x[1]):[];
    const cnt=r.up?[r.filmN?tr(r.filmN+" 部"):"",tr("待映 "+r.up+" 场")].filter(Boolean).join(" · "):tr("暂无待映场次");
    return `<article class="vm-card${sel?" hi open":""}" id="vc-${id}"><header class="vm-ch" data-vsel="${id}"><button type="button" class="vm-idx mono" data-vfocus="${id}" title="${esc(tr("在地图上定位"))}">${num}</button><div class="vm-ct"><h3><button type="button" class="vm-name" data-vsel="${id}" aria-expanded="${sel}" aria-controls="vb-${id}">${esc(v.name)}</button></h3><small>${esc([v.city?tr(v.city):"",v.addr||""].filter(Boolean).join(" · "))}</small></div>${mapUrl?`<a class="secondary-button vm-nav" href="${esc(mapUrl)}" target="_blank" rel="noopener noreferrer">${esc(tr("地图导航"))} ↗</a>`:""}</header>${r.halls.length?`<div class="vm-halls">${r.halls.map(h=>{const acc=[...(v.access||[]),...(h.access||[])];return `<span class="vm-hall">${esc(h.name)}${acc.length?` <em>${esc(tr("无障碍"))}</em>`:""}</span>`;}).join("")}</div>`:""}${trRows.length?`<dl class="vm-tr">${trRows.map(([k,val])=>`<dt>${esc(tr(k))}</dt><dd>${esc(val)}</dd>`).join("")}</dl>`:""}<button type="button" class="vm-open" data-vsel="${id}" aria-expanded="${sel}" aria-controls="vb-${id}" aria-label="${esc(tr(sel?"收起本院影片与排片":"看本院影片与排片"))}"><span>${sel?`<b>${esc(stripCity(v.short||v.name,v))}</b>`:esc(tr("看本院影片与排片"))}</span><em class="mono">${esc(cnt)}</em>${vbChevron}</button>${sel?`<div class="vm-board" id="vb-${id}">${venueBoardHTML(pid,v.id)}</div>`:""}</article>`;
  }).join("")||`<div class="fd-noshow"><b>${esc(tr("暂无影院排片信息"))}</b></div>`;
}
function venuesPage(pid){
  const p=PG[pid]; if(!p){go("programmes");return;}
  const rows=progVenuesOf(pid);
  vmUse(pid,rows);
  if(vmSel&&!rows.some(r=>r.v.id===vmSel))vmSel="";
  topEl.innerHTML=`<div class="row"><button class="back" data-back><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m15 6-6 6 6 6"/></svg>${esc(tr("返回"))}</button><span class="sp"></span><span class="pill">${esc(p.name)}</span></div>`;
  const sig=rows.map(r=>r.v.id+(Array.isArray(r.v.geo)?"@"+r.v.geo.join(","):"")).join("|");
  const cur=main.querySelector(".vm-page");
  if(cur&&cur.dataset.pid===pid&&cur.dataset.sig===sig){ // 同一专题重绘（加入排片、数据自动更新）：只换影院列表，地图不重建
    const box=cur.querySelector(".vm-cards"); if(box)box.innerHTML=venueCardsHTML(pid,rows);
    vmPinTop();
    if(vmState){vmState.activeId=vmState.pts.some(x=>x.v.id===vmSel)?vmSel:"";renderVenueMap();}
    return;
  }
  const map=venueMapHTML(rows);
  main.innerHTML=`<section class="view gut vm-page" data-pid="${esc(pid)}" data-sig="${esc(sig)}"><h1 class="sec">${esc(tr("影院地图与交通"))}</h1><p class="sub">${esc(p.name)} · ${rows.length} ${esc(tr("家影院"))}</p><div class="vm-split${map?"":" vm-nomap"}">${map}<div class="vm-cards">${venueCardsHTML(pid,rows)}</div></div>${venueTransfersHTML(rows)}${presentersHTML()}</section>`;
  vmPinTop(); vmWatch();
  if(vmState){
    const stage=document.getElementById("vm-stage");
    if(stage){
      vmState.fit=venueMapFit(vmState.pts,stage.clientWidth||640,stage.clientHeight||340);
      if(vmState.fresh){vmState.z=vmState.fit.z;vmState.lat=vmState.fit.lat;vmState.lon=vmState.fit.lon;vmState.fresh=false;}
      vmState.activeId=vmState.pts.some(x=>x.v.id===vmSel)?vmSel:"";
      renderVenueMap();bindVenueMapDrag();
    }
  }
}
// 地图吸顶的位置：紧贴顶栏底边（顶栏高度随内容变化，量一下再定）
/* 实际量一下：这个浏览器会不会把 #main 里的 CSS 长度（含吸顶 top）乘上 zoom。新版 Chrome / Safari 会（量到 90），
   微信内置浏览器等旧内核不会（量到 100）——按 computed zoom 一律去除会多除，标题条就悬空一条。按页面缓存结果 */
function vmZoom(){
  const pg=document.querySelector(".vm-page"); if(!pg)return 1;
  if(pg._vz)return pg._vz;
  const d=document.createElement("div"); d.style.cssText="position:absolute;visibility:hidden;pointer-events:none;width:1px;height:100px;top:0;left:0";
  pg.appendChild(d); const h=d.getBoundingClientRect().height; d.remove();
  return pg._vz=(h>40&&h<160?h/100:1);
}
function vmPinTop(){
  const pg=document.querySelector(".vm-page"),pin=document.querySelector(".vm-dock"),tb=document.getElementById("topbar");if(!pg||!tb)return;
  const b=tb.getBoundingClientRect().bottom,z=vmZoom(); // 专题类页面整体缩放（#main.prog-scale{zoom:.9}），吸顶位置要换算回缩放前的长度
  if(pin&&b>0)pin.style.setProperty("--vm-top",(b/z).toFixed(2)+"px");
  const v=(vmListTop()/z).toFixed(2)+"px"; if(pg.style.getPropertyValue("--vm-list")!==v)pg.style.setProperty("--vm-list",v); // 展开的影院标题条吸在地图下沿
}
// 影院列表可见区域的上沿：地图吸在列表上方时是地图底边；宽屏左右分栏或矮屏不吸顶时是顶栏底边
function vmListTop(){
  const tb=document.getElementById("topbar"),top=tb?Math.max(0,tb.getBoundingClientRect().bottom):0,pin=document.querySelector(".vm-dock"),cards=document.querySelector(".vm-cards");
  if(!pin||!cards||getComputedStyle(pin).position!=="sticky")return top;
  const pr=pin.getBoundingClientRect(),cr=cards.getBoundingClientRect();
  if(pr.left>=cr.right-1||pr.right<=cr.left+1)return top;
  return top+pr.height;
}
function vmScrollTo(vid){
  const card=document.getElementById("vc-"+vid);if(!card)return;
  const y=window.scrollY+card.getBoundingClientRect().top-vmListTop()-10;
  window.scrollTo({top:Math.max(0,y),behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
}
// 选中 / 取消一家影院：地图把它移到中间并高亮，卡片展开影片与排片，列表滚到这张卡片
function vmSelect(id,zoom){
  vmSel=id||""; vmPick={film:"",day:undefined};
  if(vmState){
    const pt=vmSel&&vmState.pts.find(x=>x.v.id===vmSel);
    vmState.activeId=pt?vmSel:"";
    if(pt){vmState.lat=pt.geo[0];vmState.lon=pt.geo[1];if(zoom)vmState.z=Math.max(vmState.z,15);}
    renderVenueMap();
  }
  const box=document.querySelector(".vm-cards"); if(box)box.innerHTML=venueCardsHTML(vmPid,progVenuesOf(vmPid));
  if(vmSel)vmScrollTo(vmSel);
}
function vmBoardRefresh(){const box=document.getElementById("vb-"+vmSel);if(box)box.innerHTML=venueBoardHTML(vmPid,vmSel);}
window.addEventListener("resize",()=>{if(!document.querySelector(".vm-page"))return;vmPinTop();if(document.getElementById("vm-stage")&&vmState)renderVenueMap();});
/* 手机浏览器工具栏收起 / 展开会改变视口高度（地图高度用 vh），微信内置浏览器等不一定发 resize：
   滚动时和地图、顶栏尺寸变化时都重新量一次，展开的影院标题条始终贴着地图下沿，不会悬空一条 */
{let raf=0;const again=()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;if(document.querySelector(".vm-page"))vmPinTop();});};
 window.addEventListener("scroll",again,{passive:true});
 if(typeof ResizeObserver!=="undefined"){const ro=new ResizeObserver(again);vmWatch=()=>{ro.disconnect();const d=document.querySelector(".vm-dock"),tb=document.getElementById("topbar");if(d)ro.observe(d);if(tb)ro.observe(tb);};}}
document.addEventListener("click",e=>{
  if(!e.target.closest||!e.target.closest(".vm-page"))return;
  const md=e.target.closest("[data-vm-mode]");
  if(md&&vmState){vmMode=md.dataset.vmMode;renderVenueMap();return;}
  const act=e.target.closest("[data-vm-act]");
  if(act&&vmState){
    const a=act.dataset.vmAct;
    if(a==="in")vmState.z=Math.min(17,vmState.z+1);
    else if(a==="out")vmState.z=Math.max(8,vmState.z-1);
    else if(a==="fit"){vmState.z=vmState.fit.z;vmState.lat=vmState.fit.lat;vmState.lon=vmState.fit.lon;}
    renderVenueMap();return;
  }
  if(e.target.closest(".vm-nav,[data-film],[data-plan]"))return; // 地图导航、进影片页、加入排片各有处理
  const vf=e.target.closest("[data-vfocus]");
  if(vf){vmSelect(vf.dataset.vfocus,true);return;}
  const pin=e.target.closest("[data-vpin]");
  if(pin){if(!(vmTapId===pin.dataset.vpin&&Date.now()-vmTapAt<800))vmSelect(pin.dataset.vpin);return;}
  const sel=e.target.closest("[data-vsel]");
  if(sel){vmSelect(vmSel===sel.dataset.vsel?"":sel.dataset.vsel);return;}
  const fb=e.target.closest("[data-vbfilm]");
  if(fb){vmPick.film=vmPick.film===fb.dataset.vbfilm?"":fb.dataset.vbfilm;vmPick.day=undefined;vmBoardRefresh();return;}
  const db=e.target.closest("[data-vbday]");
  if(db){vmPick.day=db.dataset.vbday;vmBoardRefresh();}
});
function progPage(pid){
  if(sectionProgramme!==pid){sectionFilter="";sectionProgramme=pid;}
  const p=PG[pid]; if(!p){ notFoundPage("prog"); return; }
  const shows=progShows(pid), fids=[...new Set(shows.map(x=>x.id))], films=catalogueFilms().filter(f=>f.prog===pid||p.sections?.[f.id]||p.members?.includes(f.id)||fids.includes(f.id)).sort(filmOrder);
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
      ${p.sections?`<div class="plan-scope sec-scope"><button class="schedule-filter" data-section-sel aria-haspopup="dialog"><span><small>${esc(tr("选择单元"))}</small><b>${esc(tr(secLabel(sectionFilter)))}</b></span><span class="scope-count">${tr(films.filter(f=>programmeFilmInSection(f,pid,sectionFilter)).length+" 部")}</span>${filterChevron}</button></div>`:""}
      ${sectionNoteHTML(p,sectionFilter)}
      <div class="plan-toolbar"><button class="primary-button" data-prog-jump="up">即将放映</button><button class="secondary-button" data-prog-jump="gone">已结束</button></div>
      <p class="src">场次与排片表自动同步 · 页面打开时每分钟检查更新</p>${films.length?progFilmsHTML(pid,films):`<div class="fd-noshow"><b>片单与场次即将公布</b><span>公布后会第一时间更新到这里。</span></div>`}
    </div></article>`;
}
function about(){
  main.innerHTML = `<section class="view gut about"><h1 class="sec">关于影展</h1>
    <p class="sub">风格万相 · 中外经典影片展</p>
    <dl class="kv"><dt>展期</dt><dd>2026.10 – 2027.01</dd><dt>影院</dt><dd>${VENUES.map(v=>esc(v.name+(v.halls.length?"（"+v.halls.map(h=>h.name).join("、")+"）":""))).join("<br>")}</dd><dt>本页场次</dt><dd>10.30 – 11.08，共 ${SH.length} 场 / ${FILMS.length} 部</dd></dl>
    <p>从伯格曼的公路回忆到塔可夫斯基的末日祈祷，从费穆的城墙到徐克的江湖，十七部作品横跨 1947 至 2025 年，排在同一块银幕上，恰好是一份关于“风格”的地图。</p>
    <p class="src">后续场次公布后将补充至排片表。</p></section>`;
}
