const assert = require('assert');
const fs = require('fs');
const path = require('path');
const L = require('../shared/library.js');
const R = require('../shared/recommend.js');

const root = path.resolve(__dirname, '..');
assert.equal(
  fs.readFileSync(path.join(root, 'shared/recommend.js'), 'utf8'),
  fs.readFileSync(path.join(root, 'miniprogram/utils/recommend.js'), 'utf8'),
  'miniprogram/utils/recommend.js must match shared/recommend.js'
);

// 1. Decade & year matching
assert(L.yearMatches({ y: 2025 }, 'd:2020'));
assert(!L.yearMatches({ y: 2019 }, 'd:2020'));
assert(L.yearMatches({ y: 1986 }, 'd:classic'));
assert(L.yearMatches({ y: 2019 }, 'd:2020,2019'));
assert.equal(L.decadeLabel('d:2020'), '2020年代');
assert.equal(L.decadeLabel('2025'), '2025');

// 2. Decision traits (AND semantics)
const progs = [{ id: 'gh26', name: '2026台北金马影展', en: '2026 Taipei Golden Horse', kind: '影展专题', start: '2026-11-05', end: '2026-11-22', sections: { f1: '焦點', f2: '焦點', f3: '大師' } }];
const films = [
  { id: 'f1', prog: 'gh26', cn: '片一', dir: '导演甲', y: 2026, reg: 'cn', genre: ['剧情'], min: 100, r: [8.4], subtitles: '英文字幕', screeningNotes: { 's1': '映后活动 · 导演 · 字幕机' }, worldPremiere: { kind: 'festival', date: '2026-11-08', festival: '台北金马影展' } },
  { id: 'f2', prog: 'gh26', cn: '片二', dir: '导演甲', y: 2025, reg: 'cn', genre: ['剧情'], min: 90, r: [8.0] },
  { id: 'f3', prog: 'gh26', cn: '片三', dir: '导演乙', y: 2024, reg: 'eu', genre: ['剧情', '悬疑'], min: 110, r: [7.8] },
  { id: 'f4', prog: 'gh26', cn: '片四', dir: '导演丙', y: 1988, reg: 'eu', genre: ['纪录片'], min: 80, r: [8.9] }
];
const shows = [
  { id: 'f1', p: 'gh26', k: 's1', d: '11/08', t: '14:00', st: 100, en: 200 },
  { id: 'f2', p: 'gh26', k: 's2', d: '11/08', t: '14:30', st: 130, en: 220 },
  { id: 'f2', p: 'gh26', k: 's3', d: '11/08', t: '19:00', st: 400, en: 490 },
  { id: 'f3', p: 'gh26', k: 's4', d: '11/08', t: '14:15', st: 115, en: 225 }
];
const overlaps = (a, b) => a.st < b.en - 2 && b.st < a.en - 2;
const ctx = {
  shows, programmes: progs, picked: new Set(['s1']), watched: {}, want: {},
  keyOf: s => s.k, isPast: () => false, overlaps, programme: 'all', city: 'all',
  showProgramme: s => s.p, programmeIds: f => [f.prog]
};

const ts1 = L.traitStatus(films[0], ctx);
assert(ts1.qa && ts1.sub && ts1.last && ts1.wp && !ts1.fit, 'f1 should be qa+sub+last+wp and already picked so not fit');
assert(L.matchesTraits(films[0], 'qa,sub,last,wp', ctx));
assert(!L.matchesTraits(films[0], 'qa,fit', ctx));
assert(L.status(films[0], ctx).lastChance, 'f1 has 1 upcoming show');

const ts2 = L.traitStatus(films[1], ctx);
assert(!ts2.last && ts2.fit, 'f2 has 2 shows and s3 fits without conflict');

const ts3 = L.traitStatus(films[2], ctx);
assert(ts3.last && !ts3.fit, 'f3 single show clashes with picked s1');

// 3. Recommendations
const tasteMap = { f1: { funAvg: 4.5, boreAvg: 1.0 }, f3: { funAvg: 4.3, boreAvg: 1.2 }, f4: { funAvg: 2.0, boreAvg: 4.0 } };
const recs = R.forFilm(films[0], {
  films, shows, programmes: progs, watched: {}, want: {}, picked: new Set(['s1']),
  keyOf: s => s.k, isPast: () => false, showDate: s => s.st, overlaps,
  tasteGet: id => tasteMap[id] || null
}, 4);
assert(recs.length >= 2);
assert.equal(recs[0].film.id, 'f2', 'same director + same section + fits plan should rank first');
assert(recs[0].reasons.includes('同导演'));
assert(recs[0].reasons.includes('同单元'));
assert(recs[0].fitsPlan);
const r3 = recs.find(x => x.film.id === 'f3');
assert(r3 && r3.reasons.includes('趣味相近'), 'taste quadrant neighbor should surface reason');

// Watched films should drop behind unwatched films
const recsWatched = R.forFilm(films[0], {
  films, shows, programmes: progs, watched: { f2: { d: '2026-11-01', r: 8 } }, want: {}, picked: new Set(),
  keyOf: s => s.k, isPast: () => false, showDate: s => s.st, overlaps,
  tasteGet: id => tasteMap[id] || null
}, 4);
assert.equal(recsWatched[0].film.id, 'f3', 'unwatched taste neighbor should rank above already-watched f2');

console.log('PASS: decision filter traits, decades, last-chance detection and Next Up recommendations.');
