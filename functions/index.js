const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// Trigger: when a new message is created, increment unreadCounts for all other participants
exports.onMessageCreate = functions.firestore
  .document('conversations/{convoId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    try {
      const msg = snap.data();
      const convoId = context.params.convoId;
      const convoRef = db.collection('conversations').doc(convoId);
      const convoSnap = await convoRef.get();
      if (!convoSnap.exists) return null;
      const convo = convoSnap.data();
      const participants = convo.participants || [];
      const updates = {};
      participants.forEach(pid => {
        if (pid !== msg.senderId) {
          updates[`unreadCounts.${pid}`] = admin.firestore.FieldValue.increment(1);
        }
      });
      updates.lastMessage = msg.text || '';
      updates.lastMessageTime = admin.firestore.FieldValue.serverTimestamp();
      await convoRef.update(updates);
    } catch (err) {
      console.error('onMessageCreate error', err);
    }
    return null;
  });

// Trigger: when a message is updated and its readBy includes a user, ensure unreadCounts for that user is set to 0
exports.onMessageUpdate = functions.firestore
  .document('conversations/{convoId}/messages/{messageId}')
  .onUpdate(async (change, context) => {
    try {
      const before = change.before.data();
      const after = change.after.data();
      const convoId = context.params.convoId;
      const convoRef = db.collection('conversations').doc(convoId);

      // If readBy changed and now includes a user not previously included, zero their unreadCounts if all messages are read
      const prevRead = before.readBy || [];
      const newRead = after.readBy || [];
      const newlyRead = newRead.filter(u => !prevRead.includes(u));
      if (newlyRead.length === 0) return null;

      // For each newly read user, check if there are any messages not read by them; if none, set unreadCounts.<uid> to 0
      for (const uid of newlyRead) {
        const msgsSnap = await db.collection('conversations').doc(convoId).collection('messages').get();
        const hasUnread = msgsSnap.docs.some(d => { const md = d.data(); return !(md.readBy || []).includes(uid) && md.senderId !== uid; });
        if (!hasUnread) {
          await convoRef.update({ [`unreadCounts.${uid}`]: 0 });
        }
      }
    } catch (err) {
      console.error('onMessageUpdate error', err);
    }
    return null;
  });
