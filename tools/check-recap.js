// Recap section selection affects actual drawing and output height independently.
const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path'),R=require('../shared/recap.js');
function context(){const calls=[];const c=new Proxy({calls,measureText:t=>({width:String(t).length*14}),createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:(...args)=>calls.push([k,...args])});return c;}
const item={title:'Test film',en:'Test film',date:'2026-11-07',dstamp:'07 NOV 2026',score:8,venue:'Cinema',prog:'Programme'};
const sample={title:'Recap',stats:[[2,'films']],fav:item,progs:[{name:'A',n:1,avg:8},{name:'B',n:1,avg:8}],items:[item,{...item,title:'Second film'}]};
const before=JSON.stringify(sample),ids=R.SECTIONS.map(x=>x[0]);
assert(R.heightOf(sample)>0);const footerHeight=R.heightOf({...sample,sections:[]});assert(footerHeight>0);
assert(!ids.includes('footer'));const footerOnly=context();R.draw(footerOnly,{...sample,sections:[]});assert(footerOnly.calls.some(x=>x[0]==='fillText'&&String(x[1]).includes('微信搜索')));
const all=context(),legacy=context();R.draw(all,{...sample,sections:ids});R.draw(legacy,sample);assert.deepStrictEqual(all.calls,legacy.calls);
for(let mask=0;mask<1<<ids.length;mask++){
 const sections=ids.filter((id,i)=>mask&(1<<i)),o={...sample,sections},c=context();R.draw(c,o);
 assert.equal(R.heightOf(o),sections.reduce((h,id)=>h+R.heightOf({...sample,sections:[id]})-footerHeight,footerHeight));
 const texts=c.calls.filter(x=>x[0]==='fillText').map(x=>x[1]);
 for(const [id,label] of [['stamps','印章墙'],['list','观影清单'],['favorite','本期最爱'],['programmes','按专题']])assert.equal(texts.includes(label),sections.includes(id));
}
assert.equal(JSON.stringify(sample),before);
assert.equal(R.heightOf({...sample,fav:null,sections:['favorite']}),footerHeight);
assert.equal(R.heightOf({...sample,items:[],sections:['stamps','list']}),footerHeight);
// Mini-programme wall: watched-only content, ratings, missing posters, navigation and responsive columns.
const root=path.resolve(__dirname,'..'),film=(id,ev)=>({id,cn:id,ev}),rows=[{id:'old',f:film('old'),rec:{d:'2026-10-01',r:0}},{id:'new',f:film('new'),rec:{d:'2026-11-07',r:9}},{id:'event',f:film('event',1),rec:{d:'2026-11-07',r:6}}];
const storage={},app={globalData:{data:{}},onData:()=>()=>{}},modules={'../../utils/library.js':require('../shared/library.js'),'../../utils/util.js':{index:()=>({}),poster:f=>f.id==='new'?'new.jpg':''},'../../utils/watched.js':{entries:()=>rows,onChange:()=>()=>{}},'../../utils/i18n.js':{dict:()=>({}),tr:x=>x}};let page,nav;
vm.runInNewContext(fs.readFileSync(path.join(root,'miniprogram/pages/poster-wall/poster-wall.js'),'utf8'),{require:n=>modules[n],getApp:()=>app,Page:o=>page=o,wx:{getStorageSync:k=>storage[k],setStorageSync:(k,v)=>storage[k]=v,getWindowInfo:()=>({windowWidth:390,windowHeight:844}),setNavigationBarTitle(){},navigateTo:o=>nav=o.url,switchTab:o=>nav=o.url}});
const p={...page,data:JSON.parse(JSON.stringify(page.data)),setData(v){Object.assign(this.data,v);}};p.onLoad();assert.equal(p.data.items.map(x=>x.id).join(','),'new,old');assert.equal(p.data.items[0].score,'9/10');assert.equal(p.data.items[1].score,'未评分');assert.equal(p.data.items[1].poster,'');
assert.equal(p.data.cols,5);p.measure({windowWidth:844,windowHeight:390});assert.equal(p.data.cols,10);assert.equal(Object.keys(storage).length,0);p.openFilm({currentTarget:{dataset:{id:'new'}}});assert.equal(nav,'/pages/film/film?id=new');rows.splice(1,1);p.build();assert.equal(p.data.items.map(x=>x.id).join(','),'old');p.onUnload();
assert.equal(fs.readFileSync(path.join(root,'miniprogram/utils/recap.js'),'utf8').split('\n').slice(1).join('\n'),fs.readFileSync(path.join(root,'shared/recap.js'),'utf8'));
console.log('PASS: 64 recap section combinations with mandatory branding/QR footer, independent stamps/list, compatible defaults, unchanged records and poster-wall ratings/navigation/responsive columns.');

