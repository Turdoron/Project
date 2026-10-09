/* Service worker mínimo: solo para que la app se pueda instalar. No intercepta ninguna petición ni guarda
   nada en caché, a propósito: todo va directo a la red, así nunca se ve una versión vieja del programa ni
   datos desactualizados. (Chrome ya no exige un manejador de "fetch" para instalar la app.) */
self.addEventListener('install', () => self.skipWaiting())
