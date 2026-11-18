/* js/film-detail.js — 影片详情页：荣誉、外链、评分、放映场次与筛选、购票码。
   网站脚本按功能拆成 js/*.js，按 index.html 里的顺序加载；部署时 tools/build-assets.js 按同样顺序合并成一个 app.js。 */

function honorHTML(x){const i=x.indexOf("｜");const t=i>0?x.slice(0,i):"",rest=i>0?x.slice(i+1):x;const m=rest.match(/^(\d{4})\s*(.*)$/);const yr=m?m[1]:"",body=m?m[2]:rest;const cls=t==="获奖"?"win":t==="提名"?"nom":/评选|入选/.test(t)?"list":"sel";const parts=body.split(" · ");return `<li class="fd-honor ${cls}"><span class="fd-ht">${esc(t||"荣誉")}</span><span class="fd-hy">${esc(yr)}</span><span class="fd-hb"><b>${esc(parts[0])}</b>${parts.length>1?`<small>${esc(parts.slice(1).join(" · "))}</small>`:""}</span></li>`;}
const EXT_ARROW='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>';
function extLinksHTML(f){const l=f.links||{},en=encodeURIComponent(f.en||f.o||f.cnZh||f.cn),zh=encodeURIComponent(f.cnZh||f.cn),y=f.y?" "+f.y:"";
  const items=[["Letterboxd",l.lb?`https://letterboxd.com/film/${l.lb}/`:l.imdb?`https://letterboxd.com/imdb/${l.imdb}`:`https://letterboxd.com/search/films/${en}${encodeURIComponent(y)}/`,!!(l.lb||l.imdb),"在 Letterboxd 上查看"],
    ["IMDb",l.imdb?`https://www.imdb.com/title/${l.imdb}/`:`https://www.imdb.com/find/?q=${en}${encodeURIComponent(y)}&s=tt`,!!l.imdb,"在 IMDb 上查看"],
    ["豆瓣",l.douban?`https://movie.douban.com/subject/${l.douban}/`:`https://search.douban.com/movie/subject_search?search_text=${zh}`,!!l.douban,"在豆瓣上查看"]];
  return `<nav class="fd-ext" aria-label="外部评分与影评">${items.map(([n,u,exact,lab])=>`<a class="fd-extl" href="${u}" target="_blank" rel="noopener noreferrer"${exact?"":' title="打开该站搜索结果"'}><span>${lab}</span>${EXT_ARROW}</a>`).join("")}</nav>`;}
