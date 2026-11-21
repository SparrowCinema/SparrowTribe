/* 我的典藏票根册（2026-11-21 重做）。
   票根 = 某一次观影的「皮肤」：本机 sparrow-tickets-v2 只存用户改过的字段（规则见 shared/tickets.js、shared/psync.js），
   日期、影院、片名、专题由观影记录与片库推出；随个人档案云端同步与完整备份一起保存。
   浏览：按年 → 月连续滚动（月份标题吸顶）、年份切换、搜索 + 分面筛选、四档密度（大 / 中 / 小 / 书脊）；
   票面只在接近屏幕时才绘制，画好后缓存成图片。导出：当前结果 / 年度 / 专题 / 精选票根墙，超过 MOSAIC_MAX 张分成多张图。 */
const TICKET_KEY="sparrow-tickets-v1",TICKET_STORE_KEY="sparrow-tickets-v2",TICKET_DENSITY_KEY="sparrow-ticket-density";
const ticketArtworkEngine=window.SparrowTickets,TE=ticketArtworkEngine;
const TicketArt=window.SparrowTicketSketch;
let ticketArtStyle=(()=>{try{return TicketArt.normalize(localStorage.getItem(TicketArt.storageKey));}catch{return TicketArt.normalize();}})();
const readTicketPreference=key=>localStorage.getItem(key);
let ticketFilmStyles=TicketArt.readFilmStyles(readTicketPreference);
// 手绘风格随个人档案云端同步：记下修改时间，ticketArtRev 让同步发现有改动
let ticketArtRev=0;
function ticketMarkArt(filmId){TicketArt.markArt(readTicketPreference,(k,v)=>localStorage.setItem(k,v),filmId);ticketArtRev++;}
// 云端合并后刷新内存里的风格设置
function ticketArtReload(){ticketArtStyle=(()=>{try{return TicketArt.normalize(localStorage.getItem(TicketArt.storageKey));}catch{return TicketArt.normalize();}})();ticketFilmStyles=TicketArt.readFilmStyles(readTicketPreference);ticketArtRev++;}
const ticketStyleFor=row=>ticketFilmStyles.get(row.filmId)||ticketArtStyle;
const TICKET_W={l:320,m:200,s:130},TICKET_PICK_MAX=24,TICKET_PENDING_STEP=60;
let ticketStoreCache=null,ticketRev=0,ticketData=null,ticketDataRev=-1,ticketByKey=new Map();
let ticketQ={text:"",year:"",programme:[],city:[],venue:[],format:[]},ticketSide="front",ticketDraft=null,ticketMode="album";
let ticketDensity=(()=>{try{const v=localStorage.getItem(TICKET_DENSITY_KEY);return TICKET_W[v]||v==="spine"?v:"m";}catch{return "m";}})();
let ticketFacets=false,ticketPick=null,ticketExportOpen=false,ticketPendingShown=TICKET_PENDING_STEP,ticketSearchTimer=0;
const ticketImageCache=new Map(),ticketURLs=new Map();
let ticketQueue=[],ticketWorking=0,ticketIO=null;
const ticketDict=phrase=>esc(tr(phrase));
const ticketOption=(value,label,selected)=>`<option value="${esc(value)}"${value===selected?" selected":""}>${esc(label)}</option>`;
const ticketCanvas=(w,h)=>Object.assign(document.createElement("canvas"),{width:w,height:h});

// ——— 存储 ———
function ticketViewings(){const G=window.SparrowGrowth;return G?TE.viewings(watched,G.views,id=>F[id]&&!F[id].ev):[];}
function ticketStore(){
  if(ticketStoreCache)return ticketStoreCache;
  let raw=null;try{raw=localStorage.getItem(TICKET_STORE_KEY);}catch{}
  if(raw!==null){ticketStoreCache=TE.cleanStore(raw);return ticketStoreCache;}
  // 第一次打开新版：把旧版整条记录迁移过来（旧键保留不删，以防万一）
  let old=[];try{old=TE.read(localStorage.getItem(TICKET_KEY));}catch{}
  ticketStoreCache=old.length?TE.migrateV1(old,ticketViewings(),ticketBase):{};
  if(old.length)ticketStorePut(ticketStoreCache,true);
  return ticketStoreCache;
}
function ticketStorePut(store,quiet){
  const clean=TE.cleanStore(store);
  try{localStorage.setItem(TICKET_STORE_KEY,JSON.stringify(clean));}
  catch{if(!quiet)toast(tr("票根保存失败，请检查本机存储"));return false;}
  ticketStoreCache=clean;ticketRev++;return true;
}
function ticketSet(changes){const next={...ticketStore(),...changes};return ticketStorePut(next);}

// ——— 由观影记录与片库推出票面字段 ———
function ticketArtwork(f){
  const assets=[f.poster,f.posterUrl,...(Array.isArray(f.stills)?f.stills.map(item=>typeof item==="string"?item:item?.url):[])];
  return [...new Set(assets.filter(url=>typeof url==="string"&&/^(https:\/\/|posters\/|images\/)/i.test(url)))];
}
function ticketFromFilm(f,s,date){
  const p=PG[s?.p]||PG[f.prog],v=VN[s?.v],h=v?.halls?.find(item=>item.id===s?.h);
  return {filmId:f.id,title:f.cn,subtitle:f.o||f.en,showId:s?.sid||(s?keyOf(s):""),
    programmeId:p?.id||"",programme:p?.name||"",section:p?.sections?.[f.id]||(p?.id===f.prog?f.section:"")||"",
    date:s?isoOf(showDate(s)):date,time:s?.t||"",city:v?.city||"",venue:v?.name||"",hall:h?.name||s?.h||"",format:f.version||"",art:ticketArtwork(f)[0]||""};
}
function ticketBase(filmId,view,date){
  const f=F[filmId];if(!f)return null;
  const s=view?watchShow(view):null,b=ticketFromFilm(f,s,date),fmt=view?.f&&window.SparrowGrowth?.FMT[view.f];
  if(fmt)b.format=fmt.zh;
  b.date=date;b.arts=ticketArtwork(f);b.director=f.dir||"";
  return b;
}
function ticketAll(){
  if(ticketData&&ticketDataRev===ticketRev+"|"+watchedSig())return ticketData;
  // 不对应观影记录的票根先挪回所属影片（一部电影一张，和观影护照对齐）
  const list=ticketViewings(),moves=TE.reconcile(list,ticketStore());
  if(moves)ticketStorePut({...ticketStore(),...moves},true);
  ticketData=TE.build(list,ticketStore(),ticketBase);ticketDataRev=ticketRev+"|"+watchedSig();
  ticketByKey=new Map(ticketData.tickets.map(row=>[row.key,row]));
  return ticketData;
}
// watched 会被原地修改，用条数 + 最新更新时间判断观影记录有没有变
function watchedSig(){let t=0,n=0;for(const id in watched){n++;const v=+watched[id]?.t||0;if(v>t)t=v;}return n+":"+t;}

