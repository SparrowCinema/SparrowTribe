/* js/films.js — 片目：筛选、分组折叠、渐进渲染。
   网站脚本按功能拆成 js/*.js，按 index.html 里的顺序加载；部署时 tools/build-assets.js 按同样顺序合并成一个 app.js。 */

let fmine="all", ffilt="all", fcity="all", fyear="all", freg="all", flen="all", ftrait="all", fq="";
const yearOk=f=>window.SparrowLibrary.yearMatches(f,fyear);
// 片长分档（参照国际影展手册常见的 Runtime 筛选）
const LEN_BINS=[["s","60 分钟以内",0,60],["m","60–90 分钟",61,90],["l","90–120 分钟",91,120],["xl","120 分钟以上",121,1e9]];
const lenOk=(f,k=flen)=>{const a=selList(k);if(!a.length)return true;return a.some(x=>{const b=LEN_BINS.find(y=>y[0]===x);return !!(b&&f.min&&!f.minTbd&&f.min>=b[2]&&f.min<=b[3]);});};
const regOk=(f,k=freg)=>selHas(k,f.reg);
const LIBRARY_MODES=[['all','全部影片','浏览完整片目'],['want','想看','标记了想看的影片 · 有新场次会标出'],['planned','已加入排片','已保存在个人排片中的影片'],['watched','已看过','收进观影护照的影片'],['unwatched','还没看过','继续探索新的银幕相遇'],['qa','主创映后场','有主创映后活动的影片']];
function showsOverlap(a,b){if(!a||!b)return false;const sa=showDate(a),sb=showDate(b),da=typeof durationOf==="function"?durationOf(a):(F[a.id]?.min||120),db=typeof durationOf==="function"?durationOf(b):(F[b.id]?.min||120);return sa<sb+db*60000-120000&&sb<sa+da*60000-120000;}
function libraryContext(){return {shows:SH,programmes:PROGRAMMES,picked,watched,want,keyOf,isPast,overlaps:showsOverlap,city:fcity,cityOfShow:s=>VN[s.v]?.city,programme:ffilt,programmeOf:f=>f.prog,programmeIds:f=>filmProgsOf(f).map(x=>x.p.id),showProgramme:s=>s.p||F[s.id]?.prog};}
function filmSelectorOptions(type,query=''){
 const ctx=libraryContext(),q=query.trim().toLocaleLowerCase();let rows;
 if(type==='programme')rows=[{id:'all',name:tr('全部专题'),sub:tr('浏览完整片目'),selected:!selList(ffilt).length},...progGroupOrder().map(p=>({id:p.id,name:p.name,sub:[tr(FILMS.filter(f=>window.SparrowLibrary.inProgramme(f,p.id,ctx)).length+' 部影片'),p.city].filter(Boolean).join(' · '),selected:selList(ffilt).includes(p.id)}))];
 else if(type==='region'){const base=FILMS.filter(f=>window.SparrowLibrary.inProgramme(f,ffilt,ctx));rows=[{id:'all',name:tr('全部地区'),sub:tr(base.length+' 部影片'),selected:!selList(freg).length},...Object.keys(REG).map(k=>({id:k,name:tr(REG[k].n),sub:tr(base.filter(f=>f.reg===k).length+' 部影片'),selected:selList(freg).includes(k)})).filter(x=>!x.sub.startsWith('0'))];}
 else if(type==='length'){const base=FILMS.filter(f=>window.SparrowLibrary.inProgramme(f,ffilt,ctx));rows=[{id:'all',name:tr('全部片长'),sub:tr(base.length+' 部影片'),selected:!selList(flen).length},...LEN_BINS.map(([k,n])=>({id:k,name:tr(n),sub:tr(base.filter(f=>lenOk(f,k)).length+' 部影片'),selected:selList(flen).includes(k)}))];}
 else if(type==='year'){
  const base=FILMS.filter(f=>window.SparrowLibrary.inProgramme(f,ffilt,ctx));
  const decades=window.SparrowLibrary.DECADES.map(([id,name])=>({id,name:tr(name),n:base.filter(f=>window.SparrowLibrary.yearMatches(f,id)).length,selected:selList(fyear).includes(id)})).filter(x=>x.n).map(x=>({id:x.id,name:x.name,sub:tr(x.n+' 部影片'),selected:x.selected}));
  const ys=[...new Set(base.map(f=>f.y).filter(Boolean))].sort((a,b)=>b-a);
  rows=[{id:'all',name:tr('全部年份'),sub:tr(base.length+' 部影片'),selected:!selList(fyear).length},...decades,...ys.map(y=>({id:String(y),name:String(y),sub:tr(base.filter(f=>String(f.y)===String(y)).length+' 部影片'),selected:selList(fyear).includes(String(y))}))];
 }
 else if(type==='city')rows=[{id:'all',name:tr('全部城市'),sub:tr('按已收录场次所在城市筛选'),selected:!selList(fcity).length},...[...new Set(VENUES.map(v=>v.city).filter(Boolean))].map(c=>({id:c,name:tr(c),sub:tr(FILMS.filter(f=>window.SparrowLibrary.inProgramme(f,ffilt,ctx)&&window.SparrowLibrary.inCity(f,c,ctx)).length+' 部影片'),selected:selList(fcity).includes(c)}))];
 else rows=LIBRARY_MODES.map(([id,name,sub])=>({id,name:tr(name),sub:tr(sub)+' · '+tr(FILMS.filter(f=>window.SparrowLibrary.inProgramme(f,ffilt,ctx)&&window.SparrowLibrary.category(f,id,ctx)).length+' 部影片'),selected:id==='all'?!selList(fmine).length:selList(fmine).includes(id)}));
 return rows.filter(x=>!q||(x.name+' '+x.sub).toLocaleLowerCase().includes(q)).map(x=>`<button class="selector-option" role="option" aria-selected="${x.selected}" data-filter-value="${esc(x.id)}"><span><b>${esc(x.name)}</b><small>${esc(x.sub)}</small></span><span class="selector-check" aria-hidden="true">${x.selected?'✓':''}</span></button>`).join('')||'<p class="selector-empty" role="status">没有匹配的结果</p>';
}
function traitStripHTML(){
 const ctx=libraryContext(),active=selList(ftrait);
 const pre=FILMS.filter(f=>window.SparrowLibrary.inProgramme(f,ffilt,ctx)&&window.SparrowLibrary.inCity(f,fcity,ctx)&&yearOk(f)&&regOk(f)&&lenOk(f)&&window.SparrowLibrary.category(f,fmine,ctx)&&filmMatches(f,fq));
 const chips=window.SparrowLibrary.TRAITS.map(([id,label])=>{
  const on=active.includes(id),nextSel=on?ftrait:selToggle(ftrait,id);
  const cnt=pre.filter(f=>window.SparrowLibrary.matchesTraits(f,nextSel,ctx)).length;
  if(!on&&!cnt)return '';
  const name=id==='fit'&&picked.size?tr('零冲突凑空档'):tr(label);
  return `<button type="button" class="trait-chip${on?' on':''}" data-trait="${id}" aria-pressed="${on}"><span>${esc(name)}</span><em class="mono">${cnt}</em></button>`;
 }).filter(Boolean).join('');
 return chips?`<div class="trait-strip" role="group" aria-label="${esc(tr('选片快捷筛选'))}">${chips}</div>`:'';
}
function libraryFiltersHTML(){return `<div class="schedule-filterbar library-filterbar" aria-label="片目筛选">${[['programme','专题',selLabel(ffilt,'全部专题',i=>PG[i]?.name||i,'个专题'),ffilt],['year','年代/年份',selLabel(fyear,'全部年份',i=>tr(window.SparrowLibrary.decadeLabel(i)),'项年份'),fyear],['city','城市',selLabel(fcity,'全部城市',i=>tr(i),'座城市'),fcity],['region','地区',selLabel(freg,'全部地区',i=>REG[i]?.n||i,'个地区'),freg],['length','片长',selLabel(flen,'全部片长',i=>(LEN_BINS.find(x=>x[0]===i)||[0,i])[1],'档片长'),flen],['personal','我的',selLabel(fmine,LIBRARY_MODES[0][1],i=>(LIBRARY_MODES.find(x=>x[0]===i)||[0,i])[1],'个分类'),fmine]].map(([type,label,value,id])=>`<button class="schedule-filter${id!=='all'?' active':''}" data-film-filter="${type}" aria-haspopup="dialog" aria-label="${esc(label+'：'+value)}"><span><small>${label}</small><b>${esc(value||'')}</b></span>${filterChevron}</button>`).join('')}</div>${traitStripHTML()}${ffilt!=='all'||fcity!=='all'||fyear!=='all'||freg!=='all'||flen!=='all'||fmine!=='all'||ftrait!=='all'||fq?'<div class="filter-reset-row"><button class="filter-reset" data-reset-library>重置筛选 ↺</button></div>':''}`;}
function libraryBadges(f){const x=window.SparrowLibrary.status(f,libraryContext());return '<span class="film-statuses">'+(x.wanted?(wantNew(f.id)?'<i class="new">新场次</i>':'')+'<i class="want">想看</i>':'')+(x.planned?'<i>已排片</i>':'')+(x.watched?'<i>已看过</i>':'')+(x.event?'<i class="event">主创映后</i>':'')+(x.lastChance?'<i class="last">最后一场</i>':'')+'</span>';}

