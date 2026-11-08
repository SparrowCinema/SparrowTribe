/* Transport-neutral community client: one durable, latest-write-wins outbox per
   film; no private passport fields are sent. A failed request never marks a vote
   as published. Queue credentials are local only and excluded from backups. */
(function(root){
 'use strict';
 function create(o){let pending={},busy=null,cache={},status='idle',generation=0,loadedAll=false;const subs=[];const loaded=o.load();if(loaded&&typeof loaded==='object'&&!Array.isArray(loaded))Object.values(loaded).forEach(j=>{if(j&&typeof j.code==='string'&&/^[\w-]{1,80}$/.test(j.film)&&Number.isSafeInteger(j.revision)&&j.revision>=0&&['fun','bore'].every(k=>j[k]===null||Number.isInteger(j[k])&&j[k]>=0&&j[k]<=5))pending[j.code+'|'+j.film]=j;});
  const emit=()=>subs.forEach(f=>f()),persist=()=>{o.save(pending);emit();};
  const key=j=>j.code+'|'+j.film;
  function enqueue(code,film,rec){if(!code||!/^[\w-]{1,80}$/.test(film))return;const j={code,film,fun:rec?.tastePublic===true&&!rec.del?rec.fun:null,bore:rec?.tastePublic===true&&!rec.del?rec.bore:null,revision:(!rec?.del&&Math.max(0,...['fun','bore','tastePublic'].map(k=>Number.isSafeInteger(rec?.tasteAt?.[k])?rec.tasteAt[k]:0)))||Math.max(0,Number(rec?.t)||0)};['fun','bore'].forEach(k=>{if(!Number.isInteger(j[k])||j[k]<0||j[k]>5)j[k]=null;});pending[key(j)]=j;persist();return flush();}
  async function flush(){if(busy)return busy;busy=(async()=>{status='busy';emit();try{for(const k of Object.keys(pending)){const j=pending[k];const r=await o.rpc('st_taste_vote',{code:j.code,film:j.film,fun:j.fun,bore:j.bore,revision:j.revision});if(r?.reason==='stale'){if(pending[k]===j){delete pending[k];persist();}continue;}if(!r||r.ok!==true)throw Error('Community unavailable');if(pending[k]===j){delete pending[k];persist();}if(r.summary){generation++;cache[j.film]=r.summary;}}status=Object.keys(pending).length?'pending':'ok';}catch(e){status='error';}finally{busy=null;emit();if(status==='pending'&&o.defer)o.defer(flush);}})();return busy;}
  async function read(ids){const gen=generation;const r=await o.rpc('st_taste_read',{films:ids});if(!r||r.version!==1||!Array.isArray(r.films))throw Error('Community unavailable');if(gen===generation){if(!ids){Object.keys(cache).forEach(k=>{delete cache[k];});loadedAll=true;}else ids.forEach(id=>{cache[id]=empty(id);});r.films.forEach(x=>{cache[x.id]=x;});}emit();return r.films;}
  // A whole-catalogue read lists only rated films; any other film has zero ratings.
  const empty=id=>({id,funN:0,funAvg:null,boreN:0,boreAvg:null,pairN:0,pairFun:null,pairBore:null});
  return {enqueue,flush,read,get:id=>cache[id]||(loadedAll?empty(id):undefined),status:()=>status,pending:film=>Object.values(pending).some(j=>j.film===film),subscribe:f=>{subs.push(f);return()=>{const i=subs.indexOf(f);if(i>=0)subs.splice(i,1);};}};
 }
 const api={create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SparrowTasteClient=api;
})(typeof window!=='undefined'?window:this);
