// 个人排片长图：与网站「排片长图」同一套版式（1080 宽），可在浏览器画布与小程序 2d 画布里运行。
// 入参 days 与「我的」页的 days 结构一致：[{ d, wk, range, items:[{ id, t, end, cn, version, dir, min, venue, hall, color, gap }] }]
const D = { W: 1080, P: 64, ROW: 196, GAP: 52, DAYH: 104, HEAD: 360, STATS: 150, FOOT: 364 };
// 画布无法加载网站的网页字体，按系统字体就近匹配：苹果用 Songti / PingFang / Menlo，安卓用思源系
const SERIF = '"Noto Serif SC","Songti SC","STSong","Source Han Serif SC","Noto Serif CJK SC",serif', SANS = '"Noto Sans SC","PingFang SC","Source Han Sans SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif', MONO = '"IBM Plex Mono",Menlo,"SF Mono",Consolas,monospace';

// 顶部标题区：专题名最大（与网站一致），品牌与 Logo 缩小放角落；返回 { TS, TLH, TY0, HEAD, lines }
function layout(c, o) {
  const { W, P } = D, names = (o.pgs || []).filter(Boolean), EN = !!o.en, kickT = EN ? 'Screening plan' : '观影日程';
  let TS = names.length === 1 ? 92 : 68, lines = [];
  const fit = () => {
    c.font = '900 ' + TS + 'px ' + SERIF; const mw = W - 2 * P; lines = [];
    if (names.length <= 1) lines = wrapLines(c, names.length ? names[0] : kickT, mw);
    else {
      const show = names.length > 3 ? names.slice(0, 2) : names;
      show.forEach(n => { const ls = wrapLines(c, n, mw); lines.push(ls.length > 1 ? ls[0].replace(/\s+$/, '') + '…' : ls[0]); });
      if (names.length > 3) lines.push(EN ? '+ ' + (names.length - 2) + ' more' : '等 ' + names.length + ' 个专题');
    }
  };
  fit(); while (lines.length > 3 && TS > 52) { TS -= 6; fit(); }
  if (names.length > 1) { TS = 60; fit(); while (lines.some(l => l.endsWith('…')) && TS > 44) { TS -= 4; fit(); } }
  const TLH = Math.round(TS * 1.2), TY0 = 152 + 14 + TS;
  return { TS, TLH, TY0, HEAD: TY0 + (lines.length - 1) * TLH + 64, lines };
}

function heightOf(days, head) {
  return (head || D.HEAD) + D.STATS + days.reduce((n, g) => n + D.DAYH + g.items.length * D.ROW + (g.items.length - 1) * D.GAP + 24, 0) + D.FOOT;
}

