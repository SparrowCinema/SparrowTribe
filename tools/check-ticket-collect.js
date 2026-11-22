// 典藏玩法（2026-11-22）：封版编号、场次限定、隐藏款、影展限定、验真二维码、全收集金章。
// 数据层与票面文字都在 shared/tickets.js / shared/psync.js；后端函数见 backend/tickets-collect-v1.sql。
const assert=require('assert'),T=require('../shared/tickets.js'),S=require('../shared/psync.js');

const films={a:{cn:'坠落的审判'},b:{cn:'花样年华'},c:{cn:'悲情城市'}};
const base=(filmId,view,date)=>{const f=films[filmId];if(!f)return null;const s=view&&view.k;
  return {filmId,title:f.cn,subtitle:'',programmeId:'gh',programme:'2026 第63届金马影展',section:'焦点影人',date,time:s?'19:30':'',venue:s?'信义威秀':'',hall:s?'1厅':'',city:'台北',
    showId:s?'sid-'+filmId:'',format:'4K',art:'',arts:[],progKind:'影展专题',progStart:'2026-11-06',progEnd:'2026-11-22',showTag:s?'映后场':''};};
const view=(filmId,d,k)=>({key:filmId+'|'+d,filmId,view:{d,r:0,k:k||''}});

// ——— 场次限定：领号时带场次编号，结果写回 sh / sq ———
const list=[view('a','2026-11-08','k'),view('b','2026-11-09'),view('c','2026-12-30')];
let store=S.cleanTix({'a|2026-11-08':{t:11},'b|2026-11-09':{t:12},'c|2026-12-30':{t:13}});
const showOf=key=>key.startsWith('a|')?'sid-a':'';
let items=T.pendingIssue(store,showOf);
assert.equal(items.length,3);assert.equal(items.find(x=>x.f==='a').h,'sid-a');assert.equal(items.find(x=>x.f==='b').h,'');
let res=items.map((x,i)=>({s:x.s,no:i+1,h:x.h||null,sno:x.h?1:null}));
store=S.cleanTix({...store,...T.applyIssue(store,items,res)});
assert.equal(store['a|2026-11-08'].sh,'sid-a');assert.equal(store['a|2026-11-08'].sq,1);assert.equal(store['b|2026-11-09'].sh,undefined);
assert.equal(T.pendingIssue(store,showOf).length,0,'nothing left to issue');
// 旧后端（不认识场次）：记 sh "-"，不再反复领；改天后端升级后再领会补上
let old=S.cleanTix({'a|2026-11-08':{t:11}});const oi=T.pendingIssue(old,showOf);
old=S.cleanTix({...old,...T.applyIssue(old,oi,[{s:oi[0].s,no:5}])});
assert.equal(old['a|2026-11-08'].sh,'-');assert.equal(old['a|2026-11-08'].q,5);
assert.equal(T.applyIssue(old,T.pendingIssue(old,showOf),[{s:oi[0].s,no:5}]),null,'old backend again: no change, loop stops');
const up=T.applyIssue(old,T.pendingIssue(old,showOf),[{s:oi[0].s,no:5,h:'sid-a',sno:3}]);
assert.equal(up['a|2026-11-08'].sq,3);assert.equal(up['a|2026-11-08'].q,5,'edition number kept');
// 没序号的排在补场次的前面
const mixed={};for(let i=0;i<60;i++)mixed['a|2026-10-'+String(i%28+1).padStart(2,'0')+(i>=28?'|'+(2+Math.floor((i-28)/28)):'')]={t:i,q:i+1,sh:'-'};
mixed['b|2026-11-09']={t:99};
assert.equal(T.pendingIssue(S.cleanTix(mixed),()=> 'sid')[0].f,'b','unissued first');

// ——— 票面字段 ———
let built=T.build(list,store,base);T.decorate(built.tickets,null);
const ra=built.tickets.find(r=>r.filmId==='a'),rb=built.tickets.find(r=>r.filmId==='b'),rc=built.tickets.find(r=>r.filmId==='c');
assert.equal(ra.showNo,1);assert.equal(ra.showTag,'映后场');assert.equal(rb.showNo,0);
assert.equal(ra.limited,true,'viewing inside festival dates');assert.equal(ra.limitedName,'金马影展');assert.equal(rc.limited,false,'viewing after festival');
let ed=T.editionLines(ra);
assert.equal(ed.line1,'本片第 '+ra.issue+' 张典藏');assert.equal(ed.line2,'本场第 1 张 · 映后场');assert.equal(ed.total,'');
assert.deepStrictEqual(T.editionLines({issue:0}).line1,'待发号 · 联网后自动烫印');

