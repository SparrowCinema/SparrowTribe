const Screenings = require('./utils/screenings.js');
// 场次按日期、开场时间排好：往期专题沿用旧数据再拼上当期场次时顺序会乱，排片页日期条就会出现 18…29 之后才是 21、22
const showSortKey = s => { const U = require('./utils/util.js'), [m, d] = String(s.d).split('/').map(Number); return U.year(s.d, s.year) * 1e6 + m * 1e4 + d * 100 + U.toMin(s.t) / 1e4; };
const sortShows = list => list.sort((a, b) => showSortKey(a) - showSortKey(b));
const DataCache = require('./utils/datacache.js');
// 启动数据：安装包里的兜底数据（只含进行中 / 即将开始的专题）；本机有更新的缓存（上次联网取到的完整片目）时优先用缓存
const BUNDLED = require('./data/data.js');
const LOCAL = Screenings.apply((() => { const c = DataCache.load(BUNDLED); return c ? Object.assign({}, BUNDLED, c, { reg: BUNDLED.reg }) : BUNDLED; })());
sortShows(LOCAL.shows); // 安装包兜底数据按专题文件顺序排列，启动时与联网数据一样按日期时间排序（影片页场次依赖此顺序）
const plan = require('./utils/plan.js');
const watched = require('./utils/watched.js');
const I = require('./utils/i18n.js');
const community=require('./utils/community.js');
const sync = require('./utils/sync.js');
const CFG = require('./utils/cfg.js');

// 每个页面自动绑定云端配置（页面根节点 page-meta 用 ps 设置 --r 缩放，notice 为公告）
const _Page = Page;
try { Page = function (o) {
  const on = o.onLoad, off = o.onUnload, sh = o.onShow;
  o.onLoad = function (q) { try { CFG.bind(this); } catch (e) { } return on && on.call(this, q); };
  o.onShow = function () { try { CFG.chrome(); } catch (e) { } return sh && sh.apply(this, arguments); }; // 每次显示按当前外观重设原生导航栏/标签栏
  o.onUnload = function () { try { this.__cfgOff && this.__cfgOff(); } catch (e) { } return off && off.call(this); };
  return _Page(o);
}; } catch (e) { }

