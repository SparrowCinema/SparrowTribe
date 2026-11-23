/* js/core.js — 数据全局变量与通用工具：影片 / 影院 / 场次索引、城市筛选、专题状态、海报与缩略图、转义与格式化、品牌。
   网站脚本按功能拆成 js/*.js，按 index.html 里的顺序加载；部署时 tools/build-assets.js 按同样顺序合并成一个 app.js。 */
const REG = {cn:{n:"华语",c:"var(--oxblood)"},eu:{n:"欧洲",c:"var(--teal)"},us:{n:"美国",c:"var(--ochre)"},as:{n:"亚洲",c:"var(--olive)"},me:{n:"非洲",c:"#6d4c6f"},la:{n:"拉美",c:"#8a6350"}};
/* 影片、影院、专题与排片数据在 data/ 目录：data/catalog.json（专题与影院）+ data/programmes/<专题id>.json（片目与排片）。新增影展只需新增一个专题文件并在 catalog 中登记。 */
let FILMS=[], VENUES=[], PROGRAMMES=[], SH=[], VN={}, F={}, PG={}, days=[];

const hallOf = s => VN[s.v].halls.find(x=>x.id===s.h);
const placeOf = s => `${venueLabel(VN[s.v])} ${hallOf(s).name}`;
const placeHTML = s => `${esc(venueLabel(VN[s.v]))}<span class="hall-tag">${esc(hallOf(s).name)}</span>`; /* 影厅名较长时（如「5号Dolby Cinema 杜比影院厅」）作为独立小标签整体换行，不挤乱影院名 */
/* 场次变更记录（部署时 tools/build-changes.js 生成 data/changes.json，loadData 读入）：{旧场次键:{to,f,sid,was,reused}}。
   resolveKey：旧场次键 → 现在的场次键（改期后），用于分享链接、观影记录关联的场次；找不到时原样返回。 */
let MOVES={};
const resolveKey = k => { if(validKeys.has(k)) return k; const m=MOVES[k]; return m&&m.to&&validKeys.has(m.to)?m.to:k; };
const keyOf = s => window.SparrowScreenings.keyOf(s);
let vfilt = "all", cityFilt = "all", venueQuery = "";
/* 首页默认城市：没手动选过城市时，默认只看所在城市（定位城市有场次用它，否则杭州）的排片，甘特图首屏就是本地影厅。
   手动选择（含「全部城市」）记在本机 sparrow-city-pref；从专题、影片跳到排片表时不套用默认城市。 */
