/* Service worker mínimo: solo para que la app se pueda instalar. No guarda nada en caché a propósito,
   para que nunca se vea una versión vieja del programa ni datos desactualizados: todo va siempre a la red. */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', ev => ev.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})
