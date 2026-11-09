// 从分享卡片/海报小程序码直接进入影片或专题页时，页面是栈底，微信在左上角显示「主页」按钮。
// 轻提示（coach mark）指向该按钮：只在栈底页出现，8 秒自动消失；关闭后不再出现，最多展示 3 次。
const KEY = 'sk-hometip';
function show(page) {
  try {
    if (getCurrentPages().length !== 1) return;
    const app = getApp();
    if (app.globalData.homeTipShown) return;
    const s = wx.getStorageSync(KEY) || { n: 0 };
    if (s.off || s.n >= 3) return;
    app.globalData.homeTipShown = 1;
    wx.setStorageSync(KEY, { n: s.n + 1 });
    page.setData({ homeTip: true });
    page._homeTipT = setTimeout(() => page.setData({ homeTip: false }), 8000);
  } catch (e) {}
}
function close(page) {
  clearTimeout(page._homeTipT);
  page.setData({ homeTip: false });
  try { const s = wx.getStorageSync(KEY) || { n: 0 }; s.off = 1; wx.setStorageSync(KEY, s); } catch (e) {}
}
function home() { wx.reLaunch({ url: '/pages/schedule/schedule' }); }
module.exports = { show, close, home };
