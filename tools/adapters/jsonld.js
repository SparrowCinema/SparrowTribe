/* Schema.org JSON-LD 通用影展适配器（Event / ScreeningEvent / Movie）
 * 自动从官网 HTML 提取全部 <script type="application/ld+json">（也支持直接传入 .jsonld/.json 文件），
 * 解析 @graph、嵌套数组、ScreeningEvent / Event、workPresented / workFeatured / Movie、ISO 8601 时长与地点。 */
'use strict';

function pad2(n) { return String(n).padStart(2, '0'); }

function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function parseIsoDuration(dur) {
  if (!dur) return 0;
  if (typeof dur === 'number' && Number.isFinite(dur)) return Math.round(dur);
  const s = String(dur).trim();
  const m = s.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  if (m) {
    const mins = (parseInt(m[1] || 0, 10) * 1440) + (parseInt(m[2] || 0, 10) * 60) + parseInt(m[3] || 0, 10) + Math.round(parseInt(m[4] || 0, 10) / 60);
    if (mins > 0) return mins;
  }
  const n = s.match(/(\d{1,4})/);
  return n ? parseInt(n[1], 10) : 0;
}

function isoToLocalMDHM(iso, tz) {
  if (!iso) return { date: '', time: '', year: null };
  const s = String(iso).trim();
  // If explicit local time without timezone offset (e.g. "2026-05-18T19:30:00"), trust wall-clock directly
  const bare = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2})?$/);
  if (bare) {
    return { date: `${+bare[2]}/${+bare[3]}`, time: `${bare[4]}:${bare[5]}`, year: +bare[1] };
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return { date: '', time: '', year: null };
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz || 'UTC',
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false
    });
    const parts = {};
    fmt.formatToParts(d).forEach(p => { parts[p.type] = p.value; });
    const h = parts.hour === '24' ? '00' : parts.hour;
    return { date: `${+parts.month}/${+parts.day}`, time: `${h}:${parts.minute}`, year: +parts.year };
  } catch (e) {
    return {
      date: `${d.getUTCMonth() + 1}/${d.getUTCDate()}`,
      time: `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`,
      year: d.getUTCFullYear()
    };
  }
}

