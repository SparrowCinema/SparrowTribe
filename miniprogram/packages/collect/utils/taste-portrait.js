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
    const views = Array.isArray(rec.v) ? Math.max(1, rec.v.length) : 1;
    if (views > 1) sc += Math.min(20, (views - 1) * 8);
    return sc;
  }

  function compactFilm(e, en) {
    const f = e.f || {}, rec = e.rec || {};
    const title = clamp(en ? (f.en || f.cn || f.title) : (f.cn || f.title || f.en), 60);
    const out = { t: title };
    if (f.y) out.y = clamp(String(f.y), 8);
    if (f.c) out.c = clamp(f.c, 28);
    if (f.dir) out.d = clamp(f.dir, 36);
    if (f.genre) out.g = clamp(Array.isArray(f.genre) ? f.genre.join('/') : f.genre, 36);
    if (typeof rec.r === 'number' && rec.r > 0) out.r = round1(rec.r);
    if (validTaste(rec.fun)) out.fun = round1(rec.fun);
    if (validTaste(rec.bore)) out.bore = round1(rec.bore);
    const views = Array.isArray(rec.v) ? Math.max(1, rec.v.length) : 1;
    if (views > 1) out.v = views;
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
    const payload = {
      action: 'taste_portrait',
      lang: en ? 'en' : 'zh',
      scope,
      watchedCount: scoped.length,
      topFilms
    };
    if (tasteSummary) payload.tasteSummary = tasteSummary;
    return { ok: topFilms.length >= MIN_FILMS, watchedCount: scoped.length, ratedCount: tasteSummary ? tasteSummary.ratedCount : 0, payload };
  }

  function fingerprint(payload) {
    const s = JSON.stringify(payload || {});
    return 'tp1-' + fnv1a(s, 2166136261).toString(36) + '-' + fnv1a(s, 3735928559).toString(36);
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
