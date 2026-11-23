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
  const {spawnSync}=require('node:child_process');
  const setup=spawnSync('python3',['-m','venv','/tmp/asian-horizon-image-qa'],{stdio:'inherit'});
  if(setup.status===0){
    const python='/tmp/asian-horizon-image-qa/bin/python';
    spawnSync(python,['-m','pip','install','--quiet','pillow'],{stdio:'inherit'});
    spawnSync(python,['-c',"import base64, io, json, sys, urllib.request\nfrom concurrent.futures import ThreadPoolExecutor\nfrom PIL import Image, ImageOps\ndef check(item):\n    key, sources = item\n    for url in sources:\n        try:\n            request=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0','Referer':url.split('/')[0]+'//'+url.split('/')[2]+'/'})\n            with urllib.request.urlopen(request,timeout=12) as remote:\n                payload=remote.read(16000000)\n            with Image.open(io.BytesIO(payload)) as raw:\n                image=ImageOps.exif_transpose(raw).convert('RGB')\n                original=image.size\n                if image.width<500 or image.height<=image.width: continue\n                image.thumbnail((1024,1600),Image.Resampling.LANCZOS)\n                full=io.BytesIO()\n                image.save(full,'JPEG',quality=89,optimize=True)\n                preview=io.BytesIO()\n                image.thumbnail((180,250),Image.Resampling.LANCZOS)\n                image.save(preview,'JPEG',quality=68)\n                return key,original,base64.b64encode(full.getvalue()).decode(),base64.b64encode(preview.getvalue()).decode()\n        except Exception as problem:\n            print(f'ASIAN-ART-TRY {key} {problem}',file=sys.stderr,flush=True)\n    return key,None,'',''\nwith ThreadPoolExecutor(max_workers=8) as pool:\n    for key,original,full,preview in pool.map(check,json.loads(sys.argv[1])):\n        print(f'ASIAN-ART-SIZE {key} {original}',flush=True)\n        if not full: continue\n        print('ASIAN-ART-THUMB '+key+' '+preview,flush=True)\n        for part,i in enumerate(range(0,len(full),8192)):\n            print(f'ASIAN-ART-DATA {key} {part} '+full[i:i+8192],flush=True)\n","[[\"four-seasons-in-java-2026\",[\"https://eventguide.id/wp-content/uploads/2025/12/SnapInsta-Ai_3759785200181125944-822x1024.jpg\"]],[\"head-to-head-2026\",[\"https://www.ioncinema.com/wp-content/uploads/2026/09/ghasideh-golmakani-head-to-head-2026.jpg\"]],[\"master-rezwan-shahriar-sumit-2026\",[\"https://m.media-amazon.com/images/M/MV5BYzdhNGZhODYtOGRiZi00YjJlLWJhZmUtYjMyZDFlZTU2OTNlXkEyXkFqcGc%40._V1_.jpg\"]],[\"the-remotes-2026\",[\"https://media2.firstshowing.net/firstshowing/img18/theremotespostermaincolorbig59.jpg\"]],[\"whispers-in-may-2026\",[\"https://images.squarespace-cdn.com/content/v1/66e5fab3453eec06433b58da/1742480454830-ZIAAJ6NR0TL6VC66MBAQ/2500%2B%285%29.jpeg\"]],[\"9-temples-to-heaven-2026\",[\"https://www.impawards.com/intl/thailand/2026/posters/nine_temples_to_heaven.jpg\"]],[\"gr26-011\",[\"https://m.media-amazon.com/images/M/MV5BZTFjNzA1NjQtMTJkNy00MGM1LTlhMTAtMDc5ZTM1NTcwYjZiXkEyXkFqcGc%40._V1_.jpg\"]],[\"9-temples-alt\",[\"https://www.impawards.com/intl/thailand/2026/posters/nine_temples_to_heaven_ver2_xxlg.jpg\",\"https://www.impawards.com/intl/thailand/2026/posters/nine_temples_to_heaven_ver2_xlg.jpg\",\"https://www.impawards.com/intl/thailand/2026/posters/nine_temples_to_heaven_ver2.jpg\"]],[\"ah-hiiff-candidate\",[\"https://mmbiz.qpic.cn/mmbiz_png/ibqRZicPcNqar1xhbYjOhOAvQf79Z8oE3nujBlft9BYia8N4GncHnNVgIXY6wYDF1iaSjLOMUOrfhqEF2d0JHicYQvUSNKAHVhSjSunEXvG6bIxg/0\"]]]"],{stdio:'inherit'});
  }
}
