// 读取排片数据。
// 1. 优先读取网站 https://sparrowcinema.github.io/SparrowTribe/data/ 的最新数据（网站更新后小程序自动同步，无需重新审核）。
// 2. 读取结果缓存在云数据库 cache 集合，10 分钟内直接返回缓存；网站读取失败时也用缓存。
// 3. 都没有时，读取 films / shows / venues / programmes 四个集合；仍为空时小程序使用安装包内置数据。
const cloud = require('wx-server-sdk');
const https = require('https');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const SITE = process.env.SITE_BASE || 'https://sparrowcinema.github.io/SparrowTribe/';
const BUNDLED = require('./bundled.json');

function getJSON(url, ms = 6000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), { headers: { 'Cache-Control': 'no-cache' } }, res => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(url + ' ' + res.statusCode)); }
      let body = ''; res.setEncoding('utf8');
      res.on('data', c => { body += c; });
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    });
    req.setTimeout(ms, () => req.destroy(new Error('timeout ' + url)));
    req.on('error', reject);
  });
}

// 把网站数据转换成小程序使用的格式；安装包里已有的图片用本地路径，其余图片直接用网站地址
async function fromSite(ms) {
  const cat = await getJSON(SITE + 'data/catalog.json', ms);
  const progs = cat.programmes || [];
  const packs = await Promise.all(progs.map(p => p.file ? getJSON(SITE + p.file, ms).catch(() => null) : null));
  if (progs.some((p, i) => p.file && !packs[i])) throw new Error('programme file missing');
  const has = (dir, name) => BUNDLED[dir].includes(name);
  const films = [], shows = [], seen = new Set();
  progs.forEach((p, i) => {
    const pk = packs[i]; if (!pk) return;
    (pk.films || []).forEach(f => {
      if (seen.has(f.id)) return; seen.add(f.id);
      const o = Object.assign({}, f, { prog: f.prog || p.id });
      delete o.ticket;
      if (!has('posters', f.id + '.jpg') && f.poster && !o.posterUrl) o.posterUrl = SITE + f.poster;
      if (has('tickets', f.id + '.jpg')) o.ticketUrl = '/images/tickets/' + f.id + '.jpg';
      else if (f.ticket) o.ticketUrl = SITE + f.ticket;
      films.push(o);
    });
    (pk.shows || []).forEach(r => {
      const [d, t, id, v = 'premiere', h = 'luxe'] = Array.isArray(r) ? r : [r.d, r.t, r.id, r.v, r.h];
      shows.push({ d, t, id, v, h });
    });
  });
  const programmes = progs.map(p => {
    const o = Object.assign({}, p); delete o.file;
    o.cover = has('brand', 'prog-' + p.id + '.jpg') ? '/images/brand/prog-' + p.id + '.jpg' : (p.cover ? SITE + p.cover : '');
    return o;
  });
  if (!films.length || !shows.length) throw new Error('empty site data');
  return { films, shows, venues: cat.venues || [], programmes, source: 'site' };
}

async function all(name) {
  try {
    const out = [];
    for (let skip = 0; ; skip += 100) {
      const r = await db.collection(name).skip(skip).limit(100).get();
      out.push(...r.data);
      if (r.data.length < 100) break;
    }
    return out;
  } catch (e) { return []; } // 集合不存在时返回空，小程序会改用内置数据
}

async function fromDatabase() {
  const [films, shows, venues, programmes] = await Promise.all(['films', 'shows', 'venues', 'programmes'].map(all));
  const strip = x => { const o = Object.assign({}, x); delete o._id; delete o._openid; return o; };
  const byOrder = (a, b) => (a.order || 0) - (b.order || 0);
  films.sort(byOrder); shows.sort(byOrder); programmes.sort(byOrder);
  return { films: films.map(strip), shows: shows.map(strip), venues: venues.map(strip), programmes: programmes.map(strip), source: 'database' };
}

// 读取网站的时间预算：按云函数的超时设置留出 1.2 秒给缓存兜底（默认超时 3 秒时约 1.8 秒）
function budget(context) {
  let limit = 3000;
  try {
    if (context && typeof context.getRemainingTimeInMillis === 'function') limit = context.getRemainingTimeInMillis();
    else if (context && +context.time_limit_in_ms > 0) limit = +context.time_limit_in_ms;
  } catch (e) {}
  return Math.max(1200, Math.min(10000, limit - 1200));
}
const within = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('site budget ' + ms + 'ms')), ms))]);

const FRESH_MS = 10 * 60 * 1000; // 缓存 10 分钟内直接用，不再去网站读取

async function readCache() {
  try { const c = await db.collection('cache').doc('site').get(); if (c.data && c.data.json) return { data: JSON.parse(c.data.json), at: c.data.at || 0 }; } catch (e) {}
  return null;
}

exports.main = async (event, context) => {
  const cached = await readCache();
  if (cached && Date.now() - cached.at < FRESH_MS && !(event && event.refresh)) return Object.assign(cached.data, { source: 'cache' });
  try {
    const ms = budget(context);
    const data = await within(fromSite(ms), ms);
    const doc = { data: { json: JSON.stringify(data), at: Date.now() } };
    try { await db.collection('cache').doc('site').set(doc); }
    catch (e) { try { await db.createCollection('cache'); await db.collection('cache').doc('site').set(doc); } catch (e2) {} }
    return data;
  } catch (e) {
    console.warn('网站数据读取失败，改用缓存', e && e.message);
  }
  if (cached) return Object.assign(cached.data, { source: 'cache-stale' });
  return fromDatabase();
};
