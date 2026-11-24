/* js/router.js — 路由、数据加载与自动更新、定位、启动（必须最后加载）。
   网站脚本按功能拆成 js/*.js，按 index.html 里的顺序加载；部署时 tools/build-assets.js 按同样顺序合并成一个 app.js。 */

let pendingFlash=null, lastList="schedule";
let activeRoute="", filmReturn="schedule", capturedRoute="";
const viewPositions=new Map();
if("scrollRestoration" in history)history.scrollRestoration="manual";
function rememberView(h){if(!h)return;viewPositions.set(h,{x:window.scrollX,y:window.scrollY,gantt:document.getElementById("gantt")?.scrollLeft||0,filters:[...document.querySelectorAll(".filters")].map(el=>el.scrollLeft)});}
function restoreView(h){const p=viewPositions.get(h);if(!p)return;const apply=()=>{if(activeRoute!==h)return;window.scrollTo(p.x,p.y);const g=document.getElementById("gantt");if(g)g.scrollLeft=p.gantt;document.querySelectorAll(".filters").forEach((el,i)=>{el.scrollLeft=p.filters[i]||0;});};apply();requestAnimationFrame(apply);}
function exitFilm(){goBack(filmReturn||lastList);}
function filmDismissDirection(dx,dy,atTop){if(Math.abs(dx)>=84&&Math.abs(dx)>Math.abs(dy)*1.4)return dx<0?"left":"right";if(atTop&&dy>=110&&dy>Math.abs(dx)*1.5)return "down";return "";}
let filmSwipe=null,suppressFilmClickUntil=0;
function resetFilmSwipe(){const el=filmSwipe?.el;if(el){el.style.transform="";el.style.opacity="";el.style.willChange="";}filmSwipe=null;}
document.addEventListener("touchstart",e=>{resetFilmSwipe();if(e.touches.length!==1||!location.hash.startsWith("#film-")||document.querySelector("dialog[open],.img-sheet"))return;const el=e.target.closest(".fd");if(!el||e.target.closest("button,a,input,textarea,select,.fd-jump"))return;const t=e.touches[0];filmSwipe={el,x:t.clientX,y:t.clientY,id:t.identifier,atTop:window.scrollY<=2,dx:0,dy:0,axis:""};},{passive:true});
document.addEventListener("touchmove",e=>{const s=filmSwipe;if(!s)return;if(e.touches.length!==1){resetFilmSwipe();return;}const t=e.touches[0];if(t.identifier!==s.id)return;s.dx=t.clientX-s.x;s.dy=t.clientY-s.y;if(!s.axis&&Math.max(Math.abs(s.dx),Math.abs(s.dy))>12){if(Math.abs(s.dx)>Math.abs(s.dy)*1.4)s.axis="x";else if(s.atTop&&s.dy>0&&s.dy>Math.abs(s.dx)*1.5)s.axis="y";else{resetFilmSwipe();return;}}if(s.axis){if(e.cancelable)e.preventDefault();s.el.style.willChange="transform";s.el.style.transform=s.axis==="x"?`translateX(${s.dx*.65}px)`:`translateY(${Math.max(0,s.dy)*.65}px)`;s.el.style.opacity=String(Math.max(.65,1-Math.abs(s.axis==="x"?s.dx:s.dy)/1200));}},{passive:false});
document.addEventListener("touchend",e=>{const s=filmSwipe;if(!s)return;const t=[...e.changedTouches].find(t=>t.identifier===s.id);if(t){s.dx=t.clientX-s.x;s.dy=t.clientY-s.y;}const close=s.axis&&filmDismissDirection(s.dx,s.dy,s.atTop);resetFilmSwipe();if(close){suppressFilmClickUntil=Date.now()+400;exitFilm();}},{passive:true});
document.addEventListener("touchcancel",resetFilmSwipe,{passive:true});
document.addEventListener("click",e=>{if(Date.now()<suppressFilmClickUntil){e.preventDefault();e.stopImmediatePropagation();}},true);

