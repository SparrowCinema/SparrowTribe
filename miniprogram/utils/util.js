const CFG = require('./cfg.js');
const I = require('./i18n.js');
const TZ = require('./tz.js');
const Planner = require('./planner.js');
const WK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const year = (d, explicit) => TZ.yearOf(d, explicit);
const showYmd = s => year(s.d, s.year) + '/' + s.d; // 带年份的日期，如 2026/11/11
const showIso = s => TZ.showIso(s);
const wk = (d, explicit) => I.tr(WK[TZ.weekday(d, explicit)]);
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const fmt = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const keyOf = require('./screenings.js').keyOf;
const tzOf = (s, idx) => TZ.tzOf(s, idx && idx.VN, idx && idx.PG);
const progTz = (p, idx, shows) => TZ.progTz(p, idx && idx.VN, shows);
const showDate = (s, idx) => new Date(TZ.showMs(s, idx && idx.VN, idx && idx.PG));
const poster = f => f.posterUrl || ''; // 海报全部读网站，换图自动同步
// 列表用的缩略图：网站部署时生成 posters/w360/<名>.jpg（tools/build-thumbs.py），安装包里的海报本来就是 300px，不换
const thumb = f => { const u = poster(f); return /^https?:\/\/[^?#]+\/posters\/[^/?#]+\.(jpe?g|png)$/i.test(u) ? u.replace(/\/posters\/([^/?#]+)\.(jpe?g|png)$/i, '/posters/w360/$1.jpg') : u; };
const ticket = f => f.ticketUrl || ''; // 购票码走网站在线图（离线时不显示），不再打进小程序包
const durText = m => I.tr(m < 60 ? m + ' 分钟' : Math.floor(m / 60) + ' 小时' + (m % 60 ? ' ' + (m % 60) + ' 分' : ''));

// 每部影片一种柔和浅色：按片目顺序以黄金角拉开色相
const hsl2hex = (h, s, l) => { s /= 100; l /= 100; const k = n => (n + h / 30) % 12; const a = s * Math.min(l, 1 - l); const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)))).toString(16).padStart(2, '0'); return '#' + f(0) + f(8) + f(4); };
// 色块色用 CSS 变量取饱和度/明度（app.wxss 里是浅色默认值，暗色时由 cfg.js 的 page-style 覆盖），所以切换外观不用重算数据；变量取不到时回落到浅色值
const filmTone = i => { const h = Math.round((i < 0 ? 0 : i) * 137.508 % 360); return { bg: 'hsl(' + h + ' var(--barS,36%) var(--barL,85%))', line: 'hsl(' + h + ' var(--barS,36%) var(--lineL,68%))', ink: 'hsl(' + h + ' 38% var(--inkL,22%))', bar: hsl2hex(h, 40, 62) }; };
// 上映日期：优先解析 release 中的「YYYY年M月D日」，否则用年份
const relTime = f => { const m = String(f.releaseZh || f.release || '').match(/(\d{4})年(\d{1,2})月(\d{1,2})日/); if (m) return TZ.zonedMs(+m[1], +m[2], +m[3], 0, 0, TZ.DEFAULT_TZ); const y = parseInt(f.y, 10); return Number.isFinite(y) ? TZ.zonedMs(y, 1, 1, 0, 0, TZ.DEFAULT_TZ) : 0; };
// 某部影片的下一场（未开映）
const nextShowOf = (f, shows, idx) => shows.filter(s => s.id === f.id && showDate(s, idx).getTime() > Date.now()).sort((a, b) => showDate(a, idx) - showDate(b, idx))[0] || null;
// 片单排序：有待放映场次的在前，按下一场放映时间先后；无场次的按上映日期从新到旧
const filmOrder = (shows, idx) => (a, b) => { const na = nextShowOf(a, shows, idx), nb = nextShowOf(b, shows, idx); if (!!na !== !!nb) return na ? -1 : 1; if (na && nb) return showDate(na, idx) - showDate(nb, idx); return relTime(b) - relTime(a); };
// 专题是否为影展类（影展在前，院线在后）
const keepPast = p => !!p && /影展|festival|艺术电影空间/i.test(p.kind || '');
const isFest = p => !!p && /影展|festival/i.test(p.kind || '');
// 定位城市（本机 sk-geo-city，1 天内有效；由首页定位写入，未授权时为空）——与网站 geoActiveCity / localProg 规则一致
const geoCity = () => { try { const o = wx.getStorageSync('sk-geo-city'); return o && o.c && Date.now() - o.t < 864e5 ? o.c : ''; } catch (e) { return ''; } };
// 首页优先城市：定位城市在 4 小时前之后仍有场次则用它，否则杭州（网站 homeCity）
const homeCity = data => { const c = geoCity(); if (c && c !== '杭州') { const vn = {}; (data.venues || []).forEach(v => { vn[v.id] = v; }); const pg = {}; (data.programmes || []).forEach(p => { pg[p.id] = p; }); const ids = new Set(data.venues.filter(v => v.city === c).map(v => v.id)), t = Date.now() - 4 * 36e5; if (data.shows.some(s => ids.has(s.v) && TZ.showMs(s, vn, pg) > t)) return c; } return '杭州'; };
// 下一场优先取定位城市的场次（list 已按时间升序），没有再取最早的一场（与网站 localFirst 一致）
const localFirst = (list, idx) => { const c = geoCity(); return (c && list.find(s => (idx.VN[s.v] || {}).city === c)) || list[0]; };
const localProg = (p, data, idx, status) => { const c = geoCity(); if (!c || status === 'ended') return false; return p.city === c || data.shows.some(s => progForShow(s, idx).id === p.id && (idx.VN[s.v] || {}).city === c && !ended(s, idx)); };
const langSub = f => I.tr(f.langTag || [f.language, f.subtitles].filter(Boolean).join(' ｜ '));

