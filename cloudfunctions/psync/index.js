// 个人档案同步码同步：小程序通过本云函数读写 Supabase（与网站、米其林全球名录共用同一个后端）。
// 合并规则见 psync.js（由 tools/build-fallback.js 从 shared/psync.js 复制，请勿直接改）。
// action: 'new' → 生成同步码；'sync' { code, state } → 与云端合并并返回合并结果。
const cloud = require('wx-server-sdk');
const https = require('https');
const crypto = require('crypto');
const S = require('./psync.js');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const HOST = 'dclxhxxjktegyiwafmsv.supabase.co';
const KEY = 'sb_publishable_2K9O3h8nn2I_I-cIAdks8A_QZ98xwZ2'; // 可公开的 publishable key

function rpc(fn, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({ host: HOST, path: '/rest/v1/rpc/' + fn, method: 'POST',
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, res => {
      let b = ''; res.setEncoding('utf8');
      res.on('data', c => { b += c; });
      res.on('end', () => {
        let j = null; try { j = JSON.parse(b); } catch (e) { }
        if (res.statusCode >= 300) return reject(new Error((j && j.message) || ('HTTP ' + res.statusCode)));
        resolve(j);
      });
    });
    req.setTimeout(8000, () => req.destroy(new Error('timeout')));
    req.on('error', reject); req.write(data); req.end();
  });
}

exports.main = async (event) => {
  if (event.action === 'new') return { ok: true, code: S.newCode(n => Array.from(crypto.randomBytes(n))) };
  if (event.action === 'sync') {
    const code = S.normalize(event.code);
    if (!code) return { ok: false, msg: 'bad code' };
    const mine = S.clean(event.state);
    try {
      let merged, rev;
      for (let i = 0; i < 4; i++) {
        const remote = await rpc('mg_pull', { code });
        merged = remote.data ? S.merge(mine, remote.data) : mine;
        if (remote.data && S.same(merged, remote.data)) { rev = remote.rev; break; }
        const r = await rpc('mg_push', { code, data: merged, base_rev: remote.rev || 0 });
        if (r.ok) { rev = r.rev; break; }
      }
      if (rev === undefined) return { ok: false, msg: 'busy' };
      return { ok: true, merged, rev, changed: !S.same(merged, mine) };
    } catch (e) { return { ok: false, msg: String((e && e.message) || e) }; }
  }
  return { ok: false, msg: 'unknown action' };
};
