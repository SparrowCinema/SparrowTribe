const U = require('../../utils/util.js');
const I = require('../../utils/i18n.js');
const t = I.tr;
const app = getApp();
Page({
  data: { i: {}, evGroups: [], evN: 0, evOpen: false, p: null, films: [], gone: [], goneOpen: undefined, stats: {}, section: "", sections: [], selOpen: false, selRows: [], selQuery: "", selTitle: "", selPlaceholder: "", sectionName: "", sectionN: 0 },
  onLoad(q) { this.setData({ i: I.dict() }); this.id = q.id || 'style-kaleidoscope'; this.off = app.onData(() => this.build()); this.build(); },
  onUnload() { this.off && this.off(); },
  build() {
    const data = app.globalData.data, idx = U.index(data), p = idx.PG[this.id];
    if (!p) return;
    wx.setNavigationBarTitle({ title: p.name });
    this.buildEvents(p);
    const shows = data.shows.filter(s => idx.F[s.id] && U.progForShow(s, idx).id === p.id);
    const mk = f => {
      const mine = shows.filter(s => s.id === f.id).sort((x, y) => U.showDate(x) - U.showDate(y)), next = mine.find(s => !U.ended(s, idx)), last = mine[mine.length - 1];
      const first = next || last;
      return { id: f.id, cn: f.cn, ini: (f.cn || '')[0], version: t(f.version || ''), poster: U.poster(f), color: (data.reg[f.reg] || {}).c, first: first ? first.d + ' ' + first.t : '',
        at: next ? U.showDate(next).getTime() : Infinity, lastAt: last ? U.showDate(last).getTime() : 0, gone: !!mine.length && !next };
    };
    const membership=new Set(Object.keys(p.sections||{}));
    const all = data.films.filter(f => !f.ev && idx.progOf(f).id === p.id || membership.has(f.id)).filter(f=>!this.data.section||(p.sections||{})[f.id]===this.data.section).map(mk);
    // 即将放映（含场次待公布）按下一场先后；已结束按最近一场由近及远（与网站一致）
    const films = all.filter(f => !f.gone).sort((x, y) => (x.at === y.at ? 0 : x.at < y.at ? -1 : 1) || x.cn.localeCompare(y.cn, I.isEn() ? 'en' : 'zh'));
    const gone = all.filter(f => f.gone).sort((x, y) => y.lastAt - x.lastAt || x.cn.localeCompare(y.cn, I.isEn() ? 'en' : 'zh'));
    const st = U.progInfo(p, data, idx).status;
    this.setData({ sectionName: this.data.section ? t(this.data.section) : t('全部单元'), sectionN: all.length, sections: [{name:t("全部单元"),value:""},...Array.from(new Set(Object.values(p.sections||{}))).map(n=>({name:t(n),value:n}))], p: Object.assign({}, p, { periodT: t(p.period), status: st, statusText: t(p.ongoing && st === 'live' ? '常设' : { live: '进行中', soon: '即将开始', ended: '已结束' }[st]) }), upN: t(films.length + ' 部'), goneN: t(gone.length + ' 部'), films, gone, goneOpen: this.data.goneOpen === undefined ? !films.length : this.data.goneOpen, stats: { f: data.films.filter(f=>!f.ev&&(idx.progOf(f).id===p.id||membership.has(f.id))).length, s: shows.filter(s=>!idx.F[s.id].ev).length, d: new Set(shows.map(s => s.d)).size, h: new Set(shows.map(s => s.v + s.h)).size } });
  },
  buildEvents(p) {
    const en = I.isEn(), now = new Date(), today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    const evs = p.events || [];
    const groups = (p.eventKinds || []).map(k => ({
      name: (en && p.kindEn && p.kindEn[k.id]) || k.name,
      items: evs.filter(e => e.kind === k.id).sort((a, b) => String((a.dates || [])[0] || '9').localeCompare(String((b.dates || [])[0] || '9'))).map(e => {
        const o = (en && p.evEn && p.evEn[e.id]) || {}, last = (e.dates || []).slice().sort().pop();
        return { id: e.id, title: o.title || e.title, desc: o.desc || e.desc, lines: (o.lines || e.lines).map(l => ({ k: l[0], v: l[1] })), free: !!e.free, ended: !!last && last < today };
      })
    })).filter(g => g.items.length);
    this.setData({ evGroups: groups, evN: evs.length });
  },
  openEvents() { wx.navigateTo({ url: '/pages/events/events?id=' + this.id }); },
  // 单元选择：检索弹层（与网站一致）
  selRowsFor(q) {
    const data = app.globalData.data, idx = U.index(data), p = idx.PG[this.id], sec = (p && p.sections) || {}, cur = this.data.section, m = (q || '').trim().toLocaleLowerCase();
    const films = data.films.filter(f => !f.ev && (idx.progOf(f).id === p.id || sec[f.id])), names = Array.from(new Set(Object.values(sec)));
    const rows = [{ id: '', name: t('全部单元'), sub: t(films.length + ' 部影片'), selected: cur === '' }, ...names.map(n => ({ id: n, name: t(n), sub: t(films.filter(f => sec[f.id] === n).length + ' 部影片'), selected: cur === n }))];
    return rows.filter(x => !m || (x.name + ' ' + x.sub).toLocaleLowerCase().includes(m));
  },
  openSec() { this.setData({ selOpen: true, selQuery: '', selTitle: t('选择单元'), selPlaceholder: t('搜索单元'), selRows: this.selRowsFor('') }); },
  searchSel(e) { this.setData({ selQuery: e.detail.value, selRows: this.selRowsFor(e.detail.value) }); },
  chooseSel(e) { this.setData({ section: e.currentTarget.dataset.id || '', selOpen: false }); this.build(); },
  closeSel() { this.setData({ selOpen: false, selQuery: '' }); },
  stopMove() {},
  copyTicket() { wx.setClipboardData({ data: this.data.p.ticketUrl, success: () => wx.showToast({ title: t('购票链接已复制，请在浏览器打开'), icon: 'none' }) }); },
  previewTicket() { wx.previewImage({urls:["https://sparrowcinema.github.io/SparrowTribe/"+this.data.p.ticket]}); },
  toggleGone() { this.setData({ goneOpen: !this.data.goneOpen }); },
  open(e) { wx.navigateTo({ url: '/pages/film/film?id=' + e.currentTarget.dataset.id }); },
  jump(e) {
    const to = e.currentTarget.dataset.to;
    if (to === 'gone' && !this.data.gone.length) { wx.showToast({ title: t('暂无已结束的影片'), icon: 'none' }); return; }
    const go = () => wx.createSelectorQuery().select(to === 'gone' ? '#pg-gone' : '#pg-up').boundingClientRect(r => { if (!r) return; wx.pageScrollTo({ scrollTop: Math.max(0, r.top + (this.scrollTop || 0) - 8), duration: 300 }); }).selectViewport().scrollOffset(s => { this.scrollTop = s.scrollTop; }).exec();
    if (to === 'gone' && !this.data.goneOpen) this.setData({ goneOpen: true }, go); else go();
  },
  onPageScroll(e) { this.scrollTop = e.scrollTop; },
  toSchedule() { app.globalData.jumpProg = this.id; wx.switchTab({ url: '/pages/schedule/schedule' }); },
  onShareAppMessage() { const p = this.data.p || {}; return { title: `${p.name} · ${p.sub}`, path: '/pages/programme/programme?id=' + this.id }; }
});
