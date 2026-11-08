/* Portable user-owned backups; credentials are deliberately excluded. */
(function(root){
 'use strict';
 const S=typeof module!=='undefined'&&module.exports?require('./psync.js'):root.SparrowSync;
 function encode(profile,at){return {format:'sparrow-film-passport',version:1,exportedAt:new Date(at||Date.now()).toISOString(),profile:S.clean(profile)};}
 function decode(input){
  if(!input||input.format!=='sparrow-film-passport'||input.version!==1||!input.profile||input.profile.v!==1)throw new Error('Invalid passport backup');
  const d=input.profile;
  if(!d.watched||typeof d.watched!=='object'||Array.isArray(d.watched)||!d.holder||typeof d.holder.n!=='string'||!d.photo||typeof d.photo.d!=='string'||!d.picks||!Array.isArray(d.picks.k))throw new Error('Incomplete passport backup');
  if(JSON.stringify(d).length>2500000||Object.keys(d.watched).length>12000||d.picks.k.length>2000)throw new Error('Backup too large');
  for(const id of Object.keys(d.watched)){if(['__proto__','constructor','prototype'].includes(id))throw new Error('Invalid film key');const r=d.watched[id];if(r&&!r.del){const dt=new Date(String(r.d)+'T12:00:00Z');if(!Number.isFinite(dt.getTime())||dt.toISOString().slice(0,10)!==r.d)throw new Error('Invalid viewing date');}}
  const out=S.clean(d);
  // Never silently discard part of a purportedly complete backup.
  if(Object.keys(out.watched).length!==Object.keys(d.watched).length||out.photo.d!==d.photo.d||out.holder.n!==d.holder.n||out.picks.k.length!==d.picks.k.length)throw new Error('Invalid passport data');
  return out;
 }
 function restore(local,backup,at){
  local=S.clean(local);backup=decode(backup);const t=at||Date.now();
  Object.keys(backup.watched).forEach(id=>{backup.watched[id].t=t;if(backup.watched[id].tasteAt)Object.keys(backup.watched[id].tasteAt).forEach(k=>backup.watched[id].tasteAt[k]=t);});
  ['holder','photo','picks'].forEach(k=>{backup[k].t=t;});
  // Preserve planned screenings already present on the importing device.
  backup.picks.k=[...new Set(local.picks.k.concat(backup.picks.k))];
  return S.merge(local,backup);
 }
 function empty(remote,at){remote=S.clean(remote);const out=S.clean({}),t=Math.max(at||Date.now(),...Object.values(remote.watched).map(r=>r.t+1),...['holder','photo','picks'].map(k=>remote[k].t+1));Object.keys(remote.watched).forEach(id=>{out.watched[id]={del:1,t};});['holder','photo','picks'].forEach(k=>out[k].t=t);return out;}
 const api={encode,decode,restore,empty};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SparrowBackup=api;
})(typeof window!=='undefined'?window:this);
