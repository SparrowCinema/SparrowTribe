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

// 多人接龙编码与解码（含中文昵称、共享键表去重、改名覆盖、上限裁剪）
const rawMembers = [
  { n: '阿明', k: ['A1', 'B1'], w: ['f-shared', 'f-solo'] },
  { n: '小夏', k: ['A1', 'C1'], w: ['f-shared'] },
  { n: '老周', k: ['A1', 'B1', 'D1'], w: ['f-shared', 'f-c'] }
];
const code = O.encodeRelay(rawMembers);
assert.ok(typeof code === 'string' && /^[A-Za-z0-9_-]+$/.test(code), 'URL-safe base64url');
const dec = O.decodeRelay(code);
assert.deepStrictEqual(dec, rawMembers);
assert.strictEqual(O.decodeRelay('!!!bad!!!'), null);

const up1 = O.upsertMember(dec, { n: '小夏', k: ['A1', 'B1'], w: ['f-shared'] });
assert.strictEqual(up1.length, 3, 'updating same nickname replaces in place');
assert.deepStrictEqual(up1[1].k, ['A1', 'B1']);
const up2 = O.upsertMember(dec, { n: '小陈', k: ['A1'], w: [] });
assert.strictEqual(up2.length, 4);
assert.strictEqual(O.removeMember(up2, 1).length, 3);

// 4人凑场分析：
// - A1：4人全选 → allTogether
// - B1：阿明、老周已选，小夏和小陈无冲突 → mostPicked & suggestions（全员可去）
// - F1：阿明、小夏、老周都在想看，4人全无冲突 → suggestions（全员可去）& sharedWants
// - C1：只有小夏选，但与老周 D1 时间重叠 → 3/4可去
const allShows = [
  S('A1', 'fa', 1),
  S('B1', 'fb', 5),
  S('C1', 'fc', 9),
  S('D1', 'fd', 9.5), // clashes with C1
  S('F1', 'f-shared', 14),
  S('OLD', 'fold', -5)
];
const grp = O.analyzeGroup([
  { n: '阿明', k: ['A1', 'B1'], w: ['f-shared'] },
  { n: '小夏', k: ['A1', 'C1'], w: ['f-shared'] },
  { n: '老周', k: ['A1', 'B1', 'D1'], w: ['f-shared'] },
  { n: '小陈', k: ['A1'], w: ['f-shared'] }
], allShows, o);

assert.strictEqual(grp.stats.memberCount, 4);
assert.deepStrictEqual(grp.allTogether.map(x => x.key), ['A1']);
assert.deepStrictEqual(grp.mostPicked.map(x => x.key), ['B1']);
assert.strictEqual(grp.mostPicked[0].canGo, 4);
assert.ok(grp.suggestions.some(x => x.key === 'F1' && x.canGo === 4 && x.interested === 4), 'shared want conflict-free show suggested');
assert.ok(grp.suggestions.some(x => x.key === 'B1' && x.canGo === 4 && x.picked.length === 2), 'majority-picked all-free show suggested');
assert.strictEqual(grp.sharedWants[0].filmId, 'f-shared');
assert.strictEqual(grp.sharedWants[0].count, 4);
assert.strictEqual(grp.sharedWants[0].allFree, true);

console.log('check-overlap ok (1v1 + multi-member relay)');
