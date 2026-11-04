const U = require('../../utils/util.js');
const plan = require('../../utils/plan.js');
const poster = require('../../utils/poster.js');
const W = require('../../utils/watched.js');
const R = require('../../utils/recap.js');
const I = require('../../utils/i18n.js');
const SY = require('../../utils/sync.js');
const Backup=require('../../utils/profile-backup.js');
const t = I.tr;
const app = getApp();

Page({
  data: {friendOpen:false,friends:[{u:'https://sparrowcinema.github.io/michelin-guide/',img:'/images/brand/friend-michelin.png',n:'全球米其林美食护照',d:'米其林餐厅名录 · 想去 / 去过 / 美食护照'}],collectionOpen:false,todayExpanded:false,careOpen:false,todayRows:[], i: {}, pp: {}, ppOpen: false, ppPage: 0, rc: {}, rcOpen: false, rcY: 'all', rcM: 'all', rcP: 'all', guideOpen: false, fbOpen: false, guide: [{ k: '看过 · 盖章', s: '在影片页点「看过」，护照里就会盖下这部片的印章；可以打星评分、改观影日期。' }, { k: '写下持有人', s: '护照首页可以填姓名、从相册放一张照片，印章每页最多 15 枚。' }, { k: '个人排片', s: '在排片表点色块右上角的 + 加入场次，「我的」里会自动检查时间冲突；首页甘特图可以只看我的排片。' }, { k: '导出与分享', s: '把排片生成带二维码的长图、分享链接或加入日历。' }, { k: '结算长图', s: '护照页底部「生成我的影院观影结算」，可按年份、月份、专题筛选，生成一张印章墙长图。' }, { k: '换设备不丢', s: '开启上方云端同步，另一台设备用同步码即可带走看过记录、评分、照片和排片。' }] },
  onLoad() { this.setData({ i: I.dict() }); this.off1 = plan.onChange(() => this.build()); this.off2 = app.onData(() => { this.build(); this.buildPassport(); }); this.off3 = W.onChange(() => this.buildPassport()); },
  onUnload() { this.off1 && this.off1(); this.off2 && this.off2(); this.off3 && this.off3(); },
  onShow() { wx.setNavigationBarTitle({ title: t('我的观影护照') }); this.openPassportFromFilm(); this.build(); this.buildPassport(); this.buildSync(); if (!this.offS) this.offS = SY.onStatus(() => this.buildSync()); if (SY.stale()) SY.quiet(); },
  onHide() { this.offS && this.offS(); this.offS = null; },
  toggleCollection(){this.setData({collectionOpen:!this.data.collectionOpen});},
  openPassportFromFilm(){if(app.globalData.openPassport){app.globalData.openPassport=0;this.setData({collectionOpen:true});}},
  toggleToday(){this.setData({todayExpanded:!this.data.todayExpanded});},
  toggleCare(){this.setData({careOpen:!this.data.careOpen});},
  backupProfile(){try{const file=wx.env.USER_DATA_PATH+'/sparrow-passport-'+Date.now()+'.json';wx.getFileSystemManager().writeFileSync(file,JSON.stringify(Backup.encode(SY.snapshot()),null,2),'utf8');wx.shareFileMessage({filePath:file,fileName:'sparrow-passport.json',fail:()=>wx.showToast({title:t('请在网页版下载备份'),icon:'none'})});}catch{wx.showToast({title:t('备份失败，请检查存储空间'),icon:'none'});}},
  restoreProfile(){wx.chooseMessageFile({count:1,type:'file',extension:['json'],success:r=>{try{const f=r.tempFiles[0];if(f.size>2600000)throw 0;const value=JSON.parse(wx.getFileSystemManager().readFileSync(f.path,'utf8'));Backup.decode(value);wx.showModal({title:t('导入备份'),content:t('导入后会合并排片，同一影片以备份中的记录为准；已开启同步时也会同步到其他设备。继续？'),success:async r=>{if(!r.confirm)return;try{await SY.restore(value);this.build();this.buildPassport();wx.showToast({title:t('备份已导入'),icon:'none'});}catch{wx.showToast({title:t('导入失败，请检查文件与存储空间'),icon:'none'});}}});}catch{wx.showToast({title:t('备份格式不正确'),icon:'none'});}}});},
  clearCloudProfile(){wx.showModal({title:t('清空云端内容并断开同步'),content:t('请先保存完整备份，并在其他设备停止同步。清空云端内容并断开本设备？本机档案仍会保留。'),success:async r=>{if(!r.confirm)return;try{await SY.clearCloud();this.buildSync();wx.showToast({title:t('云端内容已清空，本机档案保留'),icon:'none'});}catch{wx.showToast({title:t('云端清空未完成，请稍后重试'),icon:'none'});}}});},
  // ===== 观影护照：封面 → 资料页 → 印章页（每页 15 枚），印章外观与网站一致 =====
  buildPassport() {
    const data = app.globalData.data, idx = U.index(data), list = W.entries(data, idx);
    const rated = list.filter(e => e.rec.r), mins = list.reduce((n, e) => n + (e.f.min || 0), 0);
    const st = { n: list.length, progs: new Set(list.map(e => idx.progOf(e.f).id)).size, venues: new Set(list.filter(e => e.s).map(e => e.s.v)).size,
      avg: rated.length ? (rated.reduce((n, e) => n + e.rec.r, 0) / rated.length).toFixed(1) : '—', hm: Math.floor(mins / 60) + 'h' + String(mins % 60).padStart(2, '0') };
    const stamps = list.map((e, k) => {
      const lk = R.look(e.id), p = idx.progOf(e.f), r = e.rec.r || 0;
      return { id: e.id, title: e.f.cn, date: R.dstamp(e.rec.d), top: String((p && p.en) || 'SPARROW FILM PASSPORT').toUpperCase().split(/ · | & /)[0], venue: e.venue || t('影院观影'),
        shape: lk.shape, tilt: Math.round((((R.hash(e.id) % 21) - 10) * 1.1) * 10) / 10, dx: ((R.hash(e.id) >>> 5) % 9 - 4) * 3 + (Math.floor(k % 15 / 3) % 2 ? 10 : -2), dy: ((R.hash(e.id) >>> 9) % 7 - 3) * 3, ink: lk.ink, r, stars: r ? [1, 2, 3, 4, 5].map(i => Math.max(0, Math.min(2, r - (i - 1) * 2)) * 50) : [] };
    });
    const pages = []; for (let k = 0; k < Math.max(1, stamps.length); k += 15) { const items = stamps.slice(k, k + 15); pages.push({ no: String(pages.length + 2).padStart(2, '0'), items, slots: Array.from({ length: Math.min(1, 15 - items.length) }, (x, j) => j) }); }
    const hn = W.holder(), first = list[0], last = list[list.length - 1];
    this.setData({ pp: { st, pages, n: pages.length + 1, empty: !list.length, holder: hn || t('影迷'), photo: W.photo(), holderEn: hn ? '' : 'CINEPHILE',
      first: first ? R.dstamp(first.rec.d) : '—', last: last ? R.dstamp(last.rec.d) : '—',
      mrz1: 'P<SPARROW<FILM<PASSPORT<<' + (hn && !/[^\x00-\x7f]/.test(hn) ? hn.toUpperCase().replace(/[^A-Z]/g, '<').slice(0, 14) : 'CINEPHILE') + '<<<',
      mrz2: 'FILMS<' + String(st.n).padStart(3, '0') + '<<PROGS<' + String(st.progs).padStart(2, '0') + '<<AVG<' + (rated.length ? Math.round(st.avg * 10) : '00') + '<<' + (last ? last.rec.d.replace(/-/g, '') : '00000000') } });
  },
  // ===== 个人档案云端同步（同步码，与网站共用） =====
  buildSync() {
    const st = SY.state(), s = SY.status, rev = this._syShow;
    let line = '';
    if (st && st.code) {
      const ago = st.at ? ((Date.now() - st.at) / 1000 < 60 ? t('刚刚') : Math.round((Date.now() - st.at) / 60000) < 60 ? Math.round((Date.now() - st.at) / 60000) + ' ' + t('分钟前') : new Date(st.at).toLocaleDateString()) : '';
      line = s.state === 'busy' ? t('同步中…') : s.state === 'error' ? t('同步失败：') + s.msg : t('已同步') + (ago ? ' · ' + ago : '');
    }
    this.setData({ sy: { on: !!(st && st.code), state: s.state, line, code: st ? st.code : '', shown: st && st.code ? (rev ? st.code : st.code.slice(0, 7) + '-••••-••••-••••-••••-' + st.code.slice(-4)) : '', rev: !!rev } });
  },
  syStart() { wx.showLoading({ title: t('同步中…'), mask: true }); SY.start().then(() => { wx.hideLoading(); this._syShow = true; this.buildSync(); wx.showToast({ title: t('已开启同步，请保存好同步码'), icon: 'none', duration: 2500 }); }).catch(e => { wx.hideLoading(); this.buildSync(); wx.showToast({ title: t('同步失败：') + ((e && e.message) || ''), icon: 'none' }); }); },
  syJoin() {
    wx.showModal({ title: t('输入同步码'), editable: true, placeholderText: 'SP-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX', confirmText: t('连接'), success: r => {
      if (!r.confirm) return;
      if (!SY.normalize(r.content)) return wx.showToast({ title: t('同步码格式不对，请检查'), icon: 'none' });
      wx.showLoading({ title: t('同步中…'), mask: true });
      SY.join(r.content).then(() => { wx.hideLoading(); this.build(); this.buildPassport(); this.buildSync(); wx.showToast({ title: t('已连接，记录已合并'), icon: 'none' }); }).catch(e => { wx.hideLoading(); this.buildSync(); wx.showToast({ title: t('同步失败：') + ((e && e.message) || ''), icon: 'none' }); });
    } });
  },
  syNow() { SY.sync().then(r => { this.build(); this.buildPassport(); this.buildSync(); wx.showToast({ title: r && r.changed ? t('已同步，并合并了其他设备的更改') : t('已同步'), icon: 'none' }); }).catch(e => { this.buildSync(); wx.showToast({ title: t('同步失败：') + ((e && e.message) || ''), icon: 'none' }); }); },
  syReveal() { this._syShow = !this._syShow; this.buildSync(); },
  syCopy() { const st = SY.state(); if (st && st.code) wx.setClipboardData({ data: st.code, success: () => wx.showToast({ title: t('同步码已复制'), icon: 'none' }) }); },
  syStop() { wx.showModal({ title: t('停止同步'), content: t('在这台设备停止同步？本机记录会保留，云端的记录也不会删除；以后输入同步码可以重新连接。'), success: r => { if (r.confirm) { SY.stop(); this._syShow = false; this.buildSync(); } } }); },
  // 「我的」菜单里个人排片行的副标题；完整排片在 pages/plan/plan
  build() {
    const data = app.globalData.data, idx = U.index(data), picked = plan.get();
    const list = data.shows.filter(s => idx.F[s.id] && picked.has(U.keyOf(s))).sort((a, b) => U.showDate(a) - U.showDate(b));
    const now = Date.now(), next = list.find(s => U.showDate(s) >= now);
    const en = I.isEn(), md = next ? next.d.slice(5).replace('-', '/') + ' ' + U.wk(next.d) + ' ' + next.t : '';
    this.setData({ planSub: list.length ? (en ? list.length + (list.length === 1 ? ' show' : ' shows') + ' · ' + (next ? 'next ' + md : 'all screened') : list.length + ' 场 · ' + (next ? '下一场 ' + md : '已全部放映')) : t('按天查看日程 · 自动检查时间冲突') });
  },
  toPlan(e) { const to = e && e.currentTarget.dataset.to; wx.navigateTo({ url: '/pages/plan/plan' + (to ? '?to=' + to : '') }); },
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
  openLibrary(e) {app.globalData.jumpLibraryMine=e.currentTarget.dataset.mode;wx.switchTab({url:'/pages/films/films'});},
  toggleSync() {this.setData({syncExpanded:!this.data.syncExpanded});},
  ppOpen() { this.setData({ ppOpen: true, ppPage: 0 }); },
  ppClose() { this.setData({ ppOpen: false }); },
  ppChange(e) { this.setData({ ppPage: e.detail.current }); },
  ppPrev() { if (this.data.ppPage > 0) this.setData({ ppPage: this.data.ppPage - 1 }); },
  ppNext() { if (this.data.ppPage < this.data.pp.n - 1) this.setData({ ppPage: this.data.ppPage + 1 }); },
  openStamp(e) { wx.navigateTo({ url: '/pages/film/film?id=' + e.currentTarget.dataset.id }); },
  pickPhoto() {
    const choose = () => wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'], sizeType: ['compressed'], success: r => {
      const f = r.tempFiles && r.tempFiles[0] && r.tempFiles[0].tempFilePath; if (!f) return;
      const keep = p => { const fs = wx.getFileSystemManager(), old = W.photo();
        fs.saveFile({ tempFilePath: p, success: x => { W.setPhoto(x.savedFilePath); if (old) fs.removeSavedFile({ filePath: old, fail() { } }); this.buildPassport(); wx.showToast({ title: t('照片已放进护照'), icon: 'none' }); }, fail: () => wx.showToast({ title: t('照片添加失败'), icon: 'none' }) }); };
      wx.compressImage({ src: f, quality: 70, compressedWidth: 480, success: c => keep(c.tempFilePath), fail: () => keep(f) });
    } });
    if (!W.photo()) return choose();
    wx.showActionSheet({ itemList: [t('更换照片'), t('移除照片')], success: r => {
      if (r.tapIndex === 0) return choose();
      const old = W.photo(); W.setPhoto(''); if (old) wx.getFileSystemManager().removeSavedFile({ filePath: old, fail() { } }); this.buildPassport();
    } });
  },
  editHolder() {
    wx.showModal({ title: t('护照持有人（显示在资料页）'), editable: true, placeholderText: t('影迷'), content: W.holder(), success: r => { if (r.confirm) { W.setHolder(r.content); this.buildPassport(); } } });
  },
  // ===== 影院观影结算：按年份 / 专题 =====
  recapScope() {
    const data = app.globalData.data, idx = U.index(data), y = this.data.rcY || 'all', p = this.data.rcP || 'all', m = this.data.rcM || 'all';
    return W.entries(data, idx).filter(e => (y === 'all' || e.rec.d.slice(0, 4) === y) && (m === 'all' || e.rec.d.slice(0, 7) === m) && (p === 'all' || idx.progOf(e.f).id === p));
  },
  buildRecap() {
    const data = app.globalData.data, idx = U.index(data), all = W.entries(data, idx);
    const years = [...new Set(all.map(e => e.rec.d.slice(0, 4)))].sort().reverse(), pids = data.programmes.map(p => p.id).filter(id => all.some(e => idx.progOf(e.f).id === id));
    let y = this.data.rcY || 'all', p = this.data.rcP || 'all'; if (y !== 'all' && !years.includes(y)) y = 'all'; if (p !== 'all' && !pids.includes(p)) p = 'all';
    const months = [...new Set(all.filter(e => y === 'all' || e.rec.d.slice(0, 4) === y).map(e => e.rec.d.slice(0, 7)))].sort().reverse();
    let m = this.data.rcM || 'all'; if (m !== 'all' && !months.includes(m)) m = 'all';
    this.setData({ rcY: y, rcP: p, rcM: m });
    const list = this.recapScope(), rated = list.filter(e => e.rec.r), mins = list.reduce((n, e) => n + (e.f.min || 0), 0);
    const Y = y !== 'all' ? y : (years.length === 1 ? years[0] : ''), cnt = {};
    if (Y) all.filter(e => e.rec.d.slice(0, 4) === Y).forEach(e => { const k = e.rec.d.slice(0, 7); cnt[k] = (cnt[k] || 0) + 1; });
    const max = Math.max(1, ...Object.values(cnt)), nb = n => n + (I.isEn() ? (n === 1 ? ' film' : ' films') : ' 部');
    // 6×2 观影热度日历：颜色深浅＝那个月看了几部（accent #8e2a22）
    const grid = Y ? Array.from({ length: 12 }, (_, i) => { const k = Y + '-' + String(i + 1).padStart(2, '0'), c = cnt[k] || 0, on = this.data.rcM === k;
      return { v: on ? 'all' : k, n: String(i + 1), c, cs: c ? nb(c) : '—', on, bg: c && !on ? 'background:rgba(142,42,34,' + (0.14 + 0.46 * c / max).toFixed(2) + ');border-color:rgba(142,42,34,' + (0.22 + 0.46 * c / max).toFixed(2) + ')' : '' }; }) : [];
    const ycnt = {}; all.forEach(e => { const k = e.rec.d.slice(0, 4); ycnt[k] = (ycnt[k] || 0) + 1; });
    this.setData({ rc: { grid, months: [{ v: 'all', n: t('全部月份') }].concat(months.map(v => ({ v, n: y === 'all' ? v.replace('-', '.') : t((+v.slice(5)) + '月') }))), years: [{ v: 'all', n: t('全部'), c: nb(all.length) }].concat(years.map(v => ({ v, n: v, c: nb(ycnt[v]) }))), mY: Y, mSel: this.data.rcM !== 'all' ? t((+this.data.rcM.slice(5)) + '月') : '', progs: [{ v: 'all', n: t('全部专题') }].concat(pids.map(v => ({ v, n: idx.PG[v].name }))),
      n: list.length, hm: Math.floor(mins / 60) + 'h' + String(mins % 60).padStart(2, '0'), avg: rated.length ? (rated.reduce((n, e) => n + e.rec.r, 0) / rated.length).toFixed(1) : '—' } });
  },
  openRecap() {
    const data = app.globalData.data; if (!W.entries(data, U.index(data)).length) { wx.showToast({ title: t('先在影片页点「看过」，盖下第一枚印章'), icon: 'none' }); return; }
    this.buildRecap(); this.setData({ rcOpen: true });
  },
  closeRecap() { this.setData({ rcOpen: false }); },
  setRcM(e) { const d = e.currentTarget.dataset; if (d.c === 0) return; this.setData({ rcM: d.v }); this.buildRecap(); },
  copyContact(e) { const v = e.currentTarget.dataset.v; wx.setClipboardData({ data: v, success: () => wx.showToast({ title: /^https?:/.test(v) ? t('链接已复制') : t('已复制') + ' ' + v, icon: 'none' }) }); },
  toggleFriend() { this.setData({ friendOpen: !this.data.friendOpen }); },
  toggleFb() { this.setData({ fbOpen: !this.data.fbOpen }); },
  toggleGuide() { this.setData({ guideOpen: !this.data.guideOpen }); },
  setRcY(e) { this.setData({ rcY: e.currentTarget.dataset.v }); this.buildRecap(); },
  setRcP(e) { this.setData({ rcP: e.currentTarget.dataset.v }); this.buildRecap(); },
  noop() { },
  makeRecap() {
    const list = this.recapScope(); if (!list.length || this.busy) return;
    this.busy = true; wx.showLoading({ title: t('正在生成观影结算…'), mask: true });
    const fail = () => { this.busy = false; wx.hideLoading(); wx.showToast({ title: t('图片生成失败，请稍后再试'), icon: 'none' }); };
    const data = app.globalData.data, idx = U.index(data), y = this.data.rcY, pid = this.data.rcP, mo = this.data.rcM || 'all';
    wx.createSelectorQuery().select('#recap').fields({ node: true, size: true }).exec(async res => {
      try {
        const canvas = res && res[0] && res[0].node; if (!canvas) return fail();
        const load = src => new Promise(r => { if (!src) return r(null); const im = canvas.createImage(); im.onload = () => r(im); im.onerror = () => r(null); im.src = src; });
        const imgs = {}; await Promise.all(list.map(async e => { imgs[e.id] = await load(U.poster(e.f)); }));
        const marks = await Promise.all(['/images/brand/sparrow-movies-sq.png', '/images/brand/sparrow-tribe-sq.png'].map(load));
        const qrImg = await load('/images/brand/miniprogram-code.jpg');
        const items = list.map(e => { const lk = R.look(e.id), p = idx.progOf(e.f); return { id: e.id, title: e.f.cn, en: e.f.en || e.f.o || '', date: e.rec.d, dstamp: R.dstamp(e.rec.d), venue: I.isEn() ? e.venue : e.venueFull, vs: e.venue, score: e.rec.r || 0, color: lk.ink, shape: lk.shape, tilt: lk.tilt, top: (p && p.en) || 'SPARROW FILM PASSPORT', prog: p ? p.name : '', img: imgs[e.id] }; });
        const rated = list.filter(e => e.rec.r), mins = list.reduce((n, e) => n + (e.f.min || 0), 0), months = {};
        list.forEach(e => { const m = +e.rec.d.slice(5, 7); months[m] = (months[m] || 0) + 1; });
        const topM = Object.keys(months).sort((a, b) => months[b] - months[a] || a - b)[0];
        const byP = {}; list.forEach(e => { const p = idx.progOf(e.f); const g = byP[p.id] = byP[p.id] || { name: p.name, n: 0, sum: 0, k: 0 }; g.n++; if (e.rec.r) { g.sum += e.rec.r; g.k++; } });
        const years = [...new Set(list.map(e => e.rec.d.slice(0, 4)))].sort();
        const o = { title: t('我的影院观影结算'), sub: (mo !== 'all' ? mo.replace('-', '.') : y === 'all' ? (years.length > 1 ? years[0] + '–' + years[years.length - 1] : years[0]) : y) + ' · ' + (pid === 'all' ? t('全部专题') : idx.PG[pid].name),
          kicker: 'SPARROW FILM PASSPORT · MY CINEMA RECAP', yearTag: y === 'all' ? years[years.length - 1] : y,
          stats: [[list.length, t('部影片')], [Math.floor(mins / 60) + 'h' + String(mins % 60).padStart(2, '0'), t('银幕时长')], [rated.length ? (rated.reduce((n, e) => n + e.rec.r, 0) / rated.length).toFixed(1) : '—', t('平均评分')],
            [new Set(list.filter(e => e.s).map(e => e.s.v)).size, t('家影院')], [Object.keys(byP).length, t('个专题')], [topM ? t(topM + '月') : '—', t('看得最多的月份')]],
          fav: items.filter(x => x.score).sort((a, b) => b.score - a.score || b.date.localeCompare(a.date))[0] || null,
          progs: Object.keys(byP).map(k => ({ name: byP[k].name, n: byP[k].n, avg: byP[k].k ? byP[k].sum / byP[k].k : 0 })).sort((a, b) => b.n - a.n),
          items, qr: null, qrImg, marks, T: t, en: I.isEn() };
        const k = 0.6; canvas.width = Math.round(R.W * k); canvas.height = Math.round(R.heightOf(o) * k);
        const c = canvas.getContext('2d'); c.scale(k, k); R.draw(c, o);
        wx.canvasToTempFilePath({ canvas, fileType: 'png', success: r => { this.busy = false; wx.hideLoading(); this.setData({ rcOpen: false }); this.showImage(r.tempFilePath); }, fail: () => fail() });
      } catch (err) { fail(); }
    });
  },

});