let navFwd=false,navBack=false;
document.addEventListener("click",e=>{if(e.target.closest&&e.target.closest('a[href^="#"]'))navFwd=true;},true);
function goBack(h){navBack=true;go(h);}
function go(h){navFwd=true;if(activeRoute&&h!==activeRoute){rememberView(activeRoute);capturedRoute=activeRoute;}location.hash=h;}
// 每个影片页 / 专题页用自己的标题和简介（浏览器标签、书签，以及搜索引擎渲染后收录的页面），其他页面恢复默认
let BASE_TITLE=null,BASE_DESC=null;
function routeMeta(h){
  const md=document.querySelector('meta[name="description"]');
  if(BASE_TITLE===null){ BASE_TITLE=document.title; BASE_DESC=md?md.content:""; }
  let t="",d="";
  if(h.startsWith("film-")){ const f=F[h.slice(5)]; if(f){ t=f.cn+(f.y?" ("+f.y+")":""); d=[f.dir,f.syn?String(f.syn).replace(/\s+/g," ").slice(0,120):""].filter(Boolean).join(" · "); } }
  else if(h.startsWith("prog-")){ const p=PG[h.slice(5)]; if(p){ t=p.name; d=[p.period,p.blurb||p.sub].filter(Boolean).join(" · "); } }
  document.title=t?t+" · "+tr("麻雀观影护照"):BASE_TITLE;
  if(md) md.content=d||BASE_DESC;
}
function route(){
  if(!READY) return;
  const h = location.hash.slice(1) || "schedule";
  try{ routeMeta(h); }catch(e){}
  const changing=activeRoute!==h;
  if(changing){ stat('pv',statRouteKind(h)); if(h.startsWith('film-')) stat('film',h.slice(5)); else if(h.startsWith('prog-')) stat('prog',h.slice(5)); }
  if(changing){if(capturedRoute!==activeRoute)rememberView(activeRoute);capturedRoute="";resetFilmSwipe();if(h.startsWith("film-")&&activeRoute&&!activeRoute.startsWith("film-"))filmReturn=activeRoute;}
  const fwd=navFwd,bk=navBack;navFwd=false;navBack=false;
  const returning=changing&&viewPositions.has(h)&&(bk||!fwd||(activeRoute.startsWith("film-")&&h===filmReturn));
  activeRoute=h;
  main.classList.toggle("prog-scale",h==="programmes"||h.startsWith("prog-")||h.startsWith("events-")||h.startsWith("venues-"));
  const tab = ["plan","export","about","install","poster-wall","ticket-wall","taste-map","guide"].includes(h)||h.startsWith("share=")||h.startsWith("verify=")||h.startsWith("checkin=")||h==="checkin-host" ? "my" : h==="gantt" ? "schedule" : h.startsWith("prog-")||h.startsWith("events-")||h.startsWith("venues-") ? "programmes" : h.startsWith("film-") ? null : h;
  document.querySelectorAll(".tab").forEach(t=>t.setAttribute("aria-current", t.dataset.tab===(tab||lastList)?"page":"false"));
  if(tab){ lastList = tab; topEl.innerHTML = brandBar(); }
  if(h.startsWith("film-")){ detail(h.slice(5)); wantMarkSeen(h.slice(5)); const lf=F[h.slice(5)]; if(lf&&lf._lite) ensureFull(lf).then(ok=>{ if(!ok) return; const paint=()=>{ if(activeRoute!==h||location.hash.slice(1)!==h) return; if(document.querySelector("dialog[open],.img-sheet,.ts-wrap")){ setTimeout(paint,600); return; } const y=window.scrollY; detail(h.slice(5)); window.scrollTo(0,y); }; paint(); }); }
  else if(h.startsWith("prog-")) progPage(h.slice(5));
  else if(h.startsWith("events-")) eventsPage(h.slice(7));
  else if(h.startsWith("venues-")) venuesPage(h.slice(7));
  else if(h==="films") films();
  else if(h==="programmes") programmesPage();
  else if(h==="my"||h==="about") myPage();
  else if(h==="plan") planPage();
  else if(h==="stats") statsPage();
  else if(h==="poster-wall") posterWallPage();
  else if(h==="ticket-wall") {if(changing){ticketDraft=null;ticketMode="album";ticketPick=null;ticketExportOpen=false;if(ticketFilmJump)ticketFilmJump=false;else ticketQ.film="";}ticketWallPage();}
  else if(h==="taste-map") tasteMapPage();
  else if(h==="guide") guidePage();
  else if(h==="install") installPage();
  else if(h==="export") exportPage();
  else if(h.startsWith("share=")) exportPage(h.slice(6));
  else if(h.startsWith("verify=")) verifyPage(h.slice(7));
  else if(h.startsWith("checkin=")) checkinPage(h.slice(8));
  else if(h==="checkin-host") checkinHostPage();
  else schedule();
  if(h.startsWith('film-')||h==='my')loadCommunity();
  if(returning)restoreView(h);else if(!pendingFlash)window.scrollTo(0,0);
}
document.addEventListener("click",e=>{
  const t=e.target.closest("[data-film],[data-tab],[data-filt],[data-vf],[data-pf],[data-prog],[data-prog-sched],[data-prog-films],[data-prog-jump],[data-back],[data-jump],[data-day],[data-open-gantt],[data-ppf]"); if(!t) return;
  if(t.dataset.film) go("film-"+t.dataset.film);
  else if(t.dataset.tab) go(t.dataset.tab);
  else if(t.dataset.vf){ vfilt=t.dataset.vf; const y=window.scrollY; schedule(); window.scrollTo(0,y); }
  else if(t.dataset.pf){ if(location.hash==="#films"){ ffilt=t.dataset.pf; films(); } else { pfilt=t.dataset.pf; vfilt="all"; cityFilt="all"; cityManual(); venueQuery=""; sday=null; schedule(); } }
  else if(t.dataset.prog) go("prog-"+t.dataset.prog);
  else if(t.dataset.progSched){ pfilt=t.dataset.progSched; vfilt="all"; cityFilt="all"; cityManual(); venueQuery=""; sday=null; go("schedule"); }
  else if(t.dataset.progJump){ const el=document.getElementById(t.dataset.progJump==="gone"?"pg-gone":"pg-up"); if(el){ if(el.tagName==="DETAILS") el.open=true; el.scrollIntoView({behavior:"smooth",block:"start"}); } else toast("暂无已结束的影片"); }
  else if(t.dataset.progFilms){ ffilt=t.dataset.progFilms; fcity="all"; fyear="all"; freg="all"; flen="all"; fmine="all"; ftrait="all"; fq=""; go("films"); }
  else if(t.hasAttribute("data-back")){if(activeRoute.startsWith("film-"))exitFilm();else if(activeRoute.startsWith("events-")||activeRoute.startsWith("venues-"))goBack("prog-"+activeRoute.slice(7));else goBack(lastList);}
  else if(t.dataset.jump){ const js=SH.find(x=>keyOf(x)===t.dataset.jump); pfilt=js?js.p:"all"; vfilt="all"; cityFilt="all"; cityManual(); venueQuery=""; scheduleView="gantt";pendingFlash=t.dataset.jump; sday=t.dataset.jump.split("-")[0]; if(location.hash==="#schedule"||location.hash===""){schedule();}else go("schedule"); }
  else if(t.dataset.ppf){ planFilt=t.dataset.ppf; const y=window.scrollY; route(); window.scrollTo(0,y); }
  else if(t.dataset.day){ sday=t.dataset.day; const y=window.scrollY; schedule(); window.scrollTo(0,y); }
  else if(t.hasAttribute("data-open-gantt")) go("schedule");
});
window.addEventListener("hashchange",route);
let READY=false;
function normalizeFilm(f,pid){
  f.prog=f.prog||pid; f.cn=f.cn||f.o||f.en||f.id;
  f.r=Array.isArray(f.r)?f.r.slice(0,5):[]; while(f.r.length<5) f.r.push(null);
  ["genre","honors","highlights","cast","writers","warnings","access"].forEach(k=>{ if(!Array.isArray(f[k])) f[k]=f[k]?[f[k]]:[]; });
  if(!(+f.min>0)){ f.min=120; f.minTbd=true; } else f.min=+f.min;
  if(!REG[f.reg]){ REG.ot=REG.ot||{n:"其他",c:"#5f6b73"}; f.reg="ot"; }
  return f;
}
let dataSignature="",dataRefreshBusy=false,lastDataCheck=0;
/* 影片详情按需补全：精简数据里的影片带 _lite 标记和所在专题文件 _file；打开影片页时读取该专题文件，把长文字段合并回同一个影片对象 */
/* 手指按到影片入口时就开始取详情，进影片页时多半已经到了 */
document.addEventListener("pointerdown",e=>{const b=e.target.closest&&e.target.closest("[data-film]");if(b&&F[b.dataset.film])ensureFull(F[b.dataset.film]);},{passive:true});
let LITE_DETAIL=["syn","bio","st","parts","contentReview","contentNote","editorial","highlights"], fullPacks={};
function ensureFull(f){
 if(!f||!f._lite||!f._file)return Promise.resolve(false);
 const file=f._file,sig=dataSignature;
 fullPacks[file]=fullPacks[file]||fetch(file,{cache:"no-store"}).then(r=>{if(!r.ok)throw Error(file+" "+r.status);return r.json();}).then(pk=>{
  if(sig!==dataSignature)return false; /* 期间数据已整体更新，丢弃这次结果 */
  applyEN({},[pk]);
  (pk.films||[]).forEach(source=>{const t=F[source.id];if(!t||!t._lite||t._file!==file)return;const nf=normalizeFilm({...source},t.prog);LITE_DETAIL.forEach(k=>{if(k in nf)t[k]=nf[k];});delete t._lite;});
  return true;
 }).catch(e=>{console.warn("影片详情未加载",e);delete fullPacks[file];return false;});
 return fullPacks[file];
}
/* ===== 首页城市优先（定位）=====
   打开网页时用浏览器定位（只在本机换算成最近的已收录城市，不上传坐标，结果在本机保留 1 天）。
   定位城市有尚未散场的场次 → 排最前；没有场次、不在已收录城市、拒绝授权 → 维持默认（杭州优先，其余按目录顺序）。 */