// ——— 封版：时间推算、待取总数、写回 o、显示 ———
const day=Date.parse('2026-11-22T00:00:00+08:00');
const close=T.editionClose([day-3600e3],[{end:day+864e5,open:false}]);
assert.equal(close,day+864e5+14*864e5,'last day + 14 days, rounded to Beijing midnight');
assert.equal(T.editionClose([day+60e3],[{end:day,open:false}]),T.editionClose([day+50*60e3],[{end:day,open:false}]),'minutes apart → same close');
assert.equal(T.editionClose([day],[{end:day,open:true}]),0,'ongoing programme never closes');
assert.equal(T.editionClose([],[]),0);assert.equal(T.editionClose([day],[{end:0}]),0,'programme without end date');
const closeOf=f=>f==='c'?0:close;
assert.deepStrictEqual(T.pendingEdition(store,closeOf,close-1),[],'not yet closed');
const pe=T.pendingEdition(store,closeOf,close+1);assert.deepStrictEqual(pe.map(x=>x.f).sort(),['a','b']);assert.equal(pe[0].c,new Date(close).toISOString());
store=S.cleanTix({...store,...T.applyEdition(store,[{f:'a',total:63},{f:'b',total:0}])});
assert.equal(store['a|2026-11-08'].o,63);assert.equal(store['b|2026-11-09'].o,0,'zero total kept');assert.deepStrictEqual(T.pendingEdition(store,closeOf,close+1),[]);
built=T.build(list,store,base);
const ra2=built.tickets.find(r=>r.filmId==='a'),rb2=built.tickets.find(r=>r.filmId==='b');
ed=T.editionLines(ra2);assert.equal(ed.total,' / 0063');assert.match(ed.line1,/共 63 张 · 已封版$/);
assert.equal(T.editionLines(rb2).line1,'本片第 '+rb2.issue+' 张 · 封版后典藏','issued after close');
// 编辑保存不丢 sh / sq / o
const kept=T.entryFrom({...ra2,seat:'7排8座'},base('a',{k:'k'},'2026-11-08'));
assert.equal(kept.sh,'sid-a');assert.equal(kept.sq,1);assert.equal(kept.o,63);assert.equal(kept.st,'7排8座');

// ——— 同步：较新的一份缺这些字段时从另一份补回（编号一致才补） ———
const k='a|2026-11-08',full=store[k];
let m=S.mergeTix(S.cleanTix({[k]:full}),S.cleanTix({[k]:{t:full.t+5,st:'1排1座'}}));
assert.equal(m[k].sh,'sid-a');assert.equal(m[k].sq,1);assert.equal(m[k].o,63);assert.equal(m[k].st,'1排1座');
m=S.mergeTix(S.cleanTix({[k]:full}),S.cleanTix({[k]:{t:full.t+5,n:T.serialOf('x',1)}}));
assert.equal(m[k].o,undefined,'different serial: nothing filled');
assert.equal(S.cleanTixEntry({t:1,sh:'bad id!',sq:-1,o:1.5}).sh,undefined);

// ——— 隐藏款：约 1/400，按编号固定；底箔换成孤品流光箔，保存时不存进款式；不在款式选项里 ———
let hits=0,hiddenKey='';
for(let i=0;i<40000;i++){if(T.isHidden(T.serialOf('h|2026-11-01',i))){hits++;if(!hiddenKey)hiddenKey=String(i);}}
assert(hits>60&&hits<150,'hidden rate about 1/400, got '+hits);
assert(!T.options.finish.some(o=>o.id==='unique'),'unique foil not selectable');
const hk='a|2026-11-08',hs=T.serialOf('h|2026-11-01',Number(hiddenKey));
const hr=T.build([view('a','2026-11-08','k')],{[hk]:{t:Number(hiddenKey),n:hs}},base).tickets[0];
assert.equal(hr.hidden,true);assert.equal(hr.look.finish,'unique');
const he=T.entryFrom(hr,base('a',{k:'k'},'2026-11-08'));assert(!he.l||!he.l.includes('unique'),'unique not stored');
assert.equal(T.lookSig(hr.look),T.lookSig(T.sanitize({...hr,look:null}).look),'hidden ticket is not "customised"');
assert(T.badgesOf(hr).includes('隐藏款 · 1/1 孤品'));

