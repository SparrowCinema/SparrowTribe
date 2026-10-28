/* 麻雀观影护照 service worker：页面和 data/ 排片数据走“网络优先”（保证排片总是最新），海报、图标等静态资源走“缓存优先”，离线时也能打开上次看过的内容。 */
const CACHE = "sk-v16";
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./vendor/qrcode.js", "./data/catalog.json", "./icons/icon-192.png", "./icons/apple-touch-icon.png", "./brand/sparrow-movies-sq.png", "./brand/sparrow-tribe-sq.png", "./brand/sparrow-movies-sq-dark.png", "./brand/sparrow-tribe-sq-dark.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(url => new Request(url, {cache:"reload"})))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const isPage = req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith(".html") || (url.pathname.includes("/data/") && url.pathname.endsWith(".json"));
  if (isPage) {
    e.respondWith(
      fetch(req, {cache:"no-store"}).then(res => { if (!res.ok) throw new Error("Page unavailable"); const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })
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
