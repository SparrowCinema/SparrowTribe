// 票根详情 / 编辑（2026-11-21 起独立成页，从收藏册 navigateTo 进来，系统返回手势与页面滚动都是原生的）。
// 预览：在隐藏画布上画好正面、背面，各存成一张图片（与收藏册缩略图同一条路，手机上稳定），
// 用 <image> 显示，倾斜、翻面用 CSS 3D 变换完成，高光是一层随手指移动的渐变——不再逐帧在画布上重画。
// 参数：key=票根键（已收藏或待制作），film=影片id（没有观影记录时新建手工票根）。
const R=require('../../utils/tickets.js');
const Tix=require('../../utils/ticketstore.js');
const U=require('../../utils/util.js');
const I=require('../../utils/i18n.js');
const CFG=require('../../utils/cfg.js');
const app=getApp();
const SITE='https://sparrowcinema.github.io/SparrowTribe/';
const FACE_W=600,FACE_H=Math.round(FACE_W*R.H/R.W),FLIP_MS=180;
const say=phrase=>wx.showToast({title:I.tr(phrase),icon:'none'});
const stock=(w,h)=>wx.createOffscreenCanvas({type:'2d',width:w,height:h});
const iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const artworkUrl=src=>/^(posters|images)\//i.test(src||'')?SITE+src:src;
const clamp=v=>Math.max(0,Math.min(1,v));
// 随手指移动的高光：镭射箔带一点彩虹色，金属箔是白色反光，哑光几乎没有
function glowCss(x,y,kind){
  const at=`circle at ${x}% ${y}%`;
  if(kind==='spectrum')return `radial-gradient(${at},rgba(255,255,255,.42),rgba(255,170,235,.16) 22%,rgba(130,225,255,.12) 38%,rgba(255,240,170,.06) 52%,rgba(255,255,255,0) 64%)`;
  if(kind==='soft')return `radial-gradient(${at},rgba(255,255,255,.12),rgba(255,255,255,0) 55%)`;
  return `radial-gradient(${at},rgba(255,255,255,.36),rgba(255,255,255,0) 52%)`;
}
// 票面改动（裁切 / 配图）的指纹：和上次保存时不同才点亮「保存」
const artSig=d=>[d.crop,d.art].join('|');
const sigOf=(row,side)=>[side,R.packLook(row.look),row.crop,row.art,row.title,row.subtitle,row.date,row.time,row.venue,row.hall,row.city,row.seat,row.format,row.programme,row.section].join('¦');
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
  data:{i:{},ps:'',ok:false,draft:{},front:true,frontImg:'',backImg:'',rx:-2,ry:-4,turning:false,snap:false,glowBg:'',shine:'metal',
    arts:[],artIndex:0,shows:[],showIdx:-1,existing:false,linked:false,loading:false,busy:true,artDirty:false},
  onLoad(q){
    this._ready=true;this._turn=0;this._cache=new Map();
    CFG.bind(this);this.setData({i:I.dict()});
    this.data_=app.globalData.data;this.idx=U.index(this.data_);this.base=Tix.baseFor(this.data_,this.idx);
    const key=q.key?decodeURIComponent(q.key):'',film=q.film?decodeURIComponent(q.film):'';
    const built=Tix.build(this.data_,this.idx),views=Tix.viewings(this.idx);
    let row=null,original='';
    const fresh=item=>{const r=R.build([item],{[item.key]:{t:Date.now()}},this.base).tickets[0];if(r)r.look=R.randomLook(r);return r;};
    if(key){
      const have=built.tickets.find(r=>r.key===key);
      if(have){row={...have,look:{...have.look}};original=key;}
      else{const item=views.find(x=>x.key===key);if(item)row=fresh(item);}
    }else if(film&&this.idx.F[film]){
      const mine=views.filter(x=>x.filmId===film).sort((a,b)=>b.view.d.localeCompare(a.view.d));
      const made=new Set(built.tickets.map(r=>r.key));
      const item=mine.find(x=>!made.has(x.key))||mine[0];
      if(item&&made.has(item.key)){const have=built.tickets.find(r=>r.key===item.key);row={...have,look:{...have.look}};original=item.key;}
      else if(item)row=fresh(item);
      else{const k=Tix.freeKey(film,iso(new Date()),this.idx);const r=k&&R.build([],{[k]:{t:Date.now()}},this.base).tickets[0];if(r){r.look=R.randomLook(r);row=r;}}
    }
    if(!row){say('找不到这张票根');setTimeout(()=>wx.navigateBack({fail:()=>wx.redirectTo({url:'/pages/tickets/tickets'})}),600);return;}
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
    this._artSaved=this._original?artSig(row):'';
    this._art=[...(row.arts||[])].map(artworkUrl);
    if(row.art&&!this._art.includes(row.art))this._art.unshift(row.art);
    // 场次：手工票根列出本片全部场次；来自观影记录的只列当天
    this._shows=(this.data_.shows||[]).filter(x=>x.id===row.filmId).map(x=>{const v=this.idx.VN[x.v];return {date:iso(U.showDate(x)),time:x.t,venue:(v&&v.name)||'',hall:this.idx.hallName(x)||'',city:(v&&v.city)||''};})
      .filter(x=>!row.linked||x.date===row.date).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
    this.setData({ok:true,draft:row,existing:!!this._original,artDirty:!this._original,linked:!!row.linked,
      arts:this._art.map((_,i)=>I.tr(i===0?'海报':'备用图像')+' '+(i+1)),artIndex:Math.max(0,this._art.indexOf(row.art)),
      shows:this._shows.map(x=>`${x.date.slice(5).replace('-','/')} ${x.time} · ${x.venue}${x.hall?' '+x.hall:''}`),showIdx:this.showIndex(),
      shine:R.shineOf(row.look.finish).kind},()=>this.renderFaces());
  },
  showIndex(){const d=this._draft;return this._shows.findIndex(x=>x.date===d.date&&x.time===d.time&&x.venue===d.venue);},
  // ——— 预览：画成图片 ———
  async faceImage(node,side){
    const row=this._draft,sig=sigOf(row,side);
    if(this._cache.has(sig))return this._cache.get(sig);
    let art=null;
    if(side==='front'&&row.art){
      if(this._artSrc!==row.art){this._artSrc=row.art;this._artImg=await image(node,row.art);}
      art=this._artImg;
    }
    node.width=FACE_W;node.height=FACE_H;
    const ctx=node.getContext('2d');
    ctx.clearRect(0,0,FACE_W,FACE_H);
    R.draw(ctx,row,side,art,{x:0,y:0,w:FACE_W,h:FACE_H},stock);
    const path=await new Promise(resolve=>wx.canvasToTempFilePath({canvas:node,fileType:'png',success:r=>resolve(r.tempFilePath),fail:()=>resolve('')},this));
    if(path){this._cache.set(sig,path);if(this._cache.size>24)this._cache.delete(this._cache.keys().next().value);}
    return path;
  },
  async renderFaces(){
    if(!this._draft||!this._ready)return;
    const turn=++this._turn;
    let node=null;
    for(let i=0;i<10&&!node;i++){node=await canvas(this,'te-worker');if(!node)await new Promise(r=>setTimeout(r,60));if(turn!==this._turn)return;}
    if(!node)return;
    this.setData({busy:true});
    // 先画当前看的一面，另一面随后补上
    const first=this.data.front?'front':'back',second=first==='front'?'back':'front';
    for(const side of [first,second]){
      if(turn!==this._turn||!this._ready)return;
      const path=await this.faceImage(node,side);
      if(turn!==this._turn||!this._ready)return;
      if(path)this.setData({[side==='front'?'frontImg':'backImg']:path});
    }
    const kind=R.shineOf(this._draft.look.finish).kind;
    this.setData({busy:false,shine:kind,glowBg:glowCss(42,30,kind)});
  },
  soon(ms){clearTimeout(this._soonT);this._soonT=setTimeout(()=>this.renderFaces(),ms);},
  // ——— 翻面与倾斜（CSS 3D） ———
  flip(){
    if(this.data.turning)return;
    this.setData({turning:true,ry:90});
    setTimeout(()=>{
      if(!this._ready)return;
      this.setData({front:!this.data.front,ry:-90,snap:true});
      setTimeout(()=>{if(this._ready)this.setData({snap:false,ry:-4,rx:-2,turning:false});},40);
    },FLIP_MS);
  },
  setSide(e){if((e.currentTarget.dataset.side==='front')!==this.data.front)this.flip();},
  touchStart(e){wx.createSelectorQuery().in(this).select('#te-card').boundingClientRect(r=>{this._box=r;}).exec();this.touchMove(e);},
  touchMove(e){
    const t=e.touches&&e.touches[0],b=this._box;if(!t||!b||this.data.turning)return;
    const now=Date.now();if(now-(this._tiltAt||0)<40)return;this._tiltAt=now;
    const x=clamp((t.clientX-b.left)/b.width),y=clamp((t.clientY-b.top)/b.height);
    this.setData({ry:Math.round((x-.5)*24),rx:Math.round((.5-y)*16),glowBg:glowCss(Math.round(x*100),Math.round(y*100),this.data.shine)});
  },
  touchEnd(){if(!this.data.turning)this.setData({ry:-4,rx:-2,glowBg:glowCss(42,30,this.data.shine)});},
  // ——— 编辑 ———
  shuffle(){this._draft.look=R.randomLook(this._draft);this.renderFaces();},
  reset(){this._draft.look=R.defaults(R.sanitize({...this._draft,look:null}));this.renderFaces();},
  changeField(e){
    const name=e.currentTarget.dataset.field,d=this._draft;
    d[name]=name==='crop'?Number(e.detail.value):e.detail.value;
    const patch={['draft.'+name]:d[name]};
    if(['date','time','venue'].includes(name))patch.showIdx=this.showIndex();
    this.setData(patch);
    // 裁切只作用于正面海报：在看背面时拖动先翻回正面
    if(name==='crop'){this.artState();if(!this.data.front)this.flip();}
    this.soon(name==='crop'?120:350);
  },
  chooseShow(e){
    const x=this._shows[Number(e.detail.value)],d=this._draft;if(!x)return;
    if(!d.linked)d.date=x.date;
    Object.assign(d,{time:x.time,venue:x.venue,hall:x.hall,city:x.city});
    this.setData({draft:d,showIdx:Number(e.detail.value)});this.renderFaces();
  },
  chooseArt(e){this._draft.art=this._art[Number(e.detail.value)];this._draft.crop=50;this.setData({artIndex:Number(e.detail.value),'draft.crop':50});this.artState();this.renderFaces();},
  artState(){const dirty=!this._original||artSig(this._draft)!==this._artSaved;if(dirty!==this.data.artDirty)this.setData({artDirty:dirty});},
  saveHere(){if(this.data.artDirty)this.store(true);},
  store(stay){
    const d=this._draft,row=R.sanitize({...d});
    if(!row.date){say('请填写放映日期');return;}
    let key=d.key;
    if(!d.linked){const p=R.parseKey(key);if(!p||p.date!==row.date)key=Tix.freeKey(row.filmId,row.date,this.idx,this._original);if(!key){say('这一天的票根已经太多了');return;}}
    const base=this.base(row.filmId,d.linked?this._view:null,row.date);
    const changes={[key]:base?R.entryFrom({...row,id:key},{...base,id:key}):{t:Date.now()}};
    if(this._original&&this._original!==key)changes[this._original]={del:1,t:Date.now()};
    if(!Tix.set(changes,this.data_,this.idx))return;
    if(stay===true){this._original=key;this._draft.key=key;this._artSaved=artSig(this._draft);this.setData({existing:true,artDirty:false});say('已保存');return;}
    wx.navigateBack({success:()=>say('已收进票根收藏册'),fail:()=>wx.redirectTo({url:'/pages/tickets/tickets'})});
  },
  remove(){
    const linked=this._draft&&this._draft.linked;
    wx.showModal({title:I.tr('移出票根'),content:I.tr(linked?'将这张票根移出收藏册？这次观影会回到「待制作」。':'将这张票根移出收藏册？'),success:r=>{
      if(r.confirm&&Tix.set({[this._original]:{del:1,t:Date.now()}},this.data_,this.idx))wx.navigateBack({fail:()=>wx.redirectTo({url:'/pages/tickets/tickets'})});
    }});
  },
  // ——— 导出这张 ———
  async exportSingle(){
    if(this.data.loading)return;
    const side=this.data.front?'front':'back',row={...this._draft,look:{...this._draft.look}};
    this.setData({loading:true});wx.showLoading({title:I.tr('正在生成图片'),mask:true});
    try{
      const node=await canvas(this,'te-export');if(!node)throw Error('canvas');
      const art=side==='front'?await image(node,row.art):null;
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
