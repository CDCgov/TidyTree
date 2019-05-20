var CACHE = 'TidyTree';

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll([
        './',
        'index.html',
        'life.nwk',
      ]);
    })
  );
});

self.addEventListener('fetch', function(evt){
  evt.respondWith(fetch(evt.request).catch(function(){
    return caches.open(CACHE).then(function(cache){
      return cache.match(evt.request).then(function(matching){
        return matching || Promise.reject('no-match');
      });
    });
  }));
});
