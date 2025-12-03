// Profile.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { doc, updateDoc, getDoc, getDocs, query, where, collection } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import '../../components/styles/common.css';
import { getCachedUserProfile, cacheUserProfile } from '../../utils/cacheManager';

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

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    
    // Load from cache immediately
    const cachedProfile = getCachedUserProfile();
    if (cachedProfile) {
      setProfile(cachedProfile);
      setEditData(cachedProfile);
      setLoading(false);
    }

    // Fetch fresh data in background
    (async () => {
      try {
        // Fetch all in parallel
        const [docSnap, convoSnap, momentSnap] = await Promise.all([
          getDoc(doc(db, 'users', user.uid)),
          getDocs(query(collection(db, 'conversations'), where('participants', 'array-contains', user.uid))),
          getDocs(query(collection(db, 'moments'), where('userId', '==', user.uid)))
        ]);

        if (!mounted) return;

        // Set profile
        let profileData;
        if (docSnap.exists()) {
          profileData = docSnap.data();
          setProfile(profileData);
          setEditData(profileData);
        } else {
          profileData = {
            name: user.displayName || 'No name',
            username: user.email?.split('@')[0] || 'user',
            bio: '',
            photoURL: user.photoURL || null
          };
          setProfile(profileData);
          setEditData(profileData);
        }
        
        // Cache the profile for next load
        cacheUserProfile(user.uid, profileData);
        
        // Set counts immediately
        setConversationCount(convoSnap.size);
        setMomentCount(momentSnap.size);
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError('Failed to load profile');
        setLoading(false);
      }
    })();
    
    return () => { mounted = false; };
  }, [user]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!editData.name || !editData.bio) { setError('Name and bio are required'); return; }
    try {
      setSaving(true);
      await updateDoc(doc(db, 'users', user.uid), { name: editData.name, bio: editData.bio, photoURL: editData.photoURL || null });
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

  const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : '?';

  if (loading || !profile) {
    return <div style={{ padding:20, textAlign:'center' }}><p>Loading profile...</p></div>;
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 80px)', background:'var(--app-bg)', overflowY:'auto' }}>
      <div style={{ maxWidth:720, margin:'0 auto', padding:20, width:'100%' }}>
        <div style={{ background:'var(--card-bg)', borderRadius:16, padding:24, textAlign:'center', boxShadow:'var(--shadow-sm)', marginBottom:20 }}>
          <div style={{ marginBottom:16 }}>
            {profile.photoURL ? <img src={profile.photoURL} alt={profile.name} style={{ width:100, height:100, borderRadius:'50%', objectFit:'cover', border:'4px solid var(--primary)' }} onError={(e)=>{ e.currentTarget.src='/splash_screen/avatar_fallback.png'; }} /> : <div style={{ width:100, height:100, borderRadius:'50%', background:'linear-gradient(135deg,var(--primary),var(--accent))', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:40, fontWeight:700 }}>{getInitials(profile.name)}</div>}
          </div>

          <h1 style={{ fontSize:24, fontWeight:700, margin:'0 0 4px 0', color:'var(--text-primary)' }}>{profile.name}</h1>
          <p style={{ fontSize:14, color:'var(--text-secondary)', margin:'0 0 12px 0' }}>@{profile.username}</p>

          {!isEditing && <>
            <p style={{ fontSize:14, color:'var(--text-primary)', margin:'12px 0 0 0', lineHeight:1.5 }}>{profile.bio || 'Hey there — I am using ZeroLeak!'}</p>
            <div style={{ display:'flex', gap:8, marginTop:20 }}>
              <button onClick={()=>setIsEditing(true)} className="btn-primary" style={{ flex:1 }}>✏️ Edit Profile</button>
              <button onClick={()=>{ if(window.confirm('Sign out?')) signOut(); }} className="btn-secondary" style={{ flex:1 }}>🚪 Sign Out</button>
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
                <button className="btn-primary" type="submit" disabled={saving} style={{ flex:1 }}>{saving ? 'Saving...' : '💾 Save Changes'}</button>
                <button type="button" className="btn-secondary" onClick={()=>{ setIsEditing(false); setEditData(profile); }} style={{ flex:1 }}>✕ Cancel</button>
              </div>
            </form>
          </div>
        )}

        {!isEditing && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={{ background:'var(--card-bg)', borderRadius:12, padding:16, textAlign:'center', boxShadow:'var(--shadow-sm)' }}>
              <div style={{ fontSize:24, fontWeight:700, color:'var(--primary)' }}>{conversationCount}</div>
              <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:4 }}>Conversations</div>
            </div>
            <div style={{ background:'var(--card-bg)', borderRadius:12, padding:16, textAlign:'center', boxShadow:'var(--shadow-sm)' }}>
              <div style={{ fontSize:24, fontWeight:700, color:'var(--accent)' }}>{momentCount}</div>
              <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:4 }}>Moments</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
