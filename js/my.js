/* js/my.js — 「我的」页：观影结算、反馈、外观、菜单、趣味图谱、海报墙。
   网站脚本按功能拆成 js/*.js，按 index.html 里的顺序加载；部署时 tools/build-assets.js 按同样顺序合并成一个 app.js。 */
// —— 影院观影结算：按年份 / 专题筛选，生成长图 ——
const RC_SECTION_KEY='sparrow-recap-sections-v1';
function savedRecapSections(){try{const v=JSON.parse(localStorage.getItem(RC_SECTION_KEY));if(Array.isArray(v))return window.SparrowRecap.SECTIONS.map(x=>x[0]).filter(k=>v.includes(k));}catch(e){}return window.SparrowRecap.SECTIONS.map(x=>x[0]);}
let recapSections=savedRecapSections();
let recapY=[],recapM=[],recapP=[],recapYearReady=false,recapIncludeNotes=false; // 年份单选，月份 / 专题多选；空 = 全部
function selectRecapYear(v){const y=v==='all'?[]:[v];if(recapY[0]!==y[0])recapM=[];recapY=y;}
const tgl=(arr,v)=>arr.includes(v)?arr.filter(x=>x!==v):arr.concat(v);
function recapYears(all){return recapY.length?[...recapY].sort():recapM.length?[...new Set(recapM.map(k=>k.slice(0,4)))].sort():[...new Set(all.map(e=>e.rec.d.slice(0,4)))].sort();}
function recapScope(){const E=recapY.length?recapY:recapM.length?[...new Set(recapM.map(k=>k.slice(0,4)))]:null;
  return watchEntries().filter(e=>{const y=e.rec.d.slice(0,4),m=e.rec.d.slice(0,7);if(E&&!E.includes(y))return false;if(recapM.some(k=>k.startsWith(y))&&!recapM.includes(m))return false;return !recapP.length||recapP.includes(progOf(e.f).id);});}
/* 年份单选滑轨；仅显示当前年份的 6×2 月份日历，全部年份直接汇总。 */
function yearSegHTML(all,years){const cnt={};all.forEach(e=>{const y=e.rec.d.slice(0,4);cnt[y]=(cnt[y]||0)+1;});
  const it=(v,lab,n,on)=>'<button class="rc-y" data-rc="y" data-v="'+v+'" aria-pressed="'+on+'"><b>'+lab+'</b><small>'+n+' 部</small></button>';
  return '<div class="rc-seg" role="group" aria-label="年份">'+it('all',tr('全部年份'),all.length,!recapY.length)+years.map(y=>it(y,y,cnt[y],recapY.includes(y))).join('')+'</div>';}
function monthGridHTML(all){const ys=recapY.slice(0,1);
  return ys.map(Y=>{const cnt={};all.filter(e=>e.rec.d.slice(0,4)===Y).forEach(e=>{const m=e.rec.d.slice(0,7);cnt[m]=(cnt[m]||0)+1;});
    const max=Math.max(1,...Object.values(cnt));let h='<div class="rc-cal" role="group" aria-label="'+Y+' 月份（可多选）">';
    for(let m=1;m<=12;m++){const k=Y+'-'+String(m).padStart(2,'0'),n=cnt[k]||0,on=recapM.includes(k);
      h+='<button class="rc-d'+(n?'':' nil')+'" role="checkbox" data-rc="m" data-v="'+k+'" aria-checked="'+on+'"'+(n?' style="--p:'+Math.round(14+46*n/max)+'%"':' disabled')+' aria-label="'+Y+'年'+m+'月 '+n+' 部"><b>'+m+'</b><small>'+(n?n+' 部':'—')+'</small></button>';}
    return h+'</div>';}).join('');}
function recapProgrammeHTML(pids,chip){if(pids.length<=4)return '<div class="rc-chips">'+chip('all','全部专题',!recapP.length)+pids.map(id=>chip(id,PG[id].name,recapP.includes(id))).join('')+'</div>';
 const label=recapP.length?recapP.map(id=>PG[id].name).join('、'):tr('全部专题');return '<details class="rc-programme-picker"><summary><span>'+esc(label)+'</span><span>⌄</span></summary><div class="rc-pick-body"><input type="search" class="rc-prog-search" aria-label="'+tr('搜索专题')+'" placeholder="'+tr('搜索专题')+'"><div class="rc-prog-options">'+chip('all','全部专题',!recapP.length)+pids.map(id=>chip(id,PG[id].name,recapP.includes(id))).join('')+'</div><p class="rc-prog-empty" hidden>'+tr('没有匹配的专题')+'</p></div></details>';}
function filterRecapProgrammes(el,q){let n=0;el.querySelectorAll('.rc-prog-options [data-rc="p"]').forEach(b=>{b.hidden=b.dataset.v!=='all'&&!b.textContent.toLocaleLowerCase().includes(q.toLocaleLowerCase());if(!b.hidden)n++;});const empty=el.querySelector('.rc-prog-empty');if(empty)empty.hidden=n>1;}
function recapPanelHTML(){const all=watchEntries(),years=[...new Set(all.map(e=>e.rec.d.slice(0,4)))].sort().reverse(),pids=PROGRAMMES.map(p=>p.id).filter(id=>all.some(e=>progOf(e.f).id===id));
  if(!recapYearReady){recapY=years.slice(0,1);recapYearReady=true;}
  recapY=recapY.filter(y=>years.includes(y)).slice(0,1);recapM=recapM.filter(k=>all.some(e=>e.rec.d.slice(0,7)===k)&&recapY.includes(k.slice(0,4)));recapP=recapP.filter(id=>pids.includes(id));
  const list=recapScope(),st=passportStats(list),chip=(v,lab,on)=>'<button class="fchip" aria-pressed="'+on+'" data-rc="p" data-v="'+esc(v)+'">'+esc(lab)+'</button>';
  const noteOptCnt=typeof privateNoteOf==='function'?list.filter(e=>{const n=privateNoteOf(e.id);return n&&n.rc&&n.text&&!n.locked;}).length:0;
  return '<div class="rc-body"><p class="rc-k">年份 / YEAR</p>'+yearSegHTML(all,years)+
    (recapY.length?'<div class="rc-kh"><p class="rc-k">'+recapY[0]+' · 月份 / MONTH <small class="rc-hint">可多选</small></p>'+(recapM.length?'<button class="rc-clear" data-rc="mclear"><span>已选 '+recapM.length+' 个月</span><span>清除</span></button>':'')+'</div>'+monthGridHTML(all):'<p class="rc-year-note">'+tr('已汇总全部年份，选择年份可按月筛选。')+'</p>')+
    '<p class="rc-k">专题 / PROGRAMME <small class="rc-hint">可多选</small></p>'+recapProgrammeHTML(pids,chip)+
    '<fieldset class="rc-section-picker"><legend>'+tr('长图展示项目')+' <small>'+tr('可多选')+'</small></legend><div class="rc-options">'+window.SparrowRecap.SECTIONS.map(([id,label])=>'<label><input type="checkbox" data-rc="section" data-v="'+id+'" '+(recapSections.includes(id)?'checked':'')+'><span>'+esc(tr(label))+'</span></label>').join('')+'</div>'+(noteOptCnt?'<label class="rc-note-opt"><input type="checkbox" data-rc="notes" '+(recapIncludeNotes?'checked':'')+'><span>'+esc(tr('在观影清单中附带已勾选的私密笔记（'+noteOptCnt+' 条）'))+'</span></label>':'')+'<p>'+tr('品牌与二维码固定保留。')+' '+tr('仅影响生成的长图，不会修改观影记录。')+'</p></fieldset>'+
    '<div class="rc-sum">'+(list.length?'<span><b>'+st.n+'</b>部影片</span><span><b>'+st.hm+'</b>银幕时长</span><span><b>'+(st.avg?st.avg.toFixed(1):'—')+'</b>平均评分</span>':'<span class="rc-none">这个范围里还没有看过的影片</span>')+'</div>'+
    '<button class="primary-button rc-go" data-rc="go" '+(list.length&&recapSections.length?'':'disabled')+'>生成结算长图</button></div>';}
function recapSub(list){const all=watchEntries(),ys=recapYears(list.length?list:all),pm=recapM.length?[...recapM].sort():[];
  const when=pm.length?(pm.length<=3?pm.map(k=>k.replace('-','.')).join('、'):pm.length+tr(' 个月')):(ys.length>1?ys[0]+'–'+ys[ys.length-1]:ys[0]||'');
  const pn=recapP.length?(recapP.length<=2?recapP.map(id=>PG[id].name).join('、'):recapP.length+tr(' 个专题')):tr('全部专题');return when+' · '+pn;}
