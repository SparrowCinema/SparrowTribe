// 票根收藏册数据层（shared/tickets.js + shared/psync.js 的 tix）：键、推导、差异存储、迁移、筛选、同步合并、备份、规模。
const assert=require('assert'),T=require('../shared/tickets.js'),S=require('../shared/psync.js'),B=require('../shared/profile-backup.js'),G=require('../shared/growth.js');

const films={a:{cn:'坠落的审判',o:'Anatomy of a Fall',prog:'p1'},b:{cn:'阿黛尔·雨果的故事',prog:'p2'}};
const shows={k1:{t:'19:30',venue:'麻雀部落',hall:'1号厅',city:'杭州',p:'p1'}};
const progs={p1:'2026 吴天明电影展',p2:'风格万相'};
function base(filmId,view,date){
  const f=films[filmId];if(!f)return null;const s=view&&shows[view.k];
  return {filmId,title:f.cn,subtitle:f.o||'',programmeId:(s&&s.p)||f.prog,programme:progs[(s&&s.p)||f.prog],date,time:s?s.t:'',venue:s?s.venue:'',hall:s?s.hall:'',city:s?s.city:'',
    format:view&&view.f?G.FMT[view.f].zh:'4K修复',art:'posters/'+filmId+'.jpg',arts:['posters/'+filmId+'.jpg','https://example.org/'+filmId+'-still.jpg']};
}
const watched={
  a:{d:'2026-11-08',r:8,k:'k1',t:1,v:[{d:'2026-11-01',r:6,k:''},{d:'2026-11-08',r:8,k:'k1',f:'4k'},{d:'2026-11-08',r:9,k:''}]},
  b:{d:'2026-10-20',r:0,k:'',t:1},
  gone:{d:'2026-10-01',r:0,k:'',t:1},
  del:{del:1,t:3}
};
const list=T.viewings(watched,G.views,id=>!!films[id]);
assert.deepStrictEqual(list.map(x=>x.key).sort(),['a|2026-11-01','a|2026-11-08','a|2026-11-08|2','b|2026-10-20']);

// 空存储：每次观影一项待制作（2026-11-22 起每次观影一张，重看也有自己的票根）
let built=T.build(list,{},base);
assert.equal(built.tickets.length,0);assert.deepStrictEqual(built.pending.map(x=>x.key),['a|2026-11-08','a|2026-11-08|2','a|2026-11-01','b|2026-10-20']);

// 一键生成：只存 {t}，票面字段全部推导
const store={};built.pending.forEach(x=>{store[x.key]={t:5};});
built=T.build(list,S.cleanTix(store),base);
assert.equal(built.tickets.length,4);assert.equal(built.pending.length,0);assert.equal(built.hidden,0);
assert.equal(built.tickets.find(r=>r.filmId==='a').views,3);
assert.deepStrictEqual(built.tickets.filter(r=>r.filmId==='a').map(r=>r.nth).sort(),[1,2,3]);
const second=built.tickets.find(r=>r.key==='a|2026-11-08');
assert.equal(second.time,'19:30');assert.equal(second.venue,'麻雀部落');assert.equal(second.format,'4K 数字');assert(second.linked);
assert.equal(second.programme,'2026 吴天明电影展');
assert.equal(built.tickets[0].date,'2026-11-08');                       // 新 → 旧
// 默认款式按票根键固定，不需要存储
assert.deepStrictEqual(T.build(list,S.cleanTix(store),base).tickets.map(r=>T.packLook(r.look)),built.tickets.map(r=>T.packLook(r.look)));

