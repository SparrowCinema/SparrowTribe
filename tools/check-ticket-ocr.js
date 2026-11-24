// 拍照识票 OCR 文本解析单测（shared/ticket-ocr.js）
const assert = require('assert');
const OCR = require('../shared/ticket-ocr.js');

const venues = [
  { id: 'hz-bmh', name: '杭州百美汇影城（嘉里中心店）', short: '百美汇影城' },
  { id: 'tp-xinyi', name: '台北信义威秀影城', short: '信义威秀' },
  { id: 'sh-sfc', name: '上海影城SHO', short: '上海影城' }
];

// 1. 大陆热敏纸质票（含干扰的出票时间戳）
const t1 = OCR.parseTicketText(`
  杭州百美汇影城
  影厅：3号杜比全景声厅
  开场时间 2026-11-28 19:30
  座位 05排08座
  4K修复 原声2D
  出票时间 2026-11-20 10:15:22
  票价 88.00元
`, { venues, defaultYear: 2026 });
assert.strictEqual(t1.date, '2026-11-28');
assert.strictEqual(t1.time, '19:30');
assert.strictEqual(t1.venue, '杭州百美汇影城（嘉里中心店）');
assert.strictEqual(t1.hall, '3号杜比全景声厅');
assert.strictEqual(t1.seat, '5排8座');
assert.strictEqual(t1.format, '4K修复');

// 2. 猫眼 / 淘票票电子票截图（含起止时间段）
const t2 = OCR.parseTicketText(`
  上海影城SHO
  11月29日 14:15-16:20 国语2D
  1号厅 12排14座
  取票码 8821 9044
`, { venues, defaultYear: 2026 });
assert.strictEqual(t2.date, '2026-11-29');
assert.strictEqual(t2.time, '14:15');
assert.strictEqual(t2.venue, '上海影城SHO');
assert.strictEqual(t2.hall, '1号厅');
assert.strictEqual(t2.seat, '12排14座');
assert.strictEqual(t2.format, '国语2D');

// 3. 台湾金马影展票根（繁体 + 英文排号）
const t3 = OCR.parseTicketText(`
  2026 台北金馬影展
  信义威秀影城 第6廳
  2026/11/18 21:00
  F排12號
  35mm
`, { venues, defaultYear: 2026 });
assert.strictEqual(t3.date, '2026-11-18');
assert.strictEqual(t3.time, '21:00');
assert.strictEqual(t3.venue, '台北信义威秀影城');
assert.strictEqual(t3.hall, '第6廳');
assert.strictEqual(t3.seat, 'F排12座');
assert.strictEqual(t3.format, '35mm胶片');

// 4. 国际英文影展票（AM/PM + Row/Seat + Hall）
const t4 = OCR.parseTicketText(`
  Palais des Festivals
  Salle Debussy
  May 19, 2026  7:30 PM
  Row G, Seat 14
  IMAX Laser
`, { venues, defaultYear: 2026 });
assert.strictEqual(t4.date, '2026-05-19');
assert.strictEqual(t4.time, '19:30');
assert.strictEqual(t4.venue, 'Palais des Festivals');
assert.strictEqual(t4.hall, 'Salle Debussy');
assert.strictEqual(t4.seat, 'Row G Seat 14');
assert.strictEqual(t4.format, 'IMAX激光');

// 5. 自动匹配本片排片场次（日期+时间命中后补全精准影院/影厅，同时保留识别出的座位）
const t5 = OCR.parseTicketText(`
  2026-11-28 19:30
  8排6座
`, {
  venues,
  shows: [{ key: '11/28-19:30-hz-bmh-h1', date: '2026-11-28', time: '19:30', venue: '杭州百美汇影城', hall: 'LUXE巨幕厅', format: '4K修复' }]
});
assert.ok(t5.matchedShow);
assert.strictEqual(t5.venue, '杭州百美汇影城');
assert.strictEqual(t5.hall, 'LUXE巨幕厅');
assert.strictEqual(t5.seat, '8排6座');
assert.strictEqual(t5.format, '4K修复');

// 6. 空白 / 无法识别文本安全降级
const t6 = OCR.parseTicketText('   ???   ', { venues });
assert.strictEqual(t6.fields.length, 0);

console.log('PASS: ticket OCR parser (mainland paper, e-ticket, TW Golden Horse, international EN, schedule snap, empty fallback)');