const DEFAULT_HOME="杭州", GEO_KEY="sparrow-geo-city", GEO_ASKED="sparrow-geo-asked";
let CITIES={}; /* data/cities.json：全球城市中心坐标，启动时加载；新增影展城市（戛纳、柏林、威尼斯、釜山…）只要影院 city 写对中文城市名即可自动定位 */
let GEO_CITY=(()=>{try{const o=JSON.parse(localStorage.getItem(GEO_KEY)||"null");return o&&Date.now()-o.t<864e5?o:null;}catch(e){return null;}})();
function homeCity(venues=VENUES,shows=SH){const c=GEO_CITY&&GEO_CITY.c;if(c&&c!==DEFAULT_HOME){const ids=new Set(venues.filter(v=>v.city===c).map(v=>v.id));const t=now()-4*36e5;if(shows.some(x=>ids.has(x.v)&&showDate(x)>t))return c;}return DEFAULT_HOME;} /* 用开场时间判断（加载阶段影片表还没建好，不能用 isPast） */
function venueRank(venues,shows){let H=DEFAULT_HOME;try{H=homeCity(venues,shows);}catch(e){console.warn('定位排序失败，按默认顺序',e);}const r={};venues.forEach(v=>{r[v.id]=(v.city===H?0:v.city===DEFAULT_HOME?1e3:2e3)+(v._o||0);});return r;}
function applyHome(){const r=venueRank(VENUES,SH);VENUES.sort((a,b)=>r[a.id]-r[b.id]);SH.sort((a,b)=>showDate(a)-showDate(b)||r[a.v]-r[b.v]);}
function cityCenter(c){if(CITIES[c]&&Array.isArray(CITIES[c].geo))return CITIES[c].geo;const g=VENUES.filter(v=>v.city===c&&Array.isArray(v.geo)).map(v=>v.geo);return g.length?[g.reduce((a,x)=>a+x[0],0)/g.length,g.reduce((a,x)=>a+x[1],0)/g.length]:null;}
function nearestCity(lat,lng){const R=Math.PI/180;const pick=names=>{let best="",bd=Infinity;names.forEach(c=>{const g=cityCenter(c);if(!g)return;const lim=(CITIES[c]&&CITIES[c].r)||80;const a=Math.sin((g[0]-lat)*R/2)**2+Math.cos(lat*R)*Math.cos(g[0]*R)*Math.sin((g[1]-lng)*R/2)**2,d=12742*Math.asin(Math.sqrt(a));if(d<=lim&&d<bd){bd=d;best=c;}});return best;};const active=[...new Set(VENUES.map(v=>v.city).concat(PROGRAMMES.map(p=>p.city)).filter(Boolean))];return pick(active)||pick(Object.keys(CITIES));} /* 先在有影院/专题的城市里找；都不在范围内再用全球城市表，这样任何城市都能定位（没有场次时仍按默认顺序） */
function geoRerender(){const h=location.hash.slice(1)||"schedule";if(!READY||!["schedule","programmes","films"].includes(h))return;rememberView(h);route();restoreView(h);}
function locateCity(ask){
 if(!navigator.geolocation){if(ask)toast(tr("当前浏览器不支持定位，按默认顺序显示"));return;}
 try{localStorage.setItem(GEO_ASKED,"1");}catch(e){}
 navigator.geolocation.getCurrentPosition(pos=>{
  const before=homeCity(),prevC=GEO_CITY&&GEO_CITY.c,c=nearestCity(pos.coords.latitude,pos.coords.longitude);
  GEO_CITY={c,t:Date.now()};try{localStorage.setItem(GEO_KEY,JSON.stringify(GEO_CITY));}catch(e){}
  applyHome();const after=homeCity();
  if(after!==before||c!==prevC||ask)geoRerender();
  if(ask)toast(after===c&&c?tr("已按定位城市优先显示")+" · "+tr(c):tr("定位城市暂无排片，按默认顺序显示"));
 },()=>{if(ask)toast(tr("没有获得定位权限，按默认顺序显示"));},{enableHighAccuracy:false,timeout:10000,maximumAge:18e5});
}
async function geoBoot(){ /* 已授权：静默刷新；从没问过：首次打开时请求一次；拒绝过：不再打扰（可点「定位」重试） */
 if(!navigator.geolocation)return;let st="prompt";
 try{st=(await navigator.permissions.query({name:"geolocation"})).state;}catch(e){}
 if(st==="granted")return locateCity(false);
 if(st==="prompt"){let asked=false;try{asked=!!localStorage.getItem(GEO_ASKED);}catch(e){}if(!asked)locateCity(false);}
}
function geoChipHTML(){if(!navigator.geolocation)return"";const H=homeCity();const on=GEO_CITY&&GEO_CITY.c&&GEO_CITY.c===H;return `<button type="button" class="geo-chip${on?" on":""}" data-geo title="${esc(tr("按我所在的城市优先显示"))}"><svg aria-hidden="true" viewBox="0 0 24 24" width="13" height="13"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><circle cx="12" cy="10" r="2.3" fill="currentColor"/></svg>${on?esc(tr(H))+" "+tr("优先"):tr("定位")}</button>`;}
document.addEventListener("click",e=>{if(e.target.closest("[data-geo]"))locateCity(true);});
async function loadData(){
 const get=u=>fetch(u,{cache:"no-store"}).then(r=>{if(!r.ok)throw Error(u+" "+r.status);return r.json();});
 /* 精简启动：部署时 tools/build-lite.js 生成 data/version.json（数据版本号）和 data/lite.json（去掉详情页长文字段的全部专题数据）。
    先读版本号，没变就什么都不下载；变了只读 catalog + lite 两个文件。影片详情的长文字段在打开影片页时按需补全（ensureFull）。
    没有这两个文件（本地预览、未构建）或读取失败时，退回原来的整份加载。 */
 let ver="";try{const vj=await get("data/version.json");ver=vj.v||"";THUMBS=!!vj.th;}catch(e){}
 if(ver&&"v:"+ver===dataSignature)return false;
 const cat=await get("data/catalog.json"),programmes=cat.programmes||[],venues=cat.venues||[];
 if(!Object.keys(CITIES).length)try{CITIES=(await get("data/cities.json")).cities||{};}catch(e){console.warn("城市坐标未加载，定位仅用影院坐标",e);}
 let packs=null,signature="";
 if(ver)try{const lite=await get("data/lite.json");if(lite.v===ver&&lite.packs){packs=programmes.map(p=>p.file?lite.packs[p.id]||null:null);if(programmes.some((p,i)=>p.file&&!packs[i]))packs=null;else{signature="v:"+ver;LITE_DETAIL=lite.detail||LITE_DETAIL;}}}catch(e){console.warn("精简数据未加载，改用完整数据",e);}
 if(!packs){packs=await Promise.all(programmes.map(p=>p.file?get(p.file):null));signature=JSON.stringify([cat,packs]);if(signature===dataSignature)return false;}
 fullPacks={};
 applyEN(cat,packs);
 const vn=Object.fromEntries(venues.map(v=>[v.id,v])),films=[],filmMap={},shows=[];
 programmes.forEach((p,i)=>{const pk=packs[i];if(!pk)return;
  (pk.films||[]).forEach(source=>{if(filmMap[source.id])return;const f=normalizeFilm({...source},p.id);if(f._lite)f._file=p.file;filmMap[f.id]=f;films.push(f);});
 });
 programmes.forEach((p,i)=>{const pk=packs[i];if(!pk)return;
  (pk.shows||[]).forEach(r=>{const [d,t,id,v="premiere",hall="luxe",sid]=Array.isArray(r)?r:[r.d,r.t,r.id,r.v,r.h,r.sid];
   if(!filmMap[id]||!vn[v]||!vn[v].halls.some(x=>x.id===hall)){console.warn("场次数据不完整，已跳过",r);return;}shows.push(Object.assign({d,t,id,v,h:hall,p:p.id},sid?{sid}:{},!Array.isArray(r)&&r.year?{year:r.year,archive:r.archive===true}:{}));});});
 venues.forEach((v,i)=>{v._o=i;});const rank=venueRank(venues,shows); /* 定位城市（有未散场场次时）→ 杭州 → 其余城市按目录顺序；用于甘特图列、城市/影院选择器、同时间场次 */
 venues.sort((a,b)=>rank[a.id]-rank[b.id]);
 shows.sort((a,b)=>showDate(a)-showDate(b)||rank[a.v]-rank[b.v]);
 VENUES=venues;VN=vn;PROGRAMMES=programmes;PG=Object.fromEntries(programmes.map(p=>[p.id,p]));
 Object.entries(cat.aliases||{}).forEach(([o,n])=>{if(filmMap[n]&&!filmMap[o])filmMap[o]=filmMap[n];});
 {let ch=null;try{ch=await get("data/changes.json");}catch(e){}MOVES=(ch&&ch.moves)||{};} /* 场次变更记录：没有（本地预览）时为空，照旧按本机记录识别 */
 F=filmMap;SH=shows;{const t=now();films.forEach(f=>{if(autoEnded(f,shows,t)){f.ended=true;f.endedAuto=1;}});}FILMS=films.filter(f=>!f.ev);days=[...new Set(SH.map(s=>s.d))];validKeys=new Set(SH.map(keyOf));planTrack();picked=readSelection();watched=readWatched();want=readWant();wantSeen=readWantSeen();migrateAliases(cat.aliases);dataSignature=signature;return true;
}
// 用户正在点、拖、翻页时，后台触发的整页重绘（排片更新、云端同步）往后推：
// 否则手指按下的按钮在松开前被换掉，表现为「点了没反应」，翻页动画也会被打断
let uiTouchAt=0;["pointerdown","touchstart","keydown"].forEach(t=>document.addEventListener(t,()=>{uiTouchAt=performance.now();},{capture:true,passive:true}));
function uiBusy(){return performance.now()-uiTouchAt<1500||(typeof PC!=="undefined"&&!!(PC.t||PC.cover||PC.drag));}
const idleQ=new Map();let idleT=0;
function idleRerender(fn,key=fn.toString()){idleQ.set(key,fn);clearTimeout(idleT);
  const run=()=>{if(uiBusy()){idleT=setTimeout(run,700);return;}if(typeof ppCancelMotion==="function")ppCancelMotion();const fs=[...idleQ.values()];idleQ.clear();fs.forEach(f=>f());};run();}