// 编辑：只存和推导值不同的字段
const edited={...second,seat:'5排8座',hall:'1号厅',venue:'麻雀部落电影文化空间',look:T.randomLook(second),crop:30,art:'https://sparrowcinema.github.io/SparrowTribe/posters/a.jpg'};
const entry=T.entryFrom(edited,{...base('a',list.find(x=>x.key==='a|2026-11-08').view,'2026-11-08'),id:'a|2026-11-08'},9);
assert.deepStrictEqual(Object.keys(entry).filter(k=>k!=='x').sort(),['c','l','st','t','vn']);
// 工艺组合（2026-11-22）：随机换款连工艺组合一起换，和默认不同时存在 x；默认组合按票根键固定、不存
assert(!('x' in entry) || /^[sgch]{0,2}-[0urokbdwpqmlinacefghjstxyz][urokbdwpqmlinacefghjstxyz]?[Bv]{0,2}$/.test(entry.x),'craft code is stored in a valid form');
assert.equal(entry.x===undefined,edited.look.craft===T.build(list,{},base).tickets.find(r=>r.key===edited.key)?.look.craft);
{
  const k='a|2026-11-08',store1=S.cleanTix({[k]:{t:5,x:'gs-uBv'}}),row=T.build(list,store1,base).tickets.find(r=>r.key===k);
  assert.equal(row.look.craft,'gs-uBv','stored craft is read back');
  assert.deepEqual(T.parseCraft('gs-uBv'),{foil:['glitter','sense'],art:'uv',back:'uv',braille:true,vde:true});
  assert.deepEqual(T.parseCraft('bad'),{foil:[],art:null,back:null,braille:false,vde:false},'invalid codes fall back to no extras');
  assert.equal(S.cleanTixEntry({t:1,x:'zz-q'}).x,undefined,'sync drops malformed craft codes');
  assert.match(T.craftLabel({finish:'gold',craft:'g-rv'}),/^香槟金箔 \+ 金葱闪粉 \+ 海报隐形轮廓光油 \+ 背面隐形环形扭索 \+ 日期可变数据烫印$/);
  // 稳定随机：同一张票根每次一样，不同票根分散在各种组合里
  const codes=new Set();for(let i=0;i<400;i++)codes.add(T.sanitize({filmId:'f'+i,title:'t',date:'2026-11-08',id:'f'+i+'|2026-11-08'}).look.craft);
  assert.equal(T.sanitize({filmId:'f1',title:'t',date:'2026-11-08',id:'f1|2026-11-08'}).look.craft,T.sanitize({filmId:'f1',title:'t',date:'2026-11-08',id:'f1|2026-11-08'}).look.craft);
  assert(codes.size>=120,'400 tickets spread over many craft combinations: '+codes.size);
  // 盲盒搭配规则：底箔和配色冷暖相配；显眼增效（闪粉 / 水晶 / 全息纹理）最多一种，底箔本身显眼就不再加；海报隐形工艺每张都有
  const showy={g:'glitter',c:'crystal',h:'cast'};
  for(let i=0;i<600;i++){
    const look=T.sanitize({filmId:'f'+i,title:'t',date:'2026-11-08',id:'f'+i+'|2026-11-0'+(i%9+1),programmeId:['hainan-2026','golden-horse-63','cinema-2026','sparrow-space','wu-tianming'][i%5],programme:['2026海南岛国际电影节','2026第63届金马影展','2026院线新片','麻雀部落电影空间','2026 吴天明电影展'][i%5]}).look;
    const [foil,rest]=look.craft.split('-'),hits=[...foil].filter(c=>showy[c]);
    assert(hits.length<=1,'at most one showy enhancement: '+look.craft);
    if(['glitter','crystal','cast'].includes(look.finish))assert.equal(hits.length,0,'no showy enhancement on a showy finish: '+look.finish+' '+look.craft);
    assert(rest[0]!=='0','every ticket carries an invisible poster craft');
  }
  // 同一部电影不同日期看的票根，盲盒各不相同
  const a=T.sanitize({filmId:'f1',title:'t',date:'2026-11-08',id:'f1|2026-11-08',programmeId:'hainan-2026',programme:'2026海南岛国际电影节'}).look,b=T.sanitize({filmId:'f1',title:'t',date:'2026-11-20',id:'f1|2026-11-20',programmeId:'hainan-2026',programme:'2026海南岛国际电影节'}).look;
  assert.notEqual(T.lookSig(a),T.lookSig(b),'rewatching opens a different blind box');
  // 海报与背面的隐形工艺各自独立（25 × 25）；旧编码没有背面字母时背面跟海报
  assert.deepEqual(T.parseCraft('gs-uaBv'),{foil:['glitter','sense'],art:'uv',back:'argyle',braille:true,vde:true});
  assert.equal(T.parseCraft('-r').back,'rim','old codes: back follows the poster craft');
  const combos=new Set(),pairs=new Set();
  for(let i=0;i<1000;i++){const l=T.sanitize({filmId:'f'+i,title:'t',date:'2026-11-08',id:'f'+i+'|2026-11-08',programmeId:'hainan-2026',programme:'2026海南岛国际电影节'}).look;combos.add(T.lookSig(l));const c=T.parseCraft(l.craft);pairs.add(c.art+'/'+c.back);}
  assert(combos.size>=950,'1000 tickets of one festival are almost all different: '+combos.size);
  assert(pairs.size>=300,'poster × back invisible crafts spread widely: '+pairs.size);
}   // 同一张海报（网址只是写法不同）不存
assert(JSON.stringify(entry).length<120);
store['a|2026-11-08']=entry;
// 每次观影一张（2026-11-22 起）：同一部电影其他观影的票根也都显示，nth 是第几次观影
store['a|2026-11-01']={t:6};store['a|2026-11-08|2']={t:7};
built=T.build(list,S.cleanTix(store),base);
const aKeys=built.tickets.filter(r=>r.filmId==='a').map(r=>r.key).sort();
assert.equal(built.tickets.filter(r=>r.filmId==='a').length,list.filter(x=>x.filmId==='a'&&store[x.key]).length,'every viewing with a ticket is shown');
assert(built.tickets.filter(r=>r.filmId==='a').every(r=>r.views===3&&r.nth>=1&&r.nth<=3));
assert.equal(built.hidden,list.some(x=>x.key==='a|2026-11-01')?0:1);
assert(store['a|2026-11-01']&&store['a|2026-11-08|2']);
const again=T.build(list,S.cleanTix(store),base).tickets.find(r=>r.key==='a|2026-11-08');
assert.equal(again.seat,'5排8座');assert.equal(again.venue,'麻雀部落电影文化空间');assert.equal(again.crop,30);assert.equal(T.packLook(again.look),T.packLook(edited.look));
// 改回推导值后不再存这个字段
assert(!('vn' in T.entryFrom({...again,venue:'麻雀部落'},{...base('a',{k:'k1',d:'2026-11-08'},'2026-11-08'),id:'a|2026-11-08'},10)));

