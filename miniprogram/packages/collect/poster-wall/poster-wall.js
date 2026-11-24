const G=require('../../../utils/growth.js'),U=require('../../../utils/util.js'),W=require('../../../utils/watched.js'),I=require('../../../utils/i18n.js'),Lib=require('../../../utils/library.js'),MyP=require('../../../utils/myposter.js');
const app=getApp();
/* 「放映」视图（2026-11-25，与网站 js/my.js 的 pwr* 一致）：圈上最多 RING_MAX 个位置，影片更多时转到背后的位置换成后面的影片。
   跟手与动画在 ring.wxs（视图层），这里只在正面那张变化时更新资料栏和换片。 */
const RING_MAX=24,rmod=(a,n)=>((a%n)+n)%n;
Page({
 data:{i:{},cols:5,items:[],mode:'year',modeIndex:0,modes:['年度海报墙','季度海报墙','月度海报墙'],periods:[],periodIndex:0,period:'',programme:'all',programmeLabel:'全部专题',showScore:true,view:'grid',ring:null,ringCfg:null,ringCmd:null,selectorType:'',selectorQuery:'',selectorRows:[]},
 onLoad(){let ss=true,view='grid';try{ss=wx.getStorageSync('sk-pw-score')!=='0';view=wx.getStorageSync('sk-pw-view')==='ring'?'ring':'grid';}catch(e){}this.setData({i:I.dict(),showScore:ss,view});this.measure();this._resize=e=>this.measure(e.size);wx.onWindowResize&&wx.onWindowResize(this._resize);this.offData=app.onData(()=>this.build());this.offWatch=W.onChange(()=>this.build());this.build();},
 onShow(){wx.setNavigationBarTitle({title:I.tr('我的影院观影海报墙')});this.measure();this.build();},
 onUnload(){this._resize&&wx.offWindowResize&&wx.offWindowResize(this._resize);this.offData&&this.offData();this.offWatch&&this.offWatch();},
 context(){const data=app.globalData.data,idx=U.index(data);return {shows:data.shows||[],programmeOf:f=>idx.progOf(f).id,programmeIds:f=>idx.progsOf(f).map(x=>x.p.id),showProgramme:s=>U.progForShow(s,idx).id};},
 archive(){const data=app.globalData.data;return W.entries(data,U.index(data)).filter(e=>!e.f.ev&&!e.rec.del).sort((a,b)=>b.rec.d.localeCompare(a.rec.d));},
 programmeNames(){const ps=app.globalData.data.programmes||[];return Lib.list(this.data.programme).map(id=>(ps.find(p=>p.id===id)||{}).name||id);},
 build(){const data=app.globalData.data;if(!data)return;const all=this.archive(),mode=this.data.mode||'year',periods=Lib.posterPeriods(all,mode),period=periods.includes(this.data.period)?this.data.period:periods[0]||'',names=this.programmeNames();this._entries=Lib.posterEntries(all,mode,period,this.data.programme,this.context());this.setData({i:I.dict(),modes:['年度海报墙','季度海报墙','月度海报墙'].map(I.tr),programmeLabel:names.length===0?I.tr('全部专题'):names.length===1?names[0]:I.tr(names.length+' 个专题'),periods,periodLabels:periods.map(x=>Lib.posterPeriodLabel(x,!!(I.isEn&&I.isEn()))),periodLabel:period?Lib.posterPeriodLabel(period,!!(I.isEn&&I.isEn())):'',period,periodIndex:Math.max(0,periods.indexOf(period)),items:this._entries.map(e=>({id:e.id,title:e.f.cn,poster:MyP.pick(e.f)||U.thumb(e.f),score:e.rec.r?e.rec.r+'/10':I.tr('未评分'),rated:!!e.rec.r,stars:[0,1,2,3,4].map(k=>Math.max(0,Math.min(2,(e.rec.r||0)-2*k))*50)}))});if(this.data.view==='ring')this.ringBuild();},
 openSelector(){this.setData({selectorType:'programme',selectorQuery:''});this.buildSelector();},
 closeSelector(){this.setData({selectorType:''});},
 stopMove(){},
 searchSelector(e){this.setData({selectorQuery:e.detail.value});this.buildSelector();},
 buildSelector(){const all=this.archive(),ctx=this.context(),ps=app.globalData.data.programmes||[],q=this.data.selectorQuery.trim().toLocaleLowerCase(),period=this.data.period,mode=this.data.mode,rows=[{id:'all',name:I.tr('全部专题'),n:Lib.posterEntries(all,mode,period).length,selected:!Lib.list(this.data.programme).length},...ps.map(p=>({id:p.id,name:p.name,n:Lib.posterEntries(all,mode,period,p.id,ctx).length,selected:Lib.list(this.data.programme).includes(p.id)}))];this.setData({selectorRows:rows.filter(p=>!q||p.name.toLocaleLowerCase().includes(q))});},
 chooseProgramme(e){const id=e.currentTarget.dataset.id;this.setData({programme:id==='all'?'all':id,selectorType:''});this.build();},

 setMode(e){const n=Number(e.detail.value);this.setData({mode:['year','quarter','month'][n],modeIndex:n,period:''});this.build();},
 setPeriod(e){this.setData({period:this.data.periods[Number(e.detail.value)]});this.build();},
 exportWall(){if(this.busy||!this._entries||!this._entries.length)return;const list=this._entries.slice(),cols=this.data.cols,period=[this.data.period,...this.programmeNames()].filter(Boolean).join(' · '),title=this.data.modes[this.data.modeIndex],R=require('../../../utils/recap.js');this.busy=true;wx.showLoading({title:I.tr('正在生成海报墙…'),mask:true});
  const fail=()=>{this.busy=false;wx.hideLoading();wx.showToast({title:I.tr('图片生成失败，请稍后再试'),icon:'none'});};
  wx.createSelectorQuery().in(this).select('#poster-wall-canvas').fields({node:true,size:true}).exec(async res=>{try{const canvas=res&&res[0]&&res[0].node;if(!canvas)return fail();const load=src=>new Promise(r=>{if(!src)return r(null);const im=canvas.createImage();im.onload=()=>r(im);im.onerror=()=>r(null);im.src=src;});
   const items=await Promise.all(list.map(async e=>({id:e.id,title:e.f.cn,score:e.rec.r||0,img:await load(MyP.pick(e.f)||U.poster(e.f))}))),marks=await Promise.all(['/images/brand/sparrow-movies-sq.png','/images/brand/sparrow-tribe-sq.png'].map(load)),qrImg=await load('/images/brand/miniprogram-code.jpg');
   const pn=this.programmeNames()[0]||'',wt=Lib.posterTitle({en:I.isEn(),holder:(W.holder&&W.holder())||'',period:this.data.period,programmeName:pn});const o={title:wt.title,sub:wt.sub,yearTag:period.slice(0,4),kicker:'SPARROW FILM PASSPORT · MY CINEMA POSTER WALL',sections:['cover','posters'],posterCols:cols,posterScores:this.data.showScore,items,marks,qrImg,T:I.tr,en:I.isEn()},k=.8;canvas.width=Math.round(R.W*k);canvas.height=Math.round(R.heightOf(o)*k);const c=canvas.getContext('2d');c.scale(k,k);R.draw(c,o);
   wx.canvasToTempFilePath({canvas,fileType:'png',success:r=>{this.busy=false;wx.hideLoading();wx.previewImage({urls:[r.tempFilePath],current:r.tempFilePath});},fail});
  }catch(e){fail();}});
 },
 toggleScore(){const v=!this.data.showScore;this.setData({showScore:v});try{wx.setStorageSync('sk-pw-score',v?'1':'0');}catch(e){}},
 measure(size){let v=size;try{if(!v)v=wx.getWindowInfo?wx.getWindowInfo():wx.getSystemInfoSync();}catch(e){}this.setData({cols:Lib.posterColumns(v&&v.windowWidth,v&&v.windowHeight)});if(this.data.view==='ring'&&this.data.ring)setTimeout(()=>this.ringMeasure(),60);},
 openFilm(e){wx.navigateTo({url:'/pages/film/film?id='+encodeURIComponent(e.currentTarget.dataset.id)});},
 posterError(e){const i=Number(e.currentTarget.dataset.index),it=this.data.items[i];if(!it)return;/* 缩略图读不到时先换回原图，原图也读不到才显示片名 */const en=(this._entries||[])[i],full=en?U.poster(en.f):'';this.setData({['items['+i+'].poster']:/\/w360\//.test(it.poster)&&full&&full!==it.poster?full:''});},
 toFilms(){wx.switchTab({url:'/pages/films/films'});},
 setView(e){const view=e.currentTarget.dataset.v;if(view===this.data.view)return;try{wx.setStorageSync('sk-pw-view',view);}catch(_){}this.setData({view});if(view==='ring')this.ringBuild();},
 ringPoster(e){return MyP.pick(e.f)||U.thumb(e.f);},
 ringSlot(j,p){const L=this._entries.length,M=this._ringM,idx=rmod(j+M*Math.round((p-j)/M),L),e=this._entries[idx];return {idx,id:e.id,title:e.f.cn,poster:this.ringPoster(e)};},
 ringBuild(){const list=this._entries||[];if(!list.length){this.setData({ring:null});return;}const L=list.length,M=Math.min(L,RING_MAX),sig=list.map(e=>e.id).join(',');
  if(sig===this._ringSig&&this.data.ring){this.ringInfo(this._ringP||0);return;}
  this._ringSig=sig;this._ringM=M;this._ringP=0;
  this.setData({ring:{slots:Array.from({length:M},(_,j)=>this.ringSlot(j,0)),far:false,info:null,pos:''}},()=>{this.ringInfo(0);this.ringMeasure();});},
 ringMeasure(){wx.createSelectorQuery().in(this).select('.pr-stage').boundingClientRect(r=>{if(!r||!r.width)return;this.setData({ringCfg:{w:r.width,h:r.height,M:this._ringM,L:this._entries.length,key:this._ringSig}});}).exec();},
 ringInfo(p){const list=this._entries||[];if(!list.length||!this.data.ring)return;const L=list.length,i=rmod(p,L),e=list[i],f=e.f,en=I.isEn(),n=G.views(e.rec).length||1,r=e.rec.r||0;
  const up={'ring.pos':(i+1)+' / '+L,'ring.info':{title:f.cn,version:f.version||'',en:f.en&&f.en!==f.cn?f.en:'',rows:[['导演',f.dir],['年份',f.y],['地区',f.c&&I.tr(f.c)]].filter(x=>x[1]).map(x=>({k:I.tr(x[0]),v:String(x[1])})),r,stars:[0,1,2,3,4].map(k=>Math.max(0,Math.min(2,r-2*k))*50),seen:[e.rec.d,e.venue,n>1?(en?'Seen '+n+' times':'看过 '+n+' 次'):''].filter(Boolean).join(' · ')}};
  if(L>this._ringM&&p!==this._ringP){const slots=this.data.ring.slots;for(let j=0;j<this._ringM;j++){const x=this.ringSlot(j,p);if(x.idx!==slots[j].idx)up['ring.slots['+j+']']=x;}}
  this._ringP=p;this.setData(up);},
 ringFront(o){this.ringInfo(o.p);},
 ringFar(o){this.setData({'ring.far':!!o.far});},
 ringOpen(o){const list=this._entries||[];if(!list.length)return;wx.navigateTo({url:'/pages/film/film?id='+encodeURIComponent(list[rmod(o.p,list.length)].id)});},
 ringBtn(e){this._ringN=(this._ringN||0)+1;this.setData({ringCmd:{n:this._ringN,a:e.currentTarget.dataset.a}});},
 ringImgError(e){const j=Number(e.currentTarget.dataset.slot),x=this.data.ring&&this.data.ring.slots[j];if(!x)return;const en=this._entries[x.idx],full=en?U.poster(en.f):'';this.setData({['ring.slots['+j+'].poster']:/\/w360\//.test(x.poster)&&full&&full!==x.poster?full:''});}
});
