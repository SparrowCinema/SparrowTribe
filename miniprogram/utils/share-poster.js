/* 由 tools/build-fallback.js 从 shared/share-poster.js 复制，请改 shared/share-poster.js 后重新运行。 */
/* 麻雀观影护照 · 影片 / 专题分享海报（画布版）
 * 网站（shared/share-poster.js，window.SparrowSharePoster）与小程序（miniprogram/utils/share-poster.js，由 tools/build-fallback.js 复制）共用。
 * 只依赖 2d 画布接口，不碰 DOM / wx。
 *
 * heightOf(o) / draw(c, o) 的 o：
 *   kind: 'film' | 'programme'
 *   kicker                       页眉小字（英文大写）
 *   title, tag, en               片名 / 专题名、版本（如 4K修复）、英文名
 *   meta: [文字, ...]            导演 · 年份 · 地区 · 片长 等，每项一行（最多 3 行）
 *   lines: [{ when, where }]     下一场（影片最多 3 场）
 *   blurb                        专题简介（最多 5 行）
 *   stats: [[值, 标签], ...]     专题统计（最多 4 项）
 *   img                          影片海报（2:3）或专题头图（约 2.8:1）
 *   posters: [Image|null, ...]   专题页：即将放映的海报（最多 5 张）
 *   qrImg                        小程序页面码（小程序）；或 qr: 二维码矩阵（网站）
 *   qrText, qrSub                二维码旁说明；url（网站显示网址）
 *   marks: [Image|null, Image|null]  两枚品牌标
 *   T: 翻译函数
 */