// 移出：留删除标记，这次观影回到待制作
store['b|2026-10-20']={del:1,t:11};
built=T.build(list,S.cleanTix(store),base);
assert.equal(built.tickets.length,3);assert.deepStrictEqual(built.pending.map(x=>x.key),['b|2026-10-20']);

// 不对应观影记录的票根（改过观影日期、旧版迁移、手工新建）：build 不显示，reconcile 挪到这部电影最近一次还没有票根的观影上
store['b|2025-05-01']={t:12,tm:'14:00',vn:'百老汇影城'};store['zz|2025-01-01']={t:1};
built=T.build(list,S.cleanTix(store),base);
assert(!built.tickets.some(r=>r.key==='b|2025-05-01'||r.filmId==='zz'));assert.equal(built.hidden,2);
const moves=T.reconcile(list,S.cleanTix(store),20);
assert.deepStrictEqual(Object.keys(moves).sort(),['b|2025-05-01','b|2026-10-20']);assert(moves['b|2025-05-01'].del);
Object.assign(store,moves);
built=T.build(list,S.cleanTix(store),base);
const custom=built.tickets.find(r=>r.filmId==='b');
assert(custom&&custom.linked);assert.equal(custom.key,'b|2026-10-20');assert.equal(custom.time,'14:00');assert.equal(custom.venue,'百老汇影城');
assert.equal(built.tickets.length,4);assert.equal(built.pending.length,0);
assert.equal(T.reconcile(list,S.cleanTix(store),21),null,'second pass is a no-op');
// 这部电影的观影都已有票根时不挪；还有没做票根的观影就挪到最近的那次；用户后来亲手移出的不挪回
assert.equal(T.reconcile(list,{'a|2026-11-08':{t:1},'a|2026-11-08|2':{t:1},'a|2026-11-01':{t:1},'a|2020-01-01':{t:2}},3),null);
assert.deepStrictEqual(Object.keys(T.reconcile(list,{'a|2026-11-08':{t:1},'a|2020-01-01':{t:2}},3)).sort(),['a|2020-01-01','a|2026-11-08|2']);
assert.equal(T.reconcile(list,{'b|2026-10-20':{del:1,t:9},'b|2020-01-01':{t:2}},10),null);

