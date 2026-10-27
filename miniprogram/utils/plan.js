// 个人排片：本地存储 + 云端按微信用户同步
const KEY = 'sk-plan-v1';
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
function toggle(k) { const s = get(); if (s.has(k)) s.delete(k); else s.add(k); save(); return s.has(k); }
function addMany(keys) { const s = get(); keys.forEach(k => s.add(k)); save(); }
function remove(k) { get().delete(k); save(); }
function clear() { get().clear(); save(); }
function onChange(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; }

// 启动时合并云端与本地（取并集），换手机也能找回排片
function syncFromCloud() {
  wx.cloud.callFunction({ name: 'plan', data: { action: 'get' } }).then(res => {
    const remote = (res.result && res.result.keys) || [];
    const s = get(); const before = s.size;
    remote.forEach(k => s.add(k));
    save(s.size !== remote.length || before !== s.size);
  }).catch(() => {});
}

module.exports = { get, toggle, addMany, remove, clear, onChange, syncFromCloud };
