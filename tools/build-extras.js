// 部署时生成（GitHub Actions 里运行，生成物不提交）：
//  1) s/f/<影片id>.html、s/en/f/<影片id>.html、s/p/<专题id>.html、s/en/p/<专题id>.html：带 Open Graph / Twitter 卡片的分享页，
//     供 WhatsApp、X、Telegram、微信等抓取预览，浏览器打开后自动跳转到 index.html 对应的影片/专题。
//  2) cal/<专题id>.ics、cal/en/<专题id>.ics、cal/all.ics：可订阅日历（webcal://），场次变动后订阅者自动同步。
// 本地预览：node tools/build-extras.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const SITE = 'https://sparrowcinema.org/';
const J = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const cat = J('data/catalog.json'), EN = J('data/i18n/en.json');
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const abs = p => !p ? '' : /^https?:/.test(p) ? p : SITE + p.replace(/^\//, '');
const out = (rel, txt) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, txt); };
const VN = {}; cat.venues.forEach(v => { VN[v.id] = v; });
const progs = cat.programmes.filter(p => p.file).map(p => Object.assign({}, p, { pk: J(p.file) }));
const films = {}, filmProg = {}, shows = [];
progs.forEach(p => {
  (p.pk.films || []).forEach(f => { if (!films[f.id]) { films[f.id] = f; filmProg[f.id] = p; } });
  (p.pk.shows || []).forEach(r => { const [d, t, id, v, h] = Array.isArray(r) ? r : [r.d, r.t, r.id, r.v, r.h]; shows.push({ d, t, id, v, h, p: p.id, year: (!Array.isArray(r) && r.year) || p.pk.year || 2026, archive: !Array.isArray(r) && r.archive === true }); });
});
const keyOf = require('../shared/screenings.js').keyOf;
const dt = s => { const [m, d] = s.d.split('/').map(Number), [H, M] = s.t.split(':').map(Number); return { y: s.year, m, d, H, M }; };
const stamp = x => `${x.y}${String(x.m).padStart(2, '0')}${String(x.d).padStart(2, '0')}T${String(x.H).padStart(2, '0')}${String(x.M).padStart(2, '0')}00`;
const addMin = (x, n) => { const e = new Date(Date.UTC(x.y, x.m - 1, x.d, x.H, x.M + n)); return { y: e.getUTCFullYear(), m: e.getUTCMonth() + 1, d: e.getUTCDate(), H: e.getUTCHours(), M: e.getUTCMinutes() }; };
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const dur = s => { const f = films[s.id], e = f.screeningEnds && f.screeningEnds[keyOf(s)]; return e ? toMin(e) - toMin(s.t) : (+f.min > 0 ? +f.min : 120); };
const lang = L => L === 'en';
const enF = (id, L) => (lang(L) && EN.films[id]) || {};
const title = (f, L) => lang(L) ? (enF(f.id, L).title || f.en || f.o || f.cn) : f.cn;
const progName = (p, L) => lang(L) && EN.programmes[p.id] && EN.programmes[p.id].name || p.name;
const venueOf = (s, L) => { const v = VN[s.v], o = lang(L) && EN.venues[s.v] || {}, h = (v.halls || []).find(x => x.id === s.h) || {}, oh = o.halls && o.halls[s.h] || {}; return `${o.name || v.name} · ${oh.name || h.name || ''}`; };

// 独立内容页地址：中文 film/<id>.html、programme/<id>.html，英文前面加 en/
const docURL = (kind, id, L) => SITE + (lang(L) ? 'en/' : '') + kind + '/' + id + '.html';

