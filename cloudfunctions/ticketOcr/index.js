/* 微信云函数 ticketOcr：使用微信官方 ocr.printedText 识别纸质电影票或电子票截图文字（2026-11-24）。
   图片仅在内存中转给微信 OCR 接口，不落盘、不存档。识别失败时返回 { ok: false, reason }，前端平滑回退到手动填写。 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const MAX_BYTES = 2 * 1024 * 1024;

exports.main = async (event) => {
  try {
    const b64 = event && typeof event.imgBase64 === 'string' ? event.imgBase64.replace(/^data:image\/[a-z+]+;base64,/i, '') : '';
    if (!b64) return { ok: false, reason: 'no_image' };
    const buf = Buffer.from(b64, 'base64');
    if (!buf.length || buf.length > MAX_BYTES) return { ok: false, reason: 'too_large' };
    const contentType = event && /^image\/(jpeg|jpg|png|webp)$/i.test(event.contentType || '') ? event.contentType : 'image/jpeg';
    const res = await cloud.openapi.ocr.printedText({
      type: 'photo',
      img: { contentType, value: buf }
    });
    const items = (res && Array.isArray(res.items)) ? res.items : [];
    const lines = items.map(it => String((it && it.text) || '').trim()).filter(Boolean);
    return { ok: true, text: lines.join('\n'), lines };
  } catch (err) {
    return { ok: false, reason: (err && (err.errCode || err.message)) || 'ocr_failed' };
  }
};
