const I = require('./i18n.js');
const WK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const year = d => (+d.split('/')[0] >= 10 ? 2026 : 2027);
const wk = d => { const [m, dd] = d.split('/').map(Number); return I.tr(WK[new Date(year(d), m - 1, dd).getDay()]); };
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const fmt = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const keyOf = s => `${s.d}-${s.t}-${s.v}-${s.h}`;
const showDate = s => { const [m, d] = s.d.split('/').map(Number); const [h, mi] = s.t.split(':').map(Number); return new Date(year(s.d), m - 1, d, h, mi); };
const poster = f => f.posterUrl || ''; // 海报全部读网站，换图自动同步
const ticket = f => f.ticketUrl || ''; // 购票码走网站在线图（离线时不显示），不再打进小程序包
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
const langSub = f => I.tr(f.langTag || [f.language, f.subtitles].filter(Boolean).join(' ｜ '));

function index(data) {
  const F = {}; const ORD = {}; data.films.forEach((f, i) => { F[f.id] = f; ORD[f.id] = i; });
  Object.entries(data.aliases || {}).forEach(([o, n]) => { if (F[n] && !F[o]) F[o] = F[n]; }); // 旧影片 id → 合并后的影片
  // 杭州影院固定排最前（甘特图列与影院/城市选择器），其余按原顺序
  const vrank = new Map(data.venues.map((v, i) => [v.id, (v.city === '杭州' ? 0 : 1000) + i]));
  data.venues.sort((a, b) => vrank.get(a.id) - vrank.get(b.id));
  const VN = {}; data.venues.forEach(v => { VN[v.id] = v; });
  const PG = {}; data.programmes.forEach(p => { PG[p.id] = p; });
  const hallName = s => { const v = VN[s.v]; const h = v && v.halls.find(x => x.id === s.h); return h ? h.name : s.h; };
  const venueName = s => { const v=VN[s.v]; if(!v)return s.v; const c=I.tr(v.city||""),name=v.name.replace(new RegExp("^("+[v.city,c].filter(Boolean).join("|")+")\\s*[·・]?\\s*"),""); return (c?c+" · ":"")+name; };
  const progOf = f => PG[f.prog || 'style-kaleidoscope'] || data.programmes[0];
  const progsOf = f => { const main = progOf(f), out = [{ p: main, sec: f.section || (main.sections || {})[f.id] || '' }]; data.programmes.forEach(p => { if (p.id !== main.id && (p.sections || {})[f.id]) out.push({ p, sec: p.sections[f.id] }); }); return out; };
  return { F, ORD, VN, PG, hallName, venueName, progOf, progsOf };
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
    note: I.tr((f.screeningNotes||{})[keyOf(s)]||""), ev: EV_RE.test(I.tr((f.screeningNotes||{})[keyOf(s)]||"")), noteRest: I.tr((f.screeningNotes||{})[keyOf(s)]||"").replace(EV_RE, ''), poster: poster(f), picked: picked ? picked.has(keyOf(s)) : false,
    past: showDate(s).getTime() + durationOf(s, idx) * 60000 < Date.now()
  };
}

