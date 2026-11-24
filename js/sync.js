/* js/sync.js — 个人档案云端同步、扫码连接、趣味评分社区、档案备份。
   网站脚本按功能拆成 js/*.js，按 index.html 里的顺序加载；部署时 tools/build-assets.js 按同样顺序合并成一个 app.js。 */
// —— 个人档案云端同步：同步码 + Supabase（与米其林全球名录共用同一个后端，不用注册）——
const SYNC_KEY='sparrow-sync',NOTES_KEY='sparrow-notes-v1',NOTE_PASS_KEY='sparrow-note-pass-v1',BACKUP_META_KEY='sparrow-backup-meta-v1',SB_API='https://dclxhxxjktegyiwafmsv.supabase.co/rest/v1/rpc/',SB_KEY='sb_publishable_2K9O3h8nn2I_I-cIAdks8A_QZ98xwZ2';
let profileClearing=false,syncSt=null,syncBusy=null,syncStatus={state:'idle',msg:'',at:0},syncReveal=false,syncMode='',syncPrint='',syncTimer=0,syncApplied=[],notesRev=0;
let filmNotes=(()=>{try{const v=JSON.parse(localStorage.getItem(NOTES_KEY)||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v:{};}catch{return {};}})();
let backupMeta=(()=>{try{const v=JSON.parse(localStorage.getItem(BACKUP_META_KEY)||'{}');return v&&typeof v==='object'?v:{};}catch{return {};}})();
function saveBackupMeta(){try{localStorage.setItem(BACKUP_META_KEY,JSON.stringify(backupMeta));}catch{}}
function notePass(){try{return localStorage.getItem(NOTE_PASS_KEY)||'';}catch{return '';}}
function saveFilmNotes(){notesRev++;try{localStorage.setItem(NOTES_KEY,JSON.stringify(filmNotes));}catch{toast(tr('浏览器未能保存，请检查存储空间'));}}
function privateNoteOf(id){
  const r=filmNotes[id]; if(!r||r.del) return null;
  if(typeof r.s==='string'&&r.s.trim()) return {text:r.s,tb:r.tb===1,rc:r.rc===1,locked:false,encrypted:!!r.enc,t:r.t||0};
  if(r.enc){
    const pass=notePass();
    if(pass&&typeof SparrowNotesCrypto!=='undefined'){
      try{
        const text=SparrowNotesCrypto.decrypt(r.enc,pass);
        return {text,tb:r.tb===1,rc:r.rc===1,locked:false,encrypted:true,t:r.t||0};
      }catch{}
    }
    return {text:'',tb:r.tb===1,rc:r.rc===1,locked:true,encrypted:true,t:r.t||0};
  }
  return null;
}
function savePrivateNote(id, text, opts){
  opts=opts||{}; const clean=String(text||'').trim().slice(0,1000), t=Date.now();
  if(!clean){filmNotes[id]={del:1,t};saveFilmNotes();return;}
  const entry={t,s:clean};
  if(opts.tb)entry.tb=1;
  if(opts.rc)entry.rc=1;
  const pass=notePass();
  if(pass&&pass.length>=4&&typeof SparrowNotesCrypto!=='undefined'){
    try{entry.enc=SparrowNotesCrypto.encrypt(clean,pass);}catch{}
  }
  filmNotes[id]=entry; saveFilmNotes();
}
function setNotePassphrase(pass){
  const p=String(pass||'');
  if(!p){try{localStorage.removeItem(NOTE_PASS_KEY);}catch{}return {ok:true,cleared:true};}
  if(p.length<4)return {ok:false,msg:tr('口令至少需要 4 位字符')};
  // Verify against any existing encrypted-only entries before accepting
  let unlocked=0, failed=0, encrypted=0;
  const next=JSON.parse(JSON.stringify(filmNotes));
  Object.keys(next).forEach(id=>{
    const r=next[id]; if(!r||r.del)return;
    if(r.enc&&!r.s){
      try{r.s=SparrowNotesCrypto.decrypt(r.enc,p);unlocked++;}catch{failed++;}
    }
  });
  if(failed>0&&unlocked===0)return {ok:false,msg:tr('口令与云端已有加密笔记不匹配，请检查')};
  try{localStorage.setItem(NOTE_PASS_KEY,p);}catch{return {ok:false,msg:tr('浏览器无法保存口令')};}
  Object.keys(next).forEach(id=>{
    const r=next[id]; if(!r||r.del||!r.s)return;
    r.enc=SparrowNotesCrypto.encrypt(r.s,p); r.t=Math.max(r.t||0,Date.now()); encrypted++;
  });
  filmNotes=next; saveFilmNotes();
  return {ok:true,unlocked,encrypted};
}
function notesForCloud(){
  const out={};
  Object.keys(filmNotes).forEach(id=>{
    const r=filmNotes[id]; if(!r)return;
    if(r.del){out[id]={del:1,t:r.t||0};return;}
    // Never upload plaintext s to Supabase — only E2E encrypted enc!
    if(r.enc){const o={t:r.t||0,enc:r.enc};if(r.tb===1)o.tb=1;if(r.rc===1)o.rc=1;out[id]=o;}
  });
  return out;
}
function mergeCloudNotes(remoteNotes){
  if(!remoteNotes||typeof remoteNotes!=='object')return;
  const S=window.SparrowSync, pass=notePass();
  const merged=S.mergeNotes(filmNotes,remoteNotes);
  Object.keys(merged).forEach(id=>{
    const r=merged[id]; if(!r||r.del)return;
    if(r.enc&&!r.s&&pass&&typeof SparrowNotesCrypto!=='undefined'){
      try{r.s=SparrowNotesCrypto.decrypt(r.enc,pass);}catch{}
    }
  });
  filmNotes=merged; saveFilmNotes();
}
function activeNotesCount(){return Object.keys(filmNotes).filter(id=>filmNotes[id]&&!filmNotes[id].del&&(filmNotes[id].s||filmNotes[id].enc)).length;}
function currentBackupHealth(){
  if(typeof SparrowEcosystem==='undefined')return {level:'good',codeWarning:false,backupWarning:false};
  const watchedN=Object.keys(watched).filter(id=>watched[id]&&!watched[id].del&&watched[id].d).length;
  const code=syncSt?.code||'';
  return SparrowEcosystem.backupHealth({
    syncCode:code,
    codeSaved:!!(code&&backupMeta.codeSavedFor===code),
    watchedCount:watchedN,
    notesCount:activeNotesCount(),
    lastExportAt:backupMeta.lastExportAt||0,
    lastExportCount:backupMeta.lastExportCount||0
  });
}
function markSyncCodeSaved(){if(!syncSt?.code)return;backupMeta.codeSavedFor=syncSt.code;saveBackupMeta();}
function markBackupExported(){
  const watchedN=Object.keys(watched).filter(id=>watched[id]&&!watched[id].del&&watched[id].d).length;
  backupMeta.lastExportAt=Date.now(); backupMeta.lastExportCount=watchedN+activeNotesCount(); saveBackupMeta();
}
try{syncSt=JSON.parse(localStorage.getItem(SYNC_KEY)||'null');}catch{}
function syncSave(){try{syncSt?localStorage.setItem(SYNC_KEY,JSON.stringify(syncSt)):localStorage.removeItem(SYNC_KEY);}catch{}}
async function sbRpc(fn,body,signal){const r=await fetch(SB_API+fn,{method:'POST',headers:{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY,'Content-Type':'application/json'},body:JSON.stringify(body),signal});
  if(!r.ok){let m='';try{m=(await r.json()).message||'';}catch{}throw new Error(m||('HTTP '+r.status));}return r.json();}
function profileSnap(forCloud){const m=readMeta();return {v:1,watched:JSON.parse(JSON.stringify(watched)),holder:{n:holderName(),t:m.holder||0},photo:{d:holderPhoto(),t:m.photo||0},picks:{k:[...picked],t:m.picks||0},want:JSON.parse(JSON.stringify(want)),tix:JSON.parse(JSON.stringify(ticketStore())),art:TicketArt.artSnapshot(readTicketPreference),pp:JSON.parse(JSON.stringify(posterPicks)),notes:forCloud?notesForCloud():JSON.parse(JSON.stringify(filmNotes))};}
function profileApply(d){watched=d.watched;saveWatched();if(d.pp){posterPicks=window.SparrowSync.mergePP(posterPicks,d.pp);try{localStorage.setItem(PP_KEY,JSON.stringify(posterPicks));}catch{}} /* 合并而不是覆盖：旧版云函数不认识 pp */if(d.notes)mergeCloudNotes(d.notes);if(d.want){want=d.want;saveWant();}if(d.tix)ticketStorePut(window.SparrowSync.mergeTix(ticketStore(),d.tix),true);if(d.art&&TicketArt.applyArt(readTicketPreference,(k,v)=>localStorage.setItem(k,v),d.art))ticketArtReload();
  try{localStorage.setItem(HOLDER_KEY,d.holder.n);d.photo.d?localStorage.setItem(PHOTO_KEY,d.photo.d):localStorage.removeItem(PHOTO_KEY);localStorage.setItem(PLAN_KEY,JSON.stringify(d.picks.k));
    localStorage.setItem(META_KEY,JSON.stringify({holder:d.holder.t,photo:d.photo.t,picks:d.picks.t}));}catch{throw new Error(tr('浏览器未能保存，请检查存储空间'));}
  picked=readSelection();}
const profilePrint=()=>{try{return JSON.stringify([watched,holderName(),holderPhoto().length,[...picked].sort(),want,ticketRev,ticketArtRev,posterPicks,notesRev]);}catch{return '';}};
async function syncRun(){
  if(!syncSt||!syncSt.code)return;syncStatus={state:'busy',msg:tr('同步中…'),at:syncStatus.at};syncPaint();
  const S=window.SparrowSync;let merged,rev;
  for(let i=0;i<4;i++){const remote=await sbRpc('mg_pull',{code:syncSt.code}),mine=profileSnap(true);
    merged=remote.data?S.merge(mine,remote.data):S.clean(mine);
    if(remote.data&&S.same(merged,remote.data)){rev=remote.rev;break;}
    const r=await sbRpc('mg_push',{code:syncSt.code,data:merged,base_rev:remote.rev||0});if(r.ok){rev=r.rev;break;}}
  if(rev===undefined)throw new Error(tr('云端有其他设备正在同步，请稍后再试'));
  // 请求在路上时本机又改了（评分、刚移出的排片、想看、票根）：这些比发出时的快照新，再和「现在的本机」合并一次，
  // 同一项取较新者，免得刚移出的场次被这一轮同步放回来（2026-11-22）；本机更新的部分留给下一轮推上云端。
  const saved=merged;
  merged=S.merge(profileSnap(true),saved);
  const lateRatings=!S.same(saved,merged);
  const before=profileSnap(true),changed=!S.same(merged,before);
  if(changed){profileApply(merged);
    // 只有页面上看得见的档案（看过、想看、持有人、照片、排片）真的变了才重绘「我的」页；票根 / 手绘风格的变化不重绘，
    // 连续多次「同步后又变了」说明两边在来回改，停止重绘，避免印章反复刷新、护照收不起来
    const vis=d=>{const c=S.clean(d);return JSON.stringify([c.watched,c.want,c.holder,c.photo,c.picks]);};
    const now=Date.now();syncApplied=syncApplied.filter(t=>now-t<60000);syncApplied.push(now);
    if(vis(before)!==vis(profileSnap(true))&&syncApplied.length<=3&&(location.hash.replace('#','').split('/')[0]==='my'||!location.hash))idleRerender(()=>{if(!['my',''].includes(location.hash.replace('#','').split('/')[0]))return;const y=window.scrollY;route();window.scrollTo(0,y);},'sync');}
  syncSt={...syncSt,rev,at:Date.now()};syncSave();syncPrint=lateRatings?'':profilePrint();syncStatus={state:'ok',msg:'',at:Date.now()};syncPaint();tasteChanged();TC.flush();return {changed};}
function syncNow(){if(profileClearing)return Promise.resolve();if(syncBusy)return syncBusy;syncBusy=syncRun().catch(e=>{syncStatus={state:'error',msg:(e&&e.message)||String(e),at:syncStatus.at};syncPaint();throw e;}).finally(()=>{syncBusy=null;});return syncBusy;}
const syncQuiet=()=>syncNow().catch(()=>{});
function syncAgo(t){if(!t)return '';const s=(Date.now()-t)/1000;return s<60?tr('刚刚'):s<3600?Math.round(s/60)+' '+tr('分钟前'):s<86400?Math.round(s/3600)+' '+tr('小时前'):new Date(t).toLocaleDateString();}
function noteVaultHTML(){
  const hasPass=!!notePass(), nCnt=activeNotesCount();
  const lockedCnt=Object.keys(filmNotes).filter(id=>{const n=privateNoteOf(id);return n&&n.locked;}).length;
  return `<div class="note-vault"><div class="nv-head"><div><small class="mono">E2E ENCRYPTED NOTES</small><b>${esc(tr("私密笔记端到端加密同步"))}</b></div><span class="nv-st${hasPass?" on":""}">${hasPass?esc(tr("已开启加密")):esc(tr("仅本机保存"))}</span></div>`+
    `<p class="nv-desc">${hasPass?esc(tr("笔记在离开本机前由独立口令 AES-256 加密，云端仅存密文；换设备后输入同一口令即可解密。")):esc(tr("默认所有个人笔记仅保存在本机、绝不上传云端。设置独立口令后，将以端到端加密形式随同步码跨设备同步。"))}</p>`+
    (lockedCnt?`<p class="nv-warn">${esc(tr("有 "+lockedCnt+" 条来自其他设备的加密笔记待解锁，请输入你的笔记口令。"))}</p>`:"")+
    `<div class="nv-acts"><button type="button" class="secondary-button" data-vault="set">${hasPass?esc(tr("修改口令")):lockedCnt?esc(tr("输入口令解锁")):esc(tr("设置加密口令"))}</button>${hasPass?`<button type="button" class="text-button" data-vault="clear">${esc(tr("清除本机口令"))}</button>`:""}${nCnt?`<span class="nv-cnt mono">${nCnt} ${esc(tr("条笔记"))}</span>`:""}</div></div>`;
}
function syncCardHTML(){
  const health=currentBackupHealth();
  if(!syncSt||!syncSt.code){
    return '<h3>个人档案云端同步</h3><p class="sync-lead">用一串同步码，在手机、电脑和小程序之间同步看过记录、评分、护照照片和个人排片。不用注册账号。</p>'+
      (syncMode==='join'?'<form class="sync-join" id="sync-join"><input id="sync-input" placeholder="SP-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="同步码"><button class="primary-button" type="submit">连接</button><button type="button" class="text-button" data-sync="cancel">取消</button></form>'
      :'<div class="sync-row"><button class="primary-button" data-sync="start">开启同步</button><button class="secondary-button" data-sync="join">我已有同步码</button><button class="secondary-button" data-sync="qrstart">用小程序扫码连接</button></div>');}
  const code=syncSt.code,shown=syncReveal?code:code.slice(0,7)+'-••••-••••-••••-••••-'+code.slice(-4);
  const line=syncStatus.state==='busy'?'<span class="sync-dot busy"></span>'+esc(syncStatus.msg||'同步中…'):syncStatus.state==='error'?'<span class="sync-dot err"></span>同步失败：'+esc(syncStatus.msg):'<span class="sync-dot ok"></span>已同步'+(syncSt.at?' · '+esc(syncAgo(syncSt.at)):'');
  const codeBanner=health.codeWarning
    ? `<div class="sync-health warn"><div><b>${esc(tr("尚未确认保存同步码"))}</b><span>${esc(tr("同步码是跨设备找回档案的唯一钥匙，请先复制并存到备忘录或密码管理器。"))}</span></div><button type="button" class="secondary-button" data-sync="saved">${esc(tr("我已妥善保存"))}</button></div>`
    : `<p class="sync-saved-ok"><span class="sync-dot ok"></span>${esc(tr("已确认保存同步码"))}</p>`;
  return '<h3>个人档案云端同步</h3><p class="sync-status" role="status" aria-live="polite">'+line+'</p>'+codeBanner+
    '<div class="sync-code"><span>同步码</span><code translate="no">'+esc(shown)+'</code><div><button type="button" class="text-button" data-sync="reveal">'+(syncReveal?'隐藏':'显示')+'</button><button type="button" class="text-button" data-sync="copy">复制</button></div></div>'+
    '<div class="sync-row"><button class="primary-button" data-sync="now">立即同步</button><button class="secondary-button" data-sync="qr" aria-expanded="'+syncQR+'">'+(syncQR?'收起二维码':'用小程序扫码连接')+'</button><button class="text-button" data-sync="stop">停止同步</button></div>'+
    (syncQR?'<div class="sync-qr">'+syncQRSVG(code)+'<p>'+tr('打开微信小程序「麻雀观影护照」→ 我的 → 个人档案云端同步，点「扫码连接网站」扫这个二维码，两边的记录会自动合并。')+'<br>'+tr('二维码等同于同步码，不要截图发给别人。')+'</p></div>':'')+
    noteVaultHTML()+
    '<p class="sync-note">在另一台设备（网站或小程序）的「我的」页选「我已有同步码」，输入这串码即可；小程序也可以直接扫上面的二维码。同步码就是钥匙，请自己保存好；知道它的人都能读写这份档案。</p>';}
/* 扫码连接：网站显示同步码二维码（内容 SPARROW-SYNC:<同步码>），小程序「扫码连接网站」扫到后改用这串同步码并合并两边记录。
   二维码显示期间每 5 秒同步一次（最多 3 分钟），拉到小程序合并过来的记录后自动收起。 */
let syncQR=false,syncQRTimer=0,syncQRUntil=0;
function syncQRSVG(code){const m=qrMatrix('SPARROW-SYNC:'+code);if(!m)return '';const n=m.length,q=4;let d='';for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(m[r][c])d+='M'+(c+q)+' '+(r+q)+'h1v1h-1z';return '<svg viewBox="0 0 '+(n+2*q)+' '+(n+2*q)+'" role="img" aria-label="'+tr('同步码二维码')+'" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="'+d+'" fill="#1d1712"/></svg>';}
function syncQRWatch(on){clearInterval(syncQRTimer);syncQRTimer=0;syncQR=!!on;if(!on)return;syncQRUntil=Date.now()+18e4;
 syncQRTimer=setInterval(()=>{if(!syncQR||!syncSt||!syncSt.code||Date.now()>syncQRUntil||!document.getElementById('sync-card')){const was=syncQR;syncQRWatch(false);if(was)syncPaint();return;}
  if(document.visibilityState!=='visible')return;
  syncNow().then(r=>{if(syncQR&&r&&r.changed){syncQRWatch(false);syncPaint();stat('sync_link','qr-done');toast('已和小程序连接，记录已合并');}}).catch(()=>{});},5000);}
let communityStatus='idle',communityReadAt=0,communityReading=null;
// 已经送进社区队列的评分签名存在本机（2026-11-22）：以前只在内存里，每次打开都把全部公开评分重新排队
let tasteObserved=(()=>{try{const v=JSON.parse(localStorage.getItem('sparrow-taste-observed-v1')||'{}');return v&&typeof v==='object'?v:{};}catch{return {};}})();
const tasteSeenSave=()=>{try{localStorage.setItem('sparrow-taste-observed-v1',JSON.stringify(tasteObserved));}catch{}};
const TC=window.SparrowTasteClient.create({defer:f=>setTimeout(f,0),load:()=>{try{return JSON.parse(localStorage.getItem('sparrow-taste-outbox-v1')||'{}');}catch{return {};}},save:v=>localStorage.setItem('sparrow-taste-outbox-v1',JSON.stringify(v)),beforeVote:async job=>{if(job.code!==syncSt?.code)return;if(syncBusy)await syncBusy;if(job.code===syncSt?.code)await syncNow();},rpc:async(fn,body)=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{return await sbRpc(fn,body,controller.signal);}finally{clearTimeout(timer);}}});
function tasteChanged(){if(!syncSt?.code)return;let dirty=false;Object.keys(watched).forEach(id=>{if(!F[id]||F[id].ev)return;const r=watched[id],signature=JSON.stringify([syncSt.code,r.fun,r.bore,r.tastePublic,r.del]),old=tasteObserved[id];if(old?.signature===signature)return;tasteObserved[id]={signature,published:window.SparrowTaste.publicVote(r)};dirty=true;if((r.d&&!r.del&&r.tastePublic===true)||old?.published)TC.enqueue(syncSt.code,id,r);});if(dirty)tasteSeenSave();}
// 影片页只保留一行趣味摘要；评分及社区汇总都在底部弹层里（桌面为居中对话框）
function tasteRowHTML(f){const r=watched[f.id],seen=!!(r&&r.d&&!r.del),T=window.SparrowTaste,a=TC.get(f.id),num=k=>T.valid(r&&r[k])?'<b>'+r[k]+'</b>':'<i>—</i>';
 const mine=seen?(T.valid(r.fun)||T.valid(r.bore)?'<span class="ts-mine"><span>'+ppV('有趣','Fun')+' '+num('fun')+'</span><span>'+ppV('无聊','Boring')+' '+num('bore')+'</span></span>':'<span class="ts-cta">'+ppV('给有趣度、无聊度打分','Rate interesting and boring')+'</span>'):'<span class="ts-muted">'+ppV('看过后可以评有趣度、无聊度','Rate it after watching')+'</span>';
 const fa=a&&a.funAvg!=null?Number(a.funAvg).toFixed(1):null,ba=a&&a.boreAvg!=null?Number(a.boreAvg).toFixed(1):null,n=a?Math.max(a.funN||0,a.boreN||0):0;
 const comm=!a?'':fa||ba?ppV('社区','Community')+' <b>'+(fa||'—')+'</b> · <b>'+(ba||'—')+'</b>':n?ppV(n+' 人评价',n+' ratings'):seen?ppV('成为第一个评价的人','Be the first to rate'):ppV('社区暂无评价','No ratings yet');
 return '<button type="button" class="ts-row" data-ts-open="'+esc(f.id)+'" data-taste-row="'+esc(f.id)+'" aria-haspopup="dialog"><span class="ts-row-k">'+ppV('趣味','Taste')+'</span>'+mine+'<span class="ts-comm">'+comm+'</span><span class="ts-go" aria-hidden="true">›</span></button>';}
