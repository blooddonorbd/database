// Import Firebase scripts (must match the versions in your HTML)
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize Firebase App
firebase.initializeApp({
  apiKey: "AIzaSyCnky8bzx3KuFoujU5DSlLRYSZgiAF8840",
  authDomain: "blood-donor-bd-2025.firebaseapp.com",
  projectId: "blood-donor-bd-2025",
  storageBucket: "blood-donor-bd-2025.firebasestorage.app",
  messagingSenderId: "271945142840",
  appId: "1:271945142840:web:b0edefddb55cac5f604ccd"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title || 'Blood Donor BD';
  const notificationOptions = {
    body: payload.notification.body,
    icon: 'https://i.ibb.co/fd3zk65t/1000018685.jpg', // Your app icon
    badge: 'https://i.ibb.co/fd3zk65t/1000018685.jpg',
    data: payload.data,
    vibrate: [200, 100, 200]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
