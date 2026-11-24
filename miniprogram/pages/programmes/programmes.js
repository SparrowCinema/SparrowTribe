const T = require('../../utils/totop.js');
const U = require('../../utils/util.js');
const I = require('../../utils/i18n.js');
const Library = require('../../utils/library.js');
const Stats = require('../../utils/stats.js');
const t = I.tr;
const app = getApp();
const SITE = 'https://sparrowcinema.org/';
// 封面地址：云函数旧版本或英文层可能给出相对路径，统一补成网站绝对地址（本地 / 开头的包内图不动）
const abs = u => !u || /^(https?:|\/)/.test(u) ? u : SITE + u;

// 专题底栏：影展在前，院线与艺术影院在后；有待放映场次的专题排在同类前面
Page({
  onPageScroll(e) { T.scroll(this, e); },
  toTop() { T.go(); },
  data: { live: [], soon: [], past: [], pastYears: [], pastYearPills: [], pastMinis: [], pastByYear: false, pastYearFilt: '', total: 0, pastOpen: false },
  switchLang() { app.switchLang(); },
  onLoad() { this.setData({ i: I.dict(), en: I.isEn() }); this.off = app.onData(() => this.build()); this.build(); },
  onShow() { Stats.stat('pv', 'programmes'); wx.setNavigationBarTitle({ title: t('专题') }); this.build(); },
  onUnload() { this.off && this.off(); },
  onPullDownRefresh() { app.loadRemote(); setTimeout(() => { this.build(); wx.stopPullDownRefresh(); }, 600); },
  build() {
    const data = app.globalData.data, idx = U.index(data), now = Date.now();
    const list = data.programmes.map((p, i) => {
      const { shows, up, a, b, status } = U.progInfo(p, data, idx, now);
      const pFilms = data.films.filter(f => !f.ev && idx.progOf(f).id === p.id || (p.sections||{})[f.id] || (p.members||[]).includes(f.id));
      const fn = pFilms.length;
      const st = Library.spineStyle ? Library.spineStyle(p.id) : { bg: '#663c58', ink: '#fffaf2' };
      const yr = Library.progEndYear ? Library.progEndYear(p, b || 0) : '其他';
      const mDate = /^(\d{4})-(\d{2})/.exec(String(p.end || p.start || ''));
      const meta = mDate ? (mDate[1] + '.' + mDate[2]) : (yr !== '其他' ? yr : t(p.kind));
      const f0 = pFilms.find(f => U.thumb(f));
      const art = abs(p.cardCover || p.cover) || (f0 ? U.thumb(f0) : '');
      return Object.assign({}, p, { cover: abs(p.cover), cardCover: abs(p.cardCover), ord: i, n: shows.length, up, fn, fest: U.isFest(p), status, loc: U.localProg(p, data, idx, status), statusText: t(p.ongoing && status === 'live' ? '常设' : { live: '进行中', soon: '即将开始', ended: '已结束' }[status]), a: a || 0, b: b || 0,
        kt: t(p.kind), pt: t(p.period), stat: p.sub + ' · ' + t(fn + ' 部' + (shows.length ? ' / ' + shows.length + ' 场' : '')), goTxt: up ? t(up + ' 场') + (I.isEn() ? ' upcoming ›' : '待放映 ›') : t('专题') + ' ›',
        spineName: Library.spineTitle ? Library.spineTitle(p.name) : p.name, year: yr, meta, subCnt: t(fn + ' 部'), bg: st.bg, ink: st.ink, art, ch: (p.name || '')[0] || '' });
    });
    const rank = (x, y) => (y.loc - x.loc) || ((y.up > 0) - (x.up > 0)) || (x.a - y.a) || x.ord - y.ord;
    const live = list.filter(p => p.status === 'live').sort(rank), soon = list.filter(p => p.status === 'soon').sort(rank);
    const past = list.filter(p => p.status === 'ended').sort((x, y) => (y.b - x.b) || x.ord - y.ord);
    const pastMinis = past.slice(0, 5).map(x => ({ id: x.id, bg: x.bg }));
    const grouped = Library.groupPastByYear ? Library.groupPastByYear(past, x => x.year) : { byYear: false, years: [{ year: 'all', items: past }], batchSize: 12 };
    const pastYearPills = grouped.years.length >= 2 ? grouped.years.map(g => ({ year: g.year, label: g.year === '其他' ? t('其他') : g.year, cnt: g.items.length })) : [];
    const curYearFilt = this.pastYearFilt && grouped.years.some(g => g.year === this.pastYearFilt) ? this.pastYearFilt : '';
    const visYears = curYearFilt ? grouped.years.filter(g => g.year === curYearFilt) : grouped.years;
    const yrFolds = this.pastYearFold || {}, yrLimits = this.pastYearLimit || {};
    const pastYears = this.data.pastOpen ? visYears.map((g, i) => {
      const open = !grouped.byYear || !!curYearFilt || (yrFolds[g.year] != null ? yrFolds[g.year] === 1 : i === 0);
      const lim = yrLimits[g.year] || grouped.batchSize;
      const items = open ? g.items.slice(0, lim) : [];
      return { year: g.year, label: g.year === '其他' ? t('其他') : (I.isEn() ? g.year : g.year + ' 年'), meta: t(g.items.length + ' 个专题'), open, items, rest: Math.max(0, g.items.length - items.length) };
    }) : [];
    this.setData({ live, soon, past, pastMinis, pastByYear: grouped.byYear, pastYears, pastYearPills, pastYearFilt: curYearFilt, total: list.length, subline: t('影展、院线新片与艺术影院 · ' + (live.length + soon.length) + ' 个进行中或即将开始'), liveH: t('进行中') + ' ', pastN: t(past.length + ' 个已结束') + ' · ' + t('按书脊横向浏览') });
  },
  subAll() { U.calSub('all', I.isEn(), t); },
  togglePast() { this.setData({ pastOpen: !this.data.pastOpen }); this.build(); },
  togglePastYear(e) { const yr = e.currentTarget.dataset.year; this.pastYearFold = this.pastYearFold || {}; const g = (this.data.pastYears || []).find(x => x.year === yr); this.pastYearFold[yr] = g && g.open ? 0 : 1; this.build(); },
  setPastYear(e) { this.pastYearFilt = e.currentTarget.dataset.year || ''; this.build(); },
  morePastYear(e) { const yr = e.currentTarget.dataset.year; this.pastYearLimit = this.pastYearLimit || {}; this.pastYearLimit[yr] = (this.pastYearLimit[yr] || Library.PAST_YEAR_BATCH || 12) + 24; this.build(); },
  open(e) { wx.navigateTo({ url: '/pages/programme/programme?id=' + e.currentTarget.dataset.id }); },
  onShareAppMessage() { return { title: t('专题 · 麻雀观影护照'), path: '/pages/programmes/programmes' }; }
});
