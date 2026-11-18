/* js/passport.js — 观影护照：看过 / 想看 / 评分 / 观影日记 / 印章 / 护照翻页 / 成长。
   网站脚本按功能拆成 js/*.js，按 index.html 里的顺序加载；部署时 tools/build-assets.js 按同样顺序合并成一个 app.js。 */
/* ===== 观影护照：看过 / 我的评分（五星十分制）/ 每部影片一枚印章 / 影院观影结算 =====
   记录存在本机 localStorage「sparrow-watched-v1」：{ 影片id: { d:'YYYY-MM-DD' 观影日期, r:0–10 评分（0 未评分）, k:场次键（可空）, t:更新时间 } }
   印章外观（形状、倾角、墨色）按影片 id 固定，与小程序、结算长图一致（shared/recap.js）。 */
const WATCH_KEY='sparrow-watched-v1',HOLDER_KEY='sparrow-holder',PHOTO_KEY='sparrow-holder-photo';
let watched={};
function readWatched(){try{const o=JSON.parse(localStorage.getItem(WATCH_KEY)||'{}');return o&&typeof o==='object'&&!Array.isArray(o)?o:{};}catch{return {};}}
function migrateAliases(al){let ch=false;Object.entries(al||{}).forEach(([o,n])=>{const a=watched[o];if(!a)return;if(a.d&&!(watched[n]&&watched[n].d)){watched[n]=Object.assign({},a,{t:Date.now()});}if(!a.del){watched[o]={del:1,t:Date.now()};ch=true;}});if(ch)saveWatched();}
function saveWatched(){try{localStorage.setItem(WATCH_KEY,JSON.stringify(watched));if(typeof tasteChanged==='function')tasteChanged();}catch{toast('当前浏览器无法保存，离开页面后可能丢失');}}
const isoOf=d=>d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate());
// 默认观影日期：优先已放映的「个人排片」场次，其次本片最近一场已放映场次，否则今天
function watchGuess(id){const past=SH.filter(s=>s.id===id&&isPast(s)),mine=past.filter(s=>picked.has(keyOf(s))),s=(mine.length?mine:past).slice(-1)[0];return s?{d:isoOf(showDate(s)),k:keyOf(s)}:{d:isoOf(new Date(now())),k:''};}
function watchShow(rec){const k=rec&&rec.k&&resolveKey(rec.k),s=k&&SH.find(x=>keyOf(x)===k);return s&&isoOf(showDate(s))===rec.d?s:null;}
function watchEntries(){return Object.keys(watched).filter(id=>F[id]&&watched[id]&&!watched[id].del&&watched[id].d).map(id=>{const rec=watched[id],s=watchShow(rec);return {id,f:F[id],rec,s,venue:s?vShort(VN[s.v]):''};})
  .sort((a,b)=>a.rec.d.localeCompare(b.rec.d)||(a.s&&b.s?showDate(a.s)-showDate(b.s):0)||a.id.localeCompare(b.id));}
/* ===== 想看（2026-11-16）=====
   本机 localStorage「sparrow-want-v1」：{影片id:{t}|{del:1,t}}，随个人档案云端同步（shared/psync.js 的 want）。
   看过（盖章）后自动不再算想看。「sparrow-want-seen-v1」只存在本机：{影片id:[已见过的待映场次键]}，
   想看的影片出现没见过的待映场次时，片目卡片标「新场次」；打开影片页即算看过这些场次。 */
const WANT_KEY='sparrow-want-v1',WANT_SEEN_KEY='sparrow-want-seen-v1';
let want={},wantSeen={};
function readWant(){try{const o=JSON.parse(localStorage.getItem(WANT_KEY)||'{}');return o&&typeof o==='object'&&!Array.isArray(o)?o:{};}catch{return {};}}
function readWantSeen(){try{const o=JSON.parse(localStorage.getItem(WANT_SEEN_KEY)||'{}');return o&&typeof o==='object'&&!Array.isArray(o)?o:{};}catch{return {};}}
function saveWant(){try{localStorage.setItem(WANT_KEY,JSON.stringify(want));}catch{toast('当前浏览器无法保存，离开页面后可能丢失');}}
const isWant=id=>!!(want[id]&&!want[id].del)&&!(watched[id]&&watched[id].d);
const wantUpcoming=id=>SH.filter(s=>s.id===id&&!isPast(s)).map(keyOf);
function wantNew(id){if(!isWant(id))return 0;const seen=new Set(wantSeen[id]||[]);return wantUpcoming(id).filter(k=>!seen.has(k)).length;}
function wantMarkSeen(id){if(!isWant(id))return;const ks=wantUpcoming(id).slice(0,200);if(JSON.stringify(wantSeen[id]||[])===JSON.stringify(ks))return;wantSeen[id]=ks;try{localStorage.setItem(WANT_SEEN_KEY,JSON.stringify(wantSeen));}catch{}}
function setWant(id,on){want[id]=on?{t:Date.now()}:{del:1,t:Date.now()};saveWant();if(on)wantMarkSeen(id);}
function wantStats(){const ids=FILMS.filter(f=>isWant(f.id)).map(f=>f.id);return {n:ids.length,live:ids.filter(id=>wantUpcoming(id).length).length,fresh:ids.filter(id=>wantNew(id)).length};}
function holderPhoto(){try{return localStorage.getItem(PHOTO_KEY)||'';}catch{return '';}}
function holderName(){try{return localStorage.getItem(HOLDER_KEY)||'';}catch{return '';}}

const STAR_D='M12 2.6l2.85 6.05 6.6.8-4.87 4.55 1.25 6.55L12 17.3l-5.83 3.25 1.25-6.55L2.55 9.45l6.6-.8Z';
const STAMP_IC='<svg class="mr-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M9 3h6l-1 6h3a2 2 0 0 1 2 2v3H5v-3a2 2 0 0 1 2-2h3Z"/><path d="M4 17h16v3H4z"/></svg>';
function starsHTML(r,cls){return '<span class="'+(cls||'mr-stars')+'" aria-hidden="true">'+[1,2,3,4,5].map(i=>'<span class="mr-star" style="--fill:'+Math.max(0,Math.min(2,r-(i-1)*2))*50+'%"><svg viewBox="0 0 24 24"><path d="'+STAR_D+'"/></svg><svg class="on" viewBox="0 0 24 24"><path d="'+STAR_D+'"/></svg></span>').join('')+'</span>';}