function index(data) {
  const F = {}; const ORD = {}; data.films.forEach((f, i) => { F[f.id] = f; ORD[f.id] = i; });
  Object.entries(data.aliases || {}).forEach(([o, n]) => { if (F[n] && !F[o]) F[o] = F[n]; }); // 旧影片 id → 合并后的影片
  // 定位城市（有尚未散场的场次时）排最前，杭州其次，其余按目录原顺序（与网站 venueRank 一致）
  data.venues.forEach((v, i) => { if (v._o === undefined) v._o = i; });
  const H = homeCity(data);
  const vrank = new Map(data.venues.map(v => [v.id, (v.city === H ? 0 : v.city === '杭州' ? 1000 : 2000) + v._o]));
  data.venues.sort((a, b) => vrank.get(a.id) - vrank.get(b.id));
  const VN = {}; data.venues.forEach(v => { VN[v.id] = v; });
  const PG = {}; data.programmes.forEach(p => { PG[p.id] = p; });
  const hallName = s => { const v = VN[s.v]; const h = v && v.halls.find(x => x.id === s.h); return h ? h.name : s.h; };
  const venueName = s => { const v=VN[s.v]; if(!v)return s.v; const c=I.tr(v.city||""),name=v.name.replace(new RegExp("^("+[v.city,c].filter(Boolean).join("|")+")\\s*[·・]?\\s*"),""); return (c?c+" · ":"")+name; };
  const progOf = f => PG[f.prog || 'style-kaleidoscope'] || data.programmes[0];
  const progsOf = f => { const main = progOf(f), out = [{ p: main, sec: f.section || (main.sections || {})[f.id] || '' }]; data.programmes.forEach(p => { if (p.id !== main.id && ((p.sections || {})[f.id] || (p.members || []).includes(f.id))) out.push({ p, sec: (p.sections || {})[f.id] || '' }); }); return out; };
  return { F, ORD, VN, PG, hallName, venueName, progOf, progsOf };
}

// 映后交流：片目里有起止时间与嘉宾，且结束晚于开始，才在时刻表上显示
const qaOf = f => (f && f.qaStart && f.qaEnd && f.qaGuest && toMin(f.qaEnd) > toMin(f.qaStart)) ? { start: toMin(f.qaStart), end: toMin(f.qaEnd), label: f.qaStart + '–' + f.qaEnd, guest: f.qaGuest } : null;

// 一场放映是否已散场（片长结束后即视为已放映，首页与详情页不再显示）
const durationOf = (s, idx) => { const f=idx.F[s.id]||{}, e=(f.screeningEnds||{})[keyOf(s)]; return e ? toMin(e)-toMin(s.t) : (f.min||0); };
const progForShow = (s, idx) => { const f=idx.F[s.id]||{}; return idx.PG[s.p] || Object.values(idx.PG).find(p => (p.sections||{})[s.id] && (f.screeningEnds||{})[keyOf(s)]) || idx.progOf(f); };
const ended = (s, idx) => showDate(s, idx).getTime() + durationOf(s, idx) * 60000 < Date.now();

