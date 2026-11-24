// 读取排片数据。
// 1. 优先读取网站 https://sparrowcinema.org/data/ 的最新数据（网站更新后小程序自动同步，无需重新审核）。
// 2. 定时触发器每 10 分钟读一次网站并写入云数据库 cache 集合；小程序打开时直接返回缓存，不用等网站。
// 3. 都没有时，读取 films / shows / venues / programmes 四个集合；仍为空时小程序使用安装包内置数据。
const cloud = require('wx-server-sdk');
const https = require('https');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const OLD_SITE = 'https://sparrowcinema.github.io/SparrowTribe/';
const SITE = process.env.SITE_BASE || 'https://sparrowcinema.org/';
const BUNDLED = require('./bundled.json');

// 读取网站 JSON：声明接受 gzip（压缩后体积约为原来的 1/5，云函数到 GitHub Pages 的链路慢，这是最有效的提速），失败自动重试一次
const zlib = require('zlib');
// 换域名（docs/domain-move.md）：旧网址会整站 301 到新域名，这里跟随最多 3 次跳转（只跟 https），SITE 还没改过来时也读得到
function getOnce(url, ms, hops = 0) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const req = https.get(hops ? url : url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), { headers: { 'Cache-Control': 'no-cache', 'Accept-Encoding': 'gzip' } }, res => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && hops < 3) {
        res.resume();
        let next; try { next = new URL(res.headers.location, url).href; } catch (e) { return reject(new Error(url + ' bad redirect')); }
        if (!next.startsWith('https://')) return reject(new Error(url + ' redirect to non-https'));
        return getOnce(next, ms, hops + 1).then(resolve, reject);
      }
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
    req.setTimeout(ms, () => req.destroy(new Error('stalled ' + url)));
    req.on('error', reject);
  });
}
// 这里的 ms 是「连接空闲多久没数据就放弃」，不是总时长：大文件一直有数据不会被中断，卡住或被重置的连接 5 秒内换新连接重试，最多 3 次
async function getJSON(url, ms = 6000, tries = 3, idleMs = 5000) {
  const idle = Math.min(ms, idleMs);
  let err;
  for (let i = 0; i < tries; i++) {
    try { return await getOnce(url, idle); } catch (e) { err = e; console.warn('重试', i + 1, url.replace(SITE, ''), e && e.message); }
  }
  throw err;
}

