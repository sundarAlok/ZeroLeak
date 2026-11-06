import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import '../../components/styles/common.css';
import { getOrCreateDirectConversation } from '../../firebase/conversations';

const Favorites = () => {
  const { user } = useAuth();
  const [favUsers, setFavUsers] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const favoriteIdsKey = favoriteIds.join('|');

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    return onSnapshot(doc(db, 'users', user.uid), snapshot => {
      setFavoriteIds(snapshot.exists() ? snapshot.data().favorites || [] : []);
    }, err => {
      console.error('Failed to subscribe to favorite IDs:', err);
      setLoading(false);
    });
  }, [user]);

  useEffect(() => {
    const ids = favoriteIdsKey ? favoriteIdsKey.split('|') : [];
    if (ids.length === 0) {
      setFavUsers([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const profiles = new Map();
    const receivedInitialSnapshot = new Set();
    const markReceived = id => {
      receivedInitialSnapshot.add(id);
      if (receivedInitialSnapshot.size === ids.length) setLoading(false);
    };
    const unsubscribers = ids.map(id => onSnapshot(
      doc(db, 'publicProfiles', id),
      snapshot => {
        if (snapshot.exists()) profiles.set(id, { id, ...snapshot.data() });
        else profiles.delete(id);
        setFavUsers(ids.map(favoriteId => profiles.get(favoriteId)).filter(Boolean));
        markReceived(id);
      },
      err => {
        console.error(`Failed to subscribe to favorite profile ${id}:`, err);
        profiles.delete(id);
        setFavUsers(ids.map(favoriteId => profiles.get(favoriteId)).filter(Boolean));
        markReceived(id);
      }
    ));
    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [favoriteIdsKey]);

  const startConversation = async (targetUser) => {
    if (!user || !targetUser) return;
    try {
      const existing = await getOrCreateDirectConversation(db, user.uid, targetUser.id);

      // Store a flag to open the convo when Chat mounts
      try { localStorage.setItem('zl_open_convo', existing); } catch(e){}
      navigate('/chat');
    } catch (err) {
      console.error('startConversation failed', err);
      alert('Failed to start conversation');
    }
  };

  const visible = favUsers.filter(u => (u.name||'').toLowerCase().includes(filter.toLowerCase()) || (u.username||'').toLowerCase().includes(filter.toLowerCase()));

  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ marginTop:0 }}>Favorites</h2>
      <div style={{ margin: '12px 0' }}>
        <input placeholder="Search favorites" value={filter} onChange={(e)=>setFilter(e.target.value)} className='search-input' />
      </div>
      {loading ? <div>Loading...</div> : (
        <div style={{ display:'flex', flexDirection:'column', gap:8, padding:8, borderRadius:8, background:'var(--card-bg)', boxShadow:'var(--shadow-sm)', border:'1px solid var(--border)' }}>
          {visible.length === 0 ? <div style={{ color:'var(--text-secondary)' }}>No favorites yet</div> : visible.map(u => {
            const displayName = u?.name || u?.displayName || u?.platformName || u?.username || 'Unknown';
            const username = u?.username || '';
            const initials = (displayName||'').split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
            const showUsername = username && username.toLowerCase() !== (displayName||'').toLowerCase();
            return (
              <div key={u.id} style={{ display:'flex', gap:12, alignItems:'center', padding:8, borderRadius:8, background:'transparent', border:'none', boxShadow:'none' }}>
                {u?.photoURL ? (
                  <img src={u.photoURL} alt={displayName} style={{ width:46, height:46, borderRadius:50, objectFit:'cover', border: '2px solid rgba(99,102,241,0.10)' }} />
                ) : (
                  <div style={{ width:46, height:46, borderRadius:50, background:'linear-gradient(135deg,var(--primary),var(--accent))', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700 }}>{initials}</div>
                )}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{displayName}</div>
                  {showUsername && <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:2 }}>@{username}</div>}
                </div>
                <div>
                  <button className="zl-btn" onClick={() => startConversation(u)}>Message</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Favorites;
