/* 时区与场次时间工具（2026-11-24）：网站、小程序、可订阅日历与订阅提醒共用。
 * 优先级：场次 s.tz → 影院 venue.tz → 专题 programme.tz → 城市默认时区表 → Asia/Shanghai。
 * 小程序副本 miniprogram/utils/tz.js 与云函数副本 cloudfunctions/remind/tz.js 由 node tools/build-fallback.js 复制。 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SparrowTZ = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULT_TZ = 'Asia/Shanghai';

  const CITY_TZ = {
    '台北': 'Asia/Taipei', '台中': 'Asia/Taipei', '高雄': 'Asia/Taipei', '台南': 'Asia/Taipei',
    '新竹': 'Asia/Taipei', '桃园': 'Asia/Taipei', '台湾': 'Asia/Taipei',
    '香港': 'Asia/Hong_Kong', '澳门': 'Asia/Macau',
    '东京': 'Asia/Tokyo', '大阪': 'Asia/Tokyo', '京都': 'Asia/Tokyo', '福冈': 'Asia/Tokyo', '札幌': 'Asia/Tokyo',
    '首尔': 'Asia/Seoul', '釜山': 'Asia/Seoul', '全州': 'Asia/Seoul', '大邱': 'Asia/Seoul',
    '新加坡': 'Asia/Singapore', '曼谷': 'Asia/Bangkok', '吉隆坡': 'Asia/Kuala_Lumpur',
    '巴黎': 'Europe/Paris', '戛纳': 'Europe/Paris', '里昂': 'Europe/Paris',
    '柏林': 'Europe/Berlin', '慕尼黑': 'Europe/Berlin',
    '威尼斯': 'Europe/Rome', '罗马': 'Europe/Rome', '米兰': 'Europe/Rome', '博洛尼亚': 'Europe/Rome',
    '洛迦诺': 'Europe/Zurich', '苏黎世': 'Europe/Zurich', '日内瓦': 'Europe/Zurich',
    '鹿特丹': 'Europe/Amsterdam', '阿姆斯特丹': 'Europe/Amsterdam',
    '圣塞巴斯蒂安': 'Europe/Madrid', '马德里': 'Europe/Madrid', '巴塞罗那': 'Europe/Madrid',
    '卡罗维发利': 'Europe/Prague', '布拉格': 'Europe/Prague',
    '维也纳': 'Europe/Vienna', '布鲁塞尔': 'Europe/Brussels', '哥本哈根': 'Europe/Copenhagen', '斯德哥尔摩': 'Europe/Stockholm',
    '伦敦': 'Europe/London', '爱丁堡': 'Europe/London',
    '纽约': 'America/New_York', '波士顿': 'America/New_York', '华盛顿': 'America/New_York',
    '多伦多': 'America/Toronto', '蒙特利尔': 'America/Toronto',
    '洛杉矶': 'America/Los_Angeles', '旧金山': 'America/Los_Angeles', '西雅图': 'America/Los_Angeles', '温哥华': 'America/Vancouver',
    '芝加哥': 'America/Chicago', '帕克城': 'America/Denver',
    '悉尼': 'Australia/Sydney', '墨尔本': 'Australia/Melbourne', '奥克兰': 'Pacific/Auckland'
  };

  // 运行环境缺少完整 Intl 时区数据时回退到标准偏移（分钟）
  const FIXED_OFFSET = {
    'Asia/Shanghai': 480, 'Asia/Taipei': 480, 'Asia/Hong_Kong': 480, 'Asia/Macau': 480,
    'Asia/Singapore': 480, 'Asia/Kuala_Lumpur': 480, 'Asia/Urumqi': 360,
    'Asia/Tokyo': 540, 'Asia/Seoul': 540, 'Asia/Bangkok': 420,
    'Europe/London': 0, 'Europe/Paris': 60, 'Europe/Berlin': 60, 'Europe/Rome': 60,
    'Europe/Zurich': 60, 'Europe/Amsterdam': 60, 'Europe/Madrid': 60, 'Europe/Prague': 60,
    'Europe/Vienna': 60, 'Europe/Brussels': 60, 'Europe/Copenhagen': 60, 'Europe/Stockholm': 60,
    'America/New_York': -300, 'America/Toronto': -300, 'America/Chicago': -360,
    'America/Denver': -420, 'America/Los_Angeles': -480, 'America/Vancouver': -480,
    'Australia/Sydney': 600, 'Australia/Melbourne': 600, 'Pacific/Auckland': 720, 'UTC': 0
  };

  const FMT_CACHE = Object.create(null);
  function getFmt(tz) {
    if (FMT_CACHE[tz] !== undefined) return FMT_CACHE[tz];
    try {
      if (typeof Intl === 'object' && typeof Intl.DateTimeFormat === 'function') {
        const fmt = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
          hourCycle: 'h23'
        });
        // 触发一次验证该时区在当前运行环境确实有效
        if (typeof fmt.formatToParts === 'function') {
          fmt.formatToParts(new Date(0));
          FMT_CACHE[tz] = fmt;
          return fmt;
        }
      }
    } catch (e) {}
    FMT_CACHE[tz] = null;
    return null;
  }

  const pad2 = n => String(n).padStart(2, '0');
  const yearOf = (d, explicit) => {
    const y = +explicit;
    if (Number.isInteger(y) && y >= 1888 && y <= 2200) return y;
    return +String(d || '').split('/')[0] >= 10 ? 2026 : 2027;
  };
  const progShowYear = (d, p) => {
    if (p && p.start && p.end) {
      const sy = +String(p.start).slice(0, 4), sm = +String(p.start).slice(5, 7);
      const ey = +String(p.end).slice(0, 4);
      if (Number.isInteger(sy) && Number.isInteger(ey) && sy >= 1888 && ey >= sy) {
        if (sy === ey) return sy;
        const m = +String(d || '').split('/')[0];
        return m >= sm ? sy : ey;
      }
    }
    return yearOf(d);
  };

  function tzOfCity(city) {
    return (city && CITY_TZ[city]) || '';
  }

  function tzOf(s, vnMap, pgMap) {
    if (s && s.tz) return s.tz;
    const v = s && vnMap && vnMap[s.v];
    if (v && v.tz) return v.tz;
    const p = s && pgMap && pgMap[s.p];
    if (p && p.tz) return p.tz;
    const fromCity = tzOfCity((v && v.city) || (p && p.city));
    return fromCity || DEFAULT_TZ;
  }

  function progTz(p, vnMap, shows) {
    if (p && p.tz) return p.tz;
    if (Array.isArray(shows) && vnMap) {
      for (let i = 0; i < shows.length; i++) {
        const s = shows[i];
        if (s && s.tz) return s.tz;
        const v = s && vnMap[s.v];
        if (v && v.tz) return v.tz;
      }
    }
    return tzOfCity(p && p.city) || DEFAULT_TZ;
  }

  function partsInTz(utcMs, tz) {
    if (!Number.isFinite(utcMs)) return null;
    const zone = tz || DEFAULT_TZ;
    const fmt = getFmt(zone);
    if (fmt) {
      const parts = fmt.formatToParts(new Date(utcMs));
      let y = 0, m = 1, d = 1, H = 0, M = 0, S = 0;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (p.type === 'year') y = +p.value;
        else if (p.type === 'month') m = +p.value;
        else if (p.type === 'day') d = +p.value;
        else if (p.type === 'hour') H = +p.value % 24;
        else if (p.type === 'minute') M = +p.value;
        else if (p.type === 'second') S = +p.value;
      }
      return { y, m, d, H, M, S };
    }
    const off = FIXED_OFFSET[zone] !== undefined ? FIXED_OFFSET[zone] : 480;
    const shifted = new Date(utcMs + off * 60000);
    return {
      y: shifted.getUTCFullYear(), m: shifted.getUTCMonth() + 1, d: shifted.getUTCDate(),
      H: shifted.getUTCHours(), M: shifted.getUTCMinutes(), S: shifted.getUTCSeconds()
    };
  }

  function offsetMin(tz, utcMs) {
    const zone = tz || DEFAULT_TZ;
    const fmt = getFmt(zone);
    const raw = utcMs === undefined ? Date.now() : utcMs;
    if (!fmt || !Number.isFinite(raw)) return FIXED_OFFSET[zone] !== undefined ? FIXED_OFFSET[zone] : 480;
    const ms = Math.floor(raw / 1000) * 1000;
    const p = partsInTz(ms, zone);
    return p ? Math.round((Date.UTC(p.y, p.m - 1, p.d, p.H, p.M, p.S) - ms) / 60000) : (FIXED_OFFSET[zone] !== undefined ? FIXED_OFFSET[zone] : 480);
  }

  function zonedMs(y, m, d, H, M, tz) {
    const zone = tz || DEFAULT_TZ;
    const guess = Date.UTC(y, (m || 1) - 1, d || 1, H || 0, M || 0, 0);
    if (!Number.isFinite(guess)) return NaN;
    const off1 = offsetMin(zone, guess);
    let utc = guess - off1 * 60000;
    const off2 = offsetMin(zone, utc);
    if (off2 !== off1) utc = guess - off2 * 60000;
    return utc;
  }

  function showMs(s, vnMap, pgMap) {
    const md = String(s.d || '1/1').split('/').map(Number);
    const tm = String(s.t || '00:00').split(':').map(Number);
    const y = s.year ? yearOf(s.d, s.year) : progShowYear(s.d, pgMap && pgMap[s.p]);
    return zonedMs(y, md[0], md[1], tm[0] || 0, tm[1] || 0, tzOf(s, vnMap, pgMap));
  }

  function ymdMs(v, tz) {
    const p = String(v || '').split('-').map(Number);
    return zonedMs(p[0], p[1] || 1, p[2] || 1, 0, 0, tz || DEFAULT_TZ);
  }

  function showIso(s) {
    const md = String(s.d || '1/1').split('/').map(Number);
    return yearOf(s.d, s.year) + '-' + pad2(md[0] || 1) + '-' + pad2(md[1] || 1);
  }

  function weekday(d, explicit) {
    const md = String(d || '1/1').split('/').map(Number);
    return new Date(Date.UTC(yearOf(d, explicit), (md[0] || 1) - 1, md[1] || 1)).getUTCDay();
  }

  function nowParts(ms, tz) {
    const zone = tz || DEFAULT_TZ;
    const t = ms === undefined ? Date.now() : ms;
    const p = partsInTz(t, zone);
    return {
      y: p.y, m: p.m, d: p.d, H: p.H, M: p.M,
      dayKey: p.m + '/' + p.d,
      iso: p.y + '-' + pad2(p.m) + '-' + pad2(p.d),
      min: p.H * 60 + p.M,
      tz: zone,
      offsetMin: offsetMin(zone, t)
    };
  }

  function viewerTz() {
    try {
      if (typeof Intl === 'object' && typeof Intl.DateTimeFormat === 'function') {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      }
    } catch (e) {}
    return '';
  }

  function formatOffset(min) {
    const sign = min < 0 ? '-' : '+';
    const abs = Math.abs(min);
    return sign + pad2(Math.floor(abs / 60)) + pad2(abs % 60);
  }

  function tzShort(tz, ms) {
    const off = offsetMin(tz || DEFAULT_TZ, ms === undefined ? Date.now() : ms);
    const sign = off < 0 ? '-' : '+';
    const abs = Math.abs(off), h = Math.floor(abs / 60), m = abs % 60;
    return 'UTC' + sign + h + (m ? ':' + pad2(m) : '');
  }

  function sameOffset(tzA, tzB, ms) {
    const t = ms === undefined ? Date.now() : ms;
    return offsetMin(tzA || DEFAULT_TZ, t) === offsetMin(tzB || DEFAULT_TZ, t);
  }

  function formatLocalStamp(ms, tz) {
    const p = partsInTz(ms, tz || DEFAULT_TZ);
    return String(p.y) + pad2(p.m) + pad2(p.d) + 'T' + pad2(p.H) + pad2(p.M) + '00';
  }

  function formatUtcStamp(ms) {
    const d = new Date(ms);
    return String(d.getUTCFullYear()) + pad2(d.getUTCMonth() + 1) + pad2(d.getUTCDate()) + 'T' +
      pad2(d.getUTCHours()) + pad2(d.getUTCMinutes()) + pad2(d.getUTCSeconds()) + 'Z';
  }

  // 生成 RFC 5545 VTIMEZONE 片段（按涉及到的去重时区列表输出；支持固定时区与夏令时时区）
  function icsTimezones(tzList, refYear) {
    const seen = new Set();
    const y = refYear || 2026;
    const out = [];
    (tzList && tzList.length ? tzList : [DEFAULT_TZ]).forEach(raw => {
      const tz = raw || DEFAULT_TZ;
      if (seen.has(tz)) return;
      seen.add(tz);
      const jan = offsetMin(tz, Date.UTC(y, 0, 15, 12, 0));
      const jul = offsetMin(tz, Date.UTC(y, 6, 15, 12, 0));
      out.push('BEGIN:VTIMEZONE', 'TZID:' + tz);
      if (jan === jul) {
        const off = formatOffset(jan);
        out.push('BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:' + off, 'TZOFFSETTO:' + off, 'TZNAME:' + tzShort(tz, Date.UTC(y, 0, 15)), 'END:STANDARD');
      } else {
        const std = Math.min(jan, jul), dst = Math.max(jan, jul);
        const stdOff = formatOffset(std), dstOff = formatOffset(dst);
        const north = jul > jan;
        out.push(
          'BEGIN:STANDARD',
          'DTSTART:' + (north ? '19701101T020000' : '19700401T020000'),
          'TZOFFSETFROM:' + dstOff, 'TZOFFSETTO:' + stdOff,
          'TZNAME:' + tzShort(tz, north ? Date.UTC(y, 0, 15) : Date.UTC(y, 6, 15)),
          'END:STANDARD',
          'BEGIN:DAYLIGHT',
          'DTSTART:' + (north ? '19700308T020000' : '19701001T020000'),
          'TZOFFSETFROM:' + stdOff, 'TZOFFSETTO:' + dstOff,
          'TZNAME:' + tzShort(tz, north ? Date.UTC(y, 6, 15) : Date.UTC(y, 0, 15)),
          'END:DAYLIGHT'
        );
      }
      out.push('END:VTIMEZONE');
    });
    return out;
  }

  function icsEventDates(s, durMin, vnMap, pgMap) {
    const tz = tzOf(s, vnMap, pgMap);
    const startMs = showMs(s, vnMap, pgMap);
    const endMs = startMs + (+durMin > 0 ? +durMin : 120) * 60000;
    return {
      tz,
      startMs,
      endMs,
      dtstart: 'DTSTART;TZID=' + tz + ':' + formatLocalStamp(startMs, tz),
      dtend: 'DTEND;TZID=' + tz + ':' + formatLocalStamp(endMs, tz)
    };
  }

  return {
    DEFAULT_TZ, CITY_TZ, FIXED_OFFSET,
    yearOf, progShowYear, tzOfCity, tzOf, progTz,
    offsetMin, zonedMs, showMs, ymdMs, showIso, weekday,
    nowParts, viewerTz, formatOffset, tzShort, sameOffset,
    formatLocalStamp, formatUtcStamp, icsTimezones, icsEventDates
  };
});
