// 观影护照：看过 / 评分记录。本地存储 + 云端按微信用户同步（plan 云函数的 setWatched / get）。
// 记录：{ 影片id: { d:'YYYY-MM-DD', r:0–10（0 未评分）, k:场次键, t:更新时间 } }；删除时留 { del:1, t } 以便多设备合并。
const U = require('./util.js');
const KEY = 'sk-watched-v1', HOLDER = 'sk-holder', PHOTO = 'sk-holder-photo';
let cache = null;
const listeners = [];
const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

function all() {
  if (!cache) { try { cache = wx.getStorageSync(KEY) || {}; } catch (e) { cache = {}; } if (typeof cache !== 'object' || Array.isArray(cache)) cache = {}; }
  return cache;
}
function save(push = true) {
  try { wx.setStorageSync(KEY, cache); } catch (e) { }
  listeners.forEach(fn => fn(cache));
  if (push && wx.cloud) wx.cloud.callFunction({ name: 'plan', data: { action: 'setWatched', watched: cache } }).catch(() => { });
}
const get = id => { const r = all()[id]; return r && !r.del && r.d ? r : null; };
function set(id, rec) { const o = { d: rec.d, r: rec.r || 0, k: rec.k || '', t: Date.now() }; if (rec.f) o.f = rec.f; ['fun','bore'].forEach(k => { if (rec[k] !== undefined && rec[k] !== null && Number.isInteger(rec[k]) && rec[k] >= 0 && rec[k] <= 5) o[k] = rec[k]; }); if (Array.isArray(rec.v) && rec.v.length >= 2) o.v = rec.v; all()[id] = o; save(); }
// 影展间重复影片合并后，把旧 id 的观影记录并入新 id（旧记录留删除标记，便于多设备合并）
function migrate(aliases) {
  const c = all(); let ch = false;
  Object.keys(aliases || {}).forEach(o => { const n = aliases[o], r = c[o]; if (!r || r.del || !r.d) return; if (!c[n] || c[n].del || !c[n].d) c[n] = Object.assign({}, r, { t: Date.now() }); c[o] = { del: 1, t: Date.now() }; ch = true; });
  if (ch) save();
}
function remove(id) { all()[id] = { del: 1, t: Date.now() }; save(); }
function onChange(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; }

// 默认观影日期：优先已放映的个人排片场次，其次本片最近一场已放映场次，否则今天
function guess(id, data, idx, picked) {
  const past = data.shows.filter(s => s.id === id && U.ended(s, idx)).sort((a, b) => U.showDate(a) - U.showDate(b));
  const mine = past.filter(s => picked && picked.has(U.keyOf(s))), s = (mine.length ? mine : past).slice(-1)[0];
  return s ? { d: iso(U.showDate(s)), k: U.keyOf(s), r: 0 } : { d: iso(new Date()), k: '', r: 0 };
}
function showOf(rec, data) { const s = rec && rec.k && data.shows.find(x => U.keyOf(x) === rec.k); return s && iso(U.showDate(s)) === rec.d ? s : null; }
const vShort = v => v ? (v.short || (v.brand || v.name).replace(/^杭州/, '')) : '';
// 按观影日期排好的记录（含场次、影院简称）
function entries(data, idx) {
  const c = all();
  return Object.keys(c).filter(id => idx.F[id] && get(id)).map(id => {
    const rec = c[id], s = showOf(rec, data);
    return { id, f: idx.F[id], rec, s, venue: s ? vShort(idx.VN[s.v]) : '', venueFull: s ? idx.venueName(s) : '' };
  }).sort((a, b) => a.rec.d.localeCompare(b.rec.d) || (a.s && b.s ? U.showDate(a.s) - U.showDate(b.s) : 0) || a.id.localeCompare(b.id));
}
// 个人档案各项的最后修改时间（同步用）：{ holder, photo, picks }
const META = 'sk-profile-meta';
function meta() { try { return wx.getStorageSync(META) || {}; } catch (e) { return {}; } }
function touch(k) { try { const m = meta(); m[k] = Date.now(); wx.setStorageSync(META, m); } catch (e) { } }
function setMeta(m) { try { wx.setStorageSync(META, m || {}); } catch (e) { } }
function replaceAll(obj) { cache = obj && typeof obj === "object" ? obj : {}; save(true); }
function photo() { try { return wx.getStorageSync(PHOTO) || ''; } catch (e) { return ''; } }
function setPhoto(v, quiet) { try { wx.setStorageSync(PHOTO, v || ''); if (!quiet) touch('photo'); } catch (e) { } }
function holder() { try { return wx.getStorageSync(HOLDER) || ''; } catch (e) { return ''; } }
function setHolder(v, quiet) { try { wx.setStorageSync(HOLDER, String(v || '').trim().slice(0, 20)); if (!quiet) touch('holder'); } catch (e) { } }

// 启动时与云端合并：同一部影片取更新时间较新的那条
function syncFromCloud() {
  wx.cloud.callFunction({ name: 'plan', data: { action: 'get' } }).then(res => {
    const remote = (res.result && res.result.watched) || {}, c = all();
    let changed = false;
    Object.keys(remote).forEach(id => { const r = remote[id]; if (r && (r.d || r.del) && (!c[id] || (r.t || 0) > (c[id].t || 0))) { c[id] = r; changed = true; } });
    const localNewer = Object.keys(c).some(id => !remote[id] || (c[id].t || 0) > (remote[id].t || 0));
    if (changed || localNewer) save(localNewer); else listeners.forEach(fn => fn(cache));
  }).catch(() => { });
}

module.exports = { migrate, all, get, set, remove, onChange, guess, showOf, entries, iso, vShort, holder, setHolder, photo, setPhoto, meta, touch, setMeta, replaceAll, syncFromCloud };
