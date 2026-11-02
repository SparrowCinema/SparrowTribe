const U = require('../../utils/util.js');
const plan = require('../../utils/plan.js');
const I = require('../../utils/i18n.js');
const t = I.tr;
const app = getApp();
Page({
  data: { i: {}, items: [], days: 0, bad: false },
  onLoad(q) {
    wx.setNavigationBarTitle({ title: t('朋友分享的排片') });
    const keys = decodeURIComponent(q.k || '').split('~').filter(Boolean);
    const data = app.globalData.data, idx = U.index(data);
    const list = data.shows.filter(s => idx.F[s.id] && keys.includes(U.keyOf(s))).sort((a, b) => U.showDate(a) - U.showDate(b));
    this.keys = list.map(U.keyOf);
    this.setData({ i: I.dict(), cnt: t(list.length + ' 场电影 · ' + new Set(list.map(s => s.d)).size + ' 天'), bad: !list.length, items: list.map(s => U.showView(s, idx, data, plan.get())), days: new Set(list.map(s => s.d)).size });
  },
  importAll() { plan.addMany(this.keys); wx.showToast({ title: t('已加入我的排片'), icon: 'success' }); setTimeout(() => wx.switchTab({ url: '/pages/my/my' }), 700); },
  home() { wx.switchTab({ url: '/pages/schedule/schedule' }); },
  open(e) { wx.navigateTo({ url: '/pages/film/film?id=' + e.currentTarget.dataset.id }); }
});
