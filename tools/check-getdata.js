// 小程序数据接口检查（cloudfunctions/getData 的 v2 首屏）：
// 云函数单次返回上限约 1MB，超过后小程序拿不到最新排片。这里用当前网站数据模拟一次，提前拦住超限：
// - v2 首屏（中文 / 英文）、每个往期专题包、每段长文都必须小于 900KB（留 10% 余量）
// - v2 首屏不带长文；中文首屏不带英文层；首屏 + 全部往期专题 = 全部影片与场次
// 随 check-companion 运行。
const assert = require('assert'), Module = require('module'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const cat = read('data/catalog.json'), en = read('data/i18n/en.json');
const films = [], shows = [], seen = new Set();
cat.programmes.forEach(p => {
  if (!p.file) return;
  const pk = read(p.file);
  (pk.films || []).forEach(f => { if (!seen.has(f.id)) { seen.add(f.id); films.push(Object.assign({}, f, { prog: f.prog || p.id })); } });
  (pk.shows || []).forEach(r => { const [d, t, id, v = 'premiere', h = 'luxe'] = Array.isArray(r) ? r : [r.d, r.t, r.id, r.v, r.h]; shows.push({ d, t, id, v, h, p: p.id }); });
});
const LIMIT = 900 * 1024, HEAVY = ['syn', 'bio', 'st', 'honors', 'parts', 'contentNote', 'contentReview', 'editorial', 'highlights', 'links', 'warnings'];
const size = x => Buffer.byteLength(JSON.stringify(x));
let json;
const db = { collection: () => ({ doc: id => ({ get: async () => ({ data: id === 'site' ? { at: Date.now(), n: 1 } : { json } }) }) }) };
const orig = Module._load;
Module._load = function (r, ...a) { return r === 'wx-server-sdk' ? { DYNAMIC_CURRENT_ENV: 1, init() { }, database: () => db } : orig.call(this, r, ...a); };
const gd = require('../cloudfunctions/getData/index.js');
Module._load = orig;
const quiet = console.log;
// 两种情形：今天的专题状态；以及假设所有有结束日期的专题都已结束（往期包最多的情形）
const scenarios = [['today', p => p], ['all-ended', p => (p.end && !p.ongoing ? Object.assign({}, p, { end: '2000-01-01' }) : p)]];
(async () => {
  const report = [];
  for (const [name, tweak] of scenarios) {
    const programmes = cat.programmes.map(p => { const o = tweak(Object.assign({}, p)); delete o.file; return o; });
    json = JSON.stringify({ films, shows, venues: cat.venues, programmes, aliases: cat.aliases || {}, en, config: {} });
    console.log = () => { }; // getData 的读取日志
    const zh = await gd.main({ v: 2, lang: 'zh' }, {}), enr = await gd.main({ v: 2, lang: 'en' }, {});
    const packs = []; for (const id of zh.past) packs.push(await gd.main({ v: 2, prog: id, lang: 'en' }, {}));
    const parts = []; for (let i = 0; i < zh.detailParts; i++) parts.push(await gd.main({ v: 2, part: i, lang: 'en' }, {}));
    console.log = quiet;
    assert.ok(zh.v2 && zh.lean, name + ': v2 flag');
    assert.ok(!zh.en && zh.enOmitted, name + ': 中文首屏不应带英文层');
    assert.ok(enr.en && enr.en.ui, name + ': 英文首屏应带英文层');
    zh.films.concat(...packs.map(p => p.films)).forEach(f => HEAVY.forEach(k => assert.ok(f[k] === undefined, name + ': 首屏 / 往期包不应带长文 ' + k + ' (' + f.id + ')')));
    const ids = new Set(zh.films.map(f => f.id)); packs.forEach(p => p.films.forEach(f => ids.add(f.id)));
    assert.strictEqual(ids.size, films.length, name + ': 首屏 + 往期专题应覆盖全部影片');
    assert.strictEqual(zh.shows.length + packs.reduce((n, p) => n + p.shows.length, 0), shows.length, name + ': 场次应不重不漏');
    const big = [['首屏(中文)', zh], ['首屏(英文)', enr]].concat(packs.map(p => ['往期 ' + p.prog, p]), parts.map((p, i) => ['长文 ' + i, p]));
    big.forEach(([label, x]) => assert.ok(size(x) < LIMIT, `${name}: ${label} ${Math.round(size(x) / 1024)}KB 超过 900KB——云函数返回上限约 1MB，需要继续拆分`));
    report.push(`${name}: 首屏 中文 ${Math.round(size(zh) / 1024)}KB / 英文 ${Math.round(size(enr) / 1024)}KB，往期包最大 ${Math.round(Math.max(0, ...packs.map(size)) / 1024)}KB，长文段最大 ${Math.round(Math.max(...parts.map(size)) / 1024)}KB`);
  }
  console.log('check-getdata ok · ' + report.join(' · '));
})().catch(e => { console.error(e.message || e); process.exit(1); });
