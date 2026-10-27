const U = require('../../utils/util.js');
const plan = require('../../utils/plan.js');
const app = getApp();
Page({
  data: { items: [], days: 0, bad: false },
  onLoad(q) {
    const keys = decodeURIComponent(q.k || '').split('~').filter(Boolean);
    const data = app.globalData.data, idx = U.index(data);
    const list = data.shows.filter(s => idx.F[s.id] && keys.includes(U.keyOf(s))).sort((a, b) => U.showDate(a) - U.showDate(b));
    this.keys = list.map(U.keyOf);
    this.setData({ bad: !list.length, items: list.map(s => U.showView(s, idx, data, plan.get())), days: new Set(list.map(s => s.d)).size });
  },
  importAll() { plan.addMany(this.keys); wx.showToast({ title: '已加入我的排片', icon: 'success' }); setTimeout(() => wx.switchTab({ url: '/pages/my/my' }), 700); },
  home() { wx.switchTab({ url: '/pages/schedule/schedule' }); },
  open(e) { wx.navigateTo({ url: '/pages/film/film?id=' + e.currentTarget.dataset.id }); }
});
