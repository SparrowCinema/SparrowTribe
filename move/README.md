# 麻雀观影护照 · 旧网址搬家页

由 SparrowCinema/SparrowTribe 仓库的 `node tools/build-bridge.js` 生成，不要直接改这里的文件。

- `move.html`：新网址 https://sparrowcinema.org 第一次打开时会整页跳到这里，读出旧网址（sparrowcinema.github.io）浏览器里的观影记录，
  通过网址 # 片段带回新网址。数据只在用户浏览器里传递，不上传服务器；只会交给 https://sparrowcinema.org、https://www.sparrowcinema.org。
- `move-check.js`：新网址先加载它，确认搬家页可用后才跳转，避免用户停在 404 页。
- `index.html`：sparrowcinema.github.io 根地址跳到新网址。

**不要给这个仓库绑定自定义域名**：否则 sparrowcinema.github.io 整个源都会跳转，搬家页就读不到旧记录了。
