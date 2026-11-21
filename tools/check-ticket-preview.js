// 票根详情页（pages/ticket-edit）：独立页面、图片预览 + CSS 3D 倾斜翻面、换款重画、场次选择、保存、导出。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const tickets=require('../miniprogram/utils/tickets');
const dir=path.join(__dirname,'../miniprogram/pages/ticket-edit');
const wxml=fs.readFileSync(path.join(dir,'ticket-edit.wxml'),'utf8');
const tixWxml=fs.readFileSync(path.join(__dirname,'../miniprogram/pages/tickets/tickets.wxml'),'utf8');
const app=JSON.parse(fs.readFileSync(path.join(__dirname,'../miniprogram/app.json'),'utf8'));

// 独立页面：注册在 app.json；不用 page-container（它会锁住页面滚动）；票根上用 bindtouchmove（不拦截页面滚动）
assert(app.pages.includes('pages/ticket-edit/ticket-edit'));
assert(!/page-container/.test(wxml)&&!/page-container/.test(tixWxml),'no page-container scroll lock');
assert(!/catchtouchmove/.test(wxml),'ticket card must not block page scrolling');
assert.match(wxml,/<image[^>]*class="te-face"/);
assert.doesNotMatch(wxml,/chooseArtStyle|artStyles/,'the preview uses hand-drawn artwork by default');
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
const store={};let navigatedBack=0,toasts=[];
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
  page.touchStart({touches:[{clientX:180,clientY:40}]});
  assert(page.data.ry>5&&page.data.rx>3,'tilt follows the finger');assert.match(page.data.glowBg,/circle at 90% 10%/);
  page.touchEnd();assert.equal(page.data.ry,-4);
  // 在背面拖动裁切会翻回正面
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
  // 再次打开已收藏的票根：编辑模式，导出 PNG 不带预览高光
  const page2={...options,data:JSON.parse(JSON.stringify(options.data)),setData:page.setData};
  page2.onLoad({key:encodeURIComponent(saved[0])});await flush();
  assert(page2.data.existing);assert.equal(page2.data.draft.seat,'7排7座');
  await page2.exportSingle();await flush();
  assert(exporter.ctx.labels.includes('纪念票根'));
  page2.remove();assert(store['sk-tickets-v2'][saved[0]].del);
  console.log('PASS: ticket editor page — native scrolling/back, image preview with CSS 3D flip & tilt, shuffle redraw, show picker, default artwork without a style picker, crop flips to front, save, export, remove.');
})().catch(e=>{console.error(e);process.exitCode=1;});
