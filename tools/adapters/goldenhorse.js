/* 金马影展官网（goldenhorse.org.tw）专用适配器
 * 支持解析金马影展官网排片表 / 影片列表 HTML（或官网导出的 JSON）：
 *   - 识别中英文双语片名、单元（如「金馬獎入圍」「大師饗宴」）、导演、国家/地区、年份、片长
 *   - 识别金马场次格式（如 11/06 (四) 19:00、11.06 19:00）与影人出席/映后座谈标记（★ / ▲ / 映後座談 / 影人出席）
 *   - 自动归一化台北常用影院与影厅名称（信義威秀 / MUVIE CINEMAS 松仁泰坦廳 / 臺北文創），直接复用 catalog.json 已有影院 */
'use strict';

const { parseHTML, queryAll, queryOne, textContent } = require('./html-table.js');
const JsonLD = require('./jsonld.js');

function normalizeTaipeiVenue(rawVenue, rawHall) {
  let v = String(rawVenue || '').trim();
  let h = String(rawHall || '').trim();
  const combo = (v + ' ' + h).trim();

  // 从「信義威秀10廳」「MUVIE TITAN」等复合字符串拆分影院与影厅
  if (/信[义義]威秀|Vieshow\s*Xinyi/i.test(combo)) {
    v = '台北信义威秀影城';
    const hm = combo.match(/(\d{1,2})\s*[厅廳]/);
    if (hm) h = hm[1] + '厅';
  } else if (/MUVIE|松仁|泰坦[厅廳]|TITAN/i.test(combo)) {
    v = 'MUVIE CINEMAS TAIPEI';
    if (/泰坦|TITAN/i.test(combo)) h = 'MUVIE TITAN 厅';
    else {
      const hm = combo.match(/(\d{1,2})\s*[厅廳]/);
      if (hm) h = hm[1] + '厅';
    }
  } else if (/[台臺]北文[创創]/i.test(combo)) {
    v = '台北文创大楼';
    if (!h) {
      const hm = combo.match(/(6[楼樓]多功能[厅廳]|14[楼樓]文[创創][会會]所)/);
      if (hm) h = hm[1].replace(/樓/g, '楼').replace(/廳/g, '厅').replace(/創/g, '创').replace(/會/g, '会');
    }
  } else if (!h) {
    const hm = v.match(/^(.*?)[\s·・-]*(\d{1,2}\s*[厅廳]|[A-Za-z]\s*[厅廳]|泰坦[厅廳])$/);
    if (hm && hm[1].trim()) {
      v = hm[1].trim();
      h = hm[2].replace(/廳/g, '厅').replace(/\s+/g, '');
    }
  }
  if (h) h = h.replace(/廳/g, '厅').replace(/第(\d+)厅/, '$1厅');
  return { venue: v, hall: h };
}

function parseDateTimeSlot(text) {
  const s = String(text || '').trim();
  const dm = s.match(/(?:20\d{2}[-/.])?(\d{1,2})[-/.月](\d{1,2})/);
  const tm = s.match(/(\d{1,2})[:：](\d{2})/);
  const qa = /[★▲]|映[后後]座[谈談]|影人出席|Q&A/i.test(s) ? '影人出席 / 映后座谈' : '';
  return {
    date: dm ? `${+dm[1]}/${+dm[2]}` : '',
    time: tm ? String(+tm[1]).padStart(2, '0') + ':' + tm[2] : '',
    qa
  };
}

function parseMetaLine(text) {
  const s = String(text || '').trim();
  const minM = s.match(/(\d{1,3})\s*(?:min|mins|分[钟鐘]?)/i);
  const yearM = s.match(/\b((?:19|20)\d{2})\b/);
  const dirM = s.match(/(?:[导導]演|Director)\s*[:：]?\s*([^\s/|·・,，]{1,40}(?:\s+[^\s/|·・,，]{1,20})?)/i);
  const verM = s.match(/(4K\s*修[复復]|2K\s*修[复復]|35\s*mm|70\s*mm|DCP|IMAX|杜比)/i);
  return {
    min: minM ? parseInt(minM[1], 10) : 0,
    year: yearM ? parseInt(yearM[1], 10) : null,
    dir: dirM ? dirM[1].trim() : '',
    version: verM ? verM[1].replace(/復/g, '复').replace(/\s+/g, '') : ''
  };
}

