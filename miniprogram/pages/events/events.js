const T = require('../../utils/totop.js');
const U = require('../../utils/util.js');
const I = require('../../utils/i18n.js');
const t = I.tr;
const plan = require('../../utils/plan.js');
const app = getApp();
Page({
  onPageScroll(e) { T.scroll(this, e); },
  toTop() { T.go(); },
  data: { i: {}, p: null, tabs: [], kind: '', groups: [], selOpen: false, selRows: [], selQuery: '', selTitle: '', selPlaceholder: '', kindName: '', kindN: 0 },
  onLoad(q) { this.setData({ i: I.dict() }); this.id = q.id || 'golden-horse-2026'; this.off = app.onData(() => this.build()); this.off2 = plan.onChange(() => this.build()); this.build(); },
  onUnload() { this.off && this.off(); this.off2 && this.off2(); },
  build() {
    const data = app.globalData.data, idx = U.index(data), p = idx.PG[this.id];
    if (!p) return;
    wx.setNavigationBarTitle({ title: t('活动与论坛') });
    const picked = plan.get(), en = I.isEn(), now = new Date(), today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    const evs = p.events || [], kinds = (p.eventKinds || []).filter(k => evs.some(e => e.kind === k.id));
    const kn = k => (en && p.kindEn && p.kindEn[k.id]) || k.name, kind = this.data.kind;
    const groups = kinds.filter(k => !kind || k.id === kind).map(k => ({
      name: kn(k),
      items: evs.filter(e => e.kind === k.id).sort((a, b) => String((a.dates || [])[0] || '9').localeCompare(String((b.dates || [])[0] || '9'))).map(e => {
        const o = (en && p.evEn && p.evEn[e.id]) || {}, last = (e.dates || []).slice().sort().pop();
        const slots = data.shows.filter(s => idx.F[s.id] && idx.F[s.id].evId === e.id && idx.F[s.id].prog === p.id).sort((a, b) => U.showDate(a) - U.showDate(b)).map(s => { const v = U.showView(s, idx, data, picked); return { key: v.key, when: v.d + ' ' + v.wk + ' ' + v.t + '–' + v.end, where: v.venue + ' ' + v.hall, picked: v.picked, past: v.past }; });
        return { id: e.id, slots, title: o.title || e.title, desc: o.desc || e.desc, lines: (o.lines || e.lines).map(l => ({ k: l[0], v: l[1] })), free: !!e.free, ended: !!last && last < today };
      })
    }));
    this.setData({ kindName: kind ? ((kinds.find(k => k.id === kind) && kn(kinds.find(k => k.id === kind))) || t('全部活动')) : t('全部活动'), kindN: kind ? evs.filter(e => e.kind === kind).length : evs.length, p: { name: p.name, period: p.period }, tabs: [{ id: '', name: t('全部活动') }, ...kinds.map(k => ({ id: k.id, name: kn(k) }))], groups });
  },
  toggle(e) { const on = plan.toggle(e.currentTarget.dataset.key); wx.showToast({ title: t(on ? '已加入排片' : '已移出排片'), icon: 'none' }); },
  selRowsFor(q) {
    const data = app.globalData.data, idx = U.index(data), p = idx.PG[this.id], en = I.isEn(), evs = p.events || [], m = (q || '').trim().toLocaleLowerCase();
    const kinds = (p.eventKinds || []).filter(k => evs.some(e => e.kind === k.id)), kn = k => (en && p.kindEn && p.kindEn[k.id]) || k.name, cur = this.data.kind;
    const rows = [{ id: '', name: t('全部活动'), sub: t(evs.length + ' 项'), selected: cur === '' }, ...kinds.map(k => ({ id: k.id, name: kn(k), sub: t(evs.filter(e => e.kind === k.id).length + ' 项'), selected: cur === k.id }))];
    return rows.filter(x => !m || (x.name + ' ' + x.sub).toLocaleLowerCase().includes(m));
  },
  openSel() { this.setData({ selOpen: true, selQuery: '', selTitle: t('选择板块'), selPlaceholder: t('搜索板块'), selRows: this.selRowsFor('') }); },
  searchSel(e) { this.setData({ selQuery: e.detail.value, selRows: this.selRowsFor(e.detail.value) }); },
  chooseSel(e) { this.setData({ kind: e.currentTarget.dataset.id || '', selOpen: false }); this.build(); wx.pageScrollTo({ scrollTop: 0, duration: 150 }); },
  closeSel() { this.setData({ selOpen: false, selQuery: '' }); },
  stopMove() {},
  selectKind(e) { this.setData({ kind: e.currentTarget.dataset.id }); this.build(); wx.pageScrollTo({ scrollTop: 0, duration: 150 }); }
});
