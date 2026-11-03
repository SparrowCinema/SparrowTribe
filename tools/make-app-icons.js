// 生成「添加到主屏幕」图标：icons/icon-512.png、icon-192.png、apple-touch-icon.png(180)、favicon-32.png、maskable-512.png
// 用法：node tools/make-app-icons.js（需要 playwright；字体用 Noto Serif CJK SC）
const { chromium } = require('playwright'); const path = require('path');
const root = path.join(__dirname, '..');
// scale：内容缩放（maskable 留出 80% 安全区）；frame：是否画外边框
const page = (scale, frame) => `<!doctype html><meta charset=utf8><style>*{margin:0;box-sizing:border-box}
body{width:1024px;height:1024px;overflow:hidden;position:relative;font-family:"Noto Serif CJK SC","Noto Serif SC",serif;
background:radial-gradient(120% 120% at 30% 18%,#b13a2f 0%,#8e2a22 46%,#5e1712 100%)}
.stripe{position:absolute;inset:0;background:repeating-linear-gradient(115deg,rgba(255,235,210,.05) 0 2px,transparent 2px 34px)}
.g{position:absolute;inset:0;transform:scale(${scale});transform-origin:50% 50%}
.frame{position:absolute;inset:54px;border-radius:84px;border:5px solid rgba(232,196,118,.85);display:${frame ? 'block' : 'none'}}
.frame:after{content:"";position:absolute;inset:14px;border-radius:70px;border:2px solid rgba(232,196,118,.45)}
.reel{position:absolute;left:50%;top:372px;width:640px;height:640px;margin-left:-320px;margin-top:-320px;border-radius:50%;border:6px solid rgba(232,196,118,.38)}
.reel i{position:absolute;width:92px;height:92px;border-radius:50%;background:rgba(232,196,118,.26);left:274px;top:274px}
.reel b{position:absolute;inset:150px;border-radius:50%;border:3px solid rgba(232,196,118,.3)}
.que{position:absolute;left:0;right:0;top:128px;text-align:center;font-size:520px;font-weight:900;line-height:1;color:#fbf3e2;text-shadow:0 10px 0 rgba(60,12,8,.35),0 0 60px rgba(255,214,140,.18)}
.sub{position:absolute;left:0;right:0;top:690px;text-align:center;font-size:104px;font-weight:700;letter-spacing:.28em;padding-left:.28em;color:#ecc979}
.en{position:absolute;left:0;right:0;top:830px;text-align:center;font:600 31px "DejaVu Sans Mono",monospace;letter-spacing:.42em;padding-left:.42em;color:rgba(251,243,226,.7)}
.perf{position:absolute;left:150px;right:150px;top:806px;height:3px;background:repeating-linear-gradient(90deg,rgba(232,196,118,.7) 0 16px,transparent 16px 30px)}
</style><div class="stripe"></div><div class="frame"></div>
<div class="g"><div class="reel"><b></b></div>
<div class="que">雀</div><div class="sub">观影护照</div><div class="en">FILM PASSPORT</div></div>`;
(async () => {
  const br = await chromium.launch({ executablePath: process.env.CHROME || undefined }); const pg = await br.newPage({ viewport: { width: 1024, height: 1024 } });
  const shot = async (scale, frame, out, size) => { await pg.setContent(page(scale, frame)); await pg.waitForTimeout(500); const buf = await pg.screenshot({ type: 'png' });
    const p2 = await br.newPage({ viewport: { width: size, height: size } }); await p2.setContent(`<body style="margin:0"><img src="data:image/png;base64,${buf.toString('base64')}" style="width:${size}px;height:${size}px;display:block">`); await p2.waitForTimeout(200);
    await p2.screenshot({ path: path.join(root, out), type: 'png' }); await p2.close(); };
  await shot(1, true, 'icons/icon-512.png', 512);
  await shot(1, true, 'icons/icon-192.png', 192);
  await shot(1, false, 'icons/apple-touch-icon.png', 180); // iOS 自己加圆角，不画外边框
  await shot(.8, false, 'icons/maskable-512.png', 512);    // Android 自适应图标：内容在 80% 安全区内
  await pg.setContent(`<style>*{margin:0}body{width:1024px;height:1024px;background:#8e2a22;display:flex;align-items:center;justify-content:center;font:900 760px "Noto Serif CJK SC",serif;color:#fbf3e2}</style>雀`); await pg.waitForTimeout(300);
  const b = await pg.screenshot({ type: 'png' }); const p3 = await br.newPage({ viewport: { width: 32, height: 32 } }); await p3.setContent(`<body style="margin:0"><img src="data:image/png;base64,${b.toString('base64')}" style="width:32px;height:32px;display:block">`); await p3.screenshot({ path: path.join(root, 'icons/favicon-32.png') });
  await br.close(); console.log('ok');
})();
