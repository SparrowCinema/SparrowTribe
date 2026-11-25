// 我的趣味图谱：个人 / 社区四象限 + AI 观影画像评语（从「我的 › 成长」移出，成为「我的」里个人排片与海报墙之间的独立板块）
const U=require('../../../utils/util.js'),W=require('../../../utils/watched.js'),I=require('../../../utils/i18n.js'),Taste=require('../../../utils/taste.js'),C=require('../../../utils/community.js'),Lib=require('../../../utils/library.js'),CFG=require('../../../utils/cfg.js');
const app=getApp();
const getSt=k=>{try{return wx.getStorageSync(k);}catch(e){return '';}};
const setSt=(k,v)=>{try{wx.setStorageSync(k,v);}catch(e){}};
Page({
 data:{i:{},ps:'',reportN:0,year:'',yearIndex:0,yearLabels:[],years:[],prog:'',progIndex:0,progLabels:[],progs:[],tasteMode:'mine',tasteMap:{n:0,points:[],quadrants:[],unsure:0},tasteSelected:[],tasteLow:0,tasteCommunityError:false,
  aipOk:false,aipMeta:'',aipBusy:false,aipCached:false,aipMsg:'',aipTone:'',aipPortrait:null},
 onLoad(){this._ready=true;CFG.bind(this);this.setData({i:I.dict()});this.offData=app.onData(()=>this.build());this.offWatch=W.onChange(()=>this.build());this.offC=C.subscribe(()=>this.build());this.build();},
 onShow(){CFG.chrome();wx.setNavigationBarTitle({title:I.tr('我的电影趣味图谱')});this.build();C.read(null).then(()=>this.setData({tasteCommunityError:false})).catch(()=>this.setData({tasteCommunityError:true}));C.flush();},
 onUnload(){this._ready=false;this.__cfgOff&&this.__cfgOff();this.offData&&this.offData();this.offWatch&&this.offWatch();this.offC&&this.offC();},
 build(){const data=app.globalData.data;if(!data)return;const community=this.data.tasteMode==='community',entries=community?data.films.filter(f=>!f.ev&&C.get(f.id)?.pairN>=3).map(f=>{const a=C.get(f.id);return {id:f.id,f,rec:{fun:a.pairFun,bore:a.pairBore},community:true};}):W.entries(data,U.index(data)),low=community?data.films.filter(f=>{const a=C.get(f.id);return !f.ev&&a&&(a.funN||a.boreN)&&a.pairN<3;}).length:0;const TR=require('../utils/taste-report.js'),TP=require('../utils/taste-portrait.js');this.setData({tasteMap:Taste.map(entries,I.isEn()),tasteLow:low});const mine=W.entries(data,U.index(data)),ys=TR.years(mine).map(x=>x.y);let year=this.data.year;if(year&&!ys.includes(year))year='';const vr=TR.validRows(mine),ps=(data.programmes||[]).map(p=>{const t=this.inProg(p.id);return {id:p.id,name:I.isEn()&&p.en||p.name,n:vr.filter(x=>t(x.f)).length};}).filter(x=>x.n);let prog=this.data.prog;if(prog&&!ps.some(x=>x.id===prog))prog='';if(prog)year='';this._progs=ps;const sc=this.scope();const built=TP.buildPayload(mine,{en:I.isEn(),...sc,tasteReport:TR});const fp=TP.fingerprint(built.payload);const hit=built.ok?TP.readCache(getSt,TP.MINI_CACHE_KEY,fp):null;this._aip={built,fp};const meta=built.payload.scope+' · '+(I.isEn()?(built.watchedCount+' watched'+(built.ratedCount?' · '+built.ratedCount+' taste-rated':'')):(built.watchedCount+' 部看过'+(built.ratedCount?' · '+built.ratedCount+' 部已评趣味':'')));this.setData({years:ys,year,yearIndex:year?ys.indexOf(year)+1:0,yearLabels:[I.tr('全部年份'),...ys],prog,progIndex:prog?ps.findIndex(x=>x.id===prog)+1:0,progLabels:[I.tr('全部专题'),...ps.map(x=>x.name)],reportN:TR.analyze(mine,{en:I.isEn(),...sc}).n,aipOk:built.ok,aipMeta:meta,aipCached:!!(hit&&hit.cached),aipPortrait:hit?hit.portrait:null});},
 inProg(pid){const data=app.globalData.data,idx=U.index(data),ctx={shows:data.shows||[],programmeOf:f=>idx.progOf(f).id,programmeIds:f=>idx.progsOf(f).map(x=>x.p.id),showProgramme:s=>U.progForShow(s,idx).id};return f=>Lib.inProgramme(f,pid,ctx);},
 scope(){const p=this.data.prog&&(this._progs||[]).find(x=>x.id===this.data.prog);return p?{programme:p.name,inProg:this.inProg(p.id)}:{year:this.data.year};},
 setYear(e){const k=Number(e.detail.value);this.setData({year:k?this.data.years[k-1]:'',prog:k?'':this.data.prog,aipMsg:'',aipTone:''});this.build();},
 setProg(e){const k=Number(e.detail.value),p=k?(this._progs||[])[k-1]:null;this.setData({prog:p?p.id:'',year:p?'':this.data.year,aipMsg:'',aipTone:''});this.build();},
 setTasteMode(e){this.setData({tasteMode:e.currentTarget.dataset.mode,tasteSelected:[]});this.build();},
 selectTastePoint(e){const p=this.data.tasteMap.points.find(x=>x.key===e.currentTarget.dataset.key);const f=v=>Number.isInteger(v)?String(v):Number(v).toFixed(1);if(p)this.setData({tasteSelected:p.entries.map(x=>Object.assign({},x,{funTxt:f(x.fun),boreTxt:f(x.bore)}))});},
 makeAiPortrait(e){
  if(this.data.aipBusy||!this._aip||!this._aip.built.ok)return;
  const force=!!(e&&e.currentTarget&&e.currentTarget.dataset&&e.currentTarget.dataset.force);
  const TP=require('../utils/taste-portrait.js');
  const {built,fp}=this._aip;
  if(!force){const hit=TP.readCache(getSt,TP.MINI_CACHE_KEY,fp);if(hit&&hit.portrait){this.setData({aipPortrait:hit.portrait,aipCached:true,aipMsg:'',aipTone:''});return;}}
  if(!wx.cloud){this.setData({aipMsg:I.tr('AI 观影画像暂不可用，请稍后再试；上方离线趣味图谱仍可正常使用。'),aipTone:'warn'});return;}
  this.setData({aipBusy:true,aipMsg:I.tr('正在结合你的片单与四象限撰写评语…'),aipTone:''});
  wx.cloud.callFunction({name:'taste',data:{action:'portrait',payload:built.payload}}).then(cr=>{
   if(!this._ready)return;
   const out=cr&&cr.result;
   if(out&&out.ok&&out.portrait){
    const saved=TP.writeCache(getSt,setSt,TP.MINI_CACHE_KEY,fp,out.portrait);
    if(saved){
     this.setData({aipBusy:false,aipPortrait:saved,aipCached:true,aipMsg:'',aipTone:''});
     wx.showToast({title:I.tr('AI 观影评语已生成并缓存在本机'),icon:'none'});
     return;
    }
   }
   const reason=out&&out.reason;
   const msg=reason==='rate_limited'
    ?I.tr('AI 请求过于频繁，请稍后再试；已生成的评语会保存在本机。')
    :I.tr('AI 观影画像暂不可用，请稍后再试；上方离线趣味图谱仍可正常使用。');
   this.setData({aipBusy:false,aipMsg:msg,aipTone:'warn'});
  }).catch(()=>{
   if(!this._ready)return;
   this.setData({aipBusy:false,aipMsg:I.tr('AI 观影画像暂不可用，请检查网络后重试；上方离线趣味图谱仍可正常使用。'),aipTone:'warn'});
  });
 },
 copyAiPortrait(){
  if(!this.data.aipPortrait||!this._aip)return;
  const TP=require('../utils/taste-portrait.js');
  const txt=TP.formatCopyText(this.data.aipPortrait,this._aip.built.payload.scope,I.isEn());
  if(!txt)return;
  wx.setClipboardData({data:txt,success:()=>wx.showToast({title:I.tr('已复制观影评语'),icon:'none'})});
 },
 makeReport(){if(this.busy)return;const data=app.globalData.data;if(!data)return;const TR=require('../utils/taste-report.js'),R=require('../../../utils/recap.js'),en=I.isEn(),a=TR.analyze(W.entries(data,U.index(data)),{en,T:I.tr,...this.scope(),community:id=>{const x=C.get(id);return x&&x.pairN>=3?{fun:x.pairFun,bore:x.pairBore}:null;}});if(!a.ok){wx.showToast({title:I.tr('至少给 3 部电影的有趣度和无聊度都打分后才能生成'),icon:'none'});return;}
  this.busy=true;wx.showLoading({title:I.tr('正在生成趣味图谱…'),mask:true});const fail=()=>{this.busy=false;wx.hideLoading();wx.showToast({title:I.tr('图片生成失败，请稍后再试'),icon:'none'});};
  wx.createSelectorQuery().in(this).select('#taste-canvas').fields({node:true,size:true}).exec(async res=>{try{const canvas=res&&res[0]&&res[0].node;if(!canvas)return fail();const load=src=>new Promise(r=>{const im=canvas.createImage();im.onload=()=>r(im);im.onerror=()=>r(null);im.src=src;});
   const marks=await Promise.all(['/images/brand/sparrow-movies-sq.png','/images/brand/sparrow-tribe-sq.png'].map(load)),qrImg=await load('/images/brand/miniprogram-code.jpg'),k=.8;
   const d0=new Date(),ro={T:I.tr,holder:(W.holder&&W.holder())||'',date:d0.getFullYear()+'.'+String(d0.getMonth()+1).padStart(2,'0')+'.'+String(d0.getDate()).padStart(2,'0'),footer:(cc,y,HH)=>R.footer(cc,{qrImg,marks,T:I.tr,en,footLine:I.tr('长按识别，生成你的电影趣味图谱')},y,HH)};
   canvas.width=Math.round(TR.W*k);canvas.height=10;let c=canvas.getContext('2d');const H=TR.heightOf(c,a,ro);canvas.height=Math.round(H*k);c=canvas.getContext('2d');c.scale(k,k);
   TR.draw(c,a,ro);
   wx.canvasToTempFilePath({canvas,fileType:'png',success:r=>{this.busy=false;wx.hideLoading();wx.previewImage({urls:[r.tempFilePath],current:r.tempFilePath});},fail});
  }catch(e){fail();}});
 },
 openTasteFilm(e){wx.navigateTo({url:'/pages/film/film?id='+encodeURIComponent(e.currentTarget.dataset.id)});}
});
