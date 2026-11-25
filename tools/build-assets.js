// 部署时运行（GitHub Actions，改动不提交）：
// 1. 把 index.html 里 <!-- app-js:start --> … <!-- app-js:end --> 列出的 js/*.js 按顺序拼成一个 app.js（和拆分前的单文件等价）；
// 2. 给 app.css / app.js 引用加上内容哈希 ?v=…；
// 3. 把这个版本写进 sw.js 的 BUILD（见下方），代码更新后桌面 App 会自动刷新。
// 带 ?v 的文件由 service worker 按「缓存优先」处理，内容一变网址就变，所以既能长期缓存又不会用到旧代码；
// 本地预览不用跑这个脚本：index.html 直接逐个加载 js/*.js，不带 ?v 时 service worker 按「网络优先」取最新文件。
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { jsFiles, appJS } = require('./web-source');
const root = path.join(__dirname, '..'), file = path.join(root, 'index.html');
const hash = n => crypto.createHash('sha1').update(fs.readFileSync(path.join(root, n))).digest('hex').slice(0, 10);
let html = fs.readFileSync(file, 'utf8');
const files = jsFiles(html);
fs.writeFileSync(path.join(root, 'app.js'), appJS(html));
let n = 0;
html = html.replace(/(<link rel="stylesheet" href="app\.css)(?:\?[^"]*)?(">)/, (m, a, b) => { n++; return a + '?v=' + hash('app.css') + b; })
           .replace(/<!-- app-js:start -->[\s\S]*?<!-- app-js:end -->/, () => { n++; return '<script src="app.js?v=' + hash('app.js') + '"></script>'; });
if (n !== 2) throw new Error('index.html 里没找到 app.css / app-js 段落');
fs.writeFileSync(file, html);
// 3. 把网站代码版本写进 sw.js：sw.js 内容一变，浏览器就会装新的 service worker，已装到桌面的 App（iOS 常从后台恢复、不重新打开页面）
//    切回前台时由 js/install.js 的 controllerchange 自动刷新到新版本。只改 BUILD 不改缓存名，海报等运行时缓存不会被清空。
{ const swf = path.join(root, 'sw.js'), build = hash('app.js') + hash('app.css') + hash('index.html').slice(0, 6);
  const sw = fs.readFileSync(swf, 'utf8'), out = sw.replace(/const BUILD = "[^"]*";/, 'const BUILD = "' + build + '";');
  if (out === sw && !sw.includes('const BUILD = "' + build + '";')) throw new Error('sw.js 里没找到 const BUILD');
  fs.writeFileSync(swf, out); }
console.log('合并 ' + files.length + ' 个脚本 → app.js?v=' + hash('app.js') + '（' + Math.round(fs.statSync(path.join(root, 'app.js')).size / 1024) + 'KB）  app.css?v=' + hash('app.css'));
