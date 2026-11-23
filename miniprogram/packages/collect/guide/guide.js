// 观影护照使用指南（2026-11-23）：内容在 shared/guide.js（网站 #guide 共用），由 tools/build-fallback.js 复制到 ../utils/guide.js
const I=require('../../../utils/i18n.js'),G=require('../utils/guide.js');
Page({
 data:{i:{},chapters:[],to:''},
 onLoad(){const tr=I.tr;let n=0;
  this.setData({i:I.dict(),chapters:G.forPlatform('mp').map(c=>({id:c.id,t:tr(c.t),items:c.items.map(x=>({n:++n,k:tr(x.k),s:tr(x.s)}))}))});},
 onShow(){wx.setNavigationBarTitle({title:I.tr('观影护照使用指南')});},
 jump(e){const id='gd-'+e.currentTarget.dataset.id;wx.pageScrollTo({selector:'#'+id,duration:250,offsetTop:-8});}
});
