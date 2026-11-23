// 个人档案同步码（与网站共用）：看过记录、评分、护照照片、持有人、个人排片、想看、票根收藏册。
// 通过 psync 云函数与 Supabase 合并；合并规则见 psync.js。
const S = require('./psync.js');
const Backup=require('./profile-backup.js');
const W = require('./watched.js');
const Want = require('./want.js');
const MyP = require('./myposter.js');
const plan = require('./plan.js');
const Tix = require('./ticketstore.js');
const Art = require('./ticket-sketch.js');
const artRead = k => wx.getStorageSync(k), artWrite = (k, v) => wx.setStorageSync(k, v);
const KEY = 'sk-sync';
let busy = null, applying = false, clearing = false, timer = 0, dirty = false;
// 连续「云端合并结果和本机不一致」而自动补同步的次数（2026-11-22）：
// 旧版 psync 云函数不认识新字段（如典藏票根的场次序号、封版总数），会把它们清掉再返回，云端永远和本机不一样，
// 以前每次都 1.5 秒后再同步，一直转圈。现在最多补 2 次就停，等本机真的有新改动（changed）再同步。
let echo = 0;
const ECHO_MAX = 2;
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
  return { v: 1, watched: W.all(), holder: { n: W.holder(), t: m.holder || 0 }, photo: { d: photoB64(), t: m.photo || 0 }, picks: { k: [...plan.get()], t: m.picks || 0 }, want: JSON.parse(JSON.stringify(Want.all())), tix: Tix.snapshot(), art: Art.artSnapshot(artRead), pp: JSON.parse(JSON.stringify(MyP.all())) };
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
    if (d.want) Want.replaceAll(d.want);
    // 合并而不是覆盖：旧版 psync 云函数不认识 tix，返回的档案里没有票根，覆盖会清空本机票根（删除靠删除标记合并）
    if (d.tix) Tix.replaceAll(S.mergeTix(Tix.all(), d.tix));
    if (d.art) Art.applyArt(artRead, artWrite, d.art);
    // 我的海报：同样合并而不是覆盖（旧版 psync 云函数不认识 pp）
    if (d.pp) MyP.replaceAll(S.mergePP(MyP.all(), d.pp));
    W.setMeta({ holder: d.holder.t, photo: d.photo.t, picks: d.picks.t });
  } finally { applying = false; }
}

