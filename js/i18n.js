/* js/i18n.js — 中英文切换：语言选择、界面词典与数字句式（PATS）、页面翻译。
   网站脚本按功能拆成 js/*.js，按 index.html 里的顺序加载；部署时 tools/build-assets.js 按同样顺序合并成一个 app.js。 */
/* ---- i18n：中文 / English ----
   语言：?lang=en|zh > 本机记住的选择 > 浏览器语言。英文版 = data/i18n/en.json（影片/专题/影院译文 + 界面词典 ui）。
   界面文字不逐处改代码：英文模式下由 tr() 在渲染后统一翻译页面文字与 aria-label 等属性，未收录的文字保持中文。 */
const LANG=(()=>{try{const q=new URLSearchParams(location.search).get("lang");if(q==="en"||q==="zh"){try{localStorage.setItem("sparrow-lang",q);}catch(e){}return q;}const s=localStorage.getItem("sparrow-lang");if(s==="en"||s==="zh")return s;}catch(e){}return /^zh/i.test(navigator.language||"zh")?"zh":"en";})();
const CJK=/[\u3000-\u303f\u3400-\u9fff\uff00-\uffef]/;
let EN={ui:{},exact:{},films:{},programmes:{},venues:{}},UIK=[];
const MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const pl=(n,one,many)=>n+" "+(+n===1?one:many);
const PATS=[
 [/(\d+)\s*场排片已按最新排片更新/g,(m,n)=>n+" screening"+(n==1?" in your plan was":"s in your plan were")+" updated to the new schedule"],
 [/你们有\s*(\d+)\s*场同场/g,(m,n)=>"You share "+n+" screening"+(n==1?"":"s")],
 [/同一部电影、不同场次\s*(\d+)\s*部/g,(m,n)=>n+" same film"+(n==1?"":"s")+", different screening"],
 [/TA 还有\s*(\d+)\s*场和你不冲突/g,(m,n)=>n+" more of theirs fit your plan"],
 [/与你的排片冲突\s*(\d+)\s*场/g,(m,n)=>n+" clash"+(n==1?"":"es")+" with your plan"],
 [/TA 的\s*(\d+)\s*场已更新或取消，没有显示/g,(m,n)=>n+" of their screenings "+(n==1?"was":"were")+" changed or cancelled and "+(n==1?"is":"are")+" not shown"],
 [/你选的是\s*/g,()=>"You picked "],
 [/与你的《([^》]+)》\s*([\d/]+ [\d:]+)\s*冲突/g,(m,t,w)=>"Clashes with your "+t+" at "+w],
 [/间隔仅\s*(\d+)\s*分钟，留意入场时间/g,(m,n)=>"Only "+n+" min between screenings — mind the entry time"],
 [/有\s*(\d+)\s*组场次时间重叠/g,(m,n)=>pl(n,"pair of screenings overlaps","pairs of screenings overlap")],
 [/(\d+)\s*天后/g,(m,n)=>"in "+n+" days"],
 [/还有\s*(\d+)\s*场/g,(m,n)=>n+" more"],
 [/(\d{4})年(\d{1,2})月(\d{1,2})日\s*/g,(m,y,mo,d)=>MON[mo-1]+" "+(+d)+", "+y+" · "],
 [/(\d{1,2})月(\d{1,2})日/g,(m,a,b)=>MON[a-1]+" "+(+b)],
 [/(\d{1,2})月(?!\d)/g,(m,a)=>MON[a-1]],
 [/(\d+)\s*部有新场次/g,(m,n)=>n+" with new screenings"],
 [/(\d+)\s*场排片有变动/g,(m,n)=>pl(n,"screening in your plan changed","screenings in your plan changed")],
 [/(\d+)\s*部有场次/g,(m,n)=>n+" now screening"],
 [/(\d+)\s*部影片/g,(m,n)=>pl(n,"film","films")],
 [/(\d+)\s*部/g,(m,n)=>pl(n,"film","films")],
 [/(\d+)\s*场放映/g,(m,n)=>pl(n,"screening","screenings")],
 [/(\d+)\s*场电影/g,(m,n)=>pl(n,"film","films")],
 [/(\d+)\s*场/g,(m,n)=>pl(n,"screening","screenings")],
 [/(\d+)\s*个放映日/g,(m,n)=>pl(n,"screening day","screening days")],
 [/(\d+)\s*个影厅/g,(m,n)=>pl(n,"hall","halls")],
 [/(\d+)\s*家有排片/g,(m,n)=>pl(n,"cinema with screenings","cinemas with screenings")],
 [/(\d+)\s*家/g,(m,n)=>pl(n,"cinema","cinemas")],
 [/(\d+)\s*天行程/g,(m,n)=>pl(n,"day","days")],
 [/(\d+)\s*天/g,(m,n)=>pl(n,"day","days")],
 [/已放映 (\d+) 场/g,(m,n)=>"Screened "+n],
 [/(\d+)\s*个已结束/g,(m,n)=>n+" ended"],
 [/(\d+)\s*个进行中或即将开始/g,(m,n)=>n+" now showing or coming soon"],
 [/(\d+)\s*小时/g,(m,n)=>n+"h"],
 [/(\d+)\s*分钟/g,(m,n)=>n+" min"],
 [/(\d+)\s*分(?!钟)/g,(m,n)=>n+" min"],
 [/(\d+)\s*组/g,(m,n)=>pl(n,"pair","pairs")]
];
const PUNCT=[[/「([^」]*)」/g,(m,a)=>"“"+a+"”"],[/（/g,()=>" ("],[/）/g,()=>")"],[/，/g,()=>", "],[/：/g,()=>": "],[/。/g,()=>". "],[/、/g,()=>", "],[/！/g,()=>"!"],[/？/g,()=>"?"],[/｜/g,()=>" | "],[/＋/g,()=>"+"]];
function trCore(c){
  const u=EN.ui,x=EN.exact||{}; if(Object.prototype.hasOwnProperty.call(x,c)) return x[c]; if(Object.prototype.hasOwnProperty.call(u,c)) return u[c];
  let s=c; PATS.forEach(([re,fn])=>{ s=s.replace(re,fn); });
  for(const k of UIK){ if(s.indexOf(k)>=0) s=s.split(k).join(u[k]); }
  PUNCT.forEach(([re,fn])=>{ s=s.replace(re,fn); });
  s=s.replace(/\s{2,}/g," ").replace(/\s+([,.:!?”)])/g,"$1").replace(/\(\s+/g,"(").replace(/\s*·\s*$/,"").trim();
  return CJK.test(s)?c:s;
}
function tr(s){ if(LANG!=="en"||typeof s!=="string"||!CJK.test(s)) return s; const core=s.trim(); if(!core) return s; const out=trCore(core); return out===core?s:s.slice(0,s.indexOf(core))+out+s.slice(s.indexOf(core)+core.length); }
const TR_ATTRS=["aria-label","alt","title","placeholder"];
function trAttr(el,a){ const v=el.getAttribute(a); if(v&&CJK.test(v)){ const o=tr(v); if(o!==v) el.setAttribute(a,o); } }
function trNode(n){
  if(n.nodeType===3){ const p=n.parentNode; if(!p||p.nodeName==="SCRIPT"||p.nodeName==="STYLE"||p.nodeName==="TEXTAREA") return; const v=n.nodeValue; if(CJK.test(v)){ const o=tr(v); if(o!==v) n.nodeValue=o; } return; }
  if(n.nodeType!==1||n.nodeName==="SCRIPT"||n.nodeName==="STYLE") return;
  TR_ATTRS.forEach(a=>{ if(n.hasAttribute(a)) trAttr(n,a); });
  for(let c=n.firstChild;c;c=c.nextSibling) trNode(c);
}
async function startI18n(){
  if(LANG!=="en") return;
  document.documentElement.lang="en";
  try{ const r=await fetch("data/i18n/en.json",{cache:"no-store"}); if(r.ok){ const j=await r.json(); EN={ui:j.ui||{},exact:j.exact||{},films:j.films||{},programmes:j.programmes||{},venues:j.venues||{}}; UIK=Object.keys(EN.ui).sort((a,b)=>b.length-a.length); } }catch(e){ console.warn("English layer unavailable",e); }
  const P=CanvasRenderingContext2D.prototype,ft=P.fillText,mt=P.measureText;   // 长图画布里的中文也走词典
  P.fillText=function(t,...a){ return ft.call(this,tr(String(t)),...a); };
  P.measureText=function(t){ return mt.call(this,tr(String(t))); };
  document.title=tr(document.title); trNode(document.body);
  new MutationObserver(ms=>{ for(const m of ms){ if(m.type==="childList") m.addedNodes.forEach(trNode); else if(m.type==="characterData") trNode(m.target); else if(m.type==="attributes") trAttr(m.target,m.attributeName); } }).observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:TR_ATTRS});
}
function applyEN(cat,packs){
  if(LANG!=="en") return;
  (cat.programmes||[]).forEach(p=>{ const o=EN.programmes[p.id]; if(o) Object.assign(p,o); });
  (cat.venues||[]).forEach(v=>{ const o=EN.venues[v.id]; if(!o) return; const {halls,...rest}=o; Object.assign(v,rest); if(halls) (v.halls||[]).forEach(h=>{ if(halls[h.id]) Object.assign(h,halls[h.id]); }); });
  packs.forEach(pk=>pk&&(pk.films||[]).forEach(f=>{ const o=EN.films[f.id]; if(!o) return; f.cnZh=f.cn; const {title,...rest}=o; if(title) f.cn=title; Object.assign(f,rest); }));
}
document.addEventListener("click",e=>{ const b=e.target.closest("[data-lang-toggle]"); if(!b) return; const u=new URL(location.href); u.searchParams.set("lang",LANG==="en"?"zh":"en"); location.href=u.toString(); });
