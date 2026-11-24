// 海报墙「放映」视图（2026-11-25）：小程序 ring.wxs 的跟手 / 吸附 / 远近切换，以及页面的资料栏与换片。
// ring.wxs 是 ES5，这里用假的视图层组件和时钟在 Node 里跑。在单独的进程里运行（往本机存储写了观影记录）。
if(!process.env.PRING_CHILD){const r=require('node:child_process').spawnSync(process.execPath,[__filename],{env:{...process.env,PRING_CHILD:'1'},stdio:'inherit'});if(r.status){process.exitCode=r.status;throw new Error('check-poster-ring failed');}return;}
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.join(__dirname,'../miniprogram/packages/collect/poster-wall');

// ---------- ring.wxs ----------
let clock=1e6;const raf=[];
const wxsSrc=fs.readFileSync(path.join(dir,'ring.wxs'),'utf8');
const mod={exports:{}};vm.runInNewContext(wxsSrc,{module:mod,getDate:()=>new Date(clock),Math});
const R=mod.exports;
const comp=()=>{const c={style:'',set:[],setStyle(v){this.style=v;this.set.push(v);},getState(){return this.st||(this.st={});},requestAnimationFrame(f){raf.push(f);}};return c;};
const M=24,L=40,faces=Array.from({length:M},comp),shades=Array.from({length:M},comp),world=comp(),stage=comp(),calls=[];
const owner={selectComponent:s=>s==='.pr-world'?world:null,selectAllComponents:s=>s==='.pr-face'?faces:s==='.pr-shade'?shades:[],callMethod:(n,a)=>calls.push([n,a])};
const run=(ms=3000)=>{for(let t=0;t<ms&&raf.length;t+=16){clock+=16;const q=raf.splice(0);q.forEach(f=>f());}};
const last=n=>{for(let i=calls.length-1;i>=0;i--)if(calls[i][0]===n)return JSON.parse(JSON.stringify(calls[i][1]));return null;};
const ev=(type,touches,target={dataset:{}})=>({type,instance:stage,touches,changedTouches:touches,target});
const T=(x,y)=>({clientX:x,clientY:y});

