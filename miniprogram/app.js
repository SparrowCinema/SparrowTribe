const LOCAL = require('./data/data.js');
const plan = require('./utils/plan.js');
const watched = require('./utils/watched.js');
const I = require('./utils/i18n.js');
const sync = require('./utils/sync.js');
const CFG = require('./utils/cfg.js');

// 每个页面自动绑定云端配置（页面根节点 page-meta 用 ps 设置 --r 缩放，notice 为公告）
const _Page = Page;
try { Page = function (o) {
  const on = o.onLoad, off = o.onUnload;
  o.onLoad = function (q) { try { CFG.bind(this); } catch (e) { } return on && on.call(this, q); };
  o.onUnload = function () { try { this.__cfgOff && this.__cfgOff(); } catch (e) { } return off && off.call(this); };
  return _Page(o);
}; } catch (e) { }

App({
  globalData: { data: LOCAL, source: 'local', raw: LOCAL },
  _waiters: [],

  onLaunch() {
    I.init(); this.globalData.data = I.localize(LOCAL); this.chrome(); try { watched.migrate(LOCAL.aliases); } catch (e) { }
    if (wx.cloud) {
      wx.cloud.init({ env: 'cloud1-d9gvudh6vc59007ac', traceUser: true });
      this.loadRemote();
      plan.syncFromCloud();
      watched.syncFromCloud();
      sync.init();
    }
  },

  // 优先使用云数据库中的排片；为空或失败时使用内置数据
  loadRemote(force) {
    wx.cloud.callFunction({ name: 'getData', data: force ? { refresh: true } : {} }).then(res => {
      const r = res.result || {};
      // 云端缓存超过 3 分钟：再单独请求一次强制刷新（失败不影响当前数据）
      if (!force && r.source === 'cache' && r.cachedAt && Date.now() - r.cachedAt > 180000) setTimeout(() => this.loadRemote(true), 300);
      if (r.config) CFG.set(r.config);
      if (r.films && r.films.length && r.shows && r.shows.length) {
        if (r.en) I.setEN(r.en);
        this.globalData.raw = Object.assign({}, LOCAL, r, { reg: LOCAL.reg });
        this.globalData.data = I.localize(this.globalData.raw);
        this.globalData.source = 'cloud';
        try { watched.migrate(this.globalData.raw.aliases); } catch (e) { }
        this._waiters.forEach(fn => fn(this.globalData.data));
        if (r.lean && r.detailParts) this.loadDetail(r.detailParts, r.en);
      }
    }).catch(() => {});
  },

  // 剧情简介、影人介绍、获奖等长文字段分段取回（云函数单次返回有大小上限），取到一段合并一段
  loadDetail(n, en) {
    const raw = this.globalData.raw, byId = {}; raw.films.forEach(f => { byId[f.id] = f; });
    let done = 0;
    const merge = r => {
      Object.keys(r.d || {}).forEach(id => { if (byId[id]) Object.assign(byId[id], r.d[id]); });
      const ef = en && en.films; if (ef) Object.keys(r.e || {}).forEach(id => { ef[id] = Object.assign(ef[id] || {}, r.e[id]); });
    };
    const refresh = () => { if (en) I.setEN(en); this.globalData.data = I.localize(raw); this._waiters.forEach(fn => fn(this.globalData.data)); };
    const one = i => wx.cloud.callFunction({ name: 'getData', data: { part: i } }).then(res => { const r = res.result || {}; if (r.ok) { merge(r); if (++done % 2 === 0) refresh(); } }).catch(() => {});
    (async () => { for (let i = 0; i < n; i += 2) await Promise.all([one(i), i + 1 < n ? one(i + 1) : null]); refresh(); })();
  },

  // 底部标签栏文字随语言切换（页面标题由各页 onShow 设置）
  chrome() {
    ['排片', '专题', '片目', '我的'].forEach((t, i) => { try { wx.setTabBarItem({ index: i, text: I.tr(t) }); } catch (e) { } });
  },
  // 切换中英文：记住选择，重新进入首页，所有页面按新语言重建
  switchLang() { I.set(I.isEn() ? 'zh' : 'en'); this.globalData.data = I.localize(this.globalData.raw); this.chrome(); const ps = getCurrentPages(), r = ps.length === 1 && ps[0].route; wx.reLaunch({ url: '/' + (/^pages\/(schedule|programmes|films|my)\//.test(r || '') ? r : 'pages/schedule/schedule') }); },

  // 页面订阅数据更新
  onData(fn) { this._waiters.push(fn); return () => { this._waiters = this._waiters.filter(f => f !== fn); }; }
});
