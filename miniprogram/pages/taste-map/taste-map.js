// 我的趣味图谱：个人 / 社区四象限（从「我的 › 成长」移出，成为「我的」里个人排片与海报墙之间的独立板块）
const U=require('../../utils/util.js'),W=require('../../utils/watched.js'),I=require('../../utils/i18n.js'),Taste=require('../../utils/taste.js'),C=require('../../utils/community.js');
const app=getApp();
Page({
 data:{i:{},reportN:0,tasteMode:'mine',tasteMap:{n:0,points:[],quadrants:[],unsure:0},tasteSelected:[],tasteLow:0,tasteCommunityError:false},
 onLoad(){this.setData({i:I.dict()});this.offData=app.onData(()=>this.build());this.offWatch=W.onChange(()=>this.build());this.offC=C.subscribe(()=>this.build());this.build();},
 onShow(){wx.setNavigationBarTitle({title:I.tr('我的电影趣味图谱')});this.build();C.read(null).then(()=>this.setData({tasteCommunityError:false})).catch(()=>this.setData({tasteCommunityError:true}));C.flush();},
 onUnload(){this.offData&&this.offData();this.offWatch&&this.offWatch();this.offC&&this.offC();},
 build(){const data=app.globalData.data;if(!data)return;const community=this.data.tasteMode==='community',entries=community?data.films.filter(f=>!f.ev&&C.get(f.id)?.pairN>=3).map(f=>{const a=C.get(f.id);return {id:f.id,f,rec:{fun:a.pairFun,bore:a.pairBore},community:true};}):W.entries(data,U.index(data)),low=community?data.films.filter(f=>{const a=C.get(f.id);return !f.ev&&a&&(a.funN||a.boreN)&&a.pairN<3;}).length:0;const TR=require('../../utils/taste-report.js');this.setData({tasteMap:Taste.map(entries,I.isEn()),tasteLow:low,reportN:TR.analyze(W.entries(data,U.index(data)),{en:I.isEn()}).n});},
 setTasteMode(e){this.setData({tasteMode:e.currentTarget.dataset.mode,tasteSelected:[]});this.build();},
 selectTastePoint(e){const p=this.data.tasteMap.points.find(x=>x.key===e.currentTarget.dataset.key);const f=v=>Number.isInteger(v)?String(v):Number(v).toFixed(1);if(p)this.setData({tasteSelected:p.entries.map(x=>Object.assign({},x,{funTxt:f(x.fun),boreTxt:f(x.bore)}))});},
 makeReport(){if(this.busy)return;const data=app.globalData.data;if(!data)return;const TR=require('../../utils/taste-report.js'),R=require('../../utils/recap.js'),en=I.isEn(),a=TR.analyze(W.entries(data,U.index(data)),{en,T:I.tr,community:id=>{const x=C.get(id);return x&&x.pairN>=3?{fun:x.pairFun,bore:x.pairBore}:null;}});if(!a.ok){wx.showToast({title:I.tr('至少给 3 部电影的有趣度和无聊度都打分后才能生成'),icon:'none'});return;}
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
