// 个人排片：本地存储 + 云端按微信用户同步
const KEY = 'sk-plan-v1';
const touch = () => { try { require('./watched.js').touch('picks'); } catch (e) { } };
let cache = null;
const listeners = [];

function get() {
  if (!cache) { try { cache = new Set(wx.getStorageSync(KEY) || []); } catch (e) { cache = new Set(); } }
  return cache;
}
function save(push = true) {
  try { wx.setStorageSync(KEY, [...cache]); } catch (e) {}
  listeners.forEach(fn => fn(cache));
  if (push && wx.cloud) wx.cloud.callFunction({ name: 'plan', data: { action: 'set', keys: [...cache] } }).catch(() => {});
}
const unremind = k => { try { require('./remind.js').cancel({ kind: 'show', key: k }); } catch (e) { } };
function toggle(k) { const s = get(); if (s.has(k)) { s.delete(k); unremind(k); } else s.add(k); touch(); save();
  try { const d = getApp().globalData.data, sh = d && d.shows.find(x => [x.d, x.t, x.v, x.h].join('-') === k); require('./stats.js').stat(s.has(k) ? 'plan_add' : 'plan_remove', sh && sh.id); } catch (e) { }
  return s.has(k); }
function addMany(keys) { const s = get(); keys.forEach(k => s.add(k)); touch(); save(); }
function remove(k) { get().delete(k); unremind(k); touch(); save(); }
function clear() { const s = get(); [...s].forEach(unremind); s.clear(); touch(); save(); }
// 场次改期后整体换成新场次（utils/planchange.js）：和用户自己改一样更新修改时间，其他设备随同步一起更新
function migrate(keys) { cache = new Set(keys || []); touch(); save(); }
function replace(keys) { cache = new Set(keys || []); save(true); }
function onChange(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; }

// 旧版按 openid 的排片备份（plan 云函数）。现在个人排片随同步码档案（utils/sync.js）同步，删除也能同步；
// 这里以前是「云端与本地取并集」，网站上或别的设备上移出的场次会被旧备份加回来（2026-11-22 修复）。
// 现在只在本机还没有排片、也没有连上同步码时（换手机且没开同步）才用旧备份找回。
function syncFromCloud() {
  wx.cloud.callFunction({ name: 'plan', data: { action: 'get' } }).then(res => {
    const remote = (res.result && res.result.keys) || [];
    let code = ''; try { code = (wx.getStorageSync('sk-sync') || {}).code || ''; } catch (e) { }
    if (code || get().size || !remote.length) return;
    cache = new Set(remote); save(false);
  }).catch(() => {});
}

module.exports = { get, toggle, addMany, remove, clear, replace, migrate, onChange, syncFromCloud };
