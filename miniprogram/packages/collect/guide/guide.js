// 观影护照使用指南：内容在网站 data/guide.json，联网时由 getData 云函数带回（app.globalData.guide，改手册不用重新上传小程序）；
// 没取到时用 ../utils/guide.js 附带的兜底（tools/build-fallback.js 从 data/guide.json 生成）。顶部「最近更新」列出 45 天内的新功能。
const I=require('../../../utils/i18n.js'),G=require('../utils/guide.js');
const app=getApp();
const md=d=>{const m=/^\d{4}-(\d{2})-(\d{2})$/.exec(d||'');return m?(+m[1])+'.'+(+m[2]):d;};
Page({
 data:{i:{},chapters:[],news:[],to:''},
 onLoad(){this.render();},
 render(){const tr=I.tr,data=app.globalData.guide||null;let n=0;
  this.setData({i:I.dict(),
   news:G.newsFor(data,'mp').map((x,k)=>({k,d:md(x.d),t:tr(x.t),s:tr(x.s)})),
   chapters:G.chaptersFor(data,'mp').map(c=>({id:c.id,t:tr(c.t),items:c.items.map(x=>({n:++n,k:tr(x.k),s:tr(x.s)}))}))});
  const l=G.latest(data,'mp');if(l)try{wx.setStorageSync('sk-guide-seen',l);}catch(e){}},
 onShow(){wx.setNavigationBarTitle({title:I.tr('观影护照使用指南')});},
 jump(e){const id='gd-'+e.currentTarget.dataset.id;wx.pageScrollTo({selector:'#'+id,duration:250,offsetTop:-8});}
});
