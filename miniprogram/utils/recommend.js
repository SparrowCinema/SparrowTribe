/* 麻雀观影护照 · 看完再推荐（纯客户端，网站与小程序共用）。
   按同导演、同单元、同专题、趣味图谱近邻、类型/地区/年代综合评分，并优先推荐仍有未放映场次、尚未看过且不与个人排片冲突的影片。 */
(function (root) {
  'use strict';

  function splitNames(s) {
    return String(s || '').split(/[\/、,，&＆]/).map(function (x) { return x.trim().toLowerCase(); }).filter(function (x) { return x.length >= 2; });
  }

  function dirSet(f) {
    var out = {};
    splitNames(f && f.dir).concat(splitNames(f && f.coDirector)).forEach(function (n) { out[n] = 1; });
    return out;
  }

  function tastePoint(id, watched, tasteGet) {
    var r = watched && watched[id];
    if (r && !r.del && Number.isFinite(+r.fun) && Number.isFinite(+r.bore)) return [Number(r.fun), Number(r.bore)];
    var c = tasteGet ? tasteGet(id) : null;
    if (c && c.funAvg != null && c.boreAvg != null) return [Number(c.funAvg), Number(c.boreAvg)];
    return null;
  }

  function forFilm(film, ctx, limit) {
    if (!film || film.ev) return [];
    ctx = ctx || {};
    limit = limit || 4;
    var films = (ctx.films || []).filter(function (x) { return x && !x.ev && x.id !== film.id; });
    if (!films.length) return [];
    var shows = ctx.shows || [];
    var isPast = ctx.isPast || function () { return false; };
    var keyOf = ctx.keyOf || function (s) { return s.k || ''; };
    var showDate = ctx.showDate || function () { return 0; };
    var watched = ctx.watched || {};
    var want = ctx.want || {};
    var picked = ctx.picked || new Set();
    var tasteGet = ctx.tasteGet || null;
    var progs = ctx.programmes || [];
    var overlaps = ctx.overlaps || null;

    // Index sections and programmes for current film
    var srcDirs = dirSet(film);
    var srcGenres = {};
    (film.genre || []).forEach(function (g) { srcGenres[g] = 1; });
    var srcProgs = {}, srcSecs = {};
    if (film.prog) srcProgs[film.prog] = 1;
    progs.forEach(function (p) {
      if (!p) return;
      if (p.sections && p.sections[film.id]) { srcProgs[p.id] = 1; srcSecs[p.id + '|' + p.sections[film.id]] = p.sections[film.id]; }
      else if (Array.isArray(p.members) && p.members.indexOf(film.id) >= 0) srcProgs[p.id] = 1;
    });

    // Upcoming shows by film
    var upByFilm = {};
    var pickedUp = [];
    for (var i = 0; i < shows.length; i++) {
      var s = shows[i];
      if (isPast(s)) continue;
      if (!upByFilm[s.id]) upByFilm[s.id] = [];
      upByFilm[s.id].push(s);
      if (picked.has(keyOf(s))) pickedUp.push(s);
    }
    Object.keys(upByFilm).forEach(function (id) {
      upByFilm[id].sort(function (a, b) { return showDate(a) - showDate(b); });
    });

    var srcTaste = tastePoint(film.id, watched, tasteGet);
    var srcYear = parseInt(film.y, 10);

    var scored = [];
    for (var j = 0; j < films.length; j++) {
      var cand = films[j];
      var affinity = 0;
      var reasons = [];

      // 1. Same director
      var cDirs = dirSet(cand);
      var sameDir = Object.keys(srcDirs).some(function (n) { return !!cDirs[n]; });
      if (sameDir) { affinity += 42; reasons.push('同导演'); }

      // 2. Same festival section / programme
      var sameSec = '', sameProg = !!(cand.prog && srcProgs[cand.prog]);
      for (var pi = 0; pi < progs.length; pi++) {
        var p = progs[pi];
        if (!p) continue;
        var sec = p.sections && p.sections[cand.id];
        if (sec && srcSecs[p.id + '|' + sec]) { sameSec = sec; sameProg = true; break; }
        if (srcProgs[p.id] && (sec || (Array.isArray(p.members) && p.members.indexOf(cand.id) >= 0))) sameProg = true;
      }
      if (sameSec) { affinity += 24; reasons.push('同单元'); }
      else if (sameProg) { affinity += 12; reasons.push('同专题'); }

      // 3. Taste quadrant neighbor
      if (srcTaste) {
        var cTaste = tastePoint(cand.id, null, tasteGet);
        if (cTaste && cTaste[0] >= 3.2) {
          var dist = Math.hypot(srcTaste[0] - cTaste[0], srcTaste[1] - cTaste[1]);
          if (dist <= 1.35) {
            affinity += Math.round(18 - dist * 5);
            reasons.push('趣味相近');
          }
        }
      }

      // 4. Genre / region / decade resonance
      var sharedG = 0;
      (cand.genre || []).forEach(function (g) { if (srcGenres[g]) sharedG++; });
      if (sharedG) {
        affinity += Math.min(12, sharedG * 6);
        if (reasons.length < 2) reasons.push('同类型');
      }
      if (cand.reg && cand.reg === film.reg) affinity += 4;
      var cy = parseInt(cand.y, 10);
      if (Number.isFinite(srcYear) && Number.isFinite(cy) && Math.floor(srcYear / 10) === Math.floor(cy / 10)) affinity += 3;

      if (affinity < 10) continue;

      var up = upByFilm[cand.id] || [];
      var seenRec = watched[cand.id];
      var seen = !!(seenRec && !seenRec.del && seenRec.d);
      var wanted = !seen && !!(want[cand.id] && !want[cand.id].del);
      var fitsPlan = false;
      if (up.length && pickedUp.length && overlaps) {
        fitsPlan = up.some(function (s) {
          return !picked.has(keyOf(s)) && !pickedUp.some(function (ps) { return overlaps(s, ps); });
        });
      } else if (up.length && !pickedUp.length) {
        fitsPlan = true;
      }

      var total = affinity;
      if (seen) total -= 34; else total += 10;
      if (up.length) total += 14;
      if (fitsPlan && pickedUp.length) total += 6;
      var db = cand.r && cand.r[0];
      if (typeof db === 'number' && Number.isFinite(db)) total += Math.max(-2, Math.min(4, (db - 7) * 1.2));

      scored.push({
        film: cand,
        score: total,
        affinity: affinity,
        reasons: reasons.slice(0, 2),
        nextShow: up[0] || null,
        lastChance: up.length === 1,
        fitsPlan: fitsPlan && pickedUp.length > 0,
        wanted: wanted,
        seen: seen
      });
    }

    scored.sort(function (a, b) {
      return b.score - a.score || b.affinity - a.affinity || String(a.film.cn || '').localeCompare(String(b.film.cn || ''), 'zh');
    });
    return scored.slice(0, limit);
  }

  var api = { forFilm: forFilm };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SparrowRecommend = api;
})(typeof window !== 'undefined' ? window : this);
