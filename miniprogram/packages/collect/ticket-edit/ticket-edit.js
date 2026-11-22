// 票根详情 / 编辑（2026-11-21 起独立成页，从收藏册 navigateTo 进来，系统返回手势与页面滚动都是原生的）。
// 预览：在隐藏画布上画好正面、背面，各存成一张图片（与收藏册缩略图同一条路，手机上稳定），
// 用 <image> 显示，倾斜、翻面用 CSS 3D 变换完成，高光是一层随手指移动的渐变——不再逐帧在画布上重画。
// 参数：key=票根键（已收藏或待制作），film=影片id（没有观影记录时新建手工票根）。
const R=require('../../../utils/tickets.js');
const TitleFont=require('../utils/ticket-font.js');
const REVEALED='sk-ticket-revealed';
const revealedSet=()=>{try{return wx.getStorageSync(REVEALED)||{};}catch(e){return {};}};
function markRevealed(key){
  if(!key)return;const set=revealedSet();set[key]=1;const keys=Object.keys(set);
  if(keys.length>6000)keys.slice(0,keys.length-6000).forEach(k=>delete set[k]);
  try{wx.setStorageSync(REVEALED,set);}catch(e){}
}
const Art=require('../../../utils/ticket-sketch.js');
const readArtPreference=key=>wx.getStorageSync(key);
const Tix=require('../../../utils/ticketstore.js');
const W=require('../../../utils/watched.js');
const U=require('../../../utils/util.js');
const I=require('../../../utils/i18n.js');
const CFG=require('../../../utils/cfg.js');
const app=getApp();
const SITE='https://sparrowcinema.github.io/SparrowTribe/';
const FACE_W=600,FAST_W=360,FACE_H=Math.round(FACE_W*R.H/R.W);
const say=phrase=>wx.showToast({title:I.tr(phrase),icon:'none'});
const stock=(w,h)=>wx.createOffscreenCanvas({type:'2d',width:w,height:h});
const iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const artworkUrl=src=>/^(posters|images)\//i.test(src||'')?SITE+src:src;
// 票面改动（裁切 / 配图）的指纹：和上次保存时不同才点亮「保存」
const artSig=d=>[d.crop,d.art].join('|');
const sigOf=(row,side)=>[side,side==='front'?row.artStyle:'',R.lookSig(row.look),row.crop,row.art,row.title,row.subtitle,row.date,row.time,row.venue,row.hall,row.city,row.seat,row.format,row.programme,row.section].join('¦');
function canvas(page,id){return new Promise(resolve=>wx.createSelectorQuery().in(page).select('#'+id).fields({node:true}).exec(r=>resolve(r&&r[0]&&r[0].node||null)));}
function image(node,src){
  return new Promise(resolve=>{
    if(!src||!node||!node.createImage)return resolve(null);
    const im=node.createImage();
    const done=v=>{clearTimeout(timer);im.onload=im.onerror=null;resolve(v);};
    const timer=setTimeout(()=>done(null),6000);
    im.onload=()=>done(im);im.onerror=()=>done(null);im.src=artworkUrl(src);
  });
}

