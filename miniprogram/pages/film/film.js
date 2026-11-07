const T = require('../../utils/totop.js');
const U = require('../../utils/util.js');
const Premiere = require('../../utils/premiere.js');
const Library = require('../../utils/library.js');
const plan = require('../../utils/plan.js');
const W = require('../../utils/watched.js');
const G = require('../../utils/growth.js');
const I = require('../../utils/i18n.js');
const t = I.tr;
const app = getApp();
const RT = [['豆瓣', 10], ['IMDb', 10], ['烂番茄', 100], ['MTC', 100], ['Letterboxd', 5]];

function honor(x) {
  const i = x.indexOf('｜'); const t = i > 0 ? x.slice(0, i) : ''; const rest = i > 0 ? x.slice(i + 1) : x;
  const m = rest.match(/^(\d{4})\s*(.*)$/); const yr = m ? m[1] : ''; const body = m ? m[2] : rest;
  const parts = body.split(' · ');
  const cls = t === '获奖' ? 'win' : t === '提名' ? 'nom' : /评选|入选/.test(t) ? 'list' : 'sel';
  return { t: I.tr(t || '荣誉'), yr, a: parts[0], b: parts.slice(1).join(' · '), cls };
}

Page({
  onPageScroll(e) { T.scroll(this, e); },
  toTop() { T.go(); },
  data: { i: {}, f: null, open: false, fs: 1 },
  onLoad(q) { this.setData({ i: I.dict() }); this.id = q.id; this.off1 = app.onData(() => this.build()); this.off2 = plan.onChange(() => this.build()); this.off3 = W.onChange(() => this.buildMine()); this.build(); },
  toggleGone() { this.setData({ goneOpen: !this.data.goneOpen }); },
  onUnload() { this.off1 && this.off1(); this.off2 && this.off2(); this.off3 && this.off3(); },
  build() {
    const data = app.globalData.data, idx = U.index(data), f = idx.F[this.id];
    if (!f) { wx.showToast({ title: t('没有找到这部影片'), icon: 'none' }); return; }
    wx.setNavigationBarTitle({ title: f.cn });
    const picked = plan.get(), p = idx.progOf(f);
    const allShows = data.shows.filter(s => s.id === f.id), multi = idx.progsOf(f).length > 1;
    const shows = allShows.filter(s => !U.ended(s, idx)).map(s => {
      const v = U.showView(s, idx, data, picked); const [m, d] = s.d.split('/');
      return Object.assign(v, { progTag: multi ? U.progForShow(s, idx).name : '', m, dd: d, mon: t(m + '月'), vid: s.v, geo: !!U.geoOf(idx.VN[s.v]) });
    });
    // 影展内已放映的场次：窄条保留（黑白、无操作按钮）；院线片不显示
    const goneShows = allShows.filter(s => U.ended(s, idx) && U.keepPast(U.progForShow(s, idx))).sort((a, b) => U.showDate(a) - U.showDate(b)).map(s => {
      const v = idx.VN[s.v] || {}, h = (v.halls || []).find(x => x.id === s.h), nm = (v.short || v.brand || v.name || '').replace(new RegExp('^' + (v.city || '@@') + '\\s*[·・]?\\s*'), '');
      return { key: U.keyOf(s), d: U.showDate(s).getFullYear()+'.'+s.d.split('/').map(n=>n.padStart(2,'0')).join('.'), t: s.t, place: [v.city, nm, h && (h.short || h.name), U.progForShow(s,idx).name].filter(Boolean).join(' · ') };
    });
    const ratings = (f.r || []).map((v, i) => ({
      l: t(RT[i][0]), na: v == null,
      v: v == null ? '—' : i === 2 ? v + '%' : i === 4 ? Number(v).toFixed(1) : i < 2 ? Number(v).toFixed(1) : v,
      pct: v == null ? 0 : Math.min(100, v / RT[i][1] * 100)
    }));
    const credits = [...Premiere.rows(f,I.isEn()), ['导演', f.dir], ['联合导演', f.coDirector], [f.writerLabel || '编剧', (f.writers || []).join(' / ')], ['原著', t(f.book || '')],
      [(f.genre || []).includes('纪录片') ? '出镜' : '主演', (f.cast || []).join(' / ')], ['影片版权', (I.isEn() && f.printSourceEn) || f.printSource], ['类型', (f.genre || []).map(t).join(' / ')], ['原始语言', t(f.language)], ['海报说明', f.posterNote]]
      .filter(x => x[1]).map(x => ({ k: t(x[0]), v: x[1] }));
    const all = data.films.filter(x => !x.ev), i = all.indexOf(f);
    const nav = (f.ev ? [null, null] : [all[i - 1], all[i + 1]]).map(x => x ? { id: x.id, cn: x.cn, poster: U.poster(x) } : null);
    const para = s => String(s || '').split(/\n{2,}/).filter(Boolean);
    // 购票码：影片自带 + 所属各专题的购票码（跨影展影片可有多张，按专题标注）
    const SITE = 'https://sparrowcinema.github.io/SparrowTribe/', tks = [], seenTk = {};
    const hintOf = (pl, lb, h) => t([pl ? pl + '扫码' + (lb || '购票') : '', (h || '').replace(/^淘票票扫码购票\s*[·・]?\s*/, '')].filter(Boolean).join(' · '));
    const addTk = (url, pl, lb, h, p) => { if (!url || seenTk[url]) return; seenTk[url] = 1; tks.push({ url, hint: hintOf(pl, lb, h), label: t(lb || '购票'), prog: p ? p.name : '' }); };
    addTk(U.ticket(f), f.ticketPlatform, f.ticketLabel, f.ticketHint, idx.progOf(f));
    if (!f.ev) idx.progsOf(f).forEach(x => { if (x.p.ticket) addTk(/^https?:|^\//.test(x.p.ticket) ? x.p.ticket : SITE + x.p.ticket, x.p.ticketPlatform, '', x.p.ticketHint, x.p); });
    if (tks.length < 2) tks.forEach(x => { x.prog = ''; });
    this.setData({
      tickets: tks,
      f: {
        id: f.id, ev: !!f.ev, cn: f.cn, cnDb: (!I.isEn() && f.cnDb && f.cnDb !== f.cn) ? f.cnDb : '',warnings:f.warnings||[],contentNote:f.contentNote||t('具体内容尚待核实，不代表没有敏感内容或适合所有年龄。'),sensory:f.contentReview?.sensory==='flashing', en: f.en || f.o, minText: t(f.min ? f.min + ' 分钟' : '片长待定'), release: t(f.release || ''), o: f.o !== f.cn && f.o !== (f.en || f.o) ? f.o : '', y: f.y, c: t(f.c), min: f.min, lang: t(f.language),
        version: t(f.version || ''), genre: (f.genre || []).map(t), dir: f.dir, dirO: f.dirO, dirLife: f.dirLife,
        color: (data.reg[f.reg] || {}).c, reg: t((data.reg[f.reg] || {}).n || ''), poster: U.poster(f), ticket: U.ticket(f), ticketHint: t([f.ticketPlatform ? f.ticketPlatform + "扫码" + (f.ticketLabel || "购票") : "", (f.ticketHint || "").replace(/^淘票票扫码购票\s*[·・]?\s*/, "")].filter(Boolean).join(" · ")), section: t(f.section || ""), ticketLabel: t(f.ticketLabel || '购票'),
        prog: { id: p.id, name: p.name, kind: t(p.kind) }, progs: Library.featuredProgrammes(idx.progsOf(f),p=>U.progInfo(p,data,idx)).map(x => ({ id: x.p.id, name: x.p.name, kind: t(x.p.kind), section: t(x.sec || '') })), multi: idx.progsOf(f).length > 1, section: t(f.section || ''),
        syn: para(f.syn), bio: para(f.bio), st: para(f.st), long: String(f.syn || '').length > 220,
        ini: (f.dir || '').charAt(0), highlights: [f.editorial,...(f.highlights || [])].filter(Boolean).map((x, k) => ({ n: String(k + 1).padStart(2, '0'), x })),
        honors: (f.honors || []).map(honor),
        gifts: (f.gifts || []).map((g, k) => ({ k, label: t(g.label || ''), items: (g.items || []).map(t) }))
      },
      qa: (q => q ? { label: f.qaStart + ' – ' + f.qaEnd, guest: t(f.qaGuest) } : null)(U.qaOf(f)),
      cnt: t(shows.length + ' 场'),
      shows, goneShows, goneN: t(goneShows.length + ' 场'), goneOpen: this.data.goneOpen === undefined ? !shows.length : this.data.goneOpen, ratings, credits, nav, parts: (f.parts || []).map(m => { const en = I.isEn(); return { n: en ? m.en : m.cn, sub: [en ? m.cn : m.en, m.y, m.min ? m.min + t('分钟') : '', m.c].filter(Boolean).join(' · '), dir: (en && m.dirO) || m.dir || '', src: (en && m.printSourceEn) || m.printSource || '', syn: (en ? m.synEn : m.syn) || '', bio:(en?m.bioEn:m.bio)||'', honors: (m.honors || []).map(honor) }; }), ended: allShows.length > 0 && !shows.length
    });
    this.buildMine();
    this.setData({ fs: 1 }, () => this.fitHero());
  },
  // 头图：文字较多时逐步缩小字号，使文字区高度不超过海报（上下对齐）
  fitHero() {
    wx.createSelectorQuery().in(this).select('#hero-tt').boundingClientRect().select('#hero-pst').boundingClientRect().exec(r => {
      const t = r && r[0], p = r && r[1]; if (!t || !p) return;
      if (t.height > p.height + 1 && this.data.fs > 0.55) this.setData({ fs: Math.round((this.data.fs - 0.08) * 100) / 100 }, () => this.fitHero());
    });
  },
  // 我的观影：看过 + 五星十分制评分（每颗星 2 分，可半颗）
  buildMine() {
    const data = app.globalData.data, idx = U.index(data), rec = W.get(this.id), r = rec ? rec.r || 0 : 0, s = rec ? W.showOf(rec, data) : null, en = I.isEn();
    const vs = rec ? G.views(rec) : [], n = vs.length, multi = n > 1, ed = multi && this.ed >= 0 && this.ed < n ? this.ed : -1, open = multi && !!this.rwOpen;
    const rated = vs.filter(v => v.r), avg = rated.length ? (rated.reduce((a, v) => a + v.r, 0) / rated.length).toFixed(1) : '';
    const fname = id => { const x = G.FMT[id]; return x ? (en ? x.en : x.zh) : ''; };
    const rw = multi ? { n, open, txt: (en ? 'Watched ' + n + '×' : '看过 ' + n + ' 次'), sub: (avg ? (en ? 'avg ' : '均分 ') + avg + ' · ' : '') + (en ? 'last ' : '最近 ') + vs[n - 1].d.slice(5).replace('-', '.'),
      dots: Array.from({ length: Math.min(n, 10) }, (_, k) => k),
      rows: vs.map((v, i) => { const sh = v.k && data.shows.find(x => U.keyOf(x) === v.k); return { i, no: '#' + (i + 1), d: v.d.replace(/-/g, '.'), raw: v.d, r: v.r, rs: v.r ? String(v.r) : '—', stars: [1, 2, 3, 4, 5].map(k => Math.max(0, Math.min(2, v.r - (k - 1) * 2)) * 50), edit: i === ed, last: i === n - 1,
        tag: i === 0 ? (en ? 'First' : '首刷') : i === n - 1 ? (en ? 'Latest' : '最近') : '', line: [fname(v.f) || (en ? 'Format not set' : '版本未填'), sh ? W.vShort(idx.VN[sh.v]) : ''].filter(Boolean).join(' · ') }; }) } : null;
    this.setData({ mine: { seen: !!rec, multi, rw, r, d: rec ? rec.d : '', today: W.iso(new Date()), stars: [1, 2, 3, 4, 5].map(i => Math.max(0, Math.min(2, r - (i - 1) * 2)) * 50),
      at: s ? W.vShort(idx.VN[s.v]) + ' · ' + s.t : t('未关联场次'), seenTxt: t(rec ? '已看过 · 已盖章' : '＋ 看过'), scoreTxt: r ? r + '/10' : multi ? t('给最近一次打分') : t('点星打分'),
      fmt: this.fmtModel(multi ? (ed >= 0 ? vs[ed].f : '') : rec && rec.f) } });
  },
  // 多次观影：保存时让顶层字段与各次观影一致
  saveViews(vs, extra) {
    const rec = W.get(this.id); if (!rec) return;
    const o = Object.assign({}, rec, extra || {}); delete o.v;
    if (vs.length >= 2) o.v = vs; G.normRec(o);
    if (vs.length < 2) { const x = vs[0]; o.d = x.d; o.r = x.r; o.k = x.k || ''; if (x.f) o.f = x.f; else delete o.f; }
    W.set(this.id, o);
  },
  rwAgain() {
    const rec = W.get(this.id); if (!rec) return; const vs = G.views(rec), today = W.iso(new Date());
    vs.push({ d: today, r: 0, k: '' }); vs.sort((a, b) => a.d.localeCompare(b.d)); this.rwOpen = true; this.ed = vs.map(x => x.d).lastIndexOf(today);
    this.saveViews(vs); wx.showToast({ title: t('已加一次观影 · 可补日期、版本和评分'), icon: 'none' });
  },
  rwToggle() { this.rwOpen = !this.rwOpen; this.ed = -1; this.buildMine(); },
  rwEdit(e) { this.ed = +e.currentTarget.dataset.i; this.buildMine(); },
  rwDone() { this.ed = -1; this.buildMine(); },
  rwRate(e) { const rec = W.get(this.id), i = this.ed, v = +e.currentTarget.dataset.v; if (!rec || i < 0) return; const vs = G.views(rec); if (!vs[i]) return; vs[i].r = vs[i].r === v ? 0 : v; this.saveViews(vs); },
  rwDate(e) {
    const rec = W.get(this.id), i = this.ed, d = e.detail.value; if (!rec || i < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return; const vs = G.views(rec); if (!vs[i]) return;
    const data = app.globalData.data, idx = U.index(data), sh = data.shows.find(x => x.id === this.id && W.iso(U.showDate(x)) === d && U.ended(x, idx));
    vs[i].d = d; vs[i].k = sh ? U.keyOf(sh) : ''; const key = vs[i]; vs.sort((a, b) => a.d.localeCompare(b.d)); this.ed = Math.max(0, vs.indexOf(key)); this.saveViews(vs);
  },
  rwDel(e) {
    const rec = W.get(this.id), i = +e.currentTarget.dataset.i; if (!rec) return;
    wx.showModal({ title: t('删除这一次观影记录？'), confirmColor: '#8e2a22', success: r => { if (!r.confirm) return; const vs = G.views(rec).filter((x, k) => k !== i); this.ed = -1; if (vs.length < 2) this.rwOpen = false; this.saveViews(vs); } });
  },
  // 放映版本：两列选择器（类型 → 具体版本）
  fmtModel(cur) {
    const en = I.isEn(), pl = G.pickList(cur || ''), gs = G.FORMAT_GROUPS.filter(g => pl.some(x => x.group === g.id)), none = en ? 'Not set' : '未填写';
    const groups = [{ id: '', n: none, items: [{ id: '', n: none }] }].concat(gs.map(g => ({ id: g.id, n: en ? g.en : g.zh, items: pl.filter(x => x.group === g.id).map(x => ({ id: x.id, n: en ? x.en : x.zh })) })));
    this._fm = groups;
    const gi = cur ? Math.max(0, groups.findIndex(g => g.items.some(x => x.id === cur))) : 0, ii = cur && gi ? groups[gi].items.findIndex(x => x.id === cur) : 0;
    return { cols: [groups.map(g => g.n), groups[gi].items.map(x => x.n)], val: [gi, ii], txt: cur ? groups[gi].items[ii].n : none, on: !!cur };
  },
  fmtCol(e) {
    if (e.detail.column !== 0 || !this._fm) return;
    const g = this._fm[e.detail.value]; if (!g) return;
    this.setData({ 'mine.fmt.cols[1]': g.items.map(x => x.n), 'mine.fmt.val': [e.detail.value, 0] });
  },
  setFmt(e) {
    const rec = W.get(this.id), v = e.detail.value; if (!rec || !this._fm) return;
    const it = (this._fm[v[0]] || { items: [] }).items[v[1]], vs = G.views(rec);
    if (vs.length > 1) { if (this.ed < 0 || !vs[this.ed]) return; if (it && it.id) vs[this.ed].f = it.id; else delete vs[this.ed].f; this.saveViews(vs); }
    else { const o = Object.assign({}, rec); delete o.f; if (it && it.id) o.f = it.id; W.set(this.id, o); } wx.showToast({ title: t('放映版本已更新'), icon: 'none' });
  },
  toggleSeen() {
    if (W.get(this.id)) {
      wx.showModal({ title: t('移出观影护照？'), content: t('这部电影的印章和评分会一起删除。'), confirmText: t('移出'), confirmColor: '#8e2a22', success: r => { if (r.confirm) { W.remove(this.id); wx.showToast({ title: t('已移出观影护照'), icon: 'none' }); } } });
    } else { const data = app.globalData.data; W.set(this.id, W.guess(this.id, data, U.index(data), plan.get())); wx.showToast({ title: t('已盖章 · 加入观影护照'), icon: 'none' }); }
  },
  rate(e) {
    const v = +e.currentTarget.dataset.v, data = app.globalData.data, old = W.get(this.id), rec = old || W.guess(this.id, data, U.index(data), plan.get());
    const vs = G.views(rec);
    if (old && vs.length > 1) { vs[vs.length - 1].r = vs[vs.length - 1].r === v ? 0 : v; this.saveViews(vs); }
    else W.set(this.id, Object.assign({}, rec, { r: rec.r === v ? 0 : v }));
    if (!old) wx.showToast({ title: t('已盖章 · 加入观影护照'), icon: 'none' });
  },
  setSeenDate(e) {
    const d = e.detail.value, rec = W.get(this.id); if (!rec || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
    const data = app.globalData.data, idx = U.index(data), s = data.shows.find(x => x.id === this.id && W.iso(U.showDate(x)) === d && U.ended(x, idx));
    W.set(this.id, Object.assign({}, rec, { d, k: s ? U.keyOf(s) : '' })); wx.showToast({ title: t('观影日期已更新'), icon: 'none' });
  },
  toMy() { app.globalData.openPassport = 1; wx.switchTab({ url: '/pages/my/my' }); },
  openMap(e) { const v = app.globalData.data.venues.find(x => x.id === e.currentTarget.dataset.v); if (v) U.openMap(v); },
  toggle(e) { const on = plan.toggle(e.currentTarget.dataset.key); wx.showToast({ title: t(on ? '已加入排片' : '已移出排片'), icon: 'none' }); },
  calendar(e) {
    const data = app.globalData.data, s = data.shows.find(x => U.keyOf(x) === e.currentTarget.dataset.key), idx = U.index(data), f = idx.F[s.id];
    const start = Math.floor(U.showDate(s).getTime() / 1000);
    wx.addPhoneCalendar({
      title: I.isEn() ? f.cn + (f.version ? ' · ' + t(f.version) : '') : `《${f.cn}》${f.version ? ' · ' + f.version : ''}`, startTime: start, endTime: start + U.durationOf(s, idx) * 60,
      location: idx.venueName(s) + ' · ' + idx.hallName(s), description: t('麻雀观影护照'), alarm: true, alarmOffset: 3600,
      success: () => wx.showToast({ title: t('已加入手机日历'), icon: 'none' }),
      fail: (err) => { if (!/cancel/.test(err.errMsg || '')) wx.showToast({ title: t('未能加入日历'), icon: 'none' }); }
    });
  },
  previewTicket(e) { const k = (e && e.currentTarget.dataset.k) || 0, x = (this.data.tickets || [])[k], u = x ? x.url : (this.data.f && this.data.f.ticket); if (u) wx.previewImage({ urls: [u], current: u }); },
  more() { this.setData({ open: !this.data.open }); },
  openFilm(e) { wx.redirectTo({ url: '/pages/film/film?id=' + e.currentTarget.dataset.id }); },
  openProg(e) { wx.navigateTo({ url: '/pages/programme/programme?id=' + ((e && e.currentTarget.dataset.id) || this.data.f.prog.id) }); },
  toSchedule() { wx.switchTab({ url: '/pages/schedule/schedule' }); },
  seeDay(e) { app.globalData.jumpDay = e.currentTarget.dataset.d; wx.switchTab({ url: '/pages/schedule/schedule' }); },
  onShareAppMessage() { const f = this.data.f || {}; return { title: (I.isEn() ? f.cn + (f.version ? ' ' + f.version : '') : `《${f.cn}》${f.version ? f.version : ''}`) + ' · ' + t('麻雀观影护照'), path: '/pages/film/film?id=' + this.id, imageUrl: f.poster || undefined }; },
  onShareTimeline() { const f = this.data.f || {}; return { title: (I.isEn() ? f.cn : `《${f.cn}》`) + ' · ' + t('麻雀观影护照'), query: 'id=' + this.id }; }
});
