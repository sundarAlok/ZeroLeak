/**
 * Real-time Service - WebSocket-based Real-time Communication
 * Uses Firebase Realtime Database for instant messaging and presence
 */

import { rtdb } from '../firebase/firebase';
import { 
  ref as rtdbRef, 
  onValue, 
  set as rtdbSet, 
  update as rtdbUpdate,
  remove as rtdbRemove,
  serverTimestamp as rtdbServerTimestamp, 
  onDisconnect,
  get as rtdbGet
} from 'firebase/database';

// ============================================================================
// PRESENCE SERVICE - User Online/Offline Status
// ============================================================================

/**
 * Set user as online with real-time presence
 * Auto-disconnects when user leaves
 */
export const setUserOnline = (userId) => {
  if (!userId || !rtdb) return null;
  
  try {
    const statusRef = rtdbRef(rtdb, `status/${userId}`);
    
    // Set as online
    rtdbSet(statusRef, {
      state: 'online',
      lastChanged: rtdbServerTimestamp(),
      lastActive: rtdbServerTimestamp()
    });
    
    // Auto set offline when disconnected
    onDisconnect(statusRef).set({
      state: 'offline',
      lastChanged: rtdbServerTimestamp(),
      lastActive: rtdbServerTimestamp()
    });
    
    console.log(`✓ User ${userId} set to online`);
    return statusRef;
  } catch (err) {
    console.warn('Error setting user online:', err);
    return null;
  }
};

/**
 * Set user as offline
 */
export const setUserOffline = (userId) => {
  if (!userId || !rtdb) return;
  
  try {
    const statusRef = rtdbRef(rtdb, `status/${userId}`);
    rtdbSet(statusRef, {
      state: 'offline',
      lastChanged: rtdbServerTimestamp(),
      lastActive: rtdbServerTimestamp()
    });
  } catch (err) {
    console.warn('Error setting user offline:', err);
  }
};

/**
 * Subscribe to user's online status
 */
export const subscribeToUserStatus = (userId, callback) => {
  if (!userId || !rtdb || !callback) return null;
  
  try {
    const statusRef = rtdbRef(rtdb, `status/${userId}`);
    
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const data = snapshot.val();
      callback({
        userId,
        isOnline: data?.state === 'online',
        lastChanged: data?.lastChanged,
        lastActive: data?.lastActive
      });
    }, (err) => {
      console.warn(`Error subscribing to status of ${userId}:`, err);
      callback({ userId, isOnline: false, error: err });
    });
    
    return unsubscribe;
  } catch (err) {
    console.warn('Error subscribing to user status:', err);
    return null;
  }
};

/**
 * Get multiple users' status at once
 */
export const subscribeToMultipleUsersStatus = (userIds, callback) => {
  if (!userIds || !Array.isArray(userIds) || !rtdb || !callback) return [];
  
  const unsubscribers = userIds.map(userId => 
    subscribeToUserStatus(userId, callback)
  );
  
  return unsubscribers;
};

// ============================================================================
// MESSAGE DELIVERY SERVICE - Real-time Message Notifications
// ============================================================================

/**
 * Listen for new messages in a conversation (real-time)
 */
export const subscribeToConversationMessages = (conversationId, userId, callback) => {
  if (!conversationId || !userId || !rtdb || !callback) return null;
  
  try {
    const messagesRef = rtdbRef(rtdb, `messages/${conversationId}`);
    
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Convert to array and send latest messages
        const messages = Object.entries(data).map(([key, msg]) => ({
          id: key,
          ...msg
        }));
        
        // Filter unread messages for current user
        const unreadMessages = messages.filter(msg => 
          msg.senderId !== userId && 
          (!msg.readBy || !msg.readBy.includes(userId))
        );
        
        callback({
          conversationId,
          allMessages: messages,
          unreadMessages,
          count: messages.length
        });
      } else {
        callback({
          conversationId,
          allMessages: [],
          unreadMessages: [],
          count: 0
        });
      }
    }, (err) => {
      console.warn(`Error subscribing to messages in ${conversationId}:`, err);
    });
    
    return unsubscribe;
  } catch (err) {
    console.warn('Error subscribing to conversation messages:', err);
    return null;
  }
};

