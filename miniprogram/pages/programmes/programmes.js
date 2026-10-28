const U = require('../../utils/util.js');
const app = getApp();

// 专题底栏：影展在前，院线与艺术影院在后；有待放映场次的专题排在同类前面
Page({
  data: { list: [] },
  onLoad() { this.off = app.onData(() => this.build()); this.build(); },
  onShow() { this.build(); },
  onUnload() { this.off && this.off(); },
  onPullDownRefresh() { app.loadRemote(); setTimeout(() => { this.build(); wx.stopPullDownRefresh(); }, 600); },
  build() {
    const data = app.globalData.data, idx = U.index(data), now = Date.now();
    const list = data.programmes.map((p, i) => {
      const shows = data.shows.filter(s => idx.F[s.id] && idx.progOf(idx.F[s.id]).id === p.id);
      const up = shows.filter(s => U.showDate(s).getTime() > now).length;
      const fn = data.films.filter(f => idx.progOf(f).id === p.id).length;
      return Object.assign({}, p, { i, n: shows.length, up, fn, fest: U.isFest(p) });
    }).sort((a, b) => (b.fest - a.fest) || ((b.up > 0) - (a.up > 0)) || a.i - b.i);
    this.setData({ list });
  },
  open(e) { wx.navigateTo({ url: '/pages/programme/programme?id=' + e.currentTarget.dataset.id }); },
  onShareAppMessage() { return { title: '专题 · 麻雀观影护照', path: '/pages/programmes/programmes' }; }
});
