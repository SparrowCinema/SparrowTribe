// 读取排片数据。
// 1. 优先读取网站 https://sparrowcinema.github.io/SparrowTribe/data/ 的最新数据（网站更新后小程序自动同步，无需重新审核）。
// 2. 定时触发器每 10 分钟读一次网站并写入云数据库 cache 集合；小程序打开时直接返回缓存，不用等网站。
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
      shows.push({ d, t, id, v, h, p: p.id }); // p：场次所属专题（跨影展合并影片按此区分）
    });
  });
  const programmes = progs.map(p => {
    const o = Object.assign({}, p); delete o.file;
    o.cover = has('brand', 'prog-' + p.id + '.jpg') ? '/images/brand/prog-' + p.id + '.jpg' : (p.cover ? SITE + p.cover : '');
    o.cardCover = p.cardCover ? SITE + p.cardCover : '';
    return o;
  });
  if (!films.length || !shows.length) throw new Error('empty site data');
  const en = await getJSON(SITE + 'data/i18n/en.json', ms).catch(() => null); // 英文层：读不到时小程序用安装包里的
  return { films, shows, venues: cat.venues || [], programmes, aliases: cat.aliases || {}, en, source: 'site' };
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

// 读取网站的时间预算：getData 超时时间在控制台设为 30 秒。能读到运行时剩余时间时按它留 1.5 秒兜底，读不到时按 12 秒。
function budget(context) {
  let limit = 0;
  try {
    if (context && typeof context.getRemainingTimeInMillis === 'function') limit = +context.getRemainingTimeInMillis();
    if (!(limit > 0) && context) limit = +(context.time_limit_in_ms || context.timeLimitInMs || 0);
    if (!(limit > 0)) limit = +(process.env.SCF_FUNCTIONTIMEOUT || 0) * 1000;
  } catch (e) {}
  if (!(limit > 0)) return 12000;
  return Math.max(1500, Math.min(12000, limit - 1500));
}
const within = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('site budget ' + ms + 'ms')), ms))]);

// 缓存分块保存：云数据库单条记录有大小上限（约 1MB），整份数据超过后一次写入会失败。
// site 文档只存元信息 {at, n}，数据切成 n 段存在 site_0 … site_{n-1}；旧版单文档格式（含 json 字段）仍可读取。
const CHUNK = 100000;
async function readCache() {
  try {
    const c = await db.collection('cache').doc('site').get();
    if (!c.data) return null;
    if (c.data.n > 0) {
      const parts = await Promise.all(Array.from({ length: c.data.n }, (_, i) => db.collection('cache').doc('site_' + i).get().then(r => r.data && r.data.json)));
      if (parts.some(x => typeof x !== 'string')) return null;
      return { data: JSON.parse(parts.join('')), at: c.data.at || 0 };
    }
    if (c.data.json) return { data: JSON.parse(c.data.json), at: c.data.at || 0 };
  } catch (e) { console.warn('读取缓存失败', e && e.message); }
  return null;
}
async function writeCache(data) {
  const json = JSON.stringify(data), n = Math.ceil(json.length / CHUNK), col = db.collection('cache');
  const put = async (id, doc) => {
    try { await col.doc(id).set({ data: doc }); }
    catch (e) { try { await db.createCollection('cache'); } catch (e2) {} await col.doc(id).set({ data: doc }); }
  };
  for (let i = 0; i < n; i++) await put('site_' + i, { json: json.slice(i * CHUNK, (i + 1) * CHUNK) });
  await put('site', { at: Date.now(), n }); // 最后写元信息：读到新 n 时各段一定已写好
  console.log('缓存已写入', n + ' 段，共 ' + json.length + ' 字符');
}

// 云函数返回值有大小上限（约 1MB），完整数据（含剧情简介等长文）已超过，所以首屏只返回精简版，
// 长文字段按 PART 部一段，由小程序用 {part:i} 再逐段取回并合并。
const HEAVY = ['syn', 'bio', 'st', 'honors', 'parts', 'contentNote', 'contentReview', 'editorial', 'highlights', 'links', 'warnings'];
const PART = 40;
const pick = (o, ks) => { const r = {}; ks.forEach(k => { if (o && o[k] !== undefined) r[k] = o[k]; }); return r; };
const drop = (o, ks) => { const r = Object.assign({}, o); ks.forEach(k => { delete r[k]; }); return r; };
function slim(data) {
  const out = Object.assign({}, data, { films: data.films.map(f => drop(f, HEAVY)), lean: true, detailParts: Math.ceil(data.films.length / PART) });
  if (data.en && data.en.films) { const ef = {}; Object.keys(data.en.films).forEach(id => { ef[id] = drop(data.en.films[id], HEAVY); }); out.en = Object.assign({}, data.en, { films: ef }); }
  return out;
}
function detailPart(data, i) {
  const d = {}, e = {};
  data.films.slice(i * PART, (i + 1) * PART).forEach(f => { d[f.id] = pick(f, HEAVY); const en = data.en && data.en.films && data.en.films[f.id]; if (en) e[f.id] = pick(en, HEAVY); });
  return { ok: true, part: i, d, e };
}
const shape = (data, event) => (event && event.part !== undefined ? detailPart(data, +event.part || 0) : slim(data));

exports.main = async (event, context) => {
  // 定时触发器（每 10 分钟）或 {"refresh":true}：去网站取最新数据并更新缓存
  const isTimer = !!(event && (event.Type === 'Timer' || event.TriggerName || event.Time));
  const force = isTimer || !!(event && event.refresh);
  const cached = await readCache();
  // 小程序打开时：有缓存就直接返回，不等网站（缓存由定时触发器在后台更新）
  if (!force && cached) return shape(Object.assign(cached.data, { source: 'cache', cachedAt: cached.at }), event);
  try {
    const ms = budget(context);
    console.log('读取网站，时限', ms + 'ms', isTimer ? '（定时触发）' : '');
    const data = await within(fromSite(ms), ms);
    try { await writeCache(data); } catch (e) { console.error('缓存写入失败', e && e.message); }
    console.log('网站数据已更新到缓存', data.films.length + ' 部', data.shows.length + ' 场');
    return isTimer ? { ok: true, films: data.films.length, shows: data.shows.length } : shape(data, event);
  } catch (e) {
    console.warn('网站数据读取失败，改用缓存', e && e.message);
  }
  if (isTimer) return { ok: false };
  if (cached) return shape(Object.assign(cached.data, { source: 'cache-stale', cachedAt: cached.at }), event);
  return shape(await fromDatabase(), event);
};
