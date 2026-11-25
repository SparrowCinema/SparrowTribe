/* 由 tools/build-fallback.js 从 shared/taste-portrait.js 复制，请改 shared/taste-portrait.js 后重新运行。 */
/* 个人观影画像 / AI 评语共享模块（2026-11-25）
 * 网站与小程序共用；小程序副本 miniprogram/packages/collect/utils/taste-portrait.js 由 node tools/build-fallback.js 复制。
 * 职责：
 * 1. 从本机看过记录与趣味四象限中提取精简、无隐私的摘要（不含同步码、私人笔记、排片）；
 * 2. 计算稳定指纹用于本机缓存（记录未变动时不重复调用 AI 接口）；
 * 3. 归一化 AI 返回的结构化画像并生成可复制文本。 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SparrowTastePortrait = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MIN_FILMS = 3;
  const MAX_FILMS = 45;
  const CACHE_MAX = 12;
  const WEB_CACHE_KEY = 'sparrow-ai-portrait-v1';
  const MINI_CACHE_KEY = 'sk-ai-portrait-v1';

  const validTaste = v => typeof v === 'number' && !Number.isNaN(v) && v >= 0 && v <= 5;
  const clamp = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
  const round1 = v => Math.round(Number(v) * 10) / 10;
  const round2 = v => Math.round(Number(v) * 100) / 100;
  const splitList = v => (Array.isArray(v) ? v : String(v || '').split(/\s*[\/、,，;；|]\s*/)).map(x => clamp(x, 36)).filter(Boolean);
  const filmTitle = (e, en) => {
    const f = (e && e.f) || {};
    return clamp(en ? (f.en || f.cn || f.title) : (f.cn || f.title || f.en), 60);
  };
  const filmViews = e => (e && e.rec && Array.isArray(e.rec.v) ? Math.max(1, e.rec.v.length) : 1);

  function pearson(pairs) {
    if (!pairs || pairs.length < 4) return null;
    let sx = 0, sy = 0;
    for (let i = 0; i < pairs.length; i++) { sx += pairs[i][0]; sy += pairs[i][1]; }
    const mx = sx / pairs.length, my = sy / pairs.length;
    let num = 0, dx2 = 0, dy2 = 0;
    for (let i = 0; i < pairs.length; i++) {
      const dx = pairs[i][0] - mx, dy = pairs[i][1] - my;
      num += dx * dy; dx2 += dx * dx; dy2 += dy * dy;
    }
    if (dx2 <= 1e-9 || dy2 <= 1e-9) return null;
    return round2(num / Math.sqrt(dx2 * dy2));
  }

  function fnv1a(str, seed) {
    let h = seed >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function matchYear(rec, year) {
    if (!year) return true;
    if (String(rec.d || '').slice(0, 4) === year) return true;
    if (Array.isArray(rec.v)) return rec.v.some(x => x && String(x.d || '').slice(0, 4) === year);
    return false;
  }

  function filterEntries(entries, opts) {
    opts = opts || {};
    const inProg = typeof opts.inProg === 'function' ? opts.inProg : null;
    const year = opts.year ? String(opts.year) : '';
    return (entries || []).filter(e => {
      if (!e || !e.f || e.f.ev || !e.rec || e.rec.del) return false;
      if (inProg) return !!inProg(e.f);
      if (year) return matchYear(e.rec, year);
      return true;
    });
  }

  function filmPriority(e) {
    const rec = e.rec || {};
    let sc = 0;
    const hasFun = validTaste(rec.fun), hasBore = validTaste(rec.bore);
    if (hasFun && hasBore) sc += 40;
    else if (hasFun || hasBore) sc += 15;
    if (rec.r > 0) sc += 20;
    if (hasFun && hasBore) {
      // 高对比度 / 极端体验的片子最有代表性
      sc += Math.abs(rec.fun - 3) * 4 + Math.abs(rec.bore - 3) * 4;
      if (rec.fun >= 3.5 && rec.bore >= 3.5) sc += 12; // 迷人又折磨
    }
    if (rec.r >= 8 && hasBore && rec.bore >= 3.5) sc += 14; // 高星但难熬
    if (hasFun && rec.fun >= 4 && rec.r > 0 && rec.r <= 7) sc += 10; // 看爽但打分克制
    const views = filmViews(e);
    if (views > 1) sc += Math.min(20, (views - 1) * 8);
    return sc;
  }

  function compactFilm(e, en) {
    const f = e.f || {}, rec = e.rec || {};
    const title = filmTitle(e, en);
    const out = { t: title };
    if (f.y) out.y = clamp(String(f.y), 8);
    if (f.c) out.c = clamp(f.c, 28);
    if (f.dir) out.d = clamp(f.dir, 36);
    if (f.genre) out.g = clamp(Array.isArray(f.genre) ? f.genre.join('/') : f.genre, 36);
    if (typeof rec.r === 'number' && rec.r > 0) out.r = round1(rec.r);
    if (validTaste(rec.fun)) out.fun = round1(rec.fun);
    if (validTaste(rec.bore)) out.bore = round1(rec.bore);
    const views = filmViews(e);
    if (views > 1) out.v = views;
    return out;
  }

  function buildSignals(scoped, en) {
    const list = (scoped || []).slice().sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')));
    const out = {};

    // 1. 十分制星级分布
    const starRows = list.filter(e => typeof e.rec.r === 'number' && e.rec.r > 0);
    if (starRows.length >= 2) {
      let sum = 0, high = 0, low = 0, min = 10, max = 0;
      starRows.forEach(e => {
        const r = e.rec.r;
        sum += r;
        if (r >= 9) high++;
        if (r <= 5) low++;
        if (r < min) min = r;
        if (r > max) max = r;
      });
      out.star = { n: starRows.length, avg: round1(sum / starRows.length), high, low, min: round1(min), max: round1(max) };
    }

    // 2. 有趣/无聊相关性 & 星级/有趣相关性
    const fbPairs = list.filter(e => validTaste(e.rec.fun) && validTaste(e.rec.bore)).map(e => [e.rec.fun, e.rec.bore]);
    const rFB = pearson(fbPairs);
    if (rFB !== null) out.funBoreCorr = rFB;
    const sfPairs = list.filter(e => typeof e.rec.r === 'number' && e.rec.r > 0 && validTaste(e.rec.fun)).map(e => [e.rec.r, e.rec.fun]);
    const rSF = pearson(sfPairs);
    if (rSF !== null) out.starFunCorr = rSF;

    // 3. 全量导演 / 国家地区 / 类型 / 年代版图
    const dirMap = new Map(), cMap = new Map(), gMap = new Map(), decMap = new Map();
    let minY = 9999, maxY = 0;
    list.forEach(e => {
      const f = e.f || {}, rec = e.rec || {};
      const r = typeof rec.r === 'number' && rec.r > 0 ? rec.r : 0;
      splitList(f.dir).slice(0, 2).forEach(d => {
        const cur = dirMap.get(d) || { n: 0, rSum: 0, rN: 0 };
        cur.n++;
        if (r) { cur.rSum += r; cur.rN++; }
        dirMap.set(d, cur);
      });
      splitList(f.c).slice(0, 2).forEach(c => { cMap.set(c, (cMap.get(c) || 0) + 1); });
      splitList(f.genre).slice(0, 3).forEach(g => { gMap.set(g, (gMap.get(g) || 0) + 1); });
      const y = parseInt(String(f.y || ''), 10);
      if (y >= 1888 && y <= 2099) {
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        const dec = Math.floor(y / 10) * 10 + 's';
        decMap.set(dec, (decMap.get(dec) || 0) + 1);
      }
    });

    const topDirectors = [...dirMap.entries()]
      .filter(([, v]) => v.n >= 2)
      .sort((a, b) => b[1].n - a[1].n || ((b[1].rN ? b[1].rSum / b[1].rN : 0) - (a[1].rN ? a[1].rSum / a[1].rN : 0)) || a[0].localeCompare(b[0]))
      .slice(0, 4)
      .map(([name, v]) => {
        const item = { name, n: v.n };
        if (v.rN) item.avgR = round1(v.rSum / v.rN);
        return item;
      });
    if (topDirectors.length) out.topDirectors = topDirectors;

    const topCountries = [...cMap.entries()]
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 4)
      .map(([name, n]) => ({ name, n }));
    if (topCountries.length) out.topCountries = topCountries;

    const topGenres = [...gMap.entries()]
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 4)
      .map(([name, n]) => ({ name, n }));
    if (topGenres.length) out.topGenres = topGenres;

    const topDecades = [...decMap.entries()]
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 3)
      .map(([d, n]) => ({ d, n }));
    if (topDecades.length) out.topDecades = topDecades;
    if (minY < 9999 && maxY > minY) out.yearSpan = minY + '–' + maxY;

    // 4. 重刷执念
    const rewatched = list
      .filter(e => filmViews(e) >= 2 && filmTitle(e, en))
      .sort((a, b) => filmViews(b) - filmViews(a) || (b.rec.r || 0) - (a.rec.r || 0) || String(a.id || '').localeCompare(String(b.id || '')))
      .slice(0, 4)
      .map(e => {
        const item = { t: filmTitle(e, en), v: filmViews(e) };
        if (typeof e.rec.r === 'number' && e.rec.r > 0) item.r = round1(e.rec.r);
        return item;
      });
    if (rewatched.length) out.rewatched = rewatched;

    // 5. 反差与极端片（影评最有戏的切入点）
    const pickBrief = e => {
      const item = { t: filmTitle(e, en) };
      if (typeof e.rec.r === 'number' && e.rec.r > 0) item.r = round1(e.rec.r);
      if (validTaste(e.rec.fun)) item.fun = round1(e.rec.fun);
      if (validTaste(e.rec.bore)) item.bore = round1(e.rec.bore);
      return item;
    };
    const paradoxes = {};
    const capTire = list
      .filter(e => validTaste(e.rec.fun) && validTaste(e.rec.bore) && e.rec.fun >= 3.5 && e.rec.bore >= 3.5 && filmTitle(e, en))
      .sort((a, b) => (b.rec.fun + b.rec.bore) - (a.rec.fun + a.rec.bore) || String(a.id || '').localeCompare(String(b.id || '')))
      .slice(0, 3).map(pickBrief);
    if (capTire.length) paradoxes.captivatingTiring = capTire;

    const respTire = list
      .filter(e => typeof e.rec.r === 'number' && e.rec.r >= 8 && validTaste(e.rec.bore) && e.rec.bore >= 3.5 && filmTitle(e, en))
      .sort((a, b) => (b.rec.r / 2 + b.rec.bore) - (a.rec.r / 2 + a.rec.bore) || String(a.id || '').localeCompare(String(b.id || '')))
      .slice(0, 2).map(pickBrief);
    if (respTire.length) paradoxes.respectedTiring = respTire;

    const guilty = list
      .filter(e => validTaste(e.rec.fun) && e.rec.fun >= 4 && typeof e.rec.r === 'number' && e.rec.r > 0 && e.rec.r <= 7 && filmTitle(e, en))
      .sort((a, b) => (b.rec.fun - b.rec.r / 2) - (a.rec.fun - a.rec.r / 2) || String(a.id || '').localeCompare(String(b.id || '')))
      .slice(0, 2).map(pickBrief);
    if (guilty.length) paradoxes.guiltyPleasure = guilty;

    const mostFun = list
      .filter(e => validTaste(e.rec.fun) && e.rec.fun >= 3.5 && filmTitle(e, en))
      .sort((a, b) => (b.rec.fun - (validTaste(b.rec.bore) ? b.rec.bore * 0.05 : 0)) - (a.rec.fun - (validTaste(a.rec.bore) ? a.rec.bore * 0.05 : 0)) || String(a.id || '').localeCompare(String(b.id || '')))
      .slice(0, 2).map(pickBrief);
    if (mostFun.length) paradoxes.mostFun = mostFun;

    const mostBore = list
      .filter(e => validTaste(e.rec.bore) && e.rec.bore >= 3.5 && filmTitle(e, en))
      .sort((a, b) => (b.rec.bore - (validTaste(b.rec.fun) ? b.rec.fun * 0.05 : 0)) - (a.rec.bore - (validTaste(a.rec.fun) ? a.rec.fun * 0.05 : 0)) || String(a.id || '').localeCompare(String(b.id || '')))
      .slice(0, 2).map(pickBrief);
    if (mostBore.length) paradoxes.mostBore = mostBore;

    if (out.star && out.star.n >= 4 && out.star.max - out.star.min >= 2) {
      const byStar = starRows.filter(e => filmTitle(e, en));
      paradoxes.highestRated = byStar.slice().sort((a, b) => b.rec.r - a.rec.r || String(a.id || '').localeCompare(String(b.id || ''))).slice(0, 2).map(pickBrief);
      paradoxes.lowestRated = byStar.slice().sort((a, b) => a.rec.r - b.rec.r || String(a.id || '').localeCompare(String(b.id || ''))).slice(0, 2).map(pickBrief);
    }

    if (Object.keys(paradoxes).length) out.paradoxes = paradoxes;
    return out;
  }

  function buildPayload(entries, opts) {
    opts = opts || {};
    const en = !!opts.en;
    const scoped = filterEntries(entries, opts);
    const scope = clamp(
      opts.programme ? opts.programme : opts.year ? String(opts.year) : (en ? 'All watched films' : '全部观影'),
      60
    );

    let tasteSummary = null;
    if (opts.tasteReport && typeof opts.tasteReport.analyze === 'function') {
      try {
        const a = opts.tasteReport.analyze(entries, {
          en,
          year: opts.year || '',
          programme: opts.programme || '',
          inProg: opts.inProg
        });
        if (a && a.ok) {
          const qs = Array.isArray(a.q) ? a.q : [0, 0, 0, 0];
          tasteSummary = {
            ratedCount: a.n || 0,
            code: clamp(a.code, 8),
            persona: clamp((a.type && a.type.name) || '', 40),
            title: clamp(a.persona || '', 60),
            avgFun: round1(a.avgF || 0),
            avgBore: round1(a.avgB || 0),
            quadrants: {
              enduring: qs[0] || 0,
              captivating: qs[1] || 0,
              quiet: qs[2] || 0,
              delightful: qs[3] || 0,
              unsure: a.unsure || 0
            }
          };
          if (a.mode && a.mode.n >= 3) {
            tasteSummary.mode = { fun: round1(a.mode.fun), bore: round1(a.mode.bore), n: a.mode.n };
          }
          if (a.base && a.base.code && a.base.code !== a.code) {
            tasteSummary.shift = clamp((en ? 'Overall ' : '平时 ') + a.base.code + ' ' + a.base.name + ' -> ' + a.code + ' ' + ((a.type && a.type.name) || ''), 80);
          } else if (a.prev && a.prev.code && a.prev.code !== a.code) {
            tasteSummary.shift = clamp(a.prev.year + ' ' + a.prev.code + ' ' + a.prev.name + ' -> ' + a.code + ' ' + ((a.type && a.type.name) || ''), 80);
          }
        }
      } catch (e) {}
    }

    // 选出最具代表性的最多 MAX_FILMS 部影片，再按 id 排序保证指纹稳定
    const picked = scoped.slice().sort((a, b) => {
      const diff = filmPriority(b) - filmPriority(a);
      if (diff !== 0) return diff;
      const dCmp = String((b.rec && b.rec.d) || '').localeCompare(String((a.rec && a.rec.d) || ''));
      if (dCmp !== 0) return dCmp;
      return String(a.id || '').localeCompare(String(b.id || ''));
    }).slice(0, MAX_FILMS).sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')));

    const topFilms = picked.map(e => compactFilm(e, en)).filter(x => !!x.t);
    const signals = buildSignals(scoped, en);
    const payload = {
      action: 'taste_portrait',
      lang: en ? 'en' : 'zh',
      scope,
      watchedCount: scoped.length,
      topFilms
    };
    if (tasteSummary) payload.tasteSummary = tasteSummary;
    if (Object.keys(signals).length) payload.signals = signals;
    return { ok: topFilms.length >= MIN_FILMS, watchedCount: scoped.length, ratedCount: tasteSummary ? tasteSummary.ratedCount : 0, payload };
  }

  function fingerprint(payload) {
    const s = JSON.stringify(payload || {});
    return 'tp2-' + fnv1a(s, 2166136261).toString(36) + '-' + fnv1a(s, 3735928559).toString(36);
  }

  function normalizePortrait(raw) {
    const src = raw && typeof raw === 'object' ? (raw.portrait && typeof raw.portrait === 'object' ? raw.portrait : raw) : null;
    if (!src) return null;
    const commentary = String(src.commentary || '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 1400);
    if (!commentary) return null;
    const headline = clamp(src.headline, 48);
    const tags = (Array.isArray(src.tags) ? src.tags : []).map(t => clamp(t, 24)).filter(Boolean).slice(0, 4);
    const nextHint = clamp(src.nextHint, 180);
    const paragraphs = commentary.split(/\n+/).map(p => p.trim()).filter(Boolean);
    return { headline, tags, commentary, paragraphs, nextHint };
  }

  function loadStore(getItem, key) {
    try {
      const raw = getItem(key);
      if (!raw) return {};
      const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
    } catch (e) {
      return {};
    }
  }

  function readCache(getItem, key, fp) {
    if (!fp) return null;
    const store = loadStore(getItem, key);
    const hit = store[fp];
    if (!hit || !hit.p) return null;
    const portrait = normalizePortrait(hit.p);
    return portrait ? { portrait, at: Number(hit.at) || 0, cached: true } : null;
  }

  function writeCache(getItem, setItem, key, fp, portrait, nowMs) {
    const norm = normalizePortrait(portrait);
    if (!fp || !norm) return null;
    const store = loadStore(getItem, key);
    store[fp] = {
      p: { headline: norm.headline, tags: norm.tags, commentary: norm.commentary, nextHint: norm.nextHint },
      at: Number(nowMs) || Date.now()
    };
    const keys = Object.keys(store).sort((a, b) => (store[b].at || 0) - (store[a].at || 0));
    keys.slice(CACHE_MAX).forEach(k => { delete store[k]; });
    try {
      setItem(key, JSON.stringify(store));
    } catch (e) {}
    return norm;
  }

  function formatCopyText(portrait, scopeLabel, en) {
    const p = normalizePortrait(portrait);
    if (!p) return '';
    const lines = [];
    const header = en
      ? ('Sparrow Film Passport · AI Taste Portrait' + (scopeLabel ? ' (' + scopeLabel + ')' : ''))
      : ('麻雀观影护照 · AI 观影画像' + (scopeLabel ? '（' + scopeLabel + '）' : ''));
    lines.push(header);
    if (p.headline) lines.push(p.headline);
    if (p.tags.length) lines.push(p.tags.map(t => '#' + t).join(' '));
    lines.push('');
    lines.push(p.commentary);
    if (p.nextHint) {
      lines.push('');
      lines.push((en ? 'Next to try: ' : '下一步建议：') + p.nextHint);
    }
    return lines.join('\n');
  }

  return {
    MIN_FILMS,
    MAX_FILMS,
    CACHE_MAX,
    WEB_CACHE_KEY,
    MINI_CACHE_KEY,
    buildPayload,
    fingerprint,
    normalizePortrait,
    readCache,
    writeCache,
    formatCopyText
  };
});
