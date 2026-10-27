const U = require('../../utils/util.js');
const plan = require('../../utils/plan.js');
const app = getApp();
const RT = [['豆瓣', 10], ['IMDb', 10], ['烂番茄', 100], ['MTC', 100], ['Letterboxd', 5]];

function honor(x) {
  const i = x.indexOf('｜'); const t = i > 0 ? x.slice(0, i) : ''; const rest = i > 0 ? x.slice(i + 1) : x;
  const m = rest.match(/^(\d{4})\s*(.*)$/); const yr = m ? m[1] : ''; const body = m ? m[2] : rest;
  const parts = body.split(' · ');
  const cls = t === '获奖' ? 'win' : t === '提名' ? 'nom' : /评选|入选/.test(t) ? 'list' : 'sel';
  return { t: t || '荣誉', yr, a: parts[0], b: parts.slice(1).join(' · '), cls };
}

Page({
  data: { f: null, open: false },
  onLoad(q) { this.id = q.id; this.off1 = app.onData(() => this.build()); this.off2 = plan.onChange(() => this.build()); this.build(); },
  onUnload() { this.off1 && this.off1(); this.off2 && this.off2(); },
  build() {
    const data = app.globalData.data, idx = U.index(data), f = idx.F[this.id];
    if (!f) { wx.showToast({ title: '没有找到这部影片', icon: 'none' }); return; }
    wx.setNavigationBarTitle({ title: f.cn });
    const picked = plan.get(), p = idx.progOf(f);
    const shows = data.shows.filter(s => s.id === f.id).map(s => {
      const v = U.showView(s, idx, data, picked); const [m, d] = s.d.split('/');
      return Object.assign(v, { m, dd: d });
    });
    const ratings = (f.r || []).map((v, i) => ({
      l: RT[i][0], na: v == null,
      v: v == null ? '—' : i === 2 ? v + '%' : i === 4 ? Number(v).toFixed(1) : i < 2 ? Number(v).toFixed(1) : v,
      pct: v == null ? 0 : Math.min(100, v / RT[i][1] * 100)
    }));
    const credits = [['导演', f.dir], ['联合导演', f.coDirector], [f.writerLabel || '编剧', (f.writers || []).join(' / ')], ['原著', f.book],
      [(f.genre || []).includes('纪录片') ? '出镜' : '主演', (f.cast || []).join(' / ')], ['类型', (f.genre || []).join(' / ')], ['原始语言', f.language]]
      .filter(x => x[1]).map(x => ({ k: x[0], v: x[1] }));
    const all = data.films, i = all.indexOf(f);
    const nav = [all[i - 1], all[i + 1]].map(x => x ? { id: x.id, cn: x.cn, poster: U.poster(x) } : null);
    const para = s => String(s || '').split(/\n{2,}/).filter(Boolean);
    this.setData({
      f: {
        id: f.id, cn: f.cn, en: f.en || f.o, minText: f.min ? f.min + ' 分钟' : '片长待定', release: f.release || '', o: f.o !== f.cn && f.o !== (f.en || f.o) ? f.o : '', y: f.y, c: f.c, min: f.min, lang: f.language,
        version: f.version || '', genre: f.genre || [], dir: f.dir, dirO: f.dirO, dirLife: f.dirLife,
        color: (data.reg[f.reg] || {}).c, reg: (data.reg[f.reg] || {}).n, poster: U.poster(f), ticket: U.ticket(f),
        prog: { id: p.id, name: p.name, kind: p.kind },
        syn: para(f.syn), bio: para(f.bio), st: para(f.st), long: String(f.syn || '').length > 220,
        highlights: (f.highlights || []).map((x, k) => ({ n: String(k + 1).padStart(2, '0'), x })),
        honors: (f.honors || []).map(honor)
      },
      shows, ratings, credits, nav
    });
  },
  toggle(e) { const on = plan.toggle(e.currentTarget.dataset.key); wx.showToast({ title: on ? '已加入排片' : '已移出排片', icon: 'none' }); },
  calendar(e) {
    const data = app.globalData.data, s = data.shows.find(x => U.keyOf(x) === e.currentTarget.dataset.key), idx = U.index(data), f = idx.F[s.id];
    const start = Math.floor(U.showDate(s).getTime() / 1000);
    wx.addPhoneCalendar({
      title: `《${f.cn}》${f.version ? ' · ' + f.version : ''}`, startTime: start, endTime: start + f.min * 60,
      location: idx.venueName(s) + ' · ' + idx.hallName(s), description: '麻雀观影护照', alarm: true, alarmOffset: 3600,
      success: () => wx.showToast({ title: '已加入手机日历', icon: 'none' }),
      fail: (err) => { if (!/cancel/.test(err.errMsg || '')) wx.showToast({ title: '未能加入日历', icon: 'none' }); }
    });
  },
  more() { this.setData({ open: !this.data.open }); },
  openFilm(e) { wx.redirectTo({ url: '/pages/film/film?id=' + e.currentTarget.dataset.id }); },
  openProg() { wx.navigateTo({ url: '/pages/programme/programme?id=' + this.data.f.prog.id }); },
  toSchedule() { wx.switchTab({ url: '/pages/schedule/schedule' }); },
  onShareAppMessage() { const f = this.data.f || {}; return { title: `《${f.cn}》${f.version ? f.version : ''} · 麻雀观影护照`, path: '/pages/film/film?id=' + this.id, imageUrl: f.poster || undefined }; },
  onShareTimeline() { const f = this.data.f || {}; return { title: `《${f.cn}》 · 麻雀观影护照`, query: 'id=' + this.id }; }
});
