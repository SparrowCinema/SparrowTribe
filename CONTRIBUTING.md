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
  - 专题状态按 start/end 自动计算（即将开始 / 进行中 / 已结束），已结束进「往期专题」；catalog 中标记 `"ongoing": true` 的常设专题（如麻雀部落电影空间）开始后一直算进行中、标签显示「常设」，不进入往期；排片首页与影片详情只显示尚未散场的场次，已放映的场次与日期自动隐藏（个人排片中的记录保留）；片目按「近期放映 / 院线与待排片 / 已放映」排序并支持搜索。
  - 调试可在网址加 ?now=2026-11-07T15:00 模拟当前时间。
- 首页排片顶部显示「今日我的排片」（今天尚未散场的个人场次，按时间线排列）；超过一场时默认只显示最近一场，其余折叠，可用按钮展开或收起（网站与小程序一致）。个人排片与导出页可按专题筛选，导出的长图、日历与分享链接只包含所选专题。小程序「我的」页同样可按专题筛选，统计与「分享给朋友」只包含所选专题（小程序没有长图导出）。
- 微信小程序：`project.config.json` + `miniprogram/` + `cloudfunctions/`（AppID wx1f3f065d4885ac25，云环境 cloud1-d9gvudh6vc59007ac），说明见 miniprogram/README.md。小程序通过 getData 云函数自动读取网站 data/ 的最新数据（失败时用 cache 集合缓存），排片和影片数据只改网站即可，无需重新审核；`miniprogram/data/data.js` 是离线兜底数据，发新版前运行 `node tools/build-fallback.js` 从网站 data/ 重新生成（规则与 getData 云函数一致）。小程序安装包图片有增减时运行 `node tools/build-bundled.js` 并重新部署 getData。小程序场次键格式与网站一致。 首页与影片详情的「已散场场次隐藏」「今日我的排片」逻辑在小程序 pages/schedule、pages/film 中同步实现；这类页面代码改动需在微信开发者工具上传新版本并提交审核，排片数据本身仍自动同步。
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
- 网站与小程序保持同步：网站新增或修改功能时，同一个 PR 里同步修改小程序对应页面，并在 PR 说明里写明；小程序没有的能力（如添加到手机桌面）除外。小程序页面代码改动需在微信开发者工具上传新版本并提交审核。
- 排片时刻表（甘特图）查看今天时显示红色「当前时间」线和时间标签，每 30 秒移动一次（网站与小程序一致）；时刻表上的映后交流以虚线色块显示。

## 验证与发布

按变更范围检查 JavaScript 语法、受影响功能和桌面/手机布局。个人排片相关改动需验证加入、移除、刷新保存、分享与导入兼容性，并检查受影响的导出功能。仅文档改动审阅差异与链接即可。未执行的检查应如实说明。

继续使用现有 GitHub Pages。发现问题通过新的分支和回退 PR 修复，不重写 main 历史。

## 分支保护

AGENTS.md 和 CLAUDE.md 是协作约定，不等于 GitHub 强制保护。此次配置不自动启用仓库规则。
如需强制执行，可在 GitHub Settings → Rules → Rulesets 中为 main 启用必须通过 PR 合并、阻止强推和删除。
Claude 与 GPT 可能使用同一 GitHub 身份，审批人数可先设为0；不要要求尚不存在的 CI 检查。

## 专题页分组与头图

- 专题页（网站 `progFilmsHTML` / 小程序 `pages/programme`）把影片分为「即将放映」（含场次待公布，按下一场先后）和「已结束」（按最近一场由近及远，可折叠；没有待映影片时默认展开）。
- 专题头图放在 `programmes/<专题id>.jpg`（建议 1860×660），在 `data/catalog.json` 的 `cover` 里填路径；小程序另放一份缩小图到 `miniprogram/images/brand/prog-<专题id>.jpg`，然后运行 `node tools/build-bundled.js` 和 `node tools/build-fallback.js`。

## 英文版（网站）