function noticeHTML(f){const ws=f.warnings||[],r=f.contentReview||{};return `<section class="fd-block fd-notes"><h3 class="fd-h">内容提示 <small>CONTENT NOTES</small></h3><div class="fd-content-card"><p class="fd-content-summary">${ws.length?ws.map(esc).join(' · '):tr('现有资料未确认特别提示内容。')}</p><details class="fd-notice-scope"><summary>提示说明</summary><p>${esc(f.contentNote||tr('具体内容尚待核实，不代表没有敏感内容或适合所有年龄。'))}</p><p>${r.sensory==='flashing'?tr('已查到闪烁影像提示；光敏观众请谨慎选择。'):tr('闪烁与突发音量尚未核实；有需要请提前询问影院。')}${tr('提示可能涉及轻微剧透，不是官方分级。')}</p></details></div></section>`;}
function ratingsHTML(f){if(!(f.r||[]).length)return "";const R=[["豆瓣",10],["IMDb",10],["烂番茄",100],["MTC",100],["Letterboxd",5]];return `<div class="fd-ratings">${f.r.map((v,i)=>{const na=v==null;const shown=na?"—":i===2?v+"%":i===4?v.toFixed(1):(i<2?Number(v).toFixed(1):v);const pct=na?0:Math.max(0,Math.min(100,v/R[i][1]*100));return `<div class="fd-rt${na?" na":""}"><span class="fd-rl">${R[i][0]}</span><b aria-label="${R[i][0]} ${na?"暂无评分":shown}">${shown}</b><span class="fd-rbar"><i style="width:${pct}%"></i></span></div>`;}).join("")}</div>`;}
function giftsHTML(f){const g=f.gifts||[];return `<section class="fd-block fd-gifts"><h3 class="fd-h">伴手礼周边 <small>${g.length?"GIFTS":"待公布"}</small></h3>${g.length?g.map(x=>`<div class="fd-gift">${x.label?`<b class="fd-gl">${esc(x.label)}</b>`:""}<ul>${x.items.map(i=>`<li>${esc(i)}</li>`).join("")}</ul></div>`).join("")+`<p class="fd-gnote">数量有限，以影院现场发放为准。</p>`:`<div class="fd-noshow"><b>伴手礼信息待公布</b><span>公布后会更新到这里。</span></div>`}</section>`;}
function qaPanelHTML(f){const ready=!!(f.qaStart&&f.qaEnd&&f.qaGuest);return `<section class="fd-block fd-qa-section"><h3 class="fd-h">映后交流 <small>POST-SCREENING</small></h3><div class="fd-qa-panel${ready?"":" fd-qa-empty"}"><div class="fd-qa-panel-head"><span class="fd-qa-label">✦ ${ready?"映后交流 · DIRECTOR Q&A":"映后信息"}</span>${ready?`<b class="fd-qa-time">${esc(f.qaStart)} – ${esc(f.qaEnd)}</b>`:""}</div><div class="fd-qa-panel-body">${ready?esc(f.qaGuest):Object.values(f.screeningNotes||{}).some(x=>x.includes("映后"))?"映后活动安排见各场次备注，嘉宾以实际到场为准。":"暂无映后交流安排"}</div></div></section>`;}
function pastRowHTML(s,f){const [m,d]=s.d.split("/"),v=VN[s.v]||{},h=(v.halls||[]).find(x=>x.id===s.h),date=`${showDate(s).getFullYear()}.${m.padStart(2,"0")}.${d.padStart(2,"0")}`,place=[v.city?tr(v.city):"",stripCity(v.short||v.brand||v.name||"",v),h?hShort(h):""].filter(Boolean).join(" · "),time=s.t,programme=PG[s.p||f.prog]?.name||"",label=[place,programme].filter(Boolean).join(" · ");return `<div class="fd-prow" title="${esc(date+" "+time+" "+label)}"><span class="fd-pd">${date}</span><span class="fd-pt">${time}</span><span class="fd-pp">${esc(label)}</span></div>`;}
function pastShowsHTML(allShows,f,hasUp){const L=allShows.filter(s=>isPast(s)&&keepPast(PG[s.p])).sort((a,b)=>showDate(a)-showDate(b));if(!L.length)return "";return `<details class="fd-past"${hasUp?"":" open"}><summary>已放映 ${L.length} 场 <i>▾</i></summary>${L.map(s=>pastRowHTML(s,f)).join("")}</details>`;}
/* 院线片的影片页：放映场次可按日期、影院多选筛选（只影响本页显示；换一部影片自动清空） */
let FSF={id:'',d:[],v:[]};
const isCinemaFilm=f=>filmProgsOf(f).some(x=>x.p&&x.p.kind==='院线')||SH.some(x=>x.id===f.id&&PG[x.p]&&PG[x.p].kind==='院线');
function sfState(f){if(FSF.id!==f.id)FSF={id:f.id,d:[],v:[]};return FSF;}
function sfApply(f,shows){const st=sfState(f);return shows.filter(x=>(!st.d.length||st.d.includes(x.d))&&(!st.v.length||st.v.includes(x.v)));}
function showCountText(f,shows){const n=sfApply(f,shows).length;return n===shows.length?tr(shows.length+" 场"):tr(n+" / "+shows.length+" 场");}
function showListHTML(f,shows){const list=sfApply(f,shows);return list.length?list.map(x=>screeningHTML(x,f)).join(""):`<div class="fd-noshow"><b>${tr("所选日期和影院暂无场次")}</b><span><button type="button" class="text-button" data-sf="reset">${tr("清除筛选")}</button></span></div>`;}
function sfVenueName(id,cities){const v=VN[id]||{};const n=stripCity(v.short||v.brand||v.name||id,v);return cities.size>1&&v.city?tr(v.city)+" · "+n:n;}
function sfDims(f,shows){const dates=[...new Set(shows.map(x=>x.d))],vs=VENUES.map(v=>v.id).filter(id=>shows.some(x=>x.v===id));return {dates,vs,cities:new Set(vs.map(v=>VN[v]&&VN[v].city))};}
function showFilterHTML(f,shows){
 if(!isCinemaFilm(f))return "";const st=sfState(f),{dates,vs,cities}=sfDims(f,shows);if(dates.length<2&&vs.length<2)return "";
 const dl=d=>{const x=shows.find(y=>y.d===d);return d+" "+tr(WK[showDate(x).getDay()]);};
 const sum=(sel,all,lab,unit)=>!sel.length?tr(all):sel.length===1?lab(sel[0]):lab(sel[0])+(LANG==="en"?" +"+(sel.length-1):" 等 "+sel.length+" "+unit);
 const cells=[];if(dates.length>1)cells.push(["date","放映日期",sum(st.d,"全部日期",dl,"天"),st.d.length]);if(vs.length>1)cells.push(["venue","影院",sum(st.v,"全部影院",v=>sfVenueName(v,cities),"家"),st.v.length]);
 const n=sfApply(f,shows).length,on=st.d.length+st.v.length>0;
 return `<div class="fd-sf" data-sf-film="${esc(f.id)}"><div class="schedule-filterbar fd-sf-bar" style="grid-template-columns:repeat(${cells.length},minmax(0,1fr))" aria-label="${tr("场次筛选")}">${cells.map(([k,label,val,c])=>`<button type="button" class="schedule-filter${c?" active":""}" data-showf-filter="${k}" aria-haspopup="dialog" aria-label="${esc(tr(label)+"："+val)}"><span><small>${tr(label)}</small><b>${esc(val)}</b></span>${filterChevron}</button>`).join("")}</div>${on?`<p class="fd-sf-note">${tr("已筛选")} <b>${n} / ${shows.length}</b> ${tr("场")} · <button type="button" class="text-button" data-sf="reset">${tr("清除")}</button></p>`:""}</div>`;}
