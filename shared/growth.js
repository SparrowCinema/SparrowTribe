/* 麻雀观影护照 · 成长：影迷等级、全球足迹、纪念章（网站与小程序共用）
 * 网站直接引用 shared/growth.js（window.SparrowGrowth）；小程序用 miniprogram/utils/growth.js（由 tools/build-fallback.js 复制）。
 * 纯计算，不碰 DOM / wx。所有数据来自「看过」记录，不需要用户额外填写。
 *
 * compute(rows, ctx)
 *   rows: [{ id, d:'YYYY-MM-DD', r:0-10, fmt:'', min, prog:专题id, city:放映城市, venue:影院id }]
 *   ctx:  { progs:[{ id, name, en, kind, city, total }] }   kind='影展专题' 才算影展
 */
(function (root) {
  'use strict';
  const PER_VOL = 285;

  // 影迷等级：按「看过的不同影片数」，写死在代码里，片库变大不用改
  const LEVELS = [
    [1, '入场', 'Ticket Holder'], [10, '常客', 'Regular'], [25, '影迷', 'Cinephile'], [50, '资深观众', 'Devotee'],
    [100, '百片影迷', 'Centurion'], [250, '银幕行者', 'Screen Walker'], [500, '资深影迷', 'Veteran Cinephile'],
    [1000, '千片俱乐部', 'Thousand-Film Club'], [1500, '光影收藏家', 'Light Collector'], [2000, '影史行家', 'Film Scholar'],
    [3000, '光影策展人', 'Cinema Curator'], [4000, '影史守望者', 'Cinema Keeper'], [5000, '银幕传奇', 'Screen Legend'],
    [7500, '殿堂影迷', 'Hall-of-Fame Cinephile'], [10000, '万象宗师', 'Grand Master of Cinema']
  ].map(x => ({ n: x[0], zh: x[1], en: x[2] }));

  // 放映版本：全球常见的银幕与格式
  const FORMAT_GROUPS = [
    { id: 'digital', zh: '数字放映', en: 'Digital' }, { id: 'film', zh: '胶片', en: 'Film' },
    { id: 'imax', zh: 'IMAX', en: 'IMAX' }, { id: 'premium', zh: '特效厅 / 大银幕', en: 'Premium formats' }, { id: 'other', zh: '其他', en: 'Other' }
  ];
  const FORMATS = [
    ['2k', 'digital', '2K 数字', '2K Digital'], ['4k', 'digital', '4K 数字', '4K Digital'], ['laser', 'digital', '激光放映', 'Laser projection'],
    ['16mm', 'film', '16mm 胶片', '16mm film'], ['35mm', 'film', '35mm 胶片', '35mm film'], ['70mm', 'film', '70mm 胶片', '70mm film'],
    ['imax', 'imax', 'IMAX 数字', 'IMAX Digital'], ['imax-laser', 'imax', 'IMAX 激光', 'IMAX with Laser'], ['imax-gt', 'imax', 'IMAX GT', 'IMAX GT'],
    ['imax-film', 'imax', 'IMAX 胶片', 'IMAX film'], ['imax-70', 'imax', 'IMAX 70mm', 'IMAX 70mm'],
    ['dolby', 'premium', '杜比影院', 'Dolby Cinema'], ['4dx', 'premium', '4DX', '4DX'], ['screenx', 'premium', 'ScreenX', 'ScreenX'],
    ['cinity', 'premium', 'CINITY', 'CINITY'], ['led', 'premium', 'LED 银幕', 'LED screen'], ['other', 'other', '其他版本', 'Other']
  ].map(x => ({ id: x[0], group: x[1], zh: x[2], en: x[3] }));
  const FMT = {}; FORMATS.forEach(f => { FMT[f.id] = f; });
  const FILM_FMT = ['16mm', '35mm', '70mm', 'imax-film', 'imax-70'], IMAX_FMT = ['imax', 'imax-laser', 'imax-gt', 'imax-film', 'imax-70'];

  // 放映城市 → 国家 / 地区 / 大洲（新城市在这里补一行即可）
  const CITY = {
    '杭州': { en: 'Hangzhou', c: '中国大陆', cEn: 'Chinese Mainland', cont: '亚洲', contEn: 'Asia' },
    '厦门': { en: 'Xiamen', c: '中国大陆', cEn: 'Chinese Mainland', cont: '亚洲', contEn: 'Asia' },
    '嘉兴': { en: 'Jiaxing', c: '中国大陆', cEn: 'Chinese Mainland', cont: '亚洲', contEn: 'Asia' },
    '台北': { en: 'Taipei', c: '中国台湾', cEn: 'Taiwan, China', cont: '亚洲', contEn: 'Asia' }
  };

  // 纪念章分族：[门槛, 中文名, 英文名]
  const T = a => a.map(x => ({ n: x[0], zh: x[1], en: x[2] }));
  const GROUPS = [
    { id: 'festivals', zh: '影展足迹', en: 'Festivals', unit: ['个影展', ' festivals'], tiers: T([[1, '影展初访', 'First Festival'], [3, '影展常客', 'Festival Regular'], [5, '影展巡礼者', 'Circuit Walker'], [10, '影展旅行家', 'Festival Traveller'], [25, '环球影展家', 'Globe-Trotter'], [50, '全球影展旅行家', 'Global Festival Voyager']]) },
    { id: 'cities', zh: '城市足迹', en: 'Cities', unit: ['座城市', ' cities'], tiers: T([[1, '起点城市', 'Home City'], [3, '三城观影', 'Three Cities'], [5, '五城巡礼', 'Five Cities'], [10, '十城旅人', 'Ten Cities'], [25, '环球城游', 'World Tour']]) },
    { id: 'countries', zh: '国家与地区', en: 'Countries & regions', unit: ['个国家 / 地区', ' countries / regions'], tiers: T([[1, '第一方银幕', 'First Screen'], [3, '三地观影', 'Three Places'], [5, '五地巡礼', 'Five Places'], [10, '十地行者', 'Ten Places'], [20, '二十地远行', 'Twenty Places']]) },
    { id: 'continents', zh: '跨洲观影', en: 'Continents', unit: ['个大洲', ' continents'], tiers: T([[2, '跨洲观影', 'Across Continents'], [4, '四洲行者', 'Four Continents'], [6, '六洲旅人', 'Six Continents']]) },
    { id: 'collect', zh: '专题收藏', en: 'Programme collector', unit: ['% 最高专题完成度', '% best programme'], tiers: T([[25, '专题入门', 'Quarter Done'], [50, '专题过半', 'Halfway There'], [75, '专题近半百', 'Almost Complete'], [100, '专题集齐', 'Complete Set']]) },
    { id: 'venues', zh: '影院足迹', en: 'Cinemas', unit: ['家影院', ' cinemas'], tiers: T([[1, '初进影院', 'First Cinema'], [3, '三家影院', 'Three Cinemas'], [5, '五家影院', 'Five Cinemas'], [10, '十家影院', 'Ten Cinemas'], [20, '二十家影院', 'Twenty Cinemas']]) },
    { id: 'rated', zh: '评分与品味', en: 'Ratings', unit: ['次评分', ' ratings'], tiers: T([[1, '初次打分', 'First Rating'], [10, '十次评分', 'Ten Ratings'], [25, '二十五次评分', '25 Ratings'], [100, '百次评分', '100 Ratings'], [250, '品味家', 'Taste-maker']]) },
    { id: 'hours', zh: '银幕时长', en: 'Screen time', unit: ['小时', ' hours'], tiers: T([[10, '十小时', '10 Hours'], [50, '五十小时', '50 Hours'], [100, '百小时', '100 Hours'], [250, '二百五十小时', '250 Hours'], [500, '五百小时', '500 Hours'], [1000, '千小时', '1000 Hours']]) },
    { id: 'daily', zh: '一天的电影', en: 'One day, many films', unit: ['部（单日最多）', ' in one day'], tiers: T([[2, '一日双片', 'Double Feature'], [3, '一日三片', 'Triple Feature'], [4, '影展马拉松', 'Festival Marathon'], [5, '五连映', 'Five in a Day'], [6, '极限观影', 'Extreme Viewing']]) },
    { id: 'formats', zh: '版本收藏', en: 'Formats', unit: ['种放映版本', ' formats'], tiers: T([[1, '初识版本', 'First Format'], [3, '三种银幕', 'Three Formats'], [5, '五种银幕', 'Five Formats'], [8, '八种银幕', 'Eight Formats'], [12, '全球银幕收藏家', 'Screen Collector']]) },
    { id: 'filmprint', zh: '胶片信徒', en: 'Film prints', unit: ['场胶片放映', ' film screenings'], tiers: T([[1, '胶片初见', 'First Print'], [5, '胶片常客', 'Print Regular'], [10, '胶片信徒', 'Film Devotee'], [25, '胶片守护者', 'Print Keeper'], [50, '胶片传人', 'Print Disciple']]) },
    { id: 'imax', zh: 'IMAX 之旅', en: 'IMAX', unit: ['场 IMAX', ' IMAX screenings'], tiers: T([[1, 'IMAX 初见', 'First IMAX'], [5, 'IMAX 常客', 'IMAX Regular'], [10, 'IMAX 行家', 'IMAX Aficionado'], [25, 'IMAX 骨灰', 'IMAX Devotee']]) }
  ];

  const num = x => Number.isFinite(+x) ? +x : 0;
  const hmOf = mins => Math.floor(mins / 60);
  function levelOf(n) {
    let i = -1; LEVELS.forEach((l, k) => { if (n >= l.n) i = k; });
    const cur = i >= 0 ? LEVELS[i] : null, next = LEVELS[i + 1] || null, from = cur ? cur.n : 0;
    return { index: i, cur, next, left: next ? next.n - n : 0, pct: next ? Math.max(0, Math.min(100, Math.round((n - from) / (next.n - from) * 100))) : 100 };
  }
  function cityInfo(name) {
    if (CITY[name]) return CITY[name];
    for (const k in CITY) if (CITY[k].en === name) return CITY[k];   // 英文界面下城市名可能已被翻译
    return { en: name, c: '', cEn: '', cont: '', contEn: '' };
  }

  function compute(rows, ctx) {
    rows = (rows || []).filter(r => r && r.d); const progs = (ctx && ctx.progs) || [];
    const n = rows.length, mins = rows.reduce((s, r) => s + num(r.min), 0);
    const festIds = new Set(progs.filter(p => p.kind === '影展专题').map(p => p.id));
    const festivals = new Set(rows.filter(r => festIds.has(r.prog)).map(r => r.prog));
    const cityCount = {}; rows.forEach(r => { if (r.city) cityCount[r.city] = (cityCount[r.city] || 0) + 1; });
    const cities = Object.keys(cityCount);
    const countries = new Set(cities.map(c => cityInfo(c).c).filter(Boolean)), continents = new Set(cities.map(c => cityInfo(c).cont).filter(Boolean));
    const seenBy = {}; rows.forEach(r => { seenBy[r.prog] = (seenBy[r.prog] || 0) + 1; });
    const progRows = progs.map(p => ({ id: p.id, name: p.name, en: p.en || '', kind: p.kind, city: p.city || '', total: p.total || 0, seen: seenBy[p.id] || 0 }))
      .map(p => Object.assign(p, { pct: p.total ? Math.min(100, Math.round(p.seen / p.total * 100)) : 0 }));
    const bestPct = progRows.filter(p => p.total >= 5).reduce((m, p) => Math.max(m, p.pct), 0);
    const venues = new Set(rows.map(r => r.venue).filter(Boolean));
    const days = {}; rows.forEach(r => { days[r.d] = (days[r.d] || 0) + 1; });
    const fmts = new Set(rows.map(r => r.fmt).filter(Boolean));
    const val = {
      festivals: festivals.size, cities: cities.length, countries: countries.size, continents: continents.size, collect: bestPct,
      venues: venues.size, rated: rows.filter(r => r.r > 0).length, hours: hmOf(mins), daily: Math.max(0, ...Object.values(days)),
      formats: fmts.size, filmprint: rows.filter(r => FILM_FMT.includes(r.fmt)).length, imax: rows.filter(r => IMAX_FMT.includes(r.fmt)).length
    };
    const groups = GROUPS.map(g => {
      const v = val[g.id] || 0; let nextSeen = false;
      const tiers = g.tiers.map(t => { const earned = v >= t.n, next = !earned && !nextSeen; if (next) nextSeen = true; return Object.assign({}, t, { earned, next, pct: earned ? 100 : Math.min(99, Math.round(v / t.n * 100)) }); });
      return Object.assign({}, g, { value: v, tiers, earned: tiers.filter(t => t.earned).length, total: tiers.length });
    });
    const lvl = levelOf(n);
    // 下一枚：在所有未点亮的纪念章里取进度最高的；全无进度时用下一档等级
    let nextBadge = null;
    groups.forEach(g => { const t = g.tiers.find(x => x.next); if (t && g.value > 0 && (!nextBadge || t.pct > nextBadge.pct)) nextBadge = { kind: 'badge', group: g.id, zh: t.zh, en: t.en, groupZh: g.zh, groupEn: g.en, value: g.value, n: t.n, pct: t.pct, left: t.n - g.value, unit: g.unit };
    });
    if (lvl.next && (!nextBadge || lvl.pct >= nextBadge.pct)) nextBadge = { kind: 'level', group: 'level', zh: lvl.next.zh, en: lvl.next.en, groupZh: '影迷等级', groupEn: 'Level', value: n, n: lvl.next.n, pct: lvl.pct, left: lvl.left, unit: ['部', ' films'] };
    const earnedAll = groups.reduce((s, g) => s + g.earned, 0) + Math.max(0, lvl.index + 1), totalAll = groups.reduce((s, g) => s + g.total, 0) + LEVELS.length;
    const cityCards = cities.sort((a, b) => cityCount[b] - cityCount[a]).map(c => ({ name: c, en: cityInfo(c).en, country: cityInfo(c).c, countryEn: cityInfo(c).cEn, n: cityCount[c], progs: progRows.filter(p => p.city === c && p.seen > 0).sort((a, b) => b.pct - a.pct) }));
    return {
      n, hours: hmOf(mins), festivals: festivals.size, cities: cities.length, countries: countries.size, continents: continents.size,
      level: lvl, levels: LEVELS.map((l, k) => Object.assign({}, l, { earned: n >= l.n, current: k === lvl.index, next: k === lvl.index + 1 })),
      groups, nextBadge, earned: earnedAll, total: totalAll, cityCards, progs: progRows, volumes: Math.max(1, Math.ceil(n / PER_VOL))
    };
  }

  const api = { compute, levelOf, LEVELS, GROUPS, FORMATS, FORMAT_GROUPS, FMT, CITY, PER_VOL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SparrowGrowth = api;
})(typeof window !== 'undefined' ? window : this);
