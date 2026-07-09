// firebase-messaging-sw.js - Firebase Cloud Messaging Service Worker

// Import Firebase SDK
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize Firebase
firebase.initializeApp({
  apiKey: "AIzaSyCnky8bzx3KuFoujU5DSlLRYSZgiAF8840",
  authDomain: "blood-donor-bd-2025.firebaseapp.com",
  projectId: "blood-donor-bd-2025",
  storageBucket: "blood-donor-bd-2025.firebasestorage.app",
  messagingSenderId: "271945142840",
  appId: "1:271945142840:web:b0edefddb55cac5f604ccd"
});

// Get messaging instance
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage(function(payload) {
  console.log('📨 Background message received:', payload);
  
  // Extract notification details
  const notificationTitle = payload.notification?.title || payload.data?.title || 'Blood Donor BD';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'You have a new notification.',
    icon: payload.notification?.icon || payload.data?.icon || 'https://i.ibb.co/fd3zk65t/1000018685.jpg',
    badge: payload.notification?.badge || payload.data?.badge || 'https://i.ibb.co/fd3zk65t/1000018685.jpg',
    vibrate: [200, 100, 200],
    data: {
      url: payload.data?.url || payload.fcmOptions?.link || '/',
      ...payload.data
    },
    actions: [
      {
        action: 'open',
        title: 'Open App'
      }
    ],
    requireInteraction: false
  };
  
  // Show notification
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
  console.log('🔔 FCM notification clicked:', event);
  
  const notification = event.notification;
  notification.close();
  
  const url = notification.data?.url || '/';
  
  event.waitUntil(
    self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(function(clientList) {
      // Check if there's already a client open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes('blooddonor') || client.url.includes('bh.html')) {
          client.focus();
          if (url !== '/') {
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

console.log('📢 FCM Service Worker loaded');
