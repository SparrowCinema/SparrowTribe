const T = require('../../utils/totop.js');
const U = require('../../utils/util.js');
const I = require('../../utils/i18n.js');
const HT = require('../../utils/hometip.js');
const VB = require('../../utils/venue-board.js');
const plan = require('../../utils/plan.js');
const Remind = require('../../utils/remind.js');
const t = I.tr;
const app = getApp();

Page({
  data: {
    i: {},
    p: null,
    venueRows: [],
    venueN: 0,
    venueMap: null,
    activeId: '',
    canReset: false,
    transfers: [],
    panel: null,
    intoView: ''
  },
  onLoad(q) {
    this.setData({ i: I.dict() });
    HT.show(this);
    this.id = (q && q.id) || 'style-kaleidoscope';
    this.pick = { film: '', day: undefined };
    this.off = app.onData(() => this.build());
    this.off2 = plan.onChange(() => this.buildPanel());
    this.build();
  },
  onUnload() {
    clearTimeout(this._homeTipT);
    this.off && this.off();
    this.off2 && this.off2();
  },
  homeTipGo() { HT.home(); },
  homeTipClose() { HT.close(this); },
  // 地图固定在上方（页面不滚动，venues.json disableScroll），只有下面的影院列表（scroll-view）滚动
  onListScroll(e) { T.scroll(this, { scrollTop: e.detail.scrollTop }); },
  scrollInto(id) { this.setData({ intoView: '' }, () => this.setData({ intoView: id })); },
  toTop() { this.scrollInto('vn-head'); },
  makeMarkers(geoRows, activeId) {
    return geoRows.map((r, i) => {
      const hi = r.id === activeId;
      return {
        id: i + 1,
        latitude: r.geo.lat,
        longitude: r.geo.lng,
        title: r.short,
        callout: {
          content: r.idx + ' ' + r.short,
          display: 'ALWAYS',
          padding: 6,
          borderRadius: 6,
          fontSize: 11,
          bgColor: hi ? '#2f6f6c' : '#ffffff',
          color: hi ? '#fffaf0' : '#2b2117'
        }
      };
    });
  },
  build() {
    const data = app.globalData.data, idx = U.index(data);
    if (this.id && !idx.PG[this.id]) {
      const hit = Object.keys(idx.PG).find(k => k.startsWith(this.id));
      if (hit) this.id = hit;
    }
    const p = idx.PG[this.id];
    if (!p) return;
    this._p = p;
    wx.setNavigationBarTitle({ title: t('影院地图与交通') });

    const en = I.isEn();
    const shows = data.shows.filter(s => idx.F[s.id] && U.progForShow(s, idx).id === p.id);
    const vIds = [...new Set(shows.map(s => s.v))];
    const venueRows = data.venues.filter(v => vIds.includes(v.id)).map((v, i) => {
      const vs = shows.filter(s => s.v === v.id), up = vs.filter(s => !U.ended(s, idx));
      const hIds = [...new Set(vs.map(s => s.h))];
      const halls = (v.halls || []).filter(h => hIds.includes(h.id)).map(h => ({
        name: h.name,
        acc: !!((v.access && v.access.length) || (h.access && h.access.length))
      }));
      const trs = v.transit
        ? [['地铁', v.transit.metro], ['公交', v.transit.bus], ['停车', v.transit.parking], ['提示', v.transit.note]]
          .filter(x => x[1])
          .map(x => ({ k: t(x[0]), v: x[1] }))
        : [];
      const geo = U.geoOf(v);
      const filmN = new Set(up.filter(x => !idx.F[x.id].ev).map(x => x.id)).size; // 只数还有待映场次的影片
      const cntText = up.length ? [filmN ? t(filmN + ' 部') : '', t('待映 ' + up.length + ' 场')].filter(Boolean).join(' · ') : t('暂无待映场次');
      return {
        id: v.id,
        domIdx: i,
        idx: String(i + 1).padStart(2, '0'),
        name: v.name,
        short: v.short || v.name,
        label: (v.short || v.name).replace(new RegExp('^(' + [v.city, t(v.city || '')].filter(Boolean).join('|') + ')\\s*[·・]?\\s*'), ''),
        city: v.city || '',
        addr: [v.city ? t(v.city) : '', v.addr || ''].filter(Boolean).join(' · '),
        halls,
        total: vs.length,
        up: up.length,
        cntText,
        trs,
        geo
      };
    });

    const geoRows = venueRows.filter(r => r.geo);
    this._geoRows = geoRows;
    const lats = geoRows.map(r => r.geo.lat), lngs = geoRows.map(r => r.geo.lng);
    const box = geoRows.length ? { n: Math.max(...lats), s: Math.min(...lats), e: Math.max(...lngs), w: Math.min(...lngs) } : null;
    const padLat = box ? Math.max((box.n - box.s) * 0.2, 0.004) : 0;
    const padLng = box ? Math.max((box.e - box.w) * 0.2, 0.004) : 0;
    const fitPoints = geoRows.length > 1
      ? [{ latitude: box.n + padLat, longitude: box.w - padLng }, { latitude: box.s - padLat, longitude: box.e + padLng }]
      : [];
    if (this._pid !== p.id) { this._pid = p.id; this.pick = { film: '', day: undefined }; this.data.activeId = venueRows.length === 1 ? venueRows[0].id : ''; }
    const activeId = venueRows.some(r => r.id === this.data.activeId) ? this.data.activeId : '';
    const fit = geoRows.length ? {
      lat: (box.n + box.s) / 2,
      lng: (box.e + box.w) / 2,
      scale: geoRows.length > 1 ? 11 : 15,
      points: fitPoints
    } : null;
    this._fit = fit;

    const venueMap = fit ? {
      lat: fit.lat,
      lng: fit.lng,
      scale: fit.scale,
      points: fit.points.slice(),
      markers: this.makeMarkers(geoRows, activeId)
    } : null;

    // 跨影院转场参考（与网页一致：同城 2–6 家有坐标的影院）
    const transfers = [];
    if (geoRows.length >= 2 && geoRows.length <= 6) {
      for (let i = 0; i < geoRows.length; i++) {
        for (let j = i + 1; j < geoRows.length; j++) {
          const a = geoRows[i], b = geoRows[j];
          if (a.city !== b.city) continue;
          const road = U.distKm(a.geo, b.geo) * 1.35;
          if (!Number.isFinite(road)) continue;
          const km = Math.round(road * 10) / 10;
          const taxi = Math.max(8, Math.round(6 + road / 25 * 60));
          const metro = Math.max(15, Math.round(12 + road / 32 * 60));
          const min = road < 0.8 ? Math.max(3, Math.round(road / 4.5 * 60)) : Math.min(taxi, metro);
          const max = road < 0.8 ? Math.max(min + 2, Math.round(road / 3.5 * 60)) : Math.max(taxi, metro);
          transfers.push({
            key: a.id + '-' + b.id,
            a: a.short,
            b: b.short,
            text: en ? `${km.toFixed(1)} km · ~${min}–${max} min` : `${km.toFixed(1)} km · 约 ${min}–${max} 分钟`
          });
        }
      }
    }

    this.setData({
      p: { id: p.id, name: p.name },
      venueRows,
      venueN: venueRows.length,
      venueMap,
      activeId,
      canReset: geoRows.length > 1 || !!activeId,
      transfers
    });
    this._idx = idx; this._shows = shows;
    this.buildPanel();
  },
  // 选中 / 取消一家影院：地图移到它并高亮，卡片展开本院影片与排片（只显示即将放映和正在放映的；规则 utils/venue-board.js，与网站一致），列表滚到这张卡片
  select(id, o) {
    o = o || {};
    const row = (this.data.venueRows || []).find(r => r.id === id);
    const on = !!row && (o.force || this.data.activeId !== id);
    this.pick = { film: '', day: undefined };
    const up = { activeId: on ? id : '', canReset: true };
    if (this._geoRows && this.data.venueMap) up['venueMap.markers'] = this.makeMarkers(this._geoRows, on ? id : '');
    if (on && row.geo && o.zoom) Object.assign(up, { 'venueMap.lat': row.geo.lat, 'venueMap.lng': row.geo.lng, 'venueMap.scale': 15, 'venueMap.points': [] });
    this.setData(up, () => {
      this.buildPanel();
      if (!on) return;
      if (row.geo && !o.zoom && wx.createMapContext) { try { wx.createMapContext('vn-map', this).moveToLocation({ latitude: row.geo.lat, longitude: row.geo.lng }); } catch (e) { } }
      this.scrollInto('vc-' + row.domIdx);
    });
  },
  selectVenue(e) { this.select(e.currentTarget.dataset.id); },
  onMarkerTap(e) {
    const mid = (e.detail && e.detail.markerId) || e.markerId;
    const row = (this._geoRows || [])[mid - 1];
    if (row) this.select(row.id, { force: true });
  },
  focusVenue(e) { this.select(e.currentTarget.dataset.id, { force: true, zoom: true }); },
  buildPanel() {
    const id = this.data.activeId, idx = this._idx;
    if (!id || !idx) { if (this.data.panel) this.setData({ panel: null }); return; }
    const data = app.globalData.data, picked = plan.get(), en = I.isEn();
    const b = VB.board((this._shows || []).filter(s => s.v === id), { film: fid => idx.F[fid], start: s => U.showDate(s, idx).getTime(), past: s => U.ended(s, idx), pick: this.pick });
    const title = f => (!en && this._p && (this._p.filmTitles || {})[f.id]) || f.cn;
    const row = s => { const v = U.showView(s, idx, data, picked), f = idx.F[s.id]; v.cn = title(f); v.tags = [v.ev ? t('映后活动') : '', v.sub ? t('字幕机') : ''].filter(Boolean); return v; };
    const groups = gs => gs.map(g => ({ key: g.key, label: g.first.d + ' ' + U.wk(g.first.d, g.first.year), n: t(g.shows.length + ' 场'), rows: g.shows.map(row) }));
    const fsel = b.film ? idx.F[b.film] : null;
    this.setData({ panel: {
      id, empty: !b.upN,
      films: b.films.map(x => { const f = idx.F[x.id]; return { id: x.id, cn: title(f), poster: U.thumb(f), ph: (title(f) || '').slice(0, 1), sub: [t(f.version || ''), x.next.d + ' ' + x.next.t].filter(Boolean).join(' · '), on: b.film === x.id }; }),
      filmName: fsel ? (en ? '“' + title(fsel) + '”' : '《' + title(fsel) + '》') : '',
      days: b.days.length > 1 ? [{ key: '', label: t('全部日期'), n: t(b.days.reduce((n, d) => n + d.n, 0) + ' 场'), on: !b.day }].concat(b.days.map(d => ({ key: d.key, label: d.first.d + ' ' + U.wk(d.first.d, d.first.year), n: t(d.n + ' 场'), on: b.day === d.key }))) : [],
      up: groups(b.up)
    } });
  },
  pickFilm(e) { const id = e.currentTarget.dataset.id; this.pick = { film: this.pick.film === id ? '' : id, day: undefined }; this.buildPanel(); },
  pickDay(e) { this.pick.day = e.currentTarget.dataset.key; this.buildPanel(); },
  openFilm(e) { wx.navigateTo({ url: '/pages/film/film?id=' + e.currentTarget.dataset.id }); },
  toggle(e) {
    const key = e.currentTarget.dataset.key, on = plan.toggle(key);
    wx.showToast({ title: t(on ? '已加入排片' : '已移出排片'), icon: 'none' });
    if (on) { const s = (this._shows || []).find(x => U.keyOf(x) === key); if (s) Remind.ask({ kind: 'show', key, film: s.id }, true); }
  },
  resetMap() {
    if (!this._fit || !this._geoRows) return;
    const fit = this._fit;
    const pts = fit.points.map(pt => ({ latitude: pt.latitude, longitude: pt.longitude }));
    this.setData({
      canReset: this._geoRows.length > 1 || !!this.data.activeId,
      venueMap: {
        lat: fit.lat,
        lng: fit.lng,
        scale: fit.scale,
        points: pts,
        markers: this.makeMarkers(this._geoRows, this.data.activeId)
      }
    }, () => {
      if (pts.length && wx.createMapContext) {
        try {
          wx.createMapContext('vn-map', this).includePoints({ points: pts, padding: [24, 24, 24, 24] });
        } catch (e) { }
      }
    });
  },
  openVenueMap(e) {
    const id = e.currentTarget.dataset.id, data = app.globalData.data, v = data && U.index(data).VN[id];
    if (v) U.openMap(v);
  },
  onShareAppMessage() {
    const p = this.data.p || {};
    return {
      title: (p.name ? p.name + ' · ' : '') + t('影院地图与交通'),
      path: '/pages/venues/venues?id=' + this.id
    };
  }
});
