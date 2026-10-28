const WK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const year = d => (+d.split('/')[0] >= 10 ? 2026 : 2027);
const wk = d => { const [m, dd] = d.split('/').map(Number); return WK[new Date(year(d), m - 1, dd).getDay()]; };
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const fmt = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const keyOf = s => `${s.d}-${s.t}-${s.v}-${s.h}`;
const showDate = s => { const [m, d] = s.d.split('/').map(Number); const [h, mi] = s.t.split(':').map(Number); return new Date(year(s.d), m - 1, d, h, mi); };
const POSTERS = 'wild-strawberries dogville sirat swordsman swordsman-2 leningrad-cowboys turin-horse a-better-tomorrow long-live-the-missus bullets-over-broadway green-green-grass blood-simple spring-in-a-small-town mon-oncle where-is-the-friends-house the-sacrifice faces-places kill-bill-whole-bloody-affair the-odyssey linka-linka happy-birthday dune-part-three avengers-doomsday john-wick we-live-in-time for-better-or-worse resident-evil'.split(' ');
const poster = f => f.posterUrl || (POSTERS.includes(f.id) ? `/images/posters/${f.id}.jpg` : '');
const TICKETS = POSTERS.slice(0, 17); // 只有风格万相 17 部有购票码
const ticket = f => f.ticketUrl || (TICKETS.includes(f.id) ? `/images/tickets/${f.id}.jpg` : '');
const durText = m => (m < 60 ? m + ' 分钟' : Math.floor(m / 60) + ' 小时' + (m % 60 ? ' ' + (m % 60) + ' 分' : ''));

// 每部影片一种柔和浅色：按片目顺序以黄金角拉开色相
const hsl2hex = (h, s, l) => { s /= 100; l /= 100; const k = n => (n + h / 30) % 12; const a = s * Math.min(l, 1 - l); const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)))).toString(16).padStart(2, '0'); return '#' + f(0) + f(8) + f(4); };
const filmTone = i => { const h = Math.round((i < 0 ? 0 : i) * 137.508 % 360); return { bg: hsl2hex(h, 36, 85), line: hsl2hex(h, 36, 68), ink: hsl2hex(h, 38, 22), bar: hsl2hex(h, 40, 62) }; };
const langSub = f => [f.language, f.subtitles].filter(Boolean).join(' ｜ ');

function index(data) {
  const F = {}; const ORD = {}; data.films.forEach((f, i) => { F[f.id] = f; ORD[f.id] = i; });
  const VN = {}; data.venues.forEach(v => { VN[v.id] = v; });
  const PG = {}; data.programmes.forEach(p => { PG[p.id] = p; });
  const hallName = s => { const v = VN[s.v]; const h = v && v.halls.find(x => x.id === s.h); return h ? h.name : s.h; };
  const venueName = s => (VN[s.v] ? VN[s.v].name : s.v);
  const progOf = f => PG[f.prog || 'style-kaleidoscope'] || data.programmes[0];
  return { F, ORD, VN, PG, hallName, venueName, progOf };
}

// 一场放映的展示用对象
function showView(s, idx, data, picked) {
  const f = idx.F[s.id]; const st = toMin(s.t);
  return {
    key: keyOf(s), d: s.d, t: s.t, end: fmt(st + f.min), wk: wk(s.d), id: s.id,
    cn: f.cn, version: f.version || '', dir: f.dir, min: f.min,
    venue: idx.venueName(s), hall: idx.hallName(s),
    color: (data.reg[f.reg] || {}).c || '#8e2a22',
    tone: filmTone(idx.ORD ? idx.ORD[s.id] : 0), langSub: langSub(f),
    poster: poster(f), picked: picked ? picked.has(keyOf(s)) : false,
    past: showDate(s).getTime() + f.min * 60000 < Date.now()
  };
}

module.exports = { filmTone, langSub, WK, year, wk, toMin, fmt, keyOf, showDate, poster, ticket, durText, index, showView };
