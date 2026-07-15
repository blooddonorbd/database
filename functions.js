const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(require('./service-account.json')),
});

const db = admin.firestore();

// ============================================
// SEND PUSH NOTIFICATION (Single User)
// ============================================
exports.sendPushNotification = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
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
      console.log('No FCM token for user:', userId);
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
            { action: 'open', title: 'Open App' },
            { action: 'dismiss', title: 'Dismiss' },
          ],
        },
        fcmOptions: {
          link: 'https://blooddonorbd.com',
        },
      },
    };

    // Send notification
    const response = await admin.messaging().send({
      token: fcmToken,
      ...payload,
    });

    console.log('Push notification sent:', response);
    return { success: true, messageId: response };

  } catch (error) {
    console.error('Error sending push notification:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ============================================
// SEND NOTIFICATION TO ALL DONORS (Blood Request Alert)
// ============================================
exports.notifyAllDonors = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be logged in');
  }

  const { bloodGroup, district, patientName, hospitalName, contactNumber } = data;

  try {
    // Get all approved donors who have FCM tokens
    const donorsSnapshot = await db.collection('users')
      .where('isDonor', '==', true)
      .where('approvalStatus', '==', 'approved')
      .where('fcmToken', '!=', null)
      .get();

    if (donorsSnapshot.empty) {
      return { success: false, message: 'No eligible donors found' };
    }

    // Filter by blood group if specified
    let tokens = [];
    donorsSnapshot.forEach(doc => {
      const donor = doc.data();
      // Only send to matching blood group if specified
      if (bloodGroup && donor.bloodGroup !== bloodGroup) return;
      
      // Only send to same district if specified
      if (district && donor.district !== district) return;
      
      if (donor.fcmToken) {
        tokens.push(donor.fcmToken);
      }
    });

    if (tokens.length === 0) {
      return { success: false, message: 'No eligible donors found in this area' };
    }

    // Build notification payload
    const payload = {
      notification: {
        title: `🩸 Urgent Blood Request: ${bloodGroup || 'Blood'} Needed!`,
        body: `Patient: ${patientName || 'Unknown'} at ${hospitalName || 'Unknown Hospital'}\nContact: ${contactNumber || 'N/A'}`,
        icon: 'https://i.ibb.co/fd3zk65t/1000018685.jpg',
        badge: 'https://i.ibb.co/fd3zk65t/1000018685.jpg',
        sound: 'default',
        vibrate: [300, 100, 300, 100, 300],
      },
      data: {
        type: 'blood_request',
        bloodGroup: bloodGroup || '',
        requestId: data.requestId || '',
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
            { action: 'open', title: 'View Request' },
            { action: 'dismiss', title: 'Dismiss' },
          ],
        },
        fcmOptions: {
          link: 'https://blooddonorbd.com/#all-requests',
        },
      },
    };

    // Send to all tokens (max 500 per batch)
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
        console.log(`Sent ${response.successCount} notifications (${i + batch.length}/${tokens.length})`);
      } catch (error) {
        console.error('Batch send error:', error);
      }
    }

    // Log the notification
    await db.collection('notificationLogs').add({
      type: 'blood_request_broadcast',
      bloodGroup: bloodGroup || 'any',
      district: district || 'any',
      recipientCount: sentCount,
      requestId: data.requestId || '',
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
    console.error('Error broadcasting notification:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ============================================
// SAVE FCM TOKEN (Called from client)
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
    await db.collection('users').doc(context.auth.uid).update({
      fcmToken: fcmToken,
      fcmPlatform: platform || 'web',
      fcmUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('FCM token saved for user:', context.auth.uid);
    return { success: true };

  } catch (error) {
    console.error('Error saving FCM token:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ============================================
// NOTIFY ON NEW BLOOD REQUEST (Auto-trigger)
// ============================================
exports.notifyDonorsOnNewRequest = functions.firestore
  .document('bloodRequests/{requestId}')
  .onCreate(async (snap, context) => {
    const request = snap.data();
    const requestId = context.params.requestId;

    try {
      // Get all approved donors with matching blood group
      const donorsSnapshot = await db.collection('users')
        .where('isDonor', '==', true)
        .where('approvalStatus', '==', 'approved')
        .where('bloodGroup', '==', request.bloodGroup)
        .where('district', '==', request.district || '')
        .where('fcmToken', '!=', null)
        .get();

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

      if (tokens.length === 0) {
        console.log('No FCM tokens found for donors');
        return;
      }

      // Build notification payload
      const payload = {
        notification: {
          title: `🩸 ${request.bloodGroup} Blood Needed!`,
          body: `Patient: ${request.patientName}\nHospital: ${request.hospitalName}\nContact: ${request.contactNumber}`,
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
              { action: 'open', title: 'View Request' },
              { action: 'dismiss', title: 'Dismiss' },
            ],
          },
          fcmOptions: {
            link: 'https://blooddonorbd.com/#all-requests',
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

      console.log(`Auto-notified ${sentCount} donors for request ${requestId}`);

      // Log notification
      await db.collection('notificationLogs').add({
        type: 'auto_blood_request',
        requestId: requestId,
        bloodGroup: request.bloodGroup,
        recipientCount: sentCount,
        triggeredBy: request.requesterUid || 'system',
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    } catch (error) {
      console.error('Error auto-notifying donors:', error);
    }
  });

// ============================================
// NOTIFY ON NEW PRIVATE MESSAGE
// ============================================
exports.notifyOnPrivateMessage = functions.firestore
  .document('privateMessages/{conversationId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const message = snap.data();
    const conversationId = context.params.conversationId;

    // Only send notification if message is not from the receiver
    if (!message.receiverId) return;

    try {
      // Get receiver's FCM token
      const userDoc = await db.collection('users').doc(message.receiverId).get();
      if (!userDoc.exists) return;

      const userData = userDoc.data();
      const fcmToken = userData.fcmToken;

      if (!fcmToken) return;

      // Get sender's name
      const senderDoc = await db.collection('users').doc(message.senderId).get();
      const senderName = senderDoc.exists ? senderDoc.data().fullName : 'Someone';

      // Get conversation for unread count
      const convDoc = await db.collection('privateMessages').doc(conversationId).get();
      const unreadCount = convDoc.exists ? (convDoc.data().unread?.[message.receiverId] || 0) : 0;

      const payload = {
        notification: {
          title: `💬 New message from ${senderName}`,
          body: message.message || 'You have a new message',
          icon: 'https://i.ibb.co/fd3zk65t/1000018685.jpg',
          badge: 'https://i.ibb.co/fd3zk65t/1000018685.jpg',
          sound: 'default',
        },
        data: {
          type: 'private_message',
          conversationId: conversationId,
          senderId: message.senderId,
          messageId: context.params.messageId,
          unreadCount: String(unreadCount),
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
        },
        webpush: {
          headers: { TTL: '86400' },
          notification: {
            requireInteraction: true,
            actions: [
              { action: 'open', title: 'Reply' },
              { action: 'dismiss', title: 'Dismiss' },
            ],
          },
          fcmOptions: {
            link: 'https://blooddonorbd.com/#dm-donor',
          },
        },
      };

      await admin.messaging().send({
        token: fcmToken,
        ...payload,
      });

      console.log('Private message notification sent to:', message.receiverId);

    } catch (error) {
      console.error('Error sending private message notification:', error);
    }
  });
