// Guarda la app en el móvil para que funcione sin conexión y avisa de tareas atascadas.
const CACHE = 'mi-agenda-v4';
const ARCHIVOS = ['./', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== 'mi-agenda-datos').map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Primero intenta la red (para recibir actualizaciones); si no hay conexión, usa la copia guardada.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(e.request)
      .then(r => { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});

// Revisión en segundo plano (Android, con la app instalada): avisa de tareas que llevan mucho tiempo
self.addEventListener('periodicsync', e => {
  if (e.tag === 'revisar-tareas') e.waitUntil(revisarTareas());
});

async function revisarTareas() {
  const c = await caches.open('mi-agenda-datos');
  const r = await c.match('resumen-tareas');
  if (!r) return;
  const { umbral, tareas } = await r.json();
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const dias = s => { const [y, m, d] = s.split('-').map(Number); return Math.round((hoy - new Date(y, m - 1, d)) / 864e5); };
  const viejas = tareas.filter(t => dias(t.creado) > (t.aviso || umbral));
  if (!viejas.length) return;
  const clave = hoy.toISOString().slice(0, 10);
  const ultimo = await c.match('ultimo-aviso');
  if (ultimo && (await ultimo.text()) === clave) return;
  await c.put('ultimo-aviso', new Response(clave));
  await self.registration.showNotification('Tareas pendientes', {
    body: viejas.length === 1 ? `«${viejas[0].texto}» lleva ${dias(viejas[0].creado)} días sin hacer` : `${viejas.length} tareas llevan mucho tiempo sin hacer`,
    icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'tareas-atascadas', data: { tab: 'tareas' },
  });
}

// Al tocar el aviso, abrir la app en Tareas
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    const url = new URL('./?tab=tareas', self.registration.scope).href;
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const v of ventanas) { if ('navigate' in v) { await v.navigate(url); return v.focus(); } }
    return self.clients.openWindow(url);
  })());
});