function openRecap(){if(!watchEntries().length){toast('先在影片页点「看过」，盖下第一枚印章');return;}
  let el=document.getElementById('recap-sheet');if(el)el.remove();el=document.createElement('div');el.id='recap-sheet';el.className='img-sheet rc-sheet';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','影院观影结算');
  el.innerHTML='<div class="is-panel rc-panel"><div class="is-head"><b>我的影院观影结算</b><button class="is-close" aria-label="关闭"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 6l12 12M18 6 6 18"/></svg><span>关闭</span></button></div><div class="rc-wrap">'+recapPanelHTML()+'</div></div>';
  document.body.appendChild(el);document.documentElement.classList.add('sheet-open');
  const close=()=>{document.documentElement.classList.remove('sheet-open');el.remove();};
  el.addEventListener('input',e=>{if(e.target.matches('.rc-prog-search'))filterRecapProgrammes(el,e.target.value);});
  el.addEventListener('click',async e=>{if(e.target===el||e.target.closest('.is-close'))return close();const b=e.target.closest('[data-rc]');if(!b)return;
    const R2=()=>{const wrap=el.querySelector('.rc-wrap'),left=wrap.querySelector('.rc-seg').scrollLeft,picker=wrap.querySelector('.rc-programme-picker'),opened=picker&&picker.open,q=wrap.querySelector('.rc-prog-search')?.value||'',sy=wrap.querySelector('.rc-prog-options')?.scrollTop||0;wrap.innerHTML=recapPanelHTML();wrap.querySelector('.rc-seg').scrollLeft=left;if(opened){wrap.querySelector('.rc-programme-picker').open=true;wrap.querySelector('.rc-prog-search').value=q;filterRecapProgrammes(wrap,q);wrap.querySelector('.rc-prog-options').scrollTop=sy;}if(b.dataset.rc==='y'){const active=wrap.querySelector('.rc-y[aria-pressed=true]');active.focus({preventScroll:true});active.scrollIntoView({block:'nearest',inline:'nearest'});}};
    if(b.dataset.rc==='section'){recapSections=tgl(recapSections,b.dataset.v);try{localStorage.setItem(RC_SECTION_KEY,JSON.stringify(recapSections));}catch(e){}el.querySelector('[data-rc=go]').disabled=!recapScope().length||!recapSections.length;}
    else if(b.dataset.rc==='notes'){recapIncludeNotes=!!b.checked;}
    else if(b.dataset.rc==='m'){recapM=tgl(recapM,b.dataset.v);R2();}
    else if(b.dataset.rc==='mclear'){recapM=[];R2();}
    else if(b.dataset.rc==='y'){selectRecapYear(b.dataset.v);R2();}
    else if(b.dataset.rc==='p'){if(b.dataset.v==='all')recapP=[];else recapP=tgl(recapP,b.dataset.v);R2();}
    else if(b.dataset.rc==='go'){b.disabled=true;const ok=await makeRecap();if(ok)close();else b.disabled=false;}});}
let recapBusy=false;
async function makeRecap(wall){const list=wall?wall.list:recapScope();if(!list.length||(!wall&&!recapSections.length)||recapBusy)return false;recapBusy=true;const sections=wall?['cover','posters']:[...recapSections];toast('正在生成观影结算…');
  try{try{await Promise.all(['900 64px "Noto Serif SC"','700 30px "Noto Sans SC"','500 24px "IBM Plex Mono"'].map(f=>document.fonts.load(f,'麻雀观影护照结算0123')));}catch(e){}
    const R=window.SparrowRecap,imgs={};await Promise.all((sections.includes('favorite')||sections.includes('list')||sections.includes('posters')?list:[]).map(async e=>{imgs[e.id]=await loadImg(myPoster(e.id));}));const marks=await Promise.all(['brand/mark-movies.png','brand/mark-tribe.png'].map(loadImg));
    const incNotes=!wall&&recapIncludeNotes&&typeof privateNoteOf==='function';
    const items=list.map(e=>{const lk=R.look(e.id),p=progOf(e.f),nt=incNotes?privateNoteOf(e.id):null;return {id:e.id,title:e.f.cn,en:e.f.en||e.f.o||'',date:e.rec.d,dstamp:R.dstamp(e.rec.d),venue:e.s?(LANG==='en'?vShort(VN[e.s.v]):VN[e.s.v].name):'',vs:e.venue,score:e.rec.r||0,color:lk.ink,shape:lk.shape,tilt:lk.tilt,top:(p&&p.en)||'SPARROW FILM PASSPORT',prog:p?p.name:'',img:imgs[e.id],note:nt&&nt.rc&&nt.text&&!nt.locked?nt.text:''};});
    const st=passportStats(list),months={};list.forEach(e=>{const m=+e.rec.d.slice(5,7);months[m]=(months[m]||0)+1;});const topM=Object.keys(months).sort((a,b)=>months[b]-months[a]||a-b)[0];
    const fav=items.filter(x=>x.score).sort((a,b)=>b.score-a.score||b.date.localeCompare(a.date))[0]||null;
    const byP=new Map();list.forEach(e=>{const p=progOf(e.f);if(!byP.has(p.id))byP.set(p.id,{name:p.name,n:0,sum:0,k:0});const g=byP.get(p.id);g.n++;if(e.rec.r){g.sum+=e.rec.r;g.k++;}});
    const progs=[...byP.values()].map(g=>({name:g.name,n:g.n,avg:g.k?g.sum/g.k:0})).sort((a,b)=>b.n-a.n);
    const years=[...new Set(list.map(e=>e.rec.d.slice(0,4)))].sort();
    const o={title:wall?wall.title:tr('我的影院观影结算'),sub:wall?wall.sub:recapSub(list),posterCols:wall?wall.cols:5,posterScores:wall?wall.scores!==false:true,kicker:wall?'SPARROW FILM PASSPORT · MY CINEMA POSTER WALL':'SPARROW FILM PASSPORT · MY CINEMA RECAP',yearTag:years[years.length-1],includeNotes:incNotes&&items.some(x=>x.note),
      stats:[[st.n,tr('部影片')],[st.hm,tr('银幕时长')],[st.avg?st.avg.toFixed(1):'—',tr('平均评分')],[st.venues,tr('家影院')],[st.progs,tr('个专题')],[topM?tr(topM+'月'):'—',tr('看得最多的月份')]],
      sections,fav,progs,items,qr:qrMatrix(homeURL()),url:location.host+location.pathname,marks,T:tr,en:LANG==='en'};
    if(!R.heightOf(o)){toast('所选项目暂无内容，请选择其他项目');return false;}
    const cv=document.createElement('canvas');cv.width=R.W;cv.height=R.heightOf(o);R.draw(cv.getContext('2d'),o);
    const blob=await new Promise(r=>cv.toBlob(r,'image/png'));if(!blob){toast('图片生成失败，请稍后再试');return false;}
    showImageSheet(blob,{file:wall?'麻雀观影护照_海报墙_'+wall.sub+'.png':'麻雀观影护照_影院观影结算.png',head:wall?'海报墙已生成':'观影结算已生成',alt:wall?'海报墙长图':'影院观影结算长图'});return true;}
  catch(err){toast('图片生成失败，请稍后再试');return false;}finally{recapBusy=false;}}

/* ---- 观影护照使用指南 + 数据更新时间 ---- */
/* 影展合作&反馈与纠错：邮箱用 mailto 并预填主题；微信号点按复制（国际通用写法：Email / WeChat ID） */
const FB_MAIL='2165.yan@gmail.com',FB_WX='BFAFILM';
function miniHTML(){return `<details class="menu-disclosure guide-card mini-card" id="mini-card"><summary class="my-entry">${menuIcon('mini')}<span class="menu-copy"><b>观影护照小程序</b><small>微信里更适配 · 可同步个人云档案</small></span><span class="me-go" aria-hidden="true">›</span></summary><div class="mini-body"><img src="brand/miniprogram-code.jpg" width="112" height="112" alt="观影护照微信小程序码" loading="lazy"><div><p>在微信里长按识别小程序码，或用微信扫一扫打开。</p><p>微信里使用更适配，也可以同步个人云档案。小程序内的排片更新比网页稍慢，以网页为准。</p></div></div></details>`;}
function feedbackHTML(){const sub=encodeURIComponent('麻雀观影护照 · 影展合作&反馈与纠错');
  return '<details class="guide-card fb-card" id="fb-card"><summary>影展合作&反馈与纠错</summary><div class="fb-body"><p>影展、放映合作，或排片、片名、人名、功能有问题？欢迎告诉我们，附上截图和页面名称会更快处理。</p>'+
  '<a class="fb-row" href="mailto:'+FB_MAIL+'?subject='+sub+'"><span class="fb-k">Email</span><b translate="no">'+FB_MAIL+'</b><span class="fb-go" aria-hidden="true">↗</span></a>'+
  '<button class="fb-row" type="button" data-copy="'+FB_WX+'"><span class="fb-k">WeChat</span><b translate="no">'+FB_WX+'</b><span class="fb-go">复制</span></button></div></details>';}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-copy]');if(!b)return;const v=b.dataset.copy;try{await navigator.clipboard.writeText(v);}catch{const i=document.createElement('textarea');i.value=v;i.style.cssText='position:fixed;opacity:0';document.body.appendChild(i);i.select();try{document.execCommand('copy');}catch{}i.remove();}toast('已复制：'+v);});
