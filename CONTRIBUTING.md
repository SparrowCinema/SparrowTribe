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
- 微信小程序：`project.config.json` + `miniprogram/` + `cloudfunctions/`（AppID wx1f3f065d4885ac25，云环境 cloud1-d9gvudh6vc59007ac），说明见 miniprogram/README.md。小程序通过 getData 云函数自动读取网站 data/ 的最新数据（失败时用 cache 集合缓存），排片和影片数据只改网站即可，无需重新审核；`miniprogram/data/data.js` 是离线兜底数据，发新版前运行 `node tools/build-fallback.js` 从网站 data/ 重新生成（规则与 getData 云函数一致）。小程序安装包图片有增减时运行 `node tools/build-bundled.js` 并重新部署 getData。小程序场次键格式与网站一致。 首页与影片详情的「已散场场次隐藏」「今日我的排片」逻辑在小程序 pages/schedule、pages/film 中同步实现；这类页面代码改动需在微信开发者工具上传新版本并提交审核，排片数据本身仍自动同步。 外观（跟随系统/浅色/暗色）：网页靠 `data-theme` + localStorage(`sk-theme`)；小程序靠 `app.json` 的 `darkmode`/`theme.json`（原生导航栏、标签栏随系统）和 `utils/cfg.js`（`DARK` 变量串经 page-meta 的 page-style 覆盖 `app.wxss` 的颜色变量，并用接口按选择重设原生栏与标签图标 `images/tab/*-d.png`）。新写的样式请用 `var(--bg/--surface/--fg/--muted/--line/--accent/--bad-bg/--bad-fg)`，不要写死浅色底色；暗色色值改动要同步 `theme.json` 与 `cfg.js` 的 `PAL`。
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

## 小程序包体积（主包上限 2MB）

- 微信小程序主包（含 data、images）不能超过 2MB，上传前用 `find miniprogram -type f -printf '%s\n' | awk '{s+=$1}END{print s/1024" KB"}'` 自查，建议 ≤ 1900KB。
- `node tools/build-fallback.js` 生成的离线兜底数据是精简版（去掉简介、荣誉、内容提示、收录短片等长文字段；英文层同理），完整内容联网后由 getData / 网站数据补全。需要新增离线必备字段时，注意别让包体积再次超限。
- 包内海报宽 300px、专题封面不超过 930px 宽、小程序码为灰度 JPEG；新增图片请按此压缩。

## 国际化字段（内容提示 / 外链 / 分享 / 日历）

- 影片可选字段：`warnings`（内容提示数组，如 `["儿童受虐"]`，影片页显示「内容提示」，需在 `data/i18n/en.json` 的 `ui` 里给英文）、`medium`（放映格式）、`ageRating`（年龄提示）、`access`（无障碍信息数组，如听障字幕场）、`links`（`{imdb:"tt…", lb:"letterboxd-slug", douban:"id"}`，填了就是直达链接，没填则跳转各站搜索结果）。
- 内容提示只作参考，不是官方分级；正文简介里不再写「观影前请知悉」。
- 分享预览卡片与订阅日历在部署时由 `node tools/build-extras.js` 生成（`s/` 分享页、`cal/` 的 `.ics`，均已在 `.gitignore`，不要提交）。默认分享图由 `node tools/make-og-default.js` 生成 `brand/og-default.jpg`。
- 英文名规范：片名优先用国际发行英文名（对照 IMDb / 影展官方英文手册）；内地导演用拼音、姓在前，港台导演用本人惯用拼法（如 Tsui Hark）。

## 影展活动与短片合辑（金马影展专题）

- 专题可带 `eventKinds` 与 `events`（见 docs/golden-horse-2026-notes.md），网站 `eventsHTML` 与小程序 `pages/programme` 同步显示；英文放在 `en.json` 的 `programmes.<id>.kindEn` / `evEn`。
- 影片可带 `parts`（合辑收录的短片，字段 cn/en/y/c/min/dir/dirO/syn/synEn/honors），影片页显示「收录短片」。专题可带 `ticketUrl` / `ticketLabel`（购票链接）。

## 活动场次（可加入个人行程）

