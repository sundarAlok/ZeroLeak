/**
 * Storage Manager - Handles persistent data in localStorage and sessionStorage
 * for smooth user experience across sessions
 */

const STORAGE_KEYS = {
  // Authentication
  USER_CREDENTIALS: 'zl_user_credentials',
  USER_SESSION: 'zl_user_session',
  
  // Profile
  USER_PROFILE: 'zl_user_profile',
  USER_PREFERENCES: 'zl_user_preferences',
  
  // UI State
  UI_THEME: 'zl_theme_mode',
  UI_SIDEBAR_WIDTH: 'zl_sidebar_width',
  UI_FAV_WIDTH: 'zl_fav_width',
  UI_SHOW_FAVORITES: 'zl_show_favorites',
  
  // Chat State
  CHAT_ACTIVE_CONVO: 'zl_active_convo',
  CHAT_DRAFT_MESSAGES: 'zl_draft_messages',
  
  // Cache
  CACHE_CONVERSATIONS: 'zl_cache_conversations',
  CACHE_MESSAGES: 'zl_cache_messages',
  CACHE_USERS: 'zl_cache_users'
};

// ============================================================================
// AUTHENTICATION STORAGE
// ============================================================================

/**
 * Store user credentials in localStorage (permanent storage)
 */
export const storeUserCredentials = (user) => {
  if (!user) return;
  try {
    const credentials = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      isEmailVerified: user.emailVerified,
      storedAt: Date.now()
    };
    
    // Store in localStorage
    localStorage.setItem(STORAGE_KEYS.USER_CREDENTIALS, JSON.stringify(credentials));
    
    // Also store in sessionStorage for current session
    sessionStorage.setItem(STORAGE_KEYS.USER_SESSION, JSON.stringify(credentials));
    
    console.log('✓ User credentials stored successfully');
  } catch (err) {
    console.warn('Error storing user credentials:', err);
  }
};

/**
 * Retrieve user credentials from localStorage or sessionStorage
 */
export const getStoredUserCredentials = () => {
  try {
    // Try sessionStorage first (current session)
    const sessionData = sessionStorage.getItem(STORAGE_KEYS.USER_SESSION);
    if (sessionData) {
      return JSON.parse(sessionData);
    }
    
    // Fallback to localStorage (persistent)
    const localData = localStorage.getItem(STORAGE_KEYS.USER_CREDENTIALS);
    if (localData) {
      return JSON.parse(localData);
    }
    
    return null;
  } catch (err) {
    console.warn('Error retrieving user credentials:', err);
    return null;
  }
};

/**
 * Clear all authentication data
 */
export const clearAuthData = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.USER_CREDENTIALS);
    localStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
    localStorage.removeItem(STORAGE_KEYS.USER_PREFERENCES);
    sessionStorage.removeItem(STORAGE_KEYS.USER_SESSION);
    console.log('✓ Auth data cleared');
  } catch (err) {
    console.warn('Error clearing auth data:', err);
  }
};

// ============================================================================
// USER PROFILE STORAGE
// ============================================================================

/**
 * Store user profile information for quick access across sessions
 */
export const storeUserProfile = (userId, profileData) => {
  if (!userId || !profileData) return;
  try {
    const profile = {
      uid: userId,
      name: profileData.name || '',
      username: profileData.username || '',
      bio: profileData.bio || '',
      photoURL: profileData.photoURL || null,
      updatedAt: Date.now()
    };
    
    // Store in localStorage
    localStorage.setItem(`${STORAGE_KEYS.USER_PROFILE}_${userId}`, JSON.stringify(profile));
    
    // Also store current user profile without uid for quick access
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
  } catch (err) {
    console.warn('Error storing user profile:', err);
  }
};

/**
 * Retrieve user profile from storage
 */
export const getStoredUserProfile = (userId = null) => {
  try {
    if (userId) {
      const data = localStorage.getItem(`${STORAGE_KEYS.USER_PROFILE}_${userId}`);
      return data ? JSON.parse(data) : null;
    }
    
    // Get current user profile
    const data = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.warn('Error retrieving user profile:', err);
    return null;
  }
};

// ============================================================================
// USER PREFERENCES STORAGE
// ============================================================================

/**
 * Store user preferences (privacy, notifications, etc.)
 */
export const storeUserPreferences = (userId, preferences) => {
  if (!userId) return;
  try {
    const prefs = {
      uid: userId,
      notificationsEnabled: preferences.notificationsEnabled !== false,
      darkMode: preferences.darkMode || false,
      language: preferences.language || 'en',
      privacy: preferences.privacy || 'friends',
      updatedAt: Date.now()
    };
    
    localStorage.setItem(`${STORAGE_KEYS.USER_PREFERENCES}_${userId}`, JSON.stringify(prefs));
  } catch (err) {
    console.warn('Error storing user preferences:', err);
  }
};

/**
 * Retrieve user preferences
 */
export const getStoredUserPreferences = (userId) => {
  try {
    const data = localStorage.getItem(`${STORAGE_KEYS.USER_PREFERENCES}_${userId}`);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.warn('Error retrieving user preferences:', err);
    return null;
  }
};