const FRIEND_LINKS=[{img:'brand/friend-michelin.png',m:'M',n:'全球米其林餐厅名录',g:'去全球看电影，别忘了顺路吃点美食。',d:'收录全球米其林餐厅，可标记想去、记录去过，让每座城市的电影与美味同行。',u:'https://sparrowcinema.github.io/michelin-guide/'}];
function friendHTML(){return `<details class="menu-disclosure guide-card friend-card" id="friend-card"><summary class="my-entry">${menuIcon('link')}<span class="menu-copy"><b>友情链接</b><small>${FRIEND_LINKS.length} 个伙伴站点 · 更多陆续加入</small></span><span class="me-go" aria-hidden="true">›</span></summary><div class="friend-body">`+FRIEND_LINKS.map(x=>'<a class="friend-item" href="'+x.u+'" target="_blank" rel="noopener">'+(x.img?'<img class="fi-mark fi-img" src="'+x.img+'" alt="" width="42" height="42" loading="lazy">':'<span class="fi-mark" aria-hidden="true">'+esc(x.m||x.n.slice(0,1))+'</span>')+'<span class="fi-t"><b>'+esc(x.n)+'</b>'+(x.g?'<em class="fi-g">'+esc(x.g)+'</em>':'')+'<small>'+esc(x.d)+'</small></span><span class="fb-go" aria-hidden="true">↗</span></a>').join('')+'</div></details>';}
/* 使用指南单独一页（#guide）：规则在 shared/guide.js，内容在 data/guide.json（与小程序共用，改手册只改这个文件）。
   顶部「最近更新」列出 45 天内的新功能；「我的」里使用指南一行在有没看过的更新时显示「新」（看过的日期存本机 sparrow-guide-seen） */
