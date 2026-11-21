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

// 空存储：所有观影都是待制作
let built=T.build(list,{},base);
assert.equal(built.tickets.length,0);assert.equal(built.pending.length,4);
assert.equal(built.pending[0].view.d,'2026-11-08');

// 一键生成：只存 {t}，票面字段全部推导
const store={};built.pending.forEach(x=>{store[x.key]={t:5};});
built=T.build(list,S.cleanTix(store),base);
assert.equal(built.tickets.length,4);assert.equal(built.pending.length,0);
const second=built.tickets.find(r=>r.key==='a|2026-11-08');
assert.equal(second.time,'19:30');assert.equal(second.venue,'麻雀部落');assert.equal(second.format,'4K 数字');assert(second.linked);
assert.equal(second.programme,'2026 吴天明电影展');
assert.equal(built.tickets[0].date,'2026-11-08');                       // 新 → 旧
// 默认款式按票根键固定，不需要存储
assert.deepStrictEqual(T.build(list,S.cleanTix(store),base).tickets.map(r=>T.packLook(r.look)),built.tickets.map(r=>T.packLook(r.look)));

// 编辑：只存和推导值不同的字段
const edited={...second,seat:'5排8座',hall:'1号厅',venue:'麻雀部落电影文化空间',look:T.randomLook(second),crop:30,art:'https://sparrowcinema.github.io/SparrowTribe/posters/a.jpg'};
const entry=T.entryFrom(edited,{...base('a',list.find(x=>x.key==='a|2026-11-08').view,'2026-11-08'),id:'a|2026-11-08'},9);
assert.deepStrictEqual(Object.keys(entry).sort(),['c','l','st','t','vn']);   // 同一张海报（网址只是写法不同）不存
assert(JSON.stringify(entry).length<120);
store['a|2026-11-08']=entry;
const again=T.build(list,S.cleanTix(store),base).tickets.find(r=>r.key==='a|2026-11-08');
assert.equal(again.seat,'5排8座');assert.equal(again.venue,'麻雀部落电影文化空间');assert.equal(again.crop,30);assert.equal(T.packLook(again.look),T.packLook(edited.look));
// 改回推导值后不再存这个字段
assert(!('vn' in T.entryFrom({...again,venue:'麻雀部落'},{...base('a',{k:'k1',d:'2026-11-08'},'2026-11-08'),id:'a|2026-11-08'},10)));

// 移出：留删除标记，这次观影回到待制作
store['b|2026-10-20']={del:1,t:11};
built=T.build(list,S.cleanTix(store),base);
assert.equal(built.tickets.length,3);assert.deepStrictEqual(built.pending.map(x=>x.key),['b|2026-10-20']);

// 手工票根（没有观影记录）照常显示；片库里没有的影片跳过
store['b|2025-05-01']={t:12,tm:'14:00',vn:'百老汇影城'};store['zz|2025-01-01']={t:1};
built=T.build(list,S.cleanTix(store),base);
const custom=built.tickets.find(r=>r.key==='b|2025-05-01');
assert(custom&&!custom.linked);assert.equal(custom.time,'14:00');assert.equal(custom.venue,'百老汇影城');assert.equal(custom.date,'2025-05-01');
assert(!built.tickets.some(r=>r.filmId==='zz'));

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
const afterMigration=T.build(list,migrated,base);
assert.equal(afterMigration.tickets.length,2);assert.equal(afterMigration.pending.length,3);

// 筛选与分组
const rows=T.build(list,S.cleanTix(store),base).tickets;
assert.equal(T.filterTickets(rows,{text:'雨果'}).length,1);
assert.equal(T.filterTickets(rows,{programme:['2026 吴天明电影展']}).length,3);
assert.equal(T.filterTickets(rows,{programme:['2026 吴天明电影展'],venue:['百老汇影城']}).length,0);
assert.equal(T.filterTickets(rows,{year:'2025'}).length,1);
const counts=T.facetCounts(rows);assert.deepStrictEqual(counts.year.map(x=>x.value),['2026','2025']);
assert.deepStrictEqual(T.groupByMonth(rows).map(g=>[g.id,g.rows.length]),[['2026-11',3],['2025-05',1]]);

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

// 规模：5000 张一键生成后的存储大小与推导耗时（小程序单个存储项上限 1MB）
const many={},manyFilms={};
for(let i=0;i<5000;i++){const id='film-'+(i%900),d='20'+(20+(i%9))+'-'+String(1+i%12).padStart(2,'0')+'-'+String(1+i%28).padStart(2,'0');manyFilms[id]=1;many[id]=many[id]||{d,r:0,k:'',t:1,v:[]};many[id].v.push({d,r:0,k:''});}
Object.values(many).forEach(r=>{r.v.sort((a,b)=>a.d.localeCompare(b.d));r.d=r.v[r.v.length-1].d;});
const big=T.viewings(many,G.views,()=>true),bigStore={};big.forEach(x=>{bigStore[x.key]={t:1700000000000};});
const bigBase=(id,view,date)=>({filmId:id,title:'影片'+id,programmeId:'p1',programme:'专题',date,time:'19:30',venue:'影院',hall:'1号厅',city:'杭州',format:'2K',art:'',arts:[]});
const t0=Date.now(),bigBuilt=T.build(big,S.cleanTix(bigStore),bigBase),ms=Date.now()-t0;
const bytes=Buffer.byteLength(JSON.stringify(bigStore));
assert(big.length>=4000,'many viewings');assert.equal(bigBuilt.tickets.length,big.length);
assert(bytes<320*1024,'store too big: '+bytes);
// 都换过款式、填了座位也远低于 1MB
big.forEach(x=>{bigStore[x.key]={t:1700000000000,l:'burgundy.holo.cotton.rosette',st:'12排18座'};});
const fullBytes=Buffer.byteLength(JSON.stringify(bigStore));assert(fullBytes<600*1024,'customised store too big: '+fullBytes);
// 大票根墙 / 密排拼图的画布尺寸不超过 iOS 约 1670 万像素上限
for(const n of [1,4,12,13,48,96,180]){const l=T.wallLayout(n);assert(l.width*l.height<16.7e6,'canvas '+n);assert.equal(l.rects.length,n);}
assert(T.wallLayout(180,1440).width<=1440);
console.log(`PASS: ticket album keys, derivation, diff storage, migration, filters, sync/backup (${big.length} tickets: ${Math.round(bytes/1024)}KB default / ${Math.round(fullBytes/1024)}KB customised, build ${ms}ms).`);
