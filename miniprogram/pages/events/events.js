const U = require('../../utils/util.js');
const I = require('../../utils/i18n.js');
const t = I.tr;
const app = getApp();
Page({
  data: { i: {}, p: null, tabs: [], kind: '', groups: [] },
  onLoad(q) { this.setData({ i: I.dict() }); this.id = q.id || 'golden-horse-2026'; this.off = app.onData(() => this.build()); this.build(); },
  onUnload() { this.off && this.off(); },
  build() {
    const idx = U.index(app.globalData.data), p = idx.PG[this.id];
    if (!p) return;
    wx.setNavigationBarTitle({ title: t('活动与论坛') });
    const en = I.isEn(), now = new Date(), today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    const evs = p.events || [], kinds = (p.eventKinds || []).filter(k => evs.some(e => e.kind === k.id));
    const kn = k => (en && p.kindEn && p.kindEn[k.id]) || k.name, kind = this.data.kind;
    const groups = kinds.filter(k => !kind || k.id === kind).map(k => ({
      name: kn(k),
      items: evs.filter(e => e.kind === k.id).sort((a, b) => String((a.dates || [])[0] || '9').localeCompare(String((b.dates || [])[0] || '9'))).map(e => {
        const o = (en && p.evEn && p.evEn[e.id]) || {}, last = (e.dates || []).slice().sort().pop();
        return { id: e.id, title: o.title || e.title, desc: o.desc || e.desc, lines: (o.lines || e.lines).map(l => ({ k: l[0], v: l[1] })), free: !!e.free, ended: !!last && last < today };
      })
    }));
    this.setData({ p: { name: p.name, period: p.period }, tabs: [{ id: '', name: t('全部活动') }, ...kinds.map(k => ({ id: k.id, name: kn(k) }))], groups });
  },
  selectKind(e) { this.setData({ kind: e.currentTarget.dataset.id }); this.build(); wx.pageScrollTo({ scrollTop: 0, duration: 150 }); }
});
