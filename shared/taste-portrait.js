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

  // ===== 生成次数限制（2026-11-26）=====
  // 每次真正调用 AI 都计一次（读本机缓存不算）：1 小时内最多 QUOTA.hour 次、24 小时内最多 QUOTA.day 次。
  // 小程序以 taste 云函数按微信账号计数为准（cloudfunctions/taste，同样的数字），本机记录只用于显示剩余次数；网站没有账号，按本机计数。
  const QUOTA = { hour: 3, day: 8 };
  const WEB_QUOTA_KEY = 'sparrow-ai-portrait-log';
  const MINI_QUOTA_KEY = 'sk-ai-portrait-log';
  const HOUR = 36e5, DAY = 864e5;
  function quotaState(log, nowMs) {
    const now = Number(nowMs) || Date.now();
    const ts = (Array.isArray(log) ? log : []).filter(t => typeof t === 'number' && t > now - DAY && t <= now + 6e4).sort((a, b) => a - b);
    const inHour = ts.filter(t => t > now - HOUR);
    let waitMs = 0;
    if (inHour.length >= QUOTA.hour) waitMs = Math.max(waitMs, inHour[inHour.length - QUOTA.hour] + HOUR - now);
    if (ts.length >= QUOTA.day) waitMs = Math.max(waitMs, ts[ts.length - QUOTA.day] + DAY - now);
    const hourLeft = Math.max(0, QUOTA.hour - inHour.length), dayLeft = Math.max(0, QUOTA.day - ts.length);
    return { ok: waitMs <= 0, left: Math.min(hourLeft, dayLeft), hourLeft, dayLeft, waitMs: Math.max(0, Math.ceil(waitMs)), log: ts };
  }
  function quotaAdd(log, nowMs) { const now = Number(nowMs) || Date.now(); return quotaState(log, now).log.concat(now); }
  function waitText(ms, en) {
    const m = Math.max(1, Math.ceil((Number(ms) || 0) / 6e4));
    if (m < 60) return en ? 'about ' + m + ' min' : '约 ' + m + ' 分钟';
    const h = Math.ceil(m / 60);
    return en ? 'about ' + h + ' h' : '约 ' + h + ' 小时';
  }
  function quotaText(st, en) {
    if (!st) return '';
    if (!st.ok) return en ? 'Generation limit reached — try again in ' + waitText(st.waitMs, true) + '.' : '生成次数已达上限，' + waitText(st.waitMs, false) + '后可再生成。';
    return en ? 'You can regenerate ' + st.left + ' more time' + (st.left === 1 ? '' : 's') + ' this hour (up to ' + QUOTA.day + ' a day).'
      : '1 小时内还可重新生成 ' + st.left + ' 次（每天最多 ' + QUOTA.day + ' 次）';
  }

  // ===== 分享图片（2026-11-26）：画像 + 小程序码，网站与小程序共用同一套排版 =====
  // shareHeight(c, o) / drawShare(c, o) 的 o：portrait、scope、count（影片数）、holder、date、qrImg（小程序码图片）、en
  const SW = 1080, SP = 72, FOOT = 330;
  const SERIF = '"Noto Serif SC","Songti SC","STSong",serif', SANS = '"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif', MONO = '"IBM Plex Mono",Menlo,monospace';
  const PC = { paper: '#efe6d4', card: '#f8f2e6', ink: '#2b2117', muted: '#7a6a55', line: '#d8cbb1', red: '#8e2a22', gold: '#d9bc80', teal: '#2f6f6c', dark: '#2b2117' };
  const CJKR = /[　-〿㐀-鿿＀-￯]/;
  function wrap(c, text, max) {
    text = String(text || ''); const out = []; let line = '';
    if (!CJKR.test(text) && /\s/.test(text)) text.split(/\s+/).forEach(w => { const t = line ? line + ' ' + w : w; if (c.measureText(t).width > max && line) { out.push(line); line = w; } else line = t; });
    else for (const ch of text) { if (c.measureText(line + ch).width > max && line) { out.push(line); line = ch; } else line += ch; }
    if (line) out.push(line);
    for (let i = 1; i < out.length; i++) { const m = out[i].match(/^[：:，,、。.！!？?）)」』”·]+/); if (m) { out[i - 1] += m[0]; out[i] = out[i].slice(m[0].length); } }
    return out.filter(Boolean);
  }
  function rrect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  // 先排版（只量不画）再按同一结果绘制，保证高度与画面一致
  function paintShare(c, o, draw) {
    const p = normalizePortrait(o && o.portrait); if (!p) return 0;
    const en = !!o.en, inner = SW - SP * 2, put = (fn) => { if (draw) fn(); };
    let y = 120;
    put(() => { c.fillStyle = PC.paper; c.fillRect(0, 0, SW, 10000); });
    const ops = [];
    const text = (str, x, yy, font, color, align) => ops.push(() => { c.font = font; c.fillStyle = color; c.textAlign = align || 'left'; c.textBaseline = 'alphabetic'; c.fillText(str, x, yy); });
    text('AI FILM PORTRAIT', SP, y, '600 26px ' + MONO, PC.red);
    y += 74;
    const holder = clamp(o.holder, 16);
    const title = en ? (holder ? holder + "'s AI Film Portrait" : 'My AI Film Portrait') : (holder ? holder + '的 AI 观影画像' : '我的 AI 观影画像');
    c.font = '900 56px ' + SERIF; wrap(c, title, inner).slice(0, 2).forEach((l, i) => { text(l, SP, y + i * 70, '900 56px ' + SERIF, PC.ink); y += i ? 70 : 0; });
    y += 54;
    const meta = [clamp(o.scope, 30), o.count ? (en ? o.count + ' film' + (o.count === 1 ? '' : 's') : o.count + ' 部影片') : '', clamp(o.date, 12)].filter(Boolean).join(' · ');
    text(meta, SP, y, '400 28px ' + SANS, PC.muted);
    y += 40; const lineY = y; ops.push(() => { c.strokeStyle = PC.line; c.lineWidth = 2; c.beginPath(); c.moveTo(SP, lineY); c.lineTo(SW - SP, lineY); c.stroke(); });
    y += 74;
    if (p.headline) { c.font = '900 50px ' + SERIF; const hl = wrap(c, p.headline, inner); hl.forEach((l, i) => text(l, SP, y + i * 68, '900 50px ' + SERIF, PC.red)); y += (hl.length - 1) * 68 + 40; }
    if (p.tags.length) {
      c.font = '500 26px ' + SANS; let x = SP, ty = y + 6;
      p.tags.forEach(t => { const w = c.measureText('#' + t).width + 40; if (x + w > SW - SP) { x = SP; ty += 64; } const xx = x, yy = ty; ops.push(() => { c.fillStyle = 'rgba(47,111,108,.10)'; rrect(c, xx, yy, w, 48, 24); c.fill(); c.font = '500 26px ' + SANS; c.fillStyle = PC.teal; c.textAlign = 'left'; c.fillText('#' + t, xx + 20, yy + 33); }); x += w + 14; });
      y = ty + 48 + 66;
    }
    c.font = '400 32px ' + SANS;
    p.paragraphs.forEach((para, pi) => { const ls = wrap(c, para, inner); ls.forEach((l, i) => text(l, SP, y + i * 54, '400 32px ' + SANS, PC.ink)); y += ls.length * 54 + (pi < p.paragraphs.length - 1 ? 24 : 0); });
    if (p.nextHint) {
      y += 6; c.font = '400 30px ' + SANS; const nl = wrap(c, p.nextHint, inner - 64), bh = 40 + 40 + nl.length * 48 + 22, by = y;
      ops.push(() => { c.fillStyle = 'rgba(217,188,128,.28)'; rrect(c, SP, by, inner, bh, 20); c.fill(); });
      text(en ? 'NEXT TO TRY' : '下一步建议', SP + 32, by + 56, '700 26px ' + SANS, PC.teal);
      nl.forEach((l, i) => text(l, SP + 32, by + 108 + i * 48, '400 30px ' + SANS, PC.ink));
      y = by + bh;
    }
    y += 52;
    text(en ? 'Written by AI from my watch history · for fun' : '由 AI 根据我的观影记录生成 · 仅供娱乐', SP, y, '400 24px ' + SANS, PC.muted);
    y += 56;
    const H = y + FOOT;
    if (!draw) return H;
    c.fillStyle = PC.paper; c.fillRect(0, 0, SW, H);
    ops.forEach(f => f());
    // 页脚深色通栏：小程序码 + 说明
    const fy = y; c.fillStyle = PC.dark; c.fillRect(0, fy, SW, FOOT);
    const qs = 220, qx = SP, qy = fy + (FOOT - qs) / 2;
    c.fillStyle = '#ffffff'; rrect(c, qx - 12, qy - 12, qs + 24, qs + 24, 24); c.fill();
    if (o.qrImg) { try { c.drawImage(o.qrImg, qx, qy, qs, qs); } catch (e) {} }
    const tx = qx + qs + 56;
    c.textAlign = 'left'; c.fillStyle = PC.card; c.font = '900 42px ' + SERIF; c.fillText(en ? 'Scan for your own portrait' : '扫码生成你的 AI 观影画像', tx, fy + 124);
    c.fillStyle = PC.gold; c.font = '400 28px ' + SANS; c.fillText(en ? 'WeChat mini-program: 麻雀观影护照' : '微信小程序「麻雀观影护照」', tx, fy + 178);
    c.fillStyle = '#b7a68b'; c.font = '400 24px ' + SANS; c.fillText(en ? 'Sparrow Movies × Sparrow Tribe' : '麻雀映画 × 麻雀部落', tx, fy + 222);
    return H;
  }
  const shareHeight = (c, o) => paintShare(c, o, false);
  const drawShare = (c, o) => paintShare(c, o, true);

  return {
    QUOTA,
    WEB_QUOTA_KEY,
    MINI_QUOTA_KEY,
    quotaState,
    quotaAdd,
    quotaText,
    waitText,
    SHARE_W: SW,
    shareHeight,
    drawShare,
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
