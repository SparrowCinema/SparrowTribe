// Companion ticket artwork and data model, shared by the website and mini program.
// 2026-11-21 起票根是「某一次观影的皮肤」：存储只留用户改过的字段（见 shared/psync.js 的 cleanTix），
// 日期、影院、片名、专题都在显示时由观影记录与片库推出。旧版整条记录（sparrow-tickets-v1 / sk-tickets-v1）用 migrateV1 迁移。
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./psync.js"),require("./ticket-sketch.js"));
  else root.SparrowTickets = factory(root.SparrowSync,root.SparrowTicketSketch);
})(typeof self === "undefined" ? this : self, function (Sync,Sketch) {
"use strict";

const W=420, H=864, TEAR=698, TEETH=17, DEPTH=8, NOTCH=11;
const SOURCE={x:24,y:94,w:372,h:330};
// 与网站整体视觉一致：标题 Noto Serif SC（黑体粗度）、正文 Noto Sans SC、数字 IBM Plex Mono、英文片名 Barlow。
// 网页画之前会等这些字体载入（js/tickets.js 的 ticketFonts）；小程序与没有网络时退回系统宋体 / 苹方。
const SANS='"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif';
const SERIF='"Noto Serif SC","Songti SC","STSong","SimSun",serif';
// 片名专用：润植家康熙字典美化体（免费可商用，按片名取字子集，见 tools/build-title-font.py）。
// 输入简体会显示成《康熙字典》里对应的字形；字体没载入或缺字时退回上面的宋体。只有常规一档，用 500 避免浏览器合成假粗体。
const TITLE_FAMILY="SparrowKangxi",TITLE=`"${TITLE_FAMILY}",${SERIF}`,TITLE_WEIGHT=500;
const MONO='"IBM Plex Mono",ui-monospace,Menlo,monospace';
const LATIN='"Barlow","Helvetica Neue",Arial,sans-serif';
const WALL_PAGE=12;
const finishes = {
  holo:    {label:"虹彩镭射箔", kind:"spectrum", stops:["#b58a59","#f5c1e6","#81ece0","#b5b9ff","#fff1a8","#c99aaa"], width:2.05},
  aurora:  {label:"极光幻变箔", kind:"spectrum", stops:["#12516c","#7dffe0","#cefcb2","#8ca9ff","#f6a4fd","#296684"], width:2.6},
  prism:   {label:"钻石棱镜箔", kind:"spectrum", stops:["#adb7db","#fffefd","#ffa8f4","#c1f5ff","#baacf9","#fffdf3","#8493b5"], width:2.45},
  solar:   {label:"日珥赤焰箔", kind:"spectrum", stops:["#9f3660","#f68b8e","#ffdd82","#fff5d7","#ec9de9","#b65272"], width:2.35},
  opal:    {label:"欧泊幻彩箔", kind:"spectrum", stops:["#ad8bbe","#ffdef2","#fdf6d0","#8de2dd","#d9d1ff","#849fb3"], width:2.1},
  cobalt:  {label:"钴蓝电光箔", kind:"spectrum", stops:["#405eaa","#83cbff","#e1faff","#a6a4ff","#e4a3ff","#596dcc"], width:2.2},
  gold:    {label:"香槟金箔", kind:"metal", stops:["#805535","#dfb974","#fff0bf","#a47544"], width:1.52},
  silver:  {label:"镜面银箔", kind:"metal", stops:["#72818f","#c1d5e0","#fafbfb","#8393a1"], width:1.62},
  copper:  {label:"玫瑰铜箔", kind:"metal", stops:["#7b4050","#d8898b","#ffdec2","#af676d"], width:1.7},
  pearl:   {label:"月光珠母箔", kind:"metal", stops:["#9e98ad","#d7e1e3","#fff5f0","#d2c3df","#91a7b4"], width:1.85},
  // 2026-11-22 参考视高迪（Scodix）数字增效工艺新增：全息纹理（Cast&Cure）、水晶幻彩（Crystal）、金葱闪粉（Glitter）、立体光油（Sense）
  cast:    {label:"全息纹理箔", kind:"spectrum", fx:"cast", stops:["#8d94b8","#e8f4ff","#ffb8ec","#9ef3ff","#fff6b8","#b8a6ff","#8d94b8"], width:1.6},
  crystal: {label:"水晶幻彩钻", kind:"spectrum", fx:"crystal", stops:["#a9b4cc","#ffffff","#ffd1f1","#d3fbff","#fff3c7","#e2d4ff","#a9b4cc"], width:1.55},
  glitter: {label:"金葱闪粉", kind:"metal", fx:"glitter", stops:["#7d5a2e","#e9c77c","#fff6d6","#a87b3f"], width:1.7},
  sense:   {label:"立体光油", kind:"soft", fx:"sense", stops:["#a69f92","#e6e0d3","#fffdf6","#bdb5a5"], width:2.1},
  varnish: {label:"滴晶亮釉", kind:"soft", stops:["#8495a6","#b1c4c6","#f6f1e4","#9bb2a9"], width:1.95},
  matte:   {label:"哑光压纹", kind:"soft", stops:["#9d8969","#c1ae8d","#a69273"], width:1.08},
  // 隐藏款专用（2026-11-22）：不进盲盒、不出现在款式选择里，只由典藏编号抽中（isHidden）
  unique:  {label:"孤品流光箔", kind:"spectrum", hidden:true, stops:["#1d2b5e","#7cf3ff","#fff6c9","#ff9be6","#b6a4ff","#8dffd1","#1d2b5e"], width:2.5}
};

// 纸张（2026-11-21 重做）：只用柔和的高光与暖灰阴影，不再撒黑点、黑纤维。键名保留旧的 14 个（已保存的款式不失效），另加 6 种。
// layers 里每一层是一种纸面工艺；strength 是整体浓淡；tint/warmth 是正面的纸色。
const papers = {
  cotton:     {label:"冷压水彩纸", strength:1, layers:[["mottle",{count:22,min:22,max:52,light:.55,hi:.08,sh:.035}],["tooth",{count:700,hi:.16}]]},
  silk:       {label:"丝光绢纸", strength:1, layers:[["sheen",{hi:.10}],["lines",{dir:"d2",step:4,hi:.07,sh:.018}]]},
  linen:      {label:"亚麻纹艺术纸", strength:1, layers:[["weave",{step:4,hi:.13,sh:.05}],["mottle",{count:10,min:30,max:60,light:.5,hi:.05,sh:.025}]]},
  satin:      {label:"缎光珠光纸", strength:1, layers:[["sheen",{hi:.09,bands:2}],["tooth",{count:300,hi:.10}]]},
  washi:      {label:"楮皮和纸", strength:1, layers:[["mottle",{count:12,min:26,max:56,light:.6,hi:.08,sh:.025}],["fibers",{count:46,len:46,hi:.22,sh:.03,width:.55,curl:.5}]]},
  kraft:      {label:"精制牛皮卡", strength:1, tint:"#b28452", warmth:.16, layers:[["mottle",{count:16,min:20,max:44,light:.45,hi:.07,sh:.05}],["fibers",{count:70,len:12,hi:.16,sh:.035,width:.5,curl:.2}]]},
  parchment:  {label:"小羊皮纸", strength:1, tint:"#d3ac6c", warmth:.12, layers:[["mottle",{count:26,min:18,max:60,light:.5,hi:.06,sh:.04}]]},
  deckle:     {label:"手抄棉浆纸", strength:1, layers:[["mottle",{count:30,min:14,max:40,light:.55,hi:.08,sh:.04}],["fibers",{count:24,len:20,hi:.16,sh:0,width:.5,curl:.6}],["tooth",{count:500,hi:.14}]]},
  leather:    {label:"荔枝压纹纸", strength:1, layers:[["cells",{step:10,size:4.4,hi:.20,sh:.07}]]},
  crosshatch: {label:"斜纹布面纸", strength:1, layers:[["lines",{dir:"d1",step:5,hi:.12,sh:.04}],["lines",{dir:"d2",step:5,hi:.07,sh:.025}]]},
  ribbed:     {label:"罗纹压线纸", strength:1, layers:[["ribs",{step:5,hi:.20,sh:.06}]]},
  fleck:      {label:"洒金宣纸", strength:1, tint:"#efe2c4", warmth:.12, layers:[["fibers",{count:26,len:40,hi:.14,sh:0,width:.45,curl:.4}],["flakes",{count:16,size:2.6,colors:["#f3d58b","#d8a64a","#fff1c2"],alpha:.85}]]},
  laid:       {label:"帘纹书纸", strength:1, layers:[["laid",{step:4,chain:40,hi:.14,sh:.035}],["mottle",{count:8,min:30,max:60,light:.5,hi:.05,sh:.02}]]},
  frost:      {label:"霜面珠光卡", strength:1, tint:"#e1eaf1", warmth:.2, layers:[["sheen",{hi:.08,bands:1}],["tooth",{count:900,hi:.12}]]},
  mica:       {label:"云母银箔纸", strength:1, layers:[["mottle",{count:12,min:24,max:50,light:.6,hi:.07,sh:.02}],["flakes",{count:30,size:1.8,colors:["#ffffff","#e7eef4","#d6dde4"],alpha:.8}]]},
  xuan:       {label:"生宣", strength:1, tint:"#f3ead6", warmth:.14, layers:[["mottle",{count:14,min:28,max:64,light:.65,hi:.09,sh:.02}],["fibers",{count:30,len:60,hi:.12,sh:.02,width:.4,curl:.7}]]},
  moire:      {label:"水印波纹纸", strength:1, layers:[["moire",{gap:8,hi:.10,sh:.03}]]},
  velvet:     {label:"丝绒雾面纸", strength:1, layers:[["tooth",{count:2600,hi:.09,size:.7}],["mottle",{count:8,min:40,max:70,light:.5,hi:.04,sh:.02}]]},
  felt:       {label:"毛毡纹水彩纸", strength:1, layers:[["felt",{count:150,hi:.13,sh:.05}],["mottle",{count:10,min:30,max:60,light:.5,hi:.05,sh:.02}]]},
  vellum:     {label:"半透描图纸", strength:1, tint:"#e8eef0", warmth:.18, layers:[["sheen",{hi:.08,bands:1}],["mottle",{count:8,min:40,max:70,light:.7,hi:.06,sh:.015}]]}
};

// Label, back shadow/midtone/edge/ink, front paper/stub/ink.
const palettes = {
  burgundy: ["酒红铜金","#29121b","#56283a","#190d17","#f4d3a8","#f6eedc","#ede1c9","#722f36"],
  jade:     ["深海珐琅","#0d2526","#275d59","#0c181e","#c6e7d7","#eef5ed","#e0ece1","#21584c"],
  navy:     ["午夜银蓝","#101c31","#344967","#0e1526","#d7e9ff","#edf1f7","#dce5f1","#28496c"],
  honey:    ["黄铜琥珀","#272016","#5a4427","#1c160d","#fce1a7","#f8edda","#efdfbc","#6d491f"],
  ember:    ["朱砂赤金","#351715","#702c27","#22100f","#ffe0b3","#faf0e4","#f0dacb","#862c26"],
  violet:   ["暮紫珠光","#251a35","#523e74","#181123","#efdaff","#f1edfa","#e7def4","#52356f"],
  rose:     ["玫瑰烟霞","#381e31","#68374e","#1e1422","#ffe0ed","#fbecf1","#f2dce6","#883d5a"],
  moss:     ["苔绿古铜","#1c2922","#405947","#111b15","#e7edbe","#eef1e2","#e1e8d2","#41604c"],
  ink:      ["墨黑铂金","#18191c","#393e47","#111115","#edf0f5","#f1f1f0","#e3e6e9","#384254"],
  clay:     ["陶赭云白","#361e16","#744a39","#221610","#fae0c8","#f4eade","#ebd6c8","#7d4b38"],
  cyan:     ["冰河极光","#112a37","#305b70","#0b1b2a","#d9f6ff","#eaf6f8","#d7eaf2","#246279"],
  plum:     ["黑李紫银","#221827","#503653","#140d19","#efe0f7","#f6eef5","#eadfed","#69375f"],
  lemon:    ["日光浅金","#363119","#686130","#1f1c0c","#fff2a5","#fbf5d8","#f1e8bd","#696029"],
  graphite: ["石墨雾银","#202829","#4a5658","#111718","#e0e9e9","#edf2f0","#dce6e5","#3b5353"],
  indigo:   ["鸢尾钴蓝","#1b1a38","#3d417c","#101026","#e3e8ff","#eef0fa","#dce0f6","#424781"],
  peach:    ["蜜桃暮金","#3f221d","#78463b","#241311","#ffe6cd","#fff2e8","#f5e0d4","#8a4a3d"],
  fern:     ["冷杉青铜","#192b22","#345745","#0e1c16","#dceacb","#eaf2e9","#dceadd","#3a6048"],
  iris:     ["丁香月白","#30223f","#624977","#1b1328","#f6ddff","#f8eef9","#eedff3","#6b487a"],
  rust:     ["铁锈砂岩","#302017","#643e25","#20120a","#ffe1ba","#f5ead9","#ecd9bf","#754426"],
  cobalt:   ["钴蓝银星","#101a3f","#254995","#0b1331","#e1e9ff","#eaf1ff","#dce7fb","#2f50a0"],
  teal:     ["孔雀铜箔","#112c31","#296265","#0c1c21","#d5f3ee","#e7f5f2","#d3ebe5","#276968"],
  crimson:  ["绯红黑曜","#340f23","#741e42","#200b15","#ffd9e8","#faeaf0","#f1d9e2","#852141"],
  olive:    ["香榧松绿","#222d1b","#4a6130","#141e10","#e7f1cc","#eef4e5","#e1ebd4","#466136"],
  sepia:    ["旧照茶褐","#2b221b","#564639","#1a1510","#f5e4ce","#f2ede4","#e7dbca","#645244"]
};

const motifs = {
  rosette:"雕版花结", orbit:"星轨", facets:"折光晶面", rays:"放映光束",
  waves:"海潮声纹", frames:"胶片画框", arches:"拱廊", contour:"地形等高线"
};

const families = {
  festival: {palette:["burgundy","honey","ember","rust","peach","crimson"], finish:["holo","gold","copper","solar","glitter","cast"], texture:["cotton","laid","parchment","deckle","fleck","felt"], motif:["rosette","rays","arches"]},
  region: {palette:["jade","navy","cyan","teal","fern","cobalt"], finish:["silver","aurora","opal","pearl","crystal"], texture:["silk","washi","frost","xuan","moire","vellum"], motif:["waves","orbit","contour"]},
  theme: {palette:["violet","indigo","rose","iris","plum","cobalt"], finish:["prism","opal","cobalt","varnish","cast","crystal","sense"], texture:["linen","crosshatch","satin","leather","velvet","mica"], motif:["facets","rays","orbit"]},
  venue: {palette:["moss","clay","olive","peach","sepia","rust"], finish:["copper","gold","varnish","matte","sense","glitter"], texture:["kraft","washi","cotton","felt","xuan","laid"], motif:["arches","contour","frames"]},
  cinema: {palette:["ink","graphite","navy","lemon","sepia","indigo"], finish:["silver","matte","cobalt","pearl","sense"], texture:["ribbed","frost","satin","velvet","vellum","mica"], motif:["frames","rays","facets"]}
};

const programmeLooks = {
  "wutianming-2026": {family:"festival", palette:"burgundy", finish:"holo", texture:"cotton", motif:"rosette"},
  "golden-horse-2026": {family:"festival", palette:"honey", motif:"rays"},
  "golden-rooster-2026": {family:"festival", palette:"ember", motif:"facets"},
  "german-film-2026": {family:"region", palette:"navy", motif:"frames"},
  "hainan-2026": {family:"region", palette:"jade", finish:"silver", motif:"waves"},
  "tiantan-tour-2026": {family:"festival", palette:"rust", motif:"arches"},
  "style-kaleidoscope": {family:"theme", palette:"violet", motif:"facets"},
  "sparrow-tribe-space": {family:"venue", palette:"clay", motif:"contour"},
  "cinema-2026": {family:"cinema", palette:"ink", motif:"frames"}
};
const seeded=start=>{let seed=start>>>0||1;return ()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};};
function hashAppearance(text) {
  let value=2166136261;
  for (let i=0;i<text.length;i++) value=Math.imul(value^text.charCodeAt(i),16777619);
  return (value^(value>>>16))>>>0;
}
function pick(pool,key) {
  return pool[hashAppearance(key)%pool.length];
}
function inferFamily(name) {
  if (/国际|国别|地区/.test(name)) return "region";
  if (/影展|电影周|电影节/.test(name)) return "festival";
  if (/空间|放映室|影院/.test(name)) return "venue";
  if (/院线|公映/.test(name)) return "cinema";
  return "theme";
}
// 转动时的工艺效果：镭射 holo（彩虹流动）、全息纹理 cast、水晶 crystal、金属 sweep（光带扫过）、闪粉 glitter、亮釉 gloss、立体光油 sense；哑光 none
const fxOf=key=>{const f=finishes[key];return !f?"none":f.fx||(f.kind==="spectrum"?"holo":f.kind==="metal"?"sweep":key==="varnish"?"gloss":"none");};
// 用烫印渐变画的东西都记下来，画「工艺遮罩」时只留这些（见 foilMask）
const FOIL=typeof WeakSet==="function"?new WeakSet():null;
const foilTag=gradient=>{FOIL?.add(gradient);return gradient;};
function foilGradient(surface,x1,y1,x2,y2,finish) {
  const range=finishes[finish].stops;
  const foil=surface.createLinearGradient(x1,y1,x2,y2);
  FOIL?.add(foil);
  range.forEach((color,i)=>{
    const stop=i/(range.length-1);
    if (finish === "prism" && i>0) foil.addColorStop(stop-.07,range[i-1]);
    foil.addColorStop(stop,color);
  });
  return foil;
}

function trace(surface, points, closed=false) {
  surface.beginPath();
  for (const [i,[x,y]] of points.entries()) {
    if (i) surface.lineTo(x,y);
    else surface.moveTo(x,y);
  }
  if (closed) surface.closePath();
  surface.stroke();
}

function ring(surface,radius) {
  surface.beginPath();surface.arc(0,0,radius,0,Math.PI*2);surface.stroke();
}

function polar(radius,angle) {
  return [radius*Math.cos(angle),radius*Math.sin(angle)];
}

function drawMedallion(surface, style, fill) {
  const {motif,finish,seed}=style;
  const phase=(seed%720)*Math.PI/360;
  const metallic=finishes[finish].kind;
  surface.save();
  surface.translate(W/2,283);
  surface.strokeStyle=foilGradient(surface,-146,-108,146,118,finish);
  surface.lineWidth=metallic === "spectrum" ? .94 : .79;
  surface.globalAlpha=metallic === "spectrum" ? .64 : .48;
  surface.save();
  if (motif === "rosette") {
    surface.rotate(phase);
    const petals=[16,18,20,22,24][seed%5];
    for (let i=0;i<petals;i++) {
      surface.rotate(Math.PI*2/petals);
      surface.beginPath();surface.ellipse(0,-52,28+(seed>>>8)%8,94,0,0,Math.PI*2);surface.stroke();
    }
  } else if (motif === "orbit") {
    for (let i=0;i<9;i++) {
      surface.beginPath();surface.ellipse(0,0,149,43+i*5,phase+i*Math.PI/9,0,Math.PI*2);surface.stroke();
      const [x,y]=polar(148,phase+i*2.4);
      surface.beginPath();surface.arc(x,y,2+i%3,0,Math.PI*2);surface.stroke();
    }
  } else if (motif === "facets" || motif === "rays") {
    const rays=motif === "rays";
    const edges=rays ? 44+4*(seed%6) : 8+2*(seed%4);
    for (let i=0;i<edges;i++) {
      const a=phase+i*Math.PI*2/edges, b=a+Math.PI*2/edges;
      if (rays) trace(surface,[polar(81+(i%5)*5,a-.1),polar(i%5?142:154,a)]);
      else trace(surface,[polar(83,a),polar(146,a),polar(120,b),polar(146,b),polar(83,b)],true);
    }
  } else if (motif === "waves") {
    surface.beginPath();surface.arc(0,0,148,0,Math.PI*2);surface.clip();
    for (let y=-151;y<=151;y+=9) {
      const points=Array.from({length:37},(_,i)=>{
        const x=-151+i*8.5;
        return [x,y+10*Math.sin(x/32+y/29+phase)+5*Math.cos(x/17+y/60)];
      });
      trace(surface,points);
    }
  } else if (motif === "frames" || motif === "arches") {
    const arch=motif === "arches";
    for (let i=0;i<9;i++) {
      const x=127-i*6, y=146-i*7, shoulder=arch ? 27+i*2 : 11;
      surface.beginPath();surface.moveTo(-x,y);surface.lineTo(-x,-shoulder);
      if (arch) surface.quadraticCurveTo(-x,-y,0,-y);
      else {surface.lineTo(-x,-y);surface.lineTo(0,-y);}
      if (arch) surface.quadraticCurveTo(x,-y,x,-shoulder);
      else {surface.lineTo(x,-y);surface.lineTo(x,-shoulder);}
      surface.lineTo(x,y);surface.closePath();surface.stroke();
    }
    for (let i=-6;i<=6;i++) {
      surface.strokeRect(-135,i*20-3,3,6);surface.strokeRect(132,i*20-3,3,6);
    }
  } else {
    for (let radius=83;radius<=146;radius+=7) {
      const points=Array.from({length:64},(_,i)=>{
        const a=(Math.PI*2*i)/64;
        const wobble=Math.sin(a*3+phase)*5+Math.cos(a*4-phase+radius/120)*4;
        return polar(radius+wobble,a);
      });
      trace(surface,points,true);
    }
  }
  surface.restore();
  surface.globalAlpha=.82;
  if (motif === "frames" || motif === "arches") {
    surface.strokeRect(-143,-155,286,310);
  } else {
    for (const radius of [108,125,149]) ring(surface,radius);
    if (metallic === "spectrum") {
      surface.globalAlpha=.46;
      surface.lineWidth=1.05;
      for (const radius of [111,128,152]) ring(surface,radius);
    }
  }
  surface.globalAlpha=1;
  surface.fillStyle=fill;
  surface.beginPath();surface.arc(0,0,69,0,Math.PI*2);surface.fill();surface.stroke();
  surface.restore();
}

// 上下边的波浪齿：每个齿是一段平滑的余弦波（贝塞尔近似），齿大而圆润，不是细碎的锯齿
function teeth(surface, y, direction, inset) {
  const shoulder = 3;
  const pitch = (W - 2*shoulder) / TEETH, k = .3642;
  const start = direction > 0 ? shoulder : W-shoulder;
  surface.lineTo(start,y);
  for (let i = 0; i < TEETH; i += 1) {
    const x = start + direction*pitch*i, half = direction*pitch/2;
    surface.bezierCurveTo(x+half*k,y,x+half*(1-k),y+inset,x+half,y+inset);
    surface.bezierCurveTo(x+half*(1+k),y+inset,x+half*(2-k),y,x+2*half,y);
  }
  surface.lineTo(direction > 0 ? W : 0,y);
}

function frame(surface) {
  surface.beginPath();
  surface.moveTo(0,0);
  teeth(surface,0,1,DEPTH);
  surface.lineTo(W,TEAR-NOTCH);
  surface.arc(W,TEAR,NOTCH,-Math.PI/2,Math.PI/2,true);
  surface.lineTo(W,H);
  teeth(surface,H,-1,-DEPTH);
  surface.lineTo(0,TEAR+NOTCH);
  surface.arc(0,TEAR,NOTCH,Math.PI/2,-Math.PI/2,true);
  surface.closePath();
  surface.clip();
}


// 盲盒搭配规则（2026-11-22）：配色分冷暖，底箔只从和配色调子相配的里面抽（暖色配金铜、冷色配银与冷调镭射、紫粉配珠光棱镜）
const TONE={warm:["burgundy","honey","ember","rust","peach","crimson","clay","sepia","lemon","olive","moss"],
  cool:["jade","navy","cyan","teal","fern","cobalt","ink","graphite","indigo"],mauve:["violet","rose","iris","plum"]};
const TONE_FINISH={warm:["gold","copper","solar","holo","glitter","sense","varnish","matte","pearl"],
  cool:["silver","aurora","opal","pearl","cobalt","crystal","prism","cast","sense","varnish","matte"],
  mauve:["prism","opal","pearl","crystal","copper","holo","cast","sense","varnish"]};
const toneOf=palette=>Object.keys(TONE).find(t=>TONE[t].includes(palette))||"cool";
function matchFinish(list,palette) {const ok=TONE_FINISH[toneOf(palette)];const hit=list.filter(f=>ok.includes(f));return hit.length?hit:list;}
function defaults(record) {
  const preset=programmeLooks[record.programmeId] || {};
  const family=families[preset.family] || families[inferFamily(record.programme)];
  const key="sparrow-collectible-1|"+record.programmeId;
  const palette=preset.palette || pick(family.palette,key);
  // 盲盒：专题指定的底箔 / 纸张只占四成，其余从同家族里按搭配规则抽，同一专题的票根也各不相同；配色与纹样仍按专题固定（专题的识别感）
  const often=(value,salt)=>value && hashAppearance(key+"|"+record.id+"|"+salt)%10<4 ? value : null;
  return {
    palette,
    finish:often(preset.finish,"finish") || pick(matchFinish(family.finish,palette),key+"|"+record.id),
    texture:often(preset.texture,"texture") || pick(family.texture,key+"|"+record.id),
    motif:preset.motif || pick(family.motif,key+"|"+record.id)
  };
}
const options={finish:finishes,texture:papers,palette:palettes,motif:motifs};

// ——— 工艺组合（2026-11-22，参考视高迪 Scodix 全套数字增效）———
// 一张票根 = 烫印底箔（finish）+ 0–2 种烫印增效 + 1 种海报画面增效 + 盲文 / 可变数据烫印两个开关。
// 编码 craft = "<烫印增效字母>-<海报字母>[<背面字母>]<开关>"，如 "gs-uaBv"：闪粉 + 立体光油；海报隐形高光UV；背面隐形菱格纹；盲文；日期可变数据烫印。
// 背面字母省略时（2026-11-22 之前的编码）背面跟海报同一个字母。2026-11-22 起海报与背面各自独立抽，25 × 25 种隐形组合。
// 默认按票根 id 稳定随机（同一张票根永远一样），「随机换一款」会一起换；改过的存在票根的 x 字段（shared/psync.js）。
// 组合数：11 种烫印增效 × 7 种海报增效 × 4 种开关 = 308 种，再乘 16 种底箔、各家族的配色 / 纸张 / 纹样。
const CRAFT_FOIL={s:"sense",g:"glitter",c:"crystal",h:"cast"};
const CRAFT_ART={u:"uv",r:"rim",o:"holo",k:"sparkle",b:"band",d:"dust",w:"rainbow",p:"pixel",q:"ripple",m:"moire",l:"lenticular",i:"glint",n:"cateye",
  a:"argyle",c:"cloud",e:"meander",f:"perf",g:"firework",h:"honeycomb",j:"caustic",s:"beam",t:"diag",x:"contour",y:"postmark",z:"frames"};
const CRAFT_LABEL={sense:"立体光油",glitter:"金葱闪粉",crystal:"水晶幻彩",cast:"全息纹理",
  uv:"隐形高光UV",rim:"隐形轮廓光油",holo:"隐形全息水印",sparkle:"隐形珠光",band:"隐形扭索纹",dust:"亮哑对比纹",
  // 背面同一个字母对应另一种隐形底纹（2026-11-22）
  rainbow:"隐形镭射彩虹",pixel:"隐形像素镭射",ripple:"隐形同心波纹",moire:"隐形莫尔纹",lenticular:"隐形光栅变色",glint:"隐形星芒",cateye:"隐形猫眼光",
  argyle:"隐形菱格纹",cloud:"隐形祥云纹",meander:"隐形回纹",perf:"隐形胶片齿孔",firework:"隐形烟花",honeycomb:"隐形蜂巢纹",caustic:"隐形水波光",beam:"隐形放映光束",diag:"隐形斜纹光栅",contour:"隐形等高线",postmark:"隐形邮戳",frames:"隐形胶片帧",
  "back-moire":"隐形莫尔纹","back-lenticular":"隐形光栅变色","back-glint":"隐形星芒","back-cateye":"隐形猫眼光",
  "back-rainbow":"隐形镭射彩虹","back-pixel":"隐形像素镭射","back-ripple":"隐形同心波纹",
  "back-uv":"隐形放射纹","back-rim":"隐形环形扭索","back-holo":"隐形专题水印","back-sparkle":"隐形星尘","back-band":"隐形扭索底纹","back-dust":"亮哑网点底纹",braille:"盲文凸点",vde:"日期可变数据烫印"};
const CRAFT_RE=/^[sgch]{0,2}-[0urokbdwpqmlinacefghjstxyz][urokbdwpqmlinacefghjstxyz]?[Bv]{0,2}$/;
// 搭配规则：闪粉 / 水晶 / 全息纹理这类显眼的增效一张最多一种，底箔本身已经是其中之一就不再加；立体光油可以和它们搭。
// 海报 / 背面的隐形工艺每张都有（静止时看不见，转动时才出来），不再抽到「无」。
const SHOWY=["g","c","h"];
function makeCraft(rand,finish) {
  const own=finishes[finish]?.fx,ownShowy=["glitter","crystal","cast"].includes(own);
  const picked=[];
  if (!ownShowy && rand()<.55) picked.push(SHOWY[Math.floor(rand()*SHOWY.length)]);
  if (own!=="sense" && rand()<(picked.length?.3:.45)) picked.push("s");
  const arts=Object.keys(CRAFT_ART),art=arts[Math.floor(rand()*arts.length)],back=arts[Math.floor(rand()*arts.length)];
  return picked.sort().join("")+"-"+art+back+(rand()<.25?"B":"")+(rand()<.35?"v":"");
}
const craftFor=(record,finish)=>makeCraft(seeded(hashAppearance("craft|"+(record.id||record.key||""))),finish);
function parseCraft(code) {
  const text=CRAFT_RE.test(code||"") ? code : "-0";
  const [foil,rest]=text.split("-");
  const art=CRAFT_ART[rest[0]]||null,back=CRAFT_ART[rest[1]]||art;
  return {foil:[...foil].map(c=>CRAFT_FOIL[c]),art,back,braille:rest.includes("B"),vde:rest.includes("v")};
}
function craftLabel(look,tr=x=>x) {
  const c=parseCraft(look?.craft),parts=[finishes[look?.finish]?.label||""];
  c.foil.forEach(k=>parts.push(CRAFT_LABEL[k]));if (c.art) parts.push("海报"+CRAFT_LABEL[c.art]);if (c.back) parts.push("背面"+(CRAFT_LABEL["back-"+c.back]||CRAFT_LABEL[c.back]));
  if (c.braille) parts.push(CRAFT_LABEL.braille);if (c.vde) parts.push(CRAFT_LABEL.vde);
  return parts.filter(Boolean).map(tr).join(" + ");
}
const lookSig=look=>packLook(look)+"|"+(look?.craft||"");

function sanitize(input) {
  if (!input || typeof input!=="object" || typeof input.filmId!=="string" || !input.filmId ||
      typeof input.title!=="string" || !input.title.trim()) return null;
  const record={};
  for (const [key,limit] of Object.entries({
    id:900,filmId:160,showId:160,title:600,subtitle:600,programmeId:160,programme:120,
    section:120,date:10,time:5,venue:160,hall:80,city:60,seat:36,format:60,art:1000
  })) {
    record[key]=typeof input[key]==="string" ? input[key].slice(0,limit).trim() : "";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(record.date)) record.date="";
  if (!/^\d{2}:\d{2}$/.test(record.time)) record.time="";
  record.id ||= JSON.stringify([record.filmId,record.showId || [record.programmeId,record.date,record.time,record.venue,record.hall]]);
  record.sketch=input.sketch===true;
  record.crop=Number.isFinite(input.crop) ? Math.max(0,Math.min(100,input.crop)) : 50;
  record.savedAt=Number.isFinite(input.savedAt) ? input.savedAt : 0;
  record.serial=serialValid(input.serial) ? input.serial : "";
  record.issue=Number.isInteger(input.issue) && input.issue>0 ? input.issue : 0;
  const fallback=defaults(record);
  record.look=Object.fromEntries(Object.entries(options).map(([key,registry])=>
    [key,Object.prototype.hasOwnProperty.call(registry,input.look?.[key]) ? input.look[key] : fallback[key]]));
  record.look.craft=CRAFT_RE.test(input.look?.craft||"") ? input.look.craft : craftFor(record,record.look.finish);
  // 隐藏款（2026-11-22）：由典藏编号抽中，底箔换成「孤品流光箔」（原来的底箔记在 _finish，保存时还原，不存进款式）
  if (isHidden(record.serial)) {if (record.look.finish!=="unique") record._finish=record.look.finish;record.look.finish="unique";}
  else if (finishes[record.look.finish]?.hidden) record.look.finish=fallback.finish;
  return record;
}

function randomLook(record,locked=[]) {
  const look=Object.fromEntries(Object.entries(options).map(([dimension,registry])=>{
    if (locked.includes(dimension)) return [dimension,record.look[dimension]];
    const candidates=Object.keys(registry).filter(key=>key!==record.look[dimension] && !registry[key].hidden);
    return [dimension,candidates[Math.floor(Math.random()*candidates.length)]];
  }));
  look.craft=locked.includes("craft") ? record.look.craft : makeCraft(Math.random,look.finish);
  return look;
}

function labelOptions() {
  return Object.fromEntries(Object.entries(options).map(([key,registry])=>
    [key,Object.entries(registry).filter(([,item])=>!item.hidden).map(([id,item])=>({id,label:item.label || (Array.isArray(item) ? item[0] : item)}))]));
}

function read(raw) {
  try {
    const value=typeof raw==="string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(value)) return [];
    return Array.from(new Map(value.map(sanitize).filter(Boolean).map(record=>[record.id,record])).values());
  } catch (_) { return []; }
}

// ——— 典藏编号（2026-11-22）———
// 每张典藏票根一串编号，例如 No. SP26-7KQ4M-9XDQ3-AB2CD：SP + 观影年份后两位，后面 15 位＝14 位编码（70 位）+ 1 位校验。
// 编码由票根键 + 第一次保存的时间（毫秒）算出：同一张票根在网站、小程序、换手机后都一样；两个人同一天看同一部片也不一样。
// 70 位约 10²¹ 种：十万人各一千张（一亿张）全站出现任何一对重号的概率约百万分之四，不需要服务器发号。
// 第一次保存（或编辑、挪动）时写进票根的 n 字段，之后修改时间变了也不再变；没存过 n 的旧票根按当前保存时间推出，编辑时冻结下来。
const SERIAL_ABC="ABCDEFGHJKLMNPQRSTUVWXYZ23456789", SERIAL_LEN=14, SERIAL_RE=/^[A-HJ-NP-Z2-9]{15}$/;
function serialCheck(body) {let s=0;for (let i=0;i<SERIAL_LEN;i++) s+=SERIAL_ABC.indexOf(body[i])*(i+1);return SERIAL_ABC[s%31];}
// MurmurHash3（32 位），三个不同种子各取一份，拼成 96 位，用其中 70 位
function murmur32(str,seed) {
  let h=seed>>>0;
  for (let i=0;i<str.length;i++) {
    let k=Math.imul(str.charCodeAt(i),0xcc9e2d51);k=(k<<15)|(k>>>17);k=Math.imul(k,0x1b873593);
    h^=k;h=(h<<13)|(h>>>19);h=(Math.imul(h,5)+0xe6546b64)>>>0;
  }
  h^=str.length;h=Math.imul(h^(h>>>16),0x85ebca6b);h=Math.imul(h^(h>>>13),0xc2b2ae35);return (h^(h>>>16))>>>0;
}
function serialOf(key,t) {
  const str=String(key||"")+"#"+(Number(t)||0);
  const hs=[murmur32(str,0x9747b28c),murmur32(str,0x5bd1e995),murmur32(str,0x1b873593)];
  let body="";
  for (let i=0;i<SERIAL_LEN;i++) {const bit=i*5,w=hs[bit>>5]>>>0,off=bit&31;
    const v=off<=27 ? (w>>>off)&31 : ((w>>>off)|(hs[(bit>>5)+1]<<(32-off)))&31;body+=SERIAL_ABC[v];}
  return body+serialCheck(body);
}
const serialValid=code=>SERIAL_RE.test(code||"") && serialCheck(code)===code[SERIAL_LEN];
// 显示格式：No. SP26-7KQ4M-9XDQ3-AB2CD（没有日期时省掉年份）
const formatSerial=row=>row && serialValid(row.serial) ? "SP"+(/^\d{4}/.test(row.date||"") ? row.date.slice(2,4) : "")+"-"+row.serial.match(/.{5}/g).join("-") : "";
const entrySerial=(key,entry)=>entry && serialValid(entry.n) ? entry.n : serialOf(key,entry && entry.t);
// ——— 发行序号（2026-11-22）———
// 「本片第几张典藏」：由 Supabase 的 tk_issue 按影片统一发号（backend/tickets-issue-v1.sql），同一个典藏编号永远拿到同一个号。
// 存在票根的 q 字段；还没领到号的票根显示「待发号」，联网后由网站 js/tickets.js / 小程序 utils/ticketstore.js 自动去领。
const ISSUE_BATCH=50;
const issueText=no=>"№ "+String(no).padStart(4,"0");
// 还没领号的票根（每次最多 ISSUE_BATCH 张）：[{key, s:典藏编号, f:影片id, h:场次编号}]
// showOf(key) 返回这张票根关联的场次编号（没有返回空串）。已有序号、但有场次而还没绑定场次的票根也要再领一次（补「本场第几张」）；
// 没有序号的排在前面，避免一批票根因后端还没升级、反复补场次而挡住后面领号。
function pendingIssue(store,showOf) {
  const first=[],later=[];
  for (const key of Object.keys(store||{})) {
    const e=store[key], p=parseKey(key);
    if (!p || !e || e.del) continue;
    const h=showOf ? String(showOf(key)||"") : "";
    if (e.q && !(h && (!e.sh || e.sh==="-"))) continue;
    (e.q ? later : first).push({key,s:entrySerial(key,e),f:p.filmId,h});
  }
  return first.concat(later).slice(0,ISSUE_BATCH);
}
// 把领到的号写回票根，同时冻结典藏编号 n；返回要写入的改动，没有就返回 null
// 结果 {s, no, h, sno}：h 是这张票根绑定的场次（以第一次绑定为准），sno 是本场第几张；后端还不支持场次时记 sh:"-"，不再反复领。
function applyIssue(store,items,results,now) {
  const got=new Map((Array.isArray(results)?results:[]).filter(r=>r && serialValid(r.s) && Number.isInteger(r.no) && r.no>0).map(r=>[r.s,r]));
  const changes={};
  for (const it of items||[]) {
    const e=store[it.key], r=got.get(it.s);
    if (!r || !e || e.del || entrySerial(it.key,e)!==it.s) continue;
    // 不改修改时间：编号是按「票根键 + 保存时间」推算的，时间不变，就算旧版代码把 n / q 清掉，推算出来的还是同一个编号、领到的还是同一个号；
    // 序号靠同步合并时补齐缺失字段传到别的设备（shared/psync.js 的 mergeTix）
    const next={...e,n:it.s};
    if (!e.q) next.q=r.no;
    if (it.h && (!e.sh || e.sh==="-")) {
      if (typeof r.h==="string" && r.h) {next.sh=r.h;if (Number.isInteger(r.sno) && r.sno>0) next.sq=r.sno;}
      else next.sh="-";
    }
    if (JSON.stringify(next)!==JSON.stringify(e)) changes[it.key]=next;
  }
  return Object.keys(changes).length ? changes : null;
}

// ——— 典藏玩法（2026-11-22）：封版编号 / 场次限定 / 隐藏款 / 影展限定 / 验真 / 全收集金章 ———
// 隐藏款：按典藏编号抽，约 1/400，同一张票根永远一样；纹样也由编号生成，所以每张隐藏款都独一无二（1/1 孤品）。
const HIDDEN_RATE=400;
const isHidden=serial=>serialValid(serial) && hashAppearance("hidden|"+serial)%HIDDEN_RATE===0;
// 封版：一部影片最后一场散场、所属专题全部结束后再过 14 天封版（补做票根的宽限期）。
// ends＝该片全部场次的散场时间（毫秒），progs＝所属专题 [{end:专题结束那天 24 点的毫秒, open:常设专题}]。
// 结果向后取整到北京时间零点。有常设专题、专题没有结束日期，或既没有场次也没有专题时永不封版，返回 0。
const EDITION_GRACE=14*864e5;
function editionClose(ends,progs) {
  if (!(ends||[]).length && !(progs||[]).length) return 0;
  let last=0;
  for (const p of progs||[]) {if (p.open || !p.end) return 0;if (p.end>last) last=p.end;}
  for (const e of ends||[]) if (e>last) last=e;
  // 向后取整到北京时间零点：网站和小程序各自按本机时间推算散场时间，差几分钟也会得到同一个封版时间（总数一致）
  const BJ=8*36e5;
  return last ? Math.ceil((last+EDITION_GRACE+BJ)/864e5)*864e5-BJ : 0;
}
// 已领号、还没记下封版总数、且封版时间已过的影片（每次最多 100 部）：[{f, c:封版时间 ISO}]
function pendingEdition(store,closeOf,now) {
  const films=new Map(),t=now||Date.now();
  for (const key of Object.keys(store||{})) {
    const e=store[key], p=parseKey(key);
    if (!p || !e || e.del || !e.q || Number.isInteger(e.o) || films.has(p.filmId)) continue;
    const c=closeOf ? Number(closeOf(p.filmId))||0 : 0;
    if (c && c<=t) films.set(p.filmId,c);
    if (films.size>=100) break;
  }
  return [...films].map(([f,c])=>({f,c:new Date(c).toISOString()}));
}
// 后端 tk_edition 返回 [{f, total}]：写进这部影片每张已领号票根的 o（封版总数）。不改修改时间，原因同 applyIssue。
function applyEdition(store,results) {
  const got=new Map((Array.isArray(results)?results:[]).filter(r=>r && typeof r.f==="string" && Number.isInteger(r.total) && r.total>=0).map(r=>[r.f,r.total]));
  const changes={};
  for (const key of Object.keys(store||{})) {
    const e=store[key], p=parseKey(key);
    if (!p || !e || e.del || !e.q || Number.isInteger(e.o) || !got.has(p.filmId)) continue;
    changes[key]={...e,o:got.get(p.filmId)};
  }
  return Object.keys(changes).length ? changes : null;
}
// 全收集金章：sets = {专题id: {films:[影片id], sections:{单元名:[影片id]}}}（院线、常设专题不参加，由调用方排除）。
// 收藏册里每部影片至少有一张票根就算集到；集齐整个专题（≥3 部）＝「全满贯」，集齐所在单元（≥2 部）＝「单元满贯」。
function decorate(rows,sets) {
  const have=new Set((rows||[]).map(r=>r.filmId));
  const all=ids=>ids && ids.length && ids.every(id=>have.has(id));
  for (const row of rows||[]) {
    row.slam="";row.slamN=0;
    const set=sets && sets[row.programmeId];
    if (!set) continue;
    if (set.films.length>=3 && all(set.films)) {row.slam="programme";row.slamN=set.films.length;}
    else {const sec=row.section && set.sections && set.sections[row.section];if (sec && sec.length>=2 && all(sec)) {row.slam="section";row.slamN=sec.length;}}
  }
  return rows;
}
// 验真：票根背面的二维码打开网站验真页（#verify=典藏编号）。二维码矩阵由各端提供（网站 vendor/qrcode.js，小程序分包 utils/qrcode.js）。
const VERIFY_BASE="https://sparrowcinema.github.io/SparrowTribe/#verify=";
const verifyURL=serial=>serialValid(serial) ? VERIFY_BASE+serial : "";
let qrMaker=null;const qrCache=new Map();
function setQR(fn) {qrMaker=typeof fn==="function" ? fn : null;qrCache.clear();}
function qrFor(serial) {
  if (!qrMaker || !serialValid(serial)) return null;
  if (!qrCache.has(serial)) {let m=null;try {m=qrMaker(verifyURL(serial));} catch (e) {}if (qrCache.size>400) qrCache.clear();qrCache.set(serial,Array.isArray(m) && m.length ? m : null);}
  return qrCache.get(serial);
}
// 票面上的发行信息文字（背面撕线下方与合成图共用）
function editionLines(record) {
  if (!record.issue) return {no:"№ ----",total:"",line1:"待发号 · 联网后自动烫印",line2:""};
  const closed=record.edition>=0, inEdition=closed && record.issue<=record.edition;
  const line1=!closed ? "本片第 "+record.issue+" 张典藏" : inEdition ? "本片第 "+record.issue+" 张 · 共 "+record.edition+" 张 · 已封版" : "本片第 "+record.issue+" 张 · 封版后典藏";
  const line2=[record.showNo ? "本场第 "+record.showNo+" 张" : "",record.showTag].filter(Boolean).join(" · ");
  return {no:issueText(record.issue),total:inEdition ? " / "+String(record.edition).padStart(4,"0") : "",line1,line2};
}
const badgesOf=record=>[record.hidden ? "隐藏款 · 1/1 孤品" : "",record.limited ? record.limitedName+"限定" : "",record.slam==="programme" ? "全满贯 · 集齐 "+record.slamN+" 部" : record.slam==="section" ? "单元满贯 · 集齐 "+record.slamN+" 部" : ""].filter(Boolean);

function sorted(records,programme,year) {
  return records.filter(row=>(!programme || row.programme===programme) && (!year || row.date.slice(0,4)===year)).sort((a,b)=>
    (b.date+b.time).localeCompare(a.date+a.time) || b.savedAt-a.savedAt || a.id.localeCompare(b.id));
}

// ——— 存储：票根 = 观影记录的皮肤 ———
const SITE=/^https:\/\/sparrowcinema\.github\.io\/SparrowTribe\//i;
const ticketKey=(filmId,date,n)=>filmId+"|"+date+(n>1?"|"+n:"");
function parseKey(key) {
  if (typeof key!=="string" || !Sync.TIX_KEY.test(key)) return null;
  const [filmId,date,n]=key.split("|");
  return {filmId,date,n:Number(n||1)};
}
const cleanStore=raw=>Sync.cleanTix(typeof raw==="string" ? (()=>{try{return JSON.parse(raw);}catch(_){return {};}})() : raw);
const mergeStore=(a,b)=>Sync.mergeTix(Sync.cleanTix(a),Sync.cleanTix(b));
const packLook=look=>look ? [look.palette,look.finish,look.texture,look.motif].join(".") : "";
function unpackLook(text) {
  if (typeof text!=="string") return null;
  const [palette,finish,texture,motif]=text.split(".");
  return {palette,finish,texture,motif};
}
const normArt=url=>typeof url==="string" ? url.replace(SITE,"") : "";
function pickArt(arts,stored) {
  if (!stored) return "";
  return (arts||[]).find(url=>url===stored || normArt(url)===stored || url.endsWith("/"+stored)) || (/^https:\/\//i.test(stored) ? stored : "");
}
// 每一次观影一张票根；同一天看两次第二张键加 |2。views 为 SparrowGrowth.views，exists 判断影片还在片库里。
function viewings(watched,views,exists) {
  const out=[];
  for (const filmId of Object.keys(watched||{})) {
    const rec=watched[filmId];
    if (!rec || rec.del || !rec.d || !/^[\w-]{1,80}$/.test(filmId) || (exists && !exists(filmId))) continue;
    const seen={};
    for (const view of views(rec)) {
      const n=seen[view.d]=(seen[view.d]||0)+1;
      if (n<=9) out.push({key:ticketKey(filmId,view.d,n),filmId,view});
    }
  }
  return out;
}
// base(filmId, view|null, date) 由网站 / 小程序各自提供：返回 sanitize 之前的完整字段（含 arts 备选图像），影片不在片库时返回 null。
function record(key,filmId,view,entry,base,date) {
  const b=base(filmId,view,date);
  if (!b) return null;
  const pick=(field,value)=>value===undefined ? b[field] : value;
  const row=sanitize({...b,id:key,time:pick("time",entry.tm),venue:pick("venue",entry.vn),hall:pick("hall",entry.hl),
    city:pick("city",entry.cy),format:pick("format",entry.fm),seat:entry.st||"",art:pickArt(b.arts,entry.a) || b.art,
    crop:entry.c===undefined ? 50 : entry.c,sketch:entry.sk===1,savedAt:entry.t,serial:entrySerial(key,entry),issue:entry.q||0,look:{...unpackLook(entry.l),craft:entry.x}});
  row._entry={sh:entry.sh,sq:entry.sq,o:entry.o};
  row.key=key; row.linked=!!view; row.arts=b.arts||[]; row.director=b.director||"";
  // 典藏玩法（2026-11-22）
  row.showNo=entry.sh && entry.sh!=="-" && entry.sh===row.showId && entry.sq ? entry.sq : 0;
  row.showTag=String(b.showTag||"").slice(0,20);
  row.edition=Number.isInteger(entry.o) ? entry.o : -1;
  row.hidden=isHidden(row.serial);
  const inRange=row.date && b.progStart && b.progEnd && row.date>=b.progStart && row.date<=b.progEnd;
  row.limited=b.progKind==="影展专题" && !!inRange;
  row.limitedName=row.limited ? ((row.programme||"").replace(/^\d{4}\s*/,"").replace(/第\s*\d+\s*届/,"").replace(/\s+/g,"").slice(0,10)||"影展") : "";
  row.slam="";row.slamN=0;
  return row;
}
// 每一次观影一张票根（2026-11-22 起；之前是一部电影一张）：重看同一部电影会多一张，盲盒款式也不同。
// - 已收藏的观影显示为票根，还没做的观影进「待制作」；
// - 不对应观影记录的票根（改过观影日期、旧版迁移、手工新建）先由 reconcile 挪到这部电影还没有票根的观影上；
//   挪不了的（这部电影的观影都已有票根，或已不在护照里）不显示，存储保留。
// row.views＝这部电影一共看了几次，row.nth＝这是第几次（按观影日期，从 1 开始）。
function build(list,store,base) {
  const tickets=[], pending=[], linked=new Set(), byFilm=new Map();
  for (const item of list) {linked.add(item.key);if (!byFilm.has(item.filmId)) byFilm.set(item.filmId,[]);byFilm.get(item.filmId).push(item);}
  for (const [filmId,items] of byFilm) {
    items.sort((x,y)=>x.view.d.localeCompare(y.view.d) || x.key.localeCompare(y.key));
    items.forEach((item,i)=>{
      const entry=store[item.key];
      if (entry && !entry.del) {
        const row=record(item.key,filmId,item.view,entry,base,item.view.d);
        if (row) {row.views=items.length;row.nth=i+1;tickets.push(row);}
      } else pending.push(item);
    });
  }
  let hidden=0;
  for (const key of Object.keys(store)) {
    const entry=store[key];
    if (!linked.has(key) && entry && !entry.del && parseKey(key)) hidden++;
  }
  return {tickets:sorted(tickets),pending:pending.sort((a,b)=>b.view.d.localeCompare(a.view.d) || a.key.localeCompare(b.key)),hidden};
}
// 还没盖章的电影新建票根时的草稿（不对应观影记录，所以不经过 build）
function draft(key,entry,base) {const p=parseKey(key);return p ? record(key,p.filmId,null,entry||{t:Date.now()},base,p.date) : null;}
// 不对应观影记录的票根挪到同一部电影还没有票根的观影上（最近的优先）：返回要写入存储的改动，没有就返回 null。
// 只挪不删：原键留删除标记，内容原样搬到目标观影的键上，随同步传到其他设备。用户后来亲手移出的那次观影不挪回。
function reconcile(list,store,now) {
  const linked=new Set(list.map(item=>item.key)), free=new Map(), changes={};
  for (const item of [...list].sort((x,y)=>y.view.d.localeCompare(x.view.d) || y.key.localeCompare(x.key))) {
    if (store[item.key] && !store[item.key].del) continue;
    if (!free.has(item.filmId)) free.set(item.filmId,[]);
    free.get(item.filmId).push(item);
  }
  const orphans=Object.keys(store).filter(key=>!linked.has(key) && store[key] && !store[key].del && parseKey(key))
    .sort((a,b)=>(store[b].t||0)-(store[a].t||0));
  let n=0;
  for (const key of orphans) {
    const slots=free.get(parseKey(key).filmId)||[];
    const at=slots.findIndex(item=>{const gone=store[item.key];return !(gone && gone.del && (gone.t||0)>=(store[key].t||0));});
    if (at<0) continue;
    const target=slots.splice(at,1)[0],t=Math.max(now||Date.now(),(store[key].t||0)+1);
    changes[target.key]={...store[key],n:entrySerial(key,store[key]),t};changes[key]={del:1,t};n++;
  }
  return n ? changes : null;
}
// 编辑后的完整记录 → 只存和推导值不同的字段
function entryFrom(row,base,t) {
  const entry={t:t||Date.now()};
  const diff=(key,field)=>{const value=String(row[field]||"").trim();if(value!==String(base[field]||"").trim()) entry[key]=value;};
  diff("tm","time");diff("vn","venue");diff("hl","hall");diff("cy","city");diff("fm","format");
  if (row.seat) entry.st=row.seat;
  if (row.art && normArt(row.art)!==normArt(base.art)) entry.a=normArt(row.art);
  if (row.crop!==50) entry.c=row.crop;
  if (row.sketch) entry.sk=1;
  if (serialValid(row.serial)) entry.n=row.serial;
  if (row.issue) entry.q=row.issue;
  const old=row._entry||{};
  if (old.sh) entry.sh=old.sh;if (old.sq) entry.sq=old.sq;if (Number.isInteger(old.o)) entry.o=old.o;
  // 隐藏款的「孤品流光箔」是显示时套上的，不存进款式
  const lk=row.look && row.look.finish==="unique" ? {...row.look,finish:row._finish||defaults({...base,id:row.id}).finish} : row.look;
  const look=packLook(lk);
  if (look!==packLook(defaults({...base,id:row.id}))) entry.l=look;
  if (lk?.craft && lk.craft!==craftFor({...base,id:row.id},lk.finish)) entry.x=lk.craft;
  return Sync.cleanTixEntry(entry);
}
// 旧版整条记录 → 新存储；同一影片同一天的观影记录优先关联
function migrateV1(rows,list,base) {
  const store={}, slots={};
  for (const item of list) (slots[item.filmId+"|"+item.view.d] ||= []).push(item);
  for (const row of rows) {
    if (!row.date || !/^[\w-]{1,80}$/.test(row.filmId)) continue;
    const candidates=slots[row.filmId+"|"+row.date]||[];
    const match=candidates.find(item=>!store[item.key]);
    let key=match?.key, n=1;
    while (!key && n<10) {const next=ticketKey(row.filmId,row.date,n++);if(!store[next])key=next;}
    if (!key) continue;
    const b=base(row.filmId,match?match.view:null,row.date);
    store[key]=b ? entryFrom(sanitize({...row,id:key,programmeId:b.programmeId,programme:b.programme}),{...b,id:key},row.savedAt||Date.now()) :
      Sync.cleanTixEntry({t:row.savedAt||Date.now(),tm:row.time,vn:row.venue,hl:row.hall,cy:row.city,st:row.seat,fm:row.format,a:normArt(row.art),c:row.crop,sk:row.sketch?1:0,l:packLook(row.look)});
  }
  return store;
}
// 搜索 + 分面筛选：q = {text, year, programme:[], city:[], venue:[], format:[]}，同一分面内为「或」，不同分面为「且」
const FACETS=["programme","city","venue","format"];
function filterTickets(rows,q={}) {
  const terms=String(q.text||"").trim().toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter(row=>(!q.year || row.date.slice(0,4)===q.year) &&
    FACETS.every(field=>!q[field]?.length || q[field].includes(row[field])) &&
    terms.every(term=>[row.title,row.subtitle,row.venue,row.programme,row.city,row.director,row.hall,row.format,formatSerial(row),row.serial].join(" ").toLowerCase().includes(term)));
}
// 每个分面的计数只受其他筛选条件影响（选了 2024 年，专题后面就显示 2024 年里的张数）
function facetCounts(rows,q={}) {
  const list=obj=>Object.entries(obj).sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0],"zh")).map(([value,count])=>({value,count}));
  const tally=(subset,field,key)=>{const out={};for(const row of subset){const v=key?key(row):row[field];if(v) out[v]=(out[v]||0)+1;}return out;};
  const years=tally(filterTickets(rows,{...q,year:""}),"",row=>row.date.slice(0,4));
  const out={year:Object.keys(years).sort().reverse().map(value=>({value,count:years[value]}))};
  FACETS.forEach(field=>{
    const counted=list(tally(filterTickets(rows,{...q,[field]:[]}),field));
    // 已选但当前条件下为 0 的项也保留，方便取消
    (q[field]||[]).forEach(value=>{if(!counted.some(x=>x.value===value)) counted.push({value,count:0});});
    out[field]=counted;
  });
  return out;
}
// 按年 → 月分组（已按日期从新到旧排好）
function groupByMonth(rows) {
  const groups=[];
  for (const row of rows) {
    const id=row.date.slice(0,7) || "undated", last=groups[groups.length-1];
    if (last && last.id===id) last.rows.push(row);
    else groups.push({id,year:row.date.slice(0,4),month:Number(row.date.slice(5,7))||0,rows:[row]});
  }
  return groups;
}
const swatch=row=>{const p=palettes[row.look?.palette]||palettes.ink;return {dark:p[1],mid:p[2],bright:p[4],stock:p[5],accent:p[7]};};
// 360° 展示时票根侧面（纸边）的颜色：纸色略压暗，像卡纸的切边
const edgeOf=row=>{const s=swatch(row);return HEX.test(s.stock)&&HEX.test(s.dark)?mixHex(s.dark,s.stock,.22):"#d8cdb8";};

