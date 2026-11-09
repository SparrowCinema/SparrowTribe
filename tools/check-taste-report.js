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
assert(a.persona.length>3);assert.match(a.code,/^[HC][PR][XB][FJ]$/);assert.equal(a.axes.length,4);assert(a.type.name&&a.type.motto&&a.type.tags.length===3);assert.equal(Object.keys(TR.TYPES).length,16);Object.keys(TR.TYPES).forEach(k=>{assert(TR.TYPES[TR.MATE(k)]);assert.equal(TR.TYPES[k].zh.length,6);assert.equal(TR.TYPES[k].en.length,6);});assert(a.paras.length>=4);assert(a.paras[0].includes('4 部'));
// 确定性：同样评分同样结果（顺序无关）；评分变化后结果变化
{const b=TR.analyze(e.slice().reverse());assert.equal(b.persona,a.persona);assert.deepEqual(b.paras,a.paras);assert.deepEqual(b.picks.map(p=>p[1].id),a.picks.map(p=>p[1].id));}const a2=TR.analyze(e.map((x,i)=>i===0?Object.assign({},x,{rec:Object.assign({},x.rec,{bore:4.5})}):x));assert.notDeepEqual([a2.persona,a2.paras],[a.persona,a.paras]);
let sd=12345;const rnd=n=>{sd=(Math.imul(sd,1103515245)+12345)>>>0;return sd%n;};const names=new Set();for(let i=0;i<2000;i++){const rows=[];for(let k=0;k<6;k++)rows.push(['f'+i+'-'+k,rnd(11)/2,rnd(11)/2,0]);const r=TR.analyze(mk(rows).map((x,k)=>Object.assign(x,{f:film(x.id,{genre:[['喜剧','惊悚','动画','科幻','爱情','恐怖'][(i+k)%6]],reg:['cn','eu','us','as'][(i>>1)%4],y:1960+((i+k)%6)*10})})));if(r.ok)names.add(r.persona);}
assert(names.size>800,'expected many distinct personas, got '+names.size);
// 英文
const en=TR.analyze(e,{en:true});assert(en.persona.startsWith('The '));assert(/films/.test(en.paras[0]));
// 社区距离
const cm=TR.analyze(e,{community:id=>({fun:3,bore:3})});assert(cm.paras.some(p=>p.includes('社区')));
// 绘制：高度为正，页脚回调被调用
const c=ctx();let foot=null;const H=TR.heightOf(c,a,{date:'2026.11.10'});assert(H>3000);TR.draw(c,a,{holder:'麻雀',date:'2026.11.10',footer:(cc,y,h)=>foot=[y,h]});assert(foot&&foot[1]===H&&foot[0]<H);assert(c.calls.includes('fillText'));
// 小程序页面：按钮门槛与生成流程
let def;const data={films:[],programmes:[]},app={globalData:{data},onData:()=>()=>{}},rows=e;
const canvas={width:0,height:0,createImage(){const im={width:10,height:10};Object.defineProperty(im,'src',{set(){im.onload();}});return im;},getContext:()=>ctx()};let previewed=null,done;
const wx={setNavigationBarTitle(){},showToast(o){previewed='toast:'+o.title;},showLoading(){},hideLoading(){},createSelectorQuery:()=>({in(){return this;},select(){return this;},fields(){return this;},exec(fn){done=fn([{node:canvas}]);}}),canvasToTempFilePath:o=>o.success({tempFilePath:'t.png'}),previewImage:o=>previewed=o.urls[0]};
const mods={'../../utils/util.js':{index:()=>({})},'../../utils/watched.js':{entries:()=>rows,onChange:()=>()=>{},holder:()=>'麻雀'},'../../utils/i18n.js':{dict:()=>({}),tr:x=>x,isEn:()=>false},'../../utils/taste.js':{map:()=>({n:0,points:[],quadrants:[],unsure:0})},'../../utils/community.js':{subscribe:()=>()=>{},get:()=>null,read:()=>Promise.resolve(),flush(){}},'../../utils/taste-report.js':TR,'../../utils/recap.js':{footer(){}}};
vm.runInNewContext(fs.readFileSync('miniprogram/pages/taste-map/taste-map.js','utf8'),{require:n=>mods[n],getApp:()=>app,Page:p=>def=p,wx});
const page={...def,data:JSON.parse(JSON.stringify(def.data)),setData(d){Object.assign(this.data,d);}};page.build();assert.equal(page.data.reportN,4);
page.makeReport();(async()=>{await done;assert.equal(previewed,'t.png');assert(canvas.height>1000);console.log('PASS: taste report — threshold, filtering, determinism, '+names.size+' personas in sample, English, community, canvas and mini page export.');})().catch(err=>{console.error(err);process.exitCode=1;});
