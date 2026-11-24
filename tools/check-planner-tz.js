// 时区（shared/tz.js）、影院坐标与转场/映后提醒/冲突一键换场/想看一键排片（shared/planner.js）与订阅提醒多时区测试
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const TZ = require('../shared/tz.js');
const P = require('../shared/planner.js');
const R = require('../cloudfunctions/remind/rules.js');

const root = path.join(__dirname, '..');
const cat = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog.json'), 'utf8'));

// 1. catalog.json 坐标与时区完整性
const geoVenues = cat.venues.filter(v => Array.isArray(v.geo));
assert.ok(geoVenues.length >= 36, 'expected >= 36 venues with geo, got ' + geoVenues.length);
geoVenues.forEach(v => {
  const g = P.geoOf(v);
  assert.ok(g && g.lat > 18 && g.lat < 54 && g.lng > 73 && g.lng < 135, 'valid China/Taiwan coord for ' + v.id);
  const url = P.mapURL(v);
  if (v.city === '台北') {
    assert.strictEqual(v.tz, 'Asia/Taipei', 'Taipei venue tz: ' + v.id);
    assert.ok(url.startsWith('https://www.google.com/maps/'), 'Taipei venue should use Google Maps: ' + url);
  } else {
    assert.ok(url.startsWith('https://uri.amap.com/marker?'), 'Mainland venue should use Amap: ' + url);
  }
});
const gh = cat.programmes.find(p => p.id === 'golden-horse-2026');
assert.strictEqual(gh && gh.tz, 'Asia/Taipei', 'golden-horse-2026 should declare Asia/Taipei');

// 2. shared/tz.js — 多时区（含夏令时 DST）与优先级
const vn = {
  hz: { id: 'hz', city: '杭州' },
  tp: { id: 'tp', city: '台北', tz: 'Asia/Taipei' },
  tyo: { id: 'tyo', city: '东京' },
  cannes: { id: 'cannes', city: '戛纳', tz: 'Europe/Paris' },
  tor: { id: 'tor', city: '多伦多', tz: 'America/Toronto' }
};
const pg = {
  p1: { id: 'p1', city: '杭州' },
  p2: { id: 'p2', city: '东京', tz: 'Asia/Tokyo' },
  p3: { id: 'p3', city: '戛纳' }
};
assert.strictEqual(TZ.tzOf({ v: 'hz', p: 'p1' }, vn, pg), 'Asia/Shanghai');
assert.strictEqual(TZ.tzOf({ v: 'tp', p: 'p1' }, vn, pg), 'Asia/Taipei');
assert.strictEqual(TZ.tzOf({ v: 'tyo', p: 'p1' }, vn, pg), 'Asia/Tokyo');
assert.strictEqual(TZ.tzOf({ v: 'hz', p: 'p2' }, vn, pg), 'Asia/Tokyo');
assert.strictEqual(TZ.tzOf({ v: 'hz', p: 'p1', tz: 'Europe/London' }, vn, pg), 'Europe/London');

// 精确 UTC 转换：上海 (+8)、东京 (+9)、巴黎夏令时 (+2) 与冬令时 (+1)、多伦多夏令时 (-4) 与冬令时 (-5)
assert.strictEqual(TZ.showMs({ d: '11/20', t: '19:30', year: 2026, v: 'hz', p: 'p1' }, vn, pg), Date.UTC(2026, 10, 20, 11, 30));
assert.strictEqual(TZ.showMs({ d: '11/20', t: '19:30', year: 2026, v: 'tyo', p: 'p2' }, vn, pg), Date.UTC(2026, 10, 20, 10, 30));
assert.strictEqual(TZ.showMs({ d: '5/18', t: '20:00', year: 2026, v: 'cannes', p: 'p3' }, vn, pg), Date.UTC(2026, 4, 18, 18, 0)); // CEST +2
assert.strictEqual(TZ.showMs({ d: '1/18', t: '20:00', year: 2027, v: 'cannes', p: 'p3' }, vn, pg), Date.UTC(2027, 0, 18, 19, 0)); // CET +1
assert.strictEqual(TZ.showMs({ d: '9/10', t: '19:00', year: 2026, v: 'tor', p: 'p1' }, vn, pg), Date.UTC(2026, 8, 10, 23, 0)); // EDT -4
assert.strictEqual(TZ.showMs({ d: '12/10', t: '19:00', year: 2026, v: 'tor', p: 'p1' }, vn, pg), Date.UTC(2026, 11, 11, 0, 0)); // EST -5

// nowParts / showIso / weekday 不受本机时区影响
const npParis = TZ.nowParts(Date.UTC(2026, 4, 18, 22, 30), 'Europe/Paris');
assert.strictEqual(npParis.iso, '2026-05-19');
assert.strictEqual(npParis.dayKey, '5/19');
assert.strictEqual(npParis.min, 30);
assert.strictEqual(TZ.showIso({ d: '11/5', year: 2026 }), '2026-11-05');
assert.strictEqual(TZ.weekday('11/20', 2026), 5); // 2026-11-20 is Friday

