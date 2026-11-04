// 回到顶部：滚过约 1.5 屏高度才出现（太早会打扰，太晚没意义）。每个底栏页：onPageScroll(e){ T.scroll(this, e); } toTop(){ T.go(); }
let H = 0;
function threshold() { if (!H) { try { H = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).windowHeight || 640; } catch (e) { H = 640; } } return Math.max(500, H * 1.5); }
function scroll(page, e) { const on = e.scrollTop > threshold(); if (on !== !!page.data.topOn) page.setData({ topOn: on }); }
function go() { wx.pageScrollTo({ scrollTop: 0, duration: 280 }); }
module.exports = { scroll, go };
