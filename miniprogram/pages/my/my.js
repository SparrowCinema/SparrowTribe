const U = require('../../utils/util.js');
const plan = require('../../utils/plan.js');
const poster = require('../../utils/poster.js');
const app = getApp();

Page({
  data: { stats: {}, days: [], clash: 0, empty: true, pf: 'all', progs: [] },
  onLoad() { this.off1 = plan.onChange(() => this.build()); this.off2 = app.onData(() => this.build()); },
  onUnload() { this.off1 && this.off1(); this.off2 && this.off2(); },
  onShow() { this.build(); },
  build() {
    const data = app.globalData.data, idx = U.index(data), picked = plan.get();
    const all = data.shows.filter(s => idx.F[s.id] && picked.has(U.keyOf(s))).sort((a, b) => U.showDate(a) - U.showDate(b));
    // 专题筛选：只列出个人排片里有场次的专题；选中的专题已无场次时回到「全部」
    const pids = [...new Set(all.map(s => idx.progOf(idx.F[s.id]).id))];
    const progs = pids.length > 1 ? [{ id: 'all', n: '全部专题', c: all.length }].concat(pids.map(id => ({ id, n: idx.PG[id].name, c: all.filter(s => idx.progOf(idx.F[s.id]).id === id).length }))) : [];
    const pf = pids.includes(this.data.pf) ? this.data.pf : 'all';
    const list = pf === 'all' ? all : all.filter(s => idx.progOf(idx.F[s.id]).id === pf);
    const minutes = list.reduce((n, s) => n + idx.F[s.id].min, 0);
    let clash = 0;
    const byDay = [];
    list.forEach(s => { let g = byDay.find(x => x.d === s.d); if (!g) { g = { d: s.d, wk: U.wk(s.d), items: [] }; byDay.push(g); } g.items.push(s); });
    const days = byDay.map(g => {
      const items = g.items.map((s, i) => {
        const v = U.showView(s, idx, data, picked);
        if (i) {
          const prev = g.items[i - 1], gap = U.toMin(s.t) - (U.toMin(prev.t) + idx.F[prev.id].min);
          v.gap = gap < 0 ? { cls: 'clash', txt: '⚠ 与上一场重叠 ' + (-gap) + ' 分钟' } : gap < 20 ? { cls: 'tight', txt: '间隔仅 ' + gap + ' 分钟，留意入场时间' } : { cls: 'ok', txt: '间隔 ' + U.durText(gap) };
          if (gap < 0) clash++;
        }
        return v;
      });
      return { d: g.d, wk: g.wk, items, range: g.items[0].t + ' – ' + items[items.length - 1].end };
    });
    this.keys = list.map(U.keyOf);
    this.setData({ progs, pf, days, clash, empty: !all.length, stats: { n: list.length, d: byDay.length, hm: Math.floor(minutes / 60) + 'h' + String(minutes % 60).padStart(2, '0') } });
  },
  // 排片长图：与网站同版式，只含当前所选专题；保存到相册，或预览后发给朋友
  makeImage() {
    if (this.busy || !this.data.days.length) return;
    this.busy = true; wx.showLoading({ title: '正在生成长图…', mask: true });
    const fail = msg => { this.busy = false; wx.hideLoading(); wx.showToast({ title: msg || '生成失败，请稍后再试', icon: 'none' }); };
    wx.createSelectorQuery().select('#poster').fields({ node: true, size: true }).exec(async res => {
      try {
        const canvas = res && res[0] && res[0].node; if (!canvas) return fail();
        const days = this.data.days, k = 0.7;
        canvas.width = Math.round(poster.D.W * k); canvas.height = Math.round(poster.heightOf(days) * k);
        const c = canvas.getContext('2d'); c.scale(k, k);
        const load = src => new Promise(r => { if (!src) return r(null); const im = canvas.createImage(); im.onload = () => r(im); im.onerror = () => r(null); im.src = src; });
        const items = days.reduce((a, g) => a.concat(g.items), []), imgs = {};
        await Promise.all([...new Set(items.map(i => i.id))].map(async id => { imgs[id] = await load((items.find(i => i.id === id) || {}).poster); }));
        const marks = await Promise.all(['/images/brand/sparrow-movies-sq.png', '/images/brand/sparrow-tribe-sq.png'].map(load));
        const cur = this.data.progs.find(p => p.id === this.data.pf);
        poster.draw(c, { days, stats: this.data.stats, title: '我的观影日程', sub: this.data.pf !== 'all' && cur ? '专题：' + cur.n : '', imgs, marks });
        wx.canvasToTempFilePath({ canvas, fileType: 'png', success: r => { this.busy = false; wx.hideLoading(); this.showImage(r.tempFilePath); }, fail: () => fail() });
      } catch (e) { fail(); }
    });
  },
  showImage(path) {
    wx.showActionSheet({ itemList: ['保存到相册', '预览并发给朋友'], success: r => { if (r.tapIndex === 0) this.saveImage(path); else wx.previewImage({ urls: [path] }); } });
  },
  saveImage(path) {
    wx.saveImageToPhotosAlbum({ filePath: path,
      success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
      fail: err => {
        const m = (err && err.errMsg) || '';
        if (/cancel/.test(m)) return;
        if (/auth/.test(m)) wx.showModal({ title: '需要相册权限', content: '请在设置里允许保存到相册；或选择「预览并发给朋友」后长按图片保存。', confirmText: '去设置', success: r => { if (r.confirm) wx.openSetting(); } });
        else wx.showToast({ title: '保存失败', icon: 'none' });
      } });
  },
  setProg(e) { this.setData({ pf: e.currentTarget.dataset.id }); this.build(); },
  remove(e) { plan.remove(e.currentTarget.dataset.key); wx.showToast({ title: '已移出', icon: 'none' }); },
  clear() {
    wx.showModal({ title: '清空个人排片？', content: '会同时清除云端保存的排片。', confirmText: '清空', confirmColor: '#8e2a22',
      success: r => { if (r.confirm) plan.clear(); } });
  },
  open(e) { wx.navigateTo({ url: '/pages/film/film?id=' + e.currentTarget.dataset.id }); },
  toSchedule() { wx.switchTab({ url: '/pages/schedule/schedule' }); },
  onShareAppMessage(res) {
    if (res.from === 'button' && this.keys && this.keys.length) {
      return { title: `我的观影日程${this.data.pf !== 'all' && this.data.progs.length ? ' · ' + (this.data.progs.find(p => p.id === this.data.pf) || {}).n : ''} · ${this.keys.length} 场电影`, path: '/pages/share/share?k=' + encodeURIComponent(this.keys.join('~')) };
    }
    return { title: '麻雀观影护照 · 影展排片与观影日程', path: '/pages/schedule/schedule' };
  }
});
