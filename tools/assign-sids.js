// 给场次补固定编号 sid（2026-11-18）：场次行 [日期, 时间, 影片id, 影院id, 影厅id] 的第 6 位。
// 编号在第一次补上时由「专题 + 场次键 + 影片」算出，之后改时间、改影厅、换影院都**保留原编号**，
// 部署时 tools/build-changes.js 按编号比对历史，生成改期 / 取消记录，网站和小程序据此自动更新个人排片。
//
// 用法：node tools/assign-sids.js          给缺编号的场次补上（已有编号的不动，可重复运行）
//       node tools/assign-sids.js --check  只检查，不写文件（check-sids.js 调用）
// 维护数据时：改已有场次的时间 / 影厅，直接改前 5 位，第 6 位编号不要动；新增场次可以先不写编号，运行本脚本补上。
// 只在文本里给缺编号的行插入一行，不重排整个文件，差异里只多出编号。
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..');
const cat = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog.json'), 'utf8'));
const CHECK = process.argv.includes('--check');
const SID_RE = /^s[0-9a-z]{6,12}$/;
const make = (pid, r, n) => 's' + BigInt('0x' + crypto.createHash('sha1').update([pid, r[0], r[1], r[2], r[3], r[4], n || ''].join('|')).digest('hex').slice(0, 12)).toString(36).slice(0, 8);

function scan() {
  const all = new Map(), files = [];
  for (const p of cat.programmes) {
    if (!p.file) continue;
    const file = path.join(root, p.file), text = fs.readFileSync(file, 'utf8'), pk = JSON.parse(text);
    (pk.shows || []).forEach((r, i) => {
      if (!Array.isArray(r) || r.length < 5) throw new Error(`${p.file} 第 ${i + 1} 场不是完整的 [日期, 时间, 影片, 影院, 影厅]`);
      if (r.length > 5) {
        if (!SID_RE.test(r[5])) throw new Error(`${p.file} 第 ${i + 1} 场的编号 ${JSON.stringify(r[5])} 格式不对`);
        if (all.has(r[5])) throw new Error(`场次编号重复：${r[5]}（${all.get(r[5])} 与 ${p.file} 第 ${i + 1} 场）`);
        all.set(r[5], p.file + ' 第 ' + (i + 1) + ' 场');
      }
    });
    files.push({ p, file, text, pk });
  }
  return { all, files };
}

const { all, files } = scan();
let added = 0, missing = 0;
for (const { p, file, text, pk } of files) {
  const need = (pk.shows || []).filter(r => r.length === 5);
  if (!need.length) continue;
  missing += need.length;
  if (CHECK) continue;
  // 依次找到 "shows" 段里只有 5 项的场次行，在最后一项后面插入编号
  const start = text.indexOf('"shows"');
  if (start < 0) throw new Error(p.file + ' 找不到 shows');
  let k = 0;
  const row = /\[(\s*)("(?:[^"\\]|\\.)*")(\s*),(\s*)("(?:[^"\\]|\\.)*")\s*,\s*("(?:[^"\\]|\\.)*")\s*,\s*("(?:[^"\\]|\\.)*")\s*,\s*("(?:[^"\\]|\\.)*")(\s*)\]/g;
  const head = text.slice(0, start), body = text.slice(start);
  const out = body.replace(row, (m, ws1, a, ws2, ws3, b, c, d, e, wsEnd) => {
    const r = [a, b, c, d, e].map(x => JSON.parse(x));
    let n = 0, sid = make(p.id, r);
    while (all.has(sid)) sid = make(p.id, r, ++n);
    all.set(sid, p.file);
    k++; added++;
    const sep = m.slice(m.indexOf(e) + e.length, m.length - 1 - wsEnd.length); // e 后面到 ] 之前（应为空）
    return m.slice(0, m.length - 1 - wsEnd.length) + sep + ',' + ws1 + JSON.stringify(sid) + wsEnd + ']';
  });
  if (k !== need.length) throw new Error(`${p.file}：需要补 ${need.length} 个编号，文本里只找到 ${k} 行，请检查格式`);
  const result = head + out;
  const check = JSON.parse(result);
  if (check.shows.length !== pk.shows.length || check.shows.some((r, i) => r.slice(0, 5).join('|') !== pk.shows[i].slice(0, 5).join('|') || !SID_RE.test(r[5]))) throw new Error(p.file + '：写入结果与原数据不一致，已放弃');
  fs.writeFileSync(file, result);
}
if (CHECK) {
  if (missing) { console.error(`有 ${missing} 场没有场次编号：请运行 node tools/assign-sids.js 补上（改已有场次时请保留原编号）`); process.exit(1); }
  console.log('场次编号齐全，共 ' + all.size + ' 场，无重复');
} else console.log(added ? `已补 ${added} 个场次编号，现共 ${all.size} 场` : `场次编号齐全，共 ${all.size} 场`);
