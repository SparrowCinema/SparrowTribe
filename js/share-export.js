/* js/share-export.js — 个人排片页、分享链接与对排片、导出长图 / 日历 / 分享海报。
   网站脚本按功能拆成 js/*.js，按 index.html 里的顺序加载；部署时 tools/build-assets.js 按同样顺序合并成一个 app.js。 */
/* 二级页面（个人排片、趣味图谱、海报墙、添加到手机、使用统计）左上角的返回按钮：44px 触控区、带底色的胶囊，比原来右上角的灰色小字更醒目 */
function subBackHTML(){return '<button class="sub-back" data-tab="my" aria-label="'+esc(tr("返回我的"))+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5-7 7 7 7"/></svg><span>'+esc(tr("我的"))+'</span></button>';}
function planPage(){const all=selectedRows(),list=scopedRows(),st=planStats(list);
  main.innerHTML='<section class="view gut">'+subBackHTML()+'<div class="page-heading"><div><small>MY PROGRAMME</small><h2 class="sec">个人排片</h2></div></div>'+planGoneHTML()+
  (all.length?planProgChips(all)+(!list.length?'<div class="empty-plan"><h3>这个专题还没有加入场次</h3><p>可以切换到「全部专题」，或去排片表挑选。</p><button class="primary-button" data-prog-sched="'+esc(selList(planFilt)[0]||'')+'">去看这个专题的排片</button></div>':statsHTML(st)+'<div class="plan-toolbar"><button class="primary-button" data-tab="export">导出与分享</button>'+smartPlanButtonHTML('secondary-button')+'<button class="secondary-button" data-tab="schedule">继续选片</button><button class="text-button" data-action="clear-plan">清空排片</button></div>'+(st.clash?'<div class="conflict" role="status"><b>有 '+st.clash+' 组场次时间重叠</b><p>重叠处已在日程中标红，可一键换场或移出其中一场。</p>'+conflictSwapsHTML(list)+'</div>':'')+'<div class="plan-days">'+planRowsHTML(list,true)+'</div>')
  :'<div class="empty-plan"><span>＋</span><h3>还没有加入场次</h3><p>在排片表或影片详情里，点击“加入排片”，或根据想看清单自动排片。</p><div class="empty-plan-acts"><button class="primary-button" data-tab="schedule">去选电影</button>'+(wantFilmIds().length?smartPlanButtonHTML('secondary-button'):'')+'</div></div>')+
  '<p class="local-note">散场时间以排片表为准，未公布时按影片片长计算。含映后活动的场次已按约 30 分钟纳入转场提醒，跨影院用时按距离估算。</p></section>';}
function homeURL(){return location.origin+location.pathname;}
function shareURL(list){return location.origin+location.pathname+'#share='+encodeURIComponent(list.map(keyOf).join('~'));}
function shareURLShort(list){return location.origin+location.pathname+'#share='+list.map(keyOf).join('~');}
function qrMatrix(text){if(!window.QRCodeLib)return null;try{const {QRCode,ECL}=window.QRCodeLib;const q=new QRCode(-1,ECL.L);q.addData(text);q.make();const n=q.getModuleCount(),m=[];for(let r=0;r<n;r++){m.push([]);for(let c=0;c<n;c++)m[r].push(q.isDark(r,c));}return m;}catch(e){return null;}}
function qrSVG(text){const m=qrMatrix(text);if(!m)return '';const n=m.length,q=4;let d='';for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(m[r][c])d+='M'+(c+q)+' '+(r+q)+'h1v1h-1z';return '<svg viewBox="0 0 '+(n+2*q)+' '+(n+2*q)+'" role="img" aria-label="分享二维码" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="'+d+'" fill="#1d1712"/></svg>';}
function exportTitleHTML(list){const ids=[...new Set(list.map(x=>x.p))].filter(id=>PG[id]),names=ids.map(id=>PG[id].name);if(!names.length)return '';
  const lines=names.length>3?[names[0],names[1],(LANG==='en'?'+ '+(names.length-2)+' more':'等 '+(names.length)+' 个专题')]:names;
  return '<h3 class="pb-title'+(names.length>1?' multi':'')+'">'+lines.map(l=>'<span>'+esc(l)+'</span>').join('')+'</h3>';}
/* 对排片：朋友分享的排片 vs 我的排片（规则在 shared/overlap.js，小程序 pages/share 同步）
   同场 / 同一部电影不同场 / 可以一起加入（不冲突）/ 与我的排片冲突；只比较尚未散场的场次 */
function overlapRowHTML(s,extra){const f=F[s.id],V=VN[s.v]||{};return '<li class="ov-row"><div class="ov-t"><b>'+s.d+' '+wk(s.d)+'</b><span>'+s.t+'</span></div><div class="ov-i"><button class="ov-f" data-film="'+esc(f.id)+'">'+esc(f.cn)+(f.version?'<em>'+esc(f.version)+'</em>':'')+'</button><small>'+esc(venueLabel(V))+' · '+esc((hallOf(s)||{}).name||s.h)+'</small>'+(extra||'')+'</div>'+(extra===undefined?planToggleHTML(s):'')+'</li>';}
function overlapHTML(list,missing){
  const mine=selectedRows(),note=missing?'<p class="ov-miss">TA 的 '+missing+' 场已更新或取消，没有显示</p>':'';
  if(!mine.length)return '<div class="ov-card ov-empty"><b>和 TA 对一对排片</b><p>先加入你自己想看的场次，这里就会显示你们哪几场在一起、哪几场时间冲突。</p><button class="text-button" data-tab="schedule">去选场次 ›</button>'+note+'</div>';
  const c=SparrowOverlap.compare(list,mine,{key:keyOf,film:s=>s.id,span:s=>[showDate(s).getTime(),showEnd(s)],now:now()});
  const sec=(title,items)=>items.length?'<div class="ov-sec"><h4>'+title+'</h4><ul>'+items.join('')+'</ul></div>':'';
  const head=c.same.length?'<div class="ov-big"><b>'+c.same.length+'</b><span>场同场</span></div><p class="ov-sub">你们有 '+c.same.length+' 场同场</p>':'<p class="ov-sub ov-none">你们还没有同一场的电影</p>';
  const facts=[c.sameFilm.length?'同一部电影、不同场次 '+c.sameFilm.length+' 部':'',c.free.length?'TA 还有 '+c.free.length+' 场和你不冲突':'',c.clash.length?'与你的排片冲突 '+c.clash.length+' 场':''].filter(Boolean);
  return '<div class="ov-card"><small class="ov-k">PLAN MATCH · 对排片</small>'+head+(facts.length?'<p class="ov-facts">'+facts.map(x=>'<span>'+x+'</span>').join('')+'</p>':'')+
    sec('同场',c.same.map(s=>overlapRowHTML(s,'')))+
    sec('同一部电影，不同场次',c.sameFilm.map(x=>overlapRowHTML(x.their,'<small class="ov-me">你选的是 '+x.mine.map(m=>m.d+' '+m.t).join('、')+'</small>')))+
    sec('可以一起去（和你的排片不冲突）',c.free.map(s=>overlapRowHTML(s)))+
    sec('时间冲突',c.clash.map(x=>overlapRowHTML(x.their,'<small class="ov-clash">与你的《'+esc(F[x.mine.id].cn)+'》'+x.mine.d+' '+x.mine.t+' 冲突</small>')))+
    note+'<p class="ov-tip">想让 TA 也看到对比？<button class="text-button" data-tab="export">把我的排片发给 TA ›</button></p></div>';
}
function exportPage(shared){let list;
  let missing=0;
  if(shared!==undefined){try{const raw=decodeURIComponent(shared);const keys=raw.split('~').filter(Boolean),ok=[...new Set(keys.map(resolveKey).filter(k=>validKeys.has(k)))]; /* 改期的场次按变更记录换成新场次 *//* 部分场次已改期 / 取消时仍显示其余场次，并提示少了几场 */if(!ok.length)throw Error();missing=keys.length-ok.length;list=selectedRows(ok);}catch{main.innerHTML='<section class="view gut"><h2 class="sec">这个分享链接无法读取</h2><p>链接可能不完整，或其中场次已更新。</p><button class="primary-button" data-tab="my">打开我的影展</button></section>';currentExport=[];return;}}
  else list=scopedRows();
  currentExport=list;const isShared=shared!==undefined,st=planStats(list);
  if(!list.length){main.innerHTML='<section class="view gut export-view"><div class="page-heading"><div><small>TAKE CINEMA WITH YOU</small><h2 class="sec">导出与分享</h2></div><button class="text-button" data-tab="plan">我的排片</button></div><div class="share-empty">'+(selectedRows().length?planProgChips(selectedRows())+'<div class="empty-plan"><h3>这个专题还没有加入场次</h3><p>请切换到「全部专题」或其他专题，再导出与分享。</p></div>':'<div class="empty-plan"><h3>先为自己选几场电影</h3><p>加入场次后，就能生成带二维码的分享日程。</p><button class="primary-button" data-tab="schedule">去选电影</button></div>')+'</div></section>';return;}
  const qr=qrSVG(homeURL()),canShare=!!navigator.share;
  const chips=isShared?'':planProgChips(selectedRows());
  const tile=(act,ic,t,s,cls='')=>'<button class="xtile '+cls+'" data-action="'+act+'"><span class="xt-ic">'+ic+'</span><b>'+t+'</b><small>'+s+'</small></button>';
  const IC={img:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>',cal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M9 15h6"/></svg>',pdf:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M7 14h10v7H7z"/></svg>',add:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg>',share:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>'};
  main.innerHTML='<section class="view gut export-view"><div class="page-heading"><div><small>'+(isShared?'SHARED PROGRAMME':'TAKE CINEMA WITH YOU')+'</small><h2 class="sec">'+(isShared?'朋友分享的排片':'导出与分享')+'</h2></div><button class="text-button" data-tab="plan">我的排片</button></div>'+chips+
  (isShared?'<div class="shared-banner"><b>'+st.n+' 场电影 · '+st.days+' 天</b><p>这是一份别人分享给你的观影日程。加入后会和你自己的排片合并。</p><button class="primary-button" data-action="import-plan">全部加入我的排片</button></div>'+overlapHTML(list,missing):'')+
  '<div class="share-panel">'+(qr?'<div class="qr-box">'+qr+'</div>':'')+'<div class="share-body"><b>扫码直达排片首页</b><small>二维码打开网站首页，查看完整片目与最新排片。下方链接可分享这份个人日程。</small><div class="link-row"><input id="share-url" readonly value="'+esc(shareURL(list))+'" aria-label="分享链接"><button class="secondary-button" data-action="copy-link">复制链接</button></div>'+(canShare?'<button class="text-button share-sys" data-action="system-share">'+IC.share+' 通过手机分享…</button>':'')+'</div></div>'+
  '<div class="export-grid">'+tile('png',IC.img,'排片长图','含海报与二维码 · PNG','main')+tile('calendar',IC.cal,'导入日历','.ics · 手机/电脑日历')+tile('print',IC.pdf,'打印 / PDF','A4 排版')+'</div>'+
  '<h3 class="blockh">预览 <small>PREVIEW</small></h3><div class="share-paper"><div class="paper-band"><div class="pb-top"><div class="pb-brand">'+DUO_PRINT+'<b>'+tr('麻雀观影护照')+'</b></div>'+(LANG==='en'?'':'<span class="pb-en">SPARROW FILM PASSPORT</span>')+'</div><em>'+(isShared?'观影日程':'我的观影日程')+'</em>'+exportTitleHTML(list)+'</div><div class="paper-stats"><span><b>'+st.n+'</b>场</span><span><b>'+st.days+'</b>天</span><span><b>'+st.hm+'</b>银幕时长</span></div><div class="plan-days">'+planRowsHTML(list,false)+'</div><footer>'+(qr?'<div class="paper-qr">'+qr+'</div>':'')+'<div><b>扫码进入排片首页</b><span>麻雀观影护照 · 麻雀映画 × 麻雀部落</span></div></footer></div>'+
  '<p class="local-note">二维码直达网站首页；分享链接保存此刻的场次选择，之后修改个人排片不会改变已发出的日程。</p></section>';}
function downloadBlob(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
function wrapLines(ctx,text,maxWidth){text=tr(String(text));const out=[];let line='';const toks=CJK.test(text)||!/\s/.test(text)?Array.from(text):text.split(/(?<=\s)/);for(const ch of toks){if(ctx.measureText(line+ch).width>maxWidth&&line){out.push(line.trimEnd());line=ch;}else line+=ch;}if(line)out.push(line.trimEnd());return out;}
function wrapCanvas(ctx,text,x,y,maxWidth,lineHeight){const ls=wrapLines(ctx,text,maxWidth);ls.forEach((l,i)=>ctx.fillText(l,x,y+i*lineHeight));return y+(ls.length-1)*lineHeight;}
/* 影片 / 专题分享海报：与小程序同一套版式（shared/share-poster.js）；网站页脚二维码指向该页的分享链接 */
let sposterBusy=false;
async function makeSharePoster(k,id){
 const SP=window.SparrowSharePoster;if(!SP||sposterBusy)return;sposterBusy=true;toast(tr('正在生成分享海报…'));
 try{try{await Promise.all(['900 60px "Noto Serif SC"','500 28px "Noto Sans SC"','600 24px "IBM Plex Mono"'].map(f=>document.fonts.load(f,'麻雀观影护照0123')));}catch(e){}
  const marks=await Promise.all(['brand/mark-movies.png','brand/mark-tribe.png'].map(loadImg)),url=pageShareURL(k,id);let o;
  const place=x=>{const v=VN[x.v]||{},h=(v.halls||[]).find(y=>y.id===x.h);return (LANG==='en'?vShort(v):v.name)+(h?' · '+tr(h.name):'');};
  if(k==='f'){const f=F[id];if(!f)return;const p=progOf(f),up=SH.filter(x=>x.id===f.id&&!isPast(x)).slice(0,3);
   o={kind:'film',kicker:'SPARROW FILM PASSPORT · '+String(p.en||'FILM').toUpperCase(),title:f.cn,tag:tr(editionOf(f)),en:f.en||f.o||'',meta:[f.dir?tr('导演')+' '+f.dir:'',[f.y,tr(f.c||''),f.min&&!f.minTbd?tr(f.min+' 分钟'):''].filter(Boolean).join(' · '),p.name].filter(Boolean),
    lines:up.map(x=>({when:x.d+' '+x.t,where:place(x)})),img:await loadImg(pst(f.id)),qrText:tr('扫码查看影片详情'),qrSub:tr('场次、购票与观影护照'),url:url.replace(/^https?:\/\//,'').replace(/\.html$/,'')};}
  else{const p=PG[id];if(!p)return;const fl=FILMS.filter(f=>filmProgsOf(f).some(x=>x.p.id===p.id)),sh=SH.filter(x=>x.p===p.id&&!F[x.id]?.ev);
   const nextAt=f=>{const n=sh.find(x=>x.id===f.id&&!isPast(x));return n?showDate(n).getTime():Infinity;},pick=fl.slice().sort((a,b)=>nextAt(a)-nextAt(b)).slice(0,5);
   o={kind:'programme',kicker:'SPARROW FILM PASSPORT · '+String(p.en||p.kind||'PROGRAMME').toUpperCase(),title:p.name,en:LANG==='en'?'':(p.en||''),meta:[[tr(p.period||''),tr(p.city||'')].filter(Boolean).join(' · ')].filter(Boolean),
    stats:[[fl.length,tr('部影片')],[sh.length,tr('场放映')],[new Set(sh.map(x=>x.d)).size,tr('个放映日')],[new Set(sh.map(x=>x.v+x.h)).size,tr('个影厅')]],blurb:p.blurb||'',img:await loadImg(p.cover),posters:await Promise.all(pick.map(f=>loadImg(pst(f.id)))),
    qrText:tr('扫码查看专题'),qrSub:tr('片单、排片与活动'),url:url.replace(/^https?:\/\//,'').replace(/\.html$/,'')};}
  Object.assign(o,{qr:qrMatrix(url),marks,T:tr});
  const cv=document.createElement('canvas'),ctx=cv.getContext('2d');cv.width=SP.W;cv.height=SP.heightOf(o,ctx);SP.draw(cv.getContext('2d'),o);
  const blob=await new Promise(r=>cv.toBlob(r,'image/png'));if(!blob){toast(tr('海报生成失败，请稍后再试'));return;}
  showImageSheet(blob,{file:'麻雀观影护照_'+o.title+'.png',head:tr('分享海报已生成'),alt:o.title});
 }catch(e){console.warn(e);toast(tr('海报生成失败，请稍后再试'));}finally{sposterBusy=false;}
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-sposter]');if(!b)return;const [k,id]=b.dataset.sposter.split(':');makeSharePoster(k,id);});
function loadImg(src){return new Promise(r=>{if(!src)return r(null);const im=new Image();im.onload=()=>r(im);im.onerror=()=>r(null);im.src=src;});}
function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
let pngBusy=false;
async function exportPNG(){const list=currentExport;if(!list.length||pngBusy)return;pngBusy=true;toast('正在生成排片长图…');
  try{try{await Promise.all(['900 64px "Noto Serif SC"','700 30px "Noto Sans SC"','500 24px "IBM Plex Mono"'].map(f=>document.fonts.load(f,'麻雀映画部落排片0123')));}catch(e){}
  const SERIF='"Noto Serif SC","Songti SC",serif',SANS='"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif',MONO='"IBM Plex Mono",Menlo,monospace';
  const W=1080,P=64,ROW=196,GAP=52,DAYH=104,STATS=150,FOOT=420;
  const groups=byDay(list),imgs={};const marks=await Promise.all(['brand/mark-movies.png','brand/mark-tribe.png'].map(loadImg));await Promise.all([...new Set(list.map(s=>s.id))].map(async id=>{imgs[id]=await loadImg(pst(id));}));
  const pids=[...new Set(list.map(x=>x.p))].filter(id=>PG[id]),mc=document.createElement('canvas').getContext('2d');
  let TS=pids.length===1?92:68,titleLines=[];const fitT=()=>{mc.font='900 '+TS+'px '+SERIF;const mw=W-2*P;titleLines=[];
    if(pids.length<=1)titleLines=wrapLines(mc,pids.length?PG[pids[0]].name:kickT,mw);
    else{const show=pids.length>3?pids.slice(0,2):pids;show.forEach(id=>{const ls=wrapLines(mc,PG[id].name,mw);titleLines.push(ls.length>1?ls[0].replace(/\s+$/,'')+'…':ls[0]);});if(pids.length>3)titleLines.push(LANG==='en'?'+ '+(pids.length-2)+' more':'等 '+pids.length+' 个专题');}};
  const kickT=LANG==='en'?'Screening plan':'观影日程';fitT();while(titleLines.length>3&&TS>52){TS-=6;fitT();}if(pids.length>1){TS=60;fitT();while(titleLines.some(l=>l.endsWith('…'))&&TS>44){TS-=4;fitT();}}
  const TLH=Math.round(TS*1.2),TY0=152+14+TS,HEAD=TY0+(titleLines.length-1)*TLH+64;
  const H=HEAD+STATS+groups.reduce((n,[,it])=>n+DAYH+it.length*ROW+(it.length-1)*GAP+24,0)+FOOT;
  const cv=document.createElement('canvas'),scale=1;cv.width=W*scale;cv.height=H*scale;const c=cv.getContext('2d');c.scale(scale,scale);c.textBaseline='alphabetic';
  c.fillStyle='#efe6d4';c.fillRect(0,0,W,H);
  // header band：专题名最大，品牌与 Logo 缩小放角落
    c.fillStyle='#8e2a22';c.fillRect(0,0,W,HEAD);c.fillStyle='rgba(255,255,255,.06)';for(let x=-HEAD;x<W;x+=46){c.beginPath();c.moveTo(x,HEAD);c.lineTo(x+HEAD*.47,0);c.lineTo(x+HEAD*.47+2,0);c.lineTo(x+2,HEAD);c.fill();}
  const R0=24;marks.forEach((im,i)=>{const cx=P+R0+i*(R0*2-10),cy=70;c.fillStyle='#fffaf0';c.beginPath();c.arc(cx,cy,R0,0,Math.PI*2);c.fill();c.strokeStyle='#8e2a22';c.lineWidth=3;c.stroke();if(im){const k=Math.min((R0*1.5)/im.width,(R0*1.5)/im.height),w=im.width*k,h=im.height*k;c.drawImage(im,cx-w/2,cy-h/2,w,h);}});
  const bx=P+R0*3-10+30;c.fillStyle='#fffaf0';c.font='italic 900 26px '+SERIF;c.fillText('麻雀观影护照',bx,78);
  if(LANG!=='en'){c.globalAlpha=.7;c.font='500 17px '+MONO;c.textAlign='right';c.fillText('SPARROW FILM PASSPORT',W-P,76);c.textAlign='left';c.globalAlpha=1;}
  const kick=LANG==='en'?(location.hash.startsWith('#share=')?'Screening plan':'My screening plan'):(location.hash.startsWith('#share=')?'观影日程':'我的观影日程');
  c.fillStyle='#fffaf0';c.fillRect(P,142,48,3);c.globalAlpha=.9;c.font='600 26px '+SANS;c.fillText(kick,P+64,152);c.globalAlpha=1;
  c.fillStyle='#fffaf0';c.font='900 '+TS+'px '+SERIF;titleLines.forEach((l,i)=>c.fillText(l,P,TY0+i*TLH));
  // stats
  const st=planStats(list);let sx=P;[[st.n,'场放映'],[st.days,'天行程'],[st.hm,'银幕时长']].forEach(([v,l])=>{c.fillStyle='#2b2117';c.font='600 56px '+MONO;c.fillText(String(v),sx,HEAD+92);const w=c.measureText(String(v)).width;c.fillStyle='#7a6a55';c.font='400 24px '+SANS;c.fillText(l,sx+w+10,HEAD+92);sx+=Math.max(250,w+150);});
  c.fillStyle='#d8cbb1';c.fillRect(P,HEAD+STATS-24,W-2*P,2);
  let y=HEAD+STATS;
  groups.forEach(([d,items])=>{
    c.fillStyle='#8e2a22';c.font='600 44px '+MONO;c.fillText(d,P,y+56);const dw=c.measureText(d).width;c.font='700 26px '+SANS;c.fillText(wk(d),P+dw+16,y+56);
    c.fillStyle='#7a6a55';c.font='400 22px '+SANS;const meta=items.length+' 场 · '+items[0].t+' – '+fmt(endMin(items[items.length-1]));c.textAlign='right';c.fillText(meta,W-P,y+56);c.textAlign='left';
    y+=DAYH;
    items.forEach((s,i)=>{const f=F[s.id];
      if(i){const g=gapOf(items[i-1],s);c.font='400 22px '+SANS;c.fillStyle=g.cls==='clash'?'#b3261e':g.cls==='tight'?'#b26a1f':'#7a6a55';const gl=wrapLines(c,(g.cls==='clash'?'⚠ ':'')+g.txt,W-2*P-220);c.fillText(gl[0]+(gl.length>1?'…':''),P+220,y+GAP/2+6);c.fillStyle='#d8cbb1';c.fillRect(P+180,y-10,2,GAP+20);y+=GAP;}
      // card
      c.fillStyle='#f8f2e6';rr(c,P+200,y,W-2*P-200,ROW-20,14);c.fill();c.fillStyle=regColor(f);rr(c,P+200,y,8,ROW-20,4);c.fill();
      c.fillStyle='#2b2117';c.font='600 40px '+MONO;c.fillText(s.t,P,y+52);c.fillStyle='#7a6a55';c.font='400 26px '+MONO;c.fillText('— '+fmt(endMin(s)),P,y+92);
      const im=imgs[s.id],tx=P+232,ty=y+18,tw=104,th=ROW-56;
      if(im){c.save();rr(c,tx,ty,tw,th,6);c.clip();const r=Math.max(tw/im.width,th/im.height),iw=im.width*r,ih=im.height*r;c.drawImage(im,tx+(tw-iw)/2,ty+(th-ih)/2,iw,ih);c.restore();}
      else{c.fillStyle=regColor(f);rr(c,tx,ty,tw,th,6);c.fill();c.fillStyle='#fffaf0';c.font='900 44px '+SERIF;c.fillText(f.cn[0],tx+30,ty+80);}
      const ix=tx+tw+24,iw2=W-P-24-ix;c.fillStyle='#2b2117';c.font='700 36px '+SANS;const tl=wrapLines(c,f.cn,iw2-(f.version?110:0));c.fillText(tl[0]+(tl.length>1?'…':''),ix,y+58);
      if(f.version){const tw2=c.measureText(tl[0]+(tl.length>1?'…':'')).width;c.font='600 20px '+MONO;const vw=c.measureText(f.version).width+18;c.strokeStyle='#8e2a22';c.lineWidth=2;rr(c,ix+tw2+12,y+32,vw,32,6);c.stroke();c.fillStyle='#8e2a22';c.fillText(f.version,ix+tw2+21,y+56);}
      c.fillStyle='#7a6a55';c.font='400 24px '+SANS;c.fillText(wrapLines(c,(f.dir?f.dir+' · ':'')+minText(f),iw2)[0],ix,y+100);
      c.fillStyle='#2f6f6c';c.font='500 24px '+SANS;c.fillText(wrapLines(c,(LANG==='en'?vShort(VN[s.v]):VN[s.v].name)+' · '+hallOf(s).name,iw2)[0],ix,y+140);
      y+=ROW;});
    y+=24;});
  // footer with QR
  const fy=y+20;c.fillStyle='#2b2117';rr(c,P,fy,W-2*P,FOOT-84,20);c.fill();
  const m=qrMatrix(homeURL()),qs=264,qx=P+36,qy=fy+36;
  if(m){c.fillStyle='#fff';rr(c,qx,qy,qs,qs,10);c.fill();const n=m.length,cell=(qs-24)/(n+8);c.fillStyle='#1d1712';for(let r=0;r<n;r++)for(let k=0;k<n;k++)if(m[r][k])c.fillRect(Math.floor(qx+12+(k+4)*cell),Math.floor(qy+12+(r+4)*cell),Math.ceil(cell),Math.ceil(cell));}
  const fx=m?qx+qs+40:P+36;c.fillStyle='#fffaf0';c.font='700 38px '+SANS;c.fillText('扫码进入排片首页',fx,fy+100);c.font='400 24px '+SANS;c.globalAlpha=.8;wrapCanvas(c,'查看完整片目 · 选择想看的电影',fx,fy+150,W-P-36-fx,34);c.globalAlpha=.6;c.font='400 20px '+MONO;c.fillText(location.host+location.pathname,fx,fy+226);c.globalAlpha=1;
  c.fillStyle='#e0b9a6';c.font='italic 900 30px '+SERIF;const brandW=c.measureText('麻雀观影护照').width;c.fillText('麻雀观影护照',fx,fy+280);c.fillStyle='#fffaf0';c.globalAlpha=.7;c.font='400 20px '+SANS;if(LANG==='en')c.fillText('麻雀映画 × 麻雀部落',fx,fy+318);else c.fillText('麻雀映画 × 麻雀部落',fx+brandW+40,fy+278);c.globalAlpha=1;
  const blob=await new Promise(r=>cv.toBlob(r,'image/png'));if(!blob){toast('图片生成失败，请使用打印导出');return;}
  showImageSheet(blob);}finally{pngBusy=false;}}
/* opt.extra：[{label, run}]，保存按钮下方的一排次要操作（如票根合成图的「也导出正面 / 背面」），点了先关掉这张再运行 */
function showImageSheet(blob,opt){opt=opt||{};const url=URL.createObjectURL(blob),file=new File([blob],opt.file||'麻雀观影护照_我的观影日程.png',{type:blob.type||'image/png'});const canFile=!!(navigator.canShare&&navigator.canShare({files:[file]}));
  let el=document.getElementById('img-sheet');if(el)el.remove();el=document.createElement('div');el.id='img-sheet';el.className='img-sheet';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','排片长图');
  el.innerHTML='<div class="is-panel"><div class="is-grab" aria-hidden="true"><i></i></div><div class="is-head"><b>'+(opt.head||'排片长图已生成')+'</b><button class="is-close" aria-label="关闭"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 6l12 12M18 6 6 18"/></svg><span>关闭</span></button></div><div class="is-img"><img src="'+url+'" alt="'+(opt.alt||'排片长图预览')+'"></div><p class="is-tip">手机上长按图片可保存到相册 · 下滑或点「关闭」退出</p><div class="is-actions">'+(canFile?'<button class="primary-button" data-is="share">分享图片</button>':'')+'<button class="'+(canFile?'secondary':'primary')+'-button" data-is="save">保存图片</button></div>'+(opt.extra&&opt.extra.length?'<div class="is-more">'+opt.extra.map((x,i)=>'<button type="button" class="text-button" data-is="x'+i+'">'+esc(x.label)+'</button>').join('')+'</div>':'')+'</div>';
  document.body.appendChild(el);document.documentElement.classList.add('sheet-open');
  const panel=el.querySelector('.is-panel'),scroller=el.querySelector('.is-img');let closed=false;
  const close=(fromPop)=>{if(closed)return;closed=true;document.documentElement.classList.remove('sheet-open');document.removeEventListener('keydown',onKey);window.removeEventListener('popstate',onPop);el.classList.add('out');setTimeout(()=>{el.remove();URL.revokeObjectURL(url);},200);if(!fromPop&&history.state&&history.state.sheet)history.back();};
  const onKey=e=>{if(e.key==='Escape')close();};const onPop=()=>close(true);
  document.addEventListener('keydown',onKey);try{history.pushState({sheet:1},'');window.addEventListener('popstate',onPop);}catch(e){}
  el.querySelector('.is-close').focus({preventScroll:true});
  el.addEventListener('input',e=>{if(e.target.matches('.rc-prog-search'))filterRecapProgrammes(el,e.target.value);});
  el.addEventListener('click',async e=>{if(e.target===el||e.target.closest('.is-close'))return close();const b=e.target.closest('[data-is]');if(!b)return;if(/^x\d+$/.test(b.dataset.is)){const x=opt.extra&&opt.extra[+b.dataset.is.slice(1)];close();if(x)setTimeout(x.run,220);return;}if(b.dataset.is==='save'){downloadBlob(blob,opt.file||'麻雀观影护照_我的观影日程.png');toast('图片已保存');}else{try{await navigator.share({files:[file],title:tr('麻雀观影护照 · 我的观影日程')});}catch(err){}}});
  let y0=null,dy=0,fromHead=false;
  panel.addEventListener('touchstart',e=>{fromHead=!!e.target.closest('.is-grab,.is-head');if(fromHead||scroller.scrollTop<=0){y0=e.touches[0].clientY;dy=0;}else y0=null;},{passive:true});
  panel.addEventListener('touchmove',e=>{if(y0==null)return;dy=e.touches[0].clientY-y0;if(dy<=0){panel.style.transform='';return;}if(!fromHead&&scroller.scrollTop>0){y0=null;panel.style.transform='';return;}panel.style.transition='none';panel.style.transform='translateY('+dy+'px)';if(fromHead||dy>8)e.preventDefault();},{passive:false});
  panel.addEventListener('touchend',()=>{if(y0==null)return;panel.style.transition='';if(dy>110)close();else panel.style.transform='';y0=null;dy=0;});
}
/* 日历导出（2026-11-16 起每场带开场前 1 小时提醒，与小程序「加入手机日历」一致；按影院/专题时区输出 VTIMEZONE）。list 不传时导出当前导出页的场次；remindOne 导出单场 */
function exportCalendar(list,name){list=list||currentExport;if(!list.length)return;const escapeIcs=s=>String(s).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');const tzs=list.map(s=>SparrowTZ.tzOf(s,VN,PG)),primaryTz=tzs[0]||SparrowTZ.DEFAULT_TZ;let lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//SparrowCinema//Style Kaleidoscope//ZH','CALSCALE:GREGORIAN','X-WR-CALNAME:'+tr('麻雀观影护照'),'X-WR-TIMEZONE:'+primaryTz,...SparrowTZ.icsTimezones(tzs)];const dtStamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+Z/,'Z');for(const s of list){const ev=SparrowTZ.icsEventDates(s,durationOf(s),VN,PG);lines.push('BEGIN:VEVENT','UID:'+encodeURIComponent(keyOf(s))+'@style-kaleidoscope','DTSTAMP:'+dtStamp,ev.dtstart,ev.dtend,'SUMMARY:'+escapeIcs([F[s.id].cn,editionOf(F[s.id])].filter(Boolean).join(' · ')),'LOCATION:'+escapeIcs(VN[s.v].name+' · '+hallOf(s).name),'DESCRIPTION:'+escapeIcs((PG[s.p]||progOf(F[s.id])).name+' · '+(PG[s.p]||progOf(F[s.id])).sub+'\n'+tr('影片片长 '+minText(F[s.id]))+'\n'+tr('麻雀观影护照')),'BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:'+escapeIcs(tr('1 小时后开场')+' · '+F[s.id].cn),'TRIGGER:-PT1H','END:VALARM','END:VEVENT');}lines.push('END:VCALENDAR');downloadBlob(new Blob([lines.join('\r\n')+'\r\n'],{type:'text/calendar;charset=utf-8'}),name||'麻雀观影护照_我的观影日程.ics');toast(name?tr('已生成提醒，打开文件加入日历'):'日历文件已生成');}
function remindOne(k){const s=SH.find(x=>keyOf(x)===k);if(!s)return;stat('remind',s.id);exportCalendar([s],tr('开场提醒')+'_'+F[s.id].cn+'_'+s.d.replace('/','-')+'.ics');}
document.addEventListener('click',e=>{const b=e.target.closest('[data-remind]');if(b)remindOne(b.dataset.remind);});
/* 重绘后把被点的元素钉回原来的屏幕位置；上方图片、字体晚加载造成的位移在之后几帧内继续修正，用户一滑动就停止 */
function keepAnchor(find,ay,gx){let stop=false;const off=()=>{stop=true;};['touchstart','wheel','keydown'].forEach(ev=>window.addEventListener(ev,off,{once:true,passive:true}));
  const fix=()=>{if(stop)return;const n=find();if(n){const d=n.getBoundingClientRect().top-ay;if(Math.abs(d)>.5)window.scrollTo({top:window.scrollY+d,behavior:'instant'});}const g=document.getElementById('gantt');if(g&&gx!=null&&g.scrollLeft!==gx)g.scrollLeft=gx;};
  fix();requestAnimationFrame(fix);[60,150,300,600,1000].forEach(ms=>setTimeout(fix,ms));setTimeout(()=>['touchstart','wheel','keydown'].forEach(ev=>window.removeEventListener(ev,off)),1100);}
document.addEventListener('click',async e=>{const button=e.target.closest('[data-plan],[data-action]');if(!button)return;if(button.dataset.plan){const k=button.dataset.plan;if(!validKeys.has(k))return;if(picked.has(k))picked.delete(k);else picked.add(k);saveSelection();{const sh=SH.find(x=>keyOf(x)===k);stat(picked.has(k)?'plan_add':'plan_remove',sh&&sh.id);}const scroll=window.scrollY,gx=document.getElementById('gantt')?.scrollLeft,ay=button.getBoundingClientRect().top;route();window.scrollTo(0,scroll);const g2=document.getElementById('gantt');if(g2&&gx!=null)g2.scrollLeft=gx;/* 锚点：以被点的 +/✓ 按钮在屏幕上的位置为准，重绘后页面上方高度变化也不跳动 */const inG=!!button.closest('.tt');keepAnchor(()=>[...document.querySelectorAll('[data-plan]')].find(n=>n.dataset.plan===k&&!!n.closest('.tt')===inG),ay,gx);toast(picked.has(k)?'已加入个人排片':'已移出个人排片');return;}switch(button.dataset.action){case 'clear-plan':if(confirm(tr('清空当前浏览器保存的个人排片？'))){picked.clear();saveSelection();route();}break;case 'png':stat('export','png');exportPNG();break;case 'calendar':stat('export','ics');exportCalendar();break;case 'print':stat('export','pdf');window.print();break;case 'copy-link':{const input=document.getElementById('share-url');if(!input)break;try{await navigator.clipboard.writeText(input.value);toast('分享链接已复制');}catch{input.focus();input.select();toast('请复制已选中的分享链接');}break;}case 'system-share':{try{await navigator.share({title:tr('麻雀观影护照 · 观影日程'),text:tr('我的观影日程（'+currentExport.length+' 场）'),url:shareURL(currentExport)});}catch(err){}break;}case 'import-plan':currentExport.forEach(s=>picked.add(keyOf(s)));saveSelection();go('plan');break;}});
