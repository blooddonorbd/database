// sw.js - Service Worker for Web Push Notifications

// Cache name for static assets
const CACHE_NAME = 'blood-donor-bd-v1';

// Install event - cache static assets
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll([
        '/',
        '/bh.html',
        'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap',
        'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'
      ]).catch(error => {
        console.warn('Cache addAll error:', error);
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request).then(function(response) {
      // Return cached response if found
      if (response) {
        return response;
      }
      
      // Otherwise fetch from network
      return fetch(event.request).then(function(networkResponse) {
        // Don't cache if not a valid response
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        
        // Cache the response for future
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, responseToCache);
        });
        
        return networkResponse;
      }).catch(function(error) {
        // If offline and not in cache, show offline page
        return new Response(
          '<h1>You are offline</h1><p>Please connect to the internet to access this content.</p>',
          { headers: { 'Content-Type': 'text/html' } }
        );
      });
    })
  );
});

// ============================================
// PUSH NOTIFICATION HANDLING
// ============================================

// Push event - show notification
self.addEventListener('push', function(event) {
  console.log('📨 Push event received:', event);
  
  let data = {};
  
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (error) {
    console.warn('Invalid push data format:', error);
    data = {
      title: 'Blood Donor BD',
      body: 'You have a new notification.'
    };
  }
  
  // Extract notification details
  const title = data.title || data.notification?.title || 'Blood Donor BD';
  const body = data.body || data.notification?.body || 'You have a new notification.';
  const icon = data.icon || data.notification?.icon || 'https://i.ibb.co/fd3zk65t/1000018685.jpg';
  const badge = data.badge || data.notification?.badge || 'https://i.ibb.co/fd3zk65t/1000018685.jpg';
  const url = data.url || data.data?.url || '/';
  const tag = data.tag || data.data?.tag || 'blood-donor-notification';
  
  const options = {
    body: body,
    icon: icon,
    badge: badge,
    tag: tag,
    vibrate: [200, 100, 200, 100, 200],
    data: {
      url: url,
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'open',
        title: 'Open App',
        icon: 'https://i.ibb.co/fd3zk65t/1000018685.jpg'
      },
      {
        action: 'close',
        title: 'Dismiss'
      }
    ],
    requireInteraction: false,
    renotify: true
  };
  
  // Show the notification
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click event - handle user interaction
self.addEventListener('notificationclick', function(event) {
  console.log('🔔 Notification clicked:', event);
  
  const notification = event.notification;
  const action = event.action;
  
  // Close the notification
  notification.close();
  
  // Handle action clicks
  if (action === 'close') {
    return;
  }
  
  // Default action - open the app
  event.waitUntil(
    self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(function(clientList) {
      // Get the URL from notification data
      const url = notification.data?.url || '/';
      
      // Check if there's already a client open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes('blooddonor') || client.url.includes('bh.html')) {
          // Focus the existing client
          client.focus();
          // Navigate to the URL
          if (url && url !== '/') {
            client.navigate(url);
          }
          return;
        }
      }
      
      // No client found, open a new one
      return self.clients.openWindow(url);
    })
  );
});

// ============================================
// BACKGROUND SYNC - For offline actions
// ============================================

// Register background sync
self.addEventListener('sync', function(event) {
  if (event.tag === 'sync-notifications') {
    event.waitUntil(syncNotifications());
  }
});

// Function to sync notifications
async function syncNotifications() {
  // This will be called when the user comes back online
  console.log('🔄 Syncing notifications...');
  // You can implement additional logic here
  try {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    console.log(`📦 ${requests.length} items in cache`);
  } catch (error) {
    console.error('Sync error:', error);
  }
}

// ============================================
// SEND NOTIFICATION FROM SERVICE WORKER
// ============================================

// Function to send notification from service worker (for testing)
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SEND_NOTIFICATION') {
    const { title, body, icon, url } = event.data.payload;
    self.registration.showNotification(title, {
      body: body,
      icon: icon || 'https://i.ibb.co/fd3zk65t/1000018685.jpg',
      badge: icon || 'https://i.ibb.co/fd3zk65t/1000018685.jpg',
      data: { url: url || '/' }
    });
  }
});

console.log('📢 Service Worker loaded successfully');