function filmMatches(f,q){return window.SparrowLibrary.matches(f,q);}
const nextShow = f => SH.find(s=>s.id===f.id&&!isPast(s));
// 上映日期：优先解析 release 中的「YYYY年M月D日」，否则用年份
const relTime = f => { const m=String(f.releaseZh||f.release||"").match(/(\d{4})年(\d{1,2})月(\d{1,2})日/); if(m) return new Date(+m[1],m[2]-1,+m[3]).getTime(); return f.y?new Date(+f.y,0,1).getTime():0; };
// 片单排序：有待放映场次的在前；同组内上映日期新的在前
// 片单排序：有待放映场次的在前，按下一场放映时间先后；无场次的按上映日期从新到旧
const filmOrder = (a,b) => { const na=nextShow(a), nb=nextShow(b); if(!!na!==!!nb) return na?-1:1; if(na&&nb) return showDate(na)-showDate(nb)||a.cn.localeCompare(b.cn,"zh"); return relTime(b)-relTime(a)||a.cn.localeCompare(b.cn,"zh"); };
// 专题顺序：影展类在前，院线类在后
const isFest = p => !!p && /影展|festival/i.test(p.kind||"");
const keepPast = p => !!p && /影展|festival|艺术电影空间/i.test(p.kind||"");
const progGroupOrder = () => PROGRAMMES.slice().sort((x,y)=>(localProg(y)?1:0)-(localProg(x)?1:0)||(isFest(y)?1:0)-(isFest(x)?1:0));
/* 定位城市里的进行中/即将开始专题（专题城市或有未散场场次在该城）排最前；没有定位或该城没有专题时保持默认顺序 */
function geoActiveCity(){return (GEO_CITY&&GEO_CITY.c)||"";}
function localProg(p){const c=geoActiveCity();if(!c||progStatus(p)==="ended")return false;return p.city===c||SH.some(x=>x.p===p.id&&VN[x.v]&&VN[x.v].city===c&&!isPast(x));}
function filmCardHTML(f, ns){
  const sub = ns ? `<span class="nx">下一场 ${ns.d} ${wk(ns.d)} ${ns.t} · ${esc(vShort(VN[ns.v]))}</span>` : f.ended ? `<span class="rel">已下映</span>` : f.release ? `<span class="rel">${esc(f.release)}</span>` : "";
  return `<button class="fcard" data-film="${f.id}">
      ${slateHTML(f)}
      <span class="info"><b>${esc(f.cn)}${editionHTML(f)}</b><span class="o">${esc([LANG!=="en"&&f.cnDb&&f.cnDb!==f.cn?f.cnDb:"",f.en||f.o||""].filter(Boolean).join(" · "))}</span><span class="d">${[f.dir,f.c].filter(Boolean).map(esc).join(" · ")}</span>${f.language||f.subtitles?`<span class="film-language">${[f.language,f.subtitles].filter(Boolean).map(esc).join(" · ")}</span>`:""}${sub}${libraryBadges(f)}</span>
      <span class="score"><b>${f.r[0]??"—"}</b>豆瓣</span></button>`;
}
/* 片目分组折叠：
   · 进行中/即将开始的专题：标题右侧圆形折叠按钮（状态记在本机，搜索时自动全部展开）；该专题里已放映完的片子收进组内底部「本专题已放映」小折叠。
   · 整个专题结束后：整组移到最底部「往期专题」，每个专题各自一个折叠卡片（默认收起），按结束时间由近到远。 */
