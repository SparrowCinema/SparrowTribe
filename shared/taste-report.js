/* 我的电影趣味图谱长图：规则 + 模板组合生成（不调用 AI，离线即时生成，同样的评分得到同样的结果）。
   一、趣味代码（参考 MBTI / 性格色彩的四维度写法）：
       有趣门槛  H 易燃 / C 挑剔（有趣度均分 ≥ 3.25）
       耐闷力    P 耐心 / R 节奏（无聊度均分 < 2.75）
       两极度    X 两极 / B 平衡（两项评分的起伏）
       评价方式  F 感受 / J 鉴赏（星级是否跟着有趣度走）
     → 16 种趣味人格，各有名称、金句、标签、隐藏技能、观影雷区、灵魂搭子与下一步建议。
   二、专属称号＝形容词（有趣/无聊均分 16 格 × 4）+ 偏好（高有趣度影片里最集中的类型 / 地区 / 年代）+ 人格名，
     约 96 × 38 × 16 ≈ 5.8 万种；数据解读每段 3–5 种句式并代入数字与片名。
   网站直接加载；小程序副本由 node tools/build-fallback.js 复制到 miniprogram/utils/taste-report.js。 */
(function (root) {
  'use strict';
  const W = 1080, P = 64;
  const SERIF = '"Noto Serif SC","Songti SC",serif', SANS = '"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif', MONO = '"IBM Plex Mono",Menlo,monospace';
  const C = { paper: '#efe6d4', card: '#f8f2e6', ink: '#2b2117', muted: '#7a6a55', line: '#d8cbb1', red: '#8e2a22', gold: '#d9bc80', teal: '#2f6f6c' };
  const QC = ['#7a5a8c', '#a8541d', '#2f5d8a', '#2f6f6c']; // 漫长难熬 / 迷人又折磨 / 平静无波 / 趣味横生
  const QN = [['漫长难熬', 'Enduring'], ['迷人又折磨', 'Captivating & tiring'], ['平静无波', 'Quiet'], ['趣味横生', 'Delightful']];
  const FAM = { HP: ['沉浸系', 'Immersive', '#2f6f6c'], HR: ['心跳系', 'Thrill', '#a8541d'], CP: ['静观系', 'Contemplative', '#2f5d8a'], CR: ['锋利系', 'Sharp', '#7a3a5c'] };
  const valid = v => typeof v === 'number' && v >= 0 && v <= 5;
  function hash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  const pick = (arr, seed, salt) => arr[hash(seed + '|' + salt) % arr.length];
  function quadrant(x, y) { return x === 3 || y === 3 ? -1 : y > 3 ? (x > 3 ? 1 : 0) : (x > 3 ? 3 : 2); }
  function pos(v) { return v <= 3 ? 12 + v * (38 / 3) : 50 + (v - 3) * 19; }
  const f1 = v => (Math.round(v * 10) / 10).toFixed(1);
  const lvl = v => v < 2.25 ? 0 : v < 3 ? 1 : v < 3.75 ? 2 : 3;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---- 四个维度 ----
  const AXES = [
    { k: ['H', 'C'], zh: [['易燃', '挑剔'], '有趣门槛'], en: [['Easily lit', 'Critical'], 'Delight threshold'] },
    { k: ['P', 'R'], zh: [['耐心', '节奏'], '耐闷力'], en: [['Patient', 'Pacey'], 'Patience'] },
    { k: ['X', 'B'], zh: [['两极', '平衡'], '两极度'], en: [['Extreme', 'Balanced'], 'Range'] },
    { k: ['F', 'J'], zh: [['感受', '鉴赏'], '评价方式'], en: [['Feeling', 'Judging'], 'Judgement'] }
  ];
  // ---- 16 种趣味人格 ----
  // [名称, 金句, 标签×3, 隐藏技能, 观影雷区, 下一步]（中文 / 英文）
  const TYPES = {
    HPXF: { zh: ['烟火收藏家', '你不是在看电影，是在收集一场场烟花。', ['一点就燃', '爱憎分明', '散场还在回味'], '能在任何类型里找到闪光点，是朋友圈里最好的安利者。', '情绪来得快，刚看完的那一部常常被你封为「年度最佳」。', '试一部节奏很慢的作者电影，看看烟花能不能在安静里点亮。'],
      en: ['Firework Collector', "You don't watch films, you collect fireworks.", ['Easily lit', 'All or nothing', 'Still glowing after'], 'You find the spark in any genre, the best recommender in any group.', 'Big feelings arrive fast; the film you just saw is often "the best of the year".', 'Try a slow auteur film and see if the spark survives the quiet.'] },
    HPXJ: { zh: ['深海潜水员', '越深的电影，你越想潜下去。', ['耐得住', '重口也行', '两项都敢打高分'], '别人中途离场的片，你能看到最后，还能讲出它的好。', '容易把「难」当成「好」，偶尔给自己布置了太多功课。', '来一部纯粹好玩的类型片，给自己放个假。'],
      en: ['Deep-sea Diver', 'The deeper the film, the further you dive.', ['Patient', 'Bring it on', 'Rates both high'], 'You sit through what others walk out of, and can explain why it matters.', 'You can mistake difficult for good and give yourself homework.', 'Pick a purely fun genre film and take a holiday.'] },
    HPBF: { zh: ['日光散步者', '好电影像晴天，你总能晒到太阳。', ['好相处', '不挑食', '观影幸福感高'], '几乎每次走进影院都有收获，是幸福感最稳定的观众。', '太温和，可能错过那些需要咬牙才能吃下的杰作。', '挑一部口碑两极的电影，看看自己站在哪一边。'],
      en: ['Sunlit Stroller', 'Good films are sunny days, and you always catch the sun.', ['Easygoing', 'Omnivore', 'Happy viewer'], 'Almost every trip to the cinema pays off: the steadiest happiness in the room.', 'So gentle you may skip the masterpieces that take some effort.', 'Choose a divisive film and find out which side you are on.'] },
    HPBJ: { zh: ['温柔策展人', '你看得宽，也看得细。', ['审美稳定', '宽容但有标准', '朋友的片单顾问'], '既懂好看，也懂好电影，你推荐的片单很少翻车。', '很少给极端分数，真正的心头好可能被你藏起来了。', '下次大胆给一部片打满分，或者零分。'],
      en: ['Gentle Curator', 'You watch widely, and closely.', ['Steady taste', 'Kind but exacting', "Friends' watchlist advisor"], 'You know both fun and greatness; your recommendations rarely miss.', 'You rarely give extreme scores, so your true favourites stay hidden.', 'Dare to give a film a perfect score, or a zero.'] },
    HRXF: { zh: ['过山车乘客', '要么让我尖叫，要么让我睡着。', ['节奏控', '上头快', '爱就是爱'], '对节奏极其敏感，一部片哪里拖、哪里燃，你最先知道。', '慢热的片可能还没等到高潮，就被你判了出局。', '给下一部慢热片多 20 分钟耐心。'],
      en: ['Rollercoaster Rider', 'Either make me scream or let me sleep.', ['Pace matters', 'Quick to fall', 'Love is love'], 'You know first where a film drags and where it soars.', 'A slow burner may be ruled out before its climax.', 'Give the next slow film twenty more minutes.'] },
    HRXJ: { zh: ['夜行冒险家', '好看还是难熬，你都要亲自验证。', ['敢冒险', '心里有杆秤', '不随大流'], '敢挑战陌生题材，也能冷静分开「好看」和「好电影」。', '对拖沓零容忍，有时会错怪那些需要时间的作品。', '试一部来自你从没看过的地区的电影。'],
      en: ['Night Adventurer', 'Thrilling or gruelling, you test it yourself.', ['Daring', 'Own scale', 'Against the crowd'], 'You take on unfamiliar films and still separate fun from greatness.', 'Zero tolerance for drag can be unfair to films that need time.', 'Try a film from a region you have never explored.'] },
    HRBF: { zh: ['派对主理人', '电影是用来一起开心的。', ['快乐至上', '节奏党', '最佳观影搭子'], '一眼就能挑出全场都会喜欢的片，是组织观影局的那个人。', '偏爱轻快，可能和沉重但重要的电影擦肩而过。', '约朋友看一部严肃题材，散场后一起吃顿夜宵聊聊。'],
      en: ['Party Host', 'Films are for being happy together.', ['Joy first', 'Pacey', 'Best cinema buddy'], 'You spot the film everyone will love: the one who organises movie nights.', 'A taste for lightness can miss heavy but important films.', 'Take friends to a serious film, then talk it over at supper.'] },
    HRBJ: { zh: ['灵感猎人', '你在每部电影里，都要带走一个点子。', ['效率型', '眼光实用', '擅长总结'], '能迅速抓住一部电影最有价值的地方。', '对「无用之美」的耐心有限。', '看一部没有明确情节的电影，只感受画面和声音。'],
      en: ['Inspiration Hunter', 'You take one idea home from every film.', ['Efficient', 'Practical eye', 'Great summariser'], 'You quickly grasp what is most valuable in a film.', 'Limited patience for beauty without purpose.', 'Watch a film with no clear plot and just take in images and sound.'] },
    CPXF: { zh: ['孤勇守夜人', '很少有电影能打动你，但一旦打动，就是一辈子。', ['难取悦', '耐得住寂寞', '心头好很少'], '你的高分极其珍贵，被你认可的电影值得所有人去看。', '门槛太高，偶尔会错过简单的快乐。', '给一部轻喜剧一次机会。'],
      en: ['Lone Night Watcher', 'Few films move you, but those that do stay forever.', ['Hard to please', 'Comfortable alone', 'Few favourites'], 'Your high scores are rare and precious; anyone should see a film you love.', 'A high bar can rule out simple pleasures.', 'Give a light comedy a chance.'] },
    CPXJ: { zh: ['冷面考古学家', '你在电影里挖掘，而不是消遣。', ['学院派', '耐心挖掘', '打分严格'], '读得懂结构、历史和细节，是最可靠的影评参照。', '太理性，偶尔忘了电影也可以只是好玩。', '跟着直觉去看一部纯爆米花电影。'],
      en: ['Stone-faced Archaeologist', 'You excavate films rather than consume them.', ['Scholarly', 'Patient digger', 'Strict scorer'], 'You read structure, history and detail: the most reliable critic to consult.', 'So rational you forget films can simply be fun.', 'Follow your gut to a pure popcorn film.'] },
    CPBF: { zh: ['观潮者', '你不急，电影也不必急。', ['安静', '慢电影友好', '情绪稳定'], '能和慢电影相处得很好，享受留白与沉默。', '情绪起伏小，有时连自己都说不清喜不喜欢。', '看完后写下三个词，记录当下的感受。'],
      en: ['Tide Watcher', 'You are in no hurry, and neither is the film.', ['Quiet', 'Slow-cinema friendly', 'Calm'], 'You get along with slow films and enjoy silence and space.', 'Your feelings move so little you are not always sure you liked it.', 'Write down three words after each film.'] },
    CPBJ: { zh: ['老派品鉴师', '标准清楚，口味稳定。', ['经典派', '讲究', '不跟风'], '你的评价经得起时间考验。', '和新风格保持距离，可能错过下一部经典的起点。', '看一部今年新导演的处女作。'],
      en: ['Old-school Connoisseur', 'Clear standards, steady taste.', ['Classic lover', 'Particular', 'No trends'], 'Your judgements stand the test of time.', 'Keeping new styles at arm\'s length may miss the next classic.', 'Watch a debut by a new director this year.'] },
    CRXF: { zh: ['毒舌评审', '好就是好，烂就是烂。', ['锋利', '零容忍', '观点鲜明'], '一句话就能说清一部电影的问题，是最诚实的朋友。', '第一印象太强，有时不给电影第二次机会。', '重看一部你曾经打过低分的电影。'],
      en: ['Sharp-tongued Juror', 'Good is good, bad is bad.', ['Sharp', 'Zero tolerance', 'Strong opinions'], "One sentence and you have named a film's problem: the most honest friend.", 'Strong first impressions can deny films a second chance.', 'Rewatch a film you once scored low.'] },
    CRXJ: { zh: ['手术刀剪辑师', '你脑中永远有一个更紧凑的版本。', ['节奏洁癖', '结构控', '精准'], '对结构和节奏有专业级的直觉。', '你想剪掉的那十分钟，可能正是导演的用意。', '找一部导演剪辑版，看看多出来的部分。'],
      en: ['Scalpel Editor', 'There is always a tighter cut in your head.', ['Pace obsessive', 'Structure nerd', 'Precise'], 'Professional-grade instinct for structure and rhythm.', 'The ten minutes you would cut may be exactly the point.', "Find a director's cut and watch what was added."] },
    CRBF: { zh: ['清醒旁观者', '不轻易入戏，也不轻易离场。', ['冷静', '有距离感', '看得透'], '不被营销和情绪带着走，判断很独立。', '距离感太强，偶尔错过全情投入的快感。', '坐第一排看一场，把自己交给银幕。'],
      en: ['Clear-eyed Bystander', 'Slow to be drawn in, slow to walk out.', ['Calm', 'Detached', 'Sees through it'], 'Not swayed by hype or emotion; your judgement is independent.', 'Keeping your distance can cost you total immersion.', 'Sit in the front row and give yourself to the screen.'] },
    CRBJ: { zh: ['精准狙击手', '你只为值得的电影买票。', ['选片高手', '效率', '命中率高'], '选片命中率极高，很少把时间浪费在不对的电影上。', '过于精准，少了偶遇惊喜的机会。', '闭上眼随机选一场，给意外留一个位置。'],
      en: ['Precision Sniper', 'You only buy tickets for films worth it.', ['Expert picker', 'Efficient', 'High hit rate'], 'Your hit rate is excellent: little time wasted on the wrong film.', 'So precise you leave no room for happy accidents.', 'Pick a screening at random and leave room for surprise.'] }
  };
  // 灵魂搭子：前两维互补，后两维相同
  const MATE = code => ({ H: 'C', C: 'H' })[code[0]] + ({ P: 'R', R: 'P' })[code[1]] + code.slice(2);

  // ---- 称号词库 ----
  const ADJ = {
    zh: [
      [['挑剔的', '冷眼的', '难以取悦的', '严苛的', '高冷的', '眼光苛刻的'], ['审慎的', '克制的', '不轻易心动的', '冷静的', '理性的', '惜字如金的'], ['耐心的', '沉得住气的', '温吞的', '能熬的', '默默坚持的', '不动声色的'], ['坚忍的', '苦行的', '执拗的', '自找罪受的', '咬牙的', '不服输的']],
      [['淡定的', '佛系的', '慢热的', '安静的', '低调的', '云淡风轻的'], ['中庸的', '平和的', '清淡的', '随遇而安的', '不紧不慢的', '温吞水般的'], ['犹疑的', '矛盾的', '半信半疑的', '摇摆的', '若即若离的', '欲言又止的'], ['倔强的', '硬撑的', '耐熬的', '执着的', '死磕的', '一根筋的']],
      [['松弛的', '轻快的', '好奇的', '温和的', '随性的', '自在的'], ['敏锐的', '清醒的', '有分寸的', '会挑的', '通透的', '拎得清的'], ['多情的', '复杂的', '暧昧的', '纠结的', '敏感的', '心事重重的'], ['矛盾的', '自虐的', '痴迷的', '两极的', '又爱又恨的', '甘之如饴的']],
      [['热烈的', '雀跃的', '贪玩的', '好胃口的', '元气满满的', '兴致勃勃的'], ['眼光毒辣的', '会玩的', '机敏的', '心明眼亮的', '灵光的', '有品的'], ['上头的', '狂热的', '深陷的', '不设防的', '沉迷的', '义无反顾的'], ['极端的', '燃烧的', '疯魔的', '爱恨分明的', '用力过猛的', '全情投入的']]
    ],
    en: [
      [['Picky', 'Cool-eyed', 'Hard-to-please', 'Exacting', 'Aloof', 'Unimpressed'], ['Measured', 'Reserved', 'Unhurried', 'Cool-headed', 'Rational', 'Laconic'], ['Patient', 'Steady', 'Long-suffering', 'Stoic', 'Quietly persistent', 'Poker-faced'], ['Ascetic', 'Unbending', 'Stubborn', 'Self-testing', 'Gritty', 'Unyielding']],
      [['Easygoing', 'Zen', 'Slow-burning', 'Quiet', 'Low-key', 'Unruffled'], ['Balanced', 'Mild', 'Even-keeled', 'Unflappable', 'Unhurried', 'Lukewarm'], ['Wavering', 'Torn', 'Ambivalent', 'Swaying', 'Elusive', 'Hesitant'], ['Dogged', 'Persistent', 'Hardy', 'Determined', 'Single-minded', 'Tenacious']],
      [['Relaxed', 'Breezy', 'Curious', 'Gentle', 'Free-spirited', 'Carefree'], ['Sharp', 'Clear-eyed', 'Discerning', 'Choosy', 'Perceptive', 'Level-headed'], ['Romantic', 'Complicated', 'Ambiguous', 'Conflicted', 'Sensitive', 'Brooding'], ['Contradictory', 'Masochistic', 'Obsessed', 'Polarised', 'Love-hate', 'Willingly tormented']],
      [['Ardent', 'Exuberant', 'Playful', 'Hungry', 'Bubbly', 'Eager'], ['Keen-eyed', 'Savvy', 'Quick-witted', 'Bright-eyed', 'Witty', 'Tasteful'], ['Hooked', 'Fervent', 'Smitten', 'Unguarded', 'Devoted', 'Headlong'], ['Extreme', 'Blazing', 'Possessed', 'All-or-nothing', 'Over-the-top', 'All-in']]
    ]
  };
  const GENRE = { '喜剧': ['喜剧', 'Comedy'], '纪录片': ['纪录片', 'Documentary'], '纪录': ['纪录片', 'Documentary'], '爱情': ['爱情片', 'Romance'], '惊悚': ['惊悚片', 'Thriller'], '犯罪': ['黑色犯罪', 'Crime'], '动作': ['动作片', 'Action'], '悬疑': ['悬疑片', 'Mystery'], '动画': ['动画', 'Animation'], '科幻': ['科幻', 'Sci-fi'], '奇幻': ['奇幻', 'Fantasy'], '历史': ['历史片', 'Period'], '恐怖': ['恐怖片', 'Horror'], '短片': ['短片', 'Shorts'], '音乐': ['音乐片', 'Music'], '冒险': ['冒险片', 'Adventure'], '家庭': ['家庭片', 'Family'], '战争': ['战争片', 'War'], '运动': ['运动片', 'Sports'], '传记': ['传记片', 'Biopic'], '武侠': ['武侠片', 'Wuxia'], '古装': ['古装片', 'Costume'], '歌舞': ['歌舞片', 'Musical'], '西部': ['西部片', 'Western'] };
  const REGION = { cn: ['华语片', 'Chinese-language'], eu: ['欧洲片', 'European'], us: ['美国片', 'American'], as: ['亚洲片', 'Asian'], me: ['非洲片', 'African'], la: ['拉美片', 'Latin American'] };
  const DECADE = d => d < 1950 ? ['老电影', 'Golden-age'] : d < 1980 ? [(d % 100) + '年代', d + 's'] : d < 2000 ? [['八', '九'][(d - 1980) / 10] + '十年代', d + 's'] : d < 2020 ? ['新世纪', 'New-century'] : ['当代', 'Contemporary'];

  function validRows(entries, en) {
    return (entries || []).filter(e => e && e.f && !e.f.ev && e.rec && !e.rec.del && valid(e.rec.fun) && valid(e.rec.bore))
      .map(e => ({ id: e.id, title: en ? (e.f.en || e.f.cn) : e.f.cn, f: e.f, fun: e.rec.fun, bore: e.rec.bore, r: e.rec.r || 0, d: String(e.rec.d || '') }))
      .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  }
  // 可选年份（按观影日期），只列出有两项趣味评分的年份
  function years(entries) { const m = new Map(); validRows(entries).forEach(x => { const y = x.d.slice(0, 4); if (/^\d{4}$/.test(y)) m.set(y, (m.get(y) || 0) + 1); }); return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([y, n]) => ({ y, n })); }
  const sd = a => { const m = a.reduce((s, v) => s + v, 0) / a.length; return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / a.length); };
  const corr = (a, b) => { const ma = a.reduce((s, v) => s + v, 0) / a.length, mb = b.reduce((s, v) => s + v, 0) / b.length; let x = 0, ya = 0, yb = 0; a.forEach((v, i) => { x += (v - ma) * (b[i] - mb); ya += (v - ma) ** 2; yb += (b[i] - mb) ** 2; }); return ya && yb ? x / Math.sqrt(ya * yb) : 0; };
  // 四维度：每部影片权重相同（同一位置的多部影片会各自计入）
  function stats(rows) {
    const n = rows.length, avgF = rows.reduce((s, x) => s + x.fun, 0) / n, avgB = rows.reduce((s, x) => s + x.bore, 0) / n;
    const spreadV = (sd(rows.map(x => x.fun)) + sd(rows.map(x => x.bore))) / 2, rFB = corr(rows.map(x => x.fun), rows.map(x => x.bore));
    const rated = rows.filter(x => x.r), rStar = rated.length >= 3 ? corr(rated.map(x => x.r), rated.map(x => x.fun)) : null;
    const ax = [];
    ax.push(avgF >= 3.25 ? ['H', 50 + clamp((avgF - 3.25) / 1.75, 0.02, 0.98) * 50] : ['C', 50 + clamp((3.25 - avgF) / 3.25, 0.02, 0.98) * 50]);
    ax.push(avgB < 2.75 ? ['P', 50 + clamp((2.75 - avgB) / 2.75, 0.02, 0.98) * 50] : ['R', 50 + clamp((avgB - 2.75) / 2.25, 0.02, 0.98) * 50]);
    ax.push(spreadV >= 1.1 ? ['X', 50 + clamp((spreadV - 1.1) / 1.1, 0.02, 0.98) * 50] : ['B', 50 + clamp((1.1 - spreadV) / 1.1, 0.02, 0.98) * 50]);
    const m4 = rStar !== null ? rStar - 0.5 : -0.2 - rFB; // 星级跟着有趣度走＝感受；否则看「闷但有趣」能否并存
    ax.push(m4 >= 0 ? ['F', 50 + clamp(m4 / 0.5, 0.02, 0.98) * 50] : ['J', 50 + clamp(-m4 / 0.8, 0.02, 0.98) * 50]);
    return { avgF, avgB, spreadV, rFB, rStar, ax, code: ax.map(a => a[0]).join('') };
  }
  // 片单版图：导演、年代、国家地区（从影片资料自动读取，片库变大自动丰富，无需更新词库）
  const splitList = v => String(v || '').split(/\s*[\/、,，;；|]\s*/).map(x => x.trim()).filter(Boolean);
  function atlas(rows) {
    const dir = new Map(); rows.forEach(x => splitList(x.f.dir).slice(0, 2).forEach(d => dir.set(d, (dir.get(d) || 0) + 1)));
    const topDir = [...dir.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    const ys = rows.map(x => +x.f.y).filter(y => y > 1880 && y < 2100), decades = new Set(ys.map(y => Math.floor(y / 10)));
    const cs = new Set(); rows.forEach(x => splitList(x.f.c).forEach(c => cs.add(c)));
    return { dir: topDir && topDir[1] >= 2 ? { name: topDir[0], n: topDir[1] } : null, minY: ys.length ? Math.min(...ys) : 0, maxY: ys.length ? Math.max(...ys) : 0, decades: decades.size, countries: cs.size };
  }
  function analyze(entries, opts) {
    opts = opts || {}; const en = !!opts.en, L = en ? 1 : 0;
    const all = validRows(entries, en), year = opts.year ? String(opts.year) : '';
    const rows = year ? all.filter(x => x.d.slice(0, 4) === year) : all;
    const n = rows.length, out = { n, ok: n >= 3, en, year };
    if (!out.ok) return out;
    const seed = rows.map(x => x.id + ':' + x.fun + ':' + x.bore).join(',');
    const st = stats(rows), { avgF, avgB, rFB, rStar, ax, code } = st;
    const q = [0, 0, 0, 0]; let unsure = 0; rows.forEach(x => { const k = quadrant(x.fun, x.bore); if (k < 0) unsure++; else q[k]++; });
    const T = TYPES[code][en ? 'en' : 'zh'], mate = MATE(code), fam = FAM[code.slice(0, 2)];
    // 变化轨迹：选了年份且上一年至少 3 部
    if (year) { const py = String(+year - 1), prev = all.filter(x => x.d.slice(0, 4) === py); if (prev.length >= 3) { const pc = stats(prev).code; out.prev = { year: py, code: pc, name: TYPES[pc][en ? 'en' : 'zh'][0] }; } }
    out.code = code; out.type = { name: T[0], motto: T[1], tags: T[2], power: T[3], blind: T[4], next: T[5], family: fam[L], color: fam[2], mate, mateName: TYPES[mate][en ? 'en' : 'zh'][0] };
    out.axes = AXES.map((a, i) => { const side = a.k.indexOf(ax[i][0]), lab = a[en ? 'en' : 'zh']; return { title: lab[1], left: a.k[0] + ' ' + lab[0][0], right: a.k[1] + ' ' + lab[0][1], side, pct: Math.round(ax[i][1]) }; });
    // 偏好
    const top = Math.max(...q), dom = top / n >= 0.4 ? q.indexOf(top) : 4, empty = q.indexOf(Math.min(...q));
    const liked = rows.filter(x => x.fun >= 4).length >= 2 ? rows.filter(x => x.fun >= 4) : rows.slice().sort((a, b) => b.fun - a.fun).slice(0, Math.max(2, Math.ceil(n / 3)));
    const tally = (arr, key) => { const m = new Map(); arr.forEach(x => [].concat(key(x) || []).forEach(k => { if (k) m.set(k, (m.get(k) || 0) + 1); })); return [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))); };
    const gT = tally(liked, x => (x.f.genre || []).filter(g => GENRE[g])), rT = tally(liked, x => REGION[x.f.reg] ? x.f.reg : null), dT = tally(liked, x => /^\d{4}$/.test(String(x.f.y)) ? Math.floor(+x.f.y / 10) * 10 : null);
    const cand = [];
    if (gT[0]) cand.push({ s: gT[0][1] / liked.length + 0.05, w: GENRE[gT[0][0]] });
    if (rT[0]) cand.push({ s: rT[0][1] / liked.length - 0.1, w: REGION[rT[0][0]] });
    if (dT[0]) cand.push({ s: dT[0][1] / liked.length - 0.05, w: DECADE(dT[0][0]) });
    const cT = tally(liked, x => splitList(x.f.c)[0] || null); if (cT[0] && !en && cT[0][0].length <= 4) cand.push({ s: cT[0][1] / liked.length - 0.08, w: [cT[0][0] + '电影', ''] });
    cand.sort((a, b) => b.s - a.s);
    const pref = cand[0] && cand[0].s >= 0.3 ? cand[0] : null;
    const adj = pick(ADJ[en ? 'en' : 'zh'][lvl(avgF)][lvl(avgB)], seed, 'adj');
    out.persona = en ? 'The ' + adj + ' ' + (pref ? pref.w[1] + ' ' : '') + T[0] : adj + (pref ? pref.w[0] : '') + T[0];
    // 代表作
    const by = fn => rows.slice().sort((a, b) => fn(b) - fn(a) || a.title.localeCompare(b.title))[0];
    const mostFun = by(x => x.fun - x.bore * 0.01), mostBore = by(x => x.bore - x.fun * 0.01);
    const contrast = rows.filter(x => x.fun >= 4 && x.bore >= 4 && x.id !== mostFun.id && x.id !== mostBore.id).sort((a, b) => (b.fun + b.bore) - (a.fun + a.bore))[0] || null;
    const qName = k => QN[k][L], pct = k => Math.round(q[k] / n * 100);
    const S = [];
    S.push(pick(en ? [
      `Across ${n} films you averaged ${f1(avgF)} for interesting and ${f1(avgB)} for boring.`,
      `${n} films, two scales: ${f1(avgF)} interesting and ${f1(avgB)} boring on average.`,
      `Your ${n} rated films land at ${f1(avgF)} interesting and ${f1(avgB)} boring.`
    ] : [
      `你用两把尺子量过 ${n} 部电影：平均有趣 ${f1(avgF)}，平均无聊 ${f1(avgB)}。`,
      `${n} 部电影落在了你的图谱上，有趣度均值 ${f1(avgF)}，无聊度均值 ${f1(avgB)}。`,
      `统计你打过分的 ${n} 部电影，有趣度落在 ${f1(avgF)}，无聊度落在 ${f1(avgB)}。`,
      `${n} 部电影、两把尺子：平均有趣 ${f1(avgF)}，平均无聊 ${f1(avgB)}。`
    ], seed, 's1'));
    if (dom < 4) S.push(pick(en ? [
      `${pct(dom)}% of them sit in “${qName(dom)}”: that is your home ground.`,
      `Your centre of gravity is “${qName(dom)}”, with ${q[dom]} films (${pct(dom)}%).`,
      `Most of your films gather in “${qName(dom)}” (${pct(dom)}%).`
    ] : [
      `其中 ${pct(dom)}% 落在「${qName(dom)}」，这是你最常停留的地带。`,
      `你的重心在「${qName(dom)}」：${q[dom]} 部，占 ${pct(dom)}%。`,
      `「${qName(dom)}」收下了你 ${pct(dom)}% 的电影，几乎就是你的主场。`,
      `${q[dom]} 部电影挤在「${qName(dom)}」，比例达到 ${pct(dom)}%，你的口味很有方向感。`
    ], seed, 's2' + dom));
    else S.push(pick(en ? [
      `No single quadrant dominates: your films are spread across the whole map.`,
      `Your map is balanced, with no quadrant holding more than 40%.`
    ] : [
      `四个象限分布得相当均匀，没有哪一类超过四成，你几乎什么都看、也什么都能接受。`,
      `你的图谱没有明显的主场，四个象限各有落点，口味相当开阔。`,
      `没有一个象限占到 40%，你在每个角落都留下了脚印。`
    ], seed, 's2b'));
    S.push(pick(rFB < -0.45 ? (en ? [
      `For you, interesting and boring pull in opposite directions: when one rises, the other falls.`,
      `Your two scales move like a seesaw. A film that grips you rarely feels long.`
    ] : [
      `对你来说，有趣和无聊基本此消彼长：一部片抓住你，就很少让你觉得漫长。`,
      `你的两把尺子像跷跷板，一边高，另一边就低，感受相当直接。`,
      `有趣度越高，无聊度越低。你很少「又爱又困」。`
    ]) : rFB > 0.25 ? (en ? [
      `Unusually, your interesting and boring scores rise together: the films that fascinate you also test you.`,
      `You often rate both high at once. Demanding films are part of your pleasure.`
    ] : [
      `少见的是，你的有趣度和无聊度会一起升高：越吸引你的电影，往往也越磨人。`,
      `你常常给同一部片两项都打高分，「难看懂但好看」正是你的乐趣所在。`,
      `你并不怕闷，甚至会被闷住的电影迷住。`
    ]) : (en ? [
      `Your interesting and boring scores are largely independent: you answer the two questions separately.`,
      `You keep the two scales apart: being slow does not cancel out being interesting.`
    ] : [
      `你的有趣度和无聊度彼此独立：觉得闷，不代表就不好看。`,
      `你把「有趣」和「无聊」分开看，两项评分并不互相牵连。`,
      `两项评分没有固定的关系，你会认真分别回答这两个问题。`
    ]), seed, 's3'));
    const ex = [];
    if (mostFun) ex.push(en ? `“${mostFun.title}” was your most interesting (${f1(mostFun.fun)})` : `最让你着迷的是《${mostFun.title}》（${f1(mostFun.fun)}）`);
    if (mostBore && mostBore.id !== mostFun.id) ex.push(en ? `“${mostBore.title}” felt the longest (${f1(mostBore.bore)})` : `最考验耐心的是《${mostBore.title}》（${f1(mostBore.bore)}）`);
    if (contrast) ex.push(en ? `and “${contrast.title}” was both captivating and tiring` : `而《${contrast.title}》又迷人又折磨`);
    if (ex.length) S.push(ex.join(en ? '; ' : '；') + (en ? '.' : '。'));
    if (pref) S.push(pick(en ? [
      `Among the films you found most interesting, ${pref.w[1]} titles stand out.`,
      `Your high scores lean towards ${pref.w[1]} films: your comfort zone.`
    ] : [
      `在你觉得最有趣的电影里，「${pref.w[0]}」出现得最多。`,
      `你的高分偏爱${pref.w[0]}，这大概就是你的舒适区。`,
      `让你眼前一亮的电影里，${pref.w[0]}占了不小的比例。`
    ], seed, 's5'));
    const at = atlas(rows); out.atlas = at;
    if (at.dir) S.push(pick(en ? [`Your most-watched director is ${at.dir.name} (${at.dir.n} films).`, `${at.dir.name} appears ${at.dir.n} times in your map: a director you keep coming back to.`] : [`你最常看的导演是${at.dir.name}（${at.dir.n} 部），这份偏爱已经写进了你的图谱。`, `${at.dir.name}在你的图谱里出现了 ${at.dir.n} 次，是你反复回去找的那位导演。`, `你和${at.dir.name}的缘分不浅：${at.dir.n} 部作品都留下了你的评分。`], seed, 'dir'));
    if (at.minY && at.decades >= 2) S.push(pick(en ? [`Your films run from ${at.minY} to ${at.maxY}, across ${at.decades} decades and ${at.countries} countries or regions.`, `From ${at.minY} to ${at.maxY}: ${at.decades} decades and ${at.countries} countries or regions on your map.`] : [`你的片单从 ${at.minY} 年一路看到 ${at.maxY} 年，跨越 ${at.decades} 个年代、${at.countries} 个国家和地区。`, `${at.countries} 个国家和地区、${at.decades} 个年代，最早是 ${at.minY} 年，最新是 ${at.maxY} 年，你的视野相当辽阔。`, `时间上横跨 ${at.minY}–${at.maxY}，空间上走过 ${at.countries} 个国家和地区。`], seed, 'span'));
    if (rStar !== null) S.push(pick(rStar > 0.6 ? (en ? [`Your star ratings closely follow how interesting a film was.`] : [`你的十分制星级几乎跟着有趣度走：好不好看，主要看有没有趣。`, `星级和有趣度高度一致，你给高分的电影通常也最有趣。`])
      : rStar < 0.2 ? (en ? [`Your star ratings and interesting scores often disagree: you separate quality from enjoyment.`] : [`你的星级和有趣度经常不一致：你会把「好电影」和「有趣」分开评价。`, `给高分的不一定有趣，有趣的也不一定拿高分，你的标准很立体。`])
        : (en ? [`Your star ratings partly track how interesting a film was.`] : [`星级和有趣度有一定关联，但你也愿意为不那么有趣的好电影加分。`]), seed, 's6'));
    if (opts.community) { const d = rows.map(x => { const c = opts.community(x.id); return c ? Math.abs(c.fun - x.fun) + Math.abs(c.bore - x.bore) : null; }).filter(v => v !== null);
      if (d.length >= 3) { const m = d.reduce((s, v) => s + v, 0) / d.length; S.push(m < 1.2 ? (en ? `On ${d.length} films with community ratings, you feel much like everyone else.` : `在 ${d.length} 部有社区评分的电影上，你和大家的感受相当接近。`) : m > 2.2 ? (en ? `On ${d.length} films with community ratings you often disagree: an independent palate.` : `在 ${d.length} 部有社区评分的电影上，你经常和大家意见不同，口味相当独立。`) : (en ? `On ${d.length} films with community ratings, you agree with the crowd about half the time.` : `在 ${d.length} 部有社区评分的电影上，你和大家时而一致、时而分歧。`)); } }
    if (q[empty] === 0 || q[empty] / n < 0.12) S.push(pick(en ? [
      `“${qName(empty)}” is still almost empty. Next time, try a film you expect to land there.`,
      `Few of your films sit in “${qName(empty)}”. That corner may hold your next surprise.`
    ] : [
      `「${qName(empty)}」几乎还是空的，下次不妨挑一部可能落在那里的电影。`,
      `「${qName(empty)}」很少有你的电影，也许下一个惊喜就在那个角落。`,
      `想让图谱更完整？去「${qName(empty)}」那一格探探路。`
    ], seed, 's8'));
    out.paras = S; out.q = q; out.unsure = unsure; out.avgF = avgF; out.avgB = avgB; out.dom = dom; out.rows = rows;
    out.picks = [mostFun && [en ? 'Most interesting' : '最着迷', mostFun], mostBore && mostBore.id !== mostFun.id && [en ? 'Felt longest' : '最考验耐心', mostBore], contrast && [en ? 'Captivating & tiring' : '最反差', contrast]].filter(Boolean);
    return out;
  }

  // ---- 画布 ----
  const CJK = /[　-〿㐀-鿿＀-￯]/;
  function wrap(c, text, max) { text = String(text || ''); const out = []; let line = ''; if (!CJK.test(text) && /\s/.test(text)) text.split(/\s+/).forEach(w => { const t = line ? line + ' ' + w : w; if (c.measureText(t).width > max && line) { out.push(line); line = w; } else line = t; }); else for (const ch of text) { if (c.measureText(line + ch).width > max && line) { out.push(line); line = ch; } else line += ch; } if (line) out.push(line); for (let i = 1; i < out.length; i++) { const m = out[i].match(/^[：:，,、。.！!？?）)」』·；;]+/); if (m) { out[i - 1] += m[0]; out[i] = out[i].slice(m[0].length); } } return out.filter(Boolean); }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  const HEAD = 700, AXES_H = 650, CHART = 860, STATS = 380, FOOT = 420, LH = 50, PICK = 92, CW = W - 2 * P - 72;
  function noteText(a, o) { const d = String(o.date || ''), y = a.year; return a.en ? (y ? `This is your ${y} taste map, from ${a.n} films. Generated ${d}. Your taste keeps changing year by year; create next year's map and compare.` : `Your taste map changes as you keep watching: the more films you rate, the sharper the picture. Generated ${d} from ${a.n} films; come back next year and see how you have changed.`) : (y ? `这是你 ${y} 年的电影趣味图谱，基于这一年看过的 ${a.n} 部电影，生成于 ${d}。口味会一年年变化，明年再生成一张，对比看看你的轨迹。` : `电影趣味图谱会随着你一年年的观影积累不断变化：看得越多，画像越准。生成于 ${d}，基于 ${a.n} 部电影。明年这个时候再来生成一次，看看你变了多少。`); }
  function layout(c, a, o) {
    const en = a.en; c.font = '400 31px ' + SANS;
    const paras = (a.paras || []).map(p => wrap(c, p, CW));
    const t = a.type, rows = [[en ? 'Hidden skill' : '隐藏技能', t.power], [en ? 'Blind spot' : '观影雷区', t.blind], [en ? 'Soulmate type' : '灵魂搭子', t.mate + ' · ' + t.mateName], [en ? 'Try next' : '下一步', t.next]];
    if (a.prev) rows.unshift([en ? 'Your arc' : '变化轨迹', a.prev.code === a.code ? (en ? `Same as ${a.prev.year}: still ${a.code} ${t.name}. A steady palate.` : `和 ${a.prev.year} 年一样，你依然是 ${a.code} ${t.name}，口味相当稳定。`) : (en ? `${a.prev.year}: ${a.prev.code} ${a.prev.name} → ${a.year}: ${a.code} ${t.name}.` : `${a.prev.year} 年你还是 ${a.prev.code} ${a.prev.name}，${a.year} 年变成了 ${a.code} ${t.name}。`)]);
    c.font = '400 29px ' + SANS; const typeRows = rows.map(([k, v]) => [k, wrap(c, v, CW - 190)]);
    c.font = '400 26px ' + SANS; const note = wrap(c, noteText(a, o), CW);
    const typeH = 120 + typeRows.reduce((s, r) => s + Math.max(1, r[1].length) * 44 + 30, 0) + 30;
    const paraH = 120 + paras.reduce((s, l) => s + l.length * LH + 22, 0) + 30;
    const picksH = a.picks && a.picks.length ? 110 + a.picks.length * PICK : 0;
    const noteH = 70 + note.length * 40 + 40;
    return { paras, typeRows, note, typeH, paraH, picksH, noteH };
  }
  function heightOf(c, a, o) { if (!a || !a.ok) return 0; const g = layout(c, a, o || {}); return HEAD + AXES_H + g.typeH + CHART + STATS + g.paraH + g.picksH + g.noteH + FOOT; }
  const title40 = (c, t, y) => { c.fillStyle = C.ink; c.font = '900 40px ' + SERIF; c.fillText(t, P, y); };

  function draw(c, a, o) {
    o = o || {}; const T = o.T || (x => x), en = a.en, g = layout(c, a, o), H = heightOf(c, a, o), t = a.type;
    c.textBaseline = 'alphabetic'; c.textAlign = 'left'; c.fillStyle = C.paper; c.fillRect(0, 0, W, H);
    // 页眉
    const gr = c.createLinearGradient(0, 0, W, HEAD); gr.addColorStop(0, '#2a3b3a'); gr.addColorStop(1, '#16201f'); c.fillStyle = gr; c.fillRect(0, 0, W, HEAD);
    c.strokeStyle = C.gold; c.globalAlpha = 0.7; c.lineWidth = 2; c.strokeRect(28, 28, W - 56, HEAD - 56); c.lineWidth = 1; c.strokeRect(38, 38, W - 76, HEAD - 76); c.globalAlpha = 1;
    c.fillStyle = C.gold; c.font = '600 22px ' + MONO; c.fillText('SPARROW FILM PASSPORT · MY FILM TASTE MAP' + (a.year ? ' · ' + a.year : ''), P + 10, 108);
    const h = String(o.holder || '').trim(), yr = a.year ? a.year + (en ? ' ' : '') : '', title = en ? (h ? h + "'s " : 'My ') + yr + 'Film Taste Map' : (h || '我') + '的' + yr + '电影趣味图谱';
    c.fillStyle = '#fffaf0'; { let tz = 52; c.font = '900 ' + tz + 'px ' + SERIF; while (tz > 34 && c.measureText(title).width > W - 2 * P - 20) { tz -= 2; c.font = '900 ' + tz + 'px ' + SERIF; } c.fillText(title, P + 10, 184); }
    c.fillStyle = C.gold; c.font = '600 24px ' + SANS; c.fillText(en ? 'YOUR TASTE PERSONA' : '你的趣味人格', P + 10, 252);
    let fz = en ? 58 : 72; c.font = '900 ' + fz + 'px ' + SERIF; while (fz > 34 && c.measureText(a.persona).width > W - 2 * P - 20) { fz -= 2; c.font = '900 ' + fz + 'px ' + SERIF; }
    c.fillStyle = '#fffaf0'; c.fillText(a.persona, P + 10, 252 + fz + 16);
    // 代码胶囊
    let y = 252 + fz + 50; c.font = '800 30px ' + MONO; const cw = c.measureText(a.code).width + 44; c.fillStyle = t.color; rr(c, P + 10, y, cw, 54, 27); c.fill(); c.fillStyle = '#fffaf0'; c.fillText(a.code, P + 32, y + 38);
    c.font = '700 28px ' + SANS; c.fillStyle = '#fffaf0'; c.fillText(t.name + ' · ' + t.family, P + 30 + cw, y + 38);
    y += 100; c.font = 'italic 400 30px ' + SERIF; c.fillStyle = '#fffaf0'; c.globalAlpha = 0.92; wrap(c, (en ? '“' : '「') + t.motto + (en ? '”' : '」'), W - 2 * P - 20).slice(0, 2).forEach((l, i) => c.fillText(l, P + 10, y + i * 42)); c.globalAlpha = 1;
    y = HEAD - 96; c.font = '600 22px ' + SANS; let tx = P + 10; t.tags.forEach(tag => { const s = '#' + tag, w = c.measureText(s).width + 28; c.strokeStyle = C.gold; c.lineWidth = 1.5; rr(c, tx, y, w, 40, 20); c.stroke(); c.fillStyle = C.gold; c.fillText(s, tx + 14, y + 28); tx += w + 12; });
    c.fillStyle = '#fffaf0'; c.globalAlpha = 0.6; c.font = '400 20px ' + SANS; c.textAlign = 'right'; c.fillText(a.n + (en ? ' films' : ' 部电影'), W - P - 10, y + 28); c.textAlign = 'left'; c.globalAlpha = 1;
    // 四维度
    y = HEAD + 70; title40(c, en ? 'Four dimensions' : '趣味四维度', y); c.fillStyle = C.muted; c.font = '400 22px ' + SANS; c.fillText(en ? 'Based on your two taste scales and star ratings' : '根据你的有趣度、无聊度与星级计算', P + (en ? 330 : 230), y);
    y += 40; a.axes.forEach((x, i) => { const yy = y + i * 125, bw = W - 2 * P;
      c.fillStyle = C.muted; c.font = '600 22px ' + SANS; c.fillText(x.title, P, yy + 24);
      c.font = '700 26px ' + SANS; c.fillStyle = x.side === 0 ? t.color : C.muted; c.fillText(x.left, P, yy + 66); c.textAlign = 'right'; c.fillStyle = x.side === 1 ? t.color : C.muted; c.fillText(x.right, P + bw, yy + 66); c.textAlign = 'left';
      const by = yy + 82, bh = 16; c.fillStyle = C.line; rr(c, P, by, bw, bh, 8); c.fill(); const fw = bw * x.pct / 100; c.fillStyle = t.color; rr(c, x.side === 0 ? P : P + bw - fw, by, fw, bh, 8); c.fill();
      const mx = x.side === 0 ? P + fw : P + bw - fw; c.fillStyle = '#fffaf0'; c.beginPath(); c.arc(mx, by + bh / 2, 14, 0, Math.PI * 2); c.fill(); c.strokeStyle = t.color; c.lineWidth = 4; c.stroke();
      c.fillStyle = t.color; c.font = '700 22px ' + MONO; c.textAlign = 'center'; c.fillText(x.pct + '%', P + bw / 2, yy + 66); c.textAlign = 'left'; });
    // 人格解读
    y = HEAD + AXES_H; title40(c, en ? 'Your type' : '人格解读', y + 50); c.fillStyle = C.card; rr(c, P, y + 80, W - 2 * P, g.typeH - 110, 20); c.fill();
    let ty = y + 80 + 60; g.typeRows.forEach(([k, ls]) => { c.fillStyle = t.color; c.font = '700 26px ' + SANS; c.fillText(k, P + 36, ty); c.fillStyle = C.ink; c.font = '400 29px ' + SANS; ls.forEach((l, i) => c.fillText(l, P + 36 + 190, ty + i * 44)); ty += Math.max(1, ls.length) * 44 + 30; });
    // 四象限
    y = HEAD + AXES_H + g.typeH + 70; title40(c, en ? 'Quadrants' : '四象限', y); c.fillStyle = C.muted; c.font = '400 24px ' + SANS; c.fillText(en ? 'Interesting →   ↑ Boring' : '横轴有趣度 →　纵轴无聊度 ↑', P + (en ? 230 : 160), y);
    const bx = P, by = y + 36, bw = W - 2 * P, bh = CHART - 150;
    c.fillStyle = C.card; rr(c, bx, by, bw, bh, 20); c.fill(); c.strokeStyle = C.line; c.lineWidth = 2; c.stroke();
    [[bx, by, 0], [bx + bw / 2, by, 1], [bx, by + bh / 2, 2], [bx + bw / 2, by + bh / 2, 3]].forEach(([x, yy, k]) => { c.save(); rr(c, bx, by, bw, bh, 20); c.clip(); c.fillStyle = QC[k]; c.globalAlpha = 0.07; c.fillRect(x, yy, bw / 2, bh / 2); c.restore(); c.globalAlpha = 1; c.fillStyle = QC[k]; c.font = '700 26px ' + SANS; c.textAlign = k % 2 ? 'right' : 'left'; c.fillText(QN[k][en ? 1 : 0] + '  ' + a.q[k], k % 2 ? x + bw / 2 - 24 : x + 24, k < 2 ? yy + 44 : yy + bh / 2 - 24); c.textAlign = 'left'; });
    c.strokeStyle = C.line; c.setLineDash && c.setLineDash([8, 8]); c.beginPath(); c.moveTo(bx + bw / 2, by + 16); c.lineTo(bx + bw / 2, by + bh - 16); c.moveTo(bx + 16, by + bh / 2); c.lineTo(bx + bw - 16, by + bh / 2); c.stroke(); c.setLineDash && c.setLineDash([]);
    const groups = new Map(); a.rows.forEach(x => { const k = x.fun + '-' + x.bore; if (!groups.has(k)) groups.set(k, { fun: x.fun, bore: x.bore, n: 0 }); groups.get(k).n++; });
    groups.forEach(gp => { const px = bx + pos(gp.fun) / 100 * bw, py = by + (100 - pos(gp.bore)) / 100 * bh, k = quadrant(gp.fun, gp.bore), R = Math.min(34, 14 + gp.n * 4);
      c.fillStyle = k < 0 ? C.muted : QC[k]; c.globalAlpha = 0.9; c.beginPath(); c.arc(px, py, R, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; c.strokeStyle = '#fffaf0'; c.lineWidth = 3; c.stroke();
      if (gp.n > 1) { c.fillStyle = '#fffaf0'; c.font = '700 ' + (R > 24 ? 24 : 20) + 'px ' + SANS; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(gp.n), px, py + 1); c.textAlign = 'left'; c.textBaseline = 'alphabetic'; } });
    // 统计
    y = HEAD + AXES_H + g.typeH + CHART; const cells = [[f1(a.avgF), en ? 'Avg interesting' : '平均有趣度'], [f1(a.avgB), en ? 'Avg boring' : '平均无聊度'], [String(a.unsure), en ? 'Hard to classify' : '难以归类'], [String(a.n), en ? 'Films mapped' : '上图影片']], sw = (W - 2 * P - 36) / 4;
    cells.forEach(([v, l], i) => { const x = P + i * (sw + 12); c.fillStyle = C.card; rr(c, x, y, sw, 150, 18); c.fill(); c.fillStyle = C.teal; c.font = '800 52px ' + SERIF; c.fillText(v, x + 26, y + 76); c.fillStyle = C.muted; c.font = '400 22px ' + SANS; c.fillText(l, x + 26, y + 120); });
    { const at = a.atlas || {}, aw = (W - 2 * P - 24) / 3, ay = y + 166, ac = [[at.dir ? at.dir.name : '—', at.dir ? (en ? 'Top director · ' + at.dir.n : '最常看的导演 · ' + at.dir.n + ' 部') : (en ? 'Top director' : '最常看的导演')], [at.minY ? at.minY + '–' + at.maxY : '—', en ? at.decades + ' decades' : '跨越 ' + at.decades + ' 个年代'], [String(at.countries || '—'), en ? 'Countries / regions' : '个国家和地区']];
      ac.forEach(([v, l], i) => { const x = P + i * (aw + 12); c.fillStyle = C.card; rr(c, x, ay, aw, 140, 18); c.fill(); c.fillStyle = C.ink; let fz2 = 40; c.font = '800 ' + fz2 + 'px ' + SERIF; while (fz2 > 22 && c.measureText(v).width > aw - 48) { fz2 -= 2; c.font = '800 ' + fz2 + 'px ' + SERIF; } c.fillText(v, x + 24, ay + 66); c.fillStyle = C.muted; c.font = '400 22px ' + SANS; c.fillText(l, x + 24, ay + 110); }); }
    // 数据解读
    y += STATS; title40(c, en ? 'Reading your data' : '数据解读', y + 50); c.fillStyle = C.card; rr(c, P, y + 80, W - 2 * P, g.paraH - 110, 20); c.fill();
    ty = y + 80 + 62; c.font = '400 31px ' + SANS; c.fillStyle = C.ink; g.paras.forEach(ls => { ls.forEach(l => { c.fillText(l, P + 36, ty); ty += LH; }); ty += 22; });
    y += g.paraH;
    // 代表作
    if (g.picksH) { title40(c, en ? 'Signature films' : '代表作', y + 50); let py = y + 90;
      a.picks.forEach(([lab, x]) => { c.fillStyle = C.card; rr(c, P, py, W - 2 * P, PICK - 14, 16); c.fill(); c.fillStyle = C.red; c.font = '700 24px ' + SANS; c.fillText(lab, P + 28, py + 48); c.fillStyle = C.ink; c.font = '700 30px ' + SANS; let s = (en ? '' : '《') + x.title + (en ? '' : '》'); while (c.measureText(s).width > W - 2 * P - 500 && s.length > 2) s = s.slice(0, -2) + '…'; c.fillText(s, P + 230, py + 49); c.fillStyle = C.muted; c.font = '500 24px ' + MONO; c.textAlign = 'right'; c.fillText((en ? 'FUN ' : '有趣 ') + f1(x.fun) + (en ? ' · BORE ' : ' · 无聊 ') + f1(x.bore), W - P - 28, py + 48); c.textAlign = 'left'; py += PICK; });
      y += g.picksH; }
    // 提醒：图谱会随观影变化
    c.strokeStyle = C.line; c.lineWidth = 2; c.setLineDash && c.setLineDash([10, 8]); rr(c, P, y + 20, W - 2 * P, g.noteH - 30, 18); c.stroke(); c.setLineDash && c.setLineDash([]);
    c.fillStyle = C.muted; c.font = '400 26px ' + SANS; g.note.forEach((l, i) => c.fillText(l, P + 36, y + 76 + i * 40));
    y += g.noteH;
    if (o.footer) o.footer(c, y, H);
  }
  const api = { W, analyze, years, heightOf, draw, FOOT, hash, TYPES, MATE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SparrowTasteReport = api;
})(typeof window !== 'undefined' ? window : this);
