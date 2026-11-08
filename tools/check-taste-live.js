// Explicit opt-in only: creates one synthetic passport, temporarily casts one
// real ballot, and withdraws it in finally. Never runs in normal CI or logs keys.
if(process.env.SPARROW_TASTE_LIVE!=='1')throw Error('Set SPARROW_TASTE_LIVE=1 to run the live integration check.');
const assert=require('node:assert/strict'),crypto=require('node:crypto'),S=require('../shared/psync.js');
const base='https://dclxhxxjktegyiwafmsv.supabase.co/rest/v1/',key='sb_publishable_2K9O3h8nn2I_I-cIAdks8A_QZ98xwZ2',code=S.newCode(n=>crypto.randomBytes(n)),film='amrum',t=Date.now();let created=false;
const rpc=async(fn,data)=>{const r=await fetch(base+'rpc/'+fn,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error(fn+' HTTP '+r.status);return r.json();};
(async()=>{try{const a=await rpc('st_taste_read',{films:[film]});assert.equal(a.version,1);assert(a.films.length===1);const n=a.films[0].funN;
 const profile=S.clean({watched:{[film]:{d:'2026-11-08',r:9,k:'',t,fun:0,bore:5,tastePublic:true,tasteAt:{fun:t,bore:t,tastePublic:t}}}});const push=await rpc('mg_push',{code,data:profile,base_rev:0});assert(push.ok);created=true;
 const pull=await rpc('mg_pull',{code});assert.equal(pull.data.watched[film].fun,0);assert.equal(pull.data.watched[film].bore,5);assert.equal(pull.data.watched[film].r,9);
 const j={code,film,fun:0,bore:5,revision:t};assert((await rpc('st_taste_vote',j)).ok);assert((await rpc('st_taste_vote',j)).ok);assert.equal((await rpc('st_taste_read',{films:[film]})).films[0].funN,n+1);
 assert((await rpc('st_taste_vote',{...j,fun:5,bore:0,revision:t+1})).ok);assert.equal((await rpc('st_taste_read',{films:[film]})).films[0].funN,n+1);
 assert((await rpc('st_taste_vote',{...j,fun:null,bore:null,revision:t+2})).ok);assert.equal((await rpc('st_taste_read',{films:[film]})).films[0].funN,n);
 const raw=await fetch(base+'ballots?limit=1',{headers:{apikey:key,Authorization:'Bearer '+key,'Accept-Profile':'sparrow_taste'}});assert(!raw.ok);
 console.log('PASS: live aggregate RPC, real passport round-trip (0/5 and 9/10), deduplicated vote, update, withdrawal and raw ballot isolation.');
 }finally{if(created){await rpc('st_taste_vote',{code,film,fun:null,bore:null,revision:t+100000});const p=await rpc('mg_pull',{code});await rpc('mg_push',{code,data:S.clean({watched:{[film]:{del:1,t:t+100000}}}),base_rev:p.rev});console.log('Synthetic verification vote withdrawn; test passport cleared.');}}})().catch(e=>{console.error(e.message);process.exitCode=1;});