// 非法内容被清洗
const dirty=S.cleanTix({'a|2026-13-99':{t:1},'bad key':{t:1},'a|2026-11-01':{t:1,tm:'7pm',a:'javascript:alert(1)',l:'x.y',c:50,st:'A'.repeat(99)},__proto__:{t:1}});
assert.deepStrictEqual(Object.keys(dirty),['a|2026-13-99','a|2026-11-01']);  // 日期格式合法即可（不存在的日子不会对上观影记录）
assert.deepStrictEqual(dirty['a|2026-11-01'],{t:1,st:'A'.repeat(36)});

// 旧版整条记录迁移：同影片同一天关联到观影记录，否则成为手工票根；款式、座位保留
const v1=T.read(JSON.stringify([
  {filmId:'a',title:'坠落的审判',date:'2026-11-08',time:'19:30',venue:'麻雀部落',hall:'1号厅',seat:'3排1座',programmeId:'p1',programme:'2026 吴天明电影展',look:{palette:'jade',finish:'gold',texture:'kraft',motif:'waves'},savedAt:7},
  {filmId:'b',title:'阿黛尔·雨果的故事',date:'2024-02-02',time:'20:00',venue:'某影院',savedAt:8},
  {filmId:'gone',title:'下架影片',date:'2023-01-01',venue:'X',savedAt:9}
]));
const migrated=T.migrateV1(v1,list,base);
assert.deepStrictEqual(Object.keys(migrated).sort(),['a|2026-11-08','b|2024-02-02','gone|2023-01-01']);
assert.equal(migrated['a|2026-11-08'].st,'3排1座');assert.equal(migrated['a|2026-11-08'].l,'jade.gold.kraft.waves');assert(!('vn' in migrated['a|2026-11-08']));
assert.equal(migrated['b|2024-02-02'].vn,'某影院');assert.equal(migrated['gone|2023-01-01'].vn,'X');
const afterMigration=T.build(list,{...migrated,...T.reconcile(list,migrated,30)},base);
assert.equal(afterMigration.tickets.length,2);assert.equal(afterMigration.pending.length,2);   // b 的旧票根挪到 b 的观影上；a 另外两次观影待制作；下架影片不显示

// 筛选与分组
const rows=T.build(list,S.cleanTix(store),base).tickets;
assert.equal(T.filterTickets(rows,{text:'雨果'}).length,1);
assert.equal(T.filterTickets(rows,{programme:['2026 吴天明电影展']}).length,3);   // 同一部电影的三次观影各一张
assert.equal(T.filterTickets(rows,{programme:['2026 吴天明电影展'],venue:['百老汇影城']}).length,0);
assert.equal(T.filterTickets(rows,{year:'2026'}).length,4);
const counts=T.facetCounts(rows);assert.deepStrictEqual(counts.year.map(x=>x.value),['2026']);
assert.deepStrictEqual(T.groupByMonth(rows).map(g=>[g.id,g.rows.length]),[['2026-11',3],['2026-10',1]]);

// 同步合并：逐张取较新；旧版档案没有 tix 时不丢本机票根
const m=S.merge({v:1,tix:{'a|2026-11-01':{t:1,st:'A'}}},{v:1,tix:{'a|2026-11-01':{t:2,st:'B'},'b|2026-10-20':{del:1,t:3}}});
assert.equal(m.tix['a|2026-11-01'].st,'B');assert(m.tix['b|2026-10-20'].del);
assert.equal(S.merge({v:1,tix:{'a|2026-11-01':{t:1}}},{v:1,watched:{}}).tix['a|2026-11-01'].t,1);

// 完整备份带票根；导入合并；清空云端时票根也留删除标记
const profile={v:1,watched:{a:{d:'2026-11-01',r:0,k:'',t:1}},holder:{n:'',t:0},photo:{d:'',t:0},picks:{k:[],t:0},tix:{'a|2026-11-01':{t:4,st:'7排'}}};
const pack=B.encode(profile,1),back=B.decode(JSON.parse(JSON.stringify(pack)));
assert.equal(back.tix['a|2026-11-01'].st,'7排');
assert.equal(B.restore(S.clean({}),pack,50).tix['a|2026-11-01'].t,50);
assert.throws(()=>B.decode({...pack,profile:{...pack.profile,tix:{'a|2026-11-01':{t:1},'bad':{t:1}}}}));
assert(S.merge(profile,B.empty(profile,100)).tix['a|2026-11-01'].del);

