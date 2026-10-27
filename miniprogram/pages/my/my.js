const U = require('../../utils/util.js');
const plan = require('../../utils/plan.js');
const app = getApp();

Page({
  data: { stats: {}, days: [], clash: 0, empty: true },
  onLoad() { this.off1 = plan.onChange(() => this.build()); this.off2 = app.onData(() => this.build()); },
  onUnload() { this.off1 && this.off1(); this.off2 && this.off2(); },
  onShow() { this.build(); },
  build() {
    const data = app.globalData.data, idx = U.index(data), picked = plan.get();
    const list = data.shows.filter(s => idx.F[s.id] && picked.has(U.keyOf(s))).sort((a, b) => U.showDate(a) - U.showDate(b));
    const minutes = list.reduce((n, s) => n + idx.F[s.id].min, 0);
    let clash = 0;
    const byDay = [];
    list.forEach(s => { let g = byDay.find(x => x.d === s.d); if (!g) { g = { d: s.d, wk: U.wk(s.d), items: [] }; byDay.push(g); } g.items.push(s); });
    const days = byDay.map(g => {
      const items = g.items.map((s, i) => {
        const v = U.showView(s, idx, data, picked);
        if (i) {
          const prev = g.items[i - 1], gap = U.toMin(s.t) - (U.toMin(prev.t) + idx.F[prev.id].min);
          v.gap = gap < 0 ? { cls: 'clash', txt: '⚠ 与上一场重叠 ' + (-gap) + ' 分钟' } : gap < 20 ? { cls: 'tight', txt: '间隔仅 ' + gap + ' 分钟，留意入场时间' } : { cls: 'ok', txt: '间隔 ' + U.durText(gap) };
          if (gap < 0) clash++;
        }
        return v;
      });
      return { d: g.d, wk: g.wk, items, range: g.items[0].t + ' – ' + items[items.length - 1].end };
    });
    this.keys = list.map(U.keyOf);
    this.setData({ days, clash, empty: !list.length, stats: { n: list.length, d: byDay.length, hm: Math.floor(minutes / 60) + 'h' + String(minutes % 60).padStart(2, '0') } });
  },
  remove(e) { plan.remove(e.currentTarget.dataset.key); wx.showToast({ title: '已移出', icon: 'none' }); },
  clear() {
    wx.showModal({ title: '清空个人排片？', content: '会同时清除云端保存的排片。', confirmText: '清空', confirmColor: '#8e2a22',
      success: r => { if (r.confirm) plan.clear(); } });
  },
  open(e) { wx.navigateTo({ url: '/pages/film/film?id=' + e.currentTarget.dataset.id }); },
  toSchedule() { wx.switchTab({ url: '/pages/schedule/schedule' }); },
  onShareAppMessage(res) {
    if (res.from === 'button' && this.keys && this.keys.length) {
      return { title: `我的观影日程 · ${this.keys.length} 场电影`, path: '/pages/share/share?k=' + encodeURIComponent(this.keys.join('~')) };
    }
    return { title: '麻雀映画 & 麻雀部落 · 展映排片表', path: '/pages/schedule/schedule' };
  }
});
