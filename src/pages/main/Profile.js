// Profile.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { doc, query, where, collection, writeBatch, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { getPublicProfile } from '../../firebase/publicProfile';
import '../../components/styles/common.css';
import { getCachedUserProfile, cacheUserProfile } from '../../utils/cacheManager';
import { MdLogout } from "react-icons/md";
import { LiaEdit } from "react-icons/lia";
import { BsSave2 } from "react-icons/bs";
import AvatarCircle from '../../components/common/AvatarCircle';

const Profile = () => {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [conversationCount, setConversationCount] = useState(0);
  const [momentCount, setMomentCount] = useState(0);
  const [groupCount, setGroupCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    // Load from cache immediately
    const cachedProfile = getCachedUserProfile(user.uid);
    if (cachedProfile) {
      setProfile(cachedProfile);
      setEditData(cachedProfile);
      setLoading(false);
    }

    setLoading(!cachedProfile);
    const unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), snapshot => {
      const profileData = snapshot.exists() ? snapshot.data() : {
        name: user.displayName || 'No name',
        username: user.email?.split('@')[0] || 'user',
        bio: '',
        photoURL: user.photoURL || null
      };
      setProfile(profileData);
      setEditData(profileData);
      cacheUserProfile(user.uid, profileData);
      setLoading(false);
    }, err => {
      console.error('Error subscribing to profile:', err);
      setError('Failed to load profile');
      setLoading(false);
    });

    const unsubscribeConversations = onSnapshot(
      query(collection(db, 'conversations'), where('participants', 'array-contains', user.uid)),
      snapshot => {
        const nonGroupCount = snapshot.docs.filter(item => !item.data().isGroup).length;
        const groupCount = snapshot.docs.filter(item => item.data().isGroup).length;
        setConversationCount(nonGroupCount);
        setGroupCount(groupCount);
      },
      err => console.error('Error subscribing to conversations:', err)
    );
    const unsubscribeMoments = onSnapshot(
      query(collection(db, 'moments'), where('userId', '==', user.uid)),
      snapshot => setMomentCount(snapshot.size),
      err => console.error('Error subscribing to moments:', err)
    );

    return () => {
      unsubscribeProfile();
      unsubscribeConversations();
      unsubscribeMoments();
    };
  }, [user]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!editData.name || !editData.bio) { setError('Name and bio are required'); return; }
    try {
      setSaving(true);
      const updatedProfile = { ...profile, ...editData };
      const batch = writeBatch(db);
      batch.update(doc(db, 'users', user.uid), {
        name: editData.name,
        bio: editData.bio,
        photoURL: editData.photoURL || null
      });
      batch.set(doc(db, 'publicProfiles', user.uid), getPublicProfile(user.uid, updatedProfile));
      await batch.commit();
      setProfile(editData);
      setIsEditing(false);
      setSuccess('Profile updated successfully!');
      setTimeout(()=>setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating profile:', err);
      setError('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !profile) {
    return <div style={{ padding:20, textAlign:'center' }}><p>Loading profile...</p></div>;
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 80px)', background:'var(--app-bg)', overflowY:'auto' }}>
      <div style={{ maxWidth:720, margin:'0 auto', padding:20, width:'100%' }}>
        <div style={{ background:'var(--card-bg)', borderRadius:16, padding:24, textAlign:'center', boxShadow:'var(--shadow-sm)', marginBottom:20 }}>
          <div style={{ marginBottom:16 }}>
            <AvatarCircle
              src={profile.photoURL}
              alt={profile.name}
              size={100}
              style={{ border: '4px solid var(--primary)' }}
            />
          </div>

          <h1 style={{ fontSize:24, fontWeight:700, margin:'0 0 4px 0', color:'var(--text-primary)' }}>{profile.name}</h1>
          <p style={{ fontSize:14, color:'var(--text-secondary)', margin:'0 0 12px 0' }}>@{profile.username}</p>

          {!isEditing && <>
            <p style={{ fontSize:14, color:'var(--text-primary)', margin:'12px 0 0 0', lineHeight:1.5 }}>{profile.bio || 'Hey there — I am using ZeroLeak!'}</p>
            <div style={{ display:'flex', gap:8, marginTop:20 }}>
              <button 
                onClick={()=>setIsEditing(true)} 
                className="btn-primary" 
                style={{ flex: 1}}> <LiaEdit size={22} /> Edit Profile
              </button>
              <button 
                onClick={() => { if(window.confirm('Sign out?')) signOut(); }} 
                className="btn-primary" 
                style={{ flex: 1}} >
                <MdLogout size={20}/> Sign Out
              </button>

            </div>
          </>}

        </div>

        {isEditing && (
          <div style={{ background:'var(--card-bg)', borderRadius:16, padding:24, boxShadow:'var(--shadow-sm)', marginBottom:20 }}>
            <h2 style={{ fontSize:18, fontWeight:700, margin:'0 0 20px 0' }}>Edit Profile</h2>
            {error && <div style={{ background:'#ffecec', color:'#7c1d1d', padding:8, borderRadius:8, marginBottom:12 }}>{error}</div>}
            {success && <div style={{ background:'#ecfdf5', color:'#065f46', padding:8, borderRadius:8, marginBottom:12 }}>{success}</div>}
            <form onSubmit={handleUpdate}>
              <div style={{ marginBottom:12 }}>
                <label className="form-label">Name *</label>
                <input className="form-input" type="text" value={editData.name||''} onChange={(e)=>setEditData({...editData, name: e.target.value})} required />
              </div>
              <div style={{ marginBottom:12 }}>
                <label className="form-label">Bio *</label>
                <textarea className="form-input" style={{ minHeight:80 }} value={editData.bio||''} onChange={(e)=>setEditData({...editData, bio: e.target.value})} required />
              </div>
              <div style={{ marginBottom:12 }}>
                <label className="form-label">Photo URL</label>
                <input className="form-input" type="url" value={editData.photoURL||''} onChange={(e)=>setEditData({...editData, photoURL: e.target.value})} />
              </div>

              <div style={{ display:'flex', gap:8 }}>
                <button className="btn-primary" type="submit" disabled={saving} style={{ flex:1 }}>{saving ? 'Saving...' : <> <BsSave2 size={20} /> Save Changes </>}</button>
                <button type="button" className="btn-primary" onClick={()=>{ setIsEditing(false); setEditData(profile); }} style={{ flex:1 }}>✕ Cancel</button>
              </div>
            </form>
          </div>
        )}

        {!isEditing && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            <div style={{ background:'var(--card-bg)', borderRadius:12, padding:16, textAlign:'center', boxShadow:'var(--shadow-sm)' }}>
              <div style={{ fontSize:24, fontWeight:700, color:'var(--primary)' }}>{conversationCount}</div>
              <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:4 }}>Conversations</div>
            </div>
            <div style={{ background:'var(--card-bg)', borderRadius:12, padding:16, textAlign:'center', boxShadow:'var(--shadow-sm)' }}>
              <div style={{ fontSize:24, fontWeight:700, color:'var(--accent)' }}>{momentCount}</div>
              <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:4 }}>Moments</div>
            </div>
            <div style={{ background:'var(--card-bg)', borderRadius:12, padding:16, textAlign:'center', boxShadow:'var(--shadow-sm)' }}>
              <div style={{ fontSize:24, fontWeight:700, color:'var(--text-primary)' }}>{groupCount}</div>
              <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:4 }}>Groups</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