function text(surface,StringValue,x,y,opts={}) {
  const {font=SANS,align="left",ink="#26241f",weight=500,max=364}=opts;
  const value=StringValue.replace(/\s+/gu," ").trim();
  let size=opts.size || 14;
  surface.font=`${weight} ${size}px ${font}`;
  const width=surface.measureText(value).width;
  if (width>max) size=Math.max(Math.min(23,size),size*max/width);
  surface.font=`${weight} ${size}px ${font}`;
  surface.textAlign=align;
  const spaced=opts.spacing && "letterSpacing" in surface;   // 英文字距；不支持的画布（部分小程序）照常绘制
  if (spaced) surface.letterSpacing=opts.spacing+"px";
  if (opts.relief) {
    surface.fillStyle=opts.relief;
    surface.fillText(value,x+1.7,y+2.4,max);
    surface.fillStyle=opts.light || "#f1c9a4";
    surface.fillText(value,x-.55,y-.65,max);
  }
  surface.fillStyle=ink;
  surface.fillText(value,x,y,max);
  if (spaced) surface.letterSpacing="0px";
}

// 片名：实体票根的激凸压印。投影 + 下缘暗边 + 上缘高光做出凸起；字面随工艺变化——
// 镭射类（spectrum）是虹彩镭射烫印，金属类是烫金/烫银，哑光与亮釉是同色压凸。
const mixHex=(a,b,t)=>{const p=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));const A=p(a),B=p(b);
  return "#"+A.map((v,i)=>Math.round(v*t+B[i]*(1-t)).toString(16).padStart(2,"0")).join("");};
