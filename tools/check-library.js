const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.join(__dirname,'..'),L=require('../shared/library.js');
const films=[{id:'a',prog:'festival',cn:'Alpha',dir:'Jane Doe'},{id:'b',prog:'festival',cn:'Bravo'},{id:'c',prog:'other',cn:'Charlie',screeningNotes:{c:'Post-screening event · Director'}},{id:'d',prog:'other',cn:'Delta'}];
const shows=[{id:'a',p:'festival',k:'a'},{id:'a',p:'other',k:'a2'},{id:'b',p:'festival',k:'b'},{id:'c',p:'other',k:'c'}];
const ctx={shows,picked:new Set(['a2','b']),watched:{a:{d:'2026-11-01',r:8},b:{del:1,t:1}},keyOf:s=>s.k,programme:'all',showProgramme:s=>s.p};
assert(L.category(films[0],'planned',ctx));assert(L.category(films[0],'watched',ctx));assert(L.category(films[1],'unwatched',ctx));assert(!L.category(films[1],'watched',ctx));assert(L.category(films[2],'qa',ctx));assert(!L.category(films[3],'qa',ctx));assert(L.matches(films[0],'alpha jane'));assert(!L.matches(films[0],'alpha missing'));
ctx.programme='festival';assert(!L.category(films[0],'planned',ctx));assert(L.category(films[1],'planned',ctx));assert(!L.category(films[2],'qa',ctx));assert(L.inProgramme(films[0],'other',ctx));assert(!L.inProgramme(films[3],'festival',ctx));
ctx.programme='all';assert(!L.category({...films[0],qaGuest:'Director',qaStart:'15:00',qaEnd:'14:00'},'qa',ctx));assert(L.category({...films[0],qaGuest:'Director',qaStart:'14:00',qaEnd:'15:00'},'qa',ctx));
// A catalogue membership can precede any screenings in its secondary programme.
assert(L.inProgramme(films[3],'cinema-2026',{...ctx,programmeIds:f=>f.id==='d'?['other','cinema-2026']:[]}));
assert(!L.inProgramme(films[3],'festival',{...ctx,programmeIds:()=>['other','cinema-2026']}));
assert.equal(fs.readFileSync(path.join(root,'miniprogram/utils/library.js'),'utf8'),fs.readFileSync(path.join(root,'shared/library.js'),'utf8'));
// Exercise the mini-program page with real catalogue/utility data and reversible in-memory records.
const data=require('./full-data.js'),U=require('../miniprogram/utils/util.js');let page;
// Double-bill containers stay eligible for schedule and history lookup, but leave the catalogue.
const pingyao = data.films.filter(f => f.prog === 'pingyao-2026' && f.screeningParts?.length);
assert.equal(pingyao.length, 6);
const splitIds = pingyao.flatMap(f => f.screeningParts);
assert.equal(new Set(splitIds).size, 12);
assert.equal(data.shows.filter(s => pingyao.some(f => f.id === s.id)).length, 9);
for (const group of pingyao) {
 assert(!L.catalogueFilm(group));
 for (const [i, id] of group.screeningParts.entries()) {
  const film = data.films.find(f => f.id === id);
  assert(film && L.catalogueFilm(film), id + ' must have an independent catalogue entry');
  assert.equal(film.min, group.parts[i].min);
  assert.deepStrictEqual(L.screeningGroups(id, [...data.films, group]).map(f => f.id), [group.id]);
 }
}
const picked=new Set(),watched={},app={globalData:{data},onData:()=>()=>{}};
const sandbox={Page:p=>page=p,getApp:()=>app,require:n=>n.endsWith('/remind.js')?{ask(){},cancel(){},has(){return false},hasWant(){return false},refresh(){},syncTmpl(){},tmpl(){return ''}}:n.endsWith('/stats.js')?{stat(){},flush(){}}:n.endsWith('/want.js')?{all:()=>({}),isOn:()=>false,newCount:()=>0,markSeen(){},onChange:()=>()=>{}}:n.endsWith('/library.js')?L:n.endsWith('/util.js')?U:n.endsWith('/plan.js')?{get:()=>picked,onChange:()=>()=>{}}:n.endsWith('/watched.js')?{all:()=>watched,onChange:()=>()=>{}}:{tr:x=>x,dict:()=>({}),isEn:()=>false},wx:{setNavigationBarTitle(){}}};
vm.runInNewContext(fs.readFileSync(path.join(root,'miniprogram/pages/films/films.js'),'utf8'),sandbox);page.data=JSON.parse(JSON.stringify(page.data));page.setData=x=>Object.assign(page.data,x);page.onLoad();
const rows=()=>page.data.secs.flatMap(g=>g.live.concat(g.gone)).concat(page.data.past.flatMap(g=>g.rows)).concat((page.data.pastList||[]).flatMap(g=>g.rows));assert.equal(page.data.n,data.films.filter(L.catalogueFilm).length);
page.data.pf='cinema-2026';page.build();assert(rows().some(f=>f.id==='gr26-032'),'shared film must remain searchable before cinema sessions are announced');page.resetFilters();
const sample=data.shows.find(s=>s.p==='golden-rooster-2026')||data.shows.find(s=>U.progForShow(s,U.index(data)).id==='golden-rooster-2026');picked.add(U.keyOf(sample));page.data.mine='planned';page.build();assert.equal(page.data.n,1);assert.equal(rows()[0].id,sample.id);
page.data.mine='watched';watched[sample.id]={d:'2026-11-01',r:8};page.build();assert.equal(page.data.n,1);watched[sample.id]={del:1,t:1};page.build();assert.equal(page.data.n,0);
page.data.mine='all';page.openSelector({currentTarget:{dataset:{type:'personal'}}});assert.equal(page.data.selectorRows.length,10);// 全部 · 想看 · 已排片 · 看过 · 没看过 · 映后 · 字幕机 · 仅剩最后一场 · 全球首映 · 可凑空档
assert(page.data.selectorRows.some(r=>r.id==='sub')&&page.data.selectorRows.some(r=>r.id==='last')&&page.data.selectorRows.some(r=>r.id==='wp')&&page.data.selectorRows.some(r=>r.id==='fit'));
page.chooseFilter({currentTarget:{dataset:{id:'qa'}}});assert.equal(page.data.selectorType,'personal');page.closeSelector();assert.equal(page.data.selectorType,'');assert(page.data.n>0);assert(rows().every(f=>f.event));page.resetFilters();assert.equal(page.data.n,data.films.filter(L.catalogueFilm).length);
/* 多选：同一筛选内多个值是「或」，再点一次取消，全部取消回到 all */assert.equal(L.toggle('all','a'),'a');assert.equal(L.toggle('a','b'),'a,b');assert.equal(L.toggle('a,b','a'),'b');assert.equal(L.toggle('b','b'),'all');assert(L.has('a,b','b')&&!L.has('a,b','c')&&L.has('all','x')&&L.has('','x'));page.data.mine='all';page.chooseFilter({currentTarget:{dataset:{id:'qa'}}});const qaN=page.data.n;page.chooseFilter({currentTarget:{dataset:{id:'planned'}}});assert.equal(page.data.mine,'qa,planned');assert(page.data.n>=qaN);page.chooseFilter({currentTarget:{dataset:{id:'planned'}}});page.chooseFilter({currentTarget:{dataset:{id:'qa'}}});assert.equal(page.data.mine,'all');page.closeSelector();page.resetFilters();
const original=data.programmes;data.programmes=Array.from({length:20},(_,i)=>({id:'festival-'+i,name:'Programme '+i}));assert.equal(page.filterOptions('programme','').length,21);assert.equal(page.filterOptions('programme','Programme 19').length,1);data.programmes=original;
console.log('PASS: personal membership, deletion tombstones, programme-scoped plans/events, compound search, mini-program filters/reset and 20-programme search.');