let tsOpen='';
function tsBodyHTML(f){const r=watched[f.id],seen=!!(r&&r.d&&!r.del);
 return (seen?tasteHTML(f):'<div class="ts-unseen"><p>'+ppV('标记看过后，就能给这部电影的有趣度和无聊度打分。','Mark it watched to rate how interesting and how boring it was.')+'</p><button class="secondary-button" data-seen="'+esc(f.id)+'">＋ '+ppV('看过','Watched')+'</button></div>')+communityHTML(f);}
function tsSheetHTML(f){return '<div class="ts-wrap" id="ts-sheet"><div class="ts-backdrop" data-ts-close></div><section class="ts-sheet" role="dialog" aria-modal="true" aria-labelledby="ts-title"><span class="ts-grab" aria-hidden="true"></span><header class="ts-head"><div><small>TASTE · '+esc(f.cn)+'</small><h3 id="ts-title">'+ppV('这部电影，有趣还是无聊？','Interesting or boring?')+'</h3></div><button type="button" class="ts-x" data-ts-close aria-label="'+ppV('关闭','Close')+'">×</button></header><div class="ts-body">'+tsBodyHTML(f)+'</div><footer class="ts-foot"><button type="button" class="ts-map-btn" data-ts-map><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 3v18M3 12h18"/><circle cx="16.5" cy="7.5" r="1.4"/><circle cx="7.5" cy="16.5" r="1.4"/><circle cx="15.5" cy="15.5" r="1.4"/></svg><span>'+ppV('我的电影趣味图谱','My film taste map')+'</span><b aria-hidden="true">›</b></button><button type="button" class="primary-button" data-ts-close>'+ppV('完成','Done')+'</button></footer></section></div>';}
function tsShow(id){const f=F[id];if(!f||f.ev)return;tsClose(true);tsOpen=id;document.body.insertAdjacentHTML('beforeend',tsSheetHTML(f));document.documentElement.classList.add('ts-lock');loadCommunity();const x=document.querySelector('#ts-sheet .ts-x');if(x)x.focus({preventScroll:true});}
function tsPaint(){const el=document.querySelector('#ts-sheet .ts-body');if(el&&F[tsOpen])el.innerHTML=tsBodyHTML(F[tsOpen]);}
function tsClose(now){const w=document.getElementById('ts-sheet');tsOpen='';document.documentElement.classList.remove('ts-lock');if(!w)return;if(now||matchMedia('(prefers-reduced-motion: reduce)').matches){w.remove();return;}w.classList.add('out');setTimeout(()=>w.remove(),180);}
document.addEventListener('click',e=>{const o=e.target.closest('[data-ts-open]');if(o){tsShow(o.dataset.tsOpen);return;}if(e.target.closest('[data-ts-close]')){tsClose();return;}if(e.target.closest('[data-ts-map]')){tsClose(true);location.hash='taste-map';}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&tsOpen)tsClose();});
window.addEventListener('hashchange',()=>{if(tsOpen)tsClose(true);});
function communityHTML(f){const a=TC.get(f.id),r=watched[f.id];
 // 每项分别显示人数与平均星级；不足 3 人显示「样本不足」，不显示均分
 const line=(key,label)=>{const n=a?a[key+'N']||0:0,avg=a&&a[key+'Avg']!=null?Number(a[key+'Avg']):null;
  const val=avg!=null?'<span class="mr-stars taste-ro" aria-hidden="true">'+[1,2,3,4,5].map(i=>tasteStar(Math.round(Math.max(0,Math.min(1,avg-(i-1)))*100))).join('')+'</span><span class="cs-avg"><b>'+avg.toFixed(1)+'</b><small>/5</small></span>':'<span class="cs-low">'+(!a?'—':n?ppV('样本不足 · 还差 '+(3-n)+' 人','Too few · '+(3-n)+' more needed'):ppV('暂无评价','No ratings yet'))+'</span>';
  return '<div><b>'+label+'</b><span class="cs-val">'+val+'</span><small>'+n+' '+ppV('人评价','ratings')+'</small></div>';};
 const note=communityStatus==='error'?ppV('社区评分暂不可用；个人评分已保存在本机。','Community ratings unavailable; your ratings are saved locally.'):a?ppV('两项分别统计，各满 3 人显示平均星级。','Counted separately; averages show from 3 ratings.'):ppV('正在读取社区评分…','Loading community ratings…');
 const pending=TC.pending(f.id),published=window.SparrowTaste.publicVote(r),connected=!!syncSt?.code;
 const delivery=pending?ppV('等待上传，联网后自动重试。','Pending upload; retries when online.'):published&&!connected?ppV('评分已保存在本机，开启云端同步后会自动上传。','Scores are saved locally and will upload once cloud sync is enabled.'):'';
 const withdraw=published&&connected?'<button type="button" class="text-button cs-hint" data-community-action="withdraw" data-id="'+esc(f.id)+'">'+ppV('撤回社区评分','Withdraw community scores')+'</button>':'';
 return '<section class="community-score" data-community="'+esc(f.id)+'"><h4>'+ppV('影迷社区','Community')+' <small>COMMUNITY</small></h4><div class="community-values">'+line('fun',ppV('有趣度','Interesting'))+line('bore',ppV('无聊度','Boring'))+'</div><p role="status">'+(delivery||note)+'</p>'+withdraw+'</section>';}
