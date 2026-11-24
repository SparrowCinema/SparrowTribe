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

  /* ===== 多人一起排片：零后端「接龙链接」（2026-11-24）=====
     纯 JS UTF-8 + Base64URL 编解码，浏览器 / Node / 微信小程序通用，无需任何后端或账号。
     载荷格式：{ v: 1, K: [去重场次键], W: [去重想看影片id], m: [[昵称, [K下标...], [W下标...]], ...] }
     最多 8 人，每人最多 80 场已选 + 80 部想看；共享键表让 3–5 人链接保持简短。 */
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  function utf8Encode(str) {
    const out = [];
    for (let i = 0; i < str.length; i++) {
      let c = str.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
        const c2 = str.charCodeAt(++i);
        c = ((c - 0xd800) << 10) + (c2 - 0xdc00) + 0x10000;
      }
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }
  function utf8Decode(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length;) {
      const b0 = bytes[i++];
      if (b0 < 0x80) s += String.fromCharCode(b0);
      else if ((b0 & 0xe0) === 0xc0) s += String.fromCharCode(((b0 & 31) << 6) | (bytes[i++] & 63));
      else if ((b0 & 0xf0) === 0xe0) s += String.fromCharCode(((b0 & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63));
      else {
        const cp = (((b0 & 7) << 18) | ((bytes[i++] & 63) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63)) - 0x10000;
        s += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 1023));
      }
    }
    return s;
  }
  function b64uEncode(bytes) {
    let r = '';
    for (let i = 0; i < bytes.length; i += 3) {
      const a = bytes[i], b = i + 1 < bytes.length ? bytes[i + 1] : 0, c = i + 2 < bytes.length ? bytes[i + 2] : 0;
      r += B64[a >> 2] + B64[((a & 3) << 4) | (b >> 4)];
      if (i + 1 < bytes.length) r += B64[((b & 15) << 2) | (c >> 6)];
      if (i + 2 < bytes.length) r += B64[c & 63];
    }
    return r;
  }
  function b64uDecode(str) {
    const clean = String(str || '').replace(/[\s=]+/g, '');
    const map = {};
    for (let i = 0; i < B64.length; i++) map[B64[i]] = i;
    const out = [];
    for (let i = 0; i < clean.length; i += 4) {
      const a = map[clean[i]], b = map[clean[i + 1]];
      if (a == null || b == null) return null;
      out.push((a << 2) | (b >> 4));
      if (i + 2 < clean.length) {
        const c = map[clean[i + 2]];
        if (c == null) return null;
        out.push(((b & 15) << 4) | (c >> 2));
        if (i + 3 < clean.length) {
          const d = map[clean[i + 3]];
          if (d == null) return null;
          out.push(((c & 3) << 6) | d);
        }
      }
    }
    return out;
  }

  const MAX_MEMBERS = 8, MAX_KEYS = 80, MAX_WANTS = 80;
  function normMember(m, idx) {
    const n = String((m && m.n) || '').trim().slice(0, 16) || ('影迷' + (idx + 1));
    const k = [...new Set((Array.isArray(m && m.k) ? m.k : []).filter(x => typeof x === 'string' && x && x.length <= 80))].slice(0, MAX_KEYS);
    const w = [...new Set((Array.isArray(m && m.w) ? m.w : []).filter(x => typeof x === 'string' && x && x.length <= 80))].slice(0, MAX_WANTS);
    return { n, k, w };
  }
  function encodeRelay(members) {
    const list = (Array.isArray(members) ? members : []).slice(0, MAX_MEMBERS).map(normMember);
    const K = [], kIdx = new Map(), W = [], wIdx = new Map();
    const ki = x => { if (!kIdx.has(x)) { kIdx.set(x, K.length); K.push(x); } return kIdx.get(x); };
    const wi = x => { if (!wIdx.has(x)) { wIdx.set(x, W.length); W.push(x); } return wIdx.get(x); };
    const m = list.map(x => [x.n, x.k.map(ki), x.w.map(wi)]);
    const payload = { v: 1, K, W, m };
    return b64uEncode(utf8Encode(JSON.stringify(payload)));
  }
  function decodeRelay(str) {
    try {
      const bytes = b64uDecode(str);
      if (!bytes || !bytes.length) return null;
      const d = JSON.parse(utf8Decode(bytes));
      if (!d || d.v !== 1 || !Array.isArray(d.m) || !Array.isArray(d.K)) return null;
      const K = d.K, W = Array.isArray(d.W) ? d.W : [];
      const out = d.m.slice(0, MAX_MEMBERS).map((row, i) => {
        if (!Array.isArray(row)) return null;
        const ks = (Array.isArray(row[1]) ? row[1] : []).map(idx => K[idx]).filter(x => typeof x === 'string');
        const ws = (Array.isArray(row[2]) ? row[2] : []).map(idx => W[idx]).filter(x => typeof x === 'string');
        return normMember({ n: row[0], k: ks, w: ws }, i);
      }).filter(Boolean);
      return out.length ? out : null;
    } catch (e) { return null; }
  }
  function upsertMember(members, me) {
    const list = (Array.isArray(members) ? members : []).map(normMember);
    const m = normMember(me, list.length);
    const key = m.n.toLocaleLowerCase();
    const idx = list.findIndex(x => x.n.toLocaleLowerCase() === key);
    if (idx >= 0) { const next = list.slice(); next[idx] = m; return next; }
    if (list.length >= MAX_MEMBERS) return list.slice(0, MAX_MEMBERS - 1).concat([m]);
    return list.concat([m]);
  }
  function removeMember(members, idx) {
    const list = (Array.isArray(members) ? members : []).slice();
    if (idx >= 0 && idx < list.length) list.splice(idx, 1);
    return list;
  }

  function analyzeGroup(members, allShows, o) {
    const key = o.key, film = o.film, span = o.span, now = o.now == null ? Date.now() : o.now;
    const resolve = o.resolve || (k => k);
    const liveShows = (allShows || []).filter(s => span(s)[1] >= now);
    const byKey = new Map();
    const showsByFilm = new Map();
    liveShows.forEach(s => {
      const k = key(s);
      byKey.set(k, s);
      const fid = film(s);
      if (!showsByFilm.has(fid)) showsByFilm.set(fid, []);
      showsByFilm.get(fid).push(s);
    });
    const overlaps = (a, b) => {
      const [s1, e1] = span(a), [s2, e2] = span(b);
      return s1 < e2 - TOL && s2 < e1 - TOL;
    };

    const M = (members || []).map((m, idx) => {
      const nm = normMember(m, idx);
      const pKeys = new Set();
      const picks = [];
      let missing = 0;
      nm.k.forEach(rawK => {
        const rk = resolve(rawK);
        const s = byKey.get(rk);
        if (s && !pKeys.has(rk)) { pKeys.add(rk); picks.push(s); }
        else if (!byKey.has(rk)) missing++;
      });
      picks.sort((a, b) => span(a)[0] - span(b)[0]);
      const pFilms = new Set(picks.map(film));
      const wFilms = new Set(nm.w.filter(id => showsByFilm.has(id)));
      return { n: nm.n, picks, pKeys, pFilms, wFilms, missing };
    });

    const N = M.length;
    const maj = Math.max(2, Math.ceil(N / 2));

    // 收集所有有人已选的场次 + 至少 2 人共同感兴趣的影片的所有待映场次
    const filmInterest = new Map(); // fid -> { pickedBy: Set, wantedBy: Set }
    M.forEach((m, i) => {
      m.pFilms.forEach(fid => {
        if (!filmInterest.has(fid)) filmInterest.set(fid, { pickedBy: new Set(), wantedBy: new Set() });
        filmInterest.get(fid).pickedBy.add(i);
      });
      m.wFilms.forEach(fid => {
        if (!filmInterest.has(fid)) filmInterest.set(fid, { pickedBy: new Set(), wantedBy: new Set() });
        filmInterest.get(fid).wantedBy.add(i);
      });
    });

    const candKeys = new Set();
    M.forEach(m => m.pKeys.forEach(k => candKeys.add(k)));
    filmInterest.forEach((info, fid) => {
      const union = new Set([...info.pickedBy, ...info.wantedBy]);
      if (union.size >= 2) (showsByFilm.get(fid) || []).forEach(s => candKeys.add(key(s)));
    });

    const evalShow = s => {
      const k = key(s), fid = film(s);
      const picked = [], free = [], freeWant = [], clashed = [];
      M.forEach(m => {
        if (m.pKeys.has(k)) { picked.push(m.n); return; }
        const hit = m.picks.find(x => overlaps(s, x));
        if (hit) { clashed.push({ name: m.n, show: hit }); return; }
        free.push(m.n);
        if (m.wFilms.has(fid) || m.pFilms.has(fid)) freeWant.push(m.n);
      });
      return {
        show: s, key: k, filmId: fid,
        picked, free, freeWant, clashed,
        canGo: picked.length + free.length,
        interested: picked.length + freeWant.length
      };
    };

    const allTogether = [], mostPicked = [], suggestPool = [];
    candKeys.forEach(k => {
      const s = byKey.get(k);
      if (!s) return;
      const ev = evalShow(s);
      if (N >= 2 && ev.picked.length === N) {
        allTogether.push(ev);
      } else {
        if (N >= 2 && ev.picked.length >= 2) mostPicked.push(ev);
        // 凑场建议：至少 2 人可以无冲突同去，且至少有 1 人已选或 ≥2 人感兴趣（想看/已选同片），且能去的达到多数（或全员）
        if (N >= 2 && ev.canGo >= maj && (ev.interested >= 2 || (ev.picked.length >= 1 && ev.canGo === N))) {
          suggestPool.push(ev);
        }
      }
    });

    allTogether.sort((a, b) => span(a.show)[0] - span(b.show)[0]);
    mostPicked.sort((a, b) => b.picked.length - a.picked.length || b.canGo - a.canGo || span(a.show)[0] - span(b.show)[0]);
    // 凑场建议按「全员可去 > 感兴趣人数 > 可去人数 > 已选人数 > 开场早」排序，每部影片最多推 2 场避免刷屏
    suggestPool.sort((a, b) =>
      (b.canGo === N ? 1 : 0) - (a.canGo === N ? 1 : 0) ||
      b.interested - a.interested ||
      b.canGo - a.canGo ||
      b.picked.length - a.picked.length ||
      span(a.show)[0] - span(b.show)[0]
    );
    const filmCap = new Map(), suggestions = [];
    for (let i = 0; i < suggestPool.length && suggestions.length < 12; i++) {
      const ev = suggestPool[i];
      const cnt = filmCap.get(ev.filmId) || 0;
      if (cnt >= 2) continue;
      filmCap.set(ev.filmId, cnt + 1);
      suggestions.push(ev);
    }

    // 共同想看 / 共同关注影片（≥2 人想看或已选，不含已全员同场的影片）
    const allTogetherFilms = new Set(allTogether.map(x => x.filmId));
    const sharedWants = [];
    filmInterest.forEach((info, fid) => {
      if (allTogetherFilms.has(fid)) return;
      const union = new Set([...info.pickedBy, ...info.wantedBy]);
      if (union.size < 2) return;
      const who = [...union].map(i => M[i].n);
      const shows = showsByFilm.get(fid) || [];
      let bestShow = null;
      shows.forEach(s => {
        const ev = evalShow(s);
        if (!bestShow || ev.canGo > bestShow.canGo || (ev.canGo === bestShow.canGo && ev.picked.length > bestShow.picked.length)) {
          bestShow = ev;
        }
      });
      sharedWants.push({ filmId: fid, who, count: union.size, allFree: !!(bestShow && bestShow.canGo === N), bestShow });
    });
    sharedWants.sort((a, b) => b.count - a.count || (b.allFree ? 1 : 0) - (a.allFree ? 1 : 0));

    return {
      members: M,
      allTogether,
      mostPicked,
      suggestions,
      sharedWants,
      stats: {
        memberCount: N,
        allTogetherCount: allTogether.length,
        mostPickedCount: mostPicked.length,
        suggestCount: suggestions.length,
        sharedWantCount: sharedWants.length
      }
    };
  }

  return { compare, encodeRelay, decodeRelay, upsertMember, removeMember, analyzeGroup, MAX_MEMBERS };
});
