// 云端配置（data/config.json 经 getData 下发）：字号缩放、公告、提示文案。改配置不用重新上传小程序。
const KEY = 'sk-cfg';
let C = { scale: 1, notice: '', tips: {} };
try { const s = wx.getStorageSync(KEY); if (s && typeof s === 'object') C = Object.assign(C, s); } catch (e) { }
const subs = [];
const scale = () => { const v = Number(C.scale); return v >= 0.8 && v <= 1.2 ? v : 1; };
// 字号单独缩放（data/config.json 的 font，0.85–1.25）：只改文字，不动间距与海报；改云端配置即可，不用重新上传
const font = () => { const v = Number(C.font); return v >= 0.85 && v <= 1.25 ? v : 1; };
// 与 app.wxss 一致：屏宽 ≤600px 时 1 个 --r = 屏宽/750，更宽的屏固定 0.552px；再乘云端缩放
// 专题页(列表+详情)整页等比缩小：只改 --r，字号、间距、封面一起按比例变
const PAGE_K = { 'pages/programmes/programmes': 1, 'pages/programme/programme': 0.9 };
const ps = route => {
  let w = 375; try { w = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).windowWidth || 375; } catch (e) { }
  const base = (w <= 600 ? w / 750 : 0.552) * scale();
  // --r 管尺寸（专题页按 PAGE_K 等比缩小）；--fr 管字号，各页一致，不随 PAGE_K 缩小
  return '--r:' + (base * (PAGE_K[route] || 1)).toFixed(5) + 'px;--fr:' + (base * font()).toFixed(5) + 'px;' + (isDark() ? DARK : '');
};
// ---- 外观：跟随系统 / 浅色 / 暗色（选择存在本机 sk-theme；暗色靠 page-style 覆盖 app.wxss 里的颜色变量） ----
const TKEY = 'sk-theme';
let T = 'auto';
try { const v = wx.getStorageSync(TKEY); if (v === 'light' || v === 'dark') T = v; } catch (e) { }
const sysTheme = () => { try { const b = wx.getAppBaseInfo ? wx.getAppBaseInfo() : wx.getSystemInfoSync(); return b && b.theme === 'dark' ? 'dark' : 'light'; } catch (e) { return 'light'; } };
const isDark = () => T === 'dark' || (T === 'auto' && sysTheme() === 'dark');
const DARK = '--bg:#17130f;--surface:#211b15;--line:#3b3128;--line-soft:#2c241d;--fg:#f1e6d3;--muted:#a8977f;--accent:#d9634f;--teal:#4aa39d;--ochre:#d9953a;--chip:#2e261e;--float:rgba(33,27,21,.94);--bad-bg:#3b1f1b;--bad-fg:#ff8f80;--ic-filter:brightness(0) invert(.88);--ic-bg:transparent;--barS:22%;--barL:26%;--lineL:40%;--inkL:90%;';
// 微信原生的导航栏、底部标签栏、页面底色不吃 CSS，只能用接口按当前外观改；非标签页调用标签栏接口会失败，已吞掉
const PAL = {
  light: { front: '#000000', nav: '#f8f2e6', page: '#efe6d4', tab: '#7a6a55', sel: '#8e2a22', border: 'white', bgt: 'dark', ic: '' },
  dark: { front: '#ffffff', nav: '#211b15', page: '#17130f', tab: '#a8977f', sel: '#d9634f', border: 'black', bgt: 'light', ic: '-d' }
};
const TABS = ['schedule', 'programmes', 'films', 'my'];
const chrome = () => {
  const p = PAL[isDark() ? 'dark' : 'light'], nop = { fail() { } };
  try { wx.setNavigationBarColor(Object.assign({ frontColor: p.front, backgroundColor: p.nav }, nop)); } catch (e) { }
  try { wx.setBackgroundColor(Object.assign({ backgroundColor: p.page, backgroundColorTop: p.page, backgroundColorBottom: p.page }, nop)); } catch (e) { }
  try { wx.setBackgroundTextStyle(Object.assign({ textStyle: p.bgt }, nop)); } catch (e) { }
  try { wx.setTabBarStyle(Object.assign({ color: p.tab, selectedColor: p.sel, backgroundColor: p.nav, borderStyle: p.border }, nop)); } catch (e) { }
  TABS.forEach((n, i) => { try { wx.setTabBarItem(Object.assign({ index: i, iconPath: 'images/tab/' + n + p.ic + '.png', selectedIconPath: 'images/tab/' + n + '-on' + p.ic + '.png' }, nop)); } catch (e) { } });
};
const view = route => ({ ps: ps(route), notice: String(C.notice || ''), dk: isDark(), tpref: T });
const set = c => {
  if (!c || typeof c !== 'object') return;
  C = Object.assign({ scale: 1, notice: '', tips: {} }, c);
  try { wx.setStorageSync(KEY, C); } catch (e) { }
  subs.slice().forEach(fn => fn(view()));
};
// 给页面绑定：取当前配置，并在配置更新时刷新
const bind = page => {
  const mine = () => view(page.route);
  page.setData(mine());
  const fn = () => { try { page.setData(mine()); } catch (e) { } };
  subs.push(fn); page.__cfgOff = () => { const i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); };
};
const setTheme = p => {
  T = p === 'light' || p === 'dark' ? p : 'auto';
  try { T === 'auto' ? wx.removeStorageSync(TKEY) : wx.setStorageSync(TKEY, T); } catch (e) { }
  subs.slice().forEach(fn => fn(view()));
  chrome();
};
// 系统外观变了（只有选「跟随系统」时才有影响）：刷新所有页面并重设原生栏
try { wx.onThemeChange && wx.onThemeChange(() => { if (T === 'auto') { subs.slice().forEach(fn => fn(view())); chrome(); } }); } catch (e) { }
const tip = (key, dflt) => { const a = C.tips && C.tips[key]; return Array.isArray(a) && a.length ? a.map(String) : dflt; };
module.exports = { set, bind, tip, view, setTheme, chrome };