// ——— 图片：海报缩略图 + 票面缓存 ———
function ticketImage(source){
  if(!source)return Promise.resolve(null);
  if(!ticketImageCache.has(source)){
    if(ticketImageCache.size>=120)ticketImageCache.delete(ticketImageCache.keys().next().value);
    ticketImageCache.set(source,new Promise(resolve=>{
      const image=new Image();
      const done=value=>{clearTimeout(timeout);image.onload=image.onerror=null;resolve(value);};
      const timeout=setTimeout(()=>done(null),4500);
      image.crossOrigin="anonymous";
      image.onload=()=>done(image);image.onerror=()=>done(null);image.src=source;
    }).then(image=>{if(!image)ticketImageCache.delete(source);return image;}));
  }
  return ticketImageCache.get(source);
}
const ticketThumb=row=>row.art&&row.art===pst(row.filmId)?(pthumb(row.filmId,360)||row.art):row.art;
async function ticketPoster(row,small){
  if(!row.art)return null;
  const thumb=small?ticketThumb(row):row.art;
  return (await ticketImage(thumb))||(thumb!==row.art?await ticketImage(row.art):null);
}
// 票面字体（与网站一致，见 shared/tickets.js 的 SERIF / SANS / MONO / LATIN）：Google 字体按字分片加载，画之前先载入要用到的字，最多等 2.5 秒
const TICKET_FIXED="麻雀观影护照纪念票根收藏放映日期开场影厅座位版本影院未填待定我的观影收藏册张正面背面";
// 片名字体（润植家康熙字典美化体子集，tools/build-title-font.py）：按 data/ticket-font.json 里的内容哈希加载，新片名上线后自动换新
let ticketTitleFont=null;
function loadTicketTitleFont(){
  if(ticketTitleFont)return ticketTitleFont;
  ticketTitleFont=(async()=>{
    if(typeof FontFace!=="function"||!document.fonts)return false;
    const meta=await fetch("data/ticket-font.json").then(r=>r.ok?r.json():{}).catch(()=>({}));
    const face=new FontFace(meta.family||"SparrowKangxi",`url(fonts/ticket-title.woff2?v=${meta.v||"1"}) format("woff2"),url(fonts/ticket-title.woff?v=${meta.v||"1"}) format("woff")`,{display:"swap"});
    document.fonts.add(await face.load());return true;
  })().catch(()=>{ticketTitleFont=null;return false;});
  return ticketTitleFont;
}
async function ticketFonts(rows){
  if(!document.fonts?.load)return;
  const title=loadTicketTitleFont();
  const text=[...new Set(TICKET_FIXED+rows.map(r=>[r.title,r.programme,r.section,r.venue,r.city,r.hall,r.format,r.seat].join("")).join(""))].join("");
  const jobs=[`900 40px "Noto Serif SC"`,`700 14px "Noto Sans SC"`,`500 14px "Noto Sans SC"`].map(f=>document.fonts.load(f,text));
  jobs.push(document.fonts.load(`500 20px "IBM Plex Mono"`,"0123456789.:—/ SPARROWCINEMA"),document.fonts.load(`600 12px "Barlow"`,rows.map(r=>(r.subtitle||"").toUpperCase()).join("")||"A"));
  jobs.push(title);
  await Promise.race([Promise.all(jobs).catch(()=>{}),new Promise(r=>setTimeout(r,2500))]);
}
const ticketSig=(row,side,w,style)=>[row.key,side,w,side==="front"?style:"",TE.lookSig(row.look),row.crop,row.art,row.time,row.venue,row.hall,row.seat,row.format,row.title,row.programme,row.city].join("¦");
async function ticketTileURL(row,side,w){
  const artStyle=ticketStyleFor(row),sig=ticketSig(row,side,w,artStyle);
  if(ticketURLs.has(sig)){const url=ticketURLs.get(sig);ticketURLs.delete(sig);ticketURLs.set(sig,url);return url;}
  const [image]=await Promise.all([side==="front"?ticketPoster(row,true):null,ticketFonts([row])]);
  const h=Math.round(w*TE.H/TE.W),canvas=ticketCanvas(w,h);
  TE.draw(canvas.getContext("2d"),{...row,artStyle},side,image,{x:0,y:0,w,h},ticketCanvas);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/webp",.86));
  if(!blob)return "";
  const url=URL.createObjectURL(blob);ticketURLs.set(sig,url);
  if(ticketURLs.size>900){const [key,old]=ticketURLs.entries().next().value;ticketURLs.delete(key);URL.revokeObjectURL(old);}
  return url;
}
function ticketObserve(root){
  ticketIO?.disconnect();ticketQueue=[];
  const tiles=root.querySelectorAll(".ticket-tile");
  if(!("IntersectionObserver" in window)){tiles.forEach(ticketEnqueue);return;}
  ticketIO=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){ticketIO.unobserve(entry.target);ticketEnqueue(entry.target);}}),{rootMargin:"700px 0px"});
  tiles.forEach(tile=>ticketIO.observe(tile));
}
function ticketEnqueue(el){ticketQueue.push(el);ticketPump();}
function ticketPump(){
  while(ticketWorking<4&&ticketQueue.length){
    const el=ticketQueue.shift();if(!el.isConnected)continue;
    ticketWorking++;ticketFill(el).catch(()=>{}).finally(()=>{ticketWorking--;ticketPump();});
  }
}
async function ticketFill(el){
  const row=ticketByKey.get(el.dataset.key);if(!row)return;
  const url=await ticketTileURL(row,ticketSide,TICKET_W[ticketDensity]||TICKET_W.m);
  if(url&&el.isConnected){const img=el.querySelector("img");img.src=url;el.classList.add("ready");}
}

