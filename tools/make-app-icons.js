// 生成「添加到主屏幕」图标：icons/icon-512.png、icon-192.png、apple-touch-icon.png(180)、favicon-32.png、maskable-512.png
// 用法：node tools/make-app-icons.js（需要 playwright；字体用 Noto Serif CJK SC）
const { chromium } = require('playwright'); const path = require('path');
const root = path.join(__dirname, '..');
// scale：内容缩放（maskable 留出 80% 安全区）；frame：是否画外边框
const fs = require('fs');
const AP = fs.readFileSync(path.join(root, 'brand/passport-aperture.svg'), 'utf8').replace(/<svg[^>]*>|<\/svg>/g, '')
  .replace(/<polyline points="\d+,222[^>]*\/>\n?/g, '')
  .replace(/<polyline points="160,237[^>]*\/>\n?/g, '').replace(/<polyline points="160,11[^>]*\/>\n?/g, '')                       // 去掉底部细刻度，小尺寸看不清
  .replace(/stroke="#6f795e"/g, 'stroke="#8f9a77"')
  .replace(/stroke-width="([0-9.]+)"/g, (m, w) => 'stroke-width="' + ({ 0.8: 2.2, 0.7: 2.2, 1: 2.6, 1.2: 3.2, 1.4: 4.4 }[+w] || w * 2.5) + '"'); // 线条加粗
// 图标用观影护照封面上的光圈胶片 logo 放大；scale：内容缩放（maskable 留 80% 安全区）；frame：是否画金色外框
const page = (scale, frame) => `<!doctype html><meta charset=utf8><style>*{margin:0;box-sizing:border-box}
body{width:1024px;height:1024px;overflow:hidden;position:relative;font-family:"Noto Serif CJK SC","Noto Serif SC",serif;
background:radial-gradient(120% 120% at 30% 14%,#24574b 0%,#173d34 48%,#0d241f 100%)}
.grid{position:absolute;inset:0;background:linear-gradient(rgba(217,195,143,.05) 1px,transparent 1px) 0 0/32px 32px,linear-gradient(90deg,rgba(217,195,143,.05) 1px,transparent 1px) 0 0/32px 32px}
.g{position:absolute;inset:0;transform:scale(${scale});transform-origin:50% 50%}
.frame{position:absolute;inset:54px;border-radius:84px;border:5px solid rgba(217,195,143,.8);display:${frame ? 'block' : 'none'}}
.frame:after{content:"";position:absolute;inset:14px;border-radius:70px;border:2px solid rgba(217,195,143,.4)}
svg{position:absolute;left:62px;top:120px;width:900px;height:731px}
.sub{position:absolute;left:0;right:0;top:760px;text-align:center;font-size:150px;font-weight:900;letter-spacing:.14em;padding-left:.14em;line-height:1;color:#e6cf97;text-shadow:0 6px 0 rgba(0,0,0,.25)}
</style><div class="grid"></div><div class="frame"></div>
<div class="g"><svg viewBox="0 0 320 260" fill="none">${AP}</svg><div class="sub">观影护照</div></div>`;
(async () => {
  const br = await chromium.launch({ executablePath: process.env.CHROME || undefined }); const pg = await br.newPage({ viewport: { width: 1024, height: 1024 } });
  const shot = async (scale, frame, out, size) => { await pg.setContent(page(scale, frame)); await pg.waitForTimeout(500); const buf = await pg.screenshot({ type: 'png' });
    const p2 = await br.newPage({ viewport: { width: size, height: size } }); await p2.setContent(`<body style="margin:0"><img src="data:image/png;base64,${buf.toString('base64')}" style="width:${size}px;height:${size}px;display:block">`); await p2.waitForTimeout(200);
    await p2.screenshot({ path: path.join(root, out), type: 'png' }); await p2.close(); };
  await shot(1, true, 'icons/icon-512.png', 512);
  await shot(1, true, 'icons/icon-192.png', 192);
  await shot(1, false, 'icons/apple-touch-icon.png', 180); // iOS 自己加圆角，不画外边框
  await shot(.8, false, 'icons/maskable-512.png', 512);    // Android 自适应图标：内容在 80% 安全区内
  await pg.setContent(`<style>*{margin:0}body{width:1024px;height:1024px;background:#173d34;display:flex;align-items:center;justify-content:center}svg{width:900px;height:731px}</style><svg viewBox="59 29 202 202" fill="none" style="width:860px;height:860px">${AP}</svg>`); await pg.waitForTimeout(300);
  const b = await pg.screenshot({ type: 'png' }); const p3 = await br.newPage({ viewport: { width: 32, height: 32 } }); await p3.setContent(`<body style="margin:0"><img src="data:image/png;base64,${b.toString('base64')}" style="width:32px;height:32px;display:block">`); await p3.screenshot({ path: path.join(root, 'icons/favicon-32.png') });
  await br.close(); console.log('ok');
})();
