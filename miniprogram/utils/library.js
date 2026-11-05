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
 const api={matches,inProgramme,inCity,status,category,list,has,toggle};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SparrowLibrary=api;
})(typeof window!=='undefined'?window:this);
