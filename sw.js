/* 麻雀观影护照 service worker：页面和 data/ 排片数据走“网络优先”（保证排片总是最新），海报、图标等静态资源走“缓存优先”，离线时也能打开上次看过的内容。 */
const CACHE = "sk-v337";
const CORE = ["./", "./index.html", "./app.css", "./app.js","./manifest.webmanifest", "./vendor/qrcode.js", "./shared/recap.js?v=20261124","./shared/share-poster.js","./shared/taste-report.js","./shared/psync.js?v=20261128t", "./shared/notes-crypto.js?v=1", "./shared/ecosystem.js?v=1", "./shared/taste.js?v=2", "./shared/taste-client.js?v=2", "./shared/library.js?v=20261124d", "./shared/recommend.js?v=1", "./shared/premiere.js", "./shared/screenings.js?v=2", "./shared/tz.js?v=2", "./shared/planner.js?v=2", "./shared/growth.js?v=20261125", "./shared/overlap.js?v=2", "./shared/curl.js", "./shared/profile-backup.js?v=20261124n", "./shared/ticket-sketch.js?v=17", "./shared/tickets.js?v=32", "./shared/ticket-ocr.js?v=1", "./styles/tickets.css?v=21", "./styles/companion.css", "./brand/passport-aperture.svg", "./data/catalog.json", "./icons/icon-192.png", "./icons/apple-touch-icon.png", "./brand/sparrow-movies-sq.png", "./brand/sparrow-tribe-sq.png", "./brand/sparrow-movies-sq-dark.png", "./brand/sparrow-tribe-sq-dark.png"];

self.addEventListener("install", e => {
  /* 逐个缓存，个别文件缺失（如本地预览没有部署生成的 app.js）不影响其余文件 */
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(url => c.add(new Request(url, {cache:"reload"})).catch(() => {})))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  /* app.css / app.js：部署后带内容哈希 ?v=…（缓存优先，离线时退回任意已缓存的版本）；不带 ?v（本地预览）时和页面一样走网络优先。 */
  const isApp = /\/app\.(?:css|js)$/.test(url.pathname) || /\/js\/[\w-]+\.js$/.test(url.pathname); /* js/*.js 只在本地预览时逐个加载，按页面处理（网络优先） */
  if (isApp && url.searchParams.has("v")) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, {ignoreSearch:true}).then(r => r || Response.error()))));
    return;
  }
  const isPage = isApp || req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith(".html") || (url.pathname.includes("/data/") && url.pathname.endsWith(".json"));
  if (isPage) {
    e.respondWith(
      fetch(req, {cache:"no-store"}).then(res => { if (res.type === "opaqueredirect") return res; /* 换域名后旧网址整站 301：把跳转交给浏览器，不要退回缓存里的旧页面 */ if (!res.ok) throw new Error("Page unavailable"); const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })
        .catch(() => caches.match(req, {ignoreSearch:true}).then(r => r || (req.mode === "navigate" ? caches.match("./index.html") : Response.error())))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }))
  );
});
