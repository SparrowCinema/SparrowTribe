// 影院排片面板规则测试（shared/venue-board.js，「影院地图与交通」页点开一家影院）
const assert = require('assert');
const B = require('../shared/venue-board.js');
const H = 3600e3, T0 = Date.UTC(2026, 10, 26, 2);
const films = { a: { id: 'a' }, b: { id: 'b' }, c: { id: 'c' }, e: { id: 'e', ev: 1 } };
// d：日期键；h：相对 T0 的小时；早于 T0 的为已散场
const S = (id, d, h) => ({ id, d, h, t: String(h) });
const shows = [
  S('a', '11/27', 30), S('b', '11/26', 5), S('a', '11/26', 3), S('c', '11/25', -20), S('b', '11/25', -22),
  S('e', '11/26', 8), S('c', '11/24', -40), S('x', '11/26', 4) // x：片库里没有，跳过
];
const o = (pick, allMax) => ({ film: id => films[id], start: s => T0 + s.h * H, past: s => s.h < 0, pick, allMax });
let b = B.board(shows, o({}));
assert.deepStrictEqual(b.films.map(f => [f.id, f.n]), [['a', 2], ['b', 1]]); // 只列还有待映场次的影片，按下一场先后；已放完的 c 与活动不列
assert.equal(b.films[1].next.h, 5);
assert.equal(b.filmN, 2); assert.equal(b.upN, 4); assert.equal(b.pastN, 3);                        // 待映含活动场次
assert.deepStrictEqual(b.days.map(d => [d.key, d.n]), [['11/26', 3], ['11/27', 1]]);
assert.deepStrictEqual(b.up.map(g => [g.key, g.shows.map(s => s.id + s.h)]), [['11/26', ['a3', 'b5', 'e8']], ['11/27', ['a30']]]); // 同一天按时间先后
assert(!('past' in b), 'screened shows are never listed');
assert.equal(b.film, ''); assert.equal(b.day, ''); assert.equal(b.upShown, 4);
// 只看一部影片：待映与已放映都按影片筛，日期条只剩这部影片的日期
b = B.board(shows, o({ film: 'b' }));
assert.equal(b.film, 'b'); assert.deepStrictEqual(b.days.map(d => d.key), ['11/26']);
assert.deepStrictEqual(b.up.map(g => g.shows.map(s => s.h)), [[5]]);
assert.equal(b.filmN, 2); assert.equal(b.upN, 4);                                                    // 总数不受筛选影响
// 选一天
b = B.board(shows, o({ day: '11/27' }));
assert.equal(b.day, '11/27'); assert.deepStrictEqual(b.up.map(g => g.key), ['11/27']); assert.equal(b.upShown, 1);
// 默认规则：待映超过 allMax 场时只看最近一天；用户选过「全部日期」（''）则看全部；所选日期 / 影片不存在时回到默认
assert.equal(B.board(shows, o({}, 3)).day, '11/26');
assert.equal(B.board(shows, o({ day: '' }, 3)).day, '');
assert.equal(B.board(shows, o({ day: '11/20' }, 3)).day, '11/26');
assert.equal(B.board(shows, o({ day: '11/20' })).day, '');
assert.equal(B.board(shows, o({ film: 'zz' })).film, '');
assert.equal(B.board(shows, o({ film: 'c' })).film, '');                                            // 已放完的影片不能再筛
assert.equal(B.board(shows, o({ film: 'e' })).film, '');                                            // 活动不作为影片筛选
assert.equal(B.board(shows, o({ film: 'a' }, 1)).day, '');                                           // 只看一部影片时默认看全部日期
// 空数据
b = B.board([], o({}));
assert.deepStrictEqual([b.films.length, b.days.length, b.up.length, b.upN, b.pastN], [0, 0, 0, 0, 0]);

// 真实片库：每家影院的面板场次数与专题场次一致，分组顺序正确
const data = require('./full-data.js'), TZ = require('../shared/tz.js');
const F = {}; data.films.forEach(f => { F[f.id] = f; });
const VN = {}; data.venues.forEach(v => { VN[v.id] = v; });
const PG = {}; data.programmes.forEach(p => { PG[p.id] = p; });
const ms = s => TZ.showMs(s, VN, PG), now = Date.UTC(2026, 10, 26, 4);
let venues = 0;
data.programmes.forEach(p => {
  const ps = data.shows.filter(s => s.p === p.id && F[s.id]);
  [...new Set(ps.map(s => s.v))].forEach(v => {
    const vs = ps.filter(s => s.v === v);
    const r = B.board(vs, { film: id => F[id], start: ms, past: s => ms(s) + (F[s.id].min || 0) * 6e4 < now, pick: { day: '' } });
    assert.equal(r.upN + r.pastN, vs.length, p.id + '/' + v);
    assert.equal(r.up.reduce((n, g) => n + g.shows.length, 0), r.upN);
    const upT = r.up.flatMap(g => g.shows).map(ms); assert(upT.every((t, i) => !i || t >= upT[i - 1]), 'upcoming sorted ' + p.id + '/' + v);
    assert(r.films.every(f => f.n > 0 && vs.some(s => s.id === f.id && ms(s) + (F[s.id].min || 0) * 6e4 >= now)), 'only films still to screen ' + p.id + '/' + v);
    assert.equal(new Set(r.films.map(f => f.id)).size, r.filmN);
    venues++;
  });
});
assert(venues > 10);
console.log('PASS: venue board — upcoming-only films, counts, day groups, film/day filters, default day rule, real catalogue (' + venues + ' venue panels).');
