const R=require('../../utils/tickets.js');
const U=require('../../utils/util.js');
const W=require('../../utils/watched.js');
const I=require('../../utils/i18n.js');
const CFG=require('../../utils/cfg.js');
const app=getApp();
const KEY='sk-tickets-v1';
const read=()=>{try{return R.read(wx.getStorageSync(KEY));}catch(e){return [];}};
const say=phrase=>wx.showToast({title:I.tr(phrase),icon:'none'});
const stock=(w,h)=>wx.createOffscreenCanvas({type:'2d',width:w,height:h});
const iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const showKey=s=>s.sid||U.keyOf(s);
function save(rows){try{wx.setStorageSync(KEY,rows);return true;}catch(e){say('票根保存失败，请检查本机存储');return false;}}
function image(node,src){
  return new Promise(resolve=>{
    if(!src)return resolve(null);
    const im=node.createImage();
    const done=value=>{clearTimeout(timer);im.onload=im.onerror=null;resolve(value);};
    const timer=setTimeout(()=>done(null),4500);
    im.onload=()=>done(im);im.onerror=()=>done(null);im.src=src;
  });
}
function canvas(page,id){return new Promise(resolve=>wx.createSelectorQuery().in(page).select('#'+id).fields({node:true}).exec(result=>resolve(result?.[0]?.node||null)));}
function buildRecord(f,s,idx,date){
  const p=s?U.progForShow(s,idx):idx.progOf(f),v=s&&idx.VN[s.v];
  return R.sanitize({filmId:f.id,title:f.cn,subtitle:f.o||f.en,showId:s&&showKey(s),
    programmeId:p?.id,programme:p?.name,section:p?.sections?.[f.id]||(p?.id===f.prog?f.section:''),
    date:s?iso(U.showDate(s)):date,time:s?.t,city:v?.city,venue:v?.name,hall:s&&idx.hallName(s),format:f.version,art:U.poster(f)});
}
function artOf(f){return [...new Set([U.poster(f),...(Array.isArray(f.stills)?f.stills.map(s=>typeof s==='string'?s:s?.url):[])].filter(s=>typeof s==='string'&&s))];}

