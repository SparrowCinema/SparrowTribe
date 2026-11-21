/* My ticket album. Rendering is shared with the mini program; only ticket metadata is stored locally. */
const TICKET_KEY="sparrow-tickets-v1";
const ticketArtworkEngine=window.SparrowTickets;
let ticketYear="",ticketProgramme="",ticketPage=0,ticketSide="front",ticketDraft=null,ticketPainting=0;
const ticketImageCache=new Map();
const ticketDict=phrase=>esc(tr(phrase));
const ticketOption=(value,label,selected)=>`<option value="${esc(value)}"${value===selected?" selected":""}>${esc(label)}</option>`;
const ticketRead=()=>{try{return ticketArtworkEngine.read(localStorage.getItem(TICKET_KEY));}catch{return [];}};
function ticketWrite(values){try{localStorage.setItem(TICKET_KEY,JSON.stringify(values));return true;}catch{toast(tr("票根保存失败，请检查本机存储"));return false;}}
const ticketCanvas=(w,h)=>Object.assign(document.createElement("canvas"),{width:w,height:h});
function ticketArtwork(f){
  const assets=[f.poster,f.posterUrl,...(Array.isArray(f.stills)?f.stills.map(item=>typeof item==="string"?item:item?.url):[])];
  return [...new Set(assets.filter(url=>typeof url==="string"&&/^(https:\/\/|posters\/|images\/)/i.test(url)))];
}
function ticketImage(source){
  if(!source)return Promise.resolve(null);
  if(!ticketImageCache.has(source)){
    if(ticketImageCache.size>=32)ticketImageCache.delete(ticketImageCache.keys().next().value);
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
function ticketFromFilm(f,s,date){
  const p=PG[s?.p]||PG[f.prog],v=VN[s?.v],h=v?.halls?.find(item=>item.id===s?.h);
  return ticketArtworkEngine.sanitize({
    filmId:f.id,title:f.cn,subtitle:f.o||f.en,showId:s?.sid||(s?keyOf(s):""),
    programmeId:p?.id,programme:p?.name,section:p?.sections?.[f.id]||(p?.id===f.prog?f.section:""),
    date:s?isoOf(showDate(s)):date,time:s?.t,city:v?.city,venue:v?.name,hall:h?.name||s?.h,format:f.version,art:ticketArtwork(f)[0]
  });
}

function ticketBegin(id){
  const f=F[id];if(!f)return;
  const seen=watched[id],s=watchShow(seen);
  const d=ticketFromFilm(f,s,seen?.d||isoOf(new Date(now())));
  const existing=ticketRead().find(row=>row.id===d.id);
  if(!existing)d.look=ticketArtworkEngine.randomLook(d);
  ticketDraft={row:existing||d,original:existing?.id||"",side:"front",keepLook:true};
  ticketWallPage();
}
function ticketOpen(row){
  ticketDraft={row:{...row,look:{...row.look}},original:row.id,side:ticketSide,keepLook:true};ticketWallPage();
}

function ticketWallPage(){
  const rows=ticketRead();
  main.innerHTML=`<section class="view gut ticket-page">${subBackHTML()}
    <div class="ticket-heading"><div><span>SPARROW FILM PASSPORT</span><h2 class="sec">${ticketDict("我的票根收藏册")}</h2></div>
      <button type="button" class="primary-button" data-ticket-action="new">${ticketDict("制作票根")}</button></div>
    ${ticketDraft?ticketEditor(ticketDraft.row):ticketWall(rows)}
  </section>`;
  const panel=main.querySelector(".ticket-page");
  panel.addEventListener("click",ticketClick);
  panel.addEventListener("change",ticketChange);
  panel.addEventListener("input",event=>{
    if(event.target.id==="ticket-search")ticketSearch(event.target.value);
    else if(event.target.name==="crop"&&ticketDraft){ticketDraft.row.crop=Number(event.target.value);ticketDrawEditor();}
  });
  if(ticketDraft){
    ticketDrawEditor();
    const card=panel.querySelector(".ticket-flip");
    const tilt=e=>{
      if(!e.isPrimary)return;
      const rect=card.getBoundingClientRect();
      const limit=value=>Math.max(0,Math.min(value,1));
      const x=limit((e.clientX-rect.left)/rect.width),y=limit((e.clientY-rect.top)/rect.height);
      card.style.setProperty("--tx",`${(0.5-y)*13}deg`);
      card.style.setProperty("--ty",`${(x-0.5)*17}deg`);
      card.style.setProperty("--gx",`${x*100}%`);
      card.style.setProperty("--gy",`${y*100}%`);
    };
    const untilt=()=>["--tx","--ty","--gx","--gy"].forEach(key=>card.style.removeProperty(key));
    card.addEventListener("pointermove",tilt);
    card.addEventListener("pointerdown",e=>{if(e.pointerType==="touch")tilt(e);});
    card.addEventListener("pointerup",e=>{if(e.pointerType==="touch")untilt();});
    card.addEventListener("pointerleave",untilt);
    card.addEventListener("pointercancel",untilt);
  }
  else if(panel.querySelector("#ticket-search"))ticketSearch("");
  else {
    const shown=ticketScope(rows);
    panel.querySelectorAll(".ticket-wall-canvas").forEach((canvas,i)=>ticketRenderCard(canvas,shown[i],ticketSide));
  }
}

function ticketScope(rows=ticketRead()){
  const all=ticketArtworkEngine.sorted(rows,ticketProgramme,ticketYear);
  ticketPage=Math.min(ticketPage,Math.max(0,Math.ceil(all.length/ticketArtworkEngine.WALL_PAGE)-1));
  return all.slice(ticketPage*ticketArtworkEngine.WALL_PAGE,(ticketPage+1)*ticketArtworkEngine.WALL_PAGE);
}
function ticketWall(rows){
  if(!rows.length)return `<div class="ticket-empty"><h3>${ticketDict("还没有收藏票根")}</h3>
    <label>${ticketDict("搜索护照片库")}<input id="ticket-search" type="search" autocomplete="off"></label><div id="ticket-results" class="ticket-results"></div></div>`;
  const years=[...new Set(rows.map(row=>row.date.slice(0,4)).filter(Boolean))].sort().reverse();
  const progs=[...new Set(rows.map(row=>row.programme).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"zh"));
  if(ticketYear&&!years.includes(ticketYear))ticketYear="";
  if(ticketProgramme&&!progs.includes(ticketProgramme))ticketProgramme="";
  const filtered=ticketArtworkEngine.sorted(rows,ticketProgramme,ticketYear);
  const shown=ticketScope(rows), pages=Math.ceil(filtered.length/ticketArtworkEngine.WALL_PAGE);
  return `<div class="ticket-tools"><label>${ticketDict("年份")}<select name="wall-year">${ticketOption("",tr("全部年份"),ticketYear)}${years.map(v=>ticketOption(v,v,ticketYear)).join("")}</select></label>
    <label>${ticketDict("专题")}<select name="wall-programme">${ticketOption("",tr("全部专题"),ticketProgramme)}${progs.map(v=>ticketOption(v,v,ticketProgramme)).join("")}</select></label>
    <label>${ticketDict("票根面")}<select name="wall-side">${["front","back"].map(v=>ticketOption(v,tr(v==="front"?"正面":"背面"),ticketSide)).join("")}</select></label>
    <button class="primary-button" data-ticket-action="export"${shown.length?"":" disabled"}>${ticketDict("导出本页票根墙")}</button></div>
    ${shown.length?`<div class="ticket-wall-grid">${shown.map((row,i)=>`<button class="ticket-wall-item" type="button" data-ticket-index="${i}" aria-label="${esc(row.title+" "+row.date)}"><canvas class="ticket-wall-canvas" width="210" height="432" aria-hidden="true"></canvas><span>${esc(row.title)}</span></button>`).join("")}</div>`:
    `<p class="ticket-empty">${ticketDict("所选条件下暂无票根")}</p>`}
    <div class="ticket-pager"><span>${filtered.length} ${ticketDict("张票根")}${pages>1?` · ${ticketPage+1} / ${pages}`:""}</span>
      ${pages>1?`<button data-ticket-action="prev"${ticketPage?"":" disabled"}>${ticketDict("上一页")}</button><button data-ticket-action="next"${ticketPage+1<pages?"":" disabled"}>${ticketDict("下一页")}</button>`:""}</div>`;
}

function ticketSearch(query){
  const results=main.querySelector("#ticket-results");if(!results)return;
  const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const list=terms.length?FILMS.filter(f=>terms.every(s=>`${f.cn} ${f.o||""} ${f.en||""}`.toLowerCase().includes(s))).slice(0,30):
    watchEntries().slice(0,18).map(e=>e.f);
  results.innerHTML=list.length?list.map(f=>`<button type="button" class="ticket-result" data-ticket-film-id="${esc(f.id)}">
    ${pst(f.id)?pimg(f.id,360,'loading="lazy" alt=""'):""}<span>${esc(f.cn)}</span></button>`).join(""):
    `<p>${ticketDict(terms.length?"没有匹配的影片":"输入电影片名开始搜索。")}</p>`;
}

function ticketEditor(row){
  const f=F[row.filmId],assets=f?ticketArtwork(f):[];
  if(row.art&&!assets.includes(row.art))assets.unshift(row.art);
  const shows=SH.filter(s=>s.id===row.filmId);
  const input=(key,label,type="text")=>`<label>${ticketDict(label)}<input type="${type}" name="${key}" value="${esc(row[key])}"></label>`;
  return `<div class="ticket-editor">
    <div class="ticket-stage"><button type="button" data-ticket-action="flip" class="ticket-flip" data-side="${ticketDraft.side}" aria-label="${ticketDict("翻面")}">
      <span class="ticket-turn"><span class="ticket-face ticket-front"><canvas width="630" height="1296" id="ticket-preview-front" aria-hidden="true"></canvas></span>
      <span class="ticket-face ticket-back"><canvas width="630" height="1296" id="ticket-preview-back" aria-hidden="true"></canvas></span></span></button>
      <button type="button" class="ticket-alt" data-ticket-action="flip">${ticketDict(ticketDraft.side==="front"?"翻到背面":"翻回正面")}</button>
      <fieldset class="ticket-blind-box"><legend>${ticketDict("票根盲盒")}</legend>
        <button type="button" class="ticket-alt" data-ticket-action="shuffle">${ticketDict("随机换一款")}</button>
        <button type="button" class="ticket-alt" data-ticket-action="reset">${ticketDict("恢复专题默认")}</button>
      </fieldset></div>
    <div class="ticket-edit-fields"><div class="ticket-edit-head"><h3>${esc(row.title)}</h3><button type="button" class="ticket-alt" data-ticket-action="cancel">${ticketDict("返回收藏册")}</button></div>
      <div class="ticket-inputs">
        ${shows.length?`<label class="ticket-wide">${ticketDict("护照场次")}<select name="show">${ticketOption("",tr("自填场次"),row.showId)}
          ${shows.map(s=>ticketOption(s.sid||keyOf(s),`${isoOf(showDate(s))} ${s.t} · ${VN[s.v]?.name||s.v}`,row.showId)).join("")}</select></label>`:""}
        ${assets.length>1?`<label>${ticketDict("票面图像")}<select name="art">${assets.map((a,i)=>ticketOption(a,`${tr(i===0?"海报":"备用图像")} ${i+1}`,row.art)).join("")}</select></label>`:""}
        ${assets.length?`<label>${ticketDict("调整裁切位置")}<input type="range" min="0" max="100" name="crop" value="${row.crop}"></label>`:""}
        ${input("date","日期","date")}${input("time","开场时间","time")}${input("venue","影院")}${input("hall","影厅")}${input("seat","座位")}${input("format","放映版本")}
      </div><div class="ticket-edit-actions">
        <button class="primary-button" data-ticket-action="save">${ticketDict(ticketDraft.original?"更新票根":"加入收藏册")}</button>
        <button class="ticket-alt" data-ticket-action="single">${ticketDict("导出这张票根")}</button>
        ${ticketDraft.original?`<button class="ticket-alt" data-ticket-action="remove">${ticketDict("移出票根")}</button>`:""}</div></div></div>`;
}
function ticketDrawEditor(){
  if(!ticketDraft)return;
  const card=main.querySelector(".ticket-flip"),shine=ticketArtworkEngine.shineOf(ticketDraft.row.look.finish);
  card.dataset.shine=shine.kind;
  card.style.setProperty("--metal-highlight",shine.highlight+"af");
  for(const side of ["front","back"])ticketRenderCard(main.querySelector("#ticket-preview-"+side),ticketDraft.row,side);
}
async function ticketRenderCard(canvas,row,side){
  const rendering=++ticketPainting;canvas.ticketPainting=rendering;
  const draw=image=>{
    const ctx=canvas.getContext("2d");
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ticketArtworkEngine.draw(ctx,row,side,image,{x:0,y:0,w:canvas.width,h:canvas.height},ticketCanvas);
  };
  draw(null);
  if(side==="front"&&row.art){
    const image=await ticketImage(row.art);
    if(canvas.isConnected&&canvas.ticketPainting===rendering&&image)draw(image);
  }
}
function ticketChange(event){
  const {name,value}=event.target;
  if(name.startsWith("wall-")){
    if(name==="wall-year")ticketYear=value;
    if(name==="wall-programme")ticketProgramme=value;
    if(name==="wall-side")ticketSide=value;else ticketPage=0;
    ticketWallPage(); main.querySelector(`[name="${name}"]`)?.focus();return;
  }
  if(!ticketDraft)return;
  const row=ticketDraft.row;
  if(name==="show"){
    const f=F[row.filmId],show=SH.find(s=>s.id===row.filmId&&(s.sid||keyOf(s))===value);
    const next=show&&f?ticketFromFilm(f,show):ticketArtworkEngine.sanitize({...row,id:"",showId:"",look:null});
    if(ticketDraft.keepLook)next.look=row.look;
    ticketDraft.row=next;
    ticketWallPage();return;
  }
  if(["date","time","venue","hall","seat","format","art"].includes(name)){
    row[name]=value;
    if(["date","time","venue","hall"].includes(name)){
      row.id="";row.showId="";
      if(!ticketDraft.keepLook)row.look=ticketArtworkEngine.defaults(ticketArtworkEngine.sanitize(row));
      const select=main.querySelector('[name="show"]');if(select)select.value="";
    }
    if(name==="art")row.crop=50;
  }
  ticketDrawEditor();
}
function ticketSave(){
  const row=ticketArtworkEngine.sanitize({...ticketDraft.row,savedAt:Date.now()});
  if(!row.date){toast(tr("请填写放映日期"));return;}
  const values=ticketRead().filter(value=>value.id!==row.id&&value.id!==ticketDraft.original);
  if(!ticketWrite([...values,row]))return;
  ticketDraft=null;ticketYear=ticketProgramme="";ticketPage=0;ticketWallPage();
  toast(tr("已收进票根收藏册"));
}
async function ticketExport(button,single){
  const side=single?ticketDraft.side:ticketSide;
  const shown=single?[{...ticketDraft.row,look:{...ticketDraft.row.look}}]:ticketScope();
  if(!shown.length)return;
  const page=ticketPage, caption=[ticketYear,ticketProgramme,`${shown.length} ${tr("张票根")}`,`#${page+1}`].filter(Boolean).join(" · ");
  button.disabled=true;
  try{
    const images=await Promise.all(shown.map(row=>side==="front"?ticketImage(row.art):null));
    const layout=single?{width:ticketArtworkEngine.W*3,height:ticketArtworkEngine.H*3}:ticketArtworkEngine.wallLayout(shown.length);
    const canvas=ticketCanvas(layout.width,layout.height),ctx=canvas.getContext("2d");
    if(single)ticketArtworkEngine.draw(ctx,shown[0],side,images[0],{x:0,y:0,w:layout.width,h:layout.height},ticketCanvas);
    else ticketArtworkEngine.drawWall(ctx,shown,side,images,caption,ticketCanvas);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/png"));
    if(!blob)throw Error("image");
    const safe=(single?shown[0].title:"我的票根收藏册").replace(/[\\/:*?"<>|]/g,"-");
    if(!button.isConnected||location.hash!=="#ticket-wall")return;
    if(side==="front"&&images.some((image,i)=>!image&&shown[i].art))toast(tr("海报读取失败，已用片名代替"));
    showImageSheet(blob,{file:`${safe}-${side==="front"?"正面":"背面"}-${page+1}.png`,head:tr("票根图片已生成"),alt:tr("票根图片")});
  }catch{toast(tr("图片生成失败，请稍后再试"));}
  finally{if(button.isConnected)button.disabled=false;}
}
function ticketClick(e){
  const filmButton=e.target.closest("[data-ticket-film-id]");
  if(filmButton){ticketBegin(filmButton.dataset.ticketFilmId);return;}
  const item=e.target.closest("[data-ticket-index]");
  if(item){const row=ticketScope()[Number(item.dataset.ticketIndex)];if(row)ticketOpen(row);return;}
  const b=e.target.closest("[data-ticket-action]");if(!b)return;
  switch(b.dataset.ticketAction){
    case "new":ticketDraft=null;ticketCreatePage();break;
    case "cancel":ticketDraft=null;ticketWallPage();break;
    case "flip": {
      ticketDraft.side=ticketDraft.side==="front"?"back":"front";
      main.querySelector(".ticket-flip").dataset.side=ticketDraft.side;
      main.querySelector(".ticket-stage > .ticket-alt").textContent=tr(ticketDraft.side==="front"?"翻到背面":"翻回正面");
      break;
    }
    case "shuffle":
      ticketDraft.keepLook=true;
      ticketDraft.row.look=ticketArtworkEngine.randomLook(ticketDraft.row);
      ticketDrawEditor();break;
    case "reset":
      ticketDraft.keepLook=false;
      ticketDraft.row.look=ticketArtworkEngine.defaults(ticketArtworkEngine.sanitize(ticketDraft.row));
      ticketDrawEditor();break;
    case "save":ticketSave();break;
    case "remove":
      if(confirm(tr("将这张票根移出收藏册？"))&&ticketWrite(ticketRead().filter(row=>row.id!==ticketDraft.original))){
        ticketDraft=null;ticketWallPage();
      }break;
    case "prev":ticketPage--;ticketWallPage();break;
    case "next":ticketPage++;ticketWallPage();break;
    case "export":ticketExport(b,false);break;
    case "single":ticketExport(b,true);break;
  }
}
function ticketCreatePage(){
  const panel=main.querySelector(".ticket-page");
  panel.innerHTML=`${subBackHTML()}<div class="ticket-heading"><h2 class="sec">${ticketDict("制作票根")}</h2><button class="ticket-alt" data-ticket-action="cancel">${ticketDict("返回收藏册")}</button></div>
  <div class="ticket-empty"><label>${ticketDict("搜索护照片库")}<input id="ticket-search" type="search" autocomplete="off"></label><div id="ticket-results" class="ticket-results"></div></div>`;
  ticketSearch("");panel.querySelector("#ticket-search").focus();
}

