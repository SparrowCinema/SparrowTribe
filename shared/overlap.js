/* 对排片：比较「朋友分享的排片」和「我的排片」（2026-11-18）
   网站直接加载；小程序副本 miniprogram/utils/overlap.js 由 tools/build-fallback.js 复制，不要直接改小程序那份。
   compare(theirs, mine, o)
     theirs / mine：场次数组；o.key(s) 场次键、o.film(s) 影片 id、o.span(s) → [开始毫秒, 结束毫秒]、o.now 当前毫秒
   返回：
     same     两人都选了的同一场
     sameFilm 同一部影片、不同场次：[{their, mine:[我的场次…]}]
     free     只有 TA 选、和我的排片不冲突，可以直接加入
     clash    只有 TA 选、和我的某场时间冲突：[{their, mine}]
     onlyMe   只有我选的场次数（不含同一部影片的）
     past     TA 的场次里已散场的数量（不参与上面的分类）
   冲突容忍 2 分钟以内的重叠，与排片冲突判断一致。 */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.SparrowOverlap = factory(); })(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const TOL = 2 * 60e3;
  function compare(theirs, mine, o) {
    const key = o.key, film = o.film, span = o.span, now = o.now == null ? Date.now() : o.now;
    const live = s => span(s)[1] >= now;
    const T = theirs.filter(live), past = theirs.length - T.length;
    const M = mine.filter(live), mk = new Set(M.map(key)), tk = new Set(T.map(key));
    const mineFilms = new Map(); M.forEach(s => { const f = film(s); if (!mineFilms.has(f)) mineFilms.set(f, []); mineFilms.get(f).push(s); });
    const same = [], sameFilm = [], free = [], clash = [];
    T.forEach(s => {
      if (mk.has(key(s))) { same.push(s); return; }
      const mf = (mineFilms.get(film(s)) || []).filter(x => !tk.has(key(x)));
      if (mf.length) { sameFilm.push({ their: s, mine: mf }); return; }
      const [a, b] = span(s);
      const hit = M.find(x => { const [c, d] = span(x); return a < d - TOL && c < b - TOL; });
      if (hit) clash.push({ their: s, mine: hit }); else free.push(s);
    });
    const theirFilms = new Set(T.map(film));
    const onlyMe = M.filter(s => !tk.has(key(s)) && !theirFilms.has(film(s))).length;
    return { same, sameFilm, free, clash, onlyMe, past, theirs: T.length, mine: M.length };
  }
  return { compare };
});
