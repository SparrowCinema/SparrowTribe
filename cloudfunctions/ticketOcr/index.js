/* 微信云函数 ticketOcr：识别纸质电影票或电子票截图（2026-11-24；2026-11-25 新增 AI 识票增强）。
   - mode='wx'（默认）：使用微信官方 ocr.printedText
   - mode='ai'：经 Supabase Edge Function (ticket-ai) 调用 Google Gemini Vision，不可用或限流时自动回退到微信官方 ocr.printedText
   图片仅在内存中转，不落盘、不存档。识别失败时返回 { ok: false, reason }，前端平滑回退到手动填写。 */
const cloud = require('wx-server-sdk');
const https = require('https');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const MAX_BYTES = 2 * 1024 * 1024;
const SB_HOST = 'dclxhxxjktegyiwafmsv.supabase.co';
const SB_KEY = 'sb_publishable_2K9O3h8nn2I_I-cIAdks8A_QZ98xwZ2';

function callTicketAi(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      host: SB_HOST,
      path: '/functions/v1/smooth-processor', // Supabase Edge Function 显示名 ticket-ai
      method: 'POST',
      headers: {
        apikey: SB_KEY,
        Authorization: 'Bearer ' + SB_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        let j = null;
        try { j = JSON.parse(raw); } catch (e) {}
        resolve({ status: res.statusCode || 0, json: j });
      });
    });
    req.setTimeout(18000, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runWechatOcr(buf, contentType) {
  const res = await cloud.openapi.ocr.printedText({
    type: 'photo',
    img: { contentType, value: buf }
  });
  const items = (res && Array.isArray(res.items)) ? res.items : [];
  const lines = items.map(it => String((it && it.text) || '').trim()).filter(Boolean);
  return { text: lines.join('\n'), lines };
}

exports.main = async (event) => {
  try {
    const b64 = event && typeof event.imgBase64 === 'string'
      ? event.imgBase64.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '').replace(/\s+/g, '')
      : '';
    if (!b64) return { ok: false, reason: 'no_image' };
    const buf = Buffer.from(b64, 'base64');
    if (!buf.length || buf.length > MAX_BYTES) return { ok: false, reason: 'too_large' };
    const contentType = event && /^image\/(jpeg|jpg|png|webp)$/i.test(event.contentType || '')
      ? (String(event.contentType).toLowerCase() === 'image/jpg' ? 'image/jpeg' : String(event.contentType).toLowerCase())
      : 'image/jpeg';
    const mode = event && event.mode === 'ai' ? 'ai' : 'wx';

    let fallbackReason = '';
    if (mode === 'ai') {
      try {
        const hint = event && event.hint && typeof event.hint === 'object' ? {
          title: typeof event.hint.title === 'string' ? event.hint.title.slice(0, 80) : '',
          defaultYear: Number.isInteger(Number(event.hint.defaultYear)) ? Number(event.hint.defaultYear) : undefined
        } : undefined;
        const ai = await callTicketAi({ action: 'ticket_ocr', imageBase64: b64, contentType, hint });
        if (ai.status >= 200 && ai.status < 300 && ai.json && ai.json.ok && ai.json.fields) {
          return { ok: true, mode: 'ai', fields: ai.json.fields, text: ai.json.raw || '' };
        }
        fallbackReason = (ai.json && ai.json.reason) || (ai.status === 429 ? 'rate_limited' : 'unavailable');
      } catch (e) {
        fallbackReason = (e && e.message === 'timeout') ? 'timeout' : 'unavailable';
      }
    }

    const wxRes = await runWechatOcr(buf, contentType);
    return {
      ok: true,
      mode: 'wx',
      fallback: mode === 'ai',
      fallbackReason,
      text: wxRes.text,
      lines: wxRes.lines
    };
  } catch (err) {
    return { ok: false, reason: (err && (err.errCode || err.message)) || 'ocr_failed' };
  }
};
