#!/usr/bin/env node
/* 生成换域名用的「搬家页」（docs/domain-move.md）：node tools/build-bridge.js
   产物在 move/，要放到旧源上一个不会被 301 的位置：仓库 SparrowCinema/sparrowcinema.github.io 的根目录
   （网址 https://sparrowcinema.github.io/move.html）。本仓库绑定自定义域名后，sparrowcinema.github.io/SparrowTribe/* 会被 GitHub 整站跳转，
   但同一个源下其他仓库的页面不会，而 localStorage 按源共享，所以搬家页读得到旧网址上的记录。
   改了 shared/domain-move.js 后重新运行并把 move/ 下的文件同步到那个仓库；tools/check-domain-move.js 会检查产物是否最新。 */
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'move');
const lib = fs.readFileSync(path.join(root, 'shared/domain-move.js'), 'utf8');
const M = require('../shared/domain-move.js').MOVE;

const bridge = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta name="referrer" content="no-referrer">
<title>麻雀观影护照 · 正在搬到新网址</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:15px/1.7 -apple-system,BlinkMacSystemFont,"PingFang SC","Noto Sans SC",sans-serif;background:#efe6d4;color:#2a211a;text-align:center}p{margin:0 24px}small{color:#7a6b5c}</style>
</head><body>
<p>正在把本机的观影记录搬到新网址…<br><small>只在你的浏览器里搬运，不经过任何服务器。</small></p>
<noscript><p>请开启 JavaScript，或直接打开 <a href="${M.to}/">${M.to.replace('https://', '')}</a></p></noscript>
<script>
${lib}
</script>
<script>
(function(){
  var go = function(){ location.replace(${JSON.stringify(M.to + '/')}); };
  try { SparrowMove.runBridge({ ls: localStorage, location: location })["catch"](go); } catch (e) { go(); }
})();
</script>
</body></html>
`;

const check = `/* 新网址用它确认搬家页已部署（shared/domain-move.js 的 probe） */\nwindow.__spMoveOK = 1;\n`;

const index = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>麻雀观影护照 · Sparrow Cinema</title>
<link rel="canonical" href="${M.to}/">
<meta http-equiv="refresh" content="0; url=${M.to}/">
</head><body>
<p>麻雀观影护照已搬到 <a href="${M.to}/">${M.to.replace('https://', '')}</a></p>
<script>location.replace(${JSON.stringify(M.to + '/')} + location.search + location.hash);</script>
</body></html>
`;

const readme = `# 麻雀观影护照 · 旧网址搬家页

由 SparrowCinema/SparrowTribe 仓库的 \`node tools/build-bridge.js\` 生成，不要直接改这里的文件。

- \`move.html\`：新网址 ${M.to} 第一次打开时会整页跳到这里，读出旧网址（sparrowcinema.github.io）浏览器里的观影记录，
  通过网址 # 片段带回新网址。数据只在用户浏览器里传递，不上传服务器；只会交给 ${M.targets.join('、')}。
- \`move-check.js\`：新网址先加载它，确认搬家页可用后才跳转，避免用户停在 404 页。
- \`index.html\`：sparrowcinema.github.io 根地址跳到新网址。

**不要给这个仓库绑定自定义域名**：否则 sparrowcinema.github.io 整个源都会跳转，搬家页就读不到旧记录了。
`;

fs.mkdirSync(out, { recursive: true });
const files = { 'move.html': bridge, 'move-check.js': check, 'index.html': index, 'README.md': readme };
if (process.argv.includes('--check')) {
  const stale = Object.keys(files).filter(f => !fs.existsSync(path.join(out, f)) || fs.readFileSync(path.join(out, f), 'utf8') !== files[f]);
  if (stale.length) { console.error('move/ 不是最新，请运行 node tools/build-bridge.js：' + stale.join(', ')); process.exit(1); }
  console.log('PASS: move/ bridge files are up to date.');
} else {
  for (const f in files) fs.writeFileSync(path.join(out, f), files[f]);
  console.log('wrote move/: ' + Object.keys(files).join(', '));
}
