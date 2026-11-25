// 小程序「影院地图与交通」页（2026-11-26）：地图固定、列表滚动；点影院展开本院影片与排片、筛选、加入排片
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.join(__dirname,'..'),base=require('./full-data.js'),U=require('../miniprogram/utils/util.js'),VB=require('../miniprogram/utils/venue-board.js');
const dir=path.join(root,'miniprogram/pages/venues');
const wxml=fs.readFileSync(path.join(dir,'venues.wxml'),'utf8'),json=JSON.parse(fs.readFileSync(path.join(dir,'venues.json'),'utf8'));
assert.equal(json.disableScroll,true,'page itself must not scroll');
assert(wxml.indexOf('<map')<wxml.indexOf('<scroll-view class="vn-list"'),'map sits above the scrolling list');
assert(!wxml.slice(wxml.indexOf('<scroll-view class="vn-list"')).includes('<map'),'map is not inside the scrolling list');
const data=JSON.parse(JSON.stringify(base)),app={globalData:{data},onData:()=>()=>{}};
const picked=new Set(),asked=[],toasts=[],moved=[],listeners=[];
const plan={get:()=>picked,onChange:fn=>{listeners.push(fn);return()=>{};},toggle:k=>{if(picked.has(k))picked.delete(k);else picked.add(k);listeners.forEach(f=>f());return picked.has(k);}};
let def;
vm.runInNewContext(fs.readFileSync(path.join(dir,'venues.js'),'utf8'),{Page:p=>def=p,getApp:()=>app,console,
  require:n=>n.endsWith('/util.js')?U:n.endsWith('/venue-board.js')?VB:n.endsWith('/plan.js')?plan:n.endsWith('/remind.js')?{ask:p=>asked.push(p)}:n.endsWith('/totop.js')?{scroll(){},go(){}}:n.endsWith('/hometip.js')?{show(){},home(){},close(){}}:{tr:x=>x,dict:()=>({}),isEn:()=>false},
  wx:{setNavigationBarTitle(){},showToast:o=>toasts.push(o.title),navigateTo(){},createMapContext:()=>({moveToLocation:o=>moved.push(o),includePoints(){}}),createSelectorQuery(){return{select(){return this},boundingClientRect(){return this},selectViewport(){return this},scrollOffset(){return this},exec(){}}}}});
const page={...def,data:JSON.parse(JSON.stringify(def.data)),setData(o,done){for(const [k,v] of Object.entries(o)){const ks=k.split('.');let t=this.data;while(ks.length>1)t=t[ks.shift()];t[ks[0]]=v;}if(done)done();}};
// 用真实片库挑一个有多家影院、且有待映场次的专题（按当前时间）
const idx=U.index(data);
const pick=data.programmes.find(p=>{const sh=data.shows.filter(s=>idx.F[s.id]&&U.progForShow(s,idx).id===p.id);return new Set(sh.map(s=>s.v)).size>1&&sh.some(s=>!U.ended(s,idx));})||data.programmes.find(p=>new Set(data.shows.filter(s=>s.p===p.id).map(s=>s.v)).size>1);
page.onLoad({id:pick.id});
assert(page.data.venueRows.length>1);assert.equal(page.data.activeId,'');assert.equal(page.data.panel,null);
assert(page.data.venueRows.every(r=>/部|场/.test(r.cntText)),'each card shows film / screening counts');
const target=page.data.venueRows.find(r=>/待映/.test(r.cntText))||page.data.venueRows[0];
page.selectVenue({currentTarget:{dataset:{id:target.id}}});
assert.equal(page.data.activeId,target.id);assert(page.data.panel&&page.data.panel.id===target.id,'panel opens for the tapped venue');
assert.equal(page.data.intoView,'vc-'+target.domIdx,'list scrolls to the card');
if(target.geo)assert(moved.length===1&&moved[0].latitude===target.geo.lat,'map pans to the venue');
const shows=data.shows.filter(s=>s.v===target.id&&idx.F[s.id]&&U.progForShow(s,idx).id===pick.id);
const P=page.data.panel,upRows=P.up.flatMap(g=>g.rows);
const dayN=P.days.length?P.days.slice(1).reduce((n,d)=>n+parseInt(d.n,10),0):upRows.length;
assert.equal(dayN+(P.pastN||0),shows.length,'every screening at the venue is in the panel (upcoming by day + screened)');
assert.equal(P.films.length,new Set(shows.filter(s=>!idx.F[s.id].ev).map(s=>s.id)).size,'poster strip lists every film at the venue');
if(upRows.length){
  const r=upRows[0];page.toggle({currentTarget:{dataset:{key:r.key}}});
  assert(picked.has(r.key)&&asked.length===1&&asked[0].key===r.key,'adding asks for the reminder subscription');
  assert(page.data.panel.up.flatMap(g=>g.rows).find(x=>x.key===r.key).picked,'row reflects the plan');
  page.toggle({currentTarget:{dataset:{key:r.key}}});assert(!picked.has(r.key));
}
// 只看一部影片 → 再点取消
const f0=P.films[0];page.pickFilm({currentTarget:{dataset:{id:f0.id}}});
assert(page.data.panel.filmName.includes(f0.cn));assert(page.data.panel.up.flatMap(g=>g.rows).every(x=>x.id===f0.id));
page.pickFilm({currentTarget:{dataset:{id:''}}});assert.equal(page.data.panel.filmName,'');
// 日期条
if(page.data.panel.days.length>2){const d=page.data.panel.days[2];page.pickDay({currentTarget:{dataset:{key:d.key}}});assert(page.data.panel.up.every(g=>g.key===d.key));}
// 已放映折叠
if(page.data.panel.pastN){assert.equal(page.data.panel.past.length,0);page.togglePast();assert(page.data.panel.past.length>0);}
// 地图上点另一家影院
const other=page.data.venueRows.find(r=>r.geo&&r.id!==target.id);
if(other){const mid=page._geoRows.findIndex(r=>r.id===other.id)+1;page.onMarkerTap({detail:{markerId:mid}});assert.equal(page.data.activeId,other.id);assert.equal(page.data.panel.id,other.id);assert.equal(page.data.pastOpen,false);}
// 再点同一家收起
page.selectVenue({currentTarget:{dataset:{id:page.data.activeId}}});assert.equal(page.data.activeId,'');assert.equal(page.data.panel,null);
// 回到顶部走 scroll-into-view
page.toTop();assert.equal(page.data.intoView,'vn-head');
console.log('PASS: mini-program venues page — fixed map + scrolling list, venue panel, film/day filters, plan toggle, marker tap ('+pick.id+').');
