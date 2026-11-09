const Taste=require('../../utils/taste.js'),C=require('../../utils/community.js'),SY=require('../../utils/sync.js');
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

const SM = require('../../utils/share-make.js');
Page({
  onPageScroll(e) { T.scroll(this, e); },
  toTop() { T.go(); },
  data: { i: {}, f: null, open: false, fs: 1, tsShow: false, tsRow: {}, lgShow: false, lg: { shows: [], fmt: { cols: [[], []], val: [0, 0] }, stars: [0, 0, 0, 0, 0] } },
  onLoad(q) { this.setData({ i: I.dict() }); this.id = SM.fromScene(q, ((app.globalData.data || {}).films || []).map(x => x.id)); this.off1 = app.onData(() => this.build()); this.off2 = plan.onChange(() => this.build()); this.off3 = W.onChange(() => this.buildMine()); this.offC=C.subscribe(()=>this.setData({community:C.model(this.id,I.isEn()),tsRow:this.tsRowModel()}));this.build();this.loadCommunity(); },
  loadCommunity(){C.read([this.id]).then(()=>this.setData({community:C.model(this.id,I.isEn()),tsRow:this.tsRowModel(),communityError:false})).catch(()=>this.setData({communityError:true}));},
  async communityAction(e){const action=e.currentTarget.dataset.action;if(action==='retry'){await SY.quiet();C.changed();await C.flush();return this.loadCommunity();}if(!C.identity()){wx.showToast({title:t('请先在「我的」开启云端同步'),icon:'none'});return;}const rec=W.get(this.id);if(!rec)return;const commit=async()=>{await SY.quiet();const current=W.get(this.id);if(!current)return;W.set(this.id,Taste.set(current,'tastePublic',action==='publish'));C.changed();await C.flush();this.loadCommunity();};commit();},
  toggleGone() { this.setData({ goneOpen: !this.data.goneOpen }); },
  onUnload() { this.offC&&this.offC();this.off1 && this.off1(); this.off2 && this.off2(); this.off3 && this.off3(); },
  build() {
    const data = app.globalData.data, idx = U.index(data), f = idx.F[this.id];
    if (!f) { wx.showToast({ title: t('没有找到这部影片'), icon: 'none' }); return; }
    wx.setNavigationBarTitle({ title: f.cn });
    const picked = plan.get(), p = idx.progOf(f);
    const allShows = data.shows.filter(s => s.id === f.id), multi = idx.progsOf(f).length > 1;
    const shows = allShows.filter(s => !U.ended(s, idx)).map(s => {
      const v = U.showView(s, idx, data, picked); const [m, d] = s.d.split('/');
      return Object.assign(v, { progTag: multi ? U.progForShow(s, idx).name : '', m, dd: d, mon: t(m + '月'), vid: s.v, sd: s.d, geo: !!U.geoOf(idx.VN[s.v]) });
    });
    // 院线片：放映场次按日期、影院多选筛选（只影响本页显示，与网站 showFilterHTML 一致）
    const sfSt = this.sf || (this.sf = { d: [], v: [] }), cinema = idx.progsOf(f).some(x => x.p && x.p.kind === '院线') || allShows.some(s => (U.progForShow(s, idx) || {}).kind === '院线');
    const sfDates = [...new Set(shows.map(x => x.sd))], sfVs = [...new Set(shows.map(x => x.vid))], sfCities = new Set(sfVs.map(v => (idx.VN[v] || {}).city));
    const vLabel = id => { const v = idx.VN[id] || {}, n = String(v.short || v.brand || v.name || id).replace(new RegExp('^(' + [v.city, t(v.city || '')].filter(Boolean).join('|') + ')\\s*[·・]?\\s*'), ''); return sfCities.size > 1 && v.city ? t(v.city) + ' · ' + n : n; };
    const sfShow = cinema && (sfDates.length > 1 || sfVs.length > 1);
    const sum = (sel, all, lab, unit) => !sel.length ? t(all) : sel.length === 1 ? lab(sel[0]) : lab(sel[0]) + (I.isEn() ? ' +' + (sel.length - 1) : ' 等 ' + sel.length + ' ' + unit);
    const dLabel = d => d + ' ' + U.wk(d);
    const sf = { show: sfShow, filtered: sfShow && (sfSt.d.length + sfSt.v.length > 0), hasD: sfDates.length > 1, hasV: sfVs.length > 1,
      dText: sum(sfSt.d, '全部日期', dLabel, '天'), vText: sum(sfSt.v, '全部影院', vLabel, '家'), dOn: !!sfSt.d.length, vOn: !!sfSt.v.length };
    this._sf = { shows: shows.slice(), dates: sfDates, vs: sfVs, dLabel, vLabel, cities: sfCities };
    const showsAllN = shows.length;
    if (sf.show) shows.splice(0, shows.length, ...shows.filter(x => (!sfSt.d.length || sfSt.d.includes(x.sd)) && (!sfSt.v.length || sfSt.v.includes(x.vid))));
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
      sfAll: showsAllN, cnt: sf.filtered && shows.length !== showsAllN ? t(shows.length + ' / ' + showsAllN + ' 场') : t(showsAllN + ' 场'), sf,
      shows, goneShows, goneN: t(goneShows.length + ' 场'), goneOpen: this.data.goneOpen === undefined ? !showsAllN : this.data.goneOpen, ratings, credits, nav, parts: (f.parts || []).map(m => { const en = I.isEn(); return { n: en ? m.en : m.cn, sub: [en ? m.cn : m.en, m.y, m.min ? m.min + t('分钟') : '', m.c].filter(Boolean).join(' · '), dir: (en && m.dirO) || m.dir || '', src: (en && m.printSourceEn) || m.printSource || '', syn: (en ? m.synEn : m.syn) || '', bio:(en?m.bioEn:m.bio)||'', honors: (m.honors || []).map(honor) }; }), ended: allShows.length > 0 && !shows.length
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
  dyToggle() { this.dyOpen = !this.dyOpen; this.buildMine(); },
  buildMine() {
    const data = app.globalData.data, idx = U.index(data), rec = W.get(this.id), r = rec ? rec.r || 0 : 0, en = I.isEn();
    const vs = rec ? G.views(rec) : [], n = vs.length;
    const fname = id => { const x = G.FMT[id]; return x ? (en ? x.en : x.zh) : ''; };
    const diary = vs.map((v, i) => { const sh = v.k && data.shows.find(x => U.keyOf(x) === v.k), fv = fname(v.f), l1 = sh ? W.vShort(idx.VN[sh.v]) + ' · ' + sh.t : fv;
      return { i, md: v.d.slice(5).replace('-', '.'), y: v.d.slice(0, 4), l1: l1 || (en ? 'Add screening & format' : '补充场次与版本'), l1Nil: !l1, l2: sh && fv ? fv : '', rs: v.r ? String(v.r) : '—', rNil: !v.r,
        tag: n > 1 ? (i === n - 1 ? (en ? 'Latest' : '最近') : i === 0 ? (en ? 'First' : '首刷') : '') : '' }; }).reverse();
    const fold = n > 3, open = !!this.dyOpen, hid = n - 3, shown = fold && !open ? diary.slice(0, 3) : diary;
    const taste = rec ? ['fun','bore'].map(k => ({ key:k, value: Taste.valid(rec[k]) ? rec[k] : null, stars: [1,2,3,4,5].map(n => ({ n, fill: Taste.valid(rec[k]) ? (rec[k] >= n ? 100 : rec[k] >= n - 0.5 ? 50 : 0) : 0 })) })) : ['fun','bore'].map(k => ({ key:k, value:null, stars:[1,2,3,4,5].map(n=>({n,fill:0})) }));
    this.setData({ community:C.model(this.id,I.isEn()), tsRow:this.tsRowModel(), taste, mine: { seen: !!rec, n, r, diary: shown, dyFold: fold, dyOpen: open, dyMoreTxt: open ? (en ? 'Show fewer' : '收起较早的观影') : (en ? 'Show ' + hid + ' earlier' : '展开其余 ' + hid + ' 次'), nTxt: en ? '×' + n : n + ' 次', stars: [1, 2, 3, 4, 5].map(i => Math.max(0, Math.min(2, r - (i - 1) * 2)) * 50),
      seenTxt: I.isEn() ? '+ Watched · stamp' : '＋ 看过 · 盖章', scoreTxt: r ? r + '/10' : t('点星打分') } });
  },
  // 影片页一行摘要（与网页 tasteRowHTML 同规则）；点开为底部弹层 page-container
  tsRowModel(){const rec=W.get(this.id),en=I.isEn(),a=C.get(this.id),v=k=>rec&&Taste.valid(rec[k])?String(rec[k]):'—',seen=!!rec,mine=seen&&(Taste.valid(rec.fun)||Taste.valid(rec.bore));
    const fa=a&&a.funAvg!=null?Number(a.funAvg).toFixed(1):'',ba=a&&a.boreAvg!=null?Number(a.boreAvg).toFixed(1):'',n=a?Math.max(a.funN||0,a.boreN||0):0;
    const comm=!a?'':fa||ba?(en?'Community ':'社区 ')+(fa||'—')+' · '+(ba||'—'):n?(en?n+' ratings':n+' 人评价'):seen?(en?'Be the first to rate':'成为第一个评价的人'):(en?'No ratings yet':'社区暂无评价');
    return {mine,fun:v('fun'),bore:v('bore'),comm};},
  openTaste(){this.setData({tsShow:true,lgShow:false});this.loadCommunity();},
  sheetLeave(){this.closeTaste();this.lgClose();},
  closeTaste(){if(this.data.tsShow)this.setData({tsShow:false});},
  toTasteMap(){this.setData({tsShow:false});wx.navigateTo({url:'/pages/taste-map/taste-map'});},
  tasteRate(e){const rec=W.get(this.id),k=e.currentTarget.dataset.k,n=Number(e.currentTarget.dataset.n);if(rec&&['fun','bore'].includes(k)&&Taste.valid(n))W.set(this.id,Taste.toggle(rec,k,n));},
  // 多次观影：保存时让顶层字段与各次观影一致（规则在 shared/growth.js setViews）
  saveViews(vs) { const rec = W.get(this.id); if (!rec) return; const o = G.setViews(rec, vs); if (o) W.set(this.id, o); },
  // —— 观影日记：点一行或「再看一次」打开底部编辑弹层（与网页 lgOpen 同规则）——
  lgPast() { const data = app.globalData.data, idx = U.index(data); return data.shows.filter(x => x.id === this.id && U.ended(x, idx)).sort((a, b) => U.showDate(b) - U.showDate(a)); },
  lgLabel(s) { const d = U.showDate(s), idx = U.index(app.globalData.data); return (d.getMonth() + 1) + '.' + String(d.getDate()).padStart(2, '0') + ' ' + s.t + ' · ' + W.vShort(idx.VN[s.v]); },
  lgLink(d, k) { const past = this._past || []; if (k) { const s = past.find(x => U.keyOf(x) === k); if (s && W.iso(U.showDate(s)) === d) return k; } const s = past.find(x => W.iso(U.showDate(x)) === d); return s ? U.keyOf(s) : ''; },
  lgOpen(e) {
    try { this.lgOpen0(e); } catch (err) { console.error('lgOpen', err); wx.showToast({ title: I.isEn() ? 'Could not open' : '暂时无法打开，请重试', icon: 'none' }); }
  },
  lgOpen0(e) {
    const rec = W.get(this.id); if (!rec) return; const vs = G.views(rec), i = e && e.currentTarget.dataset.i !== undefined ? +e.currentTarget.dataset.i : -1;
    this._past = this.lgPast();
    if (i >= 0 && vs[i]) this._lg = { i, isNew: false, d: vs[i].d, k: vs[i].k || '', f: vs[i].f || '', r: vs[i].r || 0 };
    else { const d = W.iso(new Date()); this._lg = { i: -1, isNew: true, d, k: '', f: '', r: 0 }; this._lg.k = this.lgLink(d, ''); }
    this.lgPaint(true);
  },
  lgPaint(show) {
    const o = this._lg; if (!o) return; const en = I.isEn(), past = this._past || [], n = G.views(W.get(this.id)).length, si = past.findIndex(x => U.keyOf(x) === o.k), s = si >= 0 ? past[si] : null;
    const lg = { d: o.d, dShow: o.d.replace(/-/g, '.'), today: W.iso(new Date()), hasPast: past.length > 0, shows: [en ? 'No linked screening' : '不关联场次'].concat(past.map(x => this.lgLabel(x))), showIdx: si + 1,
      at: s ? this.lgLabel(s) : (past.length ? (en ? 'None' : '不关联') : (en ? 'No past screenings' : '本片暂无已放映场次')), atNil: !s, fmt: this.fmtModel(o.f), r: o.r,
      stars: [1, 2, 3, 4, 5].map(k => Math.max(0, Math.min(2, o.r - (k - 1) * 2)) * 50), scoreTxt: o.r ? o.r + '/10' : (en ? '—' : '未评'),
      title: o.isNew ? (en ? 'Log another viewing' : '再看一次') : n > 1 ? (en ? 'Viewing ' + (o.i + 1) : '第 ' + (o.i + 1) + ' 次观影') : (en ? 'Viewing' : '观影记录'),
      delTxt: o.isNew ? '' : n > 1 ? (en ? 'Delete this viewing' : '删除这一次') : (en ? 'Remove from passport' : '移出观影护照') };
    const d = { lg }; if (show) { d.lgShow = true; d.tsShow = false; } this.setData(d);
  },
  lgDate(e) { const o = this._lg, d = e.detail.value; if (!o || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return; o.d = d; o.k = this.lgLink(d, o.k); this.lgPaint(); },
  lgPick(e) { const o = this._lg; if (!o) return; const k = +e.detail.value, s = k > 0 ? (this._past || [])[k - 1] : null; o.k = s ? U.keyOf(s) : ''; if (s) o.d = W.iso(U.showDate(s)); this.lgPaint(); },
  lgRate(e) { const o = this._lg; if (!o) return; const v = +e.currentTarget.dataset.v; o.r = o.r === v ? 0 : v; this.lgPaint(); },
  lgClose() { this._lg = null; if (this.data.lgShow) this.setData({ lgShow: false }); },
  lgSave() {
    const o = this._lg, rec = W.get(this.id); if (!o || !rec) return;
    const res = G.putView(rec, o.isNew ? -1 : o.i, { d: o.d, r: o.r, k: o.k, f: o.f }); if (res.rec) W.set(this.id, res.rec);
    wx.showToast({ title: o.isNew ? (I.isEn() ? 'Viewing logged' : '已记下这一次观影') : (I.isEn() ? 'Saved' : '已保存'), icon: 'none' }); this.lgClose();
  },
  lgDel() {
    const o = this._lg, rec = W.get(this.id); if (!o || !rec) return; const n = G.views(rec).length;
    if (n < 2) { wx.showModal({ title: t('移出观影护照？'), content: t('这部电影的印章和评分会一起删除。'), confirmText: t('移出'), confirmColor: '#8e2a22', success: r => { if (r.confirm) { this.lgClose(); W.remove(this.id); wx.showToast({ title: t('已移出观影护照'), icon: 'none' }); } } }); return; }
    wx.showModal({ title: t('删除这一次观影记录？'), confirmColor: '#8e2a22', success: r => { if (!r.confirm) return; const x = G.dropView(rec, o.i); if (x) W.set(this.id, x); this.lgClose(); } });
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
    this.setData({ 'lg.fmt.cols[1]': g.items.map(x => x.n), 'lg.fmt.val': [e.detail.value, 0] });
  },
  setFmt(e) {
    const o = this._lg, v = e.detail.value; if (!o || !this._fm) return;
    const it = (this._fm[v[0]] || { items: [] }).items[v[1]]; o.f = it && it.id ? it.id : ''; this.lgPaint();
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
  // 「已盖章」：到「我的」展开护照并翻到这部电影印章所在页（my.js ppJump）
  toStamp() { app.globalData.openPassport = this.id; wx.switchTab({ url: '/pages/my/my' }); },
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
  sfTap(e) { const st = this.sf || (this.sf = { d: [], v: [] }); st.d = []; st.v = []; this.build(); },
  sfRows(type, q) { const x = this._sf; if (!x) return []; const st = this.sf || { d: [], v: [] }, all = x.shows;
    const rows = type === 'date' ? [{ id: 'all', name: t('全部日期'), sub: t(all.length + ' 场'), selected: !st.d.length }, ...x.dates.map(d => { const xs = all.filter(s => s.sd === d); return { id: d, name: x.dLabel(d), sub: t(xs.length + ' 场') + ' · ' + xs.map(s => s.t || '').join(' '), selected: st.d.includes(d) }; })]
      : [{ id: 'all', name: t('全部影院'), sub: t(all.length + ' 场'), selected: !st.v.length }, ...x.vs.map(v => { const xs = all.filter(s => s.vid === v); return { id: v, name: x.vLabel(v), sub: t(xs.length + ' 场'), selected: st.v.includes(v) }; })];
    const m = String(q || '').trim().toLowerCase(); return m ? rows.filter(r => (r.name + ' ' + r.sub).toLowerCase().includes(m)) : rows; },
  sfOpen(e) { const type = e.currentTarget.dataset.type; this.setData({ sfSel: type, sfQ: '', sfTitle: t(type === 'date' ? '选择放映日期' : '选择影院'), sfPh: t(type === 'date' ? '搜索日期' : '搜索影院或城市'), sfRowsV: this.sfRows(type, '') }); },
  sfSearch(e) { this.setData({ sfQ: e.detail.value, sfRowsV: this.sfRows(this.data.sfSel, e.detail.value) }); },
  sfPick(e) { const id = e.currentTarget.dataset.id, st = this.sf || (this.sf = { d: [], v: [] }), k = this.data.sfSel === 'date' ? 'd' : 'v'; if (id === 'all') st[k] = []; else { const i = st[k].indexOf(id); if (i >= 0) st[k].splice(i, 1); else st[k].push(id); } this.setData({ sfRowsV: this.sfRows(this.data.sfSel, this.data.sfQ) }); },
  sfClose() { this.setData({ sfSel: '' }); this.build(); },
  sfStop() {},
  sharePoster() {
    const data = app.globalData.data, idx = U.index(data), f = idx.F[this.id]; if (!f) return;
    const p = idx.progOf(f), up = data.shows.filter(s => s.id === f.id && !U.ended(s, idx)).sort((a, b) => U.showDate(a) - U.showDate(b)).slice(0, 3);
    SM.make(this, { page: 'pages/film/film', scene: f.id.slice(0, 32), build: async load => ({
      kind: 'film', kicker: 'SPARROW FILM PASSPORT · ' + String(p.en || 'FILM').toUpperCase(), title: f.cn, tag: t(f.version || ''), en: f.en || f.o || '',
      meta: [f.dir ? t('导演') + ' ' + f.dir : '', [f.y, t(f.c || ''), f.min && !f.minTbd ? t(f.min + ' 分钟') : ''].filter(Boolean).join(' · '), p.name].filter(Boolean),
      lines: up.map(s => ({ when: s.d + ' ' + s.t, where: idx.venueName(s) + ' · ' + idx.hallName(s) })),
      img: await load(U.poster(f)), qrText: t('长按识别小程序码'), qrSub: t('查看影片详情、场次与购票') }) });
  },
  onShareAppMessage() { const f = this.data.f || {}; return { title: (I.isEn() ? f.cn + (f.version ? ' ' + f.version : '') : `《${f.cn}》${f.version ? f.version : ''}`) + ' · ' + t('麻雀观影护照'), path: '/pages/film/film?id=' + this.id, imageUrl: f.poster || undefined }; },
  onShareTimeline() { const f = this.data.f || {}; return { title: (I.isEn() ? f.cn : `《${f.cn}》`) + ' · ' + t('麻雀观影护照'), query: 'id=' + this.id }; }
});