function parse(input, options) {
  options = options || {};
  const text = String(input || '').trim();

  // 1. 支持直接传入金马官网抓取到的 JSON 数组/对象
  if (text.startsWith('{') || text.startsWith('[')) {
    const raw = JSON.parse(text);
    const list = Array.isArray(raw) ? raw : (raw.screenings || raw.films || raw.data || []);
    return list.map(item => {
      const vh = normalizeTaipeiVenue(item.venue || item.cinema || item.theater || '', item.hall || item.room || '');
      const slot = parseDateTimeSlot((item.date || '') + ' ' + (item.time || '') + ' ' + (item.note || item.qa || ''));
      return {
        title: String(item.title || item.cn || item.name_zh || '').trim(),
        en: String(item.en || item.name_en || item.english || '').trim(),
        orig: String(item.orig || item.original || item.name_en || '').trim(),
        year: item.year ? parseInt(item.year, 10) : null,
        dir: String(item.dir || item.director || '').trim(),
        country: String(item.country || item.region || '').trim(),
        min: parseInt(item.min || item.runtime || 0, 10) || 0,
        section: String(item.section || item.category || '').trim(),
        version: String(item.version || item.format || '').trim(),
        date: slot.date,
        time: slot.time,
        venue: vh.venue,
        hall: vh.hall,
        qa: item.qa || slot.qa,
        audience: '',
        access: String(item.access || '').trim(),
        imdb: String(item.imdb || '').trim(),
        douban: String(item.douban || '').trim(),
        lb: String(item.lb || '').trim(),
        synopsis: String(item.synopsis || item.desc || '').trim()
      };
    }).filter(r => r.title);
  }

  const doc = parseHTML(text);
  const records = [];

  // 2. 金马官网排片卡片 / 列表结构（.film-item / .schedule-item / .screening-row / article）
  const cards = queryAll(doc, '.gh-film, .film-item, .schedule-item, .screening-item, tr[data-film], tr.screening');
  cards.forEach(card => {
    const titleNode = queryOne(card, '.title-zh, .film-title-zh, .cn-title, .film-title, h3, h4, td.title');
    const enNode = queryOne(card, '.title-en, .film-title-en, .en-title, .subtitle');
    const title = textContent(titleNode).replace(/[★▲]/g, '').trim();
    if (!title) return;
    const en = textContent(enNode).trim();
    const sec = textContent(queryOne(card, '.section, .unit, .category, .strand')).trim();
    const dirNode = queryOne(card, '.director, .dir');
    const meta = parseMetaLine(textContent(queryOne(card, '.meta, .info, .film-meta')) || textContent(card));
    const countryNode = queryOne(card, '.country, .region');
    const synNode = queryOne(card, '.synopsis, .intro, .desc, p.syn');

    // 一部片卡片内可能包含多场放映（.show-item / .screening / li.slot），也可能本身就是单场行
    const slots = queryAll(card, '.show-item, .screening-slot, .slot, li.time-slot');
    const emit = (slotText, venueRaw, hallRaw) => {
      const slot = parseDateTimeSlot(slotText);
      const vh = normalizeTaipeiVenue(venueRaw, hallRaw);
      records.push({
        title,
        en,
        orig: en || title,
        year: meta.year,
        dir: textContent(dirNode).replace(/^(?:[导導]演|Director)\s*[:：]?\s*/i, '').trim() || meta.dir,
        country: textContent(countryNode).trim(),
        min: meta.min,
        section: sec,
        version: textContent(queryOne(card, '.version, .format')).trim() || meta.version,
        date: slot.date,
        time: slot.time,
        venue: vh.venue,
        hall: vh.hall,
        qa: slot.qa || (/[★▲]|映[后後]座[谈談]|影人出席/.test(textContent(card)) ? '影人出席 / 映后座谈' : ''),
        audience: '',
        access: '',
        imdb: '', douban: '', lb: '',
        synopsis: textContent(synNode).trim()
      });
    };

    if (slots.length) {
      slots.forEach(sl => {
        const vNode = queryOne(sl, '.venue, .cinema, .theater, .place');
        const hNode = queryOne(sl, '.hall, .screen, .room');
        const st = textContent(sl);
        const vRaw = textContent(vNode) || st.replace(/(?:20\d{2}[-/.])?\d{1,2}[-/.月]\d{1,2}[^\s]*|\d{1,2}[:：]\d{2}|[★▲]|[(（][一二三四五六日天][)）]/g, '').trim();
        emit(st, vRaw, textContent(hNode));
      });
    } else {
      const vNode = queryOne(card, '.venue, .cinema, .theater, .place, td.venue');
      const hNode = queryOne(card, '.hall, .screen, .room, td.hall');
      const dtNode = queryOne(card, '.datetime, .time, .date, td.date, td.time');
      const dtText = (dtNode ? textContent(dtNode) : '') + ' ' + textContent(card);
      emit(dtText, textContent(vNode), textContent(hNode));
    }
  });

  if (records.length) return records;

  // 3. 回退：尝试从页面中的通用表格提取金马排片（含「日期 / 時間 / 片名 / 戲院」列）
  const tables = queryAll(doc, 'table');
  for (const tb of tables) {
    const trs = queryAll(tb, 'tr');
    const matrix = trs.map(tr => tr.children.filter(c => c.tag === 'th' || c.tag === 'td').map(c => textContent(c))).filter(r => r.some(Boolean));
    if (matrix.length < 2) continue;
    const head = matrix[0].map(h => h.toLowerCase());
    const idxOf = keys => head.findIndex(h => keys.some(k => h.includes(k)));
    const iT = idxOf(['片名', '影片', 'title']);
    const iEn = idxOf(['英文', 'english']);
    const iD = idxOf(['日期', 'date']);
    const iTm = idxOf(['時間', '时间', 'time']);
    const iV = idxOf(['戲院', '影院', '場地', '地点', 'venue']);
    const iH = idxOf(['廳', '厅', 'hall']);
    const iSec = idxOf(['單元', '单元', 'section']);
    const iDir = idxOf(['導演', '导演', 'director']);
    const iMin = idxOf(['片長', '片长', '分', 'runtime']);
    if (iT < 0) continue;
    for (let r = 1; r < matrix.length; r++) {
      const row = matrix[r], g = i => (i >= 0 && row[i]) ? row[i].trim() : '';
      const rawTitle = g(iT);
      if (!rawTitle) continue;
      const slot = parseDateTimeSlot(g(iD) + ' ' + g(iTm) + ' ' + rawTitle);
      const vh = normalizeTaipeiVenue(g(iV), g(iH));
      const meta = parseMetaLine(g(iMin));
      records.push({
        title: rawTitle.replace(/[★▲]/g, '').trim(),
        en: g(iEn),
        orig: g(iEn) || rawTitle.replace(/[★▲]/g, '').trim(),
        year: null,
        dir: g(iDir),
        country: '',
        min: meta.min,
        section: g(iSec),
        version: '',
        date: slot.date,
        time: slot.time,
        venue: vh.venue,
        hall: vh.hall,
        qa: slot.qa,
        audience: '', access: '', imdb: '', douban: '', lb: '', synopsis: ''
      });
    }
    if (records.length) return records;
  }

  // 4. 最终回退：如果页面内嵌 JSON-LD，也无缝解析
  return JsonLD.parse(text, { tz: options.tz || 'Asia/Taipei' });
}

module.exports = {
  id: 'goldenhorse',
  name: 'Golden Horse Film Festival (goldenhorse.org.tw)',
  defaultTz: 'Asia/Taipei',
  defaultCity: '台北',
  parse,
  normalizeTaipeiVenue
};
