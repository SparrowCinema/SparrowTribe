// 生成小程序离线兜底数据 miniprogram/data/data.js（云函数和网站都读不到时才会用到）。
// 转换规则与 cloudfunctions/getData/index.js 的 fromSite() 保持一致：两处改一处时要同步改另一处。
// 发布小程序新版本前运行一次：node tools/build-fallback.js
const fs = require('fs'), path = require('path');
require('./prepare-premieres.js');
const { build, OUT, root } = require('./fallback-data.js');
const readJSON = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));

// 最小兜底（2026-11-22 起）：只含常设专题，规则见 tools/fallback-data.js。
// 检查脚本要用完整片库时 require('./full-data.js')，不要读 miniprogram/data/data.js。
const TODAY = process.env.FALLBACK_TODAY || undefined;
const { data, kept, dropped, allFilmIds } = build({ minimal: true, today: TODAY });
const { films, programmes } = data;
console.log('fallback date', data.fallbackDate, 'kept (ongoing only):', kept.join(', ') || '(none)', '· dropped', dropped.length, 'programmes');
fs.copyFileSync(path.join(root,'shared/screenings.js'),path.join(root,'miniprogram/utils/screenings.js'));
fs.copyFileSync(path.join(root,'shared/tz.js'),path.join(root,'miniprogram/utils/tz.js'));
fs.copyFileSync(path.join(root,'shared/tz.js'),path.join(root,'cloudfunctions/remind/tz.js'));
fs.copyFileSync(path.join(root,'shared/planner.js'),path.join(root,'miniprogram/utils/planner.js'));
fs.writeFileSync(OUT, '/* 本地内置数据（最小兜底，只含常设专题）：云函数和本机缓存都没有时使用。由 tools/build-fallback.js 从网站 data/ 生成。 */\nmodule.exports = ' + JSON.stringify(data) + ';\n');
console.log('films', films.length, 'shows', data.shows.length, 'venues', data.venues.length, 'programmes', programmes.length);

// 英文层：data/i18n/en.json → miniprogram/data/en.js（小程序离线兜底；联网时 getData 会带回网站最新的英文层）
const en = readJSON('data/i18n/en.json'); delete en._readme;
// 同理：离线英文层去掉影片长文字段（联网时 getData 带回完整英文层）
const EN_DROP = ['syn', 'st', 'contentNote', 'editorial', 'bio', 'highlights', 'honors', 'warnings', 'parts', 'contentReview'];
Object.values(en.films || {}).forEach(o => EN_DROP.forEach(k => { delete o[k]; }));
// 包体积（2026-11-21）：离线英文层只留兜底数据里有的影片和专题，影片只留列表 / 排片 / 票根要用的短字段；
// 演职员、场次备注等联网后由 getData 带回（小程序主包上限 2MB）
const EN_FILM_KEEP = ['title', 'o', 'dir', 'c', 'y', 'genre', 'language', 'version', 'release'];
const keptFilms = new Set(films.map(f => f.id)), keptProgs = new Set(programmes.map(p => p.id));
for (const id of Object.keys(en.films || {})) {
  if (!keptFilms.has(id)) { delete en.films[id]; continue; }
  for (const k of Object.keys(en.films[id])) if (!EN_FILM_KEEP.includes(k)) delete en.films[id][k];
}
for (const id of Object.keys(en.programmes || {})) if (!keptProgs.has(id)) delete en.programmes[id];
fs.writeFileSync(path.join(root, 'miniprogram/data/en.js'), '/* 英文层：由 tools/build-fallback.js 从 data/i18n/en.json 生成。 */\nmodule.exports = ' + JSON.stringify(en) + ';\n');
console.log('en.js films', Object.keys(en.films).length, 'ui', Object.keys(en.ui).length);

// 观影护照：结算长图与印章的画布代码，网站与小程序共用 shared/recap.js，这里复制一份给小程序
fs.writeFileSync(path.join(root, 'miniprogram/utils/recap.js'), '/* 由 tools/build-fallback.js 从 shared/recap.js 复制，请改 shared/recap.js 后重新运行。 */\n' + fs.readFileSync(path.join(root, 'shared/recap.js'), 'utf8'));
console.log('recap.js copied');
fs.copyFileSync(path.join(root,'shared/tickets.js'),path.join(root,'miniprogram/utils/tickets.js'));
fs.copyFileSync(path.join(root,'shared/ticket-sketch.js'),path.join(root,'miniprogram/utils/ticket-sketch.js'));
fs.writeFileSync(path.join(root,'miniprogram/packages/collect/utils/ticket-ocr.js'),'/* 由 tools/build-fallback.js 从 shared/ticket-ocr.js 复制，请改 shared/ticket-ocr.js 后重新运行。 */\n'+fs.readFileSync(path.join(root,'shared/ticket-ocr.js'),'utf8'));
// 影片 / 专题分享海报：shared/share-poster.js 复制给小程序
fs.writeFileSync(path.join(root, 'miniprogram/utils/share-poster.js'), '/* 由 tools/build-fallback.js 从 shared/share-poster.js 复制，请改 shared/share-poster.js 后重新运行。 */\n' + fs.readFileSync(path.join(root, 'shared/share-poster.js'), 'utf8'));
console.log('share-poster.js copied');
// 趣味图谱长图：shared/taste-report.js 复制给小程序
fs.writeFileSync(path.join(root, 'miniprogram/packages/collect/utils/taste-report.js'), '/* 由 tools/build-fallback.js 从 shared/taste-report.js 复制，请改 shared/taste-report.js 后重新运行。 */\n' + fs.readFileSync(path.join(root, 'shared/taste-report.js'), 'utf8'));
console.log('taste-report.js copied');
// 使用指南：shared/guide.js 复制给小程序分包，末尾附 data/guide.json 作离线兜底（联网后用 getData 返回的 guide，改手册不用重新上传小程序）
{ const gd = JSON.parse(fs.readFileSync(path.join(root, 'data/guide.json'), 'utf8')); delete gd.note;
  fs.writeFileSync(path.join(root, 'miniprogram/packages/collect/utils/guide.js'), '/* 由 tools/build-fallback.js 从 shared/guide.js 复制并附上 data/guide.json，请改那两个文件后重新运行。 */\n' + fs.readFileSync(path.join(root, 'shared/guide.js'), 'utf8') + '\nmodule.exports.DATA = ' + JSON.stringify(gd) + ';\n'); }
