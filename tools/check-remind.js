// 订阅消息规则测试（cloudfunctions/remind/rules.js）：开场提醒、场次变更、想看新场次、字段长度与时间格式
const assert = require('assert');
const fs = require('fs'), path = require('path');
const R = require('../cloudfunctions/remind/rules.js');
const root = path.join(__dirname, '..');
const cat = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog.json'), 'utf8'));
const films = [], shows = [], seen = new Set();
cat.programmes.forEach(p => {
  if (!p.file) return;
  const pk = JSON.parse(fs.readFileSync(path.join(root, p.file), 'utf8'));
  (pk.films || []).forEach(f => { if (!seen.has(f.id)) { seen.add(f.id); films.push(f); } });
  (pk.shows || []).forEach(r => { const [d, t, id, v = 'premiere', h = 'luxe'] = Array.isArray(r) ? r : [r.d, r.t, r.id, r.v, r.h]; shows.push({ d, t, id, v, h, p: p.id }); });
});
const data = { films, shows, venues: cat.venues };
const idx = R.index(data);

// 时间：北京时间、年份规则与小程序一致
assert.strictEqual(R.timeText(R.startOf({ d: '11/20', t: '19:30' })), '2026年11月20日 19:30');
assert.strictEqual(R.timeText(R.startOf({ d: '1/5', t: '09:05' })), '2027年1月5日 09:05');
assert.strictEqual(R.timeText(R.startOf({ d: '3/1', t: '10:00', year: 2026 })), '2026年3月1日 10:00');
assert.strictEqual(Array.from(R.cut('一二三四五六七八九十一二三四五六七八九十一')).length, 20);

// 全部场次：消息字段都合规（thing ≤ 20 字、非空，time 格式正确）
const checkMsg = m => {
  ['thing1', 'thing5', 'thing6', 'thing8'].forEach(k => { const v = m[k].value; assert.ok(v && Array.from(v).length <= 20, k + ' ' + v); });
  assert.match(m.time2.value, /^\d{4}年\d{1,2}月\d{1,2}日 \d{2}:\d{2}$/);
};
let n = 0;
shows.forEach(s => { if (!idx.F[s.id]) return; checkMsg(R.message('start', idx.F[s.id], s, idx, R.startOf(s))); n++; });
assert.ok(n > 100, 'checked ' + n);

const s = shows.find(x => idx.F[x.id] && !idx.F[x.id].ev);
const st = R.startOf(s), key = R.keyOf(s);
const doc = { kind: 'show', key, film: s.id, start: st, show: { d: s.d, t: s.t, v: s.v, h: s.h } };
// 开场前 1 小时内才发；更早等待；开场后过期
assert.strictEqual(R.decide(doc, idx, st - 2 * R.HOUR, true).act, 'wait');
const go = R.decide(doc, idx, st - 50 * 60e3, true);
assert.strictEqual(go.act, 'send'); assert.strictEqual(go.kind, 'start');
assert.strictEqual(go.page, 'pages/film/film?id=' + encodeURIComponent(s.id));
assert.strictEqual(R.decide(doc, idx, st + 20 * 60e3, true).act, 'expire');

// 场次键消失（改时间 / 影厅）：数据可信时发变更通知，地点用原场次；数据不可信时不发
const moved = Object.assign({}, doc, { key: key + 'x' });
const ch = R.decide(moved, idx, st - 5 * R.HOUR, true);
assert.strictEqual(ch.kind, 'change'); assert.strictEqual(ch.data.thing5.value, R.placeOf(s, idx)); checkMsg(ch.data);
assert.strictEqual(R.decide(moved, idx, st - 5 * R.HOUR, false).act, 'wait');

// 场次变更记录：改期按新时间新地点发「已改期」；取消发「已取消」；不依赖数据新鲜度
const ns = shows.find(x => idx.F[x.id] && x !== s && R.startOf(x) > st + 3 * R.HOUR);
const idxM = Object.assign({}, idx, { moves: { [key + 'z']: { to: R.keyOf(ns), f: s.id }, [key + 'y']: { to: null, f: s.id } } });
const mv = R.decide(Object.assign({}, doc, { key: key + 'z' }), idxM, st - 5 * R.HOUR, false);
assert.strictEqual(mv.kind, 'moved'); assert.strictEqual(mv.data.time2.value, R.timeText(R.startOf(ns))); assert.strictEqual(mv.data.thing5.value, R.placeOf(ns, idx)); checkMsg(mv.data);
const cc = R.decide(Object.assign({}, doc, { key: key + 'y' }), idxM, st - 5 * R.HOUR, false);
assert.strictEqual(cc.kind, 'cancelled'); assert.strictEqual(cc.data.time2.value, R.timeText(st)); checkMsg(cc.data);

// 想看：已知场次不提醒；出现新场次提醒最早的一场
const now = st - 3 * R.HOUR, ups = R.upcoming(idx, s.id, now);
assert.strictEqual(R.decide({ kind: 'want', film: s.id, known: ups.map(R.keyOf) }, idx, now, true).act, 'wait');
const w = R.decide({ kind: 'want', film: s.id, known: [] }, idx, now, true);
assert.strictEqual(w.kind, 'want'); checkMsg(w.data);

// 影院 id 含「-」的场次（如厦门金鸡）地点也正确
const dash = shows.find(x => /-/.test(x.v) && idx.F[x.id]);
if (dash) assert.ok(!/^[\w-]+$/.test(R.placeOf(dash, idx)), 'place for ' + dash.v);
console.log('check-remind ok · ' + n + ' screenings');
