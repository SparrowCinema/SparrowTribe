/* 麻雀观影护照 · 影院观影结算长图 + 观影印章（画布版）
 * 网站（shared/recap.js，以 window.SparrowRecap 使用）与小程序（miniprogram/utils/recap.js，由 tools/build-fallback.js 复制）共用同一份代码。
 * 只依赖 2d 画布接口，不碰 DOM / wx。
 *
 * draw(c, o) / heightOf(o) 的 o：
 *   title, sub, kicker                 页眉文字
 *   stats: [[值, 标签], ...]           6 项为宜
 *   fav: 条目 | null                    评分最高的一部（条目结构同 items）
 *   progs: [{ name, n, avg }]           按专题
 *   items: [{ title, en, date, dstamp, venue, score, color, shape, tilt, top, img }]
 *   qr: 二维码矩阵 | null；url          网站页脚用；没有二维码时页脚改为微信搜索引导
 *   marks: [Image|null, Image|null]     两枚品牌标
 *   T: 翻译函数；en: 是否英文
 */
(function (root) {
  const SERIF = '"Noto Serif SC","Songti SC",serif', SANS = '"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif', MONO = '"IBM Plex Mono",Menlo,monospace';
  const C = { paper: '#efe6d4', card: '#f8f2e6', ink: '#2b2117', muted: '#7a6a55', line: '#d8cbb1', red: '#8e2a22', leather: '#5a1712', gold: '#d9bc80', teal: '#2f6f6c' };
  const W = 1080, P = 64, CJK = /[　-〿㐀-鿿＀-￯]/;
  const L = { HEAD: 460, STATS: 380, FAV: 400, PROGH: 120, PROGROW: 76, WALLH: 110, CELL: 310, LISTH: 120, ROW: 172, FOOT: 420 };

  function wrapLines(c, text, max) {
    text = String(text || ''); const out = []; let line = '';
    if (!CJK.test(text) && /\s/.test(text)) {
      text.split(/\s+/).forEach(w => { const t = line ? line + ' ' + w : w; if (c.measureText(t).width > max && line) { out.push(line); line = w; } else line = t; });
    } else {
      for (const ch of text) { if (c.measureText(line + ch).width > max && line) { out.push(line); line = ch; } else line += ch; }
    }
    if (line) out.push(line);
    // 行首不放标点
    for (let i = 1; i < out.length; i++) { const m = out[i].match(/^[：:，,、。.！!？?）)」』·]+/); if (m) { out[i - 1] += m[0]; out[i] = out[i].slice(m[0].length); } }
    return out.filter(Boolean);
  }
  const clip1 = (c, t, max) => { const ls = wrapLines(c, t, max); return ls.length > 1 ? ls[0].replace(/\s+$/, '') + '…' : (ls[0] || ''); };
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function cover(c, im, x, y, w, h, r) { c.save(); rr(c, x, y, w, h, r); c.clip(); const s = Math.max(w / im.width, h / im.height), iw = im.width * s, ih = im.height * s; c.drawImage(im, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); c.restore(); }

  function starPath(c, cx, cy, R) { c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? R * 0.45 : R, a = -Math.PI / 2 + i * Math.PI / 5; c[i ? 'lineTo' : 'moveTo'](cx + r * Math.cos(a), cy + r * Math.sin(a)); } c.closePath(); }
  // 五星十分制：score 0–10，每颗星 2 分，可半颗
  function stars(c, x, y, R, score, on, off) {
    for (let i = 0; i < 5; i++) {
      const cx = x + R + i * R * 2.25, part = Math.max(0, Math.min(2, (score || 0) - i * 2)) / 2;
      starPath(c, cx, y, R); c.fillStyle = off; c.fill();
      if (part > 0) { c.save(); c.beginPath(); c.rect(cx - R, y - R, R * 2 * part, R * 2); c.clip(); starPath(c, cx, y, R); c.fillStyle = on; c.fill(); c.restore(); }
    }
    return R * 2.25 * 5 - R * 0.25;
  }

  // 弧形文字（印章外圈）；top=true 写在上半圈，从左到右
  function arcText(c, text, cx, cy, r, top) {
    text = String(text || ''); if (!text) return;
    const chars = [...text], ws = chars.map(ch => c.measureText(ch).width), total = ws.reduce((a, b) => a + b, 0), span = total / r;
    let a = top ? -Math.PI / 2 - span / 2 : Math.PI / 2 + span / 2;
    chars.forEach((ch, i) => {
      const half = ws[i] / 2 / r; a += top ? half : -half;
      c.save(); c.translate(cx + r * Math.cos(a), cy + r * Math.sin(a)); c.rotate(top ? a + Math.PI / 2 : a - Math.PI / 2); c.fillText(ch, 0, 0); c.restore();
      a += top ? half : -half;
    });
  }

  function octagon(c, cx, cy, s) { const k = s * 0.42; c.beginPath(); [[-k, -s], [k, -s], [s, -k], [s, k], [k, s], [-k, s], [-s, k], [-s, -k]].forEach(([x, y], i) => c[i ? 'lineTo' : 'moveTo'](cx + x, cy + y)); c.closePath(); }

  // 一枚观影印章：size 为外框边长；it.shape 0 圆章 / 1 方章 / 2 八角章 / 3 票根章
  function drawStamp(c, it, cx, cy, size, T) {
    T = T || (x => x);
    const col = it.color || C.red, s = size / 2;
    c.save(); c.translate(cx, cy); c.rotate((it.tilt || 0) * Math.PI / 180); c.globalAlpha = 0.9;
    c.strokeStyle = col; c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle';
    const shape = it.shape || 0;
    let inner = s * 1.5, ty = -s * 0.1;
    if (shape === 0) {
      c.lineWidth = size * 0.03; c.beginPath(); c.arc(0, 0, s - c.lineWidth / 2, 0, Math.PI * 2); c.stroke();
      c.lineWidth = size * 0.01; c.beginPath(); c.arc(0, 0, s * 0.74, 0, Math.PI * 2); c.stroke();
      c.font = '700 ' + Math.round(size * 0.06) + 'px ' + MONO; arcText(c, String(it.top || 'SPARROW FILM PASSPORT').toUpperCase().split(/ · | & /)[0].slice(0, 26), 0, 0, s * 0.86, true);
      c.font = '500 ' + Math.round(size * 0.058) + 'px ' + SANS; arcText(c, it.vs || it.venue || T('影院观影'), 0, 0, s * 0.86, false);
      [-1, 1].forEach(k => { starPath(c, k * s * 0.86, 0, size * 0.022); c.fill(); });
      inner = s * 1.28; ty = -s * 0.16;
    } else if (shape === 1 || shape === 3) {
      c.lineWidth = size * 0.028; rr(c, -s + 3, -s * 0.82, size - 6, s * 1.64, shape === 1 ? size * 0.06 : 4); c.stroke();
      c.lineWidth = size * 0.009; rr(c, -s + size * 0.07, -s * 0.82 + size * 0.05, size - size * 0.14, s * 1.64 - size * 0.1, shape === 1 ? size * 0.03 : 2); c.stroke();
      c.font = '700 ' + Math.round(size * 0.055) + 'px ' + MONO; c.fillText(clip1(c, String(it.top || 'SPARROW FILM PASSPORT').toUpperCase().split(/ · | & /)[0], size * 0.8), 0, -s * 0.6);
      c.font = '500 ' + Math.round(size * 0.055) + 'px ' + SANS; c.fillText(clip1(c, it.vs || it.venue || T('影院观影'), size * 0.8), 0, s * 0.62);
      inner = size * 0.82; ty = -s * 0.14;
    } else {
      c.lineWidth = size * 0.028; octagon(c, 0, 0, s - 3); c.stroke(); c.lineWidth = size * 0.009; octagon(c, 0, 0, s * 0.86); c.stroke();
      c.font = '700 ' + Math.round(size * 0.055) + 'px ' + MONO; c.fillText(clip1(c, String(it.top || 'SPARROW FILM PASSPORT').toUpperCase().split(/ · | & /)[0], size * 0.62), 0, -s * 0.62);
      c.font = '500 ' + Math.round(size * 0.055) + 'px ' + SANS; c.fillText(clip1(c, it.vs || it.venue || T('影院观影'), size * 0.62), 0, s * 0.64);
      inner = size * 0.74; ty = -s * 0.14;
    }
    // 片名（最多两行）、日期、评分
    let fs = size * 0.11; c.font = '900 ' + Math.round(fs) + 'px ' + SERIF;
    let ls = wrapLines(c, it.title, inner);
    if (ls.length > 2) { fs = size * 0.085; c.font = '900 ' + Math.round(fs) + 'px ' + SERIF; ls = wrapLines(c, it.title, inner); }
    if (ls.length > 2) ls = [ls[0], clip1(c, ls.slice(1).join(CJK.test(it.title) ? '' : ' '), inner)];
    const lh = fs * 1.12, y0 = ty - (ls.length - 1) * lh / 2;
    ls.forEach((l, i) => c.fillText(l, 0, y0 + i * lh));
    c.font = '700 ' + Math.round(size * 0.07) + 'px ' + MONO; c.fillText(it.dstamp || '', 0, s * 0.2);
    if (it.score) { const R = size * 0.032, w = R * 2.25 * 5 - R * 0.25; stars(c, -w / 2, s * 0.38, R, it.score, col, 'rgba(0,0,0,0)'); c.lineWidth = 1.2; for (let i = 0; i < 5; i++) { starPath(c, -w / 2 + R + i * R * 2.25, s * 0.38, R); c.stroke(); } }
    c.restore();
  }

  function heightOf(o) {
    const n = (o.items || []).length;
    return L.HEAD + L.STATS + (o.fav ? L.FAV : 0) + ((o.progs || []).length > 1 ? L.PROGH + o.progs.length * L.PROGROW : 0) + (n ? L.WALLH + Math.ceil(n / 3) * L.CELL + 20 : 0) + (n ? L.LISTH + n * L.ROW : 0) + L.FOOT;
  }

  function draw(c, o) {
    const T = o.T || (x => x), H = heightOf(o), items = o.items || [];
    c.textBaseline = 'alphabetic'; c.textAlign = 'left';
    c.fillStyle = C.paper; c.fillRect(0, 0, W, H);

    // 页眉：护照封皮
    const g = c.createLinearGradient(0, 0, W, L.HEAD); g.addColorStop(0, '#6e1d16'); g.addColorStop(1, '#431009');
    c.fillStyle = g; c.fillRect(0, 0, W, L.HEAD);
    c.strokeStyle = C.gold; c.globalAlpha = 0.75; c.lineWidth = 2; c.strokeRect(28, 28, W - 56, L.HEAD - 56); c.lineWidth = 1; c.strokeRect(38, 38, W - 76, L.HEAD - 76); c.globalAlpha = 1;
    c.fillStyle = C.gold; c.font = '600 22px ' + MONO; c.fillText(o.kicker || 'SPARROW FILM PASSPORT', P + 10, 112);
    c.fillStyle = '#fffaf0'; c.font = '900 ' + (o.en ? 58 : 70) + 'px ' + SERIF; c.fillText(o.title || T('我的影院观影结算'), P + 10, 210);
    c.font = '400 28px ' + SANS; c.globalAlpha = 0.85; c.fillText(o.sub || '', P + 10, 262); c.globalAlpha = 1;
    c.fillStyle = C.gold; c.fillRect(P + 10, 300, 64, 3);
    c.font = '400 22px ' + SANS; c.globalAlpha = 0.75; c.fillStyle = '#fffaf0'; c.fillText(T('麻雀观影护照') + ' · ' + T('麻雀映画 × 麻雀部落'), P + 10, 350); c.globalAlpha = 1;
    // 右上：金色大印
    c.save(); c.translate(W - P - 130, 200); c.rotate(-0.12); c.strokeStyle = C.gold; c.fillStyle = C.gold; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 4; c.beginPath(); c.arc(0, 0, 118, 0, Math.PI * 2); c.stroke(); c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, 90, 0, Math.PI * 2); c.stroke();
    c.font = '700 17px ' + MONO; arcText(c, 'SPARROW · FILM · PASSPORT', 0, 0, 104, true); arcText(c, 'ADMIT ONE · ' + (o.yearTag || ''), 0, 0, 104, false);
    c.font = '900 64px ' + MONO; c.fillText(String(items.length), 0, -6); c.font = '600 18px ' + SANS; c.fillText(T('部影片'), 0, 42);
    c.restore();

    // 统计
    let y = L.HEAD + 40; const cw = (W - 2 * P - 2 * 20) / 3, ch = 140;
    (o.stats || []).slice(0, 6).forEach(([v, l], i) => {
      const x = P + (i % 3) * (cw + 20), yy = y + Math.floor(i / 3) * (ch + 20);
      c.fillStyle = C.card; rr(c, x, yy, cw, ch, 16); c.fill(); c.strokeStyle = C.line; c.lineWidth = 1.5; c.stroke();
      c.fillStyle = i === 0 ? C.red : C.ink; c.font = '600 52px ' + MONO; c.fillText(clip1(c, String(v), cw - 48), x + 24, yy + 72);
      c.fillStyle = C.muted; c.font = '400 22px ' + SANS; c.fillText(clip1(c, l, cw - 48), x + 24, yy + 112);
    });
    y = L.HEAD + L.STATS;

    const head = (zh, en, yy) => { c.fillStyle = C.red; c.fillRect(P, yy + 2, 8, 34); c.fillStyle = C.ink; c.font = '900 38px ' + SERIF; c.fillText(T(zh), P + 24, yy + 32); const w = c.measureText(T(zh)).width; c.fillStyle = C.muted; c.font = '500 18px ' + MONO; c.fillText(en, P + 24 + w + 16, yy + 30); };

    // 最爱
    if (o.fav) {
      const f = o.fav; head('本期最爱', 'TOP RATED', y);
      const cy = y + 70; c.fillStyle = C.card; rr(c, P, cy, W - 2 * P, L.FAV - 100, 18); c.fill();
      const pw = 190, ph = L.FAV - 140;
      if (f.img) cover(c, f.img, P + 20, cy + 20, pw, ph, 10); else { c.fillStyle = f.color || C.red; rr(c, P + 20, cy + 20, pw, ph, 10); c.fill(); }
      const tx = P + 20 + pw + 36, tw = W - P - 30 - tx;
      c.fillStyle = C.ink; c.font = '900 44px ' + SERIF; const tl = wrapLines(c, f.title, tw).slice(0, 2); tl.forEach((l, i) => c.fillText(l, tx, cy + 72 + i * 54));
      let yy = cy + 72 + (tl.length - 1) * 54 + 40;
      if (f.en && f.en !== f.title) { c.fillStyle = C.muted; c.font = 'italic 400 24px ' + SERIF; c.fillText(clip1(c, f.en, tw), tx, yy); yy += 46; }
      stars(c, tx, yy + 4, 18, f.score, C.red, C.line); c.fillStyle = C.red; c.font = '700 34px ' + MONO; c.fillText((f.score / 1).toFixed(0) + '/10', tx + 220, yy + 16);
      c.fillStyle = C.teal; c.font = '500 24px ' + SANS; c.fillText(clip1(c, [f.dstamp, f.venue].filter(Boolean).join(' · '), tw), tx, yy + 68);
      y += L.FAV;
    }

    // 按专题
    if ((o.progs || []).length > 1) {
      head('按专题', 'BY PROGRAMME', y); let yy = y + 90; const max = Math.max(...o.progs.map(p => p.n));
      o.progs.forEach(p => {
        c.fillStyle = C.ink; c.font = '700 28px ' + SANS; c.fillText(clip1(c, p.name, 330), P, yy + 30);
        const bx = P + 350, bw = W - P - 290 - bx; c.fillStyle = C.line; rr(c, bx, yy + 10, bw, 26, 13); c.fill(); c.fillStyle = C.red; rr(c, bx, yy + 10, Math.max(26, bw * p.n / max), 26, 13); c.fill();
        c.fillStyle = C.ink; c.font = '600 26px ' + MONO; c.textAlign = 'right'; c.fillText(T(p.n + ' 部') + (p.avg ? '  ★' + p.avg.toFixed(1) : ''), W - P, yy + 32); c.textAlign = 'left';
        yy += L.PROGROW;
      });
      y += L.PROGH + o.progs.length * L.PROGROW;
    }

    // 印章墙
    if (items.length) {
      head('印章墙', 'STAMPS', y); const cell = (W - 2 * P) / 3;
      items.forEach((it, i) => { const cx = P + cell * (i % 3) + cell / 2, cy = y + L.WALLH + Math.floor(i / 3) * L.CELL + L.CELL / 2 - 10; drawStamp(c, it, cx, cy, Math.min(cell, L.CELL) - 44, T); });
      y += L.WALLH + Math.ceil(items.length / 3) * L.CELL + 20;

      // 清单
      head('观影清单', 'FILMS WATCHED', y); y += L.LISTH;
      items.forEach((it, i) => {
        const yy = y + i * L.ROW;
        if (i) { c.fillStyle = C.line; c.fillRect(P, yy - 14, W - 2 * P, 1.5); }
        c.fillStyle = C.muted; c.font = '600 24px ' + MONO; c.fillText(String(i + 1).padStart(2, '0'), P, yy + 40);
        const px = P + 60; if (it.img) cover(c, it.img, px, yy, 96, 140, 8); else { c.fillStyle = it.color || C.red; rr(c, px, yy, 96, 140, 8); c.fill(); c.fillStyle = '#fffaf0'; c.font = '900 40px ' + SERIF; c.fillText([...String(it.title)][0] || '', px + 28, yy + 84); }
        const tx = px + 124, tw = W - P - 230 - tx;
        c.fillStyle = C.ink; c.font = '700 34px ' + SANS; c.fillText(clip1(c, it.title, tw), tx, yy + 42);
        c.fillStyle = C.muted; c.font = '400 22px ' + SANS; c.fillText(clip1(c, [it.en !== it.title ? it.en : '', it.prog].filter(Boolean).join(' · '), tw), tx, yy + 80);
        c.fillStyle = C.teal; c.font = '500 22px ' + SANS; c.fillText(clip1(c, [it.dstamp, it.venue].filter(Boolean).join(' · '), tw), tx, yy + 116);
        if (it.score) { stars(c, W - P - 200, yy + 40, 16, it.score, C.red, C.line); c.fillStyle = C.red; c.font = '700 28px ' + MONO; c.textAlign = 'right'; c.fillText(it.score + '/10', W - P, yy + 92); c.textAlign = 'left'; }
        else { c.fillStyle = C.muted; c.font = '400 22px ' + SANS; c.textAlign = 'right'; c.fillText(T('未评分'), W - P, yy + 48); c.textAlign = 'left'; }
      });
      y += items.length * L.ROW;
    }

    // 页脚
    if (o.qrImg) { // 小程序：深色通栏铺满左右与底边，右侧小程序码
      const fy = y + 30, hb = H - fy; c.fillStyle = C.ink; c.fillRect(0, fy, W, hb);
      const Q = 270, qx = W - P - Q, qy = fy + (hb - Q) / 2, tw = qx - P - 40;
      c.fillStyle = '#fffaf0'; c.font = '700 38px ' + SANS; c.fillText(o.en ? 'Search “麻雀观影护照”' : '微信搜索「麻雀观影护照」', P, fy + 92);
      c.font = '400 24px ' + SANS; c.globalAlpha = 0.8; wrapLines(c, T('盖下你的下一枚观影印章 · 记录每一场银幕'), tw).slice(0, 2).forEach((l, i) => c.fillText(l, P, fy + 140 + i * 34)); c.globalAlpha = 1;
      c.fillStyle = '#fffaf0'; rr(c, qx, qy, Q, Q, Q / 2); c.fill();
      c.save(); c.beginPath(); c.arc(qx + Q / 2, qy + Q / 2, Q / 2 - 10, 0, Math.PI * 2); c.clip(); c.drawImage(o.qrImg, qx + 10, qy + 10, Q - 20, Q - 20); c.restore();
      const R = 44, cy = fy + hb - 52 - R;
      (o.marks || []).forEach((im, i) => {
        const cx = P + R + i * (R * 2 + 18); c.fillStyle = '#fffaf0'; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
        if (im) { const k = Math.min((R * 1.5) / im.width, (R * 1.5) / im.height), w = im.width * k, h = im.height * k; c.drawImage(im, cx - w / 2, cy - h / 2, w, h); }
      });
      const bx = P + 2 * (R * 2 + 18) + 12; c.fillStyle = '#e0b9a6'; c.font = 'italic 900 28px ' + SERIF; c.fillText(T('麻雀观影护照'), bx, cy - 4);
      c.fillStyle = '#fffaf0'; c.globalAlpha = 0.7; c.font = '400 20px ' + SANS; c.fillText(T('麻雀映画 × 麻雀部落'), bx, cy + 30); c.globalAlpha = 1;
      return;
    }
    const fy = y + 30; c.fillStyle = C.ink; rr(c, P, fy, W - 2 * P, L.FOOT - 90, 20); c.fill();
    let fx = P + 36;
    if (o.qr) {
      const m = o.qr, qs = 250, qx = P + 36, qy = fy + 40; c.fillStyle = '#fff'; rr(c, qx, qy, qs, qs, 10); c.fill();
      const n = m.length, cell = (qs - 24) / (n + 8); c.fillStyle = '#1d1712';
      for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (m[r][k]) c.fillRect(Math.floor(qx + 12 + (k + 4) * cell), Math.floor(qy + 12 + (r + 4) * cell), Math.ceil(cell), Math.ceil(cell));
      fx = qx + qs + 40;
      c.fillStyle = '#fffaf0'; c.font = '700 36px ' + SANS; c.fillText(T('扫码盖下你的观影印章'), fx, fy + 100);
      c.font = '400 23px ' + SANS; c.globalAlpha = 0.8; wrapLines(c, T('麻雀观影护照：影展、艺术影院与院线排片'), W - P - 36 - fx).slice(0, 2).forEach((l, i) => c.fillText(l, fx, fy + 148 + i * 32)); c.globalAlpha = 0.55; c.font = '400 19px ' + MONO; c.fillText(clip1(c, o.url || '', W - P - 36 - fx), fx, fy + 210); c.globalAlpha = 1;
    } else {
      c.fillStyle = '#fffaf0'; c.font = '700 36px ' + SANS; c.fillText(o.en ? 'Search “麻雀观影护照” on WeChat' : '微信搜索「麻雀观影护照」', fx, fy + 96);
      c.font = '400 23px ' + SANS; c.globalAlpha = 0.8; c.fillText(T('盖下你的下一枚观影印章'), fx, fy + 144); c.globalAlpha = 1;
    }
    (o.marks || []).forEach((im, i) => {
      const R = 40, cx = (o.qr ? fx : fx) + R + i * (R * 2 + 16), cy = fy + 268 - (o.qr ? 0 : 20);
      c.fillStyle = '#fffaf0'; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
      if (im) { const s = Math.min((R * 1.5) / im.width, (R * 1.5) / im.height), w = im.width * s, h = im.height * s; c.drawImage(im, cx - w / 2, cy - h / 2, w, h); }
    });
    const bx = fx + 2 * 80 + 16 + 30; c.fillStyle = '#e0b9a6'; c.font = 'italic 900 28px ' + SERIF; c.fillText(T('麻雀观影护照'), bx, fy + 262 - (o.qr ? 0 : 20)); c.fillStyle = '#fffaf0'; c.globalAlpha = 0.7; c.font = '400 20px ' + SANS; c.fillText(T('麻雀映画 × 麻雀部落'), bx, fy + 296 - (o.qr ? 0 : 20)); c.globalAlpha = 1;
  }

  // 印章外观：按影片 id 固定形状、倾角；颜色按地区
  function hash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  const INKS = ['#8e2a22', '#2f5d8a', '#2f6f6c', '#6b3f8f', '#a8541d', '#4f6b2a'];
  function look(id, i) { const h = hash(id); return { shape: (h + (i || 0)) % 4, tilt: (h % 15) - 7, ink: INKS[(h >>> 3) % INKS.length] }; }
  const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  function dstamp(iso) { if (!iso) return ''; const [y, m, d] = String(iso).split('-'); return d + ' ' + (MON[+m - 1] || m) + ' ' + y; }

  const api = { W, heightOf, draw, drawStamp, look, dstamp, hash, INKS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SparrowRecap = api;
})(typeof window !== 'undefined' ? window : this);
