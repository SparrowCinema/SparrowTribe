// 票根册查找（2026-11-23）：典藏玩法筛选、只看某部电影、搜索与分面组合。
const assert=require('assert'),T=require('../shared/tickets.js');
const row=(id,o)=>Object.assign({key:id+'|2026-11-0'+(o.d||1),filmId:id,title:o.title||id,subtitle:'',date:'2026-11-0'+(o.d||1),venue:o.venue||'浙影',programme:o.prog||'金马',city:'杭州',format:'',director:'',hall:'',serial:'SP26-'+id,
  checkedIn:0,autographs:[],edition:-1,hidden:false,limited:false,slam:''},o);
const rows=[
  row('a',{checkedIn:1795000000000,autographs:[{name:'毕赣'}],limited:true}),
  row('b',{edition:63,d:2}),
  row('c',{hidden:true,slam:'programme',d:3}),
  row('a',{d:4,key:'a|2026-11-04',title:'a'}),
  row('d',{d:5,prog:'院线'})
];
assert.deepStrictEqual(T.badgeKeys(rows[0]),['checkin','autograph','limited']);
assert.deepStrictEqual(T.badgeKeys(rows[4]),[]);
// 同一组里是「或」
assert.strictEqual(T.filterTickets(rows,{badge:['checkin','sealed']}).length,2);
assert.strictEqual(T.filterTickets(rows,{badge:['hidden']})[0].filmId,'c');
// 和其他分面是「且」
assert.strictEqual(T.filterTickets(rows,{badge:['slam'],programme:['院线']}).length,0);
// 只看某部电影：两次观影两张
assert.strictEqual(T.filterTickets(rows,{film:'a'}).length,2);
assert.strictEqual(T.filterTickets(rows,{film:'a',badge:['autograph']}).length,1);
// 搜索仍然可用
assert.strictEqual(T.filterTickets(rows,{text:'SP26-b'}).length,1);
// 计数：固定顺序、只列有票根的项、已选的 0 项保留
let c=T.facetCounts(rows);
assert.deepStrictEqual(c.badge.map(x=>x.value),['checkin','autograph','sealed','hidden','limited','slam']);
assert.strictEqual(c.badge.find(x=>x.value==='sealed').label,'已封版');
c=T.facetCounts(rows,{programme:['院线'],badge:['hidden']});
assert.deepStrictEqual(c.badge,[{value:'hidden',label:'隐藏款',count:0}]);
assert.strictEqual(T.facetCounts([row('x',{})]).badge.length,0);
// 旧调用（没有 badge / film）照旧
assert.strictEqual(T.filterTickets(rows,{}).length,5);
console.log('PASS: ticket find — collectible badges filter (or within, and across), single-film filter, search, counts.');
