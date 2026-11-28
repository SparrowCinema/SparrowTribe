const T = require('../../utils/tickets.js');
const Tix = require('../../utils/ticketstore.js');
const U = require('../../utils/util.js');
const I = require('../../utils/i18n.js');
const Stats = require('../../utils/stats.js');
const HT = require('../../utils/hometip.js');
const t = I.tr;
const app = getApp();

Page({
  data: {
    i: {},
    state: 'loading', // loading | working | ok | error | invalid | noshow
    again: false,
    reason: '',
    film: null,
    ed: null,
    ticketKey: '',
    filmId: '',
    homeTip: false
  },
  onLoad(q) {
    if (q && q.host === '1') {
      wx.redirectTo({ url: '/packages/collect/checkin-host/checkin-host' });
      return;
    }
    this.setData({ i: I.dict() });
    wx.setNavigationBarTitle({ title: t('现场认证') });
    Stats.stat('pv', 'checkin');
    HT.show(this);
    const c = T.checkinSceneParse(q && q.scene)
      || T.checkinSceneParse(q && q.q)
      || T.checkinParse(q && q.q)
      || T.checkinParse(q && q.raw);
    if (!c) {
      this.setData({ state: 'invalid' });
      return;
    }
    this._code = c;
    this.offData = app.onData(() => this.tryRun());
    this.tryRun();
  },
  onUnload() {
    if (this._waitTimer) clearTimeout(this._waitTimer);
    if (this.offData) this.offData();
  },
  dismissHomeTip() { HT.close(this); },
  showMeta(s, data) {
    const idx = U.index(data), f = idx.F[s.id] || {};
    const venue = idx.venueName(s), hall = idx.hallName(s);
    const place = [venue, hall].filter(Boolean).join(' · ');
    const time = [U.ymd(s), U.wk(s.d, s.year), s.t].filter(Boolean).join(' ');
    return {
      id: s.id,
      cn: f.cn || s.id,
      version: f.version ? t(f.version) : '',
      poster: U.thumb(f),
      time,
      place
    };
  },
  async tryRun() {
    if (this._busy || this._done || !this._code) return;
    const c = this._code, data = app.globalData.data || {};
    const s = (data.shows || []).find(x => (!c.f || x.id === c.f) && (x.sid === c.h || U.keyOf(x) === c.h));
    if (!s) {
      if (app.globalData.source === 'cloud' && app.globalData.full) {
        if (this._waitTimer) { clearTimeout(this._waitTimer); this._waitTimer = 0; }
        this.setData({ state: 'noshow' });
        return;
      }
      this.setData({ state: 'loading' });
      if (!this._waitTimer) {
        this._waitTimer = setTimeout(() => {
          this._waitTimer = 0;
          if (!this._busy && !this._done) this.setData({ state: 'noshow' });
        }, 12000);
      }
      return;
    }
    if (this._waitTimer) { clearTimeout(this._waitTimer); this._waitTimer = 0; }
    this._busy = true;
    this.setData({ state: 'working', film: this.showMeta(s, data), reason: '' });
    const r = await Tix.checkin(c);
    this._busy = false;
    this._done = true;
    if (r.ok) {
      let ed = null;
      try {
        const cur = app.globalData.data || data, idx = U.index(cur);
        const row = Tix.build(cur, idx).tickets.find(x => x.key === r.key);
        ed = T.editionLines(row || { issue: r.no, showNo: r.sno, checkedIn: r.ci || Date.now() });
      } catch (e) {
        ed = T.editionLines({ issue: r.no, showNo: r.sno, checkedIn: r.ci || Date.now() });
      }
      this.setData({ state: 'ok', again: !!r.again, ticketKey: r.key || '', filmId: r.film || s.id, ed });
      return;
    }
    this.setData({
      state: r.reason === 'noshow' ? 'noshow' : 'error',
      reason: r.reason || 'offline',
      ticketKey: r.key || '',
      filmId: r.film || s.id
    });
  },
  retry() {
    this._done = false;
    if (this.data.state === 'noshow') {
      app.loadRemote(true);
      this.setData({ state: 'loading' });
    }
    this.tryRun();
  },
  rescan() {
    wx.scanCode({
      onlyFromCamera: true,
      success: res => {
        const c = T.checkinSceneParse(res.path || '')
          || T.checkinSceneParse(res.result || '')
          || T.checkinParse(res.result || '');
        if (!c) { wx.showToast({ title: t('这不是现场签到码'), icon: 'none' }); return; }
        this._code = c;
        this._done = false;
        this._busy = false;
        this.tryRun();
      }
    });
  },
  openTicket() {
    if (this.data.ticketKey) {
      wx.navigateTo({ url: '/packages/collect/ticket-edit/ticket-edit?key=' + encodeURIComponent(this.data.ticketKey) });
      return;
    }
    wx.navigateTo({ url: '/packages/collect/tickets/tickets' });
  },
  openFilm() {
    if (this.data.filmId) wx.navigateTo({ url: '/pages/film/film?id=' + encodeURIComponent(this.data.filmId) });
  },
  goHome() {
    wx.switchTab({ url: '/pages/schedule/schedule' });
  }
});
