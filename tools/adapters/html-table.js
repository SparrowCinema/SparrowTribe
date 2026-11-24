/* 通用 HTML 表格 / 列表 + 选择器配置文件适配器（零外部依赖）
 * 两种用法：
 *   1. 无配置文件：自动查找网页中的 <table>，按表头映射为标准片单排片记录。
 *   2. 带 --config fest.json：按选择器配置抓取任意列表/卡片结构：
 *      {
 *        "item": "li.screening-item",
 *        "fields": {
 *          "title": ".title",
 *          "en": ".en-title",
 *          "date": "[data-date]@data-date",
 *          "time": ".time",
 *          "venue": ".venue",
 *          "hall": ".hall",
 *          "dir": ".director",
 *          "min": { "selector": ".meta", "regex": "(\\d+)\\s*min" }
 *        }
 *      }
 * 支持的 CSS 选择器语法：tag, .class, #id, [attr], [attr="val"], 后代组合 (空格), > 直接子元素, :nth-child(n), 以及末尾 @attr 取属性。 */
'use strict';

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function parseAttrs(raw) {
  const attrs = {};
  const re = /([a-zA-Z0-9_:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(raw))) {
    attrs[m[1].toLowerCase()] = decodeEntities(m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : (m[4] !== undefined ? m[4] : '')));
  }
  return attrs;
}

function parseHTML(html) {
  const clean = String(html || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  const root = { tag: '#root', attrs: {}, children: [], parent: null };
  const stack = [root];
  const tokenRe = /<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)([^>]*)>|([^<]+)/g;
  let m;
  while ((m = tokenRe.exec(clean))) {
    const parent = stack[stack.length - 1];
    if (m[4] !== undefined) {
      const txt = decodeEntities(m[4]);
      if (txt) parent.children.push({ text: txt, parent });
      continue;
    }
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    const rawAttrs = m[3] || '';
    const selfClose = /\/\s*$/.test(rawAttrs) || VOID_TAGS.has(tag);
    if (closing) {
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === tag) { stack.length = i; break; }
      }
      continue;
    }
    const node = { tag, attrs: parseAttrs(rawAttrs.replace(/\/\s*$/, '')), children: [], parent };
    parent.children.push(node);
    if (!selfClose) stack.push(node);
  }
  return root;
}

function textContent(node) {
  if (!node) return '';
  if (node.text !== undefined) return node.text;
  return (node.children || []).map(textContent).join(' ').replace(/\s+/g, ' ').trim();
}

function parseSimpleSelector(sel) {
  const s = sel.trim();
  const out = { tag: '', id: '', classes: [], attrs: [], nth: 0 };
  let rest = s;
  const nthM = rest.match(/:nth-child\(\s*(\d+)\s*\)/i);
  if (nthM) { out.nth = parseInt(nthM[1], 10); rest = rest.replace(nthM[0], ''); }
  const attrRe = /\[([a-zA-Z0-9_:-]+)(?:\s*=\s*["']?([^"'\]]*)["']?)?\]/g;
  let am;
  while ((am = attrRe.exec(rest))) out.attrs.push([am[1].toLowerCase(), am[2]]);
  rest = rest.replace(attrRe, '');
  const idM = rest.match(/#([a-zA-Z0-9_-]+)/);
  if (idM) { out.id = idM[1]; rest = rest.replace(idM[0], ''); }
  const clsRe = /\.([a-zA-Z0-9_-]+)/g;
  let cm;
  while ((cm = clsRe.exec(rest))) out.classes.push(cm[1]);
  rest = rest.replace(clsRe, '').trim();
  if (rest && rest !== '*') out.tag = rest.toLowerCase();
  return out;
}

function matchesSimple(node, spec) {
  if (!node || !node.tag || node.tag === '#root') return false;
  if (spec.tag && node.tag !== spec.tag) return false;
  if (spec.id && node.attrs.id !== spec.id) return false;
  if (spec.classes.length) {
    const cls = String(node.attrs.class || '').split(/\s+/).filter(Boolean);
    if (!spec.classes.every(c => cls.includes(c))) return false;
  }
  for (const [k, v] of spec.attrs) {
    if (!(k in node.attrs)) return false;
    if (v !== undefined && node.attrs[k] !== v) return false;
  }
  if (spec.nth > 0 && node.parent) {
    const elemSiblings = node.parent.children.filter(c => c.tag);
    if (elemSiblings[spec.nth - 1] !== node) return false;
  }
  return true;
}

function queryAll(root, selector) {
  const parts = [];
  const raw = String(selector || '').trim();
  if (!raw) return [];
  // Support comma-separated selectors
  if (raw.includes(',')) {
    const seen = new Set(), out = [];
    raw.split(',').forEach(part => {
      queryAll(root, part).forEach(n => { if (!seen.has(n)) { seen.add(n); out.push(n); } });
    });
    return out;
  }
  // Tokenize combinators (' ' and '>')
  const tokens = raw.replace(/\s*>\s*/g, ' > ').split(/\s+/).filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === '>') {
      if (i + 1 < tokens.length) parts.push({ child: true, spec: parseSimpleSelector(tokens[++i]) });
    } else {
      parts.push({ child: false, spec: parseSimpleSelector(tokens[i]) });
    }
  }
  if (!parts.length) return [];

  function walk(node, out) {
    for (const c of (node.children || [])) {
      if (!c.tag) continue;
      out.push(c);
      walk(c, out);
    }
  }

  let cur = [root];
  for (const step of parts) {
    const next = [];
    const seen = new Set();
    for (const base of cur) {
      const pool = step.child ? (base.children || []).filter(c => c.tag) : (() => { const a = []; walk(base, a); return a; })();
      for (const cand of pool) {
        if (!seen.has(cand) && matchesSimple(cand, step.spec)) {
          seen.add(cand);
          next.push(cand);
        }
      }
    }
    cur = next;
    if (!cur.length) break;
  }
  return cur;
}

