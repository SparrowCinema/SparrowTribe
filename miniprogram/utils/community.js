const Client=require('./taste-client.js'),Taste=require('./taste.js'),W=require('./watched.js');
const KEY='sk-taste-outbox-v1';let observed={};
const client=Client.create({defer:f=>setTimeout(f,0),load:()=>{try{return wx.getStorageSync(KEY)||{};}catch{return {};}},save:v=>wx.setStorageSync(KEY,v),rpc:(fn,body)=>wx.cloud.callFunction({name:'taste',data:{action:fn==='st_taste_read'?'read':'vote',...body}}).then(r=>r.result)});
function identity(){try{return wx.getStorageSync('sk-sync')?.code||'';}catch{return '';}}
function changed(){const code=identity();if(!code)return;const current=W.all();Object.keys(current).forEach(id=>{const r=current[id],signature=JSON.stringify([code,r.fun,r.bore,r.tastePublic,r.del]),old=observed[id];if(old?.signature===signature)return;observed[id]={signature,published:Taste.publicVote(r)};if(Taste.publicVote(r)||old?.published)client.enqueue(code,id,r);});}
function init(){W.onChange(changed);changed();client.flush();}
function model(id){const a=client.get(id),r=W.get(id);return {fun:a&&a.funAvg!=null?a.funAvg.toFixed(1)+'/5':'—',bore:a&&a.boreAvg!=null?a.boreAvg.toFixed(1)+'/5':'—',funN:a?.funN||0,boreN:a?.boreN||0,available:!!a,pending:client.pending(id),published:!!r?.tastePublic,eligible:!!r&&(Taste.valid(r.fun)||Taste.valid(r.bore))};}
module.exports={...client,identity,changed,init,model};
