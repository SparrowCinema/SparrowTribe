// 小程序影片长文按需加载（miniprogram/app.js 的 ensureDetail / loadDetail / mergeDetail，getData 的 {v:2, film:id}）：
// - 影片页打开时，这部片还没有简介等长文 → 单独请求一次，取到后合并并通知页面；重复打开不重复请求
// - 已有长文、本机数据（还没连上云端）、云函数旧版（返回不认识的结果）时不请求或不合并，失败后下次可以重试
// - 分段长文按 id 合并到「当前」影片对象：往期专题补齐换成新对象后仍能合并上；失败的分段重试一次
// 会设置全局 wx / App，单独进程运行，不影响 check-companion 里的其他检查
if (!process.env.MPDETAIL_CHILD) { const r = require('node:child_process').spawnSync(process.execPath, [__filename], { env: { ...process.env, MPDETAIL_CHILD: '1' }, stdio: 'inherit' }); if (r.status) { process.exitCode = r.status; throw new Error('check-mp-detail failed'); } return; }
const assert = require('assert');
const calls = [];
let respond = () => ({});
const store = {};
const noop = () => { };
global.wx = new Proxy({
  cloud: { init: noop, callFunction: o => { calls.push(o.data); return Promise.resolve().then(() => ({ result: respond(o.data) })); } },
  getStorageSync: k => store[k], setStorageSync: (k, v) => { store[k] = v; }, removeStorageSync: k => { delete store[k]; },
  getSystemInfoSync: () => ({ language: 'zh_CN', theme: 'light', windowWidth: 375, windowHeight: 700, pixelRatio: 2 }),
  getAppBaseInfo: () => ({ language: 'zh_CN', theme: 'light' }), getWindowInfo: () => ({ windowWidth: 375, windowHeight: 700 }),
  getFileSystemManager: () => ({ readFileSync() { throw Error('none'); }, writeFile: noop }),
  env: { USER_DATA_PATH: '/tmp' }, getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } })
}, { get: (t, k) => (k in t ? t[k] : noop) });
let cfg;
global.App = o => { cfg = o; };
global.getApp = () => cfg;
global.getCurrentPages = () => [];
global.Page = noop; global.Component = noop;
require('../miniprogram/app.js');
assert.ok(cfg && typeof cfg.ensureDetail === 'function' && typeof cfg.mergeDetail === 'function', 'app exposes ensureDetail / mergeDetail');
const LOCAL = require('../miniprogram/data/data.js');
const tick = () => new Promise(r => setTimeout(r, 0));

(async () => {
  const film = Object.assign({}, LOCAL.films[0]); delete film.syn; delete film.bio; delete film.st; delete film._full;
  const raw = Object.assign({}, LOCAL, { films: [film].concat(LOCAL.films.slice(1).map(f => Object.assign({}, f))) });
  const app = Object.assign(Object.create(cfg), { globalData: { raw, data: null, source: 'local' }, _waiters: [], _en: null });
  let notified = 0; app._waiters.push(() => { notified++; });

  // 本机数据阶段不请求
  assert.strictEqual(app.ensureDetail(film.id), null, 'no request before cloud data');
  assert.strictEqual(calls.length, 0);

  app.globalData.source = 'cloud';
  respond = d => (d.film ? { ok: true, film: d.film, d: { syn: '简介第一段\n\n第二段', bio: '导演介绍' }, e: null } : {});
  const p1 = app.ensureDetail(film.id), p2 = app.ensureDetail(film.id);
  assert.ok(p1 && p1 === p2, 'one request while pending');
  assert.deepStrictEqual(calls[0], { v: 2, film: film.id, lang: 'zh' });
  assert.strictEqual(await p1, true);
  assert.strictEqual(raw.films[0].syn, '简介第一段\n\n第二段'); assert.strictEqual(raw.films[0].bio, '导演介绍');
  assert.ok(notified >= 1, 'pages notified'); assert.ok(app.globalData.data, 'data rebuilt');
  assert.strictEqual(app.ensureDetail(film.id), null, 'no second request once loaded');
  assert.strictEqual(calls.length, 1);

  // 片子本来没有任何长文：取过一次（_full）就不再取
  const bare = raw.films[1]; delete bare.syn; delete bare.bio; delete bare.st; delete bare._full;
  respond = d => ({ ok: true, film: d.film, d: {}, e: null });
  await app.ensureDetail(bare.id);
  assert.strictEqual(app.ensureDetail(bare.id), null, 'films without long text are not refetched');

  // 旧版云函数（返回首屏格式）或请求失败：不合并，之后可以重试
  const f3 = raw.films[2]; delete f3.syn; delete f3.bio; delete f3.st; delete f3._full;
  respond = () => ({ v2: true, films: [] });
  assert.strictEqual(await app.ensureDetail(f3.id), false);
  assert.ok(!f3.syn);
  respond = () => { throw Error('network'); };
  assert.strictEqual(await app.ensureDetail(f3.id), false);
  respond = d => ({ ok: true, film: d.film, d: { syn: '后来取到' } });
  assert.strictEqual(await app.ensureDetail(f3.id), true, 'retry after failure');
  assert.strictEqual(f3.syn, '后来取到');

  // 分段：合并到当前影片对象（往期专题换成新对象后），失败的分段重试一次
  const f4 = raw.films[3]; delete f4.syn; delete f4._full;
  let fail = 1; calls.length = 0;
  respond = d => {
    if (d.part === 0 && fail) { fail = 0; throw Error('timeout'); }
    return { ok: true, part: d.part, d: d.part === 0 ? { [f4.id]: { syn: '分段简介' } } : {} };
  };
  app.loadDetail(2, null, 'zh');
  raw.films[3] = Object.assign({}, f4, { replaced: 1 }); // 模拟 loadPast 把影片换成新对象
  for (let i = 0; i < 10; i++) await tick();
  assert.strictEqual(raw.films[3].syn, '分段简介', 'part merged into the current film object');
  assert.strictEqual(calls.filter(c => c.part === 0).length, 2, 'failed part retried once');
  console.log('PASS: mini-program film details — on-demand single-film fetch, no duplicate requests, old cloud function / failures ignored and retried, parts merge into current objects with one retry.');
})().catch(e => { console.error(e); process.exit(1); });