const CITY_PREF="sparrow-city-pref";
let cityAuto=false, cityInit=false;
function cityManual(save){cityInit=true;cityAuto=false;if(save)try{localStorage.setItem(CITY_PREF,cityFilt);}catch(e){}}
function cityDefault(){
 if(!cityInit){cityInit=true;let p=null;try{p=localStorage.getItem(CITY_PREF);}catch(e){}
  if(p!==null){cityFilt=selList(p).filter(c=>VENUES.some(v=>v.city===c)).join(",")||"all";return;}
  cityAuto=pfilt==="all"&&vfilt==="all"&&cityFilt==="all";}
 if(!cityAuto)return;
 if(pfilt!=="all"||vfilt!=="all"){cityAuto=false;return;}
 if(onlyMine){cityFilt="all";return;} /* 只看我的排片时不按城市收窄，外地场次也要看得到 */
 const up=SH.filter(x=>!isPast(x)),H=homeCity();
 cityFilt=new Set(up.map(x=>VN[x.v]?.city)).size>1&&up.some(x=>VN[x.v]?.city===H)?H:"all";
}
// 多选筛选：值为 "all" 或逗号连接的多个 id（同一筛选内为「或」）
const selList=v=>SparrowLibrary.list(v),selHas=(v,i)=>SparrowLibrary.has(v,i),selToggle=(v,i)=>SparrowLibrary.toggle(v,i);
const selLabel=(v,all,one,unit)=>{const a=selList(v);return !a.length?all:a.length===1?one(a[0]):tr(a.length+" "+(LANG==="en"&&unit==="家影院"?"家":unit));};
const editionOf = f => f.version||"";
const fhue = id => { const i=Object.keys(F).indexOf(id); return Math.round((i<0?0:i)*137.508%360); };
const langSub = f => f.langTag || [f.language, f.subtitles].filter(Boolean).join(" ｜ ");
const editionHTML = f => f.version ? ` <small class="edition">${esc(f.version)}</small>` : "";
const progOf = f => PG[f.prog||"style-kaleidoscope"];
/* 同一部影片可出现在多个影展：主影展 f.prog 加上 catalog 里 sections 登记过的影展 */
const filmProgsOf = f => { const main=progOf(f), out=[{p:main,sec:f.section||main.sections?.[f.id]||""}]; PROGRAMMES.forEach(p=>{ if(p.id!==main.id&&(p.sections?.[f.id]||p.members?.includes(f.id))) out.push({p,sec:p.sections?.[f.id]||""}); }); return out; };
const progShows = pid => SH.filter(x=>x.p===pid);
let pfilt = "all";
let sectionFilter="", sectionProgramme="";
const durationOf=s=>{const e=F[s.id].screeningEnds?.[keyOf(s)];return e?toMin(e)-toMin(s.t):F[s.id].min;};
const inProg = x => selHas(pfilt,x.p);
/* 时间：?now=2026-11-07T15:00 可模拟当前时间，便于检查“已放映 / 已结束”的显示 */
const NOW_OVERRIDE = (()=>{try{const q=new URLSearchParams(location.search).get("now");const t=q?Date.parse(q):NaN;return isNaN(t)?null:t;}catch{return null;}})();
const now = () => NOW_OVERRIDE ?? Date.now();
const ymd = v => { const [y,m,d]=String(v).split("-").map(Number); return new Date(y,(m||1)-1,d||1).getTime(); };
const showEnd = s => showDate(s).getTime()+durationOf(s)*60000;
const isPast = s => showEnd(s) < now();
const STATUS = {live:"进行中", soon:"即将开始", ended:"已结束"};
function progRange(p){ const sh=progShows(p.id); const a=p.start?ymd(p.start):(sh.length?showDate(sh[0]).getTime():null); const b=p.end?ymd(p.end)+864e5:(sh.length?Math.max(...sh.map(showEnd)):null); return [a,b]; }
/* 常设专题（catalog 中 ongoing:true，如麻雀部落电影空间）：开始后一直算进行中，不进入往期 */
/* 提前结束：结束日前 2 天内（含结束日当天），已公布的场次全部散场，就算已结束——不必等到结束日 24:00（如 2026德国电影展最后一场 11/22，结束日写 11/23）。院线专题不录全部场次，不提前结束。 */
const PROG_EARLY=2*864e5;
function progDone(p,t){ if(p.ongoing||!p.end||p.kind==="院线") return false; const sh=progShows(p.id); return sh.length>0&&t>=ymd(p.end)-PROG_EARLY&&sh.every(isPast); }
/* 院线片自动下映：出现在院线专题（kind 院线，本籍或 members / sections 挂进来的都算）里的影片，release 里的上映日期（「YYYY年M月D日」）已过、又没有待映场次时，视为已下映（等同手写 ended:true），专题页、片目归入已结束：
   录入过的场次已全部放完 → 马上算；一场都没录过 → 上映满 RUN_DAYS 天才算。没写具体上映日的不处理；之后补了新场次会自动回到即将放映。 */
const RUN_DAYS=30;
function autoEnded(f,shows,t){ if(f.ended||f.ev) return false;
  if(!PROGRAMMES.some(p=>p.kind==="院线"&&(f.prog===p.id||p.members?.includes(f.id)||p.sections?.[f.id]))) return false;
  const m=String(f.releaseZh||f.release||"").match(/(\d{4})年(\d{1,2})月(\d{1,2})日/); if(!m) return false; const rel=new Date(+m[1],m[2]-1,+m[3]).getTime(); if(t<rel) return false;
  const mine=shows.filter(s=>s.id===f.id); if(mine.some(s=>!isPast(s))) return false;
  return mine.length>0||t>=rel+RUN_DAYS*864e5; }
