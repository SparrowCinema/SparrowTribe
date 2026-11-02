const U = require('../../utils/util.js');
const I = require('../../utils/i18n.js');
const t = I.tr;
const app = getApp();

Page({
  data: { filt: 'all', pf: 'all', regs: [], progs: [], list: [] },
  onLoad() { this.setData({ i: I.dict() }); wx.setNavigationBarTitle({ title: t('片目') }); this.off = app.onData(() => this.build()); this.build(); },
  onUnload() { this.off && this.off(); },
  build() {
    const data = app.globalData.data, idx = U.index(data), { filt, pf } = this.data;
    const fest = p => U.isFest(p) ? 0 : 1;
    let lastP = '';
    const list = data.films
      .filter(f => (filt === 'all' || f.reg === filt) && (pf === 'all' || idx.progOf(f).id === pf || ((idx.PG[pf]||{}).sections||{})[f.id]))
      .sort((a, b) => fest(idx.progOf(a)) - fest(idx.progOf(b)) || data.programmes.indexOf(idx.progOf(a)) - data.programmes.indexOf(idx.progOf(b)) || U.filmOrder(data.shows)(a, b))
      .map(f => {
        const p = pf!=='all' ? idx.PG[pf] : idx.progOf(f), nx = U.nextShowOf(f, data.shows);
        const grp = p.id !== lastP ? (U.isFest(p) ? t('影展 · ') + p.name : p.name) : ''; lastP = p.id;
        return { id: f.id, cn: f.cn, en: f.en || f.o, dir: f.dir, c: t(f.c), y: f.y, version: t(f.version || ''), db: f.r && f.r[0] != null ? f.r[0] : '—',
          release: t(f.release || ''), poster: U.poster(f), color: (data.reg[f.reg] || {}).c, grp, grpKind: t(U.isFest(p)?'影展':p.kind||'专题'), grpName:p.name, next: nx ? nx.d + ' ' + nx.t : '' };
      });
    this.setData({ total: t(list.length + ' 部影片'), list, regs: Object.keys(data.reg).map(k => ({ k, n: t(data.reg[k].n) })), progs: data.programmes.length > 1 ? data.programmes : [] });
  },
  setFilt(e) { this.setData({ filt: e.currentTarget.dataset.k }); this.build(); },
  setProg(e) { this.setData({ pf: e.currentTarget.dataset.k }); this.build(); },
  open(e) { wx.navigateTo({ url: '/pages/film/film?id=' + e.currentTarget.dataset.id }); },
  onShareAppMessage() { return { title: t('片目 · 麻雀观影护照'), path: '/pages/films/films' }; }
});