function paintCommunity(){document.querySelectorAll('[data-community]').forEach(el=>{const f=F[el.dataset.community];if(f)el.outerHTML=communityHTML(f);});document.querySelectorAll('[data-taste-row]').forEach(el=>{const f=F[el.dataset.tasteRow];if(f)el.outerHTML=tasteRowHTML(f);});}
function loadCommunity(force){if(communityReading)return force?communityReading.then(()=>loadCommunity(true)):communityReading;if(!force&&Date.now()-communityReadAt<30000){paintCommunity();return Promise.resolve();}communityReading=TC.read(null).then(()=>{communityStatus='ok';communityReadAt=Date.now();}).catch(()=>{communityStatus='error';}).finally(()=>{communityReading=null;paintCommunity();const map=document.querySelector('.taste-map');if(map&&tasteMapMode==='community')map.outerHTML=tasteMapHTML();});return communityReading;}
TC.subscribe(paintCommunity);setInterval(()=>{if(document.visibilityState==='visible'&&(location.hash.startsWith('#film-')||location.hash==='#taste-map')){if(TC.status()==='error')TC.flush();loadCommunity();}},30000);window.addEventListener('online',()=>{syncQuiet().then(()=>{tasteChanged();TC.flush();loadCommunity(true);});});
document.addEventListener('click',e=>{const a=e.target.closest('[data-community-action="withdraw"]');
 if(a){const id=a.dataset.id,r=watched[id];if(!syncSt?.code||!window.SparrowTaste.publicVote(r))return;if(!tasteObserved[id]?.published){tasteObserved[id]={published:true};tasteSeenSave();}watched[id]=window.SparrowTaste.set(r,'tastePublic',false);saveWatched();refreshMyRate(id);return;}
 const m=e.target.closest('[data-taste-map]');if(m){tasteMapMode=m.dataset.tasteMap;const el=m.closest('.taste-map');if(el)el.outerHTML=tasteMapHTML();loadCommunity();return;}
 const p=e.target.closest('[data-taste-point]');if(p){const entries=tasteMapMode==='community'?FILMS.filter(f=>{const a=TC.get(f.id);return a&&a.pairN>=3;}).map(f=>{const a=TC.get(f.id);return {id:f.id,f,rec:{fun:a.pairFun,bore:a.pairBore},community:true};}):watchEntries(),model=window.SparrowTaste.map(entries,LANG==='en'),group=model.points.find(g=>g.key===p.dataset.tastePoint),target=p.closest('.taste-map').querySelector('.taste-selected');if(group)target.innerHTML=group.entries.map(x=>'<button class="text-button" data-film="'+esc(x.id)+'">'+esc(x.title)+' · '+ppV('有趣 ','Interesting ')+(Number.isInteger(x.fun)?x.fun:Number(x.fun).toFixed(1))+' · '+ppV('无聊 ','Boring ')+(Number.isInteger(x.bore)?x.bore:Number(x.bore).toFixed(1))+' ›</button>').join('');}
});

