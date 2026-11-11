# 院线新片：取消单元与存档（2026-11-12）

用户要求：
1. 取消深度安静（gr26-032）在院线新片里的「院线上映」单元；院线新片暂不设置单元。
2. 删除院线新片里的内地公映日存档与用户指定存档场次。

## 改动
- `data/catalog.json`：cinema-2026 删除 `sections`（该字段同时决定跨专题归属，因此深度安静不再出现在院线新片中，仅保留在原专题）。
- `data/programmes/cinema-2026.json`：删除顶层 `releaseArchives`（21）、21 条 `archive:true` 场次（shows 38→17）、21 部影片的 `releaseArchive`、`screeningArchive` 及存档 `screeningNotes`。21 部影片保留 `ended:true`，仍在「已结束 / 已下映」。
- `data/i18n/en.json`：删除对应 21 条存档场次英文备注。
- 删除 `tools/check-cinema-archive.js`；`check-mini-ended.js`、`check-library.js` 改为不再依赖存档/跨专题单元。
- `miniprogram/README.md`：公映日存档一节改为「已移除」。
- 未改动：`shared/screenings.js`、`shared/premiere.js` 及小程序副本中读取存档的代码保留，因没有数据不会触发；因此小程序无需为此重新提审。
- `sw.js` 缓存 sk-v218 → sk-v219。

## 兼容性
- 网站：个人排片读取时过滤不存在的场次键，指向已删除存档场次的旧收藏会被忽略（下次保存时从本机排片中移除）。看过记录按影片 id 存，不受影响。
- 小程序：排片数据由 getData 自动同步，无需重新审核。

## 验证
check-content、check-library、check-companion、check-mini-ended 通过；小程序包 1787KB。未在真机/浏览器逐页手动检查。
