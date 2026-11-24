#!/usr/bin/env node
/* Semi-Automated Festival Schedule Ingestion CLI
   Ingests official festival schedule CSV, TSV, ICS (iCalendar), or JSON and generates:
     1. Standardized data/programmes/<id>.json (5-tuple shows ready for assign-sids.js)
     2. Venue & programme patch snippet for data/catalog.json
     3. Bilingual scaffold for data/i18n/en.json
     4. Diagnostics report (hall collisions, missing runtimes/directors/venue geo)

   Usage:
     node tools/import-festival.js --input schedule.csv --id sample-fest-2026 --name "示例影展" \
       [--en "SAMPLE FEST"] [--city "上海"] [--tz "Asia/Shanghai"] [--year 2026] [--kind "影展专题"] \
       [--dry-run] [--write] [--out-dir /tmp/out]
*/
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Eco = require('../shared/ecosystem.js');
const Adapters = require('./adapters/index.js');

const ROOT = path.resolve(__dirname, '..');

function slugify(str, fallback) {
  const ascii = String(str || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  if (ascii && /^[a-z0-9]/.test(ascii)) return ascii;
  // Deterministic hash slug for pure non-ASCII titles
  let h = 2166136261;
  const s = String(str || fallback || 'item');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (fallback || 'item') + '-' + (h >>> 0).toString(36);
}

function normKey(s) {
  return String(s || '').toLowerCase().replace(/[\s:：·・\-—,.，。!！?？'’"“”()（）《》\[\]]/g, '');
}

function parseDelimited(text, sep) {
  if (sep === '\t') {
    const clean = String(text || '').replace(/^\uFEFF/, '');
    return clean.split(/\r?\n/).filter(l => l.trim()).map(l => l.split('\t').map(c => c.trim()));
  }
  return Eco.parseCSV(text);
}

function parseICS(text) {
  const unfolded = String(text || '').replace(/\r?\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);
  const events = [];
  let cur = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') { if (cur) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).split(';')[0].toUpperCase();
    const val = line.slice(idx + 1).replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').trim();
    cur[key] = val;
  }
  return events.map(ev => {
    const dt = String(ev.DTSTART || '');
    const m = dt.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
    const date = m ? `${+m[2]}/${+m[3]}` : '';
    const time = m && m[4] ? `${m[4]}:${m[5]}` : '';
    let min = 0;
    const dtEnd = String(ev.DTEND || '');
    const me = dtEnd.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
    if (m && m[4] && me) {
      const s0 = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
      const s1 = Date.UTC(+me[1], +me[2] - 1, +me[3], +me[4], +me[5]);
      if (s1 > s0 && (s1 - s0) / 60000 <= 600) min = Math.round((s1 - s0) / 60000);
    }
    const loc = String(ev.LOCATION || '').split(/[·・\-\/|]/).map(x => x.trim()).filter(Boolean);
    return {
      title: ev.SUMMARY || '',
      date,
      time,
      venue: loc[0] || '',
      hall: loc[1] || '1号厅',
      min: min || undefined,
      synopsis: ev.DESCRIPTION || ''
    };
  });
}

function parseDateMD(raw) {
  const s = String(raw || '').trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${+m[2]}/${+m[3]}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})$/);
  if (m) return `${+m[1]}/${+m[2]}`;
  m = s.match(/^(\d{1,2})月(\d{1,2})日?/);
  if (m) return `${+m[1]}/${+m[2]}`;
  return '';
}

