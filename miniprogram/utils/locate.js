// 定位城市优先（与网站 locateCity / nearestCity 一致）：wx.getFuzzyLocation 取模糊位置，只在本机换算成最近的已收录城市，
// 不上传坐标；结果存本机 sk-geo-city（1 天），util.geoCity / localProg 读取它来排序专题与片目。
const CITIES = require('./cities.js');
const KEY = 'sk-geo-city', TRY = 'sk-geo-try', DAY = 864e5;
const centerOf = (c, data) => {
  if (CITIES[c] && Array.isArray(CITIES[c].geo)) return CITIES[c].geo;
  const g = (data.venues || []).filter(v => v.city === c && Array.isArray(v.geo)).map(v => v.geo);
  return g.length ? [g.reduce((a, x) => a + (+x[0]), 0) / g.length, g.reduce((a, x) => a + (+x[1]), 0) / g.length] : null;
};
function nearest(lat, lng, data) {
  const R = Math.PI / 180; let best = '', bd = Infinity;
  const names = new Set((data.venues || []).map(v => v.city).concat((data.programmes || []).map(p => p.city)).filter(Boolean));
  names.forEach(c => {
    const g = centerOf(c, data); if (!g) return;
    const lim = (CITIES[c] && CITIES[c].r) || 80;
    const a = Math.sin((g[0] - lat) * R / 2) ** 2 + Math.cos(lat * R) * Math.cos(g[0] * R) * Math.sin((g[1] - lng) * R / 2) ** 2;
    const d = 12742 * Math.asin(Math.sqrt(a));
    if (d <= lim && d < bd) { bd = d; best = c; }
  });
  return best;
}
// force=true 时忽略缓存（手动重试）；done(changed) 在城市变化后回调，页面据此重新排序
function locate(data, done, force, finish) {
  try {
    const o = wx.getStorageSync(KEY), t = +wx.getStorageSync(TRY) || 0, now = Date.now();
    if (!force && ((o && o.t && now - o.t < DAY) || now - t < DAY)) return; // 1 天内已定位或刚被拒绝过，不再打扰
    if (typeof wx.getFuzzyLocation !== 'function') { if (finish) finish(false); return; }
    wx.setStorageSync(TRY, now);
    wx.getFuzzyLocation({
      type: 'gcj02',
      success: r => {
        const c = nearest(r.latitude, r.longitude, data), prev = o && o.c;
        wx.setStorageSync(KEY, { c, t: Date.now() });
        if (c !== prev && done && !finish) done(c);
        if (finish) finish(true);
      },
      fail: () => { if (finish) finish(false); }
    });
  } catch (e) { }
}
module.exports = { locate, nearest };
