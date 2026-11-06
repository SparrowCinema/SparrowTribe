const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const cat=read('data/catalog.json'),evidence={};
for(const n of fs.readdirSync(path.join(root,'docs')).filter(n=>/^world-premiere.*\.json$/.test(n)))Object.assign(evidence,read('docs/'+n).verifiedRecords||{});
const seen=new Map(),counts={};
function validDate(s){
 if(!/^\d{4}(?:-\d{2})?(?:-\d{2})?$/.test(s||''))return false;
 const [y,m=1,d=1]=s.split('-').map(Number),dt=new Date(Date.UTC(y,m-1,d));
 return y>=1888&&dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d;
}
for(const prog of cat.programmes){if(!prog.file)continue;for(const f of read(prog.file).films||[]){if(f.ev)continue;
 const p=f.worldPremiere,label=f.id+' '+f.cn;
 assert(p&&typeof p==='object'&&!Array.isArray(p),label+' requires worldPremiere (run build-fallback to initialise unknown records)');
 assert(['verified','partial','pending','unannounced','withheld','not-applicable'].includes(p.status),label+' invalid premiere status');
 assert(['festival','theatrical','unknown','collection'].includes(p.kind),label+' invalid premiere kind');
 assert(p.date===null||validDate(p.date),label+' invalid premiere date');
 for(const k of ['festival','festivalEn'])assert(p[k]===null||typeof p[k]==='string'&&p[k].trim(),label+' requires explicit '+k);
 if(p.kind==='festival'&&p.festival)assert(p.festivalEn&&!/[\u3400-\u9fff]/.test(p.festivalEn),label+' premiere festival needs English');
 if(['verified','partial'].includes(p.status)){
  assert(p.date&&validDate(p.checked)&&p.checked.length===10,label+' verified premiere needs date and check date');
  assert(p.status!=='verified'||p.date.length===10,label+' incomplete date must be partial');
  assert(p.kind==='theatrical'||p.kind==='festival'&&p.festival&&p.festivalEn,label+' verified premiere needs context');
  assert(evidence[f.id]?.sources?.length,label+' verified premiere needs internal evidence');
 }
 if(['pending','unannounced','withheld'].includes(p.status))assert(p.date===null&&p.festival===null&&p.festivalEn===null&&p.kind==='unknown',label+' unknown premiere must not publish guessed data');
 if(p.kind==='collection')assert(f.parts?.length&&p.status==='not-applicable',label+' collection must identify included works');
 if(seen.has(f.id))assert.deepStrictEqual(p,seen.get(f.id),label+' premiere differs between programmes');else{seen.set(f.id,p);counts[p.status]=(counts[p.status]||0)+1;}
}}
assert(validDate('2024-02-29')&&!validDate('2026-02-29')&&!validDate('2026-13-01'));
const P=require('../shared/premiere.js');assert.equal(P.rows({ev:1},false).length,0);assert.equal(P.rows({},false)[0][1],'待核实');assert.equal(P.rows({worldPremiere:{status:'withheld'}},true)[0][1],'Not disclosed');
console.log('PASS: premiere fields and evidence for '+seen.size+' films '+JSON.stringify(counts));
