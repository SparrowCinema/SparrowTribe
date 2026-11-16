// 网站源码读取：index.html 的主样式和主脚本已拆到根目录的 app.css / app.js。
// 检查脚本需要「整页源码」时用 read()：返回把这两个文件按原位置内嵌回去的 HTML（与拆分前的 index.html 等价），
// 这样按源码片段做检查的脚本不用关心代码在哪个文件里。
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
function read() {
  const f = n => fs.readFileSync(path.join(root, n), 'utf8');
  let html = f('index.html');
  const css = /<link rel="stylesheet" href="app\.css(?:\?[^"]*)?">/, js = /<script src="app\.js(?:\?[^"]*)?"><\/script>/;
  if (!css.test(html) || !js.test(html)) throw new Error('index.html 里找不到 app.css / app.js 的引用');
  return html.replace(css, () => '<style>\n' + f('app.css') + '</style>').replace(js, () => '<script>\n' + f('app.js') + '</script>');
}
module.exports = { read };
