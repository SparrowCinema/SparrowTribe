// 生成分享默认图 brand/og-default.jpg（1200×630）。用法：CHROME=/usr/bin/google-chrome node tools/make-og-default.js
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const root = path.join(__dirname, '..'), b64 = f => 'data:image/png;base64,' + fs.readFileSync(path.join(root, f)).toString('base64');
const html = `<!doctype html><meta charset=utf8><style>*{margin:0;box-sizing:border-box}body{width:1200px;height:630px;background:#f8f2e6;font-family:"Noto Serif CJK SC","Noto Serif SC",serif;color:#2b2117;position:relative;overflow:hidden}
.bar{position:absolute;left:0;right:0;height:46px;background:#8e2a22;display:flex;gap:16px;align-items:center;padding:0 12px}.bar i{width:26px;height:20px;border-radius:5px;background:#f8f2e6;opacity:.9}.t{top:0}.b{bottom:0}
.c{position:absolute;left:90px;top:130px}h1{font-size:96px;font-weight:900;letter-spacing:.04em}.e{font:600 34px "DejaVu Sans Mono",monospace;letter-spacing:.12em;color:#8e2a22;margin-top:10px}
p{font:500 34px/1.5 "Noto Sans CJK SC",sans-serif;margin-top:34px;color:#5a4a3a}.lg{position:absolute;right:70px;top:300px;display:flex;gap:18px;align-items:center}.lg img{width:190px}</style>
<div class="bar t">${'<i></i>'.repeat(40)}</div><div class="bar b">${'<i></i>'.repeat(40)}</div>
<div class="c"><h1>麻雀观影护照</h1><div class="e">SPARROW FILM PASSPORT</div><p>影展 · 艺术影院 · 院线排片<br>个人观影日程与印章护照</p></div>
<div class="lg"><img src="${b64('brand/sparrow-movies-sq.png')}"><img src="${b64('brand/sparrow-tribe-sq.png')}"></div>`;
(async () => { const br = await chromium.launch({ executablePath: process.env.CHROME || undefined }); const pg = await br.newPage({ viewport: { width: 1200, height: 630 } }); await pg.setContent(html); await pg.waitForTimeout(400); await pg.screenshot({ path: path.join(root, 'brand/og-default.jpg'), type: 'jpeg', quality: 88 }); await br.close(); console.log('ok'); })();