// 旧客户端保存的手绘标记仍可读写和备份，当前票面始终以手绘渲染。
const artRow=rows.find(x=>x.filmId==='a');
assert.equal(artRow.sketch,false);
const drawn=T.entryFrom({...artRow,sketch:true},base('a',null,artRow.date),110);
assert.equal(drawn.sk,1);
const drawnStore={[artRow.key]:drawn};
assert.equal(T.build(list,drawnStore,base).tickets[0].sketch,true);
assert.equal(B.decode(JSON.parse(JSON.stringify(B.encode({...profile,tix:drawnStore},110)))).tix[artRow.key].sk,1);
const original=T.entryFrom({...artRow,sketch:false},base('a',null,artRow.date),111);
assert.equal(S.mergeTix(drawnStore,{[artRow.key]:original})[artRow.key].sk,undefined);
assert.equal(S.cleanTixEntry({t:110,sk:'yes'}).sk,undefined);

const Sketch=require('../shared/ticket-sketch.js');
const patch=new Uint8ClampedArray(12*8*4);
for(let i=0;i<patch.length;i+=4)patch.set(i%48<24?[194,62,56,255]:[48,142,196,255],i);
const raster=Sketch.stylize(patch,12,8,48,32);
assert.equal(raster.length,48*32*4);
assert.deepStrictEqual(raster,Sketch.stylize(patch,12,8,48,32));
assert(new Set(raster.filter((_,i)=>i%4===0)).size>8,'pencil strokes introduce pigment variation');
assert(raster.every((value,i)=>i%4!==3||value===255));
const renders=Sketch.styles.map(({id})=>{
  assert.equal(Sketch.normalize(id),id);
  const painted=Sketch.stylize(patch,12,8,48,32,id);
  assert.equal(painted.length,raster.length);
  assert(painted.every((value,i)=>i%4!==3||value===255));
  assert.deepStrictEqual(painted,Sketch.stylize(patch,12,8,48,32,id));
  return Buffer.from(painted).toString('base64');
});
assert.equal(Sketch.normalize('unknown'),'news-dots');
assert.equal(new Set(renders).size,Sketch.styles.length,'each style has distinct pixels');
const doodle=Sketch.stylize(patch,12,8,48,32,'doodle');
const hasInk=doodle.some((value,i)=>i%4===0&&value<40&&doodle[i+1]<40&&doodle[i+2]<40);
assert(hasInk,'comic panel outlines strongly contrasting colors');
assert.deepStrictEqual(Sketch.styles.map(x=>x.id),['news-dots','crayon','kid-crayon','doodle','watercolor','pop-dots','memphis','cmyk-dots','crt','ccd','projector']);
// 已删除的风格换成相近的一款
assert.deepStrictEqual(['woodcut','blue-ink','cartoon','nope'].map(Sketch.normalize),['crayon','watercolor','pop-dots','news-dots']);
assert.equal(Sketch.readFilmStyles(()=>JSON.stringify({'old-film':'cartoon'})).get('old-film'),'pop-dots');
// 影片的覆盖值与收藏册默认分开，清除覆盖后重新使用默认值。
const artStorage=new Map([[Sketch.storageKey,'watercolor']]);
const readArt=key=>artStorage.get(key),writeArt=(key,value)=>artStorage.set(key,value);
assert.equal(Sketch.filmStyleOptions[0].id,'');
assert.equal(Sketch.saveFilmStyle(readArt,writeArt,'first-film','doodle').get('first-film'),'doodle');
assert.equal(Sketch.saveFilmStyle(readArt,writeArt,'second-film','memphis').get('first-film'),'doodle');
assert.equal(Sketch.saveFilmStyle(readArt,writeArt,'first-film','').get('second-film'),'memphis');
assert.equal(Sketch.readFilmStyles(readArt).has('first-film'),false);
assert.equal(readArt(Sketch.storageKey),'watercolor');
assert.equal(Sketch.saveFilmStyle(readArt,writeArt,'second-film','invalid-style'),null);
assert.equal(Sketch.saveFilmStyle(()=>{throw Error('storage read failed');},writeArt,'third-film','doodle'),null);
assert.equal(Sketch.readFilmStyles(readArt).get('second-film'),'memphis');

