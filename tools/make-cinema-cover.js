// 生成「YYYY 院线新片」专题头图（1860×660，中/英两版 + 小程序 930×330）。
// 用法：node tools/make-cinema-cover.js 2027   （需要 playwright 与系统中文字体）
// 每年新建一个 cinema-YYYY 专题时，用它出图，再把 data/catalog.json 的 cover 指到 programmes/cinema-YYYY.jpg。
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const Y = process.argv[2] || '2026';
const root = path.join(__dirname, '..');
const holes = n => Array.from({ length: n }, () => '<i></i>').join('');
const page = (lang) => `<!doctype html><meta charset=utf8><style>
*{box-sizing:border-box;margin:0}body{width:1860px;height:660px;overflow:hidden;background:#12090a;font-family:"Noto Serif CJK SC","Noto Serif SC","Source Han Serif SC","Songti SC",serif;position:relative}
.strip{position:absolute;left:0;right:0;height:64px;background:#12090a;display:flex;gap:18px;align-items:center;padding:0 14px}.strip i{flex:none;width:38px;height:30px;border-radius:7px;background:#3a1f1d}.top{top:0}.bot{bottom:0}
.bg{position:absolute;left:0;right:0;top:64px;bottom:64px;background:linear-gradient(115deg,#8a2a22 0%,#5a1a17 55%,#2b1012 100%);overflow:hidden}
.bg:before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(115deg,rgba(255,255,255,.045) 0 1px,transparent 1px 34px)}
.glow{position:absolute;right:-120px;top:-160px;width:900px;height:900px;border-radius:50%;background:radial-gradient(circle,rgba(230,140,70,.55),transparent 62%)}
.txt{position:absolute;left:126px;top:92px;color:#fff8ec}
.yr{font:700 66px/1 "DejaVu Sans Mono","IBM Plex Mono",monospace;letter-spacing:.14em;color:#e9b96a;margin-bottom:6px}
h1{font-weight:900;font-size:${lang==='zh'?190:118}px;line-height:1.02;letter-spacing:${lang==='zh'?'.01em':'0'}}
.bar{width:120px;height:7px;background:#e9b96a;margin:14px 0 18px}
.en{font:600 44px/1.2 "DejaVu Sans Mono",monospace;letter-spacing:.06em;color:#e9b96a}
.sub{margin-top:26px;font:700 38px/1.3 "Noto Sans CJK SC","Noto Sans SC",sans-serif;color:#fff8ec}.per{font:600 38px "DejaVu Serif",serif;color:#e9b96a;margin-top:6px}
.tk{position:absolute;right:170px;top:128px;width:500px;height:300px;transform:rotate(5deg);background:#f4ecd9;border-radius:22px;box-shadow:0 24px 50px rgba(0,0,0,.45);padding:34px 40px;color:#8a1f1a}
.tk:before{content:"";position:absolute;left:-26px;top:100px;width:52px;height:52px;border-radius:50%;background:#7a231d}
.tk .a{font:700 34px "DejaVu Sans Mono",monospace;letter-spacing:.04em}.tk .m{font-weight:900;font-size:${lang==='zh'?104:70}px;color:#1d1710;margin-top:6px;line-height:1.1}
.tk .f{font:600 28px "DejaVu Sans Mono",monospace;color:#6b5d4a;margin-top:12px}.tk .d{position:absolute;right:110px;top:34px;bottom:34px;border-left:4px dashed #a02820}
</style>
<div class="strip top">${holes(48)}</div><div class="strip bot">${holes(48)}</div>
<div class="bg"><div class="glow"></div></div>
<div class="txt"><div class="yr">${Y}</div><h1>${lang==='zh'?'院线新片':'Now Showing'}</h1><div class="bar"></div>
<div class="en">${lang==='zh'?'NOW SHOWING &amp; COMING SOON':'NEW RELEASES &amp; RE-RELEASES'}</div>
<div class="sub">${lang==='zh'?Y+' 年度院线上映与重映':'Cinema releases &amp; re-releases · '+Y}</div></div>
<div class="tk"><div class="a">ADMIT ONE</div><div class="m">${lang==='zh'?'院线':'Cinema'}</div><div class="f">${Y} · ${lang==='zh'?'NOW SHOWING':'NOW SHOWING'}</div><div class="d"></div></div>`;
(async () => {
  const br = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  for (const lang of ['zh', 'en']) {
    const pg = await br.newPage({ viewport: { width: 1860, height: 660 } });
    await pg.setContent(page(lang)); await pg.waitForTimeout(400);
    const out = path.join(root, 'programmes', `cinema-${Y}${lang === 'en' ? '-en' : ''}.jpg`);
    await pg.screenshot({ path: out, type: 'jpeg', quality: 88 }); console.log('wrote', out);
  }
  await br.close();
})();
