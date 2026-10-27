const WK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const year = d => (+d.split('/')[0] >= 10 ? 2026 : 2027);
const wk = d => { const [m, dd] = d.split('/').map(Number); return WK[new Date(year(d), m - 1, dd).getDay()]; };
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const fmt = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const keyOf = s => `${s.d}-${s.t}-${s.v}-${s.h}`;
const showDate = s => { const [m, d] = s.d.split('/').map(Number); const [h, mi] = s.t.split(':').map(Number); return new Date(year(s.d), m - 1, d, h, mi); };
const POSTERS = 'wild-strawberries dogville sirat swordsman swordsman-2 leningrad-cowboys turin-horse a-better-tomorrow long-live-the-missus bullets-over-broadway green-green-grass blood-simple spring-in-a-small-town mon-oncle where-is-the-friends-house the-sacrifice faces-places'.split(' ');
const poster = f => f.posterUrl || (POSTERS.includes(f.id) ? `/images/posters/${f.id}.jpg` : '');
const ticket = f => f.ticketUrl || (POSTERS.includes(f.id) ? `/images/tickets/${f.id}.jpg` : '');
const durText = m => (m < 60 ? m + ' 分钟' : Math.floor(m / 60) + ' 小时' + (m % 60 ? ' ' + (m % 60) + ' 分' : ''));

function index(data) {
  const F = {}; data.films.forEach(f => { F[f.id] = f; });
  const VN = {}; data.venues.forEach(v => { VN[v.id] = v; });
  const PG = {}; data.programmes.forEach(p => { PG[p.id] = p; });
  const hallName = s => { const v = VN[s.v]; const h = v && v.halls.find(x => x.id === s.h); return h ? h.name : s.h; };
  const venueName = s => (VN[s.v] ? VN[s.v].name : s.v);
  const progOf = f => PG[f.prog || 'style-kaleidoscope'] || data.programmes[0];
  return { F, VN, PG, hallName, venueName, progOf };
}

// 一场放映的展示用对象
function showView(s, idx, data, picked) {
  const f = idx.F[s.id]; const st = toMin(s.t);
  return {
    key: keyOf(s), d: s.d, t: s.t, end: fmt(st + f.min), wk: wk(s.d), id: s.id,
    cn: f.cn, version: f.version || '', dir: f.dir, min: f.min,
    venue: idx.venueName(s), hall: idx.hallName(s),
    color: (data.reg[f.reg] || {}).c || '#8e2a22',
    poster: poster(f), picked: picked ? picked.has(keyOf(s)) : false
  };
}

module.exports = { WK, year, wk, toMin, fmt, keyOf, showDate, poster, ticket, durText, index, showView };
