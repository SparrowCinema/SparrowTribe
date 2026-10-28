const U = require('../../utils/util.js');
const app = getApp();

Page({
  data: { filt: 'all', pf: 'all', regs: [], progs: [], list: [] },
  onLoad() { this.off = app.onData(() => this.build()); this.build(); },
  onUnload() { this.off && this.off(); },
  build() {
    const data = app.globalData.data, idx = U.index(data), { filt, pf } = this.data;
    const fest = p => U.isFest(p) ? 0 : 1;
    let lastP = '';
    const list = data.films
      .filter(f => (filt === 'all' || f.reg === filt) && (pf === 'all' || idx.progOf(f).id === pf))
      .sort((a, b) => fest(idx.progOf(a)) - fest(idx.progOf(b)) || data.programmes.indexOf(idx.progOf(a)) - data.programmes.indexOf(idx.progOf(b)) || U.filmOrder(data.shows)(a, b))
      .map(f => {
        const p = idx.progOf(f), nx = U.nextShowOf(f, data.shows);
        const grp = p.id !== lastP ? (U.isFest(p) ? '影展 · ' + p.name : p.name) : ''; lastP = p.id;
        return { id: f.id, cn: f.cn, en: f.en || f.o, dir: f.dir, c: f.c, y: f.y, version: f.version || '', db: f.r && f.r[0] != null ? f.r[0] : '—',
          release: f.release || '', poster: U.poster(f), color: (data.reg[f.reg] || {}).c, grp, next: nx ? nx.d + ' ' + nx.t : '' };
      });
    this.setData({ list, regs: Object.keys(data.reg).map(k => ({ k, n: data.reg[k].n })), progs: data.programmes.length > 1 ? data.programmes : [] });
  },
  setFilt(e) { this.setData({ filt: e.currentTarget.dataset.k }); this.build(); },
  setProg(e) { this.setData({ pf: e.currentTarget.dataset.k }); this.build(); },
  open(e) { wx.navigateTo({ url: '/pages/film/film?id=' + e.currentTarget.dataset.id }); },
  onShareAppMessage() { return { title: '片目 · 麻雀观影护照', path: '/pages/films/films' }; }
});
