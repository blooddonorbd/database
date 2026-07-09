// functions/index.js - Cloud Functions for Push Notifications

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const webpush = require('web-push');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

const db = admin.firestore();

// ============================================
// VAPID KEYS - Use the same as in your client
// ============================================
const VAPID_PUBLIC_KEY = "BHMKtlvzLGDuNh6eat6tR8uBQjYrN4otniIbhY2nNkBCPGU5I4L8B9JNSXHNNUB34Wv47YqZjirTmYex3sg9UTk";
const VAPID_PRIVATE_KEY = "YOUR_VAPID_PRIVATE_KEY"; // ⚠️ IMPORTANT: Replace with your actual private key

// Set VAPID details for web-push
webpush.setVapidDetails(
  'mailto:blooddonorbd025@gmail.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// ============================================
// 1. PROCESS PUSH QUEUE - Firestore Trigger
// ============================================
exports.processPushQueue = functions.firestore
  .document('pushQueue/{queueId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const queueId = context.params.queueId;
    
    console.log(`📤 Processing push queue item: ${queueId}`);
    console.log(`📋 Data:`, JSON.stringify(data, null, 2));
    
    // Don't process if already sent or has too many retries
    if (data.status === 'sent') {
      console.log('⏩ Already sent, skipping');
      return;
    }
    
    if (data.retries >= 5) {
      console.log('❌ Max retries reached, marking as failed');
      await snap.ref.update({ 
        status: 'failed',
        error: 'Max retries reached'
      });
      return;
    }

    try {
      let sent = false;
      
      // Try FCM first
      if (data.fcmToken) {
        console.log('📱 Sending via FCM...');
        try {
          await sendFCMNotification(data.fcmToken, data.title, data.body, data.data);
          sent = true;
          console.log('✅ FCM sent successfully');
        } catch (fcmError) {
          console.warn('⚠️ FCM failed, trying WebPush:', fcmError.message);
        }
      }
      
      // If FCM failed or not available, try WebPush
      if (!sent && data.pushSubscription) {
        console.log('🌐 Sending via WebPush...');
        try {
          await sendWebPushNotification(
            data.pushSubscription,
            data.title,
            data.body,
            data.data
          );
          sent = true;
          console.log('✅ WebPush sent successfully');
        } catch (webPushError) {
          console.warn('⚠️ WebPush failed:', webPushError.message);
        }
      }
      
      // Update status
      if (sent) {
        await snap.ref.update({
          status: 'sent',
          sentAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✅ Push notification sent for queue: ${queueId}`);
      } else {
        // Increment retries
        await snap.ref.update({
          retries: admin.firestore.FieldValue.increment(1),
          lastError: 'No delivery method available',
          status: 'retry'
        });
        console.log(`🔄 Retry scheduled (${data.retries + 1}/5) for queue: ${queueId}`);
      }
      
    } catch (error) {
      console.error(`❌ Error processing queue ${queueId}:`, error);
      
      // Increment retries on error
      await snap.ref.update({
        retries: admin.firestore.FieldValue.increment(1),
        lastError: error.message || 'Unknown error',
        status: 'retry'
      });
    }
  });

// ============================================
// 2. SEND FCM NOTIFICATION
// ============================================
async function sendFCMNotification(token, title, body, data = {}) {
  const payload = {
    notification: {
      title: title,
      body: body,
      sound: 'default',
      badge: '1',
      click_action: 'https://blooddonorbd.com'
    },
    data: {
      ...data,
      title: title,
      body: body,
      click_action: 'https://blooddonorbd.com'
    },
    token: token
  };
  
  try {
    const response = await admin.messaging().send(payload);
    console.log('✅ FCM Response:', response);
    return response;
  } catch (error) {
    console.error('❌ FCM Error:', error);
    
    // Handle specific FCM errors
    if (error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered') {
      // Token is invalid, remove it from user document
      await removeInvalidToken(token);
    }
    
    throw error;
  }
}

// ============================================
// 3. SEND WEB PUSH NOTIFICATION
// ============================================
async function sendWebPushNotification(subscription, title, body, data = {}) {
  const payload = JSON.stringify({
    title: title,
    body: body,
    url: data.url || '/',
    icon: data.icon || 'https://i.ibb.co/fd3zk65t/1000018685.jpg',
    badge: data.badge || 'https://i.ibb.co/fd3zk65t/1000018685.jpg',
    ...data
  });
  
  const options = {
    TTL: 86400, // 24 hours
    urgency: 'normal',
    vapidDetails: {
      subject: 'mailto:blooddonorbd025@gmail.com',
      publicKey: VAPID_PUBLIC_KEY,
      privateKey: VAPID_PRIVATE_KEY
    }
  };
  
  try {
    const response = await webpush.sendNotification(
      subscription,
      payload,
      options
    );
    console.log('✅ WebPush Response:', response);
    return response;
  } catch (error) {
    console.error('❌ WebPush Error:', error);
    
    // If subscription is invalid, remove it
    if (error.statusCode === 410 || error.statusCode === 404) {
      await removeInvalidSubscription(subscription);
    }
    
    throw error;
  }
}

// ============================================
// 4. HELPER FUNCTIONS - Remove Invalid Tokens
// ============================================
async function removeInvalidToken(token) {
  try {
    // Find user with this token and remove it
    const usersSnapshot = await db.collection('users')
      .where('fcmToken', '==', token)
      .get();
    
    const batch = db.batch();
    usersSnapshot.forEach(doc => {
      batch.update(doc.ref, {
        fcmToken: null,
        pushEnabled: false
      });
    });
    
    await batch.commit();
    console.log('🧹 Removed invalid FCM token from user(s)');
  } catch (error) {
    console.error('Error removing invalid token:', error);
  }
}

async function removeInvalidSubscription(subscription) {
  try {
    // Find user with this subscription and remove it
    const usersSnapshot = await db.collection('users')
      .where('pushSubscription.endpoint', '==', subscription.endpoint)
      .get();
    
    const batch = db.batch();
    usersSnapshot.forEach(doc => {
      batch.update(doc.ref, {
        pushSubscription: null,
        pushEnabled: false
      });
    });
    
    await batch.commit();
    console.log('🧹 Removed invalid WebPush subscription from user(s)');
  } catch (error) {
    console.error('Error removing invalid subscription:', error);
  }
}

// ============================================
// 5. SCHEDULED JOB - Clean old notifications
// ============================================
exports.cleanOldNotifications = functions.pubsub
  .schedule('0 0 * * *') // Runs at midnight every day
  .onRun(async (context) => {
    console.log('🧹 Starting old notifications cleanup...');
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    try {
      // Get notifications older than 30 days
      const snapshot = await db.collection('notifications')
        .where('createdAt', '<', thirtyDaysAgo)
        .get();
      
      if (snapshot.empty) {
        console.log('ℹ️ No old notifications to clean up');
        return;
      }
      
      // Delete in batches
      const batch = db.batch();
      let count = 0;
      
      snapshot.forEach(doc => {
        batch.delete(doc.ref);
        count++;
        
        // Commit in batches of 500
        if (count >= 500) {
          batch.commit();
          count = 0;
        }
      });
      
      if (count > 0) {
        await batch.commit();
      }
      
      console.log(`🧹 Cleaned up ${snapshot.size} old notifications`);
    } catch (error) {
      console.error('❌ Cleanup error:', error);
    }
  });

// ============================================
// 6. SEND BULK NOTIFICATIONS
// ============================================
exports.sendBulkNotifications = functions.https.onCall(async (data, context) => {
  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated'
    );
  }
  
  // Check admin role
  const userDoc = await db.collection('users').doc(context.auth.uid).get();
  const user = userDoc.data();
  
  if (!user || (user.role !== 'admin' && user.role !== 'main_admin')) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Admin access required'
    );
  }
  
  const { title, body, targetUsers, data: extraData } = data;
  
  if (!title || !body) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Title and body are required'
    );
  }
  
  try {
    let userList = [];
    
    // If specific users provided, send to them
    if (targetUsers && targetUsers.length > 0) {
      const userPromises = targetUsers.map(uid => 
        db.collection('users').doc(uid).get()
      );
      const userDocs = await Promise.all(userPromises);
      userList = userDocs
        .filter(doc => doc.exists)
        .map(doc => ({ id: doc.id, ...doc.data() }));
    } else {
      // Send to all users
      const snapshot = await db.collection('users')
        .where('pushEnabled', '==', true)
        .get();
      userList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    
    console.log(`📤 Sending bulk notification to ${userList.length} users`);
    
    // Queue notifications for each user
    const batch = db.batch();
    const notificationData = {
      title: title,
      body: body,
      data: extraData || {},
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    for (const user of userList) {
      // Create notification document
      const notifRef = db.collection('notifications').doc();
      batch.set(notifRef, {
        userId: user.id,
        ...notificationData
      });
      
      // Queue push notification
      const queueRef = db.collection('pushQueue').doc();
      batch.set(queueRef, {
        userId: user.id,
        notificationId: notifRef.id,
        title: title,
        body: body,
        data: extraData || {},
        fcmToken: user.fcmToken || null,
        pushSubscription: user.pushSubscription || null,
        status: 'pending',
        type: user.pushType || 'fcm',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        retries: 0
      });
    }
    
    await batch.commit();
    
    return {
      success: true,
      message: `Queued notifications for ${userList.length} users`
    };
    
  } catch (error) {
    console.error('❌ Bulk notification error:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to send bulk notifications'
    );
  }
});

console.log('🚀 Cloud Functions for Push Notifications loaded');
