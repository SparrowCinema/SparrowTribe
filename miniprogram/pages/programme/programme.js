const U = require('../../utils/util.js');
const app = getApp();
Page({
  data: { p: null, films: [], stats: {} },
  onLoad(q) { this.id = q.id || 'style-kaleidoscope'; this.off = app.onData(() => this.build()); this.build(); },
  onUnload() { this.off && this.off(); },
  build() {
    const data = app.globalData.data, idx = U.index(data), p = idx.PG[this.id];
    if (!p) return;
    wx.setNavigationBarTitle({ title: p.name });
    const shows = data.shows.filter(s => idx.F[s.id] && idx.progOf(idx.F[s.id]).id === p.id);
    const films = data.films.filter(f => idx.progOf(f).id === p.id).sort(U.filmOrder(shows)).map(f => {
      const first = U.nextShowOf(f, shows) || shows.find(s => s.id === f.id);
      return { id: f.id, cn: f.cn, version: f.version || '', poster: U.poster(f), color: (data.reg[f.reg] || {}).c, first: first ? first.d + ' ' + first.t : '' };
    });
    this.setData({ p, films, stats: { f: films.length, s: shows.length, d: new Set(shows.map(s => s.d)).size, h: new Set(shows.map(s => s.v + s.h)).size } });
  },
  open(e) { wx.navigateTo({ url: '/pages/film/film?id=' + e.currentTarget.dataset.id }); },
  toSchedule() { wx.switchTab({ url: '/pages/schedule/schedule' }); },
  onShareAppMessage() { const p = this.data.p || {}; return { title: `${p.name} · ${p.sub}`, path: '/pages/programme/programme?id=' + this.id }; }
});
