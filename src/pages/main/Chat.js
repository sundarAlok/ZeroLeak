// Chat.js (FULL replacement)
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db, rtdb } from '../../firebase/firebase';
import { collection, query, getDocs, getDoc, doc, addDoc, updateDoc, onSnapshot, orderBy, serverTimestamp, deleteDoc, where, limit, writeBatch, increment, arrayUnion } from 'firebase/firestore';
import { ref as rtdbRef, onDisconnect, onValue, set as rtdbSet, serverTimestamp as rtdbServerTimestamp, get as rtdbGet } from 'firebase/database';
import { ChatCard, UserCard } from '../../components/common/PremiumCards';
import GroupModal from '../../components/common/GroupModal';
import SearchBar from '../../components/common/SearchBar';
import '../../components/styles/common.css';
import { getCachedConversations, cacheConversations, cacheUser, getCachedUser, getCachedMessages, cacheMessages } from '../../utils/cacheManager';
import { FiMenu, FiMoreVertical, FiMapPin, FiTrash2, FiLock, FiUnlock, FiMessageCircle, FiSmile, FiUserX } from 'react-icons/fi';
import { arrayRemove } from 'firebase/firestore';
import { HiOutlineUserGroup, HiArrowRight } from 'react-icons/hi2';
import { BsBookmarkHeart } from 'react-icons/bs';


