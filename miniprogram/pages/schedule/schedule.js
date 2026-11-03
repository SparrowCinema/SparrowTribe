const U = require('../../utils/util.js');
const plan = require('../../utils/plan.js');
const I = require('../../utils/i18n.js');
const t = I.tr;
const app = getApp();
const K = 3.4; // 每分钟 3.4rpx（每小时约 204rpx，片名与版本标签都能完整显示）

const vShort = v => (v.city ? t(v.city) + ' · ' : '') + (v.short || v.brand || v.name).replace(new RegExp('^(' + [v.city,t(v.city||'')].filter(Boolean).join('|') + ')\\s*[·・]?\\s*'), '');
const hShort = h => h.short || h.name;

Page({
  setView(e){const view=e.currentTarget.dataset.view;this.setData({view});try{wx.setStorageSync('sk-schedule-view',view);}catch{}},
  data: {view:wx.getStorageSync('sk-schedule-view')||'gantt', onlyMine: false, selectorType: '', selectorQuery: '', selectorRows: [], programmeName: '', cityName: '', city: 'all', cityIndex: 0, cities: [], venueQuery: '', venueName: '', pf: 'all', vf: 'all', day: '', days: [], nowLine: null, todayOpen: false, myToday: [], myTodayTitle: '', progs: [], vchips: [], venues: [], vOpen: false, cols: [], ticks: [], H: 0, dayList: [], legend: [], span: '', count: 0, dayTitle: '', empty: '', scrollInto: '' },

  onLoad(q) {
    let om = false; try { om = !!wx.getStorageSync('sk-only-mine'); } catch (e) { }
    this.setData({ i: I.dict(), en: I.isEn(), onlyMine: om });
    if (q && q.day) this.setData({ day: q.day });
    this.off1 = app.onData(() => this.build());
    this.off2 = plan.onChange(() => this.build());
    this.build();
  },
  onUnload() { this.off1 && this.off1(); this.off2 && this.off2(); this.stopTick(); },
  onHide() { this.stopTick(); },
  // 当前时间线：每 30 秒移动一次（跨天时整页重建）
  startTick() { this.stopTick(); this.timer = setInterval(() => this.tick(), 30000); },
  stopTick() { if (this.timer) { clearInterval(this.timer); this.timer = null; } },
  tick() {
    const c = this.ttCtx; if (!c) return;
    const t = new Date(), key = (t.getMonth() + 1) + '/' + t.getDate();
    if (key !== c.today) { this.build(); return; }
    this.setData({ nowLine: this.nowLineOf(c) });
  },
  nowLineOf(c) {
    if (!c.isToday) return null;
    const t = new Date(), m = t.getHours() * 60 + t.getMinutes();
    return m >= c.S && m <= c.E ? { top: Math.round((m - c.S) * K), label: U.fmt(m) } : null;
  },
  onShow() { wx.setNavigationBarTitle({ title: t('麻雀观影护照') }); app.chrome(); this.startTick(); const j = app.globalData.jumpDay, jp = app.globalData.jumpProg; if (j) { app.globalData.jumpDay = ''; this.setData({ pf: 'all', vf: 'all', city: 'all', venueQuery: '', day: j }); } if (jp) { app.globalData.jumpProg = ''; this.setData({ pf: jp, vf: 'all', city: 'all', venueQuery: '', day: '' }); } this.build(); },
  onPullDownRefresh() { app.loadRemote(); setTimeout(() => { this.build(); wx.stopPullDownRefresh(); }, 600); },

  build() {
    const data = app.globalData.data, idx = U.index(data), picked = plan.get();
    const { pf, vf, city, venueQuery } = this.data;
    const list = data.shows.filter(s => idx.F[s.id] && !U.ended(s, idx) && (pf === 'all' || U.progForShow(s, idx).id === pf) && (vf === 'all' || s.v === vf) && (city === 'all' || idx.VN[s.v].city === city) && (!this.data.onlyMine || picked.has(U.keyOf(s))));
    // 首页顶部：今天我的排片中尚未散场的场次，按时间线排列
    const tk = new Date(), tkey = (tk.getMonth() + 1) + '/' + tk.getDate();
    // 今天还有没散场的就显示今天；今天都散场后顺延到之后最近一个有排片的日子（到了当天自动变回「今日」）
    const upc = data.shows.filter(s => idx.F[s.id] && picked.has(U.keyOf(s)) && !U.ended(s, idx)).sort((a, b) => U.showDate(a) - U.showDate(b));
    const nkey = upc.length ? upc[0].d : tkey, t0 = new Date(tk.getFullYear(), tk.getMonth(), tk.getDate()), d1 = upc.length ? U.showDate(upc[0]) : t0;
    const off = Math.round((new Date(d1.getFullYear(), d1.getMonth(), d1.getDate()) - t0) / 864e5);
    const myToday = upc.filter(s => s.d === nkey)
      .sort((a, b) => U.toMin(a.t) - U.toMin(b.t))
      .map(s => { const vw = U.showView(s, idx, data, picked); return { key: vw.key, id: s.id, t: vw.t, end: vw.end, endTxt: I.isEn() ? 'ends ' + vw.end : vw.end + ' 散场', cn: vw.cn, venue: vw.venue, hall: vw.hall, tone: vw.tone }; });
    const allDays = [...new Set(data.shows.map(s => s.d))];
    const ds = allDays.filter(d => list.some(s => s.d === d));
    let day = this.data.day;
    if (!ds.includes(day)) {
      const t = new Date(); t.setHours(0, 0, 0, 0);
      day = ds.find(d => { const [m, dd] = d.split('/').map(Number); return new Date(U.year(d), m - 1, dd) >= t; }) || ds[0] || '';
    }
    let lastM = '';
    const days = ds.map(d => {
      const [m, dd] = d.split('/'); const mon = m !== lastM ? t(m + '月') : ''; lastM = m;
      return { d, mon, dd, wk: U.wk(d), n: list.filter(s => s.d === d).length, mine: data.shows.some(s => s.d === d && picked.has(U.keyOf(s))) };
    });

    // 单日时刻表：纵轴时间，横向影厅
    const dl = list.filter(s => s.d === day);
    let cols = [], ticks = [], H = 0, nowLine = null;
    this.ttCtx = null;
    if (dl.length) {
      let S = Math.min(...dl.map(s => U.toMin(s.t))), E = Math.max(...dl.map(s => Math.max(U.toMin(s.t) + U.durationOf(s, idx) + (U.showView(s, idx, data, picked).ev ? 30 : 0), (U.qaOf(idx.F[s.id]) || {}).end || 0)));
      // Only show the current-time marker inside the screening window.
      const tn = new Date(), todayKey = (tn.getMonth() + 1) + '/' + tn.getDate(), isToday = todayKey === day;
      // Leave 30–59 minutes before the first screening.
      S = Math.max(0, Math.floor((S - 30) / 30) * 30);
      E = Math.ceil(E / 60) * 60; if (E - S < 180) E = S + 180;
      this.ttCtx = { day, S, E, isToday, today: todayKey };
      nowLine = this.nowLineOf(this.ttCtx);
      H = Math.round((E - S) * K) + 30;
      for (let m = S; m <= E; m += 60) ticks.push({ y: Math.round((m - S) * K), t: U.fmt(m) });
      data.venues.forEach(v => v.halls.forEach(h => {
        const hs = dl.filter(s => s.v === v.id && s.h === h.id);
        if (!hs.length) return;
        const qas = [];
        cols.push({ key: v.id + h.id, vn: vShort(v), hn: hShort(h), qas, blocks: hs.map(s => {
          const vw = U.showView(s, idx, data, picked), st = U.toMin(s.t), qa = U.qaOf(idx.F[s.id]);
          if (qa) qas.push({ key: vw.key + '-qa', nm: '映后交流', id: s.id, top: Math.round((qa.start - S) * K), h: Math.max(60, Math.round((qa.end - qa.start) * K) - 6), label: qa.label });
          else if (vw.ev) { const pe = st + U.durationOf(s, idx), nx = Math.min(Infinity, ...hs.map(y => U.toMin(y.t)).filter(m => m > st)), pm = Math.min(30, nx - pe); if (pm >= 10) qas.push({ key: vw.key + '-post', nm: '映后', id: s.id, top: Math.round((pe - S) * K), h: Math.round(pm * K) - 6, label: U.fmt(pe) + '–' + U.fmt(pe + pm) }); }
          return Object.assign(vw, { top: Math.round((st - S) * K), h: Math.max(150, Math.round(U.durationOf(s, idx) * K) - 6) });
        }) });
      }));
    }
    // 专题筛选：已结束的专题不再列出（当前选中的除外），与网站一致
    const progs = data.programmes.map(p => {
      const info = U.progInfo(p, data, idx);
      const fn = data.films.filter(f => !f.ev && idx.progOf(f).id === p.id || (p.sections||{})[f.id]).length;
      return Object.assign({}, p, { n: info.shows.length, fn, status: info.status });
    }).filter(p => p.status !== 'ended' || p.id === pf);
    // 影院筛选：只列出当前专题里还有待放映场次的影院；只有一家时不显示
    const upInProg = data.shows.filter(s => idx.F[s.id] && !U.ended(s, idx) && (pf === 'all' || U.progForShow(s, idx).id === pf));
    const vlist = data.venues.filter(v => upInProg.some(s => s.v === v.id) || v.id === vf);
    const cities = [{id:'all', name:t('全部城市')}].concat([...new Set(data.venues.map(v => v.city).filter(Boolean))].map(id=>({id,name:t(id)})));
    const venues = data.venues.filter(v => (city==='all'||v.city===city) && (!venueQuery || [v.city,v.name,v.short,...v.halls.map(h=>h.name)].join(' ').toLowerCase().includes(venueQuery.toLowerCase()))).map(v => {
      const n = upInProg.filter(s => s.v === v.id).length;
      return { id: v.id, short: vShort(v), name: v.name, city: t(v.city||''), label: v.name.replace(new RegExp('^'+(v.city||'$^')),''), fmt: t((v.fmt || []).join(' · ')), n, halls: v.halls.length ? v.halls.map(h => h.name).join(' · ') : t('影厅待补充') };
    });
    const vname = vf !== 'all' && idx.VN[vf] ? idx.VN[vf].name : t('当前筛选');
    const venueGroups=data.venues.filter(v=>dl.some(s=>s.v===v.id)).map(v=>({id:v.id,name:vShort(v),halls:v.halls.filter(h=>dl.some(s=>s.v===v.id&&s.h===h.id)).map(h=>({id:h.id,name:h.short||h.name,rows:dl.filter(s=>s.v===v.id&&s.h===h.id).map(s=>{const r=U.showView(s,idx,data,picked);r.mpa=idx.F[s.id].mpa?.rating||'';return r;})}))}));
    this.setData({
      venueGroups,day, days, cols, ticks, H, nowLine, progs, venues, myToday, cities, cityIndex: Math.max(0,cities.findIndex(c=>c.id===city)), venueName: vf==='all'?t('全部影院'):vShort(idx.VN[vf]), programmeName: pf==='all'?t('全部专题'):idx.PG[pf].name, cityName:city==='all'?t('全部城市'):t(city),
      todayHead: t(off <= 0 ? '今日我的排片' : off === 1 ? '明日我的排片' : '近期我的排片'),
      myTodayTitle: t(nkey.replace('/', '月') + '日') + ' ' + U.wk(nkey) + ' · ' + t(off <= 0 ? '接下来 ' + myToday.length + ' 场' : off === 1 ? myToday.length + ' 场' : off + ' 天后 · ' + myToday.length + ' 场'),
      todayToggle: t(this.data.todayOpen ? '收起' : '还有 ' + Math.max(0, myToday.length - 1) + ' 场 · 展开全部'),
      vchips: vlist.length > 1 ? [{ id: 'all', n: t('全部影院') }].concat(vlist.map(v => ({ id: v.id, n: vShort(v) }))) : [],
      dayList: dl.map(s => U.showView(s, idx, data, picked)),
      dayTitle: day ? t(day.replace('/', '月') + '日') + ' ' + U.wk(day) : '',
      hallCount: new Set(dl.map(s => s.v + s.h)).size,
      empty: ds.length ? '' : (this.data.onlyMine ? t('当前筛选下还没有你加入的场次') : t(vname + '暂无排片')), mineN: data.shows.filter(s => idx.F[s.id] && !U.ended(s, idx) && picked.has(U.keyOf(s)) && (pf === 'all' || U.progForShow(s, idx).id === pf)).length,
      legend: Object.keys(data.reg).map(k => data.reg[k]),
      span: ds.length ? ds[0] + ' – ' + ds[ds.length - 1] : '', count: list.length,
      scrollInto: 'd' + (ds.indexOf(day) > 1 ? ds.indexOf(day) - 1 : 0)
    });
  },

  selectorOptions(type, query) {
    const data=app.globalData.data, idx=U.index(data), q=(query||'').trim().toLowerCase();let rows;
    if(type==='programme')rows=[{id:'all',name:t('全部专题'),sub:t('查看所有专题的排片'),selected:this.data.pf==='all'},...this.data.progs.map(p=>({id:p.id,name:p.name,sub:[p.city,p.period].filter(Boolean).join(' · '),selected:this.data.pf===p.id}))];
    else if(type==='city')rows=this.data.cities.map(c=>({id:c.id,name:c.name,sub:'',selected:this.data.city===c.id}));
    else rows=[{id:'all',name:t('全部影院'),sub:this.data.cityName,selected:this.data.vf==='all'},...data.venues.filter(v=>this.data.city==='all'||v.city===this.data.city).map(v=>{const n=data.shows.filter(s=>s.v===v.id&&!U.ended(s,idx)&&(this.data.pf==='all'||U.progForShow(s,idx).id===this.data.pf)).length;return {id:v.id,n,name:vShort(v),sub:[t(n+' 场'),...v.halls.map(h=>h.name)].filter(Boolean).join(' · '),selected:this.data.vf===v.id};}).sort((a,b)=>Number(b.n>0)-Number(a.n>0))];
    return rows.filter(x=>!q||(x.name+' '+x.sub).toLowerCase().includes(q));
  },
  openSelector(e) { const type=e.currentTarget.dataset.type;this.setData({selectorType:type,selectorQuery:'',selectorTitle:t({programme:'选择专题',city:'选择城市',venue:'选择影院'}[type]),selectorPlaceholder:t({programme:'搜索专题',city:'搜索城市',venue:'搜索影院、城市或影厅'}[type]),selectorRows:this.selectorOptions(type,'')}); },
  searchSelector(e) {this.setData({selectorQuery:e.detail.value,selectorRows:this.selectorOptions(this.data.selectorType,e.detail.value)});},
  closeSelector() {this.setData({selectorType:'',selectorQuery:''});},
  stopMove() {},
  chooseFilter(e) {const id=e.currentTarget.dataset.id,type=this.data.selectorType;if(type==='programme')this.setProg(e);else if(type==='city'){this.setData({city:id,vf:'all',day:''});this.build();}else this.setVenue(e);this.closeSelector();},
  resetFilters() {this.setData({pf:'all',city:'all',vf:'all',day:'',venueQuery:''});this.build();},
  setProg(e) { this.setData({ pf: e.currentTarget.dataset.id, vf: 'all', city: 'all', venueQuery: '', day: '' }); this.build(); },
  setVenue(e) { this.setData({ vf: e.currentTarget.dataset.id, vOpen: false }); this.build(); },
  setCity(e) { this.setData({city:this.data.cities[+e.detail.value].id,vf:'all',venueQuery:'',day:''}); this.build(); },
  searchVenue(e) { this.setData({venueQuery:e.detail.value}); this.build(); },
  toggleMine() { const v = !this.data.onlyMine; try { wx.setStorageSync('sk-only-mine', v ? 1 : 0); } catch (e) { } this.setData({ onlyMine: v }); this.build(); },
  setDay(e) { this.setData({ day: e.currentTarget.dataset.d }); this.build(); },
  toggleToday() { this.setData({ todayOpen: !this.data.todayOpen }); this.build(); },
  switchLang() { app.switchLang(); },
  toggleVenues() { this.setData({ vOpen: !this.data.vOpen }); },
  openFilm(e) { wx.navigateTo({ url: '/pages/film/film?id=' + e.currentTarget.dataset.id }); },
  openProg(e) { wx.navigateTo({ url: '/pages/programme/programme?id=' + e.currentTarget.dataset.id }); },
  toggle(e) {
    const on = plan.toggle(e.currentTarget.dataset.key);
    wx.showToast({ title: t(on ? '已加入排片' : '已移出排片'), icon: 'none' });
  },
  onShareAppMessage() { return { title: t('麻雀观影护照 · 影展排片与观影日程'), path: '/pages/schedule/schedule' }; },
  onShareTimeline() { return { title: t('麻雀观影护照 · 影展排片与观影日程') }; }
});