// ---------- 分享页 ----------
const page = ({ L, kind, id, ttl, desc, img, wide, hash, bare }) => {
  const rel = (lang(L) ? 's/en/' : 's/') + kind + '/' + id + '.html', url = docURL(kind === 'f' ? 'film' : 'programme', id, L); // canonical 指向不跳转的独立内容页
  const home = SITE + 'index.html?' + (lang(L) ? 'lang=en&' : '') + 'go=' + hash.slice(1) + hash; // go= 是备用：部分内置浏览器跳转时会丢掉 # 后面的部分
  const name = lang(L) ? 'Sparrow Film Passport' : '麻雀观影护照';
  return `<!doctype html><html lang="${lang(L) ? 'en' : 'zh-CN'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(ttl)}${bare ? '' : ' | ' + name}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${url}">
<meta property="og:site_name" content="${name}"><meta property="og:type" content="${kind === 'f' ? 'video.movie' : 'website'}"><meta property="og:title" content="${esc(ttl)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}">${img ? `<meta property="og:image" content="${esc(img)}"><meta property="og:image:alt" content="${esc(ttl)}">` : ''}<meta property="og:locale" content="${lang(L) ? 'en_US' : 'zh_CN'}">
<meta name="twitter:card" content="${img && wide ? 'summary_large_image' : 'summary'}"><meta name="twitter:title" content="${esc(ttl)}"><meta name="twitter:description" content="${esc(desc)}">${img ? `<meta name="twitter:image" content="${esc(img)}">` : ''}
<style>body{font:16px/1.7 system-ui,-apple-system,"PingFang SC",sans-serif;max-width:640px;margin:0 auto;padding:32px 20px;color:#2b2117;background:#f8f2e6}img{max-width:240px;border-radius:8px}a{color:#8e2a22}</style></head><body>
${img ? `<img src="${esc(img)}" alt="">` : ''}<h1>${esc(ttl)}</h1><p>${esc(desc)}</p><p><a href="${home}">${lang(L) ? 'Open in Sparrow Film Passport →' : '在麻雀观影护照中打开 →'}</a></p>
<script>location.replace(${JSON.stringify(home)})</script></body></html>`;
};
const now = Date.now();
let nShare = 0;
for (const L of ['zh', 'en']) {
  Object.values(films).forEach(f => {
    const p = filmProg[f.id], e = enF(f.id, L), ttl0 = title(f, L);
    const dirs = lang(L) ? (e.dir || f.dirO || f.dir) : f.dir;
    const upcoming = shows.filter(s => s.id === f.id && Date.UTC(s.year, dt(s).m - 1, dt(s).d, dt(s).H - 8, dt(s).M) > now).slice(0, 2)
      .map(s => `${s.d.replace('/', '.')} ${s.t} ${venueOf(s, L)}`).join(lang(L) ? '; ' : '；');
    const syn = clip(e.syn || f.syn, 110);
    const ttl = [ttl0 + (f.y ? ` (${f.y})` : ''), dirs].filter(Boolean).join(' · ');
    const desc = [progName(p, L), upcoming, syn].filter(Boolean).join(' ｜ ');
    out(`s/${lang(L) ? 'en/' : ''}f/${f.id}.html`, page({ L, kind: 'f', id: f.id, ttl, desc, img: abs(f.poster) || abs(p.cardCover || p.cover), hash: '#film-' + f.id })); nShare++;
  });
  progs.forEach(p => {
    const o = lang(L) && EN.programmes[p.id] || {}, cover = o.cover || p.cardCover || p.cover;
    out(`s/${lang(L) ? 'en/' : ''}p/${p.id}.html`, page({ L, kind: 'p', id: p.id, ttl: o.name || p.name, bare: true, desc: clip(`${p.period} · ${o.blurb || p.blurb || o.sub || p.sub}`, 160), img: abs(cover), wide: true, hash: '#prog-' + p.id })); nShare++;
  });
}