const Chat = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const messagesEndRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [activeConvo, setActiveConvo] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [groupOpen, setGroupOpen] = useState(false);
  const [menuState, setMenuState] = useState({ open: false, x: 0, y: 0, convoId: null });
  const [unlockedConvos] = useState([]);
  const usersCacheRef = useRef(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showFavorites, setShowFavorites] = useState(() => {
    try { return localStorage.getItem('zl_show_favorites') === 'true'; } catch { return false; }
  });
  const [isMobile, setIsMobile] = useState(false);
  const [favWidth, setFavWidth] = useState(() => {
    try { return parseInt(localStorage.getItem('zeroleak_fav_width')) || 320; } catch { return 320; }
  });
  const [isResizingFav, setIsResizingFav] = useState(false);
  const favRef = useRef(null);
  const msgsUnsubRef = useRef({ messages: null, meta: null });
  const menuRef = useRef(null);
  // user metadata (favorites, per-user deleted convo timestamps)
  const [userMeta, setUserMeta] = useState({ favorites: [], deletedConversations: {} });
  const [favFilter, setFavFilter] = useState('');
  const [activeTab, setActiveTab] = useState('chats');

  // Subscribe to current user's profile metadata (favorites / deletedConversations)
  useEffect(() => {
    if (!user) return;
    try {
      const unsub = onSnapshot(doc(db, 'users', user.uid), (d) => {
        if (!d.exists()) return;
        const data = d.data() || {};
        setUserMeta({ favorites: data.favorites || [], deletedConversations: data.deletedConversations || {} });
      }, (err) => console.error('user doc onSnapshot error', err));
      return () => { try { unsub(); } catch(e){} };
    } catch (err) {
      console.error('Failed to subscribe to user meta', err);
    }
  }, [user]);
  
  // Resize state for sidebar width control (like WhatsApp)
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      return parseInt(localStorage.getItem('zeroleak_sidebar_width')) || 360;
    } catch {
      return 360;
    }
  });
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef(null);

  // compute max allowed side panel width (1/3 of viewport) to ensure chat area remains visible
  const getMaxSideWidth = () => {
    try { return Math.floor((window.innerWidth || 1200) * 0.45); } catch { return 480; }
  };

  // conversations listener - OPTIMIZED: Load from cache FIRST, then sync
  useEffect(() => {
    if (!user) return;

    // STEP 1: Load from cache immediately (instant UI)
    const cachedConvos = getCachedConversations();
    if (cachedConvos && cachedConvos.length > 0) {
      // Recompute previews using current user's UID and cached messages so previews remain correct
      try {
        const currentUid = user.uid;
        const adjusted = cachedConvos.map(c => {
          let lastMessagePreview = c.lastMessagePreview || c.lastMessage || '';
          try {
            const cachedMsgs = getCachedMessages(c.id);
            if (cachedMsgs && cachedMsgs.length > 0) {
              const lm = cachedMsgs[cachedMsgs.length - 1];
              let senderName = '';
              if (lm.senderId === currentUid) {
                senderName = 'You';
              } else {
                // Try to resolve sender's platform name from cache (prefer exact senderId)
                const senderCached = getCachedUser(lm.senderId) || getCachedUser(c.otherUserId) || {};
                senderName = senderCached.name || (lm.senderName || '');
              }
              const text = (lm.text || lm.message || '').toString();
              // For 1-on-1 chats we show only the message text; for groups include sender prefix
              lastMessagePreview = c.isGroup ? (senderName ? `${senderName}: ${text}` : text) : text;
            }
          } catch (e) { /* ignore */ }
          return { ...c, lastMessagePreview };
        });
        setConversations(adjusted);
      } catch (e) {
        setConversations(cachedConvos);
      }
      setLoading(false);
    } else {
      setLoading(true);
    }

    // STEP 2: Set up real-time listener to sync in background
    const q = query(
      collection(db, 'conversations'), 
      where('participants', 'array-contains', user.uid),
      orderBy('lastMessageTime', 'desc'),
      limit(50)
    );
    
    const unsub = onSnapshot(q, (snapshot) => {
      try {
        const basicConvos = [];
        const otherIds = new Set();
        const currentUid = user.uid; // Capture current user's UID
        
        snapshot.docs.forEach(d => {
          const data = d.data();
          const otherId = data.participants?.find(id => id !== currentUid) || null;
          if (otherId) otherIds.add(otherId);
          
          basicConvos.push({
            id: d.id,
            participants: data.participants || [],
            otherUserId: otherId,
            lastMessage: data.lastMessage || '',
            timestamp: data.lastMessageTime,
            pinned: data.pinned || false,
            locked: data.locked || false,
            unreadCount: (data.unreadCounts?.[currentUid]) || 0,
            isGroup: !!data.isGroup,
            groupName: data.groupName || null,
            groupPhotoURL: data.groupPhotoURL || null
          });
        });

        // Build conversations with cached user data first
        const convosWithCachedData = basicConvos.map(c => {
          const cachedUserData = getCachedUser(c.otherUserId);
          // check if the current user has deleted this conversation previously
          const deletedMap = userMeta?.deletedConversations || {};
          const deletedTs = deletedMap && deletedMap[c.id] ? deletedMap[c.id] : null;
          let deletedAtMs = null;
          try {
            if (deletedTs == null) deletedAtMs = null;
            else if (typeof deletedTs === 'number') deletedAtMs = deletedTs;
            else if (deletedTs.toMillis) deletedAtMs = deletedTs.toMillis();
            else if (deletedTs.seconds != null) deletedAtMs = (deletedTs.seconds * 1000) + ((deletedTs.nanoseconds || deletedTs.nanos || 0) / 1e6);
          } catch (e) { deletedAtMs = null; }

          // try to build a preview from cached messages if present and not deleted
          let lastMessagePreview = '';
          let lastMessage = '';
          try {
            if (!deletedAtMs) {
              lastMessage = c.lastMessage || '';
              lastMessagePreview = lastMessage;
              const cachedMsgs = getCachedMessages(c.id);
              if (cachedMsgs && cachedMsgs.length > 0) {
                const lm = cachedMsgs[cachedMsgs.length - 1];
                // SIMPLE LOGIC: Check if CURRENT user sent this message
                let senderName = '';
                if (lm.senderId === currentUid) {
                  // Current user sent this message
                  senderName = 'You';
                } else {
                  // Other participant sent this message - use their platform name
                  senderName = (cachedUserData && cachedUserData.name) || '';
                }
                const text = (lm.text || lm.message || '').toString();
                // For 1-on-1 chats we show only the message text; for groups include sender prefix
                lastMessagePreview = c.isGroup ? (senderName ? `${senderName}: ${text}` : text) : text;
                lastMessage = lm.text || lm.message || lastMessage;
              }
            } else {
              // user deleted conversation previously - show no old preview
              lastMessage = '';
              lastMessagePreview = '';
            }
          } catch (e) { /* ignore cache read */ }

          const isFavourite = (userMeta?.favorites || []).includes(c.otherUserId);

          const userObj = c.isGroup
            ? { id: c.groupId || c.id, name: c.groupName || 'Group', username: '', photoURL: c.groupPhotoURL || '' }
            : (cachedUserData ? { id: c.otherUserId, ...cachedUserData } : { id: c.otherUserId, name: 'Loading...', username: '', photoURL: '' });

          return {
            id: c.id,
            user: userObj,
            lastMessage,
            lastMessagePreview,
            timestamp: c.timestamp,
            pinned: c.pinned,
            locked: c.locked,
            unreadCount: c.unreadCount,
            isGroup: c.isGroup,
            participantCount: c.participants.length || 2,
            isFavourite
          };
        });

        convosWithCachedData.sort((a,b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          const ta = a.timestamp?.toDate?.().getTime?.() ?? a.timestamp?.getTime?.() ?? 0;
          const tb = b.timestamp?.toDate?.().getTime?.() ?? b.timestamp?.getTime?.() ?? 0;
          return tb - ta;
        });

        setConversations(convosWithCachedData);
        setLoading(false);

        // Cache conversations for next load
        cacheConversations(convosWithCachedData);

        // Fetch missing user data in background
        const missingIds = Array.from(otherIds).filter(id => !getCachedUser(id));
        if (missingIds.length > 0) {
          Promise.all(
            missingIds.map(id => 
              getDoc(doc(db, 'users', id))
                .then(d => {
                  if (d.exists()) {
                    cacheUser(id, d.data()); // Cache for future use
                    return { id, data: d.data() };
                  }
                  return null;
                })
                .catch(() => null)
            )
          ).then(results => {
            const userMap = new Map();
            results.forEach(r => { if (r && r.data) userMap.set(r.id, r.data); });
            
            // Update conversations with fresh user data and rebuild previews
            setConversations(prev => prev.map(c => {
              if (!userMap.has(c.user.id)) return c;
              
              // Get fresh user data
              const freshUserData = userMap.get(c.user.id);
              
              // Rebuild message preview with fresh data
              let lastMessagePreview = c.lastMessagePreview;
              try {
                const cachedMsgs = getCachedMessages(c.id);
                if (cachedMsgs && cachedMsgs.length > 0) {
                  const lm = cachedMsgs[cachedMsgs.length - 1];
                  let senderName = '';
                  if (lm.senderId === user.uid) {
                    // Current user sent this message
                    senderName = 'You';
                  } else {
                    // Other participant sent this message
                    senderName = freshUserData.name || '';
                  }
                  const text = (lm.text || lm.message || '').toString();
                  // For 1-on-1 chats we show only the message text; for groups include sender prefix
                  lastMessagePreview = c.isGroup ? (senderName ? `${senderName}: ${text}` : text) : text;
                }
              } catch (e) { /* ignore */ }
              
              return { 
                ...c, 
                user: { id: c.user.id, ...freshUserData },
                lastMessagePreview
              };
            }));
          }).catch(err => console.error('Error fetching user docs:', err));
        }

      } catch (err) {
        console.error('conversation snapshot sync error', err);
        setLoading(false);
      }
    }, (err) => {
      console.error('conversations onSnapshot error', err);
      setLoading(false);
    });

    return () => { try { unsub(); } catch(e){} };
  }, [user, userMeta]);

  // presence publish / delivered best-effort
  useEffect(() => {
    if (!user || !rtdb) return;
    const statusRef = rtdbRef(rtdb, `status/${user.uid}`);
    try {
      rtdbSet(statusRef, { state: 'online', lastChanged: rtdbServerTimestamp() });
      onDisconnect(statusRef).set({ state: 'offline', lastChanged: rtdbServerTimestamp() });
    } catch (err) { console.warn('presence set failed', err); }

    const allStatusRef = rtdbRef(rtdb, 'status');
    const off = onValue(allStatusRef, (snap) => {
      const data = snap.val() || {};
      conversations.forEach(c => {
        const otherId = c.user?.id;
        if (!otherId) return;
        const st = data[otherId];
        if (st && st.state === 'online') {
          // best-effort mark delivered for messages in this convo
          // (we rely on each client marking delivered when they load messages)
        }
      });
    });

    return () => {
      try { rtdbSet(statusRef, { state: 'offline', lastChanged: rtdbServerTimestamp() }); } catch (e){}
      try { off && off(); } catch (e) {}
    };
  }, [user, conversations]);

  // window size -> mobile detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Sidebar resize handler (like WhatsApp)
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      
      const container = resizeRef.current;
      if (!container) return;
      
      const rect = container.getBoundingClientRect();
      const newWidth = e.clientX - rect.left;
      
      // Constrain width: min 280px, max 600px
      const constrainedWidth = Math.max(280, Math.min(600, newWidth));
      setSidebarWidth(constrainedWidth);
    };

    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false);
        // Persist sidebar width to localStorage
        localStorage.setItem('zeroleak_sidebar_width', sidebarWidth.toString());
      }
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'auto';
      document.body.style.cursor = 'auto';
    };
  }, [isResizing, sidebarWidth]);

  // close menu on outside click / escape
  useEffect(() => {
    const handleDown = (e) => {
      if (!menuState.open) return;
      const el = menuRef.current;
      if (el && !el.contains(e.target)) setMenuState({ ...menuState, open: false });
    };
    const handleKey = (e) => { if (e.key === 'Escape' && menuState.open) setMenuState({ ...menuState, open:false }); };
    window.addEventListener('mousedown', handleDown);
    window.addEventListener('keydown', handleKey);
    return () => { window.removeEventListener('mousedown', handleDown); window.removeEventListener('keydown', handleKey); };
  }, [menuState]);

  // listen for favorite panel toggle from MainLayout
  useEffect(() => {
    const onToggle = (e) => {
      const next = e?.detail?.show ?? !(localStorage.getItem('zl_show_favorites') === 'true');
      try { localStorage.setItem('zl_show_favorites', next ? 'true' : 'false'); } catch(e){}
      setShowFavorites(!!next);
    };
    window.addEventListener('zl:toggleFavorites', onToggle);
    return () => window.removeEventListener('zl:toggleFavorites', onToggle);
  }, []);

  // persist showFavorites so eslint recognizes it's used and state persists
  useEffect(() => {
    try { localStorage.setItem('zl_show_favorites', showFavorites ? 'true' : 'false'); } catch(e){}
  }, [showFavorites]);

  // right favorites panel resize handlers
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizingFav) return;
      const container = favRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      // compute width from right edge
      const newWidth = rect.right - e.clientX;
      const constrained = Math.max(240, Math.min(640, newWidth));
      setFavWidth(constrained);
    };
    const handleMouseUp = () => {
      if (isResizingFav) {
        setIsResizingFav(false);
        try { localStorage.setItem('zeroleak_fav_width', favWidth.toString()); } catch(e){}
      }
    };
    if (isResizingFav) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'auto';
      document.body.style.cursor = 'auto';
    };
  }, [isResizingFav, favWidth]);

  // helper: mark messages as delivered for current user
  const markMessagesDelivered = useCallback(async (convoId) => {
    if (!convoId || !user) return;
    try {
      const snap = await getDocs(collection(db, 'conversations', convoId, 'messages'));
      const promises = [];
      snap.docs.forEach(m => {
        const md = m.data();
        if (md.senderId !== user.uid && !((md.deliveredTo || []).includes(user.uid))) {
          const msgRef = doc(db, 'conversations', convoId, 'messages', m.id);
          promises.push(updateDoc(msgRef, { deliveredTo: arrayUnion(user.uid) }));
        }
      });
      await Promise.all(promises);
    } catch (err) {
      console.error('markMessagesDelivered error', err);
    }
  }, [user]);

  // helper: mark messages read for current user
  const markMessagesRead = useCallback(async (convoId) => {
    if (!convoId || !user) return;
    try {
      const snap = await getDocs(collection(db, 'conversations', convoId, 'messages'));
      const promises = [];
      snap.docs.forEach(m => {
        const md = m.data();
        if (md.senderId !== user.uid && !((md.readBy || []).includes(user.uid))) {
          const msgRef = doc(db, 'conversations', convoId, 'messages', m.id);
          promises.push(updateDoc(msgRef, { readBy: arrayUnion(user.uid) }));
        }
      });
      await Promise.all(promises);
      // set unread count to 0 for this user on convo doc
      try {
        await updateDoc(doc(db, 'conversations', convoId), { [`unreadCounts.${user.uid}`]: 0 });
        setConversations(prev => prev.map(c => c.id === convoId ? ({ ...c, unreadCount: 0 }) : c));
      } catch (err) { /* ignore */ }
    } catch (err) {
      console.error('markMessagesRead error', err);
    }
  }, [user]);

  // openConversation - reliable (fetch meta, user data, subscribe messages)
  const openConversation = useCallback(async (convo) => {
    if (!convo || !convo.id) return;

    try {
      let meta = {};
      try {
        const cd = await getDoc(doc(db, 'conversations', convo.id));
        if (cd.exists()) meta = cd.data();
      } catch (err) { /* ignore */ }

      // ensure other user's profile is present
      let userInfo = convo.user;
      try {
        if (!userInfo || !userInfo.id || !userInfo.name) {
          const participants = (meta && meta.participants) || convo.participants || [];
          const otherId = participants.find(id => id !== user.uid) || (convo.user && convo.user.id) || null;
          if (otherId) {
            const ud = await getDoc(doc(db, 'users', otherId));
            if (ud.exists()) userInfo = { id: otherId, ...ud.data() };
            else userInfo = { id: otherId, name: 'Unknown', username: '', photoURL: '' };
          }
        }
      } catch (err) {
        console.warn('Failed to fetch other user for convo', convo.id, err);
      }

      const built = {
        id: convo.id,
        user: userInfo || { id: null, name: 'Unknown', username: '', photoURL: '' },
        lastMessage: meta.lastMessage || convo.lastMessage || '',
        timestamp: meta.lastMessageTime || convo.timestamp || null,
        pinned: meta.pinned || convo.pinned || false,
        blockedBy: meta.blockedBy || convo.blockedBy || null,
        locked: meta.locked || convo.locked || false,
        lockSalt: meta.lockSalt || convo.lockSalt || null,
        isGroup: meta.isGroup || false,
        participants: meta.participants || []
      };

      // For groups, fetch participant usernames if not cached
      if (built.isGroup && built.participants.length > 0) {
        const missingUsernames = built.participants.filter(pid => !getCachedUser(pid)?.username);
        if (missingUsernames.length > 0) {
          try {
            const userDocs = await Promise.all(missingUsernames.map(pid => getDoc(doc(db, 'users', pid))));
            userDocs.forEach((doc, idx) => {
              if (doc.exists()) {
                cacheUser(missingUsernames[idx], doc.data());
              }
            });
            // Trigger re-render to show fetched usernames
            setActiveConvo(prev => ({ ...prev }));
          } catch (err) {
            console.warn('Failed to fetch participant usernames for group', err);
          }
        }
      }

      setActiveConvo(prev => (prev && prev.id === built.id) ? prev : built);

      // mobile behavior: hide sidebar after setting activeConvo (give render a tick)
      setTimeout(() => { if (isMobile) setShowSidebar(false); }, 60);

      // Load cached messages for this convo immediately so UI shows instantly
      try {
        const cachedMsgs = getCachedMessages(built.id);
        if (cachedMsgs && cachedMsgs.length > 0) {
          setMessages(cachedMsgs);
          setTimeout(() => { try { messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' }); } catch(e){} }, 20);
        }
      } catch (e) { /* ignore cache errors */ }

      // attempt delivered/read marking
      await markMessagesDelivered(built.id);
      await markMessagesRead(built.id);

      // subscribe to messages
      try {
        // unsubscribe previous
        try { if (msgsUnsubRef.current.messages) msgsUnsubRef.current.messages(); } catch(e){}
        try { if (msgsUnsubRef.current.meta) msgsUnsubRef.current.meta(); } catch(e){}
        msgsUnsubRef.current.messages = null;
        msgsUnsubRef.current.meta = null;

        const q = query(collection(db, 'conversations', built.id, 'messages'), orderBy('timestamp', 'asc'));
        const unsubMsgs = onSnapshot(q, (snapshot) => {
          const msgs = snapshot.docs.map(d => {
            const data = d.data() || {};
            // normalize timestamp to milliseconds (prefer server timestamp, fallback to clientTimestamp)
            let ts = null;
            try {
              if (data.timestamp == null) ts = data.clientTimestamp || null;
              else if (typeof data.timestamp === 'number') ts = data.timestamp;
              else if (data.timestamp.toMillis) ts = data.timestamp.toMillis();
              else if (data.timestamp.seconds != null) ts = (data.timestamp.seconds * 1000) + ((data.timestamp.nanoseconds || data.timestamp.nanos || 0) / 1e6);
              else ts = new Date(data.timestamp).getTime();
            } catch (e) { ts = data.clientTimestamp || null; }

            return { id: d.id, ...data, timestamp: ts };
          });

          setMessages(msgs);
          cacheMessages(built.id, msgs); // Cache for fast reload (timestamps already normalized)
          setTimeout(() => { try { messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' }); } catch(e){} }, 20);
        }, (err) => console.error('messages onSnapshot error', err));
        msgsUnsubRef.current.messages = unsubMsgs;

        const unsubMeta = onSnapshot(doc(db, 'conversations', built.id), (d) => {
          if (!d.exists()) return;
          const data = d.data();
          setActiveConvo(prev => prev ? ({ ...prev, pinned: data.pinned || false, blockedBy: data.blockedBy || null, locked: data.locked || false, lockSalt: data.lockSalt || null }) : prev);
        }, (err) => console.error('meta onSnapshot error', err));
        msgsUnsubRef.current.meta = unsubMeta;
      } catch (err) {
        console.error('Failed to subscribe to messages/meta:', err);
      }

    } catch (err) {
      console.error('openConversation error', err);
    }
  }, [isMobile, markMessagesDelivered, markMessagesRead, user?.uid]);

  // wrapper for clicking a card (ensures no double triggers)
  const handleCardClick = useCallback((convo) => {
    try {
      // If this convo is already active, do nothing
      if (activeConvo && activeConvo.id === convo.id) return;

      // Optimistically clear unread count locally so badge disappears immediately
      setConversations(prev => prev.map(c => c.id === convo.id ? ({ ...c, unreadCount: 0 }) : c));

      // Load cached messages immediately for instant display
      try {
        const cached = getCachedMessages(convo.id);
        if (cached && cached.length > 0) {
          setMessages(cached);
        }
      } catch (e) { /* ignore cache failures */ }

      // optimistic set active convo to speed UI
      setActiveConvo(convo);

      // Fire-and-forget: tell server this convo was opened (set unread to 0)
      (async () => {
        try {
          await updateDoc(doc(db, 'conversations', convo.id), { [`unreadCounts.${user.uid}`]: 0 });
        } catch (err) {
          // If server update fails, we'll re-sync via onSnapshot or markMessagesRead
          console.warn('Failed to clear unread count on server:', err);
        }
      })();

      openConversation(convo).catch(err => console.error('openConversation failed', err));
    } catch (err) {
      console.error('handleCardClick error', err);
    }
  }, [openConversation, activeConvo, user]);

  // search users (debounced inside effect)
  useEffect(() => {
    const perform = async () => {
      const q = (searchQuery || '').trim();
      if (!q || q.length < 2) { setSearchResults([]); return; }
      try {
        setLoading(true);
        const resultsMap = new Map();
        try {
          const uq = query(collection(db, 'users'), where('username', '==', q), limit(10));
          const snap = await getDocs(uq);
          snap.docs.forEach(d => { const u = { id: d.id, ...d.data() }; if (u.id !== user.uid) resultsMap.set(u.id, u); });
        } catch (e) {}
        try {
          const nq = query(collection(db, 'users'), where('name', '>=', q), where('name', '<=', q + '\uf8ff'), limit(10));
          const snap2 = await getDocs(nq);
          snap2.docs.forEach(d => { const u = { id: d.id, ...d.data() }; if (u.id !== user.uid) resultsMap.set(u.id, u); });
        } catch (e) {}
        if (resultsMap.size === 0) {
          let users = usersCacheRef.current;
          if (!users) { const snap = await getDocs(query(collection(db, 'users'), limit(500))); users = snap.docs.map(d => ({ id: d.id, ...d.data() })); usersCacheRef.current = users; }
          users.forEach(u => {
            if (u.id === user.uid) return;
            const name = (u.name||'').toLowerCase();
            const username = (u.username||'').toLowerCase();
            if (name.includes(q.toLowerCase()) || username.includes(q.toLowerCase())) resultsMap.set(u.id, u);
          });
        }
        const results = Array.from(resultsMap.values()).slice(0, 10);
        setSearchResults(results);
      } catch (err) {
        console.error('Error searching users:', err);
      } finally {
        setLoading(false);
      }
    };
    const t = setTimeout(perform, 250);
    return () => clearTimeout(t);
  }, [searchQuery, user]);

  const startConversation = async (targetUser) => {
    try {
      // find existing conversation for both participants
      // Query only conversations where the current user is a participant
      // (reading the entire collection will fail Firestore rules if many docs are not readable)
      const q = query(collection(db, 'conversations'), where('participants', 'array-contains', user.uid));
      const allConvosSnap = await getDocs(q);
      let existingConvoId = null;
      for (const d of allConvosSnap.docs) {
        const data = d.data();
        if (data.participants?.includes(targetUser.id)) { existingConvoId = d.id; break; }
      }
      if (!existingConvoId) {
        const unreadCounts = {}; unreadCounts[user.uid] = 0; unreadCounts[targetUser.id] = 0;
        const newConvo = await addDoc(collection(db, 'conversations'), {
          participants: [user.uid, targetUser.id],
          lastMessage: '',
          lastMessageTime: serverTimestamp(),
          createdAt: serverTimestamp(),
          pinned: false,
          blockedBy: null,
          locked: false,
          unreadCounts
        });
        existingConvoId = newConvo.id;
      }

      // fetch metadata
      let convo = conversations.find(c => c.id === existingConvoId);
      try {
        const cd = await getDoc(doc(db, 'conversations', existingConvoId));
        if (cd.exists()) {
          const data = cd.data();
          convo = convo || {};
          convo = {
            id: existingConvoId,
            user: targetUser,
            lastMessage: data.lastMessage || '',
            timestamp: data.lastMessageTime,
            pinned: data.pinned || false,
            blockedBy: data.blockedBy || null,
            locked: data.locked || false,
            lockSalt: data.lockSalt || null
          };
        }
      } catch (err) { console.warn('Failed to fetch convo metadata', err); }

      // open conversation reliably
      try {
        await openConversation(convo);
      } catch (err) {
        console.warn('openConversation after startConversation failed', err);
        setActiveConvo(convo);
      }

      setSearchQuery(''); setSearchResults([]);
    } catch (err) {
      console.error('Error starting conversation:', err);
      alert('Failed to start conversation');
    }
  };

  const sendMessage = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!newMessage.trim() || !activeConvo) return;
    if (activeConvo.blockedBy && activeConvo.blockedBy !== user.uid) { alert('You cannot send messages to this conversation — you are blocked.'); return; }
    if (activeConvo.locked && !unlockedConvos.includes(activeConvo.id)) { alert('This chat is locked. Unlock it to send messages.'); return; }

    try {
      const clientTs = Date.now();
      const msgRef = await addDoc(collection(db, 'conversations', activeConvo.id, 'messages'), {
        senderId: user.uid,
        senderName: user.displayName || '',
        text: newMessage.trim(),
        readBy: [user.uid],
        deliveredTo: [],
        timestamp: serverTimestamp(),
        clientTimestamp: clientTs
      });

      // mark delivered for online participants (best-effort)
      try {
        const convoDoc = await getDoc(doc(db, 'conversations', activeConvo.id));
        const participants = (convoDoc.exists() && convoDoc.data().participants) || [];
        for (const pid of participants) {
          if (pid === user.uid) continue;
          try {
            const snap = await rtdbGet(rtdbRef(rtdb, `status/${pid}`));
            const val = snap && typeof snap.val === 'function' ? snap.val() : (snap && snap.val ? snap.val() : snap);
            if (val && val.state === 'online') {
              await updateDoc(doc(db, 'conversations', activeConvo.id, 'messages', msgRef.id), { deliveredTo: arrayUnion(pid) });
            }
          } catch (inner) { /* ignore presence check failures */ }
        }
      } catch (innerErr) { /* ignore presence logic errors */ }

      // update convo's last message and unread counts
      try {
        const convoRef = doc(db, 'conversations', activeConvo.id);
        try {
          const cd = await getDoc(convoRef);
          const participants = (cd.exists() && cd.data().participants) || [];
          const updates = { lastMessage: newMessage.trim(), lastMessageTime: serverTimestamp() };
          participants.forEach(pid => { if (pid !== user.uid) updates[`unreadCounts.${pid}`] = increment(1); });
          await updateDoc(convoRef, updates);
        } catch (innerErr) {
          await updateDoc(convoRef, { lastMessage: newMessage.trim(), lastMessageTime: serverTimestamp() });
        }
      } catch (err) { console.warn('Failed to update conversation lastMessage:', err); }

      setNewMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
      alert('Failed to send message');
    }
  };

  // menu actions (delete, block, pin, lock)
  const handleDeleteConversation = async (convoId) => {
    const confirmDelete = window.confirm('Delete this conversation and its messages? This cannot be undone');
    if (!confirmDelete) return;
    try {
      // try to batch-delete messages
      try {
        const msgsSnap = await getDocs(collection(db, 'conversations', convoId, 'messages'));
        const docs = msgsSnap.docs || [];
        if (docs.length === 0) {
          await deleteDoc(doc(db, 'conversations', convoId));
        } else if (docs.length <= 450) {
          const batch = writeBatch(db);
          docs.forEach(m => batch.delete(doc(db, 'conversations', convoId, 'messages', m.id)));
          batch.delete(doc(db, 'conversations', convoId));
          await batch.commit();
        } else {
          // delete in chunks
          const chunkSize = 400;
          for (let i = 0; i < docs.length; i += chunkSize) {
            const batch = writeBatch(db);
            const chunk = docs.slice(i, i + chunkSize);
            chunk.forEach(m => batch.delete(doc(db, 'conversations', convoId, 'messages', m.id)));
            await batch.commit();
          }
          await deleteDoc(doc(db, 'conversations', convoId));
        }
        setConversations(prev => prev.filter(c => c.id !== convoId));
        if (activeConvo?.id === convoId) {
          setActiveConvo(null);
          setMessages([]);
        }
      } catch (inner) {
        console.warn('Failed to batch-delete messages:', inner);
        // fallback: delete convo doc
        await deleteDoc(doc(db, 'conversations', convoId));
        setConversations(prev => prev.filter(c => c.id !== convoId));
        if (activeConvo?.id === convoId) { setActiveConvo(null); setMessages([]); }
      }
    } catch (err) {
      console.error('Failed to delete conversation', err);
      alert('Failed to delete conversation');
    } finally {
      setMenuState({ ...menuState, open: false });
    }
  };

  const handleBlockToggle = async (convoId) => {
    try {
      const convoRef = doc(db, 'conversations', convoId);
      const convo = conversations.find(c => c.id === convoId) || {};
      const currentlyBlockedBy = convo.blockedBy || null;
      if (currentlyBlockedBy === user.uid) {
        // unblock
        await updateDoc(convoRef, { blockedBy: null });
        setConversations(prev => prev.map(c => c.id === convoId ? ({ ...c, blockedBy: null }) : c));
        if (activeConvo?.id === convoId) setActiveConvo(prev => prev ? ({ ...prev, blockedBy: null }) : prev);
        alert('User unblocked for this conversation');
      } else {
        // block
        await updateDoc(convoRef, { blockedBy: user.uid });
        setConversations(prev => prev.map(c => c.id === convoId ? ({ ...c, blockedBy: user.uid }) : c));
        if (activeConvo?.id === convoId) setActiveConvo(prev => prev ? ({ ...prev, blockedBy: user.uid }) : prev);
        alert('User blocked for this conversation');
      }
      setMenuState({ ...menuState, open: false });
    } catch (err) {
      console.error('Block toggle failed', err);
      alert('Block toggle failed');
    }
  };

  const handlePinToggle = async (convoId) => {
    try {
      const convo = conversations.find(c => c.id === convoId);
      const isPinned = convo?.pinned;
      await updateDoc(doc(db, 'conversations', convoId), { pinned: !isPinned });
      setConversations(prev => prev.map(c => c.id === convoId ? ({ ...c, pinned: !isPinned }) : c));
    } catch (err) {
      console.error('Pin toggle failed', err);
      alert('Pin toggle failed');
    } finally {
      setMenuState({ ...menuState, open: false });
    }
  };

  const handleLock = async (convoId) => {
    try {
      const pwd = window.prompt('Set a password to lock this chat (leave empty to cancel)');
      if (!pwd) return setMenuState({ ...menuState, open: false });
      const convoRef = doc(db, 'conversations', convoId);
      // very small PBKDF2 mimic using a simple salt & derived conversion (we reuse your existing functions if present)
      const salt = Array.from(window.crypto.getRandomValues(new Uint8Array(16))).map(n => n.toString(16).padStart(2,'0')).join('');
      // simple derivedKey (SHA-256) as base64
      const enc = new TextEncoder();
      const keyMaterial = await window.crypto.subtle.importKey('raw', enc.encode(pwd), { name: 'PBKDF2' }, false, ['deriveBits']);
      const derivedBits = await window.crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 150000, hash: 'SHA-256' }, keyMaterial, 256);
      const b64 = btoa(String.fromCharCode(...new Uint8Array(derivedBits)));
      await updateDoc(convoRef, { locked: true, lockSalt: salt, lockKey: b64 });
      alert('Chat locked');
    } catch (err) {
      console.error('Lock failed', err);
      alert('Lock failed');
    } finally {
      setMenuState({ ...menuState, open: false });
    }
  };

    // Toggle favourite for conversation (store per-user favorites on users.{uid}.favorites)
    const handleFavouriteToggle = async (convoId) => {
      try {
        const convo = conversations.find(c => c.id === convoId);
        const otherId = convo?.user?.id;
        if (!otherId) return;
        const isFav = (userMeta?.favorites || []).includes(otherId);
        const userRef = doc(db, 'users', user.uid);
        if (isFav) {
          await updateDoc(userRef, { favorites: arrayRemove(otherId) });
          setUserMeta(prev => ({ ...prev, favorites: (prev?.favorites || []).filter(f => f !== otherId) }));
        } else {
          await updateDoc(userRef, { favorites: arrayUnion(otherId) });
          // add optimistically but ensure uniqueness to avoid duplicate entries
          setUserMeta(prev => {
            const prevFavs = prev?.favorites || [];
            const next = Array.from(new Set([ ...prevFavs, otherId ]));
            return { ...prev, favorites: next };
          });
        }
        setConversations(prev => prev.map(c => c.id === convoId ? ({ ...c, isFavourite: !isFav }) : c));
        setMenuState({ ...menuState, open: false });
      } catch (err) {
        console.error('Favourite toggle failed', err);
        alert('Failed to update favourite');
      }
    };

    // Unlock (when conversation is locked)
    const handleUnlock = async (convoId) => {
      try {
        await updateDoc(doc(db, 'conversations', convoId), { locked: false, lockSalt: null, lockKey: null });
        setConversations(prev => prev.map(c => c.id === convoId ? ({ ...c, locked: false }) : c));
        if (activeConvo?.id === convoId) setActiveConvo(prev => prev ? ({ ...prev, locked: false }) : prev);
        setMenuState({ ...menuState, open: false });
        alert('Chat unlocked');
      } catch (err) {
        console.error('Unlock failed', err);
        alert('Failed to unlock chat');
      }
    };

  // Helper to get convo from state
  const getConvoFromState = (convoId) => conversations.find(c => c.id === convoId);

  // Filter conversations based on active tab
  const filteredConversations = conversations.filter(convo => {
    if (activeTab === 'chats') return !convo.isGroup;
    if (activeTab === 'groups') return convo.isGroup;
    return true;
  });

  return (
    <div ref={resizeRef} style={{ display:'flex', height:'calc(100vh - 80px)', background:'var(--app-bg)' }}>
      {/* Sidebar */}
      {showSidebar && (
        <div style={{ width: Math.min(sidebarWidth, getMaxSideWidth()), maxWidth: '30vw', background:'var(--card-bg)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ padding:12, display:'flex', flexDirection:'column', gap:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                {/* <img src="/splash_screen/logo.png" alt="ZeroLeak" style={{ height:30 }} /> */}
                <div style={{ display:'flex', flexDirection:'column', marginTop: -4 }}>
                  <div style={{ fontWeight:700, color:'var(--primary)', fontSize:21, fontFamily:`'Segoe UI', 'Helvetica Neue', Arial, sans-serif`, fontStyle:'italic', letterSpacing:0.2, textShadow:'0 1px 0 rgba(0,0,0,0.04)', paddingLeft:2 }}>ZeroLeak</div>
                </div>
              </div>

              <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center' }}>
                {isMobile && (
                  <button title="Toggle list" onClick={() => setShowSidebar(s => !s)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize:20 }}>
                    <FiMenu size={20} />
                  </button>
                )}
                <button title="Create group" onClick={() => setGroupOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize:24, marginTop:7}}>
                  <HiOutlineUserGroup size={24} />
                </button>
              </div>
            </div>

            <div style={{ paddingTop:1 }}>
              <SearchBar value={searchQuery} onChange={(e)=>setSearchQuery(e.target.value)} placeholder="Search users or usernames" />
            </div>

            {/* Tabs for Chats and Groups */}
            <div style={{ display:'flex', gap:4, padding:'8px 0' }}>
              <button
                onClick={() => setActiveTab('chats')}
                style={{
                  flex:1,
                  padding:'8px 12px',
                  borderRadius:8,
                  border:'none',
                  background: activeTab === 'chats' ? 'var(--primary)' : 'var(--bg)',
                  color: activeTab === 'chats' ? '#fff' : 'var(--text-primary)',
                  fontWeight:600,
                  cursor:'pointer',
                  transition:'all 0.2s'
                }}
              >
                Chats
              </button>
              <button
                onClick={() => setActiveTab('groups')}
                style={{
                  flex:1,
                  padding:'8px 12px',
                  borderRadius:8,
                  border:'none',
                  background: activeTab === 'groups' ? 'var(--primary)' : 'var(--bg)',
                  color: activeTab === 'groups' ? '#fff' : 'var(--text-primary)',
                  fontWeight:600,
                  cursor:'pointer',
                  transition:'all 0.2s'
                }}
              >
                Groups
              </button>
            </div>
          </div>

          <div style={{ flex:1, overflowY:'auto', padding:8 }}>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {/* Block banner removed: block/unblock handled via menu toggle only */}

              {searchResults.length > 0 && (
                <div>
                  {searchResults.map(u => <UserCard key={u.id} user={u} onSelect={startConversation} />)}
                </div>
              )}

              {searchQuery && searchResults.length === 0 && !loading && <div style={{ padding:20, textAlign:'center', color:'var(--text-secondary)' }}>No users found</div>}

              {(!searchQuery || searchResults.length === 0) && (
                filteredConversations.length > 0 ? filteredConversations.map(convo => (
                  <div key={convo.id} style={{ cursor:'pointer', position:'relative' }}>
                    <ChatCard user={convo.user} lastMessage={convo.lastMessage} lastMessagePreview={convo.lastMessagePreview} timestamp={convo.timestamp} isActive={activeConvo?.id === convo.id} onCardClick={() => handleCardClick(convo)} onMenuClick={(e) => { e.stopPropagation(); setMenuState({ open:true, x:e.clientX, y:e.clientY, convoId: convo.id }); }} unreadCount={convo.unreadCount} participantCount={convo.participantCount} pinned={convo.pinned} />
                  </div>
                )) : (
                  <div style={{ padding:24, textAlign:'center', color:'var(--text-secondary)' }}>
                    <div style={{ fontSize:32, marginBottom:12 }}><FiMessageCircle size={32} /></div>
                    <p style={{ margin:0, fontWeight:500 }}>No conversations yet</p>
                    <p style={{ fontSize:13, margin:'8px 0 0 0' }}>Start by searching for a user</p>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Resizable divider (only show on desktop, not mobile) */}
      {showSidebar && !isMobile && (
        <div
          onMouseDown={() => setIsResizing(true)}
          className="resize-divider"
          style={{
            background: isResizing ? 'var(--primary)' : 'transparent'
          }}
          title="Drag to resize"
        />
      )}

      <GroupModal open={groupOpen} onClose={()=>setGroupOpen(false)} currentUser={user} onGroupCreated={() => setActiveTab('groups')} />

      {menuState.open && (() => {
        const currentConvo = getConvoFromState(menuState.convoId);
        return (
          <div style={{ position: 'fixed', left: menuState.x, top: menuState.y, zIndex: 1200 }}>
            <div ref={menuRef} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 220 }}>
              <button className="menu-item" style={{ display: 'flex', alignItems: 'center', gap: 10 }} onClick={async () => { try { await handleFavouriteToggle(menuState.convoId); } finally { setMenuState({ ...menuState, open: false }); } }}><BsBookmarkHeart size={18} /> {currentConvo?.isFavourite ? 'Unfavourite' : 'Favourite'}</button>
              <button className="menu-item" style={{ display: 'flex', alignItems: 'center', gap: 10 }} onClick={async () => { try { await handlePinToggle(menuState.convoId); } finally { setMenuState({ ...menuState, open: false }); } }}><FiMapPin size={18} /> {currentConvo?.pinned ? 'Unpin' : 'Pin'}</button>
              <button className="menu-item" style={{ display: 'flex', alignItems: 'center', gap: 10 }} onClick={async () => { try { await handleDeleteConversation(menuState.convoId); } finally { setMenuState({ ...menuState, open: false }); } }}><FiTrash2 size={18} /> Delete</button>
              <button className="menu-item" style={{ display: 'flex', alignItems: 'center', gap: 10 }} onClick={async () => { try { await handleBlockToggle(menuState.convoId); } finally { setMenuState({ ...menuState, open: false }); } }}><FiUserX size={18} /> {currentConvo?.blockedBy === user.uid ? 'Unblock' : 'Block'}</button>
              <button className="menu-item" style={{ display: 'flex', alignItems: 'center', gap: 10 }} onClick={async () => { try { if (currentConvo?.locked) await handleUnlock(menuState.convoId); else await handleLock(menuState.convoId); } finally { setMenuState({ ...menuState, open: false }); } }}>{currentConvo?.locked ? <FiUnlock size={18} /> : <FiLock size={18} />} {currentConvo?.locked ? 'Unlock' : 'Lock'}</button>
              {/* Close button removed to simplify menu */}
            </div>
          </div>
        );
      })()}

      {/* Chat area */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', background:'var(--card-bg)', minWidth: Math.max(360, getMaxSideWidth()) }}>
        {activeConvo ? (
          <>
            <div style={{ padding:16, borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:12 }}>
              {activeConvo.user?.photoURL ? <img src={activeConvo.user.photoURL} alt="" style={{ width:40, height:40, borderRadius:20, objectFit:'cover' }} /> : <div style={{ width:40, height:40, borderRadius:20, background:'linear-gradient(135deg,var(--primary),var(--accent))', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:600 }}>{(activeConvo.user?.name||'').split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}</div>}
              <div>
                <p style={{ margin:0, fontWeight:600 }}>{activeConvo.user?.name}</p>
          <p style={{ margin:0, fontSize:12, color:'var(--text-secondary)' }}>
            {activeConvo.isGroup ? (() => {
              const participants = activeConvo.participants || [];
              const usernames = participants.filter(pid => pid !== user?.uid).map(pid => getCachedUser(pid)?.username || 'unknown');
              if (usernames.length > 3) {
                return usernames.slice(0, 3).join(', ') + '...';
              } else {
                return usernames.join(', ');
              }
            })() : `@${activeConvo.user?.username || ''}`}
          </p>
              </div>
              <button onClick={(e)=>{ const rect = e.currentTarget.getBoundingClientRect(); setMenuState({ open:true, x:rect.left, y:rect.bottom+6, convoId: activeConvo.id }); }} style={{ marginLeft:'auto', background:'none', border:'none', fontSize:20, cursor:'pointer' }}><FiMoreVertical size={20} /></button>
            </div>

            <div style={{ flex:1, overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:8 }}>
              {messages.length === 0 ? (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--text-secondary)', textAlign:'center' }}>
                  <div>
                    <div style={{ fontSize:40, marginBottom:12 }}><FiSmile size={40} /></div>
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                </div>
              ) : (
                (() => {
                  // Helper function to get date separator text
                  const getDateSeparator = (timestamp) => {
                    if (!timestamp) return '';
                    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
                    const today = new Date();
                    const yesterday = new Date(today);
                    yesterday.setDate(yesterday.getDate() - 1);

                    if (date.toDateString() === today.toDateString()) {
                      return 'Today';
                    } else if (date.toDateString() === yesterday.toDateString()) {
                      return 'Yesterday';
                    } else {
                      return date.toLocaleDateString('en-US', { weekday: 'long' });
                    }
                  };

                  // Group messages by date and add separators
                  const messageGroups = [];
                  let currentDate = null;

                  messages.forEach((msg, idx) => {
                    const msgDate = msg.timestamp ? (msg.timestamp.toDate ? msg.timestamp.toDate() : new Date(msg.timestamp)).toDateString() : null;
                    if (msgDate !== currentDate) {
                      if (currentDate !== null) {
                        messageGroups.push({ type: 'separator', date: getDateSeparator(msg.timestamp) });
                      }
                      currentDate = msgDate;
                    }
                    messageGroups.push({ type: 'message', msg, idx });
                  });

                  return messageGroups.map((item, groupIdx) => {
                    if (item.type === 'separator') {
                      return (
                        <div key={`sep-${groupIdx}`} style={{ display: 'flex', justifyContent: 'center', margin: '16px 0' }}>
                          <div style={{
                            background: 'var(--bg)',
                            color: 'var(--text-secondary)',
                            padding: '4px 12px',
                            borderRadius: 12,
                            fontSize: 12,
                            fontWeight: 500,
                            border: '1px solid var(--border)'
                          }}>
                            {item.date}
                          </div>
                        </div>
                      );
                    } else {
                      const { msg, idx } = item;
                      const isOwn = msg.senderId === user.uid;
                      const otherId = activeConvo?.user?.id;
                      const readByOther = otherId && msg.readBy && msg.readBy.includes(otherId);
                      const deliveredToOther = otherId && msg.deliveredTo && msg.deliveredTo.includes(otherId);

                      return (
                        <div key={msg.id || idx} style={{ display:'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                          {/* Sender name for group messages (only for received messages) */}
                          {activeConvo.isGroup && !isOwn && (
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2, marginLeft: 12 }}>
                              {getCachedUser(msg.senderId)?.name || msg.senderName || 'Unknown'}
                            </div>
                          )}
                          <div style={{
                            display: 'flex',
                            justifyContent: isOwn ? 'flex-end' : 'flex-start',
                            alignItems: 'flex-end',
                            gap: 4
                          }}>
                            <div style={{
                              background: isOwn ? '#dcf8c6' : '#fff',
                              color: isOwn ? '#000' : 'var(--text-primary)',
                              padding: '8px 12px',
                              borderRadius: isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                              maxWidth: '70%',
                              wordWrap: 'break-word',
                              fontSize: 14,
                              position: 'relative',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                              border: isOwn ? 'none' : '1px solid #e0e0e0'
                            }}>
                              <div>{msg.text}</div>
                            </div>
                            <div style={{
                              fontSize: 11,
                              color: 'var(--text-secondary)',
                              marginBottom: 2,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 2
                            }}>
                              <span>{(() => {
                                if (!msg.timestamp) return '';
                                try {
                                  const d = msg.timestamp.toDate ? msg.timestamp.toDate() : new Date(msg.timestamp);
                                  return d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
                                } catch(e){ return ''; }
                              })()}</span>
                              {isOwn && (
                                <span className={`msg-tick ${readByOther ? 'read' : (deliveredToOther ? 'delivered' : '')}`}
                                      title={readByOther ? 'Read' : (deliveredToOther ? 'Delivered' : 'Sent')} />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }
                  });
                })()
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} style={{ padding:16, borderTop:'1px solid var(--border)', display:'flex', gap:8 }}>
              <input type="text" placeholder="Type a message..." value={newMessage} onChange={(e)=>setNewMessage(e.target.value)} style={{ flex:1, padding:'10px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--input-bg)', color:'var(--text-primary)' }} />
              <button type="submit" aria-label="Send" disabled={!newMessage.trim()} style={{ padding:'10px 14px', background: newMessage.trim() ? 'linear-gradient(90deg,var(--primary),var(--accent))' : 'var(--border)', color:'#fff', border:'none', borderRadius:8, cursor: newMessage.trim() ? 'pointer' : 'not-allowed', fontWeight:600, display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
                <HiArrowRight size={18} />
              </button>
            </form>
          </>
        ) : (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-secondary)', textAlign:'center' }}>
            <div>
              <div style={{ fontSize:48, marginBottom:12 }}>
                <img src="/splash_screen/logo.png" alt="ZeroLeak" style={{ height:100 }} />
              </div>
              <h2 style={{ fontSize:19, fontWeight:600, margin:'0 0 8px 0' }}>Start a conversation</h2>
              <p style={{ fontSize:16, margin:0 }}>Search for users or select from your conversations</p>
            </div>
          </div>
        )}
      </div>
      {/* Right-side favorites panel (toggleable + resizable) */}
      {showFavorites && (
        <div ref={favRef} style={{ width: Math.min(favWidth, getMaxSideWidth()), background: 'var(--card-bg)', display: 'flex', flexDirection: 'column', position: 'relative', padding:0, borderRadius:8, border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          {/* left-side drag handle for resizing favorites panel */}
          {!isMobile && (
            <div onMouseDown={() => setIsResizingFav(true)} title="Drag to resize" style={{ position: 'absolute', left: -8, top: 0, bottom: 0, width: 12, cursor: 'col-resize', zIndex: 30 }} />
          )}
          <div style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontWeight: 700 }}>Favorites</div>
          </div>
          <div style={{ padding: 8 }}>
            <input placeholder="Search favorites" value={favFilter} onChange={(e)=>setFavFilter(e.target.value)} style={{ padding:8, borderRadius:8, border:'1px solid var(--border)', background:'var(--input-bg)', width:'100%' }} />
          </div>
          <div style={{ padding: 8, overflowY: 'auto', flex: 1, display:'flex', flexDirection:'column', gap:8 }}>
            {(() => {
              const favs = (userMeta?.favorites || []).filter(f => {
                const cached = getCachedUser(f);
                const name = (cached?.name || '').toLowerCase();
                const username = (cached?.username || '').toLowerCase();
                const q = favFilter.trim().toLowerCase();
                if (!q) return true;
                return name.includes(q) || username.includes(q);
              });
              if (favs.length === 0) return <div style={{ color:'var(--text-secondary)' , padding:12}}>No favorites yet</div>;
              return favs.map(fid => {
                const cachedRaw = getCachedUser(fid) || {};
                const cached = { id: fid, ...cachedRaw };
                return (
                  <div key={fid} className="fav-item">
                    <div style={{ flex:1 }}>
                      <UserCard user={cached} onSelect={async (u) => {
                        // ensure we have id; if not, fetch from Firestore
                        if (!u || !u.id) {
                          try {
                            const ud = await getDoc(doc(db, 'users', fid));
                            if (ud && ud.exists()) startConversation({ id: ud.id, ...ud.data() });
                            else startConversation({ id: fid });
                          } catch (e) { startConversation({ id: fid }); }
                        } else {
                          startConversation(u);
                        }
                      }} />
                    </div>
                    <div style={{ marginLeft:8 }}>
                      <button className="zl-btn" onClick={async () => {
                        if (cached && cached.id) return startConversation(cached);
                        try { const ud = await getDoc(doc(db, 'users', fid)); if (ud && ud.exists()) startConversation({ id: ud.id, ...ud.data() }); else startConversation({ id: fid }); } catch(e){ startConversation({ id: fid }); }
                      }}>Message</button>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