// ——— 页面 ———
function ticketWallPage(){
  ticketAll();
  main.innerHTML=`<section class="view gut ticket-page">${subBackHTML()}<div id="ticket-body"></div></section>`;
  const panel=main.querySelector(".ticket-page");
  panel.addEventListener("click",ticketClick);
  panel.addEventListener("change",ticketChange);
  panel.addEventListener("input",ticketInput);
  ticketRender();
}
function ticketRender(){
  const body=main.querySelector("#ticket-body");if(!body)return;
  ticketIO?.disconnect();
  if(ticketDraft){body.innerHTML=ticketHeading(false,ticketDraft.original?"编辑票根":"新票根")+ticketEditor(ticketDraft.row);ticketEditorMount();return;}
  if(ticketMode==="create"){body.innerHTML=ticketCreateHTML();ticketSearch("");body.querySelector("#ticket-search")?.focus();return;}
  if(ticketMode==="pending"){body.innerHTML=ticketPendingHTML();return;}
  const {tickets,pending}=ticketAll();
  if(!tickets.length){body.innerHTML=ticketHeading(true)+ticketEmptyHTML(pending);if(!pending.length)ticketSearch("");return;}
  body.innerHTML=ticketHeading(true)+`<div id="ticket-list"></div>`;
  ticketPaintList();
}
// 页面结构与「我的海报墙」一致：标题 → 检索条 → 工具栏 → 列表；筛选、年份、显示、手绘风格和导出使用弹层
function ticketHeading(album,title){
  return `<div class="page-heading ticket-page-heading"><div><small>COLLECTOR'S TICKET BOOK</small><h2 class="sec">${ticketDict(title||"我的典藏票根册")}</h2></div>
    ${album?`<button type="button" class="text-button ticket-make" data-ticket-action="new">＋ ${ticketDict("制作票根")}</button>`:`<button type="button" class="text-button ticket-make" data-ticket-action="cancel">‹ ${ticketDict("返回收藏册")}</button>`}</div>`;
}
function ticketEmptyHTML(pending){
  if(pending.length)return `<div class="empty-plan"><h3>${ticketDict("还没有收藏票根")}</h3>
    <p>${pending.length} ${ticketDict("部电影还没做成票根")}</p>
    <div class="ticket-edit-actions ticket-center"><button type="button" class="primary-button" data-ticket-action="make-all">${ticketDict("一键生成")}</button>
    <button type="button" class="secondary-button" data-ticket-action="pending">${ticketDict("逐张挑选")}</button></div></div>`;
  return `<div class="ticket-empty"><h3>${ticketDict("还没有收藏票根")}</h3><p>${ticketDict("在影片页点「看过」盖章后，每部电影都可以做成一张票根；也可以直接搜索影片制作（会同时盖章）。")}</p>
    <label>${ticketDict("搜索护照片库")}<input id="ticket-search" type="search" autocomplete="off"></label><div id="ticket-results" class="ticket-results"></div></div>`;
}
const ticketActiveCount=()=>TE.FACETS.reduce((n,k)=>n+ticketQ[k].length,0);
const ticketFacetLabel={programme:"专题",city:"城市",venue:"影院",format:"放映版本"};
const TICKET_DENS=[["l","大图"],["m","中图"],["s","小图"],["spine","书脊"]];
function ticketShown(){
  const {tickets}=ticketAll(),all=TE.facetCounts(tickets);
  // 删除票根后已不存在的筛选项自动去掉
  if(ticketQ.year&&!all.year.some(y=>y.value===ticketQ.year))ticketQ.year="";
  TE.FACETS.forEach(k=>{ticketQ[k]=ticketQ[k].filter(v=>all[k].some(x=>x.value===v));});
  return {tickets,all,shown:TE.filterTickets(tickets,ticketQ)};
}
function ticketPaintList(){
  const box=main.querySelector("#ticket-list");if(!box)return;
  const {tickets,pending}=ticketAll(),{shown}=ticketShown(),groups=TE.groupByMonth(shown),n=ticketActiveCount();
  const filterValue=n?(LANG==="en"?n+" selected":`已选 ${n} 项`):ticketQ.text?`“${ticketQ.text}”`:tr("全部");
  const cells=[["filter","筛选",filterValue,!!(n||ticketQ.text)],["year","年份",ticketQ.year||tr("全部年份"),!!ticketQ.year],["density","显示",tr(TICKET_DENS.find(x=>x[0]===ticketDensity)[1]),false],["art-style","手绘风格",tr(TicketArt.styles.find(style=>style.id===ticketArtStyle).label),false]];
  const count=shown.length===tickets.length?`${tickets.length} ${tr("张票根")}`:`${shown.length} / ${tickets.length} ${tr("张票根")}`;
  box.innerHTML=`<div class="schedule-filterbar poster-wall-filterbar ticket-style-filterbar" aria-label="${ticketDict("票根筛选")}">${cells.map(([key,label,value,active])=>`<button type="button" class="schedule-filter${active?" active":""}" data-ticket-filter="${key}" aria-haspopup="dialog" aria-label="${esc(tr(label)+"："+value)}"><span><small>${ticketDict(label)}</small><b>${esc(value)}</b></span>${filterChevron}</button>`).join("")}</div>
    <div class="pw-actions"><p class="pw-hint pw-count" role="status">${esc(count)}${LANG==="en"?", ":"，"}${ticketDict("按观影日期排列")}</p>
      <label class="pw-score-toggle"><input type="checkbox" data-ticket-back${ticketSide==="back"?" checked":""}>${ticketDict("看背面")}</label>
      <button type="button" class="secondary-button ticket-export-btn" data-ticket-action="export-open"${shown.length?"":" disabled"}>${ticketDict("导出票根墙")}</button></div>
    ${pending.length?`<div class="ticket-todo"><span><b>${pending.length}</b> ${ticketDict("部电影还没做成票根")}</span><span><button type="button" class="text-button" data-ticket-action="make-all">${ticketDict("一键生成")}</button><i aria-hidden="true">·</i><button type="button" class="text-button" data-ticket-action="pending">${ticketDict("逐张挑选")} ›</button></span></div>`:""}
    ${n?`<div class="ticket-chips">${TE.FACETS.flatMap(k=>ticketQ[k].map(v=>`<button type="button" data-ticket-facet="${k}" data-value="${esc(v)}" aria-label="${ticketDict("移除筛选")} ${esc(v)}">${esc(v)} ×</button>`)).join("")}<button type="button" class="text-button" data-ticket-action="clear">${ticketDict("清除筛选")}</button></div>`:""}
    ${shown.length?`<div class="ticket-album" data-density="${ticketDensity}">${groups.map(g=>ticketMonthHTML(g)).join("")}</div>`:
      `<div class="empty-plan"><h3>${ticketDict("所选条件下暂无票根")}</h3><button type="button" class="secondary-button" data-ticket-action="clear-all">${ticketDict("清除筛选")}</button></div>`}
    ${ticketPick?`<div class="ticket-pickbar" role="region" aria-label="${ticketDict("精选票根墙")}"><span>${ticketDict("已选")} <b>${ticketPick.size}</b> / ${TICKET_PICK_MAX}</span>
      <button type="button" class="text-button" data-ticket-action="pick-cancel">${ticketDict("取消")}</button><button type="button" class="secondary-button ticket-export-btn" data-ticket-action="pick-export"${ticketPick.size?"":" disabled"}>${ticketDict("导出精选墙")}</button></div>`:""}`;
  if(ticketDensity!=="spine")ticketObserve(box);
}
function ticketMonthHTML(g){
  const title=g.id==="undated"?tr("日期待定"):(LANG==="en"?`${new Date(Date.UTC(+g.year,g.month-1,1)).toLocaleString("en",{month:"long",timeZone:"UTC"})} ${g.year}`:`${g.year}年${g.month}月`);
  return `<section class="ticket-month" style="--rows:${g.rows.length}"><h3 class="ticket-month-h"><span>${esc(title)}</span><small>${g.rows.length} ${ticketDict("张票根")}</small></h3>
    <div class="ticket-grid">${g.rows.map(row=>ticketDensity==="spine"?ticketSpineHTML(row):ticketTileHTML(row)).join("")}</div></section>`;
}
function ticketTileHTML(row){
  const c=TE.swatch(row),picked=ticketPick?.has(row.key);
  return `<button type="button" class="ticket-tile${picked?" picked":""}" data-key="${esc(row.key)}" style="--sw:${c.stock};--sa:${c.accent}" aria-label="${esc(row.title+" "+row.date+" "+row.venue)}"${ticketPick?` aria-pressed="${!!picked}"`:""}>
    <img alt="" decoding="async"><span>${esc(row.title)}</span></button>`;
}
function ticketSpineHTML(row){
  const c=TE.swatch(row),picked=ticketPick?.has(row.key);
  return `<button type="button" class="ticket-spine${picked?" picked":""}" data-key="${esc(row.key)}" style="--sa:${c.accent}"${ticketPick?` aria-pressed="${!!picked}"`:""}>
    <i aria-hidden="true"></i><span class="ts-main"><b>${esc(row.title)}</b><em>${esc([row.venue,row.programme].filter(Boolean).join(" · "))}</em></span><span class="ts-date">${esc([row.date.replace(/-/g,"."),row.time].filter(Boolean).join(" "))}</span></button>`;
}