- 有明确时间、地点的影展活动（如金马大师讲堂、沙龙、论坛）做成「活动场次」：在专题文件的 `films` 里加一条带 `ev:1`、`evId:<活动id>` 的伪影片（id 形如 `gh63-ev-<活动id>`，`min` 为时长，`syn` 为简介），再在 `shows` 里按常规写场次，场地在 `data/catalog.json` 的 venues 登记（如台北文创大楼）。个人排片、排片表、甘特图、日历、分享沿用现有机制。
- 网站 `loadData` 把 `ev` 影片排除出 `FILMS`（片目、专题片单、统计不含活动），但仍保留在 `F` 里供场次使用；活动详情页隐藏评分、外链、看过与映后交流。小程序在 films / programme / programmes / schedule 页同样过滤 `ev`。
- 活动页（`#events-<专题id>` / `pages/events`）按 `evId` 找到场次并显示「加入我的行程」按钮；英文放在 `en.json` 的 `films.<伪影片id>`。
- 冲突判断容忍 2 分钟以内的重叠（映后讲堂紧接上一场放映，片长取整会有 1–2 分钟误差）。

## 每部影片必备的观影提示

- 新增与修改影片必须包含 `warnings` 数组、`contentNote`、`editorial` 与 `contentReview`；英文层补对应的三项文案。未查证的内容使用 `status: "pending"`、空提示数组与明确的待核实文案，不能写成“无敏感内容”。
- `contentReview` 包含 `status`（`synopsis-reviewed` / `official-advisory` / `pending`）、`checked`（核对日期）、`sensory`（`unverified` / 已查实闪烁提示的 `flashing`）。简介核对不等于完整审片，提示说明须保留此范围。
- 内容提醒针对具体情节，不把性取向、身份或残障本身作为风险。光敏与音量提示无法从剧情推断。
- 美国 MPA 分级只使用已核实的 `mpa: {rating, edition, checked}`，证据记录在内部文档。不同剪辑版不能套用旧版分级；未知时不显示破折号占位。
- 提交前运行 `node tools/build-fallback.js`、`node tools/check-content.js`、`node tools/check-library.js`、`node tools/check-companion.js`、`node tools/check-config.js`（改小程序云端配置 data/config.json 后）`；部署也会执行后三项，避免后续片目漏掉提醒。

## 全球首映资料（每部新片必备）

- 每部非活动影片使用 `worldPremiere: {status, date, festival, festivalEn, kind, checked}`。日期用 ISO `YYYY-MM-DD`；只证实年/月时保留 `YYYY` / `YYYY-MM`，状态为 `partial`，禁止补猜日。
- 全球首映指原作最早公开放映；不得用影片制作年份、入围影展、本地公映、亚洲/台湾/内地首映或修复版首映替代。非影展首映用 `kind: "theatrical"`。短片合辑用 `kind: "collection"`，不把合辑放映日当作每部短片的全球首映。
- `verified` / `partial` 记录须有 `checked` 核对日期，并在 `docs/world-premiere*.json` 的 `verifiedRecords` 中按影片 ID 记录证据。已公布的未来首映按官方公布首场登记；具体日期可能调整。
- 未证实用 `status: "pending"` 和 null 字段；尚未公布可用 `unannounced`；盲盒使用 `withheld`，不得反推泄露片名。普通未知与非影展首映分开显示。
- 影片资料表（网站及小程序）自动显示“全球首映时间 / 首映影展”；新导入影片即使未填也显示“待核实”。运行 `node tools/build-fallback.js` 自动补入缺失字段，`check-content.js` / 发布检查会阻止漏字段、非法日期、跨专题资料不一致或无证据的“已核实”资料。
- 小程序同步了资料表及已放映场次的一行“年份日期 / 时间 / 城市·影院·厅”。网站合并后发布；小程序页面代码仍需在微信开发者工具上传审核才能生效。

## 结算项目与个人海报墙

- 影院观影结算可独立选择封面、统计、本期最爱、专题统计、印章墙、观影清单。品牌与二维码始终保留，不参与多选。省略 `sections` 的旧调用仍显示全部；取消项目时渲染与画布高度一起缩短，不留空白。选择仅保存在本机，不修改或同步观影记录。
- 「我的」在个人排片下一行提供「我的海报墙」：网页 `#poster-wall`，小程序 `pages/poster-wall/poster-wall`。仅收录已看过的非活动影片，一部一张海报，显示当前个人评分；按最近观影日期排列，点击进入影片页。
- 海报墙按视窗宽高比自动适配：竖屏每排 5 张、横屏每排 10 张，过渡尺寸为 5–10 张；网格始终填满可用宽度，只上下浏览，不横向滑动，也不再读取旧的手动列数。缺图时显示片名，不移除观影记录。
- 小程序页面、菜单与结算控制同步修改；这些页面代码需在微信开发者工具上传并提交审核后才能上线。

