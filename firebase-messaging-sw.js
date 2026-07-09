// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyCnky8bzx3KuFoujU5DSlLRYSZgiAF8840",
  authDomain: "blood-donor-bd-2025.firebaseapp.com",
  projectId: "blood-donor-bd-2025",
  storageBucket: "blood-donor-bd-2025.firebasestorage.app",
  messagingSenderId: "271945142840",
  appId: "1:271945142840:web:b0edefddb55cac5f604ccd"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('📨 Background message:', payload);
  
  const notificationTitle = payload.data?.title || payload.notification?.title || 'Blood Donor BD';
  const notificationOptions = {
    body: payload.data?.body || payload.notification?.body || 'New notification',
    icon: 'https://i.ibb.co/fd3zk65t/1000018685.jpg',
    badge: 'https://i.ibb.co/fd3zk65t/1000018685.jpg',
    vibrate: [200, 100, 200],
    data: payload.data || {},
    actions: [
      {
        action: 'view',
        title: 'View Now'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const data = event.notification.data || {};
  const url = data.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        for (const client of windowClients) {
          if (client.url.includes(url) && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});
