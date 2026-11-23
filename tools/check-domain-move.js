// 换域名搬家（shared/domain-move.js）：模拟旧源 → 搬家页 → 新源的完整往返，包括分段、校验、白名单、目标源限制和各种失败情况。
const assert = require('assert'), fs = require('fs'), path = require('path');
const M = require('../shared/domain-move.js');
const root = path.resolve(__dirname, '..');

function store(init) {
  const m = new Map(Object.entries(init || {}));
  return {
    get length() { return m.size; }, key: i => [...m.keys()][i] ?? null,
    getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k),
    dump: () => Object.fromEntries(m)
  };
}
function loc(url, log) {
  const u = new URL(url);
  return { origin: u.origin, pathname: u.pathname, search: u.search, hash: u.hash, href: u.href, replace: to => log.push(to) };
}

(async () => {
  // 白名单
  assert(M.keep('sparrow-watched-v1') && M.keep('sk-theme') && M.keep('style-kaleidoscope-plan-v1'));
  assert(!M.keep('mg-saved') && !M.keep('sparrow-stat-vid') && !M.keep('sparrow-host-key') && !M.keep(M.MOVE.flag));
  // 只交给新网址
  assert(M.targetOK('https://sparrowcinema.org/') && M.targetOK('https://www.sparrowcinema.org/x?y=1'));
  assert(!M.targetOK('https://evil.example/') && !M.targetOK('https://sparrowcinema.org.evil.example/') && !M.targetOK('http://sparrowcinema.org/') && !M.targetOK('https://a:b@sparrowcinema.org/') && !M.targetOK('javascript:alert(1)'));
  // 编码往返（含中文、大字段）
  const big = 'data:image/jpeg;base64,' + require('crypto').randomBytes(120000).toString('base64'); // 照片压不动，逼出分段
  const oldData = {
    'sparrow-watched-v1': JSON.stringify({ f1: { d: '2026-11-01', r: 8, t: 1 } }), 'style-kaleidoscope-plan-v1': JSON.stringify(['2026-11-20-19:30-v1-h1']),
    'sparrow-holder': '小麻雀', 'sparrow-holder-photo': big, 'sk-theme': 'dark', 'sparrow-tickets-v2': JSON.stringify({ 'f1|2026-11-01': { t: 5, st: '5排8座' } }),
    'mg-saved': 'michelin data must stay', 'sparrow-stat-vid': 'daily-random'
  };
  const enc = await M.encode(M.collect(store(oldData)));
  assert.equal(enc[0], 'g'); assert((await M.encode({ 'sparrow-x': 'A'.repeat(100000) })).length < 2000, 'gzip shrinks text');
  const back = await M.decode(enc);
  assert.equal(back['sparrow-holder'], '小麻雀'); assert.equal(back['sparrow-holder-photo'], big);
  assert(!('mg-saved' in back) && !('sparrow-stat-vid' in back));
  await assert.rejects(M.decode('x' + enc.slice(1))); await assert.rejects(M.decode('gAAAA'));
  // 片段解析与拼接校验
  const ps = M.pieces('abcdefghij', 4); assert.equal(ps.length, 3);
  const parsed = ps.map(p => M.parse('#spmig=' + p)); assert.equal(M.assemble(parsed), 'abcdefghij');
  assert.equal(M.assemble([parsed[0], parsed[2], parsed[1]]), null); assert.equal(M.assemble([parsed[0], parsed[1]]), null);
  const forged = { ...parsed[1], data: 'XXXX' }; assert.equal(M.assemble([parsed[0], forged, parsed[2]]), null);
  assert.deepStrictEqual(M.parse('#spmig=1.0.0.0.'), { empty: true }); assert.equal(M.parse('#spmig=1.zz.5.2.a'), null); assert.equal(M.parse('#plan'), null);

  // —— 完整往返：旧源有数据，新源第一次打开（数据较大，分 3 段）——
  async function roundTrip(oldLS, newLS, startURL, chunk) {
    const ss = store(), log = [], hist = [];
    M.MOVE.chunk = chunk || 900000;
    const env = u => ({ ls: newLS, ss, location: loc(u, log), history: { replaceState: (a, b, url) => hist.push(url) }, probe: () => Promise.resolve(true) });
    let r = await M.runArrive(env(startURL)), hops = 0;
    while (r === 'leave' && hops++ < 20) {
      const to = log[log.length - 1];
      if (to.startsWith(M.MOVE.bridge)) { await M.runBridge({ ls: oldLS, location: loc(to, log) }); r = await M.runArrive(env(log[log.length - 1])); }
      else { r = await M.runArrive(env(to)); break; } // 写入后重新载入的那一次
    }
    M.MOVE.chunk = 900000;
    return { r, log, hist, ss };
  }
  const oldLS = store(oldData), newLS = store({ 'sparrow-lang': 'zh' });
  const t1 = await roundTrip(oldLS, newLS, 'https://sparrowcinema.org/?x=1#verify=SP26-ABC', 20000);
  const bridgeHops = t1.log.filter(u => u.startsWith(M.MOVE.bridge));
  assert(bridgeHops.length >= 2, 'large payload should take several bridge hops');
  assert(bridgeHops.every(u => u.includes('to=' + encodeURIComponent('https://sparrowcinema.org/?x=1'))), 'bridge gets the page without the old hash');
  assert.equal(t1.log[t1.log.length - 1], 'https://sparrowcinema.org/?x=1#verify=SP26-ABC', 'reloads the original route after writing');
  assert.equal(t1.r, null, 'after reload the app boots normally');
  const got = newLS.dump();
  assert.equal(got['sparrow-holder'], '小麻雀'); assert.equal(got['sparrow-holder-photo'], big); assert.equal(got['sk-theme'], 'dark');
  assert.equal(got['style-kaleidoscope-plan-v1'], oldData['style-kaleidoscope-plan-v1']); assert(!('mg-saved' in got) && !('sparrow-stat-vid' in got));
  assert(JSON.parse(got[M.MOVE.flag]).n >= 6); assert(oldLS.getItem(M.MOVE.outFlag), 'old origin records that data was read');
  assert.equal(oldLS.getItem('sparrow-holder'), '小麻雀', 'old data is kept as a backup');
  assert.equal(t1.ss.getItem('sp-mig-done') > 0, true);
  // 再打开不再跳
  const again = await roundTrip(oldLS, newLS, 'https://sparrowcinema.org/');
  assert.equal(again.r, null); assert.equal(again.log.length, 0);

  // 旧源没有数据：去一趟搬家页，空回来，设标记，保留原路由，不重载
  const n2 = store(), t2 = await roundTrip(store({ 'mg-saved': '1' }), n2, 'https://sparrowcinema.org/#plan');
  assert.equal(t2.r, null); assert.equal(t2.hist[t2.hist.length - 1], 'https://sparrowcinema.org/#plan'); assert(n2.getItem(M.MOVE.flag));
  assert.equal(n2.getItem('mg-saved'), null);

  // 新源已经有用户数据：不跳、不覆盖
  const n3 = store({ 'sparrow-watched-v1': '{"x":{"d":"2026-11-23","t":9}}' }), t3 = await roundTrip(oldLS, n3, 'https://sparrowcinema.org/');
  assert.equal(t3.log.length, 0); assert.equal(n3.getItem('sparrow-watched-v1'), '{"x":{"d":"2026-11-23","t":9}}'); assert.equal(JSON.parse(n3.getItem(M.MOVE.flag)).skip, 'has-data');

  // 搬家页打不开：照常启动，不设标记（下次会话再试），本次会话不再尝试
  { const ls = store(), ss = store(), log = [];
    const env = { ls, ss, location: loc('https://sparrowcinema.org/', log), history: { replaceState() {} }, probe: () => Promise.resolve(false) };
    assert.equal(await M.runArrive(env), null); assert.equal(log.length, 0); assert.equal(ls.getItem(M.MOVE.flag), null);
    env.probe = () => Promise.resolve(true); assert.equal(await M.runArrive(env), null, 'tried once this session'); }

  // 不是新网址（本地预览、旧网址）：不做搬家
  { const log = []; assert.equal(await M.runArrive({ ls: store(), ss: store(), location: loc('http://localhost:8123/', log), history: {} }), null); assert.equal(log.length, 0); }

  // 存储不可用（无痕模式）：不搬
  { const bad = { getItem() { throw new Error('denied'); } }; assert.equal(await M.runArrive({ ls: bad, ss: bad, location: loc('https://sparrowcinema.org/', []), history: {} }), null); }

  // 搬家页收到别的目标：只回新网址
  { const log = []; await M.runBridge({ ls: store(oldData), location: loc(M.MOVE.bridge + '?to=' + encodeURIComponent('https://evil.example/steal') + '&part=0', log) });
    assert(log[0].startsWith('https://sparrowcinema.org/#spmig=1.'), log[0].slice(0, 60)); }

  // ?move=again 可以手动重搬
  { const ls = store({ [M.MOVE.flag]: '{"t":1,"n":0}' }), log = [], ss = store();
    const r = await M.runArrive({ ls, ss, location: loc('https://sparrowcinema.org/?move=again#my', log), history: {}, probe: () => Promise.resolve(true) });
    assert.equal(r, 'leave'); assert(log[0].includes('to=' + encodeURIComponent('https://sparrowcinema.org/')), log[0]); assert.equal(ss.getItem('sp-mig-ret'), '#my'); }

  // 旧网址：新域名生效后转过去；主屏幕 App 只提示；没生效时不动
  { const mk = (ok, standalone) => { const log = []; return { log, env: { ss: store(), location: loc('https://sparrowcinema.github.io/SparrowTribe/?a=1#film-x', log), standalone, fetch: url => { assert(url.startsWith('https://sparrowcinema.org/move-ready.json')); return ok ? Promise.resolve({ ok: true }) : Promise.reject(new Error('dns')); } } }; };
    let x = mk(true, false); assert.equal(await M.runDepart(x.env), 'leave'); assert.equal(x.log[0], 'https://sparrowcinema.org/?a=1#film-x');
    assert.equal(await M.runDepart(x.env), null, 'only checks once per session');
    x = mk(true, true); assert.equal(await M.runDepart(x.env), 'banner'); assert.equal(x.log.length, 0);
    x = mk(false, false); assert.equal(await M.runDepart(x.env), null); assert.equal(x.log.length, 0); }

  // 网页接入：加载器在其他脚本之前，启动先等搬家；service worker 把 301 交给浏览器；搬家页产物最新；getData 跟随跳转
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const iMove = html.indexOf('shared/domain-move.js'), iFirst = html.indexOf('<script src="vendor/qrcode.js"');
  assert(iMove > 0 && iMove < iFirst, 'domain-move loader must run before app scripts');
  assert(/window\.SP_MOVE=/.test(html));
  const router = fs.readFileSync(path.join(root, 'js/router.js'), 'utf8');
  assert(/async function boot\(\)\{\s*let mv=null; try\{ mv=await \(window\.SP_MOVE\|\|null\); \}catch\(e\)\{\}\s*if\(mv==='leave'\) return;/.test(router));
  assert(fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes('res.type === "opaqueredirect") return res;'));
  assert(/301, 302, 307, 308/.test(fs.readFileSync(path.join(root, 'cloudfunctions/getData/index.js'), 'utf8')));
  require('child_process').execFileSync(process.execPath, [path.join(__dirname, 'build-bridge.js'), '--check'], { stdio: 'inherit' });
  const en = JSON.parse(fs.readFileSync(path.join(root, 'data/i18n/en.json'), 'utf8')).ui;
  for (const k of ['已把旧网址上的本机记录搬到新网址', '观影护照已搬到新网址']) assert(en[k], 'missing English: ' + k);
  console.log('PASS: domain move — whitelist, gzip round trip, multi-part bridge hops, integrity check, target lock, no-overwrite, probe failure, departure banner, SW redirect, getData redirects.');
})().catch(e => { console.error(e); process.exit(1); });
