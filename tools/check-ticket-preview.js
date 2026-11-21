// 票根详情页（pages/ticket-edit）：独立页面、图片预览 + CSS 3D 倾斜翻面、换款重画、场次选择、保存、导出。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const tickets=require('../miniprogram/utils/tickets');
const dir=path.join(__dirname,'../miniprogram/packages/collect/ticket-edit');
const wxml=fs.readFileSync(path.join(dir,'ticket-edit.wxml'),'utf8');
const tixWxml=fs.readFileSync(path.join(__dirname,'../miniprogram/packages/collect/tickets/tickets.wxml'),'utf8');
const app=JSON.parse(fs.readFileSync(path.join(__dirname,'../miniprogram/app.json'),'utf8'));

// 独立页面：注册在 app.json；不用 page-container（它会锁住整页滚动）；2026-11-21 起票根上用 catchtouchmove：手指在票根上滑动只倾斜票根、页面不跟着滚，票根以外照常滚动
assert((app.subPackages||[]).some(p=>p.root==='packages/collect'&&p.pages.includes('ticket-edit/ticket-edit')),'ticket editor lives in the collect subpackage');
assert(!/page-container/.test(wxml)&&!/page-container/.test(tixWxml),'no page-container scroll lock');
assert.match(wxml,/id="te-card"[^>]*catchtouchmove="touchMove"/,'swiping on the ticket tilts it without scrolling the page');
assert.match(wxml,/class="te-glow \{\{glowOn\?'on':''\}\}"/,'glare layer is hidden unless the finger is moving');
assert.match(wxml,/<image[^>]*class="te-face"/);
assert.match(wxml,/<picker[^>]*range="{{artStyleLabels}}"[^>]*bindchange="pickArtStyle"/,'ticket details offer hand-drawn styles');
assert.match(tixWxml,/bindchange="pickArtStyle"/,'the album keeps its own entry to the same styles');
assert(!/canvas[^>]*id="te-worker"[^>]*bindtap/.test(wxml),'visible preview is an image, the canvas stays hidden');

// 模拟画布：记录画过的文字；canvasToTempFilePath 把当前画面存成「图片」
function ctx2d(){
  const c={labels:[]};const g={addColorStop(){}};
  return new Proxy(c,{get(t,k){
    if(k==='clearRect')return ()=>{t.labels=[];};
    if(k==='fillText')return s=>t.labels.push(s);
    if(k==='measureText')return s=>({width:s.length*12});
    if(k==='createLinearGradient'||k==='createRadialGradient')return ()=>g;
    if(k==='createPattern')return ()=>({});
    return t[k]??(()=>{});
  }});
}
const files=new Map();let fileN=0;
const worker={ctx:ctx2d(),width:0,height:0,getContext(){return this.ctx;},createImage(){const im={};setTimeout(()=>im.onload&&im.onload(),0);return im;}};
const exporter={ctx:ctx2d(),width:0,height:0,getContext(){return this.ctx;},createImage(){const im={};setTimeout(()=>im.onload&&im.onload(),0);return im;}};
const Art=require('../miniprogram/utils/ticket-sketch');
const store={[Art.storageKey]:'watercolor'};let navigatedBack=0,toasts=[];
const timers=[];
const wx={
  getStorageSync:k=>store[k]===undefined?'':JSON.parse(JSON.stringify(store[k])),setStorageSync:(k,v)=>{store[k]=JSON.parse(JSON.stringify(v));},removeStorageSync:k=>{delete store[k];},
  createSelectorQuery(){let id;return {in(){return this;},select(s){id=s;return this;},fields(){return this;},boundingClientRect(cb){cb&&cb({left:0,top:0,width:200,height:400});return this;},exec(cb){cb&&cb([{node:id==='#te-worker'?worker:exporter}]);}};},
  createOffscreenCanvas:()=>({getContext:ctx2d}),
  canvasToTempFilePath({canvas,success}){const p='tmp://'+(++fileN)+'.png';files.set(p,[...canvas.ctx.labels]);success({tempFilePath:p});},
  showToast:o=>toasts.push(o.title),showLoading(){},hideLoading(){},showActionSheet(){},setNavigationBarTitle(){},
  navigateBack:o=>{navigatedBack++;o&&o.success&&o.success();},showModal:o=>o.success({confirm:true}),
  getAppBaseInfo:()=>({theme:'light',language:'zh_CN'}),getSystemSetting:()=>({}),getWindowInfo:()=>({}),onThemeChange(){}
};
global.wx=wx;
const data=require('../miniprogram/data/data.js');
const films=data.films.filter(f=>!f.ev&&data.shows.some(s=>s.id===f.id));
const film=films[0];
let options;
const sandbox={Page:o=>{options=o;},getApp:()=>({globalData:{data}}),wx,console,setTimeout:(f,ms)=>{timers.push(f);},clearTimeout(){},Date,
  require:name=>require(path.join(dir,name))};