function parseTimeHM(raw) {
  const m = String(raw || '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return '';
  return String(+m[1]).padStart(2, '0') + ':' + m[2];
}

function parseMin(raw) {
  const m = String(raw || '').match(/(\d{1,4})/);
  return m ? parseInt(m[1], 10) : 0;
}

function normalizeRowsFromTable(rows) {
  if (!rows || rows.length < 2) return [];
  const head = rows[0].map(h => String(h || '').trim().toLowerCase());
  const pick = names => {
    for (const n of names) {
      const i = head.indexOf(n.toLowerCase());
      if (i >= 0) return i;
    }
    return -1;
  };
  const iTitle = pick(['片名', '中文片名', 'title', 'cn', 'name', 'film', '影片']);
  const iEn = pick(['英文名', '英文片名', 'en', 'english title', 'english']);
  const iOrig = pick(['原名', 'original title', 'original', 'o']);
  const iYear = pick(['年份', 'year', 'y']);
  const iDir = pick(['导演', 'director', 'directors', 'dir']);
  const iCountry = pick(['国家', '地区', '国家/地区', 'country', 'region', 'c']);
  const iMin = pick(['片长', '时长', 'runtime', 'min', 'duration']);
  const iSec = pick(['单元', 'section', 'strand', 'category']);
  const iVer = pick(['版本', '放映版本', '格式', 'version', 'format', 'edition']);
  const iDate = pick(['日期', '放映日期', 'date', 'd']);
  const iTime = pick(['时间', '开场时间', '开场', 'time', 'start', 't']);
  const iVenue = pick(['影院', '场地', 'venue', 'cinema', 'location']);
  const iHall = pick(['影厅', '厅', 'hall', 'screen', 'auditorium']);
  const iQA = pick(['映后', '映后交流', '嘉宾', 'qa', 'q&a', 'guest']);
  const iAud = pick(['场次类型', '开放对象', 'audience', 'type']);
  const iAcc = pick(['无障碍', 'access', 'accessibility']);
  const iImdb = pick(['imdb', 'imdb id', 'imdb_id']);
  const iDb = pick(['豆瓣', 'douban', 'douban id']);
  const iLb = pick(['letterboxd', 'lb', 'letterboxd uri']);
  const iSyn = pick(['简介', '剧情简介', 'synopsis', 'syn', 'description']);

  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every(c => !String(c || '').trim())) continue;
    const g = i => (i >= 0 && row[i] !== undefined ? String(row[i]).trim() : '');
    out.push({
      title: g(iTitle),
      en: g(iEn),
      orig: g(iOrig),
      year: g(iYear) ? parseInt(g(iYear), 10) : null,
      dir: g(iDir),
      country: g(iCountry),
      min: parseMin(g(iMin)),
      section: g(iSec),
      version: g(iVer),
      date: parseDateMD(g(iDate)),
      time: parseTimeHM(g(iTime)),
      venue: g(iVenue),
      hall: g(iHall),
      qa: g(iQA),
      audience: g(iAud),
      access: g(iAcc),
      imdb: g(iImdb),
      douban: g(iDb),
      lb: g(iLb),
      synopsis: g(iSyn)
    });
  }
  return out;
}

function loadExistingCatalog(rootDir) {
  const base = rootDir || ROOT;
  const cat = JSON.parse(fs.readFileSync(path.join(base, 'data/catalog.json'), 'utf8'));
  const existingFilms = [];
  (cat.programmes || []).forEach(p => {
    const fp = path.join(base, p.file);
    if (!fs.existsSync(fp)) return;
    const d = JSON.parse(fs.readFileSync(fp, 'utf8'));
    (d.films || []).forEach(f => existingFilms.push(f));
  });
  return { cat, existingFilms };
}

