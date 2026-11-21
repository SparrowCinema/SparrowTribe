// 我的票根收藏册（与网站 js/tickets.js 一致，2026-11-21 重做）：
// 票根 = 某一次观影的皮肤（utils/ticketstore.js）；按年 → 月连续滚动，先给 48 张、触底再补；
// 票面由页面里一块隐藏画布逐张画成图片（只画已加载的部分），缓存在本次打开期间；书脊模式不画图。
const R=require('../../../utils/tickets.js');
const Art=require('../../../utils/ticket-sketch.js');
const readArtPreference=key=>wx.getStorageSync(key);
const Tix=require('../../../utils/ticketstore.js');
const U=require('../../../utils/util.js');
const W=require('../../../utils/watched.js');
const I=require('../../../utils/i18n.js');
const CFG=require('../../../utils/cfg.js');
const app=getApp();
const DENS='sk-ticket-density',DENS_OPT=[['l','大图'],['m','中图'],['s','小图'],['spine','书脊']],STEP=48,PICK_MAX=24,PEND_STEP=60,TILE_W={l:300,m:200,s:130};
const say=phrase=>wx.showToast({title:I.tr(phrase),icon:'none'});
const stock=(w,h)=>wx.createOffscreenCanvas({type:'2d',width:w,height:h});
const iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const thumbOf=u=>/^https?:\/\/[^?#]+\/posters\/[^/?#]+\.(jpe?g|png)$/i.test(u||'')?u.replace(/\/posters\/([^/?#]+)\.(jpe?g|png)$/i,'/posters/w360/$1.jpg'):u;
const SITE='https://sparrowcinema.github.io/SparrowTribe/';
const artworkUrl=src=>/^(posters|images)\//i.test(src||'')?SITE+src:src;
const FACET_LABEL={programme:'专题',city:'城市',venue:'影院',format:'放映版本'};
const paths=new Map(); // 票面图片缓存：签名 → 临时文件
function image(node,src){
  return new Promise(resolve=>{
    if(!src)return resolve(null);
    const im=node.createImage();
    const done=value=>{clearTimeout(timer);im.onload=im.onerror=null;resolve(value);};
    const timer=setTimeout(()=>done(null),4500);
    im.onload=()=>done(im);im.onerror=()=>done(null);im.src=artworkUrl(src);
  });
}
async function poster(node,row,small){
  if(!row.art)return null;
  const t=small?thumbOf(row.art):row.art;
  return (await image(node,t))||(t!==row.art?await image(node,row.art):null);
}
function canvas(page,id){return new Promise(resolve=>wx.createSelectorQuery().in(page).select('#'+id).fields({node:true}).exec(result=>resolve(result?.[0]?.node||null)));}
const sigOf=(row,side,w,style)=>[row.key,side,w,side==='front'?style:'',R.packLook(row.look),row.crop,row.art,row.time,row.venue,row.hall,row.seat,row.format,row.title,row.programme].join('¦');
const monthTitle=(g,en)=>g.id==='undated'?I.tr('日期待定'):en?`${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][g.month-1]} ${g.year}`:`${g.year}年${g.month}月`;

Page({
  data:{i:{},ps:'',mode:'album',sum:{n:0,pending:0},query:'',text:'',years:[],year:'',facetsOpen:false,facets:[],chips:[],activeN:0,
    density:'m',densLabels:[],densIndex:1,artStyle:Art.normalize(),artStyleLabels:[],artStyleIndex:0,yearLabels:[],yearIndex:0,filterLabel:'',front:true,groups:[],shown:0,total:0,all:0,more:false,pick:false,pickN:0,exportOpen:false,ex:{},pending:[],pendingMore:0,results:[],loading:false},
  onLoad(params){
    this._ready=true;this._render=0;this._draft=null;this._original='';this._q={text:'',year:'',programme:[],city:[],venue:[],format:[]};
    this._pick=null;this._queue=[];this._busy=false;this._imgPatch={};this._limit=STEP;
    this._filmStyles=Art.readFilmStyles(readArtPreference);
    let density='m',artStyle=Art.normalize();
    try{density=wx.getStorageSync(DENS)||'m';artStyle=Art.normalize(wx.getStorageSync(Art.storageKey));}catch(e){}
    density=TILE_W[density]||density==='spine'?density:'m';
    CFG.bind(this);this.setData({i:I.dict(),density,densLabels:DENS_OPT.map(x=>I.tr(x[1])),densIndex:DENS_OPT.findIndex(x=>x[0]===density),
      artStyle,artStyleLabels:Art.styles.map(style=>I.tr(style.label)),artStyleIndex:Art.styles.findIndex(style=>style.id===artStyle)});wx.setNavigationBarTitle({title:I.tr('我的票根收藏册')});
    this.load();
    this.album();
    if(params.id)this.openEditor('film='+encodeURIComponent(params.id));
  },
  onShow(){
    CFG.chrome();
    if(this._shownOnce){
      let style=this.data.artStyle;
      try{style=Art.normalize(wx.getStorageSync(Art.storageKey));}catch(_){}
      const styleChanged=style!==this.data.artStyle;
      if(styleChanged)this.applyArtStyle(style);
      const filmStyles=Art.readFilmStyles(readArtPreference);
      const filmStylesChanged=filmStyles.size!==this._filmStyles.size||[...filmStyles].some(([filmId,value])=>this._filmStyles.get(filmId)!==value);
      this._filmStyles=filmStyles;
      if(filmStylesChanged)this._imgPatch={};
      if(this.data.mode==='album'){
        if(this._rev!==Tix.rev())this.album();
        else if(styleChanged||filmStylesChanged)this.paint(false);
      }
    }
    this._shownOnce=true;
  },
  onUnload(){this._ready=false;this._render++;this.__cfgOff?.();},
  onReachBottom(){if(this.data.mode==='album'&&this.data.more){this._limit+=STEP;this.paint('more');}},
  load(){
    this.data_=app.globalData.data;this.idx=U.index(this.data_);
    this._built=Tix.build(this.data_,this.idx);this._rev=Tix.rev();
    this._byKey=new Map(this._built.tickets.map(r=>[r.key,r]));
  },
  // ——— 收藏册 ———
  album(){
    if(this._rev!==Tix.rev())this.load();
    this._draft=null;++this._render;this._limit=STEP;
    const {tickets,pending}=this._built;
    this.setData({mode:'album',sum:{n:tickets.length,pending:pending.length}});
    this.paint(false);
  },
  paint(append){
    const {tickets}=this._built,q=this._q,all=R.facetCounts(tickets);
    if(q.year&&!all.year.some(y=>y.value===q.year))q.year='';
    R.FACETS.forEach(k=>{q[k]=q[k].filter(v=>all[k].some(x=>x.value===v));});
    const counts=R.facetCounts(tickets,q),yearN={};counts.year.forEach(y=>{yearN[y.value]=y.count;});
    const rows=R.filterTickets(tickets,q);this._rows=rows;
    const shownRows=rows.slice(0,this._limit),en=I.lang&&I.lang()==='en',monthN={};
    rows.forEach(r=>{const id=r.date.slice(0,7)||'undated';monthN[id]=(monthN[id]||0)+1;});
    const groups=R.groupByMonth(shownRows).map(g=>({id:g.id,title:monthTitle(g,en),n:monthN[g.id],items:g.rows.map(r=>this.item(r))}));
    const patch={shown:shownRows.length,total:rows.length,all:tickets.length,more:rows.length>shownRows.length};
    // 触底加载：前面的票根不变，只把新增的写进 setData，避免越滚越慢
    const sig=JSON.stringify([q,this.data.density,this.data.front,this.data.artStyle,this._rev]),prev=this.data.groups;
    if(append==='more'&&sig===this._sig&&prev.length){
      groups.forEach((g,gi)=>{const old=prev[gi];
        if(!old||old.id!==g.id){patch[`groups[${gi}]`]=g;return;}
        for(let ii=old.items.length;ii<g.items.length;ii++)patch[`groups[${gi}].items[${ii}]`]=g.items[ii];});
    }else patch.groups=groups;
    this._sig=sig;
    if(!append){
      const activeN=R.FACETS.reduce((n,k)=>n+q[k].length,0);
      this._years=all.year.map(y=>y.value);
      Object.assign(patch,{yearLabels:[I.tr('全部年份'),...all.year.map(y=>`${y.value}（${yearN[y.value]||0}）`)],yearIndex:q.year?this._years.indexOf(q.year)+1:0,text:q.text,
        filterLabel:activeN?(I.isEn()?activeN+' selected':`已选 ${activeN} 项`):q.text?`“${q.text}”`:I.tr('全部'),
        years:all.year.length>1?all.year.map(y=>({v:y.value,c:yearN[y.value]||0})):[],year:q.year,
        facets:R.FACETS.filter(k=>all[k].length>1||q[k].length).map(k=>({k,label:I.tr(FACET_LABEL[k]),items:counts[k].slice(0,k==='programme'?80:40).map(x=>({v:x.value,c:x.count,on:q[k].includes(x.value)}))})),
        chips:R.FACETS.flatMap(k=>q[k].map(v=>({k,v}))),activeN:R.FACETS.reduce((n,k)=>n+q[k].length,0)});
    }
    const turn=++this._render;this._queue=[];
    this.setData(patch,()=>{if(turn===this._render&&this.data.density!=='spine')this.queueAll(turn);});
  },
  styleFor(row){return this._filmStyles.get(row.filmId)||this.data.artStyle;},
  item(r){
    const c=R.swatch(r),p=!!(this._pick&&this._pick.has(r.key));
    const side=this.data.front?'front':'back',w=TILE_W[this.data.density]||TILE_W.m;
    return {k:r.key,t:r.title,img:paths.get(sigOf(r,side,w,this.styleFor(r)))||'',sw:c.mid,sa:c.accent,sb:c.stock,d:[r.date.replace(/-/g,'.'),r.time].filter(Boolean).join(' '),m:[r.venue,r.programme].filter(Boolean).join(' · '),p};
  },
  // ——— 逐张画票面（一块隐藏画布 → 临时图片） ———
  queueAll(turn){
    this.data.groups.forEach((g,gi)=>g.items.forEach((it,ii)=>{if(!it.img)this._queue.push({k:it.k,gi,ii,turn});}));
    this.pump();
  },
  async pump(){
    if(this._busy)return;this._busy=true;
    try{
      const node=await canvas(this,'ticket-worker');
      while(node&&this._ready&&this._queue.length){
        const job=this._queue.shift();if(job.turn!==this._render)continue;
        const row=this._byKey.get(job.k);if(!row)continue;
        const side=this.data.front?'front':'back',w=TILE_W[this.data.density]||TILE_W.m,artStyle=this.styleFor(row),sig=sigOf(row,side,w,artStyle);
        let path=paths.get(sig);
        if(!path){
          const h=Math.round(w*R.H/R.W);node.width=w;node.height=h;
          const ctx=node.getContext('2d'),rect={x:0,y:0,w,h};
          const art=side==='front'?await poster(node,row,true):null;
          if(job.turn!==this._render)continue;
          ctx.clearRect(0,0,w,h);R.draw(ctx,{...row,artStyle},side,art,rect,stock);
          path=await new Promise(resolve=>wx.canvasToTempFilePath({canvas:node,fileType:'png',success:r=>resolve(r.tempFilePath),fail:()=>resolve('')},this));
          if(path)paths.set(sig,path);
        }
        if(path&&job.turn===this._render){this._imgPatch[`groups[${job.gi}].items[${job.ii}].img`]=path;this.flushSoon();}
      }
    }finally{this._busy=false;}
  },
  flushSoon(){if(this._flushT)return;this._flushT=setTimeout(()=>{this._flushT=0;const p=this._imgPatch;this._imgPatch={};if(this._ready&&Object.keys(p).length)this.setData(p);},120);},
  // ——— 工具条 ———
  inputQuery(e){const v=e.detail.value;clearTimeout(this._qt);this._qt=setTimeout(()=>{this._q.text=v;this._limit=STEP;this.paint(false);},200);},
  pickYear(e){this._q.year=e.currentTarget.dataset.v;this._limit=STEP;this.paint(false);},
  pickArtStyle(e){
    const artStyleIndex=Number(e.detail.value),style=Art.styles[artStyleIndex];
    if(!style||style.id===this.data.artStyle)return;
    try{wx.setStorageSync(Art.storageKey,style.id);}catch(_){}
    Art.markArt(readArtPreference,(k,v)=>wx.setStorageSync(k,v),null);Tix.nudge();
    this.applyArtStyle(style.id);
    this.paint(false);
  },
  applyArtStyle(artStyle){
    this._imgPatch={};
    this.setData({artStyle,artStyleIndex:Art.styles.findIndex(style=>style.id===artStyle),front:true});
  },
  toggleFacets(){this.setData({facetsOpen:!this.data.facetsOpen});},
  stopMove(){},
  pickYearIdx(e){const n=Number(e.detail.value);this._q.year=n?this._years[n-1]:'';this._limit=STEP;this.paint(false);},
  pickDens(e){const d=DENS_OPT[Number(e.detail.value)][0];try{wx.setStorageSync(DENS,d);}catch(_){}this.setData({density:d,densIndex:Number(e.detail.value)});this.paint(false);},
  clearAll(){R.FACETS.forEach(k=>{this._q[k]=[];});this._q.text='';this._q.year='';this._limit=STEP;this.paint(false);},
  toggleFacet(e){const {k,v}=e.currentTarget.dataset,l=this._q[k];this._q[k]=l.includes(v)?l.filter(x=>x!==v):[...l,v];this._limit=STEP;this.paint(false);},
  clearFacets(){R.FACETS.forEach(k=>{this._q[k]=[];});this._limit=STEP;this.paint(false);},
  setDensity(e){const d=e.currentTarget.dataset.v;try{wx.setStorageSync(DENS,d);}catch(_){}this.setData({density:d});this.paint(false);},
  flipWall(){this.setData({front:!this.data.front});this.paint(false);},
  tapTicket(e){
    const k=e.currentTarget.dataset.k,row=this._byKey.get(k);if(!row)return;
    if(this._pick){
      if(this._pick.has(k))this._pick.delete(k);else if(this._pick.size>=PICK_MAX){wx.showToast({title:I.tr('精选墙最多')+' '+PICK_MAX+' '+I.tr('张票根'),icon:'none'});return;}else this._pick.add(k);
      const {gi,ii}=e.currentTarget.dataset;this.setData({[`groups[${gi}].items[${ii}].p`]:this._pick.has(k),pickN:this._pick.size});return;
    }
    this.openEditor('key='+encodeURIComponent(row.key));
  },
  // ——— 待制作 ———
  openPending(){this._pendShown=PEND_STEP;this.pendingView();wx.pageScrollTo({scrollTop:0,duration:0});},
  pendingView(){
    if(this._rev!==Tix.rev())this.load();
    const {pending}=this._built,base=Tix.baseFor(this.data_,this.idx),shown=pending.slice(0,this._pendShown||PEND_STEP);
    this._draft=null;++this._render;
    this.setData({mode:'pending',sum:{n:this._built.tickets.length,pending:pending.length},pendingMore:pending.length-shown.length,
      pending:shown.map(x=>{const f=this.idx.F[x.filmId],b=base(x.filmId,x.view,x.view.d)||{};return {k:x.key,t:(f&&f.cn)||x.filmId,poster:f?U.thumb(f):'',m:[x.view.d.replace(/-/g,'.'),b.time,b.venue].filter(Boolean).join(' · ')};})});
  },
  morePending(){this._pendShown=(this._pendShown||PEND_STEP)+PEND_STEP;this.pendingView();},
  makeAll(){
    const {pending}=this._built;if(!pending.length)return;
    const t=Date.now(),changes={};pending.forEach(x=>{changes[x.key]={t};});
    if(!Tix.set(changes,this.data_,this.idx))return;
    this.load();this.album();wx.showToast({title:I.tr('已生成')+' '+pending.length+' '+I.tr('张票根'),icon:'none'});
  },
  openPendingItem(e){this.openEditor('key='+encodeURIComponent(e.currentTarget.dataset.k));},
  // ——— 制作 ———
  start(){this._draft=null;++this._render;this.setData({mode:'search',query:''});this.search('');},
  inputSearch(e){const query=e.detail.value;this.setData({query});this.search(query);},
  search(query){
    const data=this.data_,terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const films=terms.length?data.films.filter(f=>!f.ev&&terms.every(term=>`${f.cn} ${f.o||''} ${f.en||''} ${f.dir||''}`.toLowerCase().includes(term))).slice(0,30):
      W.entries(data,this.idx).slice(-18).reverse().map(e=>e.f);
    this.setData({results:films.map(f=>({id:f.id,title:f.cn,poster:U.thumb(f)}))});
  },
  openFilm(e){this.album();this.openEditor('film='+encodeURIComponent(e.currentTarget.dataset.id));},
  // 票根详情 / 编辑是独立页面（pages/ticket-edit）：系统返回手势、页面滚动都是原生的
  openEditor(q){wx.navigateTo({url:'/packages/collect/ticket-edit/ticket-edit?'+q});},
  backAlbum(){this.album();},
  // ——— 导出 ———
  toggleExport(){
    if(this.data.exportOpen){this.setData({exportOpen:false});return;}
    const counts=R.facetCounts(this._built.tickets);
    this._exYears=counts.year.map(y=>y.value);this._exProgs=counts.programme.map(p=>p.value);
    this.setData({exportOpen:true,ex:{kind:'current',years:counts.year.map(y=>`${y.value}（${y.count}）`),progs:counts.programme.map(p=>`${p.value}（${p.count}）`),y:0,p:0,part:0}},()=>this.exParts());
  },
  exKindTap(e){this.setData({'ex.kind':e.currentTarget.dataset.kind,'ex.part':0},()=>this.exParts());},
  exKind(e){this.setData({'ex.kind':e.detail.value,'ex.part':0},()=>this.exParts());},
  exYear(e){this.setData({'ex.y':Number(e.detail.value),'ex.kind':'year','ex.part':0},()=>this.exParts());},
  exProg(e){this.setData({'ex.p':Number(e.detail.value),'ex.kind':'prog','ex.part':0},()=>this.exParts());},
  exPart(e){this.setData({'ex.part':Number(e.detail.value)});},
  exRows(){
    const ex=this.data.ex,t=this._built.tickets;
    if(ex.kind==='year')return R.filterTickets(t,{year:this._exYears[ex.y]});
    if(ex.kind==='prog')return R.filterTickets(t,{programme:[this._exProgs[ex.p]]});
    if(ex.kind==='pick')return t.filter(r=>this._pick&&this._pick.has(r.key));
    return this._rows||t;
  },
  exParts(){const n=this.exRows().length,k=Math.ceil(n/R.MOSAIC_MAX);this.setData({'ex.n':n,'ex.parts':k>1?Array.from({length:k},(_,i)=>`${i+1} / ${k}`):[]});},
  exGo(){
    if(this.data.loading||(this.data.ex.kind!=='pick'&&!this.data.ex.n))return;
    if(this.data.ex.kind==='pick'){this._pick=new Set();this.setData({exportOpen:false,pick:true,pickN:0});this.paint(true);return;}
    this.exportWall(false);
  },
  pickExport(){this.setData({'ex.kind':'pick','ex.part':0});this.exportWall(true);},
  pickCancel(){this._pick=null;this.setData({pick:false,pickN:0});this.paint(true);},
  exportWall(){this.export(false);},
  async export(single){
    if(this.data.loading)return;
    const ex=this.data.ex||{},side=single?this._side:(this.data.front?'front':'back');
    let rows,title=I.tr('我的票根收藏册'),caption='',part=0,parts=1;
    if(single)rows=[{...this._draft,look:{...this._draft.look}}];
    else{
      const all=this.exRows();parts=Math.max(1,Math.ceil(all.length/R.MOSAIC_MAX));part=Math.min(ex.part||0,parts-1);
      rows=all.slice(part*R.MOSAIC_MAX,(part+1)*R.MOSAIC_MAX);
      title=ex.kind==='year'?this._exYears[ex.y]+' '+I.tr('年度票根墙'):ex.kind==='prog'?this._exProgs[ex.p]+I.tr('票根墙'):ex.kind==='pick'?I.tr('精选票根墙'):title;
      caption=[`${all.length} ${I.tr('张票根')}`,I.tr(side==='front'?'正面':'背面'),parts>1?`${part+1} / ${parts}`:''].filter(Boolean).join(' · ');
    }
    if(!rows.length)return;
    rows=rows.map(row=>({...row,artStyle:this.styleFor(row)}));
    this.setData({loading:true});wx.showLoading({title:I.tr('正在生成图片'),mask:true});
    try{
      const node=await canvas(this,'ticket-export-canvas');
      if(!node)throw Error('Canvas');
      const small=rows.length>12,images=await Promise.all(rows.map(r=>side==='front'?poster(node,r,small):null));
      const layout=single?{width:R.W*3,height:R.H*3}:R.wallLayout(rows.length,1440);
      node.width=layout.width;node.height=layout.height;
      const ctx=node.getContext('2d');
      if(single)R.draw(ctx,rows[0],side,images[0],{x:0,y:0,w:node.width,h:node.height},stock);
      else R.drawWall(ctx,rows,side,images,caption,stock,title,1440);
      const jpg=!single&&rows.length>12;
      const file=await new Promise((resolve,reject)=>wx.canvasToTempFilePath({canvas:node,fileType:jpg?'jpg':'png',quality:.9,success:r=>resolve(r.tempFilePath),fail:reject},this));
      if(this._ready){
        wx.hideLoading();this.setData({loading:false});
        if(side==='front'&&images.some((im,i)=>!im&&rows[i].art))say('海报读取失败，已用片名代替');
        wx.showActionSheet({itemList:[I.tr('保存到相册'),I.tr('预览并发给朋友')],success:choice=>{
          if(choice.tapIndex===0)wx.saveImageToPhotosAlbum({filePath:file,success:()=>say('已保存到相册'),fail:()=>wx.previewImage({urls:[file]})});
          else wx.previewImage({urls:[file]});
        }});
      }
    }catch(e){if(this._ready)say('图片生成失败，请稍后再试');}
    finally{if(!this._ready||this.data.loading)wx.hideLoading();if(this._ready)this.setData({loading:false});}
  }
});