const fmtName=id=>{const G=window.SparrowGrowth,x=G&&G.FMT[id];return x?(LANG==='en'?x.en:x.zh):'';};
function starInput(attr,r,label){return '<div class="mr-stars mr-input" role="group" aria-label="'+label+'">'+[1,2,3,4,5].map(i=>'<span class="mr-star" style="--fill:'+Math.max(0,Math.min(2,r-(i-1)*2))*50+'%"><svg viewBox="0 0 24 24"><path d="'+STAR_D+'"/></svg><svg class="on" viewBox="0 0 24 24"><path d="'+STAR_D+'"/></svg><button '+attr+' data-v="'+(i*2-1)+'" aria-label="'+(i*2-1)+' 分"></button><button '+attr+' data-v="'+(i*2)+'" aria-label="'+(i*2)+' 分"></button></span>').join('')+'</div>';}
// 趣味评分：与十分制共用 SVG 星星样式；每颗星 1 分（整数 0–5），0 = 完全没有，未评显示「未评」
function tasteStar(fill,btn){return '<span class="mr-star" style="--fill:'+fill+'%"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+STAR_D+'"/></svg><svg class="on" viewBox="0 0 24 24" aria-hidden="true"><path d="'+STAR_D+'"/></svg>'+(btn||'')+'</span>';}
function tasteHTML(f){const rec=watched[f.id],on=!!(rec&&rec.d);if(!on)return '';
 const row=(key,label,desc)=>{const n=window.SparrowTaste.valid(rec[key])?rec[key]:null;return '<div class="taste-row"><div class="taste-copy"><b>'+label+'</b><small>'+desc+'</small></div><div class="taste-picks"><button type="button" data-taste="'+f.id+'" data-key="'+key+'" data-value="0" class="taste-zero'+(n===0?' selected':'')+'" aria-pressed="'+(n===0)+'" aria-label="'+label+' 0/5">0</button><div class="mr-stars taste-stars" role="group" aria-label="'+label+'">'+[1,2,3,4,5].map(i=>tasteStar(n!==null&&n>=i?100:n!==null&&n>=i-.5?50:0,[i-.5,i].map(x=>'<button type="button" data-taste="'+f.id+'" data-key="'+key+'" data-value="'+x+'" aria-pressed="'+(n===x)+'" aria-label="'+label+' '+x+'/5"></button>').join(''))).join('')+'</div><span class="taste-val">'+(n===null?'<small>'+ppV('未评','Not rated')+'</small>':'<b>'+n+'</b><small>/5</small>')+'</span></div></div>';};
 return '<div class="taste-panel">'+row('fun',ppV('有趣度','Interesting'),ppV('有多让你着迷？','How captivating?'))+row('bore',ppV('无聊度','Boring'),ppV('观看时多经常感到乏味？','How often did you feel bored?'))+'<p>'+ppV('0 = 完全没有，与「未评」不同 · 再点相同分数可取消 · 两项可以同时很高','0 = not at all (different from not rated) · Tap the same score to clear · Both can be high')+'</p></div>';}
function myRateHTML(f){const rec=watched[f.id],on=!!(rec&&rec.d),r=on?(rec.r||0):0,G=window.SparrowGrowth,n=on&&G?G.views(rec).length:0;
  const stars=starInput('data-rate="'+f.id+'"',r,ppV('我的评分（五星十分制）','My rating (5 stars, 10 points)'));
  const head='<h3 class="fd-h">我的观影 <small>MY FILM PASSPORT</small></h3>';
  // 一张卡片：我的评分 / 趣味 / 每一次观影，左侧统一灰色小标签
  const rate='<div class="mrc-rate"><span class="mrc-k">'+ppV('我的评分','My rating')+(n>1?'<small>'+ppV('最近一次','latest')+'</small>':'')+'</span>'+stars+'<span class="mr-score">'+(r?'<b>'+r+'</b><small>/10</small>':'<small>'+ppV('点星打分','Tap to rate')+'</small>')+'</span></div>';
  const wOn=isWant(f.id);
  if(!on)return '<section class="fd-block my-rate" id="my-rate">'+head+
    '<div class="mr-acts"><button class="mr-want'+(wOn?' on':'')+'" data-want="'+f.id+'" aria-pressed="'+wOn+'"><span>'+(wOn?ppV('★ 已想看','★ On my list'):ppV('☆ 想看','☆ Want to see'))+'</span></button><button class="mr-seen" data-seen="'+f.id+'" aria-pressed="false"><span>＋ 看过 · 盖章</span></button></div>'+
    '<div class="mrc">'+rate+tasteRowHTML(f)+'</div><p class="mr-tip">看过后会在「我的 → 观影护照」盖下这部电影的印章；评分为五星十分制，可打半颗星。</p></section>';
  return '<section class="fd-block my-rate on" id="my-rate"><div class="mr-top">'+head+
    '<button type="button" class="mr-stamp" data-st-open="'+f.id+'" aria-haspopup="dialog" aria-label="'+ppV('已盖章，查看或取消印章','Stamped · view or remove this stamp')+'">'+STAMP_IC+'<span>'+ppV('已盖章','Stamped')+'</span>'+(n>1?'<b>'+ppV(n+' 次','×'+n)+'</b>':'')+'<em aria-hidden="true">›</em></button></div>'+
    '<div class="mrc">'+rate+tasteRowHTML(f)+lgRowsHTML(f,rec)+'</div></section>';}
// 放映版本（可选）：2K / 4K / 胶片 / IMAX 各版本 / 杜比 / 4DX 等，用于「成长」里的版本收藏与胶片、IMAX 纪念章
function fmtOptionsHTML(cur){const G=window.SparrowGrowth;if(!G)return '';const en=LANG==='en';
  return '<option value="">'+ppV('未填写','Not set')+'</option>'+(pl=>G.FORMAT_GROUPS.map(g=>pl.some(x=>x.group===g.id)?'<optgroup label="'+(en?g.en:g.zh)+'">'+pl.filter(x=>x.group===g.id).map(x=>'<option value="'+x.id+'"'+(x.id===cur?' selected':'')+'>'+(en?x.en:x.zh)+'</option>').join('')+'</optgroup>':'').join(''))(G.pickList(cur));}
const MR_DD='<svg class="mr-dd" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
// —— 观影日记：每次观影一行（新→旧），点一行或「再看一次」打开底部编辑弹层 ——
function lgShowLabel(s){return esc(showDate(s).getMonth()+1+'.'+pad2(showDate(s).getDate()))+' '+s.t+' · '+esc(vShort(VN[s.v]));}
const DY_SHOW=3,DY_OPEN={}; // 观影日记折叠：默认只显示最近 3 次，展开状态仅保存在本次页面内存
function lgRowsHTML(f,rec){const G=window.SparrowGrowth,vs=G.views(rec),n=vs.length,id=f.id;
  const rowsAll=vs.map((v,i)=>({v,i})).reverse().map(({v,i})=>{const s=v.k&&SH.find(x=>keyOf(x)===v.k),fv=v.f&&fmtName(v.f),
    l1=s?esc(vShort(VN[s.v]))+' · '+s.t:(fv?esc(fv):''),l2=s&&fv?esc(fv):'',tag=n>1?(i===n-1?ppV('最近','Latest'):i===0?ppV('首刷','First'):''):'';
    return '<button type="button" class="dy-row" data-lg="edit" data-id="'+id+'" data-i="'+i+'"><span class="dy-d"><b>'+esc(v.d.slice(5).replace('-','.'))+'</b><small>'+v.d.slice(0,4)+'</small></span>'+
      '<span class="dy-m">'+(l1?'<span class="dy-l1">'+l1+'</span>':'<span class="dy-l1 nil">'+ppV('补充场次与版本','Add screening & format')+'</span>')+(l2?'<span class="dy-l2">'+l2+'</span>':'')+'</span>'+
      (n>1?'<span class="dy-s">'+(v.r?'<b>'+v.r+'</b>':'<i>—</i>')+(tag?'<small>'+tag+'</small>':'')+'</span>':'<span></span>')+chevron+'</button>';}),fold=n>DY_SHOW,open=!!DY_OPEN[id],hid=n-DY_SHOW,
    rows=(fold&&!open?rowsAll.slice(0,DY_SHOW):rowsAll).join(''),
    more=fold?'<button type="button" class="dy-more" data-dy="toggle" data-id="'+id+'" aria-expanded="'+open+'">'+(open?ppV('收起较早的观影','Show fewer'):ppV('展开其余 '+hid+' 次','Show '+hid+' earlier'))+' <i>'+(open?'▴':'▾')+'</i></button>':'';
  return rows+more+
    '<button type="button" class="dy-add" data-lg="new" data-id="'+id+'">＋ '+ppV('再看一次','Log another viewing')+'</button>';}
let LG=null; // 弹层草稿 {id,i,isNew,d,k,f,r}
function lgPast(id){return SH.filter(x=>x.id===id&&isPast(x)).sort((a,b)=>showDate(b)-showDate(a));}
function lgLink(id,d,k){const past=lgPast(id);if(k){const s=past.find(x=>keyOf(x)===k);if(s&&isoOf(showDate(s))===d)return k;}const s=past.find(x=>isoOf(showDate(x))===d);return s?keyOf(s):'';}
function lgBodyHTML(){const G=window.SparrowGrowth,o=LG,past=lgPast(o.id),dl=ppV('观影日期','Date seen'),sl=ppV('放映场次','Screening'),fl=ppV('放映版本','Format'),
  s=o.k&&SH.find(x=>keyOf(x)===o.k),fv=o.f&&fmtName(o.f);
  return '<div class="mr-list dy-form">'+
   '<label class="mr-li"><span class="mr-k">'+dl+'</span><span class="mr-v">'+esc(o.d.replace(/-/g,'.'))+'</span>'+MR_DD+'<input class="mr-ov" type="date" value="'+esc(o.d)+'" max="'+isoOf(new Date(now()))+'" data-lg-f="d" aria-label="'+dl+'"></label>'+
   (past.length?'<label class="mr-li"><span class="mr-k">'+sl+'</span><span class="mr-v'+(s?'':' nil')+'">'+(s?lgShowLabel(s):ppV('不关联','None'))+'</span>'+MR_DD+'<select class="mr-ov" data-lg-f="k" aria-label="'+sl+'"><option value="">'+ppV('不关联场次','No linked screening')+'</option>'+past.map(x=>'<option value="'+esc(keyOf(x))+'"'+(keyOf(x)===o.k?' selected':'')+'>'+lgShowLabel(x)+'</option>').join('')+'</select></label>'
     :'<div class="mr-li static"><span class="mr-k">'+sl+'</span><span class="mr-v nil">'+ppV('本片暂无已放映场次','No past screenings')+'</span></div>')+
   (G?'<label class="mr-li"><span class="mr-k">'+fl+'<small>'+ppV('可选','optional')+'</small></span><span class="mr-v'+(fv?'':' nil')+'">'+esc(fv||ppV('未填写','Not set'))+'</span>'+MR_DD+'<select class="mr-ov" data-lg-f="f" aria-label="'+fl+'">'+fmtOptionsHTML(o.f||'')+'</select></label>':'')+
  '</div><div class="dy-rate"><span class="mr-k">'+ppV('这一次的评分','Rating')+'</span>'+starInput('data-lg-rate',o.r,ppV('这一次的评分','Rating'))+'<span class="mr-score">'+(o.r?'<b>'+o.r+'</b><small>/10</small>':'<small>'+ppV('未评','—')+'</small>')+'</span></div>';}
function lgSheetHTML(){const f=F[LG.id],n=window.SparrowGrowth.views(watched[LG.id]).length,
  title=LG.isNew?ppV('再看一次','Log another viewing'):n>1?ppV('第 '+(LG.i+1)+' 次观影','Viewing '+(LG.i+1)):ppV('观影记录','Viewing'),
  del=LG.isNew?'':'<button type="button" class="text-button dy-del" data-lg="del">'+(n>1?ppV('删除这一次','Delete this viewing'):ppV('移出观影护照','Remove from passport'))+'</button>';
  return '<div class="ts-wrap" id="lg-sheet"><div class="ts-backdrop" data-lg="close"></div><section class="ts-sheet" role="dialog" aria-modal="true" aria-labelledby="lg-title"><span class="ts-grab" aria-hidden="true"></span><header class="ts-head"><div><small>DIARY · '+esc(f.cn)+'</small><h3 id="lg-title">'+title+'</h3></div><button type="button" class="ts-x" data-lg="close" aria-label="'+ppV('关闭','Close')+'">×</button></header><div class="ts-body dy-body">'+lgBodyHTML()+'</div><footer class="ts-foot">'+(del||'<span></span>')+'<button type="button" class="primary-button" data-lg="save">'+ppV('保存','Save')+'</button></footer></section></div>';}
function lgOpen(id,i){const rec=watched[id],G=window.SparrowGrowth;if(!rec||!rec.d||!G)return;const vs=G.views(rec);lgClose(true);
  if(i>=0&&vs[i])LG={id,i,isNew:false,d:vs[i].d,k:vs[i].k||'',f:vs[i].f||'',r:vs[i].r||0};
  else{const d=isoOf(new Date(now()));LG={id,i:-1,isNew:true,d,k:lgLink(id,d,''),f:'',r:0};}
  document.body.insertAdjacentHTML('beforeend',lgSheetHTML());document.documentElement.classList.add('ts-lock');const x=document.querySelector('#lg-sheet .ts-x');if(x)x.focus({preventScroll:true});}
function lgPaint(){const el=document.querySelector('#lg-sheet .dy-body');if(el&&LG)el.innerHTML=lgBodyHTML();}
function lgClose(now){const w=document.getElementById('lg-sheet');LG=null;if(!document.getElementById('ts-sheet'))document.documentElement.classList.remove('ts-lock');if(!w)return;if(now||matchMedia('(prefers-reduced-motion: reduce)').matches){w.remove();return;}w.classList.add('out');setTimeout(()=>w.remove(),180);}
// 影片页「已盖章」：底部小弹层——在护照中查看 / 取消印章（整部移出），不再直接跳转
let STO='';
function stClose(now){const w=document.getElementById('st-sheet');STO='';if(!document.getElementById('ts-sheet')&&!document.getElementById('lg-sheet'))document.documentElement.classList.remove('ts-lock');if(!w)return;if(now||matchMedia('(prefers-reduced-motion: reduce)').matches){w.remove();return;}w.classList.add('out');setTimeout(()=>w.remove(),180);}
function stOpen(id){const f=F[id],rec=watched[id];if(!f||!rec||!rec.d)return;stClose(true);STO=id;const n=(window.SparrowGrowth?window.SparrowGrowth.views(rec).length:1);
  document.body.insertAdjacentHTML('beforeend','<div class="ts-wrap" id="st-sheet"><div class="ts-backdrop" data-st="close"></div><section class="ts-sheet" role="dialog" aria-modal="true" aria-labelledby="st-title"><span class="ts-grab" aria-hidden="true"></span><header class="ts-head"><div><small>STAMP · '+esc(f.cn)+'</small><h3 id="st-title">'+ppV('观影印章','Passport stamp')+'</h3></div><button type="button" class="ts-x" data-st="close" aria-label="'+ppV('关闭','Close')+'">×</button></header><div class="ts-body"><p class="mr-tip" style="margin:0 0 14px">'+ppV('这部电影已盖章'+(n>1?'，共 '+n+' 次观影':'')+'。','This film is stamped'+(n>1?' · '+n+' viewings':'')+'.')+'</p><button type="button" class="primary-button" style="width:100%" data-st="view">'+ppV('在护照中查看印章','View in my passport')+'</button><button type="button" class="text-button dy-del" style="width:100%;margin-top:10px;min-height:44px" data-st="del">'+ppV('取消印章 · 移出观影护照','Remove stamp · take out of passport')+'</button></div></section></div>');
  document.documentElement.classList.add('ts-lock');const x=document.querySelector('#st-sheet .ts-x');if(x)x.focus({preventScroll:true});}
document.addEventListener('click',e=>{const o=e.target.closest('[data-st-open]');if(o){e.preventDefault();stOpen(o.dataset.stOpen);return;}const b=e.target.closest('[data-st]');if(!b||!STO)return;const id=STO,a=b.dataset.st;
  if(a==='close'){stClose();return;}
  if(a==='view'){stClose(true);ppJump(id);return;}
  if(a==='del'){if(!confirm(tr('移出观影护照？这部电影的印章和评分会一起删除。')))return;stClose(true);unstamp(id);}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&STO)stClose();});
