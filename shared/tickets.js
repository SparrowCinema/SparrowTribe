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
  varnish: {label:"滴晶亮釉", kind:"soft", stops:["#8495a6","#b1c4c6","#f6f1e4","#9bb2a9"], width:1.95},
  matte:   {label:"哑光压纹", kind:"soft", stops:["#9d8969","#c1ae8d","#a69273"], width:1.08}
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
  festival: {palette:["burgundy","honey","ember","rust","peach","crimson"], finish:["holo","gold","copper","solar"], texture:["cotton","laid","parchment","deckle","fleck","felt"], motif:["rosette","rays","arches"]},
  region: {palette:["jade","navy","cyan","teal","fern","cobalt"], finish:["silver","aurora","opal","pearl"], texture:["silk","washi","frost","xuan","moire","vellum"], motif:["waves","orbit","contour"]},
  theme: {palette:["violet","indigo","rose","iris","plum","cobalt"], finish:["prism","opal","cobalt","varnish"], texture:["linen","crosshatch","satin","leather","velvet","mica"], motif:["facets","rays","orbit"]},
  venue: {palette:["moss","clay","olive","peach","sepia","rust"], finish:["copper","gold","varnish","matte"], texture:["kraft","washi","cotton","felt","xuan","laid"], motif:["arches","contour","frames"]},
  cinema: {palette:["ink","graphite","navy","lemon","sepia","indigo"], finish:["silver","matte","cobalt","pearl"], texture:["ribbed","frost","satin","velvet","vellum","mica"], motif:["frames","rays","facets"]}
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
function foilGradient(surface,x1,y1,x2,y2,finish) {
  const range=finishes[finish].stops;
  const foil=surface.createLinearGradient(x1,y1,x2,y2);
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


function defaults(record) {
  const preset=programmeLooks[record.programmeId] || {};
  const family=families[preset.family] || families[inferFamily(record.programme)];
  const key="sparrow-collectible-1|"+record.programmeId;
  return {
    palette:preset.palette || pick(family.palette,key),
    finish:preset.finish || pick(family.finish,key+"|"+record.id),
    texture:preset.texture || pick(family.texture,key+"|"+record.id),
    motif:preset.motif || pick(family.motif,key+"|"+record.id)
  };
}
const options={finish:finishes,texture:papers,palette:palettes,motif:motifs};

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
  const fallback=defaults(record);
  record.look=Object.fromEntries(Object.entries(options).map(([key,registry])=>
    [key,Object.prototype.hasOwnProperty.call(registry,input.look?.[key]) ? input.look[key] : fallback[key]]));
  return record;
}

function randomLook(record,locked=[]) {
  return Object.fromEntries(Object.entries(options).map(([dimension,registry])=>{
    if (locked.includes(dimension)) return [dimension,record.look[dimension]];
    const candidates=Object.keys(registry).filter(key=>key!==record.look[dimension]);
    return [dimension,candidates[Math.floor(Math.random()*candidates.length)]];
  }));
}

function labelOptions() {
  return Object.fromEntries(Object.entries(options).map(([key,registry])=>
    [key,Object.entries(registry).map(([id,item])=>({id,label:item.label || (Array.isArray(item) ? item[0] : item)}))]));
}

