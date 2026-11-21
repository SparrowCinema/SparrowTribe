/* 我的票根收藏册（2026-11-21 重做）。
   票根 = 某一次观影的「皮肤」：本机 sparrow-tickets-v2 只存用户改过的字段（规则见 shared/tickets.js、shared/psync.js），
   日期、影院、片名、专题由观影记录与片库推出；随个人档案云端同步与完整备份一起保存。
   浏览：按年 → 月连续滚动（月份标题吸顶）、年份切换、搜索 + 分面筛选、四档密度（大 / 中 / 小 / 书脊）；
   票面只在接近屏幕时才绘制，画好后缓存成图片。导出：当前结果 / 年度 / 专题 / 精选票根墙，超过 MOSAIC_MAX 张分成多张图。 */
const TICKET_KEY="sparrow-tickets-v1",TICKET_STORE_KEY="sparrow-tickets-v2",TICKET_DENSITY_KEY="sparrow-ticket-density";
const ticketArtworkEngine=window.SparrowTickets,TE=ticketArtworkEngine;
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
  ticketData=TE.build(ticketViewings(),ticketStore(),ticketBase);ticketDataRev=ticketRev+"|"+watchedSig();
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
const ticketSig=(row,side,w)=>[row.key,side,w,TE.packLook(row.look),row.crop,row.art,row.time,row.venue,row.hall,row.seat,row.format,row.title,row.programme,row.city].join("¦");
async function ticketTileURL(row,side,w){
  const sig=ticketSig(row,side,w);
  if(ticketURLs.has(sig)){const url=ticketURLs.get(sig);ticketURLs.delete(sig);ticketURLs.set(sig,url);return url;}
  const image=side==="front"?await ticketPoster(row,true):null;
  const h=Math.round(w*TE.H/TE.W),canvas=ticketCanvas(w,h);
  TE.draw(canvas.getContext("2d"),row,side,image,{x:0,y:0,w,h},ticketCanvas);
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
  if(ticketDraft){body.innerHTML=ticketHeading(false)+ticketEditor(ticketDraft.row);ticketEditorMount();return;}
  if(ticketMode==="create"){body.innerHTML=ticketCreateHTML();ticketSearch("");body.querySelector("#ticket-search")?.focus();return;}
  if(ticketMode==="pending"){body.innerHTML=ticketPendingHTML();return;}
  const {tickets,pending}=ticketAll();
  if(!tickets.length){body.innerHTML=ticketHeading(true)+ticketEmptyHTML(pending);if(!pending.length)ticketSearch("");return;}
  body.innerHTML=ticketHeading(true)+`<div class="ticket-bar">
      <label class="ticket-search-box"><span class="sr-only">${ticketDict("搜索票根")}</span><input id="ticket-q" type="search" autocomplete="off" value="${esc(ticketQ.text)}" placeholder="${ticketDict("搜片名、导演、影院、专题")}"></label>
      <button type="button" class="ticket-alt" data-ticket-action="facets" aria-expanded="${ticketFacets}">${ticketDict("筛选")}${ticketActiveCount()?` · ${ticketActiveCount()}`:""}</button>
      <div class="ticket-seg" role="group" aria-label="${ticketDict("显示密度")}">${[["l","大图"],["m","中图"],["s","小图"],["spine","书脊"]].map(([v,l])=>`<button type="button" data-ticket-density="${v}" aria-pressed="${ticketDensity===v}">${ticketDict(l)}</button>`).join("")}</div>
      <button type="button" class="ticket-alt" data-ticket-action="side">${ticketDict(ticketSide==="front"?"正面":"背面")} ↻</button>
      <button type="button" class="ticket-alt" data-ticket-action="export-open" aria-expanded="${ticketExportOpen}">${ticketDict("导出票根墙")}</button>
    </div><div id="ticket-list"></div>`;
  ticketPaintList();
}
function ticketHeading(album){
  const {tickets,pending}=ticketAll();
  return `<div class="ticket-heading"><div><span>SPARROW FILM PASSPORT</span><h2 class="sec">${ticketDict("我的票根收藏册")}</h2>
    ${album?`<p class="ticket-sum">${ticketDict("已收藏")} <b>${tickets.length}</b> ${ticketDict("张票根")}${pending.length?` · <button type="button" class="text-button" data-ticket-action="pending">${ticketDict("待制作")} ${pending.length} ${ticketDict("场")} ›</button>`:""}</p>`:""}</div>
    ${album?`<button type="button" class="primary-button" data-ticket-action="new">${ticketDict("制作票根")}</button>`:`<button type="button" class="ticket-alt" data-ticket-action="cancel">${ticketDict("返回收藏册")}</button>`}</div>`;
}
function ticketEmptyHTML(pending){
  if(pending.length)return `<div class="ticket-empty"><h3>${ticketDict("还没有收藏票根")}</h3>
    <p>${ticketDict("你的观影护照里有")} ${pending.length} ${ticketDict("场观影还没做成票根。")}</p>
    <div class="ticket-edit-actions"><button type="button" class="primary-button" data-ticket-action="make-all">${ticketDict("一键生成全部")} ${pending.length} ${ticketDict("张票根")}</button>
    <button type="button" class="ticket-alt" data-ticket-action="pending">${ticketDict("逐张挑选")}</button></div></div>`;
  return `<div class="ticket-empty"><h3>${ticketDict("还没有收藏票根")}</h3><p>${ticketDict("在影片页点「看过」盖章后，每一次观影都可以做成一张票根；也可以直接搜索影片制作。")}</p>
    <label>${ticketDict("搜索护照片库")}<input id="ticket-search" type="search" autocomplete="off"></label><div id="ticket-results" class="ticket-results"></div></div>`;
}
const ticketActiveCount=()=>TE.FACETS.reduce((n,k)=>n+ticketQ[k].length,0);
const ticketFacetLabel={programme:"专题",city:"城市",venue:"影院",format:"放映版本"};
function ticketPaintList(){
  const box=main.querySelector("#ticket-list");if(!box)return;
  const {tickets}=ticketAll(),all=TE.facetCounts(tickets);
  // 删除票根后已不存在的筛选项自动去掉
  if(ticketQ.year&&!all.year.some(y=>y.value===ticketQ.year))ticketQ.year="";
  TE.FACETS.forEach(k=>{ticketQ[k]=ticketQ[k].filter(v=>all[k].some(x=>x.value===v));});
  const counts=TE.facetCounts(tickets,ticketQ);
  const shown=TE.filterTickets(tickets,ticketQ),groups=TE.groupByMonth(shown);
  const yearN=Object.fromEntries(counts.year.map(y=>[y.value,y.count]));
  const years=all.year.length>1?`<div class="ticket-years" role="group" aria-label="${ticketDict("年份")}">
    <button type="button" data-ticket-year="" aria-pressed="${!ticketQ.year}">${ticketDict("全部年份")}</button>
    ${all.year.map(y=>`<button type="button" data-ticket-year="${esc(y.value)}" aria-pressed="${ticketQ.year===y.value}">${esc(y.value)} <small>${yearN[y.value]||0}</small></button>`).join("")}</div>`:"";
  const facets=ticketFacets?`<div class="ticket-facets">${TE.FACETS.filter(k=>all[k].length>1||ticketQ[k].length).map(k=>`<div class="ticket-facet"><h4>${ticketDict(ticketFacetLabel[k])}</h4><div>
    ${counts[k].slice(0,k==="programme"?80:40).map(x=>`<button type="button" data-ticket-facet="${k}" data-value="${esc(x.value)}" aria-pressed="${ticketQ[k].includes(x.value)}">${esc(x.value)} <small>${x.count}</small></button>`).join("")}</div></div>`).join("")||`<p>${ticketDict("票根还不多，暂时没有可筛选的项目")}</p>`}</div>`:"";
  const chips=ticketActiveCount()?`<div class="ticket-chips">${TE.FACETS.flatMap(k=>ticketQ[k].map(v=>`<button type="button" data-ticket-facet="${k}" data-value="${esc(v)}" aria-label="${ticketDict("移除筛选")} ${esc(v)}">${esc(v)} ×</button>`)).join("")}<button type="button" class="text-button" data-ticket-action="clear">${ticketDict("清除筛选")}</button></div>`:"";
  const filtered=shown.length!==tickets.length;
  box.innerHTML=years+facets+chips+(ticketExportOpen?ticketExportHTML(shown,all):"")+
    `<p class="ticket-count" role="status">${filtered?`${ticketDict("显示")} ${shown.length} / ${tickets.length} ${ticketDict("张票根")}`:`${tickets.length} ${ticketDict("张票根")}`}${ticketPick?` · ${ticketDict("点票根挑选，最多")} ${TICKET_PICK_MAX} ${ticketDict("张票根")}`:""}</p>`+
    (shown.length?`<div class="ticket-album" data-density="${ticketDensity}">${groups.map(g=>ticketMonthHTML(g)).join("")}</div>`:`<p class="ticket-empty">${ticketDict("所选条件下暂无票根")}</p>`)+
    (ticketPick?`<div class="ticket-pickbar" role="region" aria-label="${ticketDict("精选票根墙")}"><span>${ticketDict("已选")} <b>${ticketPick.size}</b> / ${TICKET_PICK_MAX}</span>
      <button type="button" class="primary-button" data-ticket-action="pick-export"${ticketPick.size?"":" disabled"}>${ticketDict("导出精选墙")}</button><button type="button" class="ticket-alt" data-ticket-action="pick-cancel">${ticketDict("取消")}</button></div>`:"");
  if(ticketDensity!=="spine")ticketObserve(box);
}
function ticketMonthHTML(g){
  const title=g.id==="undated"?tr("日期待定"):(LANG==="en"?`${new Date(Date.UTC(+g.year,g.month-1,1)).toLocaleString("en",{month:"long",timeZone:"UTC"})} ${g.year}`:`${g.year}年${g.month}月`);
  return `<section class="ticket-month" style="--rows:${g.rows.length}"><h3 class="ticket-month-h">${esc(title)} <small>${g.rows.length} ${ticketDict("张票根")}</small></h3>
    <div class="ticket-grid">${g.rows.map(row=>ticketDensity==="spine"?ticketSpineHTML(row):ticketTileHTML(row)).join("")}</div></section>`;
}
function ticketTileHTML(row){
  const c=TE.swatch(row),picked=ticketPick?.has(row.key);
  return `<button type="button" class="ticket-tile${picked?" picked":""}" data-key="${esc(row.key)}" style="--sw:${c.mid};--sa:${c.accent}" aria-label="${esc(row.title+" "+row.date+" "+row.venue)}"${ticketPick?` aria-pressed="${!!picked}"`:""}>
    <img alt="" decoding="async"><span>${esc(row.title)}</span></button>`;
}
function ticketSpineHTML(row){
  const c=TE.swatch(row),picked=ticketPick?.has(row.key);
  return `<button type="button" class="ticket-spine${picked?" picked":""}" data-key="${esc(row.key)}" style="--sw:${c.mid};--sa:${c.accent};--sb:${c.stock}"${ticketPick?` aria-pressed="${!!picked}"`:""}>
    <i aria-hidden="true"></i><b>${esc(row.title)}</b><span>${esc([row.date.replace(/-/g,"."),row.time].filter(Boolean).join(" "))}</span><em>${esc([row.venue,row.programme].filter(Boolean).join(" · "))}</em></button>`;
}

