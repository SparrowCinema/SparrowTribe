// 想看（2026-11-16，与网站 sparrow-want-v1 规则一致）
// 本机 storage「sk-want-v1」：{影片id:{t}|{del:1,t}}，随个人档案同步（shared/psync.js 的 want，逐项取较新者）。
// 看过（盖章）后自动不再算想看。「sk-want-seen-v1」只存本机：{影片id:[已见过的待映场次键]}，
// 想看的影片出现没见过的待映场次时，片目卡片标「新场次」；打开影片页即算看过。
const W = require('./watched.js');
const KEY = 'sk-want-v1', SEEN = 'sk-want-seen-v1';
let cache = null, seen = null;
const listeners = [];
const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

function all() { if (!cache) { try { cache = obj(wx.getStorageSync(KEY)); } catch (e) { cache = {}; } } return cache; }
function seenMap() { if (!seen) { try { seen = obj(wx.getStorageSync(SEEN)); } catch (e) { seen = {}; } } return seen; }
function save(silent) { try { wx.setStorageSync(KEY, cache); } catch (e) { } if (!silent) listeners.forEach(fn => { try { fn(); } catch (e) { } }); }

function isOn(id) { const r = all()[id]; return !!(r && !r.del) && !W.get(id); }
// upKeys：这部影片当前的待映场次键（调用方按排片数据算好传入）
function newCount(id, upKeys) { if (!isOn(id)) return 0; const s = new Set(seenMap()[id] || []); return (upKeys || []).filter(k => !s.has(k)).length; }
function markSeen(id, upKeys) {
  if (!isOn(id)) return; const ks = (upKeys || []).slice(0, 200), m = seenMap();
  if (JSON.stringify(m[id] || []) === JSON.stringify(ks)) return;
  m[id] = ks; try { wx.setStorageSync(SEEN, m); } catch (e) { }
}
function set(id, on, upKeys) { all()[id] = on ? { t: Date.now() } : { del: 1, t: Date.now() }; save(); if (on) markSeen(id, upKeys); }
// 同步合并后整体替换（不触发同步回调，避免来回推送）
function replaceAll(m) { cache = obj(m); save(true); }
function onChange(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; }

module.exports = { all, isOn, set, newCount, markSeen, replaceAll, onChange };