// ---------- 独立内容页（搜索引擎收录用，不跳转）----------
// film/<id>.html、en/film/<id>.html、programme/<id>.html、en/programme/<id>.html：完整的影片 / 专题资料，带 hreflang 与 Movie 结构化数据；
// 页面上的按钮打开观影护照对应页面。分享页（s/）照旧跳转，canonical 指向这里。
const trW = s => s && (EN.exact && EN.exact[s] || EN.ui && EN.ui[s]) || '';
const HONOR = { '获奖': ['获奖', 'Won'], '提名': ['提名', 'Nominated'], '入围': ['入围', 'Selection'] };
const honorRow = (h, L) => { const m = /^([^｜]+)｜(.*)$/.exec(h || ''); if (!m) return esc(h); const lab = HONOR[m[1]] ? HONOR[m[1]][lang(L) ? 1 : 0] : m[1]; return `<b>${esc(lab)}</b> ${esc(m[2])}`; };
const ldJSON = o => JSON.stringify(o).replace(/</g, '\\u003c');
const filmProgs = {}; // 影片 → 它出现的专题（定义所在 + 有场次的）
progs.forEach(p => { (p.pk.films || []).forEach(f => { (filmProgs[f.id] = filmProgs[f.id] || new Set()).add(p.id); }); });
shows.forEach(s => { (filmProgs[s.id] = filmProgs[s.id] || new Set()).add(s.p); });
const showTime = s => Date.UTC(s.year, dt(s).m - 1, dt(s).d, dt(s).H - 8, dt(s).M);
const docPage = ({ L, kind, id, ttl, desc, img, body, ld, hash }) => {
  const name = lang(L) ? 'Sparrow Film Passport' : '麻雀观影护照', url = docURL(kind, id, L);
  const zh = docURL(kind, id, 'zh'), en = docURL(kind, id, 'en');
  const app = SITE + 'index.html?' + (lang(L) ? 'lang=en&' : '') + 'go=' + hash.slice(1) + hash;
  return `<!doctype html><html lang="${lang(L) ? 'en' : 'zh-CN'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(ttl)} | ${name}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${url}">
<link rel="alternate" hreflang="zh-Hans" href="${zh}"><link rel="alternate" hreflang="en" href="${en}"><link rel="alternate" hreflang="x-default" href="${zh}">
<meta property="og:site_name" content="${name}"><meta property="og:type" content="${kind === 'film' ? 'video.movie' : 'website'}"><meta property="og:title" content="${esc(ttl)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}">${img ? `<meta property="og:image" content="${esc(img)}">` : ''}
<link rel="icon" type="image/png" sizes="32x32" href="${SITE}icons/favicon-32.png?v=3">
${ld ? `<script type="application/ld+json">${ldJSON(ld)}</script>` : ''}
<style>:root{color-scheme:light dark}body{font:16px/1.75 system-ui,-apple-system,"PingFang SC","Noto Sans SC",sans-serif;max-width:760px;margin:0 auto;padding:28px 20px 60px;color:#2b2117;background:#f8f2e6}
@media(prefers-color-scheme:dark){body{color:#eadfcd;background:#211b15}a{color:#e0a07a!important}.meta,.note{color:#b9aa95!important}li,.card{border-color:#4a3e33!important}}
header{display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap}header img{width:180px;max-width:42vw;border-radius:8px;box-shadow:0 2px 10px #0002}
h1{font-size:26px;line-height:1.35;margin:0 0 6px}h2{font-size:17px;margin:28px 0 8px}.meta{color:#6f604f;font-size:14px;margin:2px 0}a{color:#8e2a22}
.open{display:inline-block;margin-top:14px;padding:9px 16px;border-radius:999px;background:#8e2a22;color:#fff!important;text-decoration:none;font-weight:600}
ul{padding:0;list-style:none}li{padding:7px 0;border-bottom:1px solid #e3d6c1}.note{color:#6f604f;font-size:13px}nav{font-size:14px;margin-bottom:18px}footer{margin-top:40px;font-size:13px}</style>
</head><body><nav><a href="${SITE}">${name}</a> · <a href="${lang(L) ? zh : en}" hreflang="${lang(L) ? 'zh-Hans' : 'en'}">${lang(L) ? '中文' : 'English'}</a></nav>
${body}
<p><a class="open" href="${app}">${lang(L) ? 'Open in Sparrow Film Passport →' : '在麻雀观影护照中打开 →'}</a></p>
<footer class="note">${lang(L) ? 'Schedules may change; the app shows the latest.' : '排片可能调整，以观影护照内为准。'} · <a href="${SITE}">${name}</a></footer></body></html>`;
};
const docUrls = [];
for (const L of ['zh', 'en']) {
  Object.values(films).forEach(f => {
    if (f.ev) return;
    const e = enF(f.id, L), t = title(f, L), orig = lang(L) ? (f.cn !== t ? f.cn : f.o) : (f.en || f.o);
    const dirs = lang(L) ? (e.dir || f.dirO || f.dir) : f.dir, country = lang(L) ? trW(f.c) : f.c;
    const genre = (f.genre || []).map(g => lang(L) ? trW(g) : g).filter(Boolean).join(' / ');
    const syn = lang(L) ? e.syn : f.syn, honors = (lang(L) ? e.honors : f.honors) || [];
    const pl = [...(filmProgs[f.id] || [])].map(pid => progs.find(p => p.id === pid)).filter(Boolean);
    const up = shows.filter(s => s.id === f.id && showTime(s) > now).sort((a, b) => showTime(a) - showTime(b)).slice(0, 12);
    const img = abs(f.poster);
    const ttl = t + (f.y ? ` (${f.y})` : '');
    const desc = clip([dirs, pl.map(p => progName(p, L)).join(' / '), syn].filter(Boolean).join(' · '), 160);
    const info = [f.y, country, f.min ? (lang(L) ? f.min + ' min' : f.min + ' 分钟') : '', f.version ? (lang(L) ? trW(f.version) || f.version : f.version) : ''].filter(Boolean).join(' ｜ ');
    const body = `<header>${img ? `<img src="${esc(img)}" alt="${esc(t)}">` : ''}<div><h1>${esc(ttl)}</h1>${orig && orig !== t ? `<p class="meta">${esc(orig)}</p>` : ''}
${dirs ? `<p class="meta">${lang(L) ? 'Director: ' : '导演：'}${esc(dirs)}</p>` : ''}${info ? `<p class="meta">${esc(info)}</p>` : ''}${genre ? `<p class="meta">${esc(genre)}</p>` : ''}
${pl.length ? `<p class="meta">${pl.map(p => `<a href="${docURL('programme', p.id, L)}">${esc(progName(p, L))}</a>`).join(' · ')}</p>` : ''}</div></header>
${syn ? `<h2>${lang(L) ? 'Synopsis' : '剧情简介'}</h2><p>${esc(syn)}</p>` : ''}
${honors.length ? `<h2>${lang(L) ? 'Festivals & Awards' : '影展与荣誉'}</h2><ul>${honors.map(h => `<li>${honorRow(h, L)}</li>`).join('')}</ul>` : ''}
${up.length ? `<h2>${lang(L) ? 'Upcoming screenings' : '近期放映'}</h2><ul>${up.map(s => `<li>${s.year}.${s.d.replace('/', '.')} ${s.t} · ${esc(venueOf(s, L))}</li>`).join('')}</ul>` : ''}`;
    const ld = { '@context': 'https://schema.org', '@type': 'Movie', name: t, url: docURL('film', f.id, L), inLanguage: lang(L) ? 'en' : 'zh-Hans' };
    if (orig && orig !== t) ld.alternateName = orig;
    if (dirs) ld.director = String(dirs).split(/[\/、,，]\s*/).filter(Boolean).map(n => ({ '@type': 'Person', name: n.trim() }));
    if (f.y) ld.dateCreated = String(f.y);
    if (img) ld.image = img;
    if (syn) ld.description = clip(syn, 300);
    if (+f.min > 0) ld.duration = 'PT' + (+f.min) + 'M';
    if (country) ld.countryOfOrigin = country;
    out(`${lang(L) ? 'en/' : ''}film/${f.id}.html`, docPage({ L, kind: 'film', id: f.id, ttl, desc, img, body, ld, hash: '#film-' + f.id }));
    if (L === 'zh') docUrls.push(['film', f.id]);
  });
  progs.forEach(p => {
    const o = lang(L) && EN.programmes[p.id] || {}, nm = o.name || p.name, blurb = o.blurb || p.blurb || o.sub || p.sub || '';
    const ids = new Set([...(p.pk.films || []).map(f => f.id), ...shows.filter(s => s.p === p.id).map(s => s.id)]);
    const list = [...ids].map(id => films[id]).filter(f => f && !f.ev);
    const img = abs(o.cover || p.cardCover || p.cover);
    const body = `<h1>${esc(nm)}</h1><p class="meta">${esc([p.period, lang(L) ? '' : p.city].filter(Boolean).join(' · '))}</p>${img ? `<p><img src="${esc(img)}" alt="" style="width:100%;border-radius:8px"></p>` : ''}
${blurb ? `<p>${esc(blurb)}</p>` : ''}${list.length ? `<h2>${lang(L) ? 'Films' : '片单'}（${list.length}）</h2><ul>${list.map(f => `<li><a href="${docURL('film', f.id, L)}">${esc(title(f, L))}</a>${f.y ? ` <span class="note">${f.y}</span>` : ''}</li>`).join('')}</ul>` : ''}`;
    out(`${lang(L) ? 'en/' : ''}programme/${p.id}.html`, docPage({ L, kind: 'programme', id: p.id, ttl: nm, desc: clip(`${p.period} · ${blurb}`, 160), img, body, hash: '#prog-' + p.id }));
    if (L === 'zh') docUrls.push(['programme', p.id]);
  });
}

