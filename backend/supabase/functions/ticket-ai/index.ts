// Supabase Edge Function: ticket-ai
// 麻雀观影护照 · 拍照识票 AI 增强中转（调用 Google AI Studio / Gemini API）
// - 图片仅在内存中转发给 Gemini Vision，不落盘、不写库、不打日志
// - GEMINI_API_KEY 保存在 Supabase Edge Function Secrets，永不暴露给前端
// - 部署方式见 docs/gemini-ticket-ocr.md

const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_BASE64_CHARS = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 64;
const UPSTREAM_TIMEOUT_MS = 18_000;

const RATE_LIMIT = Math.max(1, Number(Deno.env.get('AI_RATE_LIMIT') || 12));
const RATE_WINDOW_MS = Math.max(10_000, Number(Deno.env.get('AI_RATE_WINDOW_MS') || 10 * 60 * 1000));
const hits = new Map<string, number[]>();

const ALLOWED_EXACT = new Set([
  'https://sparrowcinema.org',
  'https://www.sparrowcinema.org',
  'https://sparrowcinema.github.io',
]);

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true; // 微信云函数等服务端调用不带 Origin
  if (ALLOWED_EXACT.has(origin)) return true;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return true;
  const extra = (Deno.env.get('ALLOWED_ORIGINS') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return extra.includes(origin);
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && isAllowedOrigin(origin) ? origin : 'https://sparrowcinema.org';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function jsonResp(body: Record<string, unknown>, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for') || '';
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || 'unknown';
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_WINDOW_MS;
  const list = (hits.get(key) || []).filter((t) => t > cutoff);
  if (list.length >= RATE_LIMIT) {
    hits.set(key, list);
    return false;
  }
  list.push(now);
  hits.set(key, list);
  if (hits.size > 2000) {
    for (const [k, v] of hits) {
      const kept = v.filter((t) => t > cutoff);
      if (kept.length) hits.set(k, kept);
      else hits.delete(k);
    }
  }
  return true;
}

function clampStr(v: unknown, maxLen: number): string {
  if (typeof v !== 'string') return '';
  return v.replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

function clampMultiline(v: unknown, maxLen: number): string {
  if (typeof v !== 'string') return '';
  return v.replace(/\r\n/g, '\n').trim().slice(0, maxLen);
}

function buildPrompt(hint?: { title?: string; defaultYear?: number }): string {
  const lines = [
    'You are an accurate cinema ticket & e-ticket screenshot extractor for a film festival and cinema passport app.',
    'Extract ONLY the screening details visibly printed in the image. Never guess or fabricate missing values; return "" for any field not clearly shown.',
    'Rules:',
    '1. date: screening date in YYYY-MM-DD format. Ignore ticket purchase time, order time, or print timestamp. If only month & day appear without a year, use the hint year if plausible, otherwise leave "" if ambiguous.',
    '2. time: screening START time in 24-hour HH:MM format (e.g. "19:30"). If a range like "19:30-21:40" appears, return only the start time "19:30". Convert AM/PM to 24-hour. Ignore order/print timestamps.',
    '3. venue: cinema / theatre / festival venue name in its original script (Chinese/English/etc.), without address or trailing time.',
    '4. hall: auditorium / screen / hall name (e.g. "3号杜比全景声厅", "1号厅", "第6廳", "Salle Debussy", "Screen 4").',
    '5. seat: seat position concisely (for Chinese tickets normalize to e.g. "5排8座" or "F排12座"; for English/international tickets e.g. "Row G Seat 14" or "F12").',
    '6. format: screening format or edition if visibly stated (prefer standard labels like "4K修复", "2K修复", "4K", "35mm胶片", "70mm胶片", "IMAX激光", "IMAX 3D", "IMAX", "杜比影院", "杜比全景声", "CINITY", "LUXE", "中国巨幕", "4DX", "ScreenX", "国语2D", "原版2D", "3D", "2D"). Return "" if absent.',
    '7. raw: concise plain-text transcription of the main ticket lines (max 400 chars).',
  ];
  const yr = Number(hint?.defaultYear);
  if (Number.isInteger(yr) && yr >= 1990 && yr <= 2099) {
    lines.push(`Context hint: expected year is ${yr} (use only if the ticket omits the year).`);
  }
  const title = clampStr(hint?.title, 80);
  if (title) {
    lines.push(`Context hint: the user is editing a ticket for "${title}" (do not invent fields from the title).`);
  }
  return lines.join('\n');
}

function parseJsonBody(text: string): Record<string, unknown> | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    const obj = JSON.parse(cleaned);
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') {
    if (!isAllowedOrigin(origin)) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (!isAllowedOrigin(origin)) {
    return jsonResp({ ok: false, reason: 'forbidden_origin' }, 403, origin);
  }
  if (req.method !== 'POST') {
    return jsonResp({ ok: false, reason: 'method_not_allowed' }, 405, origin);
  }

  const apiKey = (Deno.env.get('GEMINI_API_KEY') || '').trim();
  if (!apiKey) {
    return jsonResp({ ok: false, reason: 'not_configured' }, 503, origin);
  }

  if (!checkRateLimit(clientIp(req))) {
    return jsonResp({ ok: false, reason: 'rate_limited' }, 429, origin);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResp({ ok: false, reason: 'bad_json' }, 400, origin);
  }

  const action = typeof payload.action === 'string' ? payload.action : 'ticket_ocr';
  if (action !== 'ticket_ocr') {
    return jsonResp({ ok: false, reason: 'unsupported_action' }, 400, origin);
  }

  const rawB64 = typeof payload.imageBase64 === 'string' ? payload.imageBase64 : '';
  const dataUrlMatch = rawB64.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,/i);
  const b64 = rawB64.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '').replace(/\s+/g, '');
  if (!b64 || b64.length < 32 || !/^[A-Za-z0-9+/=]+$/.test(b64)) {
    return jsonResp({ ok: false, reason: 'bad_image' }, 400, origin);
  }
  if (b64.length > MAX_BASE64_CHARS) {
    return jsonResp({ ok: false, reason: 'too_large' }, 413, origin);
  }

  let mime = typeof payload.contentType === 'string' ? payload.contentType.toLowerCase().trim() : '';
  if (!mime && dataUrlMatch) mime = dataUrlMatch[1].toLowerCase();
  if (mime === 'image/jpg') mime = 'image/jpeg';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
    mime = 'image/jpeg';
  }

  const hintRaw = payload.hint && typeof payload.hint === 'object' ? (payload.hint as Record<string, unknown>) : undefined;
  const hint = hintRaw ? {
    title: typeof hintRaw.title === 'string' ? hintRaw.title : undefined,
    defaultYear: typeof hintRaw.defaultYear === 'number' ? hintRaw.defaultYear : undefined,
  } : undefined;

  const model = (Deno.env.get('GEMINI_MODEL') || DEFAULT_MODEL).trim();
  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: 512,
    responseMimeType: 'application/json',
    responseSchema: {
      type: 'OBJECT',
      properties: {
        date: { type: 'STRING' },
        time: { type: 'STRING' },
        venue: { type: 'STRING' },
        hall: { type: 'STRING' },
        seat: { type: 'STRING' },
        format: { type: 'STRING' },
        raw: { type: 'STRING' },
      },
      required: ['date', 'time', 'venue', 'hall', 'seat', 'format', 'raw'],
    },
  };
  if (/^gemini-2\.5-flash/i.test(model)) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: buildPrompt(hint) },
              { inline_data: { mime_type: mime, data: b64 } },
            ],
          },
        ],
        generationConfig,
      }),
    });

    if (upstream.status === 429) {
      return jsonResp({ ok: false, reason: 'rate_limited' }, 429, origin);
    }
    if (!upstream.ok) {
      return jsonResp({ ok: false, reason: 'upstream_error', status: upstream.status }, 502, origin);
    }

    const data = await upstream.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(parts)
      ? parts.map((p: { text?: string }) => (typeof p?.text === 'string' ? p.text : '')).join('')
      : '';
    const parsed = parseJsonBody(text);
    if (!parsed) {
      return jsonResp({ ok: false, reason: 'invalid_response' }, 502, origin);
    }

    const fields = {
      date: clampStr(parsed.date, 20),
      time: clampStr(parsed.time, 16),
      venue: clampStr(parsed.venue, 60),
      hall: clampStr(parsed.hall, 40),
      seat: clampStr(parsed.seat, 32),
      format: clampStr(parsed.format, 32),
    };
    const raw = clampMultiline(parsed.raw, 500);

    return jsonResp({ ok: true, fields, raw, model }, 200, origin);
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === 'AbortError';
    return jsonResp({ ok: false, reason: aborted ? 'timeout' : 'upstream_error' }, aborted ? 504 : 502, origin);
  } finally {
    clearTimeout(timer);
  }
});
