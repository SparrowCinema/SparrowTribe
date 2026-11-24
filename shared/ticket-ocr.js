/* 拍照识票 OCR 文本解析器（2026-11-24）
 * 网站与小程序共用；小程序副本 miniprogram/packages/collect/utils/ticket-ocr.js 由 node tools/build-fallback.js 复制。
 * 解析纸质电影票与电子票截图中的：观影日期、开场时间、影院、影厅、座位、放映版本，并尝试匹配本片排片场次。 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SparrowTicketOcr = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const pad2 = n => String(n).padStart(2, '0');
  const norm = s => String(s || '')
    .replace(/[：]/g, ':')
    .replace(/[／]/g, '/')
    .replace(/[－—–]/g, '-')
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .replace(/\u3000/g, ' ');

  const normKey = s => String(s || '').toLowerCase().replace(/[\s·・\-—,.，。!！?？:：'’"“”()（）《》\[\]]/g, '');

  const MONTHS = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12
  };

  const NOISE_LINE_RE = /出票|购票|下单|订单|取票码|兑换码|验票|服务费|票价|实付|总额|合计|打印时间|issued|order|printed|receipt|price/i;
  const SHOW_HINT_RE = /开场|放映|场次|时间|日期|影厅|座位|showtime|date|time|start/i;

  function validYmd(y, m, d) {
    y = +y; m = +m; d = +d;
    if (y < 1990 || y > 2099 || m < 1 || m > 12 || d < 1 || d > 31) return '';
    return y + '-' + pad2(m) + '-' + pad2(d);
  }

  function extractDate(lines, defaultYear) {
    const yr = Number.isInteger(+defaultYear) ? +defaultYear : new Date().getFullYear();
    const cands = [];
    lines.forEach((line, idx) => {
      const noise = NOISE_LINE_RE.test(line);
      const hint = SHOW_HINT_RE.test(line);
      const scoreBase = (hint ? 10 : 0) - (noise ? 25 : 0) - idx * 0.1;
      // YYYY-MM-DD / YYYY/MM/DD / YYYY.MM.DD / YYYY年MM月DD日
      let m;
      const reFull = /(20\d{2})\s*[-\/.年]\s*(\d{1,2})\s*[-\/.月]\s*(\d{1,2})\s*日?/g;
      while ((m = reFull.exec(line))) {
        const v = validYmd(m[1], m[2], m[3]);
        if (v) cands.push({ v, s: scoreBase + 8 });
      }
      // MM月DD日 or MM/DD (avoid matching seat/price like 12/14 when preceded by 排/座)
      const reMdZh = /(\d{1,2})\s*月\s*(\d{1,2})\s*[日号號]/g;
      while ((m = reMdZh.exec(line))) {
        const v = validYmd(yr, m[1], m[2]);
        if (v) cands.push({ v, s: scoreBase + 5 });
      }
      const reMdSlash = /(?:^|[^\d])(\d{1,2})\/(\d{1,2})(?=[^\d]|$)/g;
      while ((m = reMdSlash.exec(line))) {
        if (/排|座|厅|廳/.test(line.slice(Math.max(0, m.index - 4), m.index + 8))) continue;
        const v = validYmd(yr, m[1], m[2]);
        if (v) cands.push({ v, s: scoreBase + 3 });
      }
      // English: Nov 28, 2026 / 28 Nov 2026
      const reEn1 = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(20\d{2}))?\b/gi;
      while ((m = reEn1.exec(line))) {
        const mo = MONTHS[m[1].toLowerCase().slice(0, 3)];
        const v = validYmd(m[3] || yr, mo, m[2]);
        if (v) cands.push({ v, s: scoreBase + (m[3] ? 7 : 4) });
      }
      const reEn2 = /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?(?:\s+(20\d{2}))?\b/gi;
      while ((m = reEn2.exec(line))) {
        const mo = MONTHS[m[2].toLowerCase().slice(0, 3)];
        const v = validYmd(m[3] || yr, mo, m[1]);
        if (v) cands.push({ v, s: scoreBase + (m[3] ? 7 : 4) });
      }
    });
    cands.sort((a, b) => b.s - a.s);
    return cands.length ? cands[0].v : '';
  }

  function extractTime(lines) {
    const cands = [];
    lines.forEach((line, idx) => {
      const noise = NOISE_LINE_RE.test(line);
      const hint = SHOW_HINT_RE.test(line);
      const scoreBase = (hint ? 10 : 0) - (noise ? 25 : 0) - idx * 0.1;
      // 12-hour AM/PM
      let m;
      const reAmPm = /\b(\d{1,2})\s*:\s*(\d{2})\s*(AM|PM)\b/gi;
      while ((m = reAmPm.exec(line))) {
        let h = +m[1], mi = +m[2];
        if (h < 1 || h > 12 || mi > 59) continue;
        const pm = m[3].toUpperCase() === 'PM';
        if (pm && h < 12) h += 12;
        if (!pm && h === 12) h = 0;
        cands.push({ v: pad2(h) + ':' + pad2(mi), s: scoreBase + 11 });
      }
      // 24-hour HH:MM (prefer non-HH:MM:SS and first time in a range like 19:30-21:40; skip AM/PM matches)
      const re24 = /(?:^|[^\d])([01]?\d|2[0-3])\s*:\s*([0-5]\d)(?:\s*:\s*\d{2})?(?!\d)(?!\s*(?:AM|PM)\b)/gi;
      let firstInLine = true;
      while ((m = re24.exec(line))) {
        const hasSec = /:\s*\d{2}$/.test(m[0]) && m[0].split(':').length >= 3;
        const h = +m[1], mi = +m[2];
        const v = pad2(h) + ':' + pad2(mi);
        // Screening start time is typically the FIRST time in a "19:30-21:40" pair, without seconds
        let sc = scoreBase + (firstInLine ? 6 : 1) + (hasSec ? -14 : 2);
        if (h >= 8 && h <= 23) sc += 2;
        cands.push({ v, s: sc });
        firstInLine = false;
      }
    });
    cands.sort((a, b) => b.s - a.s);
    return cands.length ? cands[0].v : '';
  }

  function extractSeat(lines) {
    const cleanNum = x => String(x || '').replace(/^0+(?=\d)/, '');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // 中文：5排8座 / 05排08号 / B排12號 / 第5排第8座 / 5排 8座
      let m = line.match(/第?\s*([A-Za-z]|\d{1,2})\s*排\s*第?\s*(\d{1,2})\s*[座号號位]/);
      if (m) return cleanNum(m[1]).toUpperCase() + '排' + cleanNum(m[2]) + '座';
      // 中文简写：5排8（仅当行内含座位提示）
      if (/座|排/.test(line)) {
        m = line.match(/第?\s*([A-Za-z]|\d{1,2})\s*排\s*(\d{1,2})(?!\s*[号號厅廳月日:])/);
        if (m) return cleanNum(m[1]).toUpperCase() + '排' + cleanNum(m[2]) + '座';
      }
      // 英文：Row 5 Seat 8 / Row F, Seat 12 / R5 S8
      m = line.match(/\bRow\s*[:#]?\s*([A-Za-z]{1,2}|\d{1,2})[\s,·/-]+(?:Seat|No\.?|#)\s*[:#]?\s*(\d{1,3})\b/i);
      if (m) return 'Row ' + cleanNum(m[1]).toUpperCase() + ' Seat ' + cleanNum(m[2]);
      m = line.match(/\bSeat\s*[:#]?\s*([A-Za-z]{1,2})\s*[-]?\s*(\d{1,3})\b/i);
      if (m) return m[1].toUpperCase() + cleanNum(m[2]);
      // 台湾常见：G排12號 / 座位：F12
      m = line.match(/(?:座位|席位|座號|座号)\s*[:：]?\s*([A-Za-z]{1,2})\s*[-]?\s*(\d{1,3})\b/);
      if (m) return m[1].toUpperCase() + cleanNum(m[2]);
    }
    return '';
  }

  function extractHall(lines) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // 显式标注「影厅：...」
      let m = line.match(/(?:影厅|影廳|厅号|廳號)\s*[:：]\s*([^\s,，]{1,24})/);
      if (m) {
        const h = m[1].trim();
        if (h && !/^\d{1,2}排/.test(h)) return h;
      }
      // 常见中文厅名：1号厅 / 3号杜比全景声厅 / LUXE巨幕厅 / IMAX激光厅 / A廳 / 第2廳 / 艺术影厅
      m = line.match(/(?:第?\s*[A-Za-z0-9]{1,3}\s*[号號]?\s*(?:IMAX|LUXE|CINITY|杜比全景声|杜比|巨幕|激光|VIP|贵宾|全景声|LED|艺术|4DX|RealD|ScreenX|激光巨幕|杜比视界|中国巨幕)?\s*(?:激光|巨幕|影)?[厅廳]|(?:IMAX|LUXE|CINITY|杜比|巨幕|VIP|艺术|贵宾|激光)[\u4e00-\u9fa5A-Za-z0-9]{0,8}[厅廳])/i);
      if (m) {
        const h = m[0].replace(/\s+/g, '').trim();
        if (h.length >= 2 && h.length <= 24) return h;
      }
      // 英文：Hall 3 / Screen 4 / Auditorium 2 / Theater B / Salle Debussy
      m = line.match(/\b(?:Hall|Screen|Auditorium|Theater|Theatre|Salle)\s*#?\s*([A-Za-z0-9]{1,12})\b/i);
      if (m) return m[0].replace(/\s+/g, ' ').trim();
    }
    return '';
  }

  const FORMAT_PATTERNS = [
    [/4K\s*(?:数字)?修复|4K\s*Restoration/i, '4K修复'],
    [/2K\s*(?:数字)?修复|2K\s*Restoration/i, '2K修复'],
    [/IMAX\s*激光|IMAX\s*Laser/i, 'IMAX激光'],
    [/IMAX\s*3D/i, 'IMAX 3D'],
    [/\bIMAX\b/i, 'IMAX'],
    [/杜比影院|Dolby\s*Cinema/i, '杜比影院'],
    [/杜比全景声|Dolby\s*Atmos/i, '杜比全景声'],
    [/\bCINITY\b/i, 'CINITY'],
    [/\bLUXE\b/i, 'LUXE'],
    [/中国巨幕|\bCGS\b/i, '中国巨幕'],
    [/\b70\s*mm\b/i, '70mm胶片'],
    [/\b35\s*mm\b/i, '35mm胶片'],
    [/胶片|膠片/i, '胶片'],
    [/\b4DX\b/i, '4DX'],
    [/ScreenX/i, 'ScreenX'],
    [/RealD\s*3D/i, 'RealD 3D'],
    [/(?:国语|原版|原声|英语|日语|粤语|法语|韩语|德语|意语)\s*(?:2D|3D)/i, null],
    [/\b4K\b/i, '4K'],
    [/\b3D\b/i, '3D'],
    [/\b2D\b/i, '2D']
  ];

  function extractFormat(text) {
    for (let i = 0; i < FORMAT_PATTERNS.length; i++) {
      const [re, label] = FORMAT_PATTERNS[i];
      const m = text.match(re);
      if (m) return label || m[0].replace(/\s+/g, '');
    }
    return '';
  }

  function extractVenue(lines, fullText, venues) {
    const fullNorm = normKey(fullText);
    // 1. 优先匹配片库已知影院（按名字长度降序，优先精确全称）
    if (Array.isArray(venues) && venues.length) {
      const cands = [];
      venues.forEach(v => {
        if (!v) return;
        const names = [v.name, v.short].filter(Boolean);
        names.forEach(nm => {
          const nk = normKey(nm);
          if (nk.length >= 2 && fullNorm.includes(nk)) {
            cands.push({ name: v.name || nm, len: nk.length });
          }
        });
      });
      if (cands.length) {
        cands.sort((a, b) => b.len - a.len);
        return cands[0].name;
      }
    }
    // 2. 通用影院行提取
    const VENUE_RE = /影城|影院|电影院|電影院|电影中心|影剧院|剧院|戲院|戏院|威秀|秀泰|國賓|国宾|光點|光点|百老汇|百老匯|博纳|万达|萬達|CGV|UME|MUVIE|Cinema|Cinemas|Theatre|Theater|Palais/i;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || NOISE_LINE_RE.test(line)) continue;
      if (VENUE_RE.test(line)) {
        const cleaned = line
          .replace(/^(?:影院|影城|地点|地點|场馆|場館|Venue|Cinema)\s*[:：]\s*/i, '')
          .replace(/\s+\d{1,2}[:：]\d{2}.*$/, '')
          .trim();
        if (cleaned.length >= 2 && cleaned.length <= 42) return cleaned;
      }
    }
    return '';
  }

  function matchShow(parsed, shows) {
    if (!Array.isArray(shows) || !shows.length) return null;
    if (!parsed.date && !parsed.time) return null;
    let best = null, bestScore = 0;
    shows.forEach(s => {
      let sc = 0;
      if (parsed.date && s.date === parsed.date) sc += 5;
      if (parsed.time && s.time === parsed.time) sc += 6;
      if (parsed.venue && s.venue && (normKey(s.venue).includes(normKey(parsed.venue)) || normKey(parsed.venue).includes(normKey(s.venue)))) sc += 3;
      if (parsed.hall && s.hall && normKey(s.hall) === normKey(parsed.hall)) sc += 2;
      if (sc > bestScore) { bestScore = sc; best = s; }
    });
    return bestScore >= 6 ? best : null;
  }

  function parseTicketText(rawText, ctx) {
    ctx = ctx || {};
    const text = norm(rawText || '');
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const date = extractDate(lines, ctx.defaultYear);
    const time = extractTime(lines);
    const seat = extractSeat(lines);
    const hall = extractHall(lines);
    const venue = extractVenue(lines, text, ctx.venues);
    const format = extractFormat(text);
    const result = { date, time, venue, hall, seat, format, raw: text };
    const matched = matchShow(result, ctx.shows);
    if (matched) {
      result.matchedShow = matched;
      if (!result.date && matched.date) result.date = matched.date;
      if (!result.time && matched.time) result.time = matched.time;
      if (matched.venue) result.venue = matched.venue;
      if (matched.hall && !result.hall) result.hall = matched.hall;
      if (matched.format && !result.format) result.format = matched.format;
    }
    const fields = ['date', 'time', 'venue', 'hall', 'seat', 'format'].filter(k => !!result[k]);
    result.fields = fields;
    return result;
  }

  // 浏览器端图像预处理：缩放至最大宽 1600px + 灰度自动对比度拉伸，提升热敏纸质票 OCR 清晰度
  function preprocessImage(img) {
    const maxW = 1600;
    const iw = img.naturalWidth || img.width || 1, ih = img.naturalHeight || img.height || 1;
    const scale = iw > maxW ? maxW / iw : 1;
    const w = Math.max(1, Math.round(iw * scale)), h = Math.max(1, Math.round(ih * scale));
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    try {
      const imd = ctx.getImageData(0, 0, w, h), d = imd.data;
      let lo = 255, hi = 0;
      for (let i = 0; i < d.length; i += 4) {
        const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
        d[i] = d[i + 1] = d[i + 2] = g;
        if (g < lo) lo = g;
        if (g > hi) hi = g;
      }
      const span = Math.max(1, hi - lo);
      if (span < 220) {
        for (let i = 0; i < d.length; i += 4) {
          const v = Math.max(0, Math.min(255, Math.round((d[i] - lo) * 255 / span)));
          d[i] = d[i + 1] = d[i + 2] = v;
        }
      }
      ctx.putImageData(imd, 0, 0);
    } catch (e) {}
    return cv;
  }

  return { parseTicketText, preprocessImage };
});
