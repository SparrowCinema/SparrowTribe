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
let ticketQ={text:"",year:"",film:"",programme:[],city:[],venue:[],format:[],badge:[]},ticketSide="front",ticketDraft=null,ticketMode="album";
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
  const migrated=old.length?TE.migrateV1(old,ticketViewings(),ticketBase):{};
  if(!old.length||!ticketStorePut(migrated,true))ticketStoreCache=TE.cleanStore(migrated);
  return ticketStoreCache;
}
function ticketStorePut(store,quiet){
  const clean=TE.cleanStore(store);
  // 内容没变就不算一次修改（不增加版本号，不触发同步）
  if(ticketStoreCache&&JSON.stringify(clean)===JSON.stringify(ticketStoreCache))return true;
  try{localStorage.setItem(TICKET_STORE_KEY,JSON.stringify(clean));}
  catch{if(!quiet)toast(tr("票根保存失败，请检查本机存储"));return false;}
  ticketStoreCache=clean;ticketRev++;ticketIssueSoon();return true;
}
function ticketSet(changes){const next={...ticketStore(),...changes};return ticketStorePut(next);}
// 发行序号（2026-11-22）：还没领号的票根联网后自动向 Supabase tk_issue 领「本片第几张典藏」，每次最多 50 张，一轮最多 20 次。
// 后端还没执行 backend/tickets-issue-v1.sql（404）或离线时本次打开内不再重试，票根照常显示「待发号」。
let ticketIssueTimer=0,ticketIssueBusy=false,ticketIssueOff=false;
function ticketIssueSoon(ms){if(ticketIssueOff||ticketIssueBusy)return;clearTimeout(ticketIssueTimer);ticketIssueTimer=setTimeout(ticketIssueRun,ms||2000);}
async function ticketIssueRun(){
  if(ticketIssueOff||ticketIssueBusy||typeof sbRpc!=="function"||(typeof navigator!=="undefined"&&navigator.onLine===false))return;
  ticketIssueBusy=true;
  try{
    for(let round=0;round<20;round++){
      const items=TE.pendingIssue(ticketStore(),ticketShowOf);if(!items.length)break;
      const got=await sbRpc("tk_issue",{items:items.map(x=>x.h?{s:x.s,f:x.f,h:x.h}:{s:x.s,f:x.f})});
      const changes=TE.applyIssue(ticketStore(),items,got);if(!changes)break;
      ticketStorePut({...ticketStore(),...changes},true);
    }
  }catch(e){ticketIssueOff=true;}
  finally{ticketIssueBusy=false;}
  ticketEditionRun();
}
// 封版总数（2026-11-22）：已封版影片的票根向 tk_edition 取「共发行 N 张」，写进票根 o；后端还没升级（404）时本次打开内不再请求
let ticketEditionOff=false,ticketEditionBusy=false;
async function ticketEditionRun(){
  if(ticketEditionOff||ticketEditionBusy||typeof sbRpc!=="function"||(typeof navigator!=="undefined"&&navigator.onLine===false))return;
  const items=TE.pendingEdition(ticketStore(),ticketCloseOf,now());if(!items.length)return;
  ticketEditionBusy=true;
  try{const got=await sbRpc("tk_edition",{items});const changes=TE.applyEdition(ticketStore(),got);if(changes)ticketStorePut({...ticketStore(),...changes},true);}
  catch(e){ticketEditionOff=true;}
  finally{ticketEditionBusy=false;}
  ticketAutographRun();
}
// 映后嘉宾签名（2026-11-23）：现场认证过的票根向 tk_autograph 取这一场的嘉宾签名，缓存在本机 sparrow-autograph-v1（不随档案同步）
const TICKET_AG_KEY="sparrow-autograph-v1";let ticketAgStore=null,ticketAgOff=false,ticketAgBusy=false;
function ticketAgCache(){if(!ticketAgStore){try{ticketAgStore=JSON.parse(localStorage.getItem(TICKET_AG_KEY)||"{}")||{};}catch{ticketAgStore={};}}return ticketAgStore;}
async function ticketAutographRun(){
  if(ticketAgOff||ticketAgBusy||typeof sbRpc!=="function"||(typeof navigator!=="undefined"&&navigator.onLine===false))return;
  const rows=ticketAll().tickets,items=TE.pendingAutograph(rows,ticketAgCache(),now());if(!items.length)return;
  ticketAgBusy=true;
  try{
    const got=await sbRpc("tk_autograph",{items});
    const before=JSON.stringify(Object.fromEntries(Object.entries(ticketAgCache()).map(([k,v])=>[k,v.g])));
    ticketAgStore=TE.applyAutograph(ticketAgCache(),rows,items,got,now());
    try{localStorage.setItem(TICKET_AG_KEY,JSON.stringify(ticketAgStore));}catch{}
    const after=JSON.stringify(Object.fromEntries(Object.entries(ticketAgStore).map(([k,v])=>[k,v.g])));
    if(before!==after){ticketRev++;if(location.hash==="#ticket-wall"&&!ticketDraft)ticketWallPage();}
  }catch(e){ticketAgOff=true;}
  finally{ticketAgBusy=false;}
}
// 票根关联的场次编号（场次限定「本场第几张」用）
function ticketShowOf(key){ticketAll();return ticketByKey?.get(key)?.showId||"";}
// 封版时间：这部影片全部场次散场、所属专题全部结束后 14 天（shared/tickets.js 的 editionClose）
function ticketCloseOf(filmId){
  const f=F[filmId];if(!f)return 0;
  const ends=SH.filter(s=>s.id===filmId).map(showEnd);
  const progs=filmProgsOf(f).map(({p})=>({open:!!p.ongoing,end:p.end?ymd(p.end)+864e5:0}));
  return TE.editionClose(ends,progs);
}
// 全收集金章的影片集合：影展类专题（院线、常设不参加），按专题与单元列出影片
let ticketSetsCache=null,ticketSetsSig="";
function ticketSets(){
  const sig=FILMS.length+"|"+PROGRAMMES.length;if(ticketSetsCache&&ticketSetsSig===sig)return ticketSetsCache;
  const sets={};
  for(const f of FILMS){if(f.ev)continue;for(const {p,sec} of filmProgsOf(f)){if(!p||p.ongoing||p.kind!=="影展专题")continue;
    const set=sets[p.id]||(sets[p.id]={films:[],sections:{}});if(!set.films.includes(f.id))set.films.push(f.id);
    if(sec){const list=set.sections[sec]||(set.sections[sec]=[]);if(!list.includes(f.id))list.push(f.id);}}}
  ticketSetsCache=sets;ticketSetsSig=sig;return sets;
}
// 场次标签：映后场 / 产业放映场 / 本展首映场（影展里本片最早的一场）
function ticketShowTag(f,s,p){
  if(!s)return "";
  const note=f.screeningNotes?.[keyOf(s)]||"";
  if(/映后/.test(note))return "映后场";
  if(/产业放映/.test(note))return "产业放映场";
  if(p?.kind==="影展专题"){const first=SH.filter(x=>x.id===f.id&&x.p===s.p).sort((a,b)=>showDate(a)-showDate(b))[0];if(first&&keyOf(first)===keyOf(s))return "本展首映场";}
  return "";
}

