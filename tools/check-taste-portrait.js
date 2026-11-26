// 个人观影画像 / AI 评语单测（shared/taste-portrait.js）
const assert = require('assert');
const TP = require('../shared/taste-portrait.js');
const TR = require('../shared/taste-report.js');

const entries = [
  { id: 'f1', f: { id: 'f1', cn: '花样年华', en: 'In the Mood for Love', y: 2000, c: '中国香港', dir: '王家卫', genre: ['剧情', '爱情'] }, rec: { d: '2026-11-10', r: 10, fun: 4.5, bore: 1, v: [{ d: '2026-11-10' }, { d: '2026-11-20' }] } },
  { id: 'f2', f: { id: 'f2', cn: '潜行者', en: 'Stalker', y: 1979, c: '苏联', dir: '安德烈·塔可夫斯基', genre: ['科幻', '剧情'] }, rec: { d: '2026-11-12', r: 9, fun: 4, bore: 4 } },
  { id: 'f3', f: { id: 'f3', cn: '小城之春', en: 'Spring in a Small Town', y: 1948, c: '中国大陆', dir: '费穆', genre: ['剧情', '爱情'] }, rec: { d: '2025-10-03', r: 8, fun: 3.5, bore: 2 } },
  { id: 'f4', f: { id: 'f4', cn: '重庆森林', en: 'Chungking Express', y: 1994, c: '中国香港', dir: '王家卫', genre: ['剧情', '喜剧'] }, rec: { d: '2025-11-05', r: 6.5, fun: 4.5, bore: 0.5 } },
  { id: 'ev1', f: { id: 'ev1', cn: '大师讲堂', ev: 1 }, rec: { d: '2026-11-15', r: 10, fun: 5, bore: 0 } },
  { id: 'del1', f: { id: 'del1', cn: '已删除影片' }, rec: { d: '2026-11-15', del: 1, r: 8 } }
];

// 1. 全量范围构建 payload（排除活动与已删除影片，包含趣味四象限摘要、重刷次数与全量深度信号）
const b1 = TP.buildPayload(entries, { en: false, tasteReport: TR });
assert.strictEqual(b1.ok, true);
assert.strictEqual(b1.watchedCount, 4);
assert.strictEqual(b1.ratedCount, 4);
assert.strictEqual(b1.payload.action, 'taste_portrait');
assert.strictEqual(b1.payload.lang, 'zh');
assert.strictEqual(b1.payload.topFilms.length, 4);
assert.strictEqual(b1.payload.topFilms.find(x => x.t === '花样年华').v, 2);
assert.strictEqual(b1.payload.topFilms.find(x => x.t === '花样年华').g, '剧情/爱情');
assert.ok(b1.payload.tasteSummary && b1.payload.tasteSummary.code && b1.payload.tasteSummary.persona && b1.payload.tasteSummary.title);

const sig = b1.payload.signals;
assert.ok(sig && sig.star && sig.star.n === 4 && sig.star.high === 2 && sig.star.min === 6.5 && sig.star.max === 10);
assert.strictEqual(typeof sig.funBoreCorr, 'number');
assert.strictEqual(typeof sig.starFunCorr, 'number');
assert.deepStrictEqual(sig.topDirectors[0], { name: '王家卫', n: 2, avgR: 8.3 });
assert.deepStrictEqual(sig.topCountries[0], { name: '中国香港', n: 2 });
assert.strictEqual(sig.yearSpan, '1948–2000');
assert.strictEqual(sig.rewatched[0].t, '花样年华');
assert.strictEqual(sig.paradoxes.captivatingTiring[0].t, '潜行者');
assert.strictEqual(sig.paradoxes.respectedTiring[0].t, '潜行者');
assert.strictEqual(sig.paradoxes.guiltyPleasure[0].t, '重庆森林');
assert.strictEqual(sig.paradoxes.highestRated[0].t, '花样年华');
assert.strictEqual(sig.paradoxes.lowestRated[0].t, '重庆森林');

// 2. 年份筛选不足 3 部时 ok === false
const b2026 = TP.buildPayload(entries, { en: false, year: '2026', tasteReport: TR });
assert.strictEqual(b2026.ok, false);
assert.strictEqual(b2026.watchedCount, 2);

