/* 影院排片面板（2026-11-26）：「影院地图与交通」页点开一家影院，看这家影院在本专题的影片与排片。
   网站 js/programmes.js 直接加载；小程序副本 miniprogram/utils/venue-board.js 由 tools/build-fallback.js 复制，不要直接改小程序那份。
   board(shows, o)
     shows：本专题在这家影院的场次（原始场次对象，顺序不限）
     o.film(id)  → 影片对象；找不到影片的场次跳过
     o.start(s)  → 开场毫秒；o.past(s) → 是否已散场（与排片表「已散场」一致）
     o.day(s)    → 日期键，默认 s.d
     o.pick      → 当前筛选 {film:'影片id'|'', day:'日期键'|''|undefined}
                   day 为 undefined（没选过）时按默认规则：待映场次超过 o.allMax（默认 24）场时只看最近一天，否则看全部日期；
                   day 为 '' 表示用户选了「全部日期」；所选影片 / 日期已经不存在时自动回到默认
   返回：
     只显示即将放映和正在放映的影片与场次（2026-11-26 用户要求）：已散场的场次、在这家影院已全部放完的影片都不列
     films   [{id, n 待映场次数, next 下一场}]，按下一场先后；活动场次（影片带 ev）不列
     filmN   有待映场次的影片数（不含活动）；upN 待映场次数（含活动，不受筛选影响）；pastN 已散场场次数（只作统计，不显示）
     film / day  实际生效的筛选（'' 为全部）
     days    [{key, n, first}] 待映日期（已按所选影片筛过），first 为当天第一场，用来显示日期与星期
     up      [{key, first, shows:[…]}] 待映场次按日期分组，时间先后；已按影片和日期筛过
     upShown 筛选后的待映场次数 */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.SparrowVenueBoard = factory(); })(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var ALL_MAX = 24;
  function group(list, day) {
    var out = [], at = {};
    list.forEach(function (s) {
      var k = String(day(s)), g = at[k];
      if (!g) { g = at[k] = { key: k, first: s, shows: [] }; out.push(g); }
      g.shows.push(s);
    });
    return out;
  }
  function board(shows, o) {
    o = o || {};
    var film = o.film || function () { return null; }, start = o.start, day = o.day || function (s) { return s.d; };
    var pick = o.pick || {}, allMax = o.allMax == null ? ALL_MAX : o.allMax;
    var list = (shows || []).filter(function (s) { return !!film(s.id); }).map(function (s) { return { s: s, t: start(s), past: !!o.past(s) }; });
    list.sort(function (a, b) { return a.t - b.t; });
    var up = [], gone = [], byFilm = {}, order = [];
    list.forEach(function (x) {
      if (x.past) { gone.push(x.s); return; }
      up.push(x.s);
      if (film(x.s.id).ev) return;
      var m = byFilm[x.s.id];
      if (!m) { m = byFilm[x.s.id] = { id: x.s.id, n: 0, next: x.s }; order.push(m); }
      m.n++;
    });
    var films = order; // 场次已按开场先后排好，影片顺序即下一场先后
    var fsel = pick.film && byFilm[pick.film] ? pick.film : '';
    var upF = up.filter(function (s) { return !fsel || s.id === fsel; });
    var days = group(upF, day).map(function (g) { return { key: g.key, n: g.shows.length, first: g.first }; });
    var dsel = '';
    if (pick.day && days.some(function (d) { return d.key === pick.day; })) dsel = pick.day;
    else if (pick.day !== '' && !fsel && upF.length > allMax && days.length > 1) dsel = days[0].key;
    var shown = upF.filter(function (s) { return !dsel || String(day(s)) === dsel; });
    return {
      films: films, filmN: films.length, upN: up.length, pastN: gone.length,
      film: fsel, day: dsel, days: days,
      up: group(shown, day), upShown: shown.length
    };
  }
  return { board: board, ALL_MAX: ALL_MAX };
});
