# 深度安静（gr26-032）列入 2026院线新片，不设单元（2026-11-12）

- `data/catalog.json` 的 cinema-2026 新增 `members: ["gr26-032"]`：只表示专题归属，不带单元名，专题页不出现单元选择器。
- 网站（`index.html`）与小程序（`utils/util.js`、`pages/films|programme|programmes|schedule`）在判断专题归属处同时识别 `members` 与 `sections`；`sections` 行为不变。
- 影片 ID、场次键、金鸡影展专题中的原有归属均不变。
- sw 缓存 sk-v221。
- 验证：check-content、check-library、check-companion 通过；index.html 脚本语法与小程序页面语法通过。未做浏览器/真机逐页检查。
- 小程序：`members` 数据自动同步，但识别它的页面代码需上传并提交审核后才生效；审核前旧版小程序不会把该片列入院线新片。
