// 趣味图谱长图：命名与分析的确定性、组合数量、门槛与画布绘制（网站 + 小程序页面）
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),TR=require('../shared/taste-report.js');
const film=(id,o)=>Object.assign({id,cn:'片'+id,en:'Film '+id,y:1995,reg:'cn',genre:['剧情','犯罪']},o);
const mk=(rows)=>rows.map(([id,fun,bore,r],i)=>({id,f:film(id),rec:{d:'2026-11-0'+(i%9+1),fun,bore,r}}));
const ctx=()=>{const calls=[];return new Proxy({calls,measureText:t=>({width:String(t).length*20})},{get(o,k){if(k in o)return o[k];return (...a)=>{calls.push(k);return {addColorStop(){}};};},set(o,k,v){o[k]=v;return true;}});};
// 门槛
assert.equal(TR.analyze(mk([['a',4,1],['b',2,3]])).ok,false);
assert.equal(TR.heightOf(ctx(),TR.analyze(mk([['a',4,1]]))),0);
// 只评一项、活动、删除的不计入
const e=mk([['a',4,1,8],['b',4.5,2,9],['c',1,4,3],['d',5,0.5,10]]);e.push({id:'x',f:film('x'),rec:{fun:4}},{id:'ev',f:film('ev',{ev:1}),rec:{fun:4,bore:1}},{id:'del',f:film('del'),rec:{fun:4,bore:1,del:1}});
const a=TR.analyze(e);assert.equal(a.n,4);assert(a.ok);assert.deepEqual(a.q,[1,0,0,3]);assert.equal(a.dom,3);
assert(a.persona.length>3);assert.match(a.code,/^[HC][PR][XB][FJ]$/);assert.equal(a.axes.length,4);assert(a.type.name&&a.type.motto&&a.type.tags.length===3);assert.equal(Object.keys(TR.TYPES).length,16);Object.keys(TR.TYPES).forEach(k=>{assert(TR.TYPES[TR.MATE(k)]);assert.equal(TR.TYPES[k].zh.length,6);assert.equal(TR.TYPES[k].en.length,6);});
// v2：样本量收缩、重看权重、稳定称号、近邻人格、清晰度
assert(a.axes.every(x=>x.pct>=50&&x.pct<=75),'4 部影片的倾向不应超过 75%');assert.equal(a.clarity,'预告片');assert(a.type.hue);
{const big=[];for(let k=0;k<60;k++)big.push(['g'+k,4.5,1,9]);const A=TR.analyze(mk(big));assert(A.axes[0].pct>80);assert.equal(A.clarity,'高清');}
{const base=mk([['a',5,0,9],['b',5,0,9],['c',1,5,2]]);const plain=TR.stats(TR.validRows(base)).avgF;base[2].rec.v=[{},{},{}];const heavy=TR.stats(TR.validRows(base)).avgF;assert(heavy<plain,'重看过的影片权重更高');assert.equal(TR.validRows(base)[2].w,2);assert.equal(TR.analyze(base).rewatched,1);}
{const b1=mk([['a',4,1,8],['b',4.5,1,9],['c',4,1.5,8]]),b2=b1.concat(mk([['zz',4,1,8]]).map(x=>(x.rec.d='2026-12-01',x)));assert.equal(TR.analyze(b1).persona,TR.analyze(b2).persona,'多打一部同档评分，称号保持不变');}
// v2.1：最常评价、动态标签、星级与有趣度是否同步（扣除整体偏严/偏松）
{const m=[];for(let k=0;k<6;k++)m.push(['m'+k,4,1,8]);m.push(['x1',2,4,4],['x2',5,0,10]);const A=TR.analyze(mk(m));assert.deepEqual(A.mode,{fun:4,bore:1,n:6});assert(A.paras.some(p=>p.includes('最常给出的评价')));}
{const rw=mk([['a',4,1,8],['b',4.5,1,9],['c',4,1.5,8]]);rw.forEach(x=>x.rec.v=[{},{}]);assert.equal(TR.analyze(rw).type.tags[2],'重看党');}
{const strict=TR.stats(TR.validRows(mk([['a',5,0,8],['b',4,1,6],['c',3,2,4],['d',2,3,2]])));assert.equal(strict.code[3],'F','整体打分偏严但与有趣度同步，仍是感受型');const split=TR.stats(TR.validRows(mk([['a',5,0,2],['b',1,4,10],['c',4,1,3],['d',2,3,9]])));assert.equal(split.code[3],'J');}
assert(Object.keys(TR.TYPES).some(k=>{const r=TR.analyze(mk([['a',3.5,2.5,7],['b',3,3,6],['c',3.5,2.5,7],['d',3,2.5,6]]));return r.near&&TR.TYPES[r.near.code];}));assert(a.paras.length>=4);assert(a.paras[0].includes('4 部'));
// 确定性：同样评分同样结果（顺序无关）；评分变化后结果变化
{const b=TR.analyze(e.slice().reverse());assert.equal(b.persona,a.persona);assert.deepEqual(b.paras,a.paras);assert.deepEqual(b.picks.map(p=>p[1].id),a.picks.map(p=>p[1].id));}const a2=TR.analyze(e.map((x,i)=>i===0?Object.assign({},x,{rec:Object.assign({},x.rec,{bore:4.5})}):x));assert.notDeepEqual([a2.persona,a2.paras],[a.persona,a.paras]);
let sd=12345;const rnd=n=>{sd=(Math.imul(sd,1103515245)+12345)>>>0;return sd%n;};const names=new Set();for(let i=0;i<2000;i++){const rows=[];for(let k=0;k<6;k++)rows.push(['f'+i+'-'+k,rnd(11)/2,rnd(11)/2,0]);const r=TR.analyze(mk(rows).map((x,k)=>Object.assign(x,{f:film(x.id,{genre:[['喜剧','惊悚','动画','科幻','爱情','恐怖'][(i+k)%6]],reg:['cn','eu','us','as'][(i>>1)%4],y:1960+((i+k)%6)*10})})));if(r.ok)names.add(r.persona);}
assert(names.size>800,'expected many distinct personas, got '+names.size);
// 年份：按观影日期筛选、变化轨迹、同位置影片各自计权
assert.deepEqual(TR.years(e),[{y:'2026',n:4}]);
const yr=[['p1',1,4,3,'2025'],['p2',1.5,4.5,2,'2025'],['p3',2,4,4,'2025'],['c1',4.5,1,9,'2026'],['c2',4.5,1,9,'2026'],['c3',5,0.5,10,'2026']].map(([id,fun,bore,r,y])=>({id,f:film(id,{dir:'导演甲',c:'法国',y:1960}),rec:{d:y+'-06-01',fun,bore,r}}));
const y26=TR.analyze(yr,{year:'2026'});assert.equal(y26.n,3);assert.equal(y26.year,'2026');assert.deepEqual(y26.q,[0,0,0,3]);assert(y26.prev&&y26.prev.year==='2025'&&/^C/.test(y26.prev.code));assert.notEqual(y26.prev.code,y26.code);
assert.equal(TR.analyze(yr,{year:'2025'}).prev,undefined);assert.equal(TR.analyze(yr).n,6);assert.deepEqual(TR.years(yr).map(x=>x.y),['2026','2025']);
assert.deepEqual(TR.analyze(yr).atlas,{dir:{name:'导演甲',n:6},minY:1960,maxY:1960,decades:1,countries:1});
assert(TR.analyze(yr,{year:'2026'}).paras.some(p=>p.includes('导演甲')));
{const c2=ctx();let ft=null;TR.draw(c2,y26,{date:'2026.11.10',footer:(cc,y,h)=>ft=h});assert.equal(ft,TR.heightOf(ctx(),y26,{date:'2026.11.10'}));}
// 专题范围：与年份二选一，标题与「平时的你」
{const set=new Set(['c1','c2','c3']),A=TR.analyze(yr,{year:'2025',programme:'2026金鸡影展',inProg:f=>set.has(f.id)});assert.equal(A.n,3);assert.equal(A.programme,'2026金鸡影展');assert.equal(A.year,'','选了专题就不按年份');assert.equal(A.prev,undefined);assert(A.base&&A.base.n===6);
 const c3=ctx(),texts=[];c3.fillText=t=>texts.push(String(t));TR.draw(c3,A,{holder:'麻雀',date:'2026.11.10'});assert(texts.includes('麻雀的2026金鸡影展趣味图谱'));assert(texts.some(t=>t.includes('平时的你')));
 assert.equal(TR.analyze(yr,{programme:'X',inProg:f=>f.id==='c1'}).ok,false);}