window.addEventListener('hashchange',()=>{if(STO)stClose(true);});
function unstamp(id){watched[id]={del:1,t:Math.max(Date.now(),(watched[id].t||0)+1,...Object.values(watched[id].tasteAt||{}).map(t=>t+1))};saveWatched();toast('已移出观影护照');refreshMyRate(id);}
document.addEventListener('click',e=>{
  const dy=e.target.closest('[data-dy]');if(dy){const id=dy.dataset.id;DY_OPEN[id]=!DY_OPEN[id];refreshMyRate(id);return;}
  const rt=e.target.closest('[data-lg-rate]');if(rt&&LG){const v=+rt.dataset.v;LG.r=LG.r===v?0:v;lgPaint();return;}
  const b=e.target.closest('[data-lg]');if(!b)return;const a=b.dataset.lg;
  if(a==='edit'||a==='new'){lgOpen(b.dataset.id,a==='new'?-1:+b.dataset.i);return;}
  if(!LG)return;const id=LG.id,G=window.SparrowGrowth;
  if(a==='close'){lgClose();return;}
  if(a==='save'){const res=G.putView(watched[id],LG.isNew?-1:LG.i,{d:LG.d,r:LG.r,k:LG.k,f:LG.f});if(res.rec){watched[id]=Object.assign(res.rec,{t:Date.now()});saveWatched();toast(LG.isNew?ppV('已记下这一次观影','Viewing logged'):ppV('已保存','Saved'));}lgClose();refreshMyRate(id);return;}
  if(a==='del'){const n=G.views(watched[id]).length;
    if(n<2){if(!confirm(tr('移出观影护照？这部电影的印章和评分会一起删除。')))return;lgClose(true);unstamp(id);return;}
    if(!confirm(tr('删除这一次观影记录？')))return;const o=G.dropView(watched[id],LG.i);if(o){watched[id]=Object.assign(o,{t:Date.now()});saveWatched();}lgClose();refreshMyRate(id);return;}
});
document.addEventListener('change',e=>{const c=e.target.closest('[data-lg-f]');if(!c||!LG)return;const k=c.dataset.lgF;
  if(k==='d'){if(!/^\d{4}-\d{2}-\d{2}$/.test(c.value))return;LG.d=c.value;LG.k=lgLink(LG.id,LG.d,LG.k);}
  else if(k==='k'){LG.k=c.value;const s=c.value&&SH.find(x=>keyOf(x)===c.value);if(s)LG.d=isoOf(showDate(s));}
  else if(k==='f'){const G=window.SparrowGrowth;LG.f=c.value&&G&&G.FMT[c.value]?c.value:'';}
  lgPaint();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&LG)lgClose();});
window.addEventListener('hashchange',()=>{if(LG)lgClose(true);});
function refreshMyRate(id){const b=document.getElementById('my-rate');if(b&&F[id])b.outerHTML=myRateHTML(F[id]);if(tsOpen===id)tsPaint();}

// —— 印章（SVG）——
/* 片名排版改用 shared/recap.js 的 SparrowRecap.stampTitle（2026-11-18） */
// 印章 SVG 与姿态在 shared/recap.js（stampSVG / stampPose），小程序护照用同一份（inline 模式当图片显示）
function stampSVG(e){const p=progOf(e.f);return window.SparrowRecap.stampSVG({id:e.id,title:e.f.cn,top:(p&&p.en)||'',venue:e.venue||'影院观影',date:e.rec.d,r:e.rec.r||0,views:window.SparrowGrowth?window.SparrowGrowth.views(e.rec).length:0});}

// —— 护照（封面 → 资料页 → 印章页，单页翻动）——
const PP={mc:'',open:false,page:0,busy:false,vol:0,shelf:false,tab:'stamps',lvAll:false,gt:'level',cAll:false,gOpen:null},PP_PER=15,PP_VOL=285; // 每册 = 1 资料页 + 19 印章页（每页 15 枚）= 20 页 = 10 个跨页；满册自动换下一册
const ppV=(zh,en)=>LANG==='en'?en:zh;
function ppVols(all){const v=[];for(let i=0;i<Math.max(1,all.length);i+=PP_VOL)v.push(all.slice(i,i+PP_VOL));return v;}
function ppCur(){const all=watchEntries(),vols=ppVols(all);PP.vol=Math.min(Math.max(PP.vol||vols.length,1),vols.length);return {all,vols,list:vols[PP.vol-1],vol:PP.vol,nv:vols.length};}
const ppYM=d=>d?d.slice(0,7).replace('-','.'):'';
function ppRange(list){return list.length?(ppYM(list[0].rec.d)===ppYM(list[list.length-1].rec.d)?ppYM(list[0].rec.d):ppYM(list[0].rec.d)+' – '+ppYM(list[list.length-1].rec.d)):'—';}
const PP_EMBLEM='<svg viewBox="0 0 120 120" fill="none" aria-hidden="true"><circle cx="60" cy="60" r="44"/><circle cx="60" cy="60" r="36" stroke-dasharray="2 4"/><circle cx="60" cy="60" r="7"/>'+[0,1,2,3,4,5].map(i=>{const a=i*Math.PI/3-Math.PI/2;return '<circle cx="'+(60+21*Math.cos(a)).toFixed(1)+'" cy="'+(60+21*Math.sin(a)).toFixed(1)+'" r="8"/>';}).join('')+'<path d="M60 16v-8M60 112v-8M16 60H8M112 60h-8"/><path d="M38 100c6 5 14 8 22 8s16-3 22-8M30 92c-6-8-9-19-8-30M90 92c6-8 9-19 8-30" stroke-dasharray="1 3"/></svg>';
function passportStats(list){const venues=new Set(list.filter(e=>e.s).map(e=>e.s.v)),progs=new Set(list.map(e=>progOf(e.f).id)),rated=list.filter(e=>e.rec.r),mins=list.reduce((n,e)=>n+(e.f.min||0),0);
  return {n:list.length,venues:venues.size,progs:progs.size,avg:rated.length?rated.reduce((n,e)=>n+e.rec.r,0)/rated.length:0,mins,hm:Math.floor(mins/60)+'h'+pad2(mins%60)};}