// ——— 弹层（沿用排片 / 海报墙的 schedule-selector 样式） ———
function ticketLockStyleDialog(dialog){
  const root=document.documentElement,body=document.body;
  const {scrollX,scrollY}=window;
  body.style.setProperty("--ticket-style-page-top",`${-scrollY}px`);
  root.classList.add("ticket-style-dialog-open");
  const onNavigate=()=>{dialog.releaseScroll?.(false);dialog.close();};
  dialog.releaseScroll=(restore=true)=>{
    dialog.releaseScroll=null;
    window.removeEventListener("hashchange",onNavigate);
    root.classList.remove("ticket-style-dialog-open");
    body.style.removeProperty("--ticket-style-page-top");
    if(restore)window.scrollTo({left:scrollX,top:scrollY,behavior:"instant"});
  };
  window.addEventListener("hashchange",onNavigate);
}
function ticketDialog(kind,title,body,foot){
  const previous=document.getElementById("ticket-selector");
  previous?.close();
  previous?.releaseScroll?.();
  const d=document.createElement("dialog");d.id="ticket-selector";d.className="schedule-selector ticket-selector";d.dataset.kind=kind;
  d.setAttribute("aria-labelledby","ticket-selector-title");
  d.innerHTML=`<header class="selector-head"><h2 id="ticket-selector-title">${title}</h2><button type="button" class="selector-close" data-ticket-dlg="close" aria-label="${ticketDict("关闭")}">×</button></header>${body}${foot?`<footer class="selector-foot">${foot}</footer>`:""}`;
  document.body.appendChild(d);
  d.addEventListener("click",e=>{if(e.target===d){d.close();return;}ticketDialogClick(e,d);});
  d.addEventListener("input",e=>{if(e.target.id==="ticket-q"){clearTimeout(ticketSearchTimer);ticketSearchTimer=setTimeout(()=>{ticketQ.text=e.target.value;ticketPaintList();ticketFilterRefresh(d);},160);}});
  d.addEventListener("change",e=>ticketDialogChange(e,d));
  d.addEventListener("close",()=>{
    d.releaseScroll?.();
    d.remove();
    if(kind==="export"&&!ticketPick)ticketExportOpen=false;
    main.querySelector(`[data-ticket-filter="${kind}"]`)?.focus({preventScroll:true});
  });
  if(kind==="art-style")ticketLockStyleDialog(d);
  d.showModal();return d;
}
const ticketOptionRow=(attr,value,name,sub,selected)=>`<button type="button" class="selector-option" role="option" aria-selected="${selected}" ${attr}="${esc(value)}"><span><b>${esc(name)}</b>${sub?`<small>${esc(sub)}</small>`:""}</span><span class="selector-check" aria-hidden="true">${selected?"✓":""}</span></button>`;
function ticketFilterBody(){
  const {tickets}=ticketAll(),all=TE.facetCounts(tickets),counts=TE.facetCounts(tickets,ticketQ);
  const groups=TE.FACETS.filter(k=>all[k].length>1||ticketQ[k].length);
  return groups.length?groups.map(k=>`<div class="ticket-facet"><h3>${ticketDict(ticketFacetLabel[k])}</h3><div>${counts[k].slice(0,k==="programme"?80:40).map(x=>`<button type="button" data-ticket-facet="${k}" data-value="${esc(x.value)}" aria-pressed="${ticketQ[k].includes(x.value)}">${esc(x.value)} <small>${x.count}</small></button>`).join("")}</div></div>`).join(""):`<p class="selector-empty">${ticketDict("票根还不多，暂时没有可筛选的项目")}</p>`;
}
function ticketFilterRefresh(d){
  const box=d.querySelector(".selector-results"),top=box.scrollTop;box.innerHTML=ticketFilterBody();box.scrollTop=top;
  d.querySelector(".selector-done").textContent=tr("显示")+" "+ticketShown().shown.length+" "+tr("张票根");
}
function ticketOpenFilter(kind){
  if(kind==="art-style"){
    const options=ticketDraft?TicketArt.filmStyleOptions:TicketArt.styles;
    const selected=ticketDraft?ticketFilmStyles.get(ticketDraft.row.filmId)||"":ticketArtStyle;
    ticketDialog("art-style",ticketDict("手绘风格"),`<div class="selector-results" role="listbox">${options.map(({id,label})=>ticketOptionRow("data-ticket-art-style",id,tr(label),"",selected===id)).join("")}</div>`);
    return;
  }
  const {tickets,all}=ticketShown();
  if(kind==="filter"){
    const d=ticketDialog("filter",ticketDict("筛选票根"),`<label class="selector-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><input type="search" id="ticket-q" autocomplete="off" value="${esc(ticketQ.text)}" placeholder="${ticketDict("搜片名、导演、影院、专题")}" aria-label="${ticketDict("搜索票根")}"></label><div class="selector-results ticket-facet-box"></div>`,
      `<button type="button" class="text-button" data-ticket-dlg="clear">${ticketDict("清除筛选")}</button><button type="button" class="selector-done" data-ticket-dlg="close"></button>`);
    ticketFilterRefresh(d);return;
  }
  if(kind==="year"){
    const counts=TE.facetCounts(tickets,ticketQ),n=Object.fromEntries(counts.year.map(y=>[y.value,y.count]));
    ticketDialog("year",ticketDict("年份"),`<div class="selector-results" role="listbox">${ticketOptionRow("data-ticket-year","",tr("全部年份"),`${tickets.length} ${tr("张票根")}`,!ticketQ.year)}${all.year.map(y=>ticketOptionRow("data-ticket-year",y.value,y.value,`${n[y.value]||0} ${tr("张票根")}`,ticketQ.year===y.value)).join("")}</div>`);
    return;
  }
  if(kind==="density"){
    const sub={l:"每排 2–4 张，显示片名",m:"默认",s:"一屏看更多",spine:"只列文字，几千张也很快"};
    ticketDialog("density",ticketDict("显示"),`<div class="selector-results" role="listbox">${TICKET_DENS.map(([v,l])=>ticketOptionRow("data-ticket-density",v,tr(l),tr(sub[v]),ticketDensity===v)).join("")}</div>`);
  }
}

// ——— 导出弹层 ———
function ticketExportBody(){
  const o=ticketExportOpen||{},counts=TE.facetCounts(ticketAll().tickets),shown=ticketShown().shown;
  const year=o.year||counts.year[0]?.value||"",prog=o.prog||counts.programme[0]?.value||"",kind=o.kind||"current";
  const rows=ticketExportRows(),parts=Math.ceil(rows.length/TE.MOSAIC_MAX),part=Math.min(o.part||0,Math.max(0,parts-1));
  const opt=(v,name,sub,extra="")=>`<div class="ticket-ex-opt">${ticketOptionRow("data-ticket-kind",v,name,sub,kind===v)}${kind===v?extra:""}</div>`;
  return `<div class="selector-results" role="listbox">
    ${opt("current",tr("当前结果"),`${shown.length} ${tr("张票根")}`)}
    ${counts.year.length?opt("year",tr("年度票根墙"),year,`<select class="ticket-ex-select" name="export-year" aria-label="${ticketDict("年份")}">${counts.year.map(y=>ticketOption(y.value,`${y.value}（${y.count}）`,year)).join("")}</select>`):""}
    ${counts.programme.length?opt("prog",tr("专题票根墙"),prog,`<select class="ticket-ex-select" name="export-prog" aria-label="${ticketDict("专题")}">${counts.programme.map(p=>ticketOption(p.value,`${p.value}（${p.count}）`,prog)).join("")}</select>`):""}
    ${opt("pick",tr("精选票根墙"),`${tr("自己挑")} ≤${TICKET_PICK_MAX} ${tr("张票根")}`)}
    ${parts>1&&kind!=="pick"?`<label class="ticket-ex-part">${ticketDict("分成")} ${parts} ${ticketDict("张图导出")}<select class="ticket-ex-select" name="export-part">${Array.from({length:parts},(_,i)=>ticketOption(String(i),`${i+1} / ${parts}`,String(part))).join("")}</select></label>`:""}
  </div>`;
}
function ticketExportFoot(){
  const o=ticketExportOpen||{},n=ticketExportRows().length;
  return `<small>${ticketDict(ticketSide==="front"?"正面":"背面")}</small><button type="button" class="selector-done" data-ticket-dlg="go"${o.kind!=="pick"&&!n?" disabled":""}>${ticketDict(o.kind==="pick"?"开始挑选":"生成图片")}</button>`;
}
function ticketOpenExport(){
  if(!ticketExportOpen)ticketExportOpen={kind:"current"};
  ticketDialog("export",ticketDict("导出票根墙"),ticketExportBody(),ticketExportFoot());
}
function ticketExportRefresh(d){d.querySelector(".selector-results").outerHTML=ticketExportBody();d.querySelector(".selector-foot").innerHTML=ticketExportFoot();}
function ticketDialogClick(e,d){
  const kind=d.dataset.kind,t=e.target;
  const act=t.closest("[data-ticket-dlg]")?.dataset.ticketDlg;
  if(act==="close"){d.close();return;}
  if(act==="clear"){TE.FACETS.forEach(k=>{ticketQ[k]=[];});ticketQ.text="";const q=d.querySelector("#ticket-q");if(q)q.value="";ticketPaintList();ticketFilterRefresh(d);return;}
  if(act==="go"){
    if(ticketExportOpen?.kind==="pick"){ticketPick=new Set();d.close();ticketExportOpen=false;ticketPaintList();toast(tr("点票根挑选，最多")+" "+TICKET_PICK_MAX+" "+tr("张票根"));return;}
    const b=t.closest("button");ticketExport(b,false).finally(()=>{if(d.open)d.close();});return;
  }
  const facet=t.closest("[data-ticket-facet]");
  if(facet){const k=facet.dataset.ticketFacet,v=facet.dataset.value,list=ticketQ[k];ticketQ[k]=list.includes(v)?list.filter(x=>x!==v):[...list,v];ticketPaintList();ticketFilterRefresh(d);return;}
  const year=t.closest("[data-ticket-year]");
  if(year){ticketQ.year=year.dataset.ticketYear;d.close();ticketPaintList();return;}
  const dens=t.closest("[data-ticket-density]");
  if(dens){ticketDensity=dens.dataset.ticketDensity;try{localStorage.setItem(TICKET_DENSITY_KEY,ticketDensity);}catch{}d.close();ticketPaintList();return;}
  const art=t.closest("[data-ticket-art-style]");
  if(art&&kind==="art-style"){
    const choice=art.dataset.ticketArtStyle;
    d.close();
    if(ticketDraft){
      const row=ticketDraft.row;
      if(choice===(ticketFilmStyles.get(row.filmId)||""))return;
      const updated=TicketArt.saveFilmStyle(readTicketPreference,(key,value)=>localStorage.setItem(key,value),row.filmId,choice);
      if(!updated){toast(tr("票根保存失败，请检查本机存储"));return;}
      ticketFilmStyles=updated;ticketMarkArt(row.filmId);
      ticketFlipTo("front");
      ticketRenderCard(main.querySelector("#ticket-preview-front"),row,"front");
      return;
    }
    const style=TicketArt.normalize(choice);
    if(style===ticketArtStyle)return;
    ticketArtStyle=style;ticketSide="front";
    try{localStorage.setItem(TicketArt.storageKey,style);}catch{}
    ticketMarkArt(null);
    ticketPaintList();
    return;
  }
  const k=t.closest("[data-ticket-kind]");
  if(k&&kind==="export"){ticketExportOpen={...ticketExportOpen,kind:k.dataset.ticketKind,part:0};ticketExportRefresh(d);}
}
function ticketDialogChange(e,d){
  const {name,value}=e.target;
  if(name==="export-year")ticketExportOpen={...ticketExportOpen,year:value,part:0};
  else if(name==="export-prog")ticketExportOpen={...ticketExportOpen,prog:value,part:0};
  else if(name==="export-part"){ticketExportOpen={...ticketExportOpen,part:Number(value)};return;}
  else return;
  ticketExportRefresh(d);
}

