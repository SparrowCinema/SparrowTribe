const U=require('../../utils/util.js'),W=require('../../utils/watched.js'),I=require('../../utils/i18n.js'),Lib=require('../../utils/library.js');
const app=getApp();
Page({
 data:{i:{},cols:5,items:[]},
 onLoad(){this.setData({i:I.dict()});this.measure();this._resize=e=>this.measure(e.size);wx.onWindowResize&&wx.onWindowResize(this._resize);this.offData=app.onData(()=>this.build());this.offWatch=W.onChange(()=>this.build());this.build();},
 onShow(){wx.setNavigationBarTitle({title:I.tr('我的海报墙')});this.measure();this.build();},
 onUnload(){this._resize&&wx.offWindowResize&&wx.offWindowResize(this._resize);this.offData&&this.offData();this.offWatch&&this.offWatch();},
 build(){const data=app.globalData.data;if(!data)return;this.setData({i:I.dict(),items:W.entries(data,U.index(data)).filter(e=>!e.f.ev).reverse().map(e=>({id:e.id,title:e.f.cn,poster:U.poster(e.f),score:e.rec.r?e.rec.r+'/10':I.tr('未评分'),rated:!!e.rec.r,stars:[0,1,2,3,4].map(k=>Math.max(0,Math.min(2,(e.rec.r||0)-2*k))*50)}))});},
 measure(size){let v=size;try{if(!v)v=wx.getWindowInfo?wx.getWindowInfo():wx.getSystemInfoSync();}catch(e){}this.setData({cols:Lib.posterColumns(v&&v.windowWidth,v&&v.windowHeight)});},
 openFilm(e){wx.navigateTo({url:'/pages/film/film?id='+encodeURIComponent(e.currentTarget.dataset.id)});},
 posterError(e){const i=Number(e.currentTarget.dataset.index);if(this.data.items[i])this.setData({['items['+i+'].poster']:''});},
 toFilms(){wx.switchTab({url:'/pages/films/films'});}
});