// 平滑渐变：关键色之间按 smoothstep 补中间色，交界处不会出现一条硬分界线（镭射烫印那种缓慢过渡）
const HEX=/^#[0-9a-f]{6}$/i;
function smoothGradient(grad,keys,steps=8) {
  keys.forEach(([at,color],i)=>{
    if (i) {
      const [from,prev]=keys[i-1];
      if (HEX.test(color)&&HEX.test(prev)) for (let k=1;k<steps;k++) {
        const t=k/steps,e=t*t*(3-2*t);grad.addColorStop(from+(at-from)*t,mixHex(color,prev,e));
      }
    }
    grad.addColorStop(at,color);
  });
  return grad;
}
// 一道柔和的宽光带：高斯形状的透明度，没有边缘
function glowBand(grad,peak,center=.5,spread=.16,rgb="255,255,255") {
  for (let k=0;k<=24;k++) {const t=k/24,a=peak*Math.exp(-(((t-center)/spread)**2));grad.addColorStop(t,`rgba(${rgb},${a.toFixed(3)})`);}
  return grad;
}
function embossTitle(surface,title,x,y,{accent,dark,finish,scale=1,createCanvas}) {
  const value=title.replace(/\s+/gu," ").trim(),max=359,metal=finishes[finish]||finishes.matte;
  let size=55;
  surface.save();
  surface.font=`${TITLE_WEIGHT} ${size}px ${TITLE}`;
  const measured=surface.measureText(value).width;
  if (measured>max) size=Math.max(23,size*max/measured);
  surface.font=`${TITLE_WEIGHT} ${size}px ${TITLE}`;surface.textAlign="center";
  const width=Math.min(max,surface.measureText(value).width),left=x-width/2,top=y-size*.86,bottom=y+size*.12;
  const fill=(color,dx,dy)=>{surface.fillStyle=color;surface.fillText(value,x+dx,y+dy,max);};
  if (surface.__foilMask) {surface.__solid("#fff");surface.fillText(value,x,y,max);surface.restore();return;}
  // 1 柔和投影（shadowBlur 以设备像素计，按缩放换算）
  surface.shadowColor="rgba(46,32,20,.34)";surface.shadowBlur=5*scale;surface.shadowOffsetX=1.2*scale;surface.shadowOffsetY=2.6*scale;
  fill(dark,0,0);
  surface.shadowColor="transparent";surface.shadowBlur=0;surface.shadowOffsetX=0;surface.shadowOffsetY=0;
  // 2 凸起侧壁：下缘暗、上缘亮
  surface.globalAlpha=.85;fill(dark,.6,1.5);
  surface.globalAlpha=.95;fill("rgba(255,251,240,.95)",-.7,-1);
  surface.globalAlpha=1;
  // 烫印压边：一圈细暗线，浅色镭射字在浅纸上也看得清
  surface.lineJoin="round";surface.strokeStyle=dark;surface.globalAlpha=metal.kind==="soft"?.3:.45;surface.lineWidth=1;
  surface.strokeText(value,x,y,max);surface.globalAlpha=1;
  // 3 字面：所有渐变都用平滑过渡，斜向铺开（像烫印箔随角度慢慢变色），不再在字中间一刀切开
  let face;
  const diag=()=>surface.createLinearGradient(left,top,left+width*.28,bottom+size*.35);
  if (metal.kind==="spectrum") {
    // 高级镭射：珍珠银底 + 很淡的一轮幻彩（颜色先向银色靠拢，避免大面积彩虹的廉价感）
    face=smoothGradient(diag(),[[0,"#f6f7f8"],[.5,"#d3d7dc"],[1,"#b4bac2"]]);
  } else if (metal.kind==="metal") {
    const st=metal.stops,light=st[st.length-2];
    face=smoothGradient(diag(),[[0,mixHex(light,st[1],.5)],[.34,light],[.68,st[1]],[1,mixHex(st[0],st[1],.55)]]);
  } else {
    face=smoothGradient(surface.createLinearGradient(x,top,x,bottom),[[0,accent],[1,dark]]);
  }
  fill(face,0,0);
  if (metal.kind==="spectrum") {
    const st=metal.stops,hue=surface.createLinearGradient(left,bottom,left+width,top);
    smoothGradient(hue,st.map((c,i)=>[i/(st.length-1),mixHex(c,"#dfe3e8",.6)]));
    surface.globalAlpha=.72;fill(hue,0,0);surface.globalAlpha=1;
  }
  // 4 光泽：镭射 / 金属加一道很宽、边缘完全柔化的斜向反光；压凸只加上半部的柔光
  if (metal.kind!=="soft") {
    const sheen=surface.createLinearGradient(left,top,left+width*.7,bottom+size*.4);
    glowBand(sheen,metal.kind==="spectrum"?.34:.38,.5,.17);
    fill(sheen,0,0);
  } else {
    const soft=surface.createLinearGradient(x,top,x,bottom);
    soft.addColorStop(0,"rgba(255,250,236,.32)");soft.addColorStop(.5,"rgba(255,250,236,0)");
    fill(soft,0,0);
  }
  if (metal.kind==="spectrum" && createCanvas) {
    // 镭射衍射纹：6px 斜线贴片平铺在字面上；画布不支持图案时省略这一层
    try {
      const tile=createCanvas(4,4),c=tile.getContext("2d");
      c.strokeStyle="rgba(255,255,255,.7)";c.lineWidth=.6;c.beginPath();c.moveTo(-1,5);c.lineTo(5,-1);c.stroke();
      const pattern=surface.createPattern(tile,"repeat");
      if (pattern) {surface.globalAlpha=.16;fill(pattern,0,0);surface.globalAlpha=1;}
    } catch (_) { /* 退回无衍射纹 */ }
  }
  surface.restore();
}

