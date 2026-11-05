// 云端配置（data/config.json 经 getData 下发）：字号缩放、公告、提示文案。改配置不用重新上传小程序。
const KEY = 'sk-cfg';
let C = { scale: 1, notice: '', tips: {} };
try { const s = wx.getStorageSync(KEY); if (s && typeof s === 'object') C = Object.assign(C, s); } catch (e) { }
const subs = [];
const scale = () => { const v = Number(C.scale); return v >= 0.8 && v <= 1.2 ? v : 1; };
// 与 app.wxss 一致：屏宽 ≤600px 时 1 个 --r = 屏宽/750，更宽的屏固定 0.552px；再乘云端缩放
const ps = () => {
  let w = 375; try { w = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).windowWidth || 375; } catch (e) { }
  return '--r:' + ((w <= 600 ? w / 750 : 0.552) * scale()).toFixed(5) + 'px;';
};
const view = () => ({ ps: ps(), notice: String(C.notice || '') });
const set = c => {
  if (!c || typeof c !== 'object') return;
  C = Object.assign({ scale: 1, notice: '', tips: {} }, c);
  try { wx.setStorageSync(KEY, C); } catch (e) { }
  subs.slice().forEach(fn => fn(view()));
};
// 给页面绑定：取当前配置，并在配置更新时刷新
const bind = page => {
  page.setData(view());
  const fn = v => { try { page.setData(v); } catch (e) { } };
  subs.push(fn); page.__cfgOff = () => { const i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); };
};
const tip = (key, dflt) => { const a = C.tips && C.tips[key]; return Array.isArray(a) && a.length ? a.map(String) : dflt; };
module.exports = { set, bind, tip, view };