// ——— 由观影记录与片库推出票面字段 ———
function ticketArtwork(f){return filmArtwork(f);} /* 去重规则见 js/core.js 的 filmArtwork */
function ticketFromFilm(f,s,date){
  const p=PG[s?.p]||PG[f.prog],v=VN[s?.v],h=v?.halls?.find(item=>item.id===s?.h);
  return {filmId:f.id,title:f.cn,subtitle:f.o||f.en,showId:s?.sid||(s?keyOf(s):""),
    programmeId:p?.id||"",programme:p?.name||"",section:p?.sections?.[f.id]||(p?.id===f.prog?f.section:"")||"",
    date:s?isoOf(showDate(s)):date,time:s?.t||"",city:v?.city||"",venue:v?.name||"",hall:h?.name||s?.h||"",format:f.version||"",art:myPosterOf(f)||"", /* 没单独选过票面图的票根跟着「我的海报」 */
    progKind:p?.kind||"",progStart:p?.start||"",progEnd:p?.end||"",showTag:ticketShowTag(f,s,p)};
}
function ticketBase(filmId,view,date){
  const f=F[filmId];if(!f)return null;
  const s=view?watchShow(view):null,b=ticketFromFilm(f,s,date),fmt=view?.f&&window.SparrowGrowth?.FMT[view.f];
  if(fmt)b.format=fmt.zh;
  b.date=date;b.arts=ticketArtwork(f);b.director=f.dir||"";
  return b;
}
let ticketQRReady=false;
function ticketAll(){
  const nRev=typeof notesRev==="number"?notesRev:0;
  if(ticketData&&ticketDataRev===ticketRev+"|"+watchedSig()+"|"+nRev)return ticketData;
  // 不对应观影记录的票根先挪到所属影片还没有票根的观影上（每次观影一张）
  const list=ticketViewings(),moves=TE.reconcile(list,ticketStore());
  if(moves)ticketStorePut({...ticketStore(),...moves},true);
  if(!ticketQRReady&&typeof qrMatrix==="function"){TE.setQR(qrMatrix);ticketQRReady=true;}
  ticketData=TE.build(list,ticketStore(),ticketBase);TE.decorate(ticketData.tickets,ticketSets());TE.attachAutographs(ticketData.tickets,ticketAgCache());
  if(typeof privateNoteOf==="function")ticketData.tickets.forEach(row=>{const n=privateNoteOf(row.filmId);if(n&&n.tb&&n.text&&!n.locked)row.note=n.text;});
  ticketDataRev=ticketRev+"|"+watchedSig()+"|"+nRev;
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
const ticketSig=(row,side,w,style)=>[row.key,side,w,side==="front"?style:"",TE.lookSig(row.look),row.crop,row.art,row.time,row.venue,row.hall,row.seat,row.format,row.title,row.programme,row.city,TE.collectSig(row)].join("¦");
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
function ticketClearFacets(){TE.FACETS.forEach(k=>{ticketQ[k]=[];});ticketQ.badge=[];ticketQ.film="";}
// 只看某部电影（从影片页「已盖章」菜单进来）时，待制作也只算这部
function ticketPendingNow(){const {pending}=ticketAll();return ticketQ.film?pending.filter(p=>p.filmId===ticketQ.film):pending;}
// 影片页「已盖章 › 查看典藏票根」：打开票根册，只看这部电影（其他筛选和搜索清空）
let ticketFilmJump=false;
function ticketOpenFilm(id){ticketClearFacets();ticketQ.text="";ticketQ.year="";ticketQ.film=id;ticketDraft=null;ticketMode="album";ticketPick=null;ticketFilmJump=true;
  if(location.hash==="#ticket-wall"){ticketFilmJump=false;ticketWallPage();}else location.hash="#ticket-wall";}
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
  body.innerHTML=ticketHeading(true)+`<label class="fsearch ticket-find"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input type="search" id="ticket-find" autocomplete="off" value="${esc(ticketQ.text)}" placeholder="${ticketDict("搜片名、导演、影院、专题、编号")}" aria-label="${ticketDict("搜索票根")}"></label><div id="ticket-list"></div>`;
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
const ticketActiveCount=()=>TE.FACETS.reduce((n,k)=>n+ticketQ[k].length,0)+ticketQ.badge.length+(ticketQ.film?1:0);
const ticketBadgeName=k=>ticketDict((TE.BADGES.find(b=>b[0]===k)||[k,k])[1]);
const ticketFilmName=()=>{const f=ticketQ.film&&F[ticketQ.film];return f?(LANG==="en"&&f.en?f.en:f.cn):"";};
const ticketFacetLabel={programme:"专题",city:"城市",venue:"影院",format:"放映版本"};
const TICKET_DENS=[["l","大图"],["m","中图"],["s","小图"],["spine","书脊"]];
function ticketShown(){
  const {tickets}=ticketAll(),all=TE.facetCounts(tickets);
  // 删除票根后已不存在的筛选项自动去掉
  if(ticketQ.year&&!all.year.some(y=>y.value===ticketQ.year))ticketQ.year="";
  TE.FACETS.forEach(k=>{ticketQ[k]=ticketQ[k].filter(v=>all[k].some(x=>x.value===v));});
  ticketQ.badge=ticketQ.badge.filter(v=>all.badge.some(x=>x.value===v));
  return {tickets,all,shown:TE.filterTickets(tickets,ticketQ)};
}
function ticketPaintList(){
  const box=main.querySelector("#ticket-list");if(!box)return;
  const {tickets}=ticketAll(),pending=ticketPendingNow(),{shown}=ticketShown(),groups=TE.groupByMonth(shown),n=ticketActiveCount();
  const filterValue=n?(LANG==="en"?n+" selected":`已选 ${n} 项`):tr("全部");
  const cells=[["filter","筛选",filterValue,!!n],["year","年份",ticketQ.year||tr("全部年份"),!!ticketQ.year],["density","显示",tr(TICKET_DENS.find(x=>x[0]===ticketDensity)[1]),false],["art-style","手绘风格",tr(TicketArt.styles.find(style=>style.id===ticketArtStyle).label),false]];
  const count=shown.length===tickets.length?`${tickets.length} ${tr("张票根")}`:`${shown.length} / ${tickets.length} ${tr("张票根")}`;
  box.innerHTML=`<div class="schedule-filterbar poster-wall-filterbar ticket-style-filterbar" aria-label="${ticketDict("票根筛选")}">${cells.map(([key,label,value,active])=>`<button type="button" class="schedule-filter${active?" active":""}" data-ticket-filter="${key}" aria-haspopup="dialog" aria-label="${esc(tr(label)+"："+value)}"><span><small>${ticketDict(label)}</small><b>${esc(value)}</b></span>${filterChevron}</button>`).join("")}</div>
    <div class="pw-actions"><p class="pw-hint pw-count" role="status">${esc(count)}${LANG==="en"?", ":"，"}${ticketDict("按观影日期排列")}</p>
      <label class="pw-score-toggle"><input type="checkbox" data-ticket-back${ticketSide==="back"?" checked":""}>${ticketDict("看背面")}</label>
      <button type="button" class="secondary-button ticket-export-btn" data-ticket-action="export-open"${shown.length?"":" disabled"}>${ticketDict("导出票根墙")}</button></div>
    ${pending.length?`<div class="ticket-todo"><span><b>${pending.length}</b> ${ticketDict("部电影还没做成票根")}</span><span><button type="button" class="text-button" data-ticket-action="make-all">${ticketDict("一键生成")}</button><i aria-hidden="true">·</i><button type="button" class="text-button" data-ticket-action="pending">${ticketDict("逐张挑选")} ›</button></span></div>`:""}
    ${n?`<div class="ticket-chips">${ticketQ.film?`<button type="button" data-ticket-facet="film" data-value="${esc(ticketQ.film)}" aria-label="${ticketDict("移除筛选")}">《${esc(ticketFilmName())}》 ×</button>`:""}${TE.FACETS.flatMap(k=>ticketQ[k].map(v=>`<button type="button" data-ticket-facet="${k}" data-value="${esc(v)}" aria-label="${ticketDict("移除筛选")} ${esc(v)}">${esc(v)} ×</button>`)).join("")}${ticketQ.badge.map(v=>`<button type="button" data-ticket-facet="badge" data-value="${esc(v)}" aria-label="${ticketDict("移除筛选")} ${esc(ticketBadgeName(v))}">${esc(ticketBadgeName(v))} ×</button>`).join("")}<button type="button" class="text-button" data-ticket-action="clear">${ticketDict("清除筛选")}</button></div>`:""}
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
  const badge=counts.badge.length?`<div class="ticket-facet"><h3>${ticketDict("典藏")}</h3><div>${counts.badge.map(x=>`<button type="button" data-ticket-facet="badge" data-value="${x.value}" aria-pressed="${ticketQ.badge.includes(x.value)}">${esc(ticketDict(x.label))} <small>${x.count}</small></button>`).join("")}</div></div>`:"";
  return groups.length||badge?groups.map(k=>`<div class="ticket-facet"><h3>${ticketDict(ticketFacetLabel[k])}</h3><div>${counts[k].slice(0,k==="programme"?80:40).map(x=>`<button type="button" data-ticket-facet="${k}" data-value="${esc(x.value)}" aria-pressed="${ticketQ[k].includes(x.value)}">${esc(x.value)} <small>${x.count}</small></button>`).join("")}</div></div>`).join("")+badge:`<p class="selector-empty">${ticketDict("票根还不多，暂时没有可筛选的项目")}</p>`;
}
function ticketFilterRefresh(d){
  const box=d.querySelector(".selector-results"),top=box.scrollTop;box.innerHTML=ticketFilterBody();box.scrollTop=top;
  d.querySelector(".selector-done").textContent=tr("显示")+" "+ticketShown().shown.length+" "+tr("张票根");
}
function ticketOpenFilter(kind){
  if(kind==="art-pick"&&ticketDraft){
    const row=ticketDraft.row,assets=[...(row.arts||[])];
    const rows=assets.map((a,i)=>`<button type="button" class="selector-option te-art-opt" role="option" aria-selected="${a===row.art}" data-ticket-art-pick="${esc(a)}"><img src="${esc(i===0?ticketThumb({art:a,filmId:row.filmId}):a)}" alt="" loading="lazy"><span><b>${esc(artLabelText(filmArtLabel(F[row.filmId],a)||("海报 "+(i+1))))}</b></span><span class="selector-check" aria-hidden="true">${a===row.art?"✓":""}</span></button>`).join("");
    ticketDialog("art-pick",ticketDict("票面图像"),`<div class="selector-results" role="listbox">${rows}</div>${assets.length<2?`<p class="selector-empty te-art-note">${ticketDict("这部影片暂时只有这一张图像，补充备用海报或剧照后可以在这里更换")}</p>`:""}`);
    return;
  }
  if(kind==="art-style"){
    const options=ticketDraft?TicketArt.filmStyleOptions:TicketArt.styles;
    const selected=ticketDraft?ticketFilmStyles.get(ticketDraft.row.filmId)||"":ticketArtStyle;
    ticketDialog("art-style",ticketDict("手绘风格"),`<div class="selector-results" role="listbox">${options.map(({id,label})=>ticketOptionRow("data-ticket-art-style",id,tr(label),"",selected===id)).join("")}</div>`);
    return;
  }
  const {tickets,all}=ticketShown();
  if(kind==="filter"){
    const d=ticketDialog("filter",ticketDict("筛选票根"),`<div class="selector-results ticket-facet-box"></div>`,
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
  if(act==="clear"){ticketClearFacets();ticketPaintList();ticketFilterRefresh(d);return;}
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
  const pick=t.closest("[data-ticket-art-pick]");
  if(pick&&kind==="art-pick"&&ticketDraft){
    const row=ticketDraft.row,v=pick.dataset.ticketArtPick;d.close();
    if(v===row.art)return;
    row.art=v;row.crop=50;const c=main.querySelector('.te-range[name="crop"]');if(c)c.value=50;
    ticketFlipTo("front");ticketDrawEditor();ticketArtSaveState();return;
  }
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
    <p>${ticketDict("每一次观影一张票根，重看同一部电影会多开一个盲盒。一键生成会把待制作的观影全部开成盲盒票根。")}</p>
    ${pending.length?`<button type="button" class="primary-button" data-ticket-action="make-all">${ticketDict("一键生成全部")} ${pending.length} ${ticketDict("张票根")}</button>`:`<p>${ticketDict("所有观影都已经做成票根了。")}</p>`}
    <ul>${rows.map(line).join("")}</ul>
    ${pending.length>rows.length?`<button type="button" class="ticket-alt" data-ticket-action="pending-more">${ticketDict("显示更多")}（${pending.length-rows.length}）</button>`:""}</div>`;
}
function ticketMakeAll(){
  const pending=ticketPendingNow();if(!pending.length)return;
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
// 打开某次观影的票根：已收藏就编辑，没做过就新建（盲盒款式由票根键决定，按搭配规则抽，见 shared/tickets.js）
function ticketOpenViewing(item){
  const existing=ticketAll().tickets.find(row=>row.key===item.key);
  if(existing){ticketOpen(existing);return;}
  const row=TE.build([item],{[item.key]:{t:Date.now()}},ticketBase).tickets[0];if(!row)return;
  ticketDraft={row,original:"",side:"front",view:item.view};ticketShowDraft();
}
function ticketBegin(id){
  const f=F[id];if(!f)return;
  const mine=ticketViewings().filter(item=>item.filmId===id).sort((a,b)=>b.view.d.localeCompare(a.view.d));
  // 每次观影一张：打开最近一次观影的票根（没做过就新建）
  const item=mine[0];
  if(item){ticketOpenViewing(item);return;}
  // 没有观影记录：先找这部电影以前做过、现在没对上观影记录的票根（比如移出过护照），接着编辑它
  const store=ticketStore(),old=Object.keys(store).filter(k=>k.startsWith(id+"|")&&!store[k].del&&TE.parseKey(k)).sort((x,y)=>(store[y].t||0)-(store[x].t||0))[0];
  if(old){const row=TE.draft(old,store[old],ticketBase);if(row){ticketDraft={row,original:old,side:"front",view:null};ticketShowDraft();return;}}
  // 都没有：手工票根，日期默认今天，可改；保存时同时盖章
  const date=isoOf(new Date(now())),key=ticketFreeKey(id,date);
  const row=TE.draft(key,{t:Date.now()},ticketBase);if(!row)return;
  ticketDraft={row,original:"",side:"front",view:null};ticketShowDraft();
}
function ticketFreeKey(filmId,date,except){
  const store=ticketStore(),linked=new Set(ticketViewings().map(item=>item.key));
  for(let n=1;n<10;n++){const key=TE.ticketKey(filmId,date,n);if(key===except||(!linked.has(key)&&(!store[key]||store[key].del)))return key;}
  return "";
}
function ticketOpen(row){
  const item=row.linked?ticketViewings().find(x=>x.key===row.key):null;
  ticketDraft={row:{...row,look:{...row.look}},original:row.key,side:ticketSide,view:item?.view||null};ticketShowDraft();
}
// 从收藏册打开单张票根前记下滚动位置，保存 / 取消 / 移出后回到原来的位置（不再回到顶部）
let ticketAlbumY=0;
function ticketShowDraft(){
  if(!document.querySelector(".te-body"))ticketAlbumY=ticketMode==="album"?window.scrollY:0;
  ticketPrepareReveal();ticketRender();window.scrollTo(0,0);
}
function ticketBackToAlbum(){
  ticketDraft=null;ticketMode="album";ticketRender();
  const y=ticketAlbumY;window.scrollTo(0,y);requestAnimationFrame(()=>window.scrollTo(0,y)); // 第二次等布局（图片占位）稳定后再校正
}
// ——— 拆盲盒（2026-11-22）———
// 每张票根第一次在本机打开时：先亮背面，停一下再自动翻到正面，工艺层整片流过一遍光（不再显示工艺文字）。
// 已拆过的票根键记在本机（不同步，换设备会再拆一次），最多记 6000 张。
const TICKET_REVEALED="sparrow-ticket-revealed";
function ticketRevealedSet(){try{return JSON.parse(localStorage.getItem(TICKET_REVEALED)||"{}")||{};}catch{return {};}}
function ticketPrepareReveal(){
  const key=ticketDraft?.row?.key;if(!key||ticketRevealedSet()[key])return;
  ticketDraft.reveal="pending";ticketDraft.side="back";
}
function ticketMarkRevealed(key){
  const set=ticketRevealedSet();set[key]=1;const keys=Object.keys(set);
  if(keys.length>6000)keys.slice(0,keys.length-6000).forEach(k=>delete set[k]);
  try{localStorage.setItem(TICKET_REVEALED,JSON.stringify(set));}catch{}
}
function ticketRunReveal(card){
  if(ticketDraft?.reveal!=="pending")return;
  const draft=ticketDraft;draft.reveal="running";
  setTimeout(()=>{
    if(ticketDraft!==draft)return;
    card.classList.add("reveal");ticketFlipTo("front");
    if(draft.row.hidden)setTimeout(()=>{if(ticketDraft===draft)toast(tr("开出隐藏款 · 1/1 孤品"));},900);
    setTimeout(()=>{if(ticketDraft===draft){draft.reveal="done";card.classList.remove("reveal");}ticketMarkRevealed(draft.row.key);},2000);
  },750);
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
        <button type="button" class="te-art-save" data-ticket-action="save-here" ${ticketArtDirty()?"":"disabled"}>${ticketDict("保存")}</button></div>`:""}
      <div class="te-tools">${/* 正面 / 背面：轻点票根翻面、拖动 360° 转动已经够用，这里换成票面图像（2026-11-23） */""}
        ${assets.length?`<button type="button" class="te-style" data-ticket-filter="art-pick" aria-haspopup="dialog"><svg class="te-brush" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2.5" width="12" height="11" rx="1.6"/><circle cx="6" cy="6.4" r="1.3"/><path d="m2.6 12.4 3.6-3.6 2.6 2.4 1.8-1.6 2.9 2.7"/></svg>${ticketDict("票面图像")}<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 4.5 3 3 3-3"/></svg></button>`:""}
        <button type="button" class="te-style" data-ticket-filter="art-style" aria-haspopup="dialog"><svg class="te-brush" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 2.5 7 9"/><path d="M7 9c-1.6-.4-3 .6-3.2 2.2-.1 1-.6 1.7-1.3 2.1 2.6.6 5.4-.4 5.4-3"/></svg>${ticketDict("手绘风格")}${filterChevron}</button></div>
      <button type="button" class="te-reset" data-ticket-action="reset" hidden>${ticketDict("恢复盲盒款")}</button></div>
    <div class="te-body">
      <div class="te-heading">
        <div class="te-title"><h3>${esc(row.title)}</h3>${row.programme?`<small>${esc(row.programme)}</small>`:""}</div>
        <div class="te-actions">
          <button type="button" class="te-action te-action-export" data-ticket-action="single" aria-label="${ticketDict("导出这张票根")}">${ticketDict("导出")}</button>
          ${ticketDraft.original?`<button type="button" class="te-action te-action-remove" data-ticket-action="remove">${ticketDict("移出收藏册")}</button>`:""}
        </div>
      </div>
      <div class="te-sec-row"><h4 class="te-sec">${ticketDict("放映信息")}</h4><button type="button" class="te-ocr-btn" data-ticket-action="ocr-scan"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h3l2-2h6l2 2h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="3.5"/></svg><span>${ticketDict("拍照识票")}</span></button><input type="file" id="te-ocr-file" accept="image/*" hidden></div>
      <div id="te-ocr-status" class="te-ocr-status" role="status" hidden></div>
      <div class="te-card">${ticketShowRow(row)}${dateRow}${input("time","开场时间","","time")}${input("venue","影院","影院名称")}${input("hall","影厅","如 1号厅")}${input("seat","座位","选填，如 5排8座")}${input("format","放映版本","如 4K修复")}</div>
      <div class="te-acts"><button type="button" class="te-save" data-ticket-action="save">${ticketDict(ticketDraft.original?"保存修改":"加入收藏册")}</button></div>
    </div></div>`;
}
function ticketEditorMount(){
  ticketDrawEditor();
  const card=main.querySelector(".ticket-flip");if(!card)return;
  card.ticketTurn=ticketTurner(card);
  ticketRunReveal(card);
}
// 360° 转动（与小程序 packages/collect/ticket-edit/turn.wxs 同一套规则，改这里记得同步那边）：
// 左右随便转；上下最多倾斜 65°；松手按甩动速度带一点惯性，再慢慢转回最近的正面或背面；轻点翻面（走原来的 flip 动作）。
// 高光跟着角度走：正对时不亮，越斜反光越往一边移；只在拖动时出现，停下淡出。
// 触屏上手指在票根上滑动只转票根（CSS touch-action:none），页面不跟着滚；拖动过的那次松手不算点击。
// 各种工艺的反光层位置与强度（背景图在 styles/tickets.css 的 .ticket-flip[data-fx=…] .ticket-fx）
function ticketFxStyle(fx,s,t,lit){
  const p=v=>`${Math.round(v)}%`,o=lit?Math.min(1,Math.abs(s)*3+Math.abs(t)*2):0;
  const table={
    holo:[`${p(50+s*60)} ${p(50+t*60)}`,.6],
    cast:[`${p(50-s*45)} ${p(50-t*45)}, ${p(50+s*60)} ${p(50+t*60)}`,.75],
    crystal:[`${p(50+s*70)} ${p(50+t*50)}, ${p(50-s*60)} 0%`,.75],
    sweep:[`${p(50-s*60)} 0%`,.9],
    glitter:[`${p(50-s*60)} 0%, ${p(50+s*50)} 0%`,.95],
    gloss:[`${p(50-s*90)} ${p(50+t*90)}`,.75],
    sense:[`${p(50-s*90)} ${p(50+t*90)}, ${p(50-s*60)} 0%`,.9],
    // 海报 / 背面的隐形工艺：静止时完全看不见，转动时浮现；2026-11-22 再调强并改用 hard-light（亮处、暗处都看得出）
    "a-gloss":[`${p(50-s*90)} ${p(50+t*90)}`,.78],
    "a-rim":[`${p(50-s*90)} ${p(50+t*90)}`,.85],
    "a-holo":[`${p(50+s*60)} ${p(50+t*60)}`,.62],
    "a-pearl":[`${p(50+s*70)} ${p(50+t*70)}`,.7],
    "a-guilloche":[`${p(50-s*60)} 0%`,.8],
    "a-matte":[`${p(50-s*90)} ${p(50+t*90)}`,.72],
    "a-rainbow":[`${p(50+s*80)} ${p(50+t*80)}`,.55],
    "a-cateye":[`${p(50-s*110)} 0%`,.85]
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
  const reset=main.querySelector(".te-reset");if(reset)reset.hidden=TE.lookSig(ticketDraft.row.look)===TE.lookSig(TE.sanitize({...ticketDraft.row,look:null}).look);
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
// 工艺反光层（只在详情页用）：每面最多三层——底箔的反光、工艺组合里的烫印增效、隐形底纹（正面在海报上，背面铺满背面）。
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
  if(side==="back"){const back=TE.backMask(row,ticketCanvas,w);if(back)layers.push({fx:back.fx,k:1,url:`url(${back.toDataURL("image/png")})`});}
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
  // 和护照同步：给还没盖章的电影做票根，同时在护照里盖章（观影日期＝票根日期）
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
  const entry=base?TE.entryFrom({...row,id:key},{...base,id:key}):{t:Date.now(),...(TE.serialValid(row.serial)?{n:row.serial}:{})};
  const changes={[key]:entry};
  if(d.original&&d.original!==key)changes[d.original]={del:1,t:Date.now()};
  if(!ticketSet(changes))return;
  if(stay){
    d.original=key;d.row.key=key;d.artSig=ticketArtSig(d.row);
    const y=window.scrollY;ticketRender();window.scrollTo(0,y);toast(tr(stamped?"已同时盖章 · 加入观影护照":"已保存"));return;
  }
  ticketBackToAlbum();toast(tr(stamped?"已同时盖章 · 加入观影护照":"已收进典藏票根册"));
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
async function ticketExport(button,single,mode){
  const both=single&&mode==="both",side=single?(mode==="front"||mode==="back"?mode:ticketDraft.side):ticketSide;
  // 背面和合成图带发行序号：还没领到号的已收藏票根，先领一次再导出
  if(single&&mode!=="front"&&ticketDraft.original&&!ticketDraft.row.issue){
    try{await ticketIssueRun();}catch{}
    const q=ticketStore()[ticketDraft.original]?.q;if(q)ticketDraft.row.issue=q;
  }
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
    const [images]=await Promise.all([Promise.all(shown.map(row=>side==="front"||both?ticketPoster(row,small):null)),ticketFonts(shown)]);
    const layout=both?{width:TE.SHOW_W,height:TE.SHOW_H}:single?{width:TE.W*3,height:TE.H*3}:TE.wallLayout(shown.length);
    const canvas=ticketCanvas(layout.width,layout.height),ctx=canvas.getContext("2d");
    if(both)TE.drawShowcase(ctx,shown[0],images[0],ticketCanvas);
    else if(single){const rect={x:0,y:0,w:layout.width,h:layout.height};TE.draw(ctx,shown[0],side,images[0],rect,ticketCanvas);TE.bakeSheen(ctx,shown[0],side,rect,ticketCanvas,side==="front"&&!!images[0]);}
    else TE.drawWall(ctx,shown,side,images,caption,ticketCanvas,title);
    // 密排拼图像素多，用 JPEG（底色不透明，几 MB 以内，方便发微信）；单张和 12 张以内保持 PNG
    const jpeg=both||(!single&&shown.length>12);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,jpeg?"image/jpeg":"image/png",.9));
    if(!blob)throw Error("image");
    const safe=(single?shown[0].title:title).replace(/[\\/:*?"<>|]/g,"-");
    if(location.hash!=="#ticket-wall")return;
    if((side==="front"||both)&&images.some((image,i)=>!image&&shown[i].art))toast(tr("海报读取失败，已用片名代替"));
    showImageSheet(blob,{file:`${safe}-${both?"正反面":side==="front"?"正面":"背面"}${parts>1?"-"+(part+1):""}.${jpeg?"jpg":"png"}`,head:tr("票根图片已生成"),alt:tr("票根图片"),
      // 一键导出合成图；需要单面的在保存菜单里顺手再导（2026-11-22）
      extra:both?[{label:tr("也导出正面"),run:()=>ticketExport(button,true,"front")},{label:tr("也导出背面"),run:()=>ticketExport(button,true,"back")}]:null});
  }catch{toast(tr("图片生成失败，请稍后再试"));}
  finally{if(button.isConnected){button.disabled=false;button.textContent=label;}}
}

// ——— 事件 ———
function ticketInput(event){
  const t=event.target;
  if(t.id==="ticket-find"){clearTimeout(ticketSearchTimer);ticketSearchTimer=setTimeout(()=>{ticketQ.text=t.value;ticketPaintList();},160);return;}
  if(t.id==="ticket-search")ticketSearch(t.value);
  else if(t.name==="crop"&&ticketDraft){ticketDraft.row.crop=Number(t.value);if(ticketDraft.side!=="front")ticketFlipTo("front");ticketDrawEditor();ticketArtSaveState();}
  // 边输入边更新预览（停顿 250ms 再画）
  else if(ticketDraft&&["time","venue","hall","seat","format"].includes(t.name)){ticketDraft.row[t.name]=t.value;clearTimeout(ticketSearchTimer);ticketSearchTimer=setTimeout(ticketDrawEditor,250);}
}
function ticketChange(event){
  const t=event.target,{name,value}=t;
  if(t.id==="te-ocr-file"){const f=t.files&&t.files[0];t.value="";if(f)ticketRunOcr(f);return;}
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
/* ===== 拍照识票 OCR（2026-11-24）：自托管 Tesseract.js + 中英文轻量模型，仅在点击时按需加载，图片不出手机 ===== */
let ticketOcrWorkerP=null,ticketOcrBusy=false;
function ticketOcrStatus(html,cls){
  const el=main.querySelector("#te-ocr-status");if(!el)return;
  el.hidden=!html;el.className="te-ocr-status"+(cls?" "+cls:"");el.innerHTML=html||"";
}
function ticketLoadOcrScript(){
  if(window.Tesseract)return Promise.resolve(window.Tesseract);
  return new Promise((ok,bad)=>{
    const s=document.createElement("script");
    s.src=new URL("vendor/ocr/tesseract.min.js",document.baseURI).href;
    s.onload=()=>window.Tesseract?ok(window.Tesseract):bad(new Error("no_tesseract"));
    s.onerror=()=>bad(new Error("script_load_failed"));
    document.head.appendChild(s);
  });
}
async function ticketGetOcrWorker(onProgress){
  if(!ticketOcrWorkerP){
    ticketOcrWorkerP=(async()=>{
      const T=await ticketLoadOcrScript();
      const base=new URL("vendor/ocr/",document.baseURI).href;
      return await T.createWorker("chi_sim+eng",1,{
        workerPath:base+"worker.min.js",
        corePath:base+"tesseract-core-lstm.wasm.js",
        langPath:base+"lang",
        workerBlobURL:false,
        logger:m=>{if(onProgress&&m&&m.status==="recognizing text"&&typeof m.progress==="number")onProgress(Math.round(m.progress*100));}
      });
    })().catch(err=>{ticketOcrWorkerP=null;throw err;});
  }
  return ticketOcrWorkerP;
}
async function ticketRunOcr(file){
  if(!ticketDraft||ticketOcrBusy)return;
  const OCR=window.SparrowTicketOcr;if(!OCR)return;
  ticketOcrBusy=true;
  const btn=main.querySelector('[data-ticket-action="ocr-scan"]');
  if(btn)btn.disabled=true;
  ticketOcrStatus(esc(tr("正在本地加载中英文识票模型（约 7MB，首次稍候，图片不出手机）…")));
  try{
    const imgUrl=URL.createObjectURL(file);
    let cv;
    try{
      const im=await new Promise((ok,bad)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=bad;i.src=imgUrl;});
      cv=OCR.preprocessImage(im);
    }finally{URL.revokeObjectURL(imgUrl);}
    let lastPct=-1;
    const worker=await ticketGetOcrWorker(pct=>{
      if(pct!==lastPct){lastPct=pct;ticketOcrStatus(esc(tr("正在识别票面文字…"))+" "+pct+"%");}
    });
    ticketOcrStatus(esc(tr("正在识别票面文字…")));
    const res=await worker.recognize(cv);
    const raw=(res&&res.data&&res.data.text)||"";
    const row=ticketDraft.row;
    const parsed=OCR.parseTicketText(raw,{
      venues:Object.values(VN),
      shows:ticketShows(row),
      defaultYear:Number((row.date||"").slice(0,4))||new Date().getFullYear()
    });
    const labels={date:tr("日期"),time:tr("时间"),venue:tr("影院"),hall:tr("影厅"),seat:tr("座位"),format:tr("版本")};
    const filled=[];
    ["date","time","venue","hall","seat","format"].forEach(k=>{
      if(!parsed[k])return;
      if(k==="date"&&row.linked)return;
      row[k]=parsed[k];
      filled.push(labels[k]);
      const inp=main.querySelector(`.te-card [name="${k}"]`);
      if(inp)inp.value=parsed[k];
    });
    if(parsed.matchedShow&&parsed.matchedShow.city)row.city=parsed.matchedShow.city;
    if(filled.length){
      ticketDrawEditor();
      ticketArtSaveState();
      const rawNote=raw.trim()?`<details><summary>${esc(tr("查看识别原文"))}</summary><pre>${esc(raw.trim())}</pre></details>`:"";
      ticketOcrStatus(esc(tr("已自动填入：")+filled.join(LANG==="en"?", ":"、")+tr("（可继续核对修改）"))+rawNote,"ok");
      toast(tr("已识别并填入")+" "+filled.join(LANG==="en"?", ":"、"));
    }else{
      const rawNote=raw.trim()?`<details><summary>${esc(tr("查看识别原文"))}</summary><pre>${esc(raw.trim())}</pre></details>`:"";
      ticketOcrStatus(esc(tr("未能从图片中提取到场次或座位信息，请直接在下方手动填写。"))+rawNote,"warn");
    }
  }catch(err){
    console.warn("ticket ocr failed",err);
    ticketOcrStatus(esc(tr("识票未能完成，请检查网络后重试，或直接在下方手动填写。")),"warn");
  }finally{
    ticketOcrBusy=false;
    const b2=main.querySelector('[data-ticket-action="ocr-scan"]');
    if(b2)b2.disabled=false;
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
  if(facet){const k=facet.dataset.ticketFacet,v=facet.dataset.value;if(k==="film")ticketQ.film="";else ticketQ[k]=ticketQ[k].filter(x=>x!==v);ticketPaintList();return;}
  const b=e.target.closest("[data-ticket-action]");if(!b)return;
  switch(b.dataset.ticketAction){
    case "new":ticketDraft=null;ticketMode="create";ticketRender();break;
    case "pending":ticketDraft=null;ticketMode="pending";ticketPendingShown=TICKET_PENDING_STEP;ticketRender();window.scrollTo(0,0);break;
    case "pending-more":ticketPendingShown+=TICKET_PENDING_STEP;ticketRender();break;
    case "make-all":ticketMakeAll();break;
    case "cancel":ticketBackToAlbum();break;
    case "clear":ticketClearFacets();ticketPaintList();break;
    case "clear-all":ticketClearFacets();ticketQ.text="";ticketQ.year="";{const q=main.querySelector("#ticket-find");if(q)q.value="";}ticketPaintList();break;
    case "export-open":ticketOpenExport();break;
    case "pick-export":ticketExportOpen={kind:"pick"};ticketExport(b,false).finally(()=>{ticketExportOpen=false;});break;
    case "pick-cancel":ticketPick=null;ticketPaintList();break;
    case "flip":ticketFlipTo(ticketDraft.side==="front"?"back":"front");break;
    case "reset":ticketDraft.row.look=TE.sanitize({...ticketDraft.row,look:null}).look;ticketDrawEditor();break;
    case "ocr-scan":{const f=main.querySelector("#te-ocr-file");if(f&&!ticketOcrBusy)f.click();break;}
    case "save":ticketSave();break;
    case "save-here":ticketSave(true);break;
    case "remove":
      if(confirm(tr(ticketDraft.row.linked?"将这张票根移出收藏册？这次观影会回到「待制作」。":"将这张票根移出收藏册？"))&&ticketSet({[ticketDraft.original]:{del:1,t:Date.now()}})){
        ticketBackToAlbum();
      }break;
    case "export":ticketExport(b,false);break;
    case "single":ticketExport(b,true,"both");break;
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
  return SH.filter(s=>s.id===row.filmId).map(s=>{const v=VN[s.v],h=v?.halls?.find(x=>x.id===s.h);return {s,date:showIso(s),time:s.t,venue:v?.name||"",hall:h?.name||s.h||"",city:v?.city||""};})
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

// ——— 典藏验真页（2026-11-22）：票根背面二维码打开 #verify=典藏编号 ———
// 向 tk_verify 查发行记录（影片、序号、场次、发行时间）；不需要登录，不显示任何个人信息。
function verifyCode(raw){
  let c=String(raw||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
  if(c.length>15&&/^SP\d{2}/.test(c))c=c.slice(4);
  return c;
}
async function verifyPage(raw){
  const code=verifyCode(decodeURIComponent(raw||"")),head='<section class="view gut vf-view">'+subBackHTML()+'<div class="page-heading"><div><small>CERTIFICATE · VERIFY</small><h2 class="sec">'+tr("典藏验真")+'</h2></div></div>';
  const box=(cls,html)=>{if(location.hash.slice(1)!=="verify="+raw)return;main.innerHTML=head+'<div class="vf-card '+cls+'">'+html+'</div></section>';};
  if(!TE.serialValid(code)){box("vf-bad",'<b>'+tr("编号格式不正确")+'</b><p>'+tr("典藏编号是 SP 加年份后的 15 位字母与数字，请核对票根背面的编号。")+'</p>');return;}
  box("vf-wait",'<p>'+tr("正在查询发行记录…")+'</p>');
  let r=null;
  try{r=await sbRpc("tk_verify",{s:code});}catch(e){box("vf-bad",'<b>'+tr("暂时无法验证")+'</b><p>'+tr("网络或服务暂时不可用，请稍后再试。")+'</p>');return;}
  const pretty=code.match(/.{5}/g).join("-");
  if(!r||!r.no){box("vf-bad",'<b>'+tr("没有查到这串编号")+'</b><p>'+esc(pretty)+'</p><p>'+tr("可能是票根还没联网领取发行序号，或编号有误。")+'</p>');return;}
  const f=F[r.f],s=r.h?SH.find(x=>x.sid===r.h||keyOf(x)===r.h):null,v=s&&VN[s.v],hall=s&&v?.halls?.find(h=>h.id===s.h);
  // 已封版时补上总数
  let total=-1;const close=ticketCloseOf(r.f);
  if(close&&close<=now()){try{const t=await sbRpc("tk_edition",{items:[{f:r.f,c:new Date(close).toISOString()}]});if(Array.isArray(t)&&t[0]&&Number.isInteger(t[0].total))total=t[0].total;}catch(e){}}
  const ed=TE.editionLines({issue:r.no,edition:total,showNo:s?r.sno:0,showTag:""});
  const at=new Date(r.at),when=isNaN(at)?"":at.getFullYear()+"."+String(at.getMonth()+1).padStart(2,"0")+"."+String(at.getDate()).padStart(2,"0");
  const mine=Object.entries(ticketStore()).find(([k,e])=>e&&!e.del&&TE.entrySerial(k,e)===code);
  // 现场认证过的票根：带上这一场的映后嘉宾签名
  let guests=[];if(r.ci){try{const a=await sbRpc("tk_autograph",{items:[code]});guests=(Array.isArray(a)&&a[0]&&Array.isArray(a[0].g))?a[0].g:[];}catch(e){}}
  const rows=[[tr("影片"),f?esc(f.cn):esc(r.f)],[tr("发行序号"),esc(ed.no+ed.total)],["",esc(ed.line1)]];
  if(s)rows.push([tr("场次"),esc([s.d.replace("/","月")+"日",s.t,v?.city,v?.name,hall?.name].filter(Boolean).join(" · "))],["",esc(ed.line2||"")]);
  if(r.ci){const c=new Date(r.ci);if(!isNaN(c))rows.push([tr("现场认证"),esc("✓ "+c.getFullYear()+"."+String(c.getMonth()+1).padStart(2,"0")+"."+String(c.getDate()).padStart(2,"0")+" "+String(c.getHours()).padStart(2,"0")+":"+String(c.getMinutes()).padStart(2,"0")+" "+tr("在放映现场签到"))]);}
  rows.push([tr("典藏编号"),'<span class="vf-mono">'+esc(pretty)+'</span>'],[tr("发行时间"),esc(when)]);
  box("vf-ok",'<div class="vf-top">'+(f?pimg(f.id,360,'class="vf-poster" alt=""'):'')+'<div><span class="vf-seal">✓ '+tr("已验证 · 真实发行")+'</span><h3>'+(f?esc(f.cn):esc(r.f))+'</h3><p>'+tr("这张典藏票根由麻雀观影护照统一发行，编号与发行记录一致。")+'</p></div></div>'+
    '<dl class="vf-dl">'+rows.filter(x=>x[1]).map(([k,v])=>'<dt>'+k+'</dt><dd>'+v+'</dd>').join("")+'</dl>'+
    (guests.length?'<div class="vf-ag"><small>'+tr("映后嘉宾签名")+'</small><div class="ci-ag-list">'+guests.map((g,i)=>'<div class="ci-ag-item"><canvas width="300" height="150" data-vf-ag="'+i+'"></canvas><span>'+esc((g.role?g.role+" ":"")+g.name)+'</span></div>').join("")+'</div></div>':'')+
    (mine?'<button class="primary-button vf-go" data-tab="ticket-wall">'+tr("这是你的典藏票根 · 打开票根册")+'</button>':f?'<button class="secondary-button vf-go" data-film="'+esc(f.id)+'">'+tr("查看影片")+'</button>':''));
  document.querySelectorAll("canvas[data-vf-ag]").forEach(c=>{const g=guests[+c.dataset.vfAg];if(g)agDraw(c.getContext("2d"),g.st,300,150);});
}

// ——— 现场认证（2026-11-22）———
// 观众：扫放映现场的签到码打开 #checkin=影片~场次~时间窗~签到码 → 一键盖章、做票根、发号并记下现场认证。
// 主办方：隐藏页 #checkin-host，输入主办密钥、选场次，全屏显示每分钟刷新的签到码（签名在服务器，backend/tickets-checkin-v1.sql）。
function checkinShowLine(s){const v=VN[s.v],h=v?.halls?.find(x=>x.id===s.h);return [showIso(s).slice(5).replace("-","/")+" "+s.t,v?vShort(v):"",h?.name||""].filter(Boolean).join(" · ");}
function checkinHead(){return '<section class="view gut vf-view">'+subBackHTML()+'<div class="page-heading"><div><small>CHECK-IN · ON SITE</small><h2 class="sec">'+tr("现场认证")+'</h2></div></div>';}
async function checkinPage(raw){
  const c=TE.checkinParse("#checkin="+raw),hash=location.hash;
  const box=(cls,html)=>{if(location.hash!==hash)return;main.innerHTML=checkinHead()+'<div class="vf-card '+cls+'">'+html+'</div></section>';};
  if(!c){box("vf-bad",'<b>'+tr("签到码无效")+'</b><p>'+tr("请扫描放映现场屏幕上的签到码。")+'</p>');return;}
  const f=F[c.f],s=SH.find(x=>x.id===c.f&&(x.sid===c.h||keyOf(x)===c.h));
  if(!f||!s){box("vf-bad",'<b>'+tr("找不到这场放映")+'</b><p>'+tr("排片可能刚更新，请稍后刷新再试。")+'</p>');return;}
  const date=showIso(s),plan=TE.checkinPlan(watched[f.id],window.SparrowGrowth,f.id,date,keyOf(s));
  const done=ticketStore()[plan.key]?.ci;
  const top='<div class="vf-top">'+pimg(f.id,360,'class="vf-poster" alt=""')+'<div>'+(done?'<span class="vf-seal">✓ '+tr("已现场认证")+'</span>':'')+'<h3>'+esc(f.cn)+'</h3><p>'+esc(checkinShowLine(s))+'</p></div></div>';
  if(done){checkinDone(box,top,plan.key);return;}
  box("vf-ok",top+'<p>'+tr("在放映现场签到：观影护照盖章，同时领取这一场的典藏票根，票根上烫印「现场认证」。")+'</p><button class="primary-button vf-go" id="ci-go">'+tr("签到 · 盖章 · 领取典藏票根")+'</button>');
  document.getElementById("ci-go")?.addEventListener("click",async e=>{
    const b=e.currentTarget;b.disabled=true;b.textContent=tr("正在签到…");
    // 先记观影与票根（离线也不丢），再向服务器认证
    if(plan.rec){watched[f.id]=plan.rec;saveWatched();}
    const store=ticketStore(),entry=TE.applyCheckin(store[plan.key],plan.key,null);
    ticketStorePut({...store,[plan.key]:entry});
    let r=null;
    try{r=await sbRpc("tk_checkin",{item:{s:entry.n,f:f.id,h:s.sid||keyOf(s),w:c.w,k:c.k}});}catch(err){r=null;}
    if(!r||!r.ok){
      box("vf-bad",top+'<b>'+(r&&r.reason==="expired"?tr("签到码已过期"):r?tr("签到码无效"):tr("暂时无法认证"))+'</b><p>'+(r&&r.reason==="expired"?tr("请扫描现场屏幕上最新的签到码。"):r?tr("请扫描放映现场屏幕上的签到码。"):tr("网络或服务暂时不可用，请稍后再扫一次。"))+'</p><p>'+tr("观影护照已盖章，票根也已放进典藏票根册。")+'</p>');
      return;
    }
    const cur=ticketStore();ticketStorePut({...cur,[plan.key]:TE.applyCheckin(cur[plan.key],plan.key,r)});
    checkinDone(box,top.replace('<h3>','<span class="vf-seal">✓ '+tr("已现场认证")+'</span><h3>'),plan.key);
  });
}
function checkinDone(box,top,key){
  const row=ticketAll().tickets.find(x=>x.key===key),ed=row?TE.editionLines(row):null;
  box("vf-ok",top+(ed?'<dl class="vf-dl"><dt>'+tr("发行序号")+'</dt><dd>'+esc(ed.no+ed.total)+'</dd><dt></dt><dd>'+esc(ed.line1)+'</dd>'+(ed.line2?'<dt></dt><dd>'+esc(ed.line2)+'</dd>':'')+'</dl>':'')+
    '<button class="primary-button vf-go" id="ci-open">'+tr("查看我的典藏票根")+'</button>');
  document.getElementById("ci-open")?.addEventListener("click",()=>{location.hash="#ticket-wall";setTimeout(()=>{const r=ticketAll().tickets.find(x=>x.key===key);if(r)ticketOpen(r);},450);});
}
// 主办方页面
let ciHostTimer=0;
function checkinHostPage(){
  clearInterval(ciHostTimer);
  let pin="";try{pin=sessionStorage.getItem("sparrow-host-key")||"";}catch(e){}
  const t=now(),shows=SH.filter(s=>{const st=showDate(s).getTime();return st>t-4*36e5&&st<t+14*36e5;}).sort((a,b)=>showDate(a)-showDate(b));
  main.innerHTML=checkinHead()+'<div class="vf-card ci-host">'+
    '<label class="ci-row"><span>'+tr("主办密钥")+'</span><input id="ci-pin" type="password" autocomplete="off" value="'+esc(pin)+'"></label>'+
    '<label class="ci-row"><span>'+tr("场次")+'</span><select id="ci-show"><option value="">'+tr("选择一场放映")+'</option>'+shows.map((s,i)=>'<option value="'+i+'">'+esc(checkinShowLine(s)+" · "+(F[s.id]?.cn||s.id))+'</option>').join("")+'</select></label>'+
    (shows.length?'':'<p>'+tr("前后 14 小时内没有场次。")+'</p>')+
    '<div id="ci-qr" class="ci-qr"></div></div><div id="ci-ag"></div></section>';
  const qr=document.getElementById("ci-qr"),sel=document.getElementById("ci-show"),pinEl=document.getElementById("ci-pin");
  async function tick(){
    const s=shows[+sel.value];if(!s||!pinEl.value){qr.innerHTML="";return;}
    try{sessionStorage.setItem("sparrow-host-key",pinEl.value);}catch(e){}
    let r=null;try{r=await sbRpc("tk_checkin_code",{pin:pinEl.value,f:s.id,h:s.sid||keyOf(s)});}catch(e){}
    if(location.hash!=="#checkin-host"){clearInterval(ciHostTimer);return;}
    if(!r||!r.k){qr.innerHTML='<p class="ci-err">'+tr("主办密钥不对，或网络不可用")+'</p>';return;}
    qr.innerHTML='<div class="ci-code">'+qrSVG(TE.checkinURL(s.id,s.sid||keyOf(s),r.w,r.k))+'</div><h3>'+esc(F[s.id]?.cn||"")+'</h3><p>'+esc(checkinShowLine(s))+'</p><p class="ci-n">'+tr("已签到")+' <b>'+r.n+'</b> '+tr("人")+' · '+tr("签到码每分钟更新")+'</p>';
  }
  const agTick=()=>{const s=shows[+sel.value];ciAgRender(s&&pinEl.value?s:null,pinEl.value);};
  sel.addEventListener("change",()=>{tick();agTick();});pinEl.addEventListener("change",()=>{tick();agTick();});
  ciHostTimer=setInterval(tick,60000);
}

// ——— 映后嘉宾签名（2026-11-23）：主办方页面的签名板 ———
// 嘉宾在主办方的手机 / 平板上手写，笔画存成 0–1000 × 0–500 的整数坐标（tk_autograph_put）；每场最多 4 位嘉宾。
function agDraw(ctx,strokes,w,h,ink){
  ctx.clearRect(0,0,w,h);ctx.lineCap="round";ctx.lineJoin="round";ctx.strokeStyle=ink||"#1d1712";ctx.lineWidth=Math.max(1.5,w/150);
  for(const st of strokes){ctx.beginPath();ctx.moveTo(st[0]*w/1000,st[1]*h/500);
    if(st.length<4)ctx.lineTo(st[0]*w/1000+.1,st[1]*h/500);
    for(let i=2;i<st.length-2;i+=2){const mx=(st[i]+st[i+2])/2,my=(st[i+1]+st[i+3])/2;ctx.quadraticCurveTo(st[i]*w/1000,st[i+1]*h/500,mx*w/1000,my*h/500);}
    if(st.length>=4)ctx.lineTo(st[st.length-2]*w/1000,st[st.length-1]*h/500);ctx.stroke();}
}
let ciAgShown="",ciAgSeq=0;
async function ciAgRender(s,pin,force){
  const box=document.getElementById("ci-ag");if(!box)return;
  if(!s){box.innerHTML="";ciAgShown="";return;}
  // 同一场、同一密钥已经显示着就不重画（选场次和离开密钥框都会触发，重画会清掉正在填的姓名）；只用最后一次请求的结果
  const key=pin+"|"+s.id+"|"+(s.sid||keyOf(s));if(!force&&key===ciAgShown&&box.firstChild)return;
  const seq=++ciAgSeq;
  let list=null;try{list=await sbRpc("tk_autograph_list",{pin,f:s.id,h:s.sid||keyOf(s)});}catch(e){}
  if(seq!==ciAgSeq)return;
  if(!Array.isArray(list)){box.innerHTML="";ciAgShown="";return;}
  ciAgShown=key;
  const used=new Set(list.map(g=>g.i)),free=[0,1,2,3].find(i=>!used.has(i));
  box.innerHTML='<div class="vf-card ci-host"><h3 class="ci-agh">'+tr("映后嘉宾签名")+'</h3><p>'+tr("只有在这一场现场认证过的典藏票根才会出现嘉宾签名。每场最多 4 位。")+'</p>'+
    (list.length?'<div class="ci-ag-list">'+list.map(g=>'<div class="ci-ag-item"><canvas width="300" height="150" data-ag="'+g.i+'"></canvas><span>'+esc((g.role?g.role+" ":"")+g.name)+'</span><button class="text-button" data-ag-del="'+g.i+'">'+tr("删除")+'</button></div>').join("")+'</div>':'')+
    (free===undefined?'<p>'+tr("已满 4 位嘉宾。")+'</p>':
    '<label class="ci-row"><span>'+tr("嘉宾姓名")+'</span><input id="ag-name" maxlength="24" autocomplete="off"></label>'+
    '<label class="ci-row"><span>'+tr("身份")+'</span><input id="ag-role" maxlength="12" placeholder="'+tr("如：导演")+'" autocomplete="off"></label>'+
    '<div class="ci-pad"><canvas id="ag-pad"></canvas><span class="ci-pad-hint">'+tr("请嘉宾在这里签名")+'</span></div>'+
    '<div class="ci-up"><label class="secondary-button ci-up-btn">'+tr("上传签名照片")+'<input type="file" id="ag-file" accept="image/*" hidden></label>'+
    '<label class="ci-up-shade" id="ag-shade-row" hidden><span>'+tr("深浅")+'</span><input type="range" id="ag-shade" min="-60" max="60" step="5" value="0"></label>'+
    '<p class="ci-up-note">'+tr("请只上传嘉宾本人为这一场签的签名，并事先告知会用于观众的电子票根。照片只在本机识别，不会上传，只保存描出的笔画。")+'</p></div>'+
    '<div class="ci-pad-acts"><button class="secondary-button" id="ag-clear">'+tr("清除")+'</button><button class="primary-button" id="ag-save">'+tr("保存签名")+'</button></div>')+'</div>';
  box.querySelectorAll("canvas[data-ag]").forEach(c=>{const g=list.find(x=>String(x.i)===c.dataset.ag);if(g)agDraw(c.getContext("2d"),g.st,300,150);});
  box.querySelectorAll("[data-ag-del]").forEach(b=>b.addEventListener("click",async()=>{
    if(!confirm(tr("删除这位嘉宾的签名？")))return;
    try{await sbRpc("tk_autograph_put",{pin,f:s.id,h:s.sid||keyOf(s),i:+b.dataset.agDel,nm:null,rl:null,st:null});}catch(e){}
    ciAgRender(s,pin,true);}));
  const pad=document.getElementById("ag-pad");if(!pad)return;
  const dpr=Math.min(3,window.devicePixelRatio||1),W=pad.parentElement.clientWidth,H=Math.round(W/2);
  pad.width=W*dpr;pad.height=H*dpr;pad.style.height=H+"px";const ctx=pad.getContext("2d");ctx.scale(dpr,dpr);
  let strokes=[],cur=null,points=0;
  const pt=e=>{const r=pad.getBoundingClientRect();return [Math.max(0,Math.min(1000,Math.round((e.clientX-r.left)/r.width*1000))),Math.max(0,Math.min(500,Math.round((e.clientY-r.top)/r.height*500)))];};
  const redraw=()=>{agDraw(ctx,cur?strokes.concat([cur]):strokes,W,H);pad.parentElement.classList.toggle("on",strokes.length>0||!!cur);};
  pad.addEventListener("pointerdown",e=>{if(strokes.length>=80||points>=4000)return;pad.setPointerCapture(e.pointerId);cur=pt(e);points++;redraw();});
  pad.addEventListener("pointermove",e=>{if(!cur)return;const [x,y]=pt(e),lx=cur[cur.length-2],ly=cur[cur.length-1];if(Math.hypot(x-lx,y-ly)<4||points>=4000)return;cur.push(x,y);points++;redraw();});
  const end=()=>{if(cur){strokes.push(cur);cur=null;redraw();}};
  pad.addEventListener("pointerup",end);pad.addEventListener("pointercancel",end);
  // 上传签名照片：在本机描成笔画，替换签名板上的内容；可拖「深浅」重新识别，也可以再在板上补几笔
  let photo=null;const shadeRow=document.getElementById("ag-shade-row"),shade=document.getElementById("ag-shade");
  const retrace=()=>{if(!photo||!window.SparrowTrace)return;const r=SparrowTrace.trace(photo,+shade.value);
    if(!r.strokes.length){strokes=[];points=0;redraw();toast(tr(r.reason==="toolarge"?"签名太复杂，请换一张只有签名的照片":"没有识别到签名，请拖动「深浅」或换一张白纸黑字的照片"));return;}
    strokes=r.strokes;points=r.points;cur=null;redraw();};
  document.getElementById("ag-file").addEventListener("change",e=>{const file=e.target.files&&e.target.files[0];e.target.value="";if(!file)return;
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{const k=Math.min(1,1400/Math.max(img.naturalWidth,img.naturalHeight)),w=Math.max(1,Math.round(img.naturalWidth*k)),h=Math.max(1,Math.round(img.naturalHeight*k));
      const c=document.createElement("canvas");c.width=w;c.height=h;const x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,w,h);x.drawImage(img,0,0,w,h);
      URL.revokeObjectURL(url);photo=x.getImageData(0,0,w,h);shade.value="0";shadeRow.hidden=false;retrace();};
    img.onerror=()=>{URL.revokeObjectURL(url);toast(tr("无法读取这张图片"));};img.src=url;});
  shade.addEventListener("input",()=>{clearTimeout(shade._t);shade._t=setTimeout(retrace,120);});
  document.getElementById("ag-clear").addEventListener("click",()=>{strokes=[];cur=null;points=0;photo=null;shadeRow.hidden=true;redraw();});
  document.getElementById("ag-save").addEventListener("click",async e=>{
    const nm=document.getElementById("ag-name").value.trim(),rl=document.getElementById("ag-role").value.trim();
    if(!nm){toast(tr("请填写嘉宾姓名"));return;}if(!strokes.length){toast(tr("还没有签名"));return;}
    e.currentTarget.disabled=true;
    let r=null;try{r=await sbRpc("tk_autograph_put",{pin,f:s.id,h:s.sid||keyOf(s),i:free,nm,rl,st:strokes});}catch(err){}
    if(!Array.isArray(r)){toast(tr("保存失败，请检查主办密钥或网络"));e.currentTarget.disabled=false;return;}
    toast(tr("签名已保存"));ciAgRender(s,pin,true);
  });
}
