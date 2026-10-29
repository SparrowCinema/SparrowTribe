# Claude / GPT 协作流程

正式版本以 main 为准。GPT 使用 gpt/<task> 分支，Claude 使用 claude/<task> 分支，所有改动通过 PR 合并。

## 每次修改

1. 读取最新远程 main、AGENTS.md 和相关文件，并查看现有 PR。
2. 从最新 main 创建任务分支；若有重叠修改，先与用户协调范围。
3. 完成修改并进行相关验证，不覆盖其他任务的工作。
4. 提交 PR，说明修改原因、结果、实际验证及限制。
5. 合并前再次检查最新 main，解决冲突后重新验证。
6. 在用户授权范围内、相关检查通过后合并，不直接推送或强推 main。
7. 网站代码变化后，确认 GitHub Pages 工作流部署成功。

## 项目结构与现状

- 网站：https://sparrowcinema.github.io/SparrowTribe/（仓库 SparrowCinema/SparrowTribe，原名 style-kaleidoscope；GitHub Pages 不会自动跳转旧网址）
- 内部标识沿用 style-kaleidoscope：localStorage 键、风格万相专题 id、ICS 事件 UID 后缀，修改会导致已保存排片或日历重复，不要改。
- 单页静态应用：index.html 含页面样式、路由与交互脚本；数据在 data/，启动时加载：
  - data/catalog.json：专题（id、名称、类型、period、start/end ISO 日期、city、cover、file）与影院影厅。
  - data/programmes/<专题id>.json：该专题的 films 与 shows（[日期, 时间, 影片id, 影院id, 影厅id]）。新增影展＝新增一个专题文件并在 catalog 登记。
  - 同一部影片可被多个专题的场次引用，只需在一个专题文件里定义；场次归属看所在文件。
  - 专题状态按 start/end 自动计算（即将开始 / 进行中 / 已结束），已结束进「往期专题」；已散场的场次变灰；片目按「近期放映 / 院线与待排片 / 已放映」排序并支持搜索。
  - 调试可在网址加 ?now=2026-11-07T15:00 模拟当前时间。
- 微信小程序：`project.config.json` + `miniprogram/` + `cloudfunctions/`（AppID wx1f3f065d4885ac25，云环境 cloud1-d9gvudh6vc59007ac），说明见 miniprogram/README.md。小程序通过 getData 云函数自动读取网站 data/ 的最新数据（失败时用 cache 集合缓存），排片和影片数据只改网站即可，无需重新审核；`miniprogram/data/data.js` 是离线兜底数据，发新版时顺便同步。小程序安装包图片有增减时运行 `node tools/build-bundled.js` 并重新部署 getData。小程序场次键格式与网站一致。
- 海报目录：posters/；发布配置：.github/workflows/pages.yml；PWA：manifest.webmanifest、sw.js（替换同名静态文件时需升级缓存名）、icons/。
- 网站与小程序名称：麻雀观影护照（2026-10 起，原名「麻雀映画&麻雀部落展映排片表」），制作设计：麻雀映画 × 麻雀部落。风格万相是其中一个影展专题，后续会加入院线电影、艺术影院等排片。
- 专题封面放在 programmes/。影片缺少片长时显示「片长待定」，缺少简介、导演介绍等字段时详情页自动隐藏对应板块。
- 主要路由：排片、片目、影片详情、#prog-<专题id>（专题页）、#my（我的）、#plan（个人排片）、#export（导出）、#share=…（分享）、#install（添加到手机）。
- 个人排片保存在浏览器 localStorage，键为 style-kaleidoscope-plan-v1；没有账号或跨设备自动同步。
- 分享链接编码场次键；场次键由日期、时间、影院、影厅构成。修改这些字段时必须考虑已有收藏和链接兼容性。
- 导出包含 PNG、ICS 日历及打印保存 PDF；影院和影厅应保持完整显示。

## 已确认的用户要求

- 保留用户提供的完整剧情简介、演职员、时长与版本，不能用通用资料擅自替换。
- 每部影片展示影展与荣誉，明确区分获奖、提名、入围和影史评选。
- 页面不显示“资料来源”板块及“评分沿用原页面”说明。
- 每部片名后显示 4K、4K修复或2K；笑傲江湖2：东方不败为4K修复。
- 甘特图显示影院和影厅，底部导航第三项为“我的”。
- 已有个人排片与导出分享功能，后续优化需保留已保存数据。

## 验证与发布

按变更范围检查 JavaScript 语法、受影响功能和桌面/手机布局。个人排片相关改动需验证加入、移除、刷新保存、分享与导入兼容性，并检查受影响的导出功能。仅文档改动审阅差异与链接即可。未执行的检查应如实说明。

继续使用现有 GitHub Pages。发现问题通过新的分支和回退 PR 修复，不重写 main 历史。

## 分支保护

AGENTS.md 和 CLAUDE.md 是协作约定，不等于 GitHub 强制保护。此次配置不自动启用仓库规则。
如需强制执行，可在 GitHub Settings → Rules → Rulesets 中为 main 启用必须通过 PR 合并、阻止强推和删除。
Claude 与 GPT 可能使用同一 GitHub 身份，审批人数可先设为0；不要要求尚不存在的 CI 检查。