// 专题状态：有起止日期按日期，否则按场次范围（与网站 progStatus 一致）：soon 即将开始 / live 进行中 / ended 已结束
const ymd = (v, tz) => TZ.ymdMs(v, tz || TZ.DEFAULT_TZ);
function progInfo(p, data, idx, now = Date.now()) {
  const shows = data.shows.filter(s => idx.F[s.id] && progForShow(s, idx).id === p.id);
  const tz = progTz(p, idx, shows);
  const ts = shows.map(s => showDate(s, idx).getTime()), te = shows.map(s => showDate(s, idx).getTime() + durationOf(s, idx) * 60000);
  const a = p.start ? ymd(p.start, tz) : (ts.length ? Math.min(...ts) : null);
  const b = p.end ? ymd(p.end, tz) + 864e5 : (te.length ? Math.max(...te) : null);
  // 常设专题（ongoing，如麻雀部落电影空间）：开始后一直算进行中，不进入往期
  // 提前结束（与网站 progDone 一致）：结束日前 2 天内，已公布的场次全部散场即算已结束；院线专题不录全部场次，不提前结束
  const done = !p.ongoing && p.end && p.kind !== '院线' && shows.length > 0 && now >= ymd(p.end, tz) - 2 * 864e5 && te.every(e => e < now);
  const status = a != null && now < a ? 'soon' : (!p.ongoing && b != null && now >= b ? 'ended' : (done ? 'ended' : 'live'));
  return { shows, a, b, status, up: shows.filter(s => !ended(s, idx)).length };
}

// 院线片自动下映（与网站 autoEnded 一致）：出现在院线专题里（本籍或 members / sections 挂进来）的影片，上映日期已过、又没有待映场次时视为已下映（等同 ended:true）：
// 录入过的场次已全部放完 → 马上算；一场都没录过 → 上映满 30 天才算。没写具体上映日的不处理；在 app.js 每次换数据时调用，复制影片对象后标记，不改原始数据。
const RUN_DAYS = 30;
function markAutoEnded(data, now = Date.now()) {
  if (!data || !data.films || !data.programmes) return data;
  const cin = data.programmes.filter(p => p.kind === '院线');
  if (!cin.length) return data;
  const inCinema = f => cin.some(p => f.prog === p.id || (p.members || []).includes(f.id) || (p.sections || {})[f.id]);
  const idx = index(data), up = new Set(), seen = new Set();
  data.shows.forEach(s => { if (!idx.F[s.id]) return; seen.add(s.id); if (!ended(s, idx)) up.add(s.id); });
  let hit = false;
  const films = data.films.map(f => {
    if (f.ended || f.ev || up.has(f.id) || !inCinema(f)) return f;
    const m = String(f.releaseZh || f.release || '').match(/(\d{4})年(\d{1,2})月(\d{1,2})日/); if (!m) return f;
    const rel = TZ.zonedMs(+m[1], +m[2], +m[3], 0, 0, TZ.DEFAULT_TZ);
    if (now < rel || (!seen.has(f.id) && now < rel + RUN_DAYS * 864e5)) return f;
    hit = true; return Object.assign({}, f, { ended: true, endedAuto: 1 });
  });
  return hit ? Object.assign({}, data, { films }) : data;
}

// 一场放映的展示用对象
function showView(s, idx, data, picked) {
  const f = idx.F[s.id]; const st = toMin(s.t);
  return {
    key: keyOf(s), y: year(s.d, s.year), d: s.d, t: s.t, end: fmt(st + durationOf(s, idx)), wk: wk(s.d, s.year), id: s.id,
    cn: f.cn, version: I.tr(f.version || ''), dir: f.dir, min: f.min, minTxt: I.tr(f.min ? f.min + ' 分钟' : '片长待定'),
    venue: idx.venueName(s), hall: idx.hallName(s),
    color: (data.reg[f.reg] || {}).c || '#8e2a22',
    tone: filmTone(idx.ORD ? idx.ORD[s.id] : 0), langSub: langSub(f),
    note: I.tr((f.screeningNotes||{})[keyOf(s)]||""), ev: EV_RE.test(I.tr((f.screeningNotes||{})[keyOf(s)]||"")), noteRest: I.tr((f.screeningNotes||{})[keyOf(s)]||"").replace(EV_RE, '').split(/\s*·\s*/).filter(x => !SUB_SEG.test(x)).join(' · '), sub: I.tr((f.screeningNotes||{})[keyOf(s)]||"").replace(EV_RE, '').split(/\s*·\s*/).some(x => SUB_SEG.test(x)), poster: thumb(f), picked: picked ? picked.has(keyOf(s)) : false,
    past: showDate(s, idx).getTime() + durationOf(s, idx) * 60000 < Date.now()
  };
}

