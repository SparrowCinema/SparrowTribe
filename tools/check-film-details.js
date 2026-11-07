// Render the real film-detail template for every film with retained past screenings.
// No showPid stub: that helper is local to films(), not a detail-page dependency.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..'),src=fs.readFileSync(path.join(root,'index.html'),'utf8');
const line=name=>{const start=src.indexOf('function '+name+'(');assert(start>=0);return src.slice(start,src.indexOf('\n',start));};
const detailStart=src.indexOf('function detail(id){'),detailEnd=src.indexOf('\n// 头图：',detailStart);
const cat=JSON.parse(fs.readFileSync(path.join(root,'data/catalog.json'),'utf8')),PG=Object.fromEntries(cat.programmes.map(p=>[p.id,p])),VN=Object.fromEntries(cat.venues.map(v=>[v.id,v])),F={},SH=[];
for(const p of cat.programmes){if(!p.file)continue;const pack=JSON.parse(fs.readFileSync(path.join(root,p.file),'utf8'));for(const original of pack.films||[]){if(F[original.id])continue;const f=JSON.parse(JSON.stringify(original));f.prog=f.prog||p.id;for(const k of ['highlights','honors','genre'])if(!Array.isArray(f[k]))f[k]=[];F[f.id]=f;}for(const row of pack.shows||[]){if(!Array.isArray(row))continue;const [d,t,id,v,h]=row;SH.push({d,t,id,v,h,p:p.id});}}
const date=s=>{const [m,d]=s.d.split('/').map(Number),[h,mi]=s.t.split(':').map(Number);return new Date(m>=10?2026:2027,m-1,d,h,mi);};
let current=Date.parse('2026-11-07T23:59:00+08:00');const isPast=s=>date(s).getTime()+(F[s.id]?.min||120)*60000<current,keepPast=p=>!!p&&/影展|festival|艺术电影空间/i.test(p.kind||'');
const main={innerHTML:''},topEl={innerHTML:''},sandbox={main,topEl,F,PG,VN,SH,FILMS:Object.values(F).filter(f=>!f.ev),LANG:'zh',REG:new Proxy({},{get:()=>({c:'#888'})}),go:()=>assert.fail('Unexpected redirect'),pst:()=>null,showDate:date,isPast,keepPast,tr:s=>s,esc:s=>String(s??''),stripCity:(s,v)=>s.replace(v.city||'@@',''),hShort:h=>h.short||h.name,filmProgsOf:f=>[{p:PG[f.prog],sec:''}],progRange:()=>[1,2],progStatus:()=> 'live',window:{SparrowLibrary:require('../shared/library.js')},document:{},fitHero(){}};
for(const name of ['ratingsHTML','extLinksHTML','myRateHTML','noticeHTML','qaPanelHTML','giftsHTML','creditsHTML','partsHTML','presentersHTML','screeningHTML','ticketHTML','editionHTML'])sandbox[name]=()=>'';
Object.assign(sandbox,{paragraphsHTML:s=>s||'',honorHTML:s=>s,minText:f=>f.min+' min'});
vm.createContext(sandbox);vm.runInContext(line('pastRowHTML')+'\n'+line('pastShowsHTML')+'\n'+src.slice(detailStart,detailEnd),sandbox);
assert(!('showPid' in sandbox));let renders=0;
for(const at of ['2026-11-07T23:59:00+08:00','2027-12-31T23:59:00+08:00']){current=Date.parse(at);for(const f of Object.values(F)){const rows=SH.filter(s=>s.id===f.id&&isPast(s)&&keepPast(PG[s.p]));if(!rows.length)continue;main.innerHTML='';sandbox.detail(f.id);assert(main.innerHTML.includes('fd-title'));assert(main.innerHTML.includes('fd-prow'));for(const s of rows){const row=sandbox.pastRowHTML(s,f);assert(row.includes(PG[s.p].name));assert(row.includes(s.t));assert(!row.includes('–'));}renders++;}}
const f=Object.values(F)[0],s={d:'11/7',t:'14:00',id:f.id,v:cat.venues[0].id,h:cat.venues[0].halls[0].id};assert(sandbox.pastRowHTML(s,f).includes(PG[f.prog].name));
console.log('PASS: '+renders+' real detail-page renders with past screenings across all programmes, actual programme labels, start time only, and no injected showPid helper.');