// ——— 全收集金章 ———
const sets={gh:{films:['a','b','c'],sections:{'焦点影人':['a','b']}}};
built=T.build(list,store,base);T.decorate(built.tickets,sets);
assert(built.tickets.every(r=>r.slam==='programme'&&r.slamN===3),'all three collected');
const two=T.build(list.slice(0,2),store,base);T.decorate(two.tickets,sets);
assert(two.tickets.every(r=>r.slam==='section'&&r.slamN===2),'section complete');
const one=T.build(list.slice(0,1),store,base);T.decorate(one.tickets,sets);assert.equal(one.tickets[0].slam,'');
assert(T.badgesOf(built.tickets[0]).some(b=>b.startsWith('全满贯')));

// ——— 验真二维码与票面绘制（假画布，检查文字与二维码都画上了） ———
assert.equal(T.verifyURL(ra.serial),'https://sparrowcinema.github.io/SparrowTribe/#verify='+ra.serial);assert.equal(T.verifyURL('bad'),'');
const calls=[];
const fake=(w,h)=>{const ctx=new Proxy({},{get:(o,key)=>key in o?o[key]:(key==='canvas'?{width:w,height:h}:key==='measureText'?(t=>({width:String(t).length*10})):key==='createLinearGradient'||key==='createRadialGradient'||key==='createPattern'?(()=>({addColorStop(){}})):key==='getImageData'?(()=>({data:new Uint8ClampedArray(4*w*h)})):(...a)=>{calls.push([key,a]);}),set:(o,key,v)=>{o[key]=v;return true;}});return {width:w,height:h,getContext:()=>ctx};};
let qrAsked='';T.setQR(text=>{qrAsked=text;return Array.from({length:25},(_,r)=>Array.from({length:25},(_,c)=>(r*c)%3===0));});
const rich={...built.tickets.find(r=>r.filmId==='a'),hidden:true,limited:true,limitedName:'金马影展'};
T.draw(fake(420,864).getContext(),rich,'back',null,{x:0,y:0,w:420,h:864},fake);
let texts=calls.filter(c=>c[0]==='fillText').map(c=>String(c[1][0]));
assert.equal(qrAsked,T.verifyURL(rich.serial),'QR encodes verify URL');
assert(calls.filter(c=>c[0]==='fillRect').length>100,'QR modules drawn');
for(const t of ['扫码验真','本场第 1 张 · 映后场','隐藏款 · 1/1 孤品','全满贯 · 集齐 3 部','/ 0063']) assert(texts.some(x=>x.includes(t)),'back text '+t);
calls.length=0;T.draw(fake(420,864).getContext(),{...rich,hidden:false},'back',null,{x:0,y:0,w:420,h:864},fake);
assert(calls.some(c=>c[0]==='fillText'&&c[1][0]==='影展限定'),'limited header when not hidden');
calls.length=0;T.draw(fake(420,864).getContext(),rich,'front',null,{x:0,y:0,w:420,h:864},fake);
texts=calls.filter(c=>c[0]==='fillText').map(c=>String(c[1][0]));
assert(texts.includes('限定'),'limited seal on front');assert(texts.includes('隐藏款 · 1/1'),'hidden tag on front');
calls.length=0;T.drawShowcase(fake(1440,1800).getContext(),rich,null,fake,{width:1440});
texts=calls.filter(c=>c[0]==='fillText').map(c=>String(c[1][0]));
assert(texts.includes('/ 0063'),'showcase edition total');assert(texts.some(t=>t.includes('共 63 张 · 已封版')));assert(texts.some(t=>t.includes('隐藏款')));
// 还没领号：没有二维码
calls.length=0;qrAsked='';T.draw(fake(420,864).getContext(),{...rich,issue:0},'back',null,{x:0,y:0,w:420,h:864},fake);
assert.equal(qrAsked,'','no QR before issue');T.setQR(null);
console.log(`PASS: ticket collectibles — screening numbers, edition close (${new Date(close).toISOString()}), hidden ${hits}/40000, limited, verify QR, set completion.`);
