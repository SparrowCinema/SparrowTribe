/* Regression tests for PR 3:
   - shared/notes-crypto.js (PBKDF2 + AES-256-CTR + HMAC-SHA256 E2E encryption)
   - shared/psync.js & shared/profile-backup.js notes handling & merge
   - shared/ecosystem.js (Letterboxd CSV export, Letterboxd/Douban CSV import, backupHealth)
   - shared/tickets.js back note & shared/recap.js optional includeNotes
*/
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Crypto = require('../shared/notes-crypto.js');
const S = require('../shared/psync.js');
const B = require('../shared/profile-backup.js');
const Eco = require('../shared/ecosystem.js');
const Recap = require('../shared/recap.js');
const Tickets = require('../shared/tickets.js');
const full = require('./full-data.js');

// 1. E2E crypto round-trip (UTF-8 Chinese + emoji + multiline), wrong passphrase, tampering
const secret = '散场时嘉兴正下小雨，35mm 颗粒美得惊人。\n"See you at the cinema." 🎞️';
const pass = 'sparrow-2026-key';
const enc1 = Crypto.encrypt(secret, pass);
const enc2 = Crypto.encrypt(secret, pass);
assert(Crypto.isCipher(enc1), 'encrypt should produce valid v1 envelope');
assert.notStrictEqual(enc1, enc2, 'random salt/iv must produce unique ciphertexts');
assert(!enc1.includes('嘉兴') && !enc1.includes('cinema'), 'ciphertext must not leak plaintext');
assert.strictEqual(Crypto.decrypt(enc1, pass), secret, 'decrypt round-trip mismatch');
assert.strictEqual(Crypto.decrypt(enc2, pass), secret, 'second decrypt round-trip mismatch');
assert.throws(() => Crypto.decrypt(enc1, 'wrong-pass'), /Authentication|Passphrase|mismatch|wrong|MAC/i);
// Tamper with ciphertext
const parts = enc1.split('.');
parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith('AA') ? 'BB' : 'AA');
assert.throws(() => Crypto.decrypt(parts.join('.'), pass), /Authentication|tamper|wrong|MAC/i);

// 2. psync notes cleaning, merging, and backup restore
const nA = {
  f1: { t: 100, s: 'local plain', enc: enc1, tb: 1 },
  f2: { t: 200, del: 1 }
};
const nB = {
  f1: { t: 150, enc: enc2, rc: 1 },
  f2: { t: 120, s: 'older before del' },
  f3: { t: 300, enc: enc1 }
};
const mergedNotes = S.mergeNotes(nA, nB);
assert.strictEqual(mergedNotes.f1.t, 150);
assert.strictEqual(mergedNotes.f1.enc, enc2);
assert.strictEqual(mergedNotes.f1.rc, 1);
assert.strictEqual(mergedNotes.f2.del, 1);
assert.strictEqual(mergedNotes.f3.enc, enc1);
// Verify backup encode/restore preserves notes and empty clears them
const localProf = S.clean({ v: 1, watched: { f1: { d: '2026-11-01', r: 8, t: 10 } }, notes: { f1: { t: 50, s: 'private diary', tb: 1 } } });
const bpack = B.encode(localProf, 500);
const decoded = B.decode(JSON.parse(JSON.stringify(bpack)));
assert.strictEqual(decoded.notes.f1.s, 'private diary');
assert.strictEqual(decoded.notes.f1.tb, 1);
const emptied = B.empty(localProf, 600);
assert.strictEqual(emptied.notes.f1.del, 1);

// 3. Verify Web and Miniprogram sync never upload plaintext s to cloud
const root = path.resolve(__dirname, '..');
const webSync = fs.readFileSync(path.join(root, 'js/sync.js'), 'utf8');
const mpNotes = fs.readFileSync(path.join(root, 'miniprogram/utils/notes.js'), 'utf8');
assert(webSync.includes('function notesForCloud()') && webSync.includes('profileSnap(true)'), 'web sync must use notesForCloud for cloud push');
assert(mpNotes.includes('function forCloud()'), 'miniprogram notes must strip plaintext s in forCloud');
assert.strictEqual(fs.readFileSync(path.join(root, 'shared/notes-crypto.js'), 'utf8'), fs.readFileSync(path.join(root, 'miniprogram/utils/notes-crypto.js'), 'utf8'));
assert.strictEqual(fs.readFileSync(path.join(root, 'shared/ecosystem.js'), 'utf8'), fs.readFileSync(path.join(root, 'miniprogram/utils/ecosystem.js'), 'utf8'));

// 4. Ecosystem: Letterboxd export (default NO notes) + Letterboxd & Douban CSV import
const progDir = path.join(root, 'data/programmes');
const films = fs.readdirSync(progDir).filter(x => x.endsWith('.json'))
  .flatMap(fn => JSON.parse(fs.readFileSync(path.join(progDir, fn), 'utf8')).films || [])
  .filter(f => !f.ev);
const sampleWithLinks = films.find(f => f.links && f.links.lb && f.links.douban && f.links.imdb);
assert(sampleWithLinks, 'catalog must contain films with lb/douban/imdb links');
const sampleEntry = [{ id: sampleWithLinks.id, f: sampleWithLinks, rec: { d: '2026-11-10', r: 9 } }];
const csvNoNotes = Eco.exportLetterboxdCSV(sampleEntry, { notes: { [sampleWithLinks.id]: { s: 'SECRET NOTE' } } });
assert(!csvNoNotes.includes('SECRET NOTE'), 'Letterboxd export must exclude private notes by default');
assert(csvNoNotes.includes('Rating10') && csvNoNotes.includes(',9,'), '9/10 rating should map to official Letterboxd Rating10 column');
const csvWithNotes = Eco.exportLetterboxdCSV(sampleEntry, { includeNotes: true, notes: { [sampleWithLinks.id]: { s: 'OPTED IN NOTE' } } });
assert(csvWithNotes.includes('OPTED IN NOTE'), 'Letterboxd export should include note when explicitly requested');