## 影片页专题标签与已放映记录

- 影片详情顶部最多展示两个专题及对应单元：进行中、即将开始优先于已结束；同优先级按最近日期排序（进行中/即将开始取开始日期，已结束取结束日期）。此限制只作用于顶部标签，不改变影片的全部专题归属、筛选或购票入口。
- 已放映场次单行显示年份日期、开场时间、城市·影院·影厅·该场所属专题，不再显示结束时间。窄屏缩小字号并允许整行横向查看，保留完整名称；网页和小程序一致。

## 趣味评分 V1

趣味字段 `fun` / `bore` 为独立 0–5，0 不是未评；撤销与公开意愿带 `tasteAt` 字段时间戳。修改、合并或迁移观影记录时使用 shared/taste.js / shared/psync.js，保留 `r`、`v`、`f` 和排片键。社区汇总只统计主动公开的评分，不开放私人 plans/档案。发版步骤、后端权限、测试与人工微信步骤见 docs/taste-v1-release.md。提交前增加运行 check-taste.js 及 check-taste-db.js。新增影片后：若生产库已执行最新 backend/taste-v1.sql（影片首次投票自动登记），无需操作；否则重新执行 backend/taste-films.sql。状态见 docs/taste-v1-release.md。

### 趣味评分的页面结构（2026-11-09）

- 影片页「我的观影」里只有一行趣味摘要（网页 `tasteRowHTML`，小程序 `.ts-row` / `tsRowModel`）：我的有趣/无聊分数 + 社区均分，点开是底部弹层（网页 `#ts-sheet`，桌面为居中对话框；小程序 `page-container`）。弹层里是两项评分、社区结果和「公开到影迷社区」开关（开关本身即同意，不再弹确认框）。
- 四象限是「我的」里个人排片与我的海报墙之间的独立板块：网页 `#taste-map`（`tasteMapPage`），小程序 `pages/taste-map/taste-map`，样式沿用海报墙页标题与成长卡片；不再放在护照「成长」里。
- 不做短评：公开短评需要内容审核且个人主体小程序难以开放 UGC 评论；私人备注以后如有需要再单独评估。

### 影片页观影日记（2026-11-09）

- 看过后，「我的观影」从上到下是：标题 + 印章状态（「已盖章 · N 次 ›」，点它进护照）、十分制星级（多次观影时给最近一次打分）、趣味摘要、观影日记。未看过时仍是「＋ 看过」按钮。
- 观影日记每次观影一行（新→旧）：日期、场次/版本、该次评分、首刷/最近标记；最后一行「＋ 再看一次」。看一次与看多次是同一套界面。
- 点一行或「再看一次」打开底部编辑弹层（网页 `lgOpen` / `#lg-sheet`，沿用 `.ts-sheet` 样式；小程序 `lgOpen` + `page-container`）：观影日期、放映场次（从本片已放映场次中选，改日期会自动关联当天场次）、放映版本、这一次的评分；改动先存草稿，点「保存」才写入，关闭即放弃。底部「删除这一次」，只剩一次时为「移出观影护照」。
- 写入规则统一在 `shared/growth.js` 的 `setViews` / `putView` / `dropView`（小程序副本由 `node tools/build-fallback.js` 复制），保留趣味分、公开意愿等其他字段；数据结构（`v` 数组与顶层 d/r/k/f）不变。
- 网页日记相关类名用 `dy-` 前缀（`.lg-d` / `.lg-l` 已被深浅色 logo 切换占用）。