function showfRows(type){const f=F[FSF.id];if(!f)return [];const shows=SH.filter(x=>x.id===f.id&&!isPast(x)),st=sfState(f),{dates,vs,cities}=sfDims(f,shows);
 if(type==="date")return [{id:"all",name:tr("全部日期"),sub:tr(shows.length+" 场"),selected:!st.d.length},...dates.map(d=>{const xs=shows.filter(x=>x.d===d);return {id:d,name:d+" "+tr(WK[showDate(xs[0]).getDay()]),sub:tr(xs.length+" 场")+" · "+xs.map(x=>x.t).join(" "),selected:st.d.includes(d)};})];
 return [{id:"all",name:tr("全部影院"),sub:tr(shows.length+" 场"),selected:!st.v.length},...vs.map(v=>{const xs=shows.filter(x=>x.v===v),V=VN[v]||{};return {id:v,name:sfVenueName(v,cities),sub:[cities.size>1?"":tr(V.city||""),tr(xs.length+" 场")].filter(Boolean).join(" · "),selected:st.v.includes(v)};})];}
function sfRerender(){const f=F[FSF.id];if(!f)return;const shows=SH.filter(x=>x.id===f.id&&!isPast(x)),bar=document.querySelector(".fd-sf"),list=document.getElementById("fd-showlist"),cnt=document.getElementById("fd-showcount");
 if(bar)bar.outerHTML=showFilterHTML(f,shows);if(list)list.innerHTML=showListHTML(f,shows);if(cnt)cnt.textContent=showCountText(f,shows);}