// ——— 待制作 ———
function ticketPendingHTML(){
  const {pending}=ticketAll(),rows=pending.slice(0,ticketPendingShown);
  const line=item=>{const f=F[item.filmId],b=ticketBase(item.filmId,item.view,item.view.d)||{};
    return `<li><button type="button" class="ticket-pend" data-ticket-pending="${esc(item.key)}">${pst(item.filmId)?pimg(item.filmId,360,'loading="lazy" alt=""'):"<i></i>"}
      <b>${esc(f?.cn||item.filmId)}</b><span>${esc([item.view.d.replace(/-/g,"."),b.time,b.venue].filter(Boolean).join(" · "))}</span><em>${ticketDict("制作")} ›</em></button></li>`;};
  return ticketHeading(false)+`<div class="ticket-pending"><h3>${ticketDict("待制作")} ${pending.length} ${ticketDict("部")}</h3>
    <p>${ticketDict("和观影护照一样，一部电影一张票根。一键生成使用专题默认款式，之后仍可逐张换款。")}</p>
    ${pending.length?`<button type="button" class="primary-button" data-ticket-action="make-all">${ticketDict("一键生成全部")} ${pending.length} ${ticketDict("张票根")}</button>`:`<p>${ticketDict("所有观影都已经做成票根了。")}</p>`}
    <ul>${rows.map(line).join("")}</ul>
    ${pending.length>rows.length?`<button type="button" class="ticket-alt" data-ticket-action="pending-more">${ticketDict("显示更多")}（${pending.length-rows.length}）</button>`:""}</div>`;
}
function ticketMakeAll(){
  const {pending}=ticketAll();if(!pending.length)return;
  const t=Date.now(),changes={};pending.forEach(item=>{changes[item.key]={t};});
  if(!ticketSet(changes))return;
  ticketMode="album";ticketRender();toast(tr("已生成")+" "+pending.length+" "+tr("张票根"));
}

