// 影片 / 专题分享海报：取页面小程序码（wxacode 云函数，失败时用通用小程序码）→ 画布绘制 → 微信分享图片菜单。
// 页面里需要 <canvas type="2d" id="share-canvas" class="share-canvas" />
const SP = require('./share-poster.js'), I = require('./i18n.js');
const MARKS = ['/images/brand/sparrow-movies-sq.png', '/images/brand/sparrow-tribe-sq.png'], FALLBACK = '/images/brand/miniprogram-code.jpg';
async function pageCode(page, scene) {
  try {
    let env = 'release'; try { env = wx.getAccountInfoSync().miniProgram.envVersion || 'release'; } catch (e) {}
    const r = await wx.cloud.callFunction({ name: 'wxacode', data: { page, scene, env } }), id = r && r.result && r.result.ok && r.result.fileID;
    if (!id) return null; const d = await wx.cloud.downloadFile({ fileID: id }); return d && d.tempFilePath || null;
  } catch (e) { return null; }
}
async function make(page, opts) {
  if (page._spBusy) return; page._spBusy = true; wx.showLoading({ title: I.tr('正在生成分享海报…'), mask: true });
  const done = () => { page._spBusy = false; wx.hideLoading(); };
  const fail = () => { done(); wx.showToast({ title: I.tr('海报生成失败，请稍后再试'), icon: 'none' }); };
  try {
    const node = await new Promise(r => wx.createSelectorQuery().in(page).select('#share-canvas').fields({ node: true, size: true }).exec(res => r(res && res[0] && res[0].node)));
    if (!node) return fail();
    const load = src => new Promise(r => { if (!src) return r(null); const im = node.createImage(); im.onload = () => r(im); im.onerror = () => r(null); im.src = src; });
    const [o, code, marks] = await Promise.all([opts.build(load), pageCode(opts.page, opts.scene), Promise.all(MARKS.map(load))]);
    o.qrImg = await load(code || FALLBACK); o.marks = marks; o.T = I.tr;
    const H = SP.heightOf(o, node.getContext('2d')), k = 0.75; node.width = Math.round(SP.W * k); node.height = Math.round(H * k);
    const c = node.getContext('2d'); c.scale(k, k); SP.draw(c, o);
    wx.canvasToTempFilePath({ canvas: node, fileType: 'jpg', quality: 0.92, success: r => { done(); const p = r.tempFilePath, prev = () => wx.previewImage({ urls: [p], current: p }); if (wx.showShareImageMenu) wx.showShareImageMenu({ path: p, fail: prev }); else prev(); }, fail });
  } catch (e) { fail(); }
}
// 扫码进入时 scene 是 id 的前 32 个字符：精确匹配不到就按前缀找
const fromScene = (q, ids) => { if (q.id) return q.id; const s = q.scene ? decodeURIComponent(q.scene) : ''; if (!s) return ''; return ids.includes(s) ? s : (ids.find(x => x.startsWith(s)) || s); };
module.exports = { make, fromScene };