function passportPages(list){const pages=['id'];for(let i=0;i<Math.max(1,list.length);i+=PP_PER)pages.push(i);return pages;}
// 印章像真护照那样盖：位置略有偏移、角度各不相同，边缘允许轻微重叠（同一枚章每次位置固定）
function stampPose(id,i){const q=window.SparrowRecap.stampPose(id,i);return {tilt:q.tilt.toFixed(1),dx:q.dx.toFixed(2),dy:q.dy.toFixed(2)};}
function ppPageHTML(list,pg,n){const R=window.SparrowRecap,C=ppCur(),st=passportStats(C.all),no=String(pg+1).padStart(2,'0'),hn=holderName(),hp=holderPhoto();
  if(pg===0){const first=list[0],last=list[list.length-1];
    return '<section class="fp-page fp-id" aria-label="护照资料页"><div class="fp-ph"><span>FILM PASSPORT / 资料页'+(C.nv>1?' · VOL. '+pad2(C.vol):'')+'</span><span>'+no+'</span></div>'+
    '<div class="fp-idhead"><div class="fp-portrait'+(hp?' has':'')+'">'+(hp?'<img src="'+hp+'" alt="持有人照片">':PP_EMBLEM+'<small>添加照片<br>ADD PHOTO</small>')+'<button type="button" class="fp-pbtn" data-pp="photo" aria-label="从相册添加或更换照片"></button>'+(hp?'<button type="button" class="fp-pclear" data-pp="photo-clear" aria-label="移除照片">×</button>':'')+'</div><div class="fp-fields"><span class="fp-l">类型 / TYPE · P</span><span class="fp-l">持有人 / HOLDER</span><button class="fp-holder" data-pp="name">'+(hn?esc(hn):'影迷')+' <i>✎</i></button><span class="fp-en">'+(hn?'':'CINEPHILE')+'</span><span class="fp-l">签发 / ISSUED BY</span><b class="fp-iss">麻雀映画 × 麻雀部落</b></div></div>'+
    '<div class="fp-tally"><span><b>'+pad2(st.n)+'</b>看过影片</span><span><b>'+pad2(st.progs)+'</b>专题</span><span><b>'+pad2(st.venues)+'</b>影院</span><span><b>'+(st.avg?st.avg.toFixed(1):'—')+'</b>平均评分</span></div>'+
    '<dl class="fp-dl"><dt>册号 / VOLUME</dt><dd>'+pad2(C.vol)+' / '+pad2(C.nv)+'</dd><dt>本册印章 / IN THIS VOLUME</dt><dd>'+list.length+'</dd><dt>首枚印章 / FIRST STAMP</dt><dd>'+(first?R.dstamp(first.rec.d):'—')+'</dd><dt>最近印章 / LATEST</dt><dd>'+(last?R.dstamp(last.rec.d):'—')+'</dd><dt>累计时长 / SCREEN TIME</dt><dd>'+st.hm+'</dd></dl>'+
    '<div class="fp-sign"><span>签名 / SIGNATURE</span><b>See you at the cinema.</b></div>'+
    '<div class="fp-mrz" aria-hidden="true">P&lt;SPARROW&lt;FILM&lt;PASSPORT&lt;&lt;'+(hn&&!CJK.test(hn)?esc(hn.toUpperCase().replace(/[^A-Z]/g,'&lt;')).slice(0,14):'CINEPHILE')+'&lt;&lt;&lt;<br>FILMS&lt;'+String(st.n).padStart(3,'0')+'&lt;&lt;PROGS&lt;'+pad2(st.progs)+'&lt;&lt;AVG&lt;'+(st.avg?Math.round(st.avg*10):'00')+'&lt;&lt;'+(last?last.rec.d.replace(/-/g,''):'00000000')+'</div></section>';}
  const start=(pg-1)*PP_PER,items=list.slice(start,start+PP_PER);
  const cells=items.map((e,i)=>'<button class="fp-stamp" data-film="'+e.id+'" style="--tilt:'+stampPose(e.id,i).tilt+'deg;--dx:calc(var(--u)*'+stampPose(e.id,i).dx+');--dy:calc(var(--u)*'+stampPose(e.id,i).dy+');--i:'+i+'">'+stampSVG(e)+'</button>').join('')+
    Array.from({length:Math.min(1,PP_PER-items.length)},(x,i)=>'<span class="fp-slot'+(i?' dim':'')+'">'+(i===0&&!list.length?'<b>第一枚印章</b><small>在影片页点「看过」</small>':'<small>NEXT STAMP</small>')+'</span>').join('');
  return '<section class="fp-page fp-visa" aria-label="观影印章页"><div class="fp-ph"><span>VISAS / 观影印章'+(C.nv>1?' · VOL. '+pad2(C.vol):'')+'</span><span>'+no+'</span></div><h4>'+(list.length?'一部电影，一枚印章。':'这本护照还没有印章')+'</h4><p class="fp-sub">'+(list.length?'点印章回到影片 · 评分印在章上':'在影片页点「看过」，就会在这里盖章。')+'</p><div class="fp-grid">'+cells+'</div><div class="fp-pf"><span><span>印章</span> '+pg+' / '+(n-1)+'</span><span>SPARROW FILM PASSPORT</span></div></section>';}
// 平板横屏 / 折叠屏展开（≥840px）：像翻开真护照一样左右两页（1·2、3·4、5·6…）
const ppSpread=()=>matchMedia('(min-width:840px)').matches;
function ppBlank(no){return '<section class="fp-page fp-blank fp-right" aria-hidden="true"><div class="fp-ph"><span>SPARROW FILM PASSPORT</span><span>'+String(no).padStart(2,'0')+'</span></div><div class="fp-blank-mark">'+PP_EMBLEM+'</div></section>';}
function bookHTML(list,n){const sp=ppSpread(),b=sp?PP.page-PP.page%2:PP.page,last=sp?b+2>=n:b>=n-1;
  const side=(h,c)=>h.replace('class="fp-page ','class="fp-page '+c+' ');
  const book=sp?'<div class="fp-book fp-spread">'+side(ppPageHTML(list,b,n),'fp-left')+(b+1<n?side(ppPageHTML(list,b+1,n),'fp-right'):ppBlank(b+2))+'</div>':'<div class="fp-book">'+ppPageHTML(list,b,n)+'</div>';
  const label=sp&&b+1<n?(b+1)+'–'+(b+2)+' / '+n:(b+1)+' / '+n;
  return '<div class="fp-stage">'+book+'</div><div class="fp-nav"><button data-pp="prev" '+(b===0?'disabled':'')+' aria-label="上一页">← 上一页</button><span>'+label+'</span><button data-pp="next" '+(last?'disabled':'')+' aria-label="下一页">下一页 →</button></div>';}
function ppShelfHTML(C){const cards=C.vols.map((v,k)=>'<button type="button" class="fp-vcard" data-pp="vol" data-v="'+(k+1)+'" data-cv="'+(k%5+1)+'"><span class="fp-vc-no">VOL. '+pad2(k+1)+'</span><b>'+ppV('观影护照','Film Passport')+'</b><span class="fp-vc-r">'+ppRange(v)+'</span><span class="fp-vc-n">'+v.length+ppV(' 部',' films')+(k===C.nv-1?' · '+ppV('最新','Latest'):v.length>=PP_VOL?' · '+ppV('已满','Full'):'')+'</span></button>').join('');
  return '<div class="fp-shelf"><div class="fp-shelf-h"><div><small>BOOKSHELF</small><h3>'+ppV('我的护照书架','My passport shelf')+'</h3><p>'+ppV('共 '+C.nv+' 册 · 每册最多 '+PP_VOL+' 枚印章，满了自动换下一册。','You have '+C.nv+' volumes · each holds up to '+PP_VOL+' stamps, then a new one begins.')+'</p></div><button class="text-button" data-pp="shelf-close">'+ppV('返回','Back')+'</button></div><div class="fp-vgrid">'+cards+'</div></div>';}
