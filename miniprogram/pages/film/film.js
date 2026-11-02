const U = require('../../utils/util.js');
const plan = require('../../utils/plan.js');
const W = require('../../utils/watched.js');
const I = require('../../utils/i18n.js');
const t = I.tr;
const app = getApp();
const RT = [['豆瓣', 10], ['IMDb', 10], ['烂番茄', 100], ['MTC', 100], ['Letterboxd', 5]];

function honor(x) {
  const i = x.indexOf('｜'); const t = i > 0 ? x.slice(0, i) : ''; const rest = i > 0 ? x.slice(i + 1) : x;
  const m = rest.match(/^(\d{4})\s*(.*)$/); const yr = m ? m[1] : ''; const body = m ? m[2] : rest;
  const parts = body.split(' · ');
  const cls = t === '获奖' ? 'win' : t === '提名' ? 'nom' : /评选|入选/.test(t) ? 'list' : 'sel';
  return { t: I.tr(t || '荣誉'), yr, a: parts[0], b: parts.slice(1).join(' · '), cls };
}

Page({
  data: { i: {}, f: null, open: false },
  onLoad(q) { this.setData({ i: I.dict() }); this.id = q.id; this.off1 = app.onData(() => this.build()); this.off2 = plan.onChange(() => this.build()); this.off3 = W.onChange(() => this.buildMine()); this.build(); },
  onUnload() { this.off1 && this.off1(); this.off2 && this.off2(); this.off3 && this.off3(); },
  build() {
    const data = app.globalData.data, idx = U.index(data), f = idx.F[this.id];
    if (!f) { wx.showToast({ title: t('没有找到这部影片'), icon: 'none' }); return; }
    wx.setNavigationBarTitle({ title: f.cn });
    const picked = plan.get(), p = idx.progOf(f);
    const allShows = data.shows.filter(s => s.id === f.id);
    const shows = allShows.filter(s => !U.ended(s, idx)).map(s => {
      const v = U.showView(s, idx, data, picked); const [m, d] = s.d.split('/');
      return Object.assign(v, { m, dd: d, mon: t(m + '月'), vid: s.v, geo: !!U.geoOf(idx.VN[s.v]) });
    });
    const ratings = (f.r || []).map((v, i) => ({
      l: t(RT[i][0]), na: v == null,
      v: v == null ? '—' : i === 2 ? v + '%' : i === 4 ? Number(v).toFixed(1) : i < 2 ? Number(v).toFixed(1) : v,
      pct: v == null ? 0 : Math.min(100, v / RT[i][1] * 100)
    }));
    const credits = [['导演', f.dir], ['联合导演', f.coDirector], [f.writerLabel || '编剧', (f.writers || []).join(' / ')], ['原著', t(f.book || '')],
      [(f.genre || []).includes('纪录片') ? '出镜' : '主演', (f.cast || []).join(' / ')], ['类型', (f.genre || []).map(t).join(' / ')], ['原始语言', t(f.language)]]
      .filter(x => x[1]).map(x => ({ k: t(x[0]), v: x[1] }));
    const all = data.films, i = all.indexOf(f);
    const nav = [all[i - 1], all[i + 1]].map(x => x ? { id: x.id, cn: x.cn, poster: U.poster(x) } : null);
    const para = s => String(s || '').split(/\n{2,}/).filter(Boolean);
    this.setData({
      f: {
        id: f.id, cn: f.cn, en: f.en || f.o, minText: t(f.min ? f.min + ' 分钟' : '片长待定'), release: t(f.release || ''), o: f.o !== f.cn && f.o !== (f.en || f.o) ? f.o : '', y: f.y, c: t(f.c), min: f.min, lang: t(f.language),
        version: t(f.version || ''), genre: (f.genre || []).map(t), dir: f.dir, dirO: f.dirO, dirLife: f.dirLife,
        color: (data.reg[f.reg] || {}).c, reg: t((data.reg[f.reg] || {}).n || ''), poster: U.poster(f), ticket: U.ticket(f), ticketHint: t([f.ticketPlatform ? f.ticketPlatform + "扫码" + (f.ticketLabel || "购票") : "", (f.ticketHint || "").replace(/^淘票票扫码购票\s*[·・]?\s*/, "")].filter(Boolean).join(" · ")), section: t(f.section || ""), ticketLabel: t(f.ticketLabel || '购票'),
        prog: { id: p.id, name: p.name, kind: t(p.kind) },
        syn: para(f.syn), bio: para(f.bio), st: para(f.st), long: String(f.syn || '').length > 220,
        ini: (f.dir || '').charAt(0), highlights: (f.highlights || []).map((x, k) => ({ n: String(k + 1).padStart(2, '0'), x })),
        honors: (f.honors || []).map(honor),
        gifts: (f.gifts || []).map((g, k) => ({ k, label: t(g.label || ''), items: (g.items || []).map(t) }))
      },
      qa: (q => q ? { label: f.qaStart + ' – ' + f.qaEnd, guest: t(f.qaGuest) } : null)(U.qaOf(f)),
      cnt: t(shows.length + ' 场'),
      shows, ratings, credits, nav, ended: allShows.length > 0 && !shows.length
    });
    this.buildMine();
  },
  // 我的观影：看过 + 五星十分制评分（每颗星 2 分，可半颗）
  buildMine() {
    const data = app.globalData.data, idx = U.index(data), rec = W.get(this.id), r = rec ? rec.r || 0 : 0, s = rec ? W.showOf(rec, data) : null;
    this.setData({ mine: { seen: !!rec, r, d: rec ? rec.d : '', today: W.iso(new Date()), stars: [1, 2, 3, 4, 5].map(i => Math.max(0, Math.min(2, r - (i - 1) * 2)) * 50),
      at: s ? W.vShort(idx.VN[s.v]) + ' · ' + s.t : t('未关联场次'), seenTxt: t(rec ? '已看过 · 已盖章' : '＋ 看过'), scoreTxt: r ? r + '/10' : t('点星打分') } });
  },
  toggleSeen() {
    if (W.get(this.id)) {
      wx.showModal({ title: t('移出观影护照？'), content: t('这部电影的印章和评分会一起删除。'), confirmText: t('移出'), confirmColor: '#8e2a22', success: r => { if (r.confirm) { W.remove(this.id); wx.showToast({ title: t('已移出观影护照'), icon: 'none' }); } } });
    } else { const data = app.globalData.data; W.set(this.id, W.guess(this.id, data, U.index(data), plan.get())); wx.showToast({ title: t('已盖章 · 加入观影护照'), icon: 'none' }); }
  },
  rate(e) {
    const v = +e.currentTarget.dataset.v, data = app.globalData.data, old = W.get(this.id), rec = old || W.guess(this.id, data, U.index(data), plan.get());
    W.set(this.id, Object.assign({}, rec, { r: rec.r === v ? 0 : v }));
    if (!old) wx.showToast({ title: t('已盖章 · 加入观影护照'), icon: 'none' });
  },
  setSeenDate(e) {
    const d = e.detail.value, rec = W.get(this.id); if (!rec || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
    const data = app.globalData.data, idx = U.index(data), s = data.shows.find(x => x.id === this.id && W.iso(U.showDate(x)) === d && U.ended(x, idx));
    W.set(this.id, Object.assign({}, rec, { d, k: s ? U.keyOf(s) : '' })); wx.showToast({ title: t('观影日期已更新'), icon: 'none' });
  },
  toMy() { wx.switchTab({ url: '/pages/my/my' }); },
  openMap(e) { const v = app.globalData.data.venues.find(x => x.id === e.currentTarget.dataset.v); if (v) U.openMap(v); },
  toggle(e) { const on = plan.toggle(e.currentTarget.dataset.key); wx.showToast({ title: t(on ? '已加入排片' : '已移出排片'), icon: 'none' }); },
  calendar(e) {
    const data = app.globalData.data, s = data.shows.find(x => U.keyOf(x) === e.currentTarget.dataset.key), idx = U.index(data), f = idx.F[s.id];
    const start = Math.floor(U.showDate(s).getTime() / 1000);
    wx.addPhoneCalendar({
      title: I.isEn() ? f.cn + (f.version ? ' · ' + t(f.version) : '') : `《${f.cn}》${f.version ? ' · ' + f.version : ''}`, startTime: start, endTime: start + U.durationOf(s, idx) * 60,
      location: idx.venueName(s) + ' · ' + idx.hallName(s), description: t('麻雀观影护照'), alarm: true, alarmOffset: 3600,
      success: () => wx.showToast({ title: t('已加入手机日历'), icon: 'none' }),
      fail: (err) => { if (!/cancel/.test(err.errMsg || '')) wx.showToast({ title: t('未能加入日历'), icon: 'none' }); }
    });
  },
  previewTicket() { const u = this.data.f && this.data.f.ticket; if (u) wx.previewImage({ urls: [u], current: u }); },
  more() { this.setData({ open: !this.data.open }); },
  openFilm(e) { wx.redirectTo({ url: '/pages/film/film?id=' + e.currentTarget.dataset.id }); },
  openProg() { wx.navigateTo({ url: '/pages/programme/programme?id=' + this.data.f.prog.id }); },
  toSchedule() { wx.switchTab({ url: '/pages/schedule/schedule' }); },
  seeDay(e) { app.globalData.jumpDay = e.currentTarget.dataset.d; wx.switchTab({ url: '/pages/schedule/schedule' }); },
  onShareAppMessage() { const f = this.data.f || {}; return { title: (I.isEn() ? f.cn + (f.version ? ' ' + f.version : '') : `《${f.cn}》${f.version ? f.version : ''}`) + ' · ' + t('麻雀观影护照'), path: '/pages/film/film?id=' + this.id, imageUrl: f.poster || undefined }; },
  onShareTimeline() { const f = this.data.f || {}; return { title: (I.isEn() ? f.cn : `《${f.cn}》`) + ' · ' + t('麻雀观影护照'), query: 'id=' + this.id }; }
});