// ICS 时区输出
const vtz = TZ.icsTimezones(['Asia/Shanghai', 'Asia/Taipei', 'Europe/Paris', 'Asia/Shanghai']);
assert.ok(vtz.includes('TZID:Asia/Shanghai') && vtz.includes('TZID:Asia/Taipei') && vtz.includes('TZID:Europe/Paris'));
assert.strictEqual(vtz.filter(l => l === 'BEGIN:VTIMEZONE').length, 3);
const icsEv = TZ.icsEventDates({ d: '5/18', t: '22:30', year: 2026, v: 'cannes', p: 'p3' }, 120, vn, pg);
assert.strictEqual(icsEv.dtstart, 'DTSTART;TZID=Europe/Paris:20260518T223000');
assert.strictEqual(icsEv.dtend, 'DTEND;TZID=Europe/Paris:20260519T003000');

// 3. cloudfunctions/remind/rules.js 多时区提醒验证
const rIdx = R.index({
  films: [{ id: 'f1', cn: '东京物语' }, { id: 'f2', cn: '戛纳首映' }],
  venues: [
    { id: 'v-tyo', name: '东京日比谷影院', city: '东京', tz: 'Asia/Tokyo', halls: [{ id: 'h1', name: '1厅' }] },
    { id: 'v-can', name: '卢米埃尔大厅', city: '戛纳', tz: 'Europe/Paris', halls: [{ id: 'h1', name: '主厅' }] }
  ],
  programmes: [{ id: 'p-tyo', tz: 'Asia/Tokyo' }, { id: 'p-can', tz: 'Europe/Paris' }],
  shows: [
    { d: '11/20', t: '19:00', id: 'f1', v: 'v-tyo', h: 'h1', p: 'p-tyo' },
    { d: '5/18', t: '20:00', year: 2026, id: 'f2', v: 'v-can', h: 'h1', p: 'p-can' }
  ]
});
const stTyo = R.startOf(rIdx.shows[0], rIdx);
assert.strictEqual(stTyo, Date.UTC(2026, 10, 20, 10, 0)); // 19:00 JST = 10:00 UTC
const decTyo = R.decide({ kind: 'show', key: R.keyOf(rIdx.shows[0]), film: 'f1', start: stTyo, show: rIdx.shows[0] }, rIdx, stTyo - 30 * 60e3, true);
assert.strictEqual(decTyo.act, 'send');
assert.strictEqual(decTyo.data.time2.value, '2026年11月20日 19:00');
const stCan = R.startOf(rIdx.shows[1], rIdx);
assert.strictEqual(stCan, Date.UTC(2026, 4, 18, 18, 0)); // 20:00 CEST = 18:00 UTC
const decCan = R.decide({ kind: 'show', key: R.keyOf(rIdx.shows[1]), film: 'f2', start: stCan, show: rIdx.shows[1] }, rIdx, stCan - 40 * 60e3, true);
assert.strictEqual(decCan.act, 'send');
assert.strictEqual(decCan.data.time2.value, '2026年5月18日 20:00');

// 4. shared/planner.js — 转场、映后 30 分钟、冲突一键换场、想看一键排片
const VN = {
  v1: { id: 'v1', name: '杭州百美汇影城', short: '百美汇', city: '杭州', geo: [30.260416, 120.161926], halls: [{ id: 'h1', name: '1厅' }, { id: 'h2', name: '2厅' }] },
  v2: { id: 'v2', name: '杭州万象影城', short: '万象城', city: '杭州', geo: [30.251753, 120.215513], halls: [{ id: 'h1', name: 'IMAX厅' }] },
  v3: { id: 'v3', name: '台北信义威秀', short: '信义威秀', city: '台北', tz: 'Asia/Taipei', geo: [25.0355, 121.5671], halls: [{ id: 'h1', name: '1厅' }] }
};
const F = {
  a: { id: 'a', cn: '电影A', min: 100, screeningNotes: { '11/20-14:00-v1-h1': '映后活动 · 导演交流' } },
  b: { id: 'b', cn: '电影B', min: 110 },
  c: { id: 'c', cn: '电影C', min: 90 },
  d: { id: 'd', cn: '电影D', min: 100 },
  e: { id: 'e', cn: '电影E', min: 100 }
};
const ctx = {
  F, VN, PG: {},
  keyOf: s => `${s.d}-${s.t}-${s.v}-${s.h}`,
  durationOf: s => F[s.id].min,
  showMs: s => TZ.showMs(s, VN, {}),
  isPast: () => false,
  preferredCity: '杭州'
};

