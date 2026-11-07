// Chat.js (FULL replacement)
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db, rtdb } from '../../firebase/firebase';
import { collection, query, getDocs, getDoc, doc, updateDoc, onSnapshot, orderBy, serverTimestamp, deleteDoc, where, limit, writeBatch, arrayUnion, runTransaction } from 'firebase/firestore';
import { ref as rtdbRef, onDisconnect, set as rtdbSet, serverTimestamp as rtdbServerTimestamp } from 'firebase/database';
import { ChatCard, UserCard } from '../../components/common/PremiumCards';
import GroupModal from '../../components/common/GroupModal';
import SearchBar from '../../components/common/SearchBar';
import '../../components/styles/common.css';
import { cacheUser, getCachedUser, getCachedMessages, cacheMessages } from '../../utils/cacheManager';
import { FiMenu, FiMoreVertical, FiMapPin, FiTrash2, FiLock, FiUnlock, FiMessageCircle, FiSmile, FiUserX, FiArrowLeft, FiX, FiUsers, FiEdit2, FiCheck, FiPlus } from 'react-icons/fi';
import { arrayRemove } from 'firebase/firestore';
import { HiOutlineUserGroup } from 'react-icons/hi2';
import { BsBookmarkHeart, BsEmojiLaughing } from 'react-icons/bs';
import { LuSendHorizontal } from "react-icons/lu";
import { getOrCreateDirectConversation } from '../../firebase/conversations';
import AvatarCircle from '../../components/common/AvatarCircle';
import UrlFields from '../../components/common/UrlFields';
import VideoMessage, { hasEmbeddableVideo } from '../../components/common/VideoMessage';

