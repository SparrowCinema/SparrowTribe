// 影片 / 专题分享海报用的「页面小程序码」：wxacode.getUnlimited 生成后存进云存储，同一页面只生成一次。
// 入参 { page: 'pages/film/film' | 'pages/programme/programme', scene: 影片或专题 id（≤32 字符）, env: 'release' | 'trial' | 'develop' }
// env 决定扫码打开哪个版本：正式版生成的码进正式版，体验版 / 开发版生成的码进对应版本（便于上线前测试）。
// 返回 { ok, fileID }；小程序用 wx.cloud.downloadFile 取临时文件画进海报。失败时小程序退回通用小程序码。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const PAGES = ['pages/film/film', 'pages/programme/programme'];
const VER = 'v2'; // 改码样式时升级，旧缓存自然失效
exports.main = async event => {
  try {
    const page = String(event.page || ''), scene = String(event.scene || '');
    if (!PAGES.includes(page) || !scene || scene.length > 32 || !/^[0-9A-Za-z!#$&'()*+,/:;=?@\-._~]+$/.test(scene)) return { ok: false, reason: 'invalid' };
    const env = ['release', 'trial', 'develop'].includes(event.env) ? event.env : 'release';
    const key = VER + '-' + env + '-' + page.split('/')[1] + '-' + scene.replace(/[^0-9A-Za-z\-._]/g, '_');
    const db = cloud.database(), col = db.collection('wxacode');
    try { const hit = await col.doc(key).get(); if (hit.data && hit.data.fileID) return { ok: true, fileID: hit.data.fileID, cached: true }; } catch (e) { /* 没有缓存 */ }
    const res = await cloud.openapi.wxacode.getUnlimited({ scene, page, envVersion: env, checkPath: false, width: 430, autoColor: false, lineColor: { r: 43, g: 33, b: 23 }, isHyaline: false });
    if (!res || !res.buffer) return { ok: false, reason: 'empty' };
    const up = await cloud.uploadFile({ cloudPath: 'wxacode/' + key + '.png', fileContent: res.buffer });
    try { await col.doc(key).set({ data: { fileID: up.fileID, page, scene, t: Date.now() } }); } catch (e) { /* 集合不存在时也能返回本次结果 */ }
    return { ok: true, fileID: up.fileID };
  } catch (e) { return { ok: false, reason: 'unavailable', msg: String(e && e.errMsg || e && e.message || e).slice(0, 200) }; }
};
