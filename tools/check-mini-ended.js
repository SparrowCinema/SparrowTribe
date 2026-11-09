// Exercise real mini-program render models, including the flag passed into WXML.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.join(__dirname,'..'),base=require('../miniprogram/data/data.js'),U=require('../miniprogram/utils/util.js'),L=require('../shared/library.js'),P=require('../shared/premiere.js');
const ids=JSON.parse(fs.readFileSync(path.join(root,'docs/world-premiere-2026-11-10-enrichment.json'))).reviewedFilms;
const data=JSON.parse(JSON.stringify(base)),app={globalData:{data},onData:()=>()=>{}},picked=new Set();
function load(name){let definition;vm.runInNewContext(fs.readFileSync(path.join(root,'miniprogram/pages',name,name+'.js'),'utf8'),{
 Page:p=>definition=p,getApp:()=>app,require:n=>n.endsWith('/util.js')?U:n.endsWith('/library.js')?L:n.endsWith('/premiere.js')?P:n.endsWith('/plan.js')?{get:()=>picked,onChange:()=>()=>{}}:n.endsWith('/watched.js')?{all:()=>({}),onChange:()=>()=>{}}:{tr:x=>x,dict:()=>({}),isEn:()=>false},
 wx:{setNavigationBarTitle(){}}});return {...definition,data:JSON.parse(JSON.stringify(definition.data)),setData(o,done){Object.assign(this.data,o);if(done)done();}};}
const programme=load('programme');programme.id='cinema-2026';programme.buildEvents=()=>{};programme.build();
const films=load('films');films.onLoad();const cinema=films.data.secs.find(x=>x.id==='cinema-2026');assert(cinema);
for(const id of ids){assert(programme.data.gone.some(f=>f.id===id),id+' must be archived on programme page');assert(!programme.data.films.some(f=>f.id===id),id+' must not be upcoming');assert(cinema.gone.some(f=>f.id===id),id+' must be archived in film catalogue');assert(!cinema.live.some(f=>f.id===id));}
const detail=load('film');detail.buildMine=()=>{};detail.fitHero=()=>{};
for(const id of ids){detail.id=id;detail.build();assert.equal(detail.data.f.ended,true,id+' archive flag must reach WXML');assert.equal(detail.data.cnt,'已下映');assert.equal(detail.data.shows.length,0);}
// An unscheduled film without the flag remains pending; a genuine future show wins over an old flag.
const sample=data.films.find(f=>ids.includes(f.id));sample.ended=false;programme.build();assert(programme.data.films.some(f=>f.id===sample.id));detail.id=sample.id;detail.build();assert.equal(detail.data.f.ended,false);assert.equal(detail.data.cnt,'0 场');
sample.ended=true;const v=data.venues[0];data.shows.push({id:sample.id,p:'cinema-2026',d:'12/30',t:'23:59',v:v.id,h:v.halls[0].id});programme.build();assert(programme.data.films.some(f=>f.id===sample.id),'real upcoming screenings must remain visible');
// The cloud response's slim form must preserve this lightweight classification field.
const cloud=fs.readFileSync(path.join(root,'cloudfunctions/getData/index.js'),'utf8'),start=cloud.indexOf('const HEAVY ='),end=cloud.indexOf('// 诊断模式',start),ctx=vm.createContext({});
vm.runInContext(cloud.slice(start,end)+'\nthis.result=slim({films:[{id:"archived",ended:true,syn:"plot"}],shows:[]});',ctx);assert.equal(ctx.result.films[0].ended,true);
assert(fs.readFileSync(path.join(root,'miniprogram/pages/film/film.wxml'),'utf8').includes('f.ended'));
console.log('PASS: 21 archived films in real mini-program programme, catalogue and detail models; pending/upcoming precedence and cloud response flag retention.');
