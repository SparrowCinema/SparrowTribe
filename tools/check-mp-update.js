// 小程序新版本提示（miniprogram/utils/update.js）：新版下载好后弹窗，确认才重启；接口缺失或报错时不影响启动
const assert = require('assert');
const U = require('../miniprogram/utils/update.js');
function fakeWx(confirm) {
  const s = { modals: [], applied: 0, ready: null, failed: null };
  s.wx = { getUpdateManager: () => ({ onUpdateReady: f => { s.ready = f; }, onUpdateFailed: f => { s.failed = f; }, applyUpdate: () => { s.applied++; } }),
    showModal: o => { s.modals.push(o); o.success && o.success({ confirm }); } };
  return s;
}
let s = fakeWx(true);
assert.strictEqual(U.check(s.wx, t => '[' + t + ']'), true);
assert.strictEqual(s.modals.length, 0, 'no prompt before the update is downloaded');
s.ready();
assert.strictEqual(s.modals.length, 1); assert.strictEqual(s.modals[0].title, '[发现新版本]'); assert.strictEqual(s.applied, 1, 'restart on confirm');
s = fakeWx(false); U.check(s.wx); s.ready(); assert.strictEqual(s.applied, 0, 'no restart when the user picks Later');
s.failed && s.failed();                                                     // 下载失败不报错
assert.strictEqual(U.check({}), false);                                     // 低版本基础库没有接口
assert.strictEqual(U.check({ getUpdateManager() { throw Error('x'); } }), false);
assert.strictEqual(U.check(null), false);
const app = require('fs').readFileSync(require('path').join(__dirname, '../miniprogram/app.js'), 'utf8');
assert(/require\('\.\/utils\/update\.js'\)\.check\(wx, I\.tr\)/.test(app), 'app.js onLaunch calls the update check');
console.log('PASS: mini-program update prompt — waits for download, restarts only on confirm, safe without the API.');
