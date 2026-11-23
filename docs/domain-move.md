# 换域名：sparrowcinema.github.io/SparrowTribe → sparrowcinema.org

域名 `sparrowcinema.org` 在 Porkbun 注册（2026-11-24，已续到 5 年）。本文记录迁移方案和上线步骤。

## 为什么不能直接绑定

1. **网页版的个人记录在浏览器本机**（localStorage：观影记录、评分、典藏票根、个人排片、想看、同步码、护照照片……），浏览器按「源」隔离。换到 `https://sparrowcinema.org` 后是另一个源，直接读不到旧记录，老用户会以为记录全没了。
2. **GitHub Pages 绑定自定义域名后，会把 `sparrowcinema.github.io/SparrowTribe/*` 整站 301 到新域名**，旧页面没有机会运行迁移代码。
3. **service worker**：旧版 `sw.js` 对页面「网络优先，失败退回缓存」，而导航请求遇到 301 时拿到的是 `opaqueredirect`（不算成功），会一直退回缓存里的旧页面，老用户停在旧网址。
4. **小程序 getData 云函数**用 `https.get` 读网站数据，不跟随跳转，遇到 301 会失败（只能用旧缓存）。

## 方案（第一阶段，已合并，在新域名生效前不起作用）

- `shared/domain-move.js`：网站、搬家页、测试共用。
  - **搬家页** `move.html` 放在旧源上一个不会被 301 的位置：组织主页仓库 `SparrowCinema/sparrowcinema.github.io` 的根目录（`https://sparrowcinema.github.io/move.html`）。localStorage 按源共享，同源的其他仓库页面读得到 SparrowTribe 写下的记录。产物由 `node tools/build-bridge.js` 生成在 `move/`。
  - **新网址第一次打开**（`index.html` 最前面的加载器）：本机没有用户记录、也没搬过 → 先加载 `move-check.js` 确认搬家页可用（打不开就照常启动，下次会话再试，不会停在 404）→ 整页跳到搬家页（顶层跳转；iframe 里的存储会被浏览器按顶层网站分区，读不到真数据）→ 搬家页读出白名单前缀（`sparrow*`、`sk-*`、`style-kaleidoscope*`）的记录，gzip 后放进网址 `#spmig=` 片段带回（片段不发给服务器；超过 90 万字符分段来回；整份数据有校验）→ 新网址写入、记下 `sparrow-moved-in-v1`，整页重新载入一次并恢复原来的 `#路由`，轻提示「已把旧网址上的本机记录搬到新网址」。
  - 搬家页只会把数据交给 `https://sparrowcinema.org` / `www`，不会交给别的网站；同源的米其林名录等其他应用的记录不会被带走；旧源的数据不删除，留作备份。
  - 新网址上已经有用户记录时不搬，避免旧数据盖掉新数据。手动重搬：网址加 `?move=again`。
  - **旧网址上仍在运行的页面**（被 service worker 缓存的旧页面）：读得到 `https://sparrowcinema.org/move-ready.json` 时转到新网址（保留路由）；主屏幕 App 模式不跳（iOS 主屏幕 App 的存储和浏览器分开，跳过去也带不走），改为顶部常驻提示：先生成同步码，到新网址输入同步码带走记录，再重新添加到主屏幕。
- `sw.js`：导航请求拿到 `opaqueredirect` 时交给浏览器跟随跳转（缓存名 sk-v321）。这一版需要在切换前装进老用户的浏览器，所以先合并。
- `getData` 云函数：跟随最多 3 次 https 跳转。**需要在微信开发者工具重新部署 getData**（切换前完成，切换当天小程序数据就不会断）。
- 测试：`tools/check-domain-move.js`（随 check-companion）；`tools/check-domain-move-browser.js`（真 Chrome，拦截请求模拟两个源，验证 1.2MB 照片分两段完整搬运、路由保留、第二次不再跳、旧页面转到新网址）。

## 第二阶段：上线步骤

进度（2026-11-24）：1–4 已完成（搬家页仓库已建并部署、getData 已重新部署、小程序后台没有配置任何服务器域名所以不用改、域名已在 GitHub 账户验证、DNS 已指向 GitHub Pages）；5 为第二阶段 PR；6 由用户在仓库设置里填写域名。

1. **建搬家页仓库**（用户）：在 GitHub 组织 SparrowCinema 下新建公开仓库 `sparrowcinema.github.io`，Settings → Pages 选 main 分支根目录。把 `move/` 下四个文件放进去（Claude 可代为提交）。打开 `https://sparrowcinema.github.io/move-check.js` 确认能访问。**这个仓库永远不要绑定自定义域名。**
2. **重新部署 getData 云函数**（用户，微信开发者工具）。
3. **小程序后台**（用户）：开发管理 → 服务器域名里如果配置了 `sparrowcinema.github.io`，告诉 Claude，再决定如何处理（新域名可能需要备案才能加入）。
4. **Porkbun DNS**（用户或 Claude 在浏览器里操作）：删掉 Porkbun 默认的停放记录，添加
   - A `@` → `185.199.108.153`、`185.199.109.153`、`185.199.110.153`、`185.199.111.153`
   - AAAA `@` → `2606:50c0:8000::153`、`2606:50c0:8001::153`、`2606:50c0:8002::153`、`2606:50c0:8003::153`
   - CNAME `www` → `sparrowcinema.github.io`
   - 建议在 GitHub 组织 Settings → Pages 验证域名（按提示加一条 TXT 记录），防止别人抢用这个域名的 Pages。
5. **第二阶段 PR**（Claude）：加 `move-ready.json`；网站、小程序、getData、工具脚本里的站点地址 `https://sparrowcinema.github.io/SparrowTribe/` 换成 `https://sparrowcinema.org/`（验真、签到二维码、分享页、日历订阅、og 标签、`check-content` 允许的 posterUrl 前缀等）；更新 CONTRIBUTING。
6. **绑定域名**（用户）：仓库 SparrowTribe → Settings → Pages → Custom domain 填 `sparrowcinema.org`，等证书签发后勾选 Enforce HTTPS（本仓库用 Actions 部署，CNAME 文件不起作用，必须在这里填）。
7. **验收**：新网址正常打开；用一台有旧记录的手机打开新网址，记录都在；旧网址（含 `#film-…`、`#verify=…`）跳到新网址同一页面；getData 日志里读取成功；已印出的验真、签到二维码仍能打开。
8. **小程序新版本**：随下一次常规上传带上新地址（在此之前旧地址会跳转，照常可用）。

## 已知限制

- 只能搬当时这台浏览器里的记录；用户在别的浏览器 / 设备上的记录，各自第一次打开新网址时分别搬（或用同步码）。
- iOS 主屏幕 App 用户需要用同步码带走记录（见上）。
- 浏览器禁用存储（部分无痕模式）时不搬。
