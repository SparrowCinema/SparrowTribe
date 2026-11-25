// Supabase Edge Function: ticket-ai (线上 slug: smooth-processor)
// 麻雀观影护照 · AI 能力中转（调用 Google AI Studio / Gemini API）
// 支持白名单 action：
//   1. ticket_ocr     —— 拍照识票（纸质票/电子票截图提取 6 字段，图片仅内存中转、不落盘）
//   2. taste_portrait —— 个人观影画像 / 评语（基于看过清单与四象限摘要生成 200–300 字评语，不存库）
// - GEMINI_API_KEY 保存在 Supabase Edge Function Secrets，永不暴露给前端
// - 部署方式见 docs/gemini-ticket-ocr.md

const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_BASE64_CHARS = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 64;
const UPSTREAM_TIMEOUT_MS = 20_000;

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

function numOrNull(v: unknown, min: number, max: number): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return Math.round(n * 10) / 10;
}

function buildTicketPrompt(hint?: { title?: string; defaultYear?: number }): string {
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

function buildPortraitPrompt(summaryJson: string, lang: 'zh' | 'en'): string {
  if (lang === 'en') {
    return [
      'You are an insightful film festival curator and critic writing a personal cinema-taste portrait for a filmgoer.',
      'Write strictly based on the JSON data provided below (watched films, star ratings out of 10, Interesting/Boring quadrant scores out of 5, and taste persona summary).',
      'Rules:',
      '1. NEVER invent or cite films, directors, or ratings that are not present in the provided JSON.',
      '2. headline: a vivid, literary 3–7 word portrait title (no quotes).',
      '3. tags: 3–4 short taste keywords (2–3 words each).',
      '4. commentary: 150–210 words in crisp, warm, specific prose (2 short paragraphs separated by a newline). Name 2–4 standout films from the list, notice any fascinating contrast between star ratings and Interesting/Boring scores (e.g. films rated high in artistry yet tiring, or guilty delights), and highlight genre/region/era habits. Avoid generic flattery or robotic bullet lists.',
      '5. nextHint: one concrete, inviting 1-sentence suggestion (15–30 words) on what kind of film or festival strand to try next.',
      '',
      'Viewer data (JSON):',
      summaryJson,
    ].join('\n');
  }
  return [
    '你是一位品味敏锐、文风克制而有温度的影展策展人兼影评人，正在为「麻雀观影护照」的影迷撰写一份个人观影画像评语。',
    '请严格基于下方提供的 JSON 数据（看过片单、十分制星级评分、0–5 分有趣度/无聊度四象限分布及趣味人格摘要）来写。',
    '写作要求：',
    '1. 绝对不要编造清单里不存在的影片、导演、年代或评分；引用片名时加中文书名号《》。',
    '2. headline：8–18 字有画面感的观影画像标题，不带引号或句号。',
    '3. tags：3–4 个简短口味标签（每个 3–6 字，如「慢镜头拥护者」「爱憎分明派」）。',
    '4. commentary：200–300 字连贯中文评语（可分 2 段，用换行分隔）。请点名 2–4 部清单里有代表性的影片，捕捉观众在「打星」与「有趣/无聊四象限」之间的微妙张力（例如又迷人又折磨、耐闷力强、偏爱重刷等），并自然带出其导演/地区/年代或类型偏好。语气温和犀利、像懂电影的老友聊天，避免空洞夸赞和模板套话。',
    '5. nextHint：1 句具体可落地的下一步选片建议（20–45 字）。',
    '',
    '观众数据（JSON）：',
    summaryJson,
  ].join('\n');
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

async function callGemini(
  apiKey: string,
  model: string,
  parts: Record<string, unknown>[],
  responseSchema: Record<string, unknown>,
  maxOutputTokens: number,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; status: number; reason: string; upstreamStatus?: number }> {
  const generationConfig: Record<string, unknown> = {
    maxOutputTokens,
    responseMimeType: 'application/json',
    responseSchema,
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
        contents: [{ role: 'user', parts }],
        generationConfig,
      }),
    });

    if (upstream.status === 429) {
      return { ok: false, status: 429, reason: 'rate_limited' };
    }
    if (!upstream.ok) {
      return { ok: false, status: 502, reason: 'upstream_error', upstreamStatus: upstream.status };
    }

    const data = await upstream.json();
    const outParts = data?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(outParts)
      ? outParts.map((p: { text?: string }) => (typeof p?.text === 'string' ? p.text : '')).join('')
      : '';
    const parsed = parseJsonBody(text);
    if (!parsed) {
      return { ok: false, status: 502, reason: 'invalid_response' };
    }
    return { ok: true, data: parsed };
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === 'AbortError';
    return { ok: false, status: aborted ? 504 : 502, reason: aborted ? 'timeout' : 'upstream_error' };
  } finally {
    clearTimeout(timer);
  }
}

async function handleTicketOcr(payload: Record<string, unknown>, apiKey: string, model: string, origin: string | null): Promise<Response> {
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

  const schema = {
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
  };

  const res = await callGemini(
    apiKey,
    model,
    [{ text: buildTicketPrompt(hint) }, { inline_data: { mime_type: mime, data: b64 } }],
    schema,
    512,
  );
  if (!res.ok) {
    const body: Record<string, unknown> = { ok: false, reason: res.reason };
    if (res.upstreamStatus) body.status = res.upstreamStatus;
    return jsonResp(body, res.status, origin);
  }

  const parsed = res.data;
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
}