// ——— 待制作 ———
function ticketPendingHTML(){
  const {pending}=ticketAll(),rows=pending.slice(0,ticketPendingShown);
  const line=item=>{const f=F[item.filmId],b=ticketBase(item.filmId,item.view,item.view.d)||{};
    return `<li><button type="button" class="ticket-pend" data-ticket-pending="${esc(item.key)}">${pst(item.filmId)?pimg(item.filmId,360,'loading="lazy" alt=""'):"<i></i>"}
      <b>${esc(f?.cn||item.filmId)}</b><span>${esc([item.view.d.replace(/-/g,"."),b.time,b.venue].filter(Boolean).join(" · "))}</span><em>${ticketDict("制作")} ›</em></button></li>`;};
  return ticketHeading(false)+`<div class="ticket-pending"><h3>${ticketDict("待制作")} ${pending.length} ${ticketDict("场")}</h3>
    <p>${ticketDict("每一次观影都可以做一张票根。一键生成使用专题默认款式，之后仍可逐张换款。")}</p>
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
  const item=mine.find(x=>!made.has(x.key))||mine[0];
  if(item){ticketOpenViewing(item);return;}
  // 没有观影记录：手工票根，日期默认今天，可改
  const date=isoOf(new Date(now())),key=ticketFreeKey(id,date);
  const row=TE.build([],{[key]:{t:Date.now()}},ticketBase).tickets[0];if(!row)return;
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
function ticketEditor(row){
  const assets=[...(row.arts||[])];
  if(row.art&&!assets.includes(row.art))assets.unshift(row.art);
  const input=(key,label,type="text")=>`<label>${ticketDict(label)}<input type="${type}" name="${key}" value="${esc(row[key])}"></label>`;
  const dateField=row.linked?`<div class="ticket-wide ticket-fixed"><span>${ticketDict("观影日期")}</span><b>${esc(row.date.replace(/-/g,"."))}</b><small>${ticketDict("来自观影记录，可在影片页「我的观影」里修改")}</small></div>`:input("date","日期","date");
  return `<div class="ticket-editor">
    <div class="ticket-stage"><button type="button" data-ticket-action="flip" class="ticket-flip" data-side="${ticketDraft.side}" aria-label="${ticketDict("翻面")}">
      <span class="ticket-turn"><span class="ticket-face ticket-front"><canvas width="630" height="1296" id="ticket-preview-front" aria-hidden="true"></canvas></span>
      <span class="ticket-face ticket-back"><canvas width="630" height="1296" id="ticket-preview-back" aria-hidden="true"></canvas></span></span></button>
      <button type="button" class="ticket-alt ticket-flip-label" data-ticket-action="flip">${ticketDict(ticketDraft.side==="front"?"翻到背面":"翻回正面")}</button>
      <fieldset class="ticket-blind-box"><legend>${ticketDict("票根盲盒")}</legend>
        <button type="button" class="ticket-alt" data-ticket-action="shuffle">${ticketDict("随机换一款")}</button>
        <button type="button" class="ticket-alt" data-ticket-action="reset">${ticketDict("恢复专题默认")}</button>
      </fieldset></div>
    <div class="ticket-edit-fields"><div class="ticket-edit-head"><h3>${esc(row.title)}</h3></div>
      <div class="ticket-inputs">${dateField}
        ${assets.length>1?`<label>${ticketDict("票面图像")}<select name="art">${assets.map((a,i)=>ticketOption(a,`${tr(i===0?"海报":"备用图像")} ${i+1}`,row.art)).join("")}</select></label>`:""}
        ${assets.length?`<label>${ticketDict("调整裁切位置")}<input type="range" min="0" max="100" name="crop" value="${row.crop}"></label>`:""}
        ${input("time","开场时间","time")}${input("venue","影院")}${input("hall","影厅")}${input("seat","座位")}${input("format","放映版本")}
      </div><div class="ticket-edit-actions">
        <button class="primary-button" data-ticket-action="save">${ticketDict(ticketDraft.original?"更新票根":"加入收藏册")}</button>
        <button class="ticket-alt" data-ticket-action="single">${ticketDict("导出这张票根")}</button>
        ${ticketDraft.original?`<button class="ticket-alt" data-ticket-action="remove">${ticketDict("移出票根")}</button>`:""}</div></div></div>`;
}
function ticketEditorMount(){
  ticketDrawEditor();
  const card=main.querySelector(".ticket-flip");if(!card)return;
  const tilt=e=>{
    if(!e.isPrimary)return;
    const rect=card.getBoundingClientRect(),limit=value=>Math.max(0,Math.min(value,1));
    const x=limit((e.clientX-rect.left)/rect.width),y=limit((e.clientY-rect.top)/rect.height);
    card.style.setProperty("--tx",`${(0.5-y)*13}deg`);card.style.setProperty("--ty",`${(x-0.5)*17}deg`);
    card.style.setProperty("--gx",`${x*100}%`);card.style.setProperty("--gy",`${y*100}%`);
  };
  const untilt=()=>["--tx","--ty","--gx","--gy"].forEach(key=>card.style.removeProperty(key));
  card.addEventListener("pointermove",tilt);
  card.addEventListener("pointerdown",e=>{if(e.pointerType==="touch")tilt(e);});
  card.addEventListener("pointerup",e=>{if(e.pointerType==="touch")untilt();});
  card.addEventListener("pointerleave",untilt);
  card.addEventListener("pointercancel",untilt);
}
function ticketDrawEditor(){
  if(!ticketDraft)return;
  const card=main.querySelector(".ticket-flip");if(!card)return;
  const shine=TE.shineOf(ticketDraft.row.look.finish);
  card.dataset.shine=shine.kind;card.style.setProperty("--metal-highlight",shine.highlight+"af");
  for(const side of ["front","back"])ticketRenderCard(main.querySelector("#ticket-preview-"+side),ticketDraft.row,side);
}
async function ticketRenderCard(canvas,row,side){
  const rendering=(canvas.ticketPainting||0)+1;canvas.ticketPainting=rendering;
  const draw=image=>{const ctx=canvas.getContext("2d");ctx.clearRect(0,0,canvas.width,canvas.height);TE.draw(ctx,row,side,image,{x:0,y:0,w:canvas.width,h:canvas.height},ticketCanvas);};
  draw(null);
  if(side==="front"&&row.art){const image=await ticketPoster(row,false);if(canvas.isConnected&&canvas.ticketPainting===rendering&&image)draw(image);}
}
function ticketSave(){
  const d=ticketDraft,row=TE.sanitize({...d.row});
  if(!row.date){toast(tr("请填写放映日期"));return;}
  let key=d.row.key;
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
  ticketDraft=null;ticketMode="album";ticketRender();toast(tr("已收进票根收藏册"));
}

// ——— 导出 ———
function ticketExportHTML(shown,counts){
  const kind=ticketExportOpen.kind||"current",year=ticketExportOpen.year||counts.year[0]?.value||"",prog=ticketExportOpen.prog||counts.programme[0]?.value||"";
  const rows=ticketExportRows(),parts=Math.ceil(rows.length/TE.MOSAIC_MAX),part=Math.min(ticketExportOpen.part||0,Math.max(0,parts-1));
  const radio=(v,label,extra="")=>`<label class="ticket-radio"><input type="radio" name="export-kind" value="${v}"${kind===v?" checked":""}> ${label}${extra}</label>`;
  return `<div class="ticket-export"><h3>${ticketDict("导出票根墙")}</h3>
    ${radio("current",`${ticketDict("当前结果")}（${shown.length} ${ticketDict("张票根")}）`)}
    ${counts.year.length?radio("year",ticketDict("年度票根墙"),` <select name="export-year">${counts.year.map(y=>ticketOption(y.value,`${y.value}（${y.count}）`,year)).join("")}</select>`):""}
    ${counts.programme.length?radio("prog",ticketDict("专题票根墙"),` <select name="export-prog">${counts.programme.map(p=>ticketOption(p.value,`${p.value}（${p.count}）`,prog)).join("")}</select>`):""}
    ${radio("pick",`${ticketDict("精选票根墙")}（${ticketDict("自己挑")} ≤${TICKET_PICK_MAX} ${ticketDict("张票根")}）`)}
    ${parts>1?`<label>${ticketDict("分成")} ${parts} ${ticketDict("张图导出")}（${rows.length} ${ticketDict("张票根")}） <select name="export-part">${Array.from({length:parts},(_,i)=>ticketOption(String(i),`${i+1} / ${parts}`,String(part))).join("")}</select></label>`:""}
    <p class="ticket-note">${ticketDict(ticketSide==="front"?"导出正面；切换「背面」可导出背面。":"导出背面；切换「正面」可导出正面。")}</p>
    <div class="ticket-edit-actions"><button type="button" class="primary-button" data-ticket-action="do-export"${kind!=="pick"&&!rows.length?" disabled":""}>${ticketDict(kind==="pick"?"开始挑选":"生成图片")}</button>
    <button type="button" class="ticket-alt" data-ticket-action="export-close">${ticketDict("收起")}</button></div></div>`;
}
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
  return tr("我的票根收藏册");
}
async function ticketExport(button,single){
  const side=single?ticketDraft.side:ticketSide;
  let shown,title=tr("我的票根收藏册"),caption="",part=0,parts=1;
  if(single)shown=[{...ticketDraft.row,look:{...ticketDraft.row.look}}];
  else{
    const all=ticketExportRows();parts=Math.max(1,Math.ceil(all.length/TE.MOSAIC_MAX));part=Math.min(ticketExportOpen?.part||0,parts-1);
    shown=all.slice(part*TE.MOSAIC_MAX,(part+1)*TE.MOSAIC_MAX);title=ticketExportTitle();
    caption=[`${all.length} ${tr("张票根")}`,tr(side==="front"?"正面":"背面"),parts>1?`${part+1} / ${parts}`:""].filter(Boolean).join(" · ");
  }
  if(!shown.length)return;
  button.disabled=true;const label=button.textContent;button.textContent=tr("正在生成图片");
  try{
    const small=shown.length>12;
    const images=await Promise.all(shown.map(row=>side==="front"?ticketPoster(row,small):null));
    const layout=single?{width:TE.W*3,height:TE.H*3}:TE.wallLayout(shown.length);
    const canvas=ticketCanvas(layout.width,layout.height),ctx=canvas.getContext("2d");
    if(single)TE.draw(ctx,shown[0],side,images[0],{x:0,y:0,w:layout.width,h:layout.height},ticketCanvas);
    else TE.drawWall(ctx,shown,side,images,caption,ticketCanvas,title);
    // 密排拼图像素多，用 JPEG（底色不透明，几 MB 以内，方便发微信）；单张和 12 张以内保持 PNG
    const jpeg=!single&&shown.length>12;
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,jpeg?"image/jpeg":"image/png",.9));
    if(!blob)throw Error("image");
    const safe=(single?shown[0].title:title).replace(/[\\/:*?"<>|]/g,"-");
    if(!button.isConnected||location.hash!=="#ticket-wall")return;
    if(side==="front"&&images.some((image,i)=>!image&&shown[i].art))toast(tr("海报读取失败，已用片名代替"));
    showImageSheet(blob,{file:`${safe}-${side==="front"?"正面":"背面"}${parts>1?"-"+(part+1):""}.${jpeg?"jpg":"png"}`,head:tr("票根图片已生成"),alt:tr("票根图片")});
  }catch{toast(tr("图片生成失败，请稍后再试"));}
  finally{if(button.isConnected){button.disabled=false;button.textContent=label;}}
}

// ——— 事件 ———
function ticketInput(event){
  const t=event.target;
  if(t.id==="ticket-search")ticketSearch(t.value);
  else if(t.id==="ticket-q"){clearTimeout(ticketSearchTimer);ticketSearchTimer=setTimeout(()=>{ticketQ.text=t.value;ticketPaintList();},160);}
  else if(t.name==="crop"&&ticketDraft){ticketDraft.row.crop=Number(t.value);ticketDrawEditor();}
}
function ticketChange(event){
  const {name,value}=event.target;
  if(name==="export-kind"){ticketExportOpen={...ticketExportOpen,kind:value,part:0};ticketPaintList();return;}
  if(name==="export-year"||name==="export-prog"){ticketExportOpen={...ticketExportOpen,[name==="export-year"?"year":"prog"]:value,kind:name==="export-year"?"year":"prog",part:0};ticketPaintList();return;}
  if(name==="export-part"){ticketExportOpen={...ticketExportOpen,part:Number(value)};return;}
  if(!ticketDraft)return;
  const row=ticketDraft.row;
  if(["date","time","venue","hall","seat","format","art"].includes(name)){
    row[name]=value;
    if(name==="art")row.crop=50;
    ticketDrawEditor();
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
  const year=e.target.closest("[data-ticket-year]");
  if(year){ticketQ.year=year.dataset.ticketYear;ticketPaintList();return;}
  const facet=e.target.closest("[data-ticket-facet]");
  if(facet){const k=facet.dataset.ticketFacet,v=facet.dataset.value,list=ticketQ[k];ticketQ[k]=list.includes(v)?list.filter(x=>x!==v):[...list,v];ticketPaintList();ticketBarCount();return;}
  const dens=e.target.closest("[data-ticket-density]");
  if(dens){ticketDensity=dens.dataset.ticketDensity;try{localStorage.setItem(TICKET_DENSITY_KEY,ticketDensity);}catch{}
    main.querySelectorAll("[data-ticket-density]").forEach(b=>b.setAttribute("aria-pressed",b===dens));ticketPaintList();return;}
  const b=e.target.closest("[data-ticket-action]");if(!b)return;
  switch(b.dataset.ticketAction){
    case "new":ticketDraft=null;ticketMode="create";ticketRender();break;
    case "pending":ticketDraft=null;ticketMode="pending";ticketPendingShown=TICKET_PENDING_STEP;ticketRender();window.scrollTo(0,0);break;
    case "pending-more":ticketPendingShown+=TICKET_PENDING_STEP;ticketRender();break;
    case "make-all":ticketMakeAll();break;
    case "cancel":ticketDraft=null;ticketMode="album";ticketRender();break;
    case "facets":ticketFacets=!ticketFacets;b.setAttribute("aria-expanded",ticketFacets);ticketPaintList();break;
    case "clear":TE.FACETS.forEach(k=>{ticketQ[k]=[];});ticketPaintList();ticketBarCount();break;
    case "side":ticketSide=ticketSide==="front"?"back":"front";b.textContent=tr(ticketSide==="front"?"正面":"背面")+" ↻";ticketPaintList();break;
    case "export-open":ticketExportOpen=ticketExportOpen?false:{kind:"current"};b.setAttribute("aria-expanded",!!ticketExportOpen);ticketPaintList();break;
    case "export-close":ticketExportOpen=false;ticketRender();break;
    case "do-export":
      if(ticketExportOpen?.kind==="pick"){ticketPick=new Set();ticketExportOpen=false;ticketRender();}
      else ticketExport(b,false);
      break;
    case "pick-export":ticketExportOpen={kind:"pick"};ticketExport(b,false).finally(()=>{ticketExportOpen=false;});break;
    case "pick-cancel":ticketPick=null;ticketPaintList();break;
    case "flip": {
      ticketDraft.side=ticketDraft.side==="front"?"back":"front";
      main.querySelector(".ticket-flip").dataset.side=ticketDraft.side;
      main.querySelector(".ticket-flip-label").textContent=tr(ticketDraft.side==="front"?"翻到背面":"翻回正面");
      break;
    }
    case "shuffle":ticketDraft.row.look=TE.randomLook(ticketDraft.row);ticketDrawEditor();break;
    case "reset":ticketDraft.row.look=TE.defaults(TE.sanitize({...ticketDraft.row,look:null}));ticketDrawEditor();break;
    case "save":ticketSave();break;
    case "remove":
      if(confirm(tr(ticketDraft.row.linked?"将这张票根移出收藏册？这次观影会回到「待制作」。":"将这张票根移出收藏册？"))&&ticketSet({[ticketDraft.original]:{del:1,t:Date.now()}})){
        ticketDraft=null;ticketMode="album";ticketRender();
      }break;
    case "export":ticketExport(b,false);break;
    case "single":ticketExport(b,true);break;
  }
}
function ticketBarCount(){const b=main.querySelector("[data-ticket-action=facets]");if(b)b.textContent=tr("筛选")+(ticketActiveCount()?" · "+ticketActiveCount():"");}
