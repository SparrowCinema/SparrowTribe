// 对排片规则测试（shared/overlap.js）
const assert = require('assert');
const O = require('../shared/overlap.js');
const H = 3600e3, T0 = Date.UTC(2026, 10, 20, 2); // 任意基准
const S = (k, f, h, len = 2) => ({ k, f, a: T0 + h * H, b: T0 + (h + len) * H });
const o = { key: s => s.k, film: s => s.f, span: s => [s.a, s.b], now: T0 };
const theirs = [S('A1', 'a', 1), S('B1', 'b', 4), S('C1', 'c', 8), S('D1', 'd', 3), S('P', 'p', -5)];
const mine = [S('A1', 'a', 1), S('B2', 'b', 20), S('E1', 'e', 9), S('X', 'x', 3.5), S('Z', 'z', 30)];
const c = O.compare(theirs, mine, o);
assert.deepStrictEqual(c.same.map(s => s.k), ['A1']);                      // 同一场
assert.deepStrictEqual(c.sameFilm.map(x => [x.their.k, x.mine.map(m => m.k)]), [['B1', ['B2']]]); // 同片不同场
assert.deepStrictEqual(c.clash.map(x => [x.their.k, x.mine.k]).sort(), [['C1', 'E1'], ['D1', 'X']]); // 时间冲突
assert.deepStrictEqual(c.free.map(s => s.k), []);
assert.strictEqual(c.past, 1);                                             // 已散场的不参与
assert.strictEqual(c.onlyMe, 3);                                           // E1 X Z
// 2 分钟以内的重叠不算冲突
const c2 = O.compare([S('Q', 'q', 3)], [{ k: 'R', f: 'r', a: T0 + 5 * H - 60e3, b: T0 + 7 * H }], o);
assert.strictEqual(c2.free.length, 1);
// 我没有排片：全部可加入
assert.strictEqual(O.compare(theirs, [], o).free.length, 4);
console.log('check-overlap ok');
