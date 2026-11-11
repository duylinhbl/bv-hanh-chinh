const V='bv-v28',F=['./','index.html','app.js','lich.js','ct.js','style.css','config.js','manifest.json','icon.svg','logo.png','icon-192.png','icon-512.png','https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(V).then(c=>Promise.all(F.map(u=>c.add(u).catch(()=>{})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.hostname.endsWith('supabase.co'))return;
 e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{const c=r.clone();caches.open(V).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request)))});

self.addEventListener('push',e=>{let d={};try{d=e.data.json()}catch(_){d={tieu:'BV Hành chính',noi:e.data&&e.data.text()}}
 e.waitUntil(self.registration.showNotification(d.tieu||'BV Hành chính',Object.assign({body:d.noi||'',icon:'icon-192.png',badge:'icon-192.png',data:{url:d.url||'./'}},d.tag?{tag:d.tag,renotify:true}:{})))});
self.addEventListener('notificationclick',e=>{e.notification.close();const url=(e.notification.data&&e.notification.data.url)||'./';
 e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(l=>{
  for(const c of l){if('focus'in c){c.postMessage({di:url});return c.focus()}}
  return clients.openWindow(url)}))});