function rule(surface,y,ink,x=28,x2=W-28,dashed=false) {
  surface.save();
  if (dashed) surface.setLineDash([2.5,4]);
  surface.strokeStyle=ink;surface.lineWidth=.85;
  surface.beginPath();surface.moveTo(x,y);surface.lineTo(x2,y);surface.stroke();
  surface.restore();
}

function cropCover(surface,image,position,frame=SOURCE) {
  const {x,y,w,h}=frame;
  const iw=image.naturalWidth || image.width, ih=image.naturalHeight || image.height;
  if (!iw || !ih) return;
  const sw=Math.min(iw,ih*w/h), sh=Math.min(ih,iw*h/w);
  surface.drawImage(image,(iw-sw)*position/100,(ih-sh)*position/100,sw,sh,x,y,w,h);
}

// 纸面贴片：TEXTURE_SIZE 见方、四边无缝衔接，画好后平铺。只用暖白高光与暖灰阴影（不用近黑色），浓淡由各层透明度决定。
const textureCaches=new WeakMap();
const TEXTURE_SIZE=160;
const HI=a=>`rgba(255,252,244,${a})`, SH=a=>`rgba(96,76,56,${a})`;
function paintTexture(ctx,material) {
  const S=TEXTURE_SIZE;
  let seed=74323;
  const rng=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
  // 靠近边缘的元素在对边再画一份，平铺时看不出接缝
  const wrap=(x,y,r,draw)=>{for (const dx of [-S,0,S]) for (const dy of [-S,0,S]) {const X=x+dx,Y=y+dy;if (X+r<0||X-r>S||Y+r<0||Y-r>S) continue;draw(X,Y);}};
  const line=(x1,y1,x2,y2,color,width)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();};
  const layers={
    mottle(o){ // 冷压水彩纸 / 羊皮纸那种柔和的明暗起伏
      for (let i=0;i<o.count;i++) {
        const x=rng()*S,y=rng()*S,r=o.min+rng()*(o.max-o.min),light=rng()<o.light,a=(light?o.hi:o.sh)*(.55+rng()*.45);
        wrap(x,y,r,(X,Y)=>{const g=ctx.createRadialGradient(X,Y,0,X,Y,r);g.addColorStop(0,light?HI(a):SH(a));g.addColorStop(1,light?HI(0):SH(0));ctx.fillStyle=g;ctx.fillRect(X-r,Y-r,r*2,r*2);});
      }
    },
    tooth(o){ // 极细的纸面颗粒，只用高光
      const size=o.size||.9;ctx.fillStyle=HI(o.hi);
      for (let i=0;i<o.count;i++) ctx.fillRect(rng()*S,rng()*S,size,size);
    },
    fibers(o){ // 长纤维：浅色、微弯
      ctx.lineCap="round";
      for (let i=0;i<o.count;i++) {
        const x=rng()*S,y=rng()*S,a=rng()*Math.PI,len=o.len*(.5+rng()*.5),bend=(rng()-.5)*o.curl*len;
        const ex=x+Math.cos(a)*len,ey=y+Math.sin(a)*len,cx=(x+ex)/2-Math.sin(a)*bend,cy=(y+ey)/2+Math.cos(a)*bend;
        const shade=o.sh&&rng()<.25;
        wrap(x,y,len+Math.abs(bend),(X,Y)=>{const dx=X-x,dy=Y-y;ctx.strokeStyle=shade?SH(o.sh):HI(o.hi*(.6+rng()*.4));ctx.lineWidth=o.width;ctx.beginPath();ctx.moveTo(X,Y);ctx.quadraticCurveTo(cx+dx,cy+dy,ex+dx,ey+dy);ctx.stroke();});
      }
    },
    lines(o){ // 平行细纹：一条高光、旁边一条很淡的阴影。dir：h 横 / v 竖 / d1、d2 两个方向的 45° 斜线（间距须能整除贴片边长）
      const st=o.step;
      for (let c=0;c<S*2;c+=st) {
        if (o.dir==="h") {if (c>=S) break;line(0,c+.5,S,c+.5,HI(o.hi),.7);if (o.sh) line(0,c+1.4,S,c+1.4,SH(o.sh),.6);}
        else if (o.dir==="v") {if (c>=S) break;line(c+.5,0,c+.5,S,HI(o.hi),.7);if (o.sh) line(c+1.4,0,c+1.4,S,SH(o.sh),.6);}
        else {const flip=o.dir==="d2";const a=(x,y)=>flip?[S-x,y]:[x,y];
          const p1=a(c,0),p2=a(c-S,S);line(p1[0],p1[1],p2[0],p2[1],HI(o.hi),.7);
          if (o.sh) {const q1=a(c+1.2,0),q2=a(c+1.2-S,S);line(q1[0],q1[1],q2[0],q2[1],SH(o.sh),.6);}}
      }
    },
    weave(o){ // 亚麻布纹：经纬线交替起伏
      for (let y=0;y<S;y+=o.step) for (let x=0;x<S;x+=o.step) {
        const over=((x+y)/o.step)%2===0;
        if (over) {line(x,y+.6,x+o.step,y+.6,HI(o.hi),.8);line(x,y+o.step-.4,x+o.step,y+o.step-.4,SH(o.sh),.6);}
        else {line(x+.6,y,x+.6,y+o.step,HI(o.hi*.8),.8);line(x+o.step-.4,y,x+o.step-.4,y+o.step,SH(o.sh),.6);}
      }
    },
    ribs(o){ // 罗纹压线：竖向凸起，左亮右暗
      for (let x=0;x<S;x+=o.step) {line(x+.5,0,x+.5,S,HI(o.hi),1);line(x+2,0,x+2,S,SH(o.sh),.8);}
    },
    laid(o){ // 帘纹：细密横纹 + 稀疏竖向链线
      for (let y=0;y<S;y+=o.step) line(0,y+.5,S,y+.5,HI(o.hi),.6);
      for (let x=o.chain/2;x<S;x+=o.chain) {line(x,0,x,S,SH(o.sh),.7);line(x+1,0,x+1,S,HI(o.hi*.8),.6);}
    },
    cells(o){ // 荔枝纹压花：每个小凸起左上高光、右下阴影
      for (let y=o.step/2;y<S;y+=o.step) for (let x=o.step/2;x<S;x+=o.step) {
        const cx=x+(rng()-.5)*o.step*.5,cy=y+(rng()-.5)*o.step*.5,r=o.size*(.75+rng()*.5);
        wrap(cx,cy,r+1,(X,Y)=>{
          ctx.lineWidth=.9;
          ctx.strokeStyle=HI(o.hi);ctx.beginPath();ctx.arc(X,Y,r,Math.PI*.9,Math.PI*1.8);ctx.stroke();
          ctx.strokeStyle=SH(o.sh);ctx.beginPath();ctx.arc(X,Y,r,Math.PI*-.1,Math.PI*.8);ctx.stroke();
        });
      }
    },
    felt(o){ // 毛毡纹：不规则的小圆凸起
      for (let i=0;i<o.count;i++) {
        const x=rng()*S,y=rng()*S,r=1.5+rng()*3.5;
        wrap(x,y,r+1,(X,Y)=>{const g=ctx.createRadialGradient(X-r*.35,Y-r*.35,0,X,Y,r);g.addColorStop(0,HI(o.hi));g.addColorStop(.7,HI(0));g.addColorStop(1,SH(o.sh));ctx.fillStyle=g;ctx.beginPath();ctx.arc(X,Y,r,0,Math.PI*2);ctx.fill();});
      }
    },
    flakes(o){ // 洒金 / 云母：稀疏的小片金属箔
      for (let i=0;i<o.count;i++) {
        const x=rng()*S,y=rng()*S,size=o.size*(.5+rng()),rot=rng()*Math.PI,color=o.colors[i%o.colors.length];
        wrap(x,y,size*2,(X,Y)=>{
          ctx.save();ctx.translate(X,Y);ctx.rotate(rot);ctx.globalAlpha*=o.alpha*(.5+rng()*.5);ctx.fillStyle=color;
          ctx.beginPath();ctx.moveTo(-size,-size*.4);ctx.lineTo(size*.6,-size*.8);ctx.lineTo(size,size*.3);ctx.lineTo(-size*.3,size*.7);ctx.closePath();ctx.fill();
          ctx.restore();
        });
      }
    },
    moire(o){ // 水印波纹：很淡的同心波浪线
      for (let k=-S;k<S*2;k+=o.gap) {
        ctx.beginPath();
        for (let x=0;x<=S;x+=4) {const y=k+Math.sin(x/S*Math.PI*2)*6+Math.sin(x/S*Math.PI*4+k/S*Math.PI*2)*2.5;if (x) ctx.lineTo(x,y);else ctx.moveTo(x,y);}
        ctx.strokeStyle=HI(o.hi);ctx.lineWidth=.8;ctx.stroke();
        ctx.save();ctx.translate(0,1.2);ctx.strokeStyle=SH(o.sh);ctx.lineWidth=.6;ctx.stroke();ctx.restore();
      }
    },
    sheen(o){ // 缎面光泽：沿对角线起伏的柔光（周期与贴片对齐，平铺无缝）
      const bands=o.bands||1,g=ctx.createLinearGradient(0,0,S,S);
      for (let i=0;i<=8*bands;i++) {const t=i/(8*bands),v=(Math.cos(t*Math.PI*4*bands)+1)/2;g.addColorStop(Math.min(1,t),HI(o.hi*v));}
      ctx.fillStyle=g;ctx.fillRect(0,0,S,S);
    }
  };
  for (const [kind,options] of material.layers) {ctx.save();layers[kind](options);ctx.restore();}
}

function textureTile(createCanvas,key) {
  if (!textureCaches.has(createCanvas)) textureCaches.set(createCanvas,new Map());
  const cache=textureCaches.get(createCanvas);
  if (!cache.has(key)) {
    const tile=createCanvas(TEXTURE_SIZE,TEXTURE_SIZE);
    paintTexture(tile.getContext("2d"),papers[key]);
    cache.set(key,tile);
  }
  return cache.get(key);
}