function syncPaint(){const el=document.getElementById('sync-card');if(el)el.innerHTML=syncCardHTML()+profileCareHTML();}
function syncCopy(t){return navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(t):Promise.reject();}
function openVaultDialog(){
  document.getElementById('vault-dialog')?.remove();
  const has=!!notePass();
  const d=document.createElement('dialog');d.id='vault-dialog';d.className='schedule-selector vault-dialog';d.setAttribute('aria-labelledby','vault-title');
  d.innerHTML=`<header class="selector-head"><h2 id="vault-title">${esc(tr(has?'修改笔记加密口令':'设置笔记加密口令'))}</h2><button type="button" class="selector-close" data-vd="close" aria-label="${esc(tr('关闭'))}">×</button></header>`+
    `<form class="vault-form" id="vault-form"><p class="vault-tip">${esc(tr('口令仅留在本机浏览器中，用于将个人笔记 AES-256 加密后再上传云端。请自行牢记，我们无法找回口令。'))}</p>`+
    `<input type="password" id="vault-pass" minlength="4" autocomplete="new-password" placeholder="${esc(tr('输入至少 4 位加密口令'))}" required>`+
    `<div class="vault-btns"><button type="button" class="secondary-button" data-vd="close">${esc(tr('取消'))}</button><button type="submit" class="primary-button">${esc(tr('确认加密并同步'))}</button></div></form>`;
  document.body.appendChild(d);
  d.addEventListener('click',ev=>{if(ev.target===d||ev.target.closest('[data-vd="close"]'))d.close();});
  d.querySelector('#vault-form').addEventListener('submit',ev=>{
    ev.preventDefault();
    const val=d.querySelector('#vault-pass').value;
    const res=setNotePassphrase(val);
    if(!res.ok){toast(res.msg);return;}
    d.close(); syncPaint();
    toast(res.unlocked?tr('已解锁 '+res.unlocked+' 条云端笔记'):tr('已开启笔记端到端加密同步'));
    if(syncSt?.code)syncQuiet();
  });
  d.addEventListener('close',()=>d.remove());
  d.showModal(); d.querySelector('#vault-pass')?.focus();
}
document.addEventListener('click',async e=>{
  const vb=e.target.closest('[data-vault]');
  if(vb){
    if(vb.dataset.vault==='set'){openVaultDialog();return;}
    if(vb.dataset.vault==='clear'){
      if(!confirm(tr('清除本机的笔记加密口令？本机明文笔记不受影响，但之后修改的笔记将不再同步到云端，直到重新设置口令。')))return;
      setNotePassphrase(''); syncPaint(); toast(tr('已清除本机加密口令'));
    }
    return;
  }
  const b=e.target.closest('[data-sync]');if(!b)return;const a=b.dataset.sync;
  if(a==='join'||a==='cancel'){syncMode=a==='join'?'join':'';syncPaint();if(syncMode)document.getElementById('sync-input')?.focus();return;}
  if(a==='start'){syncSt={code:window.SparrowSync.newCode(n=>crypto.getRandomValues(new Uint8Array(n))),rev:0,at:0};syncReveal=true;syncSave();syncPaint();try{await syncNow();toast('已开启同步，请保存好同步码');}catch(err){toast(tr('同步失败：')+err.message);}return;}
  if(a==='saved'){markSyncCodeSaved();syncPaint();toast(tr('已标记为妥善保存'));return;}
  if(a==='reveal'){syncReveal=!syncReveal;syncPaint();return;}
  if(a==='qr'){syncQRWatch(!syncQR);syncPaint();return;}
  if(a==='qrstart'){stat('sync_link','qr');syncSt={code:window.SparrowSync.newCode(n=>crypto.getRandomValues(new Uint8Array(n))),rev:0,at:0};syncSave();syncQRWatch(true);syncPaint();try{await syncNow();}catch(err){toast(tr('同步失败：')+err.message);}return;}
  if(a==='copy'){syncCopy(syncSt.code).then(()=>{markSyncCodeSaved();syncPaint();toast('同步码已复制并标记为已保存');},()=>toast('复制失败，请长按同步码手动复制'));return;}
  if(a==='now'){try{const r=await syncNow();toast(r&&r.changed?'已同步，并合并了其他设备的更改':'已同步');}catch(err){toast(tr('同步失败：')+err.message);}return;}
  if(a==='stop'){if(!confirm(tr('在这台设备停止同步？本机记录会保留，云端的记录也不会删除；已公开的社区评分仍保留，可在影片页撤回。以后输入同步码可以重新连接。')))return;syncQRWatch(false);syncSt=null;syncSave();syncStatus={state:'idle',msg:'',at:0};syncMode='';syncReveal=false;syncPaint();}
});
document.addEventListener('submit',async e=>{if(e.target.id!=='sync-join')return;e.preventDefault();
  const code=window.SparrowSync.normalize(document.getElementById('sync-input').value);if(!code){toast('同步码格式不对，请检查');return;}
  syncSt={code,rev:0,at:0};syncSave();markSyncCodeSaved();syncMode='';syncPaint();try{await syncNow();toast('已连接，记录已合并');}catch(err){toast(tr('同步失败：')+err.message);}});
