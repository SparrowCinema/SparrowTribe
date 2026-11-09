/* 我的趣味图谱长图：规则 + 模板组合生成「趣味人格」命名与分析（不调用 AI，离线即时生成）。
   同一批评分得到同一结果；评分变化后命名与文案随之变化。
   命名＝形容词（有趣/无聊均分 16 格 × 4）+ 偏好（类型 / 年代 / 地区，约 45 种）+ 身份（主象限 × 起伏 15 格 × 3），
   约 64 × 45 × 45 ≈ 13 万种；分析段落每段 3–4 种句式，再代入数字与片名。
   网站直接加载；小程序副本由 node tools/build-fallback.js 复制到 miniprogram/utils/taste-report.js。 */
(function (root) {
  'use strict';
  const W = 1080, P = 64;
  const SERIF = '"Noto Serif SC","Songti SC",serif', SANS = '"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif', MONO = '"IBM Plex Mono",Menlo,monospace';
  const C = { paper: '#efe6d4', card: '#f8f2e6', ink: '#2b2117', muted: '#7a6a55', line: '#d8cbb1', red: '#8e2a22', gold: '#d9bc80', teal: '#2f6f6c' };
  const QC = ['#7a5a8c', '#a8541d', '#2f5d8a', '#2f6f6c']; // 漫长难熬 / 迷人又折磨 / 平静无波 / 趣味横生
  const QN = [['漫长难熬', 'Enduring'], ['迷人又折磨', 'Captivating & tiring'], ['平静无波', 'Quiet'], ['趣味横生', 'Delightful']];
  const valid = v => typeof v === 'number' && v >= 0 && v <= 5;
  function hash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  const pick = (arr, seed, salt) => arr[hash(seed + '|' + salt) % arr.length];
  function quadrant(x, y) { return x === 3 || y === 3 ? -1 : y > 3 ? (x > 3 ? 1 : 0) : (x > 3 ? 3 : 2); }
  function pos(v) { return v <= 3 ? 12 + v * (38 / 3) : 50 + (v - 3) * 19; }
  const f1 = v => (Math.round(v * 10) / 10).toFixed(1);
  const lvl = v => v < 2.25 ? 0 : v < 3 ? 1 : v < 3.75 ? 2 : 3;

  // ---- 命名词库 ----
  // 形容词：[有趣度档][无聊度档]，每格 4 个
  const ADJ = {
    zh: [
      [['挑剔的', '冷眼的', '难以取悦的', '严苛的'], ['审慎的', '克制的', '不轻易心动的', '冷静的'], ['耐心的', '沉得住气的', '温吞的', '能熬的'], ['坚忍的', '苦行的', '执拗的', '自找罪受的']],
      [['淡定的', '佛系的', '慢热的', '安静的'], ['中庸的', '平和的', '清淡的', '随遇而安的'], ['犹疑的', '矛盾的', '半信半疑的', '摇摆的'], ['倔强的', '硬撑的', '耐熬的', '执着的']],
      [['松弛的', '轻快的', '好奇的', '温和的'], ['敏锐的', '清醒的', '有分寸的', '会挑的'], ['多情的', '复杂的', '暧昧的', '纠结的'], ['矛盾的', '自虐的', '痴迷的', '两极的']],
      [['热烈的', '雀跃的', '贪玩的', '好胃口的'], ['眼光毒辣的', '会玩的', '机敏的', '心明眼亮的'], ['上头的', '狂热的', '深陷的', '不设防的'], ['极端的', '燃烧的', '疯魔的', '爱恨分明的']]
    ],
    en: [
      [['Picky', 'Cool-eyed', 'Hard-to-please', 'Exacting'], ['Measured', 'Reserved', 'Unhurried', 'Cool-headed'], ['Patient', 'Steady', 'Long-suffering', 'Stoic'], ['Ascetic', 'Unbending', 'Stubborn', 'Gluttonous-for-punishment']],
      [['Easygoing', 'Zen', 'Slow-burning', 'Quiet'], ['Balanced', 'Mild', 'Even-keeled', 'Go-with-the-flow'], ['Wavering', 'Torn', 'Ambivalent', 'Swaying'], ['Dogged', 'Persistent', 'Hardy', 'Determined']],
      [['Relaxed', 'Breezy', 'Curious', 'Gentle'], ['Sharp', 'Clear-eyed', 'Discerning', 'Choosy'], ['Romantic', 'Complicated', 'Ambiguous', 'Conflicted'], ['Contradictory', 'Masochistic', 'Obsessed', 'Polarised']],
      [['Ardent', 'Exuberant', 'Playful', 'Hungry'], ['Keen-eyed', 'Savvy', 'Quick-witted', 'Bright-eyed'], ['Hooked', 'Fervent', 'Smitten', 'Unguarded'], ['Extreme', 'Blazing', 'Possessed', 'All-or-nothing']]
    ]
  };
  // 身份：[主象限 0–3 / 4=均衡][起伏 0 稳 / 1 中 / 2 大]，每格 3 个
  const NOUN = {
    zh: [
      [['守夜人', '苦修者', '长跑者'], ['熬片人', '耐力型观众', '夜行者'], ['受难者', '殉道者', '孤勇者']],
      [['痴迷者', '共犯', '囚徒'], ['探险家', '冒险者', '深潜者'], ['赌徒', '驯兽师', '过山车乘客']],
      [['观潮者', '静修者', '旁观者'], ['散步者', '漫游者', '摆渡人'], ['潜水员', '拾荒者', '寻宝人']],
      [['享乐家', '派对动物', '开心果'], ['淘金者', '猎奇者', '寻欢客'], ['追光者', '烟火师', '冲浪者']],
      [['平衡术士', '调音师', '品鉴师'], ['杂食者', '收藏家', '策展人'], ['万花筒', '变色龙', '拼图玩家']]
    ],
    en: [
      [['Night Watcher', 'Ascetic', 'Marathoner'], ['Endurance Viewer', 'Night Walker', 'Long-Hauler'], ['Martyr', 'Lone Brave', 'Pilgrim']],
      [['Devotee', 'Accomplice', 'Willing Captive'], ['Explorer', 'Adventurer', 'Deep Diver'], ['Gambler', 'Tamer', 'Rollercoaster Rider']],
      [['Tide Watcher', 'Contemplative', 'Observer'], ['Stroller', 'Wanderer', 'Ferryman'], ['Diver', 'Scavenger', 'Treasure Hunter']],
      [['Hedonist', 'Party Animal', 'Joy Seeker'], ['Gold Panner', 'Thrill Seeker', 'Pleasure Hunter'], ['Light Chaser', 'Pyrotechnician', 'Surfer']],
      [['Balancer', 'Tuner', 'Connoisseur'], ['Omnivore', 'Collector', 'Curator'], ['Kaleidoscope', 'Chameleon', 'Puzzle Player']]
    ]
  };
  // 偏好：类型 / 年代 / 地区
  const GENRE = { '剧情': ['剧情片', 'Drama'], '喜剧': ['喜剧', 'Comedy'], '纪录片': ['纪录片', 'Documentary'], '纪录': ['纪录片', 'Documentary'], '爱情': ['爱情片', 'Romance'], '惊悚': ['惊悚片', 'Thriller'], '犯罪': ['黑色犯罪', 'Crime'], '动作': ['动作片', 'Action'], '悬疑': ['悬疑片', 'Mystery'], '动画': ['动画', 'Animation'], '科幻': ['科幻', 'Sci-fi'], '奇幻': ['奇幻', 'Fantasy'], '历史': ['历史片', 'Period'], '恐怖': ['恐怖片', 'Horror'], '短片': ['短片', 'Shorts'], '音乐': ['音乐片', 'Music'], '冒险': ['冒险片', 'Adventure'], '家庭': ['家庭片', 'Family'], '战争': ['战争片', 'War'], '运动': ['运动片', 'Sports'], '传记': ['传记片', 'Biopic'], '武侠': ['武侠片', 'Wuxia'], '古装': ['古装片', 'Costume'], '歌舞': ['歌舞片', 'Musical'], '西部': ['西部片', 'Western'] };
  const REGION = { cn: ['华语片', 'Chinese-language'], eu: ['欧洲片', 'European'], us: ['美国片', 'American'], as: ['亚洲片', 'Asian'], me: ['非洲片', 'African'], la: ['拉美片', 'Latin American'] };
  const DECADE = d => d < 1950 ? ['老电影', 'Golden-age'] : d < 1980 ? [(d % 100) + '年代', d + 's'] : d < 2000 ? [['八', '九'][(d - 1980) / 10] + '十年代', d + 's'] : d < 2020 ? ['新世纪', 'New-century'] : ['当代', 'Contemporary'];

  function analyze(entries, opts) {
    opts = opts || {}; const en = !!opts.en, L = en ? 1 : 0, T = opts.T || (x => x);
    const rows = (entries || []).filter(e => e && e.f && !e.f.ev && e.rec && !e.rec.del && valid(e.rec.fun) && valid(e.rec.bore))
      .map(e => ({ id: e.id, title: en ? (e.f.en || e.f.cn) : e.f.cn, f: e.f, fun: e.rec.fun, bore: e.rec.bore, r: e.rec.r || 0 }));
    const n = rows.length, out = { n, ok: n >= 3, en };
    if (!out.ok) return out;
    const seed = rows.map(x => x.id + ':' + x.fun + ':' + x.bore).sort().join(',');
    const avgF = rows.reduce((s, x) => s + x.fun, 0) / n, avgB = rows.reduce((s, x) => s + x.bore, 0) / n;
    const q = [0, 0, 0, 0]; let unsure = 0; rows.forEach(x => { const k = quadrant(x.fun, x.bore); if (k < 0) unsure++; else q[k]++; });
    const sd = a => { const m = a.reduce((s, v) => s + v, 0) / a.length; return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / a.length); };
    const spreadV = (sd(rows.map(x => x.fun)) + sd(rows.map(x => x.bore))) / 2, spread = spreadV < 0.8 ? 0 : spreadV < 1.35 ? 1 : 2;
    const corr = (a, b) => { const ma = a.reduce((s, v) => s + v, 0) / a.length, mb = b.reduce((s, v) => s + v, 0) / b.length; let x = 0, ya = 0, yb = 0; a.forEach((v, i) => { x += (v - ma) * (b[i] - mb); ya += (v - ma) ** 2; yb += (b[i] - mb) ** 2; }); return ya && yb ? x / Math.sqrt(ya * yb) : 0; };
    const rFB = corr(rows.map(x => x.fun), rows.map(x => x.bore));
    const rated = rows.filter(x => x.r), rStar = rated.length >= 3 ? corr(rated.map(x => x.r), rated.map(x => x.fun)) : null;
    const top = Math.max(...q), dom = top / n >= 0.4 ? q.indexOf(top) : 4, empty = q.indexOf(Math.min(...q));
    // 偏好：在「有趣度 ≥ 4」的影片里找最集中的类型 / 地区 / 年代
    const liked = rows.filter(x => x.fun >= 4).length >= 2 ? rows.filter(x => x.fun >= 4) : rows.slice().sort((a, b) => b.fun - a.fun).slice(0, Math.max(2, Math.ceil(n / 3)));
    const tally = (arr, key) => { const m = new Map(); arr.forEach(x => [].concat(key(x) || []).forEach(k => { if (k) m.set(k, (m.get(k) || 0) + 1); })); return [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))); };
    const gT = tally(liked, x => (x.f.genre || []).filter(g => g !== '剧情' && GENRE[g])), rT = tally(liked, x => REGION[x.f.reg] ? x.f.reg : null), dT = tally(liked, x => /^\d{4}$/.test(String(x.f.y)) ? Math.floor(+x.f.y / 10) * 10 : null);
    const cand = [];
    if (gT[0]) cand.push({ k: 'genre', v: gT[0][0], s: gT[0][1] / liked.length + 0.05, w: GENRE[gT[0][0]] });
    if (rT[0]) cand.push({ k: 'region', v: rT[0][0], s: rT[0][1] / liked.length - 0.1, w: REGION[rT[0][0]] });
    if (dT[0]) cand.push({ k: 'decade', v: dT[0][0], s: dT[0][1] / liked.length - 0.05, w: DECADE(dT[0][0]) });
    cand.sort((a, b) => b.s - a.s);
    const pref = cand[0] && cand[0].s >= 0.3 ? cand[0] : null;
    // 命名
    const adj = pick(ADJ[en ? 'en' : 'zh'][lvl(avgF)][lvl(avgB)], seed, 'adj'), noun = pick(NOUN[en ? 'en' : 'zh'][dom][spread], seed, 'noun');
    out.persona = en ? 'The ' + adj + ' ' + (pref ? pref.w[1] + ' ' : '') + noun : adj + (pref ? pref.w[0] : '') + noun;
    // 片名
    const by = (fn) => rows.slice().sort((a, b) => fn(b) - fn(a) || a.title.localeCompare(b.title))[0];
    const mostFun = by(x => x.fun - x.bore * 0.01), mostBore = by(x => x.bore - x.fun * 0.01), contrast = rows.filter(x => x.fun >= 4 && x.bore >= 4 && x.id !== mostFun.id && x.id !== mostBore.id).sort((a, b) => (b.fun + b.bore) - (a.fun + a.bore))[0] || null;
    const qName = k => QN[k][L], pct = k => Math.round(q[k] / n * 100);
    const S = []; // 段落
    // 1 总览
    S.push(pick(en ? [
      `Across ${n} films you averaged ${f1(avgF)} for interesting and ${f1(avgB)} for boring.`,
      `${n} films on the map: interesting averages ${f1(avgF)}, boring ${f1(avgB)}.`,
      `Your ${n} rated films land at ${f1(avgF)} interesting and ${f1(avgB)} boring on average.`
    ] : [
      `你在 ${n} 部电影上给出了趣味评分：有趣度平均 ${f1(avgF)}，无聊度平均 ${f1(avgB)}。`,
      `图谱里一共 ${n} 部电影，有趣度均值 ${f1(avgF)}、无聊度均值 ${f1(avgB)}。`,
      `统计你打过分的 ${n} 部电影，有趣度落在 ${f1(avgF)}，无聊度落在 ${f1(avgB)}。`,
      `${n} 部电影、两把尺子：平均有趣 ${f1(avgF)}，平均无聊 ${f1(avgB)}。`
    ], seed, 's1'));
    // 2 主象限
    if (dom < 4) S.push(pick(en ? [
      `${pct(dom)}% of them sit in “${qName(dom)}”, which is your home ground.`,
      `Your centre of gravity is “${qName(dom)}”, with ${q[dom]} films (${pct(dom)}%).`,
      `Most of your films gather in “${qName(dom)}” (${pct(dom)}%).`
    ] : [
      `其中 ${pct(dom)}% 落在「${qName(dom)}」，这是你最常停留的地带。`,
      `你的重心在「${qName(dom)}」：${q[dom]} 部，占 ${pct(dom)}%。`,
      `「${qName(dom)}」收下了你 ${pct(dom)}% 的电影，几乎就是你的主场。`,
      `${q[dom]} 部电影挤在「${qName(dom)}」，比例达到 ${pct(dom)}%。`
    ], seed, 's2' + dom));
    else S.push(pick(en ? [
      `No single quadrant dominates: your films are spread across the map.`,
      `Your map is balanced, with no quadrant holding more than 40%.`
    ] : [
      `四个象限分布得相当均匀，没有哪一类超过四成，你几乎什么都看、也什么都能接受。`,
      `你的图谱没有明显的主场，四个象限各有落点，口味相当开阔。`,
      `没有一个象限占到 40%，你像是在每个角落都留下了脚印。`
    ], seed, 's2b'));
    // 3 有趣与无聊的关系
    S.push(pick(rFB < -0.45 ? (en ? [
      `For you, interesting and boring pull in opposite directions: when one rises, the other falls.`,
      `Your two scales move like a seesaw. A film that grips you rarely feels long.`
    ] : [
      `对你来说，有趣和无聊基本此消彼长：一部片抓住你，就很少让你觉得漫长。`,
      `你的两把尺子像跷跷板，一边高，另一边就低。`,
      `有趣度越高，无聊度越低。你的感受相当直接。`
    ]) : rFB > 0.25 ? (en ? [
      `Unusually, your interesting and boring scores rise together: the films that fascinate you also test you.`,
      `You often rate both high at once. Demanding films are part of your pleasure.`
    ] : [
      `少见的是，你的有趣度和无聊度会一起升高：越吸引你的电影，往往也越磨人。`,
      `你常常给同一部片两项都打高分，「难看懂但好看」正是你的乐趣所在。`,
      `你并不怕闷，甚至会被闷住的电影迷住。`
    ]) : (en ? [
      `Your interesting and boring scores are largely independent, so you judge the two separately.`,
      `You keep the two scales apart: being boring does not cancel out being interesting.`
    ] : [
      `你的有趣度和无聊度彼此独立：觉得闷，不代表就不好看。`,
      `你把「有趣」和「无聊」分开看，两项评分并不互相牵连。`,
      `两项评分没有固定的关系，你会认真分别回答这两个问题。`
    ]), seed, 's3'));
    // 4 代表作
    const ex = [];
    if (mostFun) ex.push(en ? `“${mostFun.title}” is your most interesting (${f1(mostFun.fun)})` : `最有趣的是《${mostFun.title}》（${f1(mostFun.fun)}）`);
    if (mostBore && mostBore.id !== mostFun.id) ex.push(en ? `“${mostBore.title}” felt the longest (${f1(mostBore.bore)})` : `最难熬的是《${mostBore.title}》（${f1(mostBore.bore)}）`);
    if (contrast) ex.push(en ? `and “${contrast.title}” was both captivating and tiring` : `而《${contrast.title}》又迷人又折磨`);
    if (ex.length) S.push(ex.join(en ? '; ' : '；') + (en ? '.' : '。'));
    // 5 偏好
    if (pref) S.push(pick(en ? [
      `Among the films you found most interesting, ${pref.w[1]} titles stand out.`,
      `Your high scores lean towards ${pref.w[1]} films.`
    ] : [
      `在你觉得最有趣的电影里，「${pref.w[0]}」出现得最多。`,
      `你的高分偏爱${pref.w[0]}，这大概就是你的舒适区。`,
      `让你眼前一亮的电影里，${pref.w[0]}占了不小的比例。`
    ], seed, 's5'));
    // 6 星级与有趣度
    if (rStar !== null) S.push(pick(rStar > 0.6 ? (en ? [`Your star ratings closely follow how interesting a film was.`] : [`你的十分制星级几乎跟着有趣度走：好不好看，主要看有没有趣。`, `星级和有趣度高度一致，你给高分的电影通常也最有趣。`])
      : rStar < 0.2 ? (en ? [`Your star ratings and interesting scores often disagree: you separate quality from enjoyment.`] : [`你的星级和有趣度经常不一致：你会把「好电影」和「有趣」分开评价。`, `给高分的不一定有趣，有趣的也不一定拿高分，你的评价标准很立体。`])
        : (en ? [`Your star ratings partly track how interesting a film was.`] : [`星级和有趣度有一定关联，但你也会为不那么有趣的好电影加分。`]), seed, 's6'));
    // 7 社区
    if (opts.community) { const d = rows.map(x => { const c = opts.community(x.id); return c ? Math.abs(c.fun - x.fun) + Math.abs(c.bore - x.bore) : null; }).filter(v => v !== null);
      if (d.length >= 3) { const m = d.reduce((s, v) => s + v, 0) / d.length; S.push(m < 1.2 ? (en ? `You are close to the community consensus on ${d.length} shared films.` : `在 ${d.length} 部有社区评分的电影上，你和大家的感受相当接近。`) : m > 2.2 ? (en ? `On ${d.length} shared films you often disagree with the community: an independent palate.` : `在 ${d.length} 部有社区评分的电影上，你经常和大家意见不同，口味相当独立。`) : (en ? `On ${d.length} shared films you agree with the community about half the time.` : `在 ${d.length} 部有社区评分的电影上，你和大家时而一致、时而分歧。`)); } }
    // 8 建议
    if (q[empty] === 0 || q[empty] / n < 0.12) S.push(pick(en ? [
      `“${qName(empty)}” is still almost empty. Next time, try a film you expect to land there.`,
      `Few of your films sit in “${qName(empty)}”. That corner may hold your next surprise.`
    ] : [
      `「${qName(empty)}」几乎还是空的，下次不妨挑一部可能落在那里的电影。`,
      `「${qName(empty)}」很少有你的电影，也许下一个惊喜就在那个角落。`,
      `想让图谱更完整？去「${qName(empty)}」那一格探探路。`
    ], seed, 's8'));
    out.tagline = pick(en ? ['A map drawn by your own two scales.', 'Two scales, one viewer.', 'Where your films land.'] : ['两把尺子量出来的观影性格', '有趣和无聊，也能画成一张地图', '你的电影都落在了哪里'], seed, 'tag');
    out.paras = S; out.q = q; out.unsure = unsure; out.avgF = avgF; out.avgB = avgB; out.dom = dom;
    out.rows = rows; out.picks = [mostFun && [en ? 'Most interesting' : '最有趣', mostFun], mostBore && mostBore.id !== mostFun.id && [en ? 'Felt longest' : '最难熬', mostBore], contrast && [en ? 'Captivating & tiring' : '最反差', contrast]].filter(Boolean);
    return out;
  }

  // ---- 画布 ----
  const CJK = /[　-〿㐀-鿿＀-￯]/;
  function wrap(c, text, max) { text = String(text || ''); const out = []; let line = ''; if (!CJK.test(text) && /\s/.test(text)) text.split(/\s+/).forEach(w => { const t = line ? line + ' ' + w : w; if (c.measureText(t).width > max && line) { out.push(line); line = w; } else line = t; }); else for (const ch of text) { if (c.measureText(line + ch).width > max && line) { out.push(line); line = ch; } else line += ch; } if (line) out.push(line); for (let i = 1; i < out.length; i++) { const m = out[i].match(/^[：:，,、。.！!？?）)」』·；;]+/); if (m) { out[i - 1] += m[0]; out[i] = out[i].slice(m[0].length); } } return out.filter(Boolean); }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  const HEAD = 560, CHART = 860, STATS = 210, FOOT = 420, PARA_LH = 50, PICK = 92;
  function layout(c, a) { c.font = '400 32px ' + SANS; const lines = (a.paras || []).map(p => wrap(c, p, W - 2 * P - 72)); const paraH = 120 + lines.reduce((s, l) => s + l.length * PARA_LH + 22, 0) + 30; return { lines, paraH, picksH: a.picks && a.picks.length ? 110 + a.picks.length * PICK : 0 }; }
  function heightOf(c, a) { if (!a || !a.ok) return 0; const g = layout(c, a); return HEAD + CHART + STATS + g.paraH + g.picksH + FOOT; }

  function draw(c, a, o) {
    o = o || {}; const T = o.T || (x => x), en = a.en, g = layout(c, a), H = heightOf(c, a);
    c.textBaseline = 'alphabetic'; c.textAlign = 'left'; c.fillStyle = C.paper; c.fillRect(0, 0, W, H);
    // 页眉
    const gr = c.createLinearGradient(0, 0, W, HEAD); gr.addColorStop(0, '#2a3b3a'); gr.addColorStop(1, '#16201f'); c.fillStyle = gr; c.fillRect(0, 0, W, HEAD);
    c.strokeStyle = C.gold; c.globalAlpha = 0.7; c.lineWidth = 2; c.strokeRect(28, 28, W - 56, HEAD - 56); c.lineWidth = 1; c.strokeRect(38, 38, W - 76, HEAD - 76); c.globalAlpha = 1;
    c.fillStyle = C.gold; c.font = '600 22px ' + MONO; c.fillText('SPARROW FILM PASSPORT · MY TASTE MAP', P + 10, 112);
    const h = String(o.holder || '').trim(), title = en ? (h ? h + "'s Taste Map" : 'My Taste Map') : (h || '我') + '的趣味图谱';
    c.fillStyle = '#fffaf0'; c.font = '900 58px ' + SERIF; c.fillText(title, P + 10, 196);
    c.fillStyle = C.gold; c.font = '600 24px ' + SANS; c.fillText(en ? 'YOUR TASTE PERSONA' : '你的趣味人格', P + 10, 268);
    let fz = en ? 60 : 76; c.font = '900 ' + fz + 'px ' + SERIF; while (fz > 36 && c.measureText(a.persona).width > W - 2 * P - 20) { fz -= 2; c.font = '900 ' + fz + 'px ' + SERIF; }
    c.fillStyle = '#fffaf0'; c.fillText(a.persona, P + 10, 268 + fz + 20);
    c.font = '400 26px ' + SANS; c.globalAlpha = 0.8; c.fillText(a.tagline + (en ? ' · ' : ' · ') + a.n + (en ? ' films' : ' 部电影'), P + 10, 268 + fz + 78); c.globalAlpha = 1;
    c.fillStyle = C.gold; c.fillRect(P + 10, HEAD - 92, 64, 3); c.fillStyle = '#fffaf0'; c.globalAlpha = 0.7; c.font = '400 22px ' + SANS; c.fillText(T('麻雀观影护照') + ' · ' + T('麻雀映画 × 麻雀部落'), P + 10, HEAD - 54); c.globalAlpha = 1;
    // 四象限图
    let y = HEAD + 70; c.fillStyle = C.ink; c.font = '900 40px ' + SERIF; c.fillText(en ? 'Quadrants' : '四象限', P, y); c.fillStyle = C.muted; c.font = '400 24px ' + SANS; c.fillText(en ? 'Interesting →   ↑ Boring' : '横轴有趣度 →　纵轴无聊度 ↑', P + (en ? 230 : 160), y);
    const bx = P, by = y + 36, bw = W - 2 * P, bh = CHART - 150;
    c.fillStyle = C.card; rr(c, bx, by, bw, bh, 20); c.fill(); c.strokeStyle = C.line; c.lineWidth = 2; c.stroke();
    const qr = [[bx, by, bw / 2, bh / 2, 0], [bx + bw / 2, by, bw / 2, bh / 2, 1], [bx, by + bh / 2, bw / 2, bh / 2, 2], [bx + bw / 2, by + bh / 2, bw / 2, bh / 2, 3]];
    qr.forEach(([x, yy, w, hh, k]) => { c.save(); rr(c, bx, by, bw, bh, 20); c.clip(); c.fillStyle = QC[k]; c.globalAlpha = 0.07; c.fillRect(x, yy, w, hh); c.restore(); c.globalAlpha = 1; c.fillStyle = QC[k]; c.font = '700 26px ' + SANS; const lab = QN[k][en ? 1 : 0] + '  ' + a.q[k]; c.textAlign = k % 2 ? 'right' : 'left'; c.fillText(lab, k % 2 ? x + w - 24 : x + 24, k < 2 ? yy + 44 : yy + hh - 24); c.textAlign = 'left'; });
    c.strokeStyle = C.line; c.setLineDash && c.setLineDash([8, 8]); c.beginPath(); c.moveTo(bx + bw / 2, by + 16); c.lineTo(bx + bw / 2, by + bh - 16); c.moveTo(bx + 16, by + bh / 2); c.lineTo(bx + bw - 16, by + bh / 2); c.stroke(); c.setLineDash && c.setLineDash([]);
    const groups = new Map(); a.rows.forEach(x => { const k = x.fun + '-' + x.bore; if (!groups.has(k)) groups.set(k, { fun: x.fun, bore: x.bore, n: 0 }); groups.get(k).n++; });
    groups.forEach(gp => { const px = bx + pos(gp.fun) / 100 * bw, py = by + (100 - pos(gp.bore)) / 100 * bh, k = quadrant(gp.fun, gp.bore), R = Math.min(34, 14 + gp.n * 4);
      c.fillStyle = k < 0 ? C.muted : QC[k]; c.globalAlpha = 0.9; c.beginPath(); c.arc(px, py, R, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; c.strokeStyle = '#fffaf0'; c.lineWidth = 3; c.stroke();
      if (gp.n > 1) { c.fillStyle = '#fffaf0'; c.font = '700 ' + (R > 24 ? 24 : 20) + 'px ' + SANS; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(gp.n), px, py + 1); c.textAlign = 'left'; c.textBaseline = 'alphabetic'; } });
    // 统计
    y = HEAD + CHART; const cells = [[f1(a.avgF), en ? 'Avg interesting' : '平均有趣度'], [f1(a.avgB), en ? 'Avg boring' : '平均无聊度'], [String(a.unsure), en ? 'Hard to classify' : '难以归类'], [String(a.n), en ? 'Films mapped' : '上图影片']], cw = (W - 2 * P - 36) / 4;
    cells.forEach(([v, l], i) => { const x = P + i * (cw + 12); c.fillStyle = C.card; rr(c, x, y, cw, 150, 18); c.fill(); c.fillStyle = C.teal; c.font = '800 52px ' + SERIF; c.fillText(v, x + 26, y + 76); c.fillStyle = C.muted; c.font = '400 22px ' + SANS; c.fillText(l, x + 26, y + 120); });
    // 分析
    y += STATS; c.fillStyle = C.ink; c.font = '900 40px ' + SERIF; c.fillText(en ? 'Reading' : '趣味分析', P, y + 50);
    c.fillStyle = C.card; rr(c, P, y + 80, W - 2 * P, g.paraH - 110, 20); c.fill();
    let ty = y + 80 + 62; c.font = '400 32px ' + SANS; c.fillStyle = C.ink; g.lines.forEach(ls => { ls.forEach(l => { c.fillText(l, P + 36, ty); ty += PARA_LH; }); ty += 22; });
    y += g.paraH;
    // 代表作
    if (g.picksH) { c.fillStyle = C.ink; c.font = '900 40px ' + SERIF; c.fillText(en ? 'Signature films' : '代表作', P, y + 50); let py = y + 90;
      a.picks.forEach(([lab, x]) => { c.fillStyle = C.card; rr(c, P, py, W - 2 * P, PICK - 14, 16); c.fill(); c.fillStyle = C.red; c.font = '700 24px ' + SANS; c.fillText(lab, P + 28, py + 48); c.fillStyle = C.ink; c.font = '700 30px ' + SANS; let t = (en ? '' : '《') + x.title + (en ? '' : '》'); while (c.measureText(t).width > W - 2 * P - 470 && t.length > 2) t = t.slice(0, -2) + '…'; c.fillText(t, P + 210, py + 49); c.fillStyle = C.muted; c.font = '500 24px ' + MONO; c.textAlign = 'right'; c.fillText((en ? 'FUN ' : '有趣 ') + f1(x.fun) + (en ? ' · BORE ' : ' · 无聊 ') + f1(x.bore), W - P - 28, py + 48); c.textAlign = 'left'; py += PICK; });
      y += g.picksH; }
    // 页脚：沿用观影结算的品牌页脚
    if (o.footer) o.footer(c, y, H);
  }
  const api = { W, analyze, heightOf, draw, FOOT, hash };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SparrowTasteReport = api;
})(typeof window !== 'undefined' ? window : this);
