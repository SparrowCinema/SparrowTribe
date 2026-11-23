// 我的海报（2026-11-23，与网站 js/core.js 的 filmArtwork / myPosterOf 规则一致）
// 影片资料里已有的图（poster / posterUrl / stills；本站同一张图的两种地址只算一张）中本人选的那张。
// 本机 storage「sk-poster-pick-v1」：{影片id:{u,t}|{del:1,t}}，随个人档案同步（shared/psync.js 的 pp，逐项取较新者）。
// 只用在影片页大海报、海报墙、观影结算长图、典藏票根默认票面图；片目、排片、专题页、分享海报仍用官方海报。
const KEY = 'sk-poster-pick-v1';
const SITE = 'https://sparrowcinema.org/';
let cache = null;
const listeners = [];
const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
// 同一张图的比对键：本站地址去掉站点前缀和 ?v=，站内相对路径去掉 ?v=；外站地址原样（网站同一规则）
const OLD_SITE = 'https://sparrowcinema.github.io/SparrowTribe/'; // 换域名前的站点地址，旧数据里的海报地址也要认
const key = u => { u = String(u || ''); for (const s of [SITE, OLD_SITE]) if (u.toLowerCase().indexOf(s.toLowerCase()) === 0) { u = u.slice(s.length); break; } return /^(posters|images)\//i.test(u) ? u.replace(/[?#].*$/, '') : u; };
const absolute = src => /^(posters|images)\//i.test(src) ? SITE + src : src;
// 可选的图（绝对地址，第一张是官方海报）
function artOf(f) {
  if (!f) return [];
  const seen = new Set();
  return [f.poster, f.posterUrl, ...(Array.isArray(f.stills) ? f.stills.map(s => typeof s === 'string' ? s : s && s.url) : [])]
    .filter(s => typeof s === 'string' && /^(https:\/\/|posters\/|images\/)/i.test(s))
    .filter(u => { const k = key(u); if (seen.has(k)) return false; seen.add(k); return true; }).map(absolute);
}
function all() { if (!cache) { try { cache = obj(wx.getStorageSync(KEY)); } catch (e) { cache = {}; } } return cache; }
function save(silent) { try { wx.setStorageSync(KEY, cache); } catch (e) { } if (!silent) listeners.forEach(fn => { try { fn(); } catch (e) { } }); }
// 本人选的、且不是官方海报的那张（绝对地址）；没选或选的已不在资料里时返回 ''，调用方照旧用官方海报
function pick(f) {
  const r = f && all()[f.id]; if (!r || r.del) return '';
  const arts = artOf(f), k = key(r.u), i = arts.findIndex(a => key(a) === k);
  return i > 0 ? arts[i] : '';
}
function set(f, u) {
  const arts = artOf(f); if (!f || !arts.length) return;
  all()[f.id] = !u || key(u) === key(arts[0]) ? { del: 1, t: Date.now() } : { u: key(u), t: Date.now() };
  save();
}
// 同步合并后整体替换（不触发同步回调）
function replaceAll(m) { cache = obj(m); save(true); }
function onChange(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; }
module.exports = { artOf, key, pick, set, all, replaceAll, onChange };