// 波普网点：亮色块印网点（白底 + 彩色点），有黑色勾线；孟菲斯涂鸦：糖果色块上叠花纹，不出现大片纯黑
const disc=new Uint8ClampedArray(40*30*4);for(let y=0;y<30;y++)for(let x=0;x<40;x++){const i=(y*40+x)*4,inside=(x-20)**2+(y-15)**2<64;disc.set(inside?[40,60,150,255]:[250,200,210,255],i);}
const pop=Sketch.stylize(disc,40,30,200,150,'pop-dots');
assert(pop.some((v,i)=>i%4===0&&v<40&&pop[i+1]<40&&pop[i+2]<40),'pop art draws ink outlines');
assert(pop.some((v,i)=>i%4===0&&v>250&&pop[i+1]>245)&&pop.some((v,i)=>i%4===0&&v===255&&pop[i+1]===138),'pop art prints dots on white');
const mem=Sketch.stylize(sat0(),40,30,200,150,'memphis');
const blackShare=mem.filter((v,i)=>i%4===0&&v<40&&mem[i+1]<40&&mem[i+2]<40).length/(200*150);
assert(blackShare<.3,'memphis keeps black to outlines and patterns: '+blackShare);
assert(new Set(Array.from({length:200*150},(_,i)=>mem[i*4]+','+mem[i*4+1]+','+mem[i*4+2])).size>=4,'memphis mixes several candy colours');
// 印刷网点三款：四色网点有青、品、黄三种油墨的点并留出纸白；老电视有扫描线和暗边、CCD 有橙色日期戳；报纸网点只有黑墨，纸是泛黄的新闻纸
{const grad=new Uint8ClampedArray(40*30*4);for(let i=0;i<grad.length;i+=4){const p=i/4,x=p%40,y=Math.floor(p/40);grad.set([200-x*4,80+y*4,60+x*3,255],i);}
 const px=(a,f)=>Array.from({length:a.length/4},(_,i)=>[a[i*4],a[i*4+1],a[i*4+2]]).filter(f).length;
 const cm=Sketch.stylize(grad,40,30,200,150,'cmyk-dots');
 assert(px(cm,([r,g,b])=>r>245&&g>240&&b>230)>800,'cmyk halftone leaves paper white between dots');
 assert(px(cm,([r,g,b])=>b>150&&r<90)>100&&px(cm,([r,g,b])=>r>180&&g<90)>100,'cmyk prints cyan and magenta dots');
 assert.equal(Sketch.normalize('riso'),'cmyk-dots','removed riso falls back to CMYK dots');
 assert.equal(Sketch.normalize('lenticular'),'crt','removed 3D lenticular falls back to old TV');
 const tv=Sketch.stylize(grad,40,30,200,150,'crt'),row=y=>Array.from({length:200},(_,x)=>tv[(y*150*0+y*200+x)*4+1]).reduce((a,b)=>a+b,0);
 assert(tv[0]<20&&tv[1]<20,'old TV has a dark rounded bezel corner');
 assert(Math.max(...[60,61,62,63].map(row))-Math.min(...[60,61,62,63].map(row))>300,'old TV shows scanlines');
 const pj=Sketch.stylize(grad,40,30,200,150,'projector'),lum=i=>pj[i*4]+pj[i*4+1]+pj[i*4+2];
 assert(lum(75*200+100)>lum(3*200+3)*3,'projector has a bright centre and dark gate corners');
 assert(Sketch.stylize(grad,40,30,200,150,'projector').every((v,i)=>v===pj[i]),'projector scratches are stable for the same poster');
 const cd=Sketch.stylize(grad,40,30,200,150,'ccd');
 assert(Array.from({length:200*150},(_,i)=>i).some(i=>cd[i*4]>240&&cd[i*4+1]>110&&cd[i*4+1]<170&&cd[i*4+2]<90),'CCD prints an orange date stamp');
 const nw=Sketch.stylize(grad,40,30,200,150,'news-dots');assert(px(nw,([r,g,b])=>Math.max(r,g,b)-Math.min(r,g,b)>40)===0,'newsprint is a single neutral ink');}