function rr(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

function wrapLines(c, text, maxWidth) {
  const out = []; let line = '';
  // 英文按单词折行，中文按字
  if (!/[　-〿㐀-鿿＀-￯]/.test(String(text)) && /\s/.test(String(text))) {
    String(text).split(/\s+/).forEach(w => { const t2 = line ? line + ' ' + w : w; if (c.measureText(t2).width > maxWidth && line) { out.push(line); line = w; } else line = t2; });
    if (line) out.push(line);
    return out;
  }
  for (const ch of String(text)) {
    if (c.measureText(line + ch).width > maxWidth && line) { out.push(line); line = ch; } else line += ch;
  }
  if (line) out.push(line);
  return out;
}

function wrapCanvas(c, text, x, y, maxWidth, lineHeight) {
  const ls = wrapLines(c, text, maxWidth);
  ls.forEach((l, i) => c.fillText(l, x, y + i * lineHeight));
  return y + (ls.length - 1) * lineHeight;
}

// o: { days, stats:{n,d,hm}, title, sub, imgs:{[filmId]:Image|null}, marks:[Image|null, Image|null] }
function draw(c, o) {
  const { W, P, ROW, GAP, DAYH, STATS, FOOT } = D;
  const days = o.days, hd = o.head || layout(c, o), HEAD = hd.HEAD, H = heightOf(days, HEAD), T = o.T || (x => x), EN = !!o.en;
  c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  c.fillStyle = '#efe6d4'; c.fillRect(0, 0, W, H);

  // 顶部色带
  c.fillStyle = '#8e2a22'; c.fillRect(0, 0, W, HEAD);
  c.fillStyle = 'rgba(255,255,255,.06)';
  for (let x = -HEAD; x < W; x += 46) { c.beginPath(); c.moveTo(x, HEAD); c.lineTo(x + HEAD * .47, 0); c.lineTo(x + HEAD * .47 + 2, 0); c.lineTo(x + 2, HEAD); c.fill(); }
  const R0 = 24;
  (o.marks || []).forEach((im, i) => {
    const cx = P + R0 + i * (R0 * 2 - 10), cy = 70;
    c.fillStyle = '#fffaf0'; c.beginPath(); c.arc(cx, cy, R0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#8e2a22'; c.lineWidth = 3; c.stroke();
    if (im) { const k = Math.min((R0 * 1.5) / im.width, (R0 * 1.5) / im.height), w = im.width * k, h = im.height * k; c.drawImage(im, cx - w / 2, cy - h / 2, w, h); }
  });
  const bx = P + R0 * 3 - 10 + 30; c.fillStyle = '#fffaf0'; c.font = 'italic 900 26px ' + SERIF; c.fillText(T('麻雀观影护照'), bx, 78);
  if (!EN) { c.globalAlpha = .7; c.font = '500 17px ' + MONO; c.textAlign = 'right'; c.fillText('SPARROW FILM PASSPORT', W - P, 76); c.textAlign = 'left'; c.globalAlpha = 1; }
  c.fillStyle = '#fffaf0'; c.fillRect(P, 142, 48, 3); c.globalAlpha = .9; c.font = '600 26px ' + SANS; c.fillText(o.title || T('我的观影日程'), P + 64, 152); c.globalAlpha = 1;
  c.fillStyle = '#fffaf0'; c.font = '900 ' + hd.TS + 'px ' + SERIF; hd.lines.forEach((l, i) => c.fillText(l, P, hd.TY0 + i * hd.TLH));

  // 统计
  let sx = P;
  [[o.stats.n, T('场放映')], [o.stats.d, T('天行程')], [o.stats.hm, T('银幕时长')]].forEach(([v, l]) => {
    c.fillStyle = '#2b2117'; c.font = '600 56px ' + MONO; c.fillText(String(v), sx, HEAD + 92);
    const w = c.measureText(String(v)).width; c.fillStyle = '#7a6a55'; c.font = '400 24px ' + SANS; c.fillText(l, sx + w + 10, HEAD + 92);
    sx += Math.max(250, w + 150);
  });
  c.fillStyle = '#d8cbb1'; c.fillRect(P, HEAD + STATS - 24, W - 2 * P, 2);

  // 逐日
  let y = HEAD + STATS;
  days.forEach(g => {
    c.fillStyle = '#8e2a22'; c.font = '600 44px ' + MONO; c.fillText(g.d, P, y + 56);
    const dw = c.measureText(g.d).width; c.font = '700 26px ' + SANS; c.fillText(g.wk, P + dw + 16, y + 56);
    c.fillStyle = '#7a6a55'; c.font = '400 22px ' + SANS; c.textAlign = 'right'; c.fillText((g.cnt || T(g.items.length + ' 场')) + ' · ' + g.range, W - P, y + 56); c.textAlign = 'left';
    y += DAYH;
    g.items.forEach((s, i) => {
      if (i) {
        const gp = s.gap || { cls: 'ok', txt: '' };
        c.font = '400 22px ' + SANS; c.fillStyle = gp.cls === 'clash' ? '#b3261e' : gp.cls === 'tight' ? '#b26a1f' : '#7a6a55'; c.fillText(gp.txt, P + 220, y + GAP / 2 + 6);
        c.fillStyle = '#d8cbb1'; c.fillRect(P + 180, y - 10, 2, GAP + 20); y += GAP;
      }
      const col = s.color || '#8e2a22';
      c.fillStyle = '#f8f2e6'; rr(c, P + 200, y, W - 2 * P - 200, ROW - 20, 14); c.fill(); c.fillStyle = col; rr(c, P + 200, y, 8, ROW - 20, 4); c.fill();
      c.fillStyle = '#2b2117'; c.font = '600 40px ' + MONO; c.fillText(s.t, P, y + 52); c.fillStyle = '#7a6a55'; c.font = '400 26px ' + MONO; c.fillText('— ' + s.end, P, y + 92);
      const im = (o.imgs || {})[s.id], tx = P + 232, ty = y + 18, tw = 104, th = ROW - 56;
      if (im) { c.save(); rr(c, tx, ty, tw, th, 6); c.clip(); const r = Math.max(tw / im.width, th / im.height), iw = im.width * r, ih = im.height * r; c.drawImage(im, tx + (tw - iw) / 2, ty + (th - ih) / 2, iw, ih); c.restore(); }
      else { c.fillStyle = col; rr(c, tx, ty, tw, th, 6); c.fill(); c.fillStyle = '#fffaf0'; c.font = '900 44px ' + SERIF; c.fillText(String(s.cn).charAt(0), tx + 30, ty + 80); }
      const ix = tx + tw + 24, iw2 = W - P - 24 - ix;
      c.fillStyle = '#2b2117'; c.font = '700 36px ' + SANS;
      const tl = wrapLines(c, s.cn, iw2 - (s.version ? 110 : 0)), shown = tl[0] + (tl.length > 1 ? '…' : '');
      c.fillText(shown, ix, y + 58);
      if (s.version) {
        const tw2 = c.measureText(shown).width; c.font = '600 20px ' + MONO; const vw = c.measureText(s.version).width + 18;
        c.strokeStyle = '#8e2a22'; c.lineWidth = 2; rr(c, ix + tw2 + 12, y + 32, vw, 32, 6); c.stroke(); c.fillStyle = '#8e2a22'; c.fillText(s.version, ix + tw2 + 21, y + 56);
      }
      c.fillStyle = '#7a6a55'; c.font = '400 24px ' + SANS; c.fillText(wrapLines(c, (s.dir ? s.dir + ' · ' : '') + (s.minTxt || (s.min ? s.min + ' 分钟' : '片长待定')), iw2)[0] || '', ix, y + 100);
      c.fillStyle = '#2f6f6c'; c.font = '500 24px ' + SANS; c.fillText(wrapLines(c, s.venue + ' · ' + s.hall, iw2)[0] || '', ix, y + 140);
      y += ROW;
    });
    y += 24;
  });

  // 页脚：深色通栏，左右与底边铺满（与顶部色带呼应）；内容仍按页边距 P 对齐
  const BH = 340, PY = 52, fy = y + 24; c.fillStyle = '#2b2117'; c.fillRect(0, fy, W, H - fy);
  const fx = P; c.fillStyle = '#fffaf0'; c.font = '700 38px ' + SANS; c.fillText(EN ? 'Search “麻雀观影护照” on WeChat' : '微信搜索「麻雀观影护照」', fx, fy + PY + 36);
  c.font = '400 24px ' + SANS; c.globalAlpha = .8; wrapCanvas(c, T('小程序里查看完整片目 · 最新排片 · 选择想看的电影'), fx, fy + PY + 82, W - 2 * P - (o.qr ? 270 : 0), 34); c.globalAlpha = 1;
  if (o.qr) { // 右侧：小程序码（圆形码，白底垫底，与卡片等内边距）
    const Q = BH - 2 * PY, qx = W - P - Q, qy = fy + PY;
    c.fillStyle = '#fffaf0'; rr(c, qx, qy, Q, Q, Q / 2); c.fill();
    const m = 10; c.save(); c.beginPath(); c.arc(qx + Q / 2, qy + Q / 2, Q / 2 - m, 0, Math.PI * 2); c.clip(); c.drawImage(o.qr, qx + m, qy + m, Q - 2 * m, Q - 2 * m); c.restore();
  }
  const R = 48, cy = fy + BH - PY - R;
  (o.marks || []).forEach((im, i) => {
    const cx = fx + R + i * (R * 2 + 20);
    c.fillStyle = '#fffaf0'; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
    if (im) { const k = Math.min((R * 1.5) / im.width, (R * 1.5) / im.height), w = im.width * k, h = im.height * k; c.drawImage(im, cx - w / 2, cy - h / 2, w, h); }
  });
  const tx2 = fx + 4 * R + 20 + 36;
  c.fillStyle = '#e0b9a6'; c.font = 'italic 900 30px ' + SERIF; c.fillText(T('麻雀观影护照'), tx2, cy - 2);
  c.fillStyle = '#fffaf0'; c.globalAlpha = .7; c.font = '400 22px ' + SANS; c.fillText(T('麻雀映画 × 麻雀部落'), tx2, cy + 34); c.globalAlpha = 1;
}

module.exports = { D, heightOf, layout, draw };
