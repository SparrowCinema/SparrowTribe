// 检查脚本用的完整片库：全部专题的影片与场次，格式与小程序数据相同（不含长文字段）。
// 2026-11-22 起安装包里的 miniprogram/data/data.js 只含常设专题，检查脚本请改用这个模块。
module.exports = require('./fallback-data.js').build({ minimal: false }).data;
