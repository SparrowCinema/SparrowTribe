// 生成小程序离线兜底数据 miniprogram/data/data.js（云函数和网站都读不到时才会用到）。
// 转换规则与 cloudfunctions/getData/index.js 的 fromSite() 保持一致：两处改一处时要同步改另一处。
// 发布小程序新版本前运行一次：node tools/build-fallback.js
const fs = require('fs'), path = require('path');
require('./prepare-premieres.js');
const root = path.join(__dirname, '..');
const SITE = 'https://sparrowcinema.github.io/SparrowTribe/';
const BUNDLED = require(path.join(root, 'cloudfunctions/getData/bundled.json'));
const OUT = path.join(root, 'miniprogram/data/data.js');

// 片区颜色沿用现有兜底数据里的 reg（网站上的 REG 用的是 CSS 变量，小程序需要具体色值）
const prev = require(OUT);
if (!prev.reg) throw new Error('现有 data.js 缺少 reg，无法沿用片区颜色');

const readJSON = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const cat = readJSON('data/catalog.json');
const progs = cat.programmes || [];
const has = (dir, name) => (BUNDLED[dir] || []).includes(name);

const films = [], shows = [], seen = new Set();
progs.forEach(p => {
  if (!p.file) return;
  const pk = readJSON(p.file);
  (pk.films || []).forEach(f => {
    if (seen.has(f.id)) return; seen.add(f.id);
    const o = Object.assign({}, f, { prog: f.prog || p.id });
    delete o.ticket;
    if (!has('posters', f.id + '.jpg') && f.poster && !o.posterUrl) o.posterUrl = SITE + f.poster;
    if (has('tickets', f.id + '.jpg')) o.ticketUrl = '/images/tickets/' + f.id + '.jpg';
    else if (f.ticket) o.ticketUrl = SITE + f.ticket;
    films.push(o);
  });
  (pk.shows || []).forEach(r => {
    const [d, t, id, v = 'premiere', h = 'luxe'] = Array.isArray(r) ? r : [r.d, r.t, r.id, r.v, r.h];
    shows.push({ d, t, id, v, h, p: p.id }); // p：场次所属专题（跨影展合并影片按此区分）
  });
});
const programmes = progs.map(p => {
  const o = Object.assign({}, p); delete o.file;
  o.cover = has('brand', 'prog-' + p.id + '.jpg') ? '/images/brand/prog-' + p.id + '.jpg' : (p.cover ? SITE + p.cover : '');
  o.cardCover = p.cardCover ? SITE + p.cardCover : '';
  return o;
});
if (!films.length || !shows.length) throw new Error('网站数据为空，未生成');

// 离线兜底只保留列表/排片/护照所需字段：长文字段（简介、荣誉、内容提示等）联网后由 getData / 网站数据补全。
// 原因：小程序主包上限 2MB，完整数据会让源码包超限。
const LEAN_DROP = ['syn', 'bio', 'honors', 'parts', 'contentReview', 'contentNote', 'editorial', 'highlights', 'links'];
films.forEach(f => LEAN_DROP.forEach(k => { delete f[k]; }));
const data = { films, shows, venues: cat.venues || [], programmes, aliases: cat.aliases || {}, reg: Object.assign({}, prev.reg, cat.reg || {}) };
fs.writeFileSync(OUT, '/* 本地内置数据：云数据库为空或网络不可用时使用。由 tools/build-fallback.js 从网站 data/ 生成，规则与 getData 云函数一致。 */\nmodule.exports = ' + JSON.stringify(data) + ';\n');
console.log('films', films.length, 'shows', shows.length, 'venues', data.venues.length, 'programmes', programmes.length);

// 英文层：data/i18n/en.json → miniprogram/data/en.js（小程序离线兜底；联网时 getData 会带回网站最新的英文层）
const en = readJSON('data/i18n/en.json'); delete en._readme;
// 同理：离线英文层去掉影片长文字段（联网时 getData 带回完整英文层）
const EN_DROP = ['syn', 'contentNote', 'editorial', 'bio', 'highlights', 'honors', 'warnings', 'parts', 'contentReview'];
Object.values(en.films || {}).forEach(o => EN_DROP.forEach(k => { delete o[k]; }));
fs.writeFileSync(path.join(root, 'miniprogram/data/en.js'), '/* 英文层：由 tools/build-fallback.js 从 data/i18n/en.json 生成。 */\nmodule.exports = ' + JSON.stringify(en) + ';\n');
console.log('en.js films', Object.keys(en.films).length, 'ui', Object.keys(en.ui).length);

// 观影护照：结算长图与印章的画布代码，网站与小程序共用 shared/recap.js，这里复制一份给小程序
fs.writeFileSync(path.join(root, 'miniprogram/utils/recap.js'), '/* 由 tools/build-fallback.js 从 shared/recap.js 复制，请改 shared/recap.js 后重新运行。 */\n' + fs.readFileSync(path.join(root, 'shared/recap.js'), 'utf8'));
console.log('recap.js copied');

// 个人档案同步：合并规则 shared/psync.js 同时复制给小程序和 psync 云函数
const psync = fs.readFileSync(path.join(root, 'shared/psync.js'), 'utf8');
const head = '/* 由 tools/build-fallback.js 从 shared/psync.js 复制，请改 shared/psync.js 后重新运行。 */\n';
fs.writeFileSync(path.join(root, 'miniprogram/utils/psync.js'), head + psync);
fs.writeFileSync(path.join(root, 'cloudfunctions/psync/psync.js'), head + psync);
console.log('psync.js copied');

// Film-library membership and search rules shared with the website.
fs.writeFileSync(path.join(root, 'miniprogram/utils/library.js'), fs.readFileSync(path.join(root, 'shared/library.js'), 'utf8'));

fs.copyFileSync(path.join(root,'shared/profile-backup.js'),path.join(root,'miniprogram/utils/profile-backup.js'));
fs.copyFileSync(path.join(root,'shared/growth.js'),path.join(root,'miniprogram/utils/growth.js'));

fs.copyFileSync(path.join(root,'shared/premiere.js'),path.join(root,'miniprogram/utils/premiere.js'));

for(const n of ['taste.js','taste-client.js'])fs.copyFileSync(path.join(root,'shared',n),path.join(root,'miniprogram/utils',n));
for(const dir of ['plan','psync'])fs.copyFileSync(path.join(root,'shared/taste.js'),path.join(root,'cloudfunctions',dir,'taste.js'));

fs.writeFileSync(path.join(root,'cloudfunctions/plan/psync.js'),head+psync);

const tasteIds=[...new Set(films.filter(f=>!f.ev).map(f=>f.id))].sort();
fs.writeFileSync(path.join(root,'backend/taste-films.sql'),"-- Allow only real catalogue films. Re-run after adding films.\ninsert into sparrow_taste.films(id) values\n"+tasteIds.map(id=>"('"+id.replace(/'/g,"''")+"')").join(',\n')+"\non conflict do nothing;\n");
