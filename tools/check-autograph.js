// 映后嘉宾签名（2026-11-23）：缓存键、待取列表、写回缓存、挂到票根、票面绘制、缩略图缓存签名。
// 服务器只给现场认证过的票根签名（backend/tickets-autograph-v1.sql，本地 Postgres 测过：未签到的票根拿不到、密钥不对 / 坐标越界 / 非整数 / 空姓名都拒绝、可删除、表不可直接读）。
const assert=require('assert'),T=require('../shared/tickets.js');
const n1=T.serialOf('f1|2026-11-08',1),n2=T.serialOf('f2|2026-11-09',2),n3=T.serialOf('f3|2026-11-10',3);
const day=864e5,now=Date.parse('2026-11-23T12:00:00Z');
const rows=[
  {key:'f1|2026-11-08',filmId:'f1',showId:'s1',serial:n1,checkedIn:now-2*day},
  {key:'f2|2026-11-09',filmId:'f2',showId:'s2',serial:n2,checkedIn:0},                 // 没签到：不取
  {key:'f3|2026-11-10',filmId:'f3',showId:'',serial:n3,checkedIn:now-day}];            // 没场次：不取
assert.equal(T.autographKey(rows[0]),'f1|s1');assert.equal(T.autographKey(rows[1]),'');assert.equal(T.autographKey(rows[2]),'');
assert.deepStrictEqual(T.pendingAutograph(rows,{},now),[n1]);
// 服务器还没有签名：记空的，6 小时内不再取；6 小时后、签到 30 天内再取
let cache=T.applyAutograph({},rows,[n1],[{s:n1,g:[]}],now);
assert.deepStrictEqual(cache['f1|s1'],{g:[],at:now});
assert.deepStrictEqual(T.pendingAutograph(rows,cache,now+3600e3),[]);
assert.deepStrictEqual(T.pendingAutograph(rows,cache,now+7*3600e3),[n1]);
assert.deepStrictEqual(T.pendingAutograph([{...rows[0],checkedIn:now-40*day}],cache,now+7*3600e3),[],'old check-in: stop polling');
// 有签名：写回、清洗、3 天复查
const sig={name:'毕赣',role:'导演',st:[[100,300,300,100,500,320],[600,250]]};
cache=T.applyAutograph(cache,rows,[n1],[{s:n1,g:[sig,{bad:1},{name:'x',st:'no'}]}],now);
assert.equal(cache['f1|s1'].g.length,1);assert.equal(cache['f1|s1'].g[0].name,'毕赣');
assert.deepStrictEqual(T.pendingAutograph(rows,cache,now+day),[]);assert.deepStrictEqual(T.pendingAutograph(rows,cache,now+4*day),[n1]);
// 没返回的序号（服务器查不到签到记录）也记空
const c2=T.applyAutograph({},rows,[n1],[],now);assert.deepStrictEqual(c2['f1|s1'].g,[]);
// 挂到票根、票面文字、缩略图签名
T.attachAutographs(rows,cache);
assert.equal(rows[0].autographs.length,1);assert.deepStrictEqual(rows[1].autographs,[]);
assert.equal(T.guestLine(rows[0]),'映后签名 · 导演 毕赣');assert.equal(T.guestLine(rows[1]),'');
assert.notEqual(T.collectSig(rows[0]),T.collectSig({...rows[0],autographs:[]}),'thumbnail cache follows autographs');
assert.notEqual(T.collectSig({issue:1}),T.collectSig({issue:2}),'thumbnail cache follows edition number');
// 票面：正面画签名笔画（金色），背面写嘉宾姓名
const calls=[];
const fake=(w,h)=>{const ctx=new Proxy({},{get:(o,key)=>key in o?o[key]:(key==='canvas'?{width:w,height:h}:key==='measureText'?(t=>({width:String(t).length*10})):key==='createLinearGradient'||key==='createRadialGradient'||key==='createPattern'?(()=>({addColorStop(){}})):key==='getImageData'?(()=>({data:new Uint8ClampedArray(4*w*h)})):(...a)=>{calls.push([key,a]);}),set:(o,key,v)=>{o[key]=v;return true;}});return {width:w,height:h,getContext:()=>ctx};};
const rec={...T.sanitize({filmId:'f1',title:'地球最后的夜晚',subtitle:'',programme:'2026 第63届金马影展',section:'焦点影人',date:'2026-11-08',time:'19:30',venue:'信义威秀',hall:'1厅',city:'台北',format:'4K',serial:n1,issue:7,id:'x'}),checkedIn:now,showId:'s1',showNo:2,autographs:[sig,{...sig,name:'汤唯',role:'演员'}]};
T.draw(fake(420,864).getContext(),rec,'front',null,{x:0,y:0,w:420,h:864},fake);
assert(calls.filter(c=>c[0]==='quadraticCurveTo').length>=2,'signature strokes drawn');
calls.length=0;T.draw(fake(420,864).getContext(),rec,'back',null,{x:0,y:0,w:420,h:864},fake);
assert(calls.some(c=>c[0]==='fillText'&&/映后签名 · 导演 毕赣、演员 汤唯/.test(c[1][0])),'guest names on back');
assert(T.badgesOf(rec).some(b=>b.startsWith('嘉宾签名')),'badge');
// 签到 24 小时内（映后当晚）：空结果 5 分钟后再查，不锁 6 小时
const tonight=[{key:'f4|2026-11-27',filmId:'f4',showId:'s2fkzmu1o',serial:n1,checkedIn:now-2*3600e3}];
const emptyTonight=T.applyAutograph({},tonight,[n1],[{s:n1,g:[]}],now);
assert.deepStrictEqual(T.pendingAutograph(tonight,emptyTonight,now+2*60e3),[],'same-day: throttle within 5m');
assert.deepStrictEqual(T.pendingAutograph(tonight,emptyTonight,now+6*60e3),[n1],'same-day: recheck after 5m');
// base.showId 缺失时应回退到服务器签到记下的 entry.sh，确保 autographKey 与本场序号生效
const built=T.build([{key:'f4|2026-11-27',filmId:'f4',view:{d:'2026-11-27'}}],{'f4|2026-11-27':{t:now,n:n1,q:3,sh:'s2fkzmu1o',sq:2,ci:now}},(id,v,d)=>({filmId:id,title:'夫妻一场',subtitle:'',showId:'',date:d,time:'',city:'',venue:'',hall:'',format:'',art:'',arts:[]}));
assert.equal(built.tickets[0].showId,'s2fkzmu1o','showId falls back to entry.sh');
assert.equal(built.tickets[0].showNo,2,'showNo preserved via entry.sh fallback');
assert.equal(T.autographKey(built.tickets[0]),'f4|s2fkzmu1o','autographKey works even when base.showId is empty');
// 防回归：web 与小程序取签名都不能卡在 editionRun 的空列表早退之后
const fs=require('fs'),path=require('path');
const webSrc=fs.readFileSync(path.join(__dirname,'../js/tickets.js'),'utf8');
const mpSrc=fs.readFileSync(path.join(__dirname,'../miniprogram/utils/ticketstore.js'),'utf8');
assert(/ticketEditionRun\(\);\s*ticketAutographRun\(\);/.test(webSrc),'web must invoke ticketAutographRun independently of ticketEditionRun');
assert(/function ticketWallPage\(\)\{[\s\S]{0,120}ticketAutographRun\(\)/.test(webSrc),'web ticketWallPage must trigger ticketAutographRun');
assert(/editionRun\(\);\s*autographRun\(\);/.test(mpSrc),'mp must invoke autographRun independently of editionRun');
assert(/onAutograph/.test(mpSrc),'mp ticketstore must expose onAutograph for live repaint');
console.log('PASS: guest autographs — fetch rules, cache, attach, ticket drawing, thumbnail signature.');
