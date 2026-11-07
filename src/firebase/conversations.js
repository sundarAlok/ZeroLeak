import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where
} from 'firebase/firestore';

export const getOrCreateDirectConversation = async (db, currentUserId, targetUserId) => {
  if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
    throw new Error('Two different signed-in users are required to start a conversation.');
  }

  const conversationsQuery = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', currentUserId)
  );
  const snapshot = await getDocs(conversationsQuery);
  const existingConversation = snapshot.docs.find(document => {
    const data = document.data();
    return !data.isGroup
      && data.participants?.length === 2
      && data.participants.includes(targetUserId);
  });

  if (existingConversation) return existingConversation.id;

  const participants = [currentUserId, targetUserId].sort();
  const conversationId = `dm_${participants.map(id => `${id.length}_${id}`).join('_')}`;
  const conversationRef = doc(db, 'conversations', conversationId);

  await runTransaction(db, async transaction => {
    const existing = await transaction.get(conversationRef);
    if (existing.exists()) return;

    transaction.set(conversationRef, {
      participants,
      isGroup: false,
      lastMessage: '',
      lastMessageTime: serverTimestamp(),
      createdAt: serverTimestamp(),
      pinned: false,
      blockedBy: null,
      locked: false,
      unreadCounts: {
        [currentUserId]: 0,
        [targetUserId]: 0
      }
    });
  });

  return conversationId;
};