const Chat = () => {
  const { user } = useAuth();
  const currentUserId = user?.uid;
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [profilesById, setProfilesById] = useState({});
  const [messages, setMessages] = useState([]);
  const messagesEndRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [activeConvo, setActiveConvo] = useState(null);
  const [showProfilePhoto, setShowProfilePhoto] = useState(false);
  const [profilePhotoDimensions, setProfilePhotoDimensions] = useState(null);
  const [showConversationInfo, setShowConversationInfo] = useState(false);
  const [groupInfo, setGroupInfo] = useState(null);
  const [groupInfoLoading, setGroupInfoLoading] = useState(false);
  const [groupInfoEditing, setGroupInfoEditing] = useState(false);
  const [groupInfoDraft, setGroupInfoDraft] = useState({ name:'', photoURL:'', bio:'', urls:[''] });
  const [savingGroupInfo, setSavingGroupInfo] = useState(false);
  const [memberActionFor, setMemberActionFor] = useState(null);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [addMemberQuery, setAddMemberQuery] = useState('');
  const [addMemberResults, setAddMemberResults] = useState([]);
  const [loadingMemberSearch, setLoadingMemberSearch] = useState(false);
  const [addingMemberId, setAddingMemberId] = useState(null);
  const groupInfoEditingRef = useRef(false);
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
  const userMetaRef = useRef(userMeta);
  userMetaRef.current = userMeta;
  const openRequestIdRef = useRef(0);
  const [favFilter, setFavFilter] = useState('');
  const [activeTab, setActiveTab] = useState('chats');
  groupInfoEditingRef.current = groupInfoEditing;

  useEffect(() => {
    if (!showProfilePhoto && !showConversationInfo) return undefined;
    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        setShowProfilePhoto(false);
        setShowConversationInfo(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showProfilePhoto, showConversationInfo]);

  useEffect(() => {
    if (!showConversationInfo || !activeConvo?.isGroup || !activeConvo.groupId) {
      setGroupInfo(null);
      return undefined;
    }

    setGroupInfoLoading(true);
    return onSnapshot(
      doc(db, 'groups', activeConvo.groupId),
      snapshot => {
        const data = snapshot.exists() ? snapshot.data() : null;
        setGroupInfo(data);
        if (!groupInfoEditingRef.current) {
          setGroupInfoDraft({
            name:data?.name || activeConvo.groupName || '',
            photoURL:data?.photoURL || activeConvo.groupPhotoURL || '',
            bio:data?.bio || 'We are using ZeroLeak',
            urls:data?.urls?.length ? data.urls : ['']
          });
        }
        setGroupInfoLoading(false);
      },
      error => {
        console.error('Failed to load group details:', error);
        setGroupInfoLoading(false);
      }
    );
  }, [showConversationInfo, activeConvo?.isGroup, activeConvo?.groupId, activeConvo?.groupName, activeConvo?.groupPhotoURL]);

  useEffect(() => {
    if (!showAddMembers || !activeConvo?.groupId || addMemberQuery.trim().length < 2) {
      setAddMemberResults([]);
      return undefined;
    }

    let cancelled = false;
    setLoadingMemberSearch(true);
    const timeout = setTimeout(async () => {
      try {
        const snapshot = await getDocs(collection(db, 'publicProfiles'));
        if (cancelled) return;
        const queryText = addMemberQuery.trim().toLowerCase();
        const currentMembers = new Set(groupInfo?.members || activeConvo.participants || []);
        const blockedMembers = new Set(groupInfo?.blockedMembers || []);
        setAddMemberResults(snapshot.docs
          .map(item => ({ id:item.id, ...item.data() }))
          .filter(profile => profile.id !== user?.uid
            && !currentMembers.has(profile.id)
            && !blockedMembers.has(profile.id)
            && (`${profile.name || ''} ${profile.username || ''}`).toLowerCase().includes(queryText))
          .slice(0, 15));
      } catch (error) {
        console.error('Failed to search group members:', error);
        if (!cancelled) setAddMemberResults([]);
      } finally {
        if (!cancelled) setLoadingMemberSearch(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [showAddMembers, addMemberQuery, activeConvo?.groupId, activeConvo?.participants, groupInfo?.members, groupInfo?.blockedMembers, user?.uid]);

  useEffect(() => {
    setShowAddMembers(false);
    setAddMemberQuery('');
    setAddMemberResults([]);
  }, [showConversationInfo, activeConvo?.groupId]);

  const isGroupAdmin = activeConvo?.isGroup && (
    groupInfo?.ownerId === user?.uid
    || (groupInfo?.admins || []).includes(user?.uid)
  );
  const isGroupOwner = activeConvo?.isGroup && groupInfo?.ownerId === user?.uid;

  const saveGroupInfo = async () => {
    if (!activeConvo?.groupId || !isGroupAdmin) return;
    if (!groupInfoDraft.name.trim()) {
      window.alert('Group name is required.');
      return;
    }
    setSavingGroupInfo(true);
    try {
      const urls = (groupInfoDraft.urls || []).map(url => url.trim()).filter(Boolean).slice(0, 3);
      await runTransaction(db, async transaction => {
        const groupRef = doc(db, 'groups', activeConvo.groupId);
        const conversationRef = doc(db, 'conversations', activeConvo.id);
        const [snapshot, conversationSnapshot] = await Promise.all([
          transaction.get(groupRef),
          transaction.get(conversationRef)
        ]);
        if (!snapshot.exists() || !conversationSnapshot.exists()) throw new Error('Group no longer exists.');
        const current = snapshot.data();
        const admins = current.admins?.length ? current.admins : [current.ownerId];
        if (current.ownerId !== user.uid && !admins.includes(user.uid)) {
          throw new Error('Only group admins can edit group details.');
        }
        transaction.update(groupRef, {
          members:current.members || [],
          admins,
          blockedMembers:current.blockedMembers || [],
          name:groupInfoDraft.name.trim(),
          photoURL:groupInfoDraft.photoURL.trim(),
          bio: groupInfoDraft.bio.trim() || 'We are using ZeroLeak',
          urls
        });
        transaction.update(conversationRef, {
          groupName:groupInfoDraft.name.trim(),
          groupPhotoURL:groupInfoDraft.photoURL.trim()
        });
      });
      setGroupInfoEditing(false);
    } catch (error) {
      console.error('Failed to update group details:', error);
      window.alert(error.message || 'Failed to update group details.');
    } finally {
      setSavingGroupInfo(false);
    }
  };

  const addGroupMember = async member => {
    if (!activeConvo?.groupId || !activeConvo?.id || !isGroupAdmin || addingMemberId) return;
    setAddingMemberId(member.id);
    try {
      const groupRef = doc(db, 'groups', activeConvo.groupId);
      const conversationRef = doc(db, 'conversations', activeConvo.id);
      const messageRef = doc(collection(db, 'conversations', activeConvo.id, 'messages'));
      const actorProfile = getCachedUser(user.uid) || {};
      const actorName = actorProfile.name || user.displayName || 'A group admin';
      const actorUsername = actorProfile.username || '';
      const targetName = member.name || member.username || 'A member';
      const targetUsername = member.username || '';
      const eventText = `${actorUsername ? `@${actorUsername}` : actorName} added ${targetUsername ? `@${targetUsername}` : targetName} to the group`;

      await runTransaction(db, async transaction => {
        const [groupSnapshot, conversationSnapshot] = await Promise.all([
          transaction.get(groupRef),
          transaction.get(conversationRef)
        ]);
        if (!groupSnapshot.exists() || !conversationSnapshot.exists()) throw new Error('The group or its conversation no longer exists.');
        const group = groupSnapshot.data();
        const admins = Array.isArray(group.admins) && group.admins.length ? group.admins : [group.ownerId];
        if (group.ownerId !== user.uid && !admins.includes(user.uid)) throw new Error('Only group admins can add members.');
        const members = Array.isArray(group.members) ? group.members : [];
        const blockedMembers = Array.isArray(group.blockedMembers) ? group.blockedMembers : [];
        if (members.includes(member.id)) throw new Error('This user is already a group member.');
        if (blockedMembers.includes(member.id)) throw new Error('Unblock this user before adding them.');

        const nextMembers = [...members, member.id];
        const unreadCounts = { ...(conversationSnapshot.data().unreadCounts || {}) };
        nextMembers.forEach(participantId => {
          if (participantId !== user.uid) unreadCounts[participantId] = (unreadCounts[participantId] || 0) + 1;
        });
        transaction.update(groupRef, {
          members:nextMembers,
          admins,
          blockedMembers,
          bio:group.bio || 'We are using ZeroLeak',
          urls:Array.isArray(group.urls) ? group.urls : []
        });
        transaction.update(conversationRef, {
          participants:nextMembers,
          participantCount:nextMembers.length,
          unreadCounts,
          lastMessage:eventText,
          lastMessageTime:serverTimestamp()
        });
        transaction.set(messageRef, {
          senderId:user.uid,
          senderName:actorName,
          senderUsername:actorUsername,
          systemType:'membership',
          membershipAction:'added',
          targetUserId:member.id,
          targetName,
          targetUsername,
          text:eventText,
          readBy:[user.uid],
          deliveredTo:[],
          timestamp:serverTimestamp(),
          clientTimestamp:Date.now()
        });
      });
      setAddMemberQuery('');
      setAddMemberResults([]);
    } catch (error) {
      console.error('Failed to add group member:', error);
      window.alert(error.message || 'Failed to add member to the group.');
    } finally {
      setAddingMemberId(null);
    }
  };

  const handleGroupMemberAction = async (action, memberId) => {
    if (!activeConvo?.groupId || !activeConvo?.id || !isGroupAdmin) return;
    const actionLabels = {
      promote:'make this member an admin',
      demote:'remove this member as an admin',
      remove:'remove this member from the group',
      block:'block and remove this member from the group',
      unblock:'unblock this member'
    };
    if (!window.confirm(`Are you sure you want to ${actionLabels[action]}?`)) return;

    try {
      const membershipMessageRef = action === 'remove' || action === 'block'
        ? doc(collection(db, 'conversations', activeConvo.id, 'messages'))
        : null;
      const actorProfile = getCachedUser(user.uid) || {};
      const targetProfile = profilesById[memberId] || getCachedUser(memberId) || {};
      const actorName = actorProfile.name || user.displayName || 'A group admin';
      const actorUsername = actorProfile.username || '';
      const targetName = targetProfile.name || targetProfile.username || 'A member';
      const targetUsername = targetProfile.username || '';
      await runTransaction(db, async transaction => {
        const groupRef = doc(db, 'groups', activeConvo.groupId);
        const conversationRef = doc(db, 'conversations', activeConvo.id);
        const [groupSnapshot, conversationSnapshot] = await Promise.all([
          transaction.get(groupRef),
          transaction.get(conversationRef)
        ]);
        if (!groupSnapshot.exists() || !conversationSnapshot.exists()) {
          throw new Error('The group or its conversation no longer exists.');
        }

        const group = groupSnapshot.data();
        const owner = group.ownerId === user.uid;
        const admins = Array.isArray(group.admins) && group.admins.length ? [...group.admins] : [group.ownerId];
        const blockedMembers = Array.isArray(group.blockedMembers) ? [...group.blockedMembers] : [];
        const members = Array.isArray(group.members) ? [...group.members] : [];
        const groupDefaults = {
          blockedMembers,
          bio:group.bio || 'We are using ZeroLeak',
          urls:Array.isArray(group.urls) ? group.urls : []
        };
        if (!owner && !admins.includes(user.uid)) throw new Error('Only group admins can manage members.');
        if (memberId === group.ownerId) throw new Error('The group creator cannot be changed or removed.');

        if (action === 'promote' || action === 'demote') {
          if (!owner) throw new Error('Only the group creator can manage admin roles.');
          if (action === 'promote' && members.includes(memberId) && !admins.includes(memberId)) admins.push(memberId);
          if (action === 'demote' && admins.includes(memberId)) admins.splice(admins.indexOf(memberId), 1);
          transaction.update(groupRef, { ...groupDefaults, members, admins });
          return;
        }

        if (action === 'remove' || action === 'block') {
          if (admins.includes(memberId)) throw new Error('Demote this admin before removing them.');
          const nextMembers = members.filter(id => id !== memberId);
          if (nextMembers.length === members.length) throw new Error('This user is not a group member.');
          if (action === 'block' && !blockedMembers.includes(memberId)) blockedMembers.push(memberId);
          const unreadCounts = { ...(conversationSnapshot.data().unreadCounts || {}) };
          delete unreadCounts[memberId];
          nextMembers.forEach(participantId => {
            if (participantId !== user.uid) unreadCounts[participantId] = (unreadCounts[participantId] || 0) + 1;
          });
          const eventText = `${actorUsername ? `@${actorUsername}` : actorName} removed ${targetUsername ? `@${targetUsername}` : targetName} from the group`;
          transaction.update(groupRef, {
            members:nextMembers,
            blockedMembers,
            bio:groupDefaults.bio,
            urls:groupDefaults.urls,
            admins:admins.filter(id => nextMembers.includes(id))
          });
          transaction.update(conversationRef, {
            participants:nextMembers,
            participantCount:nextMembers.length,
            unreadCounts,
            lastMessage:eventText,
            lastMessageTime:serverTimestamp()
          });
          transaction.set(membershipMessageRef, {
            senderId:user.uid,
            senderName:actorName,
            senderUsername:actorUsername,
            systemType:'membership',
            membershipAction:'removed',
            targetUserId:memberId,
            targetName,
            targetUsername,
            text:eventText,
            readBy:[user.uid],
            deliveredTo:[],
            timestamp:serverTimestamp(),
            clientTimestamp:Date.now()
          });
          return;
        }

        if (action === 'unblock') {
          if (!blockedMembers.includes(memberId)) throw new Error('This user is not blocked.');
          transaction.update(groupRef, {
            members,
            admins,
            blockedMembers:blockedMembers.filter(id => id !== memberId),
            bio:groupDefaults.bio,
            urls:groupDefaults.urls
          });
        }
      });
      setMemberActionFor(null);
    } catch (error) {
      console.error(`Failed to ${action} group member:`, error);
      window.alert(error.message || 'Failed to update group member.');
    }
  };

  const closeActiveConversation = () => {
    openRequestIdRef.current += 1;
    msgsUnsubRef.current.messages?.();
    msgsUnsubRef.current.meta?.();
    msgsUnsubRef.current = { messages: null, meta: null };
    setActiveConvo(null);
    setMessages([]);
    setShowSidebar(true);
  };

  useEffect(() => () => {
    openRequestIdRef.current += 1;
    msgsUnsubRef.current.messages?.();
    msgsUnsubRef.current.meta?.();
  }, []);

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

  // Conversations and group metadata stay synchronized with Firestore.
  useEffect(() => {
    if (!currentUserId) return;
    setLoading(true);
    setConversations([]);
    setActiveConvo(null);
    setMessages([]);

    // STEP 2: Set up real-time listener to sync in background
    const q = query(
      collection(db, 'conversations'), 
      where('participants', 'array-contains', currentUserId)
    );
    
    const unsub = onSnapshot(q, (snapshot) => {
      try {
        const basicConvos = [];
        const currentUid = currentUserId;
        
        snapshot.docs.forEach(d => {
          const data = d.data();
          const otherId = data.participants?.find(id => id !== currentUid) || null;
          
          basicConvos.push({
            id: d.id,
            participants: data.participants || [],
            otherUserId: otherId,
            lastMessage: data.lastMessage || '',
            timestamp: data.lastMessageTime,
            pinned: data.pinned || false,
            blockedBy: data.blockedBy || null,
            locked: data.locked || false,
            lockSalt: data.lockSalt || null,
            unreadCount: (data.unreadCounts?.[currentUid]) || 0,
            isGroup: !!data.isGroup,
            groupId: data.groupId || null,
            groupName: data.groupName || null,
            groupPhotoURL: data.groupPhotoURL || null
          });
        });

        const cachedProfiles = {};
        basicConvos.forEach(convo => {
          if (convo.otherUserId) {
            const cachedProfile = getCachedUser(convo.otherUserId);
            if (cachedProfile) cachedProfiles[convo.otherUserId] = cachedProfile;
          }
        });
        if (Object.keys(cachedProfiles).length) {
          setProfilesById(previous => ({ ...previous, ...cachedProfiles }));
        }

        // Build conversation previews from the current Firestore snapshot.
        const convosWithCachedData = basicConvos.map(c => {
          // check if the current user has deleted this conversation previously
          const deletedMap = userMetaRef.current.deletedConversations || {};
          const deletedTs = deletedMap && deletedMap[c.id] ? deletedMap[c.id] : null;
          let deletedAtMs = null;
          try {
            if (deletedTs == null) deletedAtMs = null;
            else if (typeof deletedTs === 'number') deletedAtMs = deletedTs;
            else if (deletedTs.toMillis) deletedAtMs = deletedTs.toMillis();
            else if (deletedTs.seconds != null) deletedAtMs = (deletedTs.seconds * 1000) + ((deletedTs.nanoseconds || deletedTs.nanos || 0) / 1e6);
          } catch (e) { deletedAtMs = null; }

          const timestampMs = c.timestamp?.toMillis?.()
            || (typeof c.timestamp === 'number' ? c.timestamp : 0);
          const isDeleted = deletedAtMs != null && (!timestampMs || deletedAtMs >= timestampMs);
          const lastMessage = isDeleted ? '' : c.lastMessage || '';
          const lastMessagePreview = lastMessage;

          const isFavourite = (userMetaRef.current.favorites || []).includes(c.otherUserId);

          const cachedProfile = c.otherUserId ? getCachedUser(c.otherUserId) : null;
          const userObj = c.isGroup
            ? { id: c.groupId || c.id, name: c.groupName || 'Group', username: '', photoURL: c.groupPhotoURL || '' }
            : {
                id: c.otherUserId,
                name: cachedProfile?.name || cachedProfile?.username || 'Unknown user',
                username: cachedProfile?.username || '',
                photoURL: cachedProfile?.photoURL || ''
              };

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
            groupId: c.groupId,
            participants: c.participants,
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

        setConversations(convosWithCachedData.slice(0, 50));
        setLoading(false);

      } catch (err) {
        console.error('conversation snapshot sync error', err);
        setLoading(false);
      }
    }, (err) => {
      console.error('conversations onSnapshot error', err);
      setLoading(false);
    });

    return () => { try { unsub(); } catch(e){} };
  }, [user, currentUserId]);

  const profileSubscriptionIds = [...new Set(
    conversations.flatMap(convo => convo.participants || []).filter(uid => uid && uid !== currentUserId)
  )].sort().join('|');

  useEffect(() => {
    if (!currentUserId || !profileSubscriptionIds) return;
    const ids = profileSubscriptionIds.split('|');
    const unsubscribers = ids.map(uid => onSnapshot(
      doc(db, 'publicProfiles', uid),
      (snapshot) => {
        if (!snapshot.exists()) {
          setProfilesById(previous => {
            if (!previous[uid]) return previous;
            const next = { ...previous };
            delete next[uid];
            return next;
          });
          return;
        }
        const profile = snapshot.data();
        cacheUser(uid, profile);
        setProfilesById(previous => ({ ...previous, [uid]: profile }));
        setConversations(previous => previous.map(convo =>
          convo.user?.id === uid && !convo.isGroup
            ? { ...convo, user: { id: uid, ...profile } }
            : convo
        ));
        setActiveConvo(previous =>
          previous?.user?.id === uid && !previous.isGroup
            ? { ...previous, user: { id: uid, ...profile } }
            : previous
        );
      },
      error => console.error(`Public profile listener failed for ${uid}:`, error)
    ));
    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [user, currentUserId, profileSubscriptionIds]);

  const groupSubscriptionIds = [...new Set(
    conversations.filter(convo => convo.isGroup && convo.groupId).map(convo => convo.groupId)
  )].sort().join('|');

  useEffect(() => {
    if (!currentUserId || !groupSubscriptionIds) return;
    const ids = groupSubscriptionIds.split('|');
    const unsubscribers = ids.map(groupId => onSnapshot(
      doc(db, 'groups', groupId),
      snapshot => {
        if (!snapshot.exists()) return;
        const group = snapshot.data();
        setConversations(previous => previous.map(convo =>
          convo.groupId === groupId
            ? {
                ...convo,
                participants: group.members || convo.participants,
                participantCount: group.members?.length || convo.participantCount,
                user: { ...convo.user, name: group.name || convo.user?.name, photoURL: group.photoURL || '' }
              }
            : convo
        ));
        setActiveConvo(previous =>
          previous?.groupId === groupId
            ? {
                ...previous,
                participants: group.members || previous.participants,
                user: { ...previous.user, name: group.name || previous.user?.name, photoURL: group.photoURL || '' }
              }
            : previous
        );
      },
      error => console.error(`Group listener failed for ${groupId}:`, error)
    ));
    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [user, currentUserId, groupSubscriptionIds]);

  const favoriteIds = useMemo(() => userMeta.favorites || [], [userMeta.favorites]);
  useEffect(() => {
    setConversations(previous => previous.map(convo => ({
      ...convo,
      isFavourite: favoriteIds.includes(convo.user?.id)
    })));
  }, [favoriteIds]);

  // Publish this user's presence without subscribing to unrelated presence records.
  useEffect(() => {
    if (!user || !rtdb) return;
    const statusRef = rtdbRef(rtdb, `status/${user.uid}`);
    try {
      rtdbSet(statusRef, { state: 'online', lastChanged: rtdbServerTimestamp() });
      onDisconnect(statusRef).set({ state: 'offline', lastChanged: rtdbServerTimestamp() });
    } catch (err) { console.warn('presence set failed', err); }

    return () => {
      try { rtdbSet(statusRef, { state: 'offline', lastChanged: rtdbServerTimestamp() }); } catch (e){}
    };
  }, [user]);

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
    const requestId = ++openRequestIdRef.current;
    msgsUnsubRef.current.messages?.();
    msgsUnsubRef.current.meta?.();
    msgsUnsubRef.current = { messages: null, meta: null };

    try {
      let userInfo = convo.user;
      if (!userInfo || !userInfo.id || userInfo.name === 'Unknown user' || userInfo.name === 'Loading...') {
        const otherId = (convo.participants || []).find(id => id !== user.uid) || userInfo?.id;
        const cachedProfile = otherId && getCachedUser(otherId);
        if (cachedProfile) {
          userInfo = { id: otherId, ...cachedProfile };
        } else if (otherId) {
          userInfo = { id: otherId, name: 'Unknown user', username: '', photoURL: '' };
        }
      }

      const built = {
        id: convo.id,
        user: userInfo || { id: null, name: 'Unknown', username: '', photoURL: '' },
        lastMessage: convo.lastMessage || '',
        timestamp: convo.timestamp || null,
        unreadCount: convo.unreadCount || 0,
        pinned: convo.pinned || false,
        blockedBy: convo.blockedBy || null,
        locked: convo.locked || false,
        lockSalt: convo.lockSalt || null,
        isGroup: !!convo.isGroup,
        groupId: convo.groupId || null,
        groupName: convo.groupName || null,
        groupPhotoURL: convo.groupPhotoURL || null,
        participants: convo.participants || []
      };

      if (requestId !== openRequestIdRef.current) return;

      setActiveConvo(built);

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

      // subscribe to messages
      try {
        // unsubscribe previous
        try { if (msgsUnsubRef.current.messages) msgsUnsubRef.current.messages(); } catch(e){}
        try { if (msgsUnsubRef.current.meta) msgsUnsubRef.current.meta(); } catch(e){}
        msgsUnsubRef.current.messages = null;
        msgsUnsubRef.current.meta = null;

        const q = query(collection(db, 'conversations', built.id, 'messages'), orderBy('timestamp', 'asc'));
        const unsubMsgs = onSnapshot(q, (snapshot) => {
          if (requestId !== openRequestIdRef.current) return;
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
          if (requestId !== openRequestIdRef.current) return;
          if (!d.exists()) return;
          const data = d.data();
          setActiveConvo(prev => prev?.id === built.id
            ? ({
                ...prev,
                lastMessage: data.lastMessage || '',
                timestamp: data.lastMessageTime || null,
                unreadCount: data.unreadCounts?.[user.uid] || 0,
                pinned: data.pinned || false,
                blockedBy: data.blockedBy || null,
                locked: data.locked || false,
                lockSalt: data.lockSalt || null,
                isGroup: !!data.isGroup,
                groupId: data.groupId || null,
                groupName: data.groupName || null,
                groupPhotoURL: data.groupPhotoURL || null,
                participants: data.participants || []
              })
            : prev);
        }, (err) => console.error('meta onSnapshot error', err));
        msgsUnsubRef.current.meta = unsubMeta;

        markMessagesDelivered(built.id).catch(err => console.error('Failed to mark messages delivered:', err));
        markMessagesRead(built.id).catch(err => console.error('Failed to mark messages read:', err));
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

  useEffect(() => {
    let pendingConversationId;
    try {
      pendingConversationId = localStorage.getItem('zl_open_convo');
    } catch (err) {
      console.warn('Unable to read pending conversation:', err);
      return;
    }

    if (!pendingConversationId) return;
    const pendingConversation = conversations.find(convo => convo.id === pendingConversationId);
    if (!pendingConversation) return;

    localStorage.removeItem('zl_open_convo');
    handleCardClick(pendingConversation);
  }, [conversations, handleCardClick]);

  // search users (debounced inside effect)
  useEffect(() => {
    const perform = async () => {
      const q = (searchQuery || '').trim();
      if (!q || q.length < 2) { setSearchResults([]); return; }
      try {
        setLoading(true);
        const resultsMap = new Map();
        try {
          const uq = query(collection(db, 'publicProfiles'), where('username', '==', q.toLowerCase()), limit(10));
          const snap = await getDocs(uq);
          snap.docs.forEach(d => { const u = { id: d.id, ...d.data() }; if (u.id !== user.uid) resultsMap.set(u.id, u); });
        } catch (e) {}
        try {
          const nq = query(collection(db, 'publicProfiles'), where('name', '>=', q), where('name', '<=', q + '\uf8ff'), limit(10));
          const snap2 = await getDocs(nq);
          snap2.docs.forEach(d => { const u = { id: d.id, ...d.data() }; if (u.id !== user.uid) resultsMap.set(u.id, u); });
        } catch (e) {}
        if (resultsMap.size === 0) {
          let users = usersCacheRef.current;
          if (!users) { const snap = await getDocs(query(collection(db, 'publicProfiles'), limit(500))); users = snap.docs.map(d => ({ id: d.id, ...d.data() })); usersCacheRef.current = users; }
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
      const existingConvoId = await getOrCreateDirectConversation(db, user.uid, targetUser.id);
      const convo = conversations.find(c => c.id === existingConvoId) || {
        id: existingConvoId,
        user: targetUser,
        participants: [user.uid, targetUser.id],
        lastMessage: '',
        timestamp: null,
        unreadCount: 0,
        pinned: false,
        blockedBy: null,
        locked: false,
        isGroup: false
      };

      await openConversation(convo);

      setSearchQuery(''); setSearchResults([]);
    } catch (err) {
      console.error('Error starting conversation:', err);
      alert(`Failed to start conversation: ${err.message || 'Unknown error'}`);
    }
  };

  const sendMessage = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!newMessage.trim() || !activeConvo) return;
    if (activeConvo.blockedBy && activeConvo.blockedBy !== user.uid) { alert('You cannot send messages to this conversation — you are blocked.'); return; }
    if (activeConvo.locked && !unlockedConvos.includes(activeConvo.id)) { alert('This chat is locked. Unlock it to send messages.'); return; }

    try {
      const clientTs = Date.now();
      const text = newMessage.trim();
      const convoRef = doc(db, 'conversations', activeConvo.id);
      const messageRef = doc(collection(db, 'conversations', activeConvo.id, 'messages'));
      await runTransaction(db, async transaction => {
        const convoSnapshot = await transaction.get(convoRef);
        if (!convoSnapshot.exists()) {
          throw new Error('This conversation no longer exists.');
        }

        const conversation = convoSnapshot.data();
        if (!conversation.participants?.includes(user.uid)) {
          throw new Error('You are no longer a participant in this conversation.');
        }

        const unreadCounts = { ...(conversation.unreadCounts || {}) };
        conversation.participants.forEach(participantId => {
          if (participantId !== user.uid) {
            unreadCounts[participantId] = (unreadCounts[participantId] || 0) + 1;
          }
        });

        transaction.set(messageRef, {
          senderId: user.uid,
          senderName: user.displayName || '',
          text,
          readBy: [user.uid],
          deliveredTo: [],
          timestamp: serverTimestamp(),
          clientTimestamp: clientTs
        });
        transaction.update(convoRef, {
          lastMessage: text,
          lastMessageTime: serverTimestamp(),
          unreadCounts
        });
      });
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
      <div style={{ flex:1, display:'flex', flexDirection:'column', background:'var(--right-chat-area-bg)', minWidth: Math.max(360, getMaxSideWidth()) }}>
        {activeConvo ? (
          <>
            <div style={{ padding:16, borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:12, background: 'var(--card-bg)' }}>
              <button
                type="button"
                aria-label="Close conversation"
                onClick={closeActiveConversation}
                style={{ display:'flex', alignItems:'center', justifyContent:'center', width:36, height:36, border:0, borderRadius:'50%', background:'transparent', color:'var(--text-primary)', cursor:'pointer', flexShrink:0 }}
              >
                <FiArrowLeft size={22} />
              </button>
              <button
                type="button"
                aria-label="View profile picture"
                onClick={() => setShowProfilePhoto(true)}
                style={{ padding:0, border:0, borderRadius:'50%', background:'transparent', cursor:'pointer', flexShrink:0 }}
              >
                <AvatarCircle src={activeConvo.user?.photoURL} alt={activeConvo.user?.name || 'Profile picture'} size={44} />
              </button>
              <button
                type="button"
                aria-label="View conversation details"
                onClick={() => setShowConversationInfo(true)}
                style={{ flex:1, minWidth:0, padding:0, textAlign:'left', border:0, background:'transparent', color:'inherit', cursor:'pointer' }}
              >
                <span style={{ display:'block', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {activeConvo.user?.name || 'Unknown user'}
                </span>
                <span style={{ display:'block', marginTop:2, fontSize:12, color:'var(--text-secondary)', textAlign:'left', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {activeConvo.isGroup ? (() => {
                    const participants = activeConvo.participants || [];
                    const usernames = participants
                      .filter(pid => pid !== user?.uid)
                      .map(pid => profilesById[pid]?.username || getCachedUser(pid)?.username)
                      .filter(Boolean);
                    return usernames.slice(0, 3).map(username => `@${username}`).join(', ')
                      + (usernames.length > 3 ? '…' : '');
                  })() : (activeConvo.user?.username ? `@${activeConvo.user.username}` : '')}
                </span>
              </button>
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
                      if (msg.systemType === 'membership') {
                        const actor = msg.senderUsername ? `@${msg.senderUsername}` : msg.senderName || 'A group admin';
                        const target = msg.targetUsername ? `@${msg.targetUsername}` : msg.targetName || 'a member';
                        const actionText = msg.membershipAction === 'added'
                          ? `${actor} added ${target} to the group`
                          : `${actor} removed ${target} from the group`;
                        return (
                          <div key={msg.id || idx} style={{ display:'flex', justifyContent:'center', margin:'8px 0' }}>
                            <div style={{ maxWidth:'85%', padding:'7px 14px', borderRadius:14, background:'#f3e8ff', color:'#6b21a8', textAlign:'center', fontSize:12, lineHeight:1.45 }}>
                              {actionText}
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={msg.id || idx} className={`message ${isOwn ? 'own' : 'other'}${hasEmbeddableVideo(msg.text) ? ' has-video' : ''}`} style={{ marginBottom: 8 }}>
                          <div className="msg">
                            {/* Header: name (left) + username (right) - only for received messages */}
                            {!isOwn && (
                              <div className="msg-header">
                                <div className="name">{profilesById[msg.senderId]?.name || getCachedUser(msg.senderId)?.name || msg.senderName || 'Unknown user'}</div>
                                {(profilesById[msg.senderId]?.username || getCachedUser(msg.senderId)?.username) && (
                                  <div className="username">@{profilesById[msg.senderId]?.username || getCachedUser(msg.senderId)?.username}</div>
                                )}
                              </div>
                            )}
                            {/* Message body */}
                            <div className="msg-body">
                              <VideoMessage text={msg.text || ''} />
                            </div>
                            {/* Footer: time + ticks */}
                            <div className="msg-footer">
                              <span className="time">{(() => {
                                if (!msg.timestamp) return '';
                                try {
                                  const d = msg.timestamp.toDate ? msg.timestamp.toDate() : new Date(msg.timestamp);
                                  return d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
                                } catch(e){ return ''; }
                              })()}</span>
                              {isOwn && (
                                <span className="tick" title={readByOther ? 'Read' : (deliveredToOther ? 'Delivered' : 'Sent')}>
                                  {readByOther ? '✔✔' : (deliveredToOther ? '✔✔' : '✔')}
                                </span>
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

            <form onSubmit={sendMessage} style={{ padding:'4px 10px', borderTop:'1px solid var(--border)', display:'flex', gap:8, background: 'var(--card-bg)' }}>
              {/* emoji button code */}
              <BsEmojiLaughing size={22} className="emoji-button" onClick={() => { alert('Emoji picker not implemented yet'); }} />
              {/* message sending input bar */}
              <input type="text" placeholder="Type a message..." value={newMessage} onChange={(e)=>setNewMessage(e.target.value)} style={{ flex:1, padding:'8px 10px', borderRadius:8, border:'none', background:'var(--card-bg)', color:'var(--text-primary)', outline: 'none', fontSize: 14, letterSpacing:0.3 }} />
              {/* message sending button */}
              <button type="submit" aria-label="Send" disabled={!newMessage.trim()} style={{ padding:'10px 14px', background: newMessage.trim() ? 'var(--card-bg)' : 'var(--card-bg)', color: newMessage.trim() ? 'var(--text-primary)' : 'var(--card-bg)', border:'none', borderRadius:8, cursor: newMessage.trim() ? 'pointer' : 'not-allowed', fontWeight:600, display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
                <LuSendHorizontal size={18} />
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
                            const ud = await getDoc(doc(db, 'publicProfiles', fid));
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
                        try { const ud = await getDoc(doc(db, 'publicProfiles', fid)); if (ud && ud.exists()) startConversation({ id: ud.id, ...ud.data() }); else startConversation({ id: fid }); } catch(e){ startConversation({ id: fid }); }
                      }}>Message</button>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {showProfilePhoto && activeConvo && (
        <div
          role="presentation"
          onClick={() => setShowProfilePhoto(false)}
          style={{ position:'fixed', inset:0, zIndex:1500, display:'flex', alignItems:'center', justifyContent:'center', padding:24, background:'rgba(0,0,0,0.78)' }}
        >
          <button
            type="button"
            aria-label="Close profile picture"
            onClick={() => setShowProfilePhoto(false)}
            style={{ position:'absolute', top:20, right:20, display:'flex', alignItems:'center', justifyContent:'center', width:42, height:42, border:0, borderRadius:'50%', background:'rgba(255,255,255,0.16)', color:'#fff', cursor:'pointer' }}
          >
            <FiX size={24} />
          </button>
          {activeConvo.user?.photoURL ? (
            (() => {
              const photoURL = activeConvo.user.photoURL;
              const dimensions = profilePhotoDimensions?.src === photoURL ? profilePhotoDimensions : null;
              return (
                <img
                  src={photoURL}
                  alt={activeConvo.user?.name || 'Profile picture'}
                  onClick={event => event.stopPropagation()}
                  onLoad={event => {
                    const { naturalWidth, naturalHeight } = event.currentTarget;
                    setProfilePhotoDimensions({ src: photoURL, width: naturalWidth, height: naturalHeight });
                  }}
                  style={{
                    display:'block',
                    width:'auto',
                    height:'auto',
                    maxWidth: dimensions
                      ? `min(calc(100vw - 48px), 960px, ${dimensions.width * 3}px)`
                      : 'min(calc(100vw - 48px), 960px)',
                    maxHeight: dimensions
                      ? `min(calc(100vh - 48px), 900px, ${dimensions.height * 3}px)`
                      : 'min(calc(100vh - 48px), 900px)',
                    objectFit:'contain',
                    borderRadius:20,
                    boxShadow:'0 20px 70px rgba(0,0,0,0.4)'
                  }}
                />
              );
            })()
          ) : (
            <div onClick={event => event.stopPropagation()}>
              <AvatarCircle src={null} alt={activeConvo.user?.name || 'Profile picture'} size={240} />
            </div>
          )}
        </div>
      )}

      {showConversationInfo && activeConvo && (
        <div
          role="presentation"
          onClick={() => setShowConversationInfo(false)}
          style={{ position:'fixed', inset:0, zIndex:1490, display:'flex', alignItems:'center', justifyContent:'center', padding:16, background:'rgba(0,0,0,0.52)' }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={activeConvo.isGroup ? 'Group information' : 'Contact information'}
            onClick={event => event.stopPropagation()}
            style={{ width:'min(100%, 440px)', maxHeight:'min(82vh, 720px)', overflowY:'auto', borderRadius:20, background:'var(--card-bg)', color:'var(--text-primary)', boxShadow:'0 20px 70px rgba(0,0,0,0.3)' }}
          >
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid var(--border)' }}>
              <h2 style={{ margin:0, fontSize:18 }}>{activeConvo.isGroup ? 'Group information' : 'Contact information'}</h2>
              <button
                type="button"
                aria-label="Close conversation details"
                onClick={() => setShowConversationInfo(false)}
                style={{ display:'flex', alignItems:'center', justifyContent:'center', width:36, height:36, border:0, borderRadius:'50%', background:'transparent', color:'inherit', cursor:'pointer' }}
              >
                <FiX size={21} />
              </button>
            </div>

            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'24px 20px 20px', textAlign:'center' }}>
              <AvatarCircle
                src={activeConvo.isGroup ? (groupInfo?.photoURL || activeConvo.groupPhotoURL) : activeConvo.user?.photoURL}
                alt={activeConvo.user?.name || 'Profile picture'}
                size={112}
              />
              <h3 style={{ margin:'14px 0 4px', fontSize:21 }}>{groupInfo?.name || activeConvo.user?.name || 'Unknown user'}</h3>
              {!activeConvo.isGroup && (
                <>
                  {activeConvo.user?.username && <div style={{ color:'var(--text-secondary)' }}>@{activeConvo.user.username}</div>}
                  <p style={{ margin:'12px 0 0', lineHeight:1.5, whiteSpace:'pre-wrap' }}>
                    {activeConvo.user?.bio || 'No bio added.'}
                  </p>
                  {(activeConvo.user?.urls || []).filter(Boolean).map(url => (
                    <a key={url} href={url} target="_blank" rel="noreferrer" style={{ marginTop:8, color:'var(--primary)', overflowWrap:'anywhere' }}>
                      {url}
                    </a>
                  ))}
                </>
              )}
              {activeConvo.isGroup && (
                <div style={{ marginTop:6, color:'var(--text-secondary)' }}>
                  {groupInfoLoading ? 'Loading group details…' : `${(groupInfo?.members || activeConvo.participants || []).length} members`}
                </div>
              )}
            </div>

            {activeConvo.isGroup && (
              <div style={{ padding:'0 20px 20px' }}>
                <section style={{ padding:'0 0 16px', marginBottom:18, borderBottom:'1px solid var(--border)' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
                    <h4 style={{ margin:0, fontSize:15 }}>Group details</h4>
                    {isGroupAdmin && !groupInfoEditing && (
                      <button
                        type="button"
                        aria-label="Edit group details"
                        onClick={() => setGroupInfoEditing(true)}
                        style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:34, height:34, border:0, borderRadius:8, background:'var(--hover-bg)', color:'inherit', cursor:'pointer' }}
                      >
                        <FiEdit2 size={16} />
                      </button>
                    )}
                  </div>
                  {groupInfoEditing ? (
                    <div style={{ marginTop:12 }}>
                      <label className="form-label">Group name</label>
                      <input
                        className="form-input"
                        value={groupInfoDraft.name}
                        onChange={event => setGroupInfoDraft({ ...groupInfoDraft, name:event.target.value })}
                        maxLength={80}
                      />
                      <label className="form-label" style={{ display:'block', marginTop:12 }}>Group image URL</label>
                      <input
                        className="form-input"
                        type="url"
                        value={groupInfoDraft.photoURL}
                        onChange={event => setGroupInfoDraft({ ...groupInfoDraft, photoURL:event.target.value })}
                        placeholder="https://example.com/image.jpg"
                      />
                      <label className="form-label">Bio</label>
                      <textarea
                        className="form-input"
                        value={groupInfoDraft.bio}
                        onChange={event => setGroupInfoDraft({ ...groupInfoDraft, bio:event.target.value })}
                        style={{ minHeight:72, resize:'vertical' }}
                      />
                      <UrlFields
                        urls={groupInfoDraft.urls}
                        onChange={urls => setGroupInfoDraft({ ...groupInfoDraft, urls })}
                        maxUrls={3}
                        label="Group links"
                      />
                      <div style={{ display:'flex', gap:8 }}>
                        <button type="button" className="btn-primary" onClick={saveGroupInfo} disabled={savingGroupInfo}>
                          <FiCheck size={16} /> {savingGroupInfo ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            setGroupInfoDraft({
                              name:groupInfo?.name || activeConvo.groupName || '',
                              photoURL:groupInfo?.photoURL || activeConvo.groupPhotoURL || '',
                              bio:groupInfo?.bio || 'We are using ZeroLeak',
                              urls:groupInfo?.urls?.length ? groupInfo.urls : ['']
                            });
                            setGroupInfoEditing(false);
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p style={{ margin:'9px 0 0', lineHeight:1.5, whiteSpace:'pre-wrap' }}>
                        {groupInfo?.bio || 'We are using ZeroLeak'}
                      </p>
                      <h4 style={{ margin:'16px 0 0', fontSize:15 }}>Links</h4>
                      {(groupInfo?.urls || []).filter(Boolean).map(url => (
                        <a key={url} href={url} target="_blank" rel="noreferrer" style={{ display:'block', marginTop:8, color:'var(--primary)', overflowWrap:'anywhere' }}>
                          {url}
                        </a>
                      ))}
                      {!(groupInfo?.urls || []).some(Boolean) && (
                        <p style={{ margin:'8px 0 0', color:'var(--text-secondary)', fontSize:13 }}>No links added.</p>
                      )}
                    </>
                  )}
                </section>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, fontWeight:600 }}>
                    <FiUsers size={18} />
                    <span>Members</span>
                  </div>
                  {isGroupAdmin && (
                    <button
                      type="button"
                      onClick={() => setShowAddMembers(value => !value)}
                      style={{ display:'inline-flex', alignItems:'center', gap:5, border:0, borderRadius:8, padding:'6px 10px', background:'var(--hover-bg)', color:'var(--primary)', fontWeight:600, cursor:'pointer' }}
                    >
                      <FiPlus size={15} /> Add
                    </button>
                  )}
                </div>
                {showAddMembers && isGroupAdmin && (
                  <div style={{ padding:12, marginBottom:12, border:'1px solid var(--border)', borderRadius:12 }}>
                    <input
                      className="form-input"
                      type="search"
                      value={addMemberQuery}
                      onChange={event => setAddMemberQuery(event.target.value)}
                      placeholder="Search by name or username"
                      aria-label="Search users to add to group"
                    />
                    {loadingMemberSearch && <div style={{ padding:10, color:'var(--text-secondary)', fontSize:13 }}>Searching…</div>}
                    {!loadingMemberSearch && addMemberQuery.trim().length >= 2 && addMemberResults.length === 0 && (
                      <div style={{ padding:10, color:'var(--text-secondary)', fontSize:13 }}>No available users found.</div>
                    )}
                    {addMemberResults.map(member => (
                      <div key={member.id} style={{ display:'flex', alignItems:'center', gap:9, padding:'9px 0', borderTop:'1px solid var(--border)' }}>
                        <AvatarCircle src={member.photoURL} alt={member.name || 'User'} size={36} />
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontWeight:600 }}>{member.name || member.username}</div>
                          {member.username && <div style={{ fontSize:12, color:'var(--text-secondary)' }}>@{member.username}</div>}
                        </div>
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={addingMemberId === member.id}
                          onClick={() => addGroupMember(member)}
                        >
                          {addingMemberId === member.id ? 'Adding…' : 'Add'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {(groupInfo?.members || activeConvo.participants || []).map(memberId => {
                    const member = profilesById[memberId] || getCachedUser(memberId) || {};
                    const admins = groupInfo?.admins?.length ? groupInfo.admins : [groupInfo?.ownerId].filter(Boolean);
                    const memberIsAdmin = admins.includes(memberId);
                    return (
                      <div key={memberId} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderTop:'1px solid var(--border)' }}>
                        <AvatarCircle src={member.photoURL} alt={member.name || 'Member'} size={40} />
                        <div style={{ minWidth:0, flex:1, textAlign:'left' }}>
                          <div style={{ fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {memberId === user?.uid ? `${member.name || 'You'} (You)` : member.name || member.username || 'Member'}
                            {memberIsAdmin && <span style={{ marginLeft:7, fontSize:11, color:'var(--primary)' }}>Admin</span>}
                          </div>
                          {member.username && <div style={{ fontSize:12, color:'var(--text-secondary)' }}>@{member.username}</div>}
                        </div>
                        {isGroupAdmin && memberId !== groupInfo?.ownerId && (
                          <div style={{ position:'relative' }}>
                            <button
                              type="button"
                              aria-label={`Actions for ${member.name || member.username || 'member'}`}
                              onClick={() => setMemberActionFor(memberActionFor === memberId ? null : memberId)}
                              style={{ display:'flex', alignItems:'center', justifyContent:'center', width:34, height:34, border:0, borderRadius:8, background:'transparent', color:'inherit', cursor:'pointer' }}
                            >
                              <FiMoreVertical />
                            </button>
                            {memberActionFor === memberId && (
                              <div style={{ position:'absolute', right:0, top:36, zIndex:2, minWidth:175, padding:6, border:'1px solid var(--border)', borderRadius:10, background:'var(--card-bg)', boxShadow:'var(--shadow-md)' }}>
                                {isGroupOwner && (
                                  <button type="button" className="btn-secondary" style={{ width:'100%', marginBottom:4 }} onClick={() => handleGroupMemberAction(memberIsAdmin ? 'demote' : 'promote', memberId)}>
                                    {memberIsAdmin ? 'Remove admin' : 'Make admin'}
                                  </button>
                                )}
                                {memberIsAdmin && !isGroupOwner && (
                                  <div style={{ padding:'7px 8px', fontSize:12, color:'var(--text-secondary)' }}>Admins cannot manage other admins.</div>
                                )}
                                {!memberIsAdmin && (
                                  <>
                                    <button type="button" className="btn-secondary" style={{ width:'100%', marginBottom:4 }} onClick={() => handleGroupMemberAction('remove', memberId)}>Remove member</button>
                                    <button type="button" className="btn-secondary" style={{ width:'100%' }} onClick={() => handleGroupMemberAction('block', memberId)}>Block member</button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {(groupInfo?.blockedMembers || []).length > 0 && (
                  <section style={{ marginTop:20 }}>
                    <h4 style={{ margin:'0 0 8px', fontSize:14 }}>Blocked members</h4>
                    {groupInfo.blockedMembers.map(memberId => {
                      const member = profilesById[memberId] || getCachedUser(memberId) || {};
                      return (
                        <div key={memberId} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderTop:'1px solid var(--border)' }}>
                          <AvatarCircle src={member.photoURL} alt={member.name || 'Blocked member'} size={36} />
                          <div style={{ flex:1, minWidth:0, textAlign:'left' }}>
                            <div style={{ fontWeight:600 }}>{member.name || member.username || 'Blocked member'}</div>
                            {member.username && <div style={{ fontSize:12, color:'var(--text-secondary)' }}>@{member.username}</div>}
                          </div>
                          {isGroupAdmin && (
                            <button type="button" className="btn-secondary" onClick={() => handleGroupMemberAction('unblock', memberId)}>Unblock</button>
                          )}
                        </div>
                      );
                    })}
                  </section>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default Chat;