// ===== 影院位置与转场估算 =====
// 影院坐标写在 data/catalog.json 的 venues[].geo = [纬度, 经度]（GCJ-02，腾讯地图/高德坐标），addr 为地址。
// 有坐标：小程序显示「地图」按钮；相邻两场都有坐标时按直线距离估算地铁 / 打车用时；没有坐标时按通用经验值提示。
const geoOf = v => (v && Array.isArray(v.geo) && v.geo.length === 2 && isFinite(+v.geo[0]) && isFinite(+v.geo[1])) ? { lat: +v.geo[0], lng: +v.geo[1] } : null;
function distKm(a, b) {
  const R = 6371, r = x => x * Math.PI / 180, dLa = r(b.lat - a.lat), dLo = r(b.lng - a.lng);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
// 相邻两场（同一天）的转场：同影院约 10 分钟（取票、找厅）；跨影院 = 估算出行时间 + 10 分钟；跨城市无法衔接
function transfer(a, b, idx) {
  const gap = toMin(b.t) - (toMin(a.t) + durationOf(a, idx));
  if (a.v === b.v) return { kind: 'same', gap, need: 10 };
  const va = idx.VN[a.v], vb = idx.VN[b.v];
  if (va && vb && va.city && vb.city && va.city !== vb.city) return { kind: 'city', gap, need: 9999 };
  const ga = geoOf(va), gb = geoOf(vb);
  if (ga && gb) {
    const road = distKm(ga, gb) * 1.35, taxi = Math.max(8, Math.round(6 + road / 25 * 60)), metro = Math.max(15, Math.round(12 + road / 32 * 60));
    return { kind: 'cross', gap, need: Math.min(taxi, metro) + 10, km: Math.round(road * 10) / 10, taxi, metro };
  }
  return { kind: 'cross', gap, need: 45 };
}
function openMap(v) {
  const g = geoOf(v); if (!g) return false;
  wx.openLocation({ latitude: g.lat, longitude: g.lng, name: v.name || v.short || '', address: v.addr || '', scale: 17 });
  return true;
}
const EV_RE = /^(映后活动|Post-screening event)\s*·\s*/;
// 日历订阅：小程序不能直接打开 webcal。推荐去网页版一键订阅（复制网页地址到手机浏览器打开）；也可复制订阅链接手动添加
const calSub = (id, en, t) => {
  const SITE = 'https://sparrowcinema.github.io/SparrowTribe/';
  const sub = SITE + 'cal/' + (en ? 'en/' : '') + id + '.ics', page = SITE + (id === 'all' ? '#programmes' : '#prog-' + id);
  const manual = () => wx.showModal({ title: t('手动添加订阅'), content: t('复制链接后，在手机日历里添加「订阅日历」并粘贴：iPhone 在 设置 › 日历 › 账户 › 添加账户 › 其他 › 添加已订阅的日历；安卓在日历 App 的「添加日历 / 订阅」。订阅后场次有调整会自动同步。'), confirmText: t('复制链接'), cancelText: t('取消'),
    success: r => { if (r.confirm) wx.setClipboardData({ data: sub, success: () => wx.showToast({ title: t('订阅链接已复制'), icon: 'none' }) }); } });
  wx.showActionSheet({ itemList: [t('推荐：网页版一键订阅（复制网址）'), t('手动添加（复制订阅链接）')], success: r => {
    if (r.tapIndex === 1) return manual();
    webTip(id === 'all' ? '#programmes' : '#prog-' + id, ['① 用手机浏览器打开这个网址：Safari、谷歌浏览器、安卓自带浏览器都可以一键订阅。', '② 在专题页点「订阅日历」，一键订阅到系统日历，场次有调整会自动更新。', '③ 建议先添加到手机桌面（iPhone 点「分享」→「添加到主屏幕」），以后像 App 一样直接打开。'], t);
  } });
};
// 网页版引导：复制网页地址，并说明用 iPhone 自带 Safari 打开、添加到手机桌面后像 App 一样用（一键导入个人排片 / 一键订阅专题日历）
const SITE_URL = 'https://sparrowcinema.github.io/SparrowTribe/';
const webTip = (hash, lines, t, title) => {
  wx.setClipboardData({ data: SITE_URL + (hash || ''), success: () => wx.showModal({ title: t(title || '网页版地址已复制'), content: lines.map(x => t(x)).join('\n'), showCancel: false, confirmText: t('知道了') }) });
};
module.exports = { webTip, calSub, geoOf, distKm, transfer, openMap, progForShow, durationOf, progInfo, qaOf, ended, isFest, relTime, nextShowOf, filmOrder, filmTone, langSub, WK, year, wk, toMin, fmt, keyOf, showDate, poster, ticket, durText, index, showView };