function profileCareHTML(){
  const health=currentBackupHealth();
  const lastTxt=backupMeta.lastExportAt?tr('上次导出备份：')+syncAgo(backupMeta.lastExportAt):tr('尚未导出过本地备份');
  const remindHTML=health.backupWarning?`<div class="sync-health info"><div><b>${esc(tr('定期备份提醒'))}</b><span>${esc(health.backupReason)}</span></div><button type="button" class="secondary-button" data-profile="backup">${esc(tr('立即备份'))}</button></div>`:'';
  return `<div class="profile-care"><h4>你的档案，由你保管</h4>${remindHTML}<p><b>保存在哪里</b><br>排片、印章、评分、姓名和照片默认保存在本浏览器。开启同步后，档案副本会存入 Supabase 云端，用同步码连接其他设备；普通档案非端到端加密，但个人笔记默认纯本机、设置独立口令后才以端到端加密形式同步。</p><p><b>备份与恢复</b> · <small class="mono">${esc(lastTxt)}</small><br>完整备份包含观影记录、个人笔记、评分、照片、姓名和个人排片，不包含同步码与加密口令。导入会合并已有排片，同一影片以导入记录为准。</p><div class="care-actions"><button class="secondary-button" data-profile="backup">下载完整备份</button><button class="secondary-button" data-profile="restore">导入备份</button></div>`+
    `<div class="eco-box"><small class="mono">LETTERBOXD &amp; DOUBAN</small><b>${esc(tr('生态 CSV 导入与导出'))}</b><p>${esc(tr('将已看观影记录导出为官方 Letterboxd CSV，或导入 Letterboxd / 豆瓣观影导出表（自动匹配本站已收录片目，导入前先预览确认）。'))}</p><label class="eco-opt"><input type="checkbox" id="lb-inc-notes"><span>${esc(tr('导出 Letterboxd CSV 时附带个人笔记（Review 列，默认不附带）'))}</span></label><div class="care-actions"><button type="button" class="secondary-button" data-eco="export-lb">${esc(tr('导出 Letterboxd CSV'))}</button><button type="button" class="secondary-button" data-eco="import-csv">${esc(tr('导入 Letterboxd / 豆瓣 CSV'))}</button></div></div>`+
    `<p><b>同步码丢失</b><br>先检查另一台已连接的设备；没有同步码和已连接设备时，我们无法凭姓名找回。已有备份仍可恢复到本机，再创建新的同步码。</p><p><b>停止同步与删除</b><br>停止同步只断开本设备，不删除本机或云端。清空云端内容前，请先在其他设备停止同步，避免旧记录再次上传。清空会移除云端的照片、姓名、排片与观影内容，保留匿名同步记录及删除标记；本机副本保留。社区评分单独保存；请先在影片页撤回已公开的评分，再清空私人档案。</p>${syncSt?.code?'<button class="text-button" data-profile="clear-cloud">清空云端内容并断开同步</button>':''}<p>如需彻底删除服务器上的同步记录，请通过「影展合作&反馈与纠错」联系维护者；请勿在公开反馈里发送完整同步码。</p></div>`;}
