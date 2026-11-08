// The same aggregate RPC used by the website; never reads other users' plans.
const cloud=require('wx-server-sdk'),https=require('https');
cloud.init({env:cloud.DYNAMIC_CURRENT_ENV});
const HOST='dclxhxxjktegyiwafmsv.supabase.co',KEY='sb_publishable_2K9O3h8nn2I_I-cIAdks8A_QZ98xwZ2';
exports.main=async event=>{try{
 const read=event.action==='read';if(!read&&event.action!=='vote')return {ok:false,reason:'invalid'};
 const ids=event.films;if(read&&ids!=null&&(!Array.isArray(ids)||ids.length>500))return {ok:false,reason:'invalid'};
 if(!read){const {OPENID}=cloud.getWXContext();if(!OPENID)return {ok:false,reason:'identity'};const binding=await cloud.database().collection('psync_bind').doc(OPENID).get();if(binding.data?.code!==event.code)return {ok:false,reason:'identity'};}
 const body=read?{films:ids||null}:{code:event.code,film:event.film,fun:event.fun,bore:event.bore,revision:event.revision};
 return await new Promise((resolve,reject)=>{const data=JSON.stringify(body),req=https.request({host:HOST,path:'/rest/v1/rpc/'+(read?'st_taste_read':'st_taste_vote'),method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}},res=>{let b='';res.setEncoding('utf8');res.on('data',c=>{b+=c;if(b.length>200000)req.destroy(Error('Too large'));});res.on('end',()=>{try{if(res.statusCode>=300)return reject(Error('Community unavailable'));resolve(JSON.parse(b));}catch(e){reject(e);}});});req.setTimeout(8000,()=>req.destroy(Error('timeout')));req.on('error',reject);req.end(data);});
 }catch(e){return {ok:false,reason:'unavailable'};}};