let folds=(()=>{try{return JSON.parse(localStorage.getItem('sparrow-fold-v1')||'{}')||{};}catch{return {};}})();
function saveFolds(){try{localStorage.setItem('sparrow-fold-v1',JSON.stringify(folds));}catch{}}
const CHEV='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
function stackHTML(rows){return '<span class="fstack" aria-hidden="true">'+rows.slice(0,4).map(f=>pst(f.id)?pimg(f.id,360,'alt="" loading="lazy"'):'<i style="background:'+REG[f.reg].c+'">'+esc(f.cn[0])+'</i>').join('')+'</span>';}
/* 片目渐进渲染：每个列表先画前 FL_FIRST 张卡片，滚到附近再每次补 FL_STEP 张；收起的专题、「本专题已放映」「往期专题」展开时才画。
   片库到几千部时页面节点数仍然只跟已浏览的范围有关。已画到多少张记在 flShown（按列表 key），从影片页返回时原样恢复，滚动位置不会跳；
   搜索或筛选变化时清零。不支持 IntersectionObserver 的浏览器一次画完。 */
const FL_FIRST=12, FL_STEP=24;
let FL={}, flShown={}, flSig="", flIO=null;
function lazyFlist(key,items,open){ /* items: [影片, 下一场或null] */
  if(!items.length) return "";
  if(!("IntersectionObserver" in window)) return `<div class="flist">${items.map(([f,nx])=>filmCardHTML(f,nx)).join("")}</div>`;
  FL[key]=items; const n=Math.min(items.length,Math.max(open?FL_FIRST:0,flShown[key]||0)); flShown[key]=n;
  return `<div class="flist" data-fl="${esc(key)}">${items.slice(0,n).map(([f,nx])=>filmCardHTML(f,nx)).join("")}</div>${n<items.length?`<div class="fl-more" data-fl-more="${esc(key)}" aria-hidden="true"></div>`:""}`;
}
function flGrow(key){ const items=FL[key], list=document.querySelector(`.flist[data-fl="${CSS.escape(key)}"]`), more=document.querySelector(`.fl-more[data-fl-more="${CSS.escape(key)}"]`); if(!items||!list) return false;
  const a=flShown[key]||0, b=Math.min(items.length,a+(a?FL_STEP:FL_FIRST)); if(b>a){ list.insertAdjacentHTML("beforeend",items.slice(a,b).map(([f,nx])=>filmCardHTML(f,nx)).join("")); flShown[key]=b; }
  if(b>=items.length){ more&&more.remove(); return false; } return true; }
