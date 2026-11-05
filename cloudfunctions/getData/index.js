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

// 读取网站 JSON：声明接受 gzip（压缩后体积约为原来的 1/5，云函数到 GitHub Pages 的链路慢，这是最有效的提速），失败自动重试一次
const zlib = require('zlib');
function getOnce(url, ms) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const req = https.get(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), { headers: { 'Cache-Control': 'no-cache', 'Accept-Encoding': 'gzip' } }, res => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(url + ' ' + res.statusCode)); }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('error', reject);
      res.on('end', () => {
        try {
          let buf = Buffer.concat(chunks);
          if (/gzip/i.test(res.headers['content-encoding'] || '')) buf = zlib.gunzipSync(buf);
          console.log('读取', url.replace(SITE, ''), Math.round(buf.length / 1024) + 'KB', (Date.now() - t0) + 'ms');
          resolve(JSON.parse(buf.toString('utf8')));
        } catch (e) { reject(e); }
      });
    });
    req.setTimeout(ms, () => req.destroy(new Error('timeout ' + url)));
    req.on('error', reject);
  });
}
async function getJSON(url, ms = 6000) {
  try { return await getOnce(url, ms); } catch (e) { console.warn('重试', url, e && e.message); return getOnce(url, ms); }
}

// 把网站数据转换成小程序使用的格式；安装包里已有的图片用本地路径，其余图片直接用网站地址
async function fromSite(ms, prev) {
  const deadline = Date.now() + ms;
  // 英文层和云端配置是可选的：与节目文件同时开始读；读不完就沿用上一次缓存里的，绝不拖垮整次刷新
  const enP = getJSON(SITE + 'data/i18n/en.json', ms).catch(() => null);
  const cfgP = getJSON(SITE + 'data/config.json', ms).catch(() => null);
  const optional = p => Promise.race([p, new Promise(r => setTimeout(() => r(null), Math.max(0, deadline - Date.now() - 1500)))]);
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
  const en = (await optional(enP)) || (prev && prev.en) || null; // 英文层：读不到时沿用上次缓存，再不行小程序用安装包里的
  const config = (await optional(cfgP)) || (prev && prev.config) || null; // 云端配置：字号缩放、公告、提示文案
  return { films, shows, venues: cat.venues || [], programmes, aliases: cat.aliases || {}, en, config, source: 'site' };
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
function budget(context, cap = 12000) {
  let limit = 0;
  try {
    if (context && typeof context.getRemainingTimeInMillis === 'function') limit = +context.getRemainingTimeInMillis();
    if (!(limit > 0) && context) limit = +(context.time_limit_in_ms || context.timeLimitInMs || 0);
    if (!(limit > 0)) limit = +(process.env.SCF_FUNCTIONTIMEOUT || 0) * 1000;
  } catch (e) {}
  if (!(limit > 0)) return cap;
  return Math.max(1500, Math.min(cap, limit - 6000));
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
  await Promise.all(Array.from({ length: n }, (_, i) => put('site_' + i, { json: json.slice(i * CHUNK, (i + 1) * CHUNK) }))); // 各段并行写，缩短刷新耗时
  await put('site', { at: Date.now(), n }); // 最后写元信息：读到新 n 时各段一定已写好
  console.log('缓存已写入', n + ' 段，共 ' + json.length + ' 字符');
}

// 云函数返回值有大小上限（约 1MB），完整数据（含剧情简介等长文）已超过，所以首屏只返回精简版，
// 长文字段按 PART 部一段，由小程序用 {part:i} 再逐段取回并合并。
const HEAVY = ['syn', 'bio', 'st', 'honors', 'parts', 'contentNote', 'contentReview', 'editorial', 'highlights', 'links', 'warnings'];
// 旧版小程序不会再取分段，只认首屏数据：把最常看的剧情简介(syn)、导演介绍(bio)中文部分留在首屏（约 160KB，仍远低于上限），
// 其余长文只在新版里分段补齐。
const KEEP_EARLY = ['syn', 'bio'];
const LEAN_DROP = HEAVY.filter(k => !KEEP_EARLY.includes(k));
const PART = 40;
const pick = (o, ks) => { const r = {}; ks.forEach(k => { if (o && o[k] !== undefined) r[k] = o[k]; }); return r; };
const drop = (o, ks) => { const r = Object.assign({}, o); ks.forEach(k => { delete r[k]; }); return r; };
function slim(data) {
  const out = Object.assign({}, data, { films: data.films.map(f => drop(f, LEAN_DROP)), lean: true, detailParts: Math.ceil(data.films.length / PART) });
  if (data.en && data.en.films) { const ef = {}; Object.keys(data.en.films).forEach(id => { ef[id] = drop(data.en.films[id], HEAVY); }); out.en = Object.assign({}, data.en, { films: ef }); }
  return out;
}
function detailPart(data, i) {
  const d = {}, e = {};
  data.films.slice(i * PART, (i + 1) * PART).forEach(f => { d[f.id] = pick(f, HEAVY); const en = data.en && data.en.films && data.en.films[f.id]; if (en) e[f.id] = pick(en, HEAVY); });
  return { ok: true, part: i, d, e };
}
const shape = (data, event) => (event && event.part !== undefined ? detailPart(data, +event.part || 0) : slim(data));

// 诊断模式：测试参数为 {"diag":true} 时会逐步执行「读网站 → 转换 → 写缓存」并把每步耗时与报错返回，
// 用于排查调用失败。小程序不会传 diag，不受影响。
async function diagnose(context) {
  // 网络已验证可用。这里分步执行「读网站 → 写缓存」，每步都有硬性时限，保证总耗时 < 25 秒、一定能把结果返回
  const out = { diag: true, steps: [] };
  const race = (p, ms, label) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(label + ' 超过 ' + ms / 1000 + ' 秒仍未完成')), ms))]);
  const T0 = Date.now();
  let data = null;
  try {
    const t = Date.now(); data = await race(fromSite(8000), 10000, '读取网站');
    out.steps.push({ name: '读取网站并转换', ms: Date.now() - t, ok: true, info: data.films.length + ' 部 / ' + data.shows.length + ' 场' });
  } catch (e) { out.steps.push({ name: '读取网站并转换', ms: Date.now() - T0, ok: false, error: String(e && e.message || e).slice(0, 200) }); }
  if (data) {
    const json = JSON.stringify(data), n = Math.ceil(json.length / CHUNK), col = db.collection('cache');
    out.steps.push({ name: '缓存体积', ok: true, info: Math.round(json.length / 1024) + 'K 字符，分 ' + n + ' 段' });
    const res = [];
    const one = async i => { const t = Date.now(); try { await col.doc('site_' + i).set({ data: { json: json.slice(i * CHUNK, (i + 1) * CHUNK) } }); res[i] = (Date.now() - t) + 'ms'; } catch (e) { res[i] = '失败:' + String(e && e.message || e).slice(0, 80); } };
    try { await race(Promise.all(Array.from({ length: n }, (_, i) => one(i))), 12000, '写入缓存分段'); } catch (e) { out.steps.push({ name: '写入缓存分段', ok: false, error: String(e.message) }); }
    out.steps.push({ name: '各段写入', ok: res.length === n && res.every(x => x && !String(x).startsWith('失败')), info: res.map((x, i) => i + ':' + (x || '未完成')).join(' ') });
    if (out.steps[out.steps.length - 1].ok) {
      try { await race(col.doc('site').set({ data: { at: Date.now(), n } }), 5000, '写入元信息'); out.steps.push({ name: '写入元信息(缓存生效)', ok: true }); }
      catch (e) { out.steps.push({ name: '写入元信息', ok: false, error: String(e.message) }); }
    }
  }
  out.ok = out.steps.every(x => x.ok); out.totalMs = Date.now() - T0;
  return out;
}

