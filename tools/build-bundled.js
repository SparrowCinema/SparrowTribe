// 生成 cloudfunctions/getData/bundled.json：记录小程序安装包里已有的海报、购票码、专题封面。
// 小程序图片有变动（需要重新上传审核）时运行一次：node tools/build-bundled.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), img = path.join(root, 'miniprogram/images');
const list = d => fs.existsSync(path.join(img, d)) ? fs.readdirSync(path.join(img, d)).filter(f => /\.(jpe?g|png)$/i.test(f)).sort() : [];
const out = { posters: list('posters'), tickets: list('tickets'), brand: list('brand') };
fs.writeFileSync(path.join(root, 'cloudfunctions/getData/bundled.json'), JSON.stringify(out, null, 1) + '\n');
console.log('posters', out.posters.length, 'tickets', out.tickets.length, 'brand', out.brand.length);
