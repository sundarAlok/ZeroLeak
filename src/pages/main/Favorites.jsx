import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase/firebase';
import { collection, getDoc, doc, getDocs, query, where, addDoc, serverTimestamp, limit } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import '../../components/styles/common.css';

const Favorites = () => {
  const { user } = useAuth();
  const [favUsers, setFavUsers] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const ud = await getDoc(doc(db, 'users', user.uid));
        const favs = (ud.exists() && ud.data().favorites) || [];
        if (favs.length === 0) {
          if (mounted) setFavUsers([]);
          return;
        }
        const usersSnapPromises = favs.map(id => getDoc(doc(db, 'users', id)).catch(() => null));
        const results = await Promise.all(usersSnapPromises);
        const users = results.filter(r=>r && r.exists()).map(r=>({ id: r.id, ...r.data() }));
        if (mounted) setFavUsers(users);
      } catch (err) {
        console.error('Failed to load favorites', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [user]);

  const startConversation = async (targetUser) => {
    if (!user || !targetUser) return;
    try {
      // Try to find existing conversation between user and targetUser
      const q = query(collection(db, 'conversations'), where('participants', 'array-contains', user.uid), limit(500));
      const snap = await getDocs(q);
      let existing = null;
      for (const d of snap.docs) {
        const data = d.data();
        if (data.participants?.includes(targetUser.id)) { existing = d.id; break; }
      }
      if (!existing) {
        const r = await addDoc(collection(db, 'conversations'), {
          participants: [user.uid, targetUser.id],
          lastMessage: '',
          lastMessageTime: serverTimestamp(),
          createdAt: serverTimestamp(),
          pinned: false,
          blockedBy: null,
          locked: false,
          unreadCounts: { [user.uid]: 0, [targetUser.id]: 0 }
        });
        existing = r.id;
      }

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
        <input placeholder="Search favorites" value={filter} onChange={(e)=>setFilter(e.target.value)} style={{ width:'100%', padding:10, borderRadius:8, border:'1px solid var(--border)' }} />
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
