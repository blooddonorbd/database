const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();

// ============================================
// 1. SAVE FCM TOKEN
// ============================================
exports.saveFcmToken = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be logged in');
  }

  const { fcmToken, platform } = data;

  if (!fcmToken) {
    throw new functions.https.HttpsError('invalid-argument', 'FCM token is required');
  }

  try {
    await db.collection('users').doc(context.auth.uid).set({
      fcmToken: fcmToken,
      fcmPlatform: platform || 'web',
      fcmUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log('✅ FCM token saved for user:', context.auth.uid);
    return { success: true };

  } catch (error) {
    console.error('❌ Error saving FCM token:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ============================================
// 2. SEND PUSH NOTIFICATION TO SINGLE USER
// ============================================
exports.sendPushNotification = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be logged in');
  }

  const { userId, title, body, type, bloodGroup, requestId } = data;

  try {
    // Get user's FCM token
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new Error('User not found');
    }

    const userData = userDoc.data();
    const fcmToken = userData.fcmToken;

    if (!fcmToken) {
      console.log('⚠️ No FCM token for user:', userId);
      return { success: false, message: 'User has no device token' };
    }

    // Build notification payload
    const payload = {
      notification: {
        title: title || 'Blood Donor BD',
        body: body || 'You have a new notification',
        icon: 'https://i.ibb.co/fd3zk65t/1000018685.jpg',
        badge: 'https://i.ibb.co/fd3zk65t/1000018685.jpg',
        sound: 'default',
        vibrate: [200, 100, 200],
      },
      data: {
        type: type || 'general',
        bloodGroup: bloodGroup || '',
        requestId: requestId || '',
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      webpush: {
        headers: {
          TTL: '86400',
        },
        notification: {
          requireInteraction: true,
          actions: [
            { action: 'open', title: '📱 Open App' },
            { action: 'dismiss', title: '❌ Dismiss' },
          ],
        },
        fcmOptions: {
          link: 'https://blooddonorbd.github.io/database/',
        },
      },
    };

    // Send notification
    const response = await admin.messaging().send({
      token: fcmToken,
      ...payload,
    });

    console.log('✅ Push notification sent:', response);
    return { success: true, messageId: response };

  } catch (error) {
    console.error('❌ Error sending push notification:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ============================================
// 3. BROADCAST TO ALL DONORS
// ============================================
exports.notifyAllDonors = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be logged in');
  }

  const { bloodGroup, district, patientName, hospitalName, contactNumber, requestId } = data;

  try {
    // Build query for eligible donors
    let query = db.collection('users')
      .where('isDonor', '==', true)
      .where('approvalStatus', '==', 'approved')
      .where('fcmToken', '!=', null);

    // Filter by blood group if specified
    if (bloodGroup) {
      query = query.where('bloodGroup', '==', bloodGroup);
    }

    // Filter by district if specified
    if (district) {
      query = query.where('district', '==', district);
    }

    const donorsSnapshot = await query.get();

    if (donorsSnapshot.empty) {
      return { 
        success: false, 
        message: 'No eligible donors found with FCM tokens' 
      };
    }

    // Collect tokens
    const tokens = [];
    donorsSnapshot.forEach(doc => {
      const donor = doc.data();
      if (donor.fcmToken) {
        tokens.push(donor.fcmToken);
      }
    });

    if (tokens.length === 0) {
      return { 
        success: false, 
        message: 'No FCM tokens found for eligible donors' 
      };
    }

    // Build notification payload
    const payload = {
      notification: {
        title: `🩸 ${bloodGroup || 'Blood'} Needed!`,
        body: `Patient: ${patientName || 'Unknown'}\nHospital: ${hospitalName || 'Unknown Hospital'}\nContact: ${contactNumber || 'N/A'}`,
        icon: 'https://i.ibb.co/fd3zk65t/1000018685.jpg',
        badge: 'https://i.ibb.co/fd3zk65t/1000018685.jpg',
        sound: 'default',
        vibrate: [300, 100, 300, 100, 300],
      },
      data: {
        type: 'blood_request',
        bloodGroup: bloodGroup || '',
        requestId: requestId || '',
        district: district || '',
        patientName: patientName || '',
        hospitalName: hospitalName || '',
        contactNumber: contactNumber || '',
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      webpush: {
        headers: {
          TTL: '86400',
        },
        notification: {
          requireInteraction: true,
          actions: [
            { action: 'open', title: '📱 View Request' },
            { action: 'dismiss', title: '❌ Dismiss' },
          ],
        },
        fcmOptions: {
          link: 'https://blooddonorbd.github.io/database/#all-requests',
        },
      },
    };

    // Send in batches (max 500 per batch)
    let sentCount = 0;
    const batchSize = 500;
    
    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize);
      try {
        const response = await admin.messaging().sendEachForMulticast({
          tokens: batch,
          ...payload,
        });
        sentCount += response.successCount;
        console.log(`📨 Sent ${response.successCount} notifications (${i + batch.length}/${tokens.length})`);
      } catch (error) {
        console.error('❌ Batch send error:', error);
      }
    }

    // Log the notification
    await db.collection('notificationLogs').add({
      type: 'blood_request_broadcast',
      bloodGroup: bloodGroup || 'any',
      district: district || 'any',
      recipientCount: sentCount,
      requestId: requestId || '',
      sentBy: context.auth.uid,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { 
      success: true, 
      message: `Notification sent to ${sentCount} donors`,
      totalDonors: tokens.length,
      sentCount: sentCount
    };

  } catch (error) {
    console.error('❌ Error broadcasting notification:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ============================================
// 4. SEND ADMIN ANNOUNCEMENT
// ============================================
exports.sendAdminNotification = functions.https.onCall(async (data, context) => {
  // Check if user is admin
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be logged in');
  }

  // Check admin role
  const userDoc = await db.collection('users').doc(context.auth.uid).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'User not found');
  }

  const userData = userDoc.data();
  const adminRoles = ['main_admin', 'admin', 'moderator'];
  if (!adminRoles.includes(userData.role)) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can send announcements');
  }

  const { title, body, priority } = data;

  if (!title || !body) {
    throw new functions.https.HttpsError('invalid-argument', 'Title and body are required');
  }

  try {
    // Get all users with FCM tokens
    const usersSnapshot = await db.collection('users')
      .where('fcmToken', '!=', null)
      .get();

    const tokens = [];
    usersSnapshot.forEach(doc => {
      const user = doc.data();
      if (user.fcmToken) {
        tokens.push(user.fcmToken);
      }
    });

    if (tokens.length === 0) {
      return { success: false, message: 'No users with FCM tokens' };
    }

    const payload = {
      notification: {
        title: `📢 ${title}`,
        body: body,
        icon: 'https://i.ibb.co/fd3zk65t/1000018685.jpg',
        badge: 'https://i.ibb.co/fd3zk65t/1000018685.jpg',
        sound: 'default',
      },
      data: {
        type: 'admin_notice',
        priority: priority || 'normal',
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      webpush: {
        headers: { TTL: '86400' },
        notification: {
          requireInteraction: priority === 'urgent' ? true : false,
          actions: [
            { action: 'open', title: '📱 Read More' },
            { action: 'dismiss', title: '❌ Dismiss' },
          ],
        },
        fcmOptions: {
          link: 'https://blooddonorbd.github.io/database/#dashboard',
        },
      },
    };

    // Send in batches
    let sentCount = 0;
    const batchSize = 500;
    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize);
      try {
        const response = await admin.messaging().sendEachForMulticast({
          tokens: batch,
          ...payload,
        });
        sentCount += response.successCount;
      } catch (error) {
        console.error('Batch send error:', error);
      }
    }

    // Log announcement
    await db.collection('announcements').add({
      title: title,
      body: body,
      priority: priority || 'normal',
      sentBy: context.auth.uid,
      sentByName: userData.fullName || 'Admin',
      recipientCount: sentCount,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { 
      success: true, 
      message: `Announcement sent to ${sentCount} users`,
      sentCount: sentCount
    };

  } catch (error) {
    console.error('Error sending admin notification:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ============================================
// 5. CHECK NOTIFICATION STATUS
// ============================================
exports.checkNotificationStatus = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be logged in');
  }

  try {
    const userDoc = await db.collection('users').doc(context.auth.uid).get();
    if (!userDoc.exists) {
      return { hasToken: false };
    }

    const userData = userDoc.data();
    return {
      hasToken: !!userData.fcmToken,
      platform: userData.fcmPlatform || 'unknown',
      lastUpdated: userData.fcmUpdatedAt || null
    };
  } catch (error) {
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ============================================
// 6. AUTO-NOTIFY ON NEW BLOOD REQUEST
// ============================================
exports.notifyDonorsOnNewRequest = functions.firestore
  .document('bloodRequests/{requestId}')
  .onCreate(async (snap, context) => {
    const request = snap.data();
    const requestId = context.params.requestId;

    // Skip if already notified
    if (request._notified) return;

    try {
      // Get donors with matching blood group and district
      let query = db.collection('users')
        .where('isDonor', '==', true)
        .where('approvalStatus', '==', 'approved')
        .where('fcmToken', '!=', null)
        .where('bloodGroup', '==', request.bloodGroup);

      // Only filter by district if available
      if (request.district) {
        query = query.where('district', '==', request.district);
      }

      const donorsSnapshot = await query.get();

      if (donorsSnapshot.empty) {
        console.log('No donors found for blood group:', request.bloodGroup);
        return;
      }

      const tokens = [];
      donorsSnapshot.forEach(doc => {
        const donor = doc.data();
        if (donor.fcmToken) {
          tokens.push(donor.fcmToken);
        }
      });

      if (tokens.length === 0) return;

      const payload = {
        notification: {
          title: `🩸 ${request.bloodGroup} Blood Needed!`,
          body: `${request.patientName || 'Patient'} needs ${request.unitsNeeded || 1} unit(s) at ${request.hospitalName || 'Hospital'}`,
          icon: 'https://i.ibb.co/fd3zk65t/1000018685.jpg',
          badge: 'https://i.ibb.co/fd3zk65t/1000018685.jpg',
          sound: 'default',
          vibrate: [300, 100, 300, 100, 300],
        },
        data: {
          type: 'blood_request',
          bloodGroup: request.bloodGroup,
          requestId: requestId,
          district: request.district || '',
          patientName: request.patientName || '',
          hospitalName: request.hospitalName || '',
          contactNumber: request.contactNumber || '',
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
        },
        webpush: {
          headers: { TTL: '86400' },
          notification: {
            requireInteraction: true,
            actions: [
              { action: 'open', title: '📱 Help Now' },
              { action: 'dismiss', title: '❌ Dismiss' },
            ],
          },
          fcmOptions: {
            link: 'https://blooddonorbd.github.io/database/#all-requests',
          },
        },
      };

      let sentCount = 0;
      const batchSize = 500;
      for (let i = 0; i < tokens.length; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);
        try {
          const response = await admin.messaging().sendEachForMulticast({
            tokens: batch,
            ...payload,
          });
          sentCount += response.successCount;
        } catch (error) {
          console.error('Batch send error:', error);
        }
      }

      // Mark as notified
      await db.collection('bloodRequests').doc(requestId).update({
        _notified: true,
        _notifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        _notificationCount: sentCount
      });

      console.log(`✅ Auto-notified ${sentCount} donors for request ${requestId}`);

    } catch (error) {
      console.error('❌ Error auto-notifying donors:', error);
    }
  });

// ============================================
// 7. CLEANUP EXPIRED TOKENS (Daily)
// ============================================
exports.cleanupExpiredTokens = functions.pubsub
  .schedule('0 0 * * *')
  .timeZone('Asia/Dhaka')
  .onRun(async (context) => {
    console.log('🧹 Running token cleanup...');

    try {
      const usersSnapshot = await db.collection('users')
        .where('fcmToken', '!=', null)
        .get();

      let cleaned = 0;
      
      for (const doc of usersSnapshot.docs) {
        const user = doc.data();
        const token = user.fcmToken;
        
        try {
          // Try to send a silent test message
          await admin.messaging().send({
            token: token,
            data: { type: 'ping' },
            android: { priority: 'normal' },
            apns: { headers: { 'apns-priority': '5' } }
          });
        } catch (error) {
          // If token is invalid, remove it
          if (error.code === 'messaging/invalid-registration-token' ||
              error.code === 'messaging/registration-token-not-registered') {
            await db.collection('users').doc(doc.id).update({
              fcmToken: null,
              fcmTokenInvalid: true,
              fcmTokenInvalidAt: admin.firestore.FieldValue.serverTimestamp()
            });
            cleaned++;
          }
        }
      }

      console.log(`✅ Cleaned ${cleaned} invalid tokens`);
      return null;

    } catch (error) {
      console.error('❌ Error cleaning tokens:', error);
      return null;
    }
  });
