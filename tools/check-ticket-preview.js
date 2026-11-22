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

// 独立页面：注册在 app.json；不用 page-container（它会锁住整页滚动）；票根上用 catchtouchmove：手指在票根上滑动只转票根、页面不跟着滚，票根以外照常滚动
// 2026-11-22 起 360° 转动由 turn.wxs 在视图层跟手（不经过 setData）
assert((app.subPackages||[]).some(p=>p.root==='packages/collect'&&p.pages.includes('ticket-edit/ticket-edit')),'ticket editor lives in the collect subpackage');
assert(!/page-container/.test(wxml)&&!/page-container/.test(tixWxml),'no page-container scroll lock');
assert.match(wxml,/<wxs src="\.\/turn\.wxs" module="T" \/>/);
assert.match(wxml,/id="te-card"[^>]*turn="\{\{turnReq\}\}" change:turn="\{\{T\.request\}\}"/,'tabs and crop edits ask the view layer to turn');
assert.match(wxml,/id="te-card"[^>]*bindtouchstart="\{\{T\.start\}\}" catchtouchmove="\{\{T\.move\}\}" bindtouchend="\{\{T\.end\}\}"/,'dragging turns the ticket in the view layer without scrolling the page');
assert(!/bindtap="flip"/.test(wxml),'taps are handled by turn.wxs so a drag never also flips');
assert.equal((wxml.match(/class="te-glow"/g)||[]).length,2,'each face carries its own glare');
assert.equal((wxml.match(/class="te-edge /g)||[]).length,4,'paper edges on both long sides, split at the tear notch');
// WXS 编译器不认 .6 这种省略 0 的小数（2026-11-22 曾导致小程序无法预览）：字符串之外一律写 0.6
{
  const code=fs.readFileSync(path.join(dir,'turn.wxs'),'utf8').replace(/\/\/.*$/gm,'').replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g,"''");
  assert(!/(^|[^\w.])\.\d/m.test(code),'turn.wxs: write 0.6, not .6 (WXS rejects leading-dot numbers)');
}
// 主包里不能放只有分包用的 JS（上传会被拦）
assert(!fs.existsSync(path.join(__dirname,'../miniprogram/utils/ticket-font.js')),'ticket-font.js lives in the collect subpackage');
// turn.wxs：左右随便转，上下最多 65°，松手按速度转回最近的一面，轻点翻面，页面请求转到指定一面
{
  let clock=1000;
  const T=require('vm').runInNewContext(fs.readFileSync(path.join(dir,'turn.wxs'),'utf8')+';module.exports',{module:{exports:{}},getDate:()=>({getTime:()=>clock}),Math});
  const styles={},calls=[],st={};
  const comp=name=>({setStyle(v){styles[name]=v;},getDataset:()=>name.startsWith('.te-fx')?{fx:'cast',k:1}:{}});
  const owner={selectComponent:s=>comp(s),selectAllComponents:s=>[comp(s+'0'),comp(s+'1')],callMethod:(n,a)=>calls.push([n,JSON.parse(JSON.stringify(a))])};
  const inst={getState:()=>st,getDataset:()=>({shine:'spectrum',fx:'cast'})};
  const ev=(x,y)=>({instance:inst,touches:x==null?[]:[{clientX:x,clientY:y}]});
  const rot=()=>styles['.te-rot'].transform.match(/rotateX\((-?[\d.]+)deg\) rotateY\((-?[\d.]+)deg\)/).slice(1).map(Number);
  T.request({side:'front',n:0,kind:'metal'},null,owner,inst);assert.deepEqual(rot(),[-2,-4]);
  // 拖动：左右 200px = 90°，向上 400px 超过 65° 时卡住
  T.start(ev(100,300),owner);clock+=16;T.move(ev(160,200),owner);clock+=16;T.move(ev(300,-100),owner);
  assert.deepEqual(rot(),[65,86],'yaw follows the finger, pitch is capped at 65°');
  assert.equal(styles['.te-rot'].transition,'none');assert.equal(styles['.te-glow0'].opacity,1,'glare shows while dragging');
  assert.match(styles['.te-glow0'].background,/^radial-gradient\(circle at -?\d+% -?\d+%,rgba\(255,255,255,\.11\)/,'spectrum glare follows the finish (half strength now that foil effects carry the shine)');
  assert.match(styles['.te-fx0']['background-position'],/^-?\d+% -?\d+%, -?\d+% -?\d+%$/,'cast foil effect moves both layers with the angle');assert(styles['.te-fx0'].opacity>0,'foil effect shows while turning');
  T.end(ev(),owner);
  assert.deepEqual(rot(),[-2,536],'a hard flick spins on (inertia capped at one turn) and settles on the back, level');
  assert.match(styles['.te-rot'].transition,/^transform \d+ms cubic-bezier/);assert.equal(styles['.te-glow0'].opacity,0,'glare fades after release');assert.equal(styles['.te-fx0'].opacity,0,'foil effect fades after release');
  assert.deepEqual(calls.pop(),['turned',{front:false}]);
  // 慢慢拖一点点再松手：转回原来那一面
  T.start(ev(100,100),owner);clock+=200;T.move(ev(140,100),owner);clock+=200;T.end(ev(),owner);
  assert.deepEqual(rot(),[-2,536]);assert.deepEqual(calls.pop(),['turned',{front:false}]);
  // 轻点：翻到另一面
  T.start(ev(100,100),owner);T.end(ev(),owner);assert.deepEqual(rot(),[-2,716]);assert.deepEqual(calls.pop(),['turned',{front:true}]);
  // 页面请求：已在正面不动，要背面就转过去
  T.request({side:'front',n:1},null,owner,inst);assert.deepEqual(rot(),[-2,716]);
  T.request({side:'back',n:2},null,owner,inst);assert.deepEqual(rot(),[-2,896]);assert.deepEqual(calls.pop(),['turned',{front:false}]);
  assert.equal(T.sideOf(-184),'back');assert.equal(T.sideOf(-364),'front');
  // 拆盲盒：snap 请求无动画地停到背面
  T.request({side:'back',n:3,snap:1},null,owner,inst);assert.deepEqual(rot(),[-2,176]);assert.equal(styles['.te-rot'].transition,'none');assert.deepEqual(calls.pop(),['turned',{front:false}]);
  // 工艺反光：小程序 turn.wxs 与网页 ticketFxStyle 同一张表
  const web=fs.readFileSync(path.join(__dirname,'../js/tickets.js'),'utf8'),a=web.indexOf('function ticketFxStyle('),b=web.indexOf('\nfunction ticketTurner(',a);
  const webFx=vm.runInNewContext(web.slice(a,b)+';ticketFxStyle',{Math});
  for(const fx of ['holo','cast','crystal','sweep','glitter','gloss','sense','a-gloss','a-rim','a-holo','a-pearl','a-guilloche','a-matte','a-rainbow','a-cateye','none'])for(const [x,y,lit] of [[.3,-.2,true],[-.8,.5,true],[.5,.1,false]]){
    assert.equal(JSON.stringify(T.fxStyle(fx,x,y,lit)),JSON.stringify(webFx(fx,x,y,lit)),'foil effect table matches the website: '+fx);
  }
  assert.equal(webFx('none',.5,.5,true).o,0,'matte has no foil effect');
  // 工艺分类：新加的视高迪式工艺 + 原有工艺
  const fxOf=tickets.fxOf;
  assert.deepEqual(['holo','gold','varnish','matte','cast','crystal','glitter','sense'].map(fxOf),['holo','sweep','gloss','none','cast','crystal','glitter','sense']);
  assert(['cast','crystal','glitter','sense'].every(k=>tickets.options.finish.some(o=>o.id===k)),'new finishes are selectable');
}
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
// 测试里没有视图层：模拟 turn.wxs 转完后回调 turned
{const turnTo=page.turnTo;page.turnTo=function(side){turnTo.call(this,side);this.turned({front:side==='front'});};}
page.setData=function(p,cb){for(const [k,v] of Object.entries(p)){const parts=k.replace(/\[(\d+)\]/g,'.$1').split('.');let o=this.data;for(let i=0;i<parts.length-1;i++)o=o[parts[i]];o[parts[parts.length-1]]=v;}cb&&cb();};
const flush=async()=>{for(let n=0;n<20;n++){await new Promise(r=>setImmediate(r));while(timers.length)timers.shift()();}};

(async()=>{
  // 没有观影记录：新建手工票根，正反面都画成图片
  page.onLoad({film:film.id});await flush();
  assert.equal(page._artStyle,'watercolor');
  assert(page.data.ok&&!page.data.existing&&!page.data.linked);
  assert(files.get(page.data.frontImg).includes('纪念票根'),'front face rendered to an image');
  assert(files.get(page.data.backImg).includes('收藏票根'),'back face rendered to an image');
  // 盲盒（2026-11-22）：没有「随机换一款」；第一次打开先停在背面再翻到正面揭晓，揭晓后记进本机，下次打开不再播
  assert.equal(typeof page.shuffle,'undefined','no shuffle button in blind-box mode');
  assert(!/bindtap="shuffle"/.test(wxml),'shuffle button removed from the page');
  assert.equal(page.data.front,true,'reveal ends on the front');
  assert.equal(page.data.revealing,false);
  assert(store['sk-ticket-revealed']&&store['sk-ticket-revealed'][page._draft.key]===1,'revealed tickets are remembered on this device');
  assert.equal(page.data.custom,false,'blind-box look needs no restore button');
  assert(!('craft' in page.data),'no craft text line on the ticket page (removed 2026-11-22)');
  // 翻面：页面发转动请求（序号递增），视图层转完回报正反面
  const n0=page.data.turnReq.n;page.flip();assert.equal(page.data.turnReq.side,'back');assert.equal(page.data.turnReq.n,n0+1);
  await flush();assert.equal(page.data.front,false);assert.match(page.data.edge,/^#[0-9a-f]{6}$/,'paper edge colour comes from the palette');
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
  // 拖动中（bindchanging）实时重画正面，不等松手
  const beforeLive=page.data.frontImg;
  page.changeField({type:'changing',currentTarget:{dataset:{field:'crop'}},detail:{value:35}});await flush();
  assert.notEqual(page.data.frontImg,beforeLive,'crop preview updates while dragging');assert.equal(page.data.draft.crop,35);
  page.changeField({type:'changing',currentTarget:{dataset:{field:'crop'}},detail:{value:36}});page.changeField({type:'changing',currentTarget:{dataset:{field:'crop'}},detail:{value:37}});await flush();
  assert.equal(page._liveBusy,false,'live crop loop settles');
  page.changeField({type:'change',currentTarget:{dataset:{field:'crop'}},detail:{value:20}});await flush();await new Promise(r=>setTimeout(r,200));await flush();
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
  // 从详情页保存回来：收藏册原地刷新，保留已加载的张数和滚动位置（不重置回前 48 张，否则会回到错位的地方）
  const scrolls=[];wx.pageScrollTo=o=>scrolls.push(o.scrollTop);
  const album2={...albumOptions,data:{...albumOptions.data,mode:'album',shown:96},setData:page.setData,_filmStyles:Art.readFilmStyles(wx.getStorageSync),_shownOnce:true,
    _q:{text:'',year:'',programme:[],city:[],venue:[],format:[]},_limit:96,_scrollTop:1234,_rev:-1,_opened:'',
    paint(append,done){this.painted2=[append,this._limit];done&&done();}};
  album2.onShow();
  assert.deepEqual(album2.painted2,[false,96],'returning keeps the tickets already loaded');
  assert.deepEqual(scrolls,[1234],'returning restores the scroll position');
  console.log('PASS: ticket editor page — native scrolling/back, image preview with 360° turning (turn.wxs), blind-box reveal (no shuffle), show picker, per-film artwork styles and album fallback, crop flips to front, crop save-in-place, save, export, remove; album keeps its place after saving.');
})().catch(e=>{console.error(e);process.exitCode=1;});