function sat0(){const a=new Uint8ClampedArray(40*30*4);for(let i=0;i<a.length;i+=4){const p=i/4,x=p%40,y=Math.floor(p/40);a.set(x<14?[30,30,40,255]:x<27?[220,90,70,255]:y<15?[250,240,220,255]:[70,160,200,255],i);}return a;}
const sat=new Uint8ClampedArray(40*30*4);for(let i=0;i<sat.length;i+=4)sat.set(i%160<80?[200,40,40,255]:[40,90,200,255],i);
const kid=Sketch.stylize(sat,40,30,200,150,'kid-crayon'),flat=Sketch.stylize(sat,40,30,200,150,'doodle');
const pale=a=>a.filter((v,i)=>i%4===0&&Math.min(v,a[i+1],a[i+2])>140).length;
assert(pale(kid)>pale(flat)*1.5+50,'kid crayon leaves paper showing through the wax');
// 手绘风格随云端同步：两台设备各改各的，合并后逐项取较新；清除单片风格留删除标记；云端的旧名字按 ALIAS 换算
{
  const mem=()=>{const m=new Map();return {read:k=>m.has(k)?m.get(k):null,write:(k,v)=>m.set(k,v),m};};
  const A=mem(),B=mem();
  A.write(Sketch.storageKey,'memphis');Sketch.markArt(A.read,A.write,null,100);
  Sketch.saveFilmStyle(A.read,A.write,'film-a','pop-dots');Sketch.markArt(A.read,A.write,'film-a',110);
  Sketch.saveFilmStyle(B.read,B.write,'film-b','watercolor');Sketch.markArt(B.read,B.write,'film-b',120);
  B.write(Sketch.storageKey,'doodle');Sketch.markArt(B.read,B.write,null,90);
  const merged=S.mergeArt(Sketch.artSnapshot(A.read),Sketch.artSnapshot(B.read));
  assert.equal(merged.d.s,'memphis','newer album default wins');
  assert.deepStrictEqual(Object.keys(merged.f).sort(),['film-a','film-b']);
  assert.equal(Sketch.applyArt(B.read,B.write,merged),true);
  assert.equal(B.read(Sketch.storageKey),'memphis');assert.equal(Sketch.readFilmStyles(B.read).get('film-a'),'pop-dots');
  assert.equal(Sketch.applyArt(B.read,B.write,merged),false,'second apply changes nothing');
  // 在 A 上清除 film-a 的单片风格 → 删除标记传到 B
  Sketch.saveFilmStyle(A.read,A.write,'film-a','');Sketch.markArt(A.read,A.write,'film-a',130);
  const snapA=Sketch.artSnapshot(A.read);assert.deepStrictEqual(snapA.f['film-a'],{del:1,t:130});
  Sketch.applyArt(B.read,B.write,S.mergeArt(Sketch.artSnapshot(B.read),snapA));
  assert.equal(Sketch.readFilmStyles(B.read).has('film-a'),false);
  // 旧时间的云端数据不会覆盖本机较新的选择；已删除的风格名按 ALIAS 换算
  assert.equal(Sketch.applyArt(B.read,B.write,{d:{s:'woodcut',t:5},f:{'film-b':{s:'cartoon',t:5}}}),false);
  Sketch.applyArt(B.read,B.write,{f:{'film-c':{s:'cartoon',t:999}}});assert.equal(Sketch.readFilmStyles(B.read).get('film-c'),'pop-dots');
  // 档案清洗：随整份档案同步，旧档案没有 art 也不出错；备份恢复与清空
  const prof=S.clean({art:{d:{s:'memphis',t:3},f:{'x':{s:'pop-dots',t:4},'bad id!':{s:'x',t:1},'y':{del:1,t:2}}}});
  assert.deepStrictEqual(prof.art,{d:{s:'memphis',t:3},f:{x:{s:'pop-dots',t:4},y:{del:1,t:2}}});
  assert.deepStrictEqual(S.clean({}).art,{d:{s:'',t:0},f:{}});
  assert.deepStrictEqual(S.merge({},{art:prof.art}).art.f.x,{s:'pop-dots',t:4});
  const Backup=require('../shared/profile-backup.js');
  const restored=Backup.restore({},Backup.encode({art:prof.art}),500);assert.equal(restored.art.f.x.t,500);
  const wiped=Backup.empty({art:prof.art},600);assert.deepStrictEqual(wiped.art.f.x,{del:1,t:600});
}
const blocked=()=>({getContext:()=>({getImageData(){throw Error('pixels unavailable');}})});
assert.equal(Sketch.paint({}, {},50,{x:0,y:0,w:48,h:32},blocked,()=>{}),false);

