const T = require('../../utils/totop.js');
const U = require('../../utils/util.js');
const CFG = require('../../utils/cfg.js');
const plan = require('../../utils/plan.js');
const poster = require('../../utils/poster.js');
const W = require('../../utils/watched.js');
const I = require('../../utils/i18n.js');
const Lib = require('../../utils/library.js');
const t = I.tr;
// 多选：pf 是 'all' 或逗号连接的多个专题 id（「或」关系）
const sl = Lib.list, sh = Lib.has;
const app = getApp();

Page({
  onPageScroll(e) { T.scroll(this, e); },
  toTop() { T.go(); },
  data: { i: {}, planSelectorOpen: false, planQuery: '', planOptions: [], stats: {}, days: [], clash: 0, empty: true, pf: 'all', progs: [] },
  onLoad(q) { this.to = q && q.to; this.setData({ i: I.dict() }); this.off1 = plan.onChange(() => this.build()); this.off2 = app.onData(() => this.build()); },
  onUnload() { this.off1 && this.off1(); this.off2 && this.off2(); },
  onShow() { wx.setNavigationBarTitle({ title: t('个人排片') }); this.build(); },
  onReady() { if (this.to === 'tools') setTimeout(() => wx.pageScrollTo({ selector: '#plan-tools', offsetTop: -12, duration: 300 }), 200); },
  noop() { },
  openPlanSelector(){this.setData({planSelectorOpen:true,planQuery:'',planOptions:this.data.progs});},
  closePlanSelector(){this.setData({planSelectorOpen:false});},
  searchPlanSelector(e){const q=e.detail.value.toLocaleLowerCase();this.setData({planQuery:e.detail.value,planOptions:this.data.progs.filter(p=>p.n.toLocaleLowerCase().includes(q))});},
  choosePlanScope(e){const id=e.currentTarget.dataset.id;this.setData({pf:id==='all'?'all':Lib.toggle(this.data.pf,id)});this.build();const q=(this.data.planQuery||'').toLocaleLowerCase();this.setData({planOptions:this.data.progs.filter(p=>p.n.toLocaleLowerCase().includes(q))});},
  openMap(e) { const v = app.globalData.data.venues.find(x => x.id === e.currentTarget.dataset.v); if (v) U.openMap(v); },

  build() {
    const data = app.globalData.data, idx = U.index(data), picked = plan.get();
    const all = data.shows.filter(s => idx.F[s.id] && picked.has(U.keyOf(s))).sort((a, b) => U.showDate(a) - U.showDate(b));
    // 专题筛选：只列出个人排片里有场次的专题；选中的专题已无场次时回到「全部」
    // 专题筛选：只要个人排片不为空就显示；列出所有有放映场次的专题（未加入的显示「未加入」），与网站一致
    const pids = data.programmes.map(p => p.id).filter(id => data.shows.some(s => idx.F[s.id] && U.progForShow(s, idx).id === id));
    const progs = all.length ? [{ id: 'all', n: t('全部专题'), c: all.length, lab: t('合并 ' + all.length + ' 场') }].concat(pids.map(id => { const c = all.filter(s => U.progForShow(s, idx).id === id).length; return { id, n: idx.PG[id].name, c, lab: c ? t(c + ' 场') : t('未加入') }; })) : [];
    const pf = sl(this.data.pf).filter(id => pids.includes(id)).join(',') || 'all';
    const list = all.filter(s => sh(pf, U.progForShow(s, idx).id));
    this._list = list;
    progs.forEach(p => { p.selected = p.id === 'all' ? !sl(pf).length : sl(pf).includes(p.id); });
    const minutes = list.reduce((n, s) => n + idx.F[s.id].min, 0);
    let clash = 0;
    const byDay = [];
    list.forEach(s => { let g = byDay.find(x => x.d === s.d); if (!g) { g = { y: U.year(s.d, s.year), d: s.d, wk: U.wk(s.d), items: [] }; byDay.push(g); } g.items.push(s); });
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
    this.pgs = [...new Set(list.map(x => U.progForShow(x, idx).name))];
    this.setData({planScopeName: !sl(pf).length ? t('全部专题') : sl(pf).length === 1 ? ((progs.find(p => p.id === pf) || {}).n || t('全部专题')) : t(sl(pf).length + ' 个专题'), clashTxt: t('有 ' + clash + ' 组场次时间重叠'), progs, pf, days, clash, empty: !all.length, pfEmpty: !!all.length && !list.length, stats: { n: list.length, d: byDay.length, hm: Math.floor(minutes / 60) + 'h' + String(minutes % 60).padStart(2, '0') } });
  },
  // 排片长图：与网站同版式，只含当前所选专题；保存到相册，或预览后发给朋友
  // 一键把当前所选排片里还没放映的场次加入手机日历（逐场写入；已加过的记住，重复点不会重复添加）
  addAllCalendar() {
    const en = I.isEn();
    wx.showActionSheet({ itemList: [en ? 'Recommended: one-tap import on the web (Safari)' : '推荐：网页版一键导入（iPhone 用 Safari）', en ? 'Import all at once (calendar file)' : '一次导入全部（生成日历文件）', en ? 'Add one by one to phone calendar' : '逐场写入手机日历'], success: r => {
      if (r.tapIndex === 0) this.webImportTip(); else if (r.tapIndex === 1) this.shareIcs(); else this.addEachCalendar();
    } });
  },
  // 推荐路线：网页版「导出与分享」里点「导入日历」，iPhone 自带 Safari 可一键导入全部（谷歌浏览器不行）。网页要先用同步码连上这份排片
  webImportTip() {
    U.webTip('#export', CFG.tip('export', ['① iPhone 请用自带的 Safari 打开这个网址（谷歌等浏览器无法一键导入日历）；安卓用谷歌浏览器或自带浏览器都可以。', '② 进入「导出与分享」，点「导入日历」：iPhone 直接导入；安卓会下载日历文件，点开用「日历」打开，全部排片一次导入。', '首次使用，请先在网页「我的」里用同步码连接：在小程序「我的 → 个人档案云端同步」复制同步码。']), t);
  },
  // 生成 .ics 日历文件，通过微信「发送文件」交给聊天（文件传输助手/自己），点开后用系统日历一次导入全部
  shareIcs() {
    const data = app.globalData.data, idx = U.index(data), en = I.isEn();
    let list = this._list || []; const up = list.filter(s => !U.ended(s, idx)); if (up.length) list = up;
    if (!list.length) { wx.showToast({ title: t('这个专题还没有加入场次'), icon: 'none' }); return; }
    const esc = x => String(x == null ? '' : x).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
    const z = n => ('0' + n).slice(-2), st = d => d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()) + 'T' + z(d.getHours()) + z(d.getMinutes()) + '00';
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z/, 'Z');
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SparrowCinema//Sparrow Film Passport//ZH', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:' + t('麻雀观影护照'), 'X-WR-TIMEZONE:Asia/Shanghai', 'BEGIN:VTIMEZONE', 'TZID:Asia/Shanghai', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0800', 'TZOFFSETTO:+0800', 'TZNAME:CST', 'END:STANDARD', 'END:VTIMEZONE'];
    list.forEach(s => {
      const f = idx.F[s.id], a = U.showDate(s), b = new Date(a.getTime() + U.durationOf(s, idx) * 60000), pg = U.progForShow(s, idx);
      L.push('BEGIN:VEVENT', 'UID:' + encodeURIComponent(U.keyOf(s)) + '@style-kaleidoscope', 'DTSTAMP:' + stamp, 'DTSTART;TZID=Asia/Shanghai:' + st(a), 'DTEND;TZID=Asia/Shanghai:' + st(b),
        'SUMMARY:' + esc(en ? f.cn + (f.version ? ' · ' + t(f.version) : '') : `《${f.cn}》${f.version ? ' · ' + f.version : ''}`), 'LOCATION:' + esc(idx.venueName(s) + ' · ' + idx.hallName(s)),
        'DESCRIPTION:' + esc((pg && pg.name ? pg.name : '') + '\n' + t('麻雀观影护照')), 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(f.cn), 'TRIGGER:-PT1H', 'END:VALARM', 'END:VEVENT');
    });
    L.push('END:VCALENDAR');
    const name = (en ? 'Sparrow-Film-Passport-My-Schedule' : '麻雀观影护照_我的观影日程') + '.ics', path = wx.env.USER_DATA_PATH + '/' + name;
    try { wx.getFileSystemManager().writeFileSync(path, L.join('\r\n') + '\r\n', 'utf8'); } catch (e) { wx.showToast({ title: t('日历文件生成失败'), icon: 'none' }); return; }
    if (!wx.shareFileMessage) { wx.showToast({ title: t('当前微信版本不支持发送文件，请改用「逐场写入」'), icon: 'none', duration: 2500 }); return; }
    wx.shareFileMessage({ filePath: path, fileName: name, fail: err => { if (!/cancel/.test((err && err.errMsg) || '')) wx.showToast({ title: t('未能发送文件，请改用「逐场写入」'), icon: 'none', duration: 2500 }); } });
  },
  addEachCalendar() {
    if (this.calBusy) return;
    const data = app.globalData.data, idx = U.index(data);
    let done = {}; try { done = wx.getStorageSync('sk-cal-done') || {}; } catch (e) { }
    const todo = (this._list || []).filter(s => !U.ended(s, idx) && !done[U.keyOf(s)]);
    if (!todo.length) { wx.showToast({ title: t((this._list || []).length ? '没有需要新加入的场次' : '这个专题还没有加入场次'), icon: 'none' }); return; }
    wx.showModal({ title: t('排片表批量导入日历'), content: I.isEn() ? 'Add ' + todo.length + ' upcoming screenings to your phone calendar (1-hour reminder)? Ones already added are skipped.' : '把 ' + todo.length + ' 场还没放映的排片加入手机日历（开场前 1 小时提醒）？已加入过的不会重复添加。', confirmText: t('导入'), cancelText: t('取消'), success: async r => {
      if (!r.confirm) return;
      this.calBusy = true; let ok = 0, stop = false;
      for (const s of todo) {
        const f = idx.F[s.id], start = Math.floor(U.showDate(s).getTime() / 1000);
        const res = await new Promise(rs => wx.addPhoneCalendar({
          title: I.isEn() ? f.cn + (f.version ? ' · ' + t(f.version) : '') : `《${f.cn}》${f.version ? ' · ' + f.version : ''}`, startTime: start, endTime: start + U.durationOf(s, idx) * 60,
          location: idx.venueName(s) + ' · ' + idx.hallName(s), description: t('麻雀观影护照'), alarm: true, alarmOffset: 3600,
          success: () => rs(1), fail: err => rs(/cancel/.test((err && err.errMsg) || '') ? -1 : 0) }));
        if (res === 1) { ok++; done[U.keyOf(s)] = 1; } else if (res === -1) { stop = true; break; }
      }
      try { wx.setStorageSync('sk-cal-done', done); } catch (e) { }
      this.calBusy = false;
      wx.showToast({ title: I.isEn() ? (stop ? ok + ' added, the rest cancelled' : ok === todo.length ? ok + ' screenings added to your calendar' : ok + ' added, some failed') : (stop ? '已加入 ' + ok + ' 场，其余已取消' : ok === todo.length ? '已加入 ' + ok + ' 场到手机日历' : '已加入 ' + ok + ' 场，部分未成功'), icon: 'none', duration: 2500 });
    } });
  },
  makeImage() {
    if (this.busy) return;
    if (!this.data.days.length) { wx.showToast({ title: t('这个专题还没有加入场次'), icon: 'none' }); return; }
    this.busy = true; wx.showLoading({ title: t('正在生成长图…'), mask: true });
    const fail = msg => { this.busy = false; wx.hideLoading(); wx.showToast({ title: msg || t('生成失败，请稍后再试'), icon: 'none' }); };
    wx.createSelectorQuery().select('#poster').fields({ node: true, size: true }).exec(async res => {
      try {
        const canvas = res && res[0] && res[0].node; if (!canvas) return fail();
        const days = this.data.days, k = 0.7, c = canvas.getContext('2d');
        const head = poster.layout(c, { pgs: this.pgs, en: I.isEn() });
        canvas.width = Math.round(poster.D.W * k); canvas.height = Math.round(poster.heightOf(days, head.HEAD) * k);
        c.scale(k, k);
        const load = src => new Promise(r => { if (!src) return r(null); const im = canvas.createImage(); im.onload = () => r(im); im.onerror = () => r(null); im.src = src; });
        const items = days.reduce((a, g) => a.concat(g.items), []), imgs = {};
        await Promise.all([...new Set(items.map(i => i.id))].map(async id => { imgs[id] = await load((items.find(i => i.id === id) || {}).poster); }));
        const marks = await Promise.all(['/images/brand/sparrow-movies-sq.png', '/images/brand/sparrow-tribe-sq.png'].map(load));
        const qr = await load('/images/brand/miniprogram-code.jpg');
        poster.draw(c, { days, head, pgs: this.pgs, stats: this.data.stats, title: t('我的观影日程'), imgs, marks, qr, T: t, en: I.isEn() });
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
      return { title: t('我的观影日程') + (this.data.pf !== 'all' && this.data.progs.length ? ' · ' + this.data.planScopeName : '') + ' · ' + t(this.keys.length + ' 场电影'), path: '/pages/share/share?k=' + encodeURIComponent(this.keys.join('~')) };
    }
    return { title: t('麻雀观影护照 · 影展排片与观影日程'), path: '/pages/schedule/schedule' };
  }
});