function progStatus(p){ const [a,b]=progRange(p), t=now(); if(a!=null&&t<a) return "soon"; if(!p.ongoing&&b!=null&&t>=b) return "ended"; if(progDone(p,t)) return "ended"; return "live"; }
function progOrdered(){ const rank={live:0,soon:1,ended:2}; return PROGRAMMES.slice().sort((x,y)=>{const sx=progStatus(x),sy=progStatus(y),lx=localProg(x),ly=localProg(y);if(lx!==ly)return lx?-1:1;if(sx!==sy)return rank[sx]-rank[sy];const ux=progShows(x.id).some(s=>!isPast(s)),uy=progShows(y.id).some(s=>!isPast(s));if(ux!==uy)return ux?-1:1;const [ax,bx]=progRange(x),[ay,by]=progRange(y);return sx==="ended"?(by||0)-(bx||0):(ax||0)-(ay||0);}); }
function defaultProg(){ const open=progOrdered().filter(p=>progStatus(p)!=="ended"); const pick=open.find(p=>progShows(p.id).some(s=>!isPast(s)))||open.find(p=>progShows(p.id).length)||open[0]; return pick?pick.id:"all"; }
const statusTag = p => { const st=progStatus(p); return `<i class="pst pst-${st}">${p.ongoing&&st==="live"?"常设":STATUS[st]}</i>`; };
const progChips = (cur=pfilt) => { const open=progOrdered().filter(p=>progStatus(p)!=="ended"||p.id===cur); return `<div class="filters prog-chips">${[["all","全部专题"],...open.map(p=>[p.id,p.name])].map(([k,n])=>`<button class="fchip" data-pf="${k}" aria-pressed="${cur===k}">${esc(n)}</button>`).join("")}</div>`; };
const dateSpan = list => { if(!list.length) return ""; const ds=[...new Set(list.map(x=>x.d))]; return ds[0]+" – "+ds[ds.length-1]; };
function progCardHTML(p){ const n=progShows(p.id).length, fn=FILMS.filter(f=>f.prog===p.id||p.sections?.[f.id]||p.members?.includes(f.id)).length; return `<button class="prog-card pc-${progStatus(p)}" data-prog="${p.id}">${p.cover?`<img src="${p.cardCover||p.cover}" alt="" loading="lazy">`:""}<span class="pc-body"><small>${statusTag(p)}${esc(p.kind)} · ${esc(p.period)}${p.city?` · ${esc(p.city)}`:""}</small><b>${esc(p.name)}</b><span>${esc(p.sub)} · ${fn} 部${n?` / ${n} 场`:""}</span>${p.blurb?`<span class="pc-blurb">${esc(tr(p.blurb))}</span>`:""}</span><span class="pc-go">专题 ›</span></button>`; }
function programmesPage(){
  const all=progOrdered(), live=all.filter(p=>progStatus(p)==="live"), soon=all.filter(p=>progStatus(p)==="soon"), past=all.filter(p=>progStatus(p)==="ended");
  const sec=(t,en,list)=>list.length?`<h3 class="blockh pgl-h">${t} <small>${list.length} · ${en}</small></h3><div class="prog-strip">${list.map(progCardHTML).join("")}</div>`:"";
  main.innerHTML=`<section class="view gut"><h2 class="sec">专题</h2><p class="sub">影展、院线新片与艺术影院 · ${live.length+soon.length} 个进行中或即将开始</p>
    ${sec("进行中","NOW ON",live)}${sec("即将开始","COMING UP",soon)}
    ${past.length?`<details class="past-progs"><summary>往期专题 <small>${past.length} 个已结束</small></summary><div class="prog-strip">${past.map(progCardHTML).join("")}</div></details>`:""}
    ${all.length?"":`<div class="g-empty"><b>专题整理中</b><span>新的影展与放映专题会陆续上线</span></div>`}
    ${presentersHTML()}</section>`;
}
function progCardsHTML(){ const all=progOrdered(), open=all.filter(p=>progStatus(p)!=="ended"), past=all.filter(p=>progStatus(p)==="ended");
  return `<div class="prog-strip">${open.map(progCardHTML).join("")}</div>${past.length?`<details class="past-progs"><summary>往期专题 <small>${past.length} 个已结束</small></summary><div class="prog-strip">${past.map(progCardHTML).join("")}</div></details>`:""}`; }
const pst = id => (F[id]&&F[id].poster)||null;
/* 海报缩略图：部署时 tools/build-thumbs.py 生成 posters/w360、w720（WebP），data/version.json 带 th:1 时启用；
   列表 / 网格 / 海报墙用 w360，影片页大图用 w720，长图与分享海报等画布仍用原图。图片带 data-full，缩略图读不到时自动换回原图。 */
