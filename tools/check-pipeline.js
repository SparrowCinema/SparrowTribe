/* Regression tests for PR 4:
   - tools/check-schema.js (strict structured catalog & programme schema gate)
   - tools/check-coverage.js (full-catalog coverage audit)
   - tools/import-festival.js (CSV & ICS ingestion, venue reuse, hall collision detection)
   - tools/enrich-metadata.js (missing-metadata queue without mutating repo data)
   - curator submission issue forms & standalone curator workbench HTML
*/
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const Schema = require('./check-schema.js');
const Coverage = require('./check-coverage.js');
const Importer = require('./import-festival.js');
const Enricher = require('./enrich-metadata.js');

const ROOT = path.resolve(__dirname, '..');

// 1. Real catalog passes strict schema gate
const schemaRes = Schema.validate(ROOT);
assert.strictEqual(schemaRes.ok, true, 'Real catalog must pass schema gate: ' + schemaRes.errors.join('; '));
assert(schemaRes.stats.programmes >= 9, 'expected >= 9 programmes');
assert(schemaRes.stats.venues >= 37, 'expected >= 37 venues');
assert(schemaRes.stats.shows >= 700, 'expected >= 700 shows');

// 2. Coverage audit returns consistent numbers
const cov = Coverage.audit(ROOT);
assert(cov.films.total >= 350, 'expected >= 350 unique non-event films');
assert(cov.films.lb.pct > 70, 'expected Letterboxd coverage > 70%');
assert(cov.venues.geo.n >= 36, 'expected >= 36 venues with geo');
assert(cov.venues.access.n >= 2, 'expected >= 2 verified accessible venues');

// 3. CSV ingestion: reuses existing venue ("杭州百美汇影城"), detects hall collision, writes clean 5-tuples
const fixtureCSV = [
  '片名,英文名,年份,导演,片长,单元,版本,日期,时间,影院,影厅,映后,场次类型,无障碍,IMDb',
  '测试新浪潮,Test New Wave,2026,张三,104,主竞赛,4K修复,12/01,14:00,杭州百美汇影城,LUXE厅,导演映后,public,无障碍影厅,tt1234567',
  '冲突场次测试,Conflict Film,2026,李四,95,主竞赛,DCP,12/01,14:00,杭州百美汇影城,LUXE厅,,press,,',
  '海外影院首映,Overseas Film,2026,王五,118,午夜单元,35mm胶片,12/02,20:30,柏林电影宫,1号厅,,public,,'
].join('\n');

const csvRes = Importer.ingest({
  inputText: fixtureCSV,
  format: 'csv',
  id: 'test-fest-2026',
  name: '测试影展',
  en: 'TEST FEST',
  city: '杭州',
  tz: 'Europe/Berlin',
  year: 2026
});
assert.strictEqual(csvRes.programmeJson.programme, 'test-fest-2026');
assert.strictEqual(csvRes.programmeJson.films.length, 3);
assert.strictEqual(csvRes.programmeJson.shows.length, 2, 'colliding slot must be dropped from shows and logged');
assert.strictEqual(csvRes.diagnostics.collisions.length, 1, 'hall collision must be reported');
assert.strictEqual(csvRes.diagnostics.reusedVenues, 1, 'existing catalog venue should be reused');
assert.strictEqual(csvRes.diagnostics.newVenues, 1, 'new overseas venue should be generated');
assert.strictEqual(csvRes.programmeJson.shows[0].length, 5, 'imported show tuples must be 5-element for assign-sids');
assert.strictEqual(csvRes.programmeJson.shows[0][3], 'premiere', '杭州百美汇影城 should resolve to existing id premiere');
assert.strictEqual(csvRes.catalogPatch.programme.tz, 'Europe/Berlin');
assert.strictEqual(csvRes.programmeJson.films[0].links.imdb, 'tt1234567');
assert.deepStrictEqual(csvRes.programmeJson.films[0].access, ['无障碍影厅']);

// 4. ICS ingestion
const fixtureICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'SUMMARY:夜间巡游',
  'DTSTART:20261205T193000',
  'DTEND:20261205T212000',
  'LOCATION:杭州百美汇影城 · LUXE厅',
  'DESCRIPTION:一段测试简介',
  'END:VEVENT',
  'END:VCALENDAR'
].join('\r\n');
const icsRes = Importer.ingest({
  inputText: fixtureICS,
  format: 'ics',
  id: 'ics-fest-2026',
  name: 'ICS影展',
  year: 2026
});
assert.strictEqual(icsRes.programmeJson.films.length, 1);
assert.strictEqual(icsRes.programmeJson.films[0].min, 110);
assert.strictEqual(icsRes.programmeJson.shows.length, 1);
assert.strictEqual(icsRes.programmeJson.shows[0][0], '12/5');
assert.strictEqual(icsRes.programmeJson.shows[0][1], '19:30');

// 5. Enricher queue builds cleanly without fabricating data
const queue = Enricher.buildQueue(ROOT);
assert(Array.isArray(queue) && queue.length > 0, 'queue should list films with missing external links/fields');
assert(queue.every(q => q.id && Array.isArray(q.missing) && q.missing.length > 0 && q.searchUrls.imdb));

// 6. Curator submission templates & workbench HTML validity
const tpl1 = fs.readFileSync(path.join(ROOT, '.github/ISSUE_TEMPLATE/festival-submission.yml'), 'utf8');
const tpl2 = fs.readFileSync(path.join(ROOT, '.github/ISSUE_TEMPLATE/schedule-csv-import.yml'), 'utf8');
assert(tpl1.includes('curator-submission') && tpl2.includes('schedule-import'));
const wbHtml = fs.readFileSync(path.join(ROOT, 'tools/curator-workbench.html'), 'utf8');
const scriptMatch = wbHtml.match(/<script>([\s\S]*?)<\/script>/);
assert(scriptMatch, 'curator-workbench.html must include inline script');
new vm.Script(scriptMatch[1], { filename: 'tools/curator-workbench.html' });

// 7. Verify staging directory output via temp dir
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sparrow-import-'));
try {
  const csvPath = path.join(tmpDir, 'sample.csv');
  fs.writeFileSync(csvPath, fixtureCSV, 'utf8');
  const outDir = path.join(tmpDir, 'out');
  require('child_process').execFileSync(process.execPath, [
    path.join(__dirname, 'import-festival.js'),
    '--input', csvPath, '--id', 'cli-test-2026', '--name', 'CLI测试展', '--out-dir', outDir
  ], { stdio: 'pipe' });
  assert(fs.existsSync(path.join(outDir, 'cli-test-2026.json')));
  assert(fs.existsSync(path.join(outDir, 'cli-test-2026.catalog-patch.json')));
  assert(fs.existsSync(path.join(outDir, 'cli-test-2026.en-scaffold.json')));
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

console.log(`PASS: festival ingestion pipeline — schema gate (${schemaRes.stats.shows} shows), coverage audit (${cov.films.total} films), CSV/ICS importer, metadata queue, issue templates & curator workbench.`);
