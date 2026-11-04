const T = require('../../utils/totop.js');
const U = require('../../utils/util.js');
const I = require('../../utils/i18n.js');
const t = I.tr;
const app = getApp();
const SITE = 'https://sparrowcinema.github.io/SparrowTribe/';
// 封面地址：云函数旧版本或英文层可能给出相对路径，统一补成网站绝对地址（本地 / 开头的包内图不动）
const abs = u => !u || /^(https?:|\/)/.test(u) ? u : SITE + u;

// 专题底栏：影展在前，院线与艺术影院在后；有待放映场次的专题排在同类前面
Page({
  onPageScroll(e) { T.scroll(this, e); },
  toTop() { T.go(); },
  data: { live: [], soon: [], past: [], total: 0, pastOpen: false },
  switchLang() { app.switchLang(); },
  onLoad() { this.setData({ i: I.dict(), en: I.isEn() }); this.off = app.onData(() => this.build()); this.build(); },
  onShow() { wx.setNavigationBarTitle({ title: t('专题') }); this.build(); },
  onUnload() { this.off && this.off(); },
  onPullDownRefresh() { app.loadRemote(); setTimeout(() => { this.build(); wx.stopPullDownRefresh(); }, 600); },
  build() {
    const data = app.globalData.data, idx = U.index(data), now = Date.now();
    const list = data.programmes.map((p, i) => {
      const { shows, up, a, b, status } = U.progInfo(p, data, idx, now);
      const fn = data.films.filter(f => !f.ev && idx.progOf(f).id === p.id || (p.sections||{})[f.id]).length;
      return Object.assign({}, p, { cover: abs(p.cover), cardCover: abs(p.cardCover), ord: i, n: shows.length, up, fn, fest: U.isFest(p), status, statusText: t(p.ongoing && status === 'live' ? '常设' : { live: '进行中', soon: '即将开始', ended: '已结束' }[status]), a: a || 0, b: b || 0,
        kt: t(p.kind), pt: t(p.period), stat: p.sub + ' · ' + t(fn + ' 部' + (shows.length ? ' / ' + shows.length + ' 场' : '')), goTxt: up ? t(up + ' 场') + (I.isEn() ? ' upcoming ›' : '待放映 ›') : t('专题') + ' ›' });
    });
    const rank = (x, y) => ((y.up > 0) - (x.up > 0)) || (x.a - y.a) || x.ord - y.ord;
    const live = list.filter(p => p.status === 'live').sort(rank), soon = list.filter(p => p.status === 'soon').sort(rank);
    const past = list.filter(p => p.status === 'ended').sort((x, y) => (y.b - x.b) || x.ord - y.ord);
    this.setData({ live, soon, past, total: list.length, subline: t('影展、院线新片与艺术影院 · ' + (live.length + soon.length) + ' 个进行中或即将开始'), liveH: t('进行中') + ' ', pastN: t(past.length + ' 个已结束') });
  },
  subAll() { U.calSub('all', I.isEn(), t); },
  togglePast() { this.setData({ pastOpen: !this.data.pastOpen }); },
  open(e) { wx.navigateTo({ url: '/pages/programme/programme?id=' + e.currentTarget.dataset.id }); },
  onShareAppMessage() { return { title: t('专题 · 麻雀观影护照'), path: '/pages/programmes/programmes' }; }
});
