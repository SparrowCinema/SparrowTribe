const T = require('../../utils/totop.js');
const U = require('../../utils/util.js');
const plan = require('../../utils/plan.js');
const OV = require('../../utils/overlap.js');
const Want = require('../../utils/want.js');
const W = require('../../utils/watched.js');
const I = require('../../utils/i18n.js');
const t = I.tr;
const app = getApp();
const NICK_KEY = 'sk-group-nick';
Page({
  onPageScroll(e) { T.scroll(this, e); },
  toTop() { T.go(); },
  data: { i: {}, items: [], days: 0, bad: false, mode: '1v1', grp: null, nick: '', withWant: true },
  onLoad(q) {
    const data = app.globalData.data, idx = U.index(data), PC = require('../../utils/planchange.js');
    this.setData({ i: I.dict() });
    if (q.g) {
      wx.setNavigationBarTitle({ title: t('多人一起排片') });
      const members = OV.decodeRelay(decodeURIComponent(q.g || ''));
      if (!members) { this.setData({ mode: 'group', bad: true }); return; }
      let nick = '';
      try { nick = wx.getStorageSync(NICK_KEY) || (W.holder && W.holder()) || ''; } catch (e) { }
      this._members = members;
      this._code = OV.encodeRelay(members);
      this.setData({ mode: 'group', nick, withWant: true });
      this.buildGroup();
      this.off = plan.onChange(() => this.buildGroup());
      return;
    }
    wx.setNavigationBarTitle({ title: t('朋友分享的排片') });
    const keys = [...new Set(decodeURIComponent(q.k || '').split('~').filter(Boolean).map(k => PC.resolve(data, k)))]; // 改期的场次按变更记录换成新场次
    const list = data.shows.filter(s => idx.F[s.id] && keys.includes(U.keyOf(s))).sort((a, b) => U.showDate(a) - U.showDate(b));
    this.keys = list.map(U.keyOf); this._list = list; this._miss = keys.length - list.length;
    this.setData({ mode: '1v1', cnt: t(list.length + ' 场电影 · ' + new Set(list.map(s => s.d)).size + ' 天'), bad: !list.length, items: list.map(s => U.showView(s, idx, data, plan.get())), days: new Set(list.map(s => s.d)).size });
    this.compare();
    this.off = plan.onChange(() => this.compare());
  },
  onUnload() { this.off && this.off(); },
  // 对排片：和我的排片比较（规则在 utils/overlap.js，网站 overlapHTML 同步）
  compare() {
    const data = app.globalData.data, idx = U.index(data), picked = plan.get(), en = I.isEn();
    const mine = data.shows.filter(s => idx.F[s.id] && picked.has(U.keyOf(s)));
    const span = s => { const a = U.showDate(s).getTime(); return [a, a + U.durationOf(s, idx) * 60000]; };
    const c = OV.compare(this._list || [], mine, { key: U.keyOf, film: s => s.id, span, now: Date.now() });
    const row = (s, extra) => { const v = U.showView(s, idx, data, picked); return { key: v.key, id: v.id, d: v.d + ' ' + v.wk, t: v.t, cn: v.cn, version: v.version, place: v.venue + ' · ' + v.hall, extra: extra || '', on: picked.has(v.key) }; };
    const facts = [
      c.sameFilm.length ? (en ? c.sameFilm.length + ' same film' + (c.sameFilm.length > 1 ? 's' : '') + ', different screening' : '同一部电影、不同场次 ' + c.sameFilm.length + ' 部') : '',
      c.free.length ? (en ? c.free.length + ' more of theirs fit your plan' : 'TA 还有 ' + c.free.length + ' 场和你不冲突') : '',
      c.clash.length ? (en ? c.clash.length + ' clash' + (c.clash.length > 1 ? 'es' : '') + ' with your plan' : '与你的排片冲突 ' + c.clash.length + ' 场') : ''
    ].filter(Boolean);
    this.setData({ ov: {
      empty: !mine.length, same: c.same.length,
      miss: this._miss ? (en ? this._miss + (this._miss > 1 ? ' of their screenings were changed or cancelled and are not shown' : ' of their screenings was changed or cancelled and is not shown') : 'TA 的 ' + this._miss + ' 场已更新或取消，没有显示') : '',
      facts,
      secs: [
        { k: 'same', title: t('同场'), rows: c.same.map(s => row(s)) },
        { k: 'film', title: t('同一部电影，不同场次'), rows: c.sameFilm.map(x => row(x.their, (en ? 'You picked ' : '你选的是 ') + x.mine.map(m => m.d + ' ' + m.t).join(en ? ', ' : '、'))) },
        { k: 'free', title: t('可以一起去（和你的排片不冲突）'), add: true, rows: c.free.map(s => row(s)) },
        { k: 'clash', title: t('时间冲突'), bad: true, rows: c.clash.map(x => { const f = idx.F[x.mine.id]; return row(x.their, en ? 'Clashes with your ' + f.cn + ' at ' + x.mine.d + ' ' + x.mine.t : '与你的《' + f.cn + '》' + x.mine.d + ' ' + x.mine.t + ' 冲突'); }) }
      ].filter(x => x.rows.length)
    } });
  },
  // 1v1 升级为多人接龙
  upgradeGroup() {
    const data = app.globalData.data, en = I.isEn();
    let nick = '';
    try { nick = wx.getStorageSync(NICK_KEY) || (W.holder && W.holder()) || ''; } catch (e) { }
    const theirs = { n: en ? 'Friend' : '朋友', k: this.keys || [], w: [] };
    const me = { n: nick || (en ? 'Me' : '我'), k: [...plan.get()], w: data.films.filter(f => Want.isOn(f.id)).map(f => f.id) };
    this._members = OV.upsertMember([theirs], me);
    this._code = OV.encodeRelay(this._members);
    wx.setNavigationBarTitle({ title: t('多人一起排片') });
    this.setData({ mode: 'group', nick });
    if (this.off) this.off();
    this.off = plan.onChange(() => this.buildGroup());
    this.buildGroup();
  },
  // 多人接龙分析渲染
  buildGroup() {
    const data = app.globalData.data, idx = U.index(data), PC = require('../../utils/planchange.js'), picked = plan.get(), en = I.isEn();
    const span = s => { const a = U.showDate(s, idx).getTime(); return [a, a + U.durationOf(s, idx) * 60000]; };
    const members = this._members || [];
    const res = OV.analyzeGroup(members, data.shows.filter(s => idx.F[s.id]), {
      key: U.keyOf, film: s => s.id, span, now: Date.now(), resolve: k => PC.resolve(data, k)
    });
    const N = res.stats.memberCount, sep = en ? ', ' : '、';
    const nickLower = (this.data.nick || '').trim().toLocaleLowerCase();
    const alreadyIn = !!nickLower && members.some(m => m.n.toLocaleLowerCase() === nickLower);
    const makeRow = (ev, tags, add) => {
      const v = U.showView(ev.show, idx, data, picked);
      return { key: v.key, id: v.id, d: v.d + ' ' + v.wk, t: v.t, cn: v.cn, version: v.version, place: v.venue + ' · ' + v.hall, tags, add: !!add, on: picked.has(v.key) };
    };
    const allRows = res.allTogether.map(ev => makeRow(ev, [{ c: 'all', tx: en ? 'All ' + N + ' picked' : '全员 ' + N + ' 人已选' }], false));
    const sugRows = res.suggestions.map(ev => {
      const tags = [{ c: ev.canGo === N ? 'all' : 'maj', tx: ev.canGo === N ? (en ? 'All ' + N + ' free' : '全员 ' + N + '/' + N + ' 可去') : (en ? ev.canGo + '/' + N + ' free' : ev.canGo + '/' + N + ' 人可去') }];
      if (ev.picked.length) tags.push({ c: 'pick', tx: (en ? 'Picked: ' : '已选：') + ev.picked.join(sep) });
      if (ev.freeWant.length) tags.push({ c: 'want', tx: (en ? 'Wants: ' : '想看：') + ev.freeWant.join(sep) });
      const otherFree = ev.free.filter(n => !ev.freeWant.includes(n));
      if (otherFree.length) tags.push({ c: 'free', tx: (en ? 'Free: ' : '无冲突：') + otherFree.join(sep) });
      if (ev.clashed.length) tags.push({ c: 'clash', tx: (en ? 'Clash: ' : '冲突：') + ev.clashed.map(x => x.name).join(sep) });
      return makeRow(ev, tags, true);
    });
    const mostRows = res.mostPicked.map(ev => {
      const tags = [{ c: 'pick', tx: (en ? 'Picked (' + ev.picked.length + '): ' : '已选（' + ev.picked.length + '人）：') + ev.picked.join(sep) }];
      if (ev.free.length) tags.push({ c: 'free', tx: (en ? 'Can join: ' : '可加入：') + ev.free.join(sep) });
      if (ev.clashed.length) tags.push({ c: 'clash', tx: (en ? 'Clash: ' : '冲突：') + ev.clashed.map(x => x.name).join(sep) });
      return makeRow(ev, tags, true);
    });
    const wantRows = res.sharedWants.map(w => {
      const f = idx.F[w.filmId]; if (!f) return null;
      const best = w.bestShow;
      const slotTxt = best ? (best.show.d + ' ' + best.show.t + ' · ' + (w.allFree ? (en ? 'All ' + N + ' free' : '全员无冲突') : (en ? best.canGo + '/' + N + ' free' : best.canGo + '/' + N + ' 人可去'))) : t('暂无待映场次');
      return { id: f.id, cn: f.cn, version: t(f.version || ''), who: w.who.join(sep) + '（' + w.count + (en ? ' ppl' : '人') + '）', slotTxt, allFree: w.allFree, bestKey: best ? best.key : '', on: best ? picked.has(best.key) : false };
    }).filter(Boolean);
    const secs = [
      { k: 'all', title: t('全员同场'), rows: allRows },
      { k: 'sug', title: t('一起看凑场建议'), rows: sugRows },
      { k: 'most', title: t('多数人已选'), rows: mostRows }
    ].filter(x => x.rows.length);
    this.setData({ grp: {
      n: N, max: OV.MAX_MEMBERS, alreadyIn,
      members: res.members.map((m, i) => ({ idx: i, n: m.n, sub: en ? m.picks.length + ' shows' + (m.wFilms.size ? ' · ' + m.wFilms.size + ' want' : '') : m.picks.length + ' 场' + (m.wFilms.size ? ' · ' + m.wFilms.size + ' 想看' : '') })),
      stats: res.stats, secs, wantRows
    } });
  },
  nickInput(e) { this.setData({ nick: e.detail.value }); },
  toggleWithWant() { this.setData({ withWant: !this.data.withWant }); },
  joinGroup() {
    const data = app.globalData.data, en = I.isEn();
    const nick = (this.data.nick || '').trim().slice(0, 16) || (en ? 'Me' : '我');
    try { wx.setStorageSync(NICK_KEY, nick); } catch (e) { }
    const me = { n: nick, k: [...plan.get()], w: this.data.withWant ? data.films.filter(f => Want.isOn(f.id)).map(f => f.id) : [] };
    this._members = OV.upsertMember(this._members || [], me);
    this._code = OV.encodeRelay(this._members);
    this.setData({ nick });
    this.buildGroup();
    wx.showToast({ title: t('已加入接龙，可点转发给下一位朋友'), icon: 'none' });
  },
  removeMember(e) {
    const idx = +e.currentTarget.dataset.idx;
    const next = OV.removeMember(this._members || [], idx);
    if (!next.length) return;
    this._members = next;
    this._code = OV.encodeRelay(next);
    this.buildGroup();
    wx.showToast({ title: t('已移出该成员'), icon: 'none' });
  },
  copyWebRelay() {
    const url = 'https://sparrowcinema.org/#group=' + (this._code || '');
    wx.setClipboardData({ data: url, success: () => wx.showToast({ title: t('网页接龙链接已复制'), icon: 'none' }) });
  },
  addOne(e) { const k = e.currentTarget.dataset.key; if (!k) return; plan.toggle(k); wx.showToast({ title: plan.get().has(k) ? t('已加入排片') : t('已移出排片'), icon: 'none' }); },
  pick() { wx.switchTab({ url: '/pages/schedule/schedule' }); },
  importAll() { plan.addMany(this.keys); wx.showToast({ title: t('已加入我的排片'), icon: 'success' }); setTimeout(() => wx.navigateTo({ url: '/pages/plan/plan' }), 700); },
  home() { wx.switchTab({ url: '/pages/schedule/schedule' }); },
  open(e) { wx.navigateTo({ url: '/pages/film/film?id=' + e.currentTarget.dataset.id }); },
  onShareAppMessage() {
    const en = I.isEn();
    if (this.data.mode === 'group' && this._code) {
      const n = (this._members || []).length;
      return { title: en ? `Group screening match (${n} friends)` : `多人一起排片接龙（已有 ${n} 人）`, path: '/pages/share/share?g=' + encodeURIComponent(this._code) };
    }
    const keys = (this.keys || []).join('~');
    return { title: en ? 'Shared screening plan' : '朋友分享的排片', path: '/pages/share/share?k=' + encodeURIComponent(keys) };
  }
});