// ---------- 站点地图（搜索引擎用，robots.txt 里登记；每个网址带中英文 hreflang）----------
{
  const day = new Date().toISOString().slice(0, 10);
  const alt = (k, id) => `<xhtml:link rel="alternate" hreflang="zh-Hans" href="${docURL(k, id, 'zh')}"/><xhtml:link rel="alternate" hreflang="en" href="${docURL(k, id, 'en')}"/><xhtml:link rel="alternate" hreflang="x-default" href="${docURL(k, id, 'zh')}"/>`;
  const rows = [`  <url><loc>${SITE}</loc><lastmod>${day}</lastmod></url>`];
  docUrls.forEach(([k, id]) => { for (const L of ['zh', 'en']) rows.push(`  <url><loc>${docURL(k, id, L)}</loc><lastmod>${day}</lastmod>${alt(k, id)}</url>`); });
  out('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + rows.join('\n') + '\n</urlset>\n');
  console.log('content pages ' + docUrls.length * 2 + ', sitemap ' + rows.length + ' URLs');
}

// ---------- 可订阅日历 ----------
const esci = s => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\;');
const fold = line => { const b = Buffer.from(line, 'utf8'); if (b.length <= 74) return line; const parts = []; let cur = ''; for (const ch of line) { if (Buffer.byteLength(cur + ch) > (parts.length ? 73 : 74)) { parts.push(cur); cur = ch; } else cur += ch; } parts.push(cur); return parts.join('\r\n '); };
const DTS = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z/, 'Z');
const ics = (calName, list, L) => {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SparrowCinema//Sparrow Film Passport//' + (lang(L) ? 'EN' : 'ZH'), 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + esci(calName), 'X-WR-TIMEZONE:Asia/Shanghai', 'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H',
    'BEGIN:VTIMEZONE', 'TZID:Asia/Shanghai', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0800', 'TZOFFSETTO:+0800', 'TZNAME:CST', 'END:STANDARD', 'END:VTIMEZONE'];
  list.forEach(s => {
    const f = films[s.id], p = progs.find(x => x.id === s.p), st = dt(s), en = addMin(st, dur(s)), note = f.screeningNotes && f.screeningNotes[keyOf(s)], e = enF(f.id, L), nt = lang(L) && e.screeningNotes && e.screeningNotes[keyOf(s)] || note;
    const t = (s.archive ? (lang(L) ? '[User archive] ' : '【用户指定存档】') : '') + title(f, L) + (f.version ? ' · ' + f.version : '');
    lines.push('BEGIN:VEVENT', 'UID:' + encodeURIComponent(keyOf(s)) + '@style-kaleidoscope', 'DTSTAMP:' + DTS, 'DTSTART;TZID=Asia/Shanghai:' + stamp(st), 'DTEND;TZID=Asia/Shanghai:' + stamp(en), 'SUMMARY:' + esci(t), 'LOCATION:' + esci(venueOf(s, L)),
      'DESCRIPTION:' + esci([progName(p, L), nt, SITE + (lang(L) ? 's/en/' : 's/') + 'f/' + f.id + '.html'].filter(Boolean).join('\n')), 'URL:' + SITE + (lang(L) ? 's/en/' : 's/') + 'f/' + f.id + '.html', 'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
};
let nCal = 0;
for (const L of ['zh', 'en']) {
  const dir = lang(L) ? 'cal/en/' : 'cal/';
  progs.forEach(p => { out(dir + p.id + '.ics', ics((lang(L) ? 'Sparrow Film Passport · ' : '麻雀观影护照 · ') + progName(p, L), shows.filter(s => s.p === p.id), L)); nCal++; });
  out(dir + 'all.ics', ics(lang(L) ? 'Sparrow Film Passport · All programmes' : '麻雀观影护照 · 全部专题', shows, L)); nCal++;
}
console.log('share pages', nShare, 'calendars', nCal);
