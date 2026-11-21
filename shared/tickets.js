// Companion ticket artwork and data model, shared by the website and mini program.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SparrowTickets = factory();
})(typeof self === "undefined" ? this : self, function () {
"use strict";

const W=420, H=864, TEAR=698, TEETH=31, DEPTH=5, NOTCH=11;
const SOURCE={x:24,y:94,w:372,h:330};
const SANS='"PingFang SC","Microsoft YaHei",sans-serif';
const SERIF='"Songti SC","SimSun",serif';
const MONO='monospace';
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

const papers = {
  cotton:     {label:"细颗粒棉纸", kind:"grain", count:4200, inking:.07},
  silk:       {label:"日本绢纸", kind:"lines", step:4, angle:-.23, inking:.11},
  linen:      {label:"交织亚麻", kind:"grid", step:5, inking:.17},
  satin:      {label:"丝绒细砂", kind:"grain", count:7700, inking:.13},
  washi:      {label:"长纤维和纸", kind:"fiber", count:370, length:10, inking:.17},
  kraft:      {label:"复古牛皮卡", kind:"fiber", count:550, length:5, inking:.19, tint:"#b28452", warmth:.16},
  parchment:  {label:"暖调羊皮纸", kind:"cloud", count:34, inking:.24, tint:"#d3ac6c", warmth:.14},
  deckle:     {label:"版画粗棉纸", kind:"grain", count:3100, dot:2.1, inking:.15},
  leather:    {label:"荔枝压纹纸", kind:"cells", step:9, inking:.14},
  crosshatch: {label:"双斜纹纸", kind:"cross", step:6, inking:.12},
  ribbed:     {label:"拉丝竖纹纸", kind:"lines", step:6, angle:Math.PI/2, inking:.15},
  fleck:      {label:"再生星点纸", kind:"fiber", count:910, length:2.2, inking:.23},
  laid:       {label:"帘纹书纸", kind:"laid", step:5, inking:.14},
  frost:      {label:"霜面珠光卡", kind:"cloud", count:73, inking:.14, tint:"#e1eaf1", warmth:.22}
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
  festival: {palette:["burgundy","honey","ember","rust","peach","crimson"], finish:["holo","gold","copper","solar"], texture:["cotton","laid","parchment","deckle"], motif:["rosette","rays","arches"]},
  region: {palette:["jade","navy","cyan","teal","fern","cobalt"], finish:["silver","aurora","opal","pearl"], texture:["silk","washi","frost","linen"], motif:["waves","orbit","contour"]},
  theme: {palette:["violet","indigo","rose","iris","plum","cobalt"], finish:["prism","opal","cobalt","varnish"], texture:["linen","crosshatch","satin","leather"], motif:["facets","rays","orbit"]},
  venue: {palette:["moss","clay","olive","peach","sepia","rust"], finish:["copper","gold","varnish","matte"], texture:["kraft","washi","cotton","fleck"], motif:["arches","contour","frames"]},
  cinema: {palette:["ink","graphite","navy","lemon","sepia","indigo"], finish:["silver","matte","cobalt","pearl"], texture:["ribbed","frost","satin","fleck"], motif:["frames","rays","facets"]}
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

function teeth(surface, y, direction, inset) {
  const shoulder = 2.5;
  const pitch = (W - 2*shoulder) / TEETH;
  const start = direction > 0 ? shoulder : W-shoulder;
  surface.lineTo(start,y);
  for (let i = 0; i < TEETH; i += 1) {
    const x = start + direction*pitch*i;
    const step = direction*pitch;
    surface.bezierCurveTo(x+step*.22,y,x+step*.29,y+inset,x+step*.5,y+inset);
    surface.bezierCurveTo(x+step*.71,y+inset,x+step*.78,y,x+step,y);
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

function text(surface,StringValue,x,y,opts={}) {
  const {font=SANS,align="left",ink="#26241f",weight=500,max=364}=opts;
  const value=StringValue.replace(/\s+/gu," ").trim();
  let size=opts.size || 14;
  surface.font=`${weight} ${size}px ${font}`;
  const width=surface.measureText(value).width;
  if (width>max) size=Math.max(Math.min(23,size),size*max/width);
  surface.font=`${weight} ${size}px ${font}`;
  surface.textAlign=align;
  if (opts.relief) {
    surface.fillStyle=opts.relief;
    surface.fillText(value,x+1.7,y+2.4,max);
    surface.fillStyle=opts.light || "#f1c9a4";
    surface.fillText(value,x-.55,y-.65,max);
  }
  surface.fillStyle=ink;
  surface.fillText(value,x,y,max);
}

function rule(surface,y,ink,x=28,x2=W-28,dashed=false) {
  surface.save();
  if (dashed) surface.setLineDash([2.5,4]);
  surface.strokeStyle=ink;surface.lineWidth=.85;
  surface.beginPath();surface.moveTo(x,y);surface.lineTo(x2,y);surface.stroke();
  surface.restore();
}

function cropCover(surface,image,position) {
  const {x,y,w,h}=SOURCE;
  const iw=image.naturalWidth || image.width, ih=image.naturalHeight || image.height;
  if (!iw || !ih) return;
  const sw=Math.min(iw,ih*w/h), sh=Math.min(ih,iw*h/w);
  surface.drawImage(image,(iw-sw)*position/100,(ih-sh)*position/100,sw,sh,x,y,w,h);
}

// A small repeat tile keeps the pattern sharp without drawing thousands of dots per card.
const textureCaches=new WeakMap();
const TEXTURE_SIZE=120;
function paintTexture(ctx,material) {
  let seed=74323;
  const rng=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
  const kind=material.kind;
  if (kind==="grain" || kind==="fiber" || kind==="cloud") {
    const count=material.count;
    for (let i=0;i<count;i++) {
      const x=rng()*120,y=rng()*120,color=i%3 ? "#40322b" : "#fff1dd";
      if (kind==="fiber") {
        ctx.strokeStyle=color;ctx.lineWidth=.65;
        ctx.beginPath();ctx.moveTo(x,y);
        ctx.lineTo(x+(rng()-.5)*material.length,y+(rng()-.5)*material.length);ctx.stroke();
      } else if (kind==="cloud") {
        const r=5+rng()*10;
        const gradient=ctx.createRadialGradient(x,y,0,x,y,r);
        gradient.addColorStop(0,i%2 ? "#6c4a3955" : "#fff5dc75");gradient.addColorStop(1,"#a8978000");
        ctx.fillStyle=gradient;ctx.fillRect(x-r,y-r,r*2,r*2);
      } else {
        ctx.fillStyle=color;
        const width=material.dot || (count>5000 ? .8 : 1.2);
        ctx.fillRect(x,y,width,width*.82);
      }
    }
  } else if (kind==="cells") {
    for (let y=1;y<120;y+=material.step) for (let x=1;x<120;x+=material.step) {
      ctx.strokeStyle="#dbc3a9";ctx.lineWidth=.7;
      ctx.beginPath();ctx.ellipse(x+rng()*3,y+rng()*3,4,2.8,rng(),0,Math.PI*2);ctx.stroke();
    }
  } else {
    const angles={grid:[0,Math.PI/2],lines:[material.angle],cross:[Math.PI/4,-Math.PI/4],laid:[0]};
    for (const angle of angles[kind]) {
      ctx.save();ctx.translate(60,60);ctx.rotate(angle);
      for (let y=-120;y<=120;y+=material.step) {
        ctx.fillStyle="#fff2de";ctx.fillRect(-120,y,240,.9);
        ctx.fillStyle="#3c302b";ctx.fillRect(-120,y+1,240,.7);
      }
      ctx.restore();
    }
    if (kind==="laid") {
      ctx.fillStyle="#3c302b";
      for (let x=8;x<120;x+=24) ctx.fillRect(x,0,.8,120);
    }
  }
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
  surface.globalAlpha=material.inking;
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
    text(surface,year || "麻雀",W/2,295,{...centre,size:36,weight:700,font:year ? MONO : SERIF,max:132,relief:edge});
    const heading=(year && record.programme.startsWith(year) ? record.programme.slice(4).trim() : record.programme) || "我的观影收藏";
    text(surface,heading,W/2,511,{...centre,size:38,weight:700,font:SERIF,max:347,relief:edge,light:bright+"a0"});
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
    if (image) cropCover(surface,image,record.crop);
    else {
      surface.strokeStyle=foilGradient(surface,x,y,x+w,y+h,finish);surface.lineWidth=1;
      for (let i=0;i<6;i++) surface.strokeRect(x+24+i*9,y+24+i*9,w-48-i*18,h-48-i*18);
      text(surface,record.title,W/2,y+h/2,{align:"center",font:SERIF,size:30,weight:700,ink:bright,max:w-130});
    }
    surface.strokeStyle=foilGradient(surface,x,y+h,x+w,y,finish);
    surface.lineWidth=metal.width;surface.strokeRect(x-.8,y-.8,w+1.6,h+1.6);
    surface.lineWidth=.48;surface.strokeRect(x-3,y-3,w+6,h+6);
    text(surface,record.title,W/2,506,{size:55,font:SERIF,weight:700,align:"center",max:359,ink:accent,relief:accent+"c9"});
    if (record.subtitle && record.subtitle.toLowerCase()!==record.title.toLowerCase()) {
      text(surface,record.subtitle.toUpperCase(),W/2,538,{size:12,align:"center",ink:"#554b40"});
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
    text(surface,"SPARROW CINEMA",W/2,821,{size:10,font:MONO,align:"center",ink:accent});
  }
  if (light) previewSheen(surface,metal,side,light);
  surface.restore();
}

function wallLayout(count) {
  const columns=count===1 ? 1 : count<=4 ? 2 : count<=6 ? 3 : 4;
  const width=columns===1 ? 940 : 1580;
  const margin=64, gap=33, top=206, bottom=92;
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

function drawWall(surface,records,side,images,caption,createCanvas) {
  const layout=wallLayout(records.length);
  const {width,height,rects}=layout;
  const background=surface.createLinearGradient(0,0,width,height);
  background.addColorStop(0,"#383d35");background.addColorStop(1,"#1b231e");
  surface.fillStyle=background;surface.fillRect(0,0,width,height);
  text(surface,"麻雀观影护照",64,69,{size:22,ink:"#d6bd91",weight:650});
  text(surface,"我的票根收藏册",62,144,{size:58,font:SERIF,ink:"#f5ebd5",weight:700,max:width-125});
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
return {W,H,WALL_PAGE,options:labelOptions(),sanitize,read,sorted,defaults,randomLook,shineOf,draw,wallLayout,drawWall};
});