function read(raw) {
  try {
    const value=typeof raw==="string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(value)) return [];
    return Array.from(new Map(value.map(sanitize).filter(Boolean).map(record=>[record.id,record])).values());
  } catch (_) { return []; }
}

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
    crop:entry.c===undefined ? 50 : entry.c,sketch:entry.sk===1,savedAt:entry.t,look:unpackLook(entry.l)});
  row.key=key; row.linked=!!view; row.arts=b.arts||[]; row.director=b.director||"";
  return row;
}
// 和观影护照对齐：一部电影一张票根（护照是一部电影一枚印章）。
// - 同一部电影有多张已收藏的票根（重看、旧数据）时只显示最近保存的一张，其余留在存储里不删除；
// - 还没做票根的电影进「待制作」，用最近一次观影；
// - 不对应观影记录的票根（改过观影日期、旧版迁移、手工新建）先由 reconcile 挪到这部电影上；
//   这部电影已不在护照里时不显示（存储保留，重新盖章后回来）。
function build(list,store,base) {
  const tickets=[], pending=[], byFilm=new Map(), linked=new Set();
  for (const item of list) {linked.add(item.key);if (!byFilm.has(item.filmId)) byFilm.set(item.filmId,[]);byFilm.get(item.filmId).push(item);}
  let hidden=0;
  for (const [filmId,items] of byFilm) {
    const live=items.filter(item=>store[item.key] && !store[item.key].del);
    if (live.length) {
      live.sort((x,y)=>(store[y.key].t||0)-(store[x.key].t||0) || y.view.d.localeCompare(x.view.d));
      const item=live[0], row=record(item.key,filmId,item.view,store[item.key],base,item.view.d);
      if (row) {row.views=items.length;tickets.push(row);}
      hidden+=live.length-1;
    } else pending.push(items.reduce((x,y)=>y.view.d>x.view.d?y:x));
  }
  for (const key of Object.keys(store)) {
    const entry=store[key];
    if (!linked.has(key) && entry && !entry.del && parseKey(key)) hidden++;
  }
  return {tickets:sorted(tickets),pending:pending.sort((a,b)=>b.view.d.localeCompare(a.view.d) || a.key.localeCompare(b.key)),hidden};
}
// 还没盖章的电影新建票根时的草稿（不对应观影记录，所以不经过 build）
function draft(key,entry,base) {const p=parseKey(key);return p ? record(key,p.filmId,null,entry||{t:Date.now()},base,p.date) : null;}
// 不对应观影记录的票根挪到同一部电影上（这部电影还没有票根时）：返回要写入存储的改动，没有就返回 null。
// 只挪不删：原键留删除标记，内容原样搬到这部电影最近一次观影的键上，随同步传到其他设备。
function reconcile(list,store,now) {
  const linked=new Set(list.map(item=>item.key)), has=new Set(), latest=new Map(), changes={};
  for (const item of list) {
    if (store[item.key] && !store[item.key].del) has.add(item.filmId);
    const cur=latest.get(item.filmId);
    if (!cur || item.view.d>cur.view.d) latest.set(item.filmId,item);
  }
  const orphans=Object.keys(store).filter(key=>!linked.has(key) && store[key] && !store[key].del && parseKey(key))
    .sort((a,b)=>(store[b].t||0)-(store[a].t||0));
  let n=0;
  for (const key of orphans) {
    const filmId=parseKey(key).filmId, target=latest.get(filmId);
    if (!target || has.has(filmId)) continue;
    const gone=store[target.key];                       // 用户后来亲手移出过这张，就不再挪回来
    if (gone && gone.del && (gone.t||0)>=(store[key].t||0)) continue;
    const t=Math.max(now||Date.now(),(store[key].t||0)+1);
    changes[target.key]={...store[key],t};changes[key]={del:1,t};has.add(filmId);n++;
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
  const look=packLook(row.look);
  if (look!==packLook(defaults({...base,id:row.id}))) entry.l=look;
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
    terms.every(term=>[row.title,row.subtitle,row.venue,row.programme,row.city,row.director,row.hall,row.format].join(" ").toLowerCase().includes(term)));
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
    text(surface,"收藏票根",W-35,57,{size:12,align:"right",ink:bright});
    rule(surface,78,bright+"77",35,W-35);
    drawMedallion(surface,{motif,finish,seed:hashAppearance(record.id)},dark);
    const year=record.programme.match(/^\d{4}/)?.[0] || record.date.slice(0,4);
    const centre={align:"center",ink:bright};
    text(surface,year || "麻雀",W/2,295,{...centre,size:36,weight:year?600:900,font:year ? MONO : SERIF,max:132,relief:edge});
    const heading=(year && record.programme.startsWith(year) ? record.programme.slice(4).trim() : record.programme) || "我的观影收藏";
    text(surface,heading,W/2,511,{...centre,size:38,weight:900,font:SERIF,max:347,relief:edge,light:bright+"a0"});
    if (record.section) text(surface,record.section,W/2,552,{...centre,size:17,max:326});
    rule(surface,601,bright+"75",59,W-59);
    text(surface,record.title,W/2,652,{...centre,size:21,weight:650,max:331});
    rule(surface,TEAR,bright+"6b",24,W-24,true);
    text(surface,[record.date.replace(/-/g,"."),record.city].filter(Boolean).join(" · "),W/2,756,{...centre,size:14,font:MONO});
    text(surface,"SPARROW CINEMA",W/2,807,{...centre,size:11,font:MONO});
  } else {
    surface.fillStyle=stock;surface.fillRect(0,0,W,H);
    surface.fillStyle=stub;surface.fillRect(0,TEAR,W,H-TEAR);
    paper(surface,texture,"front",createCanvas);
    text(surface,"麻雀观影护照",28,52,{size:13,weight:700,ink:accent});
    text(surface,"纪念票根",W-28,52,{size:12,weight:700,align:"right",ink:accent});
    rule(surface,73,accent+"62");
    const {x,y,w,h}=SOURCE;
    surface.fillStyle=dark;surface.fillRect(x,y,w,h);
    if (image) {
      if (!Sketch?.paint(surface,image,record.crop,SOURCE,createCanvas,cropCover,rect.w/W,record.artStyle)) {
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
    embossTitle(surface,record.title,W/2,506,{accent,dark,finish,scale:rect.w/W,createCanvas});
    if (record.subtitle && record.subtitle.toLowerCase()!==record.title.toLowerCase()) {
      text(surface,record.subtitle.toUpperCase(),W/2,540,{size:12.5,weight:600,font:LATIN,spacing:2.2,align:"center",ink:"#5b5046",max:340});
    }
    rule(surface,561,accent+"58");
    text(surface,"放映日期",28,587,{size:12});
    text(surface,record.date.replace(/-/g,".") || "日期待定",28,624,{size:25,font:MONO,max:223});
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

const shineOf=key=>{const f=finishes[key]||finishes.matte;return {kind:f.kind,highlight:f.stops[f.stops.length-2]};};
return {W,H,TITLE_FAMILY,edgeOf,WALL_PAGE,MOSAIC_MAX,FACETS,options:labelOptions(),sanitize,read,sorted,defaults,randomLook,shineOf,draw,wallLayout,drawWall,
  ticketKey,parseKey,cleanStore,mergeStore,packLook,unpackLook,normArt,viewings,build,reconcile,draft,entryFrom,migrateV1,filterTickets,facetCounts,groupByMonth,swatch};
});
