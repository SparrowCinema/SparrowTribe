// 场次变更记录（2026-11-18）：部署时运行，产物 data/changes.json 不提交（已在 .gitignore）。
// 按 git 历史逐版比对 data/programmes/*.json 里的场次编号 sid（tools/assign-sids.js），得出：
//   - 改期 / 换厅 / 换影院：同一个 sid 的场次键变了
//   - 取消：sid 消失了（同一提交里同一部影片在同专题新增了一场、且旧场被删，视为「删了重加」的改期）
// 输出：
//   moves  { 旧场次键: {to: 现在的场次键 或 null(已取消), f: 影片id, sid, was: {d,t,v,h} 旧场次, reused?: 1 旧键已被别的场次占用} }
//          —— 网站 / 小程序据此自动更新个人排片、分享链接、订阅提醒
//   items  [{ sid, p 专题, f 影片, from, to, kinds:['date'|'time'|'venue'|'hall'], at 变更时间 }]  —— 用来显示「改到了几点」
// 需要完整的 git 历史（工作流 checkout 用 fetch-depth: 0）；读不到历史时只输出空记录，不影响部署。
// 用法：node tools/build-changes.js [--days 120] [--print]
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const DAYS = +arg('--days', 120);
const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
const keyOf = r => `${r.d}-${r.t}-${r.v}-${r.h}`;
const rowsOf = (text, p) => {
  let pk; try { pk = JSON.parse(text); } catch (e) { return null; }
  const out = [];
  (pk.shows || []).forEach(r => { if (Array.isArray(r) && r.length >= 6 && r[5]) out.push({ sid: r[5], d: r[0], t: r[1], f: r[2], v: r[3], h: r[4], p }); });
  return out;
};
const progOf = file => path.basename(file, '.json');

function main() {
  let commits = [];
  try {
    git('rev-parse', '--git-dir');
    const log = git('log', '--reverse', '--format=@%H|%cI', '--name-only', '--since=' + DAYS + '.days', '--', 'data/programmes');
    let cur = null;
    log.split('\n').forEach(line => {
      if (line.startsWith('@')) { const [h, at] = line.slice(1).split('|'); cur = { h, at, files: [] }; commits.push(cur); }
      else if (line.trim() && cur && line.endsWith('.json')) cur.files.push(line.trim());
    });
  } catch (e) { console.warn('读不到 git 历史，变更记录为空：', e.message.split('\n')[0]); commits = []; }
  // 每个提交只重读它改动的文件，其余沿用上一版
  const files = {}; // file → rows
  let prev = null; // sid → row（上一版全量）
  const hist = new Map(); // sid → { keys:Set, last:row|null, p, f, events:[] }
  const snap = () => { const m = new Map(); Object.values(files).forEach(rows => (rows || []).forEach(r => m.set(r.sid, r))); return m; };
  const diff = (a, b, at) => {
    const gone = [], born = [];
    a.forEach((r, sid) => { const n = b.get(sid); if (!n) gone.push(r); else if (keyOf(n) !== keyOf(r)) event(r, n, at); });
    b.forEach((r, sid) => { if (!a.has(sid)) born.push(r); });
    // 删了重加：同专题同影片，一删一增，按时间最接近配对
    gone.forEach(g => {
      const i = born.findIndex(n => n.p === g.p && n.f === g.f);
      if (i >= 0) { const n = born.splice(i, 1)[0]; event(g, n, at, true); alias(n.sid, g.sid); }
      else event(g, null, at);
    });
  };
  const H = sid => { if (!hist.has(sid)) hist.set(sid, { keys: new Map(), events: [] }); return hist.get(sid); };
  const part = r => ({ d: r.d, t: r.t, v: r.v, h: r.h });
  const alias = (newSid, oldSid) => { const o = H(oldSid), n = H(newSid); o.keys.forEach((v, k) => n.keys.set(k, v)); n.events.unshift(...o.events); hist.delete(oldSid); };
  const event = (from, to, at, rebuilt) => {
    const h = H(from.sid); h.keys.set(keyOf(from), part(from)); if (to) h.keys.set(keyOf(to), part(to));
    const kinds = to ? ['d', 't', 'v', 'h'].filter(k => from[k] !== to[k]).map(k => ({ d: 'date', t: 'time', v: 'venue', h: 'hall' })[k]) : ['cancel'];
    h.events.push({ sid: to ? to.sid : from.sid, p: from.p, f: from.f, from: keyOf(from), to: to ? keyOf(to) : null, kinds, at, rebuilt: !!rebuilt });
  };
  const step = (readFile, list, at) => {
    list.forEach(f => { const t = readFile(f); files[f] = t == null ? null : rowsOf(t, progOf(f)); });
    const now = snap();
    if (now.size && prev && prev.size) diff(prev, now, at);
    if (now.size) prev = now;
  };
  // 历史基线：窗口开始前的那一版
  if (commits.length) {
    try {
      const base = git('rev-parse', commits[0].h + '^').trim();
      const list = git('ls-tree', '--name-only', base, 'data/programmes/').split('\n').filter(f => f.endsWith('.json'));
      list.forEach(f => { try { files[f] = rowsOf(git('show', base + ':' + f), progOf(f)); } catch (e) { } });
      const s = snap(); if (s.size) prev = s;
    } catch (e) { /* 窗口从仓库第一个提交开始 */ }
  }
  commits.forEach(c => step(f => { try { return git('show', c.h + ':' + f); } catch (e) { return null; } }, c.files, c.at));
  // 工作区（本地未提交的改动；部署时与最新提交相同）
  const wt = fs.readdirSync(path.join(root, 'data/programmes')).filter(f => f.endsWith('.json')).map(f => 'data/programmes/' + f);
  Object.keys(files).filter(f => !wt.includes(f)).forEach(f => { files[f] = null; });
  step(f => fs.readFileSync(path.join(root, f), 'utf8'), wt, new Date().toISOString());

  const current = prev || new Map(), live = new Set([...current.values()].map(keyOf));
  const moves = {}, items = [];
  hist.forEach((h, sid) => {
    const cur = current.get(sid) || null, to = cur ? keyOf(cur) : null;
    h.keys.forEach((was, k) => { if (k !== to) moves[k] = { to, f: (cur || h.events[0] || {}).f, sid, was }; });
    if (h.events.length) { const last = h.events[h.events.length - 1], first = h.events[0]; items.push({ sid, p: last.p, f: last.f, from: first.from, to, kinds: [...new Set(h.events.flatMap(e => e.kinds))].filter(k => to || k === 'cancel'), at: last.at }); }
  });
  // 旧键被别的场次重新占用：只在用户本机记录的影片对不上时才迁移（客户端判断），这里标出
  Object.keys(moves).forEach(k => { if (live.has(k)) moves[k].reused = 1; });
  const out = { generated: new Date().toISOString(), days: DAYS, moves, items: items.sort((a, b) => (a.at < b.at ? 1 : -1)) };
  fs.writeFileSync(path.join(root, 'data/changes.json'), JSON.stringify(out));
  console.log(`场次变更记录：${commits.length} 个数据提交，${items.length} 场有变动（改期 ${items.filter(i => i.to).length}、取消 ${items.filter(i => !i.to).length}），${Object.keys(moves).length} 个旧场次键`);
  if (process.argv.includes('--print')) console.log(JSON.stringify(out, null, 1));
}
main();
