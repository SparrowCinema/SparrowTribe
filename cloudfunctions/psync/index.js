// 个人档案同步码同步：小程序通过本云函数读写 Supabase（与网站、米其林全球名录共用同一个后端）。
// 合并规则见 psync.js（由 tools/build-fallback.js 从 shared/psync.js 复制，请勿直接改）。
// action: 'new' → 生成同步码；'sync' { code, state } → 与云端合并并返回合并结果；
//         'issue' { items } → 典藏票根发行序号（tk_issue）；'edition' { items } → 封版总数（tk_edition）；'checkin' { item } → 现场认证（tk_checkin）；
//         'wx' → 用微信登录身份（openid）取得/创建该用户绑定的同步码；'bind' { code } → 把该微信绑定到指定同步码（与网站已有档案合并用）。
const cloud = require('wx-server-sdk');
const https = require('https');
const crypto = require('crypto');
const S = require('./psync.js');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const HOST = 'dclxhxxjktegyiwafmsv.supabase.co';
const KEY = 'sb_publishable_2K9O3h8nn2I_I-cIAdks8A_QZ98xwZ2'; // 可公开的 publishable key

function rpc(fn, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({ host: HOST, path: '/rest/v1/rpc/' + fn, method: 'POST',
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, res => {
      let b = ''; res.setEncoding('utf8');
      res.on('data', c => { b += c; });
      res.on('end', () => {
        let j = null; try { j = JSON.parse(b); } catch (e) { }
        if (res.statusCode >= 300) return reject(new Error((j && j.message) || ('HTTP ' + res.statusCode)));
        resolve(j);
      });
    });
    req.setTimeout(8000, () => req.destroy(new Error('timeout')));
    req.on('error', reject); req.write(data); req.end();
  });
}

const db = cloud.database();
const col = db.collection('psync_bind');
async function getBind(OPENID) { try { const r = await col.doc(OPENID).get(); return r.data && r.data.code || ''; } catch (e) { return ''; } }
async function setBind(OPENID, code) {
  const data = { code, at: Date.now() };
  try { await col.doc(OPENID).set({ data }); }
  catch (e) { try { await db.createCollection('psync_bind'); } catch (x) { } await col.doc(OPENID).set({ data }); }
}

exports.main = async (event) => {
  if (event.action === 'wx' || event.action === 'bind') {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) return { ok: false, msg: 'no openid' };
    try {
      if (event.action === 'bind') { const c = S.normalize(event.code); if (!c) return { ok: false, msg: 'bad code' }; await setBind(OPENID, c); return { ok: true, code: c }; }
      let code = S.normalize(await getBind(OPENID));
      if (!code) { code = S.newCode(n => Array.from(crypto.randomBytes(n))); await setBind(OPENID, code); }
      return { ok: true, code };
    } catch (e) { return { ok: false, msg: String((e && e.message) || e) }; }
  }
  // 'issue' { items:[{s,f}] }：典藏票根发行序号，转发给 Supabase 的 tk_issue（backend/tickets-issue-v1.sql）；不带 openid
  if (event.action === 'issue') {
    const items = (Array.isArray(event.items) ? event.items : []).slice(0, 50)
      .filter(x => x && /^[A-HJ-NP-Z2-9]{15}$/.test(String(x.s || '')) && /^[\w-]{1,80}$/.test(String(x.f || '')))
      // h：场次编号（场次限定「本场第几张」，backend/tickets-collect-v1.sql）
      .map(x => /^[\w:\/.-]{1,120}$/.test(String(x.h || '')) ? { s: String(x.s), f: String(x.f), h: String(x.h) } : { s: String(x.s), f: String(x.f) });
    if (!items.length) return { ok: false, msg: 'bad items' };
    try { const r = await rpc('tk_issue', { items }); return { ok: true, items: Array.isArray(r) ? r : [] }; }
    catch (e) { return { ok: false, msg: String((e && e.message) || e) }; }
  }
  // 'checkin' { item:{s,f,h,w,k} }：现场认证，转发给 tk_checkin（backend/tickets-checkin-v1.sql）；签到码由服务器校验，不带 openid
  if (event.action === 'checkin') {
    const it = event.item || {};
    if (!/^[A-HJ-NP-Z2-9]{15}$/.test(String(it.s || '')) || !/^[\w-]{1,80}$/.test(String(it.f || '')) || !/^[\w:\/.-]{1,120}$/.test(String(it.h || ''))
      || !/^\d{1,12}$/.test(String(it.w || '')) || !/^[0-9a-f]{12}$/i.test(String(it.k || ''))) return { ok: false, reason: 'bad' };
    try { const r = await rpc('tk_checkin', { item: { s: String(it.s), f: String(it.f), h: String(it.h), w: Number(it.w), k: String(it.k).toLowerCase() } }); return r && typeof r === 'object' ? r : { ok: false, reason: 'offline' }; }
    catch (e) { return { ok: false, reason: 'offline', msg: String((e && e.message) || e) }; }
  }
  // 'edition' { items:[{f,c}] }：已封版影片的发行总数，转发给 tk_edition（backend/tickets-collect-v1.sql）；不带 openid
  if (event.action === 'edition') {
    const items = (Array.isArray(event.items) ? event.items : []).slice(0, 100)
      .filter(x => x && /^[\w-]{1,80}$/.test(String(x.f || '')) && !isNaN(Date.parse(String(x.c || ''))))
      .map(x => ({ f: String(x.f), c: String(x.c) }));
    if (!items.length) return { ok: false, msg: 'bad items' };
    try { const r = await rpc('tk_edition', { items }); return { ok: true, items: Array.isArray(r) ? r : [] }; }
    catch (e) { return { ok: false, msg: String((e && e.message) || e) }; }
  }
  // 'stat' { vid, evs }：匿名使用统计，转发给 Supabase 的 ss_hit（backend/stats-v1.sql）；不带 openid
  if (event.action === 'stat') {
    const vid = String(event.vid || ''), evs = Array.isArray(event.evs) ? event.evs.slice(0, 60) : [];
    if (!/^[a-z0-9]{8,32}$/.test(vid) || !evs.length) return { ok: false, msg: 'bad stat' };
    try { const n = await rpc('ss_hit', { p: 'mini', vid, evs }); return { ok: true, n }; } catch (e) { return { ok: false, msg: String((e && e.message) || e) }; }
  }
  if (event.action === 'new') return { ok: true, code: S.newCode(n => Array.from(crypto.randomBytes(n))) };
  if (event.action === 'sync') {
    const code = S.normalize(event.code);
    if (!code) return { ok: false, msg: 'bad code' };
    const mine = S.clean(event.state);
    try {
      let merged, rev;
      for (let i = 0; i < 4; i++) {
        const remote = await rpc('mg_pull', { code });
        merged = remote.data ? S.merge(mine, remote.data) : mine;
        if (remote.data && S.same(merged, remote.data)) { rev = remote.rev; break; }
        const r = await rpc('mg_push', { code, data: merged, base_rev: remote.rev || 0 });
        if (r.ok) { rev = r.rev; break; }
      }
      if (rev === undefined) return { ok: false, msg: 'busy' };
      return { ok: true, merged, rev, changed: !S.same(merged, mine) };
    } catch (e) { return { ok: false, msg: String((e && e.message) || e) }; }
  }
  return { ok: false, msg: 'unknown action' };
};
