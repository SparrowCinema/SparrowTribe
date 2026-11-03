const U = require('../../utils/util.js');
const I = require('../../utils/i18n.js');
const plan = require('../../utils/plan.js');
const W = require('../../utils/watched.js');
const Library = require('../../utils/library.js');
const t = I.tr;
const app = getApp();
const MODES = [['all','全部影片','浏览完整片目'],['planned','已加入排片','已保存在个人排片中的影片'],['watched','已看过','收进观影护照的影片'],['unwatched','还没看过','继续探索新的银幕相遇'],['qa','主创映后场','有主创映后活动的影片']];
const FOLD_KEY = 'sk-fold-v1';

/* 片目分组折叠（与网站一致）：
   · 进行中/即将开始的专题：标题右侧圆形折叠按钮（状态记在本机）；组内已放映完的片子收进底部「本专题已放映」小折叠。
   · 整个专题结束后：整组移到最底部「往期专题」，每个专题一张折叠卡片（默认收起），按结束时间由近到远。 */
Page({
  data: { year:'all',city:'all',mine:'all',q:'',selectorType:'',selectorQuery:'',selectorRows:[],pf: 'all', progs: [], secs: [], past: [], pastN: 0, n: 0 },
  onLoad() {
    let f = {}; try { f = wx.getStorageSync(FOLD_KEY) || {}; } catch (e) { }
    this.folds = f; this.pastOpen = {}; this.goneOpen = {};
    this.setData({ i: I.dict() }); wx.setNavigationBarTitle({ title: t('片目') });
    this.off = app.onData(() => this.build());this.offPlan=plan.onChange(()=>this.build());this.offWatched=W.onChange(()=>this.build());this.build();
  },
  onUnload() {this.off&&this.off();this.offPlan&&this.offPlan();this.offWatched&&this.offWatched();},
  onShow() {const mode=app.globalData.jumpLibraryMine;if(mode){app.globalData.jumpLibraryMine='';this.setData({mine:mode,pf:'all',q:''});}this.build();},
  context() {const data=app.globalData.data,idx=U.index(data);return {shows:data.shows,picked:plan.get(),watched:W.all(),keyOf:U.keyOf,programme:this.data.pf,city:this.data.city,cityOfShow:s=>idx.VN[s.v]?.city,programmeOf:f=>idx.progOf(f).id,showProgramme:s=>U.progForShow(s,idx).id};},

  row(f, data, idx, withNext, pid) {
    const nx = withNext ? data.shows.filter(s=>s.id===f.id&&!U.ended(s,idx)&&(pid?U.progForShow(s,idx).id===pid:(this.data.pf==='all'||U.progForShow(s,idx).id===this.data.pf))&&(this.data.city==='all'||idx.VN[s.v]?.city===this.data.city)).sort((a,b)=>U.showDate(a)-U.showDate(b))[0] : null,status=Library.status(f,this.context());
    return {planned:status.planned,watched:status.watched,event:status.event,id:f.id, cn: f.cn, en: f.en || f.o, dir: f.dir, c: t(f.c), y: f.y, version: t(f.version || ''), db: f.r && f.r[0] != null ? f.r[0] : '—',
      release: t(f.release || ''), poster: U.poster(f), color: (data.reg[f.reg] || {}).c, next: nx ? nx.d + ' ' + nx.t : '' };
  },
  build() {
    const data = app.globalData.data, idx = U.index(data), {mine,pf,q}=this.data,ctx=this.context();
    const fest = p => U.isFest(p) ? 0 : 1;
    const base=data.films.filter(f=>!f.ev).filter(f=>Library.inProgramme(f,pf,ctx)&&Library.inCity(f,this.data.city,ctx)&&(this.data.year==='all'||String(f.y)===this.data.year)&&Library.category(f,mine,ctx)&&Library.matches(f,q));
    const inP = (f, p) => idx.progsOf(f).some(x => x.p.id === p.id) || data.shows.some(s => s.id === f.id && U.progForShow(s, idx).id === p.id); // 跨影展影片在每个所属专题都列出
    const info = {}; data.programmes.forEach(p => { info[p.id] = U.progInfo(p, data, idx); });
    const showsIn = (f, p) => data.shows.filter(s => s.id === f.id && U.progForShow(s, idx).id === p.id);
    const isLiveIn = (f, p) => { const ss = showsIn(f, p); return ss.some(s => !U.ended(s, idx)) || (!ss.length && info[p.id].status !== 'ended'); };
    const order = data.programmes.slice().sort((a, b) => fest(a) - fest(b));
    const kind = p => t(U.isFest(p) ? '影展' : p.kind || '专题');
    const stack = rows => rows.slice(0, 4).map(r => ({ id: r.id, poster: r.poster, color: r.color, ch: r.cn[0] }));
    const secs = [], past = [];
    order.forEach(p => {
      if (pf !== 'all' && pf !== p.id) return;
      const ms = base.filter(f => inP(f, p)); if (!ms.length) return;
      if (info[p.id].status === 'ended') {
        const rows = ms.sort((a, b) => U.relTime(b) - U.relTime(a)).map(f => this.row(f, data, idx, false, p.id));
        past.push({ id: p.id, kind: kind(p), name: p.name, period: p.period || '', n: rows.length, rows, stack: stack(rows), open:!!q||mine!=='all'||!!this.pastOpen[p.id], end: info[p.id].b || 0 });
      } else {
        const live = ms.filter(f => isLiveIn(f, p)).sort(U.filmOrder(data.shows.filter(s => U.progForShow(s, idx).id === p.id))).map(f => this.row(f, data, idx, true, p.id));
        const gone = ms.filter(f => !isLiveIn(f, p)).sort((a, b) => U.relTime(b) - U.relTime(a)).map(f => this.row(f, data, idx, false, p.id));
        const all = live.concat(gone);
        secs.push({ id: p.id, kind: kind(p), name: p.name, meta: all.length, en: p.en || '', live, gone, stack: stack(all), open:!!q||mine!=='all'||this.folds[p.id]!==0, goneOpen:!!q||mine!=='all'||!!this.goneOpen[p.id] });
      }
    });
    past.sort((a, b) => b.end - a.end);
    const stat = { total: data.films.filter(f => !f.ev).length, live: data.films.filter(f => !f.ev).filter(f => U.nextShowOf(f, data.shows)).length, progs: data.programmes.filter(p => data.films.some(f => idx.progOf(f).id === p.id || ((p.sections || {})[f.id]))).length };
    this.setData({yearName:this.data.year==='all'?t('全部年份'):this.data.year,cityName:this.data.city==='all'?t('全部城市'):t(this.data.city),programmeName:pf==='all'?t('全部专题'):(idx.PG[pf]||{}).name,mineName:t(MODES.find(x=>x[0]===mine)[1]),active:pf!=='all'||this.data.city!=='all'||this.data.year!=='all'||mine!=='all'||!!q,stat, secs, past, pastN: past.reduce((n, x) => n + x.n, 0), n: base.length, regs: Object.keys(data.reg).map(k => ({ k, n: t(data.reg[k].n) })), progs: data.programmes.length > 1 ? data.programmes : [] });
  },
  search(e) {this.setData({q:e.detail.value});this.build();},
  resetFilters() {this.setData({mine:'all',pf:'all',city:'all',year:'all',q:''});this.build();},
  options(type,query) {const data=app.globalData.data,ctx=this.context(),q=(query||'').trim().toLocaleLowerCase();
    const yb=data.films.filter(f=>!f.ev&&Library.inProgramme(f,this.data.pf,ctx)),ys=[...new Set(yb.map(f=>f.y).filter(Boolean))].sort((a,b)=>b-a);
    const rows=type==='year'?[{id:'all',name:t('全部年份'),sub:t(yb.length+' 部影片'),selected:this.data.year==='all'},...ys.map(y=>({id:String(y),name:String(y),sub:t(yb.filter(f=>String(f.y)===String(y)).length+' 部影片'),selected:this.data.year===String(y)}))]:type==='city'?[{id:'all',name:t('全部城市'),sub:t('按已收录场次所在城市筛选'),selected:this.data.city==='all'},...[...new Set(data.venues.map(v=>v.city).filter(Boolean))].map(c=>({id:c,name:t(c),sub:t(data.films.filter(f=>!f.ev&&Library.inProgramme(f,this.data.pf,ctx)&&Library.inCity(f,c,ctx)).length+' 部影片'),selected:this.data.city===c}))]:type==='programme'?[{id:'all',name:t('全部专题'),sub:t('浏览完整片目'),selected:this.data.pf==='all'},...data.programmes.map(p=>({id:p.id,name:p.name,sub:t(data.films.filter(f=>!f.ev&&Library.inProgramme(f,p.id,ctx)).length+' 部影片')+' · '+t(p.city||''),selected:this.data.pf===p.id}))]:MODES.map(([id,name,sub])=>({id,name:t(name),sub:t(sub)+' · '+t(data.films.filter(f=>!f.ev&&Library.inProgramme(f,this.data.pf,ctx)&&Library.category(f,id,ctx)).length+' 部影片'),selected:this.data.mine===id}));
    return rows.filter(x=>!q||(x.name+' '+x.sub).toLocaleLowerCase().includes(q));
  },
  openSelector(e) {const type=e.currentTarget.dataset.type;this.setData({selectorType:type,selectorQuery:'',selectorTitle:t(type==='programme'?'选择专题':type==='year'?'选择年份':type==='city'?'选择城市':'我的影片'),selectorPlaceholder:t(type==='programme'?'搜索专题':type==='year'?'搜索年份':type==='city'?'搜索城市':'搜索我的分类'),selectorRows:this.options(type,'')});},
  searchSelector(e) {this.setData({selectorQuery:e.detail.value,selectorRows:this.options(this.data.selectorType,e.detail.value)});},
  chooseFilter(e) {const ty=this.data.selectorType,v=e.currentTarget.dataset.id;this.setData(Object.assign({[ty==='programme'?'pf':ty==='year'?'year':ty==='city'?'city':'mine']:v},ty==='programme'?{year:'all'}:{}));this.build();this.closeSelector();},
  closeSelector() {this.setData({selectorType:'',selectorQuery:''});},
  stopMove() {},
  toggleSec(e) { const id = e.currentTarget.dataset.id, i = this.data.secs.findIndex(s => s.id === id); if (i < 0) return; const open = !this.data.secs[i].open; this.folds[id] = open ? 1 : 0; try { wx.setStorageSync(FOLD_KEY, this.folds); } catch (er) { } this.setData({ ['secs[' + i + '].open']: open }); },
  toggleGone(e) { const id = e.currentTarget.dataset.id, i = this.data.secs.findIndex(s => s.id === id); if (i < 0) return; const v = !this.data.secs[i].goneOpen; this.goneOpen[id] = v; this.setData({ ['secs[' + i + '].goneOpen']: v }); },
  togglePast(e) { const id = e.currentTarget.dataset.id, i = this.data.past.findIndex(s => s.id === id); if (i < 0) return; const v = !this.data.past[i].open; this.pastOpen[id] = v; this.setData({ ['past[' + i + '].open']: v }); },
  setProg(e) { this.setData({ pf: e.currentTarget.dataset.k }); this.build(); },
  open(e) { wx.navigateTo({ url: '/pages/film/film?id=' + e.currentTarget.dataset.id }); },
  onShareAppMessage() { return { title: t('片目 · 麻雀观影护照'), path: '/pages/films/films' }; }
});
