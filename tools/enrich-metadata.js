#!/usr/bin/env node
/* Semi-Automated Metadata Enricher & Verification Queue CLI
   Scans catalog films for missing external IDs (IMDb, Letterboxd, Douban) or technical fields.
   - Without TMDB_API_KEY (or with --queue): prints an exact, non-fabricated missing-metadata queue
     with direct verification links for curators.
   - With TMDB_API_KEY and --apply: queries TMDB Search + External IDs API to fill ONLY missing
     links.imdb (never overwrites user-provided synopses, runtimes, credits, or screening editions).

   Usage:
     node tools/enrich-metadata.js [--programme <id>] [--json] [--apply]
*/
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function buildQueue(rootDir, progFilter) {
  const base = rootDir || ROOT;
  const cat = JSON.parse(fs.readFileSync(path.join(base, 'data/catalog.json'), 'utf8'));
  const queue = [];
  const seen = new Set();

  (cat.programmes || []).forEach(p => {
    if (progFilter && p.id !== progFilter) return;
    const fp = path.join(base, p.file);
    if (!fs.existsSync(fp)) return;
    const d = JSON.parse(fs.readFileSync(fp, 'utf8'));
    (d.films || []).forEach(f => {
      if (!f || f.ev || seen.has(f.id)) return;
      seen.add(f.id);
      const links = f.links || {};
      const missing = [];
      if (!links.imdb) missing.push('links.imdb');
      if (!links.lb) missing.push('links.lb');
      if (!links.douban) missing.push('links.douban');
      if (!f.min) missing.push('min');
      if (!f.poster) missing.push('poster');
      if (!missing.length) return;
      const q = encodeURIComponent([f.en || f.o || f.cn, f.y || ''].filter(Boolean).join(' '));
      const qCn = encodeURIComponent(f.cn || '');
      queue.push({
        id: f.id,
        programme: p.id,
        cn: f.cn,
        en: f.en || f.o || '',
        year: f.y || null,
        dir: f.dir || '',
        missing,
        searchUrls: {
          imdb: `https://www.imdb.com/find/?q=${q}`,
          letterboxd: `https://letterboxd.com/search/films/${q}/`,
          douban: `https://search.douban.com/movie/subject_search?search_text=${qCn}`
        }
      });
    });
  });

  return queue;
}

async function applyTMDB(queue, apiKey, rootDir) {
  const base = rootDir || ROOT;
  const cat = JSON.parse(fs.readFileSync(path.join(base, 'data/catalog.json'), 'utf8'));
  const target = queue.filter(x => x.missing.includes('links.imdb'));
  let enriched = 0;

  const byProg = new Map();
  target.forEach(item => {
    if (!byProg.has(item.programme)) byProg.set(item.programme, []);
    byProg.get(item.programme).push(item);
  });

  for (const [pid, items] of byProg.entries()) {
    const p = cat.programmes.find(x => x.id === pid);
    if (!p) continue;
    const fp = path.join(base, p.file);
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    let dirty = false;

    for (const item of items) {
      const query = encodeURIComponent(item.en || item.cn);
      const yParam = item.year ? `&year=${item.year}` : '';
      const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${encodeURIComponent(apiKey)}&query=${query}${yParam}`;
      const sr = await fetch(searchUrl);
      if (!sr.ok) continue;
      const sj = await sr.json();
      const hit = (sj.results || [])[0];
      if (!hit || !hit.id) continue;
      const er = await fetch(`https://api.themoviedb.org/3/movie/${hit.id}/external_ids?api_key=${encodeURIComponent(apiKey)}`);
      if (!er.ok) continue;
      const ej = await er.json();
      if (ej && ej.imdb_id && /^tt\d{6,10}$/.test(ej.imdb_id)) {
        const f = (data.films || []).find(x => x.id === item.id);
        if (f) {
          if (!f.links) f.links = {};
          if (!f.links.imdb) {
            f.links.imdb = ej.imdb_id;
            dirty = true;
            enriched++;
          }
        }
      }
      await new Promise(r => setTimeout(r, 260));
    }
    if (dirty) fs.writeFileSync(fp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }
  return enriched;
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const doApply = argv.includes('--apply');
  const pIdx = argv.indexOf('--programme');
  const progFilter = pIdx >= 0 ? argv[pIdx + 1] : '';

  const queue = buildQueue(ROOT, progFilter);
  const apiKey = process.env.TMDB_API_KEY || '';

  if (doApply && apiKey) {
    applyTMDB(queue, apiKey, ROOT).then(n => {
      console.log(`TMDB enrichment complete: added ${n} verified IMDb IDs.`);
    }).catch(err => {
      console.error('TMDB enrichment failed:', err.message);
      process.exit(1);
    });
  } else {
    if (doApply && !apiKey) {
      console.error('Note: TMDB_API_KEY is not set; outputting missing-metadata verification queue without modifying files.');
    }
    if (asJson) {
      console.log(JSON.stringify({ count: queue.length, queue }, null, 2));
    } else {
      console.log(`Missing-Metadata Queue (${queue.length} films${progFilter ? ' in ' + progFilter : ''}):`);
      queue.slice(0, 30).forEach(x => {
        console.log(`  - [${x.programme}] ${x.id} (${x.cn}${x.year ? ' / ' + x.year : ''}) missing: ${x.missing.join(', ')}`);
      });
      if (queue.length > 30) console.log(`  ... and ${queue.length - 30} more (pass --json for full queue).`);
    }
  }
}

module.exports = { buildQueue };
