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
exports.main=async event=>{try{
 if(event&&event.action==='portrait'){
  const p=event.payload&&typeof event.payload==='object'?event.payload:null;
  if(!p||!Array.isArray(p.topFilms)||p.topFilms.length<3)return {ok:false,reason:'too_few_films'};
  const r=await postJson('/functions/v1/smooth-processor',Object.assign({},p,{action:'taste_portrait'}),45000); // 云函数超时 50 秒（config.json），留 5 秒把结果交回去
  if(r.status>=200&&r.status<300&&r.json&&r.json.ok&&r.json.portrait)return {ok:true,portrait:r.json.portrait,model:r.json.model||''};
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