let GUIDE=null,guideP=null;
function loadGuide(){if(GUIDE)return Promise.resolve(GUIDE);if(!guideP)guideP=fetch('data/guide.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw 0;return r.json();}).then(d=>(GUIDE=d)).catch(()=>{guideP=null;return null;});return guideP;}
function guideSeen(){try{return localStorage.getItem('sparrow-guide-seen')||'';}catch(e){return '';}}
function guideIsNew(){const G=window.SparrowGuide;if(!G||!GUIDE)return false;const l=G.latest(GUIDE,'web');return !!l&&l>guideSeen()&&G.newsFor(GUIDE,'web').length>0;}
function guideBadge(){/* 「我的」页渲染后补上「新」标记（手册数据是异步读的） */const put=()=>{const b=document.querySelector('[data-tab="guide"] .menu-copy b');if(b&&guideIsNew()&&!b.querySelector('.me-new'))b.insertAdjacentHTML('beforeend','<i class="me-new">'+tr('新')+'</i>');};if(GUIDE)put();else loadGuide().then(put);}
function guidePage(){const G=window.SparrowGuide;if(!G){main.innerHTML='';return;}
  const head='<section class="view gut guide-page">'+subBackHTML()+'<div class="page-heading"><div><small>PASSPORT GUIDE</small><h1 class="sec">'+tr('观影护照使用指南')+'</h1></div></div>';
  if(!GUIDE){main.innerHTML=head+'<p class="gd-wait">'+tr('使用指南加载中…')+'</p></section>';loadGuide().then(d=>{if(location.hash!=='#guide')return;if(d)guidePage();else{const w=main.querySelector('.gd-wait');if(w)w.textContent=tr('使用指南加载失败，请检查网络后重试');}});return;}
  const ch=G.chaptersFor(GUIDE,'web'),news=G.newsFor(GUIDE,'web');let n=0;
  const md=d=>{const m=/^\d{4}-(\d{2})-(\d{2})$/.exec(d);return m?(+m[1])+'.'+(+m[2]):d;};
  main.innerHTML=head+(news.length?'<section class="gd-news" aria-label="'+tr('最近更新')+'"><h3>'+tr('最近更新')+'</h3><ul>'+news.map(x=>'<li><span class="gd-d mono">'+md(x.d)+'</span><div><b>'+esc(tr(x.t))+'</b><p>'+esc(tr(x.s))+'</p></div></li>').join('')+'</ul></section>':'')+
  '<nav class="gd-nav" aria-label="'+tr('章节')+'">'+ch.map(c=>'<button type="button" data-gd="'+c.id+'">'+esc(tr(c.t))+'</button>').join('')+'</nav>'+
  ch.map(c=>'<section class="gd-ch" id="gd-'+c.id+'"><h3>'+esc(tr(c.t))+'</h3><ol>'+c.items.map(x=>'<li><span class="gd-n">'+(++n)+'</span><b>'+esc(tr(x.k))+'</b><p>'+esc(tr(x.s))+'</p></li>').join('')+'</ol></section>').join('')+'</section>';
  main.querySelectorAll('[data-gd]').forEach(b=>b.addEventListener('click',()=>{const el=document.getElementById('gd-'+b.dataset.gd);if(el)el.scrollIntoView({behavior:'smooth',block:'start'});}));
  const l=G.latest(GUIDE,'web');if(l)try{localStorage.setItem('sparrow-guide-seen',l);}catch(e){}}
let dataUpd=null;
function dataUpdated(){/* 版权区「数据更新于」：启动时取一次，成功后填入所有已渲染的版权区 */const put=s=>document.querySelectorAll('.data-upd').forEach(el=>{el.textContent=s;el.parentElement.hidden=false;});if(dataUpd)return put(dataUpd);
  fetch('data/catalog.json',{method:'HEAD',cache:'no-cache'}).then(r=>{const lm=r.headers.get('last-modified');const d=lm?new Date(lm):null;if(!d||isNaN(d))throw 0;const p=n=>String(n).padStart(2,'0');dataUpd=d.getFullYear()+'.'+p(d.getMonth()+1)+'.'+p(d.getDate());put(dataUpd);}).catch(()=>{});}
function menuIcon(name){const shapes={ticket:'<path d="M5 6h14v3a3 3 0 0 0 0 6v3H5v-3a3 3 0 0 0 0-6V6Zm9 2v2m0 4v2"/>',want:'<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.8L12 16.8l-5.3 2.8 1.1-5.8-4.3-4.1 5.9-.8Z"/>',taste:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 3v18M3 12h18"/><circle cx="16.5" cy="7.5" r="1.4"/><circle cx="7.5" cy="16.5" r="1.4"/><circle cx="15.5" cy="15.5" r="1.4"/>',wall:'<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="9" rx="1"/><path d="M3 16h7M14 16h7M3 20h7M14 20h7"/>',link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',passport:'<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M9 17h6"/>',recap:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',plan:'<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',export:'<rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2"/>',phone:'<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',sync:'<path d="M4 10a8 8 0 0 1 14-5l2 3M20 14a8 8 0 0 1-14 5l-2-3M20 3v5h-5M4 21v-5h5"/>',guide:'<path d="M12 5v16M12 5C9 2 5 3 3 4v15c3-1 6-1 9 2 3-3 6-3 9-2V4c-2-1-6-2-9 1Z"/>',mini:'<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="9.5" cy="12" r="2"/><circle cx="14.5" cy="12" r="2"/>',feedback:'<path d="M21 11a8 8 0 0 1-8 8H7l-4 3V7a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5Z"/><path d="M7 8h10M7 12h7"/>',theme:'<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor"/>'};return `<span class="me-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">${shapes[name]||shapes.guide}</svg></span>`;}
/* ---- 外观：跟随系统 / 浅色 / 暗色（选择保存在本机，data-theme 由 <head> 里的小脚本在首屏前写入） ---- */
function themePref(){try{const v=localStorage.getItem("sk-theme");return v==="light"||v==="dark"?v:"auto"}catch(e){return "auto"}}
function applyTheme(p){
  const r=document.documentElement;if(p==="light"||p==="dark")r.setAttribute("data-theme",p);else r.removeAttribute("data-theme");
  document.querySelectorAll('meta[name="theme-color"]').forEach(m=>{if(!m.dataset.o)m.dataset.o=m.content;m.content=p==="dark"?"#211b15":p==="light"?"#f8f2e6":m.dataset.o});
}
applyTheme(themePref());
function themeRowHTML(){const cur=themePref(),opts=[["auto","跟随系统"],["light","浅色"],["dark","暗色"]];
 return `<details class="menu-disclosure appearance-disclosure"><summary class="my-entry">${menuIcon("theme")}<span class="menu-copy"><b>外观</b><small data-theme-label>${opts.find(x=>x[0]===cur)[1]}</small></span><span class="me-go" aria-hidden="true">›</span></summary><div class="menu-body"><p>自动跟随手机或电脑，也可固定浅色、暗色</p><div class="theme-seg" role="radiogroup" aria-label="外观">${opts.map(([k,t])=>`<button type="button" role="radio" aria-checked="${cur===k}" data-theme-set="${k}">${t}</button>`).join("")}</div></div></details>`;}
document.addEventListener("click",e=>{const b=e.target.closest("[data-theme-set]");if(!b)return;const p=b.dataset.themeSet;
  try{p==="auto"?localStorage.removeItem("sk-theme"):localStorage.setItem("sk-theme",p)}catch(_){}
  applyTheme(p);document.querySelectorAll("[data-theme-label]").forEach(x=>x.textContent=tr({auto:"跟随系统",light:"浅色",dark:"暗色"}[p]));document.querySelectorAll("[data-theme-set]").forEach(x=>x.setAttribute("aria-checked",String(x===b)));});
function menuRowHTML(icon,title,sub,attr){return `<button class="my-entry" ${attr}>${menuIcon(icon)}<span class="menu-copy"><b>${title}</b><small>${sub}</small></span><span class="me-go" aria-hidden="true">›</span></button>`;}
// 护照卡片的展开 / 收起记在内存里：同步或排片更新后重绘「我的」页时保持用户刚才的选择
let myPassportOpen=true;
// 手机上快速连点「我的观影护照」时，两下可能被当成一次双击缩放、或在页面忙时排队成「开 + 关」相互抵消，看起来要按好几下：
// 自己处理这一行的点击，立即切换，350ms 内的重复点击忽略（配合 CSS touch-action:manipulation 去掉双击缩放）
let myPassportTapAt=0;
document.addEventListener('click',e=>{const s=e.target.closest('details.passport-collection>summary');if(!s)return;e.preventDefault();
  const now=performance.now();if(now-myPassportTapAt<350)return;myPassportTapAt=now;const d=s.parentElement;d.open=!d.open;});
document.addEventListener('toggle',e=>{if(e.target.matches?.('details.passport-collection')&&e.target.isConnected){myPassportOpen=e.target.open;if(myPassportOpen)sizeBook();else ppCancelMotion();}},true);
function passportCollectionHTML(){return `<details class="menu-disclosure passport-collection"${myPassportOpen?' open':''}><summary class="my-entry">${menuIcon('passport')}<span class="menu-copy"><b>我的观影护照</b><small>${tr(watchEntries().length+' 部影片')} · ${tr('展开封面与电影印章')}</small></span><span class="me-go" aria-hidden="true">›</span></summary><div class="menu-body">${passportHTML()}</div></details>`;}
function myPage(){const list=selectedRows(),st=planStats(list),next=list.find(s=>!isPast(s));
 const bh=typeof currentBackupHealth==='function'?currentBackupHealth():{level:'good'};
 const syncSub=bh.codeWarning?tr('同步码尚未确认保存 · 点击保存'):bh.backupWarning?tr('建议备份 · 支持 Letterboxd / 豆瓣 CSV'):tr('同步、私密笔记加密与 Letterboxd 互通');
 const sync=`<details class="menu-disclosure sync-disclosure"><summary class="my-entry">${menuIcon('sync')}<span class="menu-copy"><b>个人档案云端同步${bh.level!=='good'?'<i class="my-dot" aria-hidden="true"></i>':''}</b><small>${esc(syncSub)}</small></span><span class="me-go" aria-hidden="true">›</span></summary><section class="menu-body sync-card" id="sync-card">${syncCardHTML()}${profileCareHTML()}</section></details>`;
 const guide=menuRowHTML('guide','观影护照使用指南','排片、护照、典藏票根、同步，一页看懂','data-tab="guide"');
 const feedback=feedbackHTML().replace('class="guide-card fb-card"','class="menu-disclosure guide-card fb-card"').replace('<summary>影展合作&反馈与纠错</summary>',`<summary class="my-entry">${menuIcon('feedback')}<span class="menu-copy"><b>影展合作&反馈与纠错</b><small>影展合作 · 排片问题与使用建议</small></span><span class="me-go" aria-hidden="true">›</span></summary>`);
 main.innerHTML='<section class="view gut my-dashboard"><div class="my-page-head"><h1 class="sec">我的</h1><p>带着日程出发，带着电影回来。</p></div>'+
 /* 「我的」分三段：护照（默认展开，是这页的主角）→ 我的电影 → 设置与帮助 */
 '<div class="my-menu my-pass">'+passportCollectionHTML()+'</div><h3 class="my-group">'+tr('我的电影')+(LANG==='en'?'':' <small>MY CINEMA</small>')+'</h3><div class="my-menu">'+
 menuRowHTML('plan','个人排片',(planChangeCount()?tr(planChangeCount()+' 场排片有变动')+' · ':'')+(list.length?st.n+' 场 · '+(next?'下一场 '+next.d+' '+wk(next.d)+' '+next.t:'已全部放映'):'按天查看日程 · 自动检查时间冲突'),'data-tab="plan"')+
 (ws=>menuRowHTML('want','想看清单',ws.n?tr(ws.n+' 部')+(ws.fresh?' · '+tr(ws.fresh+' 部有新场次'):ws.live?' · '+tr(ws.live+' 部有场次'):''):'在影片页点「想看」，有新场次时会标出','data-want-list'))(wantStats())+
 menuRowHTML('recap','我的影院观影结算','按年份与专题，收藏印章与评分。','data-pp="recap"')+
 menuRowHTML('wall','我的海报墙','看过的影片 · 我的评分','data-tab="poster-wall"')+
 menuRowHTML('ticket','我的典藏票根册','每次观影一张票根 · 年度与专题票根墙','data-tab="ticket-wall"')+
 menuRowHTML('taste','我的电影趣味图谱',tasteMenuSub(),'data-tab="taste-map"')+
 menuRowHTML('export','导出与分享','带二维码的排片长图 · 分享链接 · 日历 · PDF','data-tab="export"')+
 '</div><h3 class="my-group">'+tr('设置与帮助')+(LANG==='en'?'':' <small>SETTINGS</small>')+'</h3><div class="my-menu">'+sync+themeRowHTML()+
 menuRowHTML('phone','添加到手机',ENV.standalone?'已在 App 模式中打开':'放到桌面像 App 一样看 · 微信里用浮窗','data-tab="install"')+miniHTML()+guide+feedback+friendHTML()+'</div><p class="local-note">排片和护照保存在当前浏览器；开启上面的云端同步，或用分享链接，即可换设备。</p>'+presentersHTML()+'</section>';sizeBook();guideBadge();}
function tasteMenuSub(){const n=watchEntries().filter(e=>!e.rec.del&&!e.f.ev&&window.SparrowTaste.valid(e.rec.fun)&&window.SparrowTaste.valid(e.rec.bore)).length;return n?tr(n+' 部影片')+' · '+tr('有趣与无聊四象限'):tr('有趣与无聊四象限');}
let tasteYear='',tasteProg='';function tasteIn(pid){const ctx=libraryContext();return f=>window.SparrowLibrary.inProgramme(f,pid,ctx);}
function tasteProgRows(){const TR=window.SparrowTasteReport,all=TR.validRows(watchEntries());return [{id:'',name:tr('全部专题'),sub:tr(all.length+' 部影片'),selected:!tasteProg},...progOrdered().map(p=>{const t=tasteIn(p.id);return {id:p.id,name:p.name,n:all.filter(x=>t(x.f)).length};}).filter(x=>x.n).map(x=>({id:x.id,name:x.name,sub:tr(x.n+' 部影片'),selected:tasteProg===x.id}))];}
function tasteScope(){return tasteProg&&PG[tasteProg]?{programme:PG[tasteProg].name,inProg:tasteIn(tasteProg)}:{year:tasteYear};}
function tasteYearRows(){const ys=window.SparrowTasteReport.years(watchEntries());return [{id:'',name:tr('全部年份'),sub:tr(ys.reduce((s,x)=>s+x.n,0)+' 部影片'),selected:!tasteYear},...ys.map(x=>({id:x.y,name:x.y,sub:tr(x.n+' 部影片'),selected:tasteYear===x.y}))];}
function tastePortraitEndpoint(){
 return typeof SB_API==='string'&&SB_API?SB_API.replace(/\/rest\/v1\/rpc\/?$/,'/functions/v1/smooth-processor'):'';
}
let aiPortraitBusy=false,aiPortraitMsg='',aiPortraitTone='';
function tastePortraitBuild(){
 const TP=window.SparrowTastePortrait,TR=window.SparrowTasteReport;
 if(!TP)return null;
 const built=TP.buildPayload(watchEntries(),{en:LANG==='en',...tasteScope(),tasteReport:TR});
 const fp=TP.fingerprint(built.payload);
 const hit=built.ok?TP.readCache(k=>localStorage.getItem(k),TP.WEB_CACHE_KEY,fp):null;
 return {TP,built,fp,hit};
}
function tastePortraitHTML(){
 const ctx=tastePortraitBuild();if(!ctx)return '';
 const {built,hit}=ctx,en=LANG==='en',p=hit&&hit.portrait;
 const scopeMeta=built.payload.scope+' · '+(en?(built.watchedCount+' watched'+(built.ratedCount?' · '+built.ratedCount+' taste-rated':'')):(built.watchedCount+' 部看过'+(built.ratedCount?' · '+built.ratedCount+' 部已评趣味':'')));
 let body='';
 if(p){
  const tagsHTML=p.tags&&p.tags.length?'<div class="aip-tags">'+p.tags.map(t=>'<span>'+esc(t)+'</span>').join('')+'</div>':'';
  const parasHTML=p.paragraphs.map(line=>'<p class="aip-p">'+esc(line)+'</p>').join('');
  const nextHTML=p.nextHint?'<div class="aip-next"><b>'+esc(tr('下一步建议'))+'</b><span>'+esc(p.nextHint)+'</span></div>':'';
  body=(p.headline?'<h3 class="aip-headline">'+esc(p.headline)+'</h3>':'')+tagsHTML+'<div class="aip-text">'+parasHTML+'</div>'+nextHTML+
   '<div class="aip-foot"><button type="button" class="aip-btn aip-btn-ghost" data-aip="copy">'+esc(tr('复制评语'))+'</button><button type="button" class="aip-btn aip-btn-ghost" data-aip="refresh"'+(aiPortraitBusy?' disabled':'')+'>'+esc(aiPortraitBusy?tr('生成中…'):tr('重新生成'))+'</button></div>';
 }else{
  body='<p class="aip-desc">'+esc(tr('结合当前范围看过的片单、星级评分与趣味四象限摘要，由 AI 生成 200–300 字专属观影评语。结果缓存在本机，观影记录未变动时不重复请求。'))+'</p>'+
   '<div class="aip-cta"><button type="button" class="aip-btn aip-btn-primary" data-aip="gen"'+(built.ok&&!aiPortraitBusy?'':' disabled')+'>'+esc(aiPortraitBusy?tr('正在生成观影评语…'):tr('生成 AI 观影评语'))+'</button>'+
   (!built.ok?'<small>'+esc(tr('当前范围至少标记 3 部看过影片后即可生成'))+'</small>':'')+'</div>';
 }
 const msgHTML=aiPortraitMsg?'<p class="aip-msg'+(aiPortraitTone?' '+aiPortraitTone:'')+'" role="status">'+esc(aiPortraitMsg)+'</p>':'';
 return '<section class="ai-portrait" id="ai-portrait"><header class="aip-head"><div><b>✦ '+esc(tr('AI 观影画像'))+'</b><small>'+esc(scopeMeta)+'</small></div>'+(p&&hit.cached?'<span class="aip-badge">'+esc(tr('本机已缓存'))+'</span>':'')+'</header>'+body+msgHTML+'</section>';
}
function refreshAiPortraitCard(){
 const box=main.querySelector('#ai-portrait');if(!box)return;
 box.outerHTML=tastePortraitHTML();
 bindAiPortraitCard();
}
function bindAiPortraitCard(){
 const box=main.querySelector('#ai-portrait');if(!box)return;
 const g=box.querySelector('[data-aip="gen"]');if(g)g.onclick=()=>runAiPortrait(false);
 const rf=box.querySelector('[data-aip="refresh"]');if(rf)rf.onclick=()=>runAiPortrait(true);
 const cp=box.querySelector('[data-aip="copy"]');if(cp)cp.onclick=copyAiPortrait;
}
async function runAiPortrait(force){
 if(aiPortraitBusy)return;
 const ctx=tastePortraitBuild();if(!ctx||!ctx.built.ok)return;
 const {TP,built,fp,hit}=ctx;
 if(!force&&hit&&hit.portrait){aiPortraitMsg='';aiPortraitTone='';refreshAiPortraitCard();return;}
 const endpoint=tastePortraitEndpoint();
 if(!endpoint){aiPortraitMsg=tr('AI 观影画像暂不可用，请稍后再试；上方离线趣味图谱仍可正常使用。');aiPortraitTone='warn';refreshAiPortraitCard();return;}
 aiPortraitBusy=true;aiPortraitMsg=tr('正在结合你的片单与四象限撰写评语…');aiPortraitTone='';refreshAiPortraitCard();
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),22000);
 try{
  const res=await fetch(endpoint,{
   method:'POST',signal:ctrl.signal,
   headers:{'Content-Type':'application/json',...(typeof SB_KEY==='string'&&SB_KEY?{apikey:SB_KEY,Authorization:'Bearer '+SB_KEY}:{})},
   body:JSON.stringify(built.payload)
  });
  const j=await res.json().catch(()=>null);
  if(res.ok&&j&&j.ok&&j.portrait){
   const saved=TP.writeCache(k=>localStorage.getItem(k),(k,v)=>localStorage.setItem(k,v),TP.WEB_CACHE_KEY,fp,j.portrait);
   if(saved){
    aiPortraitMsg='';aiPortraitTone='';
    toast(tr('AI 观影评语已生成并缓存在本机'));
   }else{
    aiPortraitMsg=tr('AI 返回内容格式异常，请稍后重试。');aiPortraitTone='warn';
   }
  }else{
   const reason=(j&&j.reason)||(res.status===429?'rate_limited':'unavailable');
   aiPortraitMsg=reason==='rate_limited'
    ?tr('AI 请求过于频繁，请稍后再试；已生成的评语会保存在本机。')
    :tr('AI 观影画像暂不可用，请稍后再试；上方离线趣味图谱仍可正常使用。');
   aiPortraitTone='warn';
  }
 }catch(err){
  console.warn('ai portrait failed',err);
  aiPortraitMsg=tr('AI 观影画像暂不可用，请检查网络后重试；上方离线趣味图谱仍可正常使用。');
  aiPortraitTone='warn';
 }finally{
  clearTimeout(timer);aiPortraitBusy=false;refreshAiPortraitCard();
 }
}
function copyAiPortrait(){
 const ctx=tastePortraitBuild();if(!ctx||!ctx.hit||!ctx.hit.portrait)return;
 const txt=ctx.TP.formatCopyText(ctx.hit.portrait,ctx.built.payload.scope,LANG==='en');if(!txt)return;
 const ok=()=>toast(tr('已复制观影评语'));
 if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(ok).catch(()=>fallbackCopy(txt,ok));}
 else fallbackCopy(txt,ok);
}
function fallbackCopy(txt,onOk){
 try{const ta=document.createElement('textarea');ta.value=txt;ta.style.cssText='position:fixed;left:-9999px;top:0;font-size:16px';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();onOk();}catch(e){toast(tr('复制失败，请手动长按选中文字'));}
}
function tasteMapPage(){aiPortraitMsg='';aiPortraitTone='';const TRy=window.SparrowTasteReport.years(watchEntries());if(tasteYear&&!TRy.some(x=>x.y===tasteYear))tasteYear='';if(tasteProg&&!PG[tasteProg])tasteProg='';const rn=window.SparrowTasteReport.analyze(watchEntries(),{en:LANG==='en',...tasteScope()}).n;main.innerHTML='<section class="view gut taste-map-page">'+subBackHTML()+'<div class="page-heading"><div><small>MY FILM TASTE MAP</small><h1 class="sec">我的电影趣味图谱</h1></div></div><p class="pw-hint">'+tr('横轴是有趣度，纵轴是无聊度。在影片页「趣味」一栏给两项都打分，影片就会出现在图上。')+'</p><div class="schedule-filterbar tr-filterbar" aria-label="'+tr('图谱范围')+'">'+[['tprog','专题',tasteProg?PG[tasteProg].name:tr('全部专题'),!!tasteProg],['tyear','年份',tasteYear||tr('全部年份'),!!tasteYear]].map(([k,l,v,on])=>'<button type="button" class="schedule-filter'+(on?' active':'')+'" data-'+k+' aria-haspopup="dialog" aria-label="'+esc(tr(l)+'：'+v)+'"><span><small>'+tr(l)+'</small><b>'+esc(v)+'</b></span>'+filterChevron+'</button>').join('')+'</div><p class="pw-hint tr-note">'+tr('专题和年份二选一，选一个会自动重置另一个。')+'</p><div class="tr-acts2"><button type="button" id="tr-make" class="tr-make"'+(rn>=3?'':' disabled')+'>'+tr('生成我的趣味图谱')+'</button><small>'+(rn>=3?tr('长图含趣味人格命名、四象限与分析'):tr('至少给 3 部电影的有趣度和无聊度都打分后才能生成'))+'</small></div>'+tastePortraitHTML()+tasteMapHTML()+'</section>';const mk=main.querySelector('#tr-make');if(mk)mk.onclick=makeTasteReport;bindAiPortraitCard();if(tasteMapMode==='community')loadCommunity();}
/* 生成我的趣味图谱长图：命名与分析由 shared/taste-report.js 按评分规则组合生成（离线、同样的评分得到同样的结果） */
let trBusy=false;async function makeTasteReport(){if(trBusy)return;trBusy=true;toast('正在生成趣味图谱…');
 try{try{await Promise.all(['900 64px "Noto Serif SC"','700 30px "Noto Sans SC"','500 24px "IBM Plex Mono"'].map(f=>document.fonts.load(f,'麻雀趣味图谱0123')));}catch(e){}
  const TR=window.SparrowTasteReport,R=window.SparrowRecap,en=LANG==='en',a=TR.analyze(watchEntries(),{en,T:tr,...tasteScope(),community:id=>{const x=TC.get(id);return x&&x.pairN>=3?{fun:x.pairFun,bore:x.pairBore}:null;}});if(!a.ok){toast('至少给 3 部电影的有趣度和无聊度都打分后才能生成');return;}
  const marks=await Promise.all(['brand/mark-movies.png','brand/mark-tribe.png'].map(loadImg));const cv=document.createElement('canvas');cv.width=TR.W;cv.height=10;let c=cv.getContext('2d');const d0=new Date(now()),ro={T:tr,holder:holderName(),date:d0.getFullYear()+'.'+String(d0.getMonth()+1).padStart(2,'0')+'.'+String(d0.getDate()).padStart(2,'0'),footer:(cc,y,H)=>R.footer(cc,{qr:qrMatrix(homeURL()),url:location.host+location.pathname,marks,T:tr,en,footHead:tr('扫码生成你的电影趣味图谱'),footLine:tr('麻雀观影护照：给看过的电影打有趣度与无聊度')},y,H)};cv.height=TR.heightOf(c,a,ro);c=cv.getContext('2d');
  TR.draw(c,a,ro);
  const blob=await new Promise(r=>cv.toBlob(r,'image/png'));if(!blob){toast('图片生成失败，请稍后再试');return;}
  showImageSheet(blob,{file:'麻雀观影护照_'+(tasteProg?PG[tasteProg].name+'_':tasteYear?tasteYear+'_':'')+'电影趣味图谱.png',head:'趣味图谱已生成',alt:'趣味图谱长图'});}
 catch(err){console.error(err);toast('图片生成失败，请稍后再试');}finally{trBusy=false;}}
