// 生成「2026海南岛国际电影节」专题头图（1860×660，中/英两版）。用法：CHROME=/usr/bin/google-chrome node tools/make-hainan-cover.js
// 画面参考官方主视觉描述：渐变蓝海面、海岛剪影与圆形光晕（数字 8），为自绘原创图形，不使用官方海报。
const { chromium } = require('playwright');
const path = require('path');
const root = path.join(__dirname, '..');
const page = lang => `<!doctype html><meta charset=utf8><style>
*{box-sizing:border-box;margin:0}body{width:1860px;height:660px;overflow:hidden;position:relative;font-family:"Noto Sans CJK SC","Noto Sans SC",sans-serif;
background:linear-gradient(180deg,#1f5f9a 0%,#4b9ccf 46%,#a9dcec 62%,#2f86b5 62.2%,#1b5f8c 100%)}
.halo{position:absolute;left:1180px;top:60px;width:500px;height:500px;border-radius:50%;border:16px solid rgba(255,255,255,.55);box-shadow:0 0 80px rgba(255,255,255,.45),inset 0 0 60px rgba(255,255,255,.3)}
.eight{position:absolute;left:1180px;top:60px;width:500px;height:500px;display:grid;place-items:center;color:#fff;font:900 330px/1 "Noto Serif CJK SC",serif;opacity:.92;text-shadow:0 6px 30px #0a3a6a66}
.isle{position:absolute;left:1010px;top:352px;width:860px;height:120px;background:#0f4468;clip-path:polygon(0 100%,8% 62%,18% 74%,32% 28%,44% 66%,55% 44%,70% 78%,84% 52%,100% 100%)}
.txt{position:absolute;left:118px;top:82px;color:#fff}
.yr{font:700 58px/1 "DejaVu Sans Mono",monospace;letter-spacing:.16em;color:#ffe9b3;text-shadow:0 2px 10px #0003}
h1{font-family:"Noto Serif CJK SC","Noto Serif SC",serif;font-weight:900;font-size:${lang === 'zh' ? 118 : 70}px;line-height:1.08;margin-top:12px;text-shadow:0 4px 22px #0a3a6a77;letter-spacing:${lang === 'zh' ? '.02em' : '0'}}
.bar{width:120px;height:7px;background:#ffe9b3;margin:18px 0 18px}
.en{font:600 30px/1.3 "DejaVu Sans Mono",monospace;letter-spacing:.06em;color:#ffe9b3}
.meta{margin-top:30px;font-weight:700;font-size:42px;line-height:1.35;text-shadow:0 2px 12px #0a3a6a77}.meta small{display:block;font-size:30px;font-weight:600;opacity:.95}
</style><div class="halo"></div><div class="eight">8</div><div class="isle"></div>
<div class="txt"><div class="yr">2026</div><h1>${lang === 'zh' ? '海南岛国际电影节' : 'Hainan Island<br>International Film Festival'}</h1><div class="bar"></div>
<div class="en">${lang === 'zh' ? 'HAINAN ISLAND INTERNATIONAL FILM FESTIVAL' : 'THE 8TH EDITION · SANYA'}</div>
<div class="meta">${lang === 'zh' ? '第八届 · 三亚 · 12.06 – 12.12' : 'Sanya · Dec 6 – 12'}<small>${lang === 'zh' ? '海生万象 · 影领未来' : 'Many Wonders of the Sea, Cinema Leading the Future'}</small></div></div>`;
(async () => {
  const br = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  for (const lang of ['zh', 'en']) {
    const pg = await br.newPage({ viewport: { width: 1860, height: 660 } });
    await pg.setContent(page(lang)); await pg.waitForTimeout(600);
    const out = path.join(root, 'programmes', `hainan-2026${lang === 'en' ? '-en' : ''}.jpg`);
    await pg.screenshot({ path: out, type: 'jpeg', quality: 88 }); console.log('wrote', out);
  }
  await br.close();
})();