- 页面右上角「中 / EN」切换；也可用 `?lang=en` / `?lang=zh`。选择记在本机，首次访问按浏览器语言。
- 英文内容全部在 `data/i18n/en.json`：`films`（按影片 id 覆盖片名 title、导演、主演、剧情简介、荣誉等）、`programmes`、`venues`、`ui`（界面中文→英文词典，长词优先匹配）、`exact`（只整句匹配的短词）。荣誉条目保留中文前缀（获奖｜/提名｜）用于分类，页面上再由词典译成 Won / Nominated。
- 新增影片或专题后，请在 `en.json` 补译；没补的字段自动显示中文，不会报错。界面上带数字的句式（N 场、N 分钟、日期等）在 `index.html` 的 `PATS` 里。

## 英文版（小程序）

- 首页右上角「中 / EN」切换，选择记在本机；首次打开按微信语言。切换后用 `reLaunch` 重新进入首页，各页面在 `onLoad` 里取 `I.dict()`。
- 与网站共用同一份词典 `data/i18n/en.json`。getData 云函数会一并返回 `en`；离线兜底是 `miniprogram/data/en.js`，由 `node tools/build-fallback.js` 生成（和 `data.js` 一起）。
- 页面里的 JS 文字用 `tr()`（`miniprogram/utils/i18n.js`），WXML 里的固定文字用 `L.t(i, '中文')` / `L.n(i, 数量, 单位)`（`utils/l.wxs`）。词典里没有的文字原样显示中文，不会报错。新增界面文字后请在 `en.json` 的 `ui` 补译，并运行 `node tools/build-fallback.js`。
- 长图（`utils/poster.js`）在英文模式下按单词折行；页脚「微信搜索「麻雀观影护照」」保留中文名，因为小程序在微信里就叫这个名字。
- 小程序页面代码改动需要在微信开发者工具上传新版本并提交审核；英文译文数据随网站自动同步（需重新部署 getData 云函数一次，之后 `en` 会随网站更新）。

## 观影护照（看过 / 评分 / 印章 / 影院观影结算）

- 影片页「我的观影」：点「看过」盖章，五星十分制打分（每颗星 2 分，可半颗；再点同一分数清除）。默认观影日期取已放映的个人排片场次，其次本片最近一场已放映场次，否则今天；可改日期。
- 「我的」页顶部是可翻页的观影护照：封面 → 资料页 → 印章页（每页 4 枚）。每部影片一枚印章，形状（圆章 / 方章 / 八角章 / 票根章）、倾角、墨色按影片 id 固定，网站与小程序一致。
- 「生成我的影院观影结算」按年份、专题筛选，生成长图（统计、本期最爱、按专题、印章墙、观影清单）。
- 结算长图与画布印章的代码在 `shared/recap.js`，网站直接加载；小程序用的 `miniprogram/utils/recap.js` 由 `node tools/build-fallback.js` 复制生成，不要直接改小程序那份。
- 记录保存：网站存在浏览器 localStorage `sparrow-watched-v1`（护照持有人名 `sparrow-holder`）；小程序存在本机 `sk-watched-v1` 并通过 `plan` 云函数（action `setWatched` / `get`）按微信用户同步，`plan` 云函数改动后需重新部署。

## 个人档案云端同步（同步码）

「我的」页的「个人档案云端同步」板块（网站和小程序都有）：用一串同步码（`SP-` 开头）在多台设备间同步看过记录、评分、护照照片、持有人和个人排片，不用注册账号。

- 后端：与米其林全球名录共用同一个 Supabase 项目（`mg_pull` / `mg_push`），只保存同步码的 SHA-256；同步码前缀 `SP-` 与米其林的 `MG-` 互不冲突，无需改数据库。
- 合并规则：`shared/psync.js`（网站直接引用；`node tools/build-fallback.js` 会把它复制到 `miniprogram/utils/psync.js` 和 `cloudfunctions/psync/psync.js`）。每一项都带更新时间，取较新者；删除用 `{del:1,t}` 留痕。个人排片整体取较新的一份。
- 网站：`index.html` 里直接请求 Supabase。小程序：通过 `psync` 云函数请求（不用配置 request 合法域名）。
- 本机附加存储：网站 `sparrow-sync`（同步码）、`sparrow-profile-meta`（各项修改时间）、`sparrow-holder-photo`；小程序 `sk-sync`、`sk-profile-meta`。

## 影院地图与转场时间（小程序）

