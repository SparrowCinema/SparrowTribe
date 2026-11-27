const Taste=require('../../utils/taste.js'),C=require('../../utils/community.js');
const T = require('../../utils/totop.js');
const U = require('../../utils/util.js');
const MyP = require('../../utils/myposter.js');
const plan = require('../../utils/plan.js');
const PC = require('../../utils/planchange.js');
const poster = require('../../utils/poster.js');
const W = require('../../utils/watched.js');
const Want = require('../../utils/want.js');
const R = require('../../utils/recap.js');
const SV = require('../../utils/svguri.js');
const I = require('../../utils/i18n.js');
const SY = require('../../utils/sync.js');
const Notes = require('../../utils/notes.js');
const Eco = require('../../utils/ecosystem.js');
const Backup=require('../../utils/profile-backup.js');
const G = require('../../utils/growth.js');
const CFG = require('../../utils/cfg.js');
const Stats = require('../../utils/stats.js');
const t = I.tr;
const app = getApp();

Page({
  onPageScroll(e) { T.scroll(this, e); },
  toTop() { T.go(); },
  data: {collectionOpen:true,cuCfg:null,cuCmd:null,friendOpen:false,friends:[{u:'https://sparrowcinema.github.io/michelin-guide/',img:'/images/brand/friend-michelin.png',n:'全球米其林餐厅名录',g:'去全球看电影，别忘了顺路吃点美食。',d:'收录全球米其林餐厅，可标记想去、记录去过，让每座城市的电影与美味同行。'}],collectionOpen:false,todayExpanded:false,careOpen:false,todayRows:[], i: {}, pp: {}, ppOpen: false, ppPage: 0, ppVol: 0, ppShelf: false, ppTab: 'stamps', lvAll: false, gt: 'level', cAll: false, gOpen: null, mcat: '', gr: {}, wide: false, ppSp: 0, ppK: 1, ppH: 0, ppCH: 0, ppCK: 1, spreads: [], ppLabel: '', rc: {}, rcOpen: false, rcY: [], rcM: [], rcP: [], rcSections: R.SECTIONS.map(x=>x[0]), rcIncludeNotes: false, fbOpen: false},
  switchLang() { app.switchLang(); },
  setTheme(e) { CFG.setTheme(e.currentTarget.dataset.p); },
  // 隐藏入口：连续轻点右上角「观影护照」5 次打开主办方现场签到投屏页（生成小程序码）
  tapHostBadge() {
    const now = Date.now();
    if (!this._hostTapT || now - this._hostTapT > 2500) this._hostTapN = 0;
    this._hostTapT = now;
    if (++this._hostTapN >= 5) { this._hostTapN = 0; wx.navigateTo({ url: '/packages/collect/checkin-host/checkin-host' }); }
  },
  onLoad() { try{const v=wx.getStorageSync('sk-recap-sections-v1');if(Array.isArray(v))this.setData({rcSections:R.SECTIONS.map(x=>x[0]).filter(k=>v.includes(k))});}catch(e){} this.setData({ i: I.dict(), en: I.isEn() }); this.measure(); this._rz = () => { this.cuReset(); this.measure(); this.buildSpreads(); }; wx.onWindowResize && wx.onWindowResize(this._rz); this.off1 = plan.onChange(() => this.build()); this.off2 = app.onData(() => { this.build(); this.buildPassport(); }); this.off3 = W.onChange(() => this.buildPassport()); },
  onUnload() { this.offC&&this.offC();this._rz && wx.offWindowResize && wx.offWindowResize(this._rz); this.off1 && this.off1(); this.off2 && this.off2(); this.off3 && this.off3(); },
  // 使用手册有没看过的更新（app.guideLatest 来自 getData 带回的 data/guide.json）时，「使用指南」一行显示「新」
  guideBadge() { let seen = ''; try { seen = wx.getStorageSync('sk-guide-seen') || ''; } catch (e) { } const l = getApp().guideLatest(); this.setData({ guideNew: !!l && l > seen }); },
  onShow() { this.guideBadge(); Stats.stat('pv', 'my'); wx.setNavigationBarTitle({ title: t('我的观影护照') }); this.openPassportFromFilm(); this.build(); this.buildPassport(); this.ppJump(); this.buildSync();C.flush(); if (!this.offS) this.offS = SY.onStatus(() => this.buildSync()); if (SY.stale()) SY.quiet(); },
  onHide() { this.cuReset(); this.offS && this.offS(); this.offS = null; },
  toggleCollection() {
    this.cuReset();
    this.setData({ collectionOpen: !this.data.collectionOpen, cuCfg: this.cuCfg(), cuCmd: null }, () => this.cuMeasure());
    this.ensureSvg();
  },
  openPassportFromFilm(){const o=app.globalData.openPassport;if(o){app.globalData.openPassport=0;this._jump=typeof o==='string'?o:'';this.setData({collectionOpen:true});}},
  // 从影片页「已盖章」进入：翻到这部电影印章所在的册与页，印章轻轻「盖」一下（与网站 ppJump 同规则）
  ppJump(){const id=this._jump;this._jump='';if(!id)return;const ids=this._ppIds||[],k=ids.indexOf(id);if(k<0)return;
    const vol=Math.floor(k/285)+1,page=1+Math.floor((k%285)/15);
    if(vol!==this.data.pp.vol){this.setData({ppVol:vol});this.buildPassport();}
    const sp=Math.floor(page/2);this.cuReset();
    this.setData({ppShelf:false,ppOpen:true,ppTab:'stamps',ppPage:page,ppSp:sp,'pp.hit':id,cuCfg:this.cuCfg(page,sp),cuCmd:null},()=>this.cuMeasure());this.spLabel();this.ensureSvg();
    setTimeout(()=>wx.pageScrollTo({selector:'.fp',offsetTop:-8,duration:300}),120);
    clearTimeout(this._hitT);this._hitT=setTimeout(()=>this.setData({'pp.hit':''}),2400);},
  toggleToday(){this.setData({todayExpanded:!this.data.todayExpanded});},
  toggleCare(){this.setData({careOpen:!this.data.careOpen});},
  backupProfile(){try{const file=wx.env.USER_DATA_PATH+'/sparrow-passport-'+Date.now()+'.json';wx.getFileSystemManager().writeFileSync(file,JSON.stringify(Backup.encode(SY.snapshot(false)),null,2),'utf8');const wn=Object.keys(W.all()).filter(k=>W.all()[k]&&!W.all()[k].del&&W.all()[k].d).length;Notes.markExported(wn);this.buildSync();wx.shareFileMessage({filePath:file,fileName:'sparrow-passport.json',fail:()=>wx.showToast({title:t('请在网页版下载备份'),icon:'none'})});}catch{wx.showToast({title:t('备份失败，请检查存储空间'),icon:'none'});}},
  restoreProfile(){wx.chooseMessageFile({count:1,type:'file',extension:['json'],success:r=>{try{const f=r.tempFiles[0];if(f.size>2600000)throw 0;const value=JSON.parse(wx.getFileSystemManager().readFileSync(f.path,'utf8'));Backup.decode(value);wx.showModal({title:t('导入备份'),content:t('导入后会合并排片，同一影片以备份中的记录为准；已开启同步时也会同步到其他设备。继续？'),success:async r=>{if(!r.confirm)return;try{await SY.restore(value);this.build();this.buildPassport();this.buildSync();wx.showToast({title:t('备份已导入'),icon:'none'});}catch{wx.showToast({title:t('导入失败，请检查文件与存储空间'),icon:'none'});}}});}catch{wx.showToast({title:t('备份格式不正确'),icon:'none'});}}});},
  clearCloudProfile(){wx.showModal({title:t('清空云端内容并断开同步'),content:t('请先保存完整备份，并在其他设备停止同步。请先在影片页撤回不想保留的社区评分。清空云端内容并断开本设备？本机档案仍会保留。'),success:async r=>{if(!r.confirm)return;try{await SY.clearCloud();this.buildSync();wx.showToast({title:t('云端内容已清空，本机档案保留'),icon:'none'});}catch{wx.showToast({title:t('云端清空未完成，请稍后重试'),icon:'none'});}}});},
  // ===== 观影护照：封面 → 资料页 → 印章页（每页 15 枚），印章外观与网站一致 =====
  buildPassport() {
    const data = app.globalData.data, idx = U.index(data), list = W.entries(data, idx);
    const rated = list.filter(e => e.rec.r), mins = list.reduce((n, e) => n + (e.f.min || 0), 0);
    const st = { n: list.length, progs: new Set(list.map(e => idx.progOf(e.f).id)).size, venues: new Set(list.filter(e => e.s).map(e => e.s.v)).size,
      avg: rated.length ? (rated.reduce((n, e) => n + e.rec.r, 0) / rated.length).toFixed(1) : '—', hm: Math.floor(mins / 60) + 'h' + String(mins % 60).padStart(2, '0') };
    this._stSrc = {};
    const stamps = list.map((e, k) => {
      const lk = R.look(e.id), p = idx.progOf(e.f), r = e.rec.r || 0;
      const stt = R.stampTitle(e.f.cn, lk.shape); // 片名排版与网站 / 长图印章同一套（shared/recap.js 的 stampTitle）
      // 印章画面与网站护照同一份 SVG（shared/recap.js 的 stampSVG）。不带 SVG 滤镜，保证文字清晰；油墨纹理由 my.wxss 的 .st 遮罩提供（较网站淡一些）。只在当前页附近按需生成（见 ensureSvg）
      const q = R.stampPose(e.id, k % 15);
      this._stSrc[e.id] = { id: e.id, title: e.f.cn, top: (p && p.en) || '', venue: e.venue || t('影院观影'), date: e.rec.d, r, views: G.views(e.rec).length };
      return { id: e.id, sk: 's' + R.hash(e.id + '|' + JSON.stringify(this._stSrc[e.id])), title: e.f.cn, ink: R.look(e.id).ink, x: G.views(e.rec).length > 1 ? '×' + G.views(e.rec).length : '', tilt: q.tilt, dx: Math.round(q.dx * 60) / 10, dy: Math.round(q.dy * 60) / 10 };
    });
    this._ppIds = stamps.map(x => x.id);
    // 分册：每册 285 枚（1 资料页 + 19 印章页），按观影日期从早到晚，满了换下一册
    const en = I.isEn(), PER = 285, vols = []; for (let k = 0; k < Math.max(1, stamps.length); k += PER) vols.push({ s: stamps.slice(k, k + PER), l: list.slice(k, k + PER) });
    const vi = Math.min(Math.max(this.data.ppVol || vols.length, 1), vols.length), cur = vols[vi - 1], vlist = cur.l, p2 = n => String(n).padStart(2, '0'), ym = d => d ? d.slice(0, 7).replace('-', '.') : '';
    const rng = l => l.length ? (ym(l[0].rec.d) === ym(l[l.length - 1].rec.d) ? ym(l[0].rec.d) : ym(l[0].rec.d) + ' – ' + ym(l[l.length - 1].rec.d)) : '—';
    const pages = []; for (let k = 0; k < Math.max(1, cur.s.length); k += 15) { const items = cur.s.slice(k, k + 15); pages.push({ k: pages.length + 1, no: String(pages.length + 2).padStart(2, '0'), items, slots: Array.from({ length: Math.min(1, 15 - items.length) }, (x, j) => j) }); }
    const hn = W.holder(), first = vlist[0], last = vlist[vlist.length - 1];
    this.setData({ pp: { svg: this._svgKeep(pages), st, pages, n: pages.length + 1, nv: vols.length, vol: vi, volNo: p2(vi), volTxt: p2(vi) + ' / ' + p2(vols.length), vn: vlist.length, cv: (vi - 1) % 5 + 1, capPre: vols.length > 1 ? (en ? 'Vol. ' + vi + ' of ' + vols.length + ' · ' : '第 ' + vi + ' 册 · 共 ' + vols.length + ' 册 · ') : '', shelfTxt: en ? 'Passport shelf · ' + vols.length + ' volumes ↗' : '护照书架 · 共 ' + vols.length + ' 册 ↗', shelfLk: en ? 'Shelf · ' + vols.length + ' vols' : '书架 · ' + vols.length + ' 册',
      vols: vols.map((v, k) => ({ k: k + 1, no: p2(k + 1), cv: k % 5 + 1, range: rng(v.l), nTxt: v.l.length + (en ? ' films' : ' 部') + (k === vols.length - 1 ? (en ? ' · Latest' : ' · 最新') : v.l.length >= PER ? (en ? ' · Full' : ' · 已满') : '') })), empty: !list.length, holder: hn || t('影迷'), photo: W.photo(), holderEn: hn ? '' : 'CINEPHILE',
      first: first ? R.dstamp(first.rec.d) : '—', last: last ? R.dstamp(last.rec.d) : '—',
      mrz1: 'P<SPARROW<FILM<PASSPORT<<' + (hn && !/[^\x00-\x7f]/.test(hn) ? hn.toUpperCase().replace(/[^A-Z]/g, '<').slice(0, 14) : 'CINEPHILE') + '<<<',
      mrz2: 'FILMS<' + String(st.n).padStart(3, '0') + '<<PROGS<' + String(st.progs).padStart(2, '0') + '<<AVG<' + (rated.length ? Math.round(st.avg * 10) : '00') + '<<' + (last ? last.rec.d.replace(/-/g, '') : '00000000') } });
    this.buildSpreads();
    this.buildGrowth(list, idx);
    this.setData({tasteSub:this.tasteSub(list)});
  },
  // ===== 成长：影迷等级 / 全球足迹 / 旅程纪念章（计算在 utils/growth.js，与网站共用） =====
  buildGrowth(list, idx) {
    const en = I.isEn(), nm = x => en ? x.en : x.zh, K = n => n >= 1000 ? (n % 1000 === 0 ? n / 1000 : +(n / 1000).toFixed(1)) + 'k' : String(n);
    const rows = [], sh = app.globalData.data.shows;
    list.forEach(e => { const p = idx.progOf(e.f), v = e.s ? idx.VN[e.s.v] : null, base = { id: e.id, min: e.f.min || 0, prog: p.id, city: (v && v.city) || p.city || '', venue: e.s ? e.s.v : '', f: { y: e.f.y, c: e.f.c, dir: e.f.dir, genre: e.f.genre, language: e.f.language, honors: e.f.honors, r: e.f.r, o: e.f.o, en: e.f.en }, time: e.s ? e.s.t : '' };
      G.views(e.rec).forEach((x, k) => { const s2 = x.k && sh.find(y => U.keyOf(y) === x.k), v2 = s2 ? idx.VN[s2.v] : null;
        rows.push(Object.assign({}, base, { time: k === 0 ? base.time : (s2 ? s2.t : ''), d: x.d, r: x.r || 0, fmt: x.f || '', re: k > 0, city: k === 0 ? base.city : ((v2 && v2.city) || base.city), venue: k === 0 ? base.venue : (s2 ? s2.v : base.venue) })); }); });
    const progs = (app.globalData.data.programmes || []).map(p => ({ id: p.id, name: p.name, en: p.en || '', kind: p.kind, city: p.city || '', total: Object.keys(idx.F).filter(k => idx.progOf(idx.F[k]).id === p.id).length }));
    const g = G.compute(rows, { progs }), L = g.level, nb = g.nextBadge, lo = Math.max(0, L.index - 1);
    const catOf = id => (g.groups.find(x => x.id === id) || {}).cat, cs = G.CATS.filter(c => g.groups.some(x => x.cat === c.id)), ce = c => g.groups.filter(x => x.cat === c.id).reduce((s, x) => s + x.earned, 0);
    const mcat = cs.some(c => c.id === this.data.mcat) ? this.data.mcat : (nb && nb.kind === 'badge' && catOf(nb.group)) || cs.slice().sort((a, b) => ce(b) - ce(a))[0].id;
    const op = this.data.gOpen || [nb && nb.group !== 'level' ? nb.group : g.groups[0].id];
    const nbTxt = !nb ? '' : nb.group === 'collect' ? (en ? nb.left + '% to go' : '还差 ' + nb.left + '% 完成度') : nb.group === 'daily' ? (en ? '+' + nb.left + ' more in one day' : '单日再多看 ' + nb.left + ' 部') : en ? nb.left + nb.unit[1] + ' to go' : '还差 ' + nb.left + nb.unit[0];
    this.setData({ gr: { n: g.n, lvName: L.cur ? nm(L.cur) : t('尚未入场'), lvSub: L.cur && !en ? L.cur.en : '', pct: L.pct,
      lvLeft: !L.next ? t('已抵达最高等级') : !g.n ? t('盖下第一枚印章，就此入场') : en ? L.left + ' more to reach ' + L.next.en : '再看 ' + L.left + ' 部，升为「' + L.next.zh + '」',
      stats: [[g.festivals, en ? 'festivals' : '影展'], [g.cities, en ? 'cities' : '城市'], [g.hours, t('银幕小时')], [g.earned, t('枚纪念章')]],
      next: nb ? { grp: en ? nb.groupEn : nb.groupZh, name: nm(nb), txt: nbTxt, pct: nb.pct } : null,
      ladder: (this.data.lvAll ? g.levels : g.levels.slice(lo, lo + 5)).map(l => ({ name: nm(l), sub: (en ? '' : l.en + ' · ') + l.n + (en ? (l.n === 1 ? ' film' : ' films') : ' 部'), st: l.current ? 'cur' : l.earned ? 'on' : l.next ? 'nx' : '', tag: l.current ? (en ? 'NOW' : '当前') : l.next ? (en ? 'NEXT' : '下一级') : '' })),
      lvMore: this.data.lvAll ? (en ? 'Collapse' : '收起') : (en ? 'All ' + g.levels.length + ' levels · up to 10,000 films' : '查看全部 ' + g.levels.length + ' 个等级 · 最高 10000 部'),
      geo: en ? g.countries + ' countries / regions · ' + g.continents + ' continents' : g.countries + ' 个国家 / 地区 · ' + g.continents + ' 个大洲',
      cMore: g.cityCards.length > 4 ? (this.data.cAll ? (en ? 'Collapse' : '收起') : (en ? 'All ' + g.cityCards.length + ' cities' : '查看全部 ' + g.cityCards.length + ' 座城市')) : '',
      subs: [['level', en ? 'Levels' : '等级', (L.cur ? L.index + 1 : 0) + '/' + g.levels.length], ['trail', en ? 'Footprints' : '足迹', g.cities], ['medals', en ? 'Medals' : '纪念章', g.earned + '/' + g.total]].map(x => ({ k: x[0], n: x[1], c: x[2] })),
      cities: (this.data.cAll ? g.cityCards : g.cityCards.slice(0, 4)).map(c => ({ name: en ? c.en : c.name, country: en ? c.countryEn : c.country, n: c.n, bars: c.progs.map(p => ({ name: en && p.en ? p.en : p.name, seen: p.seen, total: p.total, pct: p.pct })) })),
      medalSum: g.earned + ' / ' + g.total,
      mcat: mcat, cats: G.CATS.map(c => { const gs = g.groups.filter(x => x.cat === c.id); return { id: c.id, name: nm(c), n: gs.reduce((s, x) => s + x.earned, 0), t: gs.reduce((s, x) => s + x.total, 0), groups: gs.map(gr => gr.kind === 'set'
        ? { id: gr.id, set: true, open: op.includes(gr.id), earned: gr.earned + '/' + gr.total, dots: gr.items.filter(x => x.earned).slice(0, 8).map(() => 'on').concat(gr.items.some(x => !x.earned) ? [''] : []), name: nm(gr), rule: en ? gr.rule[1] : gr.rule[0], medals: gr.items.map(x => ({ n: x.ic, name: nm(x), st: x.earned ? 'on' : 'far' })) }
        : { id: gr.id, open: op.includes(gr.id), earned: gr.earned + '/' + gr.total, dots: gr.tiers.map(x => x.earned ? 'on' : x.next ? 'nx' : ''), name: nm(gr), rule: en ? gr.rule[1] : gr.rule[0], val: gr.value + (gr.id === 'collect' ? '' : ' ') + (en ? gr.unit[1] : gr.unit[0]), medals: gr.tiers.map(x => ({ n: K(x.n) + (gr.id === 'collect' ? '%' : ''), name: nm(x), st: x.earned ? 'on' : x.next ? 'next' : 'far', pct: x.pct })) }) }; }).filter(c => c.groups.length) } });
  },
  ppTabSw(e) {
    const tab = e.currentTarget.dataset.t === 'growth' ? 'growth' : 'stamps';
    if (tab === this.data.ppTab) return;
    this.cuReset();
    this.setData({ ppTab: tab, cuCfg: this.cuCfg(), cuCmd: null }, () => this.cuMeasure());
    this.ensureSvg();
  },
  grSub(e) { this.setData({ gt: e.currentTarget.dataset.t }); },
  cToggle() { this.setData({ cAll: !this.data.cAll }); this.buildPassport(); },
  mcSw(e) { this.setData({ mcat: e.currentTarget.dataset.c }); this.buildPassport(); },
  gTog(e) { const id = e.currentTarget.dataset.g, cur = [].concat(...this.data.gr.cats.map(c => c.groups)).filter(x => x.open).map(x => x.id), nx = cur.includes(id) ? cur.filter(x => x !== id) : cur.concat(id); this.setData({ gOpen: nx }); this.buildPassport(); },
  lvToggle() { this.setData({ lvAll: !this.data.lvAll }); this.buildPassport(); },
  // ===== 个人档案云端同步（同步码，与网站共用） =====
  buildSync() {
    const st = SY.state(), s = SY.status, rev = this._syShow;
    let line = '';
    if (st && st.code) {
      const ago = st.at ? ((Date.now() - st.at) / 1000 < 60 ? t('刚刚') : Math.round((Date.now() - st.at) / 60000) < 60 ? Math.round((Date.now() - st.at) / 60000) + ' ' + t('分钟前') : new Date(st.at).toLocaleDateString()) : '';
      line = s.state === 'busy' ? t('同步中…') : s.state === 'error' ? t('同步失败：') + s.msg : t('已同步') + (ago ? ' · ' + ago : '');
    }
    const wn = Object.keys(W.all()).filter(k => W.all()[k] && !W.all()[k].del && W.all()[k].d).length;
    const health = Notes.health(st && st.code, wn);
    const sub = health.codeWarning ? t('同步码尚未确认保存 · 建议复制保管') : health.backupWarning ? (line ? line + ' · ' + t('建议本地备份') : t('建议导出一次本地备份')) : '';
    this.setData({ sy: { wx: !!(st && st.wx), on: !!(st && st.code), state: s.state, line, sub, health, hasPass: !!Notes.pass(), notesCount: Notes.activeCount(), lockedCount: Notes.lockedCount(), code: st ? st.code : '', shown: st && st.code ? (rev ? st.code : st.code.slice(0, 7) + '-••••-••••-••••-••••-' + st.code.slice(-4)) : '', rev: !!rev } });
  },
  syStart() { wx.showLoading({ title: t('同步中…'), mask: true }); SY.start().then(() => { wx.hideLoading(); this._syShow = true; this.buildSync(); wx.showToast({ title: t('已开启同步，请保存好同步码'), icon: 'none', duration: 2500 }); }).catch(e => { wx.hideLoading(); this.buildSync(); wx.showToast({ title: t('同步失败：') + ((e && e.message) || ''), icon: 'none' }); }); },
  syJoin() {
    wx.showModal({ title: t('输入同步码'), editable: true, placeholderText: 'SP-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX', confirmText: t('连接'), success: r => {
      if (!r.confirm) return;
      const norm = SY.normalize(r.content);
      if (!norm) return wx.showToast({ title: t('同步码格式不对，请检查'), icon: 'none' });
      wx.showLoading({ title: t('同步中…'), mask: true });
      SY.join(norm).then(() => { Notes.markCodeSaved(norm); wx.hideLoading(); this.build(); this.buildPassport(); this.buildSync(); wx.showToast({ title: t('已连接，记录已合并'), icon: 'none' }); }).catch(e => { wx.hideLoading(); this.buildSync(); wx.showToast({ title: t('同步失败：') + ((e && e.message) || ''), icon: 'none' }); });
    } });
  },
  // 扫码连接网站：扫网站「个人档案云端同步」里的二维码，改用网站的同步码并合并两边记录（本微信同时绑定到这串码）
  syScan() {
    wx.scanCode({ onlyFromCamera: false, scanType: ['qrCode'], success: r => {
      const code = SY.fromScan(r.result), st = SY.state();
      if (!code) return wx.showToast({ title: t('这不是麻雀观影护照的同步二维码'), icon: 'none' });
      if (st && st.code === code) return wx.showToast({ title: t('已经连接到这份档案'), icon: 'none' });
      wx.showModal({ title: t('连接网站档案'), content: t('小程序和网站的看过记录、评分、照片和个人排片会合并成一份，之后两边自动同步。'), confirmText: t('连接'), success: m => {
        if (!m.confirm) return;
        wx.showLoading({ title: t('同步中…'), mask: true });
        SY.join(code).then(() => { Notes.markCodeSaved(code); Stats.stat('sync_link', 'scan'); wx.hideLoading(); this.build(); this.buildPassport(); this.buildSync(); wx.showToast({ title: t('已连接，记录已合并'), icon: 'none' }); }).catch(e => { wx.hideLoading(); this.buildSync(); wx.showToast({ title: t('同步失败：') + ((e && e.message) || ''), icon: 'none' }); });
      } });
    } });
  },
  syNow() { SY.sync().then(r => { this.build(); this.buildPassport(); this.buildSync(); wx.showToast({ title: r && r.changed ? t('已同步，并合并了其他设备的更改') : t('已同步'), icon: 'none' }); }).catch(e => { this.buildSync(); wx.showToast({ title: t('同步失败：') + ((e && e.message) || ''), icon: 'none' }); }); },
  syReveal() { this._syShow = !this._syShow; this.buildSync(); },
  syCopy() { const st = SY.state(); if (st && st.code) wx.setClipboardData({ data: st.code, success: () => { Notes.markCodeSaved(st.code); this.buildSync(); wx.showToast({ title: t('同步码已复制并标记为已保存'), icon: 'none' }); } }); },
  syMarkSaved() { const st = SY.state(); if (st && st.code) { Notes.markCodeSaved(st.code); this.buildSync(); wx.showToast({ title: t('已标记为妥善保存'), icon: 'none' }); } },
  syStop() { wx.showModal({ title: t('停止同步'), content: t('在这台设备停止同步？本机记录会保留，云端的记录也不会删除；已公开的社区评分仍保留，可在影片页撤回。以后输入同步码可以重新连接。'), success: r => { if (r.confirm) { SY.stop(); this._syShow = false; this.buildSync(); } } }); },
  noteVaultSet() {
    wx.showModal({ title: t(Notes.pass() ? '修改笔记加密口令' : '设置笔记加密口令'), editable: true, placeholderText: t('至少 4 位口令（仅留本机，请牢记）'), confirmText: t('确认'), success: r => {
      if (!r.confirm) return;
      const res = Notes.setPass(r.content || '');
      if (!res.ok) { wx.showToast({ title: t(res.msg), icon: 'none' }); return; }
      this.buildSync();
      wx.showToast({ title: res.unlocked ? t('已解锁 ' + res.unlocked + ' 条云端笔记') : t('已开启笔记端到端加密同步'), icon: 'none' });
      const st = SY.state(); if (st && st.code) SY.quiet();
    } });
  },
  noteVaultClear() {
    wx.showModal({ title: t('清除本机加密口令？'), content: t('本机明文笔记不受影响，但之后修改的笔记将不再同步到云端，直到重新设置口令。'), success: r => {
      if (!r.confirm) return;
      Notes.setPass(''); this.buildSync(); wx.showToast({ title: t('已清除本机加密口令'), icon: 'none' });
    } });
  },
  exportLetterboxd() {
    const data = app.globalData.data, idx = U.index(data), entries = W.entries(data, idx);
    if (!entries.length) { wx.showToast({ title: t('还没有已看影片可供导出'), icon: 'none' }); return; }
    const csv = Eco.exportLetterboxdCSV(entries, { includeNotes: false, progNameOf: f => (idx.progOf(f) || {}).name || '' });
    try {
      const file = wx.env.USER_DATA_PATH + '/sparrow-letterboxd-' + Date.now() + '.csv';
      wx.getFileSystemManager().writeFileSync(file, csv, 'utf8');
      Notes.markExported(entries.length); this.buildSync();
      wx.shareFileMessage({ filePath: file, fileName: 'sparrow-letterboxd.csv', fail: () => wx.setClipboardData({ data: csv, success: () => wx.showToast({ title: t('已复制 Letterboxd CSV 内容'), icon: 'none' }) }) });
    } catch (e) {
      wx.setClipboardData({ data: csv, success: () => wx.showToast({ title: t('已复制 Letterboxd CSV 内容'), icon: 'none' }) });
    }
  },
  // 「我的」菜单里个人排片行的副标题；完整排片在 pages/plan/plan
  build() {
    const data = app.globalData.data, idx = U.index(data), picked = plan.get();
    const list = data.shows.filter(s => idx.F[s.id] && picked.has(U.keyOf(s))).sort((a, b) => U.showDate(a) - U.showDate(b));
    const now = Date.now(), next = list.find(s => U.showDate(s) >= now);
    const en = I.isEn(), md = next ? next.d.slice(5).replace('-', '/') + ' ' + U.wk(next.d) + ' ' + next.t : '';
    { const d = app.globalData.data, ix = U.index(d), ids = d.films.filter(f => !f.ev && Want.isOn(f.id)).map(f => f.id), up = id => d.shows.filter(s => s.id === id && !U.ended(s, ix)).map(U.keyOf);
      const live = ids.filter(id => up(id).length).length, fresh = ids.filter(id => Want.newCount(id, up(id))).length;
      this.setData({ wantSub: ids.length ? (en ? ids.length + (ids.length === 1 ? ' film' : ' films') + (fresh ? ' · ' + fresh + ' with new screenings' : live ? ' · ' + live + ' now screening' : '') : ids.length + ' 部' + (fresh ? ' · ' + fresh + ' 部有新场次' : live ? ' · ' + live + ' 部有场次' : '')) : t('在影片页点「想看」，有新场次时会标出') }); }
    const goneN = (() => { try { const d = app.globalData.data; PC.track(d); return PC.list(d).length; } catch (e) { return 0; } })(), goneTxt = goneN ? (en ? goneN + (goneN === 1 ? ' screening changed · ' : ' screenings changed · ') : goneN + ' 场排片有变动 · ') : '';
    this.setData({ planSub: goneTxt + (list.length ? (en ? list.length + (list.length === 1 ? ' show' : ' shows') + ' · ' + (next ? 'next ' + md : 'all screened') : list.length + ' 场 · ' + (next ? '下一场 ' + md : '已全部放映')) : t('按天查看日程 · 导出长图 · 导入日历 · 分享')) });
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
    const rp = w > 600 ? 0.552 : w / 750, wide = w >= 840, nat = 1200 * rp;
    const B = Math.min(w * 0.92, 940, Math.max(560, (h - 300) * 1.408)), k = B / nat;
    const cw = Math.min(340, w * 0.4), ck = cw / (460 * rp);
    const d = { wide, ppK: k, ppH: Math.round(B * 0.71) + 4, ppCK: ck, ppCH: Math.round(cw * 1.422) + 6 };
    if (wide !== this.data.wide) { if (wide) d.ppSp = Math.floor(this.data.ppPage / 2); else d.ppPage = this.data.ppSp * 2; }
    this.setData(d);
  },
  buildSpreads() {
    const n = (this.data.pp && this.data.pp.n) || 1, c = Math.ceil(n / 2), spreads = [];
    for (let j = 0; j < c; j++) spreads.push({ k: j, l: 2 * j, r: 2 * j + 1, rno: String(2 * j + 2).padStart(2, '0') });
    const sp = Math.min(this.data.ppSp, c - 1);
    const pg = Math.min(this.data.ppPage, n - 1);
    this.setData({ spreads, ppSp: sp, ppPage: pg, cuCfg: this.cuCfg(pg, sp) }, () => this.cuMeasure());
    this.spLabel(); this.ensureSvg();
  },
  spLabel() { const n = this.data.pp.n, l = this.data.ppSp * 2 + 1; this.setData({ ppLabel: l + 1 <= n ? l + '–' + (l + 1) + ' / ' + n : l + ' / ' + n }); },
  ppOpen() {
    this.cuReset();
    this.setData({ ppOpen: true, ppPage: 0, ppSp: 0, cuCfg: this.cuCfg(0, 0), cuCmd: null }, () => this.cuMeasure());
    this.spLabel(); this.ensureSvg();
  },
  ppClose() { this.cuReset(); this.setData({ ppOpen: false, ppVol: 0, cuCmd: null }); this.buildPassport(); },
  ppShelfOpen() { this.cuReset(); this.setData({ ppOpen: false, ppShelf: true, cuCmd: null }); },
  ppShelfClose() { this.setData({ ppShelf: false, ppVol: 0 }); this.buildPassport(); },
  ppPickVol(e) { this.cuReset(); this.setData({ ppVol: +e.currentTarget.dataset.v || 0, ppShelf: false, ppOpen: true, ppPage: 0, ppSp: 0, cuCmd: null }); this.buildPassport(); },
  // 印章图片：只生成当前页与前后几页（单页 ±1，双页前后两跨页），翻页后补上新露出的页；已生成的按内容键沿用
  _svgKeep(pages) { const old = (this.data.pp && this.data.pp.svg) || {}, keep = {}; (pages || []).forEach(pg => (pg.items || []).forEach(s => { if (old[s.sk]) keep[s.sk] = old[s.sk]; })); return keep; },
  // 每枚章独立处理 SVG 加载，图片完成前、或单张加载失败时保留文字印章。
  stLoad(e) {
    const key = e.currentTarget.dataset.key, s = this.data.pp.svg?.[key];
    if (s && s.src && !s.ready) this.setData({ ['pp.svg.' + key + '.ready']: true });
  },
  stErr(e) {
    const key = e.currentTarget.dataset.key, s = this.data.pp.svg?.[key];
    if (s && s.src) this.setData({ ['pp.svg.' + key]: { src: '', ready: false } });
  },
  ensureSvg(page, sp) {
    const pp = this.data.pp; if (!this.cuVisible() || !pp.pages || !this._stSrc) return;
    const wide = this.data.wide, c = wide ? (sp === undefined ? this.data.ppSp : sp) * 2 : (page === undefined ? this.data.ppPage : page), lo = wide ? c - 2 : c - 1, hi = wide ? c + 3 : c + 1, have = pp.svg || {}, d = {};
    for (let k = Math.max(1, lo); k <= hi && k < pp.n; k++) {
      const pg = pp.pages[k - 1]; if (!pg) continue;
      pg.items.forEach(s => {
        const key = 'pp.svg.' + s.sk;
        if (!have[s.sk] && !d[key] && this._stSrc[s.id]) d[key] = { src: SV.svgUri(R.stampSVG(this._stSrc[s.id], { inline: true, ink: false, badge: false })), ready: false };
      });
    }
    const ks = Object.keys(d); for (let i = 0; i < ks.length; i += 15) { const part = {}; ks.slice(i, i + 15).forEach(k => { part[k] = d[k]; }); this.setData(part); } // 分批，避免单次 setData 过大
  },
  // 按钮翻页：交给 curl-ctl.wxs 做卷曲动画，翻完回调 cuDone 换页
  ppPrev() { this.cuTurn(-1); },
  ppNext() { this.cuTurn(1); },
  cuTurn(dir) {
    const cfg = this.data.cuCfg;
    if (!this.cuVisible() || !cfg || !(dir > 0 ? cfg.cf : cfg.cb)) return;
    this._cuCmd = (this._cuCmd || 0) + 1;
    this.setData({ cuCmd: { ...cfg, dir, serial: this._cuCmd } });
  },
  cuVisible() { const d = this.data; return d.collectionOpen && d.ppOpen && !d.ppShelf && d.ppTab === 'stamps'; },
  cuReset() { this._cuEpoch = (this._cuEpoch || 0) + 1; this._cuG = null; },
  // 翻页卷曲的参数：书页尺寸（未缩放的 px）、在页面里的位置、当前页、能否前后翻
  cuCfg(page = this.data.ppPage, sp = this.data.ppSp) {
    const g = this._cuG || {}, wide = this.data.wide, n = (this.data.pp && this.data.pp.n) || 1, cur = wide ? sp : page, last = wide ? Math.ceil(n / 2) - 1 : n - 1;
    return { W: g.W || 0, H: g.H || 0, k: g.k || 1, left: g.left || 0, top: g.top || 0, sp: wide, page: cur, cf: cur < last, cb: cur > 0, n, vol: this.data.pp.vol || 0, epoch: this._cuEpoch || 0 };
  },
  cuMeasure() {
    if (!this.cuVisible()) return;
    const epoch = this._cuEpoch;
    wx.createSelectorQuery().in(this).select('.cu-book').boundingClientRect().selectViewport().scrollOffset().exec(r => {
      const b = r && r[0], v = r && r[1]; if (!b || !b.width || epoch !== this._cuEpoch || !this.cuVisible()) return;
      const wide = this.data.wide, k = wide ? this.data.ppK : 1, o = this._cuG || {};
      const g = { W: Math.round(b.width / k / (wide ? 2 : 1) * 10) / 10, H: Math.round(b.height / k * 10) / 10, k, left: b.left + (v ? v.scrollLeft : 0), top: b.top + (v ? v.scrollTop : 0) };
      if (o.W === g.W && o.H === g.H && o.k === g.k && Math.abs(o.left - g.left) < 1 && Math.abs(o.top - g.top) < 1) return;
      this._cuG = g; this.setData({ cuCfg: this.cuCfg(this.data.ppPage, this.data.ppSp) });
    });
  },
  // 卷曲翻完：页码和卷曲参数同一次 setData，渲染层在新页码到达时复位各层，避免闪一下
  cuDone(o) {
    const c = this.data.cuCfg, d = o && o.dir;
    if (!this.cuVisible() || !c || (d !== -1 && d !== 1) || o.epoch !== (this._cuEpoch || 0) || o.vol !== c.vol || o.n !== c.n || o.sp !== c.sp || o.page !== c.page) return;
    if (this.data.wide) { const sp = this.data.ppSp + d; if (sp < 0 || sp >= this.data.spreads.length) return; this.setData({ ppSp: sp, cuCfg: this.cuCfg(this.data.ppPage, sp), cuCmd: null }); this.spLabel(); this.ensureSvg(); }
    else { const p = this.data.ppPage + d; if (p < 0 || p >= this.data.pp.n) return; this.setData({ ppPage: p, cuCfg: this.cuCfg(p, this.data.ppSp), cuCmd: null }); this.ensureSvg(); }
  },
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
  tasteSub(list){const n=list.filter(e=>!e.rec.del&&!e.f.ev&&Taste.valid(e.rec.fun)&&Taste.valid(e.rec.bore)).length;return (n?I.tr(n+' 部影片')+' · ':'')+I.tr('有趣与无聊四象限');},
  toTasteMap(){wx.navigateTo({url:'/packages/collect/taste-map/taste-map'});},
  toTicketAlbum(){wx.navigateTo({url:'/packages/collect/tickets/tickets'});},
  toPosterWall(){wx.navigateTo({url:'/packages/collect/poster-wall/poster-wall'});},
  setRcSections(e){const values=e.detail.value||[],sections=R.SECTIONS.map(x=>x[0]).filter(k=>values.includes(k));this.setData({rcSections:sections});try{wx.setStorageSync('sk-recap-sections-v1',sections);}catch(err){}this.buildRecap();},
  setRcIncludeNotes(e){const on=(e.detail.value||[]).includes('1');this.setData({rcIncludeNotes:on});},
  // ===== 影院观影结算：按年份 / 专题 =====
  recapScope() {
    const data = app.globalData.data, idx = U.index(data), Y = this.data.rcY || [], M = this.data.rcM || [], P = this.data.rcP || [];
    const E = Y.length ? Y : M.length ? [...new Set(M.map(k => k.slice(0, 4)))] : null;
    return W.entries(data, idx).filter(e => { const y = e.rec.d.slice(0, 4), m = e.rec.d.slice(0, 7); if (E && !E.includes(y)) return false; if (M.some(k => k.startsWith(y)) && !M.includes(m)) return false; return !P.length || P.includes(idx.progOf(e.f).id); });
  },
  // 年份单选；月份 / 专题多选，空 = 全部
  buildRecap() {
    const data = app.globalData.data, idx = U.index(data), all = W.entries(data, idx);
    const years = [...new Set(all.map(e => e.rec.d.slice(0, 4)))].sort().reverse(), pids = data.programmes.map(p => p.id).filter(id => all.some(e => idx.progOf(e.f).id === id));
    if(!this._recapYearReady){this.setData({rcY:years.slice(0,1)});this._recapYearReady=true;}
    const y = (this.data.rcY || []).filter(v => years.includes(v)).slice(0,1), p = (this.data.rcP || []).filter(v => pids.includes(v));
    const m = (this.data.rcM || []).filter(k => all.some(e => e.rec.d.slice(0, 7) === k) && y.includes(k.slice(0, 4)));
    this.setData({ rcY: y, rcP: p, rcM: m });
    const list = this.recapScope(), rated = list.filter(e => e.rec.r), mins = list.reduce((n, e) => n + (e.f.min || 0), 0);
    const notesInScope = typeof Notes.get === 'function' ? list.filter(e => { const n = Notes.get(e.id); return n && n.rc && n.text; }).length : 0;
    const ys = y;
    const nb = n => n + (I.isEn() ? (n === 1 ? ' film' : ' films') : ' 部');
    // 仅显示所选年份的 6×2 日历；全部年份不展开月份。
    const grids = ys.map(Y => { const cnt = {}; all.filter(e => e.rec.d.slice(0, 4) === Y).forEach(e => { const k = e.rec.d.slice(0, 7); cnt[k] = (cnt[k] || 0) + 1; });
      const max = Math.max(1, ...Object.values(cnt));
      return { y: Y, cells: Array.from({ length: 12 }, (_, i) => { const k = Y + '-' + String(i + 1).padStart(2, '0'), c = cnt[k] || 0, on = m.includes(k);
        return { v: k, n: String(i + 1), c, cs: c ? nb(c) : '—', on, bg: c && !on ? 'background:rgba(142,42,34,' + (0.14 + 0.46 * c / max).toFixed(2) + ');border-color:rgba(142,42,34,' + (0.22 + 0.46 * c / max).toFixed(2) + ')' : '' }; }) }; });
    const ycnt = {}; all.forEach(e => { const k = e.rec.d.slice(0, 4); ycnt[k] = (ycnt[k] || 0) + 1; });
    this.setData({ rc: { sections:R.SECTIONS.map(([id,label])=>({id,label:t(label),on:this.data.rcSections.includes(id)})), sectionCount:this.data.rcSections.length, notesInScope, grids, years: [{ v: 'all', n: t('全部年份'), c: nb(all.length), on: !y.length }].concat(years.map(v => ({ v, n: v, c: nb(ycnt[v]), on: y.includes(v) }))), mSel: m.length ? (I.isEn() ? m.length + ' selected' : '已选 ' + m.length + ' 个月') : '', progSearch:pids.length>4,progLabel:p.length?p.map(v=>idx.PG[v].name).join('、'):t('全部专题'), progs: [{ v: 'all', n: t('全部专题'), on: !p.length }].concat(pids.filter(v=>!this.data.rcProgQuery||idx.PG[v].name.toLocaleLowerCase().includes(this.data.rcProgQuery.toLocaleLowerCase())).map(v => ({ v, n: idx.PG[v].name, on: p.includes(v) }))),
      n: list.length, hm: Math.floor(mins / 60) + 'h' + String(mins % 60).padStart(2, '0'), avg: rated.length ? (rated.reduce((n, e) => n + e.rec.r, 0) / rated.length).toFixed(1) : '—' } });
  },
  recapSub(list, idx) {
    const M = this.data.rcM || [], P = this.data.rcP || [], en = I.isEn();
    const ys = [...new Set(list.map(e => e.rec.d.slice(0, 4)))].sort(), pm = [...M].sort();
    const when = pm.length ? (pm.length <= 3 ? pm.map(k => k.replace('-', '.')).join('、') : pm.length + (en ? ' months' : ' 个月')) : (ys.length > 1 ? ys[0] + '–' + ys[ys.length - 1] : ys[0] || '');
    const pn = P.length ? (P.length <= 2 ? P.map(id => idx.PG[id].name).join('、') : P.length + (en ? ' programmes' : ' 个专题')) : t('全部专题');
    return when + ' · ' + pn;
  },
  openRecap() {
    const data = app.globalData.data; if (!W.entries(data, U.index(data)).length) { wx.showToast({ title: t('先在影片页点「看过」，盖下第一枚印章'), icon: 'none' }); return; }
    this.buildRecap(); this.setData({ rcOpen: true });
  },
  closeRecap() { this.setData({ rcOpen: false }); },
  setRcM(e) { const d = e.currentTarget.dataset; if (d.v === 'all') this.setData({ rcM: [] }); else if (d.c === 0) return; else { const c = this.data.rcM || []; this.setData({ rcM: c.includes(d.v) ? c.filter(x => x !== d.v) : c.concat(d.v) }); } this.buildRecap(); },
  copyContact(e) { const v = e.currentTarget.dataset.v; wx.setClipboardData({ data: v, success: () => wx.showToast({ title: /^https?:/.test(v) ? t('链接已复制') : t('已复制') + ' ' + v, icon: 'none' }) }); },
  toggleFriend() { this.setData({ friendOpen: !this.data.friendOpen }); },
  toggleFb() { this.setData({ fbOpen: !this.data.fbOpen }); },
  openGuide() { wx.navigateTo({ url: '/packages/collect/guide/guide' }); },
  setRcY(e) { const v=e.currentTarget.dataset.v,y=v==='all'?[]:[v],same=(this.data.rcY||[])[0]===y[0];this.setData({rcY:y,rcM:same?this.data.rcM:[],rcYearAnchor:'rc-year-'+v});this.buildRecap(); },
  toggleAppearance(){this.setData({appearanceOpen:!this.data.appearanceOpen});},
  toggleRcProgrammes(){this.setData({rcProgOpen:!this.data.rcProgOpen});},
  searchRcProgrammes(e){this.setData({rcProgQuery:e.detail.value});this.buildRecap();},
  setRcP(e) { const v = e.currentTarget.dataset.v, c = this.data.rcP || []; this.setData({ rcP: v === 'all' ? [] : c.includes(v) ? c.filter(x => x !== v) : c.concat(v) }); this.buildRecap(); },
  noop() { },
  makeRecap() {
    const list = this.recapScope(); if (!list.length || !this.data.rcSections.length || this.busy) return;
    const sections=[...this.data.rcSections], includeNotes=!!this.data.rcIncludeNotes;this.busy = true; wx.showLoading({ title: t('正在生成观影结算…'), mask: true });
    const fail = () => { this.busy = false; wx.hideLoading(); wx.showToast({ title: t('图片生成失败，请稍后再试'), icon: 'none' }); };
    const data = app.globalData.data, idx = U.index(data);
    wx.createSelectorQuery().select('#recap').fields({ node: true, size: true }).exec(async res => {
      try {
        const canvas = res && res[0] && res[0].node; if (!canvas) return fail();
        const load = src => new Promise(r => { if (!src) return r(null); const im = canvas.createImage(); im.onload = () => r(im); im.onerror = () => r(null); im.src = src; });
        const imgs = {}; await Promise.all((sections.includes('favorite')||sections.includes('list')?list:[]).map(async e => { imgs[e.id] = await load(MyP.pick(e.f) || U.poster(e.f)); }));
        const marks = await Promise.all(['/images/brand/sparrow-movies-sq.png', '/images/brand/sparrow-tribe-sq.png'].map(load));
        const qrImg = await load('/images/brand/miniprogram-code.jpg');
        const items = list.map(e => { const lk = R.look(e.id), p = idx.progOf(e.f), n = includeNotes && typeof Notes.get === 'function' ? Notes.get(e.id) : null; return { id: e.id, title: e.f.cn, en: e.f.en || e.f.o || '', date: e.rec.d, dstamp: R.dstamp(e.rec.d), venue: I.isEn() ? e.venue : e.venueFull, vs: e.venue, score: e.rec.r || 0, color: lk.ink, shape: lk.shape, tilt: lk.tilt, top: (p && p.en) || 'SPARROW FILM PASSPORT', prog: p ? p.name : '', img: imgs[e.id], note: n && n.rc && n.text ? n.text : '' }; });
        const rated = list.filter(e => e.rec.r), mins = list.reduce((n, e) => n + (e.f.min || 0), 0), months = {};
        list.forEach(e => { const m = +e.rec.d.slice(5, 7); months[m] = (months[m] || 0) + 1; });
        const topM = Object.keys(months).sort((a, b) => months[b] - months[a] || a - b)[0];
        const byP = {}; list.forEach(e => { const p = idx.progOf(e.f); const g = byP[p.id] = byP[p.id] || { name: p.name, n: 0, sum: 0, k: 0 }; g.n++; if (e.rec.r) { g.sum += e.rec.r; g.k++; } });
        const years = [...new Set(list.map(e => e.rec.d.slice(0, 4)))].sort();
        const o = { title: t('我的影院观影结算'), sub: this.recapSub(list, idx),
          kicker: 'SPARROW FILM PASSPORT · MY CINEMA RECAP', yearTag: years[years.length - 1],
          stats: [[list.length, t('部影片')], [Math.floor(mins / 60) + 'h' + String(mins % 60).padStart(2, '0'), t('银幕时长')], [rated.length ? (rated.reduce((n, e) => n + e.rec.r, 0) / rated.length).toFixed(1) : '—', t('平均评分')],
            [new Set(list.filter(e => e.s).map(e => e.s.v)).size, t('家影院')], [Object.keys(byP).length, t('个专题')], [topM ? t(topM + '月') : '—', t('看得最多的月份')]],
          fav: items.filter(x => x.score).sort((a, b) => b.score - a.score || b.date.localeCompare(a.date))[0] || null,
          progs: Object.keys(byP).map(k => ({ name: byP[k].name, n: byP[k].n, avg: byP[k].k ? byP[k].sum / byP[k].k : 0 })).sort((a, b) => b.n - a.n),
          sections, includeNotes, items, qr: null, qrImg, marks, T: t, en: I.isEn() };
        if(!R.heightOf(o)){this.busy=false;wx.hideLoading();wx.showToast({title:t('所选项目暂无内容，请选择其他项目'),icon:'none'});return;}
        const k = 0.6; canvas.width = Math.round(R.W * k); canvas.height = Math.round(R.heightOf(o) * k);
        const c = canvas.getContext('2d'); c.scale(k, k); R.draw(c, o);
        wx.canvasToTempFilePath({ canvas, fileType: 'png', success: r => { this.busy = false; wx.hideLoading(); this.setData({ rcOpen: false }); this.showImage(r.tempFilePath); }, fail: () => fail() });
      } catch (err) { fail(); }
    });
  },

});
