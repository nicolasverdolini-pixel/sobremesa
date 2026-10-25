// Guarda la app para que abra rápido y funcione sin conexión.
const CACHE = 'sobremesa-v3';
const ARCHIVOS = ['./', 'index.html', 'styles.css', 'js/sonido.js', 'js/palabras.js', 'js/app.js', 'js/quiensoy.js', 'js/impostor.js', 'js/truco.js', 'js/cartas.js', 'js/equipos.js', 'js/partida.js', 'js/tabu.js', 'js/bomba.js', 'js/sudoku.js', 'js/crucigrama-palabras.js', 'js/crucigrama.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-180.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Primero la red (para recibir mejoras), y si no hay conexión, lo guardado.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(r => { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); return r; })
      .catch(() => caches.match(e.request))
  );
});
