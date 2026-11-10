// 部署时生成（GitHub Actions 里运行，生成物不提交）：
//  1) s/f/<影片id>.html、s/en/f/<影片id>.html、s/p/<专题id>.html、s/en/p/<专题id>.html：带 Open Graph / Twitter 卡片的分享页，
//     供 WhatsApp、X、Telegram、微信等抓取预览，浏览器打开后自动跳转到 index.html 对应的影片/专题。
//  2) cal/<专题id>.ics、cal/en/<专题id>.ics、cal/all.ics：可订阅日历（webcal://），场次变动后订阅者自动同步。
// 本地预览：node tools/build-extras.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const SITE = 'https://sparrowcinema.github.io/SparrowTribe/';
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

// ---------- 分享页 ----------
const page = ({ L, kind, id, ttl, desc, img, wide, hash, bare }) => {
  const rel = (lang(L) ? 's/en/' : 's/') + kind + '/' + id + '.html', url = SITE + rel;
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
