// 影片 / 专题分享海报：两种版式、空场次、缺图都能画完，heightOf 与绘制一致。
const assert = require('node:assert/strict'), SP = require('../shared/share-poster.js');
const texts = [], ctx = new Proxy({}, { get: (t, k) => k === 'measureText' ? (s => ({ width: String(s).length * 28 })) : (typeof k === 'string' && /^[a-z]/.test(k) ? (...a) => { if (k === 'fillText') texts.push(a[0]); } : undefined), set: () => true });
const film = { kind: 'film', title: '海上钢琴师', tag: '4K修复', en: 'The Legend of 1900', meta: ['导演 朱塞佩·托纳多雷', '1998 · 意大利 · 120 分钟', '2026院线新片'], lines: [{ when: '11/11 19:30', where: '杭州 · 星光嘉映 · 4号厅' }], img: null, qrImg: null, qr: [[1, 0], [0, 1]], marks: [null, null] };
const hf = SP.heightOf(film, ctx); assert(hf > 1200); texts.length = 0; SP.draw(ctx, film); assert(texts.includes('海上钢琴师') && texts.includes('近期场次'));
texts.length = 0; SP.draw(ctx, { ...film, lines: [] }); assert(texts.includes('场次待公布'));
const prog = { kind: 'programme', title: '2026金马影展', en: 'Golden Horse', meta: ['2026.11.06 – 11.22 · 台北'], stats: [[156, '部影片'], [375, '场放映'], [17, '个放映日'], [5, '个影厅']], blurb: '简介'.repeat(80), posters: [null, null, null], marks: [] };
assert(SP.heightOf(prog, ctx) > SP.heightOf({ ...prog, posters: [], blurb: '' }, ctx));
texts.length = 0; SP.draw(ctx, prog); assert(texts.includes('156'));
texts.length = 0; SP.draw(ctx, { ...prog, stats: [[0, '部影片'], [0, '场放映']] }); assert(!texts.includes('部影片'), '全为 0 的统计不显示');
console.log('PASS: share poster film/programme layouts');
