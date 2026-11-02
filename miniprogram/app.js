const LOCAL = require('./data/data.js');
const plan = require('./utils/plan.js');
const I = require('./utils/i18n.js');

App({
  globalData: { data: LOCAL, source: 'local', raw: LOCAL },
  _waiters: [],

  onLaunch() {
    I.init(); this.globalData.data = I.localize(LOCAL); this.chrome();
    if (wx.cloud) {
      wx.cloud.init({ env: 'cloud1-d9gvudh6vc59007ac', traceUser: true });
      this.loadRemote();
      plan.syncFromCloud();
    }
  },

  // 优先使用云数据库中的排片；为空或失败时使用内置数据
  loadRemote() {
    wx.cloud.callFunction({ name: 'getData' }).then(res => {
      const r = res.result || {};
      if (r.films && r.films.length && r.shows && r.shows.length) {
        if (r.en) I.setEN(r.en);
        this.globalData.raw = Object.assign({}, LOCAL, r, { reg: LOCAL.reg });
        this.globalData.data = I.localize(this.globalData.raw);
        this.globalData.source = 'cloud';
        this._waiters.forEach(fn => fn(this.globalData.data));
      }
    }).catch(() => {});
  },

  // 底部标签栏文字随语言切换（页面标题由各页 onShow 设置）
  chrome() {
    ['排片', '专题', '片目', '我的'].forEach((t, i) => { try { wx.setTabBarItem({ index: i, text: I.tr(t) }); } catch (e) { } });
  },
  // 切换中英文：记住选择，重新进入首页，所有页面按新语言重建
  switchLang() { I.set(I.isEn() ? 'zh' : 'en'); this.globalData.data = I.localize(this.globalData.raw); this.chrome(); wx.reLaunch({ url: '/pages/schedule/schedule' }); },

  // 页面订阅数据更新
  onData(fn) { this._waiters.push(fn); return () => { this._waiters = this._waiters.filter(f => f !== fn); }; }
});
