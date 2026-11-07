const U=require('../../utils/util.js'),W=require('../../utils/watched.js'),I=require('../../utils/i18n.js');
const app=getApp(),KEY='sk-poster-columns-v1';
Page({
 data:{i:{},cols:10,choices:[10,11,12,13,14,15],choice:0,items:[]},
 onLoad(){let n=10;try{const v=Number(wx.getStorageSync(KEY));if(Number.isInteger(v)&&v>=10&&v<=15)n=v;}catch(e){}this.setData({i:I.dict(),cols:n,choice:n-10});this.offData=app.onData(()=>this.build());this.offWatch=W.onChange(()=>this.build());this.build();},
 onShow(){wx.setNavigationBarTitle({title:I.tr('我的海报墙')});this.build();},
 onUnload(){this.offData&&this.offData();this.offWatch&&this.offWatch();},
 build(){const data=app.globalData.data;if(!data)return;this.setData({i:I.dict(),items:W.entries(data,U.index(data)).filter(e=>!e.f.ev).reverse().map(e=>({id:e.id,title:e.f.cn,poster:U.poster(e.f),score:e.rec.r?e.rec.r+'/10':I.tr('未评分'),rated:!!e.rec.r}))});},
 columns(e){const n=this.data.choices[Number(e.detail.value)];if(!n)return;this.setData({cols:n,choice:n-10});try{wx.setStorageSync(KEY,n);}catch(err){}},
 openFilm(e){wx.navigateTo({url:'/pages/film/film?id='+encodeURIComponent(e.currentTarget.dataset.id)});},
 posterError(e){const i=Number(e.currentTarget.dataset.index);if(this.data.items[i])this.setData({['items['+i+'].poster']:''});},
 toFilms(){wx.switchTab({url:'/pages/films/films'});}
});
