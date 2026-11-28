/* 由 tools/build-fallback.js 从 shared/autograph-trace.js 复制，请改 shared/autograph-trace.js 后重新运行。 */
/* 签名照片 → 签名笔画（2026-11-23）：主办方拍下或选一张纸上的签名，在本机描成和现场手签同样格式的笔画
 * [[x,y,x,y,…],…]（0–1000 × 0–500 的整数，最多 80 笔、4000 点），再用 tk_autograph_put 保存，票面效果与手签一致。
 * 步骤：灰度 → 大津法自动阈值（可用「深浅」微调）→ 去掉小噪点 → 按墨迹范围裁切缩放 → Zhang-Suen 细化成单像素骨架
 *      → 沿骨架走成折线 → 简化 + 等距重采样（票面按段长决定粗细，等距让线宽均匀）→ 映射到签名板坐标。
 * 纯函数，不依赖浏览器：输入 {data,width,height}（ImageData 格式）。网站直接加载（window.SparrowTrace），测试 tools/check-autograph-trace.js。 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SparrowTrace = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const PAD_W = 1000, PAD_H = 500, MAX_STROKES = 80, MAX_POINTS = 4000;

  function gray(img) {
    const n = img.width * img.height, g = new Uint8Array(n), d = img.data;
    for (let i = 0; i < n; i++) {
      const a = d[i * 4 + 3] / 255;
      // 透明像素当白纸
      g[i] = Math.round((0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) * a + 255 * (1 - a));
    }
    return g;
  }
  function otsu(g) {
    const hist = new Array(256).fill(0);
    for (const v of g) hist[v]++;
    let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sumB = 0, wB = 0, best = 0, th = 128;
    for (let t = 0; t < 256; t++) {
      wB += hist[t]; if (!wB) continue;
      const wF = g.length - wB; if (!wF) break;
      sumB += t * hist[t];
      const mB = sumB / wB, mF = (sum - sumB) / wF, between = wB * wF * (mB - mF) * (mB - mF);
      if (between > best) { best = between; th = t; }
    }
    return th;
  }
  // 墨迹＝比阈值暗的像素；如果「墨迹」占了一半以上，说明是深底浅字，反过来
  function binarize(img, shift) {
    const g = gray(img), th = Math.max(1, Math.min(254, otsu(g) + (shift || 0)));
    const n = g.length, bin = new Uint8Array(n); let ink = 0;
    for (let i = 0; i < n; i++) if (g[i] <= th) { bin[i] = 1; ink++; }
    // 深浅两类的平均灰度差太小＝只是纸纹或光线不匀，没有真正的墨迹
    let sd = 0, sl = 0; for (let i = 0; i < n; i++) { if (bin[i]) sd += g[i]; else sl += g[i]; }
    const contrast = ink && ink < n ? sl / (n - ink) - sd / ink : 0;
    if (ink > n / 2) { for (let i = 0; i < n; i++) bin[i] ^= 1; ink = n - ink; }
    return { bin, w: img.width, h: img.height, ink, contrast: Math.abs(contrast) };
  }
  // 去掉面积太小的连通块（纸面污点、噪点）
  function despeckle(bin, w, h, minArea) {
    const seen = new Uint8Array(w * h), stack = [];
    for (let s = 0; s < w * h; s++) {
      if (!bin[s] || seen[s]) continue;
      const comp = []; stack.push(s); seen[s] = 1;
      while (stack.length) {
        const p = stack.pop(); comp.push(p);
        const x = p % w, y = (p - x) / w;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx; if (bin[q] && !seen[q]) { seen[q] = 1; stack.push(q); }
        }
      }
      if (comp.length < minArea) for (const p of comp) bin[p] = 0;
    }
  }
  function bbox(bin, w, h) {
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (bin[y * w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return x1 < 0 ? null : { x0, y0, x1, y1 };
  }
  // 把墨迹范围采样到工作网格（最长边约 480 格）：格子里墨迹占比超过一定比例就算有墨
  function resampleGrid(bin, w, h, b) {
    const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1, s = Math.min(480 / bw, 240 / bh, 2);
    const gw = Math.max(8, Math.round(bw * s)) + 4, gh = Math.max(8, Math.round(bh * s)) + 4, out = new Uint8Array(gw * gh);
    for (let gy = 2; gy < gh - 2; gy++) for (let gx = 2; gx < gw - 2; gx++) {
      const sx0 = b.x0 + (gx - 2) / s, sx1 = b.x0 + (gx - 1) / s, sy0 = b.y0 + (gy - 2) / s, sy1 = b.y0 + (gy - 1) / s;
      let ink = 0, all = 0;
      for (let y = Math.floor(sy0); y < Math.max(Math.floor(sy0) + 1, Math.ceil(sy1)); y++) for (let x = Math.floor(sx0); x < Math.max(Math.floor(sx0) + 1, Math.ceil(sx1)); x++) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue; all++; ink += bin[y * w + x];
      }
      if (all && ink / all >= 0.3) out[gy * gw + gx] = 1;
    }
    return { bin: out, w: gw, h: gh };
  }
  // Zhang-Suen 细化
  function thin(bin, w, h) {
    const b = bin.slice(); let changed = true;
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : b[y * w + x];
    while (changed) {
      changed = false;
      for (let step = 0; step < 2; step++) {
        const del = [];
        for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
          if (!b[y * w + x]) continue;
          const p = [at(x, y - 1), at(x + 1, y - 1), at(x + 1, y), at(x + 1, y + 1), at(x, y + 1), at(x - 1, y + 1), at(x - 1, y), at(x - 1, y - 1)];
          const B = p.reduce((s, v) => s + v, 0); if (B < 2 || B > 6) continue;
          let A = 0; for (let i = 0; i < 8; i++) if (!p[i] && p[(i + 1) % 8]) A++;
          if (A !== 1) continue;
          if (step === 0 ? (p[0] * p[2] * p[4] || p[2] * p[4] * p[6]) : (p[0] * p[2] * p[6] || p[0] * p[4] * p[6])) continue;
          del.push(y * w + x);
        }
        if (del.length) { changed = true; for (const i of del) b[i] = 0; }
      }
    }
    return b;
  }
  // 沿骨架走成折线：先从端点出发，再处理剩下的环；分叉处另起一笔，起点接上已走过的相邻点，不留缝
  function walk(sk, w, h) {
    const N = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && sk[y * w + x];
    const deg = (x, y) => N.reduce((n, [dx, dy]) => n + (on(x + dx, y + dy) ? 1 : 0), 0);
    const used = new Uint8Array(w * h), polys = [];
    const go = (sx, sy) => {
      const pts = [];
      // 接上相邻的已走过的点
      for (const [dx, dy] of N) if (on(sx + dx, sy + dy) && used[(sy + dy) * w + sx + dx]) { pts.push([sx + dx, sy + dy]); break; }
      let x = sx, y = sy, pdx = 0, pdy = 0;
      for (;;) {
        used[y * w + x] = 1; pts.push([x, y]);
        let next = null, best = -9;
        for (const [dx, dy] of N) {
          if (!on(x + dx, y + dy) || used[(y + dy) * w + x + dx]) continue;
          const score = dx * pdx + dy * pdy - (Math.abs(dx) + Math.abs(dy) === 2 ? 0.1 : 0); // 尽量走直、优先上下左右
          if (score > best) { best = score; next = [dx, dy]; }
        }
        if (!next) {
          // 走到头时，如果旁边是已走过的点（环闭合或回到分叉），接上它
          for (const [dx, dy] of N) if (on(x + dx, y + dy) && used[(y + dy) * w + x + dx] && !(pts.length > 1 && pts[pts.length - 2][0] === x + dx && pts[pts.length - 2][1] === y + dy) && pts.length > 2) { pts.push([x + dx, y + dy]); break; }
          break;
        }
        pdx = next[0]; pdy = next[1];
        // 斜着走时，阶梯拐角上的两个像素属于同一笔，一并标记，免得之后单独变成碎笔画
        if (pdx && pdy) { if (on(x + pdx, y)) used[y * w + x + pdx] = 1; if (on(x, y + pdy)) used[(y + pdy) * w + x] = 1; }
        x += pdx; y += pdy;
      }
      if (pts.length >= 2) polys.push(pts);
      else if (pts.length === 1) polys.push([pts[0], [pts[0][0] + 1, pts[0][1]]]); // 孤立的点（如 i 上的点）
    };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (on(x, y) && !used[y * w + x] && deg(x, y) === 1) go(x, y);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (on(x, y) && !used[y * w + x]) go(x, y);
    return polys;
  }
  function rdp(pts, eps) {
    if (pts.length < 3) return pts.slice();
    const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1], L = Math.hypot(bx - ax, by - ay) || 1;
    let idx = 0, far = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / L;
      if (d > far) { far = d; idx = i; }
    }
    if (far <= eps) return [pts[0], pts[pts.length - 1]];
    return rdp(pts.slice(0, idx + 1), eps).slice(0, -1).concat(rdp(pts.slice(idx), eps));
  }
  function lengthOf(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
  function resample(pts, step) {
    const out = [pts[0]]; let carry = 0;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], seg = Math.hypot(x1 - x0, y1 - y0);
      let t = step - carry;
      while (t <= seg) { out.push([x0 + (x1 - x0) * t / seg, y0 + (y1 - y0) * t / seg]); t += step; }
      carry = seg - (t - step);
    }
    const last = pts[pts.length - 1], tail = out[out.length - 1];
    if (Math.hypot(last[0] - tail[0], last[1] - tail[1]) > step * 0.3) out.push(last);
    return out;
  }

  // 主函数：img＝ImageData，shift＝深浅微调（-60…60，负数更严、只留深色笔画；正数更宽松）
  function trace(img, shift) {
    if (!img || !img.width || !img.height) return { strokes: [], reason: 'empty' };
    const bz = binarize(img, shift);
    if (bz.contrast < 60) return { strokes: [], reason: 'noink' };
    // 噪点门槛跟着笔画粗细走：笔宽≈2×墨迹面积÷边缘长度，比半个笔宽见方的点还小的才算污点（粗笔签名的 i 点也能留下）
    let edge = 0; const B = bz.bin, W = bz.w, H = bz.h;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (B[i] && (x === 0 || y === 0 || x === W - 1 || y === H - 1 || !B[i - 1] || !B[i + 1] || !B[i - W] || !B[i + W])) edge++; }
    const pen = edge ? 2 * bz.ink / edge : 2;
    despeckle(B, W, H, Math.max(10, Math.round(0.5 * pen * pen)));
    const b = bbox(bz.bin, bz.w, bz.h);
    if (!b || (b.x1 - b.x0) < 8 && (b.y1 - b.y0) < 8) return { strokes: [], reason: 'noink' };
    const grid = resampleGrid(bz.bin, bz.w, bz.h, b);
    despeckle(grid.bin, grid.w, grid.h, 4);
    const sk = thin(grid.bin, grid.w, grid.h);
    let polys = walk(sk, grid.w, grid.h);
    // 去掉贴着长笔画的碎段（骨架毛刺）；离得远的短段保留（如 i 上的点）
    const keep = new Uint8Array(grid.w * grid.h), MIN = 8;
    for (const p of polys) if (lengthOf(p) >= MIN) for (const [x, y] of p) keep[y * grid.w + x] = 1;
    const near = (x, y) => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < grid.w && ny < grid.h && keep[ny * grid.w + nx]) return true; } return false; };
    polys = polys.filter(p => lengthOf(p) >= MIN || !p.every(([x, y]) => near(x, y)));
    if (!polys.length) return { strokes: [], reason: 'noink' };
    // 映射到签名板：四周留 40，居中
    const k = Math.min((PAD_W - 80) / grid.w, (PAD_H - 80) / grid.h), ox = (PAD_W - grid.w * k) / 2, oy = (PAD_H - grid.h * k) / 2;
    const map = p => [Math.max(0, Math.min(PAD_W, Math.round(ox + p[0] * k))), Math.max(0, Math.min(PAD_H, Math.round(oy + p[1] * k)))];
    polys.sort((a, c) => lengthOf(c) - lengthOf(a));
    polys = polys.slice(0, MAX_STROKES);
    // 等距重采样（签名板坐标约 9 个单位一点），点数超限就把间距放大
    for (let step = 9; step < 60; step *= 1.4) {
      const strokes = polys.map(p => resample(rdp(p, 0.6).map(map), step)).map(p => {
        const flat = []; let px = -1, py = -1;
        for (const [x, y] of p) { const rx = Math.round(x), ry = Math.round(y); if (rx === px && ry === py) continue; flat.push(rx, ry); px = rx; py = ry; }
        if (flat.length === 2) flat.push(Math.min(PAD_W, flat[0] + 4), flat[1]); // 点画成一小段，票面才看得见
        return flat;
      }).filter(s => s.length >= 4);
      const points = strokes.reduce((n, s) => n + s.length / 2, 0);
      if (points <= MAX_POINTS) return { strokes, points, reason: '' };
    }
    return { strokes: [], reason: 'toolarge' };
  }
  // 与服务器 strokes_ok 相同的检查
  function valid(st) {
    if (!Array.isArray(st) || !st.length || st.length > MAX_STROKES) return false;
    let n = 0;
    for (const s of st) {
      if (!Array.isArray(s) || s.length < 2 || s.length % 2) return false;
      for (let i = 0; i < s.length; i++) if (!Number.isInteger(s[i]) || s[i] < 0 || s[i] > (i % 2 ? PAD_H : PAD_W)) return false;
      n += s.length / 2;
    }
    return n <= MAX_POINTS;
  }
  return { trace, valid, otsu, thin, rdp, resample };
});
