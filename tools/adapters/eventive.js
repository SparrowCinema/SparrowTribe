/* Eventive 公开 API 影展适配器（北美及全球大量影展通用，如 Sundance/SIFF/VIFF/NYFF 等）
 * 支持：
 *   1. 本地 Eventive JSON 快照（{ events: [...], films: [...] } 或纯 events 数组）
 *   2. 实时抓取 Eventive 公开 API：
 *      - 直接传 API 地址：https://api.eventive.org/event_buckets/<bucketId>/events
 *      - 传影展官网地址：https://<slug>.eventive.org/schedule（自动提取 eventBucket ID 并拉取 events + films） */
'use strict';

const { isoToLocalMDHM } = require('./jsonld.js');

function stripHtml(s) {
  return String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function pickDetail(details, keys) {
  if (!details || typeof details !== 'object') return '';
  for (const k of keys) {
    if (details[k] !== undefined && details[k] !== null && String(details[k]).trim()) {
      const v = details[k];
      return Array.isArray(v) ? v.join(' / ') : String(v).trim();
    }
  }
  return '';
}

function parse(input, options) {
  options = options || {};
  const tz = options.tz || 'America/New_York';
  const data = typeof input === 'string' ? JSON.parse(input) : input;

  const events = Array.isArray(data) ? data
    : Array.isArray(data && data.events) ? data.events
    : Array.isArray(data && data.data && data.data.events) ? data.data.events
    : [];
  const filmsList = Array.isArray(data && data.films) ? data.films
    : Array.isArray(data && data.data && data.data.films) ? data.data.films
    : [];

  const filmById = new Map();
  filmsList.forEach(f => { if (f && f.id) filmById.set(f.id, f); });

  const records = [];

  events.forEach(ev => {
    if (!ev || ev.is_hidden) return;
    const evFilms = Array.isArray(ev.films) ? ev.films : [];
    const primaryFilm = (evFilms[0] && (typeof evFilms[0] === 'string' ? filmById.get(evFilms[0]) : Object.assign({}, filmById.get(evFilms[0].id) || {}, evFilms[0]))) || null;

    const title = (primaryFilm && (primaryFilm.name || primaryFilm.title)) || ev.name || '';
    if (!title.trim()) return;

    const details = (primaryFilm && primaryFilm.details) || ev.details || {};
    const evTz = (ev.timezone || (ev.venue && ev.venue.timezone) || tz);
    const dt = isoToLocalMDHM(ev.start_time || ev.startTime, evTz);

    let min = parseInt(pickDetail(details, ['runtime', 'duration', 'length']), 10) || (primaryFilm && +primaryFilm.runtime) || 0;
    if (!min && ev.start_time && ev.end_time) {
      const a = new Date(ev.start_time).getTime(), b = new Date(ev.end_time).getTime();
      if (Number.isFinite(a) && Number.isFinite(b) && b > a && (b - a) / 60000 <= 600) {
        min = Math.round((b - a) / 60000);
      }
    }

    const venueObj = ev.venue || {};
    const venueRaw = venueObj.name || ev.location_name || ev.venue_name || (ev.is_virtual ? 'Online / Virtual' : '');
    let venue = venueRaw, hall = ev.auditorium || ev.screen || ev.room || '';
    if (!hall && venueRaw.includes(' - ')) {
      const ps = venueRaw.split(' - ');
      venue = ps[0].trim();
      hall = ps.slice(1).join(' - ').trim();
    }

    const tags = [].concat(ev.tags || [], (primaryFilm && primaryFilm.tags) || []).map(t => typeof t === 'string' ? t : (t && t.name) || '').filter(Boolean);
    const section = tags.find(t => !/^(in-person|virtual|online|featured|q&a|qa)$/i.test(t)) || '';
    const hasQA = tags.some(t => /q&a|qa|talkback|conversation/i.test(t)) || /Q&A|in person/i.test(ev.description || '');
    const yearStr = pickDetail(details, ['year', 'release_year']);
    const yM = yearStr.match(/(19|20)\d{2}/);
    const imdbRaw = pickDetail(details, ['imdb', 'imdb_id', 'imdb_url']) || (primaryFilm && primaryFilm.imdb_id) || '';
    const acc = [];
    if (ev.accessibility && Array.isArray(ev.accessibility)) acc.push(...ev.accessibility);
    if (tags.some(t => /open caption|closed caption|cc|subtitled/i.test(t))) acc.push('字幕/辅助');

    records.push({
      title: title.trim(),
      en: title.trim(),
      orig: pickDetail(details, ['original_title', 'foreign_title']) || title.trim(),
      year: yM ? parseInt(yM[0], 10) : null,
      dir: pickDetail(details, ['director', 'directors', 'directed_by']) || (primaryFilm && primaryFilm.director) || '',
      country: pickDetail(details, ['country', 'countries', 'country_of_origin']),
      min,
      section,
      version: pickDetail(details, ['format', 'screening_format', 'projection']),
      date: dt.date,
      time: dt.time,
      venue: venue.trim(),
      hall: hall.trim(),
      qa: hasQA ? 'Q&A' : '',
      audience: ev.is_industry ? 'industry' : (ev.is_press ? 'press' : 'public'),
      access: acc.join('、'),
      imdb: imdbRaw,
      douban: '',
      lb: '',
      synopsis: stripHtml((primaryFilm && (primaryFilm.short_description || primaryFilm.description)) || ev.short_description || ev.description || '')
    });
  });

  // Also include films without scheduled events yet
  if (!records.length && filmsList.length) {
    filmsList.forEach(f => {
      const details = f.details || {};
      const yM = pickDetail(details, ['year', 'release_year']).match(/(19|20)\d{2}/);
      records.push({
        title: (f.name || '').trim(),
        en: (f.name || '').trim(),
        orig: pickDetail(details, ['original_title']) || (f.name || '').trim(),
        year: yM ? parseInt(yM[0], 10) : null,
        dir: pickDetail(details, ['director', 'directors']),
        country: pickDetail(details, ['country', 'countries']),
        min: parseInt(pickDetail(details, ['runtime']), 10) || (+f.runtime) || 0,
        section: '', version: '', date: '', time: '', venue: '', hall: '', qa: '', audience: 'public', access: '',
        imdb: pickDetail(details, ['imdb', 'imdb_id']), douban: '', lb: '',
        synopsis: stripHtml(f.short_description || f.description || '')
      });
    });
  }

  return records;
}

async function fetchFromUrl(url, fetchText) {
  const mApi = String(url).match(/api\.eventive\.org\/event_buckets\/([a-f0-9]+)/i);
  let bucketId = mApi ? mApi[1] : '';
  if (!bucketId) {
    const html = await fetchText(url);
    const m1 = html.match(/"eventBucket"\s*:\s*"([a-f0-9]{20,})"/i) || html.match(/event_buckets\/([a-f0-9]{20,})/i);
    if (!m1) throw new Error('Could not detect Eventive event_bucket ID from URL: ' + url);
    bucketId = m1[1];
  }
  const [evRaw, flRaw] = await Promise.all([
    fetchText(`https://api.eventive.org/event_buckets/${bucketId}/events`),
    fetchText(`https://api.eventive.org/event_buckets/${bucketId}/films`).catch(() => '{"films":[]}')
  ]);
  const evJson = JSON.parse(evRaw);
  const flJson = JSON.parse(flRaw);
  return JSON.stringify({
    events: Array.isArray(evJson) ? evJson : (evJson.events || []),
    films: Array.isArray(flJson) ? flJson : (flJson.films || [])
  });
}

module.exports = {
  id: 'eventive',
  name: 'Eventive Public Festival API (events + films)',
  parse,
  fetchFromUrl
};
