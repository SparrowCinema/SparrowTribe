// The same aggregate RPC used by the website; never reads other users' plans.
// 2026-11-25：新增 action:'portrait'，将个人看过摘要转发到 Supabase Edge Function (smooth-processor) 生成 AI 观影评语，不存库。
// 2026-11-26：按微信号 OPENID 限制短时间生成次数（默认 1 小时最多 3 次、24 小时最多 5 次），防刷 API。
const cloud=require('wx-server-sdk'),https=require('https'),crypto=require('crypto');
cloud.init({env:cloud.DYNAMIC_CURRENT_ENV});
const HOST='dclxhxxjktegyiwafmsv.supabase.co',KEY='sb_publishable_2K9O3h8nn2I_I-cIAdks8A_QZ98xwZ2';
const HOUR_MS=60*60*1000,DAY_MS=24*60*60*1000;
const HOUR_LIMIT=Math.max(1,Number(process.env.PORTRAIT_HOUR_LIMIT||3));
const DAY_LIMIT=Math.max(HOUR_LIMIT,Number(process.env.PORTRAIT_DAY_LIMIT||5));
const memHits=new Map(),inFlight=new Set();

function postJson(path,body,timeoutMs){
 return new Promise((resolve,reject)=>{
  const data=JSON.stringify(body),req=https.request({host:HOST,path,method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}},res=>{
   let b='';res.setEncoding('utf8');
   res.on('data',c=>{b+=c;if(b.length>200000)req.destroy(Error('Too large'));});
   res.on('end',()=>{let j=null;try{j=JSON.parse(b);}catch(e){}resolve({status:res.statusCode||0,json:j});});
  });
  req.setTimeout(timeoutMs||8000,()=>req.destroy(Error('timeout')));
  req.on('error',reject);req.end(data);
 });
}

function evalLimit(rawTs,now){
 const ts=(Array.isArray(rawTs)?rawTs:[]).map(Number).filter(t=>Number.isFinite(t)&&t>now-DAY_MS&&t<=now+60000).sort((a,b)=>a-b);
 const hr=ts.filter(t=>t>now-HOUR_MS);
 if(hr.length>=HOUR_LIMIT)return {ok:false,scope:'hour',limit:HOUR_LIMIT,retryAfterSec:Math.max(60,Math.ceil((hr[0]+HOUR_MS-now)/1000)),ts};
 if(ts.length>=DAY_LIMIT)return {ok:false,scope:'day',limit:DAY_LIMIT,retryAfterSec:Math.max(60,Math.ceil((ts[0]+DAY_MS-now)/1000)),ts};
 return {ok:true,ts};
}

async function readQuota(openid,now){
 const db=cloud.database(),col=db.collection('ai_portrait_rl');
 const mem=memHits.get(openid)||[];
 try{
  const r=await col.doc(openid).get();
  const dbTs=r&&r.data&&Array.isArray(r.data.ts)?r.data.ts:[];
  const base=dbTs.length>=mem.length?dbTs:mem;
  return evalLimit(base,now);
 }catch(e){
  return evalLimit(mem,now);
 }
}

async function saveQuota(openid,prevTs,now){
 const next=prevTs.filter(t=>t>now-DAY_MS).concat([now]).slice(-Math.max(DAY_LIMIT+2,10));
 memHits.set(openid,next);
 const db=cloud.database(),col=db.collection('ai_portrait_rl'),data={ts:next,at:now};
 try{await col.doc(openid).set({data});}
 catch(e){try{await db.createCollection('ai_portrait_rl');}catch(_){}try{await col.doc(openid).set({data});}catch(_){}}
}

exports.main=async event=>{try{
 if(event&&event.action==='portrait'){
  const p=event.payload&&typeof event.payload==='object'?event.payload:null;
  if(!p||!Array.isArray(p.topFilms)||p.topFilms.length<3)return {ok:false,reason:'too_few_films'};
  const {OPENID}=cloud.getWXContext();
  const uid=OPENID||'anon';
  if(inFlight.has(uid))return {ok:false,reason:'rate_limited',scope:'hour',retryAfterSec:60,limit:HOUR_LIMIT};
  const now=Date.now();
  const quota=OPENID?await readQuota(OPENID,now):evalLimit(memHits.get(uid)||[],now);
  if(!quota.ok)return {ok:false,reason:'rate_limited',scope:quota.scope,retryAfterSec:quota.retryAfterSec,limit:quota.limit};
  inFlight.add(uid);
  try{
   const clientKey=OPENID?crypto.createHash('sha256').update('sparrow-portrait:'+OPENID).digest('hex').slice(0,32):'';
   const reqBody=Object.assign({},p,{action:'taste_portrait'});
   if(clientKey)reqBody.clientKey=clientKey;
   const r=await postJson('/functions/v1/smooth-processor',reqBody,22000);
   if(r.status>=200&&r.status<300&&r.json&&r.json.ok&&r.json.portrait){
    if(OPENID)await saveQuota(OPENID,quota.ts,Date.now());
    else memHits.set(uid,quota.ts.concat([Date.now()]));
    return {ok:true,portrait:r.json.portrait,model:r.json.model||''};
   }
   const reason=(r.json&&r.json.reason)||(r.status===429?'rate_limited':'unavailable');
   const out={ok:false,reason};
   if(reason==='rate_limited'){
    if(r.json&&r.json.scope)out.scope=r.json.scope;
    if(r.json&&r.json.retryAfterSec)out.retryAfterSec=r.json.retryAfterSec;
    if(r.json&&r.json.limit)out.limit=r.json.limit;
   }
   return out;
  }finally{inFlight.delete(uid);}
 }
 const read=event.action==='read';if(!read&&event.action!=='vote')return {ok:false,reason:'invalid'};
 const ids=event.films;if(read&&ids!=null&&(!Array.isArray(ids)||ids.length>500))return {ok:false,reason:'invalid'};
 if(!read){const {OPENID}=cloud.getWXContext();if(!OPENID)return {ok:false,reason:'identity'};const binding=await cloud.database().collection('psync_bind').doc(OPENID).get();if(binding.data?.code!==event.code)return {ok:false,reason:'identity'};}
 const body=read?{films:ids||null}:{code:event.code,film:event.film,fun:event.fun,bore:event.bore,revision:event.revision};
 const r=await postJson('/rest/v1/rpc/'+(read?'st_taste_read':'st_taste_vote'),body,8000);
 if(r.status>=300||!r.json)return {ok:false,reason:'unavailable'};
 return r.json;
}catch(e){return {ok:false,reason:'unavailable'};}};
