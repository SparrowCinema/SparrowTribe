/* Film-library membership. Shared by the website and mini-program.
   多选：筛选值是 'all'（不限）、单个 id，或逗号连接的多个 id（如 'a,b'）；同一筛选内多个值是「或」。 */
(function(root){
 'use strict';
 const list=v=>Array.isArray(v)?v.map(String).filter(Boolean):(v==null||v===''||v==='all'?[]:String(v).split(',').filter(x=>x&&x!=='all'));
 const has=(v,id)=>{const a=list(v);return !a.length||a.includes(String(id));};
 const toggle=(v,id)=>{const a=list(v),i=a.indexOf(String(id));if(i<0)a.push(String(id));else a.splice(i,1);return a.length?a.join(','):'all';};
 function matches(f,query){const hay=[f.cn,f.cnZh,f.cnDb,f.en,f.o,f.dir,f.dirO,f.c,(f.cast||[]).join(' '),f.version].filter(Boolean).join(' ').toLocaleLowerCase();return String(query||'').toLocaleLowerCase().split(/\s+/).filter(Boolean).every(w=>hay.includes(w));}
 function inProgramme(f,id,ctx){const a=list(id);return !a.length||a.some(p=>(f.prog||ctx.programmeOf?.(f))===p||(ctx.programmeIds?.(f)||[]).includes(p)||ctx.shows.some(s=>s.id===f.id&&ctx.showProgramme(s)===p));}
 function inCity(f,city,ctx){const c=list(city);return !c.length||ctx.shows.some(s=>s.id===f.id&&ctx.cityOfShow&&c.includes(ctx.cityOfShow(s))&&has(ctx.programme,ctx.showProgramme(s)));}
 const minutes=t=>{const m=/^(\d{1,2}):(\d{2})$/.exec(String(t||''));return m?+m[1]*60+(+m[2]):NaN;};
 function status(f,ctx){
  const shows=ctx.shows.filter(s=>s.id===f.id&&has(ctx.programme,ctx.showProgramme(s))&&has(ctx.city,ctx.cityOfShow&&ctx.cityOfShow(s)));
  const rec=ctx.watched[f.id],seen=!!(rec&&!rec.del&&rec.d);
  return {planned:shows.some(s=>ctx.picked.has(ctx.keyOf(s))),watched:seen,event:shows.some(s=>/^\s*(?:映后活动|映后交流|Post-screening event|Q&A)/i.test((f.screeningNotes||{})[ctx.keyOf(s)]||'')||!!(f.qaGuest&&minutes(f.qaEnd)>minutes(f.qaStart)))};
 }
 function category(f,mode,ctx){const m=list(mode);if(!m.length)return true;const s=status(f,ctx);return m.some(k=>k==='planned'?s.planned:k==='watched'?s.watched:k==='unwatched'?!s.watched:k==='qa'?s.event:false);}
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
 const api={matches,inProgramme,inCity,status,category,list,has,toggle,featuredProgrammes,posterColumns,posterPeriod,posterPeriods,posterEntries,posterPeriodLabel,posterTitle};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SparrowLibrary=api;
})(typeof window!=='undefined'?window:this);
