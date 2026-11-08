/* 麻雀观影护照 · 个人档案云端同步（同步码，不用注册）
   网站（window.SparrowSync）、小程序（utils/psync.js）、psync 云函数共用同一份合并规则。
   档案 = { v:1, watched:{影片id:{d,r,k,t}|{del:1,t}}, holder:{n,t}, photo:{d,t}, picks:{k:[场次键],t} }
   每一项都带更新时间 t，合并时同一项取较新的一份（删除用 {del:1,t} 留痕），所以不需要“上次同步的副本”，
   两台设备各自改了不同的片子会全部保留，改了同一部片子则以最后一次修改为准。 */
(function (root) {
  'use strict';
  var B32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  // rnd(n) 返回 n 个 0–255 的随机数；网站用 crypto.getRandomValues，云函数用 crypto.randomBytes
  function newCode(rnd) { var b = rnd(24), s = ''; for (var i = 0; i < b.length; i++) s += B32[b[i] % 32]; return 'SP-' + s.match(/.{4}/g).join('-'); }
  function normalize(input) {
    var raw = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^SP/, '');
    return raw.length === 24 && /^[A-Z2-9]+$/.test(raw) ? 'SP-' + raw.match(/.{4}/g).join('-') : '';
  }
  var num = function (x) { return Number.isFinite(+x) ? +x : 0; };
  function clean(d) {
    var out = { v: 1, watched: {}, holder: { n: '', t: 0 }, photo: { d: '', t: 0 }, picks: { k: [], t: 0 } };
    if (!d || typeof d !== 'object') return out;
    var w = d.watched && typeof d.watched === 'object' ? d.watched : {};
    Object.keys(w).slice(0, 12000).forEach(function (id) {
      var r = w[id]; if (!/^[\w-]{1,80}$/.test(id) || !r || typeof r !== 'object') return;
      var t = num(r.t);
      if (r.del) { out.watched[id] = { del: 1, t: t }; return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.d || ''))) return;
      out.watched[id] = { d: r.d, r: Math.max(0, Math.min(10, Math.round(num(r.r)))), k: typeof r.k === 'string' ? r.k.slice(0, 80) : '', t: t };
      // 放映版本（可选，如 4k / 35mm / imax-gt）；没有就不写这个键，旧记录保持原样
      if (typeof r.f === 'string' && /^[\w-]{1,20}$/.test(r.f)) out.watched[id].f = r.f;
      ['fun','bore'].forEach(function (k) { if (r[k] !== null && r[k] !== undefined && Number.isInteger(r[k]) && r[k] >= 0 && r[k] <= 5) out.watched[id][k] = r[k]; });
      // 多次观影（可选）：第 1 次起的完整列表，≥2 次才写；顶层 d/k/f/r 由客户端保持一致
      if (Array.isArray(r.v)) {
        var vs = r.v.slice(0, 30).map(function (x) {
          if (!x || !/^\d{4}-\d{2}-\d{2}$/.test(String(x.d || ''))) return null;
          var o = { d: x.d, r: Math.max(0, Math.min(10, Math.round(num(x.r)))), k: typeof x.k === 'string' ? x.k.slice(0, 80) : '' };
          if (typeof x.f === 'string' && /^[\w-]{1,20}$/.test(x.f)) o.f = x.f; return o;
        }).filter(Boolean).sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
        if (vs.length >= 2) out.watched[id].v = vs;
      }
    });
    if (d.holder && typeof d.holder.n === 'string') out.holder = { n: d.holder.n.slice(0, 20), t: num(d.holder.t) };
    if (d.photo && typeof d.photo.d === 'string' && (d.photo.d === '' || (/^data:image\/jpeg;base64,/.test(d.photo.d) && d.photo.d.length < 400000))) out.photo = { d: d.photo.d, t: num(d.photo.t) };
    if (d.picks && Array.isArray(d.picks.k)) out.picks = { k: d.picks.k.filter(function (k) { return typeof k === 'string' && k.length <= 80; }).slice(0, 2000), t: num(d.picks.t) };
    return out;
  }
  function merge(a, b) {            // a = 本机，b = 云端；同一项取较新者，时间相同取本机
    a = clean(a); b = clean(b);
    var out = { v: 1, watched: {}, holder: null, photo: null, picks: null };
    Object.keys(a.watched).concat(Object.keys(b.watched)).forEach(function (id) {
      var x = a.watched[id], y = b.watched[id]; out.watched[id] = !x ? y : !y ? x : (y.t > x.t ? y : x);
    });
    ['holder', 'photo', 'picks'].forEach(function (k) { out[k] = b[k].t > a[k].t ? b[k] : a[k]; });
    return out;
  }
  var same = function (a, b) { return JSON.stringify(clean(a)) === JSON.stringify(clean(b)); };
  var api = { newCode: newCode, normalize: normalize, clean: clean, merge: merge, same: same };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SparrowSync = api;
})(typeof window !== 'undefined' ? window : this);
