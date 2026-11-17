// 微信订阅消息（模板「电影上映提醒」，一次性订阅），配合 remind 云函数。
// - 加入排片时：请求订阅，允许后开场前 1 小时发提醒；场次时间 / 影厅变了改发变更通知。
// - 标想看时：请求订阅，这部影片出现新场次时通知一次。
// - 移出排片 / 取消想看时撤销（不弹窗）。
// wx.requestSubscribeMessage 只能在点击事件里同步调用，所以模板 ID 先存在本机（sk-remind-tmpl），启动时向云函数核对一次。
// 用户在弹窗里拒绝后，7 天内加入排片 / 想看时不再自动弹（sk-remind-no）；个人排片页的「开场提醒」按钮仍可手动开启。
// 已开启的订阅记在本机 sk-remind-v1：{s:{场次键:时间}, w:{影片id:时间}}，打开个人排片页时用云端列表校正。
const I = require('./i18n.js');
const TMPL = '0bOfTP5aSMTerLMnmJPTlYI9Tl36Dcm_6HbK-7H-B38';
const K = 'sk-remind-v1', KT = 'sk-remind-tmpl', KN = 'sk-remind-no';
const get = (k, d) => { try { return wx.getStorageSync(k) || d; } catch (e) { return d; } };
const put = (k, v) => { try { wx.setStorageSync(k, v); } catch (e) { } };
const env = () => { try { return wx.getAccountInfoSync().miniProgram.envVersion; } catch (e) { return 'release'; } };
const call = data => wx.cloud ? wx.cloud.callFunction({ name: 'remind', data }).then(r => r.result || {}) : Promise.resolve({ ok: false });
const tmpl = () => get(KT, {}).id || TMPL;
function syncTmpl() { const o = get(KT, {}); if (o.t && Date.now() - o.t < 864e5) return; call({ action: 'tmpl' }).then(r => { if (r.ok && r.id) put(KT, { id: r.id, t: Date.now() }); }).catch(() => { }); }
function state() { const o = get(K, {}); o.s = o.s || {}; o.w = o.w || {}; return o; }
function mark(kind, id, on) { const o = state(), m = kind === 'want' ? o.w : o.s; if (on) m[id] = Date.now(); else delete m[id]; put(K, o); }
const has = key => !!state().s[key];
const hasWant = film => !!state().w[film];

// p：{kind:'show', key, film} 或 {kind:'want', film}；auto：由加入排片 / 想看顺带触发（拒绝过 7 天内不弹）
// done(ok)：开启成功后回调
function ask(p, auto, done) {
  if (!wx.requestSubscribeMessage || !wx.cloud) return;
  if (auto && Date.now() - (get(KN, 0) || 0) < 7 * 864e5) return;
  const id = tmpl();
  wx.requestSubscribeMessage({
    tmplIds: [id],
    success: res => {
      if (res[id] !== 'accept') { if (res[id] === 'reject') put(KN, Date.now()); return; }
      call(Object.assign({ action: 'add', env: env() }, p)).then(r => {
        if (r.ok) { mark(p.kind, p.kind === 'want' ? p.film : p.key, true); wx.showToast({ title: I.tr(p.kind === 'want' ? '有新场次时微信通知你' : '开场前 1 小时微信提醒'), icon: 'none' }); done && done(true); }
        else if (r.msg === 'too late') wx.showToast({ title: I.tr('离开场不到 15 分钟，来不及提醒了'), icon: 'none' });
      }).catch(() => { });
    },
    fail: () => { } // 用户关闭了订阅消息总开关等：不打扰
  });
}
function cancel(p) {
  const id = p.kind === 'want' ? p.film : p.key;
  if (!(p.kind === 'want' ? hasWant(id) : has(id))) return;
  mark(p.kind, id, false); call(Object.assign({ action: 'cancel' }, p)).catch(() => { });
}
// 用云端仍在等待的订阅校正本机记录（已发出、已过期的会消失）
function refresh(cb) {
  call({ action: 'list' }).then(r => { if (!r.ok) return; const o = { s: {}, w: {} }; (r.list || []).forEach(x => { if (x.kind === 'want') o.w[x.film] = 1; else if (x.key) o.s[x.key] = 1; }); put(K, o); cb && cb(); }).catch(() => { });
}
module.exports = { TMPL, tmpl, syncTmpl, ask, cancel, has, hasWant, refresh };