function flObserve(){ if(!("IntersectionObserver" in window)) return; flIO&&flIO.disconnect();
  flIO=new IntersectionObserver(es=>es.forEach(e=>{ if(!e.isIntersecting) return; const el=e.target, key=el.dataset.flMore; flIO.unobserve(el); if(flGrow(key)&&el.isConnected) requestAnimationFrame(()=>el.isConnected&&flIO.observe(el)); }),{rootMargin:"1200px 0px"});
  document.querySelectorAll(".fl-more").forEach(el=>flIO.observe(el)); }
function filmsListHTML(){
  { const sig=[fq,ffilt,fcity,fyear,freg,flen,fmine,ftrait].join("|"); if(sig!==flSig){ flSig=sig; flShown={}; } FL={}; requestAnimationFrame(flObserve); }
  // 跨影展影片在每个所属专题里都列出；「下一场」只取该专题的场次
  const ctx=libraryContext();
  const showPid=s=>s.p||F[s.id]?.prog;
  const nextIn=(f,pid)=>SH.find(s=>s.id===f.id&&!isPast(s)&&selHas(fcity,VN[s.v]?.city)&&showPid(s)===pid);
  const orderIn=pid=>(a,b)=>{const x=nextIn(a,pid),y=nextIn(b,pid);return x&&y?showDate(x)-showDate(y)||a.cn.localeCompare(b.cn,"zh"):x?-1:y?1:filmOrder(a,b);};
  const base = FILMS.filter(f=>window.SparrowLibrary.inProgramme(f,ffilt,ctx)&&window.SparrowLibrary.inCity(f,fcity,ctx)&&yearOk(f)&&regOk(f)&&lenOk(f)&&window.SparrowLibrary.category(f,fmine,ctx)&&window.SparrowLibrary.matchesTraits(f,ftrait,ctx)&&filmMatches(f,fq));
  const members=p=>!selHas(ffilt,p.id)?[]:base.filter(f=>filmProgsOf(f).some(x=>x.p.id===p.id)||SH.some(s=>s.id===f.id&&showPid(s)===p.id));
  const isLiveIn=(f,p)=>!!nextIn(f,p.id)||(!f.ended&&!SH.some(s=>s.id===f.id&&showPid(s)===p.id)&&progStatus(p)!=="ended");
  const endedP=p=>progStatus(p)==="ended";
  const groups = progGroupOrder().filter(p=>!endedP(p)).map(p=>{const m=members(p);return [p,m.filter(f=>isLiveIn(f,p)).sort(orderIn(p.id)),m.filter(f=>!isLiveIn(f,p)).sort((a,b)=>relTime(b)-relTime(a))];}).filter(([,r,g])=>r.length||g.length);
  const autoOpen=!!fq||fmine!=="all"||ftrait!=="all";
  const grpHTML = ([p,rows,old]) => { const key='g:'+p.id, open=autoOpen||folds[key]!==0, all=rows.concat(old);
    return `<section class="fsec${open?"":" closed"}" data-fsec="${key}"><header class="fgrp fgrp2"><div class="fgrp-main"><span class="fgrp-kind">${isFest(p)?"影展":esc(p.kind||"专题")}</span><h3>${esc(p.name)}</h3><small class="fgrp-meta">${all.length} 部 · ${esc(p.en||p.kind||"")}</small></div><div class="fgrp-side">${stackHTML(all)}<button class="fold-btn" data-fold="${key}" aria-expanded="${open}" aria-label="${tr(open?"收起":"展开")} ${esc(p.name)}">${CHEV}</button></div></header>
      <div class="fsec-body">${lazyFlist(key+":live",rows.map(f=>[f,nextIn(f,p.id)]),open)}${old.length?`<details class="fgone"${autoOpen?" open":""}><summary><span>本专题已放映</span><b>${old.length}</b><span>部</span>${CHEV}</summary>${lazyFlist(key+":old",old.map(f=>[f,null]),open&&autoOpen)}</details>`:""}</div></section>`; };
  const endedGroups = progGroupOrder().filter(endedP).map(p=>[p,members(p).sort((a,b)=>relTime(b)-relTime(a))]).filter(([,r])=>r.length).sort((x,y)=>(progRange(y[0])[1]||0)-(progRange(x[0])[1]||0));
  const pastHTML = endedGroups.length?`<header class="fpast-h"><h3>往期专题</h3><small>${endedGroups.reduce((n,[,r])=>n+r.length,0)} 部 · 已结束的专题收在这里</small></header>`+endedGroups.map(([p,rows])=>`<details class="fold-prog"${autoOpen?" open":""}><summary><span class="fp-t"><span class="fgrp-kind">${isFest(p)?"影展":esc(p.kind||"专题")}</span><b>${esc(p.name)}</b><small class="fp-n">${rows.length} 部${p.period?" · "+esc(p.period):""}</small></span>${stackHTML(rows)}<span class="fold-btn" aria-hidden="true">${CHEV}</span></summary>${lazyFlist("p:"+p.id,rows.map(f=>[f,null]),autoOpen)}</details>`).join(""):"";
  const body = groups.map(grpHTML).join("")+pastHTML;
  const activeLabels=[...selList(fmine).map(k=>(LIBRARY_MODES.find(x=>x[0]===k)||[0,k])[1]),...selList(ftrait).map(k=>(window.SparrowLibrary.TRAITS.find(x=>x[0]===k)||[0,k])[1])];
  return `<p class="library-result-count" aria-live="polite">${base.length} 部影片${activeLabels.length?" · "+activeLabels.map(tr).join(" · "):""}</p>`+(body || `<div class="g-empty"><b>${fq?`没有找到「${esc(fq)}」`:"当前分类暂无影片"}</b><span>${fmine==="planned"?"在排片表中加入场次，就会出现在这里。":fmine==="watched"?"在影片页点「看过」，开始收集你的电影印章。":"换个条件，或试试片名、导演、演员。"}</span></div>`);
}
document.addEventListener("click",e=>{
  const trb=e.target.closest("[data-trait]");
  if(trb){ftrait=selToggle(ftrait,trb.dataset.trait);const y=window.scrollY;const fb=document.getElementById("fl-filters"),w=document.getElementById("flist-wrap");if(fb&&w){fb.innerHTML=libraryFiltersHTML();w.innerHTML=filmsListHTML();}else films();window.scrollTo(0,y);return;}
  const b=e.target.closest("[data-fold]");if(!b)return;const sec=b.closest(".fsec"),open=!sec.classList.toggle("closed");folds[b.dataset.fold]=open?1:0;saveFolds();b.setAttribute("aria-expanded",open);b.setAttribute("aria-label",tr(open?"收起":"展开")+" "+sec.querySelector("h3").textContent);
  if(!open){const top=sec.getBoundingClientRect().top;if(top<0)window.scrollTo({top:window.scrollY+top-(document.getElementById("topbar")?.offsetHeight||0)-8,behavior:"instant"});}});