(function (root) {
  const SERIF = '"Noto Serif SC","Songti SC","STSong",serif', SANS = '"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif', MONO = '"IBM Plex Mono",Menlo,monospace';
  const C = { paper: '#efe6d4', card: '#f8f2e6', ink: '#2b2117', muted: '#7a6a55', line: '#d8cbb1', red: '#8e2a22', gold: '#d9bc80', teal: '#2f6f6c' };
  const W = 1080, P = 64, FOOT = 380, CJK = /[　-〿㐀-鿿＀-￯]/;

  function wrapLines(c, text, max) {
    text = String(text || ''); const out = []; let line = '';
    if (!CJK.test(text) && /\s/.test(text)) text.split(/\s+/).forEach(w => { const t = line ? line + ' ' + w : w; if (c.measureText(t).width > max && line) { out.push(line); line = w; } else line = t; });
    else for (const ch of text) { if (c.measureText(line + ch).width > max && line) { out.push(line); line = ch; } else line += ch; }
    if (line) out.push(line);
    for (let i = 1; i < out.length; i++) { const m = out[i].match(/^[：:，,、。.！!？?）)」』·]+/); if (m) { out[i - 1] += m[0]; out[i] = out[i].slice(m[0].length); } }
    return out.filter(Boolean);
  }
  function clamp(c, text, max, n) { const ls = wrapLines(c, text, max); if (ls.length <= n) return ls; const k = ls.slice(0, n); k[n - 1] = k[n - 1].replace(/.$/, '') + '…'; return k; }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function cover(c, im, x, y, w, h, r) { c.save(); rr(c, x, y, w, h, r); c.clip(); const s = Math.max(w / im.width, h / im.height), iw = im.width * s, ih = im.height * s; c.drawImage(im, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); c.restore(); }
  function placeholder(c, x, y, w, h, r, text) { c.fillStyle = C.line; rr(c, x, y, w, h, r); c.fill(); c.fillStyle = C.muted; c.font = '900 ' + Math.round(w / 5) + 'px ' + SERIF; c.textAlign = 'center'; c.fillText(String(text || '').slice(0, 1), x + w / 2, y + h / 2 + w / 14); c.textAlign = 'left'; }

  // 先排版（算高度），再按同一排版绘制，保证 heightOf 与 draw 一致
  function layout(c, o) {
    const T = o.T || (s => s), L = { items: [] }; let y = 96;
    L.items.push({ t: 'kicker', y }); y += 34;
    if (o.kind === 'programme') {
      const bh = Math.round((W - 2 * P) / 2.82); L.items.push({ t: 'banner', y: y + 14, h: bh }); y += 14 + bh + 104;
      c.font = '900 64px ' + SERIF; const tl = clamp(c, o.title, W - 2 * P, 2); L.items.push({ t: 'title', y, lines: tl, size: 64, x: P, w: W - 2 * P }); y += tl.length * 80;
      if (o.en) { y += 4; L.items.push({ t: 'en', y, x: P }); y += 40; }
      (o.meta || []).slice(0, 2).forEach(m => { y += 6; L.items.push({ t: 'meta', y, text: m, x: P }); y += 38; });
      if ((o.stats || []).some(x => Number(x[0]) > 0)) { y += 26; L.items.push({ t: 'stats', y }); y += 128; }
      if (o.blurb) { c.font = '400 30px ' + SANS; const bl = clamp(c, o.blurb, W - 2 * P, 5); y += 52; L.items.push({ t: 'blurb', y, lines: bl }); y += bl.length * 50; }
      const ps = (o.posters || []).slice(0, 5); if (ps.length) { y += 40; L.items.push({ t: 'posters', y, list: ps }); y += Math.round((W - 2 * P - 4 * 18) / 5 * 1.5) + 10; }
    } else {
      const pw = 400, ph = 600, tx = P + pw + 48, tw = W - P - tx; L.items.push({ t: 'poster', y: y + 22, w: pw, h: ph });
      let ty = y + 22 + 62; c.font = '900 60px ' + SERIF; const tl = clamp(c, o.title, tw, 3); L.items.push({ t: 'title', y: ty, lines: tl, size: 60, x: tx, w: tw }); ty += tl.length * 76;
      if (o.tag) { L.items.push({ t: 'tag', y: ty, x: tx }); ty += 62; }
      if (o.en) { c.font = 'italic 500 28px ' + SANS; const el = clamp(c, o.en, tw, 2); L.items.push({ t: 'enl', y: ty, lines: el, x: tx }); ty += el.length * 38 + 10; }
      (o.meta || []).slice(0, 3).forEach(m => { L.items.push({ t: 'meta', y: ty, text: m, x: tx, w: tw }); ty += 42; });
      y = Math.max(y + 22 + ph, ty) + 84;
      const ls = (o.lines || []).slice(0, 3); L.items.push({ t: 'shows', y, list: ls }); y += 60 + Math.max(1, ls.length) * 92;
    }
    L.footY = y + 30; L.H = L.footY + FOOT; return L;
  }

  function heightOf(o, c) { return layout(c || measureCtx(), o).H; }
  let _m = null; function measureCtx() { // 没传画布时的近似测量（只用于网站预估高度）
    if (_m) return _m; try { if (typeof OffscreenCanvas !== 'undefined') return (_m = new OffscreenCanvas(10, 10).getContext('2d')); if (typeof document !== 'undefined') return (_m = document.createElement('canvas').getContext('2d')); } catch (e) {}
    return (_m = { font: '', measureText: t => ({ width: String(t).length * 30 }) });
  }

  function draw(c, o) {
    const T = o.T || (s => s), L = layout(c, o); c.textBaseline = 'alphabetic'; c.textAlign = 'left';
    c.fillStyle = C.paper; c.fillRect(0, 0, W, L.H);
    c.fillStyle = C.red; c.fillRect(0, 0, W, 10);
    L.items.forEach(it => {
      if (it.t === 'kicker') { c.fillStyle = C.red; c.font = '600 24px ' + MONO; c.fillText(o.kicker || 'SPARROW FILM PASSPORT', P, it.y); }
      else if (it.t === 'banner') { if (o.img) cover(c, o.img, P, it.y, W - 2 * P, it.h, 18); else { c.fillStyle = C.ink; rr(c, P, it.y, W - 2 * P, it.h, 18); c.fill(); } }
      else if (it.t === 'poster') { c.save(); c.shadowColor = 'rgba(43,33,23,.28)'; c.shadowBlur = 30; c.shadowOffsetY = 12; c.fillStyle = C.card; rr(c, P, it.y, it.w, it.h, 14); c.fill(); c.restore(); if (o.img) cover(c, o.img, P, it.y, it.w, it.h, 14); else placeholder(c, P, it.y, it.w, it.h, 14, o.title); }
      else if (it.t === 'title') { c.fillStyle = C.ink; c.font = '900 ' + it.size + 'px ' + SERIF; it.lines.forEach((l, i) => c.fillText(l, it.x, it.y + i * (it.size + 16))); }
      else if (it.t === 'tag') { c.font = '700 26px ' + SANS; const w = c.measureText(o.tag).width + 28; c.strokeStyle = C.red; c.lineWidth = 2; rr(c, it.x, it.y - 34, w, 46, 8); c.stroke(); c.fillStyle = C.red; c.fillText(o.tag, it.x + 14, it.y - 1); }
      else if (it.t === 'en') { c.fillStyle = C.muted; c.font = 'italic 500 28px ' + SANS; c.fillText(o.en, it.x, it.y); }
      else if (it.t === 'enl') { c.fillStyle = C.muted; c.font = 'italic 500 28px ' + SANS; it.lines.forEach((l, i) => c.fillText(l, it.x, it.y + i * 38)); }
      else if (it.t === 'meta') { c.fillStyle = C.muted; c.font = '400 28px ' + SANS; c.fillText(it.w ? clamp(c, it.text, it.w, 1)[0] : it.text, it.x, it.y); }
      else if (it.t === 'stats') { const st = o.stats.slice(0, 4), cw = (W - 2 * P) / st.length; c.fillStyle = C.card; rr(c, P, it.y, W - 2 * P, 112, 16); c.fill(); st.forEach(([v, k], i) => { const x = P + i * cw + 30; if (i) { c.fillStyle = C.line; c.fillRect(P + i * cw, it.y + 22, 2, 68); } c.fillStyle = C.ink; c.font = '700 40px ' + MONO; c.fillText(String(v), x, it.y + 54); c.fillStyle = C.muted; c.font = '400 22px ' + SANS; c.fillText(k, x, it.y + 88); }); }
      else if (it.t === 'blurb') { c.fillStyle = C.ink; c.font = '400 30px ' + SANS; it.lines.forEach((l, i) => c.fillText(l, P, it.y + i * 50)); }
      else if (it.t === 'posters') { const gw = 18, w = (W - 2 * P - 4 * gw) / 5, h = w * 1.5; c.fillStyle = C.muted; c.font = '600 22px ' + MONO; c.fillText(T('即将放映') + ' · UPCOMING', P, it.y - 14); it.list.forEach((im, i) => { const x = P + i * (w + gw); if (im) cover(c, im, x, it.y, w, h, 8); else placeholder(c, x, it.y, w, h, 8, ''); }); }
      else if (it.t === 'shows') {
        c.fillStyle = C.ink; c.font = '900 34px ' + SERIF; c.fillText(it.list.length ? T('近期场次') : T('场次待公布'), P, it.y);
        c.fillStyle = C.red; c.fillRect(P, it.y + 18, 56, 4);
        it.list.forEach((s, i) => { const y = it.y + 60 + i * 92; c.fillStyle = C.card; rr(c, P, y, W - 2 * P, 76, 12); c.fill(); c.fillStyle = C.red; c.font = '700 30px ' + MONO; c.fillText(s.when, P + 24, y + 48); const wx = P + 24 + Math.max(250, c.measureText(s.when).width + 30); c.fillStyle = C.ink; c.font = '500 26px ' + SANS; c.fillText(clamp(c, s.where, W - P - 24 - wx, 1)[0], wx, y + 47); });
        if (!it.list.length) { c.fillStyle = C.muted; c.font = '400 26px ' + SANS; c.fillText(T('排片公布后会在麻雀观影护照更新'), P, it.y + 70); }
      }
    });
    // 页脚：深色通栏 + 页面二维码
    const fy = L.footY, hb = L.H - fy; c.fillStyle = C.ink; c.fillRect(0, fy, W, hb);
    const Q = 260, qx = W - P - Q, qy = fy + (hb - Q) / 2; c.fillStyle = '#fff'; rr(c, qx - 14, qy - 14, Q + 28, Q + 28, 18); c.fill();
    if (o.qrImg) c.drawImage(o.qrImg, qx, qy, Q, Q);
    else if (o.qr) { const m = o.qr, n = m.length, s = Q / n; c.fillStyle = C.ink; for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (m[r][k]) c.fillRect(qx + k * s, qy + r * s, Math.ceil(s), Math.ceil(s)); }
    const tx = P, tw = qx - P - 50; c.fillStyle = '#fffaf0'; c.font = '900 40px ' + SERIF; wrapLines(c, o.qrText || T('长按识别，查看详情'), tw).slice(0, 2).forEach((l, i) => c.fillText(l, tx, fy + 100 + i * 54));
    c.globalAlpha = 0.72; c.font = '400 24px ' + SANS; c.fillText(clamp(c, o.qrSub || '', tw, 1)[0] || '', tx, fy + 200); if (o.url) { c.font = '400 20px ' + MONO; c.fillText(o.url, tx, fy + 236); } c.globalAlpha = 1;
    const my = fy + hb - 92; (o.marks || []).forEach((im, i) => { const R = 34, cx = tx + R + i * (R * 2 + 14), cy = my + R; c.fillStyle = '#fffaf0'; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill(); if (im) c.drawImage(im, cx - R + 6, cy - R + 6, 2 * R - 12, 2 * R - 12); });
    const bx = tx + 2 * 68 + 14 + 22; c.fillStyle = '#e0b9a6'; c.font = 'italic 900 28px ' + SERIF; c.fillText(T('麻雀观影护照'), bx, my + 30); c.fillStyle = '#fffaf0'; c.globalAlpha = 0.7; c.font = '400 20px ' + SANS; c.fillText(T('麻雀映画 × 麻雀部落'), bx, my + 60); c.globalAlpha = 1;
  }

  const api = { W, heightOf, draw, layout };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SparrowSharePoster = api;
})(typeof self !== 'undefined' ? self : this);
