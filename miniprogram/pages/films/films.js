const T = require('../../utils/totop.js');
const U = require('../../utils/util.js');
const I = require('../../utils/i18n.js');
const plan = require('../../utils/plan.js');
const W = require('../../utils/watched.js');
const Want = require('../../utils/want.js');
const Library = require('../../utils/library.js');
const Stats = require('../../utils/stats.js');
const t = I.tr;
// 多选：reg / len / year / city / mine / pf 是 'all' 或逗号连接的多个值（同一筛选内为「或」）
const sl = Library.list, sh = Library.has;
const summ = (v, all, one, unit) => { const a = sl(v); return !a.length ? all : a.length === 1 ? one(a[0]) : t(a.length + ' ' + (I.isEn() && unit === '家影院' ? '家' : unit)); };
const app = getApp();
const MODES = [['all','全部影片','浏览完整片目'],['want','想看','标记了想看的影片 · 有新场次会标出'],['planned','已加入排片','已保存在个人排片中的影片'],['watched','已看过','收进观影护照的影片'],['unwatched','还没看过','继续探索新的银幕相遇'],['qa','主创映后场','有主创映后活动的影片']];
const FOLD_KEY = 'sk-fold-v1';
// 片长分档（与网站一致）
const LEN_BINS = [['s','60 分钟以内',0,60],['m','60–90 分钟',61,90],['l','90–120 分钟',91,120],['xl','120 分钟以上',121,1e9]];
const lenOk = (f, k) => { const a = sl(k); if (!a.length) return true; return a.some(x => { const b = LEN_BINS.find(y => y[0] === x); return !!(b && f.min && f.min >= b[2] && f.min <= b[3]); }); };

/* 片目分组折叠（与网站一致）：
   · 进行中/即将开始的专题：标题右侧圆形折叠按钮（状态记在本机）；组内已放映完的片子收进底部「本专题已放映」小折叠。
   · 整个专题结束后：整组移到最底部「往期专题」，每个专题一张折叠卡片（默认收起），按结束时间由近到远。 */