// ——— 制作 / 编辑 ———
function ticketCreateHTML(){
  return ticketHeading(false)+`<div class="ticket-empty"><h3>${ticketDict("制作票根")}</h3><label>${ticketDict("搜索护照片库")}<input id="ticket-search" type="search" autocomplete="off"></label><div id="ticket-results" class="ticket-results"></div></div>`;
}
function ticketSearch(query){
  const results=main.querySelector("#ticket-results");if(!results)return;
  const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const list=terms.length?FILMS.filter(f=>terms.every(s=>`${f.cn} ${f.o||""} ${f.en||""} ${f.dir||""}`.toLowerCase().includes(s))).slice(0,30):
    watchEntries().slice(-18).reverse().map(e=>e.f);
  results.innerHTML=list.length?list.map(f=>`<button type="button" class="ticket-result" data-ticket-film-id="${esc(f.id)}">
    ${pst(f.id)?pimg(f.id,360,'loading="lazy" alt=""'):""}<span>${esc(f.cn)}</span></button>`).join(""):
    `<p>${ticketDict(terms.length?"没有匹配的影片":"输入电影片名开始搜索。")}</p>`;
}
// 打开某次观影的票根：已收藏就编辑，没做过就新建（随机盲盒款式）
function ticketOpenViewing(item){
  const existing=ticketAll().tickets.find(row=>row.key===item.key);
  if(existing){ticketOpen(existing);return;}
  const row=TE.build([item],{[item.key]:{t:Date.now()}},ticketBase).tickets[0];if(!row)return;
  row.look=TE.randomLook(row);
  ticketDraft={row,original:"",side:"front",view:item.view};ticketRender();window.scrollTo(0,0);
}
function ticketBegin(id){
  const f=F[id];if(!f)return;
  const mine=ticketViewings().filter(item=>item.filmId===id).sort((a,b)=>b.view.d.localeCompare(a.view.d));
  const made=new Set(ticketAll().tickets.map(row=>row.key));
  // 一部电影一张：已有票根就打开它，否则用最近一次观影新建
  const item=mine.find(x=>made.has(x.key))||mine[0];
  if(item){ticketOpenViewing(item);return;}
  // 没有观影记录：先找这部电影以前做过、现在没对上观影记录的票根（比如移出过护照），接着编辑它
  const store=ticketStore(),old=Object.keys(store).filter(k=>k.startsWith(id+"|")&&!store[k].del&&TE.parseKey(k)).sort((x,y)=>(store[y].t||0)-(store[x].t||0))[0];
  if(old){const row=TE.draft(old,store[old],ticketBase);if(row){ticketDraft={row,original:old,side:"front",view:null};ticketRender();window.scrollTo(0,0);return;}}
  // 都没有：手工票根，日期默认今天，可改；保存时同时盖章
  const date=isoOf(new Date(now())),key=ticketFreeKey(id,date);
  const row=TE.draft(key,{t:Date.now()},ticketBase);if(!row)return;
  row.look=TE.randomLook(row);
  ticketDraft={row,original:"",side:"front",view:null};ticketRender();window.scrollTo(0,0);
}
function ticketFreeKey(filmId,date,except){
  const store=ticketStore(),linked=new Set(ticketViewings().map(item=>item.key));
  for(let n=1;n<10;n++){const key=TE.ticketKey(filmId,date,n);if(key===except||(!linked.has(key)&&(!store[key]||store[key].del)))return key;}
  return "";
}
function ticketOpen(row){
  const item=row.linked?ticketViewings().find(x=>x.key===row.key):null;
  ticketDraft={row:{...row,look:{...row.look}},original:row.key,side:ticketSide,view:item?.view||null};ticketRender();window.scrollTo(0,0);
}
// 票面（裁切 / 配图）改动后，可以就地保存，不用离开详情页
const ticketArtSig=row=>[row.crop,row.art].join("|");
function ticketArtDirty(){
  const d=ticketDraft;if(!d)return false;
  if(d.artSig===undefined)d.artSig=d.original?ticketArtSig(d.row):"";
  return ticketArtSig(d.row)!==d.artSig;
}
function ticketArtSaveState(){const b=main.querySelector(".te-art-save");if(b)b.disabled=!ticketArtDirty();}
function ticketEditor(row){
  const assets=[...(row.arts||[])];
  if(row.art&&!assets.includes(row.art))assets.unshift(row.art);
  const front=ticketDraft.side==="front";
  const input=(key,label,placeholder,type="text")=>`<label class="te-row"><span class="te-k">${ticketDict(label)}</span><input class="te-in" type="${type}" name="${key}" value="${esc(row[key])}" placeholder="${ticketDict(placeholder)}"></label>`;
  const dateRow=row.linked?`<div class="te-row"><span class="te-k">${ticketDict("观影日期")}</span><span class="te-v"><b class="te-mono">${esc(row.date.replace(/-/g,"."))}</b><small class="te-note">${ticketDict("来自观影记录")}</small></span></div>`:input("date","观影日期","","date");
  return `<div class="te">
    <div class="te-stage"><button type="button" data-ticket-action="flip" class="ticket-flip" data-side="${ticketDraft.side}" aria-label="${ticketDict("翻面")}">
      <span class="ticket-turn"><span class="ticket-face ticket-front"><canvas width="630" height="1296" id="ticket-preview-front" aria-hidden="true"></canvas><span class="ticket-fx" aria-hidden="true" hidden></span><span class="ticket-fx" aria-hidden="true" hidden></span><span class="ticket-fx" aria-hidden="true" hidden></span></span>
      <span class="ticket-face ticket-back"><canvas width="630" height="1296" id="ticket-preview-back" aria-hidden="true"></canvas><span class="ticket-fx" aria-hidden="true" hidden></span><span class="ticket-fx" aria-hidden="true" hidden></span><span class="ticket-fx" aria-hidden="true" hidden></span></span>
      <span class="ticket-edge te-l1"></span><span class="ticket-edge te-l2"></span><span class="ticket-edge te-r1"></span><span class="ticket-edge te-r2"></span></span></button>
      ${assets.length?`<div class="te-art">
        <label class="te-crop"><span>${ticketDict("裁切")}</span><input class="te-range" type="range" min="0" max="100" name="crop" value="${row.crop}" aria-label="${ticketDict("裁切位置")}"></label>
        ${assets.length>1?`<select class="te-art-pick" name="art" aria-label="${ticketDict("票面图像")}">${assets.map((a,i)=>ticketOption(a,`${tr(i===0?"海报":"备用图像")} ${i+1}`,row.art)).join("")}</select>`:""}
        <button type="button" class="te-art-save" data-ticket-action="save-here" ${ticketArtDirty()?"":"disabled"}>${ticketDict("保存")}</button></div>`:""}
      <div class="te-tools"><div class="te-seg" role="tablist" aria-label="${ticketDict("票根面")}">
        <button type="button" role="tab" data-ticket-side="front" aria-selected="${front}">${ticketDict("正面")}</button><button type="button" role="tab" data-ticket-side="back" aria-selected="${!front}">${ticketDict("背面")}</button></div>
        <button type="button" class="te-dice" data-ticket-action="shuffle">${ticketDict("随机换一款")}</button>
        <button type="button" class="te-style" data-ticket-filter="art-style" aria-haspopup="dialog">${ticketDict("手绘风格")}${filterChevron}</button></div>
      <p class="te-craft" aria-live="polite"></p>
      <button type="button" class="te-reset" data-ticket-action="reset">${ticketDict("恢复专题默认款式")}</button></div>
    <div class="te-body">
      <div class="te-heading">
        <div class="te-title"><h3>${esc(row.title)}</h3>${row.programme?`<small>${esc(row.programme)}</small>`:""}</div>
        <div class="te-actions">
          <button type="button" class="te-action te-action-export" data-ticket-action="single" aria-label="${ticketDict("导出这张票根")}">${ticketDict("导出")}</button>
          ${ticketDraft.original?`<button type="button" class="te-action te-action-remove" data-ticket-action="remove">${ticketDict("移出收藏册")}</button>`:""}
        </div>
      </div>
      <h4 class="te-sec">${ticketDict("放映信息")}</h4>
      <div class="te-card">${ticketShowRow(row)}${dateRow}${input("time","开场时间","","time")}${input("venue","影院","影院名称")}${input("hall","影厅","如 1号厅")}${input("seat","座位","选填，如 5排8座")}${input("format","放映版本","如 4K修复")}</div>
      <div class="te-acts"><button type="button" class="te-save" data-ticket-action="save">${ticketDict(ticketDraft.original?"保存修改":"加入收藏册")}</button></div>
    </div></div>`;
}
function ticketEditorMount(){
  ticketDrawEditor();
  const card=main.querySelector(".ticket-flip");if(!card)return;
  card.ticketTurn=ticketTurner(card);
}
// 360° 转动（与小程序 packages/collect/ticket-edit/turn.wxs 同一套规则，改这里记得同步那边）：
// 左右随便转；上下最多倾斜 65°；松手按甩动速度带一点惯性，再慢慢转回最近的正面或背面；轻点翻面（走原来的 flip 动作）。
// 高光跟着角度走：正对时不亮，越斜反光越往一边移；只在拖动时出现，停下淡出。
// 触屏上手指在票根上滑动只转票根（CSS touch-action:none），页面不跟着滚；拖动过的那次松手不算点击。
// 各种工艺的反光层位置与强度（背景图在 styles/tickets.css 的 .ticket-flip[data-fx=…] .ticket-fx）
function ticketFxStyle(fx,s,t,lit){
  const p=v=>`${Math.round(v)}%`,o=lit?Math.min(1,Math.abs(s)*2.4+Math.abs(t)*1.6):0;
  const table={
    holo:[`${p(50+s*60)} ${p(50+t*60)}`,.6],
    cast:[`${p(50-s*45)} ${p(50-t*45)}, ${p(50+s*60)} ${p(50+t*60)}`,.75],
    crystal:[`${p(50+s*70)} ${p(50+t*50)}, ${p(50-s*60)} 0%`,.75],
    sweep:[`${p(50-s*60)} 0%`,.9],
    glitter:[`${p(50-s*60)} 0%, ${p(50+s*50)} 0%`,.95],
    gloss:[`${p(50-s*90)} ${p(50+t*90)}`,.75],
    sense:[`${p(50-s*90)} ${p(50+t*90)}, ${p(50-s*60)} 0%`,.9]
  };
  const [pos,peak]=table[fx]||["50% 50%",0];
  return {pos,o:+(o*peak).toFixed(3)};
}
function ticketTurner(card){
  const turn=card.querySelector(".ticket-turn"),REST_X=-2,REST_Y=-4,DEG_X=.45,DEG_Y=.35,TILT=65;
  const still=matchMedia("(prefers-reduced-motion: reduce)").matches;
  let ry=(ticketDraft?.side==="back"?180:0)+REST_Y,rx=REST_X,start=null,dragged=false,samples=[],fade=0;
  const face=y=>Math.round((y-REST_Y)/180),sideOf=y=>((face(y)%2)+2)%2?"back":"front";
  const paint=(ms,lit)=>{
    turn.style.transition=ms&&!still?`transform ${ms}ms cubic-bezier(.18,.8,.25,1)`:"none";
    turn.style.transform=`rotateX(${rx}deg) rotateY(${ry}deg)`;
    const rel=(ry-REST_Y-face(ry)*180)*Math.PI/180,tilt=(rx-REST_X)*Math.PI/180,s=Math.sin(rel),t=Math.sin(tilt);
    card.style.setProperty("--gx",`${Math.round(50+s*90)}%`);card.style.setProperty("--gy",`${Math.round(32-t*90)}%`);
    // 工艺反光（与小程序 turn.wxs 的 fxStyle 一致）：只在烫印范围里，按角度移动；越斜越明显，松手淡出
    card.querySelectorAll(".ticket-fx").forEach(el=>{
      if(el.hidden)return;
      const fx=ticketFxStyle(el.dataset.fx,s,t,lit);
      el.style.backgroundPosition=fx.pos;el.style.opacity=+(fx.o*(+el.dataset.k||1)).toFixed(3);el.style.transition=lit?"opacity .12s":`opacity ${Math.max(ms||0,350)}ms ease-out`;
    });
    clearTimeout(fade);
    if(lit)card.dataset.glare="";else fade=setTimeout(()=>delete card.dataset.glare,Math.min(ms||0,250));
  };
  const settle=target=>{
    const ms=Math.round(Math.min(900,380+Math.abs(target-ry)*1.6));
    ry=target;rx=REST_X;paint(ms,false);
    const side=sideOf(ry);
    if(ticketDraft&&side!==ticketDraft.side){ticketDraft.side=side;ticketSideTabs(side);}
  };
  paint(0,false);
  card.addEventListener("pointerdown",e=>{
    if(!e.isPrimary||e.button>0)return;
    start={x:e.clientX,y:e.clientY,ry,rx};dragged=false;samples=[{t:performance.now(),ry}];
    try{card.setPointerCapture(e.pointerId);}catch{}
  });
  card.addEventListener("pointermove",e=>{
    if(!start||!e.isPrimary)return;
    const dx=e.clientX-start.x,dy=e.clientY-start.y;
    if(!dragged&&Math.abs(dx)+Math.abs(dy)<6)return;
    dragged=true;
    ry=start.ry+dx*DEG_X;rx=Math.max(-TILT,Math.min(TILT,start.rx-dy*DEG_Y));
    const t=performance.now();samples.push({t,ry});while(samples.length>2&&t-samples[0].t>100)samples.shift();
    paint(0,true);
  });
  const release=e=>{
    if(!start)return;start=null;
    if(!dragged)return;
    const a=samples[0],b=samples[samples.length-1],dt=b.t-a.t;
    const v=dt>0&&performance.now()-b.t<80?(b.ry-a.ry)/dt:0;
    settle(face(ry+Math.max(-360,Math.min(360,v*250)))*180+REST_Y);
  };
  card.addEventListener("pointerup",release);card.addEventListener("pointercancel",release);
  card.addEventListener("click",e=>{if(dragged){dragged=false;e.preventDefault();e.stopPropagation();}},true);
  return {to(side){if(sideOf(ry)!==side)settle((face(ry)+1)*180+REST_Y);},side:()=>sideOf(ry)};
}
function ticketDrawEditor(){
  if(!ticketDraft)return;
  const card=main.querySelector(".ticket-flip");if(!card)return;
  const shine=TE.shineOf(ticketDraft.row.look.finish);
  card.dataset.shine=shine.kind;card.style.setProperty("--metal-highlight",shine.highlight+"af");card.style.setProperty("--edge",TE.edgeOf(ticketDraft.row));
  const craft=main.querySelector(".te-craft");if(craft)craft.textContent=tr("工艺")+"："+TE.craftLabel(ticketDraft.row.look,tr);
  for(const side of ["front","back"])ticketRenderCard(main.querySelector("#ticket-preview-"+side),ticketDraft.row,side);
}
async function ticketRenderCard(canvas,row,side){
  const rendering=(canvas.ticketPainting||0)+1;canvas.ticketPainting=rendering;
  const styled={...row,artStyle:ticketStyleFor(row)};
  const draw=image=>{const ctx=canvas.getContext("2d");ctx.clearRect(0,0,canvas.width,canvas.height);TE.draw(ctx,styled,side,image,{x:0,y:0,w:canvas.width,h:canvas.height},ticketCanvas);ticketFxMask(canvas,styled,side,image);};
  await ticketFonts([row]);if(!canvas.isConnected||canvas.ticketPainting!==rendering)return;
  draw(null);
  if(side==="front"&&row.art){const image=await ticketPoster(row,false);if(canvas.isConnected&&canvas.ticketPainting===rendering&&image)draw(image);}
}
// 工艺反光层（只在详情页用）：每面最多三层——底箔的反光、工艺组合里的烫印增效、海报画面增效（只有正面）。
// 前两层用工艺遮罩（烫印 / 镭射 / 光油 / 盲文 / 可变数据烫印的区域），海报层用从海报算出的遮罩；转动时按角度移动（ticketTurner）。
function ticketFxMask(canvas,row,side,image){
  const spans=[...(canvas.parentElement?.querySelectorAll(".ticket-fx")||[])];if(!spans.length)return;
  const w=315,h=Math.round(w*TE.H/TE.W),layers=[];
  const base=TE.fxOf(row.look.finish),extra=TE.parseCraft(row.look.craft).foil.find(fx=>fx!==base);
  if(base!=="none"||extra){
    const mask=ticketCanvas(w,h);
    if(TE.foilMask(mask.getContext("2d"),row,side,{x:0,y:0,w,h},ticketCanvas,!!image)){
      const url=`url(${mask.toDataURL("image/png")})`;
      if(base!=="none")layers.push({fx:base,k:1,url});
      if(extra)layers.push({fx:extra,k:.7,url});
    }
  }
  if(side==="front"&&image){const art=TE.artMask(row,image,ticketCanvas,w);if(art)layers.push({fx:art.fx,k:1,url:`url(${art.toDataURL("image/png")})`});}
  spans.forEach((el,i)=>{
    const layer=layers[i];el.hidden=!layer;
    if(!layer){el.style.webkitMaskImage=el.style.maskImage="none";delete el.dataset.fx;return;}
    el.dataset.fx=layer.fx;el.dataset.k=layer.k;el.style.webkitMaskImage=layer.url;el.style.maskImage=layer.url;
  });
}
function ticketSave(stay){
  const d=ticketDraft,row=TE.sanitize({...d.row});
  if(!row.date){toast(tr("请填写放映日期"));return;}
  let key=d.row.key,stamped=false;
  // 一部电影一张票根、和护照同步：给还没盖章的电影做票根，同时在护照里盖章（观影日期＝票根日期）
  const rec=watched[row.filmId];
  if(!d.row.linked&&(!rec||rec.del)){
    watched[row.filmId]={d:row.date,r:0,k:"",t:Math.max(Date.now(),(rec?.t||0)+1)};saveWatched();stamped=true;
    const item=ticketViewings().find(x=>x.filmId===row.filmId);
    if(item){key=item.key;d.view=item.view;d.row.linked=true;d.row.key=key;}
  }
  if(!d.row.linked){
    const parsed=TE.parseKey(key);
    if(!parsed||parsed.date!==row.date)key=ticketFreeKey(row.filmId,row.date,d.original);
    if(!key){toast(tr("这一天的票根已经太多了"));return;}
  }
  const base=ticketBase(row.filmId,d.view,row.date);
  const entry=base?TE.entryFrom({...row,id:key},{...base,id:key}):{t:Date.now()};
  const changes={[key]:entry};
  if(d.original&&d.original!==key)changes[d.original]={del:1,t:Date.now()};
  if(!ticketSet(changes))return;
  if(stay){
    d.original=key;d.row.key=key;d.artSig=ticketArtSig(d.row);
    const y=window.scrollY;ticketRender();window.scrollTo(0,y);toast(tr(stamped?"已同时盖章 · 加入观影护照":"已保存"));return;
  }
  ticketDraft=null;ticketMode="album";ticketRender();toast(tr(stamped?"已同时盖章 · 加入观影护照":"已收进典藏票根册"));
}

