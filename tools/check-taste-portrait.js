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

// 6. 短时间（每小时 3 次）与每日（24 小时 5 次）生成配额 + 服务端冷却锁定
const qMem = {};
const qGet = k => qMem[k] || '';
const qSet = (k, v) => { qMem[k] = v; };
const T0 = 1_700_000_000_000;
let q = TP.checkQuota(qGet, TP.WEB_QUOTA_KEY, T0);
assert.strictEqual(q.ok, true);
assert.strictEqual(q.remain, 3);
assert.strictEqual(TP.quotaBtnLabel(q, false, false), '重新生成');

TP.recordQuota(qGet, qSet, TP.WEB_QUOTA_KEY, T0);
q = TP.recordQuota(qGet, qSet, TP.WEB_QUOTA_KEY, T0 + 10_000);
assert.strictEqual(q.ok, true);
assert.strictEqual(q.remain, 1);
assert.strictEqual(TP.quotaBtnLabel(q, false, false), '重新生成（余1次）');

q = TP.recordQuota(qGet, qSet, TP.WEB_QUOTA_KEY, T0 + 20_000);
assert.strictEqual(q.ok, false);
assert.strictEqual(q.scope, 'hour');
assert.ok(q.waitMs > 50 * 60 * 1000);
assert.ok(TP.formatQuotaMsg(q, false).includes('每小时最多 3 次'));
assert.ok(TP.formatQuotaMsg(q, true).includes('3 per hour'));
assert.ok(TP.quotaBtnLabel(q, false, false).includes('后再试'));

// 1 小时后小时窗口释放，再生成 2 次触发 24 小时 5 次上限
const T1 = T0 + TP.HOUR_MS + 60_000;
assert.strictEqual(TP.checkQuota(qGet, TP.WEB_QUOTA_KEY, T1).ok, true);
TP.recordQuota(qGet, qSet, TP.WEB_QUOTA_KEY, T1);
q = TP.recordQuota(qGet, qSet, TP.WEB_QUOTA_KEY, T1 + 5000);
assert.strictEqual(q.ok, false);
assert.strictEqual(q.scope, 'day');
assert.ok(TP.formatQuotaMsg(q, false).includes('24 小时内已达生成上限'));
assert.ok(TP.formatQuotaMsg(q, true).includes('5 per 24h'));

// 24 小时后全部释放；服务端返回 rate_limited 时同步锁定
const T2 = T1 + TP.DAY_MS + 60_000;
assert.strictEqual(TP.checkQuota(qGet, TP.WEB_QUOTA_KEY, T2).ok, true);
const locked = TP.lockQuota(qGet, qSet, TP.WEB_QUOTA_KEY, 900, 'hour', T2);
assert.strictEqual(locked.ok, false);
assert.strictEqual(TP.checkQuota(qGet, TP.WEB_QUOTA_KEY, T2 + 60_000).ok, false);
assert.strictEqual(TP.checkQuota(qGet, TP.WEB_QUOTA_KEY, T2 + 901_000).ok, true);

// 7. 分享图片画布尺寸与绘制（中/英文、带/不带趣味人格、页脚小程序码回调）
function mockCtx() {
  const texts = [];
  return {
    texts,
    font: '400 32px sans-serif',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    textAlign: 'left',
    textBaseline: 'alphabetic',
    measureText(s) {
      const m = String(this.font || '').match(/(\d+(?:\.\d+)?)px/);
      const fs = m ? Number(m[1]) : 24;
      let w = 0;
      for (const ch of String(s || '')) w += /[^\x00-\x7f]/.test(ch) ? fs : fs * 0.56;
      return { width: w };
    },
    createLinearGradient() { return { addColorStop() {} }; },
    beginPath() {}, moveTo() {}, lineTo() {}, arcTo() {}, arc() {}, closePath() {},
    fillRect() {}, strokeRect() {}, fill() {}, stroke() {}, save() {}, restore() {}, clip() {},
    fillText(t) { texts.push(String(t)); }
  };
}

let footerCalled = null;
const cZh = mockCtx();
const cardOptsZh = {
  en: false,
  holder: '麻雀影迷',
  scope: '全部观影',
  watchedCount: 4,
  ratedCount: 4,
  date: '2026.11.26',
  tasteSummary: b1.payload.tasteSummary,
  footer: (cc, y, H) => { footerCalled = { y, H }; }
};
const hZh = TP.cardHeight(cZh, saved, cardOptsZh);
assert.ok(hZh >= 900 && hZh <= 3000, 'unexpected card height: ' + hZh);
TP.drawCard(cZh, saved, cardOptsZh);
assert.ok(footerCalled && footerCalled.H === hZh && footerCalled.y < hZh);
assert.ok(cZh.texts.some(t => t.includes('麻雀影迷的 AI 观影画像')));
assert.ok(cZh.texts.some(t => t.includes('慢镜头里的暗房拾光人')));
assert.ok(cZh.texts.some(t => t.includes('#慢节奏友好')));
assert.ok(cZh.texts.some(t => t.includes('下一步建议')));

const cEn = mockCtx();
const hEn = TP.cardHeight(cEn, { headline: 'Night Owl of Slow Cinema', tags: ['Slow burn', 'Rewatcher'], commentary: 'You linger inside Stalker and replay In the Mood for Love.\n\nYour star ratings stay disciplined even when you are thrilled.', nextHint: 'Try an Eastern European 4K restoration next.' }, { en: true, scope: 'All watched films', watchedCount: 12 });
assert.ok(hEn >= 600);
TP.drawCard(cEn, { headline: 'Night Owl of Slow Cinema', tags: ['Slow burn', 'Rewatcher'], commentary: 'You linger inside Stalker and replay In the Mood for Love.\n\nYour star ratings stay disciplined even when you are thrilled.', nextHint: 'Try an Eastern European 4K restoration next.' }, { en: true, scope: 'All watched films', watchedCount: 12 });
assert.ok(cEn.texts.some(t => t.includes('My AI Taste Portrait')));

console.log('PASS: AI taste portrait (payload, signals, paradoxes, scope filter, tp2 fingerprint stability, LRU cache, quota limits, share card canvas, copy text)');
