# 麻雀观影护照 · 微信小程序

麻雀观影护照（由麻雀映画与麻雀部落制作）的小程序版本。与网站共用同一份影片、排片数据结构。

- AppID：`wx1f3f065d4885ac25`
- 云开发环境：`cloud1-d9gvudh6vc59007ac`

## 目录

| 路径 | 内容 |
|---|---|
| `project.config.json`（仓库根目录） | 开发者工具项目配置，指向 `miniprogram/` 和 `cloudfunctions/` |
| `miniprogram/pages/schedule` | 首页：专题卡片、甘特图排片、逐日场次（tab「排片」） |
| `miniprogram/pages/films` | 片目（tab「片目」） |
| `miniprogram/pages/film` | 影片详情：购票小程序码、评分、场次、加入排片 / 手机日历、简介、荣誉、导演 |
| `miniprogram/pages/programme` | 专题页 |
| `miniprogram/pages/my` | 我的影展：个人排片、冲突检查、分享给朋友（tab「我的」） |
| `miniprogram/pages/share` | 朋友分享的排片：一键加入或进入首页 |
| `miniprogram/data/data.js` | 内置数据（云数据库为空或断网时使用） |
| `miniprogram/images/` | 海报、购票码、LOGO、tab 图标（已压缩，主包约 1.4MB） |
| `cloudfunctions/getData` | 读取 films / shows / venues / programmes 四个集合 |
| `cloudfunctions/seed` | 把 `data.json` 一次性导入云数据库 |
| `cloudfunctions/plan` | 按微信用户保存个人排片（集合 plans） |

## 第一次运行

1. 微信开发者工具 →「导入项目」→ 选择仓库根目录（含 `project.config.json` 的那一层），AppID 会自动读取。
2. 左侧 `cloudfunctions` 目录右键 → 选择云环境 `cloud1-d9gvudh6vc59007ac`。
3. 分别右键 `getData`、`seed`、`plan` →「上传并部署：云端安装依赖」。
4. 右键 `seed` →「云端测试」，参数填 `{"confirm":"overwrite"}`，运行一次。会创建并写入 films、shows、venues、programmes、plans 五个集合。
5. 编译预览即可。没导入数据前，小程序会直接使用内置数据，也能正常打开。

## 以后更新排片

- 在云开发控制台 → 数据库里直接改 films / shows / venues / programmes 的记录即可，用户下拉刷新就能看到，不必重新发版。
- shows 记录字段：`d`（日期，如 `11/7`）、`t`（开场时间）、`id`（影片 id）、`v`（影院 id）、`h`（影厅 id）、`order`（排序）。
- 新影片的海报和购票码可以上传到云存储，把文件 ID 填到影片记录的 `posterUrl`、`ticketUrl` 字段。
- 也可以改 `cloudfunctions/seed/data.json` 后重新跑 seed（会覆盖四个集合）。

## 发布前需要在小程序后台处理

- **用户隐私保护指引**：影片页「加入日历」用到了 `wx.addPhoneCalendar`，需要在后台「设置 → 服务内容声明 → 用户隐私保护指引」里声明「日历（仅写入）」。
- **服务类目**：个人主体可选类目有限，提交审核前先在后台确认能选到合适的类目。
- 购票码是其他小程序的小程序码，用户长按识别跳转，不需要额外配置。