// 英文
const en=TR.analyze(e,{en:true});assert(en.persona.startsWith('The '));assert(/films/.test(en.paras[0]));
// 社区距离
const cm=TR.analyze(e,{community:id=>({fun:3,bore:3})});assert(cm.paras.some(p=>p.includes('社区')));
// 绘制：高度为正，页脚回调被调用
const c=ctx();let foot=null;const H=TR.heightOf(c,a,{date:'2026.11.10'});assert(H>3000);TR.draw(c,a,{holder:'麻雀',date:'2026.11.10',footer:(cc,y,h)=>foot=[y,h]});assert(foot&&foot[1]===H&&foot[0]<H);assert(c.calls.includes('fillText'));
// 小程序页面：按钮门槛与生成流程
let def;const data={films:[],programmes:[{id:'P1',name:'专题一'}]},app={globalData:{data},onData:()=>()=>{}},rows=e;
const canvas={width:0,height:0,createImage(){const im={width:10,height:10};Object.defineProperty(im,'src',{set(){im.onload();}});return im;},getContext:()=>ctx()};let previewed=null,done;
const wx={setNavigationBarTitle(){},showToast(o){previewed='toast:'+o.title;},showLoading(){},hideLoading(){},createSelectorQuery:()=>({in(){return this;},select(){return this;},fields(){return this;},exec(fn){done=fn([{node:canvas}]);}}),canvasToTempFilePath:o=>o.success({tempFilePath:'t.png'}),previewImage:o=>previewed=o.urls[0]};
const mods={'../../utils/util.js':{index:()=>({})},'../../utils/watched.js':{entries:()=>rows,onChange:()=>()=>{},holder:()=>'麻雀'},'../../utils/i18n.js':{dict:()=>({}),tr:x=>x,isEn:()=>false},'../../utils/taste.js':{map:()=>({n:0,points:[],quadrants:[],unsure:0})},'../../utils/community.js':{subscribe:()=>()=>{},get:()=>null,read:()=>Promise.resolve(),flush(){}},'../../utils/taste-report.js':TR,'../../utils/recap.js':{footer(){}},'../../utils/library.js':{inProgramme:(f,id)=>id==='P1'}};
vm.runInNewContext(fs.readFileSync('miniprogram/pages/taste-map/taste-map.js','utf8'),{require:n=>mods[n],getApp:()=>app,Page:p=>def=p,wx});
const page={...def,data:JSON.parse(JSON.stringify(def.data)),setData(d){Object.assign(this.data,d);}};page.build();assert.equal(page.data.reportN,4);assert.equal(JSON.stringify(page.data.yearLabels),'["全部年份","2026"]');page.setYear({detail:{value:1}});assert.equal(page.data.year,'2026');assert.equal(page.data.reportN,4);assert.equal(JSON.stringify(page.data.progLabels),'["全部专题","专题一"]');page.setProg({detail:{value:1}});assert.equal(page.data.prog,'P1');assert.equal(page.data.year,'','专题与年份二选一');assert.equal(page.data.reportN,4);page.setYear({detail:{value:1}});assert.equal(page.data.prog,'');
page.makeReport();(async()=>{await done;assert.equal(previewed,'t.png');assert(canvas.height>1000);console.log('PASS: taste report — threshold, filtering, determinism, '+names.size+' personas in sample, English, community, canvas and mini page export.');})().catch(err=>{console.error(err);process.exitCode=1;});
