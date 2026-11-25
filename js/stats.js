/* js/stats.js — 匿名使用统计与 #stats 页面。
   网站脚本按功能拆成 js/*.js，按 index.html 里的顺序加载；部署时 tools/build-assets.js 按同样顺序合并成一个 app.js。 */
/* ===== 使用统计（2026-11-16）=====
   匿名、按天汇总：只上报「事件名 + 影片/专题 id 或页面类型」，不上报搜索词、个人档案、IP 以外的任何信息（IP 也不入库）。
   访客标识每天在本机重新随机生成（sparrow-stat-vid），只用来数当天的设备数，跨天无法关联。
   浏览器开启「请勿追踪」/ GPC、本地预览、网址带 ?now= 调试时不上报。后端 backend/stats-v1.sql 的 ss_hit 还没建好（404）时自动停止。
   汇总页：#stats（不在菜单里）。 */
const ST={q:[],off:false,searched:false};
function statVid(){const day=new Date(Date.now()+8*3600e3).toISOString().slice(0,10);let o={};try{o=JSON.parse(localStorage.getItem('sparrow-stat-vid')||'{}')||{};}catch{}
  if(o.d!==day||!/^[a-z0-9]{8,32}$/.test(o.v||'')){const b=new Uint8Array(12);(window.crypto||{}).getRandomValues?crypto.getRandomValues(b):b.forEach((x,i)=>b[i]=Math.random()*256);o={d:day,v:Array.from(b,x=>(x%36).toString(36)).join('')};try{localStorage.setItem('sparrow-stat-vid',JSON.stringify(o));}catch{}}return o.v;}
const statOff=()=>ST.off||navigator.doNotTrack==='1'||window.doNotTrack==='1'||navigator.globalPrivacyControl===true||/^(localhost|127\.|\[::1\])/.test(location.hostname)||location.protocol==='file:'||new URLSearchParams(location.search).has('now');
function stat(e,k){if(statOff())return;ST.q.push({e,k:String(k==null?'':k).replace(/[^A-Za-z0-9_:.\-]/g,'').slice(0,80)});if(ST.q.length>=40)statFlush();}
function statFlush(){if(statOff()||!ST.q.length)return;const evs=ST.q.splice(0,60);
  try{fetch(SB_API+'ss_hit',{method:'POST',keepalive:true,headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY,'Content-Type':'application/json'},body:JSON.stringify({p:'web',vid:statVid(),evs})}).then(r=>{if(r.status===404||r.status===400)ST.off=true;}).catch(()=>{});}catch{}}
setInterval(statFlush,30000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')statFlush();});
window.addEventListener('pagehide',statFlush);
const statRouteKind=h=>h.startsWith('film-')?'film':h.startsWith('prog-')?'prog':h.startsWith('events-')?'events':h.startsWith('share=')?'share-in':/^[a-z-]{1,24}$/.test(h)?h:'other';
async function statsPage(){main.innerHTML='<section class="view gut">'+subBackHTML()+'<div class="page-heading"><div><small>USAGE</small><h1 class="sec">使用统计</h1></div></div><p class="local-note" id="st-body">读取中…</p></section>';
  let d;try{d=await sbRpc('ss_summary',{days:30});}catch(e){document.getElementById('st-body').textContent=tr('统计后端还没有启用：请在 Supabase 执行 backend/stats-v1.sql。');return;}
  const el=document.getElementById('st-body');if(!el)return;el.className='';
  const days=[...new Set([...d.visitors.map(x=>x.day),...d.events.map(x=>x.day)])].sort().reverse();
  const v=(day,p)=>(d.visitors.find(x=>x.day===day&&x.platform===p)||{}).n||0;
  const evn=(day,ev)=>d.events.filter(x=>x.day===day&&x.ev===ev).reduce((a,x)=>a+x.n,0);
  const tot=ev=>d.events.filter(x=>x.ev===ev).reduce((a,x)=>a+x.n,0);
  const name=(ev,k)=>ev==='film'||ev==='plan_add'||ev==='want'||ev==='watched'?(F[k]?F[k].cn:k):ev==='prog'?(PG[k]?PG[k].name:k):k;
  const top=ev=>d.top.filter(x=>x.ev===ev).slice(0,10);
  const lab={pv:'页面浏览',film:'影片页',prog:'专题页',plan_add:'加入排片',plan_remove:'移出排片',want:'标想看',watched:'盖章',share:'分享',export:'导出',remind:'开场提醒',sync_link:'连接同步',search:'搜索'};
  const sum=['pv','film','plan_add','want','watched','share','export','remind','sync_link','search'];
  el.innerHTML='<p class="local-note">'+tr('最近 30 天 · 匿名汇总 · 访客为每天的设备数')+'</p>'+
   '<div class="st-cards">'+sum.map(k=>'<div><b>'+tot(k)+'</b><small>'+tr(lab[k])+'</small></div>').join('')+'</div>'+
   '<h3 class="my-group">'+tr('每日')+'</h3><div class="st-table"><table><thead><tr><th>'+tr('日期')+'</th><th>'+tr('网站访客')+'</th><th>'+tr('小程序访客')+'</th><th>'+tr('页面浏览')+'</th><th>'+tr('加入排片')+'</th><th>'+tr('盖章')+'</th></tr></thead><tbody>'+
   (days.length?days.map(day=>'<tr><td>'+day.slice(5)+'</td><td>'+v(day,'web')+'</td><td>'+v(day,'mini')+'</td><td>'+evn(day,'pv')+'</td><td>'+evn(day,'plan_add')+'</td><td>'+evn(day,'watched')+'</td></tr>').join(''):'<tr><td colspan="6">'+tr('还没有数据')+'</td></tr>')+'</tbody></table></div>'+
   [['film','看得最多的影片'],['plan_add','加入排片最多'],['want','最多人想看'],['prog','看得最多的专题'],['pv','页面']].map(([ev,t])=>{const r=top(ev);return r.length?'<h3 class="my-group">'+tr(t)+'</h3><ol class="st-top">'+r.map(x=>'<li><span>'+esc(name(ev,x.key))+'</span><b>'+x.n+'</b></li>').join('')+'</ol>':'';}).join('');}
