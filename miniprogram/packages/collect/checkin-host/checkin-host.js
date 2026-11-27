const T = require('../../../utils/tickets.js');
const U = require('../../../utils/util.js');
const I = require('../../../utils/i18n.js');
const t = I.tr;
const app = getApp();
const PIN_KEY = 'sk-host-key';

Page({
  data: {
    i: {},
    pin: '',
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
    updated: ''
  },
  onLoad() {
    let pin = '', env = 'release';
    try { pin = wx.getStorageSync(PIN_KEY) || ''; } catch (e) {}
    try { env = wx.getAccountInfoSync().miniProgram.envVersion || 'release'; } catch (e) {}
    this.setData({ i: I.dict(), pin, env });
    wx.setNavigationBarTitle({ title: t('现场签到 · 主办方') });
    this._seq = 0;
    this._tmpFile = '';
    this._lastScene = '';
    this._shows = [];
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
    const time = [U.showYmd(s), U.wk(s.d, s.year), s.t].filter(Boolean).join(' ');
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
    const list = (data.shows || []).filter(s => {
      if (!idx.F[s.id] || !s.sid) return false;
      const st = U.showDate(s, idx).getTime();
      if (this.data.showAll) return st > now - 4 * 36e5;
      return st > now - 4 * 36e5 && st < now + 14 * 36e5;
    }).sort((a, b) => U.showDate(a, idx) - U.showDate(b, idx));
    const metas = list.map(s => this.showMeta(s, idx));
    this._shows = metas;
    let pickIdx = prevSid ? metas.findIndex(x => x.sid === prevSid) : -1;
    if (pickIdx < 0 && metas.length === 1) pickIdx = 0;
    const cur = pickIdx >= 0 ? metas[pickIdx] : null;
    this.setData({ labels: metas.map(x => x.shortLine), pickIdx, cur });
    if (cur && this.data.pin && (!this.data.qr || cur.sid !== prevSid)) this.refresh(false);
  },
  toggleShowAll() {
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
  clearPin() {
    this.cleanTmp();
    this._lastScene = '';
    try { wx.removeStorageSync(PIN_KEY); } catch (e) {}
    this.setData({ pin: '', qr: '', err: '', count: 0, full: false });
  },
  pickShow(e) {
    const pickIdx = Number(e.detail.value);
    const cur = this._shows[pickIdx] || null;
    this._lastScene = '';
    this.setData({ pickIdx, cur, qr: '', err: '', count: 0 });
    if (cur && this.data.pin) this.refresh(true);
  },
  tapRefresh() {
    this.refresh(true);
  },
  toggleFull() {
    if (!this.data.qr) return;
    this.setData({ full: !this.data.full });
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
  }
});
