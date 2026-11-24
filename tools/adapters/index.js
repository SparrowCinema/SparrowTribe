/* 影展官方片单抓取适配器注册表（tools/adapters/index.js）
 * 统一提供：
 *   - jsonld:      通用 Schema.org JSON-LD（Event / ScreeningEvent / Movie）
 *   - eventive:    Eventive 公开 API（events + films，支持直接传官网或 API 链接）
 *   - html:        通用 HTML 表格或列表 + --config 选择器 JSON 配置
 *   - goldenhorse: 金马影展官网（goldenhorse.org.tw）专用适配器
 *   - auto:        根据 URL / 扩展名 / 内容自动识别适配器 */
'use strict';

const JsonLD = require('./jsonld.js');
const Eventive = require('./eventive.js');
const HtmlTable = require('./html-table.js');
const GoldenHorse = require('./goldenhorse.js');

const ADAPTERS = {
  jsonld: JsonLD,
  eventive: Eventive,
  html: HtmlTable,
  goldenhorse: GoldenHorse
};

async function fetchText(url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs || 20000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'SparrowFilmPassport-Importer/1.0 (+https://sparrowcinema.org/)',
        'Accept': 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8'
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function detectAdapter(options) {
  const { url = '', inputText = '', config = null } = options || {};
  const u = String(url).toLowerCase();
  if (u.includes('goldenhorse.org.tw')) return 'goldenhorse';
  if (u.includes('eventive.org')) return 'eventive';
  if (config && config.item) return 'html';
  const trimmed = String(inputText || '').trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const obj = JSON.parse(trimmed);
      if (obj && (Array.isArray(obj.events) || (obj.data && Array.isArray(obj.data.events)))) return 'eventive';
      if (obj && (obj['@context'] || obj['@graph'] || obj['@type'])) return 'jsonld';
    } catch (e) {}
  }
  if (/<script[^>]+application\/ld\+json/i.test(trimmed)) return 'jsonld';
  if (/goldenhorse\.org\.tw|金馬影展|信義威秀|MUVIE\s+TITAN/i.test(trimmed)) return 'goldenhorse';
  if (/<table\b/i.test(trimmed) || /<html\b/i.test(trimmed)) return 'html';
  return '';
}

async function fetchAdapterInput(adapterId, url, fetchFn) {
  const fn = fetchFn || fetchText;
  const resolved = adapterId === 'auto' ? detectAdapter({ url }) : adapterId;
  if (resolved === 'eventive') {
    return { adapter: 'eventive', text: await Eventive.fetchFromUrl(url, fn) };
  }
  const text = await fn(url);
  return { adapter: resolved || detectAdapter({ url, inputText: text }) || 'html', text };
}

function parseWithAdapter(adapterId, inputText, options) {
  const id = adapterId === 'auto' ? detectAdapter({ url: options && options.url, inputText, config: options && options.config }) : adapterId;
  const mod = ADAPTERS[id];
  if (!mod) throw new Error(`Unknown adapter "${adapterId}". Available: ${Object.keys(ADAPTERS).join(', ')}`);
  return { adapter: id, records: mod.parse(inputText, options) };
}

module.exports = { ADAPTERS, fetchText, detectAdapter, fetchAdapterInput, parseWithAdapter };