// ===== 影院位置与转场估算（与网站共用 shared/planner.js，含映后 30 分钟提醒）=====
const geoOf = Planner.geoOf;
const distKm = Planner.distKm;
function plannerCtx(idx, extra) {
  return Object.assign({
    F: idx.F, VN: idx.VN, PG: idx.PG,
    keyOf,
    durationOf: s => durationOf(s, idx),
    showMs: s => TZ.showMs(s, idx.VN, idx.PG),
    isPast: s => ended(s, idx)
  }, extra || {});
}
function transfer(a, b, idx) {
  return Planner.transfer(a, b, plannerCtx(idx));
}
function openMap(v) {
  const g = geoOf(v); if (!g) return false;
  wx.openLocation({ latitude: g.lat, longitude: g.lng, name: v.name || v.short || '', address: v.addr || '', scale: 17 });
  return true;
}
const EV_RE = /^(映后活动|Post-screening event)\s*·\s*/;
const SUB_SEG = /^(字幕机|Subtitle display)$/; // 场次备注里单独成段的「字幕机」显示成标签（与网站 noteHTML 一致）
// 日历订阅：小程序不能直接打开 webcal。推荐去网页版一键订阅（复制网页地址到手机浏览器打开）；也可复制订阅链接手动添加
const calSub = (id, en, t) => {
  const SITE = 'https://sparrowcinema.org/';
  const sub = SITE + 'cal/' + (en ? 'en/' : '') + id + '.ics', page = SITE + (id === 'all' ? '#programmes' : '#prog-' + id);
  const manual = () => wx.showModal({ title: t('手动添加订阅'), content: t('复制链接后，在手机日历里添加「订阅日历」并粘贴：iPhone 在 设置 › 日历 › 账户 › 添加账户 › 其他 › 添加已订阅的日历；安卓在日历 App 的「添加日历 / 订阅」。订阅后场次有调整会自动同步。'), confirmText: t('复制链接'), cancelText: t('取消'),
    success: r => { if (r.confirm) wx.setClipboardData({ data: sub, success: () => wx.showToast({ title: t('订阅链接已复制'), icon: 'none' }) }); } });
  wx.showActionSheet({ itemList: [t('推荐：网页版一键订阅（复制网址）'), t('手动添加（复制订阅链接）')], success: r => {
    if (r.tapIndex === 1) return manual();
    webTip(id === 'all' ? '#programmes' : '#prog-' + id, CFG.tip('calsub', ['① 用手机浏览器打开这个网址：Safari、谷歌浏览器、安卓自带浏览器都可以一键订阅。', '② 在专题页点「订阅日历」，一键订阅到系统日历，场次有调整会自动更新。']), t);
  } });
};
// 网页版引导：复制网页地址，并说明用 iPhone 自带 Safari 打开、添加到手机桌面后像 App 一样用（一键导入个人排片 / 一键订阅专题日历）
const SITE_URL = 'https://sparrowcinema.org/';
const webTip = (hash, lines, t, title) => {
  wx.setClipboardData({ data: SITE_URL + (hash || ''), success: () => wx.showModal({ title: t(title || '网页版地址已复制'), content: lines.map(x => t(x)).join('\n'), showCancel: false, confirmText: t('知道了') }) });
};
module.exports = { TZ, Planner, plannerCtx, tzOf, progTz, showIso, markAutoEnded, thumb, localFirst, homeCity, ymd: showYmd, geoCity, localProg, webTip, calSub, geoOf, distKm, transfer, openMap, progForShow, durationOf, progInfo, qaOf, ended, isFest, keepPast, relTime, nextShowOf, filmOrder, filmTone, langSub, WK, year, wk, toMin, fmt, keyOf, showDate, poster, ticket, durText, index, showView };
