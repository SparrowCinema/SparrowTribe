#!/usr/bin/env node
/* Structured Schema Validation Gate for SparrowCinema catalog & programme files.
   Validates catalog.json (programmes, tz, jury, sectionNotes, venues, geo, halls, access)
   and every data/programmes/*.json (films, links, audience, access, shows, venue/hall refs, slot collisions). */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const VALID_AUDIENCE = new Set(['public', 'industry', 'press', 'free']);
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const IMDB_RE = /^tt\d{6,10}$/;
const DOUBAN_RE = /^\d{5,12}$/;
const DATE_RE = /^(\d{1,2})\/(\d{1,2})$/;
const TIME_RE = /^(\d{1,2}):(\d{2})$/;

function validTZ(tz) {
  if (typeof tz !== 'string' || !tz.trim()) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch (e) {
    return false;
  }
}

function validate(rootDir) {
  const base = rootDir || ROOT;
  const errors = [];
  const warnings = [];
  const err = m => errors.push(m);
  const warn = m => warnings.push(m);

  const catPath = path.join(base, 'data/catalog.json');
  const cat = JSON.parse(fs.readFileSync(catPath, 'utf8'));

  if (!Array.isArray(cat.programmes) || !cat.programmes.length) err('catalog.programmes must be a non-empty array');
  if (!Array.isArray(cat.venues) || !cat.venues.length) err('catalog.venues must be a non-empty array');

  // 1. Validate venues
  const venueMap = new Map();
  (cat.venues || []).forEach((v, idx) => {
    const tag = `venue[${idx}](${v && v.id})`;
    if (!v || !v.id || typeof v.id !== 'string') { err(`${tag}: missing string id`); return; }
    if (venueMap.has(v.id)) err(`${tag}: duplicate venue id "${v.id}"`);
    venueMap.set(v.id, v);
    if (!v.name || typeof v.name !== 'string') err(`${tag}: missing name`);
    if (v.geo !== undefined) {
      if (!Array.isArray(v.geo) || v.geo.length !== 2 || typeof v.geo[0] !== 'number' || typeof v.geo[1] !== 'number' ||
          v.geo[0] < -90 || v.geo[0] > 90 || v.geo[1] < -180 || v.geo[1] > 180) {
        err(`${tag}: invalid geo coordinates ${JSON.stringify(v.geo)}`);
      }
    }
    if (v.tz !== undefined && !validTZ(v.tz)) err(`${tag}: invalid IANA tz "${v.tz}"`);
    if (v.access !== undefined && (!Array.isArray(v.access) || v.access.some(x => typeof x !== 'string' || !x.trim()))) {
      err(`${tag}: access must be an array of non-empty strings`);
    }
    if (v.transit !== undefined && typeof v.transit !== 'string' && (typeof v.transit !== 'object' || Array.isArray(v.transit))) {
      err(`${tag}: transit must be a string or object`);
    }
    const hallIds = new Set();
    (v.halls || []).forEach((h, hi) => {
      if (!h || !h.id) { err(`${tag}.halls[${hi}]: missing id`); return; }
      if (hallIds.has(h.id)) err(`${tag}: duplicate hall id "${h.id}"`);
      hallIds.add(h.id);
      if (h.access !== undefined && (!Array.isArray(h.access) || h.access.some(x => typeof x !== 'string' || !x.trim()))) {
        err(`${tag}.halls[${hi}](${h.id}): access must be an array of non-empty strings`);
      }
    });
  });

  // 2. Validate programmes & load programme files
  const progIds = new Set();
  const loadedProgs = [];
  const allFilmIds = new Set();

  (cat.programmes || []).forEach((p, idx) => {
    const tag = `programme[${idx}](${p && p.id})`;
    if (!p || !p.id || typeof p.id !== 'string') { err(`${tag}: missing id`); return; }
    if (progIds.has(p.id)) err(`${tag}: duplicate programme id "${p.id}"`);
    progIds.add(p.id);
    if (!p.name || typeof p.name !== 'string') err(`${tag}: missing name`);
    if (!p.kind || typeof p.kind !== 'string') err(`${tag}: missing kind`);
    if (!p.file || typeof p.file !== 'string') { err(`${tag}: missing file`); return; }
    if (p.tz !== undefined && !validTZ(p.tz)) err(`${tag}: invalid IANA tz "${p.tz}"`);
    if (p.jury !== undefined) {
      if (!Array.isArray(p.jury)) err(`${tag}: jury must be an array`);
      else p.jury.forEach((j, ji) => {
        if (!j || typeof j.unit !== 'string' || !j.unit.trim() || !Array.isArray(j.members) || !j.members.length) {
          err(`${tag}.jury[${ji}]: requires non-empty unit and members array`);
        }
      });
    }
    if (p.sectionNotes !== undefined) {
      if (!p.sectionNotes || typeof p.sectionNotes !== 'object' || Array.isArray(p.sectionNotes)) {
        err(`${tag}: sectionNotes must be an object`);
      } else {
        Object.entries(p.sectionNotes).forEach(([k, val]) => {
          const okStr = typeof val === 'string' && val.trim();
          const okObj = val && typeof val === 'object' && !Array.isArray(val) && typeof val.intro === 'string' && val.intro.trim();
          if (!okStr && !okObj) err(`${tag}.sectionNotes["${k}"]: must be a non-empty string or { intro } object`);
        });
      }
    }
    const fp = path.join(base, p.file);
    if (!fs.existsSync(fp)) { err(`${tag}: file not found "${p.file}"`); return; }
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    if (data.programme !== p.id) err(`${p.file}: data.programme ("${data.programme}") !== catalog id ("${p.id}")`);
    loadedProgs.push({ p, data });
    (data.films || []).forEach(f => { if (f && f.id) allFilmIds.add(f.id); });
  });

  // 3. Validate films & shows inside each programme file
  let totalFilms = 0;
  let totalShows = 0;

  loadedProgs.forEach(({ p, data }) => {
    const localIds = new Set();
    (data.films || []).forEach((f, fi) => {
      totalFilms++;
      const tag = `${p.id}.films[${fi}](${f && f.id})`;
      if (!f || !f.id || typeof f.id !== 'string') { err(`${tag}: missing film id`); return; }
      if (!SLUG_RE.test(f.id)) err(`${tag}: invalid slug format "${f.id}"`);
      if (localIds.has(f.id)) err(`${tag}: duplicate film id in same programme`);
      localIds.add(f.id);
      if (!f.cn || typeof f.cn !== 'string') err(`${tag}: missing cn title`);
      if (f.y !== undefined && f.y !== null && f.y !== '' && !/^(待揭晓|待定|TBD)$/i.test(String(f.y).trim())) {
        const yNum = typeof f.y === 'number' ? f.y : parseInt(String(f.y), 10);
        if (!Number.isFinite(yNum) || yNum < 1888 || yNum > 2035) err(`${tag}: suspicious year "${f.y}"`);
      }
      if (f.min !== undefined && f.min !== null && (!Number.isFinite(f.min) || f.min < 0 || f.min > 1200)) {
        err(`${tag}: invalid runtime min=${f.min}`);
      }
      if (f.links && typeof f.links === 'object') {
        if (f.links.imdb && !IMDB_RE.test(String(f.links.imdb))) err(`${tag}: invalid links.imdb "${f.links.imdb}"`);
        if (f.links.douban && !DOUBAN_RE.test(String(f.links.douban))) err(`${tag}: invalid links.douban "${f.links.douban}"`);
        if (f.links.lb && (typeof f.links.lb !== 'string' || /\s/.test(f.links.lb))) err(`${tag}: invalid links.lb "${f.links.lb}"`);
      }
      if (f.access !== undefined && (!Array.isArray(f.access) || f.access.some(x => typeof x !== 'string' || !x.trim()))) {
        err(`${tag}: access must be array of non-empty strings`);
      }
      if (f.audience !== undefined && !VALID_AUDIENCE.has(f.audience)) {
        err(`${tag}: invalid audience "${f.audience}"`);
      }
    });

    const slotSeen = new Map();
    (data.shows || []).forEach((r, si) => {
      totalShows++;
      const isArr = Array.isArray(r);
      const dt = isArr ? r[0] : r.d;
      const tm = isArr ? r[1] : r.t;
      const fid = isArr ? r[2] : r.id;
      const vid = isArr ? r[3] : r.v;
      const hid = isArr ? r[4] : r.h;
      const tag = `${p.id}.shows[${si}](${dt} ${tm} ${fid})`;

      const dm = DATE_RE.exec(String(dt || ''));
      if (!dm || +dm[1] < 1 || +dm[1] > 12 || +dm[2] < 1 || +dm[2] > 31) err(`${tag}: invalid date "${dt}"`);
      const tmm = TIME_RE.exec(String(tm || ''));
      if (!tmm || +tmm[1] > 23 || +tmm[2] > 59) err(`${tag}: invalid time "${tm}"`);
      if (!allFilmIds.has(fid)) err(`${tag}: unknown film id "${fid}"`);

      const v = venueMap.get(vid);
      if (!v) err(`${tag}: unknown venue id "${vid}"`);
      else if (hid && !(v.halls || []).some(h => h.id === hid)) err(`${tag}: unknown hall id "${hid}" for venue "${vid}"`);

      if (!isArr) {
        if (r.audience !== undefined && !VALID_AUDIENCE.has(r.audience)) err(`${tag}: invalid show audience "${r.audience}"`);
        if (r.access !== undefined && (!Array.isArray(r.access) || r.access.some(x => typeof x !== 'string'))) err(`${tag}: invalid show access`);
      }

      const slotKey = [dt, tm, vid, hid || ''].join('|');
      if (slotSeen.has(slotKey)) {
        err(`${tag}: exact hall slot collision with film "${slotSeen.get(slotKey)}" at ${vid}/${hid} ${dt} ${tm}`);
      } else {
        slotSeen.set(slotKey, fid);
      }
    });
  });

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: {
      programmes: loadedProgs.length,
      venues: venueMap.size,
      films: totalFilms,
      uniqueFilms: allFilmIds.size,
      shows: totalShows
    }
  };
}

if (require.main === module) {
  const res = validate(ROOT);
  if (!res.ok) {
    console.error(`FAIL: check-schema found ${res.errors.length} error(s):`);
    res.errors.forEach(e => console.error('  -', e));
    process.exit(1);
  }
  console.log(`PASS: schema gate — ${res.stats.programmes} programmes, ${res.stats.venues} venues, ${res.stats.uniqueFilms} unique films, ${res.stats.shows} shows (0 collisions, 0 ref errors).`);
}

module.exports = { validate, validTZ };