function paintPaper(surface,key,createCanvas) {
  let tile;
  if (createCanvas) {
    try { tile=textureTile(createCanvas,key); } catch (_) { /* Render the same texture directly if offscreen canvas is unavailable. */ }
  }
  if (tile && surface.createPattern) {
    try {
      const pattern=surface.createPattern(tile,"repeat");
      if (pattern) {surface.fillStyle=pattern;surface.fillRect(0,0,W,H);return;}
    } catch (_) { /* Some mini-program canvases can draw the tile but cannot create a pattern from it. */ }
  }
  for (let y=0;y<H;y+=TEXTURE_SIZE) for (let x=0;x<W;x+=TEXTURE_SIZE) {
    if (tile) {
      try { surface.drawImage(tile,x,y,TEXTURE_SIZE,TEXTURE_SIZE);continue; }
      catch (_) { tile=null; }
    }
    surface.save();
    surface.translate(x,y);surface.beginPath();surface.rect(0,0,TEXTURE_SIZE,TEXTURE_SIZE);surface.clip();
    paintTexture(surface,papers[key]);
    surface.restore();
  }
}

function paper(surface,key,side,createCanvas) {
  const material=papers[key];
  surface.save();
  if (material.tint && side==="front") {
    surface.globalAlpha=material.warmth;surface.fillStyle=material.tint;surface.fillRect(0,0,W,H);
  }
  surface.globalAlpha=material.strength ?? 1;
  paintPaper(surface,key,createCanvas);
  surface.restore();
}

// Draw the light into the preview so it follows the card even on native canvases.
function previewSheen(surface,metal,side,light) {
  const bright=metal.stops[metal.stops.length-2];
  const spectrum=metal.kind==="spectrum";
  const soft=metal.kind==="soft";
  const x=light.x*W,y=light.y*H;
  const fill=surface.createRadialGradient(x,y,0,x,y,spectrum?250:200);
  fill.addColorStop(0,bright+(soft?"18":spectrum?"54":"9e"));
  fill.addColorStop(1,bright+"00");
  surface.fillStyle=fill;
  surface.fillRect(0,0,W,H);
  if (soft) return;
  const start=side==="front"?SOURCE.x:63;
  const end=side==="front"?SOURCE.x+SOURCE.w:W-63;
  const band=surface.createLinearGradient(start,y-115,end,y+115);
  band.addColorStop(0,metal.stops[0]+"88");
  band.addColorStop(Math.max(.08,Math.min(.92,light.x)),bright+"ff");
  band.addColorStop(1,metal.stops[metal.stops.length-1]+"99");
  surface.strokeStyle=band;surface.lineWidth=spectrum?3.3:2.3;
  if (side==="front") {
    const {x,y,w,h}=SOURCE;
    surface.strokeRect(x-1,y-1,w+2,h+2);
  } else {
    surface.beginPath();surface.arc(W/2,283,149,0,Math.PI*2);surface.stroke();
  }
}

function draw(surface,record,side,image,rect,createCanvas,light) {
  const {palette,finish,texture,motif}=record.look;
  const craft=parseCraft(record.look.craft);
  const [,dark,mid,edge,bright,stock,stub,accent]=palettes[palette];
  const metal=finishes[finish];
  surface.save();surface.translate(rect.x,rect.y);surface.scale(rect.w/W,rect.h/H);
  frame(surface);
  if (side==="back") {
    const background=surface.createLinearGradient(0,60,W,790);
    background.addColorStop(0,dark);background.addColorStop(.45,mid);background.addColorStop(1,edge);
    surface.fillStyle=background;surface.fillRect(0,0,W,H);
    paper(surface,texture,"back",createCanvas);
    surface.strokeStyle=foilGradient(surface,20,620,390,226,finish);surface.lineWidth=.85;
    surface.strokeRect(15,22,W-30,H-44);surface.strokeRect(20,28,W-40,H-56);
    text(surface,"麻雀观影护照",35,57,{size:13,weight:700,ink:bright});
    const tagline=headTag(record);
    text(surface,tagline||"收藏票根",W-35,57,{size:12,align:"right",ink:tagline?foilGradient(surface,W-130,47,W-35,60,record.slam?"gold":finish):bright,weight:tagline?700:400});
    rule(surface,78,bright+"77",35,W-35);
    if (record.limited) drawGoldLeaf(surface,record);
    drawMedallion(surface,{motif,finish,seed:hashAppearance(record.id)},dark);
    const year=record.programme.match(/^\d{4}/)?.[0] || record.date.slice(0,4);
    const centre={align:"center",ink:bright};
    drawEmblem(surface,record,record.slam?"gold":finish,year);
    if (record.hidden) drawConstellation(surface,record,finish);
    if (record.slam) drawSlam(surface,record);
    // 典藏编号：纪念章与专题名之间，烫印（在工艺遮罩里，转动时跟着反光）
    const serial=formatSerial(record);
    if (serial) text(surface,"No. "+serial,W/2,459,{...centre,size:11,weight:600,font:MONO,spacing:1.2,max:300,ink:foilGradient(surface,120,449,300,463,finish)});
    const heading=(year && record.programme.startsWith(year) ? record.programme.slice(4).trim() : record.programme) || "我的观影收藏";
    text(surface,heading,W/2,511,{...centre,size:38,weight:900,font:SERIF,max:347,relief:edge,light:bright+"a0"});
    if (record.section) text(surface,record.section,W/2,552,{...centre,size:17,max:326});
    rule(surface,601,bright+"75",59,W-59);
    text(surface,record.title,W/2,652,{...centre,size:21,weight:650,max:331});
    rule(surface,TEAR,bright+"6b",24,W-24,true);
    // 撕线下方（2026-11-22 改版）：左边发行序号（封版后带总数）与本场序号，右边验真二维码，底部日期城市、盲文、SPARROW CINEMA。
    // 内框线在 y=836 / 842，最后一行要在 828 以上，不能压到框线
    const ed=editionLines(record),qr=record.issue ? qrFor(record.serial) : null,lx=36,maxw=qr?262:W-72;
    if (record.issue) {
      text(surface,ed.no,lx,738,{size:24,weight:600,font:MONO,max:maxw,ink:foilGradient(surface,lx,718,lx+150,742,finish)});
      if (ed.total) {surface.font=`600 24px ${MONO}`;const nw=Math.min(maxw,surface.measureText(ed.no).width);
        text(surface,ed.total,lx+nw+6,738,{size:13,weight:600,font:MONO,ink:foilGradient(surface,lx+nw,728,lx+nw+70,740,finish)});}
    } else text(surface,ed.no,lx,738,{size:24,weight:600,font:MONO,ink:bright+"66"});
    text(surface,ed.line1,lx,757,{size:10.5,max:maxw,ink:record.issue?bright:bright+"88"});
    if (ed.line2) text(surface,ed.line2,lx,772,{size:10.5,max:maxw,ink:foilGradient(surface,lx,763,lx+160,775,finish)});
    if (qr) {drawQR(surface,qr,W-34-58,708,58,dark,stock);text(surface,"扫码验真",W-34-29,777,{size:8,align:"center",ink:bright+"cc"});}
    text(surface,[record.date.replace(/-/g,"."),record.city].filter(Boolean).join(" · "),W/2,795,{...centre,size:12,font:MONO,ink:craft.vde?foilGradient(surface,110,783,310,798,finish):bright});
    if (craft.braille) drawBraille(surface,"SPARROW",W/2,808);
    text(surface,"SPARROW CINEMA",W/2,craft.braille?825:820,{...centre,size:10,font:MONO});
  } else {
    surface.fillStyle=stock;surface.fillRect(0,0,W,H);
    surface.fillStyle=stub;surface.fillRect(0,TEAR,W,H-TEAR);
    paper(surface,texture,"front",createCanvas);
    text(surface,"麻雀观影护照",28,52,{size:13,weight:700,ink:accent});
    const tagline=headTag(record);
    text(surface,tagline||"纪念票根",W-28,52,{size:12,weight:700,align:"right",ink:accent});
    rule(surface,73,accent+"62");
    const {x,y,w,h}=SOURCE;
    surface.fillStyle=dark;surface.fillRect(x,y,w,h);
    if (surface.__foilMask ? surface.__foilArt : image) {
      if (image && !Sketch?.paint(surface,image,record.crop,SOURCE,createCanvas,cropCover,rect.w/W,record.artStyle)) {
        cropCover(surface,image,record.crop);
      }
    } else {
      surface.strokeStyle=foilGradient(surface,x,y,x+w,y+h,finish);surface.lineWidth=1;
      for (let i=0;i<6;i++) surface.strokeRect(x+24+i*9,y+24+i*9,w-48-i*18,h-48-i*18);
      text(surface,record.title,W/2,y+h/2,{align:"center",font:TITLE,size:30,weight:TITLE_WEIGHT,ink:bright,max:w-130});
    }
    surface.strokeStyle=foilGradient(surface,x,y+h,x+w,y,finish);
    surface.lineWidth=metal.width;surface.strokeRect(x-.8,y-.8,w+1.6,h+1.6);
    surface.lineWidth=.48;surface.strokeRect(x-3,y-3,w+6,h+6);
    if (record.limited) drawLimitedSeal(surface,record,x+w-46,y+h-46,dark);
    if (record.hidden) drawHiddenTag(surface,x+12,y+12,dark);
    embossTitle(surface,record.title,W/2,506,{accent,dark,finish,scale:rect.w/W,createCanvas});
    if (record.subtitle && record.subtitle.toLowerCase()!==record.title.toLowerCase()) {
      text(surface,record.subtitle.toUpperCase(),W/2,540,{size:12.5,weight:600,font:LATIN,spacing:2.2,align:"center",ink:"#5b5046",max:340});
    }
    rule(surface,561,accent+"58");
    text(surface,"放映日期",28,587,{size:12});
    text(surface,record.date.replace(/-/g,".") || "日期待定",28,624,{size:25,font:MONO,max:223,...(craft.vde?{ink:foilGradient(surface,28,600,250,628,finish)}:{})});
    text(surface,"开场",W-28,587,{size:12,align:"right"});
    text(surface,record.time || "—",W-28,624,{size:26,font:MONO,align:"right",max:120,ink:accent});
    text(surface,[record.city,record.venue].filter(Boolean).join(" / ") || "影院未填",28,667,{size:16,weight:650});
    rule(surface,TEAR,accent+"83",17,W-17,true);
    const fields=[["影厅",record.hall],["座位",record.seat],["放映版本",record.format]].filter(row=>row[1]);
    const width=(W-56)/Math.max(1,fields.length);
    fields.forEach(([heading,value],i)=>{
      const left=28+i*width;
      text(surface,heading,left,739,{size:11,max:width-10});
      text(surface,value,left,768,{size:20,weight:700,max:width-10});
    });
    if (fields.length) rule(surface,792,accent+"58");
    // 底部专题 / 影展标签：烫印细框胶囊，单元名跟在后面
    const tag=[record.programme,record.section].filter(Boolean).join(" · ");
    if (tag) {
      surface.font=`700 11px ${SANS}`;
      const tw=Math.min(300,surface.measureText(tag).width),pw=tw+30,ph=21,px=W/2-pw/2,py=802;
      surface.save();
      surface.beginPath();
      if (surface.roundRect) surface.roundRect(px,py,pw,ph,ph/2); else surface.rect(px,py,pw,ph);
      surface.fillStyle=accent+"14";surface.fill();
      surface.strokeStyle=foilGradient(surface,px,py,px+pw,py+ph,finish);surface.lineWidth=1;surface.stroke();
      surface.restore();
      text(surface,tag,W/2,py+14.6,{size:11,weight:700,align:"center",ink:accent,max:300});
      text(surface,"SPARROW CINEMA",W/2,840,{size:8.5,font:MONO,align:"center",ink:accent+"b0"});
    } else {
      text(surface,"SPARROW CINEMA",W/2,821,{size:10,font:MONO,align:"center",ink:accent});
    }
  }
  if (light) previewSheen(surface,metal,side,light);
  surface.restore();
  if (!surface.__foilMask && createCanvas && rect.w>=CRAFT_MIN && foilLayers(record.look).length) foilTexture(surface,record,side,rect,createCanvas,!!image);
}

// 工艺遮罩：把票根再画一遍，只留下用烫印渐变画的部分（烫印框线、纹章、专题胶囊）和压凸片名，涂成白色，其余全透明。
// 用 Proxy 包住画布：烫印渐变换成白色，其他颜色换成透明，不画图片和阴影，所以版式永远和票面一致，不用另写一份。
// 网页 / 小程序转动时在这个范围里叠随角度变化的工艺反光；闪粉、水晶、全息纹理的静态纹理也画在这里面。
function foilMask(ctx,record,side,rect,createCanvas,hasArt) {
  const craft=parseCraft(record.look?.craft);
  if (typeof Proxy!=="function" || !FOIL || (fxOf(record.look?.finish)==="none" && !foilLayers(record.look).length && !craft.braille && !craft.vde)) return false;
  const styles={fillStyle:"#000",strokeStyle:"#000"},stack=[],bound={};
  const clear="rgba(0,0,0,0)",map=v=>v && typeof v==="object" && FOIL.has(v) ? "#fff" : clear;
  const proxy=new Proxy(ctx,{
    get(target,key) {
      if (key==="__foilMask") return true;
      if (key==="__foilArt") return hasArt;
      if (key==="__solid") return color=>{target.fillStyle=color;styles.fillStyle=color;};
      if (key==="fillStyle" || key==="strokeStyle") return styles[key];
      if (key==="drawImage" || key==="putImageData") return ()=>{};
      if (key==="save") return ()=>{stack.push({...styles});target.save();};
      if (key==="restore") return ()=>{Object.assign(styles,stack.pop()||{});target.restore();};
      const value=target[key];
      return typeof value==="function" ? (bound[key]||(bound[key]=value.bind(target))) : value;
    },
    set(target,key,value) {
      if (key==="fillStyle" || key==="strokeStyle") {styles[key]=value;target[key]=map(value);return true;}
      if (key==="shadowColor") {target.shadowColor=clear;return true;}
      target[key]=value;return true;
    }
  });
  try {draw(proxy,record,side,null,rect,createCanvas);return true;} catch (error) {return false;}
}

// 静态工艺纹理（导出图里也有）：底箔自带的（闪粉 / 水晶 / 全息纹理）+ 工艺组合里的烫印增效，逐层画在工艺遮罩范围里。
// 缩略图（宽 < CRAFT_MIN，收藏册的格子都小于它）看不出纹理，不画，省得收藏册几百张票根多画一遍。
const TEXTURED={glitter:1,crystal:1,cast:1},CRAFT_MIN=320;
function foilLayers(look) {
  const own=fxOf(look?.finish),list=TEXTURED[own]?[own]:[];
  for (const key of parseCraft(look?.craft).foil) if (!list.includes(key)) list.push(key);
  return list;
}
function foilTexture(surface,record,side,rect,createCanvas,hasArt) {
  const w=Math.max(1,Math.round(Math.min(rect.w,900))),h=Math.max(1,Math.round(w*H/W));
  let mask;
  try {mask=createCanvas(w,h);} catch (error) {return;}
  if (!foilMask(mask.getContext("2d"),record,side,{x:0,y:0,w,h},createCanvas,hasArt)) return;
  const k=w/W;
  for (const fx of foilLayers(record.look)) {
    let layer;
    try {layer=createCanvas(w,h);} catch (error) {return;}
    const ctx=layer.getContext("2d"),rand=seeded(hashAppearance((record.id||record.key||"")+side+fx));
    ctx.save();ctx.scale(k,k);
    if (fx==="sense") {
      // 立体光油：遮罩往左上错开一点留下亮边、往右下留暗边，中间再罩一层薄光
      ctx.restore();ctx.save();
      ctx.globalAlpha=.75;ctx.drawImage(mask,-1,-1);ctx.globalCompositeOperation="destination-out";ctx.drawImage(mask,0,0);
      ctx.globalCompositeOperation="source-over";ctx.globalAlpha=.28;ctx.drawImage(mask,0,0);
    } else craftTexture(ctx,fx,rand);
    ctx.restore();
    if (fx!=="sense") {ctx.globalCompositeOperation="destination-in";ctx.drawImage(mask,0,0);}
    surface.save();surface.globalAlpha=fx==="cast"?.6:fx==="sense"?.9:.85;surface.drawImage(layer,rect.x,rect.y,rect.w,rect.h);surface.restore();
  }
}
// 纹理本身（票根坐标，W × H）：全息纹理＝同心衍射环 + 斜纹；闪粉＝明暗相间的亮片 + 星芒；水晶＝彩色钻面
function craftTexture(ctx,fx,rand,box={x:0,y:0,w:W,h:H},cx=W*.5,cy=H*.36) {
  const {x:X,y:Y,w:BW,h:BH}=box;
  if (fx==="cast") {
    const hues=["#ffffff","#ff9fdc","#5a6890","#8ff0ff","#ffe27a","#5a6890","#b9a2ff"];
    ctx.globalAlpha=.55;
    for (let r=6,i=0;r<Math.hypot(BW,BH);r+=4.2,i++) {ctx.strokeStyle=hues[i%hues.length];ctx.lineWidth=1.1;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();}
    ctx.globalAlpha=.3;ctx.strokeStyle="#ffffff";ctx.lineWidth=.6;
    for (let x=X-BH;x<X+BW+BH;x+=3.4) {ctx.beginPath();ctx.moveTo(x,Y);ctx.lineTo(x+BH*.58,Y+BH);ctx.stroke();}
    return;
  }
  const crystal=fx==="crystal",count=Math.round((crystal?11000:16000)*BW*BH/(W*H));
  // 亮片要有明有暗才看得出来：一半是亮点，一半是比箔面深的颗粒
  const colors=crystal?["#ffffff","#ff86d4","#5fdcff","#ffd84d","#a98bff","#3d4766"]:["#ffffff","#fff1c2","#5a3d16","#7a5420","#ffffff"];
  for (let i=0;i<count;i++) {
    const x=X+rand()*BW,y=Y+rand()*BH,r=crystal?.5+rand()*1.2:.3+rand()*.7;
    ctx.globalAlpha=.45+rand()*.55;ctx.fillStyle=colors[Math.floor(rand()*colors.length)];
    ctx.beginPath();
    if (crystal) {const a=rand()*Math.PI;for (let j=0;j<4;j++) {const t=a+j*Math.PI/2,q=j%2?r*.55:r;ctx.lineTo(x+Math.cos(t)*q,y+Math.sin(t)*q);}ctx.closePath();}
    else ctx.arc(x,y,r,0,Math.PI*2);
    ctx.fill();
    if (!crystal && rand()<.035) {ctx.globalAlpha=.8;ctx.fillRect(x-2.6,y-.25,5.2,.5);ctx.fillRect(x-.25,y-2.6,.5,5.2);}
  }
}

