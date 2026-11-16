// 部署时运行（GitHub Actions，改动不提交）：给 index.html 里的 app.css / app.js 引用加上内容哈希 ?v=…。
// 带 ?v 的文件由 service worker 按「缓存优先」处理，内容一变网址就变，所以既能长期缓存又不会用到旧代码；
// 本地预览不用跑这个脚本，不带 ?v 时 service worker 按「网络优先」取最新文件。
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..'), file = path.join(root, 'index.html');
const hash = n => crypto.createHash('sha1').update(fs.readFileSync(path.join(root, n))).digest('hex').slice(0, 10);
let html = fs.readFileSync(file, 'utf8'), n = 0;
html = html.replace(/(<link rel="stylesheet" href="app\.css)(?:\?[^"]*)?(">)/, (m, a, b) => { n++; return a + '?v=' + hash('app.css') + b; })
           .replace(/(<script src="app\.js)(?:\?[^"]*)?("><\/script>)/, (m, a, b) => { n++; return a + '?v=' + hash('app.js') + b; });
if (n !== 2) throw new Error('index.html 里没找到 app.css / app.js 的引用');
fs.writeFileSync(file, html);
console.log('app.css?v=' + hash('app.css') + '  app.js?v=' + hash('app.js'));
