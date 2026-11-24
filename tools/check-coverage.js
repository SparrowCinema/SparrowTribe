#!/usr/bin/env node
/* Full-Catalog Coverage Audit CLI
   Reports metadata, bilingual translation, venue geo/transit/access, and handbook coverage.
   Usage: node tools/check-coverage.js [--json] */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function pct(n, total) {
  return total ? Math.round((n / total) * 1000) / 10 : 0;
}

function audit(rootDir) {
  const base = rootDir || ROOT;
  const cat = JSON.parse(fs.readFileSync(path.join(base, 'data/catalog.json'), 'utf8'));
  const en = JSON.parse(fs.readFileSync(path.join(base, 'data/i18n/en.json'), 'utf8'));
  const enFilms = en.films || {};

  const uniqueFilms = new Map();
  const perProgramme = [];

  (cat.programmes || []).forEach(p => {
    const d = JSON.parse(fs.readFileSync(path.join(base, p.file), 'utf8'));
    const films = (d.films || []).filter(f => !f.ev);
    films.forEach(f => { if (!uniqueFilms.has(f.id)) uniqueFilms.set(f.id, f); });
    const count = fn => films.filter(fn).length;
    perProgramme.push({
      id: p.id,
      name: p.name,
      kind: p.kind,
      films: films.length,
      shows: (d.shows || []).length,
      imdb: count(f => f.links && f.links.imdb),
      lb: count(f => f.links && f.links.lb),
      douban: count(f => f.links && f.links.douban),
      wpVerified: count(f => f.worldPremiere && f.worldPremiere.status === 'verified'),
      poster: count(f => !!f.poster),
      enTitle: count(f => !!(enFilms[f.id] && enFilms[f.id].title)),
      hasTz: !!p.tz,
      hasJury: Array.isArray(p.jury) && p.jury.length > 0,
      hasSectionNotes: !!(p.sectionNotes && Object.keys(p.sectionNotes).length > 0)
    });
  });

  const allFilms = Array.from(uniqueFilms.values());
  const fN = allFilms.length;
  const fc = fn => allFilms.filter(fn).length;
  const venues = cat.venues || [];
  const vN = venues.length;
  const vc = fn => venues.filter(fn).length;

  const filmMetrics = {
    total: fN,
    imdb: { n: fc(f => f.links && f.links.imdb), pct: pct(fc(f => f.links && f.links.imdb), fN) },
    lb: { n: fc(f => f.links && f.links.lb), pct: pct(fc(f => f.links && f.links.lb), fN) },
    douban: { n: fc(f => f.links && f.links.douban), pct: pct(fc(f => f.links && f.links.douban), fN) },
    worldPremiereAny: { n: fc(f => !!f.worldPremiere), pct: pct(fc(f => !!f.worldPremiere), fN) },
    worldPremiereVerified: { n: fc(f => f.worldPremiere && f.worldPremiere.status === 'verified'), pct: pct(fc(f => f.worldPremiere && f.worldPremiere.status === 'verified'), fN) },
    poster: { n: fc(f => !!f.poster), pct: pct(fc(f => !!f.poster), fN) },
    synopsis: { n: fc(f => !!(f.syn && String(f.syn).trim())), pct: pct(fc(f => !!(f.syn && String(f.syn).trim())), fN) },
    runtime: { n: fc(f => Number.isFinite(f.min) && f.min > 0), pct: pct(fc(f => Number.isFinite(f.min) && f.min > 0), fN) },
    enLayer: { n: fc(f => !!enFilms[f.id]), pct: pct(fc(f => !!enFilms[f.id]), fN) }
  };

  const venueMetrics = {
    total: vN,
    geo: { n: vc(v => Array.isArray(v.geo) && v.geo.length === 2), pct: pct(vc(v => Array.isArray(v.geo) && v.geo.length === 2), vN) },
    addr: { n: vc(v => !!(v.addr && String(v.addr).trim())), pct: pct(vc(v => !!(v.addr && String(v.addr).trim())), vN) },
    transit: { n: vc(v => !!v.transit), pct: pct(vc(v => !!v.transit), vN) },
    access: { n: vc(v => (Array.isArray(v.access) && v.access.length > 0) || (v.halls || []).some(h => Array.isArray(h.access) && h.access.length > 0)), pct: pct(vc(v => (Array.isArray(v.access) && v.access.length > 0) || (v.halls || []).some(h => Array.isArray(h.access) && h.access.length > 0)), vN) },
    tz: { n: vc(v => !!v.tz), pct: pct(vc(v => !!v.tz), vN) }
  };

  const programmeMetrics = {
    total: perProgramme.length,
    tz: perProgramme.filter(p => p.hasTz).length,
    jury: perProgramme.filter(p => p.hasJury).length,
    sectionNotes: perProgramme.filter(p => p.hasSectionNotes).length
  };

  return { films: filmMetrics, venues: venueMetrics, programmes: programmeMetrics, perProgramme };
}

if (require.main === module) {
  const asJson = process.argv.includes('--json');
  const rep = audit(ROOT);
  if (asJson) {
    console.log(JSON.stringify(rep, null, 2));
  } else {
    const f = rep.films, v = rep.venues, p = rep.programmes;
    console.log('=== SparrowCinema Catalog Coverage Report ===');
    console.log(`Films (${f.total} unique non-event):`);
    console.log(`  Poster: ${f.poster.n}/${f.total} (${f.poster.pct}%)  | Synopsis: ${f.synopsis.n}/${f.total} (${f.synopsis.pct}%)  | Runtime: ${f.runtime.n}/${f.total} (${f.runtime.pct}%)`);
    console.log(`  IMDb:   ${f.imdb.n}/${f.total} (${f.imdb.pct}%)  | Letterboxd: ${f.lb.n}/${f.total} (${f.lb.pct}%)  | Douban: ${f.douban.n}/${f.total} (${f.douban.pct}%)`);
    console.log(`  EN i18n: ${f.enLayer.n}/${f.total} (${f.enLayer.pct}%) | World Premiere Verified: ${f.worldPremiereVerified.n}/${f.total} (${f.worldPremiereVerified.pct}%)`);
    console.log(`\nVenues (${v.total}):`);
    console.log(`  Geo: ${v.geo.n}/${v.total} (${v.geo.pct}%) | Addr: ${v.addr.n}/${v.total} (${v.addr.pct}%) | Access: ${v.access.n}/${v.total} (${v.access.pct}%) | Transit: ${v.transit.n}/${v.total} (${v.transit.pct}%)`);
    console.log(`\nProgrammes (${p.total}):`);
    console.log(`  Explicit tz: ${p.tz}/${p.total} | Jury: ${p.jury}/${p.total} | Section Notes: ${p.sectionNotes}/${p.total}`);
    console.log('\nPer-Programme Breakdown:');
    rep.perProgramme.forEach(x => {
      console.log(`  - ${x.id.padEnd(22)} films:${String(x.films).padStart(3)} shows:${String(x.shows).padStart(3)} imdb:${String(x.imdb).padStart(3)} lb:${String(x.lb).padStart(3)} db:${String(x.douban).padStart(3)} en:${String(x.enTitle).padStart(3)}`);
    });
  }
}

module.exports = { audit };
