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

console.log('PASS: festival handbook — audience classification, accessibility inheritance, and verified venue data.');