// 云函数报错原文很长且看不懂，转成一句人话（完整原文仍在控制台）
function friendly(m) {
  m = String(m || ''); try { console.warn('[sync]', m); } catch (e) { }
  if (/FUNCTION_NOT_FOUND|-501000|FunctionName/.test(m)) return '云函数 psync 还没部署到当前云环境（需在开发者工具里上传并部署）';
  if (/-501007|INVALID_ENV|env not exist|-501001/.test(m)) return '云开发环境不可用，请检查环境 ID';
  if (/timeout|time out|-504003|-501002/i.test(m)) return '网络超时，稍后再试';
  return m.length > 60 ? m.slice(0, 60) + '…' : m;
}
function run() {
  const st = state(); if (!st || !st.code) return Promise.resolve();
  status.state = 'busy'; emit(); dirty = false;
  return call({ action: 'sync', code: st.code, state: snapshot() }).then(r => {
    if (!r.ok) throw new Error(r.msg || 'fail');
    // 请求在路上时本机可能又改了（比如刚移出一场排片）：云端返回的是按「发出时的旧快照」合并的结果，
    // 直接覆盖会把刚移出的场次又放回来。所以先和「现在的本机」再合并一次（同一项取较新者），本机新改的保留，
    // 只有真的有变化才写回；本机比云端新时再补同步一次把新改动推上去。
    if (r.changed || dirty) {
      const cloud = S.clean(r.merged), local = snapshot(), next = S.merge(local, cloud);
      if (!S.same(next, local)) apply(next);
      if (!S.same(next, cloud)) {
        if (++echo <= ECHO_MAX) dirty = true;
        else { try { console.warn('[sync] 云端返回的档案缺少本机的部分字段（psync 云函数可能需要重新部署），暂停自动补同步'); } catch (e) { } }
      } else echo = 0;
    }
    setState(Object.assign({}, st, { rev: r.rev, at: Date.now() }));
    status.state = 'ok'; status.msg = ''; status.at = Date.now(); emit(); return r;
  }).catch(e => { status.state = 'error'; status.msg = friendly((e && (e.message || e.errMsg)) || String(e)); emit(); throw e; });
}
// 同步进行中本机又有改动（dirty）：这一轮结束后再同步一次，避免改动被正在进行的这一轮吞掉
function sync() { if(clearing)return Promise.resolve();if (busy) return busy; busy = run().finally(() => { busy = null; if (dirty && !clearing) { dirty = false; clearTimeout(timer); timer = setTimeout(quiet, 1500); } }); return busy; }
const quiet = () => sync().catch(() => { });
async function syncBeforeVote() { if (busy) await busy; return sync(); }
const OFF = 'sk-sync-off';
const setOff = v => { try { v ? wx.setStorageSync(OFF, 1) : wx.removeStorageSync(OFF); } catch (e) { } };
const isOff = () => { try { return !!wx.getStorageSync(OFF); } catch (e) { return false; } };
// 微信登录：以微信身份（openid）在云端绑定一串同步码，换手机、重装后自动取回；取不到身份时退回随机同步码
function wxLogin() {
  return call({ action: 'wx' }).then(r => { if (!r.ok || !r.code) throw new Error(r.msg || 'fail'); setOff(false); setState({ code: r.code, rev: 0, at: 0, wx: 1 }); return sync(); });
}
function start() {
  return wxLogin().catch(() => call({ action: 'new' }).then(r => { if (!r.code) throw new Error('fail'); setOff(false); setState({ code: r.code, rev: 0, at: 0 }); return sync(); }));
}
function join(input) {
  const code = S.normalize(input); if (!code) return Promise.reject(new Error('bad'));
  setOff(false); setState({ code, rev: 0, at: 0 });
  // 同步把这个微信账号绑定到该同步码，以后在其他手机用同一微信登录会自动连到同一份档案
  return call({ action: 'bind', code }).then(r => { if (r.ok) setState(Object.assign({}, state(), { wx: 1 })); }, () => { }).then(() => sync());
}
// 扫码连接网站：网站二维码内容为 SPARROW-SYNC:<同步码>（也接受只含同步码的二维码）；返回规范化的同步码，认不出时返回 ''
function fromScan(text) { const m = /SP-[A-Za-z0-9-]+/i.exec(String(text || '')); return m ? (S.normalize(m[0]) || '') : ''; }
function stop() { setOff(true); setState(null); status.state = 'idle'; status.msg = ''; status.at = 0; emit(); }
// 本机有改动时 3 秒后自动同步；应用从后台回来或进入「我的」页时拉取一次
function changed() { if (applying||clearing) return; echo = 0; const st = state(); if (!st || !st.code) return; if (busy) dirty = true; clearTimeout(timer); timer = setTimeout(quiet, 3000); }
function init() { W.onChange(changed); plan.onChange(changed); Want.onChange(changed); Tix.onChange(changed); MyP.onChange(changed); const st = state(); if (st && st.code) quiet(); else if (!isOff() && !clearing) wxLogin().catch(() => { }); }
function stale() { const st = state(); return !!(st && st.code && Date.now() - (st.at || 0) > 30000); }

async function restore(value){if(busy)await busy;const next=Backup.restore(snapshot(),value);apply(next);changed();}
async function clearCloud(){if(clearing)return;if(busy)await busy;await sync();clearing=true;clearTimeout(timer);try{const st=state();if(!st?.code)throw new Error('No sync code');const empty=Backup.empty(snapshot()),r=await call({action:'sync',code:st.code,state:empty});if(!r.ok)throw new Error('Cloud clear failed');stop();}finally{clearing=false;}}
module.exports = { fromScan, snapshot,restore,clearCloud,state, status, onStatus, sync, quiet, syncBeforeVote, start, join, stop, init, stale, normalize: S.normalize };
