/* js/install.js — 添加到手机（#install）。
   网站脚本按功能拆成 js/*.js，按 index.html 里的顺序加载；部署时 tools/build-assets.js 按同样顺序合并成一个 app.js。 */
const ENV=(()=>{const ua=navigator.userAgent||"";const ios=/iPhone|iPad|iPod/i.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1);return {wechat:/MicroMessenger/i.test(ua),ios,android:/Android/i.test(ua),iosSafari:ios&&!/CriOS|FxiOS|EdgiOS|MicroMessenger|QQ\//i.test(ua),standalone:(window.matchMedia&&matchMedia("(display-mode: standalone)").matches)||navigator.standalone===true};})();
let installPrompt=null;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e;if(location.hash==="#install")installPage();});
window.addEventListener("appinstalled",()=>{installPrompt=null;toast("已添加到手机桌面");if(location.hash==="#install")installPage();});
if("serviceWorker" in navigator&&location.protocol==="https:"){
  const hadController=!!navigator.serviceWorker.controller;let updatingPage=false;
  navigator.serviceWorker.addEventListener("controllerchange",()=>{if(hadController&&!updatingPage){updatingPage=true;location.reload();}});
  window.addEventListener("load",()=>{navigator.serviceWorker.register("sw.js",{updateViaCache:"none"}).then(reg=>{
    const check=()=>{if(document.visibilityState==="visible")reg.update().catch(()=>{});};
    document.addEventListener("visibilitychange",check);window.addEventListener("pageshow",check);check();
  }).catch(()=>{});});
}
let installTab=null;
const IIC={
  share:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>',
  dots:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>',
  hdots:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
  float:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="8"/><path d="M9 12h6"/></svg>',
  star:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
  globe:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
  phone:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/></svg>'
};
function stepsHTML(steps){return '<ol class="in-steps">'+steps.map(([ic,t,s],i)=>'<li><span class="in-n">'+(i+1)+'</span><span class="in-ic">'+(IIC[ic]||"")+'</span><span class="in-tx"><b>'+t+'</b>'+(s?'<small>'+s+'</small>':'')+'</span></li>').join("")+'</ol>';}
function installPage(){
  const tab=installTab||(ENV.wechat?"wechat":ENV.android?"android":"ios");
  const T=[["ios","iPhone"],["android","安卓"],["wechat","微信"]];
  let body="";
  if(tab==="ios"){
    body=(ENV.ios&&!ENV.iosSafari&&!ENV.wechat?'<p class="in-warn">建议先用 <b>Safari</b> 打开本页再添加，其他浏览器的菜单位置可能不同。</p>':'')+stepsHTML([
      ["globe","用 Safari 打开本页","微信里请先点右上角「···」→「在默认浏览器中打开」"],
      ["share","点底部工具栏的「分享」按钮","方框加向上箭头的图标；iPad 在右上角"],
      ["plus","在菜单中选「添加到主屏幕」","没看到就向下滑，或点「编辑操作」把它加进列表"],
      ["phone","点右上角「添加」","桌面会出现红色的「观影护照」图标"]]);
  }else if(tab==="android"){
    body=(installPrompt?'<button class="primary-button in-cta" data-install>一键添加到手机桌面</button><p class="in-or">或者按下面的步骤手动添加</p>':'')+stepsHTML([
      ["globe","用 Chrome 或手机自带浏览器打开本页","微信里请先点右上角「···」→「在浏览器打开」"],
      ["dots","点右上角或底部的「⋮ / ≡」菜单",""],
      ["plus","选「添加到主屏幕」或「安装应用」","部分手机写作「添加到桌面」「发送到桌面」"],
      ["phone","确认添加","如果桌面没出现图标，到系统设置里给浏览器打开「创建桌面快捷方式」权限"]]);
  }else{
    body=stepsHTML([
      ["hdots","点右上角「···」",""],
      ["float","选「浮窗」","返回聊天后，从屏幕边缘或聊天列表顶部就能一点即回"],
      ["star","或者选「收藏」","之后在「我 → 收藏」里随时打开"]])+
      '<div class="in-note"><b>想要像 App 一样放在桌面？</b><p>在「···」里选「在浏览器打开」，再按 iPhone 或安卓的步骤添加到主屏幕。</p></div>'+
      '<div class="in-note muted"><b>关于小程序</b><p>网页不能直接加入微信的小程序列表。用「浮窗」是在微信里最接近小程序的打开方式。</p></div>';
  }
  main.innerHTML='<section class="view gut in-view">'+subBackHTML()+'<div class="page-heading"><div><small>ADD TO HOME SCREEN</small><h2 class="sec">添加到手机</h2></div></div>'+
  (ENV.standalone?'<div class="in-done"><b>✓ 已经在 App 模式中打开</b><p>以后从桌面的「观影护照」图标进入即可。</p></div>':
  '<div class="in-hero"><img src="icons/icon-192.png?v=3" alt="" width="64" height="64"><div><b>把「麻雀观影护照」放到手机桌面</b><p>全屏打开，没有地址栏，看排片就像用 App；个人排片也会一直保存在这台手机上。</p></div></div>')+
  '<div class="in-tabs" role="tablist">'+T.map(([k,n])=>'<button role="tab" aria-selected="'+(k===tab)+'" data-itab="'+k+'">'+n+((k==="wechat"&&ENV.wechat)||(k==="ios"&&ENV.ios&&!ENV.wechat)||(k==="android"&&ENV.android&&!ENV.wechat)?'<i>当前</i>':'')+'</button>').join("")+'</div>'+
  '<div class="in-panel">'+body+'</div><p class="local-note">添加到桌面后，排片保存在桌面版自己的存储里，可能和浏览器里的不互通。需要搬过去时，用「导出与分享」里的日程链接导入。</p></section>';
}
document.addEventListener("click",async e=>{
  const t=e.target.closest("[data-itab]");if(t){installTab=t.dataset.itab;installPage();return;}
  if(e.target.closest("[data-install]")&&installPrompt){installPrompt.prompt();try{await installPrompt.userChoice;}catch(err){}installPrompt=null;installPage();}
});
