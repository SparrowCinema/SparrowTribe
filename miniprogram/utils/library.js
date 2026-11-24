/* Film-library membership. Shared by the website and mini-program.
   多选：筛选值是 'all'（不限）、单个 id，或逗号连接的多个 id（如 'a,b'）；同一筛选内多个值是「或」。 */
(function(root){
 'use strict';
 const list=v=>Array.isArray(v)?v.map(String).filter(Boolean):(v==null||v===''||v==='all'?[]:String(v).split(',').filter(x=>x&&x!=='all'));
 const has=(v,id)=>{const a=list(v);return !a.length||a.includes(String(id));};
 const toggle=(v,id)=>{const a=list(v),i=a.indexOf(String(id));if(i<0)a.push(String(id));else a.splice(i,1);return a.length?a.join(','):'all';};
 function matches(f,query){const hay=[f.cn,f.cnZh,f.cnDb,...(f.titleAliases||[]),f.en,f.o,f.dir,f.dirO,f.c,(f.cast||[]).join(' '),f.version].filter(Boolean).join(' ').toLocaleLowerCase();return String(query||'').toLocaleLowerCase().split(/\s+/).filter(Boolean).every(w=>hay.includes(w));}
 function inProgramme(f,id,ctx){const a=list(id);return !a.length||a.some(p=>(f.prog||ctx.programmeOf?.(f))===p||(ctx.programmeIds?.(f)||[]).includes(p)||ctx.shows.some(s=>s.id===f.id&&ctx.showProgramme(s)===p));}
 function inCity(f,city,ctx){const c=list(city);return !c.length||ctx.shows.some(s=>s.id===f.id&&ctx.cityOfShow&&c.includes(ctx.cityOfShow(s))&&has(ctx.programme,ctx.showProgramme(s)));}
 const DECADES=[
  ['d:2020','2020年代',2020,2029],
  ['d:2010','2010年代',2010,2019],
  ['d:2000','2000年代',2000,2009],
  ['d:1990','1990年代',1990,1999],
  ['d:classic','1990年前经典',0,1989]
 ];
 const TRAITS=[
  ['qa','有映后'],
  ['sub','字幕机'],
  ['last','仅剩最后一场'],
  ['wp','全球首映'],
  ['fit','可凑空档']
 ];
 function decadeLabel(k){const d=DECADES.find(x=>x[0]===k);return d?d[1]:String(k);}
 function yearMatches(f,sel){
  const a=list(sel);if(!a.length)return true;
  const yr=parseInt(f&&f.y,10),ys=String(f&&f.y||'');
  return a.some(k=>{
   const d=DECADES.find(x=>x[0]===k);
   if(d)return Number.isFinite(yr)&&yr>=d[2]&&yr<=d[3];
   return ys===String(k);
  });
 }
 const minutes=t=>{const m=/^(\d{1,2}):(\d{2})$/.exec(String(t||''));return m?+m[1]*60+(+m[2]):NaN;};
 const SUB_RE=/字幕机|Subtitle display/i;
 const QA_RE=/^\s*(?:映后活动|映后交流|Post-screening event|Q&A)/i;
 function normFest(s){return String(s||'').replace(/20\d{2}|第?\d+届|中国|国际|电影节|影展|展映|专题|[\s·・\-—()（）]/g,'').toLowerCase();}
 function isFestivalWorldPremiere(f,ctx){
  const wp=f&&f.worldPremiere;if(!wp||wp.kind!=='festival')return false;
  if(wp.atProgramme===true)return true;
  const dt=String(wp.date||'');if(dt.length<7)return false;
  const progs=(ctx&&ctx.programmes)||[];
  const pids=new Set([f.prog,...(ctx&&ctx.programmeIds?ctx.programmeIds(f):[])].filter(Boolean));
  const fn=normFest(wp.festival),fen=normFest(wp.festivalEn);
  return progs.some(p=>{
   if(!p||!pids.has(p.id)||!/影展|festival/i.test(p.kind||''))return false;
   const pn=normFest(p.name),pen=normFest(p.en);
   const same=(pn&&fn&&(fn.includes(pn)||pn.includes(fn)))||(pen&&fen&&(fen.includes(pen)||pen.includes(fen)));
   return same&&p.start&&p.end&&dt>=p.start.slice(0,dt.length)&&dt<=p.end.slice(0,dt.length);
  });
 }
 function scopedShows(f,ctx){
  return (ctx.shows||[]).filter(s=>s.id===f.id&&has(ctx.programme,ctx.showProgramme(s))&&has(ctx.city,ctx.cityOfShow&&ctx.cityOfShow(s)));
 }
 function hasQaShow(f,shows,ctx){
  return shows.some(s=>QA_RE.test((f.screeningNotes||{})[ctx.keyOf(s)]||'')||!!(f.qaGuest&&minutes(f.qaEnd)>minutes(f.qaStart)));
 }
 function hasSubtitleMachine(f,shows,ctx){
  if(SUB_RE.test(String(f.subtitles||'')))return true;
  const notes=f.screeningNotes||{};
  return shows.some(s=>SUB_RE.test(String(notes[ctx.keyOf(s)]||'')));
 }
 function showFitsPicked(s,pickedShows,ctx){
  if(!pickedShows.length)return true;
  if(ctx.overlaps)return !pickedShows.some(p=>ctx.overlaps(s,p));
  const s1=ctx.showRange?ctx.showRange(s):null;if(!s1)return true;
  return !pickedShows.some(p=>{const s2=ctx.showRange?ctx.showRange(p):null;if(!s2)return false;return s1[0]<s2[1]-2&&s2[0]<s1[1]-2;});
 }
 function traitStatus(f,ctx){
  const shows=scopedShows(f,ctx);
  const up=ctx.isPast?shows.filter(s=>!ctx.isPast(s)):shows;
  const qa=hasQaShow(f,shows,ctx);
  const sub=hasSubtitleMachine(f,shows,ctx);
  const last=ctx.isPast?up.length===1:false;
  const wp=isFestivalWorldPremiere(f,ctx);
  let fit=false;
  if(up.length){
   const pickedShows=ctx.pickedShows||((ctx.picked&&ctx.picked.size)?(ctx.shows||[]).filter(s=>ctx.picked.has(ctx.keyOf(s))&&(!ctx.isPast||!ctx.isPast(s))):[]);
   fit=up.some(s=>!ctx.picked?.has(ctx.keyOf(s))&&showFitsPicked(s,pickedShows,ctx));
  }
  return {qa,sub,last,wp,fit,upcomingCount:up.length};
 }
 function matchesTraits(f,traits,ctx){
  const a=list(traits);if(!a.length)return true;
  const ts=traitStatus(f,ctx);
  return a.every(k=>!!ts[k]);
 }
 function status(f,ctx){
  const shows=scopedShows(f,ctx);
  const rec=ctx.watched[f.id],seen=!!(rec&&!rec.del&&rec.d);
  const w=ctx.want&&ctx.want[f.id];
  const upCount=ctx.isPast?shows.filter(s=>!ctx.isPast(s)).length:0;
  return {planned:shows.some(s=>ctx.picked.has(ctx.keyOf(s))),watched:seen,wanted:!seen&&!!(w&&!w.del),event:hasQaShow(f,shows,ctx),lastChance:ctx.isPast?upCount===1:false};
 }
 function category(f,mode,ctx){const m=list(mode);if(!m.length)return true;const s=status(f,ctx);return m.some(k=>k==='planned'?s.planned:k==='want'?s.wanted:k==='watched'?s.watched:k==='unwatched'?!s.watched:k==='qa'?s.event:false);}
 // Film-hero labels only: retain full programme membership everywhere else.
 function featuredProgrammes(entries,info){
  const seen=new Set();
  return entries.filter(x=>x.p&&!seen.has(x.p.id)&&seen.add(x.p.id)).map(x=>({entry:x,info:info(x.p)})).sort((a,b)=>{
   const past=x=>x.info.status==='ended'?1:0,latest=x=>(x.info.status==='ended'?x.info.b:x.info.a)||x.info.b||0;
   return past(a)-past(b)||latest(b)-latest(a)||String(a.entry.p.id).localeCompare(String(b.entry.p.id));
  }).slice(0,2).map(x=>x.entry);
 }
 // Portrait -> landscape: fill the viewport with 5–10 posters, never a wide strip.
 function posterColumns(width,height){const ratio=Number(width)/Number(height);return Number.isFinite(ratio)&&ratio>0?Math.round(5+5*Math.min(1,Math.max(0,(ratio-.8)/.4))):5;}
 function posterPeriod(date,mode){const m=/^(\d{4})-(0[1-9]|1[0-2])-\d{2}$/.exec(String(date||''));if(!m)return '';return mode==='month'?m[1]+'-'+m[2]:mode==='quarter'?m[1]+'-Q'+Math.ceil(+m[2]/3):m[1];}
 function posterPeriods(entries,mode){return [...new Set(entries.map(e=>posterPeriod(e.rec.d,mode)).filter(Boolean))].sort().reverse();}
 function posterEntries(entries,mode,period,programme='all',ctx={shows:[]}){return entries.filter(e=>posterPeriod(e.rec.d,mode)===period&&inProgramme(e.f,programme,ctx));}
 // 海报墙导出标题：二选一——选了专题按专题命名（时间放副标题），否则按年/季/月命名
 const EN_MON=['January','February','March','April','May','June','July','August','September','October','November','December'];
 function posterPeriodLabel(period,en){const s=String(period||'');let m=/^(\d{4})-Q([1-4])$/.exec(s);if(m)return en?'Q'+m[2]+' '+m[1]:m[1]+'年第'+'一二三四'[m[2]-1]+'季度';m=/^(\d{4})-(\d{2})$/.exec(s);if(m)return en?EN_MON[+m[2]-1]+' '+m[1]:m[1]+'年'+(+m[2])+'月';return /^\d{4}$/.test(s)?(en?s:s+'年'):s;}
 function posterTitle(o){const en=!!o.en,h=String(o.holder||'').trim(),lab=posterPeriodLabel(o.period,en),name=o.programmeName||'';
  if(name)return en?{title:(h?h+"'s ":'My ')+name+' Poster Wall',sub:'Cinema log'+(lab?' · '+lab:'')}:{title:(h||'我')+'的'+name+'海报墙',sub:'影院观影'+(lab?' · '+lab:'')};
  return en?{title:(lab?lab+' ':'')+'Cinema Poster Wall',sub:(h?h+"'s":'My')+' Film Passport'}:{title:lab+'影院观影海报墙',sub:(h||'我')+'的观影护照'};}
 const api={matches,inProgramme,inCity,status,category,list,has,toggle,DECADES,TRAITS,decadeLabel,yearMatches,traitStatus,matchesTraits,isFestivalWorldPremiere,featuredProgrammes,posterColumns,posterPeriod,posterPeriods,posterEntries,posterPeriodLabel,posterTitle};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SparrowLibrary=api;
})(typeof window!=='undefined'?window:this);
