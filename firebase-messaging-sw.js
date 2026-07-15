// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Your Firebase config (same as in index.html)
const firebaseConfig = {
  apiKey: "AIzaSyCnky8bzx3KuFoujU5DSlLRYSZgiAF8840",
  authDomain: "blood-donor-bd-2025.firebaseapp.com",
  projectId: "blood-donor-bd-2025",
  storageBucket: "blood-donor-bd-2025.firebasestorage.app",
  messagingSenderId: "271945142840",
  appId: "1:271945142840:web:b0edefddb55cac5f604ccd",
  measurementId: "G-28KGSJREBR"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw] Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'Blood Donor BD';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: payload.notification?.icon || 'https://i.ibb.co/fd3zk65t/1000018685.jpg',
    badge: payload.notification?.badge || 'https://i.ibb.co/fd3zk65t/1000018685.jpg',
    vibrate: [200, 100, 200],
    data: payload.data || {},
    actions: [
      { action: 'open', title: '📱 Open App' },
      { action: 'dismiss', title: '❌ Dismiss' }
    ],
    requireInteraction: true,
    tag: 'blood-donor-bd-notification',
    renotify: true
  };

  // Show notification
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let url = 'https://blooddonorbd.github.io/database/';

  // Route based on notification type
  if (data.type === 'blood_request') {
    url = 'https://blooddonorbd.github.io/database/#all-requests';
  } else if (data.type === 'private_message') {
    url = 'https://blooddonorbd.github.io/database/#dm-donor';
  } else if (data.type === 'admin_notice') {
    url = 'https://blooddonorbd.github.io/database/#dashboard';
  } else if (data.type === 'certificate') {
    url = 'https://blooddonorbd.github.io/database/#certificates';
  } else if (data.action === 'open') {
    url = 'https://blooddonorbd.github.io/database/';
  }

  // Open the URL
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Check if there's already a window/tab open with the target URL
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        // If not, open a new window/tab
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event.notification);
});

// Service Worker install/activate
self.addEventListener('install', (event) => {
  console.log('[firebase-messaging-sw] Service Worker installed');
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  console.log('[firebase-messaging-sw] Service Worker activated');
  event.waitUntil(self.clients.claim());
});
