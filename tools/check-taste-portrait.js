// 个人观影画像 / AI 评语单测（shared/taste-portrait.js）
const assert = require('assert');
const TP = require('../shared/taste-portrait.js');
const TR = require('../shared/taste-report.js');

const entries = [
  { id: 'f1', f: { id: 'f1', cn: '花样年华', en: 'In the Mood for Love', y: 2000, c: '中国香港', dir: '王家卫', genre: ['剧情', '爱情'] }, rec: { d: '2026-11-10', r: 10, fun: 4.5, bore: 1, v: [{ d: '2026-11-10' }, { d: '2026-11-20' }] } },
  { id: 'f2', f: { id: 'f2', cn: '潜行者', en: 'Stalker', y: 1979, c: '苏联', dir: '安德烈·塔可夫斯基', genre: ['科幻', '剧情'] }, rec: { d: '2026-11-12', r: 9, fun: 4, bore: 4 } },
  { id: 'f3', f: { id: 'f3', cn: '小城之春', en: 'Spring in a Small Town', y: 1948, c: '中国大陆', dir: '费穆', genre: ['剧情', '爱情'] }, rec: { d: '2025-10-03', r: 8, fun: 3.5, bore: 2 } },
  { id: 'ev1', f: { id: 'ev1', cn: '大师讲堂', ev: 1 }, rec: { d: '2026-11-15', r: 10, fun: 5, bore: 0 } },
  { id: 'del1', f: { id: 'del1', cn: '已删除影片' }, rec: { d: '2026-11-15', del: 1, r: 8 } }
];

// 1. 全量范围构建 payload（排除活动与已删除影片，包含趣味四象限摘要与重刷次数）
const b1 = TP.buildPayload(entries, { en: false, tasteReport: TR });
assert.strictEqual(b1.ok, true);
assert.strictEqual(b1.watchedCount, 3);
assert.strictEqual(b1.ratedCount, 3);
assert.strictEqual(b1.payload.action, 'taste_portrait');
assert.strictEqual(b1.payload.lang, 'zh');
assert.strictEqual(b1.payload.topFilms.length, 3);
assert.strictEqual(b1.payload.topFilms.find(x => x.t === '花样年华').v, 2);
assert.strictEqual(b1.payload.topFilms.find(x => x.t === '花样年华').g, '剧情/爱情');
assert.ok(b1.payload.tasteSummary && b1.payload.tasteSummary.code && b1.payload.tasteSummary.persona && b1.payload.tasteSummary.title);

// 2. 年份筛选不足 3 部时 ok === false
const b2026 = TP.buildPayload(entries, { en: false, year: '2026', tasteReport: TR });
assert.strictEqual(b2026.ok, false);
assert.strictEqual(b2026.watchedCount, 2);

// 3. 指纹稳定性：同输入同指纹；评分、语言、范围任一变化则指纹改变
const fp1 = TP.fingerprint(b1.payload);
const fp1Again = TP.fingerprint(TP.buildPayload(entries.slice().reverse(), { en: false, tasteReport: TR }).payload);
assert.strictEqual(fp1, fp1Again);

const bEn = TP.buildPayload(entries, { en: true, tasteReport: TR });
assert.notStrictEqual(fp1, TP.fingerprint(bEn.payload));
assert.strictEqual(bEn.payload.topFilms.find(x => x.t === 'Stalker').fun, 4);

const changed = entries.map(e => e.id === 'f3' ? Object.assign({}, e, { rec: Object.assign({}, e.rec, { r: 9 }) }) : e);
assert.notStrictEqual(fp1, TP.fingerprint(TP.buildPayload(changed, { en: false, tasteReport: TR }).payload));

// 4. 归一化与本机 LRU 缓存（最多保留 CACHE_MAX 条）
const mem = {};
const getItem = k => mem[k] || '';
const setItem = (k, v) => { mem[k] = v; };
const sample = {
  headline: '  慢镜头里的暗房拾光人  ',
  tags: ['慢节奏友好', '重刷经典派', '爱憎分明', '导演控', '超出截断'],
  commentary: '你在《花样年华》里反复流连，又愿意在《潜行者》的漫长凝视里沉潜。\n\n\n这说明你对节奏有极高的包容度。',
  nextHint: '下次不妨挑一部东欧新浪潮的 4K 修复场。'
};
const saved = TP.writeCache(getItem, setItem, TP.WEB_CACHE_KEY, fp1, sample, 1000);
assert.strictEqual(saved.headline, '慢镜头里的暗房拾光人');
assert.strictEqual(saved.tags.length, 4);
assert.strictEqual(saved.paragraphs.length, 2);

const hit = TP.readCache(getItem, TP.WEB_CACHE_KEY, fp1);
assert.ok(hit && hit.cached);
assert.strictEqual(hit.portrait.headline, '慢镜头里的暗房拾光人');

// 写入超过 CACHE_MAX 条，最旧条目被淘汰
for (let i = 0; i < TP.CACHE_MAX + 3; i++) {
  TP.writeCache(getItem, setItem, TP.WEB_CACHE_KEY, 'fp-' + i, sample, 2000 + i);
}
assert.strictEqual(TP.readCache(getItem, TP.WEB_CACHE_KEY, fp1), null);
assert.ok(TP.readCache(getItem, TP.WEB_CACHE_KEY, 'fp-' + (TP.CACHE_MAX + 2)));

// 5. 复制文本格式化与空对象防御
const copyZh = TP.formatCopyText(saved, '全部观影', false);
assert.ok(copyZh.includes('麻雀观影护照 · AI 观影画像（全部观影）'));
assert.ok(copyZh.includes('#慢节奏友好'));
assert.ok(copyZh.includes('下一步建议：'));
assert.strictEqual(TP.normalizePortrait({ headline: 'x', commentary: '' }), null);

console.log('PASS: AI taste portrait (payload, scope filter, fingerprint stability, LRU cache, normalization, copy text)');
