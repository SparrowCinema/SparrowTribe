/* 平遥国际电影展官网（pyiffestival.com）官方 API 适配器
 * 支持：
 *   1. 本地保存的 PYIFF API 快照 JSON（{ activity, cinema, films: [...] } 或纯 activityFilms 数组）
 *   2. 实时抓取：传入 https://www.pyiffestival.com/ 或 https://api.pyiffestival.com/...
 *      自动调用官网公开游客接口（/app/api/v1/TenantUser/Login/guest）获取当前/指定年份展映片单与排片 */
'use strict';

const API_BASE = 'https://api.pyiffestival.com';

function decodeHtml(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&ldquo;/g, '“')
    .replace(/&rdquo;/g, '”')
    .replace(/&lsquo;/g, '‘')
    .replace(/&rsquo;/g, '’')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…')
    .replace(/&middot;/g, '·')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanTitle(raw) {
  return String(raw || '').replace(/\s+/g, ' ').trim();
}

function parseMainInfo(mainInfo) {
  const lines = String(mainInfo || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  let country = '', year = null, totalMin = 0, version = '';
  lines.forEach(line => {
    const parts = line.split(/[／/]/).map(s => s.trim()).filter(Boolean);
    if (!country && parts[0] && !/^\d{4}/.test(parts[0]) && !/十周年/.test(parts[0])) {
      country = parts[0].replace(/[、，,]+/g, ' / ');
    }
    const ym = line.match(/(19|20)\d{2}/);
    if (ym && !year) year = parseInt(ym[0], 10);
    const mm = line.match(/(\d{1,3})\s*(?:分钟|mins?|min\b)/i);
    if (mm) totalMin += parseInt(mm[1], 10);
    if (/4K修复/i.test(line)) version = '4K修复';
    else if (/修复版|RESTORATION/i.test(line) && !version) version = '修复版';
  });
  return { country, year, min: totalMin, version };
}

function parseDirector(basicInfo) {
  const s = decodeHtml(basicInfo);
  const m = s.match(/(?:导演|Director)\s*[：:]\s*([^\n\r]+)/i);
  if (m) return m[1].replace(/\s*[/／、]\s*/g, ' / ').trim();
  return s.replace(/\s*[/／、]\s*/g, ' / ').trim();
}

function parseDateTime(dtStr) {
  const m = String(dtStr || '').match(/(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})/);
  if (!m) return { date: '', time: '' };
  return {
    date: `${parseInt(m[2], 10)}/${parseInt(m[3], 10)}`,
    time: `${m[4].padStart(2, '0')}:${m[5]}`
  };
}

function parse(input) {
  const data = typeof input === 'string' ? JSON.parse(input) : input;
  const films = Array.isArray(data)
    ? data
    : Array.isArray(data && data.films) ? data.films
    : Array.isArray(data && data.items) ? data.items
    : [];

  const defaultVenue = (data && data.cinema && data.cinema.activityCinemaName) || '平遥电影宫';
  const records = [];

  films.forEach(f => {
    if (!f) return;
    const title = cleanTitle(f.activityFilmName || f.name);
    if (!title) return;
    const en = cleanTitle(f.activityFilmNameEN || f.nameEN);
    const dir = parseDirector(f.basicInformation);
    const main = parseMainInfo(f.mainInformation);
    const section = cleanTitle(f.activityFilmCategoryName || '');
    const synopsis = decodeHtml(f.description || '');
    const version = main.version || (/4K修复/.test(title) ? '4K修复' : /修复版/.test(title) ? '修复版' : '');
    const plans = Array.isArray(f.activityFilmPlans) ? f.activityFilmPlans : [];

    if (!plans.length) {
      records.push({
        title,
        en,
        orig: en || title,
        year: main.year,
        dir,
        country: main.country,
        min: main.min,
        section,
        version,
        date: '',
        time: '',
        venue: defaultVenue,
        hall: '',
        qa: '',
        audience: 'public',
        access: '',
        imdb: '',
        douban: '',
        lb: '',
        synopsis
      });
      return;
    }

    plans.forEach(p => {
      const dt = parseDateTime(p.startTime || p.date);
      records.push({
        title,
        en,
        orig: en || title,
        year: main.year,
        dir,
        country: main.country,
        min: main.min,
        section,
        version,
        date: dt.date,
        time: dt.time,
        venue: cleanTitle(p.activityCinemaName || defaultVenue),
        hall: cleanTitle(p.activityCinemaHall || p.activityCinemaHallName || ''),
        qa: '',
        audience: 'public',
        access: '',
        imdb: '',
        douban: '',
        lb: '',
        synopsis
      });
    });
  });

  return records;
}

async function fetchJson(url, token, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs || 20000);
  try {
    const headers = {
      'User-Agent': 'SparrowFilmPassport-Importer/1.0 (+https://sparrowcinema.org/)',
      'Accept': 'application/json'
    };
    if (token) headers.Authorization = 'Bearer ' + token;
    const res = await fetch(url, { signal: ctrl.signal, headers });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFromUrl(url) {
  const login = await fetchJson(`${API_BASE}/app/api/v1/TenantUser/Login/guest`);
  const token = login && login.accessToken;
  if (!token) throw new Error('PYIFF guest login did not return accessToken');

  const actList = await fetchJson(`${API_BASE}/app/api/v1/Activity?SkipCount=0&MaxResultCount=20`, token);
  const items = (actList && actList.items) || [];
  const yearMatch = String(url || '').match(/\b(20\d{2})\b/);
  const activity = (yearMatch && items.find(a => String(a.activityName || '').includes(yearMatch[1]))) || items[0];
  if (!activity || !activity.id) throw new Error('No PYIFF activity found');

  const actId = activity.id;
  const [cinemasRes, catsRes] = await Promise.all([
    fetchJson(`${API_BASE}/app/api/v1/Activity/${actId}/ActivityCinemas?SkipCount=0&MaxResultCount=20`, token).catch(() => ({ items: [] })),
    fetchJson(`${API_BASE}/app/api/v1/Activity/${actId}/ActivityFilmCategories?SkipCount=0&MaxResultCount=50`, token).catch(() => ({ items: [] }))
  ]);

  const cats = (catsRes && catsRes.items) || [];
  const screeningCat = cats.find(c => /电影展映/.test(c.activityFilmCategoryName || '')) || cats[0];
  const catQuery = screeningCat ? `&ActivityFilmCategoryId=${encodeURIComponent(screeningCat.id)}` : '';
  const listRes = await fetchJson(`${API_BASE}/app/api/v1/Activity/${actId}/ActivityFilms?SkipCount=0&MaxResultCount=200${catQuery}`, token);
  const briefFilms = (listRes && listRes.items) || [];

  const films = [];
  for (let i = 0; i < briefFilms.length; i += 3) {
    const batch = briefFilms.slice(i, i + 3);
    const details = await Promise.all(
      batch.map(b => fetchJson(`${API_BASE}/app/api/v1/Activity/${actId}/ActivityFilms/${b.id}`, token).catch(() => b))
    );
    films.push(...details);
  }

  return JSON.stringify({
    activity,
    cinema: (cinemasRes && cinemasRes.items && cinemasRes.items[0]) || null,
    categories: cats,
    films
  });
}

module.exports = {
  id: 'pyiff',
  name: 'Pingyao International Film Festival API (pyiffestival.com)',
  parse,
  fetchFromUrl
};
