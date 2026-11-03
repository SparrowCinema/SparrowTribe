// 生成「2026金马影展」专题头图（1860×660，中/英两版）。用法：CHROME=/usr/bin/google-chrome node tools/make-golden-horse-cover.js
// 纯文字与几何图形（胶片孔、金色弧线），不使用官方标志。
const { chromium } = require('playwright');
const path = require('path');
const root = path.join(__dirname, '..');
const holes = n => Array.from({ length: n }, () => '<i></i>').join('');
const page = lang => `<!doctype html><meta charset=utf8><style>
*{box-sizing:border-box;margin:0}body{width:1860px;height:660px;overflow:hidden;position:relative;font-family:"Noto Sans CJK SC","Noto Sans SC",sans-serif;
background:radial-gradient(circle at 78% 42%,#3b2a12 0%,#1c1409 38%,#0e0b07 72%)}
.arc{position:absolute;border-radius:50%;border:2px solid rgba(214,168,82,.45)}
.a1{left:1040px;top:-120px;width:860px;height:860px}.a2{left:1110px;top:-50px;width:720px;height:720px;border-color:rgba(214,168,82,.3)}
.a3{left:1180px;top:20px;width:580px;height:580px;border-color:rgba(214,168,82,.7);border-width:3px}
.a4{left:1250px;top:90px;width:440px;height:440px;border-color:rgba(214,168,82,.22)}
.glow{position:absolute;left:1180px;top:20px;width:580px;height:580px;border-radius:50%;background:radial-gradient(circle,rgba(233,190,102,.22),transparent 68%)}
.strip{position:absolute;left:0;width:100%;height:46px;background:#17110a;display:flex;gap:30px;align-items:center;padding-left:14px;border-top:1px solid #4a3a1d;border-bottom:1px solid #4a3a1d}
.strip i{width:26px;height:18px;border-radius:4px;background:#0b0805;box-shadow:inset 0 0 0 1px #3a2d17;flex:none}
.s1{top:0}.s2{bottom:0}
.txt{position:absolute;left:118px;top:92px;color:#f6e7c2}
.yr{font:700 52px/1 "DejaVu Sans Mono",monospace;letter-spacing:.2em;color:#d6a852}
h1{font-family:"Noto Serif CJK SC","Noto Serif SC",serif;font-weight:900;font-size:${lang === 'zh' ? 158 : 92}px;line-height:1.05;margin-top:14px;letter-spacing:${lang === 'zh' ? '.04em' : '0'};color:#f9e9bf;text-shadow:0 4px 30px #0009}
.bar{width:132px;height:7px;background:#d6a852;margin:18px 0 20px}
.en{font:600 29px/1.35 "DejaVu Sans Mono",monospace;letter-spacing:.08em;color:#d6a852}
.meta{margin-top:30px;font-weight:700;font-size:40px;line-height:1.4;color:#f6e7c2}.meta small{display:block;font-size:28px;font-weight:600;color:#cdb68a}
.big{position:absolute;left:1236px;top:150px;width:460px;text-align:center;color:#e7c27a;font-family:"Noto Serif CJK SC",serif;font-weight:900}
.big b{display:block;font-size:${lang === 'zh' ? 190 : 150}px;line-height:1;letter-spacing:.02em}.big span{display:block;margin-top:16px;font:600 30px "DejaVu Sans Mono",monospace;letter-spacing:.3em;color:#b99552}
</style><div class="glow"></div><div class="arc a1"></div><div class="arc a2"></div><div class="arc a3"></div><div class="arc a4"></div>
<div class="strip s1">${holes(64)}</div><div class="strip s2">${holes(64)}</div>
<div class="txt"><div class="yr">2026</div><h1>${lang === 'zh' ? '金马影展' : 'Golden Horse'}</h1><div class="bar"></div>
<div class="en">${lang === 'zh' ? 'TAIPEI GOLDEN HORSE FILM FESTIVAL' : 'THE 63RD TAIPEI FILM FESTIVAL'}</div>
<div class="meta">${lang === 'zh' ? '台北 · 11.06 – 11.22' : 'Taipei · Nov 6 – 22'}<small>${lang === 'zh' ? '信义威秀 · MUVIE TITAN' : 'Vie Show Hsin Yi · MUVIE TITAN'}</small></div></div>
<div class="big"><b>${lang === 'zh' ? '第63届' : '63'}</b><span>${lang === 'zh' ? 'E-PROGRAMME' : 'E-PROGRAMME'}</span></div>`;
(async () => {
  const br = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  for (const lang of ['zh', 'en']) {
    const pg = await br.newPage({ viewport: { width: 1860, height: 660 } });
    await pg.setContent(page(lang)); await pg.waitForTimeout(600);
    const out = path.join(root, 'programmes', `golden-horse-2026${lang === 'en' ? '-en' : ''}.jpg`);
    await pg.screenshot({ path: out, type: 'jpeg', quality: 88 }); console.log('wrote', out);
  }
  await br.close();
})();
