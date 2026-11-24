// 订阅消息「电影上映提醒」的取数与文案规则（纯函数，不碰数据库，便于本地测试：tools/check-remind.js）
// 模板字段：电影名称 thing1 · 上映时间 time2 · 放映地点 thing5 · 温馨提醒 thing6 · 观影须知 thing8
// thing 类最多 20 个字符，time 类为「2026年11月20日 19:30」。
const TZ = require('./tz.js');
const HOUR = 3600e3;
// 场次年份规则与小程序 utils/util.js 的 year() 一致：显式 year 优先，否则 10–12 月算 2026，1–9 月算 2027
const yearOf = s => TZ.yearOf(s.d, s.year);
const keyOf = s => `${s.d}-${s.t}-${s.v}-${s.h}` + (s.archive === true ? `-archive-${s.id}` : '');
// 场次时间按影院 / 专题时区（缺省 Asia/Shanghai），云函数运行环境是 UTC
const tzOf = (s, idx) => TZ.tzOf(s, idx && idx.VN, idx && idx.PG);
const startOf = (s, idx) => TZ.showMs(s, idx && idx.VN, idx && idx.PG);
const cut = (x, n = 20) => { const a = Array.from(String(x || '').replace(/\s+/g, ' ').trim()); return a.length > n ? a.slice(0, n - 1).join('') + '…' : a.join(''); };
const timeText = (ms, tz) => { const p = TZ.nowParts(ms, tz || TZ.DEFAULT_TZ); return `${p.y}年${p.m}月${p.d}日 ${String(p.H).padStart(2, '0')}:${String(p.M).padStart(2, '0')}`; };

function index(data) {
  const F = {}, VN = {}, PG = {};
  (data.films || []).forEach(f => { F[f.id] = f; });
  (data.venues || []).forEach(v => { VN[v.id] = v; });
  (data.programmes || []).forEach(p => { PG[p.id] = p; });
  return { F, VN, PG, shows: data.shows || [], moves: data.changes || {} }; // moves：场次变更记录（getData 从网站 data/changes.json 读入）
}
const filmName = f => f ? cut(f.cn + (f.version ? ' ' + f.version : '')) : '';
// 地点：城市·影院·影厅，超过 20 字先去掉城市，再用影厅简称
function placeOf(s, idx) {
  const v = idx.VN[s.v]; if (!v) return cut(s.v);
  const name = String(v.name || '').replace(new RegExp('^' + (v.city || '-') + '\\s*[·・]?\\s*'), '');
  const hl = (v.halls || []).find(h => h.id === s.h) || {};
  // 影院全名太长时用「品牌（简称）」，例如 万象影城（杭州万象城激光IMAX店）→ 万象影城（万象城）
  const bs = v.brand && v.short && v.brand !== v.short ? v.brand + '（' + v.short + '）' : (v.short || v.brand);
  const tries = [[v.city, name, hl.name], [name, hl.name], [name, hl.short], [bs, hl.name], [bs, hl.short], [v.short || v.brand, hl.short || hl.name], [name]];
  for (const p of tries) { const t = p.filter(Boolean).join('·'); if (Array.from(t).length <= 20) return t; }
  return cut(name);
}
const upcoming = (idx, film, now) => idx.shows.filter(s => s.id === film && startOf(s, idx) > now).sort((a, b) => startOf(a, idx) - startOf(b, idx));

const TXT = {
  start: ['1 小时内开场，请提前取票入场', '请提前到场，观影时手机静音'],
  change: ['场次有变动，点此查看最新场次', '原场次已调整，请在小程序里重新选择'],
  moved: ['场次已改期，请按新时间入场', '你的排片已自动换成新场次'],
  cancelled: ['场次已取消，点此查看其他场次', '可在小程序里改选同片其他场次'],
  want: ['你想看的影片有新场次了', '点此查看全部场次并加入排片'],
};
function message(kind, f, s, idx, when) {
  const [tip, note] = TXT[kind];
  const tz = s ? tzOf(s, idx) : TZ.DEFAULT_TZ;
  return { thing1: { value: filmName(f) || '影片' }, time2: { value: timeText(when, tz) }, thing5: { value: s ? placeOf(s, idx) : '详见小程序' }, thing6: { value: tip }, thing8: { value: note } };
}

// 判断一条订阅现在该做什么：{act:'send', kind, data, page} / {act:'expire'} / {act:'wait'}
// doc：{kind:'show', key, film, start} 或 {kind:'want', film, known:[场次键]}
// trusted：这份排片数据是否新鲜完整（不新鲜时不判断「场次消失」，避免误发变更通知）
function decide(doc, idx, now, trusted) {
  const page = 'pages/film/film?id=' + encodeURIComponent(doc.film);
  const f = idx.F[doc.film];
  if (doc.kind === 'show') {
    if (doc.start < now - 10 * 60e3) return { act: 'expire' };
    const s = idx.shows.find(x => keyOf(x) === doc.key);
    if (s) {
      const st = startOf(s, idx);
      if (st - HOUR <= now && st > now) return { act: 'send', kind: 'start', page, data: message('start', f, s, idx, st) };
      return { act: 'wait' };
    }
    // 场次键在最新排片里找不到：先查场次变更记录——改期就按新时间、新地点发「已改期」，取消就发「已取消」
    const mv = idx.moves[doc.key];
    if (mv && mv.to) {
      const ns = idx.shows.find(x => keyOf(x) === mv.to);
      if (ns && startOf(ns, idx) > now) return { act: 'send', kind: 'moved', page, data: message('moved', f, ns, idx, startOf(ns, idx)) };
    }
    if (mv && !mv.to && doc.start > now) return { act: 'send', kind: 'cancelled', page, data: message('cancelled', f, doc.show || {}, idx, doc.start) };
    // 记录里没有：时间或影厅改了。数据可信且影片本身还在时才发笼统的变更通知
    if (!trusted || !f || doc.start <= now) return { act: 'wait' };
    const old = doc.show || {}; // 订阅时记下的原场次（影院 id 本身可能含「-」，不能从场次键拆）
    return { act: 'send', kind: 'change', page, data: message('change', f, old, idx, doc.start) };
  }
  if (doc.kind === 'want') {
    if (!f) return { act: 'wait' };
    const known = new Set(doc.known || []);
    const fresh = upcoming(idx, doc.film, now + 30 * 60e3).filter(s => !known.has(keyOf(s)));
    if (!fresh.length) return { act: 'wait' };
    return { act: 'send', kind: 'want', page, data: message('want', f, fresh[0], idx, startOf(fresh[0], idx)) };
  }
  return { act: 'expire' };
}

module.exports = { HOUR, yearOf, keyOf, tzOf, startOf, cut, timeText, index, placeOf, filmName, upcoming, message, decide };