// ——— 海报画面增效（工艺组合的第二段，2026-11-22 改为隐形）———
// 静止时海报完全不变，只有转动时才在对应区域若隐若现地泛起光泽（像印刷上的透明光油、隐形全息、防伪扭索纹）：
// 隐形高光UV＝海报最亮的两成；隐形轮廓光油＝明暗边缘；隐形全息水印＝片名斜向平铺的透明全息字；
// 隐形珠光＝中高调区域的柔和珠光；隐形扭索纹＝钞票式的玫瑰曲线防伪纹；亮哑对比纹＝细密的亮油网点（像亮哑对比的透明光油）；
// 隐形镭射彩虹＝整幅海报流过彩虹；隐形像素镭射＝细方格光栅；隐形同心波纹＝从一点荡开的细环（2026-11-22 新增，转动时最容易看出来）；
// 隐形莫尔纹＝两组细线的干涉条纹；隐形光栅变色＝竖向细光栅；隐形星芒＝最亮处的十字星芒；隐形猫眼光＝随角度滑动的细亮带。
// 编码字母沿用（u r o k b d），已保存的组合照常有效，只是效果换成隐形的。遮罩从海报取样（artMask），只给网页 / 小程序转动时的反光层用。
const ART_FX={uv:"a-gloss",rim:"a-rim",holo:"a-holo",sparkle:"a-pearl",band:"a-guilloche",dust:"a-matte",rainbow:"a-rainbow",pixel:"a-holo",ripple:"a-holo",moire:"a-holo",lenticular:"a-rainbow",glint:"a-gloss",cateye:"a-cateye",argyle:"a-guilloche",cloud:"a-holo",meander:"a-rim",perf:"a-guilloche",firework:"a-holo",honeycomb:"a-holo",caustic:"a-pearl",beam:"a-cateye",diag:"a-rainbow",contour:"a-pearl",postmark:"a-rim",frames:"a-guilloche"};
// 新增的 12 种隐形纹样（2026-11-22）：海报和背面共用，画在 (0,0,w,h) 里，白色＝反光范围
const PATTERNS=["argyle","cloud","meander","perf","firework","honeycomb","caustic","beam","diag","contour","postmark","frames"];
function paintPattern(m,kind,w,h,rand,u,gap=1) { // gap：间距倍数，背面用更疏的排布（背面还有文字，太密显得乱）
  const sparse=gap>1;
  m.fillStyle="#fff";m.strokeStyle="#fff";m.lineCap="round";m.lineJoin="round";
  const line=(x1,y1,x2,y2)=>{m.beginPath();m.moveTo(x1,y1);m.lineTo(x2,y2);m.stroke();};
  if (kind==="argyle") {
    // 菱格纹：两组斜线交出菱形格
    m.lineWidth=u*.35;const step=u*6*gap,span=w+h;
    for (let x=-span;x<span;x+=step) {line(x,0,x+h*.6,h);line(x,h,x+h*.6,0);}
  } else if (kind==="cloud") {
    // 祥云纹：几朵三瓣卷云
    m.lineWidth=u*.45;
    const n=Math.max(7,Math.round(h/w*7));
    for (let i=0;i<n;i++) {
      const cx=rand()*w,cy=rand()*h,r=Math.min(w,h)*(.05+rand()*.05);
      m.beginPath();m.arc(cx,cy,r,Math.PI*.9,Math.PI*2.1);m.arc(cx+r*1.5,cy-r*.5,r*.85,Math.PI*1.1,Math.PI*2.3);m.arc(cx+r*2.8,cy,r*.7,Math.PI*1.3,Math.PI*2.6);m.stroke();
      m.beginPath();m.arc(cx+r*.4,cy+r*.1,r*.45,0,Math.PI*1.6);m.stroke();
    }
  } else if (kind==="meander") {
    // 回纹：一行行连续的方折回纹
    m.lineWidth=u*.4;const s=u*3.2;
    for (let y=s*1.5;y<h;y+=s*5*gap) {m.beginPath();for (let x=-s;x<w+s*4;x+=s*4) {m.moveTo(x,y+s*2);m.lineTo(x,y);m.lineTo(x+s*3,y);m.lineTo(x+s*3,y+s*2);m.lineTo(x+s,y+s*2);m.lineTo(x+s,y+s);m.lineTo(x+s*2,y+s);}m.stroke();}
  } else if (kind==="perf") {
    // 胶片齿孔：上下（或左右）两排圆角齿孔
    const hw=u*1.6,hh=u*2.2,gap=u*3.4,vertical=h>w;
    for (const edge of [u*2.2,(vertical?w:h)-u*2.2-hh]) for (let p=u;p<(vertical?h:w);p+=gap) {
      m.beginPath();if (vertical) (m.roundRect?m.roundRect(edge,p,hh,hw,u*.4):m.rect(edge,p,hh,hw));else (m.roundRect?m.roundRect(p,edge,hw,hh,u*.4):m.rect(p,edge,hw,hh));m.fill();
    }
  } else if (kind==="firework") {
    // 烟花：几簇放射短线
    m.lineWidth=u*.3;
    for (let i=0,n=Math.max(sparse?3:5,Math.round(h/w*(sparse?3:5)));i<n;i++) {const cx=rand()*w,cy=rand()*h,r=Math.min(w,h)*(.09+rand()*.1),n=18+Math.floor(rand()*10);for (let j=0;j<n;j++) {const a=j/n*Math.PI*2;line(cx+Math.cos(a)*r*.35,cy+Math.sin(a)*r*.35,cx+Math.cos(a)*r,cy+Math.sin(a)*r);}}
  } else if (kind==="honeycomb") {
    m.lineWidth=u*.3;const r=u*3*gap,dx=r*Math.sqrt(3),dy=r*1.5;
    for (let row=0,y=0;y<h+r;y+=dy,row++) for (let x=(row%2)*dx/2;x<w+r;x+=dx) {m.beginPath();for (let k=0;k<6;k++) {const a=Math.PI/6+k*Math.PI/3;m.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);}m.closePath();m.stroke();}
  } else if (kind==="caustic") {
    // 水波光：几组交错的正弦波线，像池底的光纹
    m.lineWidth=u*.35;
    for (let k=0;k<(sparse?1:3);k++) {const a=rand()*Math.PI,f=(2+rand()*2)/w*Math.PI*2,amp=u*(1.5+rand()*2);
      for (let o=-h*1.5;o<h*2.5;o+=u*3.2*gap) {m.beginPath();for (let x=-h;x<=w+h;x+=u) {const y=o+Math.sin(x*f+k)*amp;m.lineTo(w/2+(x-w/2)*Math.cos(a)-(y-h/2)*Math.sin(a),h/2+(x-w/2)*Math.sin(a)+(y-h/2)*Math.cos(a));}m.stroke();}}
  } else if (kind==="beam") {
    // 放映光束：从上方一点散开的光锥 + 几道细光线
    const cx=w*(.3+rand()*.4),g=m.createLinearGradient(0,0,0,h);g.addColorStop(0,"#fff");g.addColorStop(1,"rgba(255,255,255,.25)");
    m.fillStyle=g;m.beginPath();m.moveTo(cx-u,0);m.lineTo(cx+u,0);m.lineTo(cx+w*.42,h);m.lineTo(cx-w*.42,h);m.closePath();m.fill();
    m.lineWidth=u*.25;for (let i=0;i<9;i++) {const t=(i/8-.5)*.8;line(cx,0,cx+t*w,h);}
  } else if (kind==="diag") {
    m.lineWidth=u*.35;const step=u*1.6*gap*(sparse?1.3:1);for (let x=-h;x<w+h;x+=step) line(x,0,x+h,h);
  } else if (kind==="contour") {
    // 等高线：围着两三处起伏的不规则闭合线
    m.lineWidth=u*.3;
    for (let c=0;c<(sparse?1:3);c++) {const cx=sparse?w*(.3+rand()*.4):rand()*w,cy=sparse?h*(.3+rand()*.4):rand()*h,ph=[rand()*6,rand()*6,rand()*6];
      for (let r=u*2;r<Math.max(w,h)*(sparse?.75:.5);r+=u*2.4*gap*(sparse?1.4:1)) {m.beginPath();for (let i=0;i<=96;i++) {const t=i/96*Math.PI*2,q=r*(1+.16*Math.sin(3*t+ph[0])+.1*Math.sin(5*t+ph[1])+.06*Math.sin(7*t+ph[2]));m.lineTo(cx+Math.cos(t)*q,cy+Math.sin(t)*q);}m.stroke();}}
  } else if (kind==="postmark") {
    // 邮戳：一圈双环 + 环内字 + 波浪注销线
    const cx=w*(.3+rand()*.4),cy=h*(.3+rand()*.4),r=Math.min(w,h)*.22;
    m.lineWidth=u*.45;m.beginPath();m.arc(cx,cy,r,0,Math.PI*2);m.stroke();m.lineWidth=u*.25;m.beginPath();m.arc(cx,cy,r*.78,0,Math.PI*2);m.stroke();
    m.font=`700 ${r*.28}px ${MONO}`;m.textAlign="center";m.textBaseline="middle";m.fillText("SPARROW",cx,cy-r*.16);m.fillText("CINEMA",cx,cy+r*.2);
    m.lineWidth=u*.4;for (let k=0;k<6;k++) {m.beginPath();for (let x=cx+r*1.1;x<w+u;x+=u*.8) m.lineTo(x,cy-r*.6+k*r*.24+Math.sin(x/u*.6)*u*.8);m.stroke();}
  } else if (kind==="frames") {
    // 胶片帧：一格格圆角画框，像印样
    m.lineWidth=u*.35;const fw=u*9*gap,fh=u*6.5*gap,gx=u*1.6*gap;
    for (let y=u;y<h;y+=fh+gx) for (let x=u;x<w;x+=fw+gx) {m.beginPath();(m.roundRect?m.roundRect(x,y,fw,fh,u*.9):m.rect(x,y,fw,fh));m.stroke();}
  }
}
function artMaskCanvas(record,image,kind,createCanvas,mw) {
  const mh=Math.max(1,Math.round(mw*SOURCE.h/SOURCE.w)),rand=seeded(hashAppearance("art|"+(record.id||record.key||"")+kind));
  let mask;
  try {mask=createCanvas(mw,mh);} catch (error) {return null;}
  const m=mask.getContext("2d");
  const geometric=["holo","band","dust","rainbow","pixel","ripple","moire","lenticular","cateye",...PATTERNS].includes(kind);
  let L=null;
  if (!geometric) {
    try {
      const probe=createCanvas(mw,mh),p=probe.getContext("2d");
      p.save();p.scale(mw/SOURCE.w,mh/SOURCE.h);p.translate(-SOURCE.x,-SOURCE.y);cropCover(p,image,record.crop);p.restore();
      const data=p.getImageData(0,0,mw,mh).data;L=new Float32Array(mw*mh);
      for (let i=0;i<L.length;i++) L[i]=(data[i*4]*.299+data[i*4+1]*.587+data[i*4+2]*.114)/255;
    } catch (error) {L=null;}
    if (!L) kind="holo";
  }
  const pct=(arr,q)=>{const a=Array.from(arr).sort((x,y)=>x-y);return a[Math.min(a.length-1,Math.floor(q*a.length))]||0;};
  const put=alpha=>{const img=m.createImageData(mw,mh);for (let i=0;i<alpha.length;i++) {img.data[i*4]=img.data[i*4+1]=img.data[i*4+2]=255;img.data[i*4+3]=alpha[i];}m.putImageData(img,0,0);};
  m.fillStyle="#fff";
  if (kind==="uv") {
    const q=pct(L,.8),a=new Uint8ClampedArray(L.length);
    for (let i=0;i<L.length;i++) a[i]=Math.pow(Math.max(0,Math.min(1,(L[i]-q)/(1-q+.001))),.8)*255;
    put(a);
  } else if (kind==="rim") {
    const G=new Float32Array(L.length);
    for (let y=1;y<mh-1;y++) for (let x=1;x<mw-1;x++) {
      const i=y*mw+x,gx=L[i+1-mw]+2*L[i+1]+L[i+1+mw]-L[i-1-mw]-2*L[i-1]-L[i-1+mw],gy=L[i+mw-1]+2*L[i+mw]+L[i+mw+1]-L[i-mw-1]-2*L[i-mw]-L[i-mw+1];
      G[i]=Math.hypot(gx,gy);
    }
    const t=pct(G,.88)||.1,a=new Uint8ClampedArray(L.length);
    for (let i=0;i<G.length;i++) a[i]=Math.max(0,Math.min(1,(G[i]-t)/t*2))*255;
    put(a);
  } else if (kind==="rainbow") {
    // 隐形镭射彩虹：整幅海报（边缘柔化），转动时彩虹整片流过
    const g=m.createRadialGradient(mw/2,mh/2,Math.min(mw,mh)*.2,mw/2,mh/2,Math.hypot(mw,mh)*.55);g.addColorStop(0,"#fff");g.addColorStop(1,"rgba(255,255,255,.35)");
    m.fillStyle=g;m.fillRect(0,0,mw,mh);
  } else if (kind==="pixel") {
    // 隐形像素镭射：防伪烫印那种细小方格光栅，随机缺格
    const cell=Math.max(3,mw/48);
    for (let y=0;y<mh;y+=cell) for (let x=0;x<mw;x+=cell) if (rand()<.62) {m.globalAlpha=.5+rand()*.5;m.fillRect(x+cell*.12,y+cell*.12,cell*.76,cell*.76);}
    m.globalAlpha=1;
  } else if (kind==="ripple") {
    // 隐形同心波纹：从一点荡开的细环
    const cx=mw*(.25+rand()*.5),cy=mh*(.25+rand()*.5),step=Math.max(3,mw/40);
    m.strokeStyle="#fff";m.lineWidth=step*.42;
    for (let r=step;r<Math.hypot(mw,mh);r+=step) {m.beginPath();m.arc(cx,cy,r,0,Math.PI*2);m.stroke();}
  } else if (PATTERNS.includes(kind)) {
    paintPattern(m,kind,mw,mh,rand,mw/90);
  } else if (kind==="moire") {
    // 隐形莫尔纹：两组角度差几度的细线叠在一起，转动时出现流动的干涉条纹
    const step=Math.max(2.4,mw/70),a0=rand()*Math.PI,span=Math.hypot(mw,mh);
    m.strokeStyle="#fff";m.lineWidth=step*.42;
    for (const a of [a0,a0+.07]) {m.save();m.translate(mw/2,mh/2);m.rotate(a);for (let x=-span/2;x<span/2;x+=step) {m.beginPath();m.moveTo(x,-span/2);m.lineTo(x,span/2);m.stroke();}m.restore();}
  } else if (kind==="lenticular") {
    // 隐形光栅变色：竖向细光栅，像光栅卡片换角度变色
    const step=Math.max(2.4,mw/64);
    for (let x=0,i=0;x<mw;x+=step,i++) {m.globalAlpha=i%2?.55:1;m.fillRect(x,0,step*.5,mh);}
    m.globalAlpha=1;
  } else if (kind==="cateye") {
    // 隐形猫眼光：整幅柔和铺满，反光是一道随角度滑动的细亮带（磁性猫眼油墨）
    const g=m.createRadialGradient(mw/2,mh/2,Math.min(mw,mh)*.25,mw/2,mh/2,Math.hypot(mw,mh)*.6);g.addColorStop(0,"#fff");g.addColorStop(1,"rgba(255,255,255,.4)");
    m.fillStyle=g;m.fillRect(0,0,mw,mh);
  } else if (kind==="glint") {
    // 隐形星芒：画面最亮的几处冒出十字星芒
    const spots=[];
    if (L) {
      const cell=Math.max(4,Math.round(mw/10));
      for (let y=0;y<mh;y+=cell) for (let x=0;x<mw;x+=cell) {let best=-1,bi=0;for (let yy=y;yy<Math.min(mh,y+cell);yy++) for (let xx=x;xx<Math.min(mw,x+cell);xx++) {const v=L[yy*mw+xx];if (v>best) {best=v;bi=yy*mw+xx;}}spots.push([bi%mw,Math.floor(bi/mw),best]);}
      spots.sort((a,b)=>b[2]-a[2]);spots.length=Math.min(spots.length,14);
    } else for (let i=0;i<12;i++) spots.push([rand()*mw,rand()*mh,1]);
    for (const [x,y] of spots) {
      const r=mw*(.035+rand()*.035);
      m.save();m.translate(x,y);m.rotate(rand()*.5);
      for (const [len,wid] of [[r,r*.09],[r*.55,r*.06]]) for (let j=0;j<2;j++) {m.rotate(Math.PI/2*j+(len<r?Math.PI/4:0));const g=m.createLinearGradient(-len,0,len,0);g.addColorStop(0,"rgba(255,255,255,0)");g.addColorStop(.5,"#fff");g.addColorStop(1,"rgba(255,255,255,0)");m.fillStyle=g;m.fillRect(-len,-wid,len*2,wid*2);}
      m.restore();
    }
  } else if (kind==="sparkle") {
    // 隐形珠光：中高调柔和地铺开（亮度 0.45 以上逐渐变满）
    const a=new Uint8ClampedArray(L.length);
    for (let i=0;i<L.length;i++) {const t=Math.max(0,Math.min(1,(L[i]-.42)/.45));a[i]=t*t*(3-2*t)*255;}
    put(a);
  } else if (kind==="dust") {
    // 亮哑对比纹：细密的 45° 网点，像透明亮油印在哑面上
    const step=Math.max(2.6,mw/90),r=step*.3;
    m.save();m.translate(mw/2,mh/2);m.rotate(Math.PI/4);
    const span=Math.hypot(mw,mh);
    for (let y=-span/2;y<span/2;y+=step) for (let x=-span/2;x<span/2;x+=step) {m.beginPath();m.arc(x,y,r,0,Math.PI*2);m.fill();}
    m.restore();
  } else if (kind==="band") {
    // 隐形扭索纹：钞票防伪那种玫瑰曲线，一组细线绕中心交织
    const cx=mw*(.35+rand()*.3),cy=mh*(.35+rand()*.3),R=Math.hypot(mw,mh)*.42,petals=5+Math.floor(rand()*5);
    m.strokeStyle="#fff";m.lineWidth=Math.max(.6,mw/320);
    for (let k=0;k<22;k++) {
      const base=R*(.18+k*.038),amp=R*.07,phase=k*.21;
      m.beginPath();
      for (let i=0;i<=360;i++) {const t=i/360*Math.PI*2,r=base+amp*Math.sin(petals*t+phase)+amp*.45*Math.sin((petals*2+1)*t-phase);m.lineTo(cx+Math.cos(t)*r,cy+Math.sin(t)*r);}
      m.stroke();
    }
  } else {
    // 隐形全息水印：片名斜向平铺，像透明全息膜里压的字
    const word=(record.title||"麻雀观影护照").replace(/\s+/g,"").slice(0,10)||"SPARROW",size=Math.max(9,mw/11);
    m.save();m.translate(mw/2,mh/2);m.rotate(-Math.PI*.13);
    m.font=`700 ${size}px ${SERIF}`;m.textAlign="center";m.textBaseline="middle";
    const gap=m.measureText(word).width+size*1.6,span=Math.hypot(mw,mh);
    for (let y=-span/2,row=0;y<span/2;y+=size*2.1,row++) for (let x=-span/2+(row%2)*gap/2;x<span/2;x+=gap) m.fillText(word,x,y);
    m.restore();
  }
  mask.kind=kind;
  return mask;
}
// 转动反光层用的海报增效遮罩：整张票根大小（w 宽），只有海报区域里有内容；没有海报或没有这项工艺时返回 null
function artMask(record,image,createCanvas,w) {
  const kind=parseCraft(record.look?.craft).art;
  if (!kind || !image) return null;
  const mw=Math.round(w*SOURCE.w/W),mask=artMaskCanvas(record,image,kind,createCanvas,Math.max(40,mw));
  if (!mask) return null;
  let full;
  try {full=createCanvas(w,Math.round(w*H/W));} catch (error) {return null;}
  const k=w/W;full.getContext("2d").drawImage(mask,SOURCE.x*k,SOURCE.y*k,SOURCE.w*k,SOURCE.h*k);
  full.fx=ART_FX[mask.kind];
  return full;
}