// ——— 导出 ———
function ticketExportRows(){
  const {tickets}=ticketAll(),o=ticketExportOpen||{},counts=TE.facetCounts(tickets);
  if(o.kind==="year")return TE.filterTickets(tickets,{year:o.year||counts.year[0]?.value});
  if(o.kind==="prog")return TE.filterTickets(tickets,{programme:[o.prog||counts.programme[0]?.value]});
  if(o.kind==="pick")return tickets.filter(row=>ticketPick?.has(row.key));
  return TE.filterTickets(tickets,ticketQ);
}
function ticketExportTitle(){
  const o=ticketExportOpen||{},counts=TE.facetCounts(ticketAll().tickets);
  if(o.kind==="year")return (o.year||counts.year[0]?.value)+" "+tr("年度票根墙");
  if(o.kind==="prog")return (o.prog||counts.programme[0]?.value)+tr("票根墙");
  if(o.kind==="pick")return tr("精选票根墙");
  return tr("我的典藏票根册");
}
async function ticketExport(button,single){
  const side=single?ticketDraft.side:ticketSide;
  let shown,title=tr("我的典藏票根册"),caption="",part=0,parts=1;
  if(single)shown=[{...ticketDraft.row,look:{...ticketDraft.row.look}}];
  else{
    const all=ticketExportRows();parts=Math.max(1,Math.ceil(all.length/TE.MOSAIC_MAX));part=Math.min(ticketExportOpen?.part||0,parts-1);
    shown=all.slice(part*TE.MOSAIC_MAX,(part+1)*TE.MOSAIC_MAX);title=ticketExportTitle();
    caption=[`${all.length} ${tr("张票根")}`,tr(side==="front"?"正面":"背面"),parts>1?`${part+1} / ${parts}`:""].filter(Boolean).join(" · ");
  }
  if(!shown.length)return;
  shown=shown.map(row=>({...row,artStyle:ticketStyleFor(row)}));
  button.disabled=true;const label=button.textContent;button.textContent=tr("正在生成图片");
  try{
    const small=shown.length>12;
    const [images]=await Promise.all([Promise.all(shown.map(row=>side==="front"?ticketPoster(row,small):null)),ticketFonts(shown)]);
    const layout=single?{width:TE.W*3,height:TE.H*3}:TE.wallLayout(shown.length);
    const canvas=ticketCanvas(layout.width,layout.height),ctx=canvas.getContext("2d");
    if(single)TE.draw(ctx,shown[0],side,images[0],{x:0,y:0,w:layout.width,h:layout.height},ticketCanvas);
    else TE.drawWall(ctx,shown,side,images,caption,ticketCanvas,title);
    // 密排拼图像素多，用 JPEG（底色不透明，几 MB 以内，方便发微信）；单张和 12 张以内保持 PNG
    const jpeg=!single&&shown.length>12;
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,jpeg?"image/jpeg":"image/png",.9));
    if(!blob)throw Error("image");
    const safe=(single?shown[0].title:title).replace(/[\\/:*?"<>|]/g,"-");
    if(location.hash!=="#ticket-wall")return;
    if(side==="front"&&images.some((image,i)=>!image&&shown[i].art))toast(tr("海报读取失败，已用片名代替"));
    showImageSheet(blob,{file:`${safe}-${side==="front"?"正面":"背面"}${parts>1?"-"+(part+1):""}.${jpeg?"jpg":"png"}`,head:tr("票根图片已生成"),alt:tr("票根图片")});
  }catch{toast(tr("图片生成失败，请稍后再试"));}
  finally{if(button.isConnected){button.disabled=false;button.textContent=label;}}
}