Page({
  onPageScroll(e) { T.scroll(this, e); },
  toTop() { T.go(); },
  data: { reg:'all',len:'all',year:'all',city:'all',mine:'all',trait:'all',traitChips:[],q:'',selectorType:'',selectorQuery:'',selectorRows:[],pf: 'all', progs: [], secs: [], past: [], pastN: 0, n: 0 },
  switchLang() { app.switchLang(); },
  onLoad() {
    let f = {}; try { f = wx.getStorageSync(FOLD_KEY) || {}; } catch (e) { }
    this.folds = f; this.pastOpen = {}; this.goneOpen = {};
    this.setData({ i: I.dict(), en: I.isEn() }); wx.setNavigationBarTitle({ title: t('片目') });
    this.off = app.onData(() => this.build());this.offPlan=plan.onChange(()=>this.build());this.offWatched=W.onChange(()=>this.build());this.build();
  },
  onUnload() {this.off&&this.off();this.offPlan&&this.offPlan();this.offWatched&&this.offWatched();},
  onShow() { Stats.stat('pv', 'films');const mode=app.globalData.jumpLibraryMine;if(mode){app.globalData.jumpLibraryMine='';this.setData({mine:mode,trait:'all',pf:'all',q:''});}this.build();},
  context() {
    const data=app.globalData.data,idx=U.index(data);
    const overlaps=(a,b)=>{const sa=U.showDate(a,idx),sb=U.showDate(b,idx),da=(idx.F[a.id]&&idx.F[a.id].min)||120,db=(idx.F[b.id]&&idx.F[b.id].min)||120;return sa<sb+db*60000-120000&&sb<sa+da*60000-120000;};
    return {shows:data.shows,programmes:data.programmes,picked:plan.get(),watched:W.all(),want:Want.all(),keyOf:U.keyOf,isPast:s=>U.ended(s,idx),overlaps,programme:this.data.pf,city:this.data.city,cityOfShow:s=>idx.VN[s.v]?.city,programmeOf:f=>idx.progOf(f).id,programmeIds:f=>idx.progsOf(f).map(x=>x.p.id),showProgramme:s=>U.progForShow(s,idx).id};
  },

  row(f, data, idx, withNext, pid) {
    const nx = withNext ? data.shows.filter(s=>s.id===f.id&&!U.ended(s,idx)&&(pid?U.progForShow(s,idx).id===pid:sh(this.data.pf,U.progForShow(s,idx).id))&&sh(this.data.city,idx.VN[s.v]?.city)).sort((a,b)=>U.showDate(a)-U.showDate(b)) : null, nxl = nx && U.localFirst(nx, idx), status=Library.status(f,this.context());
    const wanted=status.wanted,fresh=wanted&&Want.newCount(f.id,data.shows.filter(s=>s.id===f.id&&!U.ended(s,idx)).map(U.keyOf))>0;
    return {wanted,fresh,planned:status.planned,watched:status.watched,event:status.event,lastChance:status.lastChance,id:f.id, cn: f.cn, en: f.en || f.o, dir: f.dir, c: t(f.c), y: f.y, version: t(f.version || ''), db: f.r && f.r[0] != null ? f.r[0] : '—',
      release: f.ended ? t('已下映') : t(f.release || ''), poster: U.thumb(f), color: (data.reg[f.reg] || {}).c, next: nxl ? U.ymd(nxl) + ' ' + nxl.t : '' };
  },
  build() {
    const data = app.globalData.data, idx = U.index(data), {mine,trait,pf,q}=this.data,ctx=this.context();
    const fest = p => U.isFest(p) ? 0 : 1;
    const pre=data.films.filter(f=>!f.ev).filter(f=>Library.inProgramme(f,pf,ctx)&&Library.inCity(f,this.data.city,ctx)&&Library.yearMatches(f,this.data.year)&&sh(this.data.reg,f.reg)&&lenOk(f,this.data.len)&&Library.category(f,mine,ctx)&&Library.matches(f,q));
    const activeTraits=sl(trait);
    const traitChips=(Library.TRAITS||[]).map(([id,label])=>{
      const on=activeTraits.includes(id),nextSel=on?trait:Library.toggle(trait,id);
      const cnt=pre.filter(f=>Library.matchesTraits(f,nextSel,ctx)).length;
      if(!on&&!cnt)return null;
      return {id,name:t(id==='fit'&&ctx.picked.size?'零冲突凑空档':label),cnt,on};
    }).filter(Boolean);
    const base=pre.filter(f=>Library.matchesTraits(f,trait,ctx));
    const inP = (f, p) => idx.progsOf(f).some(x => x.p.id === p.id) || data.shows.some(s => s.id === f.id && U.progForShow(s, idx).id === p.id); // 跨影展影片在每个所属专题都列出
    const info = {}; data.programmes.forEach(p => { info[p.id] = U.progInfo(p, data, idx); });
    const showsIn = (f, p) => data.shows.filter(s => s.id === f.id && U.progForShow(s, idx).id === p.id);
    const isLiveIn = (f, p) => { const ss = showsIn(f, p); return ss.some(s => !U.ended(s, idx)) || (!ss.length && !U.endedIn(f, p) && info[p.id].status !== 'ended'); };
    const loc = p => U.localProg(p, data, idx, info[p.id].status) ? 0 : 1; // 定位城市的专题排最前（没有定位时全为 1，保持原顺序）
    const order = data.programmes.slice().sort((a, b) => loc(a) - loc(b) || fest(a) - fest(b));
    const kind = p => t(U.isFest(p) ? '影展' : p.kind || '专题');
    const stack = rows => rows.slice(0, 4).map(r => ({ id: r.id, poster: r.poster, color: r.color, ch: r.cn[0] }));
    const secs = [], past = [], autoOpen = !!q || mine !== 'all' || trait !== 'all';
    // 收起的专题、「本专题已放映」「往期专题」不把影片行发给页面（片库变大后 setData 体积只跟展开的部分有关），完整行留在 this._rows，展开时再补
    const full = this._rows = { live: {}, gone: {}, past: {} };
    order.forEach(p => {
      if (!sh(pf, p.id)) return;
      const ms = base.filter(f => inP(f, p)); if (!ms.length) return;
      if (info[p.id].status === 'ended') {
        const rows = ms.sort((a, b) => U.relTime(b) - U.relTime(a)).map(f => this.row(f, data, idx, false, p.id));
        const open = autoOpen || !!this.pastOpen[p.id]; full.past[p.id] = rows;
        past.push({ id: p.id, kind: kind(p), name: p.name, period: p.period || '', n: rows.length, rows: open ? rows : [], stack: stack(rows), open, end: info[p.id].b || 0 });
      } else {
        const live = ms.filter(f => isLiveIn(f, p)).sort(U.filmOrder(data.shows.filter(s => U.progForShow(s, idx).id === p.id))).map(f => this.row(f, data, idx, true, p.id));
        const gone = ms.filter(f => !isLiveIn(f, p)).sort((a, b) => U.relTime(b) - U.relTime(a)).map(f => this.row(f, data, idx, false, p.id));
        const all = live.concat(gone);
        const open = autoOpen || this.folds[p.id] !== 0, goneOpen = autoOpen || !!this.goneOpen[p.id]; full.live[p.id] = live; full.gone[p.id] = gone;
        secs.push({ id: p.id, kind: kind(p), name: p.name, meta: all.length, en: p.en || '', live: open ? live : [], gone: open && goneOpen ? gone : [], goneN: gone.length, stack: stack(all), open, goneOpen });
      }
    });
    past.sort((a, b) => b.end - a.end);
    const stat = { total: data.films.filter(f => !f.ev).length, live: data.films.filter(f => !f.ev).filter(f => U.nextShowOf(f, data.shows)).length, progs: data.programmes.filter(p => data.films.some(f => idx.progOf(f).id === p.id || ((p.sections || {})[f.id] || (p.members || []).includes(f.id)))).length };
    this.setData({traitChips,regName:summ(this.data.reg,t('全部地区'),i=>t((data.reg[i]||{}).n||i),'个地区'),lenName:summ(this.data.len,t('全部片长'),i=>t((LEN_BINS.find(x=>x[0]===i)||[0,i])[1]),'档片长'),yearName:summ(this.data.year,t('全部年份'),i=>t(Library.decadeLabel(i)),'项年份'),cityName:summ(this.data.city,t('全部城市'),i=>t(i),'座城市'),programmeName:summ(pf,t('全部专题'),i=>(idx.PG[i]||{}).name||i,'个专题'),mineName:summ(mine,t(MODES[0][1]),i=>t((MODES.find(x=>x[0]===i)||[0,i])[1]),'个分类'),active:pf!=='all'||this.data.city!=='all'||this.data.year!=='all'||this.data.reg!=='all'||this.data.len!=='all'||mine!=='all'||trait!=='all'||!!q,stat, secs, past, pastN: past.reduce((n, x) => n + x.n, 0), n: base.length, regs: Object.keys(data.reg).map(k => ({ k, n: t(data.reg[k].n) })), progs: data.programmes.length > 1 ? data.programmes : [] });
  },
  toggleTrait(e) { const id = e.currentTarget.dataset.id; this.setData({ trait: Library.toggle(this.data.trait, id) }); this.build(); },
  search(e) {this.setData({q:e.detail.value});this.build();},
  resetFilters() {this.setData({mine:'all',trait:'all',pf:'all',city:'all',year:'all',reg:'all',len:'all',q:''});this.build();},
  filterOptions(type,query) {const data=app.globalData.data,ctx=this.context(),q=(query||'').trim().toLocaleLowerCase();
    const yb=data.films.filter(f=>!f.ev&&Library.inProgramme(f,this.data.pf,ctx)),ys=[...new Set(yb.map(f=>f.y).filter(Boolean))].sort((a,b)=>b-a);
    const decades=(Library.DECADES||[]).map(([id,name])=>({id,name:t(name),n:yb.filter(f=>Library.yearMatches(f,id)).length,selected:sl(this.data.year).includes(id)})).filter(x=>x.n).map(x=>({id:x.id,name:x.name,sub:t(x.n+' 部影片'),selected:x.selected}));
    const rows=type==='region'?[{id:'all',name:t('全部地区'),sub:t(yb.length+' 部影片'),selected:!sl(this.data.reg).length},...Object.keys(data.reg).map(k=>({id:k,name:t(data.reg[k].n),n:yb.filter(f=>f.reg===k).length,selected:sl(this.data.reg).includes(k)})).filter(x=>x.n).map(x=>Object.assign(x,{sub:t(x.n+' 部影片')}))]:type==='length'?[{id:'all',name:t('全部片长'),sub:t(yb.length+' 部影片'),selected:!sl(this.data.len).length},...LEN_BINS.map(([k,n])=>({id:k,name:t(n),sub:t(yb.filter(f=>lenOk(f,k)).length+' 部影片'),selected:sl(this.data.len).includes(k)}))]:type==='year'?[{id:'all',name:t('全部年份'),sub:t(yb.length+' 部影片'),selected:!sl(this.data.year).length},...decades,...ys.map(y=>({id:String(y),name:String(y),sub:t(yb.filter(f=>String(f.y)===String(y)).length+' 部影片'),selected:sl(this.data.year).includes(String(y))}))]:type==='city'?[{id:'all',name:t('全部城市'),sub:t('按已收录场次所在城市筛选'),selected:!sl(this.data.city).length},...[...new Set(data.venues.map(v=>v.city).filter(Boolean))].map(c=>({id:c,name:t(c),sub:t(data.films.filter(f=>!f.ev&&Library.inProgramme(f,this.data.pf,ctx)&&Library.inCity(f,c,ctx)).length+' 部影片'),selected:sl(this.data.city).includes(c)}))]:type==='programme'?[{id:'all',name:t('全部专题'),sub:t('浏览完整片目'),selected:!sl(this.data.pf).length},...data.programmes.map(p=>({id:p.id,name:p.name,sub:t(data.films.filter(f=>!f.ev&&Library.inProgramme(f,p.id,ctx)).length+' 部影片')+' · '+t(p.city||''),selected:sl(this.data.pf).includes(p.id)}))]:MODES.map(([id,name,sub])=>({id,name:t(name),sub:t(sub)+' · '+t(data.films.filter(f=>!f.ev&&Library.inProgramme(f,this.data.pf,ctx)&&Library.category(f,id,ctx)).length+' 部影片'),selected:id==='all'?!sl(this.data.mine).length:sl(this.data.mine).includes(id)}));
    return rows.filter(x=>!q||(x.name+' '+x.sub).toLocaleLowerCase().includes(q));
  },
  openSelector(e) {const type=e.currentTarget.dataset.type;this.setData({selectorType:type,selectorQuery:'',selectorTitle:t(type==='programme'?'选择专题':type==='region'?'选择地区':type==='length'?'选择片长':type==='year'?'选择年份':type==='city'?'选择城市':'我的影片'),selectorPlaceholder:t(type==='programme'?'搜索专题':type==='region'?'搜索地区':type==='length'?'搜索片长':type==='year'?'搜索年份':type==='city'?'搜索城市':'搜索我的分类'),selectorRows:this.filterOptions(type,'')});},
  searchSelector(e) {this.setData({selectorQuery:e.detail.value,selectorRows:this.filterOptions(this.data.selectorType,e.detail.value)});},
  chooseFilter(e) {
    const ty = this.data.selectorType, v = e.currentTarget.dataset.id, key = ty === 'programme' ? 'pf' : ty === 'region' ? 'reg' : ty === 'length' ? 'len' : ty === 'year' ? 'year' : ty === 'city' ? 'city' : 'mine';
    this.setData(Object.assign({ [key]: v === 'all' ? 'all' : Library.toggle(this.data[key], v) }, ty === 'programme' ? { year: 'all' } : {}));
    this.build(); this.setData({ selectorRows: this.filterOptions(ty, this.data.selectorQuery) });
  },
  closeSelector() {this.setData({selectorType:'',selectorQuery:''});},
  stopMove() {},
  toggleSec(e) { const id = e.currentTarget.dataset.id, i = this.data.secs.findIndex(s => s.id === id); if (i < 0) return; const open = !this.data.secs[i].open; this.folds[id] = open ? 1 : 0; try { wx.setStorageSync(FOLD_KEY, this.folds); } catch (er) { } const R = this._rows || { live: {}, gone: {} }, o = { ['secs[' + i + '].open']: open }; if (open) { o['secs[' + i + '].live'] = R.live[id] || []; if (this.data.secs[i].goneOpen) o['secs[' + i + '].gone'] = R.gone[id] || []; } this.setData(o); },
  toggleGone(e) { const id = e.currentTarget.dataset.id, i = this.data.secs.findIndex(s => s.id === id); if (i < 0) return; const v = !this.data.secs[i].goneOpen; this.goneOpen[id] = v; const o = { ['secs[' + i + '].goneOpen']: v }; if (v) o['secs[' + i + '].gone'] = ((this._rows || {}).gone || {})[id] || []; this.setData(o); },
  togglePast(e) { const id = e.currentTarget.dataset.id, i = this.data.past.findIndex(s => s.id === id); if (i < 0) return; const v = !this.data.past[i].open; this.pastOpen[id] = v; const o = { ['past[' + i + '].open']: v }; if (v) o['past[' + i + '].rows'] = ((this._rows || {}).past || {})[id] || []; this.setData(o); },
  setProg(e) { this.setData({ pf: e.currentTarget.dataset.k }); this.build(); },
  open(e) { wx.navigateTo({ url: '/pages/film/film?id=' + e.currentTarget.dataset.id }); },
  onShareAppMessage() { return { title: t('片目 · 麻雀观影护照'), path: '/pages/films/films' }; }
});