function ingest(options) {
  const {
    inputText,
    format, // 'csv' | 'tsv' | 'ics' | 'json' | 'html' | 'jsonld'
    adapter = '', // '' | 'auto' | 'jsonld' | 'eventive' | 'html' | 'goldenhorse'
    config = null,
    url = '',
    id,
    name,
    en = '',
    sub = '',
    city: rawCity = '',
    tz: rawTz = '',
    year = new Date().getFullYear(),
    kind = '影展专题',
    rootDir = ROOT
  } = options;

  if (!id || !/^[a-z0-9][a-z0-9-]{1,63}$/.test(id)) throw new Error('Invalid programme --id (lowercase letters, digits, hyphens)');
  if (!name) throw new Error('Missing programme --name');

  const resolvedAdapterId = adapter
    ? (adapter === 'auto' ? Adapters.detectAdapter({ url, inputText, config }) : adapter)
    : (format === 'html' || format === 'htm' ? (Adapters.detectAdapter({ url, inputText, config }) || 'html')
      : format === 'jsonld' ? 'jsonld'
      : '');
  const adapterMod = resolvedAdapterId ? Adapters.ADAPTERS[resolvedAdapterId] : null;
  const tz = rawTz || (adapterMod && adapterMod.defaultTz) || 'Asia/Shanghai';
  const city = rawCity || (adapterMod && adapterMod.defaultCity) || '';

  let records = [];
  if (resolvedAdapterId) {
    const out = Adapters.parseWithAdapter(resolvedAdapterId, inputText, {
      tz, url, config, normalizeRowsFromTable
    });
    records = out.records;
  } else if (format === 'json') {
    const raw = JSON.parse(inputText);
    records = Array.isArray(raw) ? raw : (raw.rows || raw.screenings || []);
    records = records.map(r => ({
      title: r.title || r.cn || r.name || '',
      en: r.en || '',
      orig: r.orig || r.o || '',
      year: r.year || r.y || null,
      dir: r.dir || r.director || '',
      country: r.country || r.c || '',
      min: parseMin(r.min || r.runtime || 0),
      section: r.section || '',
      version: r.version || '',
      date: parseDateMD(r.date || r.d || ''),
      time: parseTimeHM(r.time || r.t || ''),
      venue: r.venue || r.v || '',
      hall: r.hall || r.h || '',
      qa: r.qa || '',
      audience: r.audience || '',
      access: r.access || '',
      imdb: r.imdb || '',
      douban: r.douban || '',
      lb: r.lb || '',
      synopsis: r.synopsis || r.syn || ''
    }));
  } else if (format === 'ics') {
    records = parseICS(inputText);
  } else {
    records = normalizeRowsFromTable(parseDelimited(inputText, format === 'tsv' ? '\t' : ','));
  }

  const { cat, existingFilms } = loadExistingCatalog(rootDir);
  const existingVenueByKey = new Map();
  (cat.venues || []).forEach(v => {
    [v.id, v.name, v.short, v.brand].filter(Boolean).forEach(k => existingVenueByKey.set(normKey(k), v));
  });

  const existingFilmByKey = new Map();
  existingFilms.forEach(f => {
    if (f.links && f.links.imdb) existingFilmByKey.set('imdb:' + f.links.imdb.toLowerCase(), f);
    if (f.links && f.links.douban) existingFilmByKey.set('db:' + f.links.douban, f);
    if (f.links && f.links.lb) existingFilmByKey.set('lb:' + f.links.lb.toLowerCase(), f);
    [f.cn, f.en, f.o].filter(Boolean).forEach(t => existingFilmByKey.set('t:' + normKey(t) + '|' + (f.y || ''), f));
  });

  const filmsMap = new Map();
  const newVenuesMap = new Map();
  const shows = [];
  const enScaffold = {};
  const diagnostics = { reusedFilms: 0, newFilms: 0, reusedVenues: 0, newVenues: 0, collisions: [], missingFields: [] };
  const slotSeen = new Map();

  records.forEach((rec, idx) => {
    if (!rec.title) {
      diagnostics.missingFields.push({ row: idx + 2, reason: 'missing title' });
      return;
    }

    // Match or synthesize canonical film id
    const imdbM = String(rec.imdb || '').match(/tt\d{6,10}/i);
    const imdb = imdbM ? imdbM[0].toLowerCase() : '';
    const dbM = String(rec.douban || '').match(/\d{5,12}/);
    const douban = dbM ? dbM[0] : '';
    const lbM = String(rec.lb || '').match(/letterboxd\.com\/film\/([^/?#]+)/i);
    const lb = lbM ? lbM[1].toLowerCase() : (rec.lb && !/\s/.test(rec.lb) ? rec.lb.toLowerCase() : '');

    let matched = (imdb && existingFilmByKey.get('imdb:' + imdb)) ||
                  (douban && existingFilmByKey.get('db:' + douban)) ||
                  (lb && existingFilmByKey.get('lb:' + lb)) ||
                  existingFilmByKey.get('t:' + normKey(rec.title) + '|' + (rec.year || '')) ||
                  (rec.en && existingFilmByKey.get('t:' + normKey(rec.en) + '|' + (rec.year || ''))) || null;

    const filmId = matched ? matched.id : slugify(rec.en || rec.orig || rec.title, 'film');

    if (!filmsMap.has(filmId)) {
      if (matched) diagnostics.reusedFilms++;
      else diagnostics.newFilms++;

      const filmObj = {
        id: filmId,
        cn: rec.title,
        o: rec.orig || rec.en || rec.title,
        en: rec.en || rec.orig || '',
        y: Number.isFinite(rec.year) ? rec.year : null,
        c: rec.country || '',
        min: rec.min || 0,
        reg: 'world',
        dir: rec.dir || '',
        section: rec.section || '',
        version: rec.version || '',
        syn: rec.synopsis || '',
        r: [null, null, null, null, null],
        writers: [],
        cast: [],
        genre: [],
        language: '',
        highlights: [],
        honors: [],
        warnings: [],
        gifts: []
      };
      if (imdb || douban || lb) {
        filmObj.links = {};
        if (imdb) filmObj.links.imdb = imdb;
        if (douban) filmObj.links.douban = douban;
        if (lb) filmObj.links.lb = lb;
      }
      if (rec.qa) filmObj.qaGuest = rec.qa;
      if (rec.access) filmObj.access = rec.access.split(/[、,，/|+]/).map(s => s.trim()).filter(Boolean);
      if (['public', 'industry', 'press', 'free'].includes(String(rec.audience || '').toLowerCase())) {
        filmObj.audience = String(rec.audience).toLowerCase();
      }
      filmsMap.set(filmId, filmObj);
      enScaffold[filmId] = { title: rec.en || rec.orig || rec.title, dir: rec.dir || '', c: rec.country || '' };

      const miss = [];
      if (!filmObj.dir) miss.push('dir');
      if (!filmObj.min) miss.push('min');
      if (!filmObj.y) miss.push('y');
      if (!filmObj.syn) miss.push('syn');
      if (miss.length) diagnostics.missingFields.push({ filmId, title: rec.title, missing: miss });
    }

    // Match or synthesize venue & hall if screening time is provided
    if (rec.date && rec.time) {
      const vName = rec.venue || `${name}放映点`;
      const exV = existingVenueByKey.get(normKey(vName));
      let venueObj = exV;
      if (!venueObj) {
        const vId = slugify(vName, 'venue');
        if (!newVenuesMap.has(vId)) {
          newVenuesMap.set(vId, {
            id: vId,
            short: vName.slice(0, 12),
            name: vName,
            city: city || '',
            tz: tz !== 'Asia/Shanghai' ? tz : undefined,
            halls: []
          });
          diagnostics.newVenues++;
        }
        venueObj = newVenuesMap.get(vId);
      } else if (!exV._counted) {
        exV._counted = true;
        diagnostics.reusedVenues++;
      }

      const hName = rec.hall || '1号厅';
      let hallObj = (venueObj.halls || []).find(h => normKey(h.id) === normKey(hName) || normKey(h.name) === normKey(hName) || normKey(h.short) === normKey(hName));
      if (!hallObj) {
        const hId = slugify(hName, 'hall');
        hallObj = { id: hId, short: hName, name: hName };
        if (!venueObj.halls) venueObj.halls = [];
        // Only mutate new venues; for existing venues record suggested hall addition
        if (newVenuesMap.has(venueObj.id)) venueObj.halls.push(hallObj);
        else diagnostics.missingFields.push({ venueId: venueObj.id, missingHall: hName });
      }

      const slotKey = [rec.date, rec.time, venueObj.id, hallObj.id].join('|');
      if (slotSeen.has(slotKey)) {
        diagnostics.collisions.push({ slot: slotKey, filmA: slotSeen.get(slotKey), filmB: filmId });
      } else {
        slotSeen.set(slotKey, filmId);
        shows.push([rec.date, rec.time, filmId, venueObj.id, hallObj.id]);
      }
    }
  });

  const programmeJson = {
    programme: id,
    year: Number(year),
    films: Array.from(filmsMap.values()),
    shows
  };

  const catalogPatch = {
    programme: Object.assign({
      id,
      name,
      sub: sub || '',
      en: en || id.toUpperCase().replace(/-/g, ' '),
      kind,
      city: city || '',
      file: `data/programmes/${id}.json`
    }, tz && tz !== 'Asia/Shanghai' ? { tz } : {}),
    newVenues: Array.from(newVenuesMap.values()).map(v => {
      const clean = Object.assign({}, v);
      if (clean.tz === undefined) delete clean.tz;
      return clean;
    })
  };

  return { programmeJson, catalogPatch, enScaffold, diagnostics, adapter: resolvedAdapterId || format || 'csv' };
}

async function ingestUrl(options) {
  const { url, adapter = 'auto', fetchFn } = options || {};
  if (!url) throw new Error('Missing --url');
  const fetched = await Adapters.fetchAdapterInput(adapter, url, fetchFn);
  return ingest(Object.assign({}, options, {
    inputText: fetched.text,
    adapter: fetched.adapter,
    url
  }));
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--write') args.write = true;
    else if (a === '--json') args.json = true;
    else if (a === '--list-adapters') args.listAdapters = true;
    else if (a.startsWith('--') && i + 1 < argv.length) {
      args[a.slice(2)] = argv[++i];
    }
  }
  return args;
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  if (args.listAdapters) {
    console.log('Available official festival adapters:');
    Object.values(Adapters.ADAPTERS).forEach(a => console.log(`  - ${a.id.padEnd(12)} ${a.name}`));
    process.exit(0);
  }
  if (args.help || (!args.input && !args.url) || !args.id || !args.name) {
    console.log(`Usage: node tools/import-festival.js (--input <file> | --url <https://...>) --id <prog-id> --name "<中文名>" [options]
Options:
  --adapter <name>   Official scraper adapter: auto | jsonld | eventive | html | goldenhorse
  --config <file>    Selector config JSON for --adapter html (see tools/adapters/configs/)
  --list-adapters    List built-in official schedule adapters
  --en "<EN>"        English title
  --city "<城市>"     City name
  --tz "<IANA TZ>"   Timezone (default Asia/Shanghai, or adapter default)
  --year 2026        Festival year
  --kind "影展专题"   Programme kind
  --out-dir <dir>    Write generated artifacts into a staging directory
  --dry-run          Preview parsed summary without writing repo files (default)
  --write            Write data/programmes/<id>.json (and run assign-sids if in catalog)
  --json             Output full JSON summary`);
    process.exit(args.help ? 0 : 1);
  }

  (async () => {
    const config = args.config ? JSON.parse(fs.readFileSync(path.resolve(args.config), 'utf8')) : null;
    const baseOpts = {
      id: args.id,
      name: args.name,
      en: args.en || '',
      city: args.city || '',
      tz: args.tz || '',
      year: args.year ? Number(args.year) : new Date().getFullYear(),
      kind: args.kind || '影展专题',
      adapter: args.adapter || (args.url ? 'auto' : ''),
      config
    };

    let res;
    if (args.url) {
      res = await ingestUrl(Object.assign({}, baseOpts, { url: args.url }));
    } else {
      const inputPath = path.resolve(args.input);
      const inputText = fs.readFileSync(inputPath, 'utf8');
      const ext = path.extname(inputPath).toLowerCase().slice(1);
      const format = ['tsv', 'ics', 'json', 'html', 'htm', 'jsonld'].includes(ext) ? ext : 'csv';
      res = ingest(Object.assign({}, baseOpts, { inputText, format }));
    }

    if (args['out-dir']) {
      const dir = path.resolve(args['out-dir']);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${args.id}.json`), JSON.stringify(res.programmeJson, null, 2) + '\n', 'utf8');
      fs.writeFileSync(path.join(dir, `${args.id}.catalog-patch.json`), JSON.stringify(res.catalogPatch, null, 2) + '\n', 'utf8');
      fs.writeFileSync(path.join(dir, `${args.id}.en-scaffold.json`), JSON.stringify(res.enScaffold, null, 2) + '\n', 'utf8');
    } else if (args.write && !args.dryRun) {
      const outPath = path.join(ROOT, 'data/programmes', `${args.id}.json`);
      fs.writeFileSync(outPath, JSON.stringify(res.programmeJson, null, 2) + '\n', 'utf8');
      console.log('Wrote:', outPath);
      try {
        execFileSync(process.execPath, [path.join(__dirname, 'assign-sids.js')], { stdio: 'inherit' });
      } catch (e) {
        console.warn('Note: add programme entry to data/catalog.json before running assign-sids.js');
      }
    }

    if (args.json) {
      console.log(JSON.stringify(res, null, 2));
    } else {
      console.log(`Ingested [${args.id}] "${args.name}" via ${res.adapter}:`);
      console.log(`  Films: ${res.programmeJson.films.length} (reused ${res.diagnostics.reusedFilms}, new ${res.diagnostics.newFilms})`);
      console.log(`  Shows: ${res.programmeJson.shows.length}`);
      console.log(`  Venues: reused ${res.diagnostics.reusedVenues}, new ${res.diagnostics.newVenues}`);
      console.log(`  Hall collisions: ${res.diagnostics.collisions.length}`);
      console.log(`  Missing-field items: ${res.diagnostics.missingFields.length}`);
    }
  })().catch(err => {
    console.error('Import failed:', err && err.message ? err.message : err);
    process.exit(1);
  });
}

module.exports = { ingest, ingestUrl, parseICS, slugify, parseDateMD, parseTimeHM, ADAPTERS: Adapters.ADAPTERS };