vm.runInNewContext(fs.readFileSync(path.join(dir,'ticket-edit.js'),'utf8'),sandbox,{filename:'ticket-edit.js'});
const page={...options,data:JSON.parse(JSON.stringify(options.data))};
page.setData=function(p,cb){for(const [k,v] of Object.entries(p)){const parts=k.replace(/\[(\d+)\]/g,'.$1').split('.');let o=this.data;for(let i=0;i<parts.length-1;i++)o=o[parts[i]];o[parts[parts.length-1]]=v;}cb&&cb();};
const flush=async()=>{for(let n=0;n<20;n++){await new Promise(r=>setImmediate(r));while(timers.length)timers.shift()();}};

(async()=>{
  // 没有观影记录：新建手工票根，正反面都画成图片
  page.onLoad({film:film.id});await flush();
  assert.equal(page._artStyle,'watercolor');
  assert(page.data.ok&&!page.data.existing&&!page.data.linked);
  assert(files.get(page.data.frontImg).includes('纪念票根'),'front face rendered to an image');
  assert(files.get(page.data.backImg).includes('收藏票根'),'back face rendered to an image');
  // 换款：重新画，图片换成新的
  const before=page.data.frontImg;let changed=false;
  for(let i=0;i<5&&!changed;i++){page.shuffle();await flush();changed=page.data.frontImg!==before;}
  assert(changed,'shuffle produces a new preview image');
  // 翻面：CSS 转到 90° → 换面 → 无动画跳到 -90° → 回到正常角度
  page.flip();assert.equal(page.data.ry,90);assert(page.data.turning);
  await flush();assert.equal(page.data.front,false);assert.equal(page.data.turning,false);assert.equal(page.data.snap,false);
  // 倾斜与高光跟手
  // 高光与手指镜像、只在滑动时出现，松手就隐藏（不再常驻在海报上把图案冲白）
  assert.equal(page.data.glowOn,false,'no glare while idle');
  page.touchStart({touches:[{clientX:100,clientY:100}]});
  page.touchMove({touches:[{clientX:180,clientY:40}]});
  assert(page.data.ry>5&&page.data.rx>3,'tilt follows the finger');assert.match(page.data.glowBg,/circle at 10% 90%/);assert.equal(page.data.glowOn,true);
  page.touchEnd();assert.equal(page.data.ry,-4);assert.equal(page.data.glowOn,false,'glare fades on release');
  // 只为这部影片保存手绘风格，单独重画配图，翻到正面。
  const originalFront=page.data.frontImg,originalBack=page.data.backImg,crop=page.data.draft.crop;
  const choose=(id)=>page.pickArtStyle({detail:{value:String(Art.filmStyleOptions.findIndex(style=>style.id===id))}});
  choose('doodle');await flush();
  assert.equal(Art.readFilmStyles(wx.getStorageSync).get(film.id),'doodle');
  assert.equal(store[Art.storageKey],'watercolor');
  assert.equal(page.data.artStyleLabels.length,Art.styles.length+1);
  assert.equal(page.data.front,true);
  assert.notEqual(page.data.frontImg,originalFront,'style must be part of the preview image cache key');
  assert.equal(page.data.backImg,originalBack);
  assert.equal(page.data.draft.crop,crop);
  // 翻面途中连续选风格，只展示最后的选择。
  page.flip();choose('kid-crayon');choose('pop-dots');await flush();
  assert.equal(page.data.front,true);
  assert.equal(page._artStyle,'pop-dots');
  assert.equal(Art.readFilmStyles(wx.getStorageSync).get(film.id),'pop-dots');
  assert.equal(store[Art.storageKey],'watercolor');
  assert.equal(page.data.backImg,originalBack);
  // 返回收藏册时，即使票根数据未修改，也更新样式和缩略图。
  const albumDir=path.join(__dirname,'../miniprogram/packages/collect/tickets');
  let albumOptions;
  const albumSandbox={...sandbox,Page:o=>{albumOptions=o;},require:name=>require(path.join(albumDir,name))};
  vm.runInNewContext(fs.readFileSync(path.join(albumDir,'tickets.js'),'utf8'),albumSandbox,{filename:'tickets.js'});
  const album={...albumOptions,data:{...albumOptions.data,artStyle:'watercolor',front:false},setData:page.setData,
    _filmStyles:new Map(),_shownOnce:true,_rev:require('../miniprogram/utils/ticketstore').rev(),paint(){this.painted=true;}};
  album.onShow();
  assert.equal(album.data.front,false,'changing one film does not change the album side');
  assert.equal(album.data.artStyle,'watercolor');
  const otherFilm=films.find(item=>item.id!==film.id);
  assert.equal(album.styleFor({filmId:film.id}),'pop-dots');
  assert.equal(album.styleFor({filmId:otherFilm.id}),'watercolor');
  const otherPage={...options,data:JSON.parse(JSON.stringify(options.data)),setData:page.setData};
  otherPage.onLoad({film:otherFilm.id});await flush();
  assert.equal(otherPage._artStyle,'watercolor');
  assert.equal(otherPage.data.artStyleIndex,0);
  album.pickArtStyle({detail:{value:String(Art.styles.findIndex(style=>style.id==='memphis'))}});
  assert.equal(album.styleFor({filmId:film.id}),'pop-dots');
  assert.equal(album.styleFor({filmId:otherFilm.id}),'memphis');
  assert(album.painted,'the album refreshes even when no ticket record changed');
  // 在背面拖动裁切会翻回正面
  page.flip();await flush();
  page.changeField({currentTarget:{dataset:{field:'crop'}},detail:{value:20}});await flush();
  assert.equal(page.data.front,true);assert.equal(page.data.draft.crop,20);
  // 场次选择：日期、开场、影院、影厅一起填
  assert(page.data.shows.length>0);
  page.chooseShow({detail:{value:0}});await flush();
  assert(page.data.draft.time&&page.data.draft.venue);assert.equal(page.data.showIdx,0);
  page.changeField({currentTarget:{dataset:{field:'seat'}},detail:{value:'7排7座'}});
  // 保存：写入本机存储并返回收藏册
  page.store();
  const saved=Object.entries(store['sk-tickets-v2']||{}).find(([k])=>k.startsWith(film.id+'|'));
  assert(saved&&saved[1].st==='7排7座'&&saved[1].tm&&saved[1].sk===undefined,'saved only the changed fields');assert.equal(navigatedBack,1);
  // 一部电影一张票根、和护照同步：给没盖章的电影做票根时同时盖章，票根键就是这次观影的键
  const stampRec=(store['sk-watched-v1']||{})[film.id];
  assert(stampRec&&!stampRec.del,'saving a ticket stamps the passport');assert.equal(saved[0],film.id+'|'+stampRec.d);
  assert(toasts.includes('已同时盖章 · 加入观影护照'));
  // 再从收藏册点这部电影：打开已有的这张，不再新建第二张
  const pageB={...options,data:JSON.parse(JSON.stringify(options.data)),setData:page.setData};
  pageB.onLoad({film:film.id});await flush();assert(pageB.data.existing&&pageB.data.linked,'reopens the existing ticket');
  // 再次打开已收藏的票根：编辑模式，导出 PNG 不带预览高光
  const page2={...options,data:JSON.parse(JSON.stringify(options.data)),setData:page.setData};
  page2.onLoad({key:encodeURIComponent(saved[0])});await flush();
  assert(page2.data.existing);assert.equal(page2.data.draft.seat,'7排7座');
  assert.equal(page2._artStyle,'pop-dots');
  // 裁切后就地保存：不离开详情页，再打开时保持新的裁切
  assert.equal(page2.data.artDirty,false,'nothing to save right after opening');
  page2.changeField({currentTarget:{dataset:{field:'crop'}},detail:{value:83}});await flush();
  assert.equal(page2.data.artDirty,true,'crop change lights up the save button');
  page2.saveHere();await flush();
  assert.equal(page2.data.artDirty,false);assert.equal(navigatedBack,1,'save-in-place stays on the page');
  assert.equal(store['sk-tickets-v2'][saved[0]].c,83,'crop persisted');
  const page3={...options,data:JSON.parse(JSON.stringify(options.data)),setData:page.setData};
  page3.onLoad({key:encodeURIComponent(saved[0])});await flush();assert.equal(page3.data.draft.crop,83);
  await page2.exportSingle();await flush();
  assert(exporter.ctx.labels.includes('纪念票根'));
  page2.pickArtStyle({detail:{value:'0'}});await flush();
  assert.equal(page2._artStyle,'memphis');
  assert.equal(Art.readFilmStyles(wx.getStorageSync).has(film.id),false);
  assert.equal(store[Art.storageKey],'memphis');
  page2.remove();assert(store['sk-tickets-v2'][saved[0]].del);
  console.log('PASS: ticket editor page — native scrolling/back, image preview with CSS 3D flip & tilt, shuffle redraw, show picker, per-film artwork styles and album fallback, crop flips to front, crop save-in-place, save, export, remove.');
})().catch(e=>{console.error(e);process.exitCode=1;});
