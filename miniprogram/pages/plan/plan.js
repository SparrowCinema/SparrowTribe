const U = require('../../utils/util.js');
const plan = require('../../utils/plan.js');
const poster = require('../../utils/poster.js');
const W = require('../../utils/watched.js');
const I = require('../../utils/i18n.js');
const t = I.tr;
const app = getApp();

Page({
  data: { i: {}, planSelectorOpen: false, planQuery: '', planOptions: [], stats: {}, days: [], clash: 0, empty: true, pf: 'all', progs: [] },
  onLoad(q) { this.to = q && q.to; this.setData({ i: I.dict() }); this.off1 = plan.onChange(() => this.build()); this.off2 = app.onData(() => this.build()); },
  onUnload() { this.off1 && this.off1(); this.off2 && this.off2(); },
  onShow() { wx.setNavigationBarTitle({ title: t('个人排片') }); this.build(); },
  onReady() { if (this.to === 'tools') setTimeout(() => wx.pageScrollTo({ selector: '#plan-tools', offsetTop: -12, duration: 300 }), 200); },
  noop() { },
  openPlanSelector(){this.setData({planSelectorOpen:true,planQuery:'',planOptions:this.data.progs});},
  closePlanSelector(){this.setData({planSelectorOpen:false});},
  searchPlanSelector(e){const q=e.detail.value.toLocaleLowerCase();this.setData({planQuery:e.detail.value,planOptions:this.data.progs.filter(p=>p.n.toLocaleLowerCase().includes(q))});},
  choosePlanScope(e){this.setProg(e);this.closePlanSelector();},
  openMap(e) { const v = app.globalData.data.venues.find(x => x.id === e.currentTarget.dataset.v); if (v) U.openMap(v); },

  build() {
    const data = app.globalData.data, idx = U.index(data), picked = plan.get();
    const all = data.shows.filter(s => idx.F[s.id] && picked.has(U.keyOf(s))).sort((a, b) => U.showDate(a) - U.showDate(b));
    // 专题筛选：只列出个人排片里有场次的专题；选中的专题已无场次时回到「全部」
    // 专题筛选：只要个人排片不为空就显示；列出所有有放映场次的专题（未加入的显示「未加入」），与网站一致
    const pids = data.programmes.map(p => p.id).filter(id => data.shows.some(s => idx.F[s.id] && U.progForShow(s, idx).id === id));
    const progs = all.length ? [{ id: 'all', n: t('全部专题'), c: all.length, lab: t('合并 ' + all.length + ' 场') }].concat(pids.map(id => { const c = all.filter(s => U.progForShow(s, idx).id === id).length; return { id, n: idx.PG[id].name, c, lab: c ? t(c + ' 场') : t('未加入') }; })) : [];
    const pf = pids.includes(this.data.pf) ? this.data.pf : 'all';
    const list = pf === 'all' ? all : all.filter(s => U.progForShow(s, idx).id === pf);
    const minutes = list.reduce((n, s) => n + idx.F[s.id].min, 0);
    let clash = 0;
    const byDay = [];
    list.forEach(s => { let g = byDay.find(x => x.d === s.d); if (!g) { g = { d: s.d, wk: U.wk(s.d), items: [] }; byDay.push(g); } g.items.push(s); });
    const days = byDay.map(g => {
      const items = g.items.map((s, i) => {
        const v = U.showView(s, idx, data, picked);
        if (i) {
          const prev = g.items[i - 1], tr = U.transfer(prev, s, idx), gap = tr.gap, en = I.isEn(), vb = idx.VN[s.v];
          const gapTxt = (en ? 'gap ' : '间隔 ') + U.durText(Math.max(gap, 0));
          let cls = 'ok', txt;
          if (gap < -2) { cls = 'clash'; txt = t('⚠ 与上一场重叠 ' + (-gap) + ' 分钟'); }
          else if (tr.kind === 'same') {
            cls = gap < tr.need ? 'tight' : 'ok';
            txt = en ? 'Same cinema · ~' + tr.need + ' min to change halls · ' + gapTxt + (gap < tr.need ? ' — tight' : '') : '同影院 · 换厅约 ' + tr.need + ' 分钟 · ' + gapTxt + (gap < tr.need ? '，时间偏紧' : '');
          } else if (tr.kind === 'city') {
            cls = 'clash'; txt = en ? '⚠ Different city — cannot connect' : '⚠ 跨城市，无法衔接';
          } else {
            cls = gap < tr.need ? 'tight' : 'ok';
            const how = tr.taxi ? (en ? 'metro ~' + tr.metro + ' min · taxi ~' + tr.taxi + ' min (estimate)' : '地铁约 ' + tr.metro + ' 分钟 · 打车约 ' + tr.taxi + ' 分钟（估算）') : (en ? 'usually 30–45 min' : '通常需 30–45 分钟');
            txt = (gap < tr.need ? (en ? '⚠ Transfer may be too tight · ' : '⚠ 转场可能来不及 · ') : '') + (en ? 'To ' : '转场 → ') + W.vShort(vb) + ' · ' + how + ' · ' + gapTxt;
          }
          v.gap = { cls, txt, mapName: U.geoOf(vb) ? vb.id : '' };
          if (gap < -2) clash++;
        }
        return v;
      });
      return { d: g.d, wk: g.wk, cnt: t(items.length + ' 场'), items, range: g.items[0].t + ' – ' + items[items.length - 1].end };
    });
    this.keys = list.map(U.keyOf);
    this.setData({planScopeName:(progs.find(p=>p.id===pf)||{n:t('全部专题')}).n, clashTxt: t('有 ' + clash + ' 组场次时间重叠'), progs, pf, days, clash, empty: !all.length, pfEmpty: !!all.length && !list.length, stats: { n: list.length, d: byDay.length, hm: Math.floor(minutes / 60) + 'h' + String(minutes % 60).padStart(2, '0') } });
  },
  // 排片长图：与网站同版式，只含当前所选专题；保存到相册，或预览后发给朋友
  makeImage() {
    if (this.busy) return;
    if (!this.data.days.length) { wx.showToast({ title: t('这个专题还没有加入场次'), icon: 'none' }); return; }
    this.busy = true; wx.showLoading({ title: t('正在生成长图…'), mask: true });
    const fail = msg => { this.busy = false; wx.hideLoading(); wx.showToast({ title: msg || t('生成失败，请稍后再试'), icon: 'none' }); };
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
        poster.draw(c, { days, stats: this.data.stats, title: t('我的观影日程'), sub: this.data.pf !== 'all' && cur ? t('专题：') + cur.n : '', imgs, marks, T: t, en: I.isEn() });
        wx.canvasToTempFilePath({ canvas, fileType: 'png', success: r => { this.busy = false; wx.hideLoading(); this.showImage(r.tempFilePath); }, fail: () => fail() });
      } catch (e) { fail(); }
    });
  },
  showImage(path) {
    wx.showActionSheet({ itemList: [t('保存到相册'), t('预览并发给朋友')], success: r => { if (r.tapIndex === 0) this.saveImage(path); else wx.previewImage({ urls: [path] }); } });
  },
  saveImage(path) {
    wx.saveImageToPhotosAlbum({ filePath: path,
      success: () => wx.showToast({ title: t('已保存到相册'), icon: 'success' }),
      fail: err => {
        const m = (err && err.errMsg) || '';
        if (/cancel/.test(m)) return;
        if (/auth/.test(m)) wx.showModal({ title: t('需要相册权限'), content: t('请在设置里允许保存到相册；或选择「预览并发给朋友」后长按图片保存。'), confirmText: t('去设置'), success: r => { if (r.confirm) wx.openSetting(); } });
        else wx.showToast({ title: t('保存失败'), icon: 'none' });
      } });
  },
  setProg(e) { this.setData({ pf: e.currentTarget.dataset.id }); this.build(); },
  remove(e) { plan.remove(e.currentTarget.dataset.key); wx.showToast({ title: t('已移出'), icon: 'none' }); },
  clear() {
    wx.showModal({ title: t('清空个人排片？'), content: t('会同时清除云端保存的排片。'), confirmText: t('清空'), confirmColor: '#8e2a22',
      success: r => { if (r.confirm) plan.clear(); } });
  },
  open(e) { wx.navigateTo({ url: '/pages/film/film?id=' + e.currentTarget.dataset.id }); },
  toSchedule() { wx.switchTab({ url: '/pages/schedule/schedule' }); },
  onShareAppMessage(res) {
    if (res.from === 'button' && this.keys && this.keys.length) {
      return { title: t('我的观影日程') + (this.data.pf !== 'all' && this.data.progs.length ? ' · ' + (this.data.progs.find(p => p.id === this.data.pf) || {}).n : '') + ' · ' + t(this.keys.length + ' 场电影'), path: '/pages/share/share?k=' + encodeURIComponent(this.keys.join('~')) };
    }
    return { title: t('麻雀观影护照 · 影展排片与观影日程'), path: '/pages/schedule/schedule' };
  }
});
