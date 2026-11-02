const I = require('./i18n.js');
const WK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const year = d => (+d.split('/')[0] >= 10 ? 2026 : 2027);
const wk = d => { const [m, dd] = d.split('/').map(Number); return I.tr(WK[new Date(year(d), m - 1, dd).getDay()]); };
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const fmt = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const keyOf = s => `${s.d}-${s.t}-${s.v}-${s.h}`;
const showDate = s => { const [m, d] = s.d.split('/').map(Number); const [h, mi] = s.t.split(':').map(Number); return new Date(year(s.d), m - 1, d, h, mi); };
const POSTERS = 'wild-strawberries dogville sirat swordsman swordsman-2 leningrad-cowboys turin-horse a-better-tomorrow long-live-the-missus bullets-over-broadway green-green-grass blood-simple spring-in-a-small-town mon-oncle where-is-the-friends-house the-sacrifice faces-places kill-bill-whole-bloody-affair the-odyssey linka-linka happy-birthday dune-part-three avengers-doomsday john-wick we-live-in-time for-better-or-worse resident-evil'.split(' ');
const poster = f => f.posterUrl || (POSTERS.includes(f.id) ? `/images/posters/${f.id}.jpg` : '');
const TICKETS = POSTERS.slice(0, 17); // 只有风格万相 17 部有购票码
const ticket = f => f.ticketUrl || (TICKETS.includes(f.id) ? `/images/tickets/${f.id}.jpg` : '');
const durText = m => I.tr(m < 60 ? m + ' 分钟' : Math.floor(m / 60) + ' 小时' + (m % 60 ? ' ' + (m % 60) + ' 分' : ''));

// 每部影片一种柔和浅色：按片目顺序以黄金角拉开色相
const hsl2hex = (h, s, l) => { s /= 100; l /= 100; const k = n => (n + h / 30) % 12; const a = s * Math.min(l, 1 - l); const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)))).toString(16).padStart(2, '0'); return '#' + f(0) + f(8) + f(4); };
const filmTone = i => { const h = Math.round((i < 0 ? 0 : i) * 137.508 % 360); return { bg: hsl2hex(h, 36, 85), line: hsl2hex(h, 36, 68), ink: hsl2hex(h, 38, 22), bar: hsl2hex(h, 40, 62) }; };
// 上映日期：优先解析 release 中的「YYYY年M月D日」，否则用年份
const relTime = f => { const m = String(f.release || '').match(/(\d{4})年(\d{1,2})月(\d{1,2})日/); if (m) return new Date(+m[1], m[2] - 1, +m[3]).getTime(); return f.y ? new Date(+f.y, 0, 1).getTime() : 0; };
// 某部影片的下一场（未开映）
const nextShowOf = (f, shows) => shows.filter(s => s.id === f.id && showDate(s).getTime() > Date.now()).sort((a, b) => showDate(a) - showDate(b))[0] || null;
// 片单排序：有待放映场次的在前，按下一场放映时间先后；无场次的按上映日期从新到旧
const filmOrder = shows => (a, b) => { const na = nextShowOf(a, shows), nb = nextShowOf(b, shows); if (!!na !== !!nb) return na ? -1 : 1; if (na && nb) return showDate(na) - showDate(nb); return relTime(b) - relTime(a); };
// 专题是否为影展类（影展在前，院线在后）
const isFest = p => !!p && /影展|festival/i.test(p.kind || '');
const langSub = f => I.tr([f.language, f.subtitles].filter(Boolean).join(' ｜ '));

