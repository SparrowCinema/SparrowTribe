/* 观影护照使用指南：网站 #guide 与小程序 packages/collect/guide 共用的规则。
 * 内容在 data/guide.json（不在这里）：{news:[{d,t,s,only?}], chapters:[{id,t,items:[[标题, 说明, 'web'|'mp'?]]}]}。
 * 网站打开 #guide 时读 data/guide.json；小程序经 getData 云函数拿到 guide 字段（改手册不用重新上传小程序）。
 * 小程序副本由 node tools/build-fallback.js 复制，并在末尾附上一份 data/guide.json 作离线兜底（DATA）。
 * 英文在 data/i18n/en.json 的 ui（整句）/ exact（≤12 字的短标题）。 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SparrowGuide = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const api = { DATA: null };
  const ok = d => d && Array.isArray(d.chapters) && d.chapters.length ? d : null;
  const pick = d => ok(d) || ok(api.DATA) || { news: [], chapters: [] };
  const forMe = (only, p) => !only || only === p;
  // 章节：按端过滤（p = 'web' / 'mp'）
  api.chaptersFor = function (data, p) {
    return pick(data).chapters.map(c => ({ id: c.id, t: c.t, items: (c.items || []).filter(x => forMe(x[2], p)).map(x => ({ k: x[0], s: x[1] })) })).filter(c => c.items.length);
  };
  // 顶部「最近更新」：本端可见、最近 days 天内（默认 45 天）、最多 max 条（默认 5），新的在前
  api.newsFor = function (data, p, opt) {
    const o = opt || {}, now = o.now || Date.now(), days = o.days || 45, max = o.max || 5;
    const from = new Date(now - days * 864e5).toISOString().slice(0, 10);
    return (pick(data).news || []).filter(n => n && n.d && n.t && forMe(n.only, p) && n.d >= from)
      .sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0)).slice(0, max).map(n => ({ d: n.d, t: n.t, s: n.s || '' }));
  };
  // 最近一条更新的日期，用于「我的」里的「新」标记（看过手册后记下这个日期）
  api.latest = function (data, p) {
    return (pick(data).news || []).filter(n => n && n.d && forMe(n.only, p)).reduce((m, n) => (n.d > m ? n.d : m), '');
  };
  // 旧接口：forPlatform(p) 等同 chaptersFor(兜底数据, p)
  api.forPlatform = p => api.chaptersFor(null, p);
  return api;
});