// —— 成长：影迷等级 / 全球足迹 / 旅程纪念章（计算在 shared/growth.js，这里只负责画） ——
function growthData(){const G=window.SparrowGrowth;if(!G)return null;
  const rows=[];watchEntries().forEach(e=>{const p=progOf(e.f),v=e.s?VN[e.s.v]:null,base={id:e.id,min:e.f.min||0,prog:p.id,city:(v&&v.city)||p.city||'',venue:e.s?e.s.v:'',f:{y:e.f.y,c:e.f.c,dir:e.f.dir,genre:e.f.genre,language:e.f.language,honors:e.f.honors,r:e.f.r,o:e.f.o,en:e.f.en},time:e.s?e.s.t:''};G.views(e.rec).forEach((x,i)=>{const s2=x.k&&SH.find(y=>keyOf(y)===x.k),v2=s2?VN[s2.v]:null;rows.push(Object.assign({},base,{time:i===0?base.time:(s2?s2.t:''),d:x.d,r:x.r||0,fmt:x.f||'',re:i>0,city:i===0?base.city:((v2&&v2.city)||base.city),venue:i===0?base.venue:(s2?s2.v:base.venue)}));});});
  const progs=PROGRAMMES.map(p=>({id:p.id,name:p.name,en:p.en||'',kind:p.kind,city:p.city||'',total:FILMS.filter(f=>progOf(f).id===p.id).length}));
  return G.compute(rows,{progs});}
const G_CATS=()=>window.SparrowGrowth.CATS;
const gNm=x=>LANG==='en'?x.en:x.zh;
const gK=n=>n>=1000?(n%1000===0?n/1000:+(n/1000).toFixed(1))+'k':String(n);
function gMedal(t,unitPct,state,delay){return '<li class="gm '+state+'" style="--p:'+t.pct+';--i:'+delay+'" title="'+esc(gNm(t))+'"><span class="gm-disc"><b>'+gK(t.n)+(unitPct?'<i>%</i>':'')+'</b></span><small>'+esc(gNm(t))+'</small></li>';}

let tasteMapMode='mine';
function tasteMapHTML(){const en=LANG==='en',all=watchEntries(),publicEntries=FILMS.filter(f=>{const a=TC.get(f.id);return a&&a.pairN>=3;}).map(f=>{const a=TC.get(f.id);return {id:f.id,f,rec:{fun:a.pairFun,bore:a.pairBore},community:true};}),m=window.SparrowTaste.map(tasteMapMode==='community'?publicEntries:all,en);
 return '<section class="taste-map"><header><b>'+ppV('四象限','Quadrants')+'</b><small>'+m.n+' '+ppV('部电影','films')+'</small></header><div class="taste-tabs">'+[['mine',ppV('我的四象限','My quadrants')],['community',ppV('社区四象限','Community quadrants')]].map(([id,label])=>'<button data-taste-map="'+id+'" aria-pressed="'+(tasteMapMode===id)+'">'+label+'</button>').join('')+'</div><div class="taste-grid">'+m.quadrants.map(q=>'<span>'+esc(q.name)+'</span>').join('')+m.points.map(g=>'<button class="taste-point" style="left:'+g.x+'%;top:'+g.y+'%" data-taste-point="'+g.key+'" aria-label="'+esc(g.entries.map(e=>e.title).join('、'))+'">'+(g.n>1?g.n:'')+'</button>').join('')+'</div><p>'+ppV('有趣度 →　 ↑ 无聊度','Interesting →　 ↑ Boring')+'</p><footer>'+m.quadrants.map(q=>'<span>'+esc(q.name)+' <b>'+q.count+'</b></span>').join('')+'<span class="tq-unsure">'+ppV('难以归类','Hard to classify')+' <b>'+m.unsure+'</b></span></footer><p>'+(tasteMapMode==='community'?ppV('均分在 2.75–3.25 之间算难以归类，落在中线上。点击圆点查看影片。','Averages within 2.75–3.25 are hard to classify and sit on the midline. Tap a point to see the films.'):ppV('3 分是中间值，算难以归类，落在中线上；只评了一项的影片不上图。点击圆点查看影片。','A 3 is the middle value: hard to classify, plotted on the midline. Films rated on only one scale are not plotted. Tap a point to see the films.'))+(tasteMapMode==='community'?(()=>{const low=FILMS.filter(f=>{const a=TC.get(f.id);return a&&(a.funN||a.boreN)&&a.pairN<3;}).length;return low?' '+ppV(low+' 部影片样本不足 3 人，暂不上图。',low+' films have fewer than 3 paired ratings and are not plotted yet.'):'';})():'')+'</p><div class="taste-selected"></div>'+(tasteMapMode==='community'?'<p>'+(communityStatus==='error'?ppV('社区暂不可用，个人图谱不受影响。','Community unavailable. Your personal map is unaffected.'):ppV('每部影片至少 3 份双维评价才会进入社区图谱。','A film needs at least 3 paired ratings to enter the community map.'))+'</p>':'')+(!m.n?'<p>'+ppV('尚无符合条件的影片。个人图谱只需要本机评分；社区需要已公开的评价。','No eligible films yet. Your personal map uses local ratings; the community map uses published ratings.')+'</p>':'')+'</section>';}
function growthHTML(){const g=growthData();if(!g)return '';const en=LANG==='en',L=g.level,R=2*Math.PI*44;
  const ring='<svg class="gh-ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44"/><circle class="v" cx="50" cy="50" r="44" stroke-dasharray="'+(R*L.pct/100).toFixed(1)+' '+R.toFixed(1)+'" transform="rotate(-90 50 50)"/></svg>';
  const nb=g.nextBadge;
  const hero='<div class="gh"><div class="gh-top"><div class="gh-dial">'+ring+'<div class="gh-n"><b>'+g.n+'</b><small>'+ppV('部','films')+'</small></div></div><div class="gh-lv"><small>'+ppV('我的影迷等级','MY CINEPHILE LEVEL')+'</small><h3>'+(L.cur?esc(gNm(L.cur)):ppV('尚未入场','Not yet'))+'</h3>'+(L.cur&&!en?'<em>'+esc(L.cur.en)+'</em>':'')+
      '<p>'+(L.next?(g.n?ppV('再看 <b>'+L.left+'</b> 部，升为「'+L.next.zh+'」','<b>'+L.left+'</b> more to reach '+L.next.en):ppV('盖下第一枚印章，就此入场','Stamp your first film to begin')):ppV('已抵达最高等级','Highest level reached'))+'</p></div></div>'+
    '<div class="gh-stats"><span><b>'+g.festivals+'</b>'+ppV('影展','festivals')+'</span><span><b>'+g.cities+'</b>'+ppV('城市','cities')+'</span><span><b>'+g.hours+'</b>'+ppV('银幕小时','hours')+'</span><span><b>'+g.earned+'</b>'+ppV('枚纪念章','medals')+'</span></div></div>';
  const next=nb?'<div class="gn"><span class="gn-ic" style="--p:'+nb.pct+'"><i></i></span><div><small>'+ppV('下一枚','NEXT MEDAL')+' · '+esc(en?nb.groupEn:nb.groupZh)+'</small><b>'+esc(en?nb.en:nb.zh)+'</b><span>'+(nb.group==='collect'?ppV('还差 '+nb.left+'% 完成度',nb.left+'% to go'):nb.group==='daily'?ppV('单日再多看 '+nb.left+' 部','+'+nb.left+' more in one day'):ppV('还差 '+nb.left+nb.unit[0],nb.left+nb.unit[1]+' to go'))+'</span></div><em>'+nb.pct+'%</em></div>':'';
  const lo=Math.max(0,L.index-1),all=PP.lvAll,shown=all?g.levels:g.levels.slice(lo,lo+5);
  const ladder='<section class="gs"><div class="gs-h"><h3>'+ppV('影迷等级','Levels')+'</h3><span>'+ppV('按看过的不同影片数','by distinct films seen')+'</span></div><ol class="gl">'+shown.map(l=>'<li class="'+(l.current?'cur':l.earned?'on':l.next?'nx':'')+'"><i></i><b>'+gNm(l)+'</b><small>'+(en?'':l.en+' · ')+l.n+ppV(' 部',l.n===1?' film':' films')+'</small>'+(l.current?'<em>'+ppV('当前','NOW')+'</em>':l.next?'<em>'+ppV('下一级','NEXT')+'</em>':'')+'</li>').join('')+'</ol>'+
    '<button class="text-button gl-more" data-pp="lv-all">'+(all?ppV('收起','Collapse'):ppV('查看全部 '+g.levels.length+' 个等级 · 最高 10000 部','All '+g.levels.length+' levels · up to 10,000 films'))+'</button></section>';
  const cities='<section class="gs"><div class="gs-h"><h3>'+ppV('全球足迹','Footprints')+'</h3><span>'+ppV(g.countries+' 个国家 / 地区 · '+g.continents+' 个大洲',g.countries+' countries / regions · '+g.continents+' continents')+'</span></div>'+
    (g.cityCards.length?'<div class="gc">'+(PP.cAll?g.cityCards:g.cityCards.slice(0,4)).map(c=>'<article class="gc-card"><header><div><b>'+esc(en?c.en:c.name)+'</b><small>'+esc(en?c.countryEn:c.country)+'</small></div><span><b>'+c.n+'</b>'+ppV('部','films')+'</span></header>'+c.progs.map(p=>'<div class="gc-bar"><span>'+esc(en&&p.en?p.en:p.name)+'</span><i style="--w:'+p.pct+'%"></i><em>'+p.seen+'/'+p.total+'</em></div>').join('')+'</article>').join('')+'</div>'
      :'<p class="gs-empty">'+ppV('看过的影片落在哪座城市，这里就会点亮一座城市。','Cities light up here as you stamp films screened in them.')+'</p>')+(g.cityCards.length>4?'<button class="text-button gl-more" data-pp="c-all">'+(PP.cAll?ppV('收起','Collapse'):ppV('查看全部 '+g.cityCards.length+' 座城市','All '+g.cityCards.length+' cities'))+'</button>':'')+'</section>';
  const CATS=G_CATS(),openG=PP.gOpen||new Set([nb&&nb.group!=='level'?nb.group:g.groups[0].id]);
  const dots=gr=>gr.kind==='set'?gr.items.filter(i=>i.earned).slice(0,8).map(()=>'<i class="on"></i>').join('')+(gr.items.some(i=>!i.earned)?'<i></i>':''):gr.tiers.map(t=>'<i class="'+(t.earned?'on':t.next?'nx':'')+'"></i>').join('');
  const body=gr=>gr.kind==='set'?'<div class="gg-b"><div class="gg-r">'+esc(en?gr.rule[1]:gr.rule[0])+'</div><ul class="gm-row gm-set">'+gr.items.map((it,k)=>'<li class="gm gm-i '+(it.earned?'on':'far')+'" style="--p:'+(it.earned?100:0)+';--i:'+k+'" title="'+esc(gNm(it))+'"><span class="gm-disc"><b>'+it.ic+'</b></span><small>'+esc(gNm(it))+'</small></li>').join('')+'</ul></div>'
    :'<div class="gg-b"><div class="gg-r">'+esc(en?gr.rule[1]:gr.rule[0])+'</div><div class="gg-v mono">'+gr.value+(gr.id==='collect'?'':' ')+esc(en?gr.unit[1]:gr.unit[0])+'</div><ul class="gm-row">'+gr.tiers.map((t,k)=>gMedal(t,gr.id==='collect',t.earned?'on':t.next?'next':'far',k)).join('')+'</ul></div>';
  const grp=gr=>{const op=openG.has(gr.id);return '<div class="gg'+(op?' open':'')+'"><button class="gg-h" data-pp="g-tog" data-g="'+gr.id+'" aria-expanded="'+op+'"><b>'+esc(gNm(gr))+'</b><span class="gg-dots" aria-hidden="true">'+dots(gr)+'</span><span class="gg-c mono">'+gr.earned+'/'+gr.total+'</span><em aria-hidden="true">›</em></button>'+(op?body(gr):'')+'</div>';};
  const catOf=id=>(g.groups.find(x=>x.id===id)||{}).cat,cs=CATS.filter(c=>g.groups.some(x=>x.cat===c.id)),cstat=c=>{const gs=g.groups.filter(x=>x.cat===c.id);return [gs.reduce((a,x)=>a+x.earned,0),gs.reduce((a,x)=>a+x.total,0)];};
  const curCat=cs.some(c=>c.id===PP.mc)?PP.mc:(nb&&nb.kind==='badge'&&catOf(nb.group))||cs.slice().sort((a,b)=>cstat(b)[0]-cstat(a)[0])[0].id;
  const badges='<section class="gs"><div class="gs-h"><h3>'+ppV('纪念章','Medals')+'</h3><span>'+g.earned+' / '+g.total+'</span></div><div class="mc" role="tablist">'+cs.map(c=>{const st=cstat(c);return '<button role="tab" aria-selected="'+(c.id===curCat)+'" data-pp="mc" data-c="'+c.id+'">'+esc(gNm(c))+'<small>'+st[0]+'/'+st[1]+'</small></button>';}).join('')+'</div>'+g.groups.filter(x=>x.cat===curCat).map(grp).join('')+'</section>';
  const subs=[['level',ppV('等级','Levels'),(L.cur?L.index+1:0)+'/'+g.levels.length],['trail',ppV('足迹','Footprints'),g.cities],['medals',ppV('纪念章','Medals'),g.earned+'/'+g.total]];
  const subnav='<div class="gt" role="tablist">'+subs.map(x=>'<button role="tab" aria-selected="'+(PP.gt===x[0])+'" data-pp="gt" data-t="'+x[0]+'">'+x[1]+'<small>'+x[2]+'</small></button>').join('')+'</div>';
  return '<div class="fp-growth">'+hero+next+subnav+(PP.gt==='trail'?cities:PP.gt==='medals'?badges:ladder)+'</div>';}