// 3. 指纹稳定性（tp2 前缀）：同输入乱序同指纹；评分、语言、范围任一变化则指纹改变
const fp1 = TP.fingerprint(b1.payload);
assert.ok(fp1.startsWith('tp2-'));
const fp1Again = TP.fingerprint(TP.buildPayload(entries.slice().reverse(), { en: false, tasteReport: TR }).payload);
assert.strictEqual(fp1, fp1Again);

const bEn = TP.buildPayload(entries, { en: true, tasteReport: TR });
assert.notStrictEqual(fp1, TP.fingerprint(bEn.payload));
assert.strictEqual(bEn.payload.topFilms.find(x => x.t === 'Stalker').fun, 4);
assert.strictEqual(bEn.payload.signals.paradoxes.captivatingTiring[0].t, 'Stalker');

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

// 生成次数：1 小时 3 次、24 小时 8 次
{
  const T0 = Date.UTC(2026, 10, 26, 8), M = 6e4;
  let log = [];
  assert.deepStrictEqual([TP.quotaState(log, T0).ok, TP.quotaState(log, T0).left], [true, 3]);
  for (let i = 0; i < 3; i++) log = TP.quotaAdd(log, T0 - 30 * M + i * M);
  let st = TP.quotaState(log, T0);
  assert.strictEqual(st.ok, false); assert.strictEqual(st.left, 0);
  assert.strictEqual(st.waitMs, 30 * M);                                   // 最早一次满 1 小时后恢复
  assert.ok(/约 30 分钟/.test(TP.quotaText(st, false)) && /about 30 min/.test(TP.quotaText(st, true)));
  st = TP.quotaState(log, T0 + 30 * M + 3e4); assert.strictEqual(st.ok, true); assert.strictEqual(st.left, 1); // 最早那次刚过 1 小时，恢复 1 次
  // 每天 8 次：分散在一天里，第 9 次要等最早那次满 24 小时
  let day = []; for (let i = 0; i < 8; i++) day = TP.quotaAdd(day, T0 - (20 - 2 * i) * 36e5);
  st = TP.quotaState(day, T0); assert.strictEqual(st.ok, false); assert.strictEqual(st.dayLeft, 0); assert.strictEqual(st.waitMs, 4 * 36e5);
  assert.strictEqual(TP.quotaState(['x', null, T0 - 2 * 864e5], T0).left, 3); // 过期和坏记录不算
  assert.ok(/还可重新生成 3 次/.test(TP.quotaText(TP.quotaState([], T0), false)));
}
// 分享图片：用假画布量高度、画一遍，检查文字都画上了、高度与排版一致
{
  const drawn = []; let imgs = 0;
  const fake = { font: '', fillStyle: '', strokeStyle: '', lineWidth: 1, textAlign: 'left', textBaseline: 'alphabetic',
    measureText: t => ({ width: [...String(t)].length * 30 }), fillText: t => drawn.push(t), fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, arcTo() {}, closePath() {}, fill() {}, stroke() {},
    drawImage: () => { imgs++; } };
  const portrait = { headline: '慢热的长镜头信徒', tags: ['慢节奏友好', '作者电影'], commentary: '第一段评语。'.repeat(12) + '\n' + '第二段评语。'.repeat(8), nextHint: '试试侯麦的四季故事' };
  const o = { portrait, scope: '全部观影', count: 12, holder: '小麻雀', date: '2026.11.26', qrImg: {}, en: false };
  const H = TP.shareHeight(fake, o);
  assert.ok(H > 1200 && H < 4000, 'share height ' + H);
  assert.strictEqual(TP.drawShare(fake, o), H, 'draw returns the measured height');
  const all = drawn.join('|');
  ['小麻雀的 AI 观影画像', '慢热的长镜头信徒', '#慢节奏友好', '下一步建议', '扫码生成你的 AI 观影画像', '全部观影 · 12 部影片 · 2026.11.26'].forEach(t => assert.ok(all.includes(t), 'missing ' + t));
  assert.strictEqual(imgs, 1, 'mini-program code is drawn');
  assert.strictEqual(TP.shareHeight(fake, { portrait: null }), 0);
  drawn.length = 0; TP.drawShare(fake, Object.assign({}, o, { en: true, holder: '' }));
  assert.ok(drawn.join('|').includes('My AI Film Portrait') && drawn.join('|').includes('Scan for your own portrait'));
}

console.log('PASS: AI taste portrait (payload, signals, paradoxes, scope filter, tp2 fingerprint stability, LRU cache, normalization, copy text, generation quota, share image layout)');
