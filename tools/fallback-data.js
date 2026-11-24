// 从网站 data/ 生成小程序格式的数据（转换规则与 cloudfunctions/getData/index.js 的 fromSite() 一致）。
// build({ minimal: true })  → 安装包里的最小兜底（只含常设专题，tools/build-fallback.js 写入 miniprogram/data/data.js）
// build({ minimal: false }) → 全部专题的完整数据（不含长文字段），给检查脚本当作真实片库用（tools/full-data.js）
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const Screenings = require('../shared/screenings.js');
const OLD_SITE = 'https://sparrowcinema.github.io/SparrowTribe/';
const SITE = 'https://sparrowcinema.org/';
const OUT = path.join(root, 'miniprogram/data/data.js');

// 离线兜底只保留列表/排片/护照所需字段：长文字段（简介、荣誉、内容提示等）联网后由 getData / 网站数据补全。
// 原因：小程序主包上限 2MB，完整数据会让源码包超限。
const LEAN_DROP = ['syn', 'bio', 'st', 'honors', 'parts', 'contentReview', 'contentNote', 'editorial', 'highlights', 'links'];

function build(opt) {
  opt = opt || {};
  const BUNDLED = JSON.parse(fs.readFileSync(path.join(root, 'cloudfunctions/getData/bundled.json'), 'utf8'));
  // 片区颜色沿用现有兜底数据里的 reg（网站上的 REG 用的是 CSS 变量，小程序需要具体色值）
  const prevReg = require(OUT).reg;
  if (!prevReg) throw new Error('现有 data.js 缺少 reg，无法沿用片区颜色');
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
      // 海报地址只认站内：资料里手写的 posterUrl 只有指向本站才用；外链 poster 部署时会存成站内 posters/x-<id>.jpg（tools/localize-posters.py），兜底数据直接指向那里
      if (typeof o.posterUrl === 'string') o.posterUrl = o.posterUrl.replace(OLD_SITE, SITE); // 换域名前写的站内地址
      if (!(typeof o.posterUrl === 'string' && o.posterUrl.startsWith(SITE))) delete o.posterUrl;
      if (!has('posters', f.id + '.jpg') && f.poster && !o.posterUrl) o.posterUrl = SITE + (/^https?:\/\//.test(f.poster) ? 'posters/x-' + f.id + '.jpg' : f.poster.replace(/^\//, ''));
      if (has('tickets', f.id + '.jpg')) o.ticketUrl = '/images/tickets/' + f.id + '.jpg';
      else if (f.ticket) o.ticketUrl = SITE + f.ticket;
      films.push(o);
    });
    (pk.shows || []).forEach(r => {
      const [d, t, id, v = 'premiere', h = 'luxe', sid] = Array.isArray(r) ? r : [r.d, r.t, r.id, r.v, r.h, r.sid];
      const py = (!Array.isArray(r) && r.year) ? r.year : require('../shared/tz.js').progShowYear(d, p);
      shows.push(Object.assign({ d, t, id, v, h, p: p.id }, sid ? { sid } : {}, py ? { year: py } : {}, !Array.isArray(r) && r.year ? { archive: r.archive === true } : {})); // p：场次所属专题（跨影展合并影片按此区分）
    });
  });
  const programmes = progs.map(p => {
    const o = Object.assign({}, p); delete o.file;
    o.cover = has('brand', 'prog-' + p.id + '.jpg') ? '/images/brand/prog-' + p.id + '.jpg' : (p.cover ? SITE + p.cover : '');
    o.cardCover = p.cardCover ? SITE + p.cardCover : '';
    return o;
  });
  if (!films.length || !shows.length) throw new Error('网站数据为空，未生成');
  const allFilmIds = films.filter(f => !f.ev).map(f => f.id);

  // 最小兜底（2026-11-22 起）：只保留常设专题（catalog 里 ongoing:true，如麻雀部落电影空间）的影片和场次，
  // 以及全部影院。各影展、院线专题都不放进安装包：联网后由 getData 取回，小程序也会把上次联网取到的数据
  // 存在本机（utils/datacache.js），所以只影响「第一次打开且没有网络」。这样兜底数据不随影展增减变化，
  // 影展结束后不用为了瘦身重新上传小程序。被保留场次引用的跨专题影片也保留。
  // today 只记录生成日期（fallbackDate），不决定保留哪些专题。
  const today = opt.today || new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
  let kept = progs.map(p => p.id), dropped = [];
  if (opt.minimal) {
    const keepProg = new Set(progs.filter(p => p.ongoing).map(p => p.id));
    kept = [...keepProg]; dropped = progs.filter(p => !keepProg.has(p.id)).map(p => p.id);
    for (let i = shows.length - 1; i >= 0; i--) if (!keepProg.has(shows[i].p)) shows.splice(i, 1);
    const usedFilm = new Set(shows.map(s => s.id));
    for (let i = films.length - 1; i >= 0; i--) if (!keepProg.has(films[i].prog) && !usedFilm.has(films[i].id)) films.splice(i, 1);
    for (let i = programmes.length - 1; i >= 0; i--) if (!keepProg.has(programmes[i].id)) programmes.splice(i, 1);
  }
  films.forEach(f => LEAN_DROP.forEach(k => { delete f[k]; }));
  const data = Object.assign({ builtAt: Date.now(), fallbackDate: today }, opt.minimal ? { minimal: 1 } : {},
    { films, shows, venues: cat.venues || [], programmes, aliases: cat.aliases || {}, reg: Object.assign({}, prevReg, cat.reg || {}) });
  Screenings.apply(data);
  return { data, kept, dropped, allFilmIds };
}

module.exports = { build, OUT, root };