let THUMBS=false;
const pthumb = (id,w=360) => { const p=pst(id); if(!p||!THUMBS) return p; const m=/^posters\/([^/?#]+)\.(jpe?g|png)$/i.exec(p); return m?'posters/w'+w+'/'+m[1]+'.webp':p; };
const pimg = (id,w,attrs) => '<img src="'+esc(pthumb(id,w))+'" data-full="'+esc(pst(id))+'" '+attrs+'>';
document.addEventListener('error',e=>{const t=e.target;if(t&&t.tagName==='IMG'&&t.dataset&&t.dataset.full&&!t.src.endsWith(t.dataset.full)){t.src=t.dataset.full;}},true);
const minText = f => f.minTbd ? "片长待定" : f.min+" 分钟";
const slateHTML = f => pst(f.id) ? `<span class="slate has" style="background:${REG[f.reg].c}">${pimg(f.id,360,`alt="${esc(f.cn)} 海报" loading="lazy"`)}</span>` : `<span class="slate" style="background:${REG[f.reg].c}"><b>${esc(f.cn[0])}</b><span>${f.y}</span></span>`;
const WK = ["周日","周一","周二","周三","周四","周五","周六"];
const year = (d, explicit) => Number.isInteger(+explicit) && +explicit >= 1888 && +explicit <= 2200 ? +explicit : (+d.split("/")[0] >= 10 ? 2026 : 2027);
const wk = d => { const [m,dd]=d.split("/").map(Number); return WK[new Date(year(d),m-1,dd).getDay()]; };
const toMin = t => { const [h,m]=t.split(":").map(Number); return h*60+m; };
const fmt = m => String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0");
const esc = s => String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));
const paragraphsHTML = value => String(value||"").split(/\n{2,}/).map(p=>`<p>${esc(p)}</p>`).join("");
const creditsHTML = f => [
  ...SparrowPremiere.rows(f,LANG==="en"),
  ["导演", f.dir],
  ["联合导演", f.coDirector],
  [f.writerLabel||"编剧", (f.writers||[]).join(" / ")],
  ["原著", f.book],
  [(f.genre||[]).includes("纪录片")?"出镜":"主演", (f.cast||[]).join(" / ")],
  ["类型", (f.genre||[]).join(" / ")],
  ["国别", f.c],
  ["放映语言", f.language],
  ["字幕", f.subtitles],
  ["影片版权", LANG==="en"&&f.printSourceEn?f.printSourceEn:f.printSource],
  ["放映格式", f.medium],
  ["海报说明", f.posterNote],
  ["年龄提示", f.ageRating],
  ["无障碍", (f.access||[]).join(" / ")]
].filter(([,value])=>value).map(([name,value])=>`<dt>${esc(name)}</dt><dd>${esc(value)}</dd>`).join("");

const chevron = '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 6 6 6-6 6"/></svg>';
const topEl = document.getElementById("topbar"), main = document.getElementById("main");

const logoImg = (base, alt, cls="") => `<img class="lg-l ${cls}" src="brand/${base}.png" alt="${alt}"><img class="lg-d ${cls}" src="brand/${base}-dark.png" alt="${alt}">`;
const DUO = `<span class="duo" aria-hidden="true"><span class="seal">${logoImg("mark-movies","")}</span><span class="seal">${logoImg("mark-tribe","")}</span></span>`;
const DUO_PRINT = '<span class="duo" aria-hidden="true"><span class="seal seal-print"><img src="brand/mark-movies.png" alt=""></span><span class="seal seal-print"><img src="brand/mark-tribe.png" alt=""></span></span>';
const lockup = (k) => { const en = k==="movies" ? "Movies" : "Tribe", cn = k==="movies" ? "麻雀映画" : "麻雀部落"; const txt = `<span class="lk-txt"><span class="lk-en">Sparrow<br>${en}</span><span class="lk-cn">${cn}</span></span>`, mk = `<span class="lk-mark">${logoImg("mark-"+k,"")}</span>`; return `<span class="lk lk-${k}" aria-label="${cn} Sparrow ${en}">${k==="movies"?txt+mk:mk+txt}</span>`; };
const brandBar = () => `<div class="row lk-row sq-row"><span class="sq-logos" role="img" aria-label="麻雀映画 × 麻雀部落"><span class="sq-logo">${logoImg("sparrow-movies-sq","")}</span><span class="lk-x" aria-hidden="true">×</span><span class="sq-logo">${logoImg("sparrow-tribe-sq","")}</span></span><span class="sp"></span><button class="lang-btn" data-lang-toggle aria-label="Language / 语言" title="中文 / English"><b class="${LANG==="zh"?"on":""}">中</b><b class="${LANG==="en"?"on":""}">EN</b></button><span class="lk-tag">观影<br>护照</span></div>`;
const presentersHTML = () => `<section class="presenters"><p class="pres-k">制作设计 · PRODUCED &amp; DESIGNED BY</p><div class="pres-row"><span class="pres-sq">${logoImg("sparrow-movies-sq","麻雀映画 Sparrow Movies")}</span><span class="pres-x" aria-hidden="true">×</span><span class="pres-sq">${logoImg("sparrow-tribe-sq","麻雀部落 Sparrow Tribe")}</span></div><p class="pres-d">电影放映与策展</p><p class="pres-upd"${dataUpd?"":" hidden"}>数据更新于 <span class="data-upd">${dataUpd||""}</span></p></section>`;
