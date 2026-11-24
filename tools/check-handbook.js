const assert = require('assert');
const fs = require('fs');
const path = require('path');
const S = require('../shared/screenings.js');

const root = path.resolve(__dirname, '..');
assert.equal(
  fs.readFileSync(path.join(root, 'shared/screenings.js'), 'utf8'),
  fs.readFileSync(path.join(root, 'miniprogram/utils/screenings.js'), 'utf8'),
  'miniprogram/utils/screenings.js must match shared/screenings.js'
);

// 1. Audience classification
const s1 = { d: '11/10', t: '14:00', v: 'v1', h: 'h1' };
const k1 = S.keyOf(s1);
assert.equal(S.audienceType(s1, { screeningNotes: { [k1]: '产业放映 · 不对外展映 · 不对外售票' } }), 'industry');
assert(S.isRestricted(s1, { screeningNotes: { [k1]: '产业放映 · 不对外展映 · 不对外售票' } }));
assert.equal(S.audienceType(s1, { screeningNotes: { [k1]: '媒体场 · 凭记者证入场' } }), 'press');
assert(S.isRestricted(s1, { screeningNotes: { [k1]: '媒体场 · 凭记者证入场' } }));
assert.equal(S.audienceType(s1, { screeningNotes: { [k1]: '映后活动 · 免费放映' } }), 'free');
assert(!S.isRestricted(s1, { screeningNotes: { [k1]: '映后活动 · 免费放映' } }));
assert.equal(S.audienceType(s1, { screeningNotes: {} }), 'public');
assert.equal(S.audienceType({ ...s1, audience: 'press' }, {}), 'press');
assert.equal(S.audienceLabel('industry', false), '产业场');
assert.equal(S.audienceLabel('industry', true), 'Industry');

// 2. Accessibility inheritance (film + show + hall + venue)
const venue = { id: 'v1', access: ['无障碍影厅'], halls: [{ id: 'h1', access: ['轮椅席', '无障碍影厅'] }] };
const acc = S.accessList(s1, { access: ['口述影像'] }, venue);
assert.deepStrictEqual(acc, ['口述影像', '轮椅席', '无障碍影厅']);
assert(S.hasAccess(s1, {}, venue));
assert(!S.hasAccess(s1, {}, { id: 'v2', halls: [{ id: 'h1' }] }));

// 3. Verified real catalog accessibility (Taipei Golden Horse venues)
const cat = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog.json'), 'utf8'));
const xinyi = cat.venues.find(v => v.id === 'tp-vieshow-xinyi');
const titan = cat.venues.find(v => v.id === 'tp-muvie-titan');
assert(xinyi && Array.isArray(xinyi.access) && xinyi.access.includes('无障碍影厅'));
assert(titan && Array.isArray(titan.access) && titan.access.includes('无障碍影厅'));

// 4. Smoke test web js/films.js libraryContext() & showsOverlap + js/programmes.js venue map projection
const vm = require('vm');
const Lib = require('../shared/library.js');
const Planner = require('../shared/planner.js');
const filmsSrc = fs.readFileSync(path.join(root, 'js/films.js'), 'utf8');
const filmsCtx = vm.createContext({
  window: { SparrowLibrary: Lib },
  document: { querySelector: () => null, addEventListener: () => {} },
  localStorage: { getItem: () => null, setItem: () => {} },
  requestAnimationFrame: () => {},
  SH: [{ id: 'f1', d: '11/10', t: '14:00', v: 'v1', h: 'h1', p: 'p1' }, { id: 'f2', d: '11/10', t: '15:00', v: 'v1', h: 'h1', p: 'p1' }],
  PROGRAMMES: [{ id: 'p1', name: '测试专题', kind: '影展专题' }],
  FILMS: [{ id: 'f1', cn: '甲', prog: 'p1', min: 120, y: 2026, reg: 'cn', r: [8] }],
  F: { f1: { id: 'f1', cn: '甲', prog: 'p1', min: 120 }, f2: { id: 'f2', cn: '乙', prog: 'p1', min: 100 } },
  VN: { v1: { id: 'v1', city: '杭州', name: '影院', short: '影院' } },
  VENUES: [{ id: 'v1', city: '杭州', name: '影院' }],
  REG: { cn: { n: '华语', c: '#8e2a22' } },
  PG: { p1: { id: 'p1', name: '测试专题' } },
  picked: new Set(), watched: {}, want: {},
  keyOf: S.keyOf, isPast: () => false,
  showDate: s => new Date('2026-' + s.d.replace('/', '-') + 'T' + s.t + ':00Z').getTime(),
  durationOf: s => (s.id === 'f1' ? 120 : 100),
  selList: v => v === 'all' ? [] : [v], selHas: () => true, selToggle: (c, v) => v, selLabel: (v, a) => a,
  tr: x => x, esc: String, wantNew: () => false, filmProgsOf: () => [{ p: { id: 'p1' } }],
  progStatus: () => 'live', progRange: () => [0, 0], wk: () => '周二', vShort: v => v.short,
  slateHTML: () => '', editionHTML: () => '', pst: () => '', pimg: () => '', presentersHTML: () => '',
  filterChevron: '', ST: {}, stat: () => {}, GEO_CITY: null, LANG: 'zh', main: { innerHTML: '' }
});
vm.runInContext(filmsSrc, filmsCtx);
const lctx = vm.runInContext('libraryContext()', filmsCtx);
assert.strictEqual(typeof lctx.overlaps, 'function', 'libraryContext().overlaps must be a valid function');
assert.strictEqual(lctx.overlaps(filmsCtx.SH[0], filmsCtx.SH[1]), true, '14:00 (120m) and 15:00 should overlap');
vm.runInContext('films()', filmsCtx);
assert(filmsCtx.main.innerHTML.includes('id="flist-wrap"'), 'films() must render cleanly without ReferenceError');

const progSrc = fs.readFileSync(path.join(root, 'js/programmes.js'), 'utf8');
const progCtx = vm.createContext({
  window: { addEventListener: () => {} },
  document: { addEventListener: () => {}, getElementById: () => null },
  SparrowPlanner: Planner, esc: String, tr: x => x, stripCity: x => x
});
vm.runInContext(progSrc, progCtx);
const cnTile = vm.runInContext('vmTileUrl(14, 13660, 6732, false)', progCtx);
const twTile = vm.runInContext('vmTileUrl(14, 13726, 7031, true)', progCtx);
assert(cnTile.includes('autonavi.com'), 'Mainland venues should use AMap GCJ-02 tiles');
assert(twTile.includes('cartocdn.com'), 'Overseas/TW venues should use CARTO WGS-84 tiles');

console.log('PASS: festival handbook — audience classification, accessibility inheritance, films() smoke test, and warm-paper venue map tiles.');