// ============================================================================
// UI STATE STORAGE
// ============================================================================

/**
 * Store UI state (theme, sidebar width, favorites panel state, etc.)
 */
export const storeUIState = (state) => {
  try {
    if (state.theme !== undefined) {
      localStorage.setItem(STORAGE_KEYS.UI_THEME, state.theme);
    }
    if (state.sidebarWidth !== undefined) {
      localStorage.setItem(STORAGE_KEYS.UI_SIDEBAR_WIDTH, String(state.sidebarWidth));
    }
    if (state.favWidth !== undefined) {
      localStorage.setItem(STORAGE_KEYS.UI_FAV_WIDTH, String(state.favWidth));
    }
    if (state.showFavorites !== undefined) {
      localStorage.setItem(STORAGE_KEYS.UI_SHOW_FAVORITES, state.showFavorites ? 'true' : 'false');
    }
  } catch (err) {
    console.warn('Error storing UI state:', err);
  }
};

/**
 * Retrieve UI state
 */
export const getStoredUIState = () => {
  try {
    return {
      theme: localStorage.getItem(STORAGE_KEYS.UI_THEME) || 'light',
      sidebarWidth: parseInt(localStorage.getItem(STORAGE_KEYS.UI_SIDEBAR_WIDTH)) || 360,
      favWidth: parseInt(localStorage.getItem(STORAGE_KEYS.UI_FAV_WIDTH)) || 320,
      showFavorites: localStorage.getItem(STORAGE_KEYS.UI_SHOW_FAVORITES) === 'true'
    };
  } catch (err) {
    console.warn('Error retrieving UI state:', err);
    return {
      theme: 'light',
      sidebarWidth: 360,
      favWidth: 320,
      showFavorites: false
    };
  }
};

// ============================================================================
// CHAT STATE STORAGE
// ============================================================================

/**
 * Store active conversation ID for session continuity
 */
export const storeActiveConversation = (convoId) => {
  try {
    if (convoId) {
      localStorage.setItem(STORAGE_KEYS.CHAT_ACTIVE_CONVO, convoId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.CHAT_ACTIVE_CONVO);
    }
  } catch (err) {
    console.warn('Error storing active conversation:', err);
  }
};

/**
 * Get last active conversation
 */
export const getStoredActiveConversation = () => {
  try {
    return localStorage.getItem(STORAGE_KEYS.CHAT_ACTIVE_CONVO) || null;
  } catch (err) {
    console.warn('Error retrieving active conversation:', err);
    return null;
  }
};

/**
 * Store draft messages for conversations
 */
export const storeDraftMessage = (convoId, message) => {
  try {
    const drafts = JSON.parse(localStorage.getItem(STORAGE_KEYS.CHAT_DRAFT_MESSAGES) || '{}');
    if (message) {
      drafts[convoId] = message;
    } else {
      delete drafts[convoId];
    }
    localStorage.setItem(STORAGE_KEYS.CHAT_DRAFT_MESSAGES, JSON.stringify(drafts));
  } catch (err) {
    console.warn('Error storing draft message:', err);
  }
};

/**
 * Get draft message for a conversation
 */
export const getStoredDraftMessage = (convoId) => {
  try {
    const drafts = JSON.parse(localStorage.getItem(STORAGE_KEYS.CHAT_DRAFT_MESSAGES) || '{}');
    return drafts[convoId] || null;
  } catch (err) {
    console.warn('Error retrieving draft message:', err);
    return null;
  }
};

/**
 * Clear all draft messages
 */
export const clearAllDraftMessages = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.CHAT_DRAFT_MESSAGES);
  } catch (err) {
    console.warn('Error clearing draft messages:', err);
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if user session data exists (useful for auto-login)
 */
export const hasValidSession = () => {
  const credentials = getStoredUserCredentials();
  const profile = getStoredUserProfile();
  return !!(credentials && credentials.uid && profile && profile.uid);
};

/**
 * Clear all storage (on error or for debugging)
 */
export const clearAllStorage = () => {
  try {
    clearAuthData();
    localStorage.clear();
    sessionStorage.clear();
    console.log('✓ All storage cleared');
  } catch (err) {
    console.warn('Error clearing all storage:', err);
  }
};

/**
 * Get storage size estimate
 */
export const getStorageInfo = async () => {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage,
        quota: estimate.quota,
        percentage: (estimate.usage / estimate.quota) * 100
      };
    }
    return null;
  } catch (err) {
    console.warn('Error getting storage info:', err);
    return null;
  }
};

const storageManager = {
  STORAGE_KEYS,
  storeUserCredentials,
  getStoredUserCredentials,
  clearAuthData,
  storeUserProfile,
  getStoredUserProfile,
  storeUserPreferences,
  getStoredUserPreferences,
  storeUIState,
  getStoredUIState,
  storeActiveConversation,
  getStoredActiveConversation,
  storeDraftMessage,
  getStoredDraftMessage,
  clearAllDraftMessages,
  hasValidSession,
  clearAllStorage,
  getStorageInfo
};

export default storageManager;
