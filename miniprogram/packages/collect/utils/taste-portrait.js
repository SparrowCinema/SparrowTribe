/* 由 tools/build-fallback.js 从 shared/taste-portrait.js 复制，请改 shared/taste-portrait.js 后重新运行。 */
/* 个人观影画像 / AI 评语共享模块（2026-11-25）
 * 网站与小程序共用；小程序副本 miniprogram/packages/collect/utils/taste-portrait.js 由 node tools/build-fallback.js 复制。
 * 职责：
 * 1. 从本机看过记录与趣味四象限中提取精简、无隐私的摘要（不含同步码、私人笔记、排片）；
 * 2. 计算稳定指纹用于本机缓存（记录未变动时不重复调用 AI 接口）；
 * 3. 本机短时间 / 每日生成配额检查（配合服务端按账号 / IP 限流，避免高频重复刷新消耗 API）；
 * 4. 归一化 AI 返回的结构化画像并绘制带小程序二维码的分享长图（画布 2D，不碰 DOM / wx）。 */
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
  const WEB_QUOTA_KEY = 'sparrow-ai-portrait-rl-v1';
  const MINI_QUOTA_KEY = 'sk-ai-portrait-rl-v1';
  const HOUR_LIMIT = 3;
  const HOUR_MS = 60 * 60 * 1000;
  const DAY_LIMIT = 5;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const CARD_W = 1080;
  const CARD_P = 64;
  const CARD_FOOT = 420;
  const SERIF = '"Noto Serif SC","Songti SC",serif';
  const SANS = '"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif';
  const MONO = '"IBM Plex Mono",Menlo,monospace';
  const CJK = /[　-〿㐀-鿿＀-￯]/;
  const COL = { paper: '#efe6d4', card: '#f8f2e6', tint: '#f1e7d5', ink: '#2b2117', muted: '#7a6a55', line: '#d8cbb1', teal: '#2f6f6c', gold: '#d9bc80' };

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

  // ---- 短时间 / 每日生成配额（前端同步拦截 + 配合服务端按账号/IP限流） ----
  function loadQuota(getItem, key) {
    const raw = loadStore(getItem, key);
    const ts = Array.isArray(raw.ts) ? raw.ts.map(Number).filter(n => Number.isFinite(n) && n > 0).sort((a, b) => a - b) : [];
    const until = Number.isFinite(Number(raw.until)) ? Number(raw.until) : 0;
    const scope = raw.scope === 'day' ? 'day' : 'hour';
    return { ts, until, scope };
  }

  function evalQuota(st, nowMs) {
    const now = Number(nowMs) || Date.now();
    const dayHits = st.ts.filter(t => t > now - DAY_MS && t <= now + 60000);
    const hourHits = dayHits.filter(t => t > now - HOUR_MS);
    const hourLeft = Math.max(0, HOUR_LIMIT - hourHits.length);
    const dayLeft = Math.max(0, DAY_LIMIT - dayHits.length);
    const remain = Math.min(hourLeft, dayLeft);
    if (st.until > now) {
      return { ok: false, scope: st.scope || 'hour', waitMs: st.until - now, hourLeft: 0, dayLeft, remain: 0, usedHour: hourHits.length, usedDay: dayHits.length, hourLimit: HOUR_LIMIT, dayLimit: DAY_LIMIT };
    }
    if (hourHits.length >= HOUR_LIMIT) {
      const waitMs = Math.max(1000, hourHits[0] + HOUR_MS - now);
      return { ok: false, scope: 'hour', waitMs, hourLeft: 0, dayLeft, remain: 0, usedHour: hourHits.length, usedDay: dayHits.length, hourLimit: HOUR_LIMIT, dayLimit: DAY_LIMIT };
    }
    if (dayHits.length >= DAY_LIMIT) {
      const waitMs = Math.max(1000, dayHits[0] + DAY_MS - now);
      return { ok: false, scope: 'day', waitMs, hourLeft, dayLeft: 0, remain: 0, usedHour: hourHits.length, usedDay: dayHits.length, hourLimit: HOUR_LIMIT, dayLimit: DAY_LIMIT };
    }
    return { ok: true, scope: 'hour', waitMs: 0, hourLeft, dayLeft, remain, usedHour: hourHits.length, usedDay: dayHits.length, hourLimit: HOUR_LIMIT, dayLimit: DAY_LIMIT };
  }

  function checkQuota(getItem, key, nowMs) {
    return evalQuota(loadQuota(getItem, key), nowMs);
  }

  function recordQuota(getItem, setItem, key, nowMs) {
    const now = Number(nowMs) || Date.now();
    const st = loadQuota(getItem, key);
    const ts = st.ts.filter(t => t > now - DAY_MS && t <= now + 60000);
    ts.push(now);
    const next = { ts, until: st.until > now ? st.until : 0, scope: st.scope };
    try { setItem(key, JSON.stringify(next)); } catch (e) {}
    return evalQuota(next, now);
  }

  function lockQuota(getItem, setItem, key, retryAfterSec, scope, nowMs) {
    const now = Number(nowMs) || Date.now();
    const st = loadQuota(getItem, key);
    const ts = st.ts.filter(t => t > now - DAY_MS && t <= now + 60000);
    const sec = Math.max(60, Math.min(24 * 3600, Math.round(Number(retryAfterSec) || 600)));
    const next = { ts, until: Math.max(st.until || 0, now + sec * 1000), scope: scope === 'day' ? 'day' : 'hour' };
    try { setItem(key, JSON.stringify(next)); } catch (e) {}
    return evalQuota(next, now);
  }

  function formatQuotaWait(waitMs, en) {
    const mins = Math.max(1, Math.ceil((Number(waitMs) || 0) / 60000));
    if (mins < 60) return en ? (mins + ' min') : (mins + ' 分钟');
    const hrs = Math.ceil(mins / 60);
    return en ? (hrs + 'h') : (hrs + ' 小时');
  }

  function formatQuotaMsg(q, en) {
    if (!q || q.ok) return '';
    const wait = formatQuotaWait(q.waitMs, en);
    if (q.scope === 'day') {
      return en
        ? ('Daily generation limit reached (' + DAY_LIMIT + ' per 24h). Try again in ~' + wait + '; saved portraits stay cached on this device.')
        : ('24 小时内已达生成上限（最多 ' + DAY_LIMIT + ' 次），请约 ' + wait + '后再试；已生成的画像已缓存在本机。');
    }
    return en
      ? ('Hourly generation limit reached (' + HOUR_LIMIT + ' per hour). Try again in ~' + wait + '; saved portraits stay cached on this device.')
      : ('短时间内已达生成上限（每小时最多 ' + HOUR_LIMIT + ' 次），请约 ' + wait + '后再试；已生成的画像已缓存在本机。');
  }

  function quotaBtnLabel(q, busy, en) {
    if (busy) return en ? 'Generating…' : '生成中…';
    if (q && !q.ok) {
      const wait = formatQuotaWait(q.waitMs, en);
      return en ? ('Retry in ' + wait) : ('约 ' + wait + '后再试');
    }
    if (q && q.remain === 1) return en ? 'Regenerate (1 left)' : '重新生成（余1次）';
    return en ? 'Regenerate' : '重新生成';
  }

  // ---- 分享图片画布绘制（1080px 宽，复用 shared/recap.js 的小程序码页脚） ----
  function rr(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function wrapCard(c, text, max) {
    text = String(text || '');
    const out = [];
    let line = '';
    if (!CJK.test(text) && /\s/.test(text)) {
      text.split(/\s+/).forEach(w => {
        const t = line ? line + ' ' + w : w;
        if (c.measureText(t).width > max && line) { out.push(line); line = w; }
        else line = t;
      });
    } else {
      for (const ch of text) {
        if (c.measureText(line + ch).width > max && line) { out.push(line); line = ch; }
        else line += ch;
      }
    }
    if (line) out.push(line);
    for (let i = 1; i < out.length; i++) {
      const m = out[i].match(/^[：:，,、。.！!？?）)」』·；;]+/);
      if (m) { out[i - 1] += m[0]; out[i] = out[i].slice(m[0].length); }
    }
    return out.filter(Boolean);
  }

  function layoutTagRows(c, tags, maxW) {
    const rows = [];
    let cur = [], x = 0;
    c.font = '600 22px ' + SANS;
    (tags || []).forEach(tag => {
      const text = '#' + tag;
      const w = c.measureText(text).width + 30;
      if (cur.length && x + w > maxW) {
        rows.push(cur);
        cur = [];
        x = 0;
      }
      cur.push({ text, w });
      x += w + 12;
    });
    if (cur.length) rows.push(cur);
    return rows;
  }

  function cardLayout(c, portrait, o) {
    o = o || {};
    const p = normalizePortrait(portrait);
    if (!p) return null;
    const en = !!o.en;
    const innerW = CARD_W - 2 * CARD_P;
    const headTextW = innerW - 24;

    // 标题自动选字号并折行
    let headFs = en ? 48 : 54;
    let headLines = [];
    if (p.headline) {
      c.font = '900 ' + headFs + 'px ' + SERIF;
      headLines = wrapCard(c, p.headline, headTextW);
      if (headLines.length > 2) {
        headFs = en ? 40 : 44;
        c.font = '900 ' + headFs + 'px ' + SERIF;
        headLines = wrapCard(c, p.headline, headTextW);
      }
    }
    const headLH = Math.round(headFs * 1.32);
    const tagRows = layoutTagRows(c, p.tags, headTextW);

    // 页眉总高：上边距 + kicker + 归属/日期 + 标题 + 标签行 + 统计行 + 下边距
    let headH = 196;
    if (headLines.length) headH += headLines.length * headLH + 26;
    if (tagRows.length) headH += tagRows.length * 52 + 16;
    headH += 94;

    // 趣味人格条（可选）
    const ts = o.tasteSummary && o.tasteSummary.code && o.tasteSummary.persona ? o.tasteSummary : null;
    const personaH = ts ? 112 : 0;

    // 评语卡片
    const bodyTextW = innerW - 88;
    const bodyFs = en ? 29 : 32;
    const bodyLH = en ? 48 : 54;
    c.font = '400 ' + bodyFs + 'px ' + SANS;
    const paras = p.paragraphs.map(par => wrapCard(c, par, bodyTextW));
    const parasContentH = paras.reduce((s, ls, i) => s + ls.length * bodyLH + (i ? 26 : 0), 0);

    // 下一步建议卡片（嵌在评语卡底部，与页面视觉一致）
    let nextLines = [];
    const nextFs = en ? 25 : 27;
    const nextLH = en ? 40 : 44;
    if (p.nextHint) {
      c.font = '400 ' + nextFs + 'px ' + SANS;
      nextLines = wrapCard(c, p.nextHint, bodyTextW - 56);
    }
    const nextBoxH = nextLines.length ? (76 + nextLines.length * nextLH + 24) : 0;
    const bodyCardH = 74 + parasContentH + (nextBoxH ? (36 + nextBoxH) : 0) + 52;

    const gap1 = 36;
    const gap2 = ts ? 24 : 0;
    const footH = o.footer ? CARD_FOOT : 40;
    const totalH = headH + gap1 + personaH + gap2 + bodyCardH + 20 + footH;

    return {
      p, en, innerW, headTextW, headFs, headLH, headLines, tagRows, headH,
      ts, personaH, bodyTextW, bodyFs, bodyLH, paras,
      nextFs, nextLH, nextLines, nextBoxH, bodyCardH, gap1, gap2, totalH
    };
  }

  function cardHeight(c, portrait, o) {
    const g = cardLayout(c, portrait, o);
    return g ? g.totalH : 0;
  }

  function drawCard(c, portrait, o) {
    o = o || {};
    const g = cardLayout(c, portrait, o);
    if (!g) return;
    const { p, en, innerW, headTextW, headFs, headLH, headLines, tagRows, headH, ts, personaH, bodyFs, bodyLH, paras, nextFs, nextLH, nextLines, nextBoxH, bodyCardH, gap1, gap2, totalH } = g;

    c.textBaseline = 'alphabetic';
    c.textAlign = 'left';
    c.fillStyle = COL.paper;
    c.fillRect(0, 0, CARD_W, totalH);

    // 1. 深海青渐变页眉 + 双层金边
    const gr = c.createLinearGradient(0, 0, CARD_W, headH);
    gr.addColorStop(0, '#1f3534');
    gr.addColorStop(1, '#121c1c');
    c.fillStyle = gr;
    c.fillRect(0, 0, CARD_W, headH);
    const glow = c.createLinearGradient(0, 0, CARD_W, headH);
    glow.addColorStop(0, 'rgba(47,111,108,0.45)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = glow;
    c.fillRect(0, 0, CARD_W, headH);

    c.strokeStyle = COL.gold;
    c.globalAlpha = 0.72;
    c.lineWidth = 2;
    c.strokeRect(28, 28, CARD_W - 56, headH - 56);
    c.lineWidth = 1;
    c.strokeRect(38, 38, CARD_W - 76, headH - 76);
    c.globalAlpha = 1;

    const hx = CARD_P + 12;
    c.fillStyle = COL.gold;
    c.font = '600 22px ' + MONO;
    c.fillText('SPARROW FILM PASSPORT · AI TASTE PORTRAIT', hx, 98);

    const holder = clamp(o.holder, 24);
    const ownerTitle = en
      ? (holder ? holder + "'s AI Taste Portrait" : 'My AI Taste Portrait')
      : ((holder || '我') + '的 AI 观影画像');
    c.fillStyle = 'rgba(255,250,240,0.88)';
    c.font = '700 28px ' + SANS;
    c.fillText(ownerTitle, hx, 148);
    if (o.date) {
      c.fillStyle = 'rgba(217,188,128,0.85)';
      c.font = '500 22px ' + MONO;
      c.textAlign = 'right';
      c.fillText(String(o.date), CARD_W - CARD_P - 12, 148);
      c.textAlign = 'left';
    }

    let hy = 196;
    if (headLines.length) {
      c.fillStyle = '#fffaf0';
      c.font = '900 ' + headFs + 'px ' + SERIF;
      headLines.forEach((line, idx) => {
        c.fillText(line, hx, hy + headFs + idx * headLH);
      });
      hy += headLines.length * headLH + 26;
    }

    if (tagRows.length) {
      c.font = '600 22px ' + SANS;
      tagRows.forEach(row => {
        let tx = hx;
        row.forEach(item => {
          c.strokeStyle = COL.gold;
          c.lineWidth = 1.6;
          rr(c, tx, hy, item.w, 40, 20);
          c.stroke();
          c.fillStyle = COL.gold;
          c.fillText(item.text, tx + 15, hy + 28);
          tx += item.w + 12;
        });
        hy += 52;
      });
    }

    const scopeStr = clamp(o.scope, 40) || (en ? 'All watched films' : '全部观影');
    const wc = Number(o.watchedCount) || 0;
    const rc = Number(o.ratedCount) || 0;
    const statText = scopeStr
      + (wc ? (en ? ' · ' + wc + ' watched' : ' · ' + wc + ' 部看过') : '')
      + (rc ? (en ? ' · ' + rc + ' taste-rated' : ' · ' + rc + ' 部已评趣味') : '');
    c.fillStyle = 'rgba(255,250,240,0.68)';
    c.font = '400 22px ' + SANS;
    c.fillText(statText, hx, headH - 54);

    let y = headH + gap1;

    // 2. 趣味人格条（可选）
    if (ts) {
      c.fillStyle = COL.card;
      rr(c, CARD_P, y, innerW, personaH, 20);
      c.fill();
      c.strokeStyle = COL.line;
      c.lineWidth = 2;
      c.stroke();

      c.font = '800 26px ' + MONO;
      const cw = c.measureText(ts.code).width + 36;
      c.fillStyle = COL.teal;
      rr(c, CARD_P + 28, y + 30, cw, 52, 26);
      c.fill();
      c.fillStyle = '#fffaf0';
      c.fillText(ts.code, CARD_P + 46, y + 65);

      c.fillStyle = COL.ink;
      c.font = '700 28px ' + SANS;
      c.fillText(clamp(ts.persona, 26), CARD_P + 46 + cw, y + 65);

      if (typeof ts.avgFun === 'number' && typeof ts.avgBore === 'number') {
        c.fillStyle = COL.muted;
        c.font = '500 22px ' + MONO;
        c.textAlign = 'right';
        const ab = en
          ? ('FUN ' + ts.avgFun.toFixed(1) + ' · BORE ' + ts.avgBore.toFixed(1))
          : ('有趣 ' + ts.avgFun.toFixed(1) + ' · 无聊 ' + ts.avgBore.toFixed(1));
        c.fillText(ab, CARD_W - CARD_P - 28, y + 64);
        c.textAlign = 'left';
      }
      y += personaH + gap2;
    }

    // 3. 影评正文卡片
    c.fillStyle = COL.card;
    rr(c, CARD_P, y, innerW, bodyCardH, 22);
    c.fill();
    c.strokeStyle = COL.line;
    c.lineWidth = 2;
    c.stroke();

    // 顶部细饰线与引言符
    c.save();
    rr(c, CARD_P, y, innerW, bodyCardH, 22);
    c.clip();
    c.fillStyle = COL.teal;
    c.fillRect(CARD_P, y, innerW, 8);
    c.restore();

    c.fillStyle = 'rgba(47,111,108,0.18)';
    c.font = '900 84px ' + SERIF;
    c.fillText('“', CARD_P + 36, y + 86);

    let ty = y + 74 + bodyFs;
    c.fillStyle = COL.ink;
    c.font = '400 ' + bodyFs + 'px ' + SANS;
    paras.forEach((lines, idx) => {
      if (idx > 0) ty += 26;
      lines.forEach(line => {
        c.fillText(line, CARD_P + 44, ty);
        ty += bodyLH;
      });
    });

    // 4. 下一步建议
    if (nextLines.length) {
      const ny = y + bodyCardH - 52 - nextBoxH;
      const nx = CARD_P + 40;
      const nw = innerW - 80;
      c.fillStyle = COL.tint;
      rr(c, nx, ny, nw, nextBoxH, 16);
      c.fill();
      c.save();
      rr(c, nx, ny, nw, nextBoxH, 16);
      c.clip();
      c.fillStyle = COL.teal;
      c.fillRect(nx, ny, 8, nextBoxH);
      c.restore();

      c.fillStyle = COL.teal;
      c.font = '700 22px ' + SANS;
      c.fillText(en ? '✦ NEXT TO TRY' : '✦ 下一步建议', nx + 28, ny + 44);
      c.fillStyle = COL.ink;
      c.font = '400 ' + nextFs + 'px ' + SANS;
      nextLines.forEach((line, i) => {
        c.fillText(line, nx + 28, ny + 82 + i * nextLH);
      });
    }

    y += bodyCardH + 20;
    if (o.footer) o.footer(c, y, totalH);
  }

  return {
    MIN_FILMS,
    MAX_FILMS,
    CACHE_MAX,
    WEB_CACHE_KEY,
    MINI_CACHE_KEY,
    WEB_QUOTA_KEY,
    MINI_QUOTA_KEY,
    HOUR_LIMIT,
    HOUR_MS,
    DAY_LIMIT,
    DAY_MS,
    CARD_W,
    CARD_FOOT,
    buildPayload,
    fingerprint,
    normalizePortrait,
    readCache,
    writeCache,
    formatCopyText,
    checkQuota,
    recordQuota,
    lockQuota,
    formatQuotaWait,
    formatQuotaMsg,
    quotaBtnLabel,
    cardHeight,
    drawCard
  };
});