function applyProfileSafely(d){const old=profileSnap(),keys=[WATCH_KEY,HOLDER_KEY,PHOTO_KEY,PLAN_KEY,META_KEY],saved=keys.map(k=>localStorage.getItem(k));
 try{const values=[JSON.stringify(d.watched),d.holder.n,d.photo.d,JSON.stringify(d.picks.k),JSON.stringify({holder:d.holder.t,photo:d.photo.t,picks:d.picks.t})];keys.forEach((k,i)=>localStorage.setItem(k,values[i]));watched=d.watched;picked=readSelection();if(d.want){want=d.want;saveWant();}if(d.pp){posterPicks=d.pp;localStorage.setItem(PP_KEY,JSON.stringify(posterPicks));}if(d.notes)mergeCloudNotes(d.notes);}
 catch(err){keys.forEach((k,i)=>{try{saved[i]===null?localStorage.removeItem(k):localStorage.setItem(k,saved[i]);}catch{}});watched=old.watched;picked=new Set(old.picks.k);throw err;}}
function downloadProfile(){const data=window.SparrowBackup.encode(profileSnap()),blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='sparrow-passport-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);markBackupExported();syncPaint();toast('完整备份已生成，请妥善保管');}
function exportLetterboxdFile(){
  if(typeof SparrowEcosystem==='undefined')return;
  const entries=watchEntries();
  if(!entries.length){toast(tr('还没有已看影片可供导出'));return;}
  const inc=!!document.getElementById('lb-inc-notes')?.checked;
  const plainNotes={};
  if(inc)entries.forEach(e=>{const n=privateNoteOf(e.id);if(n&&n.text)plainNotes[e.id]={s:n.text};});
  const csv=SparrowEcosystem.exportLetterboxdCSV(entries,{includeNotes:inc,notes:plainNotes,progNameOf:f=>(progOf(f)||{}).name||''});
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='sparrow-letterboxd-'+new Date().toISOString().slice(0,10)+'.csv';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
  markBackupExported();syncPaint();
  toast(tr('Letterboxd CSV 已导出（'+entries.length+' 部）'));
}
function openEcoImportPreview(res){
  document.getElementById('eco-import-modal')?.remove();
  const srcName=res.source==='douban'?tr('豆瓣 CSV'):res.source==='letterboxd'?tr('Letterboxd CSV'):'CSV';
  const wCnt=res.matched.filter(x=>x.kind==='watched').length, wantCnt=res.matched.filter(x=>x.kind==='want').length, noteCnt=res.matched.filter(x=>x.note).length;
  const d=document.createElement('dialog');d.id='eco-import-modal';d.className='schedule-selector eco-dialog';d.setAttribute('aria-labelledby','eco-title');
  d.innerHTML=`<header class="selector-head"><h2 id="eco-title">${esc(srcName)} · ${esc(tr('导入预览'))}</h2><button type="button" class="selector-close" data-eco-close aria-label="${esc(tr('关闭'))}">×</button></header>`+
    `<div class="eco-summary"><p>${esc(tr('共解析 '+res.totalRows+' 条记录，匹配本站片目 '+res.matched.length+' 部'))}${res.unmatchedCount?` · <small>${esc(tr('未收录 '+res.unmatchedCount+' 部已跳过'))}</small>`:''}</p>`+
    `<div class="eco-pills"><span>${esc(tr('已看'))} <b class="mono">${wCnt}</b></span><span>${esc(tr('想看'))} <b class="mono">${wantCnt}</b></span>${noteCnt?`<span>${esc(tr('含短评/笔记'))} <b class="mono">${noteCnt}</b></span>`:''}</div>`+
    (noteCnt?`<label class="eco-opt"><input type="checkbox" id="eco-imp-notes" checked><span>${esc(tr('将短评/评论同步导入为纯私密个人笔记（仅本机可见）'))}</span></label>`:'')+
    `</div><div class="selector-results eco-list">${res.matched.length?res.matched.slice(0,80).map(x=>`<div class="eco-row"><b>${esc(x.film.cn)}</b><small>${esc(x.kind==='want'?tr('想看'):[tr('已看'),x.date||tr('今天'),x.rating10?x.rating10+'/10':''].filter(Boolean).join(' · '))}${x.alreadyWatched?' · '+esc(tr('已存在，保留本机')):''}</small></div>`).join('')+(res.matched.length>80?`<p class="selector-empty">${esc(tr('其余 '+(res.matched.length-80)+' 部同样将导入'))}</p>`:''):`<p class="selector-empty">${esc(tr('这份 CSV 中没有匹配到本站当前收录的影片'))}</p>`}</div>`+
    `<footer class="selector-foot"><small>${esc(tr('不会覆盖你已标记的观影记录'))}</small><button type="button" class="selector-done" data-eco-confirm ${res.matched.length?'':'disabled'}>${esc(tr('确认导入'))}</button></footer>`;
  document.body.appendChild(d);
  d.addEventListener('click',ev=>{
    if(ev.target===d||ev.target.closest('[data-eco-close]')){d.close();return;}
    if(ev.target.closest('[data-eco-confirm]')){
      const impNotes=!!d.querySelector('#eco-imp-notes')?.checked;
      const today=isoOf(new Date(now())), t=Date.now();
      let addedW=0, addedWant=0, addedN=0;
      res.matched.forEach(x=>{
        const id=x.film.id;
        if(x.kind==='want'){
          if(!watched[id]?.d&&!isWant(id)){setWant(id,true);addedWant++;}
        }else{
          if(!watched[id]||watched[id].del||!watched[id].d){
            watched[id]={d:x.date||today,r:x.rating10||0,k:'',t};addedW++;
          }
        }
        if(impNotes&&x.note&&!privateNoteOf(id)){
          savePrivateNote(id,x.note,{tb:false,rc:false});addedN++;
        }
      });
      if(addedW)saveWatched();
      d.close();route();
      toast(tr('已导入：已看 '+addedW+' 部 · 想看 '+addedWant+' 部'+(addedN?' · 笔记 '+addedN+' 条':'')));
      if(syncSt?.code)syncQuiet();
    }
  });
  d.addEventListener('close',()=>d.remove());
  d.showModal();
}
async function importEcoCSVFile(file){
  if(!file||typeof SparrowEcosystem==='undefined')return;
  if(file.size>6000000){toast(tr('CSV 文件过大，请检查文件'));return;}
  try{
    const text=await file.text();
    const res=SparrowEcosystem.parseImportCSV(text,FILMS,watched);
    openEcoImportPreview(res);
  }catch{toast(tr('未能读取 CSV 文件，请检查格式'));}
}
async function importProfile(file){if(!file)return;if(file.size>2600000){toast('备份文件过大，请检查文件');return;}
 try{const data=JSON.parse(await file.text());window.SparrowBackup.decode(data);if(!confirm(tr('导入后会合并排片，同一影片以备份中的记录为准；已开启同步时也会同步到其他设备。继续？')))return;
  if(syncBusy)await syncBusy;const restored=window.SparrowBackup.restore(profileSnap(),data);applyProfileSafely(restored);syncPrint='';route();toast('备份已导入');if(syncSt?.code)syncQuiet();
 }catch{toast('未能导入，请检查备份格式与浏览器存储空间');}}
async function clearCloudProfile(){if(!syncSt?.code)return;if(!confirm(tr('请先保存完整备份，并在其他设备停止同步。请先在影片页撤回不想保留的社区评分。清空云端内容并断开本设备？本机档案仍会保留。')))return;
 if(profileClearing)return;profileClearing=true;clearTimeout(syncTimer);const b=document.querySelector('[data-profile="clear-cloud"]');if(b)b.disabled=true;
 try{if(syncBusy)await syncBusy;const code=syncSt.code;let done=false;
  for(let i=0;i<4;i++){const remote=await sbRpc('mg_pull',{code}),empty=window.SparrowBackup.empty(remote.data),result=await sbRpc('mg_push',{code,data:empty,base_rev:remote.rev||0});if(result.ok){done=true;break;}}
  if(!done)throw new Error('concurrent update');syncSt=null;syncSave();syncReveal=false;syncStatus={state:'idle',msg:'',at:0};syncPaint();toast('云端内容已清空，本机档案保留');
 }catch{toast('云端清空未完成，请稍后重试');if(b)b.disabled=false;}finally{profileClearing=false;}}
document.addEventListener('click',e=>{
  const eco=e.target.closest('[data-eco]');
  if(eco){
    if(eco.dataset.eco==='export-lb'){exportLetterboxdFile();return;}
    if(eco.dataset.eco==='import-csv'){const input=document.createElement('input');input.type='file';input.accept='.csv,text/csv';input.onchange=()=>{const file=input.files[0];input.remove();importEcoCSVFile(file);};input.style.display='none';document.body.append(input);input.click();input.addEventListener('cancel',()=>input.remove());return;}
  }
  const b=e.target.closest('[data-profile]');if(!b)return;if(b.dataset.profile==='backup')downloadProfile();else if(b.dataset.profile==='clear-cloud')clearCloudProfile();else{const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=()=>{const file=input.files[0];input.remove();importProfile(file);};input.style.display='none';document.body.append(input);input.click();input.addEventListener('cancel',()=>input.remove());}
});

function syncStart(){syncPrint=profilePrint();if(syncSt&&syncSt.code)syncQuiet();
  setInterval(()=>{if(!syncSt||!syncSt.code||syncBusy||profileClearing)return;const p=profilePrint();if(p!==syncPrint){syncPrint=p;clearTimeout(syncTimer);syncTimer=setTimeout(syncQuiet,3000);}},2000);
  document.addEventListener('visibilitychange',()=>{if(syncSt&&syncSt.code&&document.visibilityState==='visible'&&Date.now()-(syncSt.at||0)>30000)syncQuiet();});
  setInterval(()=>{if(syncStatus.state==='ok')syncPaint();},60000);}