function hasType(node, wanted) {
  if (!node || !node['@type']) return false;
  const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
  return types.some(t => wanted.includes(String(t).replace(/^https?:\/\/schema\.org\//i, '')));
}

function extractNames(val) {
  if (!val) return '';
  const arr = Array.isArray(val) ? val : [val];
  return arr.map(x => typeof x === 'string' ? x : (x && x.name) || '').filter(Boolean).join(' / ');
}

function extractImdb(node) {
  const urls = [];
  if (node && node.sameAs) urls.push(...(Array.isArray(node.sameAs) ? node.sameAs : [node.sameAs]));
  if (node && node.url) urls.push(node.url);
  for (const u of urls) {
    const m = String(u || '').match(/tt\d{6,10}/i);
    if (m) return m[0].toLowerCase();
  }
  return '';
}

function extractJsonLdBlocks(text) {
  const s = String(text || '').trim();
  const blocks = [];
  if (s.startsWith('{') || s.startsWith('[')) {
    try { blocks.push(JSON.parse(s)); } catch (e) {}
    return blocks;
  }
  const re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(s))) {
    const raw = m[1].trim();
    if (!raw) continue;
    try { blocks.push(JSON.parse(raw)); } catch (e) {
      // Tolerate trailing commas or HTML comments inside script tags
      try { blocks.push(JSON.parse(raw.replace(/^<!--|-->$/g, '').trim())); } catch (e2) {}
    }
  }
  return blocks;
}

function flattenGraph(blocks) {
  const nodes = [];
  const visit = x => {
    if (!x) return;
    if (Array.isArray(x)) { x.forEach(visit); return; }
    if (typeof x !== 'object') return;
    if (Array.isArray(x['@graph'])) visit(x['@graph']);
    nodes.push(x);
    if (Array.isArray(x.subEvent)) visit(x.subEvent);
    if (Array.isArray(x.itemListElement)) {
      x.itemListElement.forEach(el => visit(el && el.item ? el.item : el));
    }
  };
  blocks.forEach(visit);
  return nodes;
}

function parse(text, options) {
  options = options || {};
  const tz = options.tz || 'UTC';
  const blocks = extractJsonLdBlocks(text);
  const nodes = flattenGraph(blocks);
  const byId = new Map();
  nodes.forEach(n => { if (n['@id']) byId.set(n['@id'], n); });
  const resolve = x => (x && typeof x === 'object' && x['@id'] && Object.keys(x).length === 1 && byId.get(x['@id'])) || x;

  const events = nodes.filter(n => hasType(n, ['ScreeningEvent', 'Event', 'Festival']));
  const records = [];

  events.forEach(ev => {
    if (hasType(ev, ['Festival']) && !ev.workPresented && !ev.workFeatured) return;
    const movie = resolve(ev.workPresented || ev.workFeatured || ev.about) || {};
    const isMovie = hasType(movie, ['Movie', 'CreativeWork', 'Film']);
    const title = decodeEntities((isMovie && movie.name) || ev.name || '').trim();
    if (!title) return;

    const dt = isoToLocalMDHM(ev.startDate, tz);
    let min = parseIsoDuration((isMovie && movie.duration) || ev.duration);
    if (!min && ev.startDate && ev.endDate) {
      const a = new Date(ev.startDate).getTime(), b = new Date(ev.endDate).getTime();
      if (Number.isFinite(a) && Number.isFinite(b) && b > a && (b - a) / 60000 <= 600) {
        min = Math.round((b - a) / 60000);
      }
    }

    const loc = resolve(ev.location) || {};
    const parentLoc = resolve(loc.containedInPlace) || {};
    let venue = '', hall = '';
    if (typeof loc === 'string') {
      venue = decodeEntities(loc);
    } else if (parentLoc && parentLoc.name) {
      venue = decodeEntities(parentLoc.name);
      hall = decodeEntities(loc.name || '');
    } else {
      const rawLoc = decodeEntities(loc.name || '');
      const parts = rawLoc.split(/\s*[·・|—-]\s*/).filter(Boolean);
      venue = parts[0] || rawLoc;
      hall = parts[1] || decodeEntities(ev.doorTime ? '' : '');
    }
    if (!hall && ev.videoFormat) hall = '';

    const country = isMovie && movie.countryOfOrigin
      ? (typeof movie.countryOfOrigin === 'string' ? movie.countryOfOrigin : (movie.countryOfOrigin.name || ''))
      : '';
    const pubYear = (isMovie && (movie.dateCreated || movie.datePublished || movie.copyrightYear)) || '';
    const yMatch = String(pubYear).match(/(19|20)\d{2}/);

    records.push({
      title,
      en: decodeEntities((isMovie && movie.alternateName) || ''),
      orig: decodeEntities((isMovie && movie.name) || title),
      year: yMatch ? parseInt(yMatch[0], 10) : null,
      dir: decodeEntities(extractNames(isMovie ? movie.director : ev.director)),
      country: decodeEntities(country),
      min,
      section: decodeEntities(ev.superEvent && ev.superEvent.name ? ev.superEvent.name : (ev.eventAttendanceMode && /Online/i.test(ev.eventAttendanceMode) ? '线上放映' : '')),
      version: decodeEntities(ev.videoFormat || ''),
      date: dt.date,
      time: dt.time,
      venue,
      hall,
      qa: decodeEntities(extractNames(ev.performer)),
      audience: '',
      access: '',
      imdb: extractImdb(isMovie ? movie : ev),
      douban: '',
      lb: '',
      synopsis: decodeEntities((isMovie && movie.description) || ev.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    });
  });

  // Fallback: standalone Movie nodes without ScreeningEvent (catalogue-only pages)
  if (!records.length) {
    nodes.filter(n => hasType(n, ['Movie', 'Film'])).forEach(movie => {
      const title = decodeEntities(movie.name || '').trim();
      if (!title) return;
      const yMatch = String(movie.dateCreated || movie.datePublished || '').match(/(19|20)\d{2}/);
      records.push({
        title,
        en: decodeEntities(movie.alternateName || ''),
        orig: title,
        year: yMatch ? parseInt(yMatch[0], 10) : null,
        dir: decodeEntities(extractNames(movie.director)),
        country: decodeEntities(typeof movie.countryOfOrigin === 'string' ? movie.countryOfOrigin : ((movie.countryOfOrigin && movie.countryOfOrigin.name) || '')),
        min: parseIsoDuration(movie.duration),
        section: '', version: '', date: '', time: '', venue: '', hall: '', qa: '', audience: '', access: '',
        imdb: extractImdb(movie), douban: '', lb: '',
        synopsis: decodeEntities(movie.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      });
    });
  }

  return records;
}

module.exports = {
  id: 'jsonld',
  name: 'Schema.org JSON-LD (ScreeningEvent / Event / Movie)',
  parse,
  parseIsoDuration,
  isoToLocalMDHM
};
