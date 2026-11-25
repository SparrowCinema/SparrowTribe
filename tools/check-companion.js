const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path'),B=require('../shared/profile-backup.js'),S=require('../shared/psync.js'),L=require('../shared/library.js');
const local={v:1,watched:{alpha:{d:'2026-11-01',r:6,k:'screen-a',t:1},beta:{del:1,t:2}},holder:{n:'A',t:1},photo:{d:'data:image/jpeg;base64,AAAA',t:1},picks:{k:['screen-a'],t:1},code:'SP-SECRET'};
const pack=B.encode(local,100),copy=B.decode(JSON.parse(JSON.stringify(pack)));assert.equal(copy.photo.d,local.photo.d);assert(!JSON.stringify(pack).includes('SP-SECRET'));
const other=S.clean({v:1,watched:{gamma:{d:'2026-10-20',r:8,k:'',t:20}},picks:{k:['screen-c'],t:20}}),restored=B.restore(other,pack,100);
assert.equal(restored.watched.alpha.r,6);assert(restored.watched.gamma);assert(restored.watched.beta.del);assert.deepStrictEqual(restored.picks.k,['screen-c','screen-a']);assert.equal(restored.photo.d,local.photo.d);
assert.throws(()=>B.decode({}));assert.throws(()=>B.decode({...pack,version:2}));assert.throws(()=>B.decode({...pack,profile:{...pack.profile,photo:{d:'data:image/svg+xml,<svg onload=alert(1)>',t:1}}}));
assert.throws(()=>B.decode({...pack,profile:{...pack.profile,watched:{x:{d:'2026-02-30',r:2,t:1}}}}));assert.throws(()=>B.decode(JSON.parse('{"format":"sparrow-film-passport","version":1,"profile":{"v":1,"watched":{"__proto__":{"d":"2026-01-01"}},"holder":{"n":""},"photo":{"d":""},"picks":{"k":[]}}}')));
const cleared=B.empty(local,100),merged=S.merge(local,cleared);assert(merged.watched.alpha.del);assert.equal(merged.photo.d,'');assert.equal(merged.holder.n,'');assert.deepStrictEqual(merged.picks.k,[]);assert.equal(local.watched.alpha.r,6);
const f={id:'same',prog:'a'},shows=[{id:'same',city:'Hangzhou',p:'a',key:'h'},{id:'same',city:'Xiamen',p:'b',key:'x'}],ctx={shows,programme:'all',city:'Xiamen',cityOfShow:s=>s.city,showProgramme:s=>s.p,keyOf:s=>s.key,picked:new Set(['h']),watched:{}};
assert(L.inCity(f,'Xiamen',ctx));assert(!L.category(f,'planned',ctx));ctx.picked.add('x');assert(L.category(f,'planned',ctx));ctx.programme='a';assert(!L.inCity(f,'Xiamen',ctx));assert(L.inCity(f,'Hangzhou',ctx));assert(!L.inCity({id:'unscheduled'},'Xiamen',ctx));
const root=path.resolve(__dirname,'..');for(const m of require('./web-source').read().matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
for(const dir of ['shared','miniprogram/pages/film','miniprogram/pages/films','miniprogram/pages/my','miniprogram/pages/programme','miniprogram/pages/venues','miniprogram/packages/collect/poster-wall','miniprogram/pages/schedule','miniprogram/packages/collect/tickets','miniprogram/packages/collect/ticket-edit','miniprogram/utils'])for(const n of fs.readdirSync(path.join(root,dir)))if(n.endsWith('.js'))new vm.Script(fs.readFileSync(path.join(root,dir,n),'utf8'),{filename:dir+'/'+n});
assert.equal(fs.readFileSync(path.join(root,'shared/profile-backup.js'),'utf8'),fs.readFileSync(path.join(root,'miniprogram/utils/profile-backup.js'),'utf8'));
assert.equal(fs.readFileSync(path.join(root,'shared/tickets.js'),'utf8'),fs.readFileSync(path.join(root,'miniprogram/utils/tickets.js'),'utf8'));
assert.equal(fs.readFileSync(path.join(root,'shared/ticket-sketch.js'),'utf8'),fs.readFileSync(path.join(root,'miniprogram/utils/ticket-sketch.js'),'utf8'));
assert.equal(fs.readFileSync(path.join(root,'shared/tz.js'),'utf8'),fs.readFileSync(path.join(root,'miniprogram/utils/tz.js'),'utf8'));
assert.equal(fs.readFileSync(path.join(root,'shared/tz.js'),'utf8'),fs.readFileSync(path.join(root,'cloudfunctions/remind/tz.js'),'utf8'));
assert.equal(fs.readFileSync(path.join(root,'shared/planner.js'),'utf8'),fs.readFileSync(path.join(root,'miniprogram/utils/planner.js'),'utf8'));
console.log('PASS: backup round trip, no credentials, merge semantics, deletions, malformed imports, city-scoped selection and JavaScript parsing.');

require('./check-recap.js');
require('./check-tickets.js');
require('./check-ticket-ocr.js');
require('./check-ticket-collect.js');
require('./check-sync-quiet.js');
require('./check-checkin.js');
require('./check-autograph.js');
require('./check-autograph-trace.js');
require('./check-ticket-find.js');
require('./check-ticket-find-mp.js');
require('./check-poster-ring.js');
require('./check-wxss.js');

require('./check-film-details.js');
require('./check-mini-ended.js');

require('./check-taste-report.js');
require('./check-taste-portrait.js');
require('./check-remind.js');
require('./check-overlap.js');
require('./check-planner-tz.js');
require('./check-recommend.js');
require('./check-handbook.js');
require('./check-notes-eco.js');
require('./check-pipeline.js');
require('./check-curl.js');
require('./check-ticket-preview.js');
require('./check-getdata.js');
require('./check-domain-move.js'); // 换域名搬家（docs/domain-move.md）
// 场次编号：每场都有、不重复（tools/assign-sids.js）
require('child_process').execFileSync(process.execPath, [require('path').join(__dirname, 'assign-sids.js'), '--check'], { stdio: 'inherit' });