async function handleTastePortrait(payload: Record<string, unknown>, apiKey: string, model: string, origin: string | null): Promise<Response> {
  const lang: 'zh' | 'en' = payload.lang === 'en' ? 'en' : 'zh';
  const rawFilms = Array.isArray(payload.topFilms) ? payload.topFilms : [];
  if (rawFilms.length < 3) {
    return jsonResp({ ok: false, reason: 'too_few_films' }, 400, origin);
  }

  const topFilms = rawFilms.slice(0, 50).map((item) => {
    const x = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const out: Record<string, unknown> = { t: clampStr(x.t, 60) };
    const y = clampStr(String(x.y || ''), 8); if (y) out.y = y;
    const c = clampStr(x.c, 28); if (c) out.c = c;
    const d = clampStr(x.d, 36); if (d) out.d = d;
    const g = clampStr(x.g, 36); if (g) out.g = g;
    const r = numOrNull(x.r, 0.5, 10); if (r !== null) out.r = r;
    const fun = numOrNull(x.fun, 0, 5); if (fun !== null) out.fun = fun;
    const bore = numOrNull(x.bore, 0, 5); if (bore !== null) out.bore = bore;
    const v = numOrNull(x.v, 2, 99); if (v !== null) out.v = Math.round(v);
    return out;
  }).filter((x) => Boolean(x.t));

  if (topFilms.length < 3) {
    return jsonResp({ ok: false, reason: 'too_few_films' }, 400, origin);
  }

  const summary: Record<string, unknown> = {
    scope: clampStr(payload.scope, 60) || (lang === 'en' ? 'All watched films' : '全部观影'),
    watchedCount: Math.max(topFilms.length, Math.min(10000, Math.round(Number(payload.watchedCount) || topFilms.length))),
    topFilms,
  };

  if (payload.tasteSummary && typeof payload.tasteSummary === 'object') {
    const ts = payload.tasteSummary as Record<string, unknown>;
    const qs = ts.quadrants && typeof ts.quadrants === 'object' ? (ts.quadrants as Record<string, unknown>) : null;
    summary.tasteSummary = {
      ratedCount: Math.max(0, Math.min(10000, Math.round(Number(ts.ratedCount) || 0))),
      code: clampStr(ts.code, 8),
      persona: clampStr(ts.persona, 40),
      title: clampStr(ts.title, 60),
      avgFun: numOrNull(ts.avgFun, 0, 5),
      avgBore: numOrNull(ts.avgBore, 0, 5),
      quadrants: qs ? {
        enduring: Math.max(0, Math.round(Number(qs.enduring) || 0)),
        captivating: Math.max(0, Math.round(Number(qs.captivating) || 0)),
        quiet: Math.max(0, Math.round(Number(qs.quiet) || 0)),
        delightful: Math.max(0, Math.round(Number(qs.delightful) || 0)),
        unsure: Math.max(0, Math.round(Number(qs.unsure) || 0)),
      } : undefined,
    };
  }

  const summaryJson = JSON.stringify(summary);
  if (summaryJson.length > 14_000) {
    return jsonResp({ ok: false, reason: 'too_large' }, 413, origin);
  }

  const schema = {
    type: 'OBJECT',
    properties: {
      headline: { type: 'STRING' },
      tags: { type: 'ARRAY', items: { type: 'STRING' } },
      commentary: { type: 'STRING' },
      nextHint: { type: 'STRING' },
    },
    required: ['headline', 'tags', 'commentary', 'nextHint'],
  };

  const res = await callGemini(
    apiKey,
    model,
    [{ text: buildPortraitPrompt(summaryJson, lang) }],
    schema,
    900,
  );
  if (!res.ok) {
    const body: Record<string, unknown> = { ok: false, reason: res.reason };
    if (res.upstreamStatus) body.status = res.upstreamStatus;
    return jsonResp(body, res.status, origin);
  }

  const parsed = res.data;
  const rawTags = Array.isArray(parsed.tags) ? parsed.tags : [];
  const portrait = {
    headline: clampStr(parsed.headline, 48),
    tags: rawTags.map((t) => clampStr(t, 24)).filter(Boolean).slice(0, 4),
    commentary: clampMultiline(parsed.commentary, 1400),
    nextHint: clampStr(parsed.nextHint, 180),
  };
  if (!portrait.commentary) {
    return jsonResp({ ok: false, reason: 'invalid_response' }, 502, origin);
  }

  return jsonResp({ ok: true, portrait, model }, 200, origin);
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

  const model = (Deno.env.get('GEMINI_MODEL') || DEFAULT_MODEL).trim();
  const action = typeof payload.action === 'string' ? payload.action : 'ticket_ocr';

  if (action === 'ticket_ocr') {
    return await handleTicketOcr(payload, apiKey, model, origin);
  }
  if (action === 'taste_portrait') {
    return await handleTastePortrait(payload, apiKey, model, origin);
  }
  return jsonResp({ ok: false, reason: 'unsupported_action' }, 400, origin);
});