function index(data) {
  const F = {}; const ORD = {}; data.films.forEach((f, i) => { F[f.id] = f; ORD[f.id] = i; });
  const VN = {}; data.venues.forEach(v => { VN[v.id] = v; });
  const PG = {}; data.programmes.forEach(p => { PG[p.id] = p; });
  const hallName = s => { const v = VN[s.v]; const h = v && v.halls.find(x => x.id === s.h); return h ? h.name : s.h; };
  const venueName = s => { const v=VN[s.v]; if(!v)return s.v; const c=I.tr(v.city||""),name=v.name.replace(new RegExp("^("+[v.city,c].filter(Boolean).join("|")+")\\s*[·・]?\\s*"),""); return (c?c+" · ":"")+name; };
  const progOf = f => PG[f.prog || 'style-kaleidoscope'] || data.programmes[0];
  return { F, ORD, VN, PG, hallName, venueName, progOf };
}

// 映后交流：片目里有起止时间与嘉宾，且结束晚于开始，才在时刻表上显示
const qaOf = f => (f && f.qaStart && f.qaEnd && f.qaGuest && toMin(f.qaEnd) > toMin(f.qaStart)) ? { start: toMin(f.qaStart), end: toMin(f.qaEnd), label: f.qaStart + '–' + f.qaEnd, guest: f.qaGuest } : null;

// 一场放映是否已散场（片长结束后即视为已放映，首页与详情页不再显示）
const durationOf = (s, idx) => { const f=idx.F[s.id]||{}, e=(f.screeningEnds||{})[keyOf(s)]; return e ? toMin(e)-toMin(s.t) : (f.min||0); };
const progForShow = (s, idx) => { const f=idx.F[s.id]||{}; return idx.PG[s.p] || Object.values(idx.PG).find(p => (p.sections||{})[s.id] && (f.screeningEnds||{})[keyOf(s)]) || idx.progOf(f); };
const ended = (s, idx) => showDate(s).getTime() + durationOf(s, idx) * 60000 < Date.now();

// 专题状态：有起止日期按日期，否则按场次范围（与网站 progStatus 一致）：soon 即将开始 / live 进行中 / ended 已结束
const ymd = v => { const [y, m, d] = String(v).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1).getTime(); };
function progInfo(p, data, idx, now = Date.now()) {
  const shows = data.shows.filter(s => idx.F[s.id] && progForShow(s, idx).id === p.id);
  const ts = shows.map(s => showDate(s).getTime()), te = shows.map(s => showDate(s).getTime() + durationOf(s, idx) * 60000);
  const a = p.start ? ymd(p.start) : (ts.length ? Math.min(...ts) : null);
  const b = p.end ? ymd(p.end) + 864e5 : (te.length ? Math.max(...te) : null);
  // 常设专题（ongoing，如麻雀部落电影空间）：开始后一直算进行中，不进入往期
  const status = a != null && now < a ? 'soon' : (!p.ongoing && b != null && now >= b ? 'ended' : 'live');
  return { shows, a, b, status, up: shows.filter(s => !ended(s, idx)).length };
}

// 一场放映的展示用对象
function showView(s, idx, data, picked) {
  const f = idx.F[s.id]; const st = toMin(s.t);
  return {
    key: keyOf(s), d: s.d, t: s.t, end: fmt(st + durationOf(s, idx)), wk: wk(s.d), id: s.id,
    cn: f.cn, version: I.tr(f.version || ''), dir: f.dir, min: f.min, minTxt: I.tr(f.min ? f.min + ' 分钟' : '片长待定'),
    venue: idx.venueName(s), hall: idx.hallName(s),
    color: (data.reg[f.reg] || {}).c || '#8e2a22',
    tone: filmTone(idx.ORD ? idx.ORD[s.id] : 0), langSub: langSub(f),
    note: I.tr((f.screeningNotes||{})[keyOf(s)]||""), poster: poster(f), picked: picked ? picked.has(keyOf(s)) : false,
    past: showDate(s).getTime() + durationOf(s, idx) * 60000 < Date.now()
  };
}

module.exports = { progForShow, durationOf, progInfo, qaOf, ended, isFest, relTime, nextShowOf, filmOrder, filmTone, langSub, WK, year, wk, toMin, fmt, keyOf, showDate, poster, ticket, durText, index, showView };
