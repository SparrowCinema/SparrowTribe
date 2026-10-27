const U = require('../../utils/util.js');
const app = getApp();

Page({
  data: { filt: 'all', pf: 'all', regs: [], progs: [], list: [] },
  onLoad() { this.off = app.onData(() => this.build()); this.build(); },
  onUnload() { this.off && this.off(); },
  build() {
    const data = app.globalData.data, idx = U.index(data), { filt, pf } = this.data;
    const list = data.films
      .filter(f => (filt === 'all' || f.reg === filt) && (pf === 'all' || idx.progOf(f).id === pf))
      .map(f => {
        const first = data.shows.find(s => s.id === f.id);
        return { id: f.id, cn: f.cn, en: f.en || f.o, dir: f.dir, c: f.c, y: f.y, version: f.version || '', db: f.r && f.r[0] != null ? f.r[0] : '—',
          poster: U.poster(f), color: (data.reg[f.reg] || {}).c, first: first ? first.d + ' ' + first.t : '' };
      });
    this.setData({ list, regs: Object.keys(data.reg).map(k => ({ k, n: data.reg[k].n })), progs: data.programmes.length > 1 ? data.programmes : [] });
  },
  setFilt(e) { this.setData({ filt: e.currentTarget.dataset.k }); this.build(); },
  setProg(e) { this.setData({ pf: e.currentTarget.dataset.k }); this.build(); },
  open(e) { wx.navigateTo({ url: '/pages/film/film?id=' + e.currentTarget.dataset.id }); },
  onShareAppMessage() { return { title: '片目 · 麻雀观影护照', path: '/pages/films/films' }; }
});
