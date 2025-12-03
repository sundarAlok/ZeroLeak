const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// Triggered when a new message document is created under a conversation
exports.onMessageCreateIncrementUnread = functions.firestore
  .document('conversations/{convoId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const { convoId } = context.params;
    const msg = snap.data();
    if (!msg) return null;

    const senderId = msg.senderId;

    const convoRef = db.collection('conversations').doc(convoId);
    const convoSnap = await convoRef.get();
    if (!convoSnap.exists) return null;

    const convo = convoSnap.data();
    const participants = convo.participants || [];

    const updates = {};
    participants.forEach(pid => {
      if (pid === senderId) return; // don't increment sender's unread
      updates[`unreadCounts.${pid}`] = admin.firestore.FieldValue.increment(1);
    });

    if (Object.keys(updates).length > 0) {
      await convoRef.update({
        lastMessage: msg.text || '',
        lastMessageTime: admin.firestore.FieldValue.serverTimestamp(),
        ...updates
      });
    }

    return null;
  });
