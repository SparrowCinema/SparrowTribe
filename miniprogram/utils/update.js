// 小程序新版本提示（2026-11-26）：新版审核发布后，微信在后台下载，默认要到下一次冷启动才换成新版，
// 用户可能好几次打开都还是旧版。这里在新版下载好时弹窗问要不要马上重启；选「稍后」也没关系，下次冷启动会自动用新版。
// 在 app.js 的 onLaunch 里调用 check(wx, I.tr)。
function check(w, tr) {
  tr = tr || (s => s);
  if (!w || typeof w.getUpdateManager !== 'function') return false;
  let um = null;
  try { um = w.getUpdateManager(); } catch (e) { return false; }
  if (!um) return false;
  um.onUpdateReady(() => {
    w.showModal({
      title: tr('发现新版本'),
      content: tr('新版本已经准备好，重启小程序就能用上。现在重启吗？'),
      confirmText: tr('马上重启'),
      cancelText: tr('稍后'),
      success: r => { if (r && r.confirm) { try { um.applyUpdate(); } catch (e) { } } }
    });
  });
  if (typeof um.onUpdateFailed === 'function') um.onUpdateFailed(() => { }); // 下载失败：不打扰，下次启动微信会再试
  return true;
}
module.exports = { check };
