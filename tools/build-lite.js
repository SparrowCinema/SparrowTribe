// 部署时生成（GitHub Actions 里运行，生成物不提交）：
//  data/lite.json    启动用的精简数据：全部专题的影片与场次，去掉只有影片详情页才用到的长文字段（DETAIL）。
//  data/version.json 数据版本号（catalog + 各专题文件内容的哈希）。网页每分钟只读这个小文件，版本没变就不再下载数据。
// 影片详情页打开时再按需读取该片所在的 data/programmes/<专题id>.json 补全长文字段（index.html 的 ensureFull）。
// 没有这两个文件时（本地直接预览、未跑本脚本）网页自动退回原来的整份加载，功能不受影响。
// 本地预览：node tools/build-lite.js
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..');
// 与 index.html 的 LITE_DETAIL 保持一致；这些字段只在影片详情页显示
const DETAIL = ['syn', 'bio', 'st', 'parts', 'contentReview', 'contentNote', 'editorial', 'highlights'];
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const catText = read('data/catalog.json'), cat = JSON.parse(catText);
const h = crypto.createHash('sha1').update(catText);
const packs = {};
let full = Buffer.byteLength(catText), films = 0;
(cat.programmes || []).forEach(p => {
  if (!p.file) return;
  const text = read(p.file); h.update('\n' + p.id + '\n' + text); full += Buffer.byteLength(text);
  const pk = JSON.parse(text);
  pk.films = (pk.films || []).map(f => { const o = Object.assign({}, f); DETAIL.forEach(k => { delete o[k]; }); o._lite = 1; films++; return o; });
  packs[p.id] = pk;
});
const v = h.digest('hex').slice(0, 16);
const lite = JSON.stringify({ v, detail: DETAIL, packs });
fs.writeFileSync(path.join(root, 'data/lite.json'), lite);
fs.writeFileSync(path.join(root, 'data/version.json'), JSON.stringify({ v }));
// 自检：精简数据里不能再有长文字段，影片数量与原文件一致
const back = JSON.parse(lite); let n = 0;
Object.values(back.packs).forEach(pk => pk.films.forEach(f => { n++; DETAIL.forEach(k => { if (k in f) throw new Error('lite.json 仍含字段 ' + k + '：' + f.id); }); }));
if (n !== films) throw new Error('lite.json 影片数量不一致');
console.log(`lite.json ${(Buffer.byteLength(lite) / 1024).toFixed(0)}KB（原数据 ${(full / 1024).toFixed(0)}KB，${films} 部影片），version ${v}`);
