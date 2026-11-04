const U = require('../../utils/util.js');
const plan = require('../../utils/plan.js');
const poster = require('../../utils/poster.js');
const W = require('../../utils/watched.js');
const R = require('../../utils/recap.js');
const I = require('../../utils/i18n.js');
const SY = require('../../utils/sync.js');
const Backup=require('../../utils/profile-backup.js');
const G = require('../../utils/growth.js');
const t = I.tr;
const app = getApp();

Page({
  data: {friendOpen:false,friends:[{u:'https://sparrowcinema.github.io/michelin-guide/',img:'/images/brand/friend-michelin.png',n:'全球米其林美食护照',g:'去全球看电影，别忘了顺路吃点美食。',d:'收录全球米其林餐厅，可标记想去、记录去过，让每座城市的电影与美味同行。'}],collectionOpen:false,todayExpanded:false,careOpen:false,todayRows:[], i: {}, pp: {}, ppOpen: false, ppPage: 0, ppVol: 0, ppShelf: false, ppTab: 'stamps', lvAll: false, gr: {}, wide: false, ppSp: 0, ppK: 1, ppH: 0, ppCH: 0, ppCK: 1, spreads: [], ppLabel: '', rc: {}, rcOpen: false, rcY: 'all', rcM: 'all', rcP: 'all', guideOpen: false, fbOpen: false, guide: [{ k: '翻开护照', s: '在「我的」里展开「我的观影护照」，点封面即可翻开；左右滑动或点上一页 / 下一页翻页。iPad 横屏、折叠屏展开时，会像书一样左右两页同时翻开。' }, { k: '看过 · 盖章', s: '在影片页点「看过」，护照里就会盖下这部片的印章；每部片的印章形状和颜色各不相同，点印章可以回到影片页。' }, { k: '评分与观影日期', s: '每部片可打 0–10 分（半颗星为 1 分），分数会印在章上；观影日期默认取你已放映的排片场次，也可以手动改成真正看的那天。' }, { k: '写下持有人', s: '护照首页点姓名可以改成自己的名字，也能从相册放一张照片；姓名会同步显示在护照底部的机读码里。' }, { k: '资料页与印章页', s: '资料页汇总看过影片、专题、影院数、平均评分、首枚与最近印章和银幕总时长；印章每页最多 15 枚，满页后自动翻到下一页。' }, { k: '分册与书架', s: '每本护照最多 285 枚印章（20 页），满了自动换下一册；按观影日期从早到晚排，第 2 册起封面会换颜色。看过的影片多了，在「我的」里点「护照书架」切换不同册。' }, { k: '个人排片', s: '在排片表点色块右上角的 + 加入场次；「我的」里会按天列出日程并自动检查时间冲突，首页甘特图可以只看我的排片，也能按专题筛选。' }, { k: '筛选多选', s: '排片页和片目页的筛选都可以多选，比如同时看几天、几家影院或几个专题，更快找到想看的场次。' }, { k: '已加入与已看过', s: '在「我的」里可以单独打开「已加入排片」和「已看过」两份片单，回顾想看的与看过的。' }, { k: '导出与分享', s: '把排片生成带二维码的长图、分享链接或加入日历（网页版另支持 PDF），发给一起看片的朋友。' }, { k: '结算长图', s: '护照页底部「生成我的影院观影结算」，可按年份、月份、专题筛选，生成一张印章墙长图，适合年终或每个影展后分享。' }, { k: '换设备不丢', s: '开启上方云端同步，另一台设备用同步码即可带走看过记录、评分、照片和排片。同步码请自己保管，丢失后无法凭姓名找回。' }, { k: '备份与恢复', s: '可以下载一份完整备份（含观影记录、评分、照片、姓名和排片，不含同步码），导入时会合并已有排片，同一影片以备份记录为准。' }, { k: '中英文与添加到手机', s: '右上角可切换中文 / English；网页版可「添加到手机」放到桌面像 App 一样用，在微信里则用浮窗；排片有误可在「反馈与纠错」告诉我们。' }] },
  onLoad() { this.setData({ i: I.dict() }); this.measure(); this._rz = () => { this.measure(); this.buildSpreads(); }; wx.onWindowResize && wx.onWindowResize(this._rz); this.off1 = plan.onChange(() => this.build()); this.off2 = app.onData(() => { this.build(); this.buildPassport(); }); this.off3 = W.onChange(() => this.buildPassport()); },
  onUnload() { this._rz && wx.offWindowResize && wx.offWindowResize(this._rz); this.off1 && this.off1(); this.off2 && this.off2(); this.off3 && this.off3(); },
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
    // 分册：每册 285 枚（1 资料页 + 19 印章页），按观影日期从早到晚，满了换下一册
    const en = I.isEn(), PER = 285, vols = []; for (let k = 0; k < Math.max(1, stamps.length); k += PER) vols.push({ s: stamps.slice(k, k + PER), l: list.slice(k, k + PER) });
    const vi = Math.min(Math.max(this.data.ppVol || vols.length, 1), vols.length), cur = vols[vi - 1], vlist = cur.l, p2 = n => String(n).padStart(2, '0'), ym = d => d ? d.slice(0, 7).replace('-', '.') : '';
    const rng = l => l.length ? (ym(l[0].rec.d) === ym(l[l.length - 1].rec.d) ? ym(l[0].rec.d) : ym(l[0].rec.d) + ' – ' + ym(l[l.length - 1].rec.d)) : '—';
    const pages = []; for (let k = 0; k < Math.max(1, cur.s.length); k += 15) { const items = cur.s.slice(k, k + 15); pages.push({ k: pages.length + 1, no: String(pages.length + 2).padStart(2, '0'), items, slots: Array.from({ length: Math.min(1, 15 - items.length) }, (x, j) => j) }); }
    const hn = W.holder(), first = vlist[0], last = vlist[vlist.length - 1];
    this.setData({ pp: { st, pages, n: pages.length + 1, nv: vols.length, vol: vi, volNo: p2(vi), volTxt: p2(vi) + ' / ' + p2(vols.length), vn: vlist.length, cv: (vi - 1) % 5 + 1, capPre: vols.length > 1 ? (en ? 'Vol. ' + vi + ' of ' + vols.length + ' · ' : '第 ' + vi + ' 册 · 共 ' + vols.length + ' 册 · ') : '', shelfTxt: en ? 'Passport shelf · ' + vols.length + ' volumes ↗' : '护照书架 · 共 ' + vols.length + ' 册 ↗', shelfLk: en ? 'Shelf · ' + vols.length + ' vols' : '书架 · ' + vols.length + ' 册',
      vols: vols.map((v, k) => ({ k: k + 1, no: p2(k + 1), cv: k % 5 + 1, range: rng(v.l), nTxt: v.l.length + (en ? ' films' : ' 部') + (k === vols.length - 1 ? (en ? ' · Latest' : ' · 最新') : v.l.length >= PER ? (en ? ' · Full' : ' · 已满') : '') })), empty: !list.length, holder: hn || t('影迷'), photo: W.photo(), holderEn: hn ? '' : 'CINEPHILE',
      first: first ? R.dstamp(first.rec.d) : '—', last: last ? R.dstamp(last.rec.d) : '—',
      mrz1: 'P<SPARROW<FILM<PASSPORT<<' + (hn && !/[^\x00-\x7f]/.test(hn) ? hn.toUpperCase().replace(/[^A-Z]/g, '<').slice(0, 14) : 'CINEPHILE') + '<<<',
      mrz2: 'FILMS<' + String(st.n).padStart(3, '0') + '<<PROGS<' + String(st.progs).padStart(2, '0') + '<<AVG<' + (rated.length ? Math.round(st.avg * 10) : '00') + '<<' + (last ? last.rec.d.replace(/-/g, '') : '00000000') } });
    this.buildSpreads();
    this.buildGrowth(list, idx);
  },
  // ===== 成长：影迷等级 / 全球足迹 / 旅程纪念章（计算在 utils/growth.js，与网站共用） =====
  buildGrowth(list, idx) {
    const en = I.isEn(), nm = x => en ? x.en : x.zh, K = n => n >= 1000 ? (n % 1000 === 0 ? n / 1000 : +(n / 1000).toFixed(1)) + 'k' : String(n);
    const rows = list.map(e => { const p = idx.progOf(e.f), v = e.s ? idx.VN[e.s.v] : null; return { id: e.id, d: e.rec.d, r: e.rec.r || 0, fmt: e.rec.f || '', min: e.f.min || 0, prog: p.id, city: (v && v.city) || p.city || '', venue: e.s ? e.s.v : '' }; });
    const progs = (app.globalData.data.programmes || []).map(p => ({ id: p.id, name: p.name, en: p.en || '', kind: p.kind, city: p.city || '', total: Object.keys(idx.F).filter(k => idx.progOf(idx.F[k]).id === p.id).length }));
    const g = G.compute(rows, { progs }), L = g.level, nb = g.nextBadge, lo = Math.max(0, L.index - 1);
    const nbTxt = !nb ? '' : nb.group === 'collect' ? (en ? nb.left + '% to go' : '还差 ' + nb.left + '% 完成度') : nb.group === 'daily' ? (en ? '+' + nb.left + ' more in one day' : '单日再多看 ' + nb.left + ' 部') : en ? nb.left + nb.unit[1] + ' to go' : '还差 ' + nb.left + nb.unit[0];
    this.setData({ gr: { n: g.n, lvName: L.cur ? nm(L.cur) : t('尚未入场'), lvSub: L.cur && !en ? L.cur.en : '', pct: L.pct,
      lvLeft: !L.next ? t('已抵达最高等级') : !g.n ? t('盖下第一枚印章，就此入场') : en ? L.left + ' more to reach ' + L.next.en : '再看 ' + L.left + ' 部，升为「' + L.next.zh + '」',
      stats: [[g.festivals, en ? 'festivals' : '影展'], [g.cities, en ? 'cities' : '城市'], [g.hours, t('银幕小时')], [g.earned, t('枚纪念章')]],
      next: nb ? { grp: en ? nb.groupEn : nb.groupZh, name: nm(nb), txt: nbTxt, pct: nb.pct } : null,
      ladder: (this.data.lvAll ? g.levels : g.levels.slice(lo, lo + 5)).map(l => ({ name: nm(l), sub: (en ? '' : l.en + ' · ') + l.n + (en ? (l.n === 1 ? ' film' : ' films') : ' 部'), st: l.current ? 'cur' : l.earned ? 'on' : l.next ? 'nx' : '', tag: l.current ? (en ? 'NOW' : '当前') : l.next ? (en ? 'NEXT' : '下一级') : '' })),
      lvMore: this.data.lvAll ? (en ? 'Collapse' : '收起') : (en ? 'All ' + g.levels.length + ' levels · up to 10,000 films' : '查看全部 ' + g.levels.length + ' 个等级 · 最高 10000 部'),
      geo: en ? g.countries + ' countries / regions · ' + g.continents + ' continents' : g.countries + ' 个国家 / 地区 · ' + g.continents + ' 个大洲',
      cities: g.cityCards.map(c => ({ name: en ? c.en : c.name, country: en ? c.countryEn : c.country, n: c.n, bars: c.progs.map(p => ({ name: en && p.en ? p.en : p.name, seen: p.seen, total: p.total, pct: p.pct })) })),
      medalSum: g.earned + ' / ' + g.total,
      groups: g.groups.map(gr => ({ name: nm(gr), val: gr.value + (gr.id === 'collect' ? '' : ' ') + (en ? gr.unit[1] : gr.unit[0]), medals: gr.tiers.map(x => ({ n: K(x.n) + (gr.id === 'collect' ? '%' : ''), name: nm(x), st: x.earned ? 'on' : x.next ? 'next' : 'far', pct: x.pct })) })) } });
  },
  ppTabSw(e) { this.setData({ ppTab: e.currentTarget.dataset.t === 'growth' ? 'growth' : 'stamps' }); },
  lvToggle() { this.setData({ lvAll: !this.data.lvAll }); this.buildPassport(); },
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
  // 折叠屏展开 / 宽窗口（≥840px）：护照像书一样左右两页；rpx 随屏宽放大，所以按 px 计算缩放
  measure() {
    let w = 375, h = 667; try { const wi = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync(); w = wi.windowWidth; h = wi.windowHeight; } catch (e) { }
    const wide = w >= 840, nat = 1.6 * w;
    const B = Math.min(w * 0.92, 940, Math.max(560, (h - 300) * 1.408)), k = B / nat;
    const cw = Math.min(340, w * 0.4), ck = cw / (0.6133 * w);
    const d = { wide, ppK: k, ppH: Math.round(B * 0.71) + 4, ppCK: ck, ppCH: Math.round(cw * 1.422) + 6 };
    if (wide !== this.data.wide) { if (wide) d.ppSp = Math.floor(this.data.ppPage / 2); else d.ppPage = this.data.ppSp * 2; }
    this.setData(d);
  },
  buildSpreads() {
    const n = (this.data.pp && this.data.pp.n) || 1, c = Math.ceil(n / 2), spreads = [];
    for (let j = 0; j < c; j++) spreads.push({ k: j, l: 2 * j, r: 2 * j + 1, rno: String(2 * j + 2).padStart(2, '0') });
    const sp = Math.min(this.data.ppSp, c - 1);
    this.setData({ spreads, ppSp: sp }); this.spLabel();
  },
  spLabel() { const n = this.data.pp.n, l = this.data.ppSp * 2 + 1; this.setData({ ppLabel: l + 1 <= n ? l + '–' + (l + 1) + ' / ' + n : l + ' / ' + n }); },
  ppOpen() { this.setData({ ppOpen: true, ppPage: 0, ppSp: 0 }); this.spLabel(); },
  ppClose() { this.setData({ ppOpen: false, ppVol: 0 }); this.buildPassport(); },
  ppShelfOpen() { this.setData({ ppOpen: false, ppShelf: true }); },
  ppShelfClose() { this.setData({ ppShelf: false, ppVol: 0 }); this.buildPassport(); },
  ppPickVol(e) { this.setData({ ppVol: +e.currentTarget.dataset.v || 0, ppShelf: false, ppOpen: true, ppPage: 0, ppSp: 0 }); this.buildPassport(); this.spLabel(); },
  ppChange(e) { if (this.data.wide) { this.setData({ ppSp: e.detail.current }); this.spLabel(); } else this.setData({ ppPage: e.detail.current }); },
  ppPrev() { if (this.data.wide) { if (this.data.ppSp > 0) { this.setData({ ppSp: this.data.ppSp - 1 }); this.spLabel(); } return; } if (this.data.ppPage > 0) this.setData({ ppPage: this.data.ppPage - 1 }); },
  ppNext() { if (this.data.wide) { if (this.data.ppSp < this.data.spreads.length - 1) { this.setData({ ppSp: this.data.ppSp + 1 }); this.spLabel(); } return; } if (this.data.ppPage < this.data.pp.n - 1) this.setData({ ppPage: this.data.ppPage + 1 }); },
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
