const T = require('../../utils/totop.js');
const U = require('../../utils/util.js');
const plan = require('../../utils/plan.js');
const OV = require('../../utils/overlap.js');
const I = require('../../utils/i18n.js');
const t = I.tr;
const app = getApp();
Page({
  onPageScroll(e) { T.scroll(this, e); },
  toTop() { T.go(); },
  data: { i: {}, items: [], days: 0, bad: false },
  onLoad(q) {
    wx.setNavigationBarTitle({ title: t('朋友分享的排片') });
    const keys = decodeURIComponent(q.k || '').split('~').filter(Boolean);
    const data = app.globalData.data, idx = U.index(data);
    const list = data.shows.filter(s => idx.F[s.id] && keys.includes(U.keyOf(s))).sort((a, b) => U.showDate(a) - U.showDate(b));
    this.keys = list.map(U.keyOf); this._list = list; this._miss = keys.length - list.length;
    this.setData({ i: I.dict(), cnt: t(list.length + ' 场电影 · ' + new Set(list.map(s => s.d)).size + ' 天'), bad: !list.length, items: list.map(s => U.showView(s, idx, data, plan.get())), days: new Set(list.map(s => s.d)).size });
    this.compare();
    this.off = plan.onChange(() => this.compare());
  },
  onUnload() { this.off && this.off(); },
  // 对排片：和我的排片比较（规则在 utils/overlap.js，网站 overlapHTML 同步）
  compare() {
    const data = app.globalData.data, idx = U.index(data), picked = plan.get(), en = I.isEn();
    const mine = data.shows.filter(s => idx.F[s.id] && picked.has(U.keyOf(s)));
    const span = s => { const a = U.showDate(s).getTime(); return [a, a + U.durationOf(s, idx) * 60000]; };
    const c = OV.compare(this._list || [], mine, { key: U.keyOf, film: s => s.id, span, now: Date.now() });
    const row = (s, extra) => { const v = U.showView(s, idx, data, picked); return { key: v.key, id: v.id, d: v.d + ' ' + v.wk, t: v.t, cn: v.cn, version: v.version, place: v.venue + ' · ' + v.hall, extra: extra || '', on: picked.has(v.key) }; };
    const facts = [
      c.sameFilm.length ? (en ? c.sameFilm.length + ' same film' + (c.sameFilm.length > 1 ? 's' : '') + ', different screening' : '同一部电影、不同场次 ' + c.sameFilm.length + ' 部') : '',
      c.free.length ? (en ? c.free.length + ' more of theirs fit your plan' : 'TA 还有 ' + c.free.length + ' 场和你不冲突') : '',
      c.clash.length ? (en ? c.clash.length + ' clash' + (c.clash.length > 1 ? 'es' : '') + ' with your plan' : '与你的排片冲突 ' + c.clash.length + ' 场') : ''
    ].filter(Boolean);
    this.setData({ ov: {
      empty: !mine.length, same: c.same.length,
      miss: this._miss ? (en ? this._miss + (this._miss > 1 ? ' of their screenings were changed or cancelled and are not shown' : ' of their screenings was changed or cancelled and is not shown') : 'TA 的 ' + this._miss + ' 场已更新或取消，没有显示') : '',
      facts,
      secs: [
        { k: 'same', title: t('同场'), rows: c.same.map(s => row(s)) },
        { k: 'film', title: t('同一部电影，不同场次'), rows: c.sameFilm.map(x => row(x.their, (en ? 'You picked ' : '你选的是 ') + x.mine.map(m => m.d + ' ' + m.t).join(en ? ', ' : '、'))) },
        { k: 'free', title: t('可以一起去（和你的排片不冲突）'), add: true, rows: c.free.map(s => row(s)) },
        { k: 'clash', title: t('时间冲突'), bad: true, rows: c.clash.map(x => { const f = idx.F[x.mine.id]; return row(x.their, en ? 'Clashes with your ' + f.cn + ' at ' + x.mine.d + ' ' + x.mine.t : '与你的《' + f.cn + '》' + x.mine.d + ' ' + x.mine.t + ' 冲突'); }) }
      ].filter(x => x.rows.length)
    } });
  },
  addOne(e) { const k = e.currentTarget.dataset.key; if (plan.get().has(k)) return; plan.toggle(k); wx.showToast({ title: t('已加入排片'), icon: 'none' }); },
  pick() { wx.switchTab({ url: '/pages/schedule/schedule' }); },
  importAll() { plan.addMany(this.keys); wx.showToast({ title: t('已加入我的排片'), icon: 'success' }); setTimeout(() => wx.navigateTo({ url: '/pages/plan/plan' }), 700); },
  home() { wx.switchTab({ url: '/pages/schedule/schedule' }); },
  open(e) { wx.navigateTo({ url: '/pages/film/film?id=' + e.currentTarget.dataset.id }); }
});