// Header labels are capped independently of full programme membership.
{
 const rows=[['old','ended',10,20],['live','live',30,50],['soon','soon',60,70],['latest-past','ended',80,90],['unknown','ended',null,null]].map(([id,status,a,b])=>({p:{id,status,a,b},sec:id+' unit'}));
 const copy=JSON.stringify(rows),info=p=>p;
 assert.deepStrictEqual(L.featuredProgrammes(rows,info).map(x=>x.p.id),['soon','live']);
 assert.deepStrictEqual(L.featuredProgrammes(rows.filter(x=>x.p.status==='ended'),info).map(x=>x.p.id),['latest-past','old']);
 assert.equal(L.featuredProgrammes([],info).length,0);assert.equal(L.featuredProgrammes(rows.slice(0,1),info)[0].sec,'old unit');
 assert.equal(L.featuredProgrammes([rows[0],rows[0]],info).length,1);assert.equal(JSON.stringify(rows),copy);assert.equal(rows.length,5);
 console.log('PASS: at most two film-header programmes, active/upcoming priority, latest dates, deduplication and unchanged full membership.');
}
for(const [w,h,n] of [[390,844,5],[768,1024,5],[844,390,10],[1024,768,10],[800,800,8],[0,0,5]])assert.equal(L.posterColumns(w,h),n);
for(let w=320,prev=5;w<=1600;w+=20){const n=L.posterColumns(w,900);assert(n>=5&&n<=10&&n>=prev);prev=n;}
console.log('PASS: poster grid changes monotonically from 5 portrait columns to 10 landscape columns.');

