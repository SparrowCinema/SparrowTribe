// 纯私密个人笔记（本机 sk-notes-v1 + 可选独立口令 E2E 加密同步 sk-note-pass-v1）及备份健康状态
const Crypto = require('./notes-crypto.js');
const S = require('./psync.js');
const Eco = require('./ecosystem.js');

const KEY = 'sk-notes-v1';
const PASS_KEY = 'sk-note-pass-v1';
const META_KEY = 'sk-backup-meta-v1';

let cache = null, metaCache = null, rev = 0;
const listeners = [];
const emit = () => { rev++; listeners.forEach(fn => { try { fn(); } catch (e) { } }); };
const onChange = fn => { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; };

function all() {
  if (!cache) {
    try {
      const v = wx.getStorageSync(KEY);
      cache = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    } catch (e) { cache = {}; }
  }
  return cache;
}
function persist(silent) {
  try { wx.setStorageSync(KEY, all()); } catch (e) { }
  if (!silent) emit(); else rev++;
}
function meta() {
  if (!metaCache) {
    try {
      const v = wx.getStorageSync(META_KEY);
      metaCache = v && typeof v === 'object' ? v : {};
    } catch (e) { metaCache = {}; }
  }
  return metaCache;
}
function saveMeta() { try { wx.setStorageSync(META_KEY, meta()); } catch (e) { } }
function pass() { try { return String(wx.getStorageSync(PASS_KEY) || ''); } catch (e) { return ''; } }

function get(id) {
  const r = all()[id];
  if (!r || r.del) return null;
  if (typeof r.s === 'string' && r.s.trim()) {
    return { text: r.s, tb: r.tb === 1, rc: r.rc === 1, locked: false, encrypted: !!r.enc, t: r.t || 0 };
  }
  if (r.enc) {
    const p = pass();
    if (p) {
      try {
        const text = Crypto.decrypt(r.enc, p);
        return { text, tb: r.tb === 1, rc: r.rc === 1, locked: false, encrypted: true, t: r.t || 0 };
      } catch (e) { }
    }
    return { text: '', tb: r.tb === 1, rc: r.rc === 1, locked: true, encrypted: true, t: r.t || 0 };
  }
  return null;
}

function save(id, text, opts) {
  opts = opts || {};
  const map = all(), clean = String(text || '').trim().slice(0, 1000), t = Date.now();
  if (!clean) {
    map[id] = { del: 1, t };
    persist(false);
    return;
  }
  const entry = { t, s: clean };
  if (opts.tb) entry.tb = 1;
  if (opts.rc) entry.rc = 1;
  const p = pass();
  if (p && p.length >= 4) {
    try { entry.enc = Crypto.encrypt(clean, p); } catch (e) { }
  }
  map[id] = entry;
  persist(false);
}

function setPass(p) {
  p = String(p || '');
  if (!p) {
    try { wx.removeStorageSync(PASS_KEY); } catch (e) { }
    return { ok: true, cleared: true };
  }
  if (p.length < 4) return { ok: false, msg: '口令至少需要 4 位字符' };
  const next = JSON.parse(JSON.stringify(all()));
  let unlocked = 0, failed = 0, encrypted = 0;
  Object.keys(next).forEach(id => {
    const r = next[id]; if (!r || r.del) return;
    if (r.enc && !r.s) {
      try { r.s = Crypto.decrypt(r.enc, p); unlocked++; } catch (e) { failed++; }
    }
  });
  if (failed > 0 && unlocked === 0) return { ok: false, msg: '口令与云端已有加密笔记不匹配，请检查' };
  try { wx.setStorageSync(PASS_KEY, p); } catch (e) { return { ok: false, msg: '无法保存口令' }; }
  Object.keys(next).forEach(id => {
    const r = next[id]; if (!r || r.del || !r.s) return;
    r.enc = Crypto.encrypt(r.s, p);
    r.t = Math.max(r.t || 0, Date.now());
    encrypted++;
  });
  cache = next;
  persist(false);
  return { ok: true, unlocked, encrypted };
}

function forCloud() {
  const map = all(), out = {};
  Object.keys(map).forEach(id => {
    const r = map[id]; if (!r) return;
    if (r.del) { out[id] = { del: 1, t: r.t || 0 }; return; }
    // 绝不上传明文 s，只同步端到端加密密文 enc
    if (r.enc) {
      const o = { t: r.t || 0, enc: r.enc };
      if (r.tb === 1) o.tb = 1;
      if (r.rc === 1) o.rc = 1;
      out[id] = o;
    }
  });
  return out;
}

function mergeCloud(remote) {
  if (!remote || typeof remote !== 'object') return;
  const merged = S.mergeNotes(all(), remote), p = pass();
  Object.keys(merged).forEach(id => {
    const r = merged[id]; if (!r || r.del) return;
    if (r.enc && !r.s && p) {
      try { r.s = Crypto.decrypt(r.enc, p); } catch (e) { }
    }
  });
  cache = merged;
  persist(true);
}

function activeCount() {
  const map = all();
  return Object.keys(map).filter(id => map[id] && !map[id].del && (map[id].s || map[id].enc)).length;
}
function lockedCount() {
  return Object.keys(all()).filter(id => { const n = get(id); return n && n.locked; }).length;
}
function markCodeSaved(code) { if (!code) return; meta().codeSavedFor = code; saveMeta(); }
function markExported(watchedCount) {
  const m = meta();
  m.lastExportAt = Date.now();
  m.lastExportCount = (watchedCount || 0) + activeCount();
  saveMeta();
}
function health(syncCode, watchedCount) {
  const m = meta();
  return Eco.backupHealth({
    syncCode: syncCode || '',
    codeSaved: !!(syncCode && m.codeSavedFor === syncCode),
    watchedCount: watchedCount || 0,
    notesCount: activeCount(),
    lastExportAt: m.lastExportAt || 0,
    lastExportCount: m.lastExportCount || 0
  });
}

module.exports = {
  all, get, save, pass, setPass, forCloud, mergeCloud,
  activeCount, lockedCount, markCodeSaved, markExported, health,
  meta, onChange, rev: () => rev
};