// 详情、首页缩略图和导出使用同一种配图风格，背面不绘制配图。
const calls=[];
const image={width:270,height:405},gradient={addColorStop(){}};
const context=new Proxy({}, {get(target,key){
  if(key==='measureText')return text=>({width:text.length*8});
  if(key==='createLinearGradient'||key==='createRadialGradient')return ()=>gradient;
  return target[key]??(()=>{});
}});
const abovePaint=Sketch.paint;
try{
  const styled={...artRow,artStyle:'doodle'};
  Sketch.paint=(_surface,asset,_crop,_frame,_canvas,_cover,scale,style)=>{assert.equal(asset,image);calls.push({scale,style});return true;};
  T.draw(context,styled,'front',image,{x:0,y:0,w:630,h:1296});
  T.draw(context,styled,'front',image,{x:0,y:0,w:130,h:267});
  T.drawWall(context,[styled],'front',[image],'');
  T.draw(context,styled,'back',image,{x:0,y:0,w:630,h:1296});
  assert.equal(calls.length,3);
  assert(calls.every(call=>call.style==='doodle'));
  assert.equal(calls[0].scale,630/T.W);
  assert.equal(calls[1].scale,130/T.W);
}finally{Sketch.paint=abovePaint;}

// 规模：5000 张一键生成后的存储大小与推导耗时（小程序单个存储项上限 1MB）
const many={},manyFilms={};
for(let i=0;i<5000;i++){const id='film-'+(i%900),d='20'+(20+(i%9))+'-'+String(1+i%12).padStart(2,'0')+'-'+String(1+i%28).padStart(2,'0');manyFilms[id]=1;many[id]=many[id]||{d,r:0,k:'',t:1,v:[]};many[id].v.push({d,r:0,k:''});}
Object.values(many).forEach(r=>{r.v.sort((a,b)=>a.d.localeCompare(b.d));r.d=r.v[r.v.length-1].d;});
const big=T.viewings(many,G.views,()=>true),bigStore={};big.forEach(x=>{bigStore[x.key]={t:1700000000000};});
const bigBase=(id,view,date)=>({filmId:id,title:'影片'+id,programmeId:'p1',programme:'专题',date,time:'19:30',venue:'影院',hall:'1号厅',city:'杭州',format:'2K',art:'',arts:[]});
const t0=Date.now(),bigBuilt=T.build(big,S.cleanTix(bigStore),bigBase),ms=Date.now()-t0;
const bytes=Buffer.byteLength(JSON.stringify(bigStore));
assert(big.length>=4000,'many viewings');assert.equal(bigBuilt.tickets.length,big.length,'one ticket per viewing');
assert(bytes<320*1024,'store too big: '+bytes);
// 都换过款式、填了座位也远低于 1MB
big.forEach(x=>{bigStore[x.key]={t:1700000000000,l:'burgundy.holo.cotton.rosette',st:'12排18座'};});
const fullBytes=Buffer.byteLength(JSON.stringify(bigStore));assert(fullBytes<600*1024,'customised store too big: '+fullBytes);
// 大票根墙 / 密排拼图的画布尺寸不超过 iOS 约 1670 万像素上限
for(const n of [1,4,12,13,48,96,180]){const l=T.wallLayout(n);assert(l.width*l.height<16.7e6,'canvas '+n);assert.equal(l.rects.length,n);}
assert(T.wallLayout(180,1440).width<=1440);
console.log(`PASS: ticket album keys, derivation, diff storage, migration, filters, sync/backup (${big.length} tickets: ${Math.round(bytes/1024)}KB default / ${Math.round(fullBytes/1024)}KB customised, build ${ms}ms).`);