// A read-only collection: the grid fits the viewport, with vertical page scrolling.
function sizePosterWall(){const grid=document.querySelector('.pw-grid');if(grid)grid.style.setProperty('--cols',window.SparrowLibrary.posterColumns(innerWidth,innerHeight));if(typeof PWR!=='undefined'&&PWR&&PWR.el.isConnected){pwrLayout();pwrApply();}}
window.addEventListener('resize',sizePosterWall);
let posterMode='year',posterSelection='',posterProgramme='all';
const POSTER_MODES=[['year','年度海报墙'],['quarter','季度海报墙'],['month','月度海报墙']];
function posterArchive(){return watchEntries().filter(e=>!e.rec.del&&!e.f.ev).sort((a,b)=>b.rec.d.localeCompare(a.rec.d));}
function posterSelectorRows(type){const all=posterArchive(),lib=window.SparrowLibrary,ctx=libraryContext();
 if(type==='mode')return POSTER_MODES.map(([id,name])=>({id,name:tr(name),sub:'',selected:posterMode===id}));
 if(type==='period')return lib.posterPeriods(all,posterMode).map(id=>({id,name:lib.posterPeriodLabel(id,typeof LANG!=='undefined'&&LANG==='en'),sub:tr(lib.posterEntries(all,posterMode,id,posterProgramme,ctx).length+' 部影片'),selected:posterSelection===id}));
 return [{id:'all',name:tr('全部专题'),sub:tr(lib.posterEntries(all,posterMode,posterSelection).length+' 部影片'),selected:!selList(posterProgramme).length},...progOrdered().map(p=>({id:p.id,name:p.name,sub:tr(lib.posterEntries(all,posterMode,posterSelection,p.id,ctx).length+' 部影片'),selected:selList(posterProgramme).includes(p.id)}))];
}
function pwScores(){try{return localStorage.getItem('sparrow-pw-score')!=='0';}catch(e){return true;}} /* 海报墙导出是否画评分（本机记住，默认显示） */
function wallTitle(){const pid=selList(posterProgramme)[0];return window.SparrowLibrary.posterTitle({en:typeof LANG!=='undefined'&&LANG==='en',holder:typeof holderName==='function'?holderName():'',period:posterSelection,programmeName:pid?(PG[pid]?.name||pid):''});} /* 海报墙导出标题：专题或年/季/月二选一（shared/library.js posterTitle） */
function posterWallPage(){pwrStop();const all=posterArchive(),lib=window.SparrowLibrary,periods=lib.posterPeriods(all,posterMode);if(!periods.includes(posterSelection))posterSelection=periods[0]||'';const list=lib.posterEntries(all,posterMode,posterSelection,posterProgramme,libraryContext()),cols=lib.posterColumns(innerWidth,innerHeight),title=POSTER_MODES.find(x=>x[0]===posterMode)[1],programmeLabel=selLabel(posterProgramme,'全部专题',id=>PG[id]?.name||id,'个专题'),sub=[posterSelection,posterProgramme!=='all'?selList(posterProgramme).map(id=>PG[id]?.name||id).join('、'):''].filter(Boolean).join(' · ');
 const fields=[['programme','专题',programmeLabel,false],['mode','海报墙',tr(title),false],['period','观影时间',posterSelection?lib.posterPeriodLabel(posterSelection,typeof LANG!=='undefined'&&LANG==='en'):'—',!periods.length]];
 main.innerHTML='<section class="view gut poster-wall-page">'+subBackHTML()+'<div class="page-heading"><div><small>MY CINEMA POSTER WALL</small><h1 class="sec">我的影院观影海报墙</h1></div></div>'+
 '<div class="schedule-filterbar poster-wall-filterbar" aria-label="'+tr('海报墙筛选')+'">'+fields.map(([key,label,value,disabled])=>'<button type="button" class="schedule-filter'+(key==='programme'&&posterProgramme!=='all'?' active':'')+'" data-poster-filter="'+key+'" aria-haspopup="dialog" aria-label="'+esc(tr(label)+'：'+tr(value))+'" '+(disabled?'disabled':'')+'><span><small>'+tr(label)+'</small><b>'+esc(tr(value))+'</b></span>'+filterChevron+'</button>').join('')+'</div><div class="pw-actions"><p class="pw-hint pw-count">'+tr(list.length+' 部影片')+((typeof LANG!=='undefined'&&LANG==='en')?', ':'，')+tr('按最近观影排列')+'</p><label class="pw-score-toggle"><input type="checkbox" id="pw-score" '+(pwScores()?'checked':'')+'>'+tr('导出时显示评分')+'</label><button id="pw-export" class="secondary-button" '+(list.length?'':'disabled')+'>'+tr('导出海报墙')+'</button></div>'+
 (list.length?pwViewBarHTML()+(posterView==='ring'?pwRingHTML():'<p class="pw-hint">'+tr('点击海报查看影片，向下浏览更多。')+'</p><div class="pw-grid" style="--cols:'+cols+'">'+list.map(e=>{const score=e.rec.r?e.rec.r+'/10':tr('未评分');return '<a class="pw-card" href="#film-'+esc(e.id)+'" aria-label="'+esc(e.f.cn+' · '+tr('我的评分')+' '+score)+'"><div class="pw-poster"><span class="pw-placeholder">'+esc(e.f.cn)+'</span>'+(pst(e.id)?pimgMine(e.id,360,'loading="lazy" class="pw-image" alt="'+esc(e.f.cn)+'"'):'')+'</div><span class="pw-stars" role="img" aria-label="'+esc(score)+'">'+[0,1,2,3,4].map(k=>'<u>★<b style="width:'+(Math.max(0,Math.min(2,(e.rec.r||0)-2*k))*50)+'%">★</b></u>').join('')+'</span></a>';}).join('')+'</div>'):
 '<div class="empty-plan"><h3>'+tr(posterProgramme==='all'?'海报墙还没有影片':'所选条件下暂无影片')+'</h3><p>'+tr(posterProgramme==='all'?'在影片页标记看过，海报和评分就会收进这里。':'试试其他专题或观影时间。')+'</p><button class="primary-button" data-tab="films">'+tr('去选电影')+'</button></div>')+'</section>';
 const pwBox=main.querySelector('#pw-score');if(pwBox)pwBox.onchange=e=>{try{localStorage.setItem('sparrow-pw-score',e.target.checked?'1':'0');}catch(_){}};
 main.querySelector('#pw-export').onclick=()=>makeRecap({list,...wallTitle(),cols:window.SparrowLibrary.posterColumns(innerWidth,innerHeight),scores:pwBox?pwBox.checked:pwScores()});
 main.querySelectorAll('.pw-image').forEach(img=>img.addEventListener('error',()=>{img.hidden=true;}));
 main.querySelectorAll('[data-pw-view]').forEach(b=>b.onclick=()=>{if(b.dataset.pwView!==posterView)pwSetView(b.dataset.pwView);});
 if(list.length&&posterView==='ring')pwrMount(main.querySelector('#pw-ring'),list);
}
/* 海报墙「放映」视图（2026-11-25）：同一个 3D 圆环，用两种距离看。
   近看＝档案：正面一张最大，两侧沿弧线后转，左右拖动转圈，松手吸附到最近一张；旁边资料栏显示片名、导演 / 年份 / 地区和我的评分、观影记录。
   拉远＝放映环：镜头后退上抬，整圈可见，随手转；点任意一张推近回到档案。
   圈上最多 PW_RING_MAX 个位置：影片更多时，转到背后的位置换成后面的影片，可以一直转下去。只用 CSS 3D，每帧只改圆环与各面的 transform / opacity。 */
