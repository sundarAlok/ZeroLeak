// PremiumCards.jsx
import React from 'react';
import '../styles/common.css';
import { FiMoreVertical } from 'react-icons/fi';
import { GrFormPin } from 'react-icons/gr';

export const ChatCard = ({ user, lastMessage, lastMessagePreview, timestamp, isActive, onCardClick, onMenuClick, unreadCount = 0, participantCount = 2, pinned = false, participants = [], isGroup = false }) => {
  const [photoError, setPhotoError] = React.useState(false);
  React.useEffect(() => setPhotoError(false), [user?.photoURL]);
  const getInitials = (name) => (name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) : '?');
  const getDisplayName = (u) => {
    // Prefer the platform `name` field first (user's chosen name), then fallbacks
    return u?.name || u?.displayName || u?.platformName || u?.username || 'Unknown';
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    let d;
    try {
      if (typeof ts === 'number') d = new Date(ts);
      else if (ts?.toDate) d = ts.toDate();
      else if (ts && ts.seconds != null) d = new Date((ts.seconds * 1000) + ((ts.nanoseconds || ts.nanos || 0) / 1e6));
      else d = new Date(ts);
    } catch (e) {
      d = new Date(ts || Date.now());
    }
    const now = new Date();
    // If same day, show local time (hh:mm). Otherwise, show relative days or full date.
    try {
      if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      }
      const msPerDay = 1000 * 60 * 60 * 24;
      const diffDays = Math.floor((now - d) / msPerDay);
      // Protect against showing "0d" when dates are very close or parsing differs
      if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      if (diffDays > 0 && diffDays < 7) return `${diffDays}d`;
      return d.toLocaleDateString();
    } catch (e) {
      return '';
    }
  };

  return (
    <div className={`chat-card ${isActive ? 'active' : ''}`} onClick={onCardClick} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onCardClick && onCardClick(); }}>
      {/* Avatar column */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, flexShrink:0, alignSelf: 'stretch' }}>
        {user?.photoURL && !photoError ? (
          <img src={user.photoURL} alt={user.name} style={{ width:46, height:46, borderRadius:50, objectFit:'cover' }} onError={() => setPhotoError(true)} />
        ) : (
          <div style={{ width:46, height:46, borderRadius:50, background:'linear-gradient(135deg,var(--primary),var(--accent))', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>{getInitials(user?.name)}</div>
        )}
      </div>

      {/* Content column */}
      <div style={{ flex:1, minWidth:0, textAlign:'left', display:'flex', flexDirection:'column', gap:0, justifyContent:'center' }}>
        {/* Row 1: name (left) | time + menu (right) */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <h3 style={{ margin:0, fontSize:16, lineHeight:1.2, fontWeight: unreadCount > 0 ? 700 : 600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{getDisplayName(user)}</h3>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:8, marginLeft:12, flexShrink:0 }}>
            <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1 }}>{formatTime(timestamp)}</div>
            <button onClick={(e)=>{ e.stopPropagation(); if (onMenuClick) onMenuClick(e); }} aria-label="Menu" style={{ background:'transparent', border:'none', padding:6, cursor:'pointer', color:'var(--text-secondary)', lineHeight:0.5 }}>
              <FiMoreVertical size={16} />
            </button>
          </div>
        </div>

        {/* Row 2: message preview (left) | pin (right) */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <p className="chat-card-message" style={{ margin:0, marginBottom:4 ,fontSize:12, color: unreadCount > 0 ? 'var(--text-primary)' : 'var(--text-secondary)', textAlign:'left', lineHeight:1.1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{lastMessagePreview ? String(lastMessagePreview) : (lastMessage ? String(lastMessage) : 'No messages yet')}</p>
          </div>
          <div style={{ marginLeft:10, flexShrink:0 }}>
            {pinned && <div style={{ color:'var(--primary)', fontSize:18, paddingRight:4 }} title="Pinned"><GrFormPin /></div>}
          </div>
        </div>
      </div>

      {unreadCount > 0 && <div style={{ marginLeft:8 }}><div className="unread-badge" aria-hidden>{unreadCount > 99 ? '99+' : unreadCount}</div></div>}
    </div>
  );
};

export const UserCard = ({ user, onSelect }) => {
  const [photoError, setPhotoError] = React.useState(false);
  React.useEffect(() => setPhotoError(false), [user?.photoURL]);
  const initials = user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) : '?';
  const displayName = user?.name || user?.displayName || user?.platformName || user?.username || 'Unknown';
  const username = user?.username || '';
  const showUsername = username && username.toLowerCase() !== (displayName||'').toLowerCase();
  return (
    <div className="chat-card" onClick={() => onSelect && onSelect(user)} style={{ display:'flex', gap:12, alignItems:'center' }}>
      {user?.photoURL && !photoError ? (
        <img src={user.photoURL} alt={displayName} style={{ width:46, height:46, borderRadius:50, objectFit:'cover', border: '2px solid rgba(99,102,241,0.10)' }} onError={() => setPhotoError(true)} />
      ) : (
        <div style={{ width:46, height:46, borderRadius:50, background:'linear-gradient(135deg,var(--primary),var(--accent))', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>{initials}</div>
      )}
      <div style={{ minWidth:0 }}>
        <div style={{ fontWeight:700, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{displayName}</div>
        {showUsername && <div style={{ fontSize:13, color:'var(--text-secondary)', marginTop:2 }}>@{username}</div>}
      </div>
    </div>
  );
};

export const MomentCard = ({ text, imageUrl, backgroundColor = '#fff', textColor = '#000', userName, userPhoto, timestamp }) => {
  return (
    <div style={{ background: imageUrl ? `url(${imageUrl}) center/cover` : backgroundColor, color: textColor, borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow)', minHeight:180, padding:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {userPhoto ? (
            <img src={userPhoto} alt={userName} style={{ width:36, height:36, borderRadius:'50%', objectFit:'cover' }} />
          ) : (
            <div style={{ width:36, height:36, borderRadius:'50%', background:'linear-gradient(135deg,var(--primary),var(--accent))', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700 }}>{userName?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}</div>
          )}
          <div>
            <div style={{ fontWeight:700 }}>{userName}</div>
            <div style={{ fontSize:12, color:'var(--text-secondary)' }}>{
              timestamp ? (() => {
                try {
                  if (typeof timestamp === 'number') return new Date(timestamp).toLocaleString();
                  if (timestamp?.toDate) return timestamp.toDate().toLocaleString();
                  if (timestamp && timestamp.seconds != null) return new Date((timestamp.seconds * 1000) + ((timestamp.nanoseconds || timestamp.nanos || 0) / 1e6)).toLocaleString();
                  return new Date(timestamp).toLocaleString();
                } catch (e) { return ''; }
              })() : ''
            }</div>
          </div>
        </div>
      </div>

      {text && <div style={{ fontSize:16, lineHeight:1.4 }}>{text}</div>}
    </div>
  );
};