App({
  onShow() { try { require('./utils/remind.js').syncTmpl(); } catch (e) { } },
  onHide() { try { require('./utils/stats.js').flush(); } catch (e) { } },
  globalData: { data: LOCAL, source: 'local', raw: LOCAL },
  _waiters: [],

  onLaunch() {
    I.init(); this.globalData.data = I.localize(LOCAL); this.chrome();
    // 场次变更：个人排片一变就记下各场次的影片与时间（utils/planchange.js），之后数据里找不到时才能提示
    try { const PC = require('./utils/planchange.js'), P = require('./utils/plan.js'); P.onChange(() => PC.track(this.globalData.data)); PC.track(this.globalData.data); } catch (e) { } try { watched.migrate(LOCAL.aliases); } catch (e) { }
    if (wx.cloud) {
      wx.cloud.init({ env: 'cloud1-d9gvudh6vc59007ac', traceUser: true });
      this.loadRemote();
      plan.syncFromCloud();
      watched.syncFromCloud();
      sync.init();community.init();sync.onStatus(()=>{if(sync.status.state==='ok'){community.changed();community.flush();}});
    }
  },

  // 优先使用云数据库中的排片；为空或失败时使用内置数据
  loadRemote(force, noRefresh) {
    if (force) { // 强制刷新云端缓存（只刷新、返回很小），完成后再用普通请求读取，不再循环刷新
      wx.cloud.callFunction({ name: 'getData', data: { refresh: true, quiet: true } }).then(() => this.loadRemote(false, true)).catch(() => {});
      return;
    }
    // v2：首屏只要当期专题、不带长文；中文界面不要英文层（详见 cloudfunctions/getData 的 v2 说明）。云函数还没重新部署时返回旧格式，照旧处理。
    const lang = I.isEn() ? 'en' : 'zh';
    wx.cloud.callFunction({ name: 'getData', data: { v: 2, lang } }).then(res => {
      const r = res.result || {};
      if (r.v2) { if (r.config) CFG.set(r.config); this.applyV2(r, lang); return; }
      // 云端缓存超过 3 分钟：再单独请求一次强制刷新（失败不影响当前数据）
      if (!noRefresh && r.source === 'cache' && r.cachedAt && Date.now() - r.cachedAt > 180000) setTimeout(() => this.loadRemote(true), 300);
      if (r.config) CFG.set(r.config);
      if (r.films && r.films.length && r.shows && r.shows.length) {
        if (r.en) I.setEN(r.en);
        this.globalData.raw = Screenings.apply(Object.assign({}, LOCAL, r, { reg: LOCAL.reg }));
        this.globalData.data = I.localize(this.globalData.raw);
        this.globalData.source = 'cloud';
        DataCache.save(r);
        try { require('./utils/planchange.js').track(this.globalData.data); } catch (e) { }
        try { watched.migrate(this.globalData.raw.aliases); } catch (e) { }
        this._waiters.forEach(fn => fn(this.globalData.data));
        if (r.lean && r.detailParts) this.loadDetail(r.detailParts, r.en);
      }
    }).catch(() => {});
  },

  // v2 首屏：把当期专题的影片与场次叠加到已有数据上（往期专题先沿用本机缓存 / 上次的数据），再在后台逐个补齐往期专题，最后取长文
  applyV2(r, lang) {
    if (!(r.films && r.films.length && r.shows && r.shows.length)) return;
    const prev = this.globalData.raw || LOCAL, act = new Set(r.active || []);
    // 本机缓存里的旧影片：已改名合并的旧 id（aliases 的键）和当期专题里已被删掉的影片都不再沿用，否则同一部片会在专题里出现两次
    const gone = new Set(Object.keys(r.aliases || prev.aliases || {})), fresh = new Set(r.films.map(f => f.id));
    const byId = new Map((prev.films || []).filter(f => !gone.has(f.id) && !(act.has(f.prog) && !fresh.has(f.id))).map(f => [f.id, f]));
    r.films.forEach(f => byId.set(f.id, f));
    const known = new Set((r.active || []).concat(r.past || []));
    const shows = sortShows((prev.shows || []).filter(s => !act.has(s.p) && known.has(s.p)).concat(r.shows)); // 往期专题的场次先沿用旧数据，已删除的专题不再保留
    if (r.en) { this._en = r.en; I.setEN(r.en); }
    this._enLang = r.en ? 'en' : (this._enLang || '');
    const base = Object.assign({}, LOCAL, r); delete base.en;
    this.globalData.raw = Screenings.apply(Object.assign(base, { films: [...byId.values()], shows, reg: LOCAL.reg }));
    this.globalData.data = I.localize(this.globalData.raw);
    this.globalData.source = 'cloud';
    try { require('./utils/planchange.js').track(this.globalData.data); } catch (e) { }
    try { watched.migrate(this.globalData.raw.aliases); } catch (e) { }
    this._waiters.forEach(fn => fn(this.globalData.data));
    this.loadPast(r.past || [], lang).then(() => {
      DataCache.save(this.globalData.raw); // 往期专题补齐后再存本机缓存，避免把不完整的数据存进去
      if (r.detailParts) this.loadDetail(r.detailParts, this._en, lang);
    });
  },
  // 往期专题：每次取一个专题（单个专题远小于云函数返回上限），两个一组并行
  loadPast(ids, lang) {
    if (!ids.length) return Promise.resolve();
    const raw = this.globalData.raw;
    const one = id => wx.cloud.callFunction({ name: 'getData', data: { v: 2, prog: id, lang } }).then(res => {
      const r = res.result || {}; if (!r.ok || !r.films) return;
      const fresh = new Set(r.films.map(f => f.id)), gone = new Set(Object.keys(raw.aliases || {})); // 该专题里已删除 / 已改名的旧影片不再沿用
      const byId = new Map(raw.films.filter(f => !gone.has(f.id) && !(f.prog === id && !fresh.has(f.id))).map(f => [f.id, f])); r.films.forEach(f => byId.set(f.id, Object.assign({}, byId.get(f.id) || {}, f)));
      raw.films = [...byId.values()];
      raw.shows = sortShows(raw.shows.filter(s => s.p !== id).concat(Screenings.apply({ films: raw.films, shows: r.shows }).shows));
      if (this._en && r.e) Object.assign(this._en.films || (this._en.films = {}), r.e);
    }).catch(() => {});
    return (async () => {
      for (let i = 0; i < ids.length; i += 2) await Promise.all([one(ids[i]), ids[i + 1] ? one(ids[i + 1]) : null]);
      if (this._en) I.setEN(this._en);
      this.globalData.data = I.localize(raw);
      try { require('./utils/planchange.js').track(this.globalData.data); } catch (e) { } // 往期专题换成最新数据后再核对一次场次变更
      this._waiters.forEach(fn => fn(this.globalData.data));
    })();
  },

  // 剧情简介、影人介绍、获奖等长文字段分段取回（云函数单次返回有大小上限），取到一段合并一段
  loadDetail(n, en, lang) {
    const raw = this.globalData.raw, byId = {}; raw.films.forEach(f => { byId[f.id] = f; });
    let done = 0;
    const merge = r => {
      Object.keys(r.d || {}).forEach(id => { if (byId[id]) Object.assign(byId[id], r.d[id]); });
      const ef = en && en.films; if (ef) Object.keys(r.e || {}).forEach(id => { ef[id] = Object.assign(ef[id] || {}, r.e[id]); });
    };
    const refresh = () => { if (en) I.setEN(en); this.globalData.data = I.localize(raw); this._waiters.forEach(fn => fn(this.globalData.data)); };
    const one = i => wx.cloud.callFunction({ name: 'getData', data: lang ? { v: 2, part: i, lang } : { part: i } }).then(res => { const r = res.result || {}; if (r.ok) { merge(r); if (++done % 2 === 0) refresh(); } }).catch(() => {});
    (async () => { for (let i = 0; i < n; i += 2) await Promise.all([one(i), i + 1 < n ? one(i + 1) : null]); refresh(); })();
  },

  // 底部标签栏文字随语言切换（页面标题由各页 onShow 设置）
  chrome() {
    ['排片', '专题', '片目', '我的'].forEach((t, i) => { try { wx.setTabBarItem({ index: i, text: I.tr(t) }); } catch (e) { } });
  },
  // 切换中英文：记住选择，重新进入首页，所有页面按新语言重建
  switchLang() { I.set(I.isEn() ? 'zh' : 'en'); if (I.isEn() && this.globalData.source === 'cloud' && this._enLang !== 'en') this.loadRemote(); /* 中文首屏没带英文层：切到英文时取一次，期间用安装包里的英文 */ this.globalData.data = I.localize(this.globalData.raw); this.chrome(); const ps = getCurrentPages(), r = ps.length === 1 && ps[0].route; wx.reLaunch({ url: '/' + (/^pages\/(schedule|programmes|films|my)\//.test(r || '') ? r : 'pages/schedule/schedule') }); },

  // 页面订阅数据更新
  onData(fn) { this._waiters.push(fn); return () => { this._waiters = this._waiters.filter(f => f !== fn); }; }
});
