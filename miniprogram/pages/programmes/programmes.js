const U = require('../../utils/util.js');
const app = getApp();

// 专题底栏：影展在前，院线与艺术影院在后；有待放映场次的专题排在同类前面
Page({
  data: { live: [], soon: [], past: [], total: 0, pastOpen: false },
  onLoad() { this.off = app.onData(() => this.build()); this.build(); },
  onShow() { this.build(); },
  onUnload() { this.off && this.off(); },
  onPullDownRefresh() { app.loadRemote(); setTimeout(() => { this.build(); wx.stopPullDownRefresh(); }, 600); },
  build() {
    const data = app.globalData.data, idx = U.index(data), now = Date.now();
    const list = data.programmes.map((p, i) => {
      const { shows, up, a, b, status } = U.progInfo(p, data, idx, now);
      const fn = data.films.filter(f => idx.progOf(f).id === p.id).length;
      return Object.assign({}, p, { i, n: shows.length, up, fn, fest: U.isFest(p), status, statusText: { live: '进行中', soon: '即将开始', ended: '已结束' }[status], a: a || 0, b: b || 0 });
    });
    const rank = (x, y) => ((y.up > 0) - (x.up > 0)) || (x.a - y.a) || x.i - y.i;
    const live = list.filter(p => p.status === 'live').sort(rank), soon = list.filter(p => p.status === 'soon').sort(rank);
    const past = list.filter(p => p.status === 'ended').sort((x, y) => (y.b - x.b) || x.i - y.i);
    this.setData({ live, soon, past, total: list.length });
  },
  togglePast() { this.setData({ pastOpen: !this.data.pastOpen }); },
  open(e) { wx.navigateTo({ url: '/pages/programme/programme?id=' + e.currentTarget.dataset.id }); },
  onShareAppMessage() { return { title: '专题 · 麻雀观影护照', path: '/pages/programmes/programmes' }; }
});