// 把网站数据转换成小程序使用的格式；安装包里已有的图片用本地路径，其余图片直接用网站地址
async function fromSite(ms, prev) {
  const deadline = Date.now() + ms;
  // 英文层和云端配置是可选的：与节目文件同时开始读；读不完就沿用上一次缓存里的，绝不拖垮整次刷新
  const enP = getJSON(SITE + 'data/i18n/en.json', ms).catch(() => null);
  const cfgP = getJSON(SITE + 'data/config.json', ms).catch(() => null);
  const chP = getJSON(SITE + 'data/changes.json', ms).catch(() => null);
  const gdP = getJSON(SITE + 'data/guide.json', ms).catch(() => null); // 使用手册（data/guide.json）：改手册不用重新上传小程序 // 场次变更记录（tools/build-changes.js），没有时为空
  const optional = p => Promise.race([p, new Promise(r => setTimeout(() => r(null), Math.max(0, deadline - Date.now() - 1500)))]);
  const cat = await getJSON(SITE + 'data/catalog.json', ms, 6, 3000); // 目录是唯一没有后备的文件：多试几次、卡住 3 秒就换连接
  const progs = cat.programmes || [];
  // 每个节目文件各读各的，到点还没读完就放弃（留出时间写缓存）；读不到的节目沿用上一次缓存里的影片和场次，下一轮再补
  const packDeadline = Math.max(0, deadline - Date.now() - 2500);
  const late = new Promise(r => setTimeout(() => r(null), packDeadline));
  const packs = await Promise.all(progs.map(p => p.file ? Promise.race([getJSON(SITE + p.file, ms).catch(() => null), late]) : null));
  const stale = [];
  progs.forEach((p, i) => {
    if (!p.file || packs[i]) return;
    const had = prev && ((prev.films || []).some(f => f.prog === p.id) || (prev.shows || []).some(x => x.p === p.id));
    if (!had) throw new Error('programme file missing: ' + p.file);
    stale.push(p.id);
  });
  if (stale.length) console.warn('以下专题本轮没读到，沿用上次缓存：', stale.join(','));
  const has = (dir, name) => BUNDLED[dir].includes(name);
  const films = [], shows = [], seen = new Set();
  progs.forEach((p, i) => {
    const pk = packs[i];
    if (!pk && stale.includes(p.id)) { // 沿用上次缓存
      (prev.films || []).forEach(f => { if (f.prog === p.id && !seen.has(f.id)) { seen.add(f.id); films.push(f); } });
      (prev.shows || []).forEach(x => { if (x.p === p.id) shows.push(x); });
      return;
    }
    if (!pk) return;
    (pk.films || []).forEach(f => {
      if (seen.has(f.id)) return; seen.add(f.id);
      const o = Object.assign({}, f, { prog: f.prog || p.id });
      delete o.ticket;
      // 海报地址只认站内：资料里手写的 posterUrl 只有指向本站（如加 ?v= 刷新缓存）才用，其余一律按 poster 推出。
    // 部署时 tools/localize-posters.py 会把外链 poster 和同值的字段一起改成相对路径 posters/x-<id>.jpg，不能原样交给小程序（相对路径会被当成安装包内文件）
    if (typeof o.posterUrl === 'string') o.posterUrl = o.posterUrl.replace(OLD_SITE, SITE); // 换域名前写的站内地址
    if (!(typeof o.posterUrl === 'string' && o.posterUrl.startsWith(SITE))) delete o.posterUrl;
    if (!has('posters', f.id + '.jpg') && f.poster && !o.posterUrl) o.posterUrl = /^https?:\/\//.test(f.poster) ? f.poster : SITE + f.poster.replace(/^\//, '');
      if (has('tickets', f.id + '.jpg')) o.ticketUrl = '/images/tickets/' + f.id + '.jpg';
      else if (f.ticket) o.ticketUrl = SITE + f.ticket;
      films.push(o);
    });
    (pk.shows || []).forEach(r => {
      const [d, t, id, v = 'premiere', h = 'luxe', sid] = Array.isArray(r) ? r : [r.d, r.t, r.id, r.v, r.h, r.sid];
      shows.push(Object.assign({ d, t, id, v, h, p: p.id }, sid ? { sid } : {})); // sid：固定场次编号（见 tools/assign-sids.js） // p：场次所属专题（跨影展合并影片按此区分）
    });
  });
  const programmes = progs.map(p => {
    const o = Object.assign({}, p); delete o.file;
    // 联网时头图一律用网站在线图（部署生成的 930px 缩略图 programmes/w930/），换图后无需重新上传小程序；包内缩略图只在离线兜底数据里使用（build-fallback.js）。catalog 可写 coverV 让微信图片缓存失效
    o.cover = p.cover ? SITE + p.cover.replace(/^programmes\/([^/]+)\.(jpe?g|png)$/i, 'programmes/w930/$1.jpg') + (p.coverV ? '?v=' + p.coverV : '') : (has('brand', 'prog-' + p.id + '.jpg') ? '/images/brand/prog-' + p.id + '.jpg' : '');
    o.cardCover = p.cardCover ? SITE + p.cardCover : '';
    return o;
  });
  if (!films.length || !shows.length) throw new Error('empty site data');
  const en = (await optional(enP)) || (prev && prev.en) || null; // 英文层：读不到时沿用上次缓存，再不行小程序用安装包里的
  const config = (await optional(cfgP)) || (prev && prev.config) || null; // 云端配置：字号缩放、公告、提示文案
  const ch = await optional(chP), changes = (ch && ch.moves) || (prev && prev.changes) || {}; // {旧场次键:{to,f,sid,was}}：小程序据此迁移个人排片，remind 据此发准确的改期通知
  const gd = await optional(gdP), guide = (gd && Array.isArray(gd.chapters) ? { news: gd.news || [], chapters: gd.chapters } : null) || (prev && prev.guide) || null;
  return { films, shows, venues: cat.venues || [], programmes, aliases: cat.aliases || {}, en, config, changes, guide, source: 'site' };
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
function detailPart(data, i, en = true) {
  const d = {}, e = {};
  data.films.slice(i * PART, (i + 1) * PART).forEach(f => { d[f.id] = pick(f, HEAVY); const x = en && data.en && data.en.films && data.en.films[f.id]; if (x) e[f.id] = pick(x, HEAVY); });
  return { ok: true, part: i, d, e };
}
// ---- v2（2026-11-18，新版小程序传 {v:2}）：首屏只给进行中 / 即将开始 / 常设专题，且不带任何长文 ----
// 云函数返回上限约 1MB；旧版首屏（全部影片 + 简介 + 导演介绍）在 325 部时已约 820KB。v2 首屏大小只跟当期专题有关：
//   {v:2}            → 当期专题的影片（不含长文）+ 场次 + 全部影院 / 专题目录 + 当期影片的英文名；past 列出其余专题 id
//   {v:2, prog:id}   → 某个往期专题的影片与场次（小程序在后台逐个补齐，补齐后存本机缓存）
//   {v:2, part:i}    → 长文分段，与旧版相同
// 另带 lang：'zh' 时不返回英文层 en（中文界面用不到，约 200KB；切到英文时小程序再按 lang:'en' 取一次，期间用安装包里的英文兜底）。
// 不带 v 的旧版小程序仍拿到原来的格式，不受影响。
const todayBJ = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
const activeIds = data => new Set((data.programmes || []).filter(p => p.ongoing || !p.end || p.end >= todayBJ()).map(p => p.id));
function packOf(data, keep) {
  const shows = data.shows.filter(s => keep(s.p)), used = new Set(shows.map(s => s.id));
  const films = data.films.filter(f => keep(f.prog) || used.has(f.id)).map(f => drop(f, HEAVY));
  const e = {}; const ef = data.en && data.en.films; if (ef) films.forEach(f => { if (ef[f.id]) e[f.id] = drop(ef[f.id], HEAVY); });
  return { films, shows, e };
}
function leanV2(data, en) {
  const act = activeIds(data), pk = packOf(data, id => act.has(id));
  const out = Object.assign({}, data, { films: pk.films, shows: pk.shows, lean: true, v2: true, active: [...act], past: (data.programmes || []).map(p => p.id).filter(id => !act.has(id)), detailParts: Math.ceil(data.films.length / PART) });
  if (data.en && en) out.en = Object.assign({}, data.en, { films: pk.e }); else { delete out.en; out.enOmitted = true; }
  return out;
}
function progPack(data, id, en) { const pk = packOf(data, p => p === id); return { ok: true, prog: id, films: pk.films, shows: pk.shows, e: en ? pk.e : {} }; }
const shape = (data, event) => {
  const v2 = event && +event.v >= 2, en = !v2 || event.lang === 'en';
  if (event && event.part !== undefined) return detailPart(data, +event.part || 0, en);
  if (v2) return event.prog ? progPack(data, String(event.prog), en) : leanV2(data, en);
  return slim(data);
};

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
