/* 转场估算、地图导航、映后 30 分钟提醒、冲突一键换场与想看清单智能排片建议（2026-11-24）。
 * 网站与小程序共用；小程序副本 miniprogram/utils/planner.js 由 node tools/build-fallback.js 复制。 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SparrowPlanner = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const POST_MIN = 30;
  const EV_RE = /^(映后活动|Post-screening event)\s*·\s*/;
  const MAINLAND_TZS = new Set(['Asia/Shanghai', 'Asia/Urumqi', 'Asia/Chongqing', 'Asia/Harbin', 'Asia/Kashgar']);
  const NON_MAINLAND_CITIES = new Set(['台北', '台中', '高雄', '台南', '新竹', '桃园', '台湾', '香港', '澳门']);

  const toMin = t => {
    const p = String(t || '0:0').split(':').map(Number);
    return (p[0] || 0) * 60 + (p[1] || 0);
  };

  function geoOf(v) {
    if (!v || !Array.isArray(v.geo) || v.geo.length !== 2) return null;
    const lat = +v.geo[0], lng = +v.geo[1];
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }

  function distKm(a, b) {
    const R = 6371, r = x => x * Math.PI / 180;
    const dLa = r(b.lat - a.lat), dLo = r(b.lng - a.lng);
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  // 中国大陆影院使用 GCJ-02（高德/腾讯）；台湾、港澳与海外使用 WGS-84（Google 地图）
  function isOverseasGeo(v) {
    if (!v) return false;
    if (v.tz && !MAINLAND_TZS.has(v.tz)) return true;
    if (v.city && NON_MAINLAND_CITIES.has(v.city)) return true;
    return false;
  }

  function mapURL(v) {
    const g = geoOf(v);
    if (!g) return '';
    if (isOverseasGeo(v)) {
      return 'https://www.google.com/maps/search/?api=1&query=' + g.lat + ',' + g.lng;
    }
    return 'https://uri.amap.com/marker?position=' + g.lng + ',' + g.lat +
      '&name=' + encodeURIComponent(v.name || v.short || '') + '&coordinate=gaode&callnative=1';
  }

  function qaOf(f) {
    if (!f || !f.qaStart || !f.qaEnd || !f.qaGuest) return null;
    const s = toMin(f.qaStart), e = toMin(f.qaEnd);
    return e > s ? { start: s, end: e } : null;
  }

  function keyOfDefault(s) {
    return `${s.d}-${s.t}-${s.v}-${s.h}` + (s.archive === true ? `-archive-${s.id}` : '');
  }

  function getKey(s, ctx) {
    return ctx && ctx.keyOf ? ctx.keyOf(s) : keyOfDefault(s);
  }

  function getDur(s, ctx) {
    if (ctx && ctx.durationOf) return ctx.durationOf(s);
    const f = ctx && ctx.F && ctx.F[s.id];
    const k = getKey(s, ctx);
    const end = f && f.screeningEnds && f.screeningEnds[k];
    if (end) return toMin(end) - toMin(s.t);
    return (f && +f.min > 0) ? +f.min : 120;
  }

  function getStartMs(s, ctx) {
    if (ctx && ctx.showMs) return ctx.showMs(s);
    const md = String(s.d || '1/1').split('/').map(Number);
    const tm = String(s.t || '0:0').split(':').map(Number);
    const y = Number.isInteger(+s.year) ? +s.year : (md[0] >= 10 ? 2026 : 2027);
    return Date.UTC(y, (md[0] || 1) - 1, md[1] || 1, (tm[0] || 0) - 8, tm[1] || 0);
  }

  function evOf(s, f, k) {
    const note = f && f.screeningNotes && f.screeningNotes[k];
    return EV_RE.test(note || '');
  }

  function postMinOf(s, ctx) {
    const f = ctx && ctx.F && ctx.F[s.id];
    if (!f) return 0;
    const qa = qaOf(f);
    if (qa) {
      const endM = toMin(s.t) + getDur(s, ctx);
      return Math.max(0, qa.end - endM);
    }
    return evOf(s, f, getKey(s, ctx)) ? POST_MIN : 0;
  }

  function transfer(a, b, ctx) {
    const durA = getDur(a, ctx);
    const startA = getStartMs(a, ctx), startB = getStartMs(b, ctx);
    const gap = Math.round((startB - (startA + durA * 60000)) / 60000);
    const postMin = postMinOf(a, ctx);
    const afterPost = gap - postMin;
    const va = ctx && ctx.VN && ctx.VN[a.v];
    const vb = ctx && ctx.VN && ctx.VN[b.v];

    let kind = 'cross', need = 45, km = 0, taxi = 0, metro = 0;
    if (a.v === b.v) {
      kind = 'same';
      need = 10;
    } else if (va && vb && va.city && vb.city && va.city !== vb.city) {
      kind = 'city';
      need = 9999;
    } else {
      const ga = geoOf(va), gb = geoOf(vb);
      if (ga && gb) {
        const road = distKm(ga, gb) * 1.35;
        taxi = Math.max(8, Math.round(6 + road / 25 * 60));
        metro = Math.max(15, Math.round(12 + road / 32 * 60));
        need = Math.min(taxi, metro) + 10;
        km = Math.round(road * 10) / 10;
      }
    }

    const clash = gap < -2 || kind === 'city';
    const tight = !clash && gap < need;
    const postOverlap = !clash && postMin > 0 && afterPost < -2;
    const postTight = !clash && !postOverlap && postMin > 0 && afterPost < need;
    return { kind, gap, need, km, taxi, metro, postMin, afterPost, clash, tight, postOverlap, postTight };
  }

  function defaultDurText(m, en) {
    if (en) return m < 60 ? m + ' min' : Math.floor(m / 60) + 'h' + (m % 60 ? ' ' + (m % 60) + 'm' : '');
    return m < 60 ? m + ' 分钟' : Math.floor(m / 60) + ' 小时' + (m % 60 ? ' ' + (m % 60) + ' 分' : '');
  }

  function formatGap(tr, opt) {
    opt = opt || {};
    const en = !!opt.en;
    const dur = opt.durText || (m => defaultDurText(m, en));
    const toVenue = opt.toVenue || '';
    const warn = opt.warnPrefix ? '⚠ ' : '';
    const gapTxt = (en ? 'gap ' : '间隔 ') + dur(Math.max(tr.gap, 0));

    if (tr.gap < -2) {
      return {
        cls: 'clash',
        txt: warn + (en ? 'Overlaps previous by ' + (-tr.gap) + ' min' : '与上一场重叠 ' + (-tr.gap) + ' 分钟')
      };
    }
    if (tr.kind === 'city') {
      return {
        cls: 'clash',
        txt: warn + (en ? 'Different city — cannot connect' : '跨城市，无法衔接')
      };
    }
    if (tr.kind === 'same') {
      if (tr.tight) {
        return {
          cls: 'tight',
          txt: en
            ? 'Same cinema · ~' + tr.need + ' min to change halls · ' + gapTxt + ' — tight'
            : '同影院 · 换厅约 ' + tr.need + ' 分钟 · ' + gapTxt + '，时间偏紧'
        };
      }
      if (tr.postOverlap) {
        return {
          cls: 'tight',
          txt: en
            ? 'Same cinema · Q&A (~' + tr.postMin + ' min) overlaps next show · ' + gapTxt
            : '同影院 · 含映后约 ' + tr.postMin + ' 分钟，若留步映后会与下场重叠 · ' + gapTxt
        };
      }
      if (tr.postTight) {
        return {
          cls: 'tight',
          txt: en
            ? 'Same cinema · ' + gapTxt + ' (tight if staying for ~' + tr.postMin + ' min Q&A)'
            : '同影院 · ' + gapTxt + '（含映后约 ' + tr.postMin + ' 分钟，留步映后换厅偏紧）'
        };
      }
      const qaNote = tr.postMin > 0
        ? (en ? ' (incl. ~' + tr.postMin + ' min Q&A)' : '（含映后约 ' + tr.postMin + ' 分钟）')
        : '';
      return {
        cls: 'ok',
        txt: (en ? 'Same cinema · ' : '同影院 · ') + gapTxt + qaNote
      };
    }

    // 跨影院
    const how = tr.taxi
      ? (en
          ? 'metro ~' + tr.metro + ' min · taxi ~' + tr.taxi + ' min (~' + tr.km + ' km)'
          : '地铁约 ' + tr.metro + ' 分钟 · 打车约 ' + tr.taxi + ' 分钟（约 ' + tr.km + 'km）')
      : (en ? 'usually 30–45 min' : '通常需 30–45 分钟');
    const dest = toVenue ? (en ? 'To ' + toVenue + ' · ' : '转场 → ' + toVenue + ' · ') : '';

    if (tr.tight) {
      const qaNote = tr.postMin > 0
        ? (en ? ' (+ ~' + tr.postMin + ' min Q&A)' : '（上场含映后约 ' + tr.postMin + ' 分钟）')
        : '';
      return {
        cls: 'tight',
        txt: warn + (en ? 'Transfer may be too tight · ' : '转场可能来不及 · ') + dest + how + ' · ' + gapTxt + qaNote
      };
    }
    if (tr.postOverlap || tr.postTight) {
      return {
        cls: 'tight',
        txt: warn + (en
          ? 'Too tight if staying for ~' + tr.postMin + ' min Q&A · '
          : '若留步映后（约 ' + tr.postMin + ' 分钟）转场来不及 · ') + dest + how + ' · ' + gapTxt
      };
    }
    const qaNote = tr.postMin > 0
      ? (en ? ' (incl. ~' + tr.postMin + ' min Q&A)' : '（含映后约 ' + tr.postMin + ' 分钟）')
      : '';
    return {
      cls: 'ok',
      txt: dest + how + ' · ' + gapTxt + qaNote
    };
  }

  // 检查两场是否冲突：时间重叠（允许 2 分钟散场容差），或同一天跨城市且间隔不足 3 小时
  function pairConflict(a, b, ctx) {
    const sA = getStartMs(a, ctx), eA = sA + getDur(a, ctx) * 60000;
    const sB = getStartMs(b, ctx), eB = sB + getDur(b, ctx) * 60000;
    if (sA < eB - 120000 && sB < eA - 120000) return 'overlap';
    if (a.d === b.d) {
      const va = ctx && ctx.VN && ctx.VN[a.v], vb = ctx && ctx.VN && ctx.VN[b.v];
      if (va && vb && va.city && vb.city && va.city !== vb.city) {
        const gap = sA <= sB ? (sB - eA) / 60000 : (sA - eB) / 60000;
        if (gap < 180) return 'city';
      }
    }
    return '';
  }

  function findConflicts(list, ctx) {
    const out = [];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const reason = pairConflict(list[i], list[j], ctx);
        if (reason) out.push({ a: list[i], b: list[j], reason });
      }
    }
    return out;
  }

  // 评估把 candidate 放入 existingList 后的相邻转场质量
  function scorePlacement(cand, existingList, ctx) {
    const cStart = getStartMs(cand, ctx);
    const cEnd = cStart + getDur(cand, ctx) * 60000;
    let prev = null, next = null;
    for (let i = 0; i < existingList.length; i++) {
      const s = existingList[i];
      if (s.d !== cand.d) continue;
      const st = getStartMs(s, ctx);
      if (st <= cStart) {
        if (!prev || st > getStartMs(prev, ctx)) prev = s;
      } else {
        if (!next || st < getStartMs(next, ctx)) next = s;
      }
    }
    let score = 0, tight = false, postTight = false, sameVenueAdj = false;
    if (prev) {
      const tr = transfer(prev, cand, ctx);
      if (tr.kind === 'city') score -= 120;
      else if (tr.tight) { score -= 40; tight = true; }
      else if (tr.postOverlap || tr.postTight) { score -= 18; postTight = true; }
      else if (tr.kind === 'same') { score += 18; sameVenueAdj = true; }
      else if (tr.gap >= tr.need + 15 && tr.gap <= 120) score += 6;
    }
    if (next) {
      const tr = transfer(cand, next, ctx);
      if (tr.kind === 'city') score -= 120;
      else if (tr.tight) { score -= 40; tight = true; }
      else if (tr.postOverlap || tr.postTight) { score -= 18; postTight = true; }
      else if (tr.kind === 'same') { score += 18; sameVenueAdj = true; }
      else if (tr.gap >= tr.need + 15 && tr.gap <= 120) score += 6;
    }
    // 偏好合理时段（不过早/不过晚轻微加分）
    const endMin = Math.round((cEnd - cStart) / 60000) + toMin(cand.t);
    if (endMin <= 22 * 60 + 45) score += 2;
    return { score, tight, postTight, sameVenueAdj };
  }

  // 冲突一键换场：为每个发生冲突的场次寻找同片无冲突的待映替代场次
  function conflictSwaps(pickedList, allShows, ctx) {
    const conflicts = findConflicts(pickedList, ctx);
    if (!conflicts.length) return [];
    const nowMs = (ctx && ctx.nowMs !== undefined) ? ctx.nowMs : Date.now();
    const isPast = ctx && ctx.isPast ? ctx.isPast : (s => getStartMs(s, ctx) + getDur(s, ctx) * 60000 < nowMs);
    const pickedKeys = new Set(pickedList.map(s => getKey(s, ctx)));
    const byKey = new Map();

    const addClash = (x, other, reason) => {
      const k = getKey(x, ctx);
      if (!byKey.has(k)) byKey.set(k, { from: x, others: [], reasons: new Set() });
      const entry = byKey.get(k);
      if (!entry.others.some(o => getKey(o, ctx) === getKey(other, ctx))) entry.others.push(other);
      entry.reasons.add(reason);
    };
    conflicts.forEach(c => { addClash(c.a, c.b, c.reason); addClash(c.b, c.a, c.reason); });

    const out = [];
    byKey.forEach((entry, fromKey) => {
      const from = entry.from;
      const rest = pickedList.filter(s => getKey(s, ctx) !== fromKey);
      const vFrom = ctx && ctx.VN && ctx.VN[from.v];
      const alts = [];
      for (let i = 0; i < allShows.length; i++) {
        const alt = allShows[i];
        if (alt.id !== from.id) continue;
        const ak = getKey(alt, ctx);
        if (ak === fromKey || pickedKeys.has(ak)) continue;
        if (isPast(alt)) continue;
        if (rest.some(r => pairConflict(alt, r, ctx))) continue;
        const pl = scorePlacement(alt, rest, ctx);
        const vAlt = ctx && ctx.VN && ctx.VN[alt.v];
        const sameCity = !!(vFrom && vAlt && vFrom.city && vFrom.city === vAlt.city);
        const sameVenue = alt.v === from.v;
        const sameDay = alt.d === from.d;
        const rank = pl.score + (sameCity ? 24 : 0) + (sameVenue ? 12 : 0) + (sameDay ? 6 : 0);
        alts.push({ show: alt, key: ak, sameCity, sameVenue, sameDay, tight: pl.tight, postTight: pl.postTight, sameVenueAdj: pl.sameVenueAdj, rank });
      }
      alts.sort((a, b) => b.rank - a.rank || getStartMs(a.show, ctx) - getStartMs(b.show, ctx));
      if (alts.length) {
        out.push({
          from,
          fromKey,
          others: entry.others,
          alts: alts.slice(0, 3)
        });
      }
    });
    out.sort((a, b) => getStartMs(a.from, ctx) - getStartMs(b.from, ctx));
    return out;
  }

  /* 想看分级（2026-11-24）：1 必看 / 2 可看（默认）/ 3 随缘。
     排片目标按档位逐级比较：先让排入的「必看」最多，再看「可看」，最后「随缘」；同档数量相同时比转场舒适度与顺路度。
     「随缘」只填空档：不会挤掉任何必看、可看，也不接受转场偏紧或跨城的场次。 */
  const TIERS = [1, 2, 3];
  const TIER_LABEL = { 1: '必看', 2: '可看', 3: '随缘' };
  const TIER_W = { 1: 1e6, 2: 1e3, 3: 1 };
  function normTier(p) { p = +p; return p === 1 || p === 3 ? p : 2; }
  function tierOfCtx(id, ctx) { return normTier(ctx && ctx.tierOf ? ctx.tierOf(id) : 2); }

  // 基于「想看」清单做智能排片建议（保留用户已选场次不动，按分级逐级最大化无冲突排入影片数，按转场舒适度与顺路度择优）
  function suggestPlan(wantIds, pickedList, allShows, ctx) {
    const nowMs = (ctx && ctx.nowMs !== undefined) ? ctx.nowMs : Date.now();
    const isPast = ctx && ctx.isPast ? ctx.isPast : (s => getStartMs(s, ctx) + getDur(s, ctx) * 60000 < nowMs);
    const preferredCity = ctx && ctx.preferredCity || '';
    const uniqueWants = [...new Set(wantIds || [])].filter(id => !(ctx && ctx.F) || !!ctx.F[id]);
    const tierOf = id => tierOfCtx(id, ctx);
    const pickedFilmIds = new Set(pickedList.map(s => s.id));
    const pickedCities = new Set(pickedList.map(s => ctx && ctx.VN && ctx.VN[s.v] && ctx.VN[s.v].city).filter(Boolean));
    const alreadyPlanned = [];
    const unscheduled = [];
    const groups = [];
    const upcomingOf = {};

    uniqueWants.forEach(filmId => {
      const tier = tierOf(filmId);
      if (pickedFilmIds.has(filmId)) {
        alreadyPlanned.push(filmId);
        return;
      }
      const upcoming = allShows
        .filter(s => s.id === filmId && !isPast(s))
        .sort((a, b) => getStartMs(a, ctx) - getStartMs(b, ctx));
      upcomingOf[filmId] = upcoming;
      if (!upcoming.length) {
        unscheduled.push({ filmId, tier, reason: 'no_upcoming', upcomingCount: 0 });
        return;
      }
      let viable = upcoming.filter(s => !pickedList.some(p => pairConflict(s, p, ctx)));
      // 随缘只填空档：与已有排片之间转场偏紧的场次不考虑
      if (tier === 3) viable = viable.filter(s => !scorePlacement(s, pickedList, ctx).tight);
      if (!viable.length) {
        unscheduled.push({ filmId, tier, reason: 'all_conflict', upcomingCount: upcoming.length });
        return;
      }
      // 给每个候选场次先按静态质量排序，并限制单部电影最多取前 8 个候选以保证搜索瞬时完成
      const scored = viable.map(s => {
        const v = ctx && ctx.VN && ctx.VN[s.v];
        const city = v && v.city || '';
        const pl = scorePlacement(s, pickedList, ctx);
        const cityBonus = (preferredCity && city === preferredCity ? 16 : 0) + (pickedCities.has(city) ? 10 : 0);
        return { s, base: pl.score + cityBonus, start: getStartMs(s, ctx) };
      }).sort((a, b) => b.base - a.base || a.start - b.start);
      groups.push({ filmId, tier, w: TIER_W[tier], totalUpcoming: upcoming.length, cands: scored.slice(0, 8) });
    });

    // 档位优先（必看 → 可看 → 随缘），同档内稀缺度优先：候选场次最少的影片排在前面（唯一场次最优先）
    groups.sort((a, b) => a.tier - b.tier || a.cands.length - b.cands.length || a.cands[0].start - b.cands[0].start);
    // 剩余可得分上界（后缀和），用于剪枝
    const suffix = new Array(groups.length + 1).fill(0);
    for (let i = groups.length - 1; i >= 0; i--) suffix[i] = suffix[i + 1] + groups[i].w;

    let bestPick = [];
    let bestVal = 0;
    let bestScore = -Infinity;
    let nodes = 0;
    const MAX_NODES = 6000;
    const cur = [];
    const anchor = pickedList.slice();

    function dfs(idx, curVal, curScore) {
      if (nodes++ >= MAX_NODES) return;
      if (curVal + suffix[idx] < bestVal) return;
      if (idx === groups.length) {
        if (curVal > bestVal || (curVal === bestVal && curScore > bestScore)) {
          bestVal = curVal;
          bestScore = curScore;
          bestPick = cur.slice();
        }
        return;
      }
      const g = groups[idx];
      let tried = false;
      for (let i = 0; i < g.cands.length; i++) {
        const cand = g.cands[i];
        if (cur.some(x => pairConflict(cand.s, x.s, ctx))) continue;
        const pl = scorePlacement(cand.s, anchor.concat(cur.map(x => x.s)), ctx);
        if (g.tier === 3 && pl.tight) continue;
        tried = true;
        const v = ctx && ctx.VN && ctx.VN[cand.s.v];
        const city = v && v.city || '';
        const cityBonus = (preferredCity && city === preferredCity ? 14 : 0) + (pickedCities.has(city) ? 8 : 0);
        cur.push({ filmId: g.filmId, tier: g.tier, s: cand.s, scarce: g.totalUpcoming === 1, candsCount: g.cands.length });
        dfs(idx + 1, curVal + g.w, curScore + pl.score + cityBonus);
        cur.pop();
        if (nodes >= MAX_NODES) return;
      }
      // 也允许跳过当前影片，以探索能排入更多（更高档）影片的组合（仅当有可能超过或追平当前最优时）
      if (!tried || curVal + suffix[idx + 1] >= bestVal) {
        dfs(idx + 1, curVal, curScore);
      }
    }

    if (groups.length) dfs(0, 0, 0);

    const chosenFilms = new Set(bestPick.map(x => x.filmId));
    groups.forEach(g => {
      if (!chosenFilms.has(g.filmId)) {
        unscheduled.push({ filmId: g.filmId, tier: g.tier, reason: 'conflict_with_suggested', upcomingCount: g.totalUpcoming });
      }
    });
    unscheduled.sort((a, b) => a.tier - b.tier);

    const combined = pickedList.concat(bestPick.map(x => x.s));
    const picks = bestPick
      .slice()
      .sort((a, b) => getStartMs(a.s, ctx) - getStartMs(b.s, ctx))
      .map(item => {
        const others = combined.filter(s => getKey(s, ctx) !== getKey(item.s, ctx));
        const pl = scorePlacement(item.s, others, ctx);
        const postMin = postMinOf(item.s, ctx);
        const tags = [];
        if (item.scarce) tags.push('唯一场次');
        if (pl.sameVenueAdj) tags.push('同影院顺路');
        if (postMin > 0) tags.push('含映后');
        if (pl.tight) tags.push('转场偏紧');
        else if (pl.postTight) tags.push('留步映后偏紧');
        return {
          filmId: item.filmId,
          tier: item.tier,
          show: item.s,
          key: getKey(item.s, ctx),
          scarce: item.scarce,
          sameVenueAdj: pl.sameVenueAdj,
          postMin,
          tight: pl.tight,
          postTight: pl.postTight,
          tags
        };
      });

    /* 必看取舍：排不进的必看，逐场找出挡路的场次（已有排片或本次建议），
       只有挡路的全部是较低档（可看 / 随缘 / 未加入想看的已选场次）时才给出方案，挑「代价」最小的一场。
       已有排片里用户手动选的场次代价略高，同为必看的不会被替换。 */
    const tradeoffs = [];
    const suggestedKeys = new Set(picks.map(p => p.key));
    const wantSet = new Set(uniqueWants);
    unscheduled.forEach(u => {
      if (u.tier !== 1 || u.reason === 'no_upcoming') return;
      let best = null;
      (upcomingOf[u.filmId] || []).forEach(s => {
        const blockers = combined.filter(x => x.id !== u.filmId && pairConflict(s, x, ctx));
        if (!blockers.length) return;
        let cost = 0, ok = true;
        const drop = blockers.map(x => {
          const k = getKey(x, ctx), existing = !suggestedKeys.has(k);
          const t = wantSet.has(x.id) ? tierOf(x.id) : (existing ? 2 : 3);
          if (t === 1) ok = false;
          cost += (t === 2 ? 10 : 3) + (existing ? 2 : 0);
          return { key: k, filmId: x.id, tier: wantSet.has(x.id) ? t : 0, existing, show: x };
        });
        if (!ok) return;
        cost += scorePlacement(s, combined.filter(x => !blockers.includes(x)), ctx).tight ? 4 : 0;
        if (!best || cost < best.cost || (cost === best.cost && getStartMs(s, ctx) < getStartMs(best.show, ctx))) {
          best = { filmId: u.filmId, show: s, key: getKey(s, ctx), drop, cost };
        }
      });
      if (best) tradeoffs.push(best);
    });

    const byTier = {};
    TIERS.forEach(t => {
      byTier[t] = {
        want: uniqueWants.filter(id => tierOf(id) === t).length,
        added: picks.filter(p => p.tier === t).length,
        already: alreadyPlanned.filter(id => tierOf(id) === t).length,
        missed: unscheduled.filter(x => x.tier === t).length
      };
    });

    return {
      picks,
      unscheduled,
      alreadyPlanned,
      tradeoffs,
      stats: {
        wantTotal: uniqueWants.length,
        addedCount: picks.length,
        alreadyCount: alreadyPlanned.length,
        unscheduledCount: unscheduled.length,
        byTier
      }
    };
  }

  return {
    POST_MIN, EV_RE, toMin, geoOf, distKm, isOverseasGeo, mapURL,
    qaOf, evOf, postMinOf, transfer, formatGap,
    pairConflict, findConflicts, conflictSwaps, suggestPlan,
    TIERS, TIER_LABEL, normTier
  };
});
