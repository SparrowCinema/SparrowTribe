const Client=require('./taste-client.js'),Taste=require('./taste.js'),W=require('./watched.js'),Sync=require('./sync.js');
const KEY='sk-taste-outbox-v1',SEEN='sk-taste-observed-v1';
// 已经送进社区队列的评分签名存在本机（2026-11-22）：以前只在内存里，每次启动都把全部公开评分重新排队、逐张投票
let observed=(()=>{try{const v=wx.getStorageSync(SEEN);return v&&typeof v==='object'?v:{};}catch{return {};}})();
const saveSeen=()=>{try{wx.setStorageSync(SEEN,observed);}catch{}};
const client=Client.create({defer:f=>setTimeout(f,0),load:()=>{try{return wx.getStorageSync(KEY)||{};}catch{return {};}},save:v=>wx.setStorageSync(KEY,v),beforeVote:job=>job.code===identity()?Sync.syncBeforeVote():null,rpc:(fn,body)=>wx.cloud.callFunction({name:'taste',data:{action:fn==='st_taste_read'?'read':'vote',...body}}).then(r=>r.result)});
function identity(){try{return wx.getStorageSync('sk-sync')?.code||'';}catch{return '';}}
function changed(){const code=identity();if(!code)return;const current=W.all();let dirty=false;Object.keys(current).forEach(id=>{const r=current[id],signature=JSON.stringify([code,r.fun,r.bore,r.tastePublic,r.del]),old=observed[id];if(old?.signature===signature)return;observed[id]={signature,published:Taste.publicVote(r)};dirty=true;if((r.d&&!r.del&&r.tastePublic===true)||old?.published)client.enqueue(code,id,r);});if(dirty)saveSeen();}
function withdraw(id){
 const rec=W.get(id);if(!identity()||!Taste.publicVote(rec))return;
 if(!observed[id]?.published){observed[id]={published:true};saveSeen();}
 W.set(id,Taste.set(rec,'tastePublic',false));
}
function init(){W.onChange(changed);wx.onNetworkStatusChange?.(r=>{if(r.isConnected){changed();client.flush();}});changed();client.flush();}
// 与网页 communityHTML 相同：每项人数 + 平均星级（按比例填充）；不足 3 人显示样本不足
function dim(a,key,en){const n=a?a[key+'N']||0:0,avg=a&&a[key+'Avg']!=null?Number(a[key+'Avg']):null;return {n,avg:avg!=null?avg.toFixed(1):'',stars:avg!=null?[1,2,3,4,5].map(i=>Math.round(Math.max(0,Math.min(1,avg-(i-1)))*100)):[],low:avg!=null?'':!a?'—':n?(en?'Too few · '+(3-n)+' more needed':'样本不足 · 还差 '+(3-n)+' 人'):(en?'No ratings yet':'暂无评价')};}
function model(id,en){const a=client.get(id),r=W.get(id);return {fun:dim(a,'fun',en),bore:dim(a,'bore',en),available:!!a,pending:client.pending(id),published:Taste.publicVote(r),connected:!!identity()};}
module.exports={...client,identity,changed,withdraw,init,model};
