/* Independent 0–5 feelings. Missing/null is unrated; zero is a real rating.
   tasteAt carries field-level tombstones so an older client cannot erase a vote
   while changing the existing ten-point score or viewing date. */
(function(root){
 'use strict';
 const valid=v=>Number.isInteger(v)&&v>=0&&v<=5;
 const fields=['fun','bore','tastePublic'];
 const stamp=v=>Number.isSafeInteger(v)&&v>=0?v:0;
 function cleanFields(r){const o={},at={};fields.forEach(k=>{const t=stamp(r?.tasteAt?.[k]);if(k==='tastePublic'){if(typeof r?.[k]==='boolean')o[k]=r[k];}else if(valid(r?.[k]))o[k]=r[k];else if(r?.[k]===null&&t)o[k]=null;if(t)at[k]=t;});if(Object.keys(at).length)o.tasteAt=at;return o;}
 function mergeFields(a,b,base){const o=Object.assign({},base);if(o.del)return o;const at={};fields.forEach(k=>{const x=cleanFields(a||{}),y=cleanFields(b||{}),has=(r)=>Object.prototype.hasOwnProperty.call(r,k),tx=stamp(x.tasteAt?.[k])||(has(x)?stamp(a?.t):0),ty=stamp(y.tasteAt?.[k])||(has(y)?stamp(b?.t):0);const r=has(y)&&(!has(x)||ty>tx)?y:has(x)?x:null;if(r){o[k]=r[k];at[k]=r===y?ty:tx;}else delete o[k];});if(Object.keys(at).length)o.tasteAt=at;else delete o.tasteAt;return o;}
 function set(r,key,value,at){if(!fields.includes(key)||key==='tastePublic'&&typeof value!=='boolean'||key!=='tastePublic'&&value!==null&&!valid(value))throw Error('Invalid taste rating');const o=Object.assign({},r),t=Math.max(stamp(at)||Date.now(),stamp(r.t)+1,...Object.values(r.tasteAt||{}).map(stamp).map(x=>x+1));o[key]=value;o.t= t;o.tasteAt=Object.assign({},r.tasteAt,{[key]:t});return o;}
 function toggle(r,key,value,at){return set(r,key,r[key]===value?null:value,at);}
 function quadrant(x,y){return !Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>5||y>5||x===3||y===3?-1:y>3?(x>3?1:0):(x>3?3:2);}
 const names=[['漫长难熬','Enduring'],['迷人又折磨','Captivating & tiring'],['平静无波','Quiet'],['趣味横生','Delightful']];
 function map(entries,en){const counts=[0,0,0,0],groups=new Map();let unsure=0;entries.forEach(e=>{const r=e.rec;if(!r||!(e.community?Number.isFinite(r.fun)&&r.fun>=0&&r.fun<=5:valid(r.fun))||!(e.community?Number.isFinite(r.bore)&&r.bore>=0&&r.bore<=5:valid(r.bore))||r.del||e.f?.ev)return;const q=quadrant(r.fun,r.bore);if(q<0)unsure++;else counts[q]++;const key=r.fun+'-'+r.bore;if(!groups.has(key))groups.set(key,{key,x:8+r.fun*16.8,y:92-r.bore*16.8,fun:r.fun,bore:r.bore,entries:[]});groups.get(key).entries.push({id:e.id,title:e.f.cn,fun:r.fun,bore:r.bore});});const points=[...groups.values()].map(g=>Object.assign(g,{n:g.entries.length}));return {n:counts.reduce((a,b)=>a+b,0)+unsure,points,quadrants:names.map((x,i)=>({name:x[en?1:0],count:counts[i],index:i})),unsure};}
 function publicVote(rec){return !!rec&&!rec.del&&!!rec.d&&rec.tastePublic===true&&(valid(rec.fun)||valid(rec.bore));}
 const api={valid,fields,cleanFields,mergeFields,set,toggle,quadrant,map,names,publicVote};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SparrowTaste=api;
})(typeof window!=='undefined'?window:this);
