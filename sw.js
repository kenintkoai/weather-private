// 🌟 版本號升級，強制瀏覽器清走舊 Cache
const CACHE_NAME = 'kens-weather-v3'; // 建議每次改完 sw.js 都改個版號
// 🌟 使用相對路徑，確保在 GitHub Pages 子目錄下能正確抓取
const APP_SHELL = ['./', './index.html', './manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  // 🌟 強制新的 Service Worker 立即進入激活狀態
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  // 🌟 立即接管所有已打開的頁面
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 🌟 1. 判斷係咪 API (Network First，確保數據最新)
  const isApi =
    url.hostname.includes('open-meteo.com') ||
    url.hostname.includes('weather.gov.hk') ||
    url.hostname.includes('jasoncameron.dev') ||
    url.hostname.includes('corsproxy.io') || 
    url.hostname.includes('allorigins.win');

  // 🌟 2. 判斷係咪 HTML 檔案 (首頁 / 路由)
  const isHtml = req.headers.get('accept')?.includes('text/html') || req.url.endsWith('/');

  // 🌟 3. 如果係 API 或者 HTML，一律使用 Network First
  if (isApi || isHtml) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // 成功攞到最新，複製一份放入 Cache 做後備
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
          return res;
        })
        .catch(() => {
          // 如果斷網，就喺 Cache 度搵返舊版本頂住
          return caches.match(req).then((cached) => {
             // 如果連 Cache 都無 (例如第一次載入)，就回傳離線提示
             return cached || new Response('您目前處於離線狀態，且無暫存資料。', { status: 503, statusText: 'Offline' });
          });
        })
    );
    return;
  }

  // 🌟 4. 靜態資源 (JS, CSS, 圖片)：Cache First (但會喺背景偷偷更新)
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && url.origin === self.location.origin) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
        }
        return res;
      });
    })
  );
});