const PW_RING_MAX=36;
let posterView=(()=>{try{return localStorage.getItem('sparrow-pw-view')==='ring'?'ring':'grid';}catch(e){return 'grid';}})(),PWR=null;
function pwSetView(v){posterView=v;try{localStorage.setItem('sparrow-pw-view',v);}catch(e){}posterWallPage();}
function pwViewBarHTML(){return '<div class="pw-viewbar"><div class="pw-view-seg" role="radiogroup" aria-label="'+esc(tr('海报墙视图'))+'">'+[['grid','网格'],['ring','放映']].map(([v,l])=>'<button type="button" role="radio" data-pw-view="'+v+'" class="'+(posterView===v?'on':'')+'" aria-checked="'+(posterView===v)+'">'+tr(l)+'</button>').join('')+'</div></div>';}
function pwRingHTML(){return '<div class="pw-ring" id="pw-ring" tabindex="0" role="region" aria-roledescription="carousel" aria-label="'+esc(tr('放映环'))+'"><div class="pw-ring-info" aria-live="polite"></div><div class="pw-ring-stage"><div class="pw-ring-world"></div></div><div class="pw-ring-ctrl"><button type="button" class="pwr-btn" data-pwr="prev" aria-label="'+esc(tr('上一部'))+'">‹</button><span class="pwr-pos mono"></span><button type="button" class="pwr-btn" data-pwr="next" aria-label="'+esc(tr('下一部'))+'">›</button><button type="button" class="pwr-zoom" data-pwr="zoom"></button></div><p class="pw-hint pwr-tip"></p></div>';}
function pwrStop(){if(PWR&&PWR.raf)cancelAnimationFrame(PWR.raf);PWR=null;}
const pwrMod=(a,n)=>((a%n)+n)%n, pwrNorm=a=>pwrMod(a+180,360)-180;
function pwrMount(el,list){if(!el)return;pwrStop();const L=list.length,M=Math.min(L,PW_RING_MAX);
 const S=PWR={el,stage:el.querySelector('.pw-ring-stage'),world:el.querySelector('.pw-ring-world'),info:el.querySelector('.pw-ring-info'),list,L,M,step:360/M,rot:0,vel:0,target:null,t:0,tT:0,slots:[],front:-1,raf:0,last:0,drag:null,reduce:matchMedia('(prefers-reduced-motion: reduce)').matches};
 S.world.innerHTML=Array.from({length:M},(_,j)=>'<div class="pwr-face pwr-front" data-slot="'+j+'"></div><div class="pwr-face pwr-back" aria-hidden="true"></div>').join('');
 const faces=S.world.children;for(let j=0;j<M;j++)S.slots.push({f:faces[2*j],b:faces[2*j+1],idx:-1});
 el.addEventListener('error',e=>{const img=e.target;if(img&&img.tagName==='IMG'&&!img.dataset.full)img.hidden=true;},true);
 pwrLayout();pwrBind();pwrApply();pwrInfo(true);}
