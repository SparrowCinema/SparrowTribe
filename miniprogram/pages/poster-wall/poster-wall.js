const U=require('../../utils/util.js'),W=require('../../utils/watched.js'),I=require('../../utils/i18n.js'),Lib=require('../../utils/library.js');
const app=getApp();
Page({
 data:{i:{},cols:5,items:[],mode:'year',modeIndex:0,modes:['年度海报墙','季度海报墙','月度海报墙'],periods:[],periodIndex:0,period:''},
 onLoad(){this.setData({i:I.dict()});this.measure();this._resize=e=>this.measure(e.size);wx.onWindowResize&&wx.onWindowResize(this._resize);this.offData=app.onData(()=>this.build());this.offWatch=W.onChange(()=>this.build());this.build();},
 onShow(){wx.setNavigationBarTitle({title:I.tr('我的海报墙')});this.measure();this.build();},
 onUnload(){this._resize&&wx.offWindowResize&&wx.offWindowResize(this._resize);this.offData&&this.offData();this.offWatch&&this.offWatch();},
 build(){const data=app.globalData.data;if(!data)return;const all=W.entries(data,U.index(data)).filter(e=>!e.f.ev&&!e.rec.del).sort((a,b)=>b.rec.d.localeCompare(a.rec.d)),mode=this.data.mode||'year',periods=Lib.posterPeriods(all,mode),period=periods.includes(this.data.period)?this.data.period:periods[0]||'';this._entries=Lib.posterEntries(all,mode,period);this.setData({i:I.dict(),modes:['年度海报墙','季度海报墙','月度海报墙'].map(I.tr),periods,period,periodIndex:Math.max(0,periods.indexOf(period)),items:this._entries.map(e=>({id:e.id,title:e.f.cn,poster:U.poster(e.f),score:e.rec.r?e.rec.r+'/10':I.tr('未评分'),rated:!!e.rec.r,stars:[0,1,2,3,4].map(k=>Math.max(0,Math.min(2,(e.rec.r||0)-2*k))*50)}))});},
 setMode(e){const n=Number(e.detail.value);this.setData({mode:['year','quarter','month'][n],modeIndex:n,period:''});this.build();},
 setPeriod(e){this.setData({period:this.data.periods[Number(e.detail.value)]});this.build();},
 exportWall(){if(this.busy||!this._entries||!this._entries.length)return;const list=this._entries.slice(),cols=this.data.cols,period=this.data.period,title=this.data.modes[this.data.modeIndex],R=require('../../utils/recap.js');this.busy=true;wx.showLoading({title:I.tr('正在生成海报墙…'),mask:true});
  const fail=()=>{this.busy=false;wx.hideLoading();wx.showToast({title:I.tr('图片生成失败，请稍后再试'),icon:'none'});};
  wx.createSelectorQuery().in(this).select('#poster-wall-canvas').fields({node:true,size:true}).exec(async res=>{try{const canvas=res&&res[0]&&res[0].node;if(!canvas)return fail();const load=src=>new Promise(r=>{if(!src)return r(null);const im=canvas.createImage();im.onload=()=>r(im);im.onerror=()=>r(null);im.src=src;});
   const items=await Promise.all(list.map(async e=>({id:e.id,title:e.f.cn,score:e.rec.r||0,img:await load(U.poster(e.f))}))),marks=await Promise.all(['/images/brand/sparrow-movies-sq.png','/images/brand/sparrow-tribe-sq.png'].map(load)),qrImg=await load('/images/brand/miniprogram-code.jpg');
   const o={title,sub:period,yearTag:period.slice(0,4),kicker:'SPARROW FILM PASSPORT · MY POSTER WALL',sections:['cover','posters'],posterCols:cols,items,marks,qrImg,T:I.tr,en:I.isEn()},k=.8;canvas.width=Math.round(R.W*k);canvas.height=Math.round(R.heightOf(o)*k);const c=canvas.getContext('2d');c.scale(k,k);R.draw(c,o);
   wx.canvasToTempFilePath({canvas,fileType:'png',success:r=>{this.busy=false;wx.hideLoading();wx.previewImage({urls:[r.tempFilePath],current:r.tempFilePath});},fail});
  }catch(e){fail();}});
 },
 measure(size){let v=size;try{if(!v)v=wx.getWindowInfo?wx.getWindowInfo():wx.getSystemInfoSync();}catch(e){}this.setData({cols:Lib.posterColumns(v&&v.windowWidth,v&&v.windowHeight)});},
 openFilm(e){wx.navigateTo({url:'/pages/film/film?id='+encodeURIComponent(e.currentTarget.dataset.id)});},
 posterError(e){const i=Number(e.currentTarget.dataset.index);if(this.data.items[i])this.setData({['items['+i+'].poster']:''});},
 toFilms(){wx.switchTab({url:'/pages/films/films'});}
});
