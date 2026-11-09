const U=require('../../utils/util.js'),W=require('../../utils/watched.js'),I=require('../../utils/i18n.js'),Lib=require('../../utils/library.js');
const app=getApp();
Page({
 data:{i:{},cols:5,items:[],mode:'year',modeIndex:0,modes:['年度海报墙','季度海报墙','月度海报墙'],periods:[],periodIndex:0,period:'',programme:'all',programmeLabel:'全部专题',showScore:true,selectorType:'',selectorQuery:'',selectorRows:[]},
 onLoad(){let ss=true;try{ss=wx.getStorageSync('sk-pw-score')!=='0';}catch(e){}this.setData({i:I.dict(),showScore:ss});this.measure();this._resize=e=>this.measure(e.size);wx.onWindowResize&&wx.onWindowResize(this._resize);this.offData=app.onData(()=>this.build());this.offWatch=W.onChange(()=>this.build());this.build();},
 onShow(){wx.setNavigationBarTitle({title:I.tr('我的影院观影海报墙')});this.measure();this.build();},
 onUnload(){this._resize&&wx.offWindowResize&&wx.offWindowResize(this._resize);this.offData&&this.offData();this.offWatch&&this.offWatch();},
 context(){const data=app.globalData.data,idx=U.index(data);return {shows:data.shows||[],programmeOf:f=>idx.progOf(f).id,programmeIds:f=>idx.progsOf(f).map(x=>x.p.id),showProgramme:s=>U.progForShow(s,idx).id};},
 archive(){const data=app.globalData.data;return W.entries(data,U.index(data)).filter(e=>!e.f.ev&&!e.rec.del).sort((a,b)=>b.rec.d.localeCompare(a.rec.d));},
 programmeNames(){const ps=app.globalData.data.programmes||[];return Lib.list(this.data.programme).map(id=>(ps.find(p=>p.id===id)||{}).name||id);},
 build(){const data=app.globalData.data;if(!data)return;const all=this.archive(),mode=this.data.mode||'year',periods=Lib.posterPeriods(all,mode),period=periods.includes(this.data.period)?this.data.period:periods[0]||'',names=this.programmeNames();this._entries=Lib.posterEntries(all,mode,period,this.data.programme,this.context());this.setData({i:I.dict(),modes:['年度海报墙','季度海报墙','月度海报墙'].map(I.tr),programmeLabel:names.length===0?I.tr('全部专题'):names.length===1?names[0]:I.tr(names.length+' 个专题'),periods,period,periodIndex:Math.max(0,periods.indexOf(period)),items:this._entries.map(e=>({id:e.id,title:e.f.cn,poster:U.poster(e.f),score:e.rec.r?e.rec.r+'/10':I.tr('未评分'),rated:!!e.rec.r,stars:[0,1,2,3,4].map(k=>Math.max(0,Math.min(2,(e.rec.r||0)-2*k))*50)}))});},
 openSelector(){this.setData({selectorType:'programme',selectorQuery:''});this.buildSelector();},
 closeSelector(){this.setData({selectorType:''});},
 stopMove(){},
 searchSelector(e){this.setData({selectorQuery:e.detail.value});this.buildSelector();},
 buildSelector(){const all=this.archive(),ctx=this.context(),ps=app.globalData.data.programmes||[],q=this.data.selectorQuery.trim().toLocaleLowerCase(),period=this.data.period,mode=this.data.mode,rows=[{id:'all',name:I.tr('全部专题'),n:Lib.posterEntries(all,mode,period).length,selected:!Lib.list(this.data.programme).length},...ps.map(p=>({id:p.id,name:p.name,n:Lib.posterEntries(all,mode,period,p.id,ctx).length,selected:Lib.list(this.data.programme).includes(p.id)}))];this.setData({selectorRows:rows.filter(p=>!q||p.name.toLocaleLowerCase().includes(q))});},
 chooseProgramme(e){const id=e.currentTarget.dataset.id;this.setData({programme:id==='all'?'all':Lib.toggle(this.data.programme,id)});this.build();this.buildSelector();},

 setMode(e){const n=Number(e.detail.value);this.setData({mode:['year','quarter','month'][n],modeIndex:n,period:''});this.build();},
 setPeriod(e){this.setData({period:this.data.periods[Number(e.detail.value)]});this.build();},
 exportWall(){if(this.busy||!this._entries||!this._entries.length)return;const list=this._entries.slice(),cols=this.data.cols,period=[this.data.period,...this.programmeNames()].filter(Boolean).join(' · '),title=this.data.modes[this.data.modeIndex],R=require('../../utils/recap.js');this.busy=true;wx.showLoading({title:I.tr('正在生成海报墙…'),mask:true});
  const fail=()=>{this.busy=false;wx.hideLoading();wx.showToast({title:I.tr('图片生成失败，请稍后再试'),icon:'none'});};
  wx.createSelectorQuery().in(this).select('#poster-wall-canvas').fields({node:true,size:true}).exec(async res=>{try{const canvas=res&&res[0]&&res[0].node;if(!canvas)return fail();const load=src=>new Promise(r=>{if(!src)return r(null);const im=canvas.createImage();im.onload=()=>r(im);im.onerror=()=>r(null);im.src=src;});
   const items=await Promise.all(list.map(async e=>({id:e.id,title:e.f.cn,score:e.rec.r||0,img:await load(U.poster(e.f))}))),marks=await Promise.all(['/images/brand/sparrow-movies-sq.png','/images/brand/sparrow-tribe-sq.png'].map(load)),qrImg=await load('/images/brand/miniprogram-code.jpg');
   const hn=String((W.holder&&W.holder())||'').trim(),wt=hn?(I.isEn()?hn+"'s Cinema Poster Wall":hn+'的影院观影海报墙'):I.tr('我的影院观影海报墙');const o={title:wt,sub:[I.tr(title),period].filter(Boolean).join(' · '),yearTag:period.slice(0,4),kicker:'SPARROW FILM PASSPORT · MY CINEMA POSTER WALL',sections:['cover','posters'],posterCols:cols,posterScores:this.data.showScore,items,marks,qrImg,T:I.tr,en:I.isEn()},k=.8;canvas.width=Math.round(R.W*k);canvas.height=Math.round(R.heightOf(o)*k);const c=canvas.getContext('2d');c.scale(k,k);R.draw(c,o);
   wx.canvasToTempFilePath({canvas,fileType:'png',success:r=>{this.busy=false;wx.hideLoading();wx.previewImage({urls:[r.tempFilePath],current:r.tempFilePath});},fail});
  }catch(e){fail();}});
 },
 toggleScore(){const v=!this.data.showScore;this.setData({showScore:v});try{wx.setStorageSync('sk-pw-score',v?'1':'0');}catch(e){}},
 measure(size){let v=size;try{if(!v)v=wx.getWindowInfo?wx.getWindowInfo():wx.getSystemInfoSync();}catch(e){}this.setData({cols:Lib.posterColumns(v&&v.windowWidth,v&&v.windowHeight)});},
 openFilm(e){wx.navigateTo({url:'/pages/film/film?id='+encodeURIComponent(e.currentTarget.dataset.id)});},
 posterError(e){const i=Number(e.currentTarget.dataset.index);if(this.data.items[i])this.setData({['items['+i+'].poster']:''});},
 toFilms(){wx.switchTab({url:'/pages/films/films'});}
});
