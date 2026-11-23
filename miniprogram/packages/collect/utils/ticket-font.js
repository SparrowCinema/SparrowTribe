// 票根片名字体：润植家康熙字典美化体（免费可商用）按片名取字的子集，部署时由 tools/build-title-font.py 生成在网站上。
// 在线加载，不进小程序包；scopes 含 native 才能给 Canvas 2D 用。最多等 2.5 秒，载不到就退回系统宋体（下次进页面再试）。
// 地址按天加参数，片名库更新后最晚隔天换新字。
const SITE = 'https://sparrowcinema.org/';
const FAMILY = 'SparrowKangxi';
let loading = null, ok = false;
function ready() {
  if (ok) return Promise.resolve(true);
  if (loading) return loading;
  loading = new Promise(resolve => {
    let done = false;
    const finish = v => { if (done) return; done = true; if (!v) loading = null; resolve(v); };
    const timer = setTimeout(() => finish(false), 2500);
    if (!wx.loadFontFace) { clearTimeout(timer); finish(false); return; }
    const d = new Date(), day = `${d.getFullYear()}${d.getMonth() + 1}${d.getDate()}`;
    wx.loadFontFace({
      global: true, family: FAMILY, scopes: ['webview', 'native'],
      source: `url("${SITE}fonts/ticket-title.woff?d=${day}")`,
      success: () => { ok = true; clearTimeout(timer); finish(true); },
      fail: () => { clearTimeout(timer); finish(false); }
    });
  });
  return loading;
}
module.exports = { ready, FAMILY };