Page({
  data:{i:{},ps:'',ok:false,draft:{},front:true,frontImg:'',backImg:'',turnReq:{side:'front',n:0},edge:'',shine:'metal',fx:'none',layersF:[],layersB:[],craft:'',custom:false,revealing:false,
    arts:[],artIndex:0,artStyleLabels:[],artStyleIndex:0,shows:[],showIdx:-1,existing:false,linked:false,loading:false,busy:true,artDirty:false},
  onLoad(q){
    this._albumArtStyle=Art.normalize();
    try{this._albumArtStyle=Art.normalize(readArtPreference(Art.storageKey));}catch(_){}
    this._ready=true;this._turn=0;this._cache=new Map();
    CFG.bind(this);this.setData({i:I.dict(),artStyleLabels:Art.filmStyleOptions.map(style=>I.tr(style.label))});
    this.data_=app.globalData.data;this.idx=U.index(this.data_);this.base=Tix.baseFor(this.data_,this.idx);
    const key=q.key?decodeURIComponent(q.key):'',film=q.film?decodeURIComponent(q.film):'';
    const built=Tix.build(this.data_,this.idx),views=Tix.viewings(this.idx);
    let row=null,original='';
    const fresh=item=>{const r=R.build([item],{[item.key]:{t:Date.now()}},this.base).tickets[0];return r;};
    if(key){
      const have=built.tickets.find(r=>r.key===key);
      if(have){row={...have,look:{...have.look}};original=key;}
      else{const item=views.find(x=>x.key===key);if(item)row=fresh(item);}
    }else if(film&&this.idx.F[film]){
      const mine=views.filter(x=>x.filmId===film).sort((a,b)=>b.view.d.localeCompare(a.view.d));
      // 每次观影一张：打开最近一次观影的票根（没做过就新建）
      const item=mine[0];
      const have=item&&built.tickets.find(r=>r.key===item.key);
      if(have){row={...have,look:{...have.look}};original=item.key;}
      else if(item)row=fresh(item);
      else{
        // 先找这部电影以前做过、现在没对上观影记录的票根（比如移出过护照），接着编辑它
        const st=Tix.all(),old=Object.keys(st).filter(k=>k.startsWith(film+'|')&&!st[k].del&&R.parseKey(k)).sort((x,y)=>(st[y].t||0)-(st[x].t||0))[0];
        const prev=old&&R.draft(old,st[old],this.base);
        if(prev){row=prev;original=old;}
        else{const k=Tix.freeKey(film,iso(new Date()),this.idx);const r=k&&R.draft(k,{t:Date.now()},this.base);if(r){row=r;}}}
    }
    if(!row){say('找不到这张票根');setTimeout(()=>wx.navigateBack({fail:()=>wx.redirectTo({url:'/packages/collect/tickets/tickets'})}),600);return;}
    const item=row.linked?views.find(x=>x.key===row.key):null;
    this._view=item?item.view:null;this._original=original;
    this.setup(row);
    wx.setNavigationBarTitle({title:I.tr(original?'编辑票根':'新票根')});
  },
  onShow(){CFG.chrome();},
  onUnload(){this._ready=false;this._turn++;this.__cfgOff&&this.__cfgOff();},
  setup(row){
    if(row.art)row.art=artworkUrl(row.art);
    this._draft=row;
    // 拆盲盒（2026-11-22）：本机第一次打开这张票根时先亮背面，再自动翻到正面揭晓（已拆过的键存在本机 sk-ticket-revealed）
    this._reveal=revealedSet()[row.key]?'':'pending';
    const style=Art.readFilmStyles(readArtPreference).get(row.filmId)||'';
    this._artStyle=style||this._albumArtStyle;
    this._artSaved=this._original?artSig(row):'';
    this._art=[...(row.arts||[])].map(artworkUrl);
    if(row.art&&!this._art.includes(row.art))this._art.unshift(row.art);
    // 场次：手工票根列出本片全部场次；来自观影记录的只列当天
    this._shows=(this.data_.shows||[]).filter(x=>x.id===row.filmId).map(x=>{const v=this.idx.VN[x.v];return {date:iso(U.showDate(x)),time:x.t,venue:(v&&v.name)||'',hall:this.idx.hallName(x)||'',city:(v&&v.city)||''};})
      .filter(x=>!row.linked||x.date===row.date).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
    this.setData({ok:true,draft:row,existing:!!this._original,artDirty:!this._original,linked:!!row.linked,
      artStyleIndex:Art.filmStyleOptions.findIndex(option=>option.id===style),
      arts:this._art.map((_,i)=>I.tr(i===0?'海报':'备用图像')+' '+(i+1)),artIndex:Math.max(0,this._art.indexOf(row.art)),
      shows:this._shows.map(x=>`${x.date.slice(5).replace('-','/')} ${x.time} · ${x.venue}${x.hall?' '+x.hall:''}`),showIdx:this.showIndex(),
      shine:R.shineOf(row.look.finish).kind},()=>this.renderFaces());
  },
  showIndex(){const d=this._draft;return this._shows.findIndex(x=>x.date===d.date&&x.time===d.time&&x.venue===d.venue);},
  // ——— 预览：画成图片 ———
  // fast：拖动裁切时用，导出一张较小的图（编码快很多），松手后再画清晰的
  async faceImage(node,side,turn,fast){
    const row={...this._draft,artStyle:this._artStyle},sig=sigOf(row,side)+(fast?'¦fast':'');
    if(this._cache.has(sig))return this._cache.get(sig);
    let art=null;
    if(side==='front'&&row.art){
      if(this._artSrc!==row.art){this._artSrc=row.art;this._artImage=image(node,row.art);}
      art=await this._artImage;
    }
    await TitleFont.ready();
    if(turn!==this._turn||!this._ready)return '';
    node.width=FACE_W;node.height=FACE_H;
    const ctx=node.getContext('2d');
    ctx.clearRect(0,0,FACE_W,FACE_H);
    R.draw(ctx,row,side,art,{x:0,y:0,w:FACE_W,h:FACE_H},stock);
    const path=await new Promise(resolve=>wx.canvasToTempFilePath({canvas:node,fileType:'png',...(fast?{destWidth:FAST_W,destHeight:Math.round(FAST_W*FACE_H/FACE_W)}:{}),success:r=>resolve(r.tempFilePath),fail:()=>resolve('')},this));
    if(path&&turn===this._turn&&this._ready){this._cache.set(sig,path);if(this._cache.size>24)this._cache.delete(this._cache.keys().next().value);}
    return path;
  },
  // 工艺反光层：每面最多三层——底箔反光、工艺组合里的烫印增效（同一张工艺遮罩）、隐形底纹（正面在海报上、遮罩从海报算出；背面铺满背面）。
  // 遮罩画在隐藏画布上转成 data URI 给 .te-fx 当 mask-image；尺寸小即可（210px 宽）
  async fxLayers(node,side,turn){
    const row={...this._draft,artStyle:this._artStyle},base=R.fxOf(row.look.finish),extra=R.parseCraft(row.look.craft).foil.find(fx=>fx!==base);
    const sig=sigOf(row,side)+'¦fx';
    if(this._cache.has(sig))return this._cache.get(sig);
    const art=side==='front'&&row.art?await this._artImage:null;
    if(turn!==this._turn||!this._ready)return [];
    const w=210,h=Math.round(w*R.H/R.W),layers=[];
    const snap=paint=>{node.width=w;node.height=h;const ctx=node.getContext('2d');ctx.clearRect(0,0,w,h);try{return paint(ctx)?node.toDataURL('image/png'):'';}catch(e){return '';}};
    if(base!=='none'||extra){
      const m=snap(ctx=>R.foilMask(ctx,row,side,{x:0,y:0,w,h},stock,!!art));
      if(m){if(base!=='none')layers.push({i:'b',fx:base,k:1,m});if(extra)layers.push({i:'e',fx:extra,k:.7,m});}
    }
    if(art){
      let mask=null;try{mask=R.artMask(row,art,stock,w);}catch(e){mask=null;}
      const m=mask&&snap(ctx=>{ctx.drawImage(mask,0,0,w,h);return true;});
      if(m)layers.push({i:'a',fx:mask.fx,k:1,m});
    }
    if(side==='back'){
      let mask=null;try{mask=R.backMask(row,stock,w);}catch(e){mask=null;}
      const m=mask&&snap(ctx=>{ctx.drawImage(mask,0,0,w,h);return true;});
      if(m)layers.push({i:'k',fx:mask.fx,k:1,m});
    }
    if(turn===this._turn)this._cache.set(sig,layers);
    return layers;
  },
  async renderFaces(first=this.data.front?'front':'back'){
    if(!this._draft||!this._ready)return;
    const turn=++this._turn;
    let node=null;
    for(let i=0;i<10&&!node;i++){node=await canvas(this,'te-worker');if(!node)await new Promise(r=>setTimeout(r,60));if(turn!==this._turn)return;}
    if(!node)return;
    this.setData({busy:true});
    // 先画当前看的一面，另一面随后补上
    const second=first==='front'?'back':'front';
    for(const side of [first,second]){
      if(turn!==this._turn||!this._ready)return;
      const path=await this.faceImage(node,side,turn);
      if(turn!==this._turn||!this._ready)return;
      if(path)this.setData({[side==='front'?'frontImg':'backImg']:path});
    }
    const {kind,fx}=R.shineOf(this._draft.look.finish);
    const layersF=await this.fxLayers(node,'front',turn),layersB=await this.fxLayers(node,'back',turn);
    if(turn!==this._turn||!this._ready)return;
    const custom=R.lookSig(this._draft.look)!==R.lookSig(R.sanitize({...this._draft,look:null}).look);
    const patch={busy:false,shine:kind,fx,layersF,layersB,custom,craft:R.craftLabel(this._draft.look,I.tr),edge:R.edgeOf(this._draft),turnReq:{...this.data.turnReq,kind,fx}};
    if(this._reveal==='pending'){
      this._reveal='running';this._turnN=(this._turnN||0)+1;patch.turnReq={side:'back',n:this._turnN,kind,fx,snap:1};patch.front=false;
      const key=this._draft.key;
      setTimeout(()=>{
        if(!this._ready)return;
        this.setData({revealing:true});this.turnTo('front');
        setTimeout(()=>{if(this._ready){this._reveal='done';this.setData({revealing:false});}markRevealed(key);},2000);
      },750);
    }
    this.setData(patch);
  },
  // 拖动裁切时实时预览（与网页一致）：只重画正面，上一张还没画完就只记下「还要再画」，画完立刻按最新位置再画一张，
  // 不会排队堆积，也不用等手指停下；松手（bindchange）后再按原来的流程画清晰的正反面
  async liveCrop(){
    if(this._liveBusy){this._livePending=true;return;}
    this._liveBusy=true;
    try{
      do{
        this._livePending=false;
        const turn=++this._turn,node=await canvas(this,'te-worker');
        if(!node||turn!==this._turn||!this._ready)break;
        const path=await this.faceImage(node,'front',turn,true);
        if(path&&turn===this._turn&&this._ready)this.setData({frontImg:path});
      }while(this._livePending&&this._ready);
    }finally{this._liveBusy=false;}
  },
  soon(ms){clearTimeout(this._soonT);this._soonT=setTimeout(()=>this.renderFaces(),ms);},
  // ——— 360° 转动（turn.wxs 在视图层跟手，这里只发请求、收结果） ———
  turnTo(side){this._turnN=(this._turnN||0)+1;this.setData({turnReq:{side,n:this._turnN,kind:this.data.shine,fx:this.data.fx}});},
  flip(){this.turnTo(this.data.front?'back':'front');},
  turned(e){const front=!!(e&&e.front);if(front!==this.data.front)this.setData({front});},
  setSide(e){if((e.currentTarget.dataset.side==='front')!==this.data.front)this.turnTo(e.currentTarget.dataset.side);},
  // ——— 编辑 ———
  reset(){this._draft.look=R.sanitize({...this._draft,look:null}).look;this.renderFaces();},
  changeField(e){
    const name=e.currentTarget.dataset.field,d=this._draft;
    d[name]=name==='crop'?Number(e.detail.value):e.detail.value;
    const patch={['draft.'+name]:d[name]};
    if(['date','time','venue'].includes(name))patch.showIdx=this.showIndex();
    this.setData(patch);
    // 裁切只作用于正面海报：在看背面时拖动先翻回正面
    if(name==='crop'){this.artState();if(!this.data.front)this.turnTo('front');}
    if(name==='crop'&&e.type==='changing'){clearTimeout(this._soonT);this.liveCrop();return;}
    this.soon(name==='crop'?120:350);
  },
  chooseShow(e){
    const x=this._shows[Number(e.detail.value)],d=this._draft;if(!x)return;
    if(!d.linked)d.date=x.date;
    Object.assign(d,{time:x.time,venue:x.venue,hall:x.hall,city:x.city});
    this.setData({draft:d,showIdx:Number(e.detail.value)});this.renderFaces();
  },
  pickArtStyle(e){
    const artStyleIndex=Number(e.detail.value),style=Art.filmStyleOptions[artStyleIndex];
    if(!style||artStyleIndex===this.data.artStyleIndex)return;
    if(!Art.saveFilmStyle(readArtPreference,(key,value)=>wx.setStorageSync(key,value),this._draft.filmId,style.id)){
      say('票根保存失败，请检查本机存储');return;
    }
    Art.markArt(readArtPreference,(k,v)=>wx.setStorageSync(k,v),this._draft.filmId);Tix.nudge();
    this._artStyle=style.id||this._albumArtStyle;
    this.setData({artStyleIndex});
    if(!this.data.front)this.turnTo('front');
    this.renderFaces('front');
  },
  chooseArt(e){this._draft.art=this._art[Number(e.detail.value)];this._draft.crop=50;this.setData({artIndex:Number(e.detail.value),'draft.crop':50});this.artState();this.renderFaces();},
  artState(){const dirty=!this._original||artSig(this._draft)!==this._artSaved;if(dirty!==this.data.artDirty)this.setData({artDirty:dirty});},
  saveHere(){if(this.data.artDirty)this.store(true);},
  store(stay){
    const d=this._draft,row=R.sanitize({...d});
    if(!row.date){say('请填写放映日期');return;}
    let key=d.key,stamped=false;
    // 给还没盖章的电影做票根时同时盖章（观影日期＝票根日期），票根与观影护照保持一部一张
    const rec=W.get(row.filmId);
    if(!d.linked&&(!rec||rec.del)){
      W.set(row.filmId,{d:row.date,r:0,k:''});stamped=true;
      const item=Tix.viewings(this.idx).find(x=>x.filmId===row.filmId);
      if(item){key=item.key;d.key=key;d.linked=true;this._view=item.view;this.setData({linked:true});}
    }
    if(!d.linked){const p=R.parseKey(key);if(!p||p.date!==row.date)key=Tix.freeKey(row.filmId,row.date,this.idx,this._original);if(!key){say('这一天的票根已经太多了');return;}}
    const base=this.base(row.filmId,d.linked?this._view:null,row.date);
    const changes={[key]:base?R.entryFrom({...row,id:key},{...base,id:key}):{t:Date.now()}};
    if(this._original&&this._original!==key)changes[this._original]={del:1,t:Date.now()};
    if(!Tix.set(changes,this.data_,this.idx))return;
    if(stay===true){this._original=key;this._draft.key=key;this._artSaved=artSig(this._draft);this.setData({existing:true,artDirty:false});say(stamped?'已同时盖章 · 加入观影护照':'已保存');return;}
    wx.navigateBack({success:()=>say(stamped?'已同时盖章 · 加入观影护照':'已收进典藏票根册'),fail:()=>wx.redirectTo({url:'/packages/collect/tickets/tickets'})});
  },
  remove(){
    const linked=this._draft&&this._draft.linked;
    wx.showModal({title:I.tr('移出票根'),content:I.tr(linked?'将这张票根移出收藏册？这次观影会回到「待制作」。':'将这张票根移出收藏册？'),success:r=>{
      if(r.confirm&&Tix.set({[this._original]:{del:1,t:Date.now()}},this.data_,this.idx))wx.navigateBack({fail:()=>wx.redirectTo({url:'/packages/collect/tickets/tickets'})});
    }});
  },
  // ——— 导出这张 ———
  async exportSingle(){
    if(this.data.loading)return;
    const side=this.data.front?'front':'back',row={...this._draft,look:{...this._draft.look},artStyle:this._artStyle};
    this.setData({loading:true});wx.showLoading({title:I.tr('正在生成图片'),mask:true});
    try{
      const node=await canvas(this,'te-export');if(!node)throw Error('canvas');
      const [art]=await Promise.all([side==='front'?image(node,row.art):null,TitleFont.ready()]);
      node.width=R.W*3;node.height=R.H*3;
      R.draw(node.getContext('2d'),row,side,art,{x:0,y:0,w:node.width,h:node.height},stock);
      const file=await new Promise((resolve,reject)=>wx.canvasToTempFilePath({canvas:node,fileType:'png',success:r=>resolve(r.tempFilePath),fail:reject},this));
      wx.hideLoading();this.setData({loading:false});
      if(side==='front'&&row.art&&!art)say('海报读取失败，已用片名代替');
      wx.showActionSheet({itemList:[I.tr('保存到相册'),I.tr('预览并发给朋友')],success:c=>{
        if(c.tapIndex===0)wx.saveImageToPhotosAlbum({filePath:file,success:()=>say('已保存到相册'),fail:()=>wx.previewImage({urls:[file]})});
        else wx.previewImage({urls:[file]});
      }});
    }catch(e){wx.hideLoading();this.setData({loading:false});say('图片生成失败，请稍后再试');}
  }
});