document.addEventListener("click",e=>{const t=e.target.closest("[data-showf-filter]");if(t){openScheduleSelector(t.dataset.showfFilter,"showf");return;}const b=e.target.closest("[data-sf]");if(!b)return;const f=F[FSF.id];if(!f)return;const st=sfState(f);st.d=[];st.v=[];sfRerender();});
function screeningHTML(s,f){const k=keyOf(s),yes=picked.has(k),gone=isPast(s);const [m,d]=s.d.split("/");return `<div class="fd-ticket${gone?" past":""}"><div class="fd-tdate fc" style="--h:${fhue(s.id)}"><small>${m}月</small><b>${d}</b><span>${wk(s.d)}</span></div><div class="fd-tbody"><div class="fd-ttime"><b>${s.t}</b><span>–</span><b class="end">${f.minTbd?"":fmt(toMin(s.t)+durationOf(s))}</b>${gone?'<em class="fd-gone">已放映</em>':""}</div><small>${placeHTML(s)}</small>${(PG[s.p]&&filmProgsOf(f).length>1)?`<span class="fd-sprog">${esc(PG[s.p].name)}</span>`:""}${f.screeningNotes?.[k]?noteHTML(f.screeningNotes[k]):""}<div class="fd-tact"><button class="fd-add${yes?" on":""}" data-plan="${esc(k)}" aria-pressed="${yes}">${yes?"✓ 已加入排片":"+ 加入排片"}</button><button class="fd-see" data-jump="${k}">在排片中查看</button>${gone?"":`<button class="fd-see fd-remind" data-remind="${esc(k)}" title="${esc(tr("下载日历文件，开场前 1 小时提醒"))}">⏰ 提醒我</button>`}</div></div></div>`;}
// 购票码：影片自带的购票码 + 所属各专题的购票码（跨影展影片会有多张，按专题标注）
const TK={};
// 购票码是否显示（按专题分开算）：专题已结束或影片已下映不显示；影展专题里这部片在该专题还有未散场的场次、或场次还没公布时显示，全部放完就隐藏，补了加场会自动重新出现。院线专题不录全部场次，沿用「本片任一场未散场或尚无场次」
function ticketLive(f,p){
  p=p||PG[f.prog]; if(p&&progStatus(p)==="ended") return false;
  if(isInternalIn(f,p)) return false; // 内部放映不对外售票
  if(f.ended) return false;
  const all=SH.filter(s=>s.id===f.id),mine=p&&p.kind!=="院线"?all.filter(s=>(s.p||f.prog)===p.id):all;
  return !mine.length||mine.some(s=>!isPast(s));
}
function ticketsOf(f){
  if(f.ev) return f.ticket&&ticketLive(f)?[{ticket:f.ticket,ticketPlatform:f.ticketPlatform,ticketHint:f.ticketHint,ticketLabel:f.ticketLabel,p:PG[f.prog]}]:[];
  const out=[],seen=new Set(),add=(t,p)=>{if(!t.ticket||seen.has(t.ticket))return;seen.add(t.ticket);out.push(Object.assign({},t,{p}));};
  if(f.ticket&&ticketLive(f)) add({ticket:f.ticket,ticketPlatform:f.ticketPlatform,ticketHint:f.ticketHint,ticketLabel:f.ticketLabel},PG[f.prog]);
  (typeof filmProgsOf==="function"&&F[f.id]?filmProgsOf(f):[]).forEach(({p})=>{if(p.ticket&&ticketLive(f,p))add({ticket:p.ticket,ticketPlatform:p.ticketPlatform,ticketHint:p.ticketHint},p);});
  return out;
}
function ticketCardHTML(t,cn,key,tag){TK[key]=Object.assign({cn},t);const w=t.ticketLabel||'购票';return `<section class="ticket-card" aria-label="${esc(cn)}${w}"><div class="ticket-copy"><small>BOOK YOUR SEAT${tag?` · ${esc(tag)}`:""}</small><h2>银幕见</h2><p>${esc(t.ticketPlatform||"微信")}扫码${w}<br>${esc((t.ticketHint||"麻雀映画小程序").replace(/^淘票票扫码购票\s*[·・]?\s*/,""))}</p><button class="ticket-expand" data-ticket="${esc(key)}">查看${w}码 ↗</button></div><button class="ticket-code" data-ticket="${esc(key)}" aria-label="放大${esc(cn)}${w}码"><img src="${t.ticket}" alt="${esc(cn)}${w}码" width="430" height="430"></button></section>`;}
function internalNoteHTML(f){const ps=internalProgsOf(f);if(!ps.length)return "";return ps.map(p=>{const sec=(p.sections||{})[f.id];return `<div class="fd-internal"><b>内部放映 · 不对外售票</b><span>${esc(p.name)}${sec?` · ${esc(sec)}`:""}</span><span>本片为产业放映，不对外展映、不对外售票，场次仅供行业观摩。</span></div>`;}).join("");}
function ticketHTML(f){const ts=ticketsOf(f),multi=ts.length>1||(typeof filmProgsOf==="function"&&filmProgsOf(f).length>1);return ts.map((t,i)=>ticketCardHTML(t,f.cn,f.id+"#"+i,multi&&t.p?t.p.name:"")).join("");} // 跨影展影片只剩一张购票码时也标出是哪个影展
document.addEventListener('click',e=>{const b=e.target.closest('[data-ticket]');if(!b)return;const f=TK[b.dataset.ticket],src=f&&f.ticket;if(!f||!src)return;const w=f.ticketLabel||'购票';document.getElementById('ticket-modal')?.remove();const d=document.createElement('dialog');d.id='ticket-modal';d.className='ticket-modal';d.setAttribute('aria-label',f.cn+w);d.innerHTML=`<header><h2>${esc(f.cn)} · ${w}</h2><button class="ticket-close" aria-label="关闭${w}码">×</button></header><img src="${src}" alt="${esc(f.cn)}${w}码"><p>${esc(f.ticketHint||"微信内可长按图片识别。其他浏览器请先保存图片，再用微信「扫一扫」从相册选择。")}</p><a class="primary-button ticket-save" href="${src}" download="${esc(f.cn)}-${w}码.${src.endsWith(".jpg")?"jpg":"png"}">保存${w}码</a>`;document.body.append(d);d.querySelector('.ticket-close').onclick=()=>d.close();d.onclick=ev=>{if(ev.target===d){const r=d.getBoundingClientRect();if(ev.clientX<r.left||ev.clientX>r.right||ev.clientY<r.top||ev.clientY>r.bottom)d.close();}};d.addEventListener('close',()=>{d.remove();if(b.isConnected)b.focus({preventScroll:true});});d.showModal();});

