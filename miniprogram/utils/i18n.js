// 中文 / English：与网站同一套词典（data/i18n/en.json → miniprogram/data/en.js，由 tools/build-fallback.js 生成）。
// 页面里的 JS 文字用 tr()；WXML 里的固定文字用 utils/l.wxs 的 L.t(i, '中文') / L.n(i, 数量, 单位)，i 来自 dict()。
// 词典里没有的文字保持中文，不会报错。
const SITE = 'https://sparrowcinema.github.io/SparrowTribe/';
let EN = require('../data/en.js');
let LANG = 'zh', KEYS = [];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pl = (n, one, many) => n + ' ' + (+n === 1 ? one : many);
const CJK = /[　-〿㐀-鿿＀-￯]/;
const PATS = [
  [/间隔仅\s*(\d+)\s*分钟，留意入场时间/g, (m, n) => 'Only ' + n + ' min between screenings — mind the entry time'],
  [/有\s*(\d+)\s*组场次时间重叠/g, (m, n) => pl(n, 'pair of screenings overlaps', 'pairs of screenings overlap')],
  [/(\d+)\s*天后/g, (m, n) => 'in ' + n + ' days'],
  [/还有\s*(\d+)\s*场/g, (m, n) => n + ' more'],
  [/(\d{4})年(\d{1,2})月(\d{1,2})日\s*/g, (m, y, mo, d) => MON[mo - 1] + ' ' + (+d) + ', ' + y + ' · '],
  [/(\d{1,2})月(\d{1,2})日/g, (m, a, b) => MON[a - 1] + ' ' + (+b)],
  [/(\d{1,2})月(?!\d)/g, (m, a) => MON[a - 1]],
  [/(\d+)\s*部影片/g, (m, n) => pl(n, 'film', 'films')],
  [/(\d+)\s*部/g, (m, n) => pl(n, 'film', 'films')],
  [/(\d+)\s*场放映/g, (m, n) => pl(n, 'screening', 'screenings')],
  [/(\d+)\s*场电影/g, (m, n) => pl(n, 'film', 'films')],
  [/(\d+)\s*场/g, (m, n) => pl(n, 'screening', 'screenings')],
  [/(\d+)\s*个放映日/g, (m, n) => pl(n, 'screening day', 'screening days')],
  [/(\d+)\s*个影厅/g, (m, n) => pl(n, 'hall', 'halls')],
  [/(\d+)\s*家有排片/g, (m, n) => pl(n, 'cinema with screenings', 'cinemas with screenings')],
  [/(\d+)\s*家/g, (m, n) => pl(n, 'cinema', 'cinemas')],
  [/(\d+)\s*天行程/g, (m, n) => pl(n, 'day', 'days')],
  [/(\d+)\s*天/g, (m, n) => pl(n, 'day', 'days')],
  [/(\d+)\s*个已结束/g, (m, n) => n + ' ended'],
  [/(\d+)\s*个进行中或即将开始/g, (m, n) => n + ' now showing or coming soon'],
  [/(\d+)\s*小时/g, (m, n) => n + 'h'],
  [/(\d+)\s*分钟/g, (m, n) => n + ' min'],
  [/(\d+)\s*分(?!钟)/g, (m, n) => n + ' min'],
  [/(\d+)\s*组/g, (m, n) => pl(n, 'pair', 'pairs')]
];
const PUNCT = [[/「([^」]*)」/g, (m, a) => '“' + a + '”'], [/（/g, () => ' ('], [/）/g, () => ')'], [/，/g, () => ', '], [/：/g, () => ': '], [/。/g, () => '. '], [/、/g, () => ', '], [/！/g, () => '!'], [/？/g, () => '?'], [/｜/g, () => ' | '], [/＋/g, () => '+']];

function setEN(en) { if (en && en.ui) { EN = { ui: en.ui || {}, exact: en.exact || {}, films: en.films || {}, programmes: en.programmes || {}, venues: en.venues || {} }; } KEYS = Object.keys(EN.ui || {}).sort((a, b) => b.length - a.length); }
function init() {
  let l = ''; try { l = wx.getStorageSync('lang'); } catch (e) { }
  if (l !== 'en' && l !== 'zh') { let sys = 'zh_CN'; try { sys = wx.getSystemInfoSync().language || sys; } catch (e) { } l = /^zh/i.test(sys) ? 'zh' : 'en'; }
  LANG = l; setEN(EN); return LANG;
}
const lang = () => LANG;
const isEn = () => LANG === 'en';
function set(l) { LANG = l === 'en' ? 'en' : 'zh'; try { wx.setStorageSync('lang', LANG); } catch (e) { } }

function trCore(c) {
  const u = EN.ui || {}, x = EN.exact || {};
  if (Object.prototype.hasOwnProperty.call(x, c)) return x[c];
  if (Object.prototype.hasOwnProperty.call(u, c)) return u[c];
  let s = c;
  PATS.forEach(([re, fn]) => { s = s.replace(re, fn); });
  for (const k of KEYS) { if (s.indexOf(k) >= 0) s = s.split(k).join(u[k]); }
  PUNCT.forEach(([re, fn]) => { s = s.replace(re, fn); });
  s = s.replace(/\s{2,}/g, ' ').replace(/\s+([,.:!?”)])/g, '$1').replace(/\(\s+/g, '(').replace(/\s*·\s*$/, '').trim();
  return CJK.test(s) ? c : s;
}
function tr(s) {
  if (LANG !== 'en' || typeof s !== 'string' || !CJK.test(s)) return s;
  const core = s.trim(); if (!core) return s;
  const out = trCore(core); if (out === core) return s;
  const at = s.indexOf(core); return s.slice(0, at) + out + s.slice(at + core.length);
}
// 给 WXML 用的词典（中文时为空对象，L.t 原样返回）
const dict = () => (LANG === 'en' ? Object.assign({ __en: 1 }, EN.ui, EN.exact) : {});

// 把影片 / 专题 / 影院换成英文译文（字段含义与网站 applyEN 一致）；中文时原样返回
function localize(data) {
  if (LANG !== 'en' || !data) return data;
  const films = data.films.map(f => {
    const o = (EN.films || {})[f.id]; if (!o) return f;
    const { title, ...rest } = o; return Object.assign({}, f, { cnZh: f.cn }, title ? { cn: title } : {}, rest);
  });
  const programmes = data.programmes.map(p => {
    const o = (EN.programmes || {})[p.id]; if (!o) return p;
    const r = Object.assign({}, p, o); if (o.cover) r.cover = SITE + o.cover; return r;
  });
  const venues = data.venues.map(v => {
    const o = (EN.venues || {})[v.id]; if (!o) return v;
    const { halls, ...rest } = o;
    return Object.assign({}, v, rest, halls ? { halls: (v.halls || []).map(h => Object.assign({}, h, halls[h.id] || {})) } : {});
  });
  const reg = {}; Object.keys(data.reg || {}).forEach(k => { reg[k] = Object.assign({}, data.reg[k], { n: tr(data.reg[k].n) }); });
  return Object.assign({}, data, { films, programmes, venues, reg });
}

module.exports = { init, lang, isEn, set, setEN, tr, dict, localize, CJK };
