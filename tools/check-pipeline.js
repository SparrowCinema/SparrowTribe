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

// 7. Official festival scraper adapters (jsonld, eventive, html auto-table & selector config, goldenhorse)
// 7a. Schema.org JSON-LD (@graph + ScreeningEvent + Movie + ISO duration + IMDb)
const fixtureJsonLdHtml = `<!doctype html><html><head>
<script type="application/ld+json">{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Movie",
      "@id": "#m1",
      "name": "La Chimera",
      "alternateName": "盗墓奇美拉",
      "director": { "@type": "Person", "name": "Alice Rohrwacher" },
      "countryOfOrigin": { "@type": "Country", "name": "Italy" },
      "dateCreated": "2023",
      "duration": "PT2H10M",
      "sameAs": "https://www.imdb.com/title/tt14561712/",
      "description": "An archaeologist returns to Tuscany."
    },
    {
      "@type": "ScreeningEvent",
      "name": "La Chimera — Gala",
      "startDate": "2026-05-18T19:30:00+02:00",
      "videoFormat": "35mm",
      "workPresented": { "@id": "#m1" },
      "location": {
        "@type": "Place",
        "name": "Salle Debussy",
        "containedInPlace": { "@type": "Place", "name": "Palais des Festivals" }
      }
    }
  ]
}</script></head><body></body></html>`;
const jldRes = Importer.ingest({
  inputText: fixtureJsonLdHtml,
  adapter: 'auto',
  id: 'cannes-sample-2026',
  name: '戛纳示例',
  city: '戛纳',
  tz: 'Europe/Paris',
  year: 2026
});
assert.strictEqual(jldRes.adapter, 'jsonld');
assert.strictEqual(jldRes.programmeJson.films.length, 1);
assert.strictEqual(jldRes.programmeJson.films[0].min, 130);
assert.strictEqual(jldRes.programmeJson.films[0].dir, 'Alice Rohrwacher');
assert.strictEqual(jldRes.programmeJson.films[0].links.imdb, 'tt14561712');
assert.strictEqual(jldRes.programmeJson.shows[0][0], '5/18');
assert.strictEqual(jldRes.programmeJson.shows[0][1], '19:30');
assert.strictEqual(jldRes.catalogPatch.newVenues[0].name, 'Palais des Festivals');
assert.strictEqual(jldRes.catalogPatch.newVenues[0].halls[0].name, 'Salle Debussy');

// 7b. Eventive Public API (events + films JSON + timezone conversion + Q&A tag)
const fixtureEventive = JSON.stringify({
  films: [{
    id: 'ef1',
    name: 'Past Lives',
    details: { director: 'Celine Song', year: '2023', country: 'USA', runtime: '106', imdb_id: 'tt13238346', format: 'DCP' },
    short_description: '<p>Two childhood sweethearts reunite.</p>'
  }],
  events: [{
    id: 'ev1',
    name: 'Past Lives',
    start_time: '2026-01-22T02:00:00Z', // 19:00 MST (America/Denver) on Jan 21
    timezone: 'America/Denver',
    venue: { name: 'Eccles Theatre - Main Hall' },
    tags: ['US Dramatic', 'Q&A'],
    films: ['ef1']
  }]
});
const evRes = Importer.ingest({
  inputText: fixtureEventive,
  adapter: 'auto',
  id: 'sundance-sample-2026',
  name: '圣丹斯示例',
  city: '帕克城',
  tz: 'America/Denver',
  year: 2026
});
assert.strictEqual(evRes.adapter, 'eventive');
assert.strictEqual(evRes.programmeJson.films.length, 1);
assert.strictEqual(evRes.programmeJson.films[0].dir, 'Celine Song');
assert.strictEqual(evRes.programmeJson.films[0].min, 106);
assert.strictEqual(evRes.programmeJson.films[0].qaGuest, 'Q&A');
assert.strictEqual(evRes.programmeJson.shows[0][0], '1/21');
assert.strictEqual(evRes.programmeJson.shows[0][1], '19:00');
assert.strictEqual(evRes.catalogPatch.newVenues[0].name, 'Eccles Theatre');
assert.strictEqual(evRes.catalogPatch.newVenues[0].halls[0].name, 'Main Hall');

// 7c. Generic HTML table (auto) + selector config JSON (--config)
const fixtureHtmlTable = `<html><body><table>
  <thead><tr><th>片名</th><th>导演</th><th>片长</th><th>日期</th><th>时间</th><th>影院</th><th>影厅</th></tr></thead>
  <tbody><tr><td>冬日旅行</td><td>陈明</td><td>98分</td><td>12/03</td><td>18:30</td><td>杭州百美汇影城</td><td>LUXE厅</td></tr></tbody>
</table></body></html>`;
const htmlTblRes = Importer.ingest({
  inputText: fixtureHtmlTable,
  format: 'html',
  id: 'html-tbl-2026',
  name: 'HTML表格示例',
  year: 2026
});
assert.strictEqual(htmlTblRes.adapter, 'html');
assert.strictEqual(htmlTblRes.programmeJson.films.length, 1);
assert.strictEqual(htmlTblRes.programmeJson.shows[0][3], 'premiere');

const sampleCfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/adapters/configs/sample-festival.json'), 'utf8'));
const fixtureHtmlCards = `<html><body><ul>
  <li class="screening-card">
    <h3 class="film-title">海边灯塔</h3>
    <span class="film-en">The Coastal Lighthouse</span>
    <span class="film-director">导演：林静</span>
    <span class="film-meta">2026 · 112 min</span>
    <span class="film-section">亚洲视野</span>
    <span class="film-format">4K修复</span>
    <time data-date="2026-12-08" class="show-time">20:15</time>
    <span class="show-venue">海滨电影院</span>
    <span class="show-hall">2号厅</span>
    <span class="show-qa">导演映后</span>
    <p class="film-synopsis">一段关于潮汐的故事。</p>
  </li>
</ul></body></html>`;
const htmlCfgRes = Importer.ingest({
  inputText: fixtureHtmlCards,
  adapter: 'html',
  config: sampleCfg,
  id: 'html-cfg-2026',
  name: 'HTML配置示例',
  year: 2026
});
assert.strictEqual(htmlCfgRes.programmeJson.films.length, 1);
assert.strictEqual(htmlCfgRes.programmeJson.films[0].dir, '林静');
assert.strictEqual(htmlCfgRes.programmeJson.films[0].min, 112);
assert.strictEqual(htmlCfgRes.programmeJson.films[0].version, '4K修复');
assert.strictEqual(htmlCfgRes.programmeJson.shows[0][0], '12/8');
assert.strictEqual(htmlCfgRes.programmeJson.shows[0][1], '20:15');

// 7d. Golden Horse (goldenhorse.org.tw) dedicated adapter — Taipei venue reuse & Q&A ★
const fixtureGhHtml = `<html><body>
  <div class="gh-film">
    <h3 class="title-zh">大濛</h3>
    <span class="title-en">A Foggy Tale</span>
    <span class="section">金馬獎入圍</span>
    <span class="director">導演：陳玉勳</span>
    <span class="meta">2026 · 124 min</span>
    <ul>
      <li class="show-item">11/06 (四) 19:00 ★ <span class="venue">信義威秀10廳</span></li>
      <li class="show-item">11/08 (六) 14:30 <span class="venue">MUVIE TITAN</span></li>
    </ul>
  </div>
</body></html>`;
const ghRes = Importer.ingest({
  inputText: fixtureGhHtml,
  adapter: 'goldenhorse',
  id: 'gh-sample-2026',
  name: '金马测试',
  year: 2026
});
assert.strictEqual(ghRes.adapter, 'goldenhorse');
assert.strictEqual(ghRes.catalogPatch.programme.tz, 'Asia/Taipei', 'Golden Horse defaults to Asia/Taipei');
assert.strictEqual(ghRes.catalogPatch.programme.city, '台北', 'Golden Horse defaults to 台北');
assert.strictEqual(ghRes.programmeJson.shows.length, 2);
assert.strictEqual(ghRes.programmeJson.shows[0][3], 'tp-vieshow-xinyi', '信義威秀10廳 reuses catalog tp-vieshow-xinyi');
assert.strictEqual(ghRes.programmeJson.shows[1][3], 'tp-muvie-titan', 'MUVIE TITAN reuses catalog tp-muvie-titan');
assert.ok(ghRes.programmeJson.films[0].qaGuest, '★ marker detected as Q&A');

// 7e. PYIFF (pyiffestival.com) official API JSON adapter
const fixturePyiff = JSON.stringify({
  cinema: { activityCinemaName: '平遥电影宫' },
  films: [{
    activityFilmCategoryName: '藏龙',
    activityFilmName: '尾款',
    activityFilmNameEN: 'FINAL PAYMENT',
    basicInformation: '导演：牛牛',
    mainInformation: '中国／2025／86分钟／中文（普通话）',
    description: '<p>一场实力悬殊的较量中，迟到的善良酿造了最终的遗憾。</p>',
    activityFilmPlans: [{
      activityCinemaName: '平遥电影宫',
      activityCinemaHall: '小城之春厅',
      startTime: '2026-09-26 11:00:00',
      endTime: '2026-09-26 12:51:00'
    }]
  }]
});
const pyiffRes = Importer.ingest({
  inputText: fixturePyiff,
  adapter: 'auto',
  id: 'pyiff-sample-2026',
  name: '平遥测试',
  city: '平遥',
  tz: 'Asia/Shanghai',
  year: 2026
});
assert.strictEqual(pyiffRes.adapter, 'pyiff');
assert.strictEqual(pyiffRes.programmeJson.films.length, 1);
assert.strictEqual(pyiffRes.programmeJson.films[0].dir, '牛牛');
assert.strictEqual(pyiffRes.programmeJson.films[0].min, 86);
assert.strictEqual(pyiffRes.programmeJson.shows.length, 1);
assert.strictEqual(pyiffRes.programmeJson.shows[0][0], '9/26');
assert.strictEqual(pyiffRes.programmeJson.shows[0][1], '11:00');

// 8. Verify staging directory output via temp dir (CSV + adapter CLI)
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

  const ghPath = path.join(tmpDir, 'gh.html');
  fs.writeFileSync(ghPath, fixtureGhHtml, 'utf8');
  const outDir2 = path.join(tmpDir, 'out-gh');
  require('child_process').execFileSync(process.execPath, [
    path.join(__dirname, 'import-festival.js'),
    '--input', ghPath, '--adapter', 'goldenhorse', '--id', 'cli-gh-2026', '--name', '金马CLI测试', '--out-dir', outDir2
  ], { stdio: 'pipe' });
  assert(fs.existsSync(path.join(outDir2, 'cli-gh-2026.json')));
  const listOut = require('child_process').execFileSync(process.execPath, [
    path.join(__dirname, 'import-festival.js'), '--list-adapters'
  ], { encoding: 'utf8' });
  assert(listOut.includes('jsonld') && listOut.includes('eventive') && listOut.includes('html') && listOut.includes('goldenhorse') && listOut.includes('pyiff'));
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

console.log(`PASS: festival ingestion pipeline — schema gate (${schemaRes.stats.shows} shows), coverage audit (${cov.films.total} films), CSV/ICS importer, 5 official adapters (jsonld/eventive/html/goldenhorse/pyiff), metadata queue, issue templates & curator workbench.`);
