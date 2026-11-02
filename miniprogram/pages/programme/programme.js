const U = require('../../utils/util.js');
const I = require('../../utils/i18n.js');
const t = I.tr;
const app = getApp();
Page({
  data: { i: {}, p: null, films: [], gone: [], goneOpen: undefined, stats: {} },
  onLoad(q) { this.setData({ i: I.dict() }); this.id = q.id || 'style-kaleidoscope'; this.off = app.onData(() => this.build()); this.build(); },
  onUnload() { this.off && this.off(); },
  build() {
    const data = app.globalData.data, idx = U.index(data), p = idx.PG[this.id];
    if (!p) return;
    wx.setNavigationBarTitle({ title: p.name });
    const shows = data.shows.filter(s => idx.F[s.id] && idx.progOf(idx.F[s.id]).id === p.id);
    const mk = f => {
      const mine = shows.filter(s => s.id === f.id).sort((x, y) => U.showDate(x) - U.showDate(y)), next = mine.find(s => !U.ended(s, idx)), last = mine[mine.length - 1];
      const first = next || last;
      return { id: f.id, cn: f.cn, ini: (f.cn || '')[0], version: t(f.version || ''), poster: U.poster(f), color: (data.reg[f.reg] || {}).c, first: first ? first.d + ' ' + first.t : '',
        at: next ? U.showDate(next).getTime() : Infinity, lastAt: last ? U.showDate(last).getTime() : 0, gone: !!mine.length && !next };
    };
    const all = data.films.filter(f => idx.progOf(f).id === p.id).map(mk);
    // 即将放映（含场次待公布）按下一场先后；已结束按最近一场由近及远（与网站一致）
    const films = all.filter(f => !f.gone).sort((x, y) => (x.at === y.at ? 0 : x.at < y.at ? -1 : 1) || x.cn.localeCompare(y.cn, I.isEn() ? 'en' : 'zh'));
    const gone = all.filter(f => f.gone).sort((x, y) => y.lastAt - x.lastAt || x.cn.localeCompare(y.cn, I.isEn() ? 'en' : 'zh'));
    this.setData({ p: Object.assign({}, p, { periodT: t(p.period) }), upN: t(films.length + ' 部'), goneN: t(gone.length + ' 部'), films, gone, goneOpen: this.data.goneOpen === undefined ? !films.length : this.data.goneOpen, stats: { f: all.length, s: shows.length, d: new Set(shows.map(s => s.d)).size, h: new Set(shows.map(s => s.v + s.h)).size } });
  },
  toggleGone() { this.setData({ goneOpen: !this.data.goneOpen }); },
  open(e) { wx.navigateTo({ url: '/pages/film/film?id=' + e.currentTarget.dataset.id }); },
  toSchedule() { app.globalData.jumpProg = this.id; wx.switchTab({ url: '/pages/schedule/schedule' }); },
  onShareAppMessage() { const p = this.data.p || {}; return { title: `${p.name} · ${p.sub}`, path: '/pages/programme/programme?id=' + this.id }; }
});
