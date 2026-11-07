// Recap section selection affects actual drawing and output height independently.
const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path'),R=require('../shared/recap.js');
function context(){const calls=[];const c=new Proxy({calls,measureText:t=>({width:String(t).length*14}),createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:(...args)=>calls.push([k,...args])});return c;}
const item={title:'Test film',en:'Test film',date:'2026-11-07',dstamp:'07 NOV 2026',score:8,venue:'Cinema',prog:'Programme'};
const sample={title:'Recap',stats:[[2,'films']],fav:item,progs:[{name:'A',n:1,avg:8},{name:'B',n:1,avg:8}],items:[item,{...item,title:'Second film'}]};
const before=JSON.stringify(sample),ids=R.SECTIONS.map(x=>x[0]);
assert(R.heightOf(sample)>0);assert.equal(R.heightOf({...sample,sections:[]}),0);
const all=context(),legacy=context();R.draw(all,{...sample,sections:ids});R.draw(legacy,sample);assert.deepStrictEqual(all.calls,legacy.calls);
for(let mask=0;mask<1<<ids.length;mask++){
 const sections=ids.filter((id,i)=>mask&(1<<i)),o={...sample,sections},c=context();R.draw(c,o);
 assert.equal(R.heightOf(o),sections.reduce((h,id)=>h+R.heightOf({...sample,sections:[id]}),0));
 const texts=c.calls.filter(x=>x[0]==='fillText').map(x=>x[1]);
 for(const [id,label] of [['stamps','印章墙'],['list','观影清单'],['favorite','本期最爱'],['programmes','按专题']])assert.equal(texts.includes(label),sections.includes(id));
}
assert.equal(JSON.stringify(sample),before);
assert.equal(R.heightOf({...sample,fav:null,sections:['favorite']}),0);
assert.equal(R.heightOf({...sample,items:[],sections:['stamps','list']}),0);
// Mini-programme wall: watched-only content, ratings, missing posters, navigation and preferences.
const root=path.resolve(__dirname,'..'),film=(id,ev)=>({id,cn:id,ev}),rows=[{id:'old',f:film('old'),rec:{d:'2026-10-01',r:0}},{id:'new',f:film('new'),rec:{d:'2026-11-07',r:9}},{id:'event',f:film('event',1),rec:{d:'2026-11-07',r:6}}];
const storage={},app={globalData:{data:{}},onData:()=>()=>{}},modules={'../../utils/util.js':{index:()=>({}),poster:f=>f.id==='new'?'new.jpg':''},'../../utils/watched.js':{entries:()=>rows,onChange:()=>()=>{}},'../../utils/i18n.js':{dict:()=>({}),tr:x=>x}};let page,nav;
vm.runInNewContext(fs.readFileSync(path.join(root,'miniprogram/pages/poster-wall/poster-wall.js'),'utf8'),{require:n=>modules[n],getApp:()=>app,Page:o=>page=o,wx:{getStorageSync:k=>storage[k],setStorageSync:(k,v)=>storage[k]=v,setNavigationBarTitle(){},navigateTo:o=>nav=o.url,switchTab:o=>nav=o.url}});
const p={...page,data:JSON.parse(JSON.stringify(page.data)),setData(v){Object.assign(this.data,v);}};p.onLoad();assert.equal(p.data.items.map(x=>x.id).join(','),'new,old');assert.equal(p.data.items[0].score,'9/10');assert.equal(p.data.items[1].score,'未评分');assert.equal(p.data.items[1].poster,'');
p.columns({detail:{value:5}});assert.equal(p.data.cols,15);assert.equal(storage['sk-poster-columns-v1'],15);p.openFilm({currentTarget:{dataset:{id:'new'}}});assert.equal(nav,'/pages/film/film?id=new');rows.splice(1,1);p.build();assert.equal(p.data.items.map(x=>x.id).join(','),'old');p.onUnload();
assert.equal(fs.readFileSync(path.join(root,'miniprogram/utils/recap.js'),'utf8').split('\n').slice(1).join('\n'),fs.readFileSync(path.join(root,'shared/recap.js'),'utf8'));
console.log('PASS: 128 recap section combinations, independent stamps/list, compatible defaults, unchanged records and poster-wall ratings/navigation/preferences.');
