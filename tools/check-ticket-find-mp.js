// 小程序票根册查找（2026-11-23）：首页搜索框、筛选弹层里的「典藏」一组、从影片页进来只看这部电影。
// 在单独的进程里跑：本测试往票根存储里写了票根，留在同一进程会影响后面的票根详情页测试
if(!process.env.TFMP_CHILD){const r=require('node:child_process').spawnSync(process.execPath,[__filename],{env:{...process.env,TFMP_CHILD:'1'},stdio:'inherit'});if(r.status){process.exitCode=r.status;throw new Error('check-ticket-find-mp failed');}return;}
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.join(__dirname,'../miniprogram/packages/collect/tickets');
const wxml=fs.readFileSync(path.join(dir,'tickets.wxml'),'utf8');
// 搜索框在首页筛选条上方，弹层里不再有搜索框
assert(wxml.indexOf('tk-find')>0&&wxml.indexOf('tk-find')<wxml.indexOf('wall-filters'),'search box sits above the filter bar');
assert(!/selector-search/.test(wxml),'no search box inside the filter panel');
const store={};
const wx={getStorageSync:k=>store[k]===undefined?'':JSON.parse(JSON.stringify(store[k])),setStorageSync:(k,v)=>{store[k]=JSON.parse(JSON.stringify(v));},removeStorageSync:k=>{delete store[k];},
  createSelectorQuery(){return {in(){return this;},select(){return this;},fields(){return this;},boundingClientRect(){return this;},exec(){}};},
  createOffscreenCanvas:()=>({getContext:()=>new Proxy({},{get:()=>()=>({})})}),canvasToTempFilePath(){},showToast(){},showLoading(){},hideLoading(){},setNavigationBarTitle(){},pageScrollTo(){},
  getAppBaseInfo:()=>({theme:'light',language:'zh_CN'}),getSystemSetting:()=>({}),getWindowInfo:()=>({windowWidth:375}),getSystemInfoSync:()=>({windowWidth:375}),onThemeChange(){},cloud:{callFunction:()=>Promise.resolve({})}};
global.wx=wx;
const data=require('./full-data.js');
const films=data.films.filter(f=>!f.ev&&data.shows.some(s=>s.id===f.id)).slice(0,3);
const [a,b,c]=films,t=Date.now();
store['sk-watched-v1']={[a.id]:{d:'2026-11-20',v:[{d:'2026-11-18'},{d:'2026-11-20'}],t},[b.id]:{d:'2026-11-19',t},[c.id]:{d:'2026-11-21',t}};
let options;const timers=[];
const sandbox={Page:o=>{options=o;},getApp:()=>({globalData:{data,full:true}}),wx,console,setTimeout:f=>{timers.push(f);return 0;},clearTimeout(){},Date,
  require:name=>require(path.join(dir,name))};
vm.runInNewContext(fs.readFileSync(path.join(dir,'tickets.js'),'utf8'),sandbox,{filename:'tickets.js'});
const page={...options,data:JSON.parse(JSON.stringify(options.data))};
page.setData=function(p,cb){for(const [k,v] of Object.entries(p)){const parts=k.replace(/\[(\d+)\]/g,'.$1').split('.');let o=this.data;for(let i=0;i<parts.length-1;i++)o=o[parts[i]];o[parts[parts.length-1]]=v;}cb&&cb();};
// 先把三部电影的观影都做成票根，其中 a 的一张是现场认证
page.onLoad({});page.makeAll();
const Tix=require('../miniprogram/utils/ticketstore.js');
const all=wx.getStorageSync('sk-tickets-v2'),aKey=Object.keys(all).find(k=>k.startsWith(a.id+'|'));
assert(aKey,'tickets were made');Tix.set({[aKey]:{...all[aKey],ci:Date.now(),t:Date.now()+1}},data,require('../miniprogram/utils/util.js').index(data));
const total=page.data.all;assert(total>=4,'one ticket per viewing ('+total+')');
// 从影片页进来：只看 a，两次观影两张，筛选条显示「已选 1 项」，有《片名》标签
page.onLoad({film:encodeURIComponent(a.id)});
assert.equal(page.data.total,2,'only this film');
assert.equal(page.data.activeN,1);
assert(page.data.chips.some(x=>x.k==='film'&&x.t.includes(a.cn)),'film chip shows the title');
// 筛选弹层里有「典藏」一组，现场认证 1 张
const g=page.data.facets.find(f=>f.k==='badge');
assert(g,'collectible group in the filter panel');
assert.equal(JSON.stringify(g.items.find(x=>x.v==='checkin')),JSON.stringify({v:'checkin',t:'现场认证',c:1,on:false}),'check-in counted once');
page.toggleFacet({currentTarget:{dataset:{k:'badge',v:'checkin'}}});
assert.equal(page.data.total,1);assert(page.data.chips.some(x=>x.k==='badge'&&x.t==='现场认证'));
// 去掉只看这部：回到全部（典藏筛选仍在）
page.toggleFacet({currentTarget:{dataset:{k:'film',v:a.id}}});
assert.equal(page.data.total,1);assert(!page.data.chips.some(x=>x.k==='film'));
page.clearFacets();assert.equal(page.data.total,total);
// 搜索框：输入片名
page.inputQuery({detail:{value:b.cn}});while(timers.length)timers.shift()();
assert(page.data.total>=1&&page.data.total<total,'search narrows the list');
assert.equal(page.data.filterLabel,'全部','search text no longer shown in the filter cell');
console.log('PASS: mini program ticket book — search box on the page, collectible filter group, single-film entry from the film page.');
