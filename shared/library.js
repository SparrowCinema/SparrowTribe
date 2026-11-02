/* Film-library membership. Shared by the website and mini-program. */
(function(root){
 'use strict';
 function matches(f,query){const hay=[f.cn,f.cnZh,f.en,f.o,f.dir,f.dirO,f.c,(f.cast||[]).join(' '),f.version].filter(Boolean).join(' ').toLocaleLowerCase();return String(query||'').toLocaleLowerCase().split(/\s+/).filter(Boolean).every(w=>hay.includes(w));}
 function inProgramme(f,id,ctx){return id==='all'||(f.prog||ctx.programmeOf?.(f))===id||ctx.shows.some(s=>s.id===f.id&&ctx.showProgramme(s)===id);}
 const minutes=t=>{const m=/^(\d{1,2}):(\d{2})$/.exec(String(t||''));return m?+m[1]*60+(+m[2]):NaN;};
 function status(f,ctx){
  const shows=ctx.shows.filter(s=>s.id===f.id&&(ctx.programme==='all'||ctx.showProgramme(s)===ctx.programme));
  const rec=ctx.watched[f.id],seen=!!(rec&&!rec.del&&rec.d);
  return {planned:shows.some(s=>ctx.picked.has(ctx.keyOf(s))),watched:seen,event:shows.some(s=>/^\s*(?:映后活动|映后交流|Post-screening event|Q&A)/i.test((f.screeningNotes||{})[ctx.keyOf(s)]||'')||!!(f.qaGuest&&minutes(f.qaEnd)>minutes(f.qaStart)))};
 }
 function category(f,mode,ctx){if(mode==='all')return true;const s=status(f,ctx);return mode==='planned'?s.planned:mode==='watched'?s.watched:mode==='unwatched'?!s.watched:mode==='qa'?s.event:false;}
 const api={matches,inProgramme,status,category};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SparrowLibrary=api;
})(typeof window!=='undefined'?window:this);
