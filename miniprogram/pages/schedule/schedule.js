const U = require('../../utils/util.js');
const plan = require('../../utils/plan.js');
const app = getApp();
const K = 2.4; // 每分钟 2.4rpx

const vShort = v => v.short || (v.brand || v.name).replace(/^杭州/, '');
const hShort = h => h.short || h.name;

Page({
  data: { pf: 'all', vf: 'all', day: '', days: [], nowLine: null, todayOpen: false, myToday: [], myTodayTitle: '', progs: [], vchips: [], venues: [], vOpen: false, cols: [], ticks: [], H: 0, dayList: [], legend: [], span: '', count: 0, dayTitle: '', empty: '', scrollInto: '' },

  onLoad(q) {
    if (q && q.day) this.setData({ day: q.day });
    this.off1 = app.onData(() => this.build());
    this.off2 = plan.onChange(() => this.build());
    this.build();
  },
  onUnload() { this.off1 && this.off1(); this.off2 && this.off2(); this.stopTick(); },
  onHide() { this.stopTick(); },
  // 当前时间线：每 30 秒移动一次（跨天时整页重建）
  startTick() { this.stopTick(); this.timer = setInterval(() => this.tick(), 30000); },
  stopTick() { if (this.timer) { clearInterval(this.timer); this.timer = null; } },
  tick() {
    const c = this.ttCtx; if (!c) return;
    const t = new Date(), key = (t.getMonth() + 1) + '/' + t.getDate();
    if (key !== c.today) { this.build(); return; }
    this.setData({ nowLine: this.nowLineOf(c) });
  },
  nowLineOf(c) {
    if (!c.isToday) return null;
    const t = new Date(), m = t.getHours() * 60 + t.getMinutes();
    return m >= c.S && m <= c.E ? { top: Math.round((m - c.S) * K), label: U.fmt(m) } : null;
  },
  onShow() { this.startTick(); const j = app.globalData.jumpDay, jp = app.globalData.jumpProg; if (j) { app.globalData.jumpDay = ''; this.setData({ pf: 'all', vf: 'all', day: j }); } if (jp) { app.globalData.jumpProg = ''; this.setData({ pf: jp, vf: 'all', day: '' }); } this.build(); },
  onPullDownRefresh() { app.loadRemote(); setTimeout(() => { this.build(); wx.stopPullDownRefresh(); }, 600); },

  build() {
    const data = app.globalData.data, idx = U.index(data), picked = plan.get();
    const { pf, vf } = this.data;
    const list = data.shows.filter(s => idx.F[s.id] && !U.ended(s, idx) && (pf === 'all' || idx.progOf(idx.F[s.id]).id === pf) && (vf === 'all' || s.v === vf));
    // 首页顶部：今天我的排片中尚未散场的场次，按时间线排列
    const tk = new Date(), tkey = (tk.getMonth() + 1) + '/' + tk.getDate();
    const myToday = data.shows.filter(s => idx.F[s.id] && s.d === tkey && picked.has(U.keyOf(s)) && !U.ended(s, idx))
      .sort((a, b) => U.toMin(a.t) - U.toMin(b.t))
      .map(s => { const vw = U.showView(s, idx, data, picked); return { key: vw.key, id: s.id, t: vw.t, end: vw.end, cn: vw.cn, venue: vw.venue, hall: vw.hall, tone: vw.tone }; });
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
    let cols = [], ticks = [], H = 0, nowLine = null;
    this.ttCtx = null;
    if (dl.length) {
      let S = Math.min(...dl.map(s => U.toMin(s.t))), E = Math.max(...dl.map(s => Math.max(U.toMin(s.t) + (idx.F[s.id].min || 120), (U.qaOf(idx.F[s.id]) || {}).end || 0)));
      // 查看今天时，把当前时间所在的小时纳入时间轴，才能画出当前时间线
      const tn = new Date(), todayKey = (tn.getMonth() + 1) + '/' + tn.getDate(), isToday = todayKey === day, nowM = tn.getHours() * 60 + tn.getMinutes();
      if (isToday && nowM < S) S = nowM;
      S = Math.floor(S / 60) * 60; E = Math.ceil(E / 60) * 60; if (E - S < 180) E = S + 180;
      this.ttCtx = { day, S, E, isToday, today: todayKey };
      nowLine = this.nowLineOf(this.ttCtx);
      H = Math.round((E - S) * K) + 30;
      for (let m = S; m <= E; m += 60) ticks.push({ y: Math.round((m - S) * K), t: U.fmt(m) });
      data.venues.forEach(v => v.halls.forEach(h => {
        const hs = dl.filter(s => s.v === v.id && s.h === h.id);
        if (!hs.length) return;
        const qas = [];
        cols.push({ key: v.id + h.id, vn: vShort(v), hn: hShort(h), qas, blocks: hs.map(s => {
          const vw = U.showView(s, idx, data, picked), st = U.toMin(s.t), qa = U.qaOf(idx.F[s.id]);
          if (qa) qas.push({ key: vw.key + '-qa', id: s.id, top: Math.round((qa.start - S) * K), h: Math.max(60, Math.round((qa.end - qa.start) * K) - 6), label: qa.label });
          return Object.assign(vw, { top: Math.round((st - S) * K), h: Math.max(110, Math.round((vw.min || 120) * K) - 6) });
        }) });
      }));
    }
    // 专题筛选：已结束的专题不再列出（当前选中的除外），与网站一致
    const progs = data.programmes.map(p => {
      const info = U.progInfo(p, data, idx);
      const fn = data.films.filter(f => idx.progOf(f).id === p.id).length;
      return Object.assign({}, p, { n: info.shows.length, fn, status: info.status });
    }).filter(p => p.status !== 'ended' || p.id === pf);
    // 影院筛选：只列出当前专题里还有待放映场次的影院；只有一家时不显示
    const upInProg = data.shows.filter(s => idx.F[s.id] && !U.ended(s, idx) && (pf === 'all' || idx.progOf(idx.F[s.id]).id === pf));
    const vlist = data.venues.filter(v => upInProg.some(s => s.v === v.id) || v.id === vf);
    const venues = data.venues.map(v => {
      const n = data.shows.filter(s => s.v === v.id).length;
      return { id: v.id, short: vShort(v), name: v.name, fmt: (v.fmt || []).join(' · '), n, halls: v.halls.length ? v.halls.map(h => h.name).join(' · ') : '影厅待补充' };
    });
    const vname = vf !== 'all' && idx.VN[vf] ? idx.VN[vf].name : '当前筛选';
    this.setData({
      day, days, cols, ticks, H, nowLine, progs, venues, myToday,
      myTodayTitle: tk.getMonth() + 1 + '月' + tk.getDate() + '日 ' + U.wk(tkey) + ' · 接下来 ' + myToday.length + ' 场',
      vchips: vlist.length > 1 ? [{ id: 'all', n: '全部影院' }].concat(vlist.map(v => ({ id: v.id, n: vShort(v) }))) : [],
      dayList: dl.map(s => U.showView(s, idx, data, picked)),
      dayTitle: day ? day.replace('/', '月') + '日 ' + U.wk(day) : '',
      hallCount: new Set(dl.map(s => s.v + s.h)).size,
      empty: ds.length ? '' : vname + '暂无排片',
      legend: Object.keys(data.reg).map(k => data.reg[k]),
      span: ds.length ? ds[0] + ' – ' + ds[ds.length - 1] : '', count: list.length,
      scrollInto: 'd' + (ds.indexOf(day) > 1 ? ds.indexOf(day) - 1 : 0)
    });
  },

  setProg(e) { this.setData({ pf: e.currentTarget.dataset.id, vf: 'all', day: '' }); this.build(); },
  setVenue(e) { this.setData({ vf: e.currentTarget.dataset.id }); this.build(); },
  setDay(e) { this.setData({ day: e.currentTarget.dataset.d }); this.build(); },
  toggleToday() { this.setData({ todayOpen: !this.data.todayOpen }); },
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