function queryOne(root, selector) {
  return queryAll(root, selector)[0] || null;
}

function extractField(itemNode, spec) {
  if (!spec) return '';
  const cfg = typeof spec === 'string' ? { selector: spec } : spec;
  let sel = String(cfg.selector || '').trim();
  let attr = cfg.attr || '';
  if (!attr && sel.includes('@')) {
    const idx = sel.lastIndexOf('@');
    attr = sel.slice(idx + 1).trim();
    sel = sel.slice(0, idx).trim();
  }
  const target = sel ? queryOne(itemNode, sel) : itemNode;
  if (!target) return '';
  let val = attr ? (target.attrs[attr.toLowerCase()] || '') : textContent(target);
  if (cfg.regex) {
    const m = val.match(new RegExp(cfg.regex, cfg.flags || 'i'));
    val = m ? (m[1] !== undefined ? m[1] : m[0]) : '';
  }
  return String(val || '').trim();
}

function parseDateMD(raw) {
  const s = String(raw || '').trim();
  let m = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${+m[2]}/${+m[3]}`;
  m = s.match(/(\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${+m[1]}/${+m[2]}`;
  m = s.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*[日号號]?/);
  if (m) return `${+m[1]}/${+m[2]}`;
  return '';
}

function parseTimeHM(raw) {
  const m = String(raw || '').trim().match(/(\d{1,2})[:：](\d{2})/);
  if (!m) return '';
  return String(+m[1]).padStart(2, '0') + ':' + m[2];
}

function parseMin(raw) {
  const m = String(raw || '').match(/(\d{1,4})/);
  return m ? parseInt(m[1], 10) : 0;
}

function parseWithConfig(doc, config) {
  const items = queryAll(doc, config.item);
  const fields = config.fields || {};
  return items.map(item => {
    const g = k => extractField(item, fields[k]);
    const yM = g('year').match(/(19|20)\d{2}/);
    return {
      title: g('title'),
      en: g('en'),
      orig: g('orig'),
      year: yM ? parseInt(yM[0], 10) : null,
      dir: g('dir'),
      country: g('country'),
      min: parseMin(g('min')),
      section: g('section'),
      version: g('version'),
      date: parseDateMD(g('date')),
      time: parseTimeHM(g('time')),
      venue: g('venue'),
      hall: g('hall'),
      qa: g('qa'),
      audience: g('audience'),
      access: g('access'),
      imdb: g('imdb'),
      douban: g('douban'),
      lb: g('lb'),
      synopsis: g('synopsis')
    };
  }).filter(r => r.title);
}

function parseTablesAuto(doc, normalizeRowsFromTable) {
  const tables = queryAll(doc, 'table');
  let best = [];
  tables.forEach(tb => {
    const trs = queryAll(tb, 'tr');
    const matrix = trs.map(tr =>
      tr.children.filter(c => c.tag === 'th' || c.tag === 'td').map(c => textContent(c))
    ).filter(row => row.some(Boolean));
    if (matrix.length < 2) return;
    const recs = normalizeRowsFromTable(matrix).filter(r => r.title);
    if (recs.length > best.length) best = recs;
  });
  return best;
}

function parse(html, options) {
  options = options || {};
  const doc = parseHTML(html);
  if (options.config && options.config.item) {
    return parseWithConfig(doc, options.config);
  }
  if (options.normalizeRowsFromTable) {
    return parseTablesAuto(doc, options.normalizeRowsFromTable);
  }
  return [];
}

module.exports = {
  id: 'html',
  name: 'Generic HTML Table / Selector-Config List',
  parse,
  parseHTML,
  queryAll,
  queryOne,
  textContent
};