// Past-programme 3-layer archive folding & horizontal book-spine helpers (scales to 100+ programmes)
{
 assert.equal(L.spineTitle('2026金马影展'), '金马影展');
 assert.equal(L.spineTitle('2026 Golden Horse Film Festival'), 'Golden Horse Film Festival');
 assert.equal(L.spineTitle('风格万相'), '风格万相');
 assert.equal(L.spineStyle('golden-horse-2026').bg, L.spineStyle('golden-horse-2026').bg);
 assert.equal(L.progEndYear({ end: '2025-11-22' }), '2025');
 assert.equal(L.progEndYear({ period: '2024.10 – 2024.11' }), '2024');
 const many = Array.from({ length: 120 }, (_, i) => ({ id: 'p-' + i, year: String(2022 + (i % 5)) }));
 const g120 = L.groupPastByYear(many, x => x.year);
 assert.equal(g120.byYear, true);
 assert.deepStrictEqual(g120.years.map(y => y.year), ['2026', '2025', '2024', '2023', '2022']);
 assert.equal(g120.years[0].items.length, 24);
 assert.equal(g120.batchSize, 12);
 const small = [{ id: 'a', year: '2026' }, { id: 'b', year: '2026' }];
 assert.equal(L.groupPastByYear(small, x => x.year).byYear, false);
 // 专题不多（≤ 一批 12 个）时不分年份，少点一层
 const eight = Array.from({ length: 8 }, (_, i) => ({ id: 'e-' + i, year: i < 1 ? '2027' : '2026' }));
 const g8 = L.groupPastByYear(eight, x => x.year);
 assert.equal(g8.byYear, false, 'eight programmes over two years should not be split by year');
 assert(g8.years.every(y => y.defOpen));
 // 分年时最近一年不足 6 个，连下一年一起默认展开
 const mixed = [].concat(Array.from({ length: 2 }, (_, i) => ({ id: 'a' + i, year: '2027' })), Array.from({ length: 20 }, (_, i) => ({ id: 'b' + i, year: '2026' })), Array.from({ length: 8 }, (_, i) => ({ id: 'c' + i, year: '2025' })));
 const gm = L.groupPastByYear(mixed, x => x.year);
 assert.equal(gm.byYear, true);
 assert.deepStrictEqual(gm.years.map(y => y.defOpen), [true, true, false]);
 assert.deepStrictEqual(g120.years.map(y => y.defOpen), [true, false, false, false, false]);
 // Verify mini-program films past drawer defaults collapsed and toggles open/picks spine cleanly
 if (page.data.pastCount > 0) {
  assert.equal(page.data.pastDrawerOpen, false, 'past drawer should be collapsed by default');
  assert.equal(page.data.pastYears.length, 0, 'collapsed past drawer should not send year/film payload');
  page.togglePastDrawer();
  assert.equal(page.data.pastDrawerOpen, true);
  assert(page.data.pastYears.length >= 1);
  const firstId = page.data.past[0].id;
  page.togglePast({ currentTarget: { dataset: { id: firstId } } });
  assert.equal(page.data.pastPick, firstId);
  assert(page.data.pastYears.some(y => y.panel && y.panel.id === firstId && y.panel.rows.length > 0));
  page.closePastPanel();
  assert.equal(page.data.pastPick, '');
  page.togglePastDrawer();
  assert.equal(page.data.pastDrawerOpen, false);
  // 搜索时不用书架：每个往期专题里命中的影片全部列出
  const pastFilm = data.films.find(f => !f.ev && f.cn && page.data.past.some(x => x.id === U.index(data).progOf(f).id));
  if (pastFilm) {
   page.search({ detail: { value: pastFilm.cn } });
   assert.equal(page.data.pastCount, 0, 'search should hide the spine drawer');
   assert.equal(page.data.pastDrawerOpen, false);
   assert(page.data.pastList.some(g => g.rows.some(r => r.id === pastFilm.id)), 'search hit in a past programme must be listed');
   assert.equal(page.data.pastList.reduce((n, g) => n + g.rows.length, 0), page.data.past.reduce((n, g) => n + g.n, 0), 'every past match is listed');
   page.resetFilters();
   assert.equal(page.data.pastList.length, 0);
  }
 }
 console.log('PASS: 3-layer past-programme spine archive folding (120-programme multi-year scale + mini-program drawer/spine toggle).');
}

