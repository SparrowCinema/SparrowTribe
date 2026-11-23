// 换域名搬家的真浏览器测试（需要 playwright + Chrome）：node tools/check-domain-move-browser.js
// 用请求拦截把两个真实的源接到本地文件：https://sparrowcinema.github.io（旧源：搬家页 move/ + 旧网站）和 https://sparrowcinema.org（新网站），
// 在旧源写入观影记录（含一张压不动的大照片，逼出分段），再打开新网址，检查记录、原路由和第二次打开不再跳转。
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };

(async () => {
  const browser = await chromium.launch({ executablePath: fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined });
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  let ready = false;
  const navs = [];
  await ctx.route('**/*', route => {
    const u = new URL(route.request().url());
    let file = null;
    if (u.origin === 'https://sparrowcinema.github.io') {
      if (u.pathname === '/move.html' || u.pathname === '/move-check.js') file = path.join(root, 'move', u.pathname);
      else if (u.pathname.startsWith('/SparrowTribe/')) file = path.join(root, decodeURIComponent(u.pathname.slice('/SparrowTribe/'.length)) || 'index.html');
    } else if (u.origin === 'https://sparrowcinema.org') {
      if (u.pathname === '/move-ready.json') return ready ? route.fulfill({ status: 200, contentType: 'application/json', body: '{}', headers: { 'access-control-allow-origin': '*' } }) : route.fulfill({ status: 404, body: '' });
      file = path.join(root, decodeURIComponent(u.pathname.slice(1)) || 'index.html');
    }
    if (file && fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!file || !fs.existsSync(file)) return u.origin.startsWith('https://sparrowcinema.') ? route.fulfill({ status: 404, body: 'not found' }) : route.abort();
    return route.fulfill({ status: 200, body: fs.readFileSync(file), headers: { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'access-control-allow-origin': '*' } });
  });
  const page = await ctx.newPage();
  page.on('framenavigated', f => { if (f === page.mainFrame()) navs.push(f.url()); });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));

  // 1. 旧源写入记录
  await page.goto('https://sparrowcinema.github.io/move-check.js');
  const photo = 'data:image/jpeg;base64,' + crypto.randomBytes(900000).toString('base64'); // 约 1.2MB，gzip 压不动 → 至少 2 段
  const seed = { 'sparrow-watched-v1': JSON.stringify({ 'no-mobile': { d: '2026-11-01', r: 8, t: 1700000000000 } }), 'sparrow-holder': '小麻雀', 'sparrow-holder-photo': photo, 'sk-theme': 'dark', 'style-kaleidoscope-plan-v1': JSON.stringify([]), 'mg-saved': 'michelin' };
  await page.evaluate(s => { for (const k in s) localStorage.setItem(k, s[k]); }, seed);

  // 2. 打开新网址（带一个路由），等搬家完成、应用启动
  navs.length = 0;
  await page.goto('https://sparrowcinema.org/#my');
  await page.waitForFunction(() => location.origin === 'https://sparrowcinema.org' && !location.hash.includes('spmig') && (typeof READY !== 'undefined' && READY === true), null, { timeout: 30000 }).catch(async e => { console.error('navs', navs.map(u => u.slice(0, 120))); throw e; });
  const got = await page.evaluate(() => ({ hash: location.hash, watched: localStorage.getItem('sparrow-watched-v1'), holder: localStorage.getItem('sparrow-holder'), photoLen: (localStorage.getItem('sparrow-holder-photo') || '').length, theme: localStorage.getItem('sk-theme'), mg: localStorage.getItem('mg-saved'), flag: localStorage.getItem('sparrow-moved-in-v1'), toast: (document.getElementById('toast') || {}).textContent || '' }));
  const bridgeHops = navs.filter(u => u.startsWith('https://sparrowcinema.github.io/move.html')).length;
  const check = (c, m) => { if (!c) { console.error('FAIL:', m, JSON.stringify({ ...got, photoLen: got.photoLen }), navs.map(u => u.slice(0, 100))); process.exit(1); } };
  check(bridgeHops >= 2, 'expected multi-part bridge hops, got ' + bridgeHops);
  check(got.hash === '#my', 'original route restored');
  check(got.holder === '小麻雀' && got.watched === seed['sparrow-watched-v1'] && got.theme === 'dark', 'records copied');
  check(got.photoLen === photo.length, 'large photo copied intact');
  check(got.mg === null, 'other apps on the old origin are not copied');
  check(got.flag && JSON.parse(got.flag).n >= 4, 'moved flag set');
  check(/搬到新网址|moved from the old address/.test(got.toast), 'toast shown');

  // 3. 再打开不再跳搬家页
  navs.length = 0;
  await page.goto('https://sparrowcinema.org/#films');
  await page.waitForFunction(() => (typeof READY !== 'undefined' && READY === true), null, { timeout: 20000 });
  check(!navs.some(u => u.includes('move.html')), 'no bounce on second visit');

  // 5. 旧网址的旧页面：新域名生效后自动转到新网址
  ready = true;
  navs.length = 0;
  await page.goto('https://sparrowcinema.github.io/SparrowTribe/#film-no-mobile');
  await page.waitForFunction(() => location.origin === 'https://sparrowcinema.org', null, { timeout: 20000 });
  check(page.url().endsWith('#film-no-mobile'), 'departure keeps the route: ' + page.url());

  const real = errors.filter(e => !/Failed to fetch|NetworkError|supabase|Load failed|reading 'update'/i.test(e) /* 测试里禁用了 service worker */);
  check(!real.length, 'page errors: ' + real.join(' | '));
  console.log('PASS: browser domain move — ' + bridgeHops + ' bridge hops, 1.2MB photo intact, route kept, no re-bounce, old page forwards once the new domain is live.');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