/**
 * Mark message as delivered (real-time notification)
 */
export const markMessageDelivered = (conversationId, messageId, userId) => {
  if (!conversationId || !messageId || !userId || !rtdb) return;
  
  try {
    const messageRef = rtdbRef(rtdb, `messages/${conversationId}/${messageId}`);
    rtdbUpdate(messageRef, {
      deliveredTo: {
        [userId]: true,
        updatedAt: rtdbServerTimestamp()
      }
    });
  } catch (err) {
    console.warn('Error marking message delivered:', err);
  }
};

/**
 * Mark message as read (real-time notification)
 */
export const markMessageRead = (conversationId, messageId, userId) => {
  if (!conversationId || !messageId || !userId || !rtdb) return;
  
  try {
    const messageRef = rtdbRef(rtdb, `messages/${conversationId}/${messageId}`);
    rtdbUpdate(messageRef, {
      readBy: {
        [userId]: true,
        readAt: rtdbServerTimestamp()
      }
    });
  } catch (err) {
    console.warn('Error marking message read:', err);
  }
};

// ============================================================================
// TYPING INDICATOR SERVICE - Real-time Typing Notifications
// ============================================================================

/**
 * Set typing indicator for a user in a conversation
 */
export const setTypingIndicator = (conversationId, userId, isTyping = true) => {
  if (!conversationId || !userId || !rtdb) return;
  
  try {
    const typingRef = rtdbRef(rtdb, `typing/${conversationId}/${userId}`);
    
    if (isTyping) {
      rtdbSet(typingRef, {
        typing: true,
        timestamp: rtdbServerTimestamp()
      });
      
      // Auto-remove typing indicator after 5 seconds
      setTimeout(() => {
        try {
          rtdbRemove(typingRef);
        } catch (err) {
          console.warn('Error removing typing indicator:', err);
        }
      }, 5000);
    } else {
      rtdbRemove(typingRef);
    }
  } catch (err) {
    console.warn('Error setting typing indicator:', err);
  }
};

/**
 * Subscribe to typing indicators in a conversation
 */
export const subscribeToTypingIndicators = (conversationId, userId, callback) => {
  if (!conversationId || !userId || !rtdb || !callback) return null;
  
  try {
    const typingRef = rtdbRef(rtdb, `typing/${conversationId}`);
    
    const unsubscribe = onValue(typingRef, (snapshot) => {
      const data = snapshot.val();
      
      if (data) {
        const typingUsers = Object.entries(data)
          .filter(([uid]) => uid !== userId) // Exclude current user
          .map(([uid, info]) => ({
            userId: uid,
            isTyping: info.typing === true,
            timestamp: info.timestamp
          }));
        
        callback({
          conversationId,
          typingUsers,
          anyoneTyping: typingUsers.some(u => u.isTyping)
        });
      } else {
        callback({
          conversationId,
          typingUsers: [],
          anyoneTyping: false
        });
      }
    }, (err) => {
      console.warn(`Error subscribing to typing in ${conversationId}:`, err);
    });
    
    return unsubscribe;
  } catch (err) {
    console.warn('Error subscribing to typing indicators:', err);
    return null;
  }
};

// ============================================================================
// UNREAD COUNTER SERVICE - Real-time Unread Message Count
// ============================================================================

/**
 * Subscribe to unread message count for user
 */
