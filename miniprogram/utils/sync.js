// 个人档案同步码（与网站共用）：看过记录、评分、护照照片、持有人、个人排片。
// 通过 psync 云函数与 Supabase 合并；合并规则见 psync.js。
const S = require('./psync.js');
const Backup=require('./profile-backup.js');
const W = require('./watched.js');
const plan = require('./plan.js');
const KEY = 'sk-sync';
let busy = null, applying = false, clearing = false, timer = 0;
const status = { state: 'idle', msg: '', at: 0 };
const listeners = [];

const state = () => { try { return wx.getStorageSync(KEY) || null; } catch (e) { return null; } };
const setState = v => { try { v ? wx.setStorageSync(KEY, v) : wx.removeStorageSync(KEY); } catch (e) { } };
const emit = () => listeners.forEach(fn => fn());
const onStatus = fn => { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; };
const call = data => wx.cloud.callFunction({ name: 'psync', data }).then(r => r.result || {});

function photoB64() {
  const p = W.photo(); if (!p) return '';
  try { return 'data:image/jpeg;base64,' + wx.getFileSystemManager().readFileSync(p, 'base64'); } catch (e) { return ''; }
}
function snapshot() {
  const m = W.meta();
  return { v: 1, watched: W.all(), holder: { n: W.holder(), t: m.holder || 0 }, photo: { d: photoB64(), t: m.photo || 0 }, picks: { k: [...plan.get()], t: m.picks || 0 } };
}
function apply(d) {
  applying = true;
  try {
    W.replaceAll(d.watched);
    W.setHolder(d.holder.n, true);
    const old = W.photo(), fs = wx.getFileSystemManager();
    if (d.photo.d) {
      const cur = photoB64();
      if (cur !== d.photo.d) {
        const path = wx.env.USER_DATA_PATH + '/holder-' + Date.now() + '.jpg';
        fs.writeFileSync(path, d.photo.d.replace(/^data:image\/jpeg;base64,/, ''), 'base64');
        W.setPhoto(path, true); if (old) { try { fs.unlinkSync(old); } catch (e) { } }
      }
    } else if (old) { W.setPhoto('', true); try { fs.unlinkSync(old); } catch (e) { } }
    plan.replace(d.picks.k);
    W.setMeta({ holder: d.holder.t, photo: d.photo.t, picks: d.picks.t });
  } finally { applying = false; }
}

function run() {
  const st = state(); if (!st || !st.code) return Promise.resolve();
  status.state = 'busy'; emit();
  return call({ action: 'sync', code: st.code, state: snapshot() }).then(r => {
    if (!r.ok) throw new Error(r.msg || 'fail');
    if (r.changed) apply(S.clean(r.merged));
    setState(Object.assign({}, st, { rev: r.rev, at: Date.now() }));
    status.state = 'ok'; status.msg = ''; status.at = Date.now(); emit(); return r;
  }).catch(e => { status.state = 'error'; status.msg = (e && (e.message || e.errMsg)) || String(e); emit(); throw e; });
}
function sync() { if(clearing)return Promise.resolve();if (busy) return busy; busy = run().finally(() => { busy = null; }); return busy; }
const quiet = () => sync().catch(() => { });
function start() {
  return call({ action: 'new' }).then(r => { if (!r.code) throw new Error('fail'); setState({ code: r.code, rev: 0, at: 0 }); return sync(); });
}
function join(input) {
  const code = S.normalize(input); if (!code) return Promise.reject(new Error('bad'));
  setState({ code, rev: 0, at: 0 }); return sync();
}
function stop() { setState(null); status.state = 'idle'; status.msg = ''; status.at = 0; emit(); }
// 本机有改动时 3 秒后自动同步；应用从后台回来或进入「我的」页时拉取一次
function changed() { if (applying||clearing) return; const st = state(); if (!st || !st.code) return; clearTimeout(timer); timer = setTimeout(quiet, 3000); }
function init() { W.onChange(changed); plan.onChange(changed); const st = state(); if (st && st.code) quiet(); }
function stale() { const st = state(); return !!(st && st.code && Date.now() - (st.at || 0) > 30000); }

async function restore(value){if(busy)await busy;const next=Backup.restore(snapshot(),value);apply(next);changed();}
async function clearCloud(){if(clearing)return;if(busy)await busy;await sync();clearing=true;clearTimeout(timer);try{const st=state();if(!st?.code)throw new Error('No sync code');const empty=Backup.empty(snapshot()),r=await call({action:'sync',code:st.code,state:empty});if(!r.ok)throw new Error('Cloud clear failed');stop();}finally{clearing=false;}}
module.exports = { snapshot,restore,clearCloud,state, status, onStatus, sync, quiet, start, join, stop, init, stale, normalize: S.normalize };
