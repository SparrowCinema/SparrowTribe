// 网站源码读取：主样式在 app.css，主脚本按功能拆在 js/*.js（index.html 里 <!-- app-js:start --> … <!-- app-js:end --> 之间按顺序列出）。
// 检查脚本需要「整页源码」时用 read()：返回把样式和全部脚本按原位置内嵌回去的 HTML（与拆分前的 index.html 等价），
// 这样按源码片段做检查的脚本不用关心代码在哪个文件里。appJS() 返回按加载顺序拼好的主脚本（与部署时生成的 app.js 相同）。
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const f = n => fs.readFileSync(path.join(root, n), 'utf8');
const BLOCK = /<!-- app-js:start -->([\s\S]*?)<!-- app-js:end -->/;
function jsFiles(html = f('index.html')) {
  const m = BLOCK.exec(html);
  if (!m) throw new Error('index.html 里找不到 <!-- app-js:start --> … <!-- app-js:end -->');
  const list = [...m[1].matchAll(/<script src="([^"?]+)"><\/script>/g)].map(x => x[1]);
  if (!list.length) throw new Error('app-js 段落里没有脚本');
  return list;
}
const appJS = html => jsFiles(html).map(f).join('');
function read() {
  const html = f('index.html');
  const css = /<link rel="stylesheet" href="app\.css(?:\?[^"]*)?">/;
  if (!css.test(html)) throw new Error('index.html 里找不到 app.css 的引用');
  const js = appJS(html);
  return html.replace(css, () => '<style>\n' + f('app.css') + '</style>').replace(BLOCK, () => '<script>\n' + js + '</script>');
}
module.exports = { read, jsFiles, appJS };