function passportHTML(){const C=ppCur(),list=C.list,pages=passportPages(list),n=pages.length;PP.page=Math.min(PP.page,n-1);const st=passportStats(C.all);
  const cover='<button type="button" class="fp-cover" data-cv="'+((C.vol-1)%5+1)+'" data-pp="open" aria-label="翻开我的观影护照"><span class="fp-cb"></span><span class="fp-edition"><span>SPARROW CINEMA</span><span>VOL. '+pad2(C.vol)+'</span></span><span class="fp-name">'+(LANG==='en'?'PERSONAL EDITION':'观影护照')+'</span><span class="fp-nen">FILM<br>PASSPORT</span><img class="fp-cover-art" src="brand/passport-aperture.svg" alt="" aria-hidden="true"><span class="fp-cover-rule"></span><span class="fp-cover-bottom"><span>ONE FILM<br>ONE STAMP</span><span class="fp-open-icon" aria-hidden="true">↗</span></span><span class="fp-publishers">麻雀映画 × 麻雀部落</span></button>';
  const tallies='<div class="fp-tallies"><span><b>'+st.n+'</b>看过影片</span><span><b>'+st.progs+'</b>专题</span><span><b>'+st.venues+'</b>影院</span><span><b>'+(st.avg?st.avg.toFixed(1):'—')+'</b>平均评分</span></div>';
  return '<section class="fp" id="fp"><div class="fp-heading"><small>YOUR LIFE IN CINEMA</small><h2>我的观影护照</h2><p>把每一次银幕相遇，收进自己的电影档案。</p></div>'+
    '<div class="fp-tabs" role="tablist"><button role="tab" aria-selected="'+(PP.tab!=='growth')+'" data-pp="tab" data-t="stamps">'+ppV('签章','Stamps')+'</button><button role="tab" aria-selected="'+(PP.tab==='growth')+'" data-pp="tab" data-t="growth">'+ppV('成长','Growth')+'</button></div>'+
    (PP.tab==='growth'?growthHTML():PP.shelf?ppShelfHTML(C):PP.open?bookHTML(list,n)+'<div class="fp-close-row"><span>'+ppV('左右滑动翻页','Swipe to turn pages')+'</span><span>'+(C.nv>1?'<button class="text-button" data-pp="shelf">'+ppV('书架','Shelf')+' · '+C.nv+ppV(' 册',' vols')+'</button> ':'')+'<button class="text-button" data-pp="close">合上护照</button></span></div>'
      :'<div class="fp-collection"><div class="fp-cover-stage">'+cover+'<p class="fp-cap">'+(C.nv>1?ppV('第 '+C.vol+' 册 · 共 '+C.nv+' 册 · ','Vol. '+C.vol+' of '+C.nv+' · '):'')+'轻触封面，翻开你的银幕旅程 ↗</p></div><div class="fp-collection-copy"><span class="fp-archive-label">A PERSONAL FILM ARCHIVE</span><h3>每一场，<br>都值得留下。</h3><p>看过、评分、盖章。<br>让喜欢的电影，成为你的独家收藏。</p>'+tallies+'<button class="fp-explore" data-library-mine="watched">查看我的已看影片 <span>↗</span></button>'+(C.nv>1?'<button class="fp-explore" data-pp="shelf">'+ppV('护照书架 · 共 '+C.nv+' 册','Passport shelf · '+C.nv+' volumes')+' <span>↗</span></button>':'')+'</div></div>')+
    '<button class="fp-recap" data-pp="recap"><span class="recap-emblem" aria-hidden="true">'+PP_EMBLEM+'</span><span class="recap-copy"><small>我的银幕足迹</small><b>生成我的影院观影结算</b><span>按年份与专题，收藏印章与评分。</span></span><i aria-hidden="true">↗</i></button>'+
    '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="pp-ink" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.1" result="d"/><feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="3" seed="11" result="b"/><feColorMatrix in="b" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -2.2 2.05" result="m"/><feComposite in="d" in2="m" operator="in"/></filter></svg></section>';}
function sizeBook(){const b=document.querySelector('.fp-book,.fp-cover');if(!b)return;const set=el=>el.style.setProperty('--u',(el.clientWidth/(el.classList.contains('fp-spread')?200:100))+'px');document.querySelectorAll('.fp-book,.fp-cover').forEach(set);}
let ppWasSpread=ppSpread();
window.addEventListener('resize',()=>{if(PP.open&&ppSpread()!==ppWasSpread&&document.getElementById('fp'))renderPassport();ppWasSpread=ppSpread();sizeBook();});
function renderPassport(){const el=document.getElementById('fp');if(!el)return;el.outerHTML=passportHTML();sizeBook();}

// 影片页「已盖章」：跳到「我的」，展开护照并翻到这部电影印章所在的那一页，印章闪一下
function ppJump(id){const all=watchEntries(),k=all.findIndex(e=>e.id===id);if(k<0){go('my');return;}
  PP.vol=Math.floor(k/PP_VOL)+1;PP.page=1+Math.floor((k%PP_VOL)/PP_PER);PP.open=true;PP.shelf=false;PP.tab='stamps';
  const t0=Date.now(),find=()=>{const d=document.querySelector('details.passport-collection'),fp=document.getElementById('fp');
    if(!d||!fp){if(Date.now()-t0<2500)requestAnimationFrame(find);return;}
    if(!d.open){d.open=true;}renderPassport();
    requestAnimationFrame(()=>{const st=document.querySelector('.fp-stamp[data-film="'+CSS.escape(id)+'"]'),box=document.getElementById('fp');
      (st||box).scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
      if(st){st.classList.remove('fp-hit');void st.offsetWidth;st.classList.add('fp-hit');}});};
  if(activeRoute==='my')find();else{go('my');requestAnimationFrame(find);}}