// 典藏票根验真二维码（2026-11-22）：vendor/qrcode.js 改成小程序模块放进分包，导出 matrix(text) → 二维布尔数组
{
  const src = fs.readFileSync(path.join(root, 'vendor/qrcode.js'), 'utf8');
  const tail = 'window.QRCodeLib={QRCode:R("index"),ECL:R("QRErrorCorrectLevel")};})();';
  if (!src.includes(tail)) throw new Error('vendor/qrcode.js 结尾变了，请同步修改 build-fallback.js 的二维码复制');
  const body = src.replace(tail, 'var QRCode=R("index"),ECL=R("QRErrorCorrectLevel");\n' +
    'module.exports={matrix:function(text){var q=new QRCode(-1,ECL.L);q.addData(text);q.make();var n=q.getModuleCount(),m=[];for(var r=0;r<n;r++){var row=[];for(var c=0;c<n;c++)row.push(q.isDark(r,c));m.push(row);}return m;}};})();');
  fs.writeFileSync(path.join(root, 'miniprogram/packages/collect/utils/qrcode.js'), '/* 由 tools/build-fallback.js 从 vendor/qrcode.js 生成，请勿直接修改。 */\n' + body);
  console.log('qrcode.js generated');
}

// 个人档案同步：合并规则 shared/psync.js 同时复制给小程序和 psync 云函数
const psync = fs.readFileSync(path.join(root, 'shared/psync.js'), 'utf8');
const head = '/* 由 tools/build-fallback.js 从 shared/psync.js 复制，请改 shared/psync.js 后重新运行。 */\n';
fs.writeFileSync(path.join(root, 'miniprogram/utils/psync.js'), head + psync);
fs.writeFileSync(path.join(root, 'cloudfunctions/psync/psync.js'), head + psync);
console.log('psync.js copied');

// Film-library membership and search rules shared with the website.
fs.writeFileSync(path.join(root, 'miniprogram/utils/library.js'), fs.readFileSync(path.join(root, 'shared/library.js'), 'utf8'));
fs.copyFileSync(path.join(root,'shared/recommend.js'),path.join(root,'miniprogram/utils/recommend.js'));
fs.copyFileSync(path.join(root,'shared/notes-crypto.js'),path.join(root,'miniprogram/utils/notes-crypto.js'));
fs.copyFileSync(path.join(root,'shared/ecosystem.js'),path.join(root,'miniprogram/utils/ecosystem.js'));

fs.copyFileSync(path.join(root,'shared/profile-backup.js'),path.join(root,'miniprogram/utils/profile-backup.js'));
fs.copyFileSync(path.join(root,'shared/growth.js'),path.join(root,'miniprogram/utils/growth.js'));
// 护照翻页卷曲：shared/curl.js 转成小程序 WXS（在渲染层跟手计算，pages/my/curl-ctl.wxs 引用）
{const s=fs.readFileSync(path.join(root,'shared/curl.js'),'utf8');fs.writeFileSync(path.join(root,'miniprogram/utils/curl.wxs'),'/* 由 tools/build-fallback.js 从 shared/curl.js 生成，请改 shared/curl.js 后重新运行。 */\n'+s.slice(0,s.indexOf('if (typeof module'))+'module.exports = SparrowCurl;\n');}
// 对排片：shared/overlap.js 复制给小程序（pages/share）
fs.writeFileSync(path.join(root,'miniprogram/utils/overlap.js'),'/* 由 tools/build-fallback.js 从 shared/overlap.js 复制，请改 shared/overlap.js 后重新运行。 */\n'+fs.readFileSync(path.join(root,'shared/overlap.js'),'utf8'));

fs.copyFileSync(path.join(root,'shared/premiere.js'),path.join(root,'miniprogram/utils/premiere.js'));

for(const n of ['taste.js','taste-client.js'])fs.copyFileSync(path.join(root,'shared',n),path.join(root,'miniprogram/utils',n));
for(const dir of ['plan','psync'])fs.copyFileSync(path.join(root,'shared/taste.js'),path.join(root,'cloudfunctions',dir,'taste.js'));

fs.writeFileSync(path.join(root,'cloudfunctions/plan/psync.js'),head+psync);

const tasteIds=[...new Set(allFilmIds)].sort(); // 趣味评分登记全部影片，不受兜底精简影响
fs.writeFileSync(path.join(root,'backend/taste-films.sql'),"-- Allow only real catalogue films. Re-run after adding films.\ninsert into sparrow_taste.films(id) values\n"+tasteIds.map(id=>"('"+id.replace(/'/g,"''")+"')").join(',\n')+"\non conflict do nothing;\n");

// 定位：城市中心坐标 data/cities.json 复制给小程序（utils/cities.js），由 utils/locate.js 使用
fs.writeFileSync(path.join(root, 'miniprogram/utils/cities.js'), '/* 由 tools/build-fallback.js 从 data/cities.json 生成，请勿直接修改。 */\nmodule.exports = ' + JSON.stringify((JSON.parse(fs.readFileSync(path.join(root, 'data/cities.json'), 'utf8')).cities) || {}) + ';\n');
