/* 由 tools/build-fallback.js 从 shared/psync.js 复制，请改 shared/psync.js 后重新运行。 */
/* 麻雀观影护照 · 个人档案云端同步（同步码，不用注册）
   网站（window.SparrowSync）、小程序（utils/psync.js）、psync 云函数共用同一份合并规则。
   档案 = { v:1, watched:{影片id:{d,r,k,t}|{del:1,t}}, holder:{n,t}, photo:{d,t}, picks:{k:[场次键],t}, want:{影片id:{t}|{del:1,t}},
          tix:{"影片id|观影日期[|第N次]":{t, 只存改过的字段}|{del:1,t}}（票根收藏册，2026-11-21）,
          art:{d:{s,t}, f:{影片id:{s,t}|{del:1,t}}}（票根手绘风格：收藏册默认 + 按影片单独选的，2026-11-21） }
   每一项都带更新时间 t，合并时同一项取较新的一份（删除用 {del:1,t} 留痕），所以不需要“上次同步的副本”，
   两台设备各自改了不同的片子会全部保留，改了同一部片子则以最后一次修改为准。 */
(function (root) {
  'use strict';
  var Taste=typeof module!=='undefined'&&module.exports?require('./taste.js'):root.SparrowTaste;
  var B32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  // rnd(n) 返回 n 个 0–255 的随机数；网站用 crypto.getRandomValues，云函数用 crypto.randomBytes
  function newCode(rnd) { var b = rnd(24), s = ''; for (var i = 0; i < b.length; i++) s += B32[b[i] % 32]; return 'SP-' + s.match(/.{4}/g).join('-'); }
  function normalize(input) {
    var raw = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^SP/, '');
    return raw.length === 24 && /^[A-Z2-9]+$/.test(raw) ? 'SP-' + raw.match(/.{4}/g).join('-') : '';
  }
  var num = function (x) { return Number.isFinite(+x) ? +x : 0; };
  // 票根收藏册（2026-11-21）：票根是某一次观影的「皮肤」，只存用户改过的字段（款式 l、座位 st、裁切 c、票面图 a、手绘 sk、开场 tm、影院 vn、影厅 hl、城市 cy、版本 fm）和典藏编号 n。
  // 键 = 影片id|观影日期，同一天看第二次加 |2；没有观影记录的手工票根也用同样的键。shared/tickets.js 复用这里的清洗规则。
  var TIX_KEY = /^[\w-]{1,80}\|\d{4}-\d{2}-\d{2}(\|[2-9])?$/, TIX_LOOK = /^[a-z]{2,12}(\.[a-z]{2,12}){3}$/;
  var TIX_FIELDS = { tm: 5, vn: 160, hl: 80, cy: 60, st: 36, fm: 60, a: 400 };
  function cleanTixEntry(e) {
    if (!e || typeof e !== 'object') return null;
    var t = num(e.t); if (e.del) return { del: 1, t: t };
    var out = { t: t };
    Object.keys(TIX_FIELDS).forEach(function (k) { if (typeof e[k] === 'string' && e[k].trim()) out[k] = e[k].trim().slice(0, TIX_FIELDS[k]); });
    if (out.tm && !/^\d{2}:\d{2}$/.test(out.tm)) delete out.tm;
    if (out.a && !/^(https:\/\/|posters\/|images\/|\/images\/)/i.test(out.a)) delete out.a;
    if (typeof e.c === 'number' && isFinite(e.c)) { var c = Math.max(0, Math.min(100, Math.round(e.c))); if (c !== 50) out.c = c; }
    if (e.sk === 1) out.sk = 1;
    // 典藏编号（2026-11-22）：15 位，字母表同同步码（没有 I O 0 1），校验由 shared/tickets.js 负责
    if (typeof e.n === 'string' && /^[A-HJ-NP-Z2-9]{15}$/.test(e.n)) out.n = e.n;
    // 发行序号（2026-11-22）：本片第几张典藏，由 Supabase tk_issue 统一发号
    if (Number.isInteger(e.q) && e.q > 0 && e.q < 1e8) out.q = e.q;
    // 典藏玩法（2026-11-22）：sh＝绑定的场次编号（"-"＝后端还不支持场次），sq＝本场第几张，o＝封版总数（0 也有效）
    if (typeof e.sh === 'string' && /^(-|[A-Za-z0-9_:\/.-]{1,120})$/.test(e.sh)) out.sh = e.sh;
    if (Number.isInteger(e.sq) && e.sq > 0 && e.sq < 1e8) out.sq = e.sq;
    if (Number.isInteger(e.o) && e.o >= 0 && e.o < 1e8) out.o = e.o;
    // 现场认证时间（毫秒，服务器记录）
    if (Number.isInteger(e.ci) && e.ci > 1e12 && e.ci < 1e14) out.ci = e.ci;
    if (typeof e.l === 'string' && TIX_LOOK.test(e.l)) out.l = e.l;
    // 工艺组合（2026-11-22）：烫印增效-海报隐形工艺[背面隐形工艺][盲文][可变数据烫印]，见 shared/tickets.js 的 CRAFT_RE；只在改过时才存
    if (typeof e.x === 'string' && /^[sgch]{0,2}-[0urokbdwpqmlinacefghjstxyz][urokbdwpqmlinacefghjstxyz]?[Bv]{0,2}$/.test(e.x)) out.x = e.x;
    return out;
  }
  function cleanTix(raw) {
    var out = {}; if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    Object.keys(raw).slice(0, 12000).forEach(function (k) { if (!TIX_KEY.test(k)) return; var e = cleanTixEntry(raw[k]); if (e) out[k] = e; });
    return out;
  }
  // 票根手绘风格（2026-11-21）：d＝收藏册默认风格，f＝按影片单独选的风格；风格名由客户端 ticket-sketch.js 校验和换算，这里只检查格式
  var ART_STYLE = /^[a-z][a-z-]{1,23}$/;
  function cleanArt(raw) {
    var out = { d: { s: '', t: 0 }, f: {} };
    if (!raw || typeof raw !== 'object') return out;
    if (raw.d && typeof raw.d === 'object') out.d = { s: ART_STYLE.test(String(raw.d.s || '')) ? raw.d.s : '', t: num(raw.d.t) };
    var f = raw.f && typeof raw.f === 'object' ? raw.f : {};
    Object.keys(f).slice(0, 12000).forEach(function (id) {
      var e = f[id]; if (!/^[\w-]{1,80}$/.test(id) || !e || typeof e !== 'object') return;
      if (e.del) out.f[id] = { del: 1, t: num(e.t) };
      else if (ART_STYLE.test(String(e.s || ''))) out.f[id] = { s: e.s, t: num(e.t) };
    });
    return out;
  }
  function mergeArt(a, b) {
    a = cleanArt(a); b = cleanArt(b);
    var out = { d: b.d.t > a.d.t ? b.d : a.d, f: {} };
    Object.keys(a.f).concat(Object.keys(b.f)).forEach(function (id) { var x = a.f[id], y = b.f[id]; out.f[id] = !x ? y : !y ? x : (y.t > x.t ? y : x); });
    return out;
  }
  // 同一张票根取较新的一份；典藏编号 n、发行序号 q 一旦有了就不能被丢掉（2026-11-22）：
  // 旧版代码不认识这两个字段，会把它们清掉但保留修改时间，新代码按丢了编号的票根重新推算出另一个编号、再领一个号（「本片第 2 张」）。
  // 所以较新的那份缺 n / q、另一份（都不是删除标记）有时，从另一份补回来；q 只在两份的编号一致时补。
  function mergeTix(a, b) {
    var out = {};
    Object.keys(a).concat(Object.keys(b)).forEach(function (k) {
      var x = a[k], y = b[k], r = !x ? y : !y ? x : (y.t > x.t ? y : x);
      if (x && y && r && !r.del) {
        var o = r === x ? y : x;
        if (o && !o.del && ((!r.n && o.n) || (!r.q && o.q) || ((!r.sh || r.sh === '-') && o.sh && o.sh !== '-') || (!r.sq && o.sq) || (r.o === undefined && o.o !== undefined) || (!r.ci && o.ci))) {
          var add = {};
          if (!r.n && o.n) add.n = o.n;
          var n = r.n || add.n;
          // 序号、场次绑定、封版总数都是服务器按典藏编号给的，只在编号一致时补
          if (n && n === o.n) {
            if (!r.q && o.q) add.q = o.q;
            if ((!r.sh || r.sh === '-') && o.sh && o.sh !== '-') { add.sh = o.sh; if (o.sq) add.sq = o.sq; }
            else if (!r.sq && o.sq && r.sh === o.sh) add.sq = o.sq;
            if (r.o === undefined && o.o !== undefined) add.o = o.o;
            if (!r.ci && o.ci) add.ci = o.ci;
          }
          if (Object.keys(add).length) r = Object.assign({}, r, add);
        }
      }
      out[k] = r;
    });
    return out;
  }
  // 我的海报（2026-11-23）：{影片id:{u:图片地址,t}|{del:1,t}}，每部影片只记选了哪张（地址），逐项取较新者；
  // 只在本人的影片页、海报墙、观影结算、典藏票根默认图里生效，地址须是该片资料里已有的图（客户端再核对一次）
  function cleanPP(d) {
    var out = {}; if (!d || typeof d !== 'object' || Array.isArray(d)) return out;
    Object.keys(d).slice(0, 5000).forEach(function (id) {
      var r = d[id]; if (!/^[\w-]{1,80}$/.test(id) || !r || typeof r !== 'object') return;
      if (r.del) { out[id] = { del: 1, t: num(r.t) }; return; }
      if (typeof r.u === 'string' && r.u.length <= 400 && /^(posters\/|images\/|https:\/\/)/i.test(r.u)) out[id] = { u: r.u, t: num(r.t) };
    });
    return out;
  }
  function mergePP(a, b) {
    a = cleanPP(a); b = cleanPP(b); var out = {};
    Object.keys(a).concat(Object.keys(b)).forEach(function (id) { var x = a[id], y = b[id]; out[id] = !x ? y : !y ? x : (y.t > x.t ? y : x); });
    return out;
  }
  function clean(d) {
    var out = { v: 1, watched: {}, holder: { n: '', t: 0 }, photo: { d: '', t: 0 }, picks: { k: [], t: 0 }, want: {}, tix: {}, art: cleanArt(null), pp: {} };
    if (!d || typeof d !== 'object') return out;
    out.pp = cleanPP(d.pp);
    out.tix = cleanTix(d.tix);
    out.art = cleanArt(d.art);
    var w = d.watched && typeof d.watched === 'object' ? d.watched : {};
    Object.keys(w).slice(0, 12000).forEach(function (id) {
      var r = w[id]; if (!/^[\w-]{1,80}$/.test(id) || !r || typeof r !== 'object') return;
      var t = num(r.t);
      if (r.del) { out.watched[id] = { del: 1, t: t }; return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.d || ''))) return;
      out.watched[id] = { d: r.d, r: Math.max(0, Math.min(10, Math.round(num(r.r)))), k: typeof r.k === 'string' ? r.k.slice(0, 80) : '', t: t };
      // 放映版本（可选，如 4k / 35mm / imax-gt）；没有就不写这个键，旧记录保持原样
      if (typeof r.f === 'string' && /^[\w-]{1,20}$/.test(r.f)) out.watched[id].f = r.f;
      Object.assign(out.watched[id],Taste.cleanFields(r));
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
    // 想看（2026-11-16）：{影片id:{t}|{del:1,t}}，和看过一样逐项取较新者；旧版本没有这个字段时为空，不会删掉别处的记录
    var wt = d.want && typeof d.want === 'object' ? d.want : {};
    Object.keys(wt).slice(0, 5000).forEach(function (id) {
      var r = wt[id]; if (!/^[\w-]{1,80}$/.test(id) || !r || typeof r !== 'object') return;
      out.want[id] = r.del ? { del: 1, t: num(r.t) } : { t: num(r.t) };
    });
    return out;
  }
  function merge(a, b) {            // a = 本机，b = 云端；同一项取较新者，时间相同取本机
    a = clean(a); b = clean(b);
    var out = { v: 1, watched: {}, holder: null, photo: null, picks: null, want: {}, tix: mergeTix(a.tix, b.tix), art: mergeArt(a.art, b.art), pp: mergePP(a.pp, b.pp) };
    Object.keys(a.watched).concat(Object.keys(b.watched)).forEach(function (id) {
      var x = a.watched[id], y = b.watched[id]; out.watched[id] = !x ? y : !y ? x : Taste.mergeFields(x,y,y.t>x.t?y:x);
    });
    Object.keys(a.want).concat(Object.keys(b.want)).forEach(function (id) {
      var x = a.want[id], y = b.want[id]; out.want[id] = !x ? y : !y ? x : (y.t > x.t ? y : x);
    });
    ['holder', 'photo', 'picks'].forEach(function (k) { out[k] = b[k].t > a[k].t ? b[k] : a[k]; });
    return out;
  }
  var same = function (a, b) { return JSON.stringify(clean(a)) === JSON.stringify(clean(b)); };
  var api = { newCode: newCode, normalize: normalize, clean: clean, merge: merge, same: same, cleanTix: cleanTix, cleanTixEntry: cleanTixEntry, mergeTix: mergeTix, TIX_KEY: TIX_KEY, cleanArt: cleanArt, mergeArt: mergeArt, cleanPP: cleanPP, mergePP: mergePP };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SparrowSync = api;
})(typeof window !== 'undefined' ? window : this);