document.addEventListener('click',e=>{const j=e.target.closest('[data-pp-jump]');if(j){e.preventDefault();ppJump(j.dataset.ppJump);}});
function turnPassport(action){if(action==='next'||action==='prev'){ppCurlAuto(action==='next'?1:-1);return;}if(PP.busy)return;const root=document.getElementById('fp');if(!root)return;
  const list=ppCur().list,n=passportPages(list).length,sp=ppSpread(),oldPages=[...root.querySelectorAll('.fp-book>.fp-page')],oldPage=oldPages[0],oldCover=root.querySelector('.fp-cover');
  if(action==='open'){PP.open=true;PP.page=0;}else if(action==='close'){PP.open=false;PP.vol=0;}
  else{const base=sp?PP.page-PP.page%2:PP.page,next=base+(action==='next'?(sp?2:1):-(sp?2:1));if(next<0||next>n-1)return;PP.page=next;}
  const oldClones=oldPages.map(x=>x.cloneNode(true)),coverClone=oldCover&&oldCover.cloneNode(true);
  const front=(action==='open'?oldCover:action==='next'?oldPage:null);const frontClone=front&&front.cloneNode(true);
  renderPassport();if(action==='close')return;
  const book=document.querySelector('#fp .fp-book');if(!book||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const leaf=document.createElement('div');leaf.className='fp-leaf';leaf.setAttribute('aria-hidden','true');leaf.inert=true;
  const f=document.createElement('div'),b=document.createElement('div');f.className='fp-leaf-f';b.className='fp-leaf-b';
  const rev=action==='prev';
  if(book.classList.contains('fp-spread')){ // 双页：右页整页翻向左侧（向后翻）或左页翻回右侧（向前翻）
    const L=book.querySelector('.fp-left'),Rg=book.querySelector('.fp-right'),ghost=[];
    if(action==='open'){if(coverClone){coverClone.style.setProperty('--u',book.style.getPropertyValue('--u'));f.append(coverClone);}if(L)L.animate([{opacity:0},{opacity:0,offset:.5},{opacity:1}],{duration:620});b.append(L.cloneNode(true));}
    else if(rev){f.append(Rg.cloneNode(true));if(oldClones[0])b.append(oldClones[0]);if(oldClones[1]){oldClones[1].classList.add('fp-ghost');ghost.push(oldClones[1]);}}
    else{if(oldClones[1])f.append(oldClones[1]);b.append(L.cloneNode(true));if(oldClones[0]){oldClones[0].classList.add('fp-ghost');ghost.push(oldClones[0]);}}
    b.classList.add('pg');leaf.append(f,b);ghost.forEach(g=>book.append(g));book.append(leaf);PP.busy=true;
    const an=leaf.animate([{transform:'rotateY('+(rev?-180:0)+'deg)'},{transform:'rotateY('+(rev?0:-180)+'deg)'}],{duration:640,easing:'cubic-bezier(.22,.7,.25,1)',fill:'forwards'});
    const done=()=>{leaf.remove();ghost.forEach(g=>g.remove());PP.busy=false;};an.finished.then(done,done);return;}
  if(action==='prev'){f.append(book.querySelector('.fp-page').cloneNode(true));}else if(frontClone){f.append(frontClone);}
  b.innerHTML='<span>SPARROW FILM PASSPORT</span>';leaf.append(f,b);book.append(leaf);PP.busy=true;
  const an=leaf.animate([{transform:'rotateY('+(rev?-180:0)+'deg)'},{transform:'rotateY('+(rev?0:-180)+'deg)'}],{duration:620,easing:'cubic-bezier(.22,.7,.25,1)',fill:'forwards'});
  const done=()=>{leaf.remove();PP.busy=false;};an.finished.then(done,done);}
let ppGesture=null,ppSuppress=0;
document.addEventListener('touchstart',e=>{ppGesture=null;if(e.touches.length!==1||!e.target.closest('#fp .fp-cover')||e.target.closest('#fp .fp-book'))return;ppGesture={x:e.touches[0].clientX,y:e.touches[0].clientY};},{passive:true});
document.addEventListener('touchend',e=>{if(!ppGesture)return;const dx=e.changedTouches[0].clientX-ppGesture.x,dy=e.changedTouches[0].clientY-ppGesture.y;ppGesture=null;if(Math.abs(dx)<40||Math.abs(dx)<Math.abs(dy)*1.3)return;ppSuppress=performance.now()+400;turnPassport(PP.open?(dx<0?'next':'prev'):'open');},{passive:true});
// —— 翻页卷曲（2026-11-18）：跟手拖动或点按钮，纸页沿折痕卷起；只在护照书页范围内显示 ——
// 单页：当前页卷起，背面是纸（透出一点正面），下面是下一页；向前翻是上一页从左边卷回来。
// 双页：右页翻向左边，背面就是下一跨页的左页（真实印章）；向前翻是左页从左外角卷向右边，背面是上一跨页的右页。
const PC={t:null,anim:0,drag:null};
const ppReduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function ppCurlStart(dir,cy0){const root=document.getElementById('fp'),book=root&&root.querySelector('.fp-book');if(!book||PP.busy||PC.t||!window.SparrowCurl)return null;
  const list=ppCur().list,n=passportPages(list).length,sp=book.classList.contains('fp-spread'),base=sp?PP.page-PP.page%2:PP.page,next=base+dir*(sp?2:1);if(next<0||next>n-1)return null;
  const BW=book.clientWidth,H=book.clientHeight,W=sp?BW/2:BW;if(!W||!H)return null;
  const keep=PP.page;PP.page=next;const tmp=document.createElement('div');tmp.innerHTML=bookHTML(list,n);PP.page=keep;const nb=tmp.querySelector('.fp-book');
  const q=(b,c)=>b.querySelector(c),clone=el=>el.cloneNode(true);let cur,under,back,mirror=false,x0=0;
  const paper=src=>{const d=document.createElement('div');d.className='fc-paper';const g=clone(src);g.classList.add('fc-ghost');d.append(g);return d;}; // 纸背透出一点正面（左右相反）
  const flip=el=>{const d=document.createElement('div');d.className='fc-in';d.append(el);return d;}; // 背面内容先左右翻转，镜像后才是正的
  if(sp){if(dir>0){x0=W;cur=clone(q(book,'.fp-right'));under=q(nb,'.fp-right');back=flip(q(nb,'.fp-left'));}
    else{mirror=true;cur=clone(q(book,'.fp-left'));under=q(nb,'.fp-left');back=flip(q(nb,'.fp-right'));}}
  else{const pg=q(book,'.fp-page'),np=q(nb,'.fp-page');if(dir>0){cur=clone(pg);under=np;back=paper(pg);}else{cur=np;under=clone(pg);back=paper(np);}}
  const ov=document.createElement('div');ov.className='fp-curl';ov.setAttribute('aria-hidden','true');ov.inert=true;
  const reg=document.createElement('div');reg.className='fc-r';reg.style.left=x0+'px';reg.style.width=W+'px';ov.append(reg);
  const sh=()=>{const i=document.createElement('i');i.className='fc-sh';return i;};
  const lay=(c,el)=>{const d=document.createElement('div');d.className='fc-l '+c;d.append(el);const s=sh();d.append(s);reg.append(d);return [d,s];};
  const [U,ush]=lay('fc-under',under),[Cu,csh]=lay('fc-cur',cur),[F,fsh]=lay('fc-flap',back);
  book.append(ov);PP.busy=true;
  const cy=cy0<H/2?0:H,rev=!sp&&dir<0; // rev：单页向前翻，上一页从左边（已翻过去的位置）卷回来
  PC.t={dir,next,W,H,cy,mirror,rev,x0,ov,cur:Cu,flap:F,ush,csh,fsh,book,P:rev?{x:-W,y:cy}:{x:W,y:cy}};
  ppCurlRender();return PC.t;}
function ppCurlRender(){const t=PC.t;if(!t)return;const r=SparrowCurl.fold({W:t.W,H:t.H,cx:t.W,cy:t.cy,px:t.P.x,py:t.P.y,mirror:t.mirror});t.Pc={x:r.px,y:r.py};
  if(r.none){t.cur.style.clipPath='none';t.flap.style.display=t.ush.style.display=t.csh.style.display=t.fsh.style.display='none';return;}
  const put=(el,s)=>{el.style.display='block';el.style.width=el.style.height=s.size+'px';el.style.transform=s.t;el.style.background=s.bg;};
  t.cur.style.clipPath=r.front;t.flap.style.display='block';t.flap.style.clipPath=r.flapClip;t.flap.style.transform=r.flapT;
  put(t.fsh,r.fshade);put(t.csh,r.cshade);put(t.ush,r.ushade);}
function ppCurlTo(target,commit,lift){const t=PC.t;if(!t)return;cancelAnimationFrame(PC.anim);
  const end=()=>{cancelAnimationFrame(PC.anim);PC.t=null;PP.busy=false;if(commit){PP.page=t.next;renderPassport();const nb=document.querySelector('#fp .fp-book');if(nb)nb.classList.add('fp-still');}else t.ov.remove();}; // 翻页时已经看到整页印章，翻完不再重放盖章动画
  if(ppReduce())return end();
  const from=t.Pc||t.P,t0=performance.now(),dur=520*(lift?1.15:1);
  const step=now=>{const k=Math.min(1,(now-t0)/dur);t.P=SparrowCurl.path(k,from.x,from.y,target.x,target.y,t.H,lift);ppCurlRender();if(k<1)PC.anim=requestAnimationFrame(step);else end();};
  PC.anim=requestAnimationFrame(step);}
function ppCurlAuto(dir){if(ppReduce()){const book=document.querySelector('#fp .fp-book');if(!book)return;const list=ppCur().list,n=passportPages(list).length,sp=book.classList.contains('fp-spread'),base=sp?PP.page-PP.page%2:PP.page,next=base+dir*(sp?2:1);if(next<0||next>n-1)return;PP.page=next;renderPassport();return;}
  const book=document.querySelector('#fp .fp-book');if(!book)return;const t=ppCurlStart(dir,book.clientHeight*.92);if(!t)return;
  // 按钮：页角沿一条略抬起的弧线翻过去
  ppCurlTo(t.rev?{x:t.W,y:t.cy}:{x:-t.W,y:t.cy},true,t.cy>0?.16:-.16);}
// 拖动：横向移动超过 6px 才开始翻页，竖向滑动照常滚动页面（.fp-book 设了 touch-action:pan-y），轻点不翻页（留给印章）
function ppCurlLocal(e){const t=PC.t,r=t.book.getBoundingClientRect();let x=e.clientX-r.left-t.x0;if(t.mirror)x=t.W-x;return {x,y:e.clientY-r.top};}
document.addEventListener('pointerdown',e=>{if(!e.isPrimary||e.button>0||PC.t||PP.busy)return;const book=e.target.closest('#fp .fp-book');if(!book)return;
  PC.drag={id:e.pointerId,sx:e.clientX,sy:e.clientY,moved:false,book};});
document.addEventListener('pointermove',e=>{const d=PC.drag;if(!d||e.pointerId!==d.id)return;
  if(!d.moved){const dx=e.clientX-d.sx,dy=e.clientY-d.sy;if(Math.abs(dx)<7||Math.abs(dx)<Math.abs(dy)*1.2){if(Math.abs(dy)>12)PC.drag=null;return;}
    const r=d.book.getBoundingClientRect(),t=ppCurlStart(dx<0?1:-1,d.sy-r.top);if(!t){PC.drag=null;return;}
    d.moved=true;try{d.book.setPointerCapture(e.pointerId);}catch(_){}
    const s=ppCurlLocal({clientX:d.sx,clientY:d.sy});d.x0=s.x;d.y0=s.y;d.lx=s.x;d.vx=0;}
  const t=PC.t;if(!t)return;e.preventDefault();const p=ppCurlLocal(e);
  // 向后翻：页角跟着手指（加上按下时离角的距离）；单页向前翻：手指直接把上一页从左边带回来
  t.P=t.rev?{x:p.x,y:p.y+(t.cy-d.y0)*.6}:{x:p.x+(t.W-d.x0),y:p.y+(t.cy-d.y0)*.6};
  d.vx=p.x-d.lx;d.lx=p.x;cancelAnimationFrame(PC.anim);PC.anim=requestAnimationFrame(ppCurlRender);});
const ppCurlUp=e=>{const d=PC.drag;if(!d||e.pointerId!==d.id)return;PC.drag=null;if(!d.moved||!PC.t)return;ppSuppress=performance.now()+400;
  const t=PC.t,P=t.Pc||t.P,cancel=e.type==='pointercancel';
  if(!t.rev){const go=!cancel&&(P.x<t.W*.55||d.vx<-6);ppCurlTo(go?{x:-t.W,y:t.cy}:{x:t.W,y:t.cy},go);}
  else{const go=!cancel&&(P.x>t.W*.45||d.vx>6);ppCurlTo(go?{x:t.W,y:t.cy}:{x:-t.W,y:t.cy},go);}};
document.addEventListener('pointerup',ppCurlUp);document.addEventListener('pointercancel',ppCurlUp);
// 拖完松手时不要顺带点开印章
document.addEventListener('click',e=>{if(performance.now()<ppSuppress&&e.target.closest('#fp')){e.preventDefault();e.stopPropagation();}},true);

// —— 看过 / 打分 / 护照按钮 ——
document.addEventListener('click',e=>{
  const wb=e.target.closest('[data-want]');
  if(wb){const id=wb.dataset.want,on=!isWant(id);setWant(id,on);if(on)stat('want',id);toast(on?tr('已加入想看 · 有新场次时会在片目标出'):tr('已移出想看'));refreshMyRate(id);return;}
  const wl=e.target.closest('[data-want-list]');
  if(wl){fmine='want';ffilt=fcity=fyear=freg=flen='all';fq='';if(location.hash==='#films')films();else location.hash='films';return;}
  const sv=e.target.closest('[data-seen]');
  if(sv){const id=sv.dataset.seen;if(!(watched[id]&&watched[id].d))stat('watched',id);if(watched[id]&&watched[id].d){if(!confirm(tr('移出观影护照？这部电影的印章和评分会一起删除。')))return;unstamp(id);return;}else{watched[id]=Object.assign({r:0,t:Date.now()},watchGuess(id));saveWatched();toast('已盖章 · 加入观影护照');}refreshMyRate(id);return;}
  const taste=e.target.closest('[data-taste]');if(taste){const id=taste.dataset.taste,k=taste.dataset.key,v=+taste.dataset.value,rec=watched[id];if(rec&&rec.d&&['fun','bore'].includes(k)&&window.SparrowTaste.valid(v)){watched[id]=window.SparrowTaste.toggle(rec,k,v);saveWatched();refreshMyRate(id);}return;}
  const rt=e.target.closest('[data-rate]');
  if(rt){const id=rt.dataset.rate,v=+rt.dataset.v,isNew=!(watched[id]&&watched[id].d);if(isNew)watched[id]=Object.assign({r:0},watchGuess(id));{const G=window.SparrowGrowth,vs=G.views(watched[id]);if(vs.length>1){vs[vs.length-1].r=vs[vs.length-1].r===v?0:v;watched[id].v=vs;G.normRec(watched[id]);}else watched[id].r=watched[id].r===v?0:v;}watched[id].t=Date.now();saveWatched();if(isNew)toast('已盖章 · 加入观影护照');refreshMyRate(id);return;}
  const pp=e.target.closest('[data-pp]');
  if(pp){if(performance.now()<ppSuppress){e.preventDefault();return;}const a=pp.dataset.pp;
    if(a==='recap'){openRecap();return;}
    if(a==='tab'){PP.tab=pp.dataset.t==='growth'?'growth':'stamps';renderPassport();return;}
    if(a==='gt'){PP.gt=pp.dataset.t;renderPassport();return;}
    if(a==='c-all'){PP.cAll=!PP.cAll;renderPassport();return;}
    if(a==='mc'){PP.mc=pp.dataset.c;renderPassport();return;}
    if(a==='g-tog'){const nbg=(growthData()||{}).nextBadge,cur=PP.gOpen||new Set([nbg&&nbg.group!=='level'?nbg.group:'festivals']);cur.has(pp.dataset.g)?cur.delete(pp.dataset.g):cur.add(pp.dataset.g);PP.gOpen=cur;renderPassport();return;}
    if(a==='lv-all'){PP.lvAll=!PP.lvAll;renderPassport();return;}
    if(a==='shelf'){PP.open=false;PP.shelf=true;renderPassport();return;}
    if(a==='shelf-close'){PP.shelf=false;PP.vol=0;renderPassport();return;}
    if(a==='vol'){PP.vol=+pp.dataset.v||0;PP.shelf=false;PP.open=true;PP.page=0;renderPassport();return;}
    if(a==='photo-clear'){try{localStorage.removeItem(PHOTO_KEY);touchMeta('photo');}catch{}renderPassport();return;}
    if(a==='photo'){pickPhoto();return;}
    if(a==='name'){const v=prompt(tr('护照持有人（显示在资料页）'),holderName());if(v!=null){try{localStorage.setItem(HOLDER_KEY,v.trim().slice(0,20));touchMeta('holder');}catch{}renderPassport();}return;}
    turnPassport(a);}
});
document.addEventListener('click',e=>{const o=e.target.closest('input.mr-ov[type=date]');if(o&&o.showPicker){try{o.showPicker();}catch{}}});


// —— 护照持有人照片：从相册选择，裁成 3:4 小图存在本机 ——
function pickPhoto(){const inp=document.createElement('input');inp.type='file';inp.accept='image/*';inp.style.display='none';
  inp.onchange=async()=>{const f=inp.files&&inp.files[0];inp.remove();if(!f)return;
    try{let bmp;try{bmp=await createImageBitmap(f,{imageOrientation:'from-image'});}catch{bmp=await new Promise((ok,no)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=no;im.src=URL.createObjectURL(f);});}
      const W=300,H=400,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d'),sw=bmp.width,sh=bmp.height,k=Math.max(W/sw,H/sh),dw=sw*k,dh=sh*k;x.drawImage(bmp,(W-dw)/2,(H-dh)/2,dw,dh);
      localStorage.setItem(PHOTO_KEY,c.toDataURL('image/jpeg',.82));touchMeta('photo');renderPassport();toast('照片已放进护照');}
    catch{toast('照片添加失败，请换一张再试');}};
  document.body.appendChild(inp);inp.click();}
