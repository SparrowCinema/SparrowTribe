const U = require('../../utils/util.js');
const plan = require('../../utils/plan.js');
const app = getApp();
const K = 2.4; // 每分钟 2.4rpx

const vShort = v => v.short || (v.brand || v.name).replace(/^杭州/, '');
const hShort = h => h.short || h.name;

Page({
  data: { pf: 'all', vf: 'all', day: '', days: [], progs: [], vchips: [], venues: [], vOpen: false, cols: [], ticks: [], H: 0, dayList: [], legend: [], span: '', count: 0, dayTitle: '', empty: '', scrollInto: '' },

  onLoad(q) {
    if (q && q.day) this.setData({ day: q.day });
    this.off1 = app.onData(() => this.build());
    this.off2 = plan.onChange(() => this.build());
    this.build();
  },
  onUnload() { this.off1 && this.off1(); this.off2 && this.off2(); },
  onShow() { const j = app.globalData.jumpDay; if (j) { app.globalData.jumpDay = ''; this.setData({ pf: 'all', vf: 'all', day: j }); } this.build(); },
  onPullDownRefresh() { app.loadRemote(); setTimeout(() => { this.build(); wx.stopPullDownRefresh(); }, 600); },

  build() {
    const data = app.globalData.data, idx = U.index(data), picked = plan.get();
    const { pf, vf } = this.data;
    const list = data.shows.filter(s => idx.F[s.id] && (pf === 'all' || idx.progOf(idx.F[s.id]).id === pf) && (vf === 'all' || s.v === vf));
    const allDays = [...new Set(data.shows.map(s => s.d))];
    const ds = allDays.filter(d => list.some(s => s.d === d));
    let day = this.data.day;
    if (!ds.includes(day)) {
      const t = new Date(); t.setHours(0, 0, 0, 0);
      day = ds.find(d => { const [m, dd] = d.split('/').map(Number); return new Date(U.year(d), m - 1, dd) >= t; }) || ds[0] || '';
    }
    let lastM = '';
    const days = ds.map(d => {
      const [m, dd] = d.split('/'); const mon = m !== lastM ? m + '月' : ''; lastM = m;
      return { d, mon, dd, wk: U.wk(d), n: list.filter(s => s.d === d).length, mine: data.shows.some(s => s.d === d && picked.has(U.keyOf(s))) };
    });

    // 单日时刻表：纵轴时间，横向影厅
    const dl = list.filter(s => s.d === day);
    let cols = [], ticks = [], H = 0;
    if (dl.length) {
      let S = Math.min(...dl.map(s => U.toMin(s.t))), E = Math.max(...dl.map(s => U.toMin(s.t) + (idx.F[s.id].min || 120)));
      S = Math.floor(S / 60) * 60; E = Math.ceil(E / 60) * 60; if (E - S < 180) E = S + 180;
      H = Math.round((E - S) * K) + 30;
      for (let m = S; m <= E; m += 60) ticks.push({ y: Math.round((m - S) * K), t: U.fmt(m) });
      data.venues.forEach(v => v.halls.forEach(h => {
        const hs = dl.filter(s => s.v === v.id && s.h === h.id);
        if (!hs.length) return;
        cols.push({ key: v.id + h.id, vn: vShort(v), hn: hShort(h), blocks: hs.map(s => {
          const vw = U.showView(s, idx, data, picked), st = U.toMin(s.t);
          return Object.assign(vw, { top: Math.round((st - S) * K), h: Math.max(110, Math.round((vw.min || 120) * K) - 6) });
        }) });
      }));
    }
    const progs = data.programmes.map(p => {
      const ps = data.shows.filter(s => idx.F[s.id] && idx.progOf(idx.F[s.id]).id === p.id);
      const fn = data.films.filter(f => idx.progOf(f).id === p.id).length;
      return Object.assign({}, p, { n: ps.length, fn });
    });
    const venues = data.venues.map(v => {
      const n = data.shows.filter(s => s.v === v.id).length;
      return { id: v.id, short: vShort(v), name: v.name, fmt: (v.fmt || []).join(' · '), n, halls: v.halls.length ? v.halls.map(h => h.name).join(' · ') : '影厅待补充' };
    });
    const vname = vf !== 'all' && idx.VN[vf] ? idx.VN[vf].name : '当前筛选';
    this.setData({
      day, days, cols, ticks, H, progs, venues,
      vchips: [{ id: 'all', n: '全部影院' }].concat(data.venues.map(v => ({ id: v.id, n: vShort(v) }))),
      dayList: dl.map(s => U.showView(s, idx, data, picked)),
      dayTitle: day ? day.replace('/', '月') + '日 ' + U.wk(day) : '',
      hallCount: new Set(dl.map(s => s.v + s.h)).size,
      empty: ds.length ? '' : vname + '暂无排片',
      legend: Object.keys(data.reg).map(k => data.reg[k]),
      span: ds.length ? ds[0] + ' – ' + ds[ds.length - 1] : '', count: list.length,
      scrollInto: 'd' + (ds.indexOf(day) > 1 ? ds.indexOf(day) - 1 : 0)
    });
  },

  setProg(e) { this.setData({ pf: e.currentTarget.dataset.id }); this.build(); },
  setVenue(e) { this.setData({ vf: e.currentTarget.dataset.id }); this.build(); },
  setDay(e) { this.setData({ day: e.currentTarget.dataset.d }); this.build(); },
  toggleVenues() { this.setData({ vOpen: !this.data.vOpen }); },
  openFilm(e) { wx.navigateTo({ url: '/pages/film/film?id=' + e.currentTarget.dataset.id }); },
  openProg(e) { wx.navigateTo({ url: '/pages/programme/programme?id=' + e.currentTarget.dataset.id }); },
  toggle(e) {
    const on = plan.toggle(e.currentTarget.dataset.key);
    wx.showToast({ title: on ? '已加入排片' : '已移出排片', icon: 'none' });
  },
  onShareAppMessage() { return { title: '麻雀观影护照 · 影展排片与观影日程', path: '/pages/schedule/schedule' }; },
  onShareTimeline() { return { title: '麻雀观影护照 · 影展排片与观影日程' }; }
});
