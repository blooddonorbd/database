// ============================================
// 🔒 CONFIGURATION FILE - DO NOT COMMIT TO GIT
// ============================================

// Firebase Configuration
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCnky8bzx3KuFoujU5DSlLRYSZgiAF8840",
  authDomain: "blood-donor-bd-2025.firebaseapp.com",
  projectId: "blood-donor-bd-2025",
  storageBucket: "blood-donor-bd-2025.firebasestorage.app",
  messagingSenderId: "271945142840",
  appId: "1:271945142840:web:b0edefddb55cac5f604ccd",
  measurementId: "G-28KGSJREBR"
};

// ImgBB API Key
const IMGBB_API_KEY = '54ffbc26529e5d05fa5cffad23712429';

// VAPID Public Key for Push Notifications
const VAPID_PUBLIC_KEY = "BHMKtlvzLGDuNh6eat6tR8uBQjYrN4otniIbhY2nNkBCPGU5I4L8B9JNSXHNNUB34Wv47YqZjirTmYex3sg9UTk";

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FIREBASE_CONFIG, IMGBB_API_KEY, VAPID_PUBLIC_KEY };
}