function pwrLayout(){const S=PWR;if(!S)return;const w=S.stage.clientWidth||360,h=S.stage.clientHeight||480,narrow=w<600;
 let W=Math.max(130,Math.min(narrow?w*.52:w*.27,260));W=Math.min(W,h*.7/1.48);const H=W*1.48;
 S.W=W;S.H=H;S.w=w;S.h=h;S.R=Math.max(W*1.12*S.M/(2*Math.PI),W*.9);S.P=Math.max(900,Math.min(1500,w*1.2));
 S.gap=W*.96;S.dep=W*.55;S.Dn=S.R;
 const tilt=18*Math.PI/180;let Df=Math.max(S.R*1.8,2*S.R*S.P/(w*.9)-S.P);
 for(let k=0;k<20;k++){const sf=S.P/(S.P+Df-S.R),bottom=(S.R*Math.sin(tilt)+H/2*Math.cos(tilt))*sf;if(bottom<=h*.44)break;Df*=1.12;}
 S.Df=Df;S.stage.style.setProperty('--pwr-w',W+'px');S.stage.style.setProperty('--pwr-h',H+'px');S.stage.style.perspective=S.P+'px';
 S.slots.forEach((x,j)=>{x.a=j*S.step;});}
function pwrItemAt(j){const S=PWR,p=S.rot/S.step;return pwrMod(j+S.M*Math.round((p-j)/S.M),S.L);}
function pwrFace(e,back){const sc=e.rec.r?e.rec.r+'/10':tr('未评分');return '<span class="pwr-ph">'+esc(e.f.cn)+'</span>'+(pst(e.id)?pimgMine(e.id,360,'class="pwr-img" alt="'+(back?'':esc(e.f.cn+' · '+tr('我的评分')+' '+sc))+'" draggable="false" decoding="async"'):'')+'<span class="pwr-shade"></span>';}
/* 每个位置的位置与朝向在两种布局间插值：近看是弧形排开（两侧往后退、转开角度、彼此叠压），拉远是真正的圆环。 */
function pwrApply(){const S=PWR;if(!S)return;const t=S.t,D=S.Dn+(S.Df-S.Dn)*t,tilt=-5-13*t,RAD=Math.PI/180;
 const pv=S.R*(1-t);S.world.style.transform='translateZ('+(pv-D)+'px) rotateX('+tilt+'deg) translateZ('+(-pv)+'px)';
 for(let j=0;j<S.M;j++){const x=S.slots[j],idx=pwrItemAt(j);
  if(idx!==x.idx){x.idx=idx;x.f.innerHTML=pwrFace(S.list[idx]);x.f.dataset.idx=idx;x.b.innerHTML=pwrFace(S.list[idx],true);x.sf=x.f.querySelector('.pwr-shade');x.sb=x.b.querySelector('.pwr-shade');}
  const d=pwrNorm(x.a-S.rot),sN=d/S.step,as=Math.min(Math.abs(sN),6),sg=sN<0?-1:1;
  const nx=sg*(as<1?as*S.gap:S.gap+(as-1)*S.W*.62),nz=S.R-as*S.dep-(as>1?(as-1)*S.dep*.4:0),ny=sg*Math.min(as*32,55);
  const rx=S.R*Math.sin(d*RAD),rz=S.R*Math.cos(d*RAD),X=nx+(rx-nx)*t,Z=nz+(rz-nz)*t,Y=ny+(d-ny)*t;
  const tf='translate3d('+X.toFixed(1)+'px,0,'+Z.toFixed(1)+'px) rotateY('+Y.toFixed(2)+'deg)';
  x.f.style.transform=tf;x.b.style.transform=tf+' translateZ(-1px) rotateY(180deg)';
  const vis=Math.max(0,Math.min(1,(4.6-Math.abs(sN))/1.2)),op=vis+(1-vis)*t;
  x.f.style.opacity=x.b.style.opacity=op.toFixed(3);x.f.style.pointerEvents=op>.3?'':'none';
  const shade=t<.5?Math.min(.55,as*.16):Math.min(.6,(1-Math.cos(d*RAD))*.32);if(x.sf)x.sf.style.opacity=shade.toFixed(3);if(x.sb)x.sb.style.opacity=(.35+shade*.5).toFixed(3);}
 pwrInfo(false);}
