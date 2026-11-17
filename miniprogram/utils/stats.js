// 使用统计（2026-11-16，与网站同一套规则）
// 匿名、按天汇总：只上报「事件名 + 影片/专题 id 或页面名」，不上报搜索词、个人档案和 openid。
// 访客标识每天在本机重新随机生成（sk-stat-vid），只用来数当天的设备数，跨天无法关联。
// 先存在内存里，满 40 条或小程序切到后台（app.js onHide）时，经 psync 云函数（action 'stat'）一次性上报。
// 开发版 / 体验版不上报；后端还没建好（云函数返回失败）时本次启动内不再尝试。
const q = [];
let off = false;
function env() { try { return wx.getAccountInfoSync().miniProgram.envVersion; } catch (e) { return 'release'; } }
function vid() {
  const day = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
  let o = {}; try { o = wx.getStorageSync('sk-stat-vid') || {}; } catch (e) { }
  if (o.d !== day || !/^[a-z0-9]{8,32}$/.test(o.v || '')) {
    let v = ''; for (let i = 0; i < 16; i++) v += Math.floor(Math.random() * 36).toString(36);
    o = { d: day, v }; try { wx.setStorageSync('sk-stat-vid', o); } catch (e) { }
  }
  return o.v;
}
function flush() {
  if (off || !q.length || !wx.cloud || env() !== 'release') { if (env() !== 'release') q.length = 0; return; }
  const evs = q.splice(0, 60);
  wx.cloud.callFunction({ name: 'psync', data: { action: 'stat', vid: vid(), evs } })
    .then(r => { if (!r.result || !r.result.ok) off = true; }).catch(() => { off = true; });
}
function stat(e, k) {
  if (off) return;
  q.push({ e, k: String(k == null ? '' : k).replace(/[^A-Za-z0-9_:.\-]/g, '').slice(0, 80) });
  if (q.length >= 40) flush();
}
module.exports = { stat, flush };