// 4a. 同影院 + 映后 30 分钟提醒：A 14:00-15:40（含映后至 16:10），B 16:00 开场 → 间隔 20 分钟本够换厅，但留步映后会重叠！
const sA = { d: '11/20', t: '14:00', id: 'a', v: 'v1', h: 'h1' };
const sB = { d: '11/20', t: '16:00', id: 'b', v: 'v1', h: 'h2' };
const trSameQa = P.transfer(sA, sB, ctx);
assert.strictEqual(trSameQa.kind, 'same');
assert.strictEqual(trSameQa.gap, 20);
assert.strictEqual(trSameQa.postMin, 30);
assert.strictEqual(trSameQa.postOverlap, true);
const fgQa = P.formatGap(trSameQa, { en: false, toVenue: '百美汇' });
assert.strictEqual(fgQa.cls, 'tight');
assert.ok(fgQa.txt.includes('映后'), 'should warn about post-screening Q&A: ' + fgQa.txt);

// 4b. 跨影院距离估算 + 映后留步偏紧
const sCrossOk = { d: '11/20', t: '16:25', id: 'b', v: 'v2', h: 'h1' }; // 间隔 45 分钟，无映后够用，有映后只剩 15 分钟不够转场
const trCrossQa = P.transfer(sA, sCrossOk, ctx);
assert.strictEqual(trCrossQa.kind, 'cross');
assert.ok(trCrossQa.km > 4 && trCrossQa.taxi > 10 && trCrossQa.metro > 15);
assert.strictEqual(trCrossQa.tight, false);
assert.strictEqual(trCrossQa.postTight, true);
assert.strictEqual(P.formatGap(trCrossQa, { en: false, toVenue: '万象城' }).cls, 'tight');

// 4c. 跨城市同一天
const sCity = { d: '11/20', t: '17:00', id: 'b', v: 'v3', h: 'h1' };
const trCity = P.transfer(sA, sCity, ctx);
assert.strictEqual(trCity.kind, 'city');
assert.strictEqual(trCity.clash, true);

// 4d. 冲突一键换场
const sClash = { d: '11/20', t: '15:00', id: 'b', v: 'v1', h: 'h2' }; // 与 sA (14:00-15:40) 冲突
const sBAlt1 = { d: '11/20', t: '16:30', id: 'b', v: 'v1', h: 'h2' }; // 同日同影院无冲突
const sBAlt2 = { d: '11/21', t: '19:00', id: 'b', v: 'v2', h: 'h1' }; // 次日跨影院无冲突
const sBAltBad = { d: '11/20', t: '14:30', id: 'b', v: 'v2', h: 'h1' }; // 仍然冲突，应被排除
const swaps = P.conflictSwaps([sA, sClash], [sA, sClash, sBAlt1, sBAlt2, sBAltBad], ctx);
assert.strictEqual(swaps.length, 1);
assert.strictEqual(swaps[0].fromKey, ctx.keyOf(sClash));
assert.strictEqual(swaps[0].alts.length, 2);
assert.strictEqual(swaps[0].alts[0].key, ctx.keyOf(sBAlt1), 'same-day same-venue comfortable swap should rank first');

// 4e. 想看一键排片：稀缺度优先 + 最大化排入影片数 + 保留已有排片不动
const sCOnly = { d: '11/21', t: '14:00', id: 'c', v: 'v1', h: 'h1' }; // C 唯一场次
const sD1 = { d: '11/21', t: '14:30', id: 'd', v: 'v1', h: 'h2' }; // D 第一场与 C 冲突
const sD2 = { d: '11/21', t: '16:30', id: 'd', v: 'v1', h: 'h2' }; // D 第二场与 C 同影院顺路不冲突
const allForSuggest = [sA, sCOnly, sD1, sD2]; // E 无待映场次
const sug = P.suggestPlan(['a', 'c', 'd', 'e'], [sA], allForSuggest, ctx);
assert.deepStrictEqual(sug.alreadyPlanned, ['a']);
assert.strictEqual(sug.picks.length, 2, 'should schedule both C and D by picking D2');
assert.deepStrictEqual(sug.picks.map(x => x.key), [ctx.keyOf(sCOnly), ctx.keyOf(sD2)]);
assert.ok(sug.picks[0].tags.includes('唯一场次'));
assert.ok(sug.picks[1].tags.includes('同影院顺路'));
assert.strictEqual(sug.unscheduled.length, 1);
assert.strictEqual(sug.unscheduled[0].filmId, 'e');
assert.strictEqual(sug.unscheduled[0].reason, 'no_upcoming');

console.log('PASS: planner & tz — ' + geoVenues.length + ' venues with geo, multi-TZ/DST, Q&A 30-min transfer, conflict swaps, smart want-list suggestion.');
