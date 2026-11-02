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
    const ymd = v => { const [y, m, d] = String(v).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1).getTime(); };
    const list = data.programmes.map((p, i) => {
      const shows = data.shows.filter(s => idx.F[s.id] && idx.progOf(idx.F[s.id]).id === p.id);
      const up = shows.filter(s => !U.ended(s, idx)).length;
      const fn = data.films.filter(f => idx.progOf(f).id === p.id).length;
      // 专题状态：按起止日期判断；没有日期时按场次范围
      const ts = shows.map(s => U.showDate(s).getTime()), te = shows.map(s => U.showDate(s).getTime() + ((idx.F[s.id] || {}).min || 0) * 60000);
      const a = p.start ? ymd(p.start) : (ts.length ? Math.min(...ts) : null);
      const b = p.end ? ymd(p.end) + 864e5 : (te.length ? Math.max(...te) : null);
      const status = a != null && now < a ? 'soon' : (b != null && now >= b ? 'ended' : 'live');
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
