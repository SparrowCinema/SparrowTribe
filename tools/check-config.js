// 检查小程序云端配置 data/config.json：字段类型与缩放范围
const c = require('../data/config.json'); const bad = [];
if (!(c.scale >= 0.8 && c.scale <= 1.2)) bad.push('scale 需在 0.8–1.2');
if (typeof c.notice !== 'string') bad.push('notice 需为字符串');
if (typeof c.tips !== 'object' || Array.isArray(c.tips)) bad.push('tips 需为对象');
else Object.keys(c.tips).forEach(k => { if (!Array.isArray(c.tips[k]) || c.tips[k].some(x => typeof x !== 'string')) bad.push('tips.' + k + ' 需为字符串数组'); });
if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
console.log('config ok');