export const subscribeToUnreadCount = (userId, conversationId, callback) => {
  if (!userId || !conversationId || !rtdb || !callback) return null;
  
  try {
    const counterRef = rtdbRef(rtdb, `unreadCounts/${userId}/${conversationId}`);
    
    const unsubscribe = onValue(counterRef, (snapshot) => {
      const count = snapshot.val() || 0;
      callback({
        userId,
        conversationId,
        unreadCount: count
      });
    }, (err) => {
      console.warn(`Error subscribing to unread count:`, err);
    });
    
    return unsubscribe;
  } catch (err) {
    console.warn('Error subscribing to unread count:', err);
    return null;
  }
};

/**
 * Increment unread count for user in conversation
 */
export const incrementUnreadCount = (userId, conversationId) => {
  if (!userId || !conversationId || !rtdb) return;
  
  try {
    const counterRef = rtdbRef(rtdb, `unreadCounts/${userId}/${conversationId}`);
    rtdbUpdate(counterRef, {
      '.sv': 'increment(1)'
    });
  } catch (err) {
    console.warn('Error incrementing unread count:', err);
  }
};

/**
 * Set unread count to 0 for user in conversation
 */
export const clearUnreadCount = (userId, conversationId) => {
  if (!userId || !conversationId || !rtdb) return;
  
  try {
    const counterRef = rtdbRef(rtdb, `unreadCounts/${userId}/${conversationId}`);
    rtdbSet(counterRef, 0);
  } catch (err) {
    console.warn('Error clearing unread count:', err);
  }
};

// ============================================================================
// PRESENCE MONITORING - Monitor all online users
// ============================================================================

/**
 * Get all currently online users
 */
export const subscribeToOnlineUsers = (callback) => {
  if (!rtdb || !callback) return null;
  
  try {
    const statusRef = rtdbRef(rtdb, 'status');
    
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const data = snapshot.val();
      
      if (data) {
        const onlineUsers = Object.entries(data)
          .filter(([_, status]) => status?.state === 'online')
          .map(([uid, status]) => ({
            userId: uid,
            isOnline: true,
            lastChanged: status.lastChanged,
            lastActive: status.lastActive
          }));
        
        callback({
          onlineUsers,
          onlineCount: onlineUsers.length
        });
      } else {
        callback({
          onlineUsers: [],
          onlineCount: 0
        });
      }
    }, (err) => {
      console.warn('Error subscribing to online users:', err);
    });
    
    return unsubscribe;
  } catch (err) {
    console.warn('Error subscribing to online users:', err);
    return null;
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a user is online (one-time fetch)
 */
export const checkUserStatus = async (userId) => {
  if (!userId || !rtdb) return null;
  
  try {
    const statusRef = rtdbRef(rtdb, `status/${userId}`);
    const snapshot = await rtdbGet(statusRef);
    const data = snapshot.val();
    
    return {
      userId,
      isOnline: data?.state === 'online',
      lastActive: data?.lastActive
    };
  } catch (err) {
    console.warn('Error checking user status:', err);
    return null;
  }
};

/**
 * Clean up real-time listeners
 */
export const cleanupRealtimeListeners = (unsubscribers) => {
  if (!unsubscribers) return;
  
  if (Array.isArray(unsubscribers)) {
    unsubscribers.forEach(unsub => {
      try {
        if (typeof unsub === 'function') unsub();
      } catch (err) {
        console.warn('Error cleaning up listener:', err);
      }
    });
  } else if (typeof unsubscribers === 'function') {
    try {
      unsubscribers();
    } catch (err) {
      console.warn('Error cleaning up listener:', err);
    }
  }
};


const realtimeService = {
  // Presence
  setUserOnline,
  setUserOffline,
  subscribeToUserStatus,
  subscribeToMultipleUsersStatus,
  subscribeToOnlineUsers,
  checkUserStatus,
  
  // Messages
  subscribeToConversationMessages,
  markMessageDelivered,
  markMessageRead,
  
  // Typing
  setTypingIndicator,
  subscribeToTypingIndicators,
  
  // Unread
  subscribeToUnreadCount,
  incrementUnreadCount,
  clearUnreadCount,
  
  // Utilities
  cleanupRealtimeListeners
};

export default realtimeService;
