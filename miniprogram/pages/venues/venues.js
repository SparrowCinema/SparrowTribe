const T = require('../../utils/totop.js');
const U = require('../../utils/util.js');
const I = require('../../utils/i18n.js');
const HT = require('../../utils/hometip.js');
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
    transfers: []
  },
  onLoad(q) {
    this.setData({ i: I.dict() });
    HT.show(this);
    this.id = (q && q.id) || 'style-kaleidoscope';
    this.off = app.onData(() => this.build());
    this.build();
  },
  onUnload() {
    clearTimeout(this._homeTipT);
    this.off && this.off();
  },
  homeTipGo() { HT.home(); },
  homeTipClose() { HT.close(this); },
  onPageScroll(e) {
    this.scrollTop = e.scrollTop;
    T.scroll(this, e);
  },
  toTop() { T.go(); },
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
      const cntText = t(vs.length + ' 场') + (up.length ? ' · ' + t('待映') + ' ' + up.length : '');
      return {
        id: v.id,
        domIdx: i,
        idx: String(i + 1).padStart(2, '0'),
        name: v.name,
        short: v.short || v.name,
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
    const activeId = geoRows.some(r => r.id === this.data.activeId) ? this.data.activeId : '';
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
  },
  onMarkerTap(e) {
    const mid = (e.detail && e.detail.markerId) || e.markerId;
    const row = (this._geoRows || [])[mid - 1];
    if (!row) return;
    this.setData({
      activeId: row.id,
      canReset: true,
      'venueMap.markers': this.makeMarkers(this._geoRows, row.id)
    });
    wx.createSelectorQuery()
      .select('#vc-' + row.domIdx).boundingClientRect()
      .selectViewport().scrollOffset()
      .exec(res => {
        const rect = res && res[0], vp = res && res[1];
        if (!rect) return;
        const base = vp ? vp.scrollTop : (this.scrollTop || 0);
        wx.pageScrollTo({ scrollTop: Math.max(0, rect.top + base - 16), duration: 260 });
      });
  },
  focusVenue(e) {
    const id = e.currentTarget.dataset.id;
    const row = (this._geoRows || []).find(r => r.id === id);
    if (!row) return;
    this.setData({
      activeId: row.id,
      canReset: true,
      venueMap: {
        lat: row.geo.lat,
        lng: row.geo.lng,
        scale: 15,
        points: [],
        markers: this.makeMarkers(this._geoRows, row.id)
      }
    });
    wx.pageScrollTo({ scrollTop: 0, duration: 260 });
  },
  resetMap() {
    if (!this._fit || !this._geoRows) return;
    const fit = this._fit;
    const pts = fit.points.map(pt => ({ latitude: pt.latitude, longitude: pt.longitude }));
    this.setData({
      activeId: '',
      canReset: this._geoRows.length > 1,
      venueMap: {
        lat: fit.lat,
        lng: fit.lng,
        scale: fit.scale,
        points: pts,
        markers: this.makeMarkers(this._geoRows, '')
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