Page({
  data:{i:{},ps:'',mode:'wall',year:0,programme:0,page:0,pages:0,front:true,rows:[],results:[],query:'',count:0,loading:false},
  onLoad(params){
    this._ready=true;this._render=0;this._draft=null;this._original='';
    CFG.bind(this);this.setData({i:I.dict()});wx.setNavigationBarTitle({title:I.tr('我的票根收藏册')});
    if(params.id)this.openFilmId(params.id);else this.wall();
  },
  onShow(){CFG.chrome();},
  onUnload(){this._ready=false;this._render++;this.__cfgOff?.();},
  wall(){
    const rows=read(),ys=[...new Set(rows.map(r=>r.date.slice(0,4)).filter(Boolean))].sort().reverse();
    const ps=[...new Set(rows.map(r=>r.programme).filter(Boolean))].sort();
    const year=Math.min(this.data.year,ys.length),programme=Math.min(this.data.programme,ps.length);
    const list=R.sorted(rows,ps[programme-1],ys[year-1]);
    const pages=Math.ceil(list.length/R.WALL_PAGE);
    const page=Math.min(Math.max(0,pages-1),this.data.page);
    this._shown=list.slice(page*R.WALL_PAGE,(page+1)*R.WALL_PAGE);
    this._draft=null; ++this._render;
    this.setData({mode:'wall',rows:this._shown,count:list.length,years:[I.tr('全部年份'),...ys],programmes:[I.tr('全部专题'),...ps],year,programme,page,pages},()=>this.drawWallTiles());
  },
  filter(e){
    this.setData({[e.currentTarget.dataset.field]:Number(e.detail.value),page:0});
    this.wall();
  },
  move(e){this.setData({page:this.data.page+Number(e.currentTarget.dataset.move)});this.wall();},
  flipWall(){this.setData({front:!this.data.front});this.wall();},
  start(){
    this._draft=null;++this._render;
    this.setData({mode:'search',query:''});
    this.search('');
  },
  inputSearch(e){const query=e.detail.value;this.setData({query});this.search(query);},
  search(query){
    const data=app.globalData.data,idx=U.index(data);
    const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const films=terms.length?data.films.filter(f=>terms.every(term=>`${f.cn} ${f.o||''} ${f.en||''}`.toLowerCase().includes(term))).slice(0,30):
      W.entries(data,idx).slice(0,18).map(e=>e.f);
    this.setData({results:films.map(f=>({id:f.id,title:f.cn,poster:U.thumb(f)}))});
  },
  openFilm(e){this.openFilmId(e.currentTarget.dataset.id);},
  openFilmId(id){
    const data=app.globalData.data,idx=U.index(data),f=idx.F[id];
    if(!f){this.wall();return;}
    const entry=W.entries(data,idx).find(e=>e.id===f.id);
    const row=buildRecord(f,entry?.s,idx,entry?.rec.d||iso(new Date()));
    const existing=read().find(r=>r.id===row.id);
    this._keepLook=true;
    if(!existing)row.look=R.randomLook(row);
    this.edit(existing||row,existing?.id||'');
  },
  openTicket(e){
    this._keepLook=true;
    const row=this._shown[Number(e.currentTarget.dataset.index)];
    if(row)this.edit({...row,look:{...row.look}},row.id);
  },
  edit(row,original=this._original,side='front'){
    this._draft=row;this._original=original;this._side=side;
    const data=app.globalData.data,idx=U.index(data),f=idx.F[row.filmId];
    this._shows=data.shows.filter(s=>s.id===row.filmId);
    this._art=f?artOf(f):[];
    if(row.art&&!this._art.includes(row.art))this._art.unshift(row.art);
    const shows=[I.tr('自填场次'),...this._shows.map(s=>`${iso(U.showDate(s))} ${s.t} · ${idx.VN[s.v]?.name||s.v}`)];
    const showIndex=this._shows.findIndex(s=>showKey(s)===row.showId)+1;
    const arts=this._art.map((_,i)=>I.tr(i===0?'海报':'备用图像')+' '+(i+1));
    this.setData({mode:'edit',draft:row,shows,showIndex,arts,artIndex:Math.max(0,this._art.indexOf(row.art)),editFront:side==='front',existing:!!original},()=>this.drawEditor());
  },
  chooseShow(e){
    const s=this._shows[Number(e.detail.value)-1];
    const data=app.globalData.data,idx=U.index(data),f=idx.F[this._draft.filmId];
    const next=s&&f?buildRecord(f,s,idx):R.sanitize({...this._draft,id:'',showId:'',look:null});
    if(this._keepLook)next.look=this._draft.look;
    this.edit(next,this._original,this._side);
  },
  chooseArt(e){this._draft.art=this._art[Number(e.detail.value)];this._draft.crop=50;this.edit(this._draft,this._original,this._side);},
  changeField(e){
    const name=e.currentTarget.dataset.field;
    this._draft[name]=name==='crop'?Number(e.detail.value):e.detail.value;
    const modifySlot=['date','time','venue','hall'].includes(name);
    const update={['draft.'+name]:this._draft[name]};
    if(modifySlot){
      this._draft.id='';this._draft.showId='';update.showIndex=0;
      if(!this._keepLook){
        this._draft.look=R.defaults(R.sanitize(this._draft));
        update['draft.look']=this._draft.look;
      }
    }
    this.setData(update);this.drawEditor();
  },
  flipEditor(){this._side=this._side==='front'?'back':'front';this.setData({editFront:this._side==='front'});this.drawEditor();},
  shuffle(){
    this._keepLook=true;
    this._draft.look=R.randomLook(this._draft);
    this.setData({'draft.look':this._draft.look},()=>this.drawEditor());
  },
  reset(){
    this._keepLook=false;
    this._draft.look=R.defaults(R.sanitize(this._draft));
    this.setData({'draft.look':this._draft.look},()=>this.drawEditor());
  },
  store(){
    const row=R.sanitize({...this._draft,savedAt:Date.now()});
    if(!row.date){say('请填写放映日期');return;}
    if(!save([...read().filter(r=>r.id!==row.id&&r.id!==this._original),row]))return;
    this.setData({year:0,programme:0,page:0});this.wall();say('已收进票根收藏册');
  },
  remove(){
    const original=this._original;
    wx.showModal({title:I.tr('移出票根'),content:I.tr('将这张票根移出收藏册？'),success:r=>{
      if(r.confirm&&save(read().filter(row=>row.id!==original)))this.wall();
    }});
  },
  async drawTile(id,row,side,render,width){
    const node=await canvas(this,id);
    if(!node||render!==this._render)return;
    node.width=width;node.height=Math.round(width*R.H/R.W);
    const ctx=node.getContext('2d'),rect={x:0,y:0,w:node.width,h:node.height};
    R.draw(ctx,row,side,null,rect,stock);
    if(side==='front'){
      const art=await image(node,row.art);
      if(art&&render===this._render){ctx.clearRect(0,0,node.width,node.height);R.draw(ctx,row,side,art,rect,stock);}
    }
  },
  drawEditor(){if(this._draft)this.drawTile('ticket-editor-canvas',this._draft,this._side,++this._render,480);},
  drawWallTiles(){
    const turn=++this._render,side=this.data.front?'front':'back';
    this._shown.forEach((row,i)=>this.drawTile('ticket-tile-'+i,row,side,turn,210));
  },
  exportWall(){this.export(false);},
  exportSingle(){this.export(true);},
  async export(single){
    if(this.data.loading)return;
    const rows=single?[{...this._draft,look:{...this._draft.look}}]:this._shown.slice();
    if(!rows.length)return;
    const side=single?this._side:(this.data.front?'front':'back'),page=this.data.page+1;
    this.setData({loading:true});wx.showLoading({title:I.tr('正在生成图片'),mask:true});
    try{
      const node=await canvas(this,'ticket-export-canvas');
      if(!node)throw Error('Canvas');
      const images=await Promise.all(rows.map(r=>side==='front'?image(node,r.art):null));
      const layout=single?{width:R.W*3,height:R.H*3}:R.wallLayout(rows.length);
      node.width=layout.width;node.height=layout.height;
      const ctx=node.getContext('2d');
      if(single)R.draw(ctx,rows[0],side,images[0],{x:0,y:0,w:node.width,h:node.height},stock);
      else R.drawWall(ctx,rows,side,images,`${rows.length} ${I.tr('张票根')} · #${page}`,stock);
      const png=await new Promise((resolve,reject)=>wx.canvasToTempFilePath({canvas:node,fileType:'png',success:r=>resolve(r.tempFilePath),fail:reject},this));
      if(this._ready){
        wx.hideLoading();
        this.setData({loading:false});
        const warning=side==='front'&&images.some((im,i)=>!im&&rows[i].art);
        if(warning)say('海报读取失败，已用片名代替');
        wx.showActionSheet({itemList:[I.tr('保存到相册'),I.tr('预览并发给朋友')],success:choice=>{
          if(choice.tapIndex===0)wx.saveImageToPhotosAlbum({filePath:png,success:()=>say('已保存到相册'),fail:()=>wx.previewImage({urls:[png]})});
          else wx.previewImage({urls:[png]});
        }});
      }
    }catch(e){if(this._ready)say('图片生成失败，请稍后再试');}
    finally{if(!this._ready||this.data.loading)wx.hideLoading();if(this._ready)this.setData({loading:false});}
  }
});
