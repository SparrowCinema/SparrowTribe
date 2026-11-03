const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const cat=read('data/catalog.json'),en=read('data/i18n/en.json'),films=new Map();
for(const p of cat.programmes){if(!p.file)continue;for(const f of read(p.file).films){
 const label=f.id+' '+f.cn,r=f.contentReview,e=en.films[f.id];
 assert(Array.isArray(f.warnings),label+' requires a warnings array (empty only when explicitly unverified)');
 assert(r&&['synopsis-reviewed','official-advisory','pending'].includes(r.status),label+' requires contentReview.status');
 assert(/^\d{4}-\d{2}-\d{2}$/.test(r.checked||''),label+' requires review date');
 assert(['unverified','flashing'].includes(r.sensory),label+' requires explicit sensory verification state');
 assert(f.contentNote&&f.editorial,label+' requires guidance and an individual selection note');
 assert(e&&e.contentNote&&e.editorial&&Array.isArray(e.warnings),label+' requires English guidance and note');
 assert(!/[\u3400-\u9fff]/.test(e.contentNote+e.editorial+e.warnings.join('')),label+' English layer contains untranslated material');
 assert(!f.warnings.some(w=>/^(同性恋|同性恋情|跨性别|残障|移民|宗教|女性)$/.test(w)),label+' identity itself must not be a warning');
 if(f.mpa){assert(['G','PG','PG-13','R','NC-17'].includes(f.mpa.rating),label+' invalid MPA classification');assert(f.mpa.checked&&f.mpa.edition,label+' rating needs edition/date');}
 if(films.has(f.id)){const prev=films.get(f.id);for(const k of ['warnings','contentReview','contentNote','editorial','mpa'])assert.deepStrictEqual(f[k],prev[k],label+' guidance differs between programmes');}
 films.set(f.id,f);
}}
console.log('PASS: content notes, verification states and bilingual individual notes for '+films.size+' unique films.');
