/* 麻雀排片 service worker：页面走“网络优先”（保证排片总是最新），海报、图标等静态资源走“缓存优先”，离线时也能打开上次看过的内容。 */
const CACHE = "sk-v3";
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./vendor/qrcode.js", "./icons/icon-192.png", "./icons/apple-touch-icon.png", "./brand/mark-movies.png", "./brand/mark-tribe.png", "./brand/mark-movies-dark.png", "./brand/mark-tribe-dark.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const isPage = req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith(".html");
  if (isPage) {
    e.respondWith(
      fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })
        .catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
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
