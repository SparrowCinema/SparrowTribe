const U = require('../../utils/util.js');
const plan = require('../../utils/plan.js');
const app = getApp();
const START = U.toMin('12:00'), END = U.toMin('22:30'), K = 2; // 每分钟 2rpx

Page({
  data: { pf: 'all', rows: [], days: [], progs: [], ruler: [], width: 0, legend: [], span: '', count: 0 },

  onLoad() {
    this.off1 = app.onData(() => this.build());
    this.off2 = plan.onChange(() => this.build());
    this.build();
  },
  onUnload() { this.off1 && this.off1(); this.off2 && this.off2(); },
  onShow() { this.build(); },
  onPullDownRefresh() { app.loadRemote(); setTimeout(() => { this.build(); wx.stopPullDownRefresh(); }, 600); },

  build() {
    const data = app.globalData.data, idx = U.index(data), picked = plan.get();
    const pf = this.data.pf;
    const list = data.shows.filter(s => idx.F[s.id] && (pf === 'all' || idx.progOf(idx.F[s.id]).id === pf));
    const days = [...new Set(list.map(s => s.d))];
    const halls = [];
    data.venues.forEach(v => v.halls.forEach(h => halls.push({ v: v.id, h: h.id })));
    const multi = new Set(list.map(s => s.v + '/' + s.h)).size > 1;
    const rows = [];
    days.forEach(d => halls.forEach(hh => {
      const hs = list.filter(s => s.d === d && s.v === hh.v && s.h === hh.h);
      if (!hs.length) return;
      rows.push({
        d, wk: U.wk(d), place: multi ? idx.venueName(hs[0]).replace('影城', '') + ' ' + idx.hallName(hs[0]) : '',
        blocks: hs.map(s => {
          const v = U.showView(s, idx, data, picked), st = U.toMin(s.t);
          return Object.assign(v, { left: (st - START) * K, w: v.min * K });
        })
      });
    }));
    const ruler = [];
    for (let m = START + 60; m <= END; m += 60) ruler.push({ x: (m - START) * K, t: U.fmt(m) });
    const agenda = days.map(d => ({ d, wk: U.wk(d), items: list.filter(s => s.d === d).map(s => U.showView(s, idx, data, picked)) }));
    const progs = data.programmes.map(p => {
      const ps = data.shows.filter(s => idx.F[s.id] && idx.progOf(idx.F[s.id]).id === p.id);
      return Object.assign({}, p, { n: ps.length, fn: new Set(ps.map(s => s.id)).size });
    });
    this.setData({
      rows, agenda, ruler, progs, width: (END - START) * K,
      legend: Object.keys(data.reg).map(k => data.reg[k]),
      span: days.length ? days[0] + ' – ' + days[days.length - 1] : '', count: list.length
    });
  },

  setProg(e) { this.setData({ pf: e.currentTarget.dataset.id }); this.build(); },
  openFilm(e) { wx.navigateTo({ url: '/pages/film/film?id=' + e.currentTarget.dataset.id }); },
  openProg(e) { wx.navigateTo({ url: '/pages/programme/programme?id=' + e.currentTarget.dataset.id }); },
  toggle(e) {
    const on = plan.toggle(e.currentTarget.dataset.key);
    wx.showToast({ title: on ? '已加入排片' : '已移出排片', icon: 'none' });
  },
  onShareAppMessage() { return { title: '麻雀观影护照 · 影展排片与观影日程', path: '/pages/schedule/schedule' }; },
  onShareTimeline() { return { title: '麻雀观影护照 · 影展排片与观影日程' }; }
});
