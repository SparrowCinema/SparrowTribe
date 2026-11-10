const fs=require('fs'),assert=require('assert'),vm=require('vm'),S=require('../shared/screenings.js'),U=require('../miniprogram/utils/util.js');
const pack=JSON.parse(fs.readFileSync('data/programmes/cinema-2026.json')),rows=pack.shows.filter(s=>s.archive),films=pack.films.filter(f=>f.screeningArchive);
assert.equal(rows.length,21);assert.equal(rows.filter(s=>s.v==='hz-mixc-imax'&&s.h==='imax').length,10);assert.equal(rows.filter(s=>s.v==='hz-xgjy-raffles'&&s.h==='hall-4').length,11);
assert.equal(new Set(rows.map(S.keyOf)).size,21,'same-day records must remain individually selectable');
const old={d:'11/7',t:'19:30',v:'old',h:'hall',id:'original'};assert.equal(S.keyOf(old),'11/7-19:30-old-hall');
// Exercise an old cloud converter which strips optional show fields.
const cloud=S.apply({films,shows:rows.map(({d,t,id,v,h})=>({d,t,id,v,h,p:'cinema-2026'}))});
for(const s of cloud.shows){const f=films.find(f=>f.id===s.id);assert.equal(s.year,2026);assert.equal(s.archive,true);assert.equal(s.t,'19:30');assert(U.ended(s,U.index({films,shows:cloud.shows,programmes:[],venues:[]})));assert(f.screeningNotes[S.keyOf(s)].includes('用户指定'));assert.equal(f.screeningArchive.actualVerified,false);}
const web=fs.readFileSync('index.html','utf8'),year=web.match(/const year = .*;/)[0],start=web.indexOf('function showDate(s){'),end=web.indexOf('\n',start),ctx=vm.createContext({});vm.runInContext(year+'\n'+web.slice(start,end)+'\nthis.date=showDate;',ctx);
for(const s of cloud.shows){const d=ctx.date(s);assert.equal(d.getFullYear(),2026);assert(d<new Date('2026-11-10'));}
const audit=JSON.parse(fs.readFileSync('docs/cinema-ratings-2026-11-10.json'));assert.equal(audit.films.length,21);
for(const f of films){const a=audit.films.find(x=>x.id===f.id);assert.deepStrictEqual(f.r,a.ratings);assert.equal(f.r.length,5);f.r.forEach((v,i)=>assert(v===null||(typeof v==='number'&&v>=0&&v<=[10,10,100,100,5][i])));for(const x of Object.values(a.platforms))assert(x.url&&x.status);}
assert.equal(films.find(f=>f.id==='three-kingdoms-luoyang').worldPremiere.status,'partial');
console.log('PASS: 21 distinct user archive screenings, 10 IMAX / 11 Dolby halls, old-cloud metadata recovery, real web 2026 dates, unchanged legacy keys, and 105 documented rating slots.');
