// 个人排片与观影护照：按微信用户 openid 保存场次键（keys）和看过/评分记录（watched）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 只保存合法字段，防止异常数据
function cleanWatched(w) {
  const out = {};
  if (!w || typeof w !== 'object') return out;
  Object.keys(w).slice(0, 12000).forEach(id => {
    const r = w[id]; if (!/^[\w-]{1,80}$/.test(id) || !r || typeof r !== 'object') return;
    const t = Number(r.t) || 0;
    if (r.del) { out[id] = { del: 1, t }; return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.d || ''))) return;
    out[id] = { d: r.d, r: Math.max(0, Math.min(10, Math.round(Number(r.r) || 0))), k: typeof r.k === 'string' ? r.k.slice(0, 80) : '', t };
    if (typeof r.f === 'string' && /^[\w-]{1,20}$/.test(r.f)) out[id].f = r.f;   // 放映版本（可选）
  });
  return out;
}

async function upsert(OPENID, data) {
  const col = db.collection('plans');
  const full = Object.assign({ updatedAt: db.serverDate() }, data);
  try {
    const r = await col.doc(OPENID).update({ data: Object.assign({}, full, data.watched ? { watched: _.set(data.watched) } : {}, data.keys ? { keys: _.set(data.keys) } : {}) });
    if (r && r.stats && r.stats.updated) return;
  } catch (e) { }
  try { await col.doc(OPENID).set({ data: full }); }
  catch (e) { try { await db.createCollection('plans'); } catch (x) { } await col.doc(OPENID).set({ data: full }); }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { keys: [], watched: {} };
  if (event.action === 'set') {
    const keys = Array.isArray(event.keys) ? event.keys.filter(k => typeof k === 'string').slice(0, 500) : [];
    await upsert(OPENID, { keys });
    return { ok: true, n: keys.length };
  }
  if (event.action === 'setWatched') {
    const watched = cleanWatched(event.watched);
    await upsert(OPENID, { watched });
    return { ok: true, n: Object.keys(watched).length };
  }
  try { const r = await db.collection('plans').doc(OPENID).get(); return { keys: r.data.keys || [], watched: r.data.watched || {} }; }
  catch (e) { return { keys: [], watched: {} }; }
};
