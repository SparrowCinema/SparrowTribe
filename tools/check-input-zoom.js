// 回归检查：手机视口下所有可见输入控件字号必须 ≥16px（否则 iOS 聚焦会放大页面）。
// 用法：python3 -m http.server 8123 &  然后 node tools/check-input-zoom.js
const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const pg = await br.newPage({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
  let bad = 0;
  for (const h of ['#films', '#schedule', '#my']) {
    await pg.goto('http://localhost:8123/' + h); await pg.waitForTimeout(800);
    const r = await pg.evaluate(() => [...document.querySelectorAll('input,select,textarea')].filter(e => !/checkbox|radio|hidden|range/.test(e.type) && parseFloat(getComputedStyle(e).fontSize) < 16).map(e => e.id || e.outerHTML.slice(0, 60)));
    if (r.length) { bad += r.length; console.log(h, 'FAIL', r); }
  }
  await br.close(); console.log(bad ? 'FAILED' : 'OK'); process.exit(bad ? 1 : 0);
})();
