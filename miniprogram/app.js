const LOCAL = require('./data/data.js');
const plan = require('./utils/plan.js');

App({
  globalData: { data: LOCAL, source: 'local' },
  _waiters: [],

  onLaunch() {
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
        this.globalData.data = Object.assign({}, LOCAL, r, { reg: LOCAL.reg });
        this.globalData.source = 'cloud';
        this._waiters.forEach(fn => fn(this.globalData.data));
      }
    }).catch(() => {});
  },

  // 页面订阅数据更新
  onData(fn) { this._waiters.push(fn); return () => { this._waiters = this._waiters.filter(f => f !== fn); }; }
});
