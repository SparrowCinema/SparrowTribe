// 小程序「一直在同步」（2026-11-22）的回归测试：
// 1. 社区趣味评分一批投票只在开头同步一次档案（以前每张票同步一次，N 部公开评分 = 连续 N 次同步）；
// 2. 小程序 utils/sync.js 在云端合并结果和本机不一致时最多自动补同步 2 次（旧版 psync 云函数清掉新字段时不再转圈）。
const assert=require('assert'),fs=require('fs'),path=require('path');
const Client=require('../shared/taste-client.js');

(async()=>{
  // ——— 1. 投票前同步：一批只同步一次 ———
  let syncs=0,votes=0;const saved={};
  const c=Client.create({defer:f=>setTimeout(f,0),load:()=>({}),save:v=>Object.assign(saved,v),beforeVote:async()=>{syncs++;},
    rpc:async(fn,body)=>{votes++;return {ok:true,summary:{film:body.film}};}});
  const rec={d:'2026-11-01',fun:4,bore:1,tastePublic:true,t:5,tasteAt:{fun:5,bore:5,tastePublic:5}};
  for(let i=0;i<30;i++)c.enqueue('SP-CODE','f'+i,rec);
  for(let i=0;i<200&&(votes<30||c.status()==='busy'||c.status()==='pending');i++)await new Promise(r=>setTimeout(r,5));
  assert.equal(votes,30,'all 30 votes sent');
  // 第一张票开始发送时其余的还没排进来，所以是两批：两次同步（以前 30 次）
  assert(syncs<=2,'at most two profile syncs for 30 votes, got '+syncs);
  // 撤回（fun/bore 为空）不需要同步
  syncs=0;c.enqueue('SP-CODE','f1',{...rec,tastePublic:false});await c.flush();
  assert.equal(syncs,0,'withdraw needs no sync');

  // ——— 2. 小程序同步补同步次数有上限 ———
  const src=fs.readFileSync(path.join(__dirname,'../miniprogram/utils/sync.js'),'utf8');
  assert(/ECHO_MAX\s*=\s*2/.test(src),'echo cap defined');
  assert(/if \(\+\+echo <= ECHO_MAX\) dirty = true;/.test(src),'cloud-differs resync is capped');
  assert(/function changed\(\) \{ if \(applying\|\|clearing\) return; echo = 0;/.test(src),'real local change resets the cap');
  // 社区已排队签名持久化（网站与小程序）
  assert(/sk-taste-observed-v1/.test(fs.readFileSync(path.join(__dirname,'../miniprogram/utils/community.js'),'utf8')),'mini keeps observed votes');
  assert(/sparrow-taste-observed-v1/.test(fs.readFileSync(path.join(__dirname,'../js/sync.js'),'utf8')),'web keeps observed votes');
  console.log('PASS: sync quiet — 30 community votes → ≤2 profile syncs (was 30); cloud-differs resync capped at 2; queued votes remembered across launches.');
})().catch(e=>{console.error(e);process.exit(1);});
