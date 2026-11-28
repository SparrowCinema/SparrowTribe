const T = require('../../../utils/tickets.js');
const U = require('../../../utils/util.js');
const I = require('../../../utils/i18n.js');
const Trace = require('../utils/autograph-trace.js');
const t = I.tr;
const app = getApp();
const PIN_KEY = 'sk-host-key';

function agDraw(ctx, strokes, w, h, ink) {
  ctx.clearRect(0, 0, w, h);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = ink || '#1d1712';
  ctx.lineWidth = Math.max(1.5, w / 150);
  for (const st of strokes) {
    if (!st || st.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(st[0] * w / 1000, st[1] * h / 500);
    if (st.length < 4) ctx.lineTo(st[0] * w / 1000 + 0.1, st[1] * h / 500);
    for (let i = 2; i < st.length - 2; i += 2) {
      const mx = (st[i] + st[i + 2]) / 2, my = (st[i + 1] + st[i + 3]) / 2;
      ctx.quadraticCurveTo(st[i] * w / 1000, st[i + 1] * h / 500, mx * w / 1000, my * h / 500);
    }
    if (st.length >= 4) ctx.lineTo(st[st.length - 2] * w / 1000, st[st.length - 1] * h / 500);
    ctx.stroke();
  }
}

Page({
  data: {
    i: {},
    pin: '',
    hidePin: false,
    showAll: false,
    labels: [],
    pickIdx: -1,
    cur: null,
    qr: '',
    count: 0,
    loading: false,
    err: '',
    full: false,
    env: 'release',
    updated: '',
    // 映后嘉宾签名（与网页版 #checkin-host 共用 tk_autograph）
    agReady: false,
    agLoading: false,
    agErr: '',
    agList: [],
    agFree: 0,
    agName: '',
    agRole: '',
    agHasInk: false,
    agHasPhoto: false,
    agShade: 0,
    agSaving: false
  },
  onLoad() {
    let pin = '', env = 'release';
    try { pin = wx.getStorageSync(PIN_KEY) || ''; } catch (e) {}
    try { env = wx.getAccountInfoSync().miniProgram.envVersion || 'release'; } catch (e) {}
    this.setData({ i: I.dict(), pin, env });
    wx.setNavigationBarTitle({ title: t('现场签到 · 主办方') });
    this._active = true;
    this._seq = 0;
    this._agSeq = 0;
    this._agShown = '';
    this._agStrokes = [];
    this._agCur = null;
    this._agPoints = 0;
    this._agPhoto = null;
    this._pad = null;
    this._padRect = null;
    this._work = null;
    this._tmpFile = '';
    this._lastScene = '';
    this._shows = [];
    this._userScope = false;
    this.offData = app.onData(() => this.buildShows());
    this.buildShows();
  },
  onShow() {
    this._active = true;
    try { wx.setKeepScreenOn({ keepScreenOn: true }); } catch (e) {}
    this.startTimer();
    if (this.data.cur && this.data.pin) this.refresh(false);
  },
  onHide() {
    this._active = false;
    this.stopTimer();
    try { wx.setKeepScreenOn({ keepScreenOn: false }); } catch (e) {}
  },
  onUnload() {
    this._active = false;
    this.stopTimer();
    if (this._agShadeTimer) clearTimeout(this._agShadeTimer);
    if (this.offData) this.offData();
    this.cleanTmp();
    try { wx.setKeepScreenOn({ keepScreenOn: false }); } catch (e) {}
  },
  cleanTmp() {
    if (!this._tmpFile) return;
    const p = this._tmpFile;
    this._tmpFile = '';
    try { wx.getFileSystemManager().unlinkSync(p); } catch (e) {}
  },
  startTimer() {
    this.stopTimer();
    this._timer = setInterval(() => {
      if (this._active && this.data.cur && this.data.pin) this.refresh(false);
    }, 60000);
  },
  stopTimer() {
    if (this._timer) { clearInterval(this._timer); this._timer = 0; }
  },
  showMeta(s, idx) {
    const f = idx.F[s.id] || {};
    const venue = idx.venueName(s), hall = idx.hallName(s);
    const place = [venue, hall].filter(Boolean).join(' · ');
    const time = [U.ymd(s), U.wk(s.d, s.year), s.t].filter(Boolean).join(' ');
    const shortLine = [s.d + ' ' + s.t, f.cn || s.id, venue, hall].filter(Boolean).join(' · ');
    return {
      sid: s.sid || '',
      filmId: s.id,
      showKey: U.keyOf(s),
      cn: f.cn || s.id,
      version: f.version ? t(f.version) : '',
      time,
      place,
      shortLine
    };
  },
  buildShows() {
    const data = app.globalData.data || {}, idx = U.index(data), now = Date.now();
    const prevSid = this.data.cur && this.data.cur.sid;
    const upcoming = (data.shows || []).filter(s => {
      if (!idx.F[s.id] || !s.sid) return false;
      return U.showDate(s, idx).getTime() > now - 4 * 36e5;
    }).sort((a, b) => U.showDate(a, idx) - U.showDate(b, idx));
    const near = upcoming.filter(s => U.showDate(s, idx).getTime() < now + 14 * 36e5);
    let showAll = this.data.showAll;
    if (!this._userScope && !showAll && !near.length && upcoming.length) showAll = true;
    const list = showAll ? upcoming : near;
    const metas = list.map(s => this.showMeta(s, idx));
    this._shows = metas;
    let pickIdx = prevSid ? metas.findIndex(x => x.sid === prevSid) : -1;
    if (pickIdx < 0 && metas.length === 1) pickIdx = 0;
    const cur = pickIdx >= 0 ? metas[pickIdx] : null;
    this.setData({ showAll, labels: metas.map(x => x.shortLine), pickIdx, cur });
    if (cur && this.data.pin && (!this.data.qr || cur.sid !== prevSid)) this.refresh(false);
  },
  toggleShowAll() {
    this._userScope = true;
    this.setData({ showAll: !this.data.showAll });
    this.buildShows();
  },
  onPinInput(e) {
    this.setData({ pin: e.detail.value || '' });
  },
  onPinCommit() {
    const pin = (this.data.pin || '').trim();
    this.setData({ pin });
    try { wx.setStorageSync(PIN_KEY, pin); } catch (e) {}
    if (pin && this.data.cur) this.refresh(true);
  },
  pastePin() {
    wx.getClipboardData({
      success: res => {
        const pin = String((res && res.data) || '').trim();
        if (!pin) { wx.showToast({ title: t('剪贴板为空'), icon: 'none' }); return; }
        this.setData({ pin });
        try { wx.setStorageSync(PIN_KEY, pin); } catch (e) {}
        wx.showToast({ title: t('已粘贴主办密钥'), icon: 'none' });
        if (this.data.cur) this.refresh(true);
      }
    });
  },
  toggleHidePin() {
    this.setData({ hidePin: !this.data.hidePin });
  },
  clearPin() {
    this.cleanTmp();
    this._lastScene = '';
    this._agShown = '';
    this._agStrokes = [];
    this._agCur = null;
    this._agPoints = 0;
    this._agPhoto = null;
    try { wx.removeStorageSync(PIN_KEY); } catch (e) {}
    this.setData({
      pin: '', qr: '', err: '', count: 0, full: false,
      agReady: false, agLoading: false, agErr: '', agList: [], agFree: 0,
      agName: '', agRole: '', agHasInk: false, agHasPhoto: false, agShade: 0
    });
  },
  pickShow(e) {
    const pickIdx = Number(e.detail.value);
    const cur = this._shows[pickIdx] || null;
    this._lastScene = '';
    this._agShown = '';
    this._agStrokes = [];
    this._agCur = null;
    this._agPoints = 0;
    this._agPhoto = null;
    this.setData({
      pickIdx, cur, qr: '', err: '', count: 0,
      agReady: false, agErr: '', agList: [], agFree: 0,
      agName: '', agRole: '', agHasInk: false, agHasPhoto: false, agShade: 0
    });
    if (cur && this.data.pin) this.refresh(true);
  },
  tapRefresh() {
    this.refresh(true);
  },
  toggleFull() {
    if (!this.data.qr) return;
    const next = !this.data.full;
    this.setData({ full: next }, () => {
      if (!next && this.data.agReady && this.data.agFree >= 0) this.initAgPad();
    });
  },
  async refresh(forceCode) {
    const cur = this.data.cur, pin = (this.data.pin || '').trim();
    if (!cur || !pin) return;
    try { wx.setStorageSync(PIN_KEY, pin); } catch (e) {}
    const seq = ++this._seq;
    if (forceCode || !this.data.qr) this.setData({ loading: true, err: '' });
    let codeRes = null;
    try {
      const r = await wx.cloud.callFunction({
        name: 'psync',
        data: { action: 'checkinCode', pin, f: cur.filmId, h: cur.sid || cur.showKey }
      });
      codeRes = r && r.result;
    } catch (e) { codeRes = null; }
    if (seq !== this._seq || !this._active) return;
    if (!codeRes || !codeRes.ok || !codeRes.k) {
      const reason = codeRes && codeRes.reason;
      this.setData({
        loading: false,
        err: reason === 'bad'
          ? t('主办密钥不对，或该场次未启用签到')
          : t('无法连接签到服务，请检查网络或确认 psync 云函数已部署')
      });
      return;
    }
    this.loadAutographs(false);
    const scene = T.checkinScene(cur.sid, codeRes.w, codeRes.k);
    if (!scene) {
      this.setData({ loading: false, err: t('场次编号无法生成小程序码') });
      return;
    }
    const nowD = new Date();
    const updated = String(nowD.getHours()).padStart(2, '0') + ':' + String(nowD.getMinutes()).padStart(2, '0') + ':' + String(nowD.getSeconds()).padStart(2, '0');
    if (!forceCode && scene === this._lastScene && this.data.qr) {
      this.setData({ loading: false, count: codeRes.n || 0, err: '', updated });
      return;
    }
    let wxRes = null;
    try {
      const r2 = await wx.cloud.callFunction({
        name: 'wxacode',
        data: { page: 'pages/checkin/checkin', scene, env: this.data.env, ephemeral: true }
      });
      wxRes = r2 && r2.result;
    } catch (e) { wxRes = null; }
    if (seq !== this._seq || !this._active) return;
    if (!wxRes || !wxRes.ok || (!wxRes.base64 && !wxRes.dataUrl)) {
      this.setData({
        loading: false,
        count: codeRes.n || 0,
        err: t('小程序码生成失败，请确认 wxacode 云函数已重新部署')
      });
      return;
    }
    let qrSrc = wxRes.dataUrl || '';
    if (wxRes.base64 && wx.env && wx.env.USER_DATA_PATH && wx.getFileSystemManager) {
      try {
        const nextFile = wx.env.USER_DATA_PATH + '/checkin-qr-' + seq + '.png';
        wx.getFileSystemManager().writeFileSync(nextFile, wxRes.base64, 'base64');
        this.cleanTmp();
        this._tmpFile = nextFile;
        qrSrc = nextFile;
      } catch (e) { /* 退回 dataUrl */ }
    }
    this._lastScene = scene;
    this.setData({ loading: false, qr: qrSrc, count: codeRes.n || 0, err: '', updated });
  },

  // ——— 映后嘉宾签名（与网页版 #checkin-host 共用 tk_autograph_list / tk_autograph_put） ———
  queryCanvas(id) {
    return new Promise(resolve => {
      if (!wx.createSelectorQuery) { resolve(null); return; }
      const q = wx.createSelectorQuery();
      const scope = q.in ? q.in(this) : q;
      scope.select(id).fields({ node: true, size: true, rect: true }).exec(res => {
        const hit = res && res[0];
        resolve(hit && hit.node ? hit : null);
      });
    });
  },
  async getWorkCanvas() {
    if (this._work && this._work.node) return this._work;
    const hit = await this.queryCanvas('#ch-ag-work');
    if (hit && hit.node) {
      this._work = { node: hit.node, ctx: hit.node.getContext('2d') };
      return this._work;
    }
    return null;
  },
  async renderAgPreview(strokes) {
    if (!Array.isArray(strokes) || !strokes.length) return '';
    try {
      const work = await this.getWorkCanvas();
      if (!work) return '';
      work.node.width = 300;
      work.node.height = 150;
      agDraw(work.ctx, strokes, 300, 150, '#1d1712');
      return typeof work.node.toDataURL === 'function' ? work.node.toDataURL('image/png') : '';
    } catch (e) { return ''; }
  },
  async applyAgList(raw) {
    const items = Array.isArray(raw) ? raw : [];
    const used = new Set(items.map(g => Number(g.i)));
    const free = [0, 1, 2, 3].find(i => !used.has(i));
    const agFree = free === undefined ? -1 : free;
    const agList = [];
    for (const g of items) {
      const img = await this.renderAgPreview(g.st);
      agList.push({
        i: Number(g.i),
        name: g.name || '',
        role: g.role || '',
        label: (g.role ? g.role + ' ' : '') + (g.name || ''),
        img
      });
    }
    if (!this._active) return;
    this.setData({ agReady: true, agLoading: false, agErr: '', agList, agFree }, () => {
      if (!this.data.full && agFree >= 0) this.initAgPad();
    });
  },
  async loadAutographs(force) {
    const cur = this.data.cur, pin = (this.data.pin || '').trim();
    if (!cur || !pin) return;
    const key = pin + '|' + cur.filmId + '|' + (cur.sid || cur.showKey);
    if (!force && key === this._agShown && this.data.agReady) return;
    const seq = ++this._agSeq;
    this.setData({ agLoading: true, agErr: '' });
    let res = null;
    try {
      const r = await wx.cloud.callFunction({
        name: 'psync',
        data: { action: 'autographList', pin, f: cur.filmId, h: cur.sid || cur.showKey }
      });
      res = r && r.result;
    } catch (e) { res = null; }
    if (seq !== this._agSeq || !this._active) return;
    if (!res || !res.ok || !Array.isArray(res.items)) {
      const outdated = !!(res && (res.msg === 'unknown action' || res.msg === 'bad action'));
      this.setData({
        agLoading: false,
        agReady: false,
        agErr: outdated
          ? t('请重新部署 psync 云函数以在小程序使用主创签名')
          : (res && res.reason === 'bad'
            ? t('主办密钥不对，无法读取主创签名')
            : t('主创签名服务暂时不可用，请稍后重试'))
      });
      return;
    }
    this._agShown = key;
    await this.applyAgList(res.items);
  },
  retryAutographs() {
    this.loadAutographs(true);
  },
  async initAgPad() {
    const hit = await this.queryCanvas('#ch-ag-pad');
    if (!hit || !hit.node || !this._active) return;
    let dpr = 2;
    try { dpr = Math.min(3, wx.getSystemInfoSync().pixelRatio || 2); } catch (e) {}
    const w = Math.max(200, Math.round(hit.width || 300));
    const h = Math.max(100, Math.round(hit.height || Math.round(w / 2)));
    hit.node.width = Math.round(w * dpr);
    hit.node.height = Math.round(h * dpr);
    const ctx = hit.node.getContext('2d');
    if (ctx.setTransform) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    else ctx.scale(dpr, dpr);
    this._pad = { node: hit.node, ctx, w, h, dpr };
    this._padRect = { left: hit.left || 0, top: hit.top || 0, width: w, height: h };
    this.redrawAgPad();
  },
  redrawAgPad() {
    const list = this._agCur ? this._agStrokes.concat([this._agCur]) : this._agStrokes;
    const has = list.length > 0;
    if (this._pad && this._pad.ctx) agDraw(this._pad.ctx, list, this._pad.w, this._pad.h, '#1d1712');
    if (has !== this.data.agHasInk) this.setData({ agHasInk: has });
  },
  agPoint(e) {
    const touch = (e && e.touches && e.touches[0]) || (e && e.changedTouches && e.changedTouches[0]);
    if (!touch) return null;
    const w = (this._pad && this._pad.w) || 300;
    const h = (this._pad && this._pad.h) || 150;
    let x = touch.x, y = touch.y;
    if (typeof x !== 'number' || typeof y !== 'number') {
      const r = this._padRect || { left: 0, top: 0, width: w, height: h };
      x = (touch.clientX || 0) - r.left;
      y = (touch.clientY || 0) - r.top;
    }
    return [
      Math.max(0, Math.min(1000, Math.round(x / w * 1000))),
      Math.max(0, Math.min(500, Math.round(y / h * 500)))
    ];
  },
  agStart(e) {
    if (this._agStrokes.length >= 80 || this._agPoints >= 4000) return;
    const p = this.agPoint(e);
    if (!p) return;
    this._agCur = [p[0], p[1]];
    this._agPoints++;
    this.redrawAgPad();
  },
  agMove(e) {
    if (!this._agCur || this._agPoints >= 4000) return;
    const p = this.agPoint(e);
    if (!p) return;
    const lx = this._agCur[this._agCur.length - 2], ly = this._agCur[this._agCur.length - 1];
    if (Math.hypot(p[0] - lx, p[1] - ly) < 4) return;
    this._agCur.push(p[0], p[1]);
    this._agPoints++;
    this.redrawAgPad();
  },
  agEnd() {
    if (!this._agCur) return;
    this._agStrokes.push(this._agCur);
    this._agCur = null;
    this.redrawAgPad();
  },
  agUndo() {
    if (!this._agStrokes.length) return;
    const last = this._agStrokes.pop();
    this._agPoints = Math.max(0, this._agPoints - Math.floor((last ? last.length : 0) / 2));
    this.redrawAgPad();
  },
  agClear() {
    this._agStrokes = [];
    this._agCur = null;
    this._agPoints = 0;
    this._agPhoto = null;
    this.setData({ agHasPhoto: false, agShade: 0, agHasInk: false });
    this.redrawAgPad();
  },
  onAgName(e) {
    this.setData({ agName: e.detail.value || '' });
  },
  onAgRole(e) {
    this.setData({ agRole: e.detail.value || '' });
  },
  agRetrace(shift) {
    if (!this._agPhoto) return;
    const r = Trace.trace(this._agPhoto, Number(shift) || 0);
    if (!r.strokes.length) {
      this._agStrokes = [];
      this._agPoints = 0;
      this._agCur = null;
      this.redrawAgPad();
      wx.showToast({
        title: t(r.reason === 'toolarge' ? '签名太复杂，请换一张只有签名的照片' : '没有识别到签名，请拖动「深浅」或换一张白纸黑字的照片'),
        icon: 'none'
      });
      return;
    }
    this._agStrokes = r.strokes;
    this._agPoints = r.points;
    this._agCur = null;
    this.redrawAgPad();
  },
  agShadeChange(e) {
    const val = Number(e.detail.value) || 0;
    this.setData({ agShade: val });
    if (this._agShadeTimer) clearTimeout(this._agShadeTimer);
    this._agShadeTimer = setTimeout(() => this.agRetrace(val), 100);
  },
  agPickPhoto() {
    const onFile = filePath => { if (filePath) this.agLoadPhoto(filePath); };
    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
        success: res => {
          const f = res && res.tempFiles && res.tempFiles[0];
          onFile(f && f.tempFilePath);
        }
      });
    } else if (wx.chooseImage) {
      wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: res => onFile(res && res.tempFilePaths && res.tempFilePaths[0])
      });
    }
  },
  async agLoadPhoto(filePath) {
    const work = await this.getWorkCanvas();
    if (!work || !work.node.createImage) {
      wx.showToast({ title: t('无法读取这张图片'), icon: 'none' });
      return;
    }
    const img = work.node.createImage();
    img.onload = () => {
      try {
        const iw = img.width || 1, ih = img.height || 1;
        const k = Math.min(1, 1000 / Math.max(iw, ih));
        const w = Math.max(1, Math.round(iw * k)), h = Math.max(1, Math.round(ih * k));
        work.node.width = w;
        work.node.height = h;
        work.ctx.fillStyle = '#ffffff';
        work.ctx.fillRect(0, 0, w, h);
        work.ctx.drawImage(img, 0, 0, w, h);
        this._agPhoto = work.ctx.getImageData(0, 0, w, h);
        this.setData({ agHasPhoto: true, agShade: 0 });
        this.agRetrace(0);
      } catch (e) {
        wx.showToast({ title: t('无法读取这张图片'), icon: 'none' });
      }
    };
    img.onerror = () => wx.showToast({ title: t('无法读取这张图片'), icon: 'none' });
    img.src = filePath;
  },
  async agSave() {
    if (this.data.agSaving) return;
    const cur = this.data.cur, pin = (this.data.pin || '').trim();
    const nm = (this.data.agName || '').trim(), rl = (this.data.agRole || '').trim();
    if (!cur || !pin || this.data.agFree < 0) return;
    if (!nm) { wx.showToast({ title: t('请填写嘉宾姓名'), icon: 'none' }); return; }
    if (!this._agStrokes.length) { wx.showToast({ title: t('还没有签名'), icon: 'none' }); return; }
    this.setData({ agSaving: true });
    let res = null;
    try {
      const r = await wx.cloud.callFunction({
        name: 'psync',
        data: { action: 'autographPut', pin, f: cur.filmId, h: cur.sid || cur.showKey, i: this.data.agFree, nm, rl, st: this._agStrokes }
      });
      res = r && r.result;
    } catch (e) { res = null; }
    if (!this._active) return;
    this.setData({ agSaving: false });
    if (!res || !res.ok || !Array.isArray(res.items)) {
      wx.showToast({ title: t('保存失败，请检查主办密钥或网络'), icon: 'none' });
      return;
    }
    this._agStrokes = [];
    this._agCur = null;
    this._agPoints = 0;
    this._agPhoto = null;
    this.setData({ agName: '', agRole: '', agHasInk: false, agHasPhoto: false, agShade: 0 });
    wx.showToast({ title: t('签名已保存'), icon: 'none' });
    await this.applyAgList(res.items);
  },
  agDelete(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const cur = this.data.cur, pin = (this.data.pin || '').trim();
    if (!cur || !pin || !Number.isInteger(idx)) return;
    wx.showModal({
      title: t('删除签名'),
      content: t('删除这位嘉宾的签名？'),
      confirmText: t('删除'),
      cancelText: t('取消'),
      success: async m => {
        if (!m.confirm) return;
        let res = null;
        try {
          const r = await wx.cloud.callFunction({
            name: 'psync',
            data: { action: 'autographPut', pin, f: cur.filmId, h: cur.sid || cur.showKey, i: idx, nm: null, rl: null, st: null }
          });
          res = r && r.result;
        } catch (err) { res = null; }
        if (!this._active) return;
        if (!res || !res.ok || !Array.isArray(res.items)) {
          wx.showToast({ title: t('删除失败，请检查网络'), icon: 'none' });
          return;
        }
        await this.applyAgList(res.items);
      }
    });
  }
});