- `data/catalog.json` 的每个影院可以加 `"geo": [纬度, 经度]`（**GCJ-02**，即腾讯地图 / 高德坐标，可在 https://lbs.qq.com/getPoint/ 拾取）和 `"addr": "地址"`。getData 云函数会自动带给小程序，**不用重新审核**。
- 有 `geo` 的影院：影片页场次旁出现「📍 地图」，「我的」页个人排片的转场行出现「地图 ›」，点击打开微信地图。
- 「我的」页个人排片里，相邻两场之间的转场行：同影院约 10 分钟（换厅/取票）；跨影院——两家都有 `geo` 时按直线距离 ×1.35 估算地铁与打车用时，没有坐标时提示通常需 30–45 分钟；跨城市提示无法衔接。间隔不够时标橙色「转场可能来不及」。估算只供参考。

## 映后活动

某一场有映后活动时，在对应影片的 `screeningNotes["日期-时间-影院id-厅id"]` 里写 `映后活动 · 角色：姓名、姓名；角色：姓名（以实际到场为准）`。网站和小程序会把「映后活动」显示成黄色标签，甘特图里该场色块带「映后」小标签；英文版在 `data/i18n/en.json` 的 `films.<id>.screeningNotes` 里同样的键下写英文（以 `Post-screening event · ` 开头）。

## 输入框防缩放（勿破坏）

手机上输入框字号 <16px 会让 iOS/微信浏览器聚焦时放大整页。index.html 里有两道守卫：全局 `input,select,textarea{font-size:16px!important}`，以及聚焦时临时锁定 viewport 的脚本。新增任何输入框都不要把字号设小于 16px；改完跑 `node tools/check-input-zoom.js`（需先起本地 http.server 8123）。

甘特图里带「映后活动」备注的场次，会在影片结束后自动预留 30 分钟的「映后」虚线时段（网站与小程序；常量 `POST_MIN` / 30）。已有「映后交流」专用时段的影片不重复显示。

## 片目分组折叠

- 进行中 / 即将开始的专题：标题右侧圆形按钮可收起（状态存本机 `sparrow-fold-v1`，小程序 `sk-fold-v1`；搜索时自动全部展开）。专题里已放映完的影片收在组内底部「本专题已放映」。
- 专题整体结束（`progStatus` 为 ended）后，整组自动移到最底部「往期专题」，每个专题一张折叠卡片，按结束时间由近到远。常设专题（`ongoing`，如麻雀部落电影空间）永远不会进往期。

## 院线新片按年份建专题

院线新片专题按自然年命名：`cinema-2026`（名称「2026院线新片」，档期 2026.01–2026.12）。每年年底新建下一年的专题：
1. 复制 `data/programmes/cinema-2026.json` 为 `cinema-2027.json`，清空影片与场次后录入新数据；
2. 在 `data/catalog.json` 新增 `cinema-2027`（名称「2027院线新片」、`start` 2027-01-01、`end` 2027-12-31、`period`、`cover`）；
3. 运行 `node tools/make-cinema-cover.js 2027` 生成中/英头图（`programmes/cinema-2027.jpg` / `-en.jpg`），再缩成 930×330 放到 `miniprogram/images/brand/prog-cinema-2027.jpg`；
4. `data/i18n/en.json` 的 `programmes` 里补英文名（如「2027 Now Showing」）。
2026 专题结束（12.31 之后）会自动进入片目的「往期专题」。

## 杭州影院优先

- 首页甘特图的影院列、城市/影院选择器、同时间场次的先后，都固定把「杭州」的影院排在最前，其他城市按 `data/catalog.json` 里的顺序跟在后面（网站 `loadData`、小程序 `utils/util.js` 的 `index()` 同步实现）。新增杭州影院无需调整顺序；以后若要换成别的本地城市，改这两处的 `杭州` 即可。

## 影厅名较长时的排版

- 影厅名在影片页、专题页、个人排片里以独立小标签显示（网站 `placeHTML()` / `.hall-tag`，小程序 `.thall` / `.htag`），名称很长（如「5号Dolby Cinema 杜比影院厅」）时整体换行，不会挤乱影院名。甘特图列头用 `short`，请给长影厅名填一个简短的 `short`。