async function refreshProgrammeData(){
 if(!READY||dataRefreshBusy||document.visibilityState==="hidden"||Date.now()-lastDataCheck<15000)return;
 if(document.querySelector("dialog[open],.img-sheet")||document.activeElement?.matches("input,textarea,select"))return;
 dataRefreshBusy=true;lastDataCheck=Date.now();
 try{const changed=await loadData();if(changed){
  const h=location.hash.slice(1)||"schedule";if(h==="export"||h.startsWith("share="))return;
  idleRerender(()=>{if((location.hash.slice(1)||"schedule")!==h)return;
  rememberView(h);const expanded=[...document.querySelectorAll("details[open]")].map(el=>el.className);
  const synopsisExpanded=!!document.querySelector(".fd-syn:not(.clamp)");
  route();restoreView(h);document.querySelectorAll("details").forEach(el=>{if(expanded.includes(el.className))el.open=true;});
  if(synopsisExpanded){document.querySelector(".fd-syn")?.classList.remove("clamp");const b=document.querySelector("[data-expand]");if(b)b.textContent="收起全文";}
  toast("排片已自动更新");},"data");
 }}catch(e){console.warn("自动同步暂不可用，保留当前排片",e);}finally{dataRefreshBusy=false;}
}
setInterval(refreshProgrammeData,60000);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")refreshProgrammeData();});
window.addEventListener("online",refreshProgrammeData);
window.addEventListener("pageshow",refreshProgrammeData);
function programmeFilmSlots(f,pid,compact){
 const all=SH.filter(s=>s.id===f.id&&s.p===pid).sort((a,b)=>showDate(a)-showDate(b));
 const upcoming=all.filter(s=>!isPast(s)),past=all.filter(isPast),fest=keepPast(PG[pid]);
 const list=(upcoming.length&&fest)||!upcoming.length?(upcoming.length?upcoming:all):upcoming;
 if(!all.length)return '<span class="pg-slot pg-unscheduled">场次待公布</span>';
 const row=s=>'<span class="pg-slot'+(isPast(s)?' pg-slot-past':'')+'" aria-label="'+esc(s.d+' '+s.t+' '+placeOf(s))+'"><time>'+esc(s.d.split("/").map(n=>n.padStart(2,"0")).join("."))+'</time><time>'+esc(s.t)+'</time><small>'+placeHTML(s)+'</small></span>';
 // 影展：已放映的场次折叠保留（变暗），点「已放映 N 场」展开；院线片不显示
 const fold=fest&&upcoming.length&&past.length?'<span class="pg-past"><span class="pg-past-t" role="button" tabindex="0" data-pgpast aria-expanded="false">已放映 '+past.length+' 场 <i>▾</i></span><span class="pg-past-l">'+past.map(row).join("")+'</span></span>':"";
 // 专题页卡片：只显示最近一场，其余场次点进影片页查看
 if(compact&&upcoming.length)return '<span class="pg-slots"><span class="pg-slot-count">下一场'+(upcoming.length>1?' · 共 '+upcoming.length+' 场':'')+'</span>'+row(upcoming[0])+(upcoming.length>1?'<span class="pg-more">另有 '+(upcoming.length-1)+' 场 ›</span>':'')+'</span>';
 return '<span class="pg-slots"><span class="pg-slot-count">'+(upcoming.length?"待映 ":"已放映 ")+list.length+' 场</span>'+list.map(row).join("")+fold+'</span>';
}
document.addEventListener("click",e=>{const b=e.target.closest("[data-pgpast]");if(!b)return;e.preventDefault();e.stopPropagation();const w=b.parentElement,o=w.classList.toggle("open");b.setAttribute("aria-expanded",o);},true);
document.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.matches&&e.target.matches("[data-pgpast]")){e.preventDefault();e.stopPropagation();e.target.click();}},true);
async function boot(){
  let mv=null; try{ mv=await (window.SP_MOVE||null); }catch(e){}
  if(mv==='leave') return; // 正在换域名搬家，页面马上会被替换
  await startI18n();
  topEl.innerHTML=brandBar();
  main.innerHTML='<section class="view gut boot"><p class="sub">正在载入排片…</p></section>';
  try{ await loadData(); }
  catch(e){ console.error(e); main.innerHTML='<section class="view gut boot"><h2 class="sec">排片数据加载失败</h2><p class="sub">请检查网络后重新打开。</p><button class="primary-button" data-reload>重新加载</button></section>'; return; }
  pfilt="all"; READY=true; route(); syncStart(); tasteChanged(); TC.flush(); geoBoot();  // 首页（含扫分享二维码进入）默认显示全部专题
  moveNotice(mv);
}
// 换域名搬家的提示：刚从旧网址搬来记录时轻提示一次；在旧网址的主屏幕 App 里时，常驻提示新网址（App 模式不自动跳转）
function moveNotice(mv){
  let n=0; try{ n=+sessionStorage.getItem('sp-mig-done')||0; sessionStorage.removeItem('sp-mig-done'); }catch(e){}
  if(n) toast(tr('已把旧网址上的本机记录搬到新网址'));
  if(mv!=='banner'||document.getElementById('move-banner')) return;
  const to=(window.SparrowMove&&SparrowMove.MOVE.to)||'https://sparrowcinema.org';
  const b=document.createElement('div'); b.id='move-banner'; b.setAttribute('role','status');
  b.style.cssText='position:sticky;top:0;z-index:60;padding:10px 16px;background:var(--accent);color:#fff;font-size:13px;line-height:1.6;text-align:center';
  b.innerHTML=esc(tr('观影护照已搬到新网址'))+' <a href="'+esc(to)+'/" style="color:#fff;font-weight:700;text-decoration:underline">'+esc(to.replace(/^https:\/\//,''))+'</a><br><small>'+esc(tr('请先在「我的 › 个人档案云端同步」生成同步码，在新网址输入即可带走全部记录，再从新网址重新添加到主屏幕。'))+'</small>';
  document.body.insertBefore(b,document.body.firstChild);
}
document.addEventListener("click",e=>{ if(e.target.closest("[data-reload]")) location.reload(); });
let rz; let lastW=window.innerWidth; window.addEventListener("resize",()=>{clearTimeout(rz);rz=setTimeout(()=>{if(Math.abs(window.innerWidth-lastW)<40)return;lastW=window.innerWidth;const h=location.hash.slice(1)||"schedule";if(h==="schedule"||h==="gantt")schedule();},200)});
dataUpdated();boot();

// —— 回到顶部：滚过约 1.5 屏高度才出现（太早会打扰，太晚没意义），向下滚动时更不打扰 ——
(function(){const b=document.getElementById('to-top');if(!b)return;b.hidden=false;let tick=0;
  const upd=()=>{tick=0;const y=window.scrollY||document.documentElement.scrollTop,th=Math.max(700,window.innerHeight*1.5);b.classList.toggle('show',y>th);};
  window.addEventListener('scroll',()=>{if(!tick)tick=requestAnimationFrame(upd);},{passive:true});
  b.addEventListener('click',()=>{const rm=matchMedia('(prefers-reduced-motion:reduce)').matches;window.scrollTo({top:0,behavior:rm?'auto':'smooth'});});upd();})();