// ——— 事件 ———
function ticketInput(event){
  const t=event.target;
  if(t.id==="ticket-search")ticketSearch(t.value);
  else if(t.name==="crop"&&ticketDraft){ticketDraft.row.crop=Number(t.value);if(ticketDraft.side!=="front")ticketFlipTo("front");ticketDrawEditor();ticketArtSaveState();}
  // 边输入边更新预览（停顿 250ms 再画）
  else if(ticketDraft&&["time","venue","hall","seat","format"].includes(t.name)){ticketDraft.row[t.name]=t.value;clearTimeout(ticketSearchTimer);ticketSearchTimer=setTimeout(ticketDrawEditor,250);}
}
function ticketChange(event){
  const t=event.target,{name,value}=t;
  if(t.matches("[data-ticket-back]")){ticketSide=t.checked?"back":"front";ticketPaintList();return;}
  if(!ticketDraft)return;
  const row=ticketDraft.row;
  if(name==="show"){if(Number(value)>=0)ticketPickShow(Number(value));return;}
  if(["date","time","venue","hall","seat","format","art"].includes(name)){
    row[name]=value;
    if(name==="art")row.crop=50;
    ticketDrawEditor();ticketArtSaveState();
  }
}
function ticketClick(e){
  const filmButton=e.target.closest("[data-ticket-film-id]");
  if(filmButton){ticketBegin(filmButton.dataset.ticketFilmId);return;}
  const pend=e.target.closest("[data-ticket-pending]");
  if(pend){const item=ticketAll().pending.find(x=>x.key===pend.dataset.ticketPending);if(item)ticketOpenViewing(item);return;}
  const tile=e.target.closest("[data-key]");
  if(tile&&!tile.dataset.ticketAction){
    const row=ticketByKey.get(tile.dataset.key);if(!row)return;
    if(ticketPick){
      if(ticketPick.has(row.key))ticketPick.delete(row.key);
      else if(ticketPick.size>=TICKET_PICK_MAX){toast(tr("精选墙最多")+" "+TICKET_PICK_MAX+" "+tr("张票根"));return;}
      else ticketPick.add(row.key);
      tile.classList.toggle("picked",ticketPick.has(row.key));tile.setAttribute("aria-pressed",ticketPick.has(row.key));
      const bar=main.querySelector(".ticket-pickbar");
      if(bar){bar.querySelector("b").textContent=ticketPick.size;bar.querySelector("[data-ticket-action=pick-export]").disabled=!ticketPick.size;}
      return;
    }
    ticketOpen(row);return;
  }
  const sideBtn=e.target.closest("[data-ticket-side]");
  if(sideBtn&&ticketDraft){ticketFlipTo(sideBtn.dataset.ticketSide);return;}
  const cell=e.target.closest("[data-ticket-filter]");
  if(cell){ticketOpenFilter(cell.dataset.ticketFilter);return;}
  const facet=e.target.closest("[data-ticket-facet]");
  if(facet){const k=facet.dataset.ticketFacet,v=facet.dataset.value;ticketQ[k]=ticketQ[k].filter(x=>x!==v);ticketPaintList();return;}
  const b=e.target.closest("[data-ticket-action]");if(!b)return;
  switch(b.dataset.ticketAction){
    case "new":ticketDraft=null;ticketMode="create";ticketRender();break;
    case "pending":ticketDraft=null;ticketMode="pending";ticketPendingShown=TICKET_PENDING_STEP;ticketRender();window.scrollTo(0,0);break;
    case "pending-more":ticketPendingShown+=TICKET_PENDING_STEP;ticketRender();break;
    case "make-all":ticketMakeAll();break;
    case "cancel":ticketDraft=null;ticketMode="album";ticketRender();break;
    case "clear":TE.FACETS.forEach(k=>{ticketQ[k]=[];});ticketPaintList();break;
    case "clear-all":TE.FACETS.forEach(k=>{ticketQ[k]=[];});ticketQ.text="";ticketQ.year="";ticketPaintList();break;
    case "export-open":ticketOpenExport();break;
    case "pick-export":ticketExportOpen={kind:"pick"};ticketExport(b,false).finally(()=>{ticketExportOpen=false;});break;
    case "pick-cancel":ticketPick=null;ticketPaintList();break;
    case "flip":ticketFlipTo(ticketDraft.side==="front"?"back":"front");break;
    case "shuffle":ticketDraft.row.look=TE.randomLook(ticketDraft.row);ticketDrawEditor();break;
    case "reset":ticketDraft.row.look=TE.defaults(TE.sanitize({...ticketDraft.row,look:null}));ticketDrawEditor();break;
    case "save":ticketSave();break;
    case "save-here":ticketSave(true);break;
    case "remove":
      if(confirm(tr(ticketDraft.row.linked?"将这张票根移出收藏册？这次观影会回到「待制作」。":"将这张票根移出收藏册？"))&&ticketSet({[ticketDraft.original]:{del:1,t:Date.now()}})){
        ticketDraft=null;ticketMode="album";ticketRender();
      }break;
    case "export":ticketExport(b,false);break;
    case "single":ticketExport(b,true);break;
  }
}
function ticketFlipTo(side){
  if(!ticketDraft)return;
  const card=main.querySelector(".ticket-flip");
  if(card?.ticketTurn)card.ticketTurn.to(side);
  ticketDraft.side=side;ticketSideTabs(side);
}
function ticketSideTabs(side){
  const card=main.querySelector(".ticket-flip");if(card)card.dataset.side=side;
  main.querySelectorAll("[data-ticket-side]").forEach(b=>b.setAttribute("aria-selected",b.dataset.ticketSide===side));
}

// 场次选择：自建票根列出本片全部场次（选中后连日期一起填）；来自观影记录的票根日期固定，只列当天场次
function ticketShows(row){
  return SH.filter(s=>s.id===row.filmId).map(s=>{const v=VN[s.v],h=v?.halls?.find(x=>x.id===s.h);return {s,date:isoOf(showDate(s)),time:s.t,venue:v?.name||"",hall:h?.name||s.h||"",city:v?.city||""};})
    .filter(x=>!row.linked||x.date===row.date).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
}
function ticketShowRow(row){
  const list=ticketShows(row);if(!list.length)return "";
  const cur=list.findIndex(x=>x.date===row.date&&x.time===row.time&&x.venue===row.venue);
  const label=x=>`${x.date.slice(5).replace("-","/")} ${x.time} · ${x.venue}${x.hall?" "+x.hall:""}`;
  return `<label class="te-row"><span class="te-k">${ticketDict("场次")}</span><select class="te-in" name="show" aria-label="${ticketDict("选择场次")}">${ticketOption("-1",tr(cur<0?"自填 / 选择场次":"自填"),String(cur))}${list.map((x,i)=>ticketOption(String(i),label(x),String(cur))).join("")}</select></label>`;
}
function ticketPickShow(i){
  const row=ticketDraft.row,x=ticketShows(row)[i];if(!x)return;
  if(!row.linked)row.date=x.date;
  Object.assign(row,{time:x.time,venue:x.venue,hall:x.hall,city:x.city});
  ticketRender();
}