// ——— 背面隐形底纹（2026-11-22）———
// 和海报增效用同一个字母，背面换成另一种底纹，铺满背面边框以内；静止时看不见，转动时在深色底上浮现：
// u 放射纹（从纹章中心放出的细光束）、r 环形扭索（绕纹章的玫瑰曲线）、o 专题水印（专题名斜向平铺）、
// k 星尘（稀疏的亮点和星芒）、b 扭索底纹（铺满整面的防伪玫瑰曲线）、d 亮哑网点底纹；
// w 镭射彩虹（整面）、p 像素镭射（细方格光栅）、q 同心波纹（从纹章荡开）、m 莫尔纹、l 光栅变色、i 星芒、n 猫眼光。
const BACK_FX={uv:"a-guilloche",rim:"a-rim",holo:"a-holo",sparkle:"a-guilloche",band:"a-holo",dust:"a-matte",rainbow:"a-rainbow",pixel:"a-holo",ripple:"a-holo",moire:"a-holo",lenticular:"a-rainbow",glint:"a-gloss",cateye:"a-cateye",argyle:"a-guilloche",cloud:"a-holo",meander:"a-rim",perf:"a-guilloche",firework:"a-holo",honeycomb:"a-holo",caustic:"a-pearl",beam:"a-cateye",diag:"a-rainbow",contour:"a-pearl",postmark:"a-rim",frames:"a-guilloche"};
function backMask(record,createCanvas,w) {
  const kind=parseCraft(record.look?.craft).back;
  if (!kind) return null;
  const h=Math.round(w*H/W),k=w/W;let full;
  try {full=createCanvas(w,h);} catch (error) {return null;}
  const m=full.getContext("2d"),rand=seeded(hashAppearance("back|"+(record.id||record.key||"")+kind));
  m.save();m.scale(k,k);
  m.beginPath();m.rect(20,18,W-40,H-36);m.clip();
  m.fillStyle="#fff";m.strokeStyle="#fff";
  const cx=W/2,cy=283;
  if (kind==="uv") {
    for (let i=0;i<96;i++) {const a=i/96*Math.PI*2,b=a+Math.PI/96*.55;m.beginPath();m.moveTo(cx+Math.cos(a)*78,cy+Math.sin(a)*78);m.lineTo(cx+Math.cos(a)*900,cy+Math.sin(a)*900);m.lineTo(cx+Math.cos(b)*900,cy+Math.sin(b)*900);m.lineTo(cx+Math.cos(b)*78,cy+Math.sin(b)*78);m.closePath();m.fill();}
  } else if (kind==="rim" || kind==="band") {
    const ring=kind==="rim",ox=ring?cx:W*(.3+rand()*.4),oy=ring?cy:H*(.35+rand()*.3),petals=6+Math.floor(rand()*6),R=ring?150:Math.hypot(W,H)*.5;
    m.lineWidth=.7;
    for (let j=0;j<(ring?16:14);j++) { // 扭索底纹：背面只留十几圈，疏朗一些
      const base=ring?82+j*5.2:R*(.1+j*.065),amp=ring?9:R*.035,phase=j*.23;
      m.beginPath();
      for (let i=0;i<=360;i++) {const t=i/360*Math.PI*2,r=base+amp*Math.sin(petals*t+phase)+amp*.4*Math.sin((petals*2+1)*t-phase);m.lineTo(ox+Math.cos(t)*r,oy+Math.sin(t)*r);}
      m.stroke();
    }
  } else if (kind==="holo") {
    const word=(record.programme||"麻雀观影护照").replace(/^\d{4}\s*/,"").replace(/\s+/g,"").slice(0,12)||"SPARROW",size=19;
    m.save();m.translate(cx,H/2);m.rotate(-Math.PI*.13);
    m.font=`700 ${size}px ${SERIF}`;m.textAlign="center";m.textBaseline="middle";
    const gap=m.measureText(word).width+size*1.8,span=Math.hypot(W,H);
    for (let y=-span/2,row=0;y<span/2;y+=size*3.6,row++) for (let x=-span/2+(row%2)*gap/2;x<span/2;x+=gap) m.fillText(word,x,y);
    m.restore();
  } else if (PATTERNS.includes(kind)) {
    m.save();m.translate(20,18);paintPattern(m,kind,W-40,H-36,rand,2.6,1.8);m.restore();
  } else if (kind==="rainbow" || kind==="cateye") {
    m.fillRect(0,0,W,H);
  } else if (kind==="moire") {
    m.lineWidth=1.6;const a0=rand()*Math.PI,span=Math.hypot(W,H);
    for (const a of [a0,a0+.07]) {m.save();m.translate(W/2,H/2);m.rotate(a);for (let x=-span/2;x<span/2;x+=6.4) {m.beginPath();m.moveTo(x,-span/2);m.lineTo(x,span/2);m.stroke();}m.restore();}
  } else if (kind==="lenticular") {
    for (let x=20,i=0;x<W-20;x+=7,i++) {m.globalAlpha=i%2?.55:1;m.fillRect(x,18,2.4,H-36);}
    m.globalAlpha=1;
  } else if (kind==="glint") {
    for (let i=0;i<16;i++) {
      const x=30+rand()*(W-60),y=30+rand()*(H-60),r=9+rand()*12;
      m.save();m.translate(x,y);
      for (let j=0;j<4;j++) {m.rotate(Math.PI/4);const len=j%2?r*.55:r,g=m.createLinearGradient(-len,0,len,0);g.addColorStop(0,"rgba(255,255,255,0)");g.addColorStop(.5,"#fff");g.addColorStop(1,"rgba(255,255,255,0)");m.fillStyle=g;m.fillRect(-len,-.9,len*2,1.8);}
      m.restore();
    }
  } else if (kind==="pixel") {
    const fx=rand()<.5?0:W,fy=rand()<.5?0:H,far=Math.hypot(W,H); // 像素镭射：整齐的方格，从一角向对角渐隐
    for (let y=18;y<H-18;y+=10) for (let x=20;x<W-20;x+=10) {const t=1-Math.hypot(x-fx,y-fy)/far;if (t<.25) continue;m.globalAlpha=Math.min(1,t*1.2);const s=2+t*5;m.fillRect(x+5-s/2,y+5-s/2,s,s);}
    m.globalAlpha=1;
  } else if (kind==="ripple") {
    m.lineWidth=2.4;for (let r=82;r<900;r+=10) {m.beginPath();m.arc(cx,cy,r,0,Math.PI*2);m.stroke();}
  } else if (kind==="sparkle") {
    for (let i=0;i<520;i++) {
      const x=20+rand()*(W-40),y=18+rand()*(H-36),r=.5+rand()*1.3;
      m.globalAlpha=.5+rand()*.5;m.beginPath();m.arc(x,y,r,0,Math.PI*2);m.fill();
      if (rand()<.06) {m.fillRect(x-4,y-.3,8,.6);m.fillRect(x-.3,y-4,.6,8);}
    }
    m.globalAlpha=1;
  } else {
    const step=8.5,r=1.7;m.save();m.translate(cx,H/2);m.rotate(Math.PI/4);const span=Math.hypot(W,H);
    for (let y=-span/2;y<span/2;y+=step) for (let x=-span/2;x<span/2;x+=step) {m.beginPath();m.arc(x,y,r,0,Math.PI*2);m.fill();}
    m.restore();
  }
  m.restore();
  full.fx=BACK_FX[kind];
  return full;
}

// ——— 典藏玩法的票面标记（2026-11-22）———
const headTag=record=>record.hidden ? "隐藏款 · 1/1" : record.limited ? "影展限定" : record.slam ? "满贯典藏" : "";
// 验真二维码：浅色底 + 深色码点（不是烫印，不进工艺遮罩），留 3 格静区
function drawQR(surface,m,x,y,size,dark,light) {
  const n=m.length,q=2,cell=size/(n+q*2);
  surface.save();
  surface.fillStyle=light;surface.beginPath();
  if (surface.roundRect) surface.roundRect(x,y,size,size,3); else surface.rect(x,y,size,size);
  surface.fill();surface.fillStyle=dark;
  for (let r=0;r<n;r++) for (let c=0;c<n;c++) if (m[r][c]) surface.fillRect(x+(c+q)*cell,y+(r+q)*cell,cell+.15,cell+.15);
  surface.restore();
}
// 影展限定：背面撒一层金箔碎（只有影展期间的观影才有），位置按典藏编号固定
function drawGoldLeaf(surface,record) {
  const rand=seeded(hashAppearance("leaf|"+(record.serial||record.id)));
  surface.save();surface.fillStyle=foilGradient(surface,40,90,380,440,"gold");
  for (let i=0;i<46;i++) {
    const x=34+rand()*352,y=92+rand()*348;
    if (Math.hypot(x-W/2,y-283)<78) continue;
    const r=1.2+rand()*3.2,k=3+Math.floor(rand()*3),a0=rand()*Math.PI;
    surface.globalAlpha=.55+rand()*.4;surface.beginPath();
    for (let j=0;j<k;j++) {const a=a0+j*Math.PI*2/k,rr=r*(.55+rand()*.6);surface.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);}
    surface.closePath();surface.fill();
  }
  surface.restore();
}
// 影展限定：正面海报右下角的烫金圆形限定章
function drawLimitedSeal(surface,record,cx,cy,dark) {
  const year=(record.programme.match(/^\d{4}/)||[])[0]||record.date.slice(0,4);
  surface.save();surface.translate(cx,cy);surface.rotate(-.18);
  surface.fillStyle=dark+"d8";surface.beginPath();surface.arc(0,0,34,0,Math.PI*2);surface.fill();
  const foil=foilGradient(surface,-34,-34,34,34,"gold");
  surface.strokeStyle=foil;surface.fillStyle=foil;
  surface.lineWidth=1.4;surface.beginPath();surface.arc(0,0,32,0,Math.PI*2);surface.stroke();
  surface.lineWidth=.6;surface.beginPath();surface.arc(0,0,28,0,Math.PI*2);surface.stroke();
  arcText(surface,record.limitedName||"影展",22.5,false,6.6,Math.PI*1.05,SERIF);
  arcText(surface,"LIMITED · "+year,22.5,true,5,Math.PI*.8,MONO);
  surface.textAlign="center";surface.font=`900 15px ${SERIF}`;surface.fillText("限定",0,5.5);
  surface.restore();
}
// 隐藏款：正面海报左上角的「隐藏款 1/1」烫印签
function drawHiddenTag(surface,x,y,dark) {
  surface.save();surface.font=`700 10px ${SANS}`;
  const label="隐藏款 · 1/1",w=surface.measureText(label).width+16,h=19;
  surface.fillStyle=dark+"d8";surface.beginPath();
  if (surface.roundRect) surface.roundRect(x,y,w,h,h/2); else surface.rect(x,y,w,h);
  surface.fill();const foil=foilGradient(surface,x,y,x+w,y+h,"unique");
  surface.strokeStyle=foil;surface.lineWidth=1;surface.stroke();
  surface.fillStyle=foil;surface.textAlign="left";surface.textBaseline="alphabetic";surface.fillText(label,x+8,y+13.3);
  surface.restore();
}
// 隐藏款：背面纪念章外一圈由典藏编号生成的星图（每张都不一样），上方「隐藏款 · 1/1 孤品」
function drawConstellation(surface,record,finish) {
  const rand=seeded(hashAppearance("stars|"+record.serial)),pts=[];
  for (let i=0;i<9;i++) {const a=-Math.PI/2+i*Math.PI*2/9+(rand()-.5)*.5,r=88+rand()*48;pts.push([W/2+Math.cos(a)*r,283+Math.sin(a)*r]);}
  surface.save();const foil=foilGradient(surface,80,150,340,420,"unique");
  surface.strokeStyle=foil;surface.fillStyle=foil;surface.lineWidth=.6;surface.globalAlpha=.85;
  surface.beginPath();pts.forEach(([x,y],i)=>i?surface.lineTo(x,y):surface.moveTo(x,y));surface.closePath();surface.stroke();
  surface.globalAlpha=1;pts.forEach(([x,y])=>star(surface,x,y,1.8+rand()*1.6));
  surface.restore();
  pillText(surface,"隐藏款 · 1/1 孤品",198,"unique",palettes[record.look.palette]?.[1]||"#111");
}
// 背面纹样上的一行小字：垫一块深色胶囊（不进工艺遮罩），字是烫印，不被放射纹干扰
function pillText(surface,label,y,finish,dark) {
  surface.save();surface.font=`700 11px ${SANS}`;
  const w=Math.min(300,surface.measureText(label).width)+22,h=20,x=W/2-w/2;
  surface.fillStyle=dark+"e6";surface.beginPath();
  if (surface.roundRect) surface.roundRect(x,y-14,w,h,h/2); else surface.rect(x,y-14,w,h);
  surface.fill();surface.strokeStyle=foilGradient(surface,x,y-14,x+w,y+6,finish);surface.lineWidth=.8;surface.stroke();
  surface.restore();
  text(surface,label,W/2,y,{size:11,weight:700,align:"center",ink:foilGradient(surface,x,y-10,x+w,y+4,finish),max:300});
}
// 全收集金章：纪念章外加一圈金色星环，下方写「全满贯 / 单元满贯 · 集齐 N 部」
function drawSlam(surface,record) {
  surface.save();surface.translate(W/2,283);
  const foil=foilGradient(surface,-74,-74,74,74,"gold");
  surface.strokeStyle=foil;surface.fillStyle=foil;
  surface.lineWidth=1.1;surface.beginPath();surface.arc(0,0,70,0,Math.PI*2);surface.stroke();
  surface.lineWidth=.5;surface.beginPath();surface.arc(0,0,74,0,Math.PI*2);surface.stroke();
  for (let i=0;i<16;i++) {const a=i*Math.PI/8;star(surface,Math.cos(a)*72,Math.sin(a)*72,i%4===0?2.6:1.6);}
  surface.restore();
  pillText(surface,(record.slam==="programme"?"全满贯":"单元满贯")+" · 集齐 "+record.slamN+" 部",378,"gold",palettes[record.look.palette]?.[1]||"#111");
}

// ——— 盲文凸点（视高迪 Braille）：透明立体光油点，英文一级盲文 ———
const BRAILLE={S:[2,3,4],P:[1,2,3,4],A:[1],R:[1,2,3,5],O:[1,3,5],W:[2,4,5,6],C:[1,4],I:[2,4],N:[1,3,4,5],E:[1,5],M:[1,3,4]};
function drawBraille(surface,word,x,y) {
  const step=3.4,cell=10.5,letters=[...word].filter(c=>BRAILLE[c]),left=x-(letters.length*cell-cell+step)/2;
  surface.save();
  letters.forEach((c,i)=>BRAILLE[c].forEach(dot=>{
    const cx=left+i*cell+(dot>3?step:0),cy=y-step+((dot-1)%3)*step;
    const g=foilTag(surface.createRadialGradient(cx-.4,cy-.5,.1,cx,cy,1.35));
    g.addColorStop(0,"rgba(255,255,255,.95)");g.addColorStop(.6,"rgba(255,255,255,.45)");g.addColorStop(1,"rgba(255,255,255,.12)");
    surface.shadowColor="rgba(0,0,0,.35)";surface.shadowBlur=1;surface.shadowOffsetY=.6;
    surface.fillStyle=g;surface.beginPath();surface.arc(cx,cy,1.25,0,Math.PI*2);surface.fill();
  }));
  surface.restore();
}

// ——— 背面原创文字徽记（不使用任何影展官方 LOGO）———
// 专题名环绕成纪念章，中间是届数、年份和星；三种章形按专题固定（圆章 / 月桂章 / 八角章）。全部用烫印渐变画，所以会跟着工艺反光。
function arcText(surface,value,radius,bottom,size,maxAngle,font) {
  let chars=[...value];
  surface.font=`700 ${size}px ${font}`;
  let widths=chars.map(c=>surface.measureText(c).width+size*.18),total=widths.reduce((a,b)=>a+b,0)/radius;
  if (total>maxAngle) {
    size=Math.max(6.5,size*maxAngle/total);surface.font=`700 ${size}px ${font}`;
    widths=chars.map(c=>surface.measureText(c).width+size*.18);total=widths.reduce((a,b)=>a+b,0)/radius;
    while (total>maxAngle && chars.length>2) {chars.pop();widths.pop();total=widths.reduce((a,b)=>a+b,0)/radius;}
  }
  surface.textAlign="center";surface.textBaseline="middle";
  let angle=-total/2;
  chars.forEach((c,i)=>{
    const a=angle+widths[i]/radius/2;
    surface.save();
    if (bottom) {surface.rotate(-a);surface.translate(0,radius);}
    else {surface.rotate(a);surface.translate(0,-radius);}
    surface.fillText(c,0,0);surface.restore();
    angle+=widths[i]/radius;
  });
  surface.textBaseline="alphabetic";
}
function star(surface,x,y,r) {
  surface.beginPath();
  for (let i=0;i<10;i++) {const a=-Math.PI/2+i*Math.PI/5,q=i%2?r*.45:r;surface.lineTo(x+Math.cos(a)*q,y+Math.sin(a)*q);}
  surface.closePath();surface.fill();
}
function drawEmblem(surface,record,finish,year) {
  const raw=(record.programme||"").replace(/^\d{4}\s*/,"").trim()||"麻雀观影护照";
  const edition=(raw.match(/第\s*(\d+)\s*届/)||[])[1];
  const name=raw.replace(/第\s*\d+\s*届/,"").replace(/\s+/g,"");
  const kind=["seal","laurel","octagon"][hashAppearance(record.programmeId||name)%3];
  surface.save();surface.translate(W/2,283);
  const foil=foilGradient(surface,-62,-62,62,62,finish);
  surface.strokeStyle=foil;surface.fillStyle=foil;
  if (kind==="octagon") {
    for (const [r,lw] of [[63,1.3],[57.5,.6]]) {
      surface.lineWidth=lw;surface.beginPath();
      for (let i=0;i<8;i++) {const a=Math.PI/8+i*Math.PI/4;surface.lineTo(Math.cos(a)*r,Math.sin(a)*r);}
      surface.closePath();surface.stroke();
    }
  } else {
    surface.lineWidth=1.3;surface.beginPath();surface.arc(0,0,63.5,0,Math.PI*2);surface.stroke();
    surface.lineWidth=.6;surface.beginPath();surface.arc(0,0,58,0,Math.PI*2);surface.stroke();
  }
  if (kind==="laurel") {
    // 月桂枝：两侧各一串叶片沿弧线向上收拢（通用纹样，非任何机构的标志）
    for (const side of [-1,1]) for (let i=0;i<9;i++) {
      const t=i/8,a=Math.PI/2+side*(Math.PI*.18+t*Math.PI*.62),r=49;
      const x=Math.cos(a)*r,y=Math.sin(a)*r,tangent=a+side*Math.PI/2;
      surface.save();surface.translate(x,y);surface.rotate(tangent+side*.55);
      surface.beginPath();surface.ellipse(0,0,5.6-t*1.6,2.1-t*.5,0,0,Math.PI*2);surface.fill();surface.restore();
    }
    surface.textAlign="center";
    const short=name.length>8?name.slice(0,8):name;
    surface.font=`700 ${short.length>6?8:9}px ${SERIF}`;surface.fillText(short,0,30);
  } else {
    arcText(surface,name,50,false,10.5,Math.PI*1.12,SERIF);
    arcText(surface,"SPARROW · FILM PASSPORT",50.5,true,6.6,Math.PI*.8,MONO);
    surface.beginPath();surface.arc(-50,0,1.6,0,Math.PI*2);surface.arc(50,0,1.6,0,Math.PI*2);surface.fill();
  }
  surface.textAlign="center";
  if (edition) {surface.font=`700 9px ${SERIF}`;surface.fillText(`第${edition}届`,0,-17);}
  surface.font=`600 ${year?24:18}px ${year?MONO:SERIF}`;surface.fillText(year||"麻雀",0,kind==="laurel"?8:10);
  const sy=kind==="laurel"?-24:24;
  if (!edition || kind!=="laurel") for (const dx of [-9,0,9]) star(surface,dx,sy+(dx?1.5:0),dx?2.1:2.8);
  surface.restore();
}

