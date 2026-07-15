// functions.js - Client-side wrapper for Firebase Cloud Functions

// Initialize Firebase Functions
const functions = firebase.functions();

// ============================================
// SAVE FCM TOKEN
// ============================================
async function saveFcmToken(fcmToken) {
    try {
        const saveTokenFunction = functions.httpsCallable('saveFcmToken');
        const result = await saveTokenFunction({
            fcmToken: fcmToken,
            platform: 'web'
        });
        console.log('FCM token saved successfully');
        return result.data;
    } catch (error) {
        console.error('Error saving FCM token:', error);
        
        // Fallback: Save directly to Firestore
        try {
            const user = firebase.auth().currentUser;
            if (user) {
                await firebase.firestore().collection('users').doc(user.uid).update({
                    fcmToken: fcmToken,
                    fcmPlatform: 'web',
                    fcmUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                console.log('FCM token saved directly to Firestore');
                return { success: true };
            }
        } catch (fallbackError) {
            console.error('Fallback save failed:', fallbackError);
        }
        return { success: false };
    }
}

// ============================================
// SEND NOTIFICATION TO SPECIFIC USER
// ============================================
async function sendNotificationToUser(userId, title, body, type = 'general', extraData = {}) {
    try {
        const sendNotification = functions.httpsCallable('sendPushNotification');
        const result = await sendNotification({
            userId: userId,
            title: title,
            body: body,
            type: type,
            ...extraData
        });
        return result.data;
    } catch (error) {
        console.error('Error sending notification:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// BROADCAST TO ALL DONORS
// ============================================
async function broadcastToDonors(bloodGroup, district, patientName, hospitalName, contactNumber, requestId = '') {
    try {
        const notifyDonors = functions.httpsCallable('notifyAllDonors');
        const result = await notifyDonors({
            bloodGroup: bloodGroup,
            district: district,
            patientName: patientName,
            hospitalName: hospitalName,
            contactNumber: contactNumber,
            requestId: requestId
        });
        return result.data;
    } catch (error) {
        console.error('Error broadcasting:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// SEND ADMIN NOTIFICATION TO ALL USERS
// ============================================
async function sendAdminNotification(title, body, priority = 'normal') {
    try {
        const adminNotify = functions.httpsCallable('sendAdminNotification');
        const result = await adminNotify({
            title: title,
            body: body,
            priority: priority
        });
        return result.data;
    } catch (error) {
        console.error('Error sending admin notification:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// CHECK NOTIFICATION STATUS
// ============================================
async function checkNotificationStatus() {
    try {
        const checkStatus = functions.httpsCallable('checkNotificationStatus');
        const result = await checkStatus({});
        return result.data;
    } catch (error) {
        console.error('Error checking notification status:', error);
        return { success: false, error: error.message };
    }
}

// Export functions globally
window.saveFcmToken = saveFcmToken;
window.sendNotificationToUser = sendNotificationToUser;
window.broadcastToDonors = broadcastToDonors;
window.sendAdminNotification = sendAdminNotification;
window.checkNotificationStatus = checkNotificationStatus;
