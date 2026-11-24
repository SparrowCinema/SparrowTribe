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
let vmState=null, vmMode="street";
function vmMercX(lon,z){return ((lon+180)/360)*256*Math.pow(2,z);}
function vmMercY(lat,z){const r=lat*Math.PI/180;return (1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*256*Math.pow(2,z);}
function vmTileUrl(z,x,y,overseas){
  const n=Math.pow(2,z), wx=((x%n)+n)%n;
  if(y<0||y>=n)return "";
  if(overseas){const s=["a","b","c","d"][(wx+y)&3];return `https://${s}.basemaps.cartocdn.com/rastertiles/voyager/${z}/${wx}/${y}@2x.png`;}
  const s=(wx+y)%4+1;
  return `https://webrd0${s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=2&style=8&x=${wx}&y=${y}&z=${z}`;
}
function vmContoursSVG(W,H){
  // Hand-drawn museum-atlas topographic contours + delicate coordinate frame (visible immediately & in 手绘底图 mode)
  const curves=[
    `M-20,${(H*0.22).toFixed(0)} Q${(W*0.24).toFixed(0)},${(H*0.10).toFixed(0)} ${(W*0.52).toFixed(0)},${(H*0.26).toFixed(0)} T${W+20},${(H*0.18).toFixed(0)}`,
    `M-20,${(H*0.36).toFixed(0)} Q${(W*0.28).toFixed(0)},${(H*0.24).toFixed(0)} ${(W*0.56).toFixed(0)},${(H*0.40).toFixed(0)} T${W+20},${(H*0.33).toFixed(0)}`,
    `M-20,${(H*0.64).toFixed(0)} Q${(W*0.30).toFixed(0)},${(H*0.78).toFixed(0)} ${(W*0.62).toFixed(0)},${(H*0.62).toFixed(0)} T${W+20},${(H*0.72).toFixed(0)}`,
    `M-20,${(H*0.80).toFixed(0)} Q${(W*0.34).toFixed(0)},${(H*0.92).toFixed(0)} ${(W*0.68).toFixed(0)},${(H*0.78).toFixed(0)} T${W+20},${(H*0.88).toFixed(0)}`
  ];
  const river=`M-20,${(H*0.52).toFixed(0)} C${(W*0.22).toFixed(0)},${(H*0.42).toFixed(0)} ${(W*0.46).toFixed(0)},${(H*0.68).toFixed(0)} ${(W*0.72).toFixed(0)},${(H*0.48).toFixed(0)} S${(W*0.92).toFixed(0)},${(H*0.56).toFixed(0)} ${W+20},${(H*0.46).toFixed(0)}`;
  const grid=[0.2,0.4,0.6,0.8].map(f=>`<line x1="${(W*f).toFixed(1)}" y1="12" x2="${(W*f).toFixed(1)}" y2="${H-12}"/><line x1="12" y1="${(H*f).toFixed(1)}" x2="${W-12}" y2="${(H*f).toFixed(1)}"/>`).join("");
  return `<g class="vm-atlas"><path class="vm-river" d="${river}"/>${curves.map(d=>`<path class="vm-contour" d="${d}"/>`).join("")}<g class="vm-grid">${grid}</g></g>`;
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
  const {pts,z,lat,lon,overseas,activeId}=vmState;
  const cx=vmMercX(lon,z), cy=vmMercY(lat,z);
  const toXY=g=>[W/2+(vmMercX(g[1],z)-cx), H/2+(vmMercY(g[0],z)-cy)];

  // 1. Real cartographic tiles (when in street mode)
  const tilesEl=stage.querySelector(".vm-tiles");
  if(tilesEl){
    if(vmMode==="street"){
      const tx0=Math.floor((cx-W/2)/256), tx1=Math.floor((cx+W/2)/256);
      const ty0=Math.floor((cy-H/2)/256), ty1=Math.floor((cy+H/2)/256);
      let html="";
      for(let tx=tx0;tx<=tx1;tx++)for(let ty=ty0;ty<=ty1;ty++){
        const u=vmTileUrl(z,tx,ty,overseas); if(!u)continue;
        const left=Math.round(W/2+(tx*256-cx)), top=Math.round(H/2+(ty*256-cy));
        html+=`<img class="vm-tile" src="${esc(u)}" alt="" draggable="false" loading="eager" style="left:${left}px;top:${top}px" onerror="this.style.opacity='0'">`;
      }
      tilesEl.innerHTML=html; tilesEl.style.opacity="1";
    } else {
      tilesEl.innerHTML=""; tilesEl.style.opacity="0";
    }
  }

  // 2. Vector overlay: hand-drawn atlas backdrop + transfer arcs + numbered pins + compass + scale
  const svg=stage.querySelector(".vm-svg"); if(!svg)return;
  svg.setAttribute("viewBox",`0 0 ${W} ${H}`);
  const coords=pts.map(p=>({...p,xy:toXY(p.geo)}));
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
    const [x,y]=p.xy, label=stripCity(p.v.short||p.v.name,p.v), num=String(p.i).padStart(2,"0"), hi=activeId===p.v.id?" hi":"";
    return `<g class="vm-pin${hi}" data-vpin="${esc(p.v.id)}" tabindex="0" role="button" aria-label="${esc(p.v.name)}"><circle class="vm-halo" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${hi?20:15}"/><circle class="vm-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="11.5"/><text class="vm-num" x="${x.toFixed(1)}" y="${(y+3.5).toFixed(1)}" text-anchor="middle">${num}</text><text class="vm-lab" x="${x.toFixed(1)}" y="${(y+25).toFixed(1)}" text-anchor="middle">${esc(label.slice(0,12))}</text></g>`;
  }).join("");
  const mPerPx=156543.03392*Math.cos(lat*Math.PI/180)/Math.pow(2,z);
  const targetM=mPerPx*76;
  const nice=[100,200,500,1000,2000,5000,10000,20000].find(v=>v>=targetM)||5000;
  const barPx=Math.max(34,Math.min(120,nice/mPerPx));
  const barTxt=nice>=1000?(nice/1000)+" km":nice+" m";
  const compass=`<g class="vm-compass" transform="translate(${W-32},34)" aria-hidden="true"><circle cx="0" cy="0" r="14"/><path d="M0,-10 L3,0 L0,-2 L-3,0 Z" class="vm-cn"/><path d="M0,10 L2.5,0 L0,2 L-2.5,0 Z" class="vm-cs"/><text x="0" y="-16" text-anchor="middle">N</text></g>`;
  const scale=`<g class="vm-scale" transform="translate(16,${H-16})"><rect x="-6" y="-12" width="${(barPx+52).toFixed(0)}" height="20" rx="5"/><line x1="0" y1="0" x2="${barPx.toFixed(1)}" y2="0"/><line x1="0" y1="-4" x2="0" y2="4"/><line x1="${barPx.toFixed(1)}" y1="-4" x2="${barPx.toFixed(1)}" y2="4"/><text x="${(barPx+7).toFixed(1)}" y="3.5">${barTxt}</text></g>`;
  svg.innerHTML=`${vmContoursSVG(W,H)}<g class="vm-arcs">${arcs}</g>${pins}${compass}${scale}`;
  stage.classList.toggle("sketch",vmMode==="sketch");
  stage.querySelectorAll("[data-vm-mode]").forEach(b=>b.classList.toggle("on",b.dataset.vmMode===vmMode));
}
function venueMapHTML(rows){
  const pts=rows.map((r,i)=>({i:i+1,v:r.v,geo:Array.isArray(r.v.geo)&&r.v.geo.length===2?r.v.geo:null})).filter(x=>x.geo);
  if(!pts.length)return "";
  const overseas=typeof SparrowPlanner!=="undefined"&&pts.every(p=>SparrowPlanner.isOverseasGeo(p.v));
  const fit=venueMapFit(pts,640,340);
  vmState={pts,overseas,fit,z:fit.z,lat:fit.lat,lon:fit.lon,activeId:""};
  return `<figure class="vm-wrap"><div class="vm-stage" id="vm-stage" aria-label="${esc(tr("展映影院地图"))}"><div class="vm-tiles" aria-hidden="true"></div><svg class="vm-svg" role="img" aria-label="${esc(tr("展映影院地图"))}"></svg><div class="vm-ctrls"><div class="vm-seg" role="group" aria-label="${esc(tr("地图风格"))}"><button type="button" data-vm-mode="street" class="${vmMode==="street"?"on":""}">${esc(tr("街道地图"))}</button><button type="button" data-vm-mode="sketch" class="${vmMode==="sketch"?"on":""}">${esc(tr("手绘底图"))}</button></div><div class="vm-zbtns"><button type="button" data-vm-act="in" aria-label="${esc(tr("放大"))}">＋</button><button type="button" data-vm-act="out" aria-label="${esc(tr("缩小"))}">－</button><button type="button" data-vm-act="fit" aria-label="${esc(tr("重置视角"))}">⌖</button></div></div></div><figcaption>${esc(tr("可拖拽平移或缩放 · 点击编号定位对应影院 · 导航按实际路况打开地图"))}</figcaption></figure>`;
}
function bindVenueMapDrag(){
  const stage=document.getElementById("vm-stage"); if(!stage||stage._vmBound)return;
  stage._vmBound=true;
  let drag=null;
  stage.addEventListener("pointerdown",e=>{
    if(e.target.closest("button,[data-vpin]"))return;
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
function venuesPage(pid){
  const p=PG[pid]; if(!p){go("programmes");return;}
  const rows=progVenuesOf(pid);
  topEl.innerHTML=`<div class="row"><button class="back" data-back><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m15 6-6 6 6 6"/></svg>${esc(tr("返回"))}</button><span class="sp"></span><span class="pill">${esc(p.name)}</span></div>`;
  const cards=rows.map((r,i)=>{
    const v=r.v, num=String(i+1).padStart(2,"0"), mapUrl=typeof SparrowPlanner!=="undefined"?SparrowPlanner.mapURL(v):"";
    const trRows=v.transit?[["地铁",v.transit.metro],["公交",v.transit.bus],["停车",v.transit.parking],["提示",v.transit.note]].filter(x=>x[1]):[];
    return `<article class="vm-card" id="vc-${esc(v.id)}"><header class="vm-ch"><button type="button" class="vm-idx mono" data-vfocus="${esc(v.id)}" title="${esc(tr("在地图上定位"))}">${num}</button><div class="vm-ct"><h3>${esc(v.name)}</h3><small>${esc([v.city?tr(v.city):"",v.addr||""].filter(Boolean).join(" · "))}</small></div>${mapUrl?`<a class="secondary-button vm-nav" href="${esc(mapUrl)}" target="_blank" rel="noopener noreferrer">${esc(tr("地图导航"))} ↗</a>`:""}</header><div class="vm-halls">${r.halls.map(h=>{const acc=[...(v.access||[]),...(h.access||[])];return `<span class="vm-hall">${esc(h.name)}${acc.length?` <em>${esc(tr("无障碍"))}</em>`:""}</span>`;}).join("")}<span class="vm-cnt mono">${tr(r.total+" 场")}${r.up?` · ${tr("待映")} ${r.up}`:""}</span></div>${trRows.length?`<dl class="vm-tr">${trRows.map(([k,val])=>`<dt>${esc(tr(k))}</dt><dd>${esc(val)}</dd>`).join("")}</dl>`:""}</article>`;
  }).join("");
  main.innerHTML=`<section class="view gut vm-page"><h2 class="sec">${esc(tr("影院地图与交通"))}</h2><p class="sub">${esc(p.name)} · ${rows.length} ${esc(tr("家影院"))}</p>${venueMapHTML(rows)}<div class="vm-cards">${cards||`<div class="fd-noshow"><b>${esc(tr("暂无影院排片信息"))}</b></div>`}</div>${venueTransfersHTML(rows)}${presentersHTML()}</section>`;
  if(vmState){
    const stage=document.getElementById("vm-stage");
    if(stage){vmState.fit=venueMapFit(vmState.pts,stage.clientWidth||640,stage.clientHeight||340);vmState.z=vmState.fit.z;vmState.lat=vmState.fit.lat;vmState.lon=vmState.fit.lon;renderVenueMap();bindVenueMapDrag();}
  }
}
window.addEventListener("resize",()=>{if(document.getElementById("vm-stage")&&vmState)renderVenueMap();});
document.addEventListener("click",e=>{
  const md=e.target.closest("[data-vm-mode]");
  if(md&&vmState){vmMode=md.dataset.vmMode;renderVenueMap();return;}
  const act=e.target.closest("[data-vm-act]");
  if(act&&vmState){
    const a=act.dataset.vmAct;
    if(a==="in")vmState.z=Math.min(17,vmState.z+1);
    else if(a==="out")vmState.z=Math.max(8,vmState.z-1);
    else if(a==="fit"){vmState.z=vmState.fit.z;vmState.lat=vmState.fit.lat;vmState.lon=vmState.fit.lon;vmState.activeId="";}
    renderVenueMap();return;
  }
  const vf=e.target.closest("[data-vfocus]");
  if(vf&&vmState){
    const pt=vmState.pts.find(p=>p.v.id===vf.dataset.vfocus);
    if(pt){vmState.lat=pt.geo[0];vmState.lon=pt.geo[1];vmState.z=Math.max(vmState.z,15);vmState.activeId=pt.v.id;renderVenueMap();document.getElementById("vm-stage")?.scrollIntoView({behavior:"smooth",block:"center"});}
    return;
  }
  const pin=e.target.closest("[data-vpin]");
  if(pin){
    if(vmState){vmState.activeId=pin.dataset.vpin;renderVenueMap();}
    const card=document.getElementById("vc-"+pin.dataset.vpin);
    if(card){document.querySelectorAll(".vm-card.hi").forEach(x=>x.classList.remove("hi"));card.classList.add("hi");card.scrollIntoView({behavior:"smooth",block:"center"});}
  }
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
