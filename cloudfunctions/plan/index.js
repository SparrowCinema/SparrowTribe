// 个人排片：按微信用户 openid 保存场次键
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { keys: [] };
  const col = db.collection('plans');
  if (event.action === 'set') {
    const keys = Array.isArray(event.keys) ? event.keys.filter(k => typeof k === 'string').slice(0, 500) : [];
    try { await col.doc(OPENID).set({ data: { keys, updatedAt: db.serverDate() } }); }
    catch (e) { try { await db.createCollection('plans'); } catch (x) {} await col.doc(OPENID).set({ data: { keys, updatedAt: db.serverDate() } }); }
    return { ok: true, n: keys.length };
  }
  try { const r = await col.doc(OPENID).get(); return { keys: r.data.keys || [] }; }
  catch (e) { return { keys: [] }; }
};