function detail(id){
  const f=F[id]; if(!f){ go("films"); return; }
  id=f.id;
  const col = REG[f.reg].c, P = pst(id);
  const allShows = SH.filter(x=>x.id===id), shows = allShows.filter(x=>!isPast(x));
  const sib = FILMS.filter(x=>x.prog===f.prog||PG[f.prog]?.sections?.[x.id]||PG[f.prog]?.members?.includes(x.id)), idx = sib.indexOf(f), prev = sib[idx-1], next = sib[idx+1];
  topEl.innerHTML = `<div class="row"><button class="back" data-back><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m15 6-6 6 6 6"/></svg>返回</button><span class="sp"></span><span class="pill">${f.ev?esc(tr("活动场次")):String(idx+1).padStart(2,"0")+" / "+sib.length}</span></div>`;
  const syn = String(f.syn||""), long = syn.length > 220;
  const has = {syn:!!syn, watch:!!f.editorial||f.highlights.length>0, hon:f.honors.length>0, dir:!!(f.dir&&(f.bio||f.dirO||f.dirLife)), ctx:!!f.st};
  const secs = [["fd-syn","剧情",has.syn],["fd-watch","荐片",has.watch],["fd-hon","荣誉",has.hon],["fd-dir","导演",has.dir],["fd-ctx","背景",has.ctx]].filter(x=>x[2]);
  const navBtn = (x,lab) => x?`<button class="fd-nb" data-film="${x.id}">${pst(x.id)?pimg(x.id,360,'alt=""'):`<span class="fd-nbs" style="background:${REG[x.reg].c}">${esc(x.cn[0])}</span>`}<span><small>${lab}</small><b>${esc(x.cn)}</b></span></button>`:"<span></span>";
  main.innerHTML = `<article class="fd" style="--fc:${col}">
  <header class="fd-hero">${P?pimg(id,360,'class="fd-bg" alt=""'):""}<div class="fd-shade"></div>
    <div class="fd-hin gut">
<div class="fd-progrow">${window.SparrowLibrary.featuredProgrammes(filmProgsOf(f),p=>{const [a,b]=progRange(p);return {status:progStatus(p),a,b};}).map(x=>`<button class="fd-prog" data-prog="${x.p.id}">${esc(x.p.kind)} · ${esc(x.p.name)} ›</button>${x.sec?`<span class="fd-unit"><i aria-hidden="true">◆</i><span class="sr-only">展映单元：</span>${esc(x.sec)}</span>`:""}`).join("")}</div>
      ${P?pimg(id,720,`class="fd-poster" alt="${esc(f.cn)} 海报"`):`<div class="fd-poster fd-ph"><b>${esc(f.cn[0])}</b></div>`}
      <div class="fd-title">
        <div class="fd-eyebrow"><span class="fd-reg">${REG[f.reg].n}</span><span title="${esc([f.y,f.c].filter(Boolean).join(" · "))}">${[f.y,f.c].filter(Boolean).map(esc).join(" · ")}</span></div>
        <h1>${esc(f.cn)}</h1>
        ${f.cnDb&&LANG!=="en"&&f.cnDb!==f.cn?`<div class="fd-native">豆瓣译名 ${esc(f.cnDb)}</div>`:""}
        <div class="fd-orig">${esc(f.en||f.o||"")}</div>${f.o&&f.o!==f.cn&&f.o!==(f.en||f.o)?`<div class="fd-native">原名 ${esc(f.o)}</div>`:""}
        <div class="fd-chips">${f.version?`<span class="fd-ed">${esc(f.version)}</span>`:""}<span>${minText(f)}</span>${f.language?`<span>${esc(f.language)}</span>`:""}${f.genre.map(g=>`<span>${esc(g)}</span>`).join("")}</div>
        <div class="fd-acts"><button class="fd-act" type="button" data-share="f:${f.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>分享影片</button><button class="fd-act" type="button" data-sposter="f:${f.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 15l3-3 2 2 3-3"/><circle cx="9" cy="8" r="1.5"/></svg>分享海报</button></div>
      </div>
    </div>
  </header>
  <div class="fd-body gut">
    <aside class="fd-side">
      ${/* 顺序：先看场次、加入排片，再购票、记录观影，最后才是各家评分 */""}<section class="fd-block"><h3 class="fd-h">放映场次 <small id="fd-showcount">${shows.length?showCountText(f,shows):(f.ended&&!allShows.length?"已下映":(internalNoteHTML(f)&&!allShows.length?"内部放映":"排片待公布"))}</small></h3>${shows.length?showFilterHTML(f,shows)+`<div id="fd-showlist">${showListHTML(f,shows)}</div>`+pastShowsHTML(allShows,f,true):(internalNoteHTML(f)&&!allShows.length?internalNoteHTML(f):`<div class="fd-noshow"><b>${allShows.length?"本片场次已全部放映结束":(f.ended?"已下映":f.release?esc(f.release):"上映信息待公布")}</b><span>${allShows.length?(pastShowsHTML(allShows,f,false)?"":"已放映的场次不再显示在这里。"):(f.ended?"本片院线放映已结束，麻雀观影护照未收录具体场次。":"麻雀观影护照收录的场次公布后会更新到这里，也可以先在各影院售票平台查看。")}</span></div>`)+pastShowsHTML(allShows,f,false)}</section>
      ${shows.length||allShows.length?internalNoteHTML(f):""}${ticketHTML(f)}
      ${f.ev?"":myRateHTML(f)}
      ${f.ev?"":ratingsHTML(f)}
      ${f.ev?"":extLinksHTML(f)}
      ${f.ev||f._lite?"":noticeHTML(f)}
      ${f.ev?"":qaPanelHTML(f)}
      ${giftsHTML(f)}
      <section class="fd-block"><h3 class="fd-h">影片信息</h3><dl class="fd-credits">${creditsHTML(f)}</dl></section>${f._lite?"":partsHTML(f)}
    </aside>
    <div class="fd-main">
      <nav class="fd-jump" aria-label="页面目录">${secs.map(([a,l])=>`<button data-scroll="${a}">${l}</button>`).join("")}</nav>
      ${f._lite?`<p class="fd-empty" role="status">影片介绍加载中…</p>`:!secs.length?`<p class="fd-empty">影片介绍整理中，排片与场次信息已可查看。</p>`:""}${!has.syn?"":`<section class="fd-sec" id="fd-syn"><h2 class="fd-st"><span>剧情简介</span><small>SYNOPSIS</small></h2><div class="fd-syn${long?" clamp":""}">${paragraphsHTML(syn)}</div>${long?`<button class="fd-more" data-expand>展开全文</button>`:""}</section>`}
      ${!has.watch?"":`<section class="fd-sec" id="fd-watch"><h2 class="fd-st"><span>荐片笔记</span><small>CURATOR'S NOTES</small></h2><ol class="fd-watch">${[f.editorial,...f.highlights].filter(Boolean).map((x,i)=>`<li><span>${String(i+1).padStart(2,"0")}</span><p>${esc(x)}</p></li>`).join("")}</ol></section>`}
      ${f.honors.length?`<section class="fd-sec" id="fd-hon"><h2 class="fd-st"><span>影展与荣誉</span><small>FESTIVALS & AWARDS</small></h2><ul class="fd-honors">${f.honors.map(honorHTML).join("")}</ul></section>`:""}
      ${!has.dir?"":`<section class="fd-sec" id="fd-dir"><h2 class="fd-st"><span>导演介绍</span><small>DIRECTOR</small></h2><div class="fd-dcard"><div class="fd-dhead"><span class="fd-av">${esc(f.dir[0])}</span><span><b>${esc(f.dir)}</b>${f.dirO&&f.dirO!==f.dir?`<small>${esc(f.dirO)}</small>`:""}${f.dirLife?`<small>${esc(f.dirLife)}</small>`:""}</span></div>${paragraphsHTML(f.bio)}</div></section>`}
      ${!has.ctx?"":`<section class="fd-sec" id="fd-ctx"><h2 class="fd-st"><span>创作背景</span><small>CONTEXT</small></h2><blockquote class="fd-ctx">${paragraphsHTML(f.st)}</blockquote></section>`}
      ${f.ev?"":`<nav class="fd-nav">${navBtn(prev,"上一部")}${navBtn(next,"下一部")}</nav>`}
    </div>
  </div>
  <div class="gut">${presentersHTML()}</div></article>`;
  fitHero(); document.fonts?.ready.then(fitHero);
}
// 头图：片名等文字较多时逐步缩小字号，使文字区上下与海报对齐（不超过海报高度）
function fitHero(){
  const t=main.querySelector('.fd-title'), p=main.querySelector('.fd-poster'); if(!t||!p) return;
  t.classList.remove('fd-tight'); const parts=[...t.querySelectorAll('h1,.fd-orig,.fd-native,.fd-chips span')]; parts.forEach(x=>x.style.fontSize='');
  const base=parts.map(x=>parseFloat(getComputedStyle(x).fontSize)), fits=()=>t.scrollHeight<=p.offsetHeight+1;
  for(let k=.94; !fits() && k>=.5; k-=.06) parts.forEach((x,i)=>x.style.fontSize=Math.max(x.tagName==='H1'?15:9.5, base[i]*k)+'px');
  t.classList.toggle('fd-tight', !fits());
}
window.addEventListener('resize',()=>{clearTimeout(fitHero.t);fitHero.t=setTimeout(fitHero,150);});
document.addEventListener("click",e=>{
  const s=e.target.closest("[data-scroll]");if(s){e.preventDefault();const t=document.getElementById(s.dataset.scroll);if(t){const top=t.getBoundingClientRect().top+window.scrollY-(document.getElementById("topbar").offsetHeight+12);window.scrollTo({top,behavior:matchMedia("(prefers-reduced-motion:reduce)").matches?"auto":"smooth"});}return;}
  const x=e.target.closest("[data-expand]");if(x){const b=x.previousElementSibling;b.classList.toggle("clamp");x.textContent=b.classList.contains("clamp")?"展开全文":"收起";}
});
