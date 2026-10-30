// Installation support without caching account data, API responses or old app builds.
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
 if(event.request.mode!=='navigate'||event.request.method!=='GET')return;
 event.respondWith(fetch(event.request).catch(()=>new Response(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#245e4c"><title>Concurceiro — sem conexão</title><body style="font-family:system-ui;background:#f7f9f8;color:#245e4c;padding:40px;max-width:450px;margin:10vh auto"><h1>Vamos reconectar.</h1><p>Conecte-se à internet para abrir seus estudos e sincronizar sua conta.</p><p>As alterações já guardadas neste dispositivo continuam preservadas.</p><a href="/" style="color:inherit">Tentar novamente</a></body></html>`,{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}})));
});
