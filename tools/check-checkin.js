// 现场认证（2026-11-22）：签到码解析、观影记录合并、票根写回、票面文字与同步字段。
// 服务器签名与时间窗校验在 backend/tickets-checkin-v1.sql（本地 Postgres 测过：伪造窗口 / 换影片 → bad，过期 → expired，重复签到幂等）。
const assert=require('assert'),T=require('../shared/tickets.js'),S=require('../shared/psync.js'),G=require('../shared/growth.js');

// ——— 签到码 ———
const url=T.checkinURL('gh63-f1','s15aaok04',14801234,'0123456789ab');
assert.equal(url,'https://sparrowcinema.org/#checkin=gh63-f1~s15aaok04~14801234~0123456789ab');
assert.deepStrictEqual(T.checkinParse(url),{f:'gh63-f1',h:'s15aaok04',w:14801234,k:'0123456789ab'});
assert.deepStrictEqual(T.checkinParse('checkin=gh63-f1~s15aaok04~14801234~0123456789AB').k,'0123456789ab');
const keyShow=T.checkinURL('f1','11/08-19:30-v1-h1',1,'aaaaaaaaaaaa');
assert.equal(T.checkinParse(keyShow).h,'11/08-19:30-v1-h1','screening key fallback survives encoding');
for (const bad of ['','https://x/#verify=ABC','#checkin=a~b~c','#checkin=f~h~12~zzzzzzzzzzzz','#checkin=f~h~x~0123456789ab','SPARROW-SYNC:SP-1']) assert.equal(T.checkinParse(bad),null,bad);

// ——— 观影记录合并 ———
const now=1763800000000;
let p=T.checkinPlan(undefined,G,'f1','2026-11-08','K1',now);
assert.deepStrictEqual(p.rec,{d:'2026-11-08',r:0,k:'K1',t:now});assert.equal(p.key,'f1|2026-11-08');
// 已有同一天同一场：不改记录
p=T.checkinPlan({d:'2026-11-08',r:8,k:'K1',t:5},G,'f1','2026-11-08','K1',now);
assert.equal(p.rec,null);assert.equal(p.key,'f1|2026-11-08');
// 同一天但没记场次：补上场次，保留评分
p=T.checkinPlan({d:'2026-11-08',r:8,k:'',t:5},G,'f1','2026-11-08','K1',now);
assert.equal(p.rec.k,'K1');assert.equal(p.rec.r,8);assert.equal(p.key,'f1|2026-11-08');
// 以前看过别的日期：新增一次观影
p=T.checkinPlan({d:'2026-10-01',r:6,k:'K0',t:5},G,'f1','2026-11-08','K1',now);
assert.equal(G.views(p.rec).length,2);assert.equal(p.key,'f1|2026-11-08');assert.equal(G.views(p.rec).find(v=>v.d==='2026-11-08').k,'K1');
// 同一天看两场：第二场的键带 |2
const two=T.checkinPlan({d:'2026-11-08',r:6,k:'K0',t:5},G,'f1','2026-11-08','K2',now);
assert.equal(two.key,'f1|2026-11-08|2');
// 已删除的记录：重新盖章
p=T.checkinPlan({del:1,t:900},G,'f1','2026-11-08','K1',now);
assert.equal(p.rec.d,'2026-11-08');assert(p.rec.t>900);

// ——— 票根写回 ———
let e=T.applyCheckin(undefined,'f1|2026-11-08',null);
assert(T.serialValid(e.n),'serial frozen before request');
const n=e.n;
e=T.applyCheckin(e,'f1|2026-11-08',{ok:true,no:7,h:'s15aaok04',sno:3,ci:'2026-11-08T11:42:00+00:00'});
assert.equal(e.n,n);assert.equal(e.q,7);assert.equal(e.sh,'s15aaok04');assert.equal(e.sq,3);assert.equal(e.ci,Date.parse('2026-11-08T11:42:00Z'));
const kept=T.applyCheckin({...e,q:5},'f1|2026-11-08',{ok:true,no:9,h:'x',sno:8,ci:'2026-11-09T00:00:00Z'});
assert.equal(kept.q,5);assert.equal(kept.sh,'s15aaok04');assert.equal(kept.ci,e.ci,'first values win');
assert.equal(T.applyCheckin(e,'f1|2026-11-08',{ok:false,reason:'expired'}).ci,e.ci);

// ——— 票面与同步 ———
const base=(filmId,view,date)=>({filmId,title:'测试片',subtitle:'',programmeId:'gh',programme:'2026 第63届金马影展',section:'',date,time:'19:30',venue:'信义威秀',hall:'1厅',city:'台北',showId:'s15aaok04',format:'4K',art:'',arts:[]});
const store=S.cleanTix({'f1|2026-11-08':e});
assert.equal(store['f1|2026-11-08'].ci,e.ci,'psync keeps ci');
const row=T.build([{key:'f1|2026-11-08',filmId:'f1',view:{d:'2026-11-08',r:0,k:'K1'}}],store,base).tickets[0];
assert(row.checkedIn>0);
assert.equal(T.editionLines(row).line2,'现场认证 · 本场第 3 张');
assert(T.badgesOf(row).includes('现场认证'));
assert.equal(T.entryFrom({...row,seat:'1排1座'},base('f1',{},'2026-11-08')).ci,e.ci,'editing keeps ci');
const merged=S.mergeTix(store,S.cleanTix({'f1|2026-11-08':{t:e.t+9,n,st:'2排'}}));
assert.equal(merged['f1|2026-11-08'].ci,e.ci,'merge fills ci back');
console.log('PASS: on-site check-in — code parse, passport merge, ticket write-back, ticket marks, sync.');