// Import back from Letterboxd CSV
const lbRes = Eco.parseImportCSV(csvWithNotes, films);
assert.strictEqual(lbRes.source, 'letterboxd');
assert.strictEqual(lbRes.matched.length, 1);
assert.strictEqual(lbRes.matched[0].film.id, sampleWithLinks.id);
assert.strictEqual(lbRes.matched[0].rating10, 9);
assert.strictEqual(lbRes.matched[0].note, 'OPTED IN NOTE');

// Import from Douban CSV
const dbCsv = '片名,网址,评分,创建时间,短评,状态\n' +
  `"${sampleWithLinks.cn}","https://movie.douban.com/subject/${sampleWithLinks.links.douban}/",4,2026-10-12 20:30:00,"非常有力量",看过\n` +
  `"不存在的测试影片","https://movie.douban.com/subject/999999999/",5,2026-10-15,"很好",想看\n`;
const dbRes = Eco.parseImportCSV(dbCsv, films);
assert.strictEqual(dbRes.source, 'douban');
assert.strictEqual(dbRes.matched.length, 1);
assert.strictEqual(dbRes.matched[0].film.id, sampleWithLinks.id);
assert.strictEqual(dbRes.matched[0].rating10, 8);
assert.strictEqual(dbRes.matched[0].date, '2026-10-12');
assert.strictEqual(dbRes.matched[0].note, '非常有力量');
assert.strictEqual(dbRes.unmatchedCount, 1);

// 5. Backup health states
const h1 = Eco.backupHealth({ syncCode: 'SP-AAAA-BBBB-CCCC-DDDD-EEEE-FFFF', codeSaved: false, watchedCount: 2, notesCount: 0, lastExportAt: 0, lastExportCount: 0 });
assert.strictEqual(h1.codeWarning, true);
assert.strictEqual(h1.level, 'warn');
const h2 = Eco.backupHealth({ syncCode: 'SP-AAAA-BBBB-CCCC-DDDD-EEEE-FFFF', codeSaved: true, watchedCount: 8, notesCount: 2, lastExportAt: 0, lastExportCount: 0 });
assert.strictEqual(h2.codeWarning, false);
assert.strictEqual(h2.backupWarning, true);
const h3 = Eco.backupHealth({ syncCode: 'SP-AAAA-BBBB-CCCC-DDDD-EEEE-FFFF', codeSaved: true, watchedCount: 8, notesCount: 2, lastExportAt: Date.now() - 86400000, lastExportCount: 10 });
assert.strictEqual(h3.level, 'good');

// 6. Recap optional includeNotes increases height only when opted in
const baseRecap = {
  title: 'Test', sub: '2026', kicker: 'K', yearTag: '2026',
  stats: [['1', '部']], fav: null, progs: [], sections: ['list'],
  items: [{ id: 'a', title: '测试影片', en: 'Test', date: '2026-11-01', dstamp: '2026.11.01', venue: '影院', vs: '影院', score: 8, color: '#8e2a22', shape: 0, tilt: 0, top: 'T', prog: 'P', img: null, note: '一句散场笔记' }],
  qr: null, qrImg: null, marks: [], T: x => x, en: false
};
const hNoNote = Recap.heightOf(baseRecap);
const hWithNote = Recap.heightOf(Object.assign({}, baseRecap, { includeNotes: true }));
assert.strictEqual(hWithNote - hNoNote, 34, 'Recap heightOf should add 34px per opted-in note row');

// 7. Tickets back rendering draws optional record.note excerpt without throwing
const drawnTexts = [];
const noopCtx = new Proxy({}, {
  get: (_, prop) => prop === 'measureText' ? (s => ({ width: String(s || '').length * 10 })) :
    prop === 'fillText' ? (s => { drawnTexts.push(String(s)); }) :
    prop === 'createLinearGradient' || prop === 'createRadialGradient' ? (() => ({ addColorStop() {} })) :
    ['save','restore','beginPath','closePath','moveTo','lineTo','arc','arcTo','rect','fillRect','strokeRect','clearRect','fill','stroke','clip','translate','rotate','scale','strokeText','drawImage','quadraticCurveTo','bezierCurveTo','ellipse','setLineDash','setTransform'].includes(prop) ? (() => {}) : ''
});
const sampleTicket = {
  id: 'a', key: 'a|2026-11-01', serial: 'A2B3C4D5E6F7G8H', filmId: 'a', title: '测试影片', en: 'Test Film',
  programme: '2026 测试展映', programmeEn: 'TEST FESTIVAL', date: '2026-11-01', time: '19:30',
  venue: '测试影院', hall: '1号厅', city: '北京', edition: '4K修复',
  look: Tickets.defaults({}), note: '散场后的晚风很温柔'
};
Tickets.draw(noopCtx, sampleTicket, 'back', null, { x: 0, y: 0, w: Tickets.W, h: Tickets.H });
assert(drawnTexts.some(t => t.includes('散场后的晚风很温柔')), 'Ticket back should render opted-in private note excerpt');

console.log('PASS: E2E notes crypto, psync/backup notes, Letterboxd/Douban CSV ecosystem, backup health, ticket back & recap notes.');
