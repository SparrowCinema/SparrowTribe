// 场次变更（2026-11-16，与网站规则一致）
// 本机 storage「sk-plan-memo-v1」记下每个已选场次的影片、日期时间、影院影厅：{场次键:{f,d,t,v,h,at}}，
// 个人排片变化和取到新数据时更新（数据里已不存在的键保留原记录）。
// 已选但最新排片里找不到、原定开场在 6 小时内或之后的场次，算作「有变动」：个人排片页顶部列出，
// 同一部影片还有别的待映场次时给出最接近的两场一键替换；「知道了」把旧场次移出个人排片。
const U = require('./util.js');
const plan = require('./plan.js');
const KEY = 'sk-plan-memo-v1', KM = 'sk-plan-moved-v1';
// 2026-11-18：先按场次变更记录（data.changes，来自网站 data/changes.json）自动处理——改期 / 换厅直接换成新场次并记入 sk-plan-moved-v1（个人排片页显示「已按最新排片更新」），
// 取消的场次写入 memo 并标 cancel，由下面的 list() 给出同片其他场次。记录里没有的变动才走原来的「本机记忆」办法。
const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const memo = () => { try { return obj(wx.getStorageSync(KEY)); } catch (e) { return {}; } };

function track(data) {
  if (!data || !data.shows) return;
  const m = memo(), byKey = new Map(data.shows.map(s => [U.keyOf(s), s])), out = {};
  const ch = data.changes || {}, moved = movedAll(), now = Date.now();
  let mig = false;
  const keys = [...plan.get()].map(k => {
    const c = ch[k]; if (!c) return k;
    const s0 = byKey.get(k); if (s0 && !(c.reused && m[k] && m[k].f && s0.id !== m[k].f)) return k;
    const w = c.was || {}, at = w.d ? U.showDate(w).getTime() : 0;
    if (c.to && byKey.has(c.to)) { moved[k] = { to: c.to, f: c.f, d: w.d, t: w.t, v: w.v, h: w.h, at }; mig = true; return c.to; }
    if (!c.to) { if (at >= now - 6 * 3600e3) m[k] = { f: c.f, d: w.d, t: w.t, v: w.v, h: w.h, at, cancel: 1 }; return k; }
    return k;
  });
  Object.keys(moved).forEach(k => { const s = byKey.get(moved[k].to); if (!s || U.showDate(s).getTime() < now - 3 * 3600e3) delete moved[k]; });
  try { wx.setStorageSync(KM, moved); } catch (e) { }
  if (mig) plan.migrate([...new Set(keys)]); // 会再触发一次 track（排片变化），那时已是新场次，不会重复迁移
  plan.get().forEach(k => { const s = byKey.get(k); if (s) out[k] = { f: s.id, d: s.d, t: s.t, v: s.v, h: s.h, at: U.showDate(s).getTime() }; else if (m[k]) out[k] = m[k]; });
  try { wx.setStorageSync(KEY, out); } catch (e) { }
}

// 返回有变动的场次 [{k,f,d,t,v,h,at,alts:[场次]}]
function list(data) {
  if (!data || !data.shows) return [];
  const m = memo(), keys = new Set(data.shows.map(U.keyOf)), picked = plan.get(), now = Date.now(), idx = U.index(data);
  return [...picked].filter(k => !keys.has(k) && m[k] && m[k].at && m[k].at >= now - 6 * 3600e3).map(k => {
    const g = Object.assign({ k }, m[k]);
    g.alts = data.shows.filter(s => s.id === g.f && !U.ended(s, idx) && !picked.has(U.keyOf(s)))
      .map(s => [s, (s.d === g.d ? 0 : 2e7) + (s.v === g.v ? 0 : 1e7) + Math.abs(U.showDate(s).getTime() - g.at) / 6e4])
      .sort((a, b) => a[1] - b[1]).slice(0, 2).map(x => x[0]);
    return g;
  }).sort((a, b) => a.at - b.at);
}

function movedAll() { try { return obj(wx.getStorageSync(KM)); } catch (e) { return {}; } }
// 已按变更记录自动换成新场次的 [{k,f,d,t,v,h,at,to,s(新场次)}]
function moved(data) {
  if (!data || !data.shows) return [];
  const byKey = new Map(data.shows.map(s => [U.keyOf(s), s])), mv = movedAll();
  return Object.keys(mv).map(k => Object.assign({ k, s: byKey.get(mv[k].to) }, mv[k])).filter(x => x.s).sort((a, b) => a.at - b.at);
}
function movedOk(k) { const mv = movedAll(); delete mv[k]; try { wx.setStorageSync(KM, mv); } catch (e) { } }
// 场次键按变更记录换成现在的场次键（分享链接用）
function resolve(data, k) { const ch = (data && data.changes) || {}, c = ch[k]; return c && c.to ? c.to : k; }
function swap(oldKey, newKey) { plan.remove(oldKey); if (!plan.get().has(newKey)) plan.toggle(newKey); }
function dismiss(k) { plan.remove(k); }

module.exports = { track, list, swap, dismiss, moved, movedOk, resolve };
