/* Service Worker для RPG Quest Journal (Offline PWA).
 * Кэшируем только статические ресурсы (HTML-оболочку, стили, звуки, иконки).
 * API-запросы (/hero, /tasks и т.д.) НЕ кэшируем — данные всегда свежие.
 */
const CACHE_NAME = "rpg-quest-v1";
const STATIC_ASSETS = [
  "/",
  "/static/index.html",
  "/static/manifest.json",
  "/static/icons/icon-192.png",
  "/static/icons/icon-512.png",
  "/static/icons/apple-touch-icon.png",
  "/static/audio/quest_done.wav",
  "/static/audio/buy.wav",
  "/static/audio/level_up.wav"
];

// Установка: предзагружаем статику в кэш
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Активация: очищаем старые версии кэша
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Запросы: офлайн для статики, сеть в приоритете для API
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Не трогаем API и не-одно-доменные запросы
  if (event.request.method !== "GET") return;
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/auth")) return;

  // Стратегия: cache-first для статики, fallback на кэш при отсутствии сети
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          // Кэшируем успешные ответы статики
          if (response && response.status === 200 && response.type === "basic") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Офлайн: если есть HTML-запрос, отдаём закэшированную оболочку
          if (event.request.mode === "navigate") {
            return caches.match("/static/index.html");
          }
        });
    })
  );
});