// Run the actual website filter/render functions against a multi-year viewing archive.
const archive=[['a','2026-11-07','A'],['b','2026-10-01','B'],['c','2025-09-01','A'],['d','2022-11-01','A'],['e','2019-06-01','B']].map(([id,d,prog])=>({id,f:{id,prog,min:90},rec:{d,r:8}}));
const snapshot=JSON.stringify(archive),web=fs.readFileSync(path.join(root,'index.html'),'utf8');
const filters=web.slice(web.indexOf('let recapY='),web.indexOf('function openRecap()'));
const sandbox=vm.createContext({watchEntries:()=>archive,progOf:f=>({id:f.prog}),PROGRAMMES:[{id:'A'},{id:'B'}],PG:{A:{name:'A'},B:{name:'B'}},passportStats:list=>({n:list.length,hm:'1h30',avg:8}),esc:String,tr:x=>x,window:{SparrowRecap:R},recapSections:ids});
vm.runInContext(filters,sandbox);const run=s=>vm.runInContext(s,sandbox);
let panel=run('recapPanelHTML()');assert.equal((panel.match(/class="rc-cal"/g)||[]).length,1);assert.equal((panel.match(/data-rc="m" /g)||[]).length,12);assert(panel.includes('2026 · 月份'));assert.equal(run('recapScope().length'),2);
run("recapM=['2026-11']");assert.equal(run('recapScope().length'),1);
run("selectRecapYear('2025')");panel=run('recapPanelHTML()');assert.equal(run('recapM.length'),0);assert.equal(run('recapY.join()'),'2025');assert.equal(run('recapScope()[0].id'),'c');assert(!panel.includes('data-v="2026-11"'));
run("recapM=['2025-09'];selectRecapYear('2025')");assert.equal(run('recapM.join()'),'2025-09');
run("selectRecapYear('all')");panel=run('recapPanelHTML()');assert(!panel.includes('class="rc-cal"'));assert.equal(run('recapScope().length'),5);assert.equal(run('recapM.length'),0);
run("recapP=['B']");run('recapPanelHTML()');assert.equal(run('recapScope().length'),2);assert.equal(run('recapY.length'),0);assert.equal(run('recapSub(recapScope())'),'2019–2026 · B');
// Mini-programme executes the same year/month transitions and never builds stacked year calendars.
let myPage;const miniModules={'../../utils/recap.js':R,'../../utils/i18n.js':{tr:x=>x,isEn:()=>false},'../../utils/util.js':{index:()=>({PG:{A:{name:'A'},B:{name:'B'}},progOf:f=>({id:f.prog})})},'../../utils/watched.js':{entries:()=>archive}};
vm.runInNewContext(fs.readFileSync(path.join(root,'miniprogram/pages/my/my.js'),'utf8'),{require:n=>miniModules[n]||{},Page:o=>myPage=o,getApp:()=>({globalData:{data:{programmes:[{id:'A'},{id:'B'}]}}}),wx:{}});
const my={...myPage,data:JSON.parse(JSON.stringify(myPage.data)),setData(v){Object.assign(this.data,v);}};
my.buildRecap();assert.equal(my.data.rcY.join(), '2026');assert.equal(my.data.rc.grids.length,1);assert.equal(my.data.rc.grids[0].cells.length,12);assert.equal(my.data.rc.n,2);
my.setRcM({currentTarget:{dataset:{v:'2026-11',c:1}}});assert.equal(my.data.rc.n,1);
const year=v=>my.setRcY({currentTarget:{dataset:{v}}});year('2025');assert.equal(my.data.rcY.join(),'2025');assert.equal(my.data.rcM.length,0);assert.equal(my.data.rc.grids[0].y,'2025');assert.equal(my.recapScope()[0].id,'c');
my.setRcM({currentTarget:{dataset:{v:'2025-09',c:1}}});year('2025');assert.equal(my.data.rcM.join(),'2025-09');year('all');assert.equal(my.data.rc.grids.length,0);assert.equal(my.data.rc.n,5);assert.equal(my.data.rcM.length,0);my.buildRecap();assert.equal(my.data.rcY.length,0);
assert.equal(JSON.stringify(archive),snapshot);
console.log('PASS: web and mini recap default to the latest year, switch one calendar at a time, clear stale months, retain same-year selection and aggregate all years without month grids.');