// ——— 导出：烘焙金属反光（2026-11-22）———
// 静止图片看不出转动时的闪光，导出时固定一个角度，把反光烘焙进烫印范围（工艺遮罩）：
// 烫金 / 烫银 / 烫铜是一道斜向亮带，镭射类是一道彩虹光，闪粉 / 亮釉 / 立体光油是柔和的白光，哑光不加。海报和纸面不受影响。
const SHEEN_RAINBOW=["#ff8fd8","#ffe27a","#9dffb0","#8ff0ff","#b9a2ff","#ff8fd8"];
function bakeSheen(surface,record,side,rect,createCanvas,hasArt,angle=-.62) {
  const fx=fxOf(record.look?.finish);
  if (fx==="none" || !createCanvas || rect.w<CRAFT_MIN) return;
  const w=Math.max(1,Math.round(Math.min(rect.w,1100))),h=Math.max(1,Math.round(w*H/W));
  let mask,layer;
  try {mask=createCanvas(w,h);layer=createCanvas(w,h);} catch (error) {return;}
  if (!foilMask(mask.getContext("2d"),record,side,{x:0,y:0,w,h},createCanvas,hasArt)) return;
  const ctx=layer.getContext("2d"),len=Math.hypot(w,h),cx=w*(side==="front"?.36:.62),cy=h*(side==="front"?.42:.38);
  const dx=Math.cos(angle)*len/2,dy=Math.sin(angle)*len/2;
  const g=ctx.createLinearGradient(cx-dx,cy-dy,cx+dx,cy+dy);
  if (fx==="holo" || fx==="cast" || fx==="crystal") {
    g.addColorStop(0,"rgba(255,255,255,0)");
    SHEEN_RAINBOW.forEach((c,i)=>g.addColorStop(.3+i*.08,c));
    g.addColorStop(.82,"rgba(255,255,255,0)");g.addColorStop(1,"rgba(255,255,255,0)");
  } else {
    const soft=fx!=="sweep";
    g.addColorStop(0,"rgba(255,255,255,0)");g.addColorStop(.38,"rgba(255,255,255,0)");
    g.addColorStop(.47,`rgba(255,255,255,${soft?.35:.75})`);g.addColorStop(.5,`rgba(255,255,255,${soft?.5:1})`);g.addColorStop(.54,`rgba(255,255,255,${soft?.3:.6})`);
    g.addColorStop(.66,"rgba(255,255,255,0)");g.addColorStop(1,"rgba(255,255,255,0)");
  }
  ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  // 亮带外还留一层很淡的底光，整片烫印都带一点金属的亮
  ctx.fillStyle="rgba(255,255,255,.12)";ctx.fillRect(0,0,w,h);
  ctx.globalCompositeOperation="destination-in";ctx.drawImage(mask,0,0);
  surface.save();surface.globalCompositeOperation="screen";surface.globalAlpha=fx==="sweep"?.85:fx==="holo"||fx==="cast"||fx==="crystal"?.6:.5;
  surface.drawImage(layer,rect.x,rect.y,rect.w,rect.h);surface.restore();
}

// ——— 导出：正反面合成图「片名海报」（2026-11-22）———
// 2160 × 2700（4:5，小红书 / 朋友圈），小程序传 width 1440。底色取票根配色，铺一层很淡的模糊海报和一个大号片名水印，
// 正反两面并排居中（直接画在大画布上，不经过离屏画布中转），下方左边片名、右边「№ 0042 / 本片第 42 张典藏 / 典藏编号」。
// 票根两侧撕线缺口要透出底图：画完票根后把底图在缺口处重画一遍，不让阴影在缺口里积成黑点。
const SHOW_W=2160,SHOW_H=2700;
function fitFont(surface,text,weight,size,font,max) {
  surface.font=`${weight} ${size}px ${font}`;const w=surface.measureText(text).width;
  if (w>max) {size=Math.max(size*.12,size*max/w);surface.font=`${weight} ${size}px ${font}`;}
  return size;
}
function spaced(surface,text,x,y,sp,align) {
  const chars=[...text],ws=chars.map(c=>surface.measureText(c).width),total=ws.reduce((a,b)=>a+b,0)+sp*(chars.length-1);
  let cx=align==="center"?x-total/2:align==="right"?x-total:x;surface.textAlign="left";
  chars.forEach((c,i)=>{surface.fillText(c,cx,y);cx+=ws[i]+sp;});
}
function showcaseBackdrop(g,record,art,createCanvas) {
  const s=swatch(record),dark=HEX.test(s.dark)?s.dark:"#1d1a17",mid=HEX.test(s.mid)?s.mid:"#3a332c";
  const top=mixHex("#0e0d0c",mid,.55),bottom=mixHex("#070707",dark,.6);
  const lg=g.createLinearGradient(0,0,SHOW_W,SHOW_H);lg.addColorStop(0,top);lg.addColorStop(1,bottom);
  g.fillStyle=lg;g.fillRect(0,0,SHOW_W,SHOW_H);
  // 很淡的模糊海报：缩成小图再放大，天然就是模糊的（不用 filter，小程序和 Safari 都画得出来）
  if (art && createCanvas) {
    try {
      const sw=36,sh=Math.max(1,Math.round(sw*(art.height||3)/(art.width||2))),small=createCanvas(sw,sh);
      small.getContext("2d").drawImage(art,0,0,sw,sh);
      g.save();g.globalAlpha=.2;g.imageSmoothingEnabled=true;
      const bw=SHOW_W+600,bh=bw*sh/sw;g.drawImage(small,-300,-200,bw,bh);g.restore();
    } catch (error) {}
  }
  const r=g.createRadialGradient(SHOW_W/2,SHOW_H*.4,60,SHOW_W/2,SHOW_H*.42,SHOW_W*.9);
  r.addColorStop(0,"rgba(255,244,226,.10)");r.addColorStop(1,"rgba(0,0,0,.32)");g.fillStyle=r;g.fillRect(0,0,SHOW_W,SHOW_H);
  // 胶片颗粒（按票根键固定，导出几次都一样）
  const rand=seeded(hashAppearance("grain|"+(record.id||"")));
  for (let i=0;i<26000;i++) {g.fillStyle=rand()<.5?`rgba(255,255,255,${.05*rand()})`:`rgba(0,0,0,${.07*rand()})`;g.fillRect(rand()*SHOW_W,rand()*SHOW_H,1.6,1.6);}
  // 大号片名水印：按宽度缩放，长片名也放得下
  const mark=record.title||"";
  if (mark) {
    const n=[...mark].length;g.save();g.globalAlpha=n<=2?.06:.045;g.fillStyle="#fff";g.textAlign="center";
    const size=fitFont(g,mark,900,n<=2?1250:900,TITLE,SHOW_W*.9);
    g.fillText(mark,SHOW_W/2,SHOW_H*.66+size*.3);g.restore();
  }
}
function drawShowcase(surface,record,art,createCanvas,opts={}) {
  const out=opts.width||SHOW_W,k=out/SHOW_W;
  surface.save();surface.scale(k,k);
  showcaseBackdrop(surface,record,art,createCanvas);
  const th=1500,tw=th*W/H,gap=70,top=300,rects=[{x:SHOW_W/2-tw-gap/2,y:top,w:tw,h:th,side:"front"},{x:SHOW_W/2+gap/2,y:top,w:tw,h:th,side:"back"}];
  for (const r of rects) {
    // 阴影：先画一块同形状的纸，阴影落在底图上
    surface.save();surface.translate(r.x,r.y);surface.scale(r.w/W,r.h/H);
    surface.shadowColor="rgba(0,0,0,.5)";surface.shadowBlur=60/(r.w/W);surface.shadowOffsetY=30/(r.h/H);
    frame(surface);surface.fillStyle="#000";surface.fillRect(0,0,W,H);surface.restore();
    const hasArt=r.side==="front" && !!art;
    draw(surface,record,r.side,r.side==="front"?art:null,{x:r.x,y:r.y,w:r.w,h:r.h},createCanvas);
    bakeSheen(surface,record,r.side,{x:r.x,y:r.y,w:r.w,h:r.h},createCanvas,hasArt);
  }
  // 撕线缺口处重画底图（缺口在票根坐标 (0,TEAR) 与 (W,TEAR)，半径 NOTCH）
  surface.save();surface.beginPath();
  for (const r of rects) for (const nx of [0,W]) {const sc=r.w/W;surface.moveTo(r.x+nx*sc+NOTCH*sc,r.y+TEAR*sc);surface.arc(r.x+nx*sc,r.y+TEAR*sc,NOTCH*sc,0,Math.PI*2);}
  surface.clip();showcaseBackdrop(surface,record,art,createCanvas);surface.restore();
  // 文字
  const L=150,R=SHOW_W-150,y0=1960,white=a=>`rgba(255,255,255,${a})`;
  surface.fillStyle=white(.85);surface.font=`500 28px ${MONO}`;spaced(surface,"SPARROW · FILM PASSPORT",L,190,8,"left");
  surface.textAlign="right";surface.font=`500 28px ${SANS}`;surface.fillText("典藏票根",R,190);
  surface.textAlign="left";surface.fillStyle="#fff";
  const tsize=fitFont(surface,record.title||"",900,110,TITLE,980);surface.fillText(record.title||"",L,y0+110);
  let ty=y0+110;
  if (record.subtitle && record.subtitle.toLowerCase()!==(record.title||"").toLowerCase()) {
    surface.fillStyle=white(.65);surface.font=`500 34px ${LATIN}`;fitFont(surface,record.subtitle.toUpperCase(),500,34,LATIN,980);
    spaced(surface,record.subtitle.toUpperCase(),L,ty+=Math.max(60,tsize*.6),6,"left");
  }
  surface.fillStyle=white(.7);surface.textAlign="left";
  const meta=[record.programme,[record.date.replace(/-/g,"."),record.time].filter(Boolean).join(" "),[record.city,record.venue].filter(Boolean).join(" · ")].filter(Boolean);
  fitFont(surface,meta.join("  ·  "),500,30,SANS,1000);surface.fillText(meta.join("  ·  "),L,ty+75);
  // 徽记（隐藏款 / 影展限定 / 满贯）：片名信息下方一行金色小字
  const badges=badgesOf(record);
  if (badges.length) {surface.textAlign="left";surface.fillStyle="#e9c77c";fitFont(surface,"✦ "+badges.join("  ✦ "),600,30,SANS,1000);surface.fillText("✦ "+badges.join("  ✦ "),L,ty+135);}
  surface.textAlign="right";
  const serial=formatSerial(record),ed=editionLines(record);
  if (record.issue) {
    surface.fillStyle="#fff";surface.font=`600 120px ${MONO}`;const no="№"+String(record.issue).padStart(4,"0");
    if (ed.total) {surface.font=`600 56px ${MONO}`;const tw=surface.measureText(ed.total.trim()).width;surface.fillStyle=white(.75);surface.fillText(ed.total.trim(),R,y0+110);
      surface.font=`600 120px ${MONO}`;surface.fillStyle="#fff";surface.fillText(no,R-tw-14,y0+110);}
    else surface.fillText(no,R,y0+110);
    surface.fillStyle=white(.75);surface.font=`500 32px ${SANS}`;surface.fillText(ed.line1,R,y0+175);
    if (ed.line2) {surface.fillStyle="#e9c77c";surface.font=`500 30px ${SANS}`;surface.fillText(ed.line2,R,y0+222);}
  } else {
    surface.fillStyle=white(.4);surface.font=`600 120px ${MONO}`;surface.fillText("№----",R,y0+110);
    surface.fillStyle=white(.55);surface.font=`500 32px ${SANS}`;surface.fillText("发行序号待发放",R,y0+175);
  }
  if (serial) {surface.fillStyle=white(.5);surface.font=`500 26px ${MONO}`;surface.fillText("No. "+serial,R,y0+(ed.line2?285:250));}
  // 验真二维码：票面上的码在缩小的合成图里太小，这里另放一个大的（小程序 1440 宽时每格约 3.5 像素，手机能扫）
  const vq=record.issue ? qrFor(record.serial) : null;
  if (vq) {
    const qs=270,qx=R-qs,qy=y0+(ed.line2?312:286);
    drawQR(surface,vq,qx,qy,qs,"#1d1712","#f4ece0");
    surface.textAlign="right";surface.fillStyle=white(.75);surface.font=`600 30px ${SANS}`;surface.fillText("扫码验真",qx-28,qy+qs/2-8);
    surface.fillStyle=white(.5);surface.font=`500 24px ${SANS}`;surface.fillText("查看这张票根的发行记录",qx-28,qy+qs/2+34);
  }
  // 页脚：有验真二维码时下移，给二维码让位
  const fy=vq ? SHOW_H-110 : SHOW_H-210;
  surface.fillStyle=white(.18);surface.fillRect(L,fy,R-L,1.5);
  surface.fillStyle=white(.6);surface.textAlign="left";surface.font=`500 24px ${SANS}`;surface.fillText("麻雀观影护照 · 麻雀映画 × 麻雀部落",L,fy+56);
  surface.restore();
}

// 12 张以内是大票根墙；更多时是密排拼图（年度 / 专题票根墙），每张图最多 MOSAIC_MAX 张，超出由调用方分成多张图。
const MOSAIC_MAX=180;
function wallLayout(count,maxWidth=2160) {
  const big=count<=12;
  const columns=count===1 ? 1 : count<=4 ? 2 : count<=6 ? 3 : count<=12 ? 4 : count<=24 ? 6 : count<=48 ? 8 : count<=96 ? 10 : 12;
  const width=big ? Math.min(maxWidth,columns===1 ? 940 : 1580) : Math.min(maxWidth,2160);
  const margin=big ? 64 : 56, gap=big ? 33 : Math.max(8,Math.round(width/150)), top=206, bottom=92;
  const cardW=Math.min(520,(width-margin*2-(columns-1)*gap)/columns);
  const cardH=cardW*H/W;
  const rows=Math.ceil(count/columns);
  const height=Math.ceil(top+rows*cardH+(rows-1)*gap+bottom);
  return {width,height,rects:Array.from({length:count},(_,i)=>{
    const row=Math.floor(i/columns), rowCount=Math.min(columns,count-row*columns);
    const rowWidth=rowCount*cardW+(rowCount-1)*gap;
    return {x:(width-rowWidth)/2+(i%columns)*(cardW+gap),y:top+row*(cardH+gap),w:cardW,h:cardH};
  })};
}

function drawWall(surface,records,side,images,caption,createCanvas,title,maxWidth) {
  const layout=wallLayout(records.length,maxWidth);
  const {width,height,rects}=layout;
  const background=surface.createLinearGradient(0,0,width,height);
  background.addColorStop(0,"#383d35");background.addColorStop(1,"#1b231e");
  surface.fillStyle=background;surface.fillRect(0,0,width,height);
  text(surface,"麻雀观影护照",64,69,{size:22,ink:"#d6bd91",weight:650});
  text(surface,title||"我的典藏票根册",62,144,{size:58,font:SERIF,ink:"#f5ebd5",weight:900,max:width-125});
  text(surface,caption||`${records.length} 张 · ${side==="back" ? "背面" : "正面"}`,width-64,178,{size:22,align:"right",ink:"#e5d6bc",max:width-128});
  rule(surface,height-66,"#d5bb895c",64,width-64);
  text(surface,"SPARROW CINEMA",width/2,height-32,{size:17,font:MONO,ink:"#e5d6bc",align:"center"});
  records.forEach((record,i)=>{
    const rect=rects[i];
    surface.save();
    surface.shadowColor="#0b0e0b99";surface.shadowBlur=22;surface.shadowOffsetY=11;
    surface.fillStyle="#222721";surface.fillRect(rect.x+1,rect.y+4,rect.w-2,rect.h-8);
    surface.restore();
    draw(surface,record,side,images[i],rect,createCanvas);
  });
  return layout;
}

const shineOf=key=>{const f=finishes[key]||finishes.matte;return {kind:f.kind,fx:fxOf(key),highlight:f.stops[f.stops.length-2]};};
return {isHidden,HIDDEN_RATE,editionClose,EDITION_GRACE,pendingEdition,applyEdition,decorate,setQR,verifyURL,editionLines,badgesOf,drawShowcase,bakeSheen,SHOW_W,SHOW_H,serialOf,serialValid,formatSerial,entrySerial,pendingIssue,applyIssue,issueText,ISSUE_BATCH,W,H,TITLE_FAMILY,edgeOf,foilMask,fxOf,artMask,backMask,parseCraft,craftLabel,lookSig,foilLayers,WALL_PAGE,MOSAIC_MAX,FACETS,options:labelOptions(),sanitize,read,sorted,defaults,randomLook,shineOf,draw,wallLayout,drawWall,
  ticketKey,parseKey,cleanStore,mergeStore,packLook,unpackLook,normArt,viewings,build,reconcile,draft,entryFrom,migrateV1,filterTickets,facetCounts,groupByMonth,swatch};
});