R.cfg({w:390,h:440,M,L,key:'k'},null,owner,stage);
assert(/perspective/.test(JSON.stringify(stage.style)),'stage gets a perspective');
assert(/width:\d/.test(faces[0].style)&&/translate3d\(0\.0px,0,/.test(faces[0].style),'front face sized and centred');
assert.deepEqual(last('ringFront'),{p:0},'initial front reported');
// 正面完全不透明，背后的位置近看时隐藏
assert(/opacity:1\.000/.test(faces[0].style),'front face visible');
assert(/opacity:0\.000/.test(faces[12].style),'far side hidden when close');

// 向左拖动：转向下一张，松手吸附到整数位置
R.start(ev('touchstart',[T(300,200)]),owner);
for(let k=1;k<=8;k++){clock+=16;assert.equal(R.move(ev('touchmove',[T(300-k*24,202)]),owner),false,'horizontal drag blocks page scroll');}
R.end(ev('touchend',[]),owner);run();
const st=stage.getState(),step=360/M;
assert(st.rot>0,'dragging left brings the next poster forward');
assert(Math.abs(st.rot/step-Math.round(st.rot/step))<1e-6,'snaps to a whole poster');
assert.equal(last('ringFront').p,Math.round(st.rot/step),'front position reported after snapping');
const before=st.rot;

// 竖向滑动：不转动，也不拦截页面滚动
R.start(ev('touchstart',[T(200,300)]),owner);
for(let k=1;k<=5;k++){const r=R.move(ev('touchmove',[T(201,300-k*30)]),owner);assert.notEqual(r,false,'vertical swipe keeps page scrolling');}
R.end(ev('touchend',[]),owner);run();assert.equal(st.rot,before,'vertical swipe does not spin');

// 点侧面的海报：转到正面；点正面：打开影片
const side=(Math.round(st.rot/step)+1)%M;
R.start(ev('touchstart',[T(330,200)],{dataset:{slot:side}}),owner);R.end(ev('touchend',[]),owner);run();
assert.equal(Math.round(st.rot/step)%M,side,'tapping a side poster turns it to the front');
calls.length=0;
R.start(ev('touchstart',[T(200,200)],{dataset:{slot:side}}),owner);R.end(ev('touchend',[]),owner);
assert.deepEqual(last('ringOpen'),{p:Math.round(st.rot/step)},'tapping the front poster opens the film');

// 按钮：下一部 / 上一部 / 全景
const p0=Math.round(st.rot/step);
R.cmd({n:1,a:'next'},null,owner,stage);run();assert.equal(Math.round(st.rot/step),p0+1,'next button');
R.cmd({n:2,a:'prev'},null,owner,stage);run();assert.equal(Math.round(st.rot/step),p0,'prev button');
R.cmd({n:3,a:'zoom'},null,owner,stage);run();assert.equal(st.t,1,'zoomed out');assert.deepEqual(last('ringFar'),{far:true},'far reported');
assert(/opacity:1\.000/.test(faces[12].style),'whole ring visible when far');
assert(/rotateY\(180deg\)/.test(faces[12].style),'back half turned to face the camera');
// 全景里点任意一张：推近并转到它
R.start(ev('touchstart',[T(100,250)],{dataset:{slot:5}}),owner);R.end(ev('touchend',[]),owner);run();
assert.equal(st.t,0,'tap in overview zooms back in');assert.equal(Math.round(st.rot/step)%M,5,'tapped poster comes to the front');
assert.deepEqual(last('ringFar'),{far:false},'near reported');
// 双指捏合拉远、张开推近
R.start(ev('touchstart',[T(150,200),T(250,200)]),owner);R.move(ev('touchmove',[T(180,200),T(220,200)]),owner);run();assert.equal(st.tT,1,'pinch in zooms out');
R.end(ev('touchend',[]),owner);
R.start(ev('touchstart',[T(180,200),T(220,200)]),owner);R.move(ev('touchmove',[T(120,200),T(280,200)]),owner);run();assert.equal(st.tT,0,'pinch out zooms in');
R.end(ev('touchend',[]),owner);

// ---------- 页面：资料栏与换片 ----------
const store={};
const wx={getStorageSync:k=>store[k]===undefined?'':JSON.parse(JSON.stringify(store[k])),setStorageSync:(k,v)=>{store[k]=JSON.parse(JSON.stringify(v));},removeStorageSync:k=>{delete store[k];},
  createSelectorQuery(){return {in(){return this;},select(){return this;},fields(){return this;},boundingClientRect(cb){this.cb=cb;return this;},exec(){this.cb&&this.cb({width:375,height:440});}};},
  showToast(){},showLoading(){},hideLoading(){},setNavigationBarTitle(){},navigateTo(o){wx.lastNav=o.url;},onWindowResize(){},offWindowResize(){},
  getAppBaseInfo:()=>({theme:'light',language:'zh_CN'}),getSystemSetting:()=>({}),getWindowInfo:()=>({windowWidth:375,windowHeight:812}),getSystemInfoSync:()=>({windowWidth:375,windowHeight:812}),onThemeChange(){},cloud:{callFunction:()=>Promise.resolve({})}};
global.wx=wx;
const data=require('./full-data.js');
const films=data.films.filter(f=>!f.ev).slice(0,L),t0=Date.now();
store['sk-watched-v1']=Object.fromEntries(films.map((f,i)=>[f.id,{d:'2026-'+String(1+i%11).padStart(2,'0')+'-'+String(1+i%27).padStart(2,'0'),r:i%11,t:t0}]));
store['sk-pw-view']='ring';
let options;
const sandbox={Page:o=>{options=o;},getApp:()=>({globalData:{data,full:true},onData:()=>()=>{}}),wx,console,setTimeout:f=>{f();return 0;},clearTimeout(){},Date,require:name=>require(path.join(dir,name))};
vm.runInNewContext(fs.readFileSync(path.join(dir,'poster-wall.js'),'utf8'),sandbox,{filename:'poster-wall.js'});
const page={...options,data:JSON.parse(JSON.stringify(options.data))};
page.setData=function(p,cb){for(const [k,v] of Object.entries(p)){const parts=k.replace(/\[(\d+)\]/g,'.$1').split('.');let o=this.data;for(let i=0;i<parts.length-1;i++){if(o[parts[i]]==null)o[parts[i]]={};o=o[parts[i]];}o[parts[parts.length-1]]=JSON.parse(JSON.stringify(v===undefined?null:v));}cb&&cb();};
page.onLoad({});
assert.equal(page.data.view,'ring','remembers the reel view');
const ring=page.data.ring,list=page._entries;
assert.equal(list.length,L,'all watched films in the wall');
assert.equal(ring.slots.length,24,'ring capped at 24 positions');
assert.deepEqual(page.data.ringCfg,{w:375,h:440,M:24,L,key:list.map(e=>e.id).join(',')},'stage measured and passed to ring.wxs');
assert.equal(ring.info.title,list[0].f.cn,'info shows the front film');assert.equal(ring.pos,'1 / '+L);
assert(ring.info.rows.some(r=>r.k==='导演'),'director row');assert(ring.info.seen.startsWith(list[0].rec.d),'viewing date shown');
// 转到背后：后面的影片换进圈里
page.ringFront({p:20});
assert.equal(page.data.ring.pos,'21 / '+L);assert.equal(page.data.ring.info.title,list[20].f.cn);
const ids=new Set(page.data.ring.slots.map(s=>s.id));assert(ids.has(list[30].id),'films beyond the first 24 swap into the ring');
assert.equal(page.data.ring.slots[(30)%24].id,list[30].id,'slot holds the film nearest the front');
page.ringFront({p:-1});assert.equal(page.data.ring.pos,L+' / '+L,'turning back wraps to the last film');
page.ringOpen({p:-1});assert.equal(wx.lastNav,'/pages/film/film?id='+encodeURIComponent(list[L-1].id),'opens the front film');
page.ringFar({far:true});assert.equal(page.data.ring.far,true);
page.ringBtn({currentTarget:{dataset:{a:'zoom'}}});assert.deepEqual(page.data.ringCmd,{n:1,a:'zoom'});
page.setView({currentTarget:{dataset:{v:'grid'}}});assert.equal(store['sk-pw-view'],'grid');assert.equal(page.data.view,'grid');
// 网页版同名规则
const web=require('./web-source').read();
for(const k of ['function pwrMount','function pwrApply','PW_RING_MAX=36',"sparrow-pw-view"])assert(web.includes(k),'web reel view: '+k);
console.log('PASS: poster wall reel view — ring.wxs drag, snap, vertical scroll pass-through, tap side / front, prev / next, overview zoom, pinch; mini-program info panel, 24-slot ring with swapping, wrap-around, view toggle.');
