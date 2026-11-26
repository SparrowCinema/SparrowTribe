// The same aggregate RPC used by the website; never reads other users' plans.
// 2026-11-25：新增 action:'portrait'，将个人看过摘要转发到 Supabase Edge Function (smooth-processor) 生成 AI 观影评语，不存库。
const cloud=require('wx-server-sdk'),https=require('https');
cloud.init({env:cloud.DYNAMIC_CURRENT_ENV});
const HOST='dclxhxxjktegyiwafmsv.supabase.co',KEY='sb_publishable_2K9O3h8nn2I_I-cIAdks8A_QZ98xwZ2';
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
// AI 画像生成次数：按微信账号（OPENID）计数，1 小时最多 3 次、24 小时最多 8 次（与 shared/taste-portrait.js 的 QUOTA 一致）。
// 记录在云数据库集合 ai_quota（文档 _id = OPENID，ts = 最近 24 小时的调用时间）；集合不存在时自动创建。AI 调用失败会退回这一次。
const QUOTA={hour:3,day:8},HOUR=36e5,DAY=864e5;
async function quotaTake(openid){
 const db=cloud.database(),col=db.collection('ai_quota'),now=Date.now();
 let ts=[];
 try{const r=await col.doc(openid).get();ts=(r.data&&r.data.ts)||[];}
 catch(e){if(/not exist|DATABASE_COLLECTION_NOT_EXIST|-502005/i.test(String(e&&(e.errMsg||e.message||e.errCode)))){try{await db.createCollection('ai_quota');}catch(e2){}}}
 ts=ts.filter(t=>typeof t==='number'&&t>now-DAY).sort((a,b)=>a-b);
 const inHour=ts.filter(t=>t>now-HOUR);let wait=0;
 if(inHour.length>=QUOTA.hour)wait=Math.max(wait,inHour[inHour.length-QUOTA.hour]+HOUR-now);
 if(ts.length>=QUOTA.day)wait=Math.max(wait,ts[ts.length-QUOTA.day]+DAY-now);
 if(wait>0)return {ok:false,waitMs:Math.ceil(wait)};
 ts.push(now);await col.doc(openid).set({data:{ts}});
 return {ok:true,at:now,left:Math.min(QUOTA.hour-inHour.length-1,QUOTA.day-ts.length)};
}
async function quotaRefund(openid,at){try{const col=cloud.database().collection('ai_quota'),r=await col.doc(openid).get();const ts=((r.data&&r.data.ts)||[]).filter(t=>t!==at);await col.doc(openid).set({data:{ts}});}catch(e){}}
exports.main=async event=>{try{
 if(event&&event.action==='portrait'){
  const p=event.payload&&typeof event.payload==='object'?event.payload:null;
  if(!p||!Array.isArray(p.topFilms)||p.topFilms.length<3)return {ok:false,reason:'too_few_films'};
  const {OPENID}=cloud.getWXContext();if(!OPENID)return {ok:false,reason:'identity'};
  const q=await quotaTake(OPENID);if(!q.ok)return {ok:false,reason:'quota',waitMs:q.waitMs};
  let r;try{r=await postJson('/functions/v1/smooth-processor',Object.assign({},p,{action:'taste_portrait'}),45000);}catch(e){await quotaRefund(OPENID,q.at);throw e;} // 云函数超时 50 秒（config.json），留 5 秒把结果交回去
  if(r.status>=200&&r.status<300&&r.json&&r.json.ok&&r.json.portrait)return {ok:true,portrait:r.json.portrait,model:r.json.model||'',left:q.left};
  await quotaRefund(OPENID,q.at);
  return {ok:false,reason:(r.json&&r.json.reason)||(r.status===429?'rate_limited':'unavailable')};
 }
 const read=event.action==='read';if(!read&&event.action!=='vote')return {ok:false,reason:'invalid'};
 const ids=event.films;if(read&&ids!=null&&(!Array.isArray(ids)||ids.length>500))return {ok:false,reason:'invalid'};
 if(!read){const {OPENID}=cloud.getWXContext();if(!OPENID)return {ok:false,reason:'identity'};const binding=await cloud.database().collection('psync_bind').doc(OPENID).get();if(binding.data?.code!==event.code)return {ok:false,reason:'identity'};}
 const body=read?{films:ids||null}:{code:event.code,film:event.film,fun:event.fun,bore:event.bore,revision:event.revision};
 const r=await postJson('/rest/v1/rpc/'+(read?'st_taste_read':'st_taste_vote'),body,8000);
 if(r.status>=300||!r.json)return {ok:false,reason:'unavailable'};
 return r.json;
}catch(e){return {ok:false,reason:'unavailable'};}};