exports.main = async (event, context) => {
  if (event && event.diag === true) return diagnose(context); // 排查问题时在测试参数里写 {"diag":true}；默认测试恢复为正常返回
  // 定时触发器（每 10 分钟，需在云开发控制台「上传触发器」才会生效）或 {"refresh":true}：去网站取最新数据并更新缓存
  const isTimer = !!(event && (event.Type === 'Timer' || event.TriggerName || event.Time));
  const force = isTimer || !!(event && event.refresh);
  const cached = await readCache();
  // 小程序打开时：有缓存就直接返回，不等网站。刷新只由定时触发器、{"refresh":true}，
  // 以及小程序检测到缓存超过 3 分钟后单独发起的强制刷新来完成，普通请求不读网站，避免调用失败。
  if (!force && cached) return shape(Object.assign(cached.data, { source: 'cache', cachedAt: cached.at }), event);
  try {
    const ms = budget(context, isTimer || (event && event.refresh) ? 20000 : 12000);
    console.log('读取网站，时限', ms + 'ms', isTimer ? '（定时触发）' : '');
    const data = await within(fromSite(ms, cached && cached.data), ms);
    try { await writeCache(data); } catch (e) { console.error('缓存写入失败', e && e.message); }
    console.log('网站数据已更新到缓存', data.films.length + ' 部', data.shows.length + ' 场');
    // quiet：只刷新缓存、返回很小的结果（小程序随后再用普通请求读缓存；排查问题时也用它）
    return isTimer || (event && event.quiet) ? { ok: true, films: data.films.length, shows: data.shows.length, at: Date.now() } : shape(data, event);
  } catch (e) {
    console.warn('网站数据读取失败，改用缓存', e && e.message);
  }
  if (isTimer) return { ok: false };
  if (cached) return shape(Object.assign(cached.data, { source: 'cache-stale', cachedAt: cached.at }), event);
  return shape(await fromDatabase(), event);
};
