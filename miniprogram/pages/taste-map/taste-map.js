// 我的趣味图谱：个人 / 社区四象限（从「我的 › 成长」移出，成为「我的」里个人排片与海报墙之间的独立板块）
const U=require('../../utils/util.js'),W=require('../../utils/watched.js'),I=require('../../utils/i18n.js'),Taste=require('../../utils/taste.js'),C=require('../../utils/community.js');
const app=getApp();
Page({
 data:{i:{},tasteMode:'mine',tasteMap:{n:0,points:[],quadrants:[],unsure:0},tasteSelected:[],tasteLow:0,tasteCommunityError:false},
 onLoad(){this.setData({i:I.dict()});this.offData=app.onData(()=>this.build());this.offWatch=W.onChange(()=>this.build());this.offC=C.subscribe(()=>this.build());this.build();},
 onShow(){wx.setNavigationBarTitle({title:I.tr('我的趣味图谱')});this.build();C.read(null).then(()=>this.setData({tasteCommunityError:false})).catch(()=>this.setData({tasteCommunityError:true}));C.flush();},
 onUnload(){this.offData&&this.offData();this.offWatch&&this.offWatch();this.offC&&this.offC();},
 build(){const data=app.globalData.data;if(!data)return;const community=this.data.tasteMode==='community',entries=community?data.films.filter(f=>!f.ev&&C.get(f.id)?.pairN>=3).map(f=>{const a=C.get(f.id);return {id:f.id,f,rec:{fun:a.pairFun,bore:a.pairBore},community:true};}):W.entries(data,U.index(data)),low=community?data.films.filter(f=>{const a=C.get(f.id);return !f.ev&&a&&(a.funN||a.boreN)&&a.pairN<3;}).length:0;this.setData({tasteMap:Taste.map(entries,I.isEn()),tasteLow:low});},
 setTasteMode(e){this.setData({tasteMode:e.currentTarget.dataset.mode,tasteSelected:[]});this.build();},
 selectTastePoint(e){const p=this.data.tasteMap.points.find(x=>x.key===e.currentTarget.dataset.key);const f=v=>Number.isInteger(v)?String(v):Number(v).toFixed(1);if(p)this.setData({tasteSelected:p.entries.map(x=>Object.assign({},x,{funTxt:f(x.fun),boreTxt:f(x.bore)}))});},
 openTasteFilm(e){wx.navigateTo({url:'/pages/film/film?id='+encodeURIComponent(e.currentTarget.dataset.id)});}
});
