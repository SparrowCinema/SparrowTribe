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

if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
  const { execFileSync } = require('node:child_process');
  const envDir = path.join(process.env.RUNNER_TEMP, 'hainan-poster-img');
  execFileSync('python3', ['-m', 'venv', envDir]);
  const python = path.join(envDir, 'bin', 'python');
  execFileSync(python, ['-m', 'pip', 'install', '--quiet', 'pillow'], {stdio:'inherit', timeout:60000});
  execFileSync(python, ['-c', "import base64\nimport concurrent.futures\nimport hashlib\nimport io\nimport json\nimport urllib.request\n\nfrom PIL import Image, ImageDraw, ImageOps\n\nassets = json.loads(\"{\\\"bleda\\\":[[\\\"festival\\\",\\\"https://mmbiz.qpic.cn/mmbiz_jpg/ibqRZicPcNqaq7pWIvGv4oBBNqDHurGBcBvllB6hEt8ZrSZiaSbYCqWcic6oicjRI8bhGCE1Wj7Ch8IRtEgWGKrCME1mdXsUYvzNwtR5pZHHkeoA/0\\\"],[\\\"still\\\",\\\"https://admin.fidmarseille.org/media/pages/festivals/festival-37/films/bleda-y-rosa-un-lloc-una-imatge/330fdc7eb6-1780335485/bleda-e-rosa-2560x-q85.jpg\\\"]],\\\"travel\\\":[[\\\"poster\\\",\\\"https://de.web.img3.acsta.net/img/71/c0/71c00186c07bce71be9c228cb6b06143.jpg\\\"]],\\\"otium\\\":[[\\\"poster\\\",\\\"https://image.tmdb.org/t/p/original/smqrwBu4A95p00UfPMntYITqQ4Z.jpg\\\"]],\\\"september\\\":[[\\\"poster\\\",\\\"https://slowreel.com/wp-content/uploads/2026/10/sepaft_poster_gelb.jpg\\\"]],\\\"birds\\\":[[\\\"festival\\\",\\\"https://mmbiz.qpic.cn/sz_mmbiz_jpg/ibqRZicPcNqapGnic7sdjWyJPzKkAAxa9mG5JJBPCAX4dnhMuEX9Lop7MTiaCBLBf9ltibNu38FfZyOBY8zuicgdl1EM4ZqNlribkJIFSG9riaQ6bAg/0\\\"],[\\\"still\\\",\\\"https://theseventhart.org/wp-content/uploads/2026/11/TheBirdsTellMeAllThereIsToKnow.jpg\\\"]],\\\"mirage\\\":[[\\\"poster\\\",\\\"https://thefilmstage.com/wp-content/uploads/2026/07/EL-ESPEJISMO-01-_PT-1.jpg\\\"]]}\")\n\ndef get(pair):\n    key, candidates = pair\n    for kind, url in candidates:\n        try:\n            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 Chrome/124.0', 'Accept': 'image/*'})\n            with urllib.request.urlopen(req, timeout=13) as response:\n                original = response.read(12 * 1024 * 1024 + 1)\n            if len(original) > 12 * 1024 * 1024:\n                raise ValueError('image exceeds 12 MB')\n            with Image.open(io.BytesIO(original)) as src:\n                frame = ImageOps.exif_transpose(src).convert('RGB')\n            w, h = frame.size\n            if max(w, h) < 1200 or (kind == 'festival' and w >= h):\n                raise ValueError(f'wrong image size or shape {w}x{h}')\n            frame.thumbnail((1600, 2000), Image.Resampling.LANCZOS)\n            stream = io.BytesIO()\n            frame.save(stream, 'JPEG', quality=87, optimize=True, progressive=True)\n            return key, kind, w, h, frame, stream.getvalue()\n        except Exception as exc:\n            print(f'HD_SOURCE_RETRY {key} {kind} {exc}')\n    raise RuntimeError('No matching asset for ' + key)\n\ndef output(key, data):\n    encoded = base64.b64encode(data).decode('ascii')\n    print(f'HD_ASSET {key} {len(data)} {hashlib.sha256(data).hexdigest()}')\n    for offset in range(0, len(encoded), 3072):\n        print(f'HD_DATA {key} {offset // 3072} {encoded[offset:offset+3072]}')\n\nwith concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:\n    rows = list(pool.map(get, assets.items()))\n\nsheet = Image.new('RGB', (660, 450), '#262626')\npen = ImageDraw.Draw(sheet)\nfor i, (key, kind, w, h, frame, data) in enumerate(rows):\n    print(f'HD_SIZE {key} {kind} {w}x{h} {frame.width}x{frame.height}')\n    thumb = frame.copy()\n    thumb.thumbnail((210, 195), Image.Resampling.LANCZOS)\n    x, y = (i % 3) * 220, (i // 3) * 225\n    sheet.paste(thumb, (x + (220 - thumb.width) // 2, y + (200 - thumb.height) // 2))\n    pen.text((x + 10, y + 200), f'{key} {kind} {w}x{h}', fill='#f4f4f4')\n\npreview = io.BytesIO()\nsheet.save(preview, 'JPEG', quality=84, optimize=True)\noutput('preview', preview.getvalue())\nfor key, kind, w, h, frame, data in rows:\n    output(key, data)\n"], {stdio:'inherit', timeout:55000});
}
