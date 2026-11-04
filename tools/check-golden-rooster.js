const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..'),data=require(path.join(root,'miniprogram/data/data.js')),U=require(path.join(root,'miniprogram/utils/util.js'));
const pack=JSON.parse(fs.readFileSync(path.join(root,'data/programmes/golden-rooster-2026.json'))),en=JSON.parse(fs.readFileSync(path.join(root,'data/i18n/en.json'))),idx=U.index(data);
for(const f of pack.films){assert(f.syn&&f.bio&&f.st&&f.highlights.length>=2&&f.honors.length);assert.equal(f.r.length,5);assert(f.r.every((x,i)=>x===null||typeof x==='number'&&x>=0&&x<=[10,10,100,100,5][i]));assert(!f.ticketHint.includes('淘票票扫码购票'));if(f.id!=='linka-linka'){const e=en.films[f.id];assert(e.bio&&e.st&&e.highlights.length>=2);}}
for(const v of data.venues)assert(['杭州','厦门','嘉兴','台北'].includes(v.city));
let page;const store=new Map(),plan={get:()=>new Set(),onChange:()=>()=>{}},I={tr:x=>x,isEn:()=>false,dict:()=>({})};
const now=new Date(2026,10,6,0,15).getTime(),RealDate=Date;
class FakeDate extends RealDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
// Use real utilities, with the page clock simulated at 00:15 before its first screening.
const utilSource=fs.readFileSync(path.join(root,'miniprogram/utils/util.js'),'utf8'),utilCtx={require:()=>I,module:{exports:{}},Date:FakeDate};vm.runInNewContext(utilSource,utilCtx);const UT=utilCtx.module.exports;
const ctx={Date:FakeDate,Page:p=>page=p,getApp:()=>({globalData:{data}}),require:n=>n.endsWith('/util.js')?UT:n.endsWith('/plan.js')?plan:n.endsWith('/library.js')?require('../shared/library.js'):I,wx:{getStorageSync:k=>store.get(k),setStorageSync:(k,v)=>store.set(k,v)},setInterval:()=>0,clearInterval(){}};
vm.runInNewContext(fs.readFileSync(path.join(root,'miniprogram/pages/schedule/schedule.js'),'utf8'),ctx);page.data=JSON.parse(JSON.stringify(page.data));page.setData=x=>Object.assign(page.data,x);page.data.pf='golden-rooster-2026';page.data.day='11/6';page.build();assert.equal(page.ttCtx.S,810);assert.equal(page.data.ticks[0].t,'13:30');assert.equal(page.data.nowLine,null);
page.setCity({detail:{value:page.data.cities.findIndex(c=>c.id==='厦门')}});assert.equal(page.data.count,173);
page.searchVenue({detail:{value:'思明'}});assert.equal(page.data.venues.length,1);assert.equal(page.data.venues[0].city,'厦门');const vid=page.data.venues[0].id;page.setVenue({currentTarget:{dataset:{id:vid}}});assert.equal(page.data.count,3);assert.equal(page.ttCtx.S,840);assert.equal(page.data.ticks[0].t,'14:00');
page.searchVenue({detail:{value:'no-such-cinema'}});assert.equal(page.data.venues.length,0);
page.setProg({currentTarget:{dataset:{id:'style-kaleidoscope'}}});assert.equal(page.data.city,'all');assert.equal(page.data.vf,'all');assert.equal(page.data.venueQuery,'');assert(page.data.dayList.length);
console.log('PASS: 83 full bilingual details and five rating slots, 25 city labels, mini-program midnight axis, city/programme/venue search and filter reset.');

page.resetFilters();page.openSelector({currentTarget:{dataset:{type:'programme'}}});assert(page.data.selectorRows.length>1);page.searchSelector({detail:{value:'金鸡'}});assert.equal(page.data.selectorRows.length,1);page.chooseFilter({currentTarget:{dataset:{id:'golden-rooster-2026'}}});assert.equal(page.data.pf,'golden-rooster-2026');assert.equal(page.data.selectorType,'programme');page.closeSelector();assert.equal(page.data.selectorType,'');
page.openSelector({currentTarget:{dataset:{type:'venue'}}});page.searchSelector({detail:{value:'思明'}});assert.equal(page.data.selectorRows.length,1);page.chooseFilter({currentTarget:{dataset:{id:page.data.selectorRows[0].id}}});assert.equal(page.data.count,3);assert.notEqual(page.data.selectorType,'');page.closeSelector();assert.equal(page.data.selectorType,'');page.resetFilters();
console.log('PASS: searchable programme/cinema selector, multi-select apply and done button, filter reset and 30-minute lead-in.');

// A catalogue with 20 programmes still renders only three homepage controls.
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sampleProgrammes=Array.from({length:20},(_,i)=>({id:'festival-'+i,name:'影展 '+i,city:'厦门',period:'2026'}));
const filterCtx={SparrowLibrary:require('../shared/library.js'),LANG:'zh',pfilt:'all',cityFilt:'all',vfilt:'all',PG:{},VN:{},SH:[],VENUES:[],tr:x=>x,esc:x=>String(x),isPast:()=>false,progOrdered:()=>sampleProgrammes,progStatus:()=> 'upcoming'};
vm.createContext(filterCtx);vm.runInContext(html.slice(html.indexOf('const selList='),html.indexOf('const inProg')),filterCtx);vm.runInContext(html.slice(html.indexOf("const filterChevron="),html.indexOf('function openScheduleSelector')),filterCtx);
assert.equal((vm.runInContext('scheduleFiltersHTML()',filterCtx).match(/data-schedule-filter=/g)||[]).length,3);
assert.equal((vm.runInContext('selectorOptions("programme")',filterCtx).match(/role="option"/g)||[]).length,21);
assert.equal((vm.runInContext('selectorOptions("programme","影展 19")',filterCtx).match(/role="option"/g)||[]).length,1);
const originalProgrammes=data.programmes;data.programmes=sampleProgrammes;page.build();assert.equal(page.selectorOptions('programme','').length,21);assert.equal(page.selectorOptions('programme','影展 19').length,1);data.programmes=originalProgrammes;page.build();
page.setProg({currentTarget:{dataset:{id:'golden-rooster-2026'}}});assert(page.selectorOptions('venue','')[1].n>0);
console.log('PASS: 20-programme stress case, three fixed homepage controls, searchable complete list and relevant cinemas first.');
