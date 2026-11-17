// 微信订阅消息：开场提醒、场次变更通知、想看的影片有新场次（2026-11-18）
// 模板「电影上映提醒」（一次性订阅）：用户每点一次「允许」，才能给他发一条。
//
// 小程序调用（openid 由微信自动带上，不信任前端传的身份）：
//   {action:'tmpl'}                         → {id} 从后台模板列表按标题取模板 ID（防止手抄写错），取不到用内置值
//   {action:'add', kind:'show', key, film, env}  → 加入排片后订阅这一场：开场前 1 小时提醒；场次时间 / 影厅变了会改发变更通知
//   {action:'add', kind:'want', film, env}       → 标想看后订阅：这部影片出现新场次时通知一次
//   {action:'cancel', kind, key|film}       → 移出排片 / 取消想看时撤销
//   {action:'list'}                         → 这个用户还在等待发送的订阅（小程序据此显示「已开启」）
// 定时触发（每 10 分钟，config.json）：读 getData 写好的排片缓存，逐条判断并发送（规则在 rules.js）。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database(), _ = db.command;
const R = require('./rules.js');
const COL = 'remind', TITLE = '电影上映提醒';
const TMPL = process.env.REMIND_TMPL || '0bOfTP5aSMTerLMnmJPTlYI9Tl36Dcm_6HbK-7H-B38';
const STATE = { release: 'formal', trial: 'trial', develop: 'developer' };

async function readCache() { // 与 getData 的缓存格式一致：site 存 {at,n}，数据分段在 site_0…
  const c = await db.collection('cache').doc('site').get().catch(() => null);
  if (!c || !c.data) return null;
  if (c.data.n > 0) {
    const parts = await Promise.all(Array.from({ length: c.data.n }, (_, i) => db.collection('cache').doc('site_' + i).get().then(r => r.data && r.data.json).catch(() => null)));
    if (parts.some(x => typeof x !== 'string')) return null;
    return { data: JSON.parse(parts.join('')), at: c.data.at || 0 };
  }
  return c.data.json ? { data: JSON.parse(c.data.json), at: c.data.at || 0 } : null;
}
async function ensure() { try { await db.createCollection(COL); } catch (e) { } }
let tmplCache = '';
async function tmplId() {
  if (tmplCache) return tmplCache;
  try {
    const r = await cloud.openapi.subscribeMessage.getTemplateList({});
    const hit = (r.data || []).find(x => x.title === TITLE && /电影名称/.test(x.content || '') && /time2/.test(x.content || ''));
    if (hit) return (tmplCache = hit.priTmplId);
  } catch (e) { console.warn('读取模板列表失败', e && (e.errCode || e.message)); }
  return TMPL;
}

async function add(OPENID, ev) {
  const kind = ev.kind === 'want' ? 'want' : 'show', film = String(ev.film || '').slice(0, 80);
  if (!/^[\w-]{1,80}$/.test(film)) return { ok: false, msg: 'bad film' };
  const cache = await readCache(); if (!cache) return { ok: false, msg: 'no data' };
  const idx = R.index(cache.data), now = Date.now();
  if (!idx.F[film]) return { ok: false, msg: 'unknown film' };
  const doc = { openid: OPENID, kind, film, state: 'wait', env: STATE[ev.env] ? ev.env : 'release', at: now, tries: 0 };
  let where;
  if (kind === 'show') {
    const s = idx.shows.find(x => R.keyOf(x) === ev.key && x.id === film);
    if (!s) return { ok: false, msg: 'unknown show' };
    const start = R.startOf(s);
    if (start - now < 15 * 60e3) return { ok: false, msg: 'too late' };
    Object.assign(doc, { key: ev.key, start, show: { d: s.d, t: s.t, v: s.v, h: s.h } });
    where = { openid: OPENID, kind, key: ev.key };
  } else {
    doc.known = R.upcoming(idx, film, now).map(R.keyOf);
    where = { openid: OPENID, kind, film };
  }
  await ensure();
  const col = db.collection(COL), old = await col.where(Object.assign({ state: 'wait' }, where)).limit(1).get();
  if (old.data.length) await col.doc(old.data[0]._id).update({ data: Object.assign({ at: now, env: doc.env }, kind === 'want' ? { known: _.set(doc.known) } : {}) });
  else await col.add({ data: doc });
  return { ok: true };
}

async function tick() {
  const now = Date.now(), col = db.collection(COL);
  let docs = [];
  try { for (let skip = 0; skip < 2000; skip += 100) { const r = await col.where({ state: 'wait' }).skip(skip).limit(100).get(); docs.push(...r.data); if (r.data.length < 100) break; } }
  catch (e) { return { ok: true, n: 0 }; } // 集合还没建：没人订阅过
  if (!docs.length) return { ok: true, n: 0 };
  const cache = await readCache(); if (!cache) return { ok: false, msg: 'no data' };
  const idx = R.index(cache.data), trusted = now - cache.at < 2 * R.HOUR && idx.shows.length > 0;
  const tid = await tmplId(); let sent = 0;
  for (const d of docs) {
    const r = R.decide(d, idx, now, trusted);
    if (r.act === 'wait') continue;
    if (r.act === 'expire') { await col.doc(d._id).update({ data: { state: 'expired' } }); continue; }
    try {
      await cloud.openapi.subscribeMessage.send({ touser: d.openid, templateId: tid, page: r.page, data: r.data, miniprogramState: STATE[d.env] || 'formal', lang: 'zh_CN' });
      await col.doc(d._id).update({ data: { state: 'sent', sentAt: now, sentKind: r.kind } }); sent++;
    } catch (e) {
      const code = e && e.errCode;
      console.warn('发送失败', d._id, code, e && e.errMsg);
      // 43101：用户没有可用的订阅次数（拒绝过或已用完），不再重试；其他错误最多重试 3 次
      const tries = (d.tries || 0) + 1;
      await col.doc(d._id).update({ data: code === 43101 || tries >= 3 ? { state: 'fail', err: code || 'x' } : { tries } });
    }
  }
  console.log('订阅提醒：待处理', docs.length, '已发送', sent);
  return { ok: true, n: docs.length, sent };
}

exports.main = async (event) => {
  // 定时触发；云开发控制台的「默认测试」不带 action，也走这里，方便手动跑一轮看日志
  if (!event || event.Type === 'Timer' || event.TriggerName || !event.action) return tick();
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, msg: 'no openid' };
  const a = event.action;
  if (a === 'tmpl') return { ok: true, id: await tmplId() };
  if (a === 'add') return add(OPENID, event);
  if (a === 'cancel') {
    const kind = event.kind === 'want' ? 'want' : 'show', where = { openid: OPENID, kind, state: 'wait' };
    if (kind === 'show') where.key = String(event.key || ''); else where.film = String(event.film || '');
    try { await db.collection(COL).where(where).update({ data: { state: 'cancel' } }); } catch (e) { }
    return { ok: true };
  }
  if (a === 'list') {
    try { const r = await db.collection(COL).where({ openid: OPENID, state: 'wait' }).field({ kind: true, key: true, film: true }).limit(500).get(); return { ok: true, list: r.data.map(x => ({ kind: x.kind, key: x.key || '', film: x.film })) }; }
    catch (e) { return { ok: true, list: [] }; }
  }
  return { ok: false, msg: 'unknown action' };
};
