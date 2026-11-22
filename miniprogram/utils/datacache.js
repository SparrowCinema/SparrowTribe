// 本机数据缓存：每次从云端取到排片数据后存一份到本机文件，下次启动先用它，云端返回后照常替换。
// 安装包里的兜底数据只含常设专题（最小兜底），有了本机缓存，各影展的影片在启动瞬间和离线时也不会消失。
// 只存列表 / 排片 / 护照需要的字段（长文字段联网后再取），文件放在用户目录，不占 storage 的 10MB 限额。
const FILE = (wx.env && wx.env.USER_DATA_PATH ? wx.env.USER_DATA_PATH : '') + '/sparrow-data-cache.json';
const KEYS = ['films', 'shows', 'venues', 'programmes', 'aliases'];
const DROP = ['syn', 'bio', 'st', 'honors', 'parts', 'contentReview', 'contentNote', 'editorial', 'highlights', 'links'];

// 读本机缓存；没有或读不出时返回 null。
// 安装包里是最小兜底（bundled.minimal，2026-11-22 起只含常设专题）时，本机缓存总比它全，一律优先用缓存；
// 旧版完整兜底才按时间比较，缓存比安装包旧就不用。
function load(bundled) {
  try {
    const c = JSON.parse(wx.getFileSystemManager().readFileSync(FILE, 'utf8'));
    if (!c || !c.savedAt || !Array.isArray(c.films) || !c.films.length || !Array.isArray(c.shows) || !c.shows.length) return null;
    if (bundled && !bundled.minimal && bundled.builtAt && c.savedAt < bundled.builtAt) return null;
    return c;
  } catch (e) { return null; }
}

// 保存一份（异步写文件，失败忽略）
function save(r) {
  try {
    if (!r || !Array.isArray(r.films) || !r.films.length || !Array.isArray(r.shows) || !r.shows.length) return;
    const o = { savedAt: Date.now() };
    KEYS.forEach(k => { if (r[k] !== undefined) o[k] = r[k]; });
    o.films = r.films.map(f => { const x = Object.assign({}, f); DROP.forEach(k => { delete x[k]; }); return x; });
    wx.getFileSystemManager().writeFile({ filePath: FILE, data: JSON.stringify(o), encoding: 'utf8', fail() { } });
  } catch (e) { }
}

module.exports = { load, save, FILE };