function pwrFrontIdx(){const S=PWR;return pwrMod(Math.round(S.rot/S.step),S.L);}
function pwrInfo(force){const S=PWR;const i=pwrFrontIdx(),far=S.tT>.5;if(!force&&i===S.front&&far===S.far)return;S.front=i;S.far=far;const e=S.list[i],f=e.f,en=typeof LANG!=='undefined'&&LANG==='en';
 const G=window.SparrowGrowth,n=G?G.views(e.rec).length:1,r=e.rec.r||0;
 const stars='<span class="pw-stars pwi-stars" role="img" aria-label="'+esc(r?r+'/10':tr('未评分'))+'">'+[0,1,2,3,4].map(k=>'<u>★<b style="width:'+(Math.max(0,Math.min(2,r-2*k))*50)+'%">★</b></u>').join('')+'</span>';
 const rows=[['导演',f.dir],['年份',f.y],['地区',f.c&&tr(f.c)]].filter(x=>x[1]);
 const seen=[e.rec.d,e.venue,n>1?(en?'Seen '+n+' times':'看过 '+n+' 次'):''].filter(Boolean).join(' · ');
 S.info.innerHTML='<div class="pwi-k mono">'+(en?'MY FILM ARCHIVE':'MY FILM ARCHIVE · 观影档案')+'</div><h3 class="pwi-t">'+esc(f.cn)+(f.version?' <small>'+esc(f.version)+'</small>':'')+'</h3>'+(f.en&&f.en!==f.cn?'<div class="pwi-o">'+esc(f.en)+'</div>':'')+
  '<dl class="pwi-dl">'+rows.map(([k,v])=>'<div><dt>'+tr(k)+'</dt><dd>'+esc(String(v))+'</dd></div>').join('')+'</dl><div class="pwi-me">'+stars+(r?'<b class="mono pwi-score">'+r+'</b><small>/10</small>':'<small>'+tr('未评分')+'</small>')+'</div><div class="pwi-seen">'+esc(seen)+'</div>';
 S.el.querySelector('.pwr-pos').textContent=(i+1)+' / '+S.L;
 S.el.querySelector('.pwr-zoom').textContent=tr(far?'近看':'全景');
 S.el.querySelector('.pwr-tip').textContent=tr(far?'点任意一张拉近查看':'左右拖动转动，点正面的海报查看影片');
 S.el.classList.toggle('far',far);}
function pwrFrame(now){const S=PWR;if(!S||!S.el.isConnected){PWR=null;return;}const dt=Math.min(3,(now-(S.last||now))/16.67)||1;S.last=now;
 if(!S.drag){if(S.target!=null){const d=S.target-S.rot;S.rot+=d*(1-Math.pow(.84,dt));if(Math.abs(d)<.03){S.rot=S.target;S.target=null;}}
  else if(S.vel){S.rot+=S.vel*dt;S.vel*=Math.pow(.95,dt);if(Math.abs(S.vel)<.04)S.vel=0;}}
 const dT=S.tT-S.t;S.t+=dT*(1-Math.pow(.88,dt));if(Math.abs(dT)<.002)S.t=S.tT;
 pwrApply();S.raf=(S.drag||S.target!=null||S.vel||S.t!==S.tT)?requestAnimationFrame(pwrFrame):0;if(!S.raf)S.last=0;}
function pwrKick(){const S=PWR;if(!S)return;if(S.reduce){if(S.target!=null){S.rot=S.target;S.target=null;}S.vel=0;S.t=S.tT;pwrApply();return;}if(!S.raf)S.raf=requestAnimationFrame(pwrFrame);}
function pwrGo(deg){const S=PWR;S.vel=0;S.target=deg;pwrKick();}
function pwrStepBy(d){const S=PWR;const base=S.target!=null?S.target:S.rot;pwrGo((Math.round(base/S.step)+d)*S.step);}
function pwrZoom(far){const S=PWR;S.tT=far?1:0;if(!far)S.target=Math.round((S.target!=null?S.target:S.rot+S.vel*20)/S.step)*S.step,S.vel=0;pwrInfo(true);pwrKick();}
function pwrOpen(i){location.hash='#film-'+PWR.list[i].id;}
function pwrBind(){const S=PWR,st=S.stage,pts=new Map();
 st.addEventListener('pointerdown',e=>{if(e.button>0)return;pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pts.size===2){const [a,b]=[...pts.values()];S.pinch=Math.hypot(a.x-b.x,a.y-b.y);S.drag=null;return;}
  S.drag={id:e.pointerId,x:e.clientX,y:e.clientY,rot:S.rot,moved:false,slot:e.target.closest('[data-slot]'),hist:[[performance.now(),S.rot]]};S.target=null;S.vel=0;});
 st.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId))return;pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pts.size===2&&S.pinch){const [a,b]=[...pts.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(d<S.pinch*.82){S.pinch=0;pwrZoom(true);}else if(d>S.pinch*1.2){S.pinch=0;pwrZoom(false);}return;}
  const g=S.drag;if(!g||g.id!==e.pointerId)return;const dx=e.clientX-g.x,dy=e.clientY-g.y;
  if(!g.moved){if(Math.abs(dx)<7)return;if(Math.abs(dy)>Math.abs(dx)){S.drag=null;return;}g.moved=true;st.classList.add('drag');try{st.setPointerCapture(e.pointerId);}catch(_){}}
  e.preventDefault();const k=S.t>.5?360/(S.w*1.4):S.step/S.gap;S.rot=g.rot-dx*k;const now=performance.now();g.hist.push([now,S.rot]);while(g.hist.length>2&&now-g.hist[0][0]>100)g.hist.shift();pwrApply();});
 const end=e=>{pts.delete(e.pointerId);if(pts.size<2)S.pinch=0;const g=S.drag;if(!g||g.id!==e.pointerId)return;S.drag=null;st.classList.remove('drag');
  if(!g.moved){if(e.type==='pointercancel'||!g.slot)return;const j=+g.slot.dataset.slot,x=S.slots[j];
   if(S.t>.5||S.tT>.5){S.tT=0;pwrGo(S.rot+pwrNorm(x.a-S.rot));pwrInfo(true);return;}
   if(x.idx===pwrFrontIdx()&&Math.abs(pwrNorm(x.a-S.rot))<S.step/2)pwrOpen(x.idx);else pwrGo(S.rot+pwrNorm(x.a-S.rot));return;}
  const h=g.hist,a=h[0],b=h[h.length-1],v=b[0]>a[0]?(b[1]-a[1])/(b[0]-a[0])*16.67:0,cap=S.t>.5?12:S.step*1.6,vel=Math.max(-cap,Math.min(cap,v));
  if(S.tT>.5){S.vel=S.reduce?0:vel;pwrKick();}else pwrGo(Math.round((S.rot+vel*(S.reduce?0:18))/S.step)*S.step);};
 st.addEventListener('pointerup',end);st.addEventListener('pointercancel',end);
 st.addEventListener('click',e=>{if(e.target.closest('a'))e.preventDefault();});
 S.el.addEventListener('click',e=>{const b=e.target.closest('[data-pwr]');if(!b)return;const a=b.dataset.pwr;if(a==='prev')pwrStepBy(-1);else if(a==='next')pwrStepBy(1);else pwrZoom(S.tT<.5);});
 S.el.addEventListener('keydown',e=>{if(e.target.closest('button')&&e.key==='Enter')return;if(e.key==='ArrowLeft'){e.preventDefault();pwrStepBy(-1);}else if(e.key==='ArrowRight'){e.preventDefault();pwrStepBy(1);}else if(e.key==='Enter'&&e.target===S.el){pwrOpen(pwrFrontIdx());}});}
