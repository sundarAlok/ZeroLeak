// Cache Manager - Centralized data caching like Instagram/WhatsApp
const CACHE_KEYS = {
  USER_PROFILE: 'zeroleak_user_profile',
  CONVERSATIONS: 'zeroleak_conversations',
  USERS: 'zeroleak_users',
  MOMENTS: 'zeroleak_moments',
  MESSAGES: (convoId) => `zeroleak_messages_${convoId}`,
  CACHE_TIMESTAMP: (key) => `${key}_ts`
};

const CACHE_DURATION = {
  USER_PROFILE: 30 * 60 * 1000, // 30 min
  CONVERSATIONS: 5 * 60 * 1000,  // 5 min
  USERS: 60 * 60 * 1000,         // 1 hour
  MOMENTS: 10 * 60 * 1000,       // 10 min
  MESSAGES: 60 * 60 * 1000       // 1 hour
};

// Get cached data if valid
export const getCachedData = (key) => {
  try {
    const cached = localStorage.getItem(key);
    const timestamp = localStorage.getItem(CACHE_KEYS.CACHE_TIMESTAMP(key));
    
    if (!cached || !timestamp) return null;
    
    const duration = Object.values(CACHE_DURATION).find(() => true) || 5 * 60 * 1000;
    const keyDuration = Object.entries(CACHE_DURATION).find(([k]) => k === key)?.[1] || duration;
    
    if (Date.now() - parseInt(timestamp) > keyDuration) {
      localStorage.removeItem(key);
      localStorage.removeItem(CACHE_KEYS.CACHE_TIMESTAMP(key));
      return null;
    }
    
    return JSON.parse(cached);
  } catch (err) {
    console.warn('Cache retrieval error:', err);
    return null;
  }
};

// Set cache data
export const setCacheData = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    localStorage.setItem(CACHE_KEYS.CACHE_TIMESTAMP(key), Date.now().toString());
  } catch (err) {
    console.warn('Cache write error:', err);
  }
};

// Clear cache by key
export const clearCache = (key) => {
  try {
    localStorage.removeItem(key);
    localStorage.removeItem(CACHE_KEYS.CACHE_TIMESTAMP(key));
  } catch (err) {
    console.warn('Cache clear error:', err);
  }
};

// Clear all cache
export const clearAllCache = () => {
  try {
    Object.values(CACHE_KEYS).forEach(key => {
      if (typeof key === 'string' && !key.includes('_ts')) {
        localStorage.removeItem(key);
        localStorage.removeItem(CACHE_KEYS.CACHE_TIMESTAMP(key));
      }
    });
  } catch (err) {
    console.warn('Clear all cache error:', err);
  }
};

// Cache user profile
export const cacheUserProfile = (userId, data) => {
  setCacheData(CACHE_KEYS.USER_PROFILE, { ...data, userId, cachedAt: Date.now() });
};

export const getCachedUserProfile = () => {
  return getCachedData(CACHE_KEYS.USER_PROFILE);
};

// Cache conversations list
export const cacheConversations = (convos) => {
  setCacheData(CACHE_KEYS.CONVERSATIONS, convos.map(c => ({
    ...c,
    cachedAt: Date.now()
  })));
};

export const getCachedConversations = () => {
  return getCachedData(CACHE_KEYS.CONVERSATIONS);
};

// Cache individual users
export const cacheUser = (userId, userData) => {
  try {
    const cachedUsers = getCachedData(CACHE_KEYS.USERS) || {};
    cachedUsers[userId] = { ...userData, cachedAt: Date.now() };
    setCacheData(CACHE_KEYS.USERS, cachedUsers);
  } catch (err) {
    console.warn('User cache error:', err);
  }
};

export const getCachedUser = (userId) => {
  try {
    const cachedUsers = getCachedData(CACHE_KEYS.USERS) || {};
    return cachedUsers[userId] || null;
  } catch (err) {
    return null;
  }
};

// Cache moments
export const cacheMoments = (moments) => {
  setCacheData(CACHE_KEYS.MOMENTS, moments.map(m => ({
    ...m,
    cachedAt: Date.now()
  })));
};

export const getCachedMoments = () => {
  return getCachedData(CACHE_KEYS.MOMENTS);
};

// Cache messages for a conversation
export const cacheMessages = (convoId, messages) => {
  const normalized = messages.map(m => {
    const ts = m.timestamp;
    let tsMs = null;
    try {
      if (ts == null) tsMs = m.clientTimestamp || null;
      else if (typeof ts === 'number') tsMs = ts;
      else if (ts.toMillis) tsMs = ts.toMillis();
      else if (ts.seconds != null) tsMs = (ts.seconds * 1000) + ((ts.nanoseconds || ts.nanos || 0) / 1e6);
      else tsMs = (new Date(ts)).getTime();
    } catch (e) { tsMs = m.clientTimestamp || null; }

    return {
      ...m,
      timestamp: tsMs,
      cachedAt: Date.now()
    };
  });
  setCacheData(CACHE_KEYS.MESSAGES(convoId), normalized);
};

export const getCachedMessages = (convoId) => {
  return getCachedData(CACHE_KEYS.MESSAGES(convoId));
};

// Clear conversation cache when new message arrives
export const invalidateConversationCache = (convoId) => {
  clearCache(CACHE_KEYS.MESSAGES(convoId));
  clearCache(CACHE_KEYS.CONVERSATIONS); // Refresh list too
};
