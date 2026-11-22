// 票根收藏册存储（与网站 js/tickets.js 的存储部分一致）：本机 sk-tickets-v2 只存用户改过的字段，
// 票面由观影记录（watched.js）与片库推出；随个人档案云端同步（psync 的 tix 字段）与完整备份保存。
// 第一次读取时把旧版整条记录 sk-tickets-v1 迁移过来（旧键保留不删）。
const T = require('./tickets.js');
const W = require('./watched.js');
const G = require('./growth.js');
const U = require('./util.js');
const KEY = 'sk-tickets-v2', OLD = 'sk-tickets-v1';
let cache = null, rev = 0;
const listeners = [];
const iso = d => [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');

const SITE = 'https://sparrowcinema.github.io/SparrowTribe/';
const absolute = src => /^(posters|images)\//i.test(src) ? SITE + src : src;
function artOf(f) { return [...new Set([f.poster, U.poster(f), ...(Array.isArray(f.stills) ? f.stills.map(s => typeof s === 'string' ? s : s && s.url) : [])].filter(s => typeof s === 'string' && s).map(absolute))]; }
// 票面基础字段：有场次时取场次的影院、影厅、专题，否则只用影片资料
function baseFor(data, idx) {
  return (filmId, view, date) => {
    const f = idx.F[filmId]; if (!f || f.ev) return null;
    const s = view ? W.showOf(view, data) : null;
    const p = s ? U.progForShow(s, idx) : idx.progOf(f), v = s && idx.VN[s.v], fmt = view && view.f && G.FMT[view.f];
    return {
      filmId, title: f.cn, subtitle: f.o || f.en || '', showId: s ? (s.sid || U.keyOf(s)) : '',
      programmeId: (p && p.id) || '', programme: (p && p.name) || '', section: (p && p.sections && p.sections[f.id]) || (p && p.id === f.prog ? f.section : '') || '',
      date: s ? iso(U.showDate(s)) : date, time: (s && s.t) || '', city: (v && v.city) || '', venue: (v && v.name) || '', hall: s ? idx.hallName(s) : '',
      format: fmt ? fmt.zh : (f.version || ''), art: artOf(f)[0] || '', arts: artOf(f), director: f.dir || '',
      progKind: (p && p.kind) || '', progStart: (p && p.start) || '', progEnd: (p && p.end) || '', showTag: showTag(f, s, p, data, idx)
    };
  };
}
// 场次标签（与网站 js/tickets.js 的 ticketShowTag 一致）：映后场 / 产业放映场 / 本展首映场
function showTag(f, s, p, data, idx) {
  if (!s) return '';
  const note = (f.screeningNotes || {})[U.keyOf(s)] || '';
  if (/映后/.test(note)) return '映后场';
  if (/产业放映/.test(note)) return '产业放映场';
  if (p && p.kind === '影展专题') {
    const first = (data.shows || []).filter(x => x.id === f.id && U.progForShow(x, idx).id === p.id).sort((a, b) => U.showDate(a) - U.showDate(b))[0];
    if (first && U.keyOf(first) === U.keyOf(s)) return '本展首映场';
  }
  return '';
}
// 典藏玩法（2026-11-22）：只有片库完整时（往期专题补齐后，app.globalData.full）才判断封版与满贯，避免按不完整的片库算错
const fullData = () => { try { const g = getApp().globalData; return !!(g && g.full); } catch (e) { return false; } };
function closeOf(data, idx) {
  return filmId => {
    const f = idx.F[filmId]; if (!f || !fullData()) return 0;
    const ends = (data.shows || []).filter(s => s.id === filmId).map(s => U.showDate(s).getTime() + U.durationOf(s, idx) * 60000);
    const progs = idx.progsOf(f).map(({ p }) => ({ open: !!p.ongoing, end: p.end ? new Date(p.end.replace(/-/g, '/')).getTime() + 864e5 : 0 }));
    return T.editionClose(ends, progs);
  };
}
function setsOf(data, idx) {
  if (!fullData()) return null;
  const sets = {};
  Object.values(idx.F).forEach(f => {
    if (f.ev) return;
    idx.progsOf(f).forEach(({ p, sec }) => {
      if (!p || p.ongoing || p.kind !== '影展专题') return;
      const set = sets[p.id] || (sets[p.id] = { films: [], sections: {} });
      if (set.films.indexOf(f.id) < 0) set.films.push(f.id);
      if (sec) { const list = set.sections[sec] || (set.sections[sec] = []); if (list.indexOf(f.id) < 0) list.push(f.id); }
    });
  });
  return sets;
}
let ctx = null; // 最近一次 build 用的片库，领号时用来找场次编号与封版时间
const viewings = idx => T.viewings(W.all(), G.views, id => !!idx.F[id] && !idx.F[id].ev);

function all(data, idx) {
  if (cache) return cache;
  let raw = null; try { raw = wx.getStorageSync(KEY); } catch (e) { }
  if (raw) { cache = T.cleanStore(raw); return cache; }
  let old = []; try { old = T.read(wx.getStorageSync(OLD)); } catch (e) { }
  // 片库还没载入时也能迁移：票根键与观影记录的键一致，之后照样关联，只是多存了几个和推导值相同的字段
  const ok = data && idx;
  cache = old.length ? T.migrateV1(old, ok ? viewings(idx) : [], ok ? baseFor(data, idx) : () => null) : {};
  if (old.length) put(cache, true);
  return cache;
}
function put(store, quiet) {
  const clean = T.cleanStore(store);
  try { wx.setStorageSync(KEY, clean); } catch (e) { if (!quiet) wx.showToast({ title: '票根保存失败，请检查本机存储', icon: 'none' }); return false; }
  cache = clean; rev++; listeners.forEach(fn => fn()); issueSoon(); return true;
}
const set = (changes, data, idx) => put(Object.assign({}, all(data, idx), changes));
// 发行序号（2026-11-22）：还没领号的票根经 psync 云函数的 issue 动作向 Supabase tk_issue 领「本片第几张典藏」，每次最多 50 张，一轮最多 20 次。
// 云函数还没重新部署、后端还没执行 backend/tickets-issue-v1.sql 或离线时，本次启动内不再重试，票根照常显示「待发号」。
let issueTimer = 0, issueBusy = false, issueOff = false;
function issueSoon(ms) { if (issueOff || issueBusy || !wx.cloud) return; clearTimeout(issueTimer); issueTimer = setTimeout(issueRun, ms || 2000); }
async function issueRun() {
  if (issueOff || issueBusy || !wx.cloud) return;
  issueBusy = true;
  try {
    for (let round = 0; round < 20; round++) {
      const items = T.pendingIssue(all(), showOf); if (!items.length) break;
      const r = await wx.cloud.callFunction({ name: 'psync', data: { action: 'issue', items: items.map(x => x.h ? { s: x.s, f: x.f, h: x.h } : { s: x.s, f: x.f }) } });
      const res = (r && r.result) || {};
      if (!res.ok) { issueOff = true; break; }
      const changes = T.applyIssue(all(), items, res.items); if (!changes) break;
      put(Object.assign({}, all(), changes), true);
    }
  } catch (e) { issueOff = true; }
  finally { issueBusy = false; }
  editionRun();
}
function showOf(key) { const row = ctx && ctx.byKey && ctx.byKey.get(key); return (row && row.showId) || ''; }
// 封版总数：已封版影片的票根经 psync 云函数的 edition 动作向 tk_edition 取「共发行 N 张」；云函数或后端还没升级时本次启动内不再请求
let editionOff = false, editionBusy = false;
async function editionRun() {
  if (editionOff || editionBusy || !wx.cloud || !ctx) return;
  const items = T.pendingEdition(all(), closeOf(ctx.data, ctx.idx), Date.now()); if (!items.length) return;
  editionBusy = true;
  try {
    const r = await wx.cloud.callFunction({ name: 'psync', data: { action: 'edition', items } });
    const res = (r && r.result) || {};
    if (!res.ok) editionOff = true;
    else { const changes = T.applyEdition(all(), res.items); if (changes) put(Object.assign({}, all(), changes), true); }
  } catch (e) { editionOff = true; }
  finally { editionBusy = false; }
}
// 同步：快照与应用（没有片库时只读写已有存储，不做迁移）
function snapshot() { return JSON.parse(JSON.stringify(all())); }
function replaceAll(store) { const before = rev; put(store, true); return rev !== before; }
// 票根以外、但随票根一起同步的设置（手绘风格）改动后调用，通知云端同步
function nudge() { listeners.forEach(fn => fn()); }
function onChange(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; }
// 一部电影一张票根（和观影护照对齐）：不对应观影记录的票根先挪回所属影片，再推出收藏册
function build(data, idx) {
  const list = viewings(idx), moves = T.reconcile(list, all(data, idx));
  if (moves) put(Object.assign({}, all(), moves), true);
  const built = T.build(list, all(), baseFor(data, idx));
  T.decorate(built.tickets, setsOf(data, idx));
  ctx = { data, idx, byKey: new Map(built.tickets.map(r => [r.key, r])) };
  issueSoon(800);
  return built;
}
function freeKey(filmId, date, idx, except) {
  const store = all(), linked = new Set(viewings(idx).map(x => x.key));
  for (let n = 1; n < 10; n++) { const key = T.ticketKey(filmId, date, n); if (key === except || (!linked.has(key) && (!store[key] || store[key].del))) return key; }
  return '';
}
module.exports = { issueSoon, issueNow: () => issueRun(), all, put, set, snapshot, replaceAll, onChange, nudge, build, baseFor, viewings, freeKey, rev: () => rev };
