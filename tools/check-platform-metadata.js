// Identity regression checks for similarly named festival films.
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const gr=read('data/programmes/golden-rooster-2026.json'),gh=read('data/programmes/golden-horse-2026.json'),cat=read('data/catalog.json');
const audit=read('docs/golden-rooster-platform-audit-2026-11-03.json'),data=require('../miniprogram/data/data.js');
assert.equal(gr.films.length,83);assert.equal(gr.shows.length,173);
for(const f of gr.films){
  const a=audit.films.find(a=>a.id===f.id);assert(a,f.id);
  assert.deepStrictEqual(f.r,a.after.r,f.id+' rating evidence');
  assert.deepStrictEqual(f.links,a.after.links,f.id+' link evidence');
  assert(/^\d+$/.test(f.links.douban));
  if(f.links.imdb)assert(/^tt\d+$/.test(f.links.imdb));
  if(f.links.lb)assert(/^[a-z0-9-]+$/.test(f.links.lb));
  f.r.forEach((v,i)=>assert(v===null||Number.isFinite(v)&&v>=0&&v<=[10,10,100,100,5][i]));
  assert.deepStrictEqual(data.films.find(x=>x.id===f.id).r,f.r,'offline rating consistency');
}
const hongKong=gr.films.find(f=>f.id==='gr26-047'),taiwan=gh.films.find(f=>f.id==='gh63-003');
assert.equal(hongKong.links.douban,'36149739');assert.equal(hongKong.links.imdb,'tt36524315');assert.equal(hongKong.links.lb,'dead-end-2026-4');
assert.equal(taiwan.links.douban,'37394940');assert.equal(taiwan.links.imdb,'tt40868707');assert.equal(taiwan.dir,'詹淳皓');assert.equal(taiwan.min,96);
assert(!gh.shows.some(s=>s[2]==='gr26-047'));assert.equal(gh.shows.filter(s=>s[2]==='gh63-003').length,2);
assert(cat.programmes.find(p=>p.id==='golden-horse-2026').sections['gh63-003']);
assert(gr.shows.some(s=>s[2]==='gr26-047'));assert(!hongKong.honors.some(x=>x.includes('金马')));
console.log('PASS: 83 film identities, five-platform evidence, offline rating consistency, separate Hong Kong/Taiwan Dead End records and screenings.');
