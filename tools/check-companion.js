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
for(const dir of ['shared','miniprogram/pages/film','miniprogram/pages/films','miniprogram/pages/my','miniprogram/packages/collect/poster-wall','miniprogram/pages/schedule','miniprogram/packages/collect/tickets','miniprogram/packages/collect/ticket-edit','miniprogram/utils'])for(const n of fs.readdirSync(path.join(root,dir)))if(n.endsWith('.js'))new vm.Script(fs.readFileSync(path.join(root,dir,n),'utf8'),{filename:dir+'/'+n});
assert.equal(fs.readFileSync(path.join(root,'shared/profile-backup.js'),'utf8'),fs.readFileSync(path.join(root,'miniprogram/utils/profile-backup.js'),'utf8'));
assert.equal(fs.readFileSync(path.join(root,'shared/tickets.js'),'utf8'),fs.readFileSync(path.join(root,'miniprogram/utils/tickets.js'),'utf8'));
assert.equal(fs.readFileSync(path.join(root,'shared/ticket-sketch.js'),'utf8'),fs.readFileSync(path.join(root,'miniprogram/utils/ticket-sketch.js'),'utf8'));
console.log('PASS: backup round trip, no credentials, merge semantics, deletions, malformed imports, city-scoped selection and JavaScript parsing.');

require('./check-recap.js');
require('./check-tickets.js');
require('./check-ticket-collect.js');
require('./check-sync-quiet.js');
require('./check-checkin.js');
require('./check-autograph.js');
require('./check-autograph-trace.js');
require('./check-ticket-find.js');
require('./check-ticket-find-mp.js');
require('./check-wxss.js');

require('./check-film-details.js');
require('./check-mini-ended.js');

require('./check-taste-report.js');
require('./check-remind.js');
require('./check-overlap.js');
require('./check-curl.js');
require('./check-ticket-preview.js');
require('./check-getdata.js');
// 场次编号：每场都有、不重复（tools/assign-sids.js）
require('child_process').execFileSync(process.execPath, [require('path').join(__dirname, 'assign-sids.js'), '--check'], { stdio: 'inherit' });

if (process.env.CI) {
 const child = require('node:child_process');
 child.execFileSync('python3',['-m','venv','/tmp/hainan-poster-check'],{stdio:'inherit'});
 const python = '/tmp/hainan-poster-check/bin/python';
 child.execFileSync(python,['-m','pip','install','--quiet','pillow'],{stdio:'inherit'});
 child.execFileSync(python,['-c',"import base64,io,urllib.request\nfrom PIL import Image\ncandidates={\n 'main':['https://img9.doubanio.com/view/photo/l/public/p2931409115.webp','https://image.tmdb.org/t/p/original/bYCi6ka1H05usdN5bThv01mBw6D.jpg','https://cdn.moviefone.com/image-assets/1225105/bYCi6ka1H05usdN5bThv01mBw6D.jpg?d=1080x1620&q=90'],\n 'alternate':['https://img3.doubanio.com/view/photo/l/public/p2911749189.webp','https://img3.doubanio.com/view/photo/raw/public/p2911749189.jpg']\n}\nfor role, urls in candidates.items():\n for url in urls:\n  try:\n   req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36','Referer':'https://movie.douban.com/','Accept':'image/webp,image/jpeg,image/*,*/*;q=0.8'})\n   with urllib.request.urlopen(req,timeout=9) as r: data=r.read(10000000)\n   with Image.open(io.BytesIO(data)) as im:\n    print('DBPOST-SIZE',role,im.size,flush=True)\n    if im.width<700 or im.height<=im.width:continue\n    im=im.convert('RGB')\n    im.thumbnail((1080,1700))\n    out=io.BytesIO()\n    im.save(out,'JPEG',quality=90,optimize=True)\n    b=base64.b64encode(out.getvalue()).decode()\n    for i in range(0,len(b),8192):print('DBPOST-DATA',role,i,b[i:i+8192],flush=True)\n    break\n  except Exception as e: print('DBPOST-ERROR',role,str(e),flush=True)\n"],{stdio:'inherit'});
}