/* 片目顶部介绍：总片目数随专题增加自动更新；文案按当前规划（按专题分组、可折叠、结束后归往期）*/
function filmsIntroHTML(){const total=FILMS.length,live=FILMS.filter(f=>nextShow(f)).length,progs=PROGRAMMES.filter(p=>FILMS.some(f=>f.prog===p.id||p.sections?.[f.id]||p.members?.includes(f.id))).length;
  return '<div class="fi-stats" aria-label="片目概览"><span><b>'+total+'</b>部影片</span><span><b>'+progs+'</b>个专题</span><span><b>'+live+'</b>部待映</span></div>'+
    '<p class="sub fi-sub">按专题分组，每个专题可收起；已放映的收进专题内，专题结束后归入「往期专题」。右侧为豆瓣评分。</p>';}
function films(){
  main.innerHTML = `<section class="view gut"><h2 class="sec">片目</h2>${filmsIntroHTML()}
    <label class="fsearch"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input type="search" id="fq" aria-label="搜索片名、导演、演员" placeholder="搜索片名、导演、演员" value="${esc(fq)}" autocomplete="off" enterkeyhint="search"></label>
    <div id="fl-filters">${libraryFiltersHTML()}</div>
    <div id="flist-wrap">${filmsListHTML()}</div>${presentersHTML()}</section>`;
}
/* 防缩放守卫（勿删）：输入框聚焦时临时 maximum-scale=1，失焦恢复，避免 iOS/微信内置浏览器聚焦自动放大整页 */
(function(){const m=document.querySelector('meta[name=viewport]');if(!m)return;const base=m.content,lock=base+',maximum-scale=1';
const isField=e=>e&&e.matches&&e.matches('input:not([type=checkbox]):not([type=radio]):not([type=range]),textarea,select');
document.addEventListener('focusin',e=>{if(isField(e.target))m.content=lock;});
document.addEventListener('focusout',e=>{if(isField(e.target))setTimeout(()=>{if(!isField(document.activeElement))m.content=base;},50);});})();
document.addEventListener("input",e=>{ if(e.target.id!=="fq") return; fq=e.target.value.trim(); if(fq&&!ST.searched){ST.searched=true;stat("search");} const fb=document.getElementById("fl-filters"); if(fb) fb.innerHTML=libraryFiltersHTML(); const w=document.getElementById("flist-wrap"); if(w) w.innerHTML=filmsListHTML(); });
