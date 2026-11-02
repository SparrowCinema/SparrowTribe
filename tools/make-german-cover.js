// 生成「2026德国电影展」专题头图（1860×660，中/英两版）。用法：CHROME=/usr/bin/google-chrome node tools/make-german-cover.js
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const b64 = id => 'data:image/jpeg;base64,' + fs.readFileSync(path.join(__dirname, '..', 'posters', id + '.jpg')).toString('base64');
const root = path.join(__dirname, '..');
const P = ['amrum', 'the-miserable-mother', 'karla', 'miroirs-no-3', 'oh-this-unspeakable-void'];
const rot = [-9, -4, 0, 4, 9], top = [96, 52, 30, 52, 96];
const page = lang => `<!doctype html><meta charset=utf8><style>
*{box-sizing:border-box;margin:0}body{width:1860px;height:660px;overflow:hidden;position:relative;font-family:"Noto Sans CJK SC","Noto Sans SC",sans-serif;
background:linear-gradient(180deg,#4f86b3 0%,#86b3d2 52%,#bcd6e4 63%,#e3cda5 63.2%,#d3b48a 100%)}
.sun{position:absolute;left:-200px;top:-260px;width:900px;height:900px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.35),transparent 65%)}
.txt{position:absolute;left:118px;top:76px;color:#fff}
.yr{font:700 58px/1 "DejaVu Sans Mono",monospace;letter-spacing:.16em;color:#ffe9b3;text-shadow:0 2px 10px #0003}
h1{font-family:"Noto Serif CJK SC","Noto Serif SC",serif;font-weight:900;font-size:${lang === 'zh' ? 150 : 88}px;line-height:1.06;margin-top:10px;text-shadow:0 4px 22px #12345a55;letter-spacing:${lang === 'zh' ? '.02em' : '0'}}
.bar{width:120px;height:7px;background:#ffe9b3;margin:16px 0 18px}
.en{font:600 31px/1.3 "DejaVu Sans Mono",monospace;letter-spacing:.06em;color:#ffe9b3}
.meta{margin-top:30px;font-weight:700;font-size:42px;line-height:1.35;text-shadow:0 2px 12px #12345a66}.meta small{display:block;font-size:30px;font-weight:600;opacity:.95}
.ps{position:absolute;left:960px;top:0;width:860px;height:100%}
.p{position:absolute;width:216px;height:306px;border-radius:6px;box-shadow:0 22px 40px rgba(20,40,70,.45);object-fit:cover;border:5px solid #fffdf6;background:#fff}
</style><div class="sun"></div>
<div class="txt"><div class="yr">2026</div><h1>${lang === 'zh' ? '德国电影展' : 'German Cinema'}</h1><div class="bar"></div>
<div class="en">${lang === 'zh' ? 'FESTIVAL OF GERMAN CINEMA IN CHINA' : 'FESTIVAL OF GERMAN CINEMA'}</div>
<div class="meta">${lang === 'zh' ? '杭州站 · 11.14 – 11.23' : 'Hangzhou · Nov 14 – 23'}<small>CINEMA CIRCLE ${lang === 'zh' ? '（杭州恒隆店）' : '(Hangzhou Heng Long)'}</small></div></div>
<div class="ps">${P.map((id, i) => `<img class="p" src="${b64(id)}" style="left:${i * 150}px;top:${top[i] + 120}px;transform:rotate(${rot[i]}deg);z-index:${i === 2 ? 5 : 3 - Math.abs(i - 2)}">`).join('')}</div>`;
(async () => {
  const br = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  for (const lang of ['zh', 'en']) {
    const pg = await br.newPage({ viewport: { width: 1860, height: 660 } });
    await pg.setContent(page(lang)); await pg.waitForTimeout(600);
    const out = path.join(root, 'programmes', `german-film-2026${lang === 'en' ? '-en' : ''}.jpg`);
    await pg.screenshot({ path: out, type: 'jpeg', quality: 88 }); console.log('wrote', out);
  }
  await br.close();
})();