assert.equal(JSON.parse(fs.readFileSync(path.join(root,'data/i18n/en.json'),'utf8')).ui['已汇总全部年份，选择年份可按月筛选。'],'All years included. Select a year to filter by month.');

// Period filters follow watched dates, including quarter and year boundaries.
const Lib=require('../shared/library.js'),periodRows=['2025-12-31','2026-01-01','2026-03-31','2026-04-01','2026-11-08'].map(d=>({rec:{d}}));
assert.deepStrictEqual(Lib.posterPeriods(periodRows,'year'),['2026','2025']);
assert.deepStrictEqual(Lib.posterPeriods(periodRows,'quarter'),['2026-Q4','2026-Q2','2026-Q1','2025-Q4']);
assert.equal(Lib.posterEntries(periodRows,'quarter','2026-Q1').length,2);
assert.equal(Lib.posterEntries(periodRows,'month','2026-11').length,1);
assert.equal(Lib.posterPeriod(null,'year'),'');
const wallItems=Array.from({length:11},(_,i)=>({...item,title:'Wall '+i,img:i===0?{width:300,height:450}:null}));
for(const cols of [5,10]){const o={...sample,sections:['cover','posters'],posterCols:cols,items:wallItems},ctx=context();R.draw(ctx,o);assert(ctx.calls.some(x=>x[0]==='drawImage'));assert(ctx.calls.some(x=>x[0]==='fillText'&&x[1]==='★ 8/10'));assert(ctx.calls.some(x=>x[0]==='fillText'&&String(x[1]).includes('微信搜索')));assert(R.heightOf(o)>R.heightOf({...o,items:[]}));}
assert(R.heightOf({...sample,sections:['posters'],items:wallItems,posterCols:5})>R.heightOf({...sample,sections:['posters'],items:wallItems,posterCols:10}));
rows.push({id:'new',f:film('new'),rec:{d:'2026-11-07',r:9}});p.setMode({detail:{value:2}});assert.equal(p.data.period,'2026-11');assert.equal(p.data.items.length,1);p.setPeriod({detail:{value:1}});assert.equal(p.data.period,'2026-10');assert.equal(p.data.items[0].id,'old');p.setMode({detail:{value:1}});assert.equal(p.data.period,'2026-Q4');
console.log('PASS: annual/quarter/month watched-date boundaries, mini period switching, poster PNG layout, ratings, missing images and mandatory footer.');

// A growing programme catalogue uses one searchable multi-select without losing selections.
assert(!run("recapProgrammeHTML(['A','B'],()=>'<button></button>')").includes('rc-programme-picker'));
run("PG.C={name:'C'};PG.D={name:'D'};PG.E={name:'E'};recapP=['A','E']");
const programmePicker=run("recapProgrammeHTML(['A','B','C','D','E'],(v,n,on)=>'<button data-v='+v+' aria-pressed='+on+'>'+n+'</button>')");
assert(programmePicker.includes('rc-prog-search'));assert(programmePicker.includes('A、E'));assert(programmePicker.includes('data-v=E aria-pressed=true'));
my.toggleAppearance();assert.equal(my.data.appearanceOpen,true);my.toggleAppearance();assert.equal(my.data.appearanceOpen,false);my.toggleRcProgrammes();assert.equal(my.data.rcProgOpen,true);
console.log('PASS: compact programme multi-select threshold, retained selection labels and collapsible appearance.');
