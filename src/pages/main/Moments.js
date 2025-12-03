// Moments.js
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, query, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../../firebase/firebase';
import { MomentCard } from '../../components/common/PremiumCards';
import '../../components/styles/common.css';
import { getCachedMoments, cacheMoments } from '../../utils/cacheManager';

const Moments = () => {
  const [moments, setMoments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [bgColor, setBgColor] = useState('#6366f1');
  const [textColor, setTextColor] = useState('#ffffff');
  const [submitting, setSubmitting] = useState(false);
  const user = auth.currentUser;

  useEffect(() => {
    // Load from cache immediately
    const cachedMoments = getCachedMoments();
    if (cachedMoments && cachedMoments.length > 0) {
      setMoments(cachedMoments);
      setLoading(false);
    }

    // Real-time listener for latest moments (limited to 100)
    const q = query(collection(db, 'moments'), orderBy('createdAt', 'desc'), limit(100));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setMoments(data);
      cacheMoments(data); // Cache for next load
      setLoading(false);
    }, (err) => { console.error('Error fetching moments:', err); setLoading(false); });

    return () => unsub();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) { alert('Please sign in first'); return; }
    if (!text.trim() && !imageUrl.trim()) { alert('Please enter text or image URL'); return; }
    try {
      setSubmitting(true);
      await addDoc(collection(db, 'moments'), {
        userId: user.uid,
        userEmail: user.email,
        userName: user.displayName || 'User',
        userPhoto: user.photoURL || null,
        text: text.trim(),
        imageUrl: imageUrl.trim(),
        backgroundColor: bgColor,
        textColor: textColor,
        createdAt: serverTimestamp()
      });
      setText(''); setImageUrl(''); setBgColor('#6366f1'); setTextColor('#ffffff'); setShowForm(false);
    } catch (err) {
      console.error('Error creating moment:', err);
      alert('Failed to create moment.');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteMoment = async (momentId) => {
    if (!window.confirm('Delete this moment?')) return;
    try { await deleteDoc(doc(db, 'moments', momentId)); } catch (err) { console.error('Error deleting moment:', err); alert('Failed to delete moment'); }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 80px)', background:'var(--app-bg)', overflowY:'auto' }}>
      <div style={{ padding:'16px', maxWidth:760, margin:'0 auto', width:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <h1 style={{ fontSize:24, fontWeight:700, margin:0 }}>Moments</h1>
        <button onClick={()=>setShowForm(s=>!s)} style={{ padding:'10px 18px', background:'var(--primary)', color:'#fff', border:'none', borderRadius:20, cursor:'pointer', fontWeight:600 }}>✨ {showForm ? 'Close' : 'Add Moment'}</button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ background:'var(--card-bg)', padding:20, borderRadius:12, marginBottom:24, boxShadow:'var(--shadow)' }}>
          <div style={{ marginBottom:16 }}>
            <label className="form-label">Text</label>
            <textarea value={text} onChange={(e)=>setText(e.target.value)} placeholder="What's on your mind?" style={{ width:'100%', minHeight:100, padding:12, border:'1px solid var(--border)', borderRadius:8, background:'var(--input-bg)', color:'var(--text-primary)' }} />
          </div>

          <div style={{ marginBottom:16 }}>
            <label className="form-label">Image URL (Optional)</label>
            <input type="url" value={imageUrl} onChange={(e)=>setImageUrl(e.target.value)} placeholder="https://example.com/image.jpg" className="form-input" />
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
            <div>
              <label className="form-label">Background</label>
              <input type="color" value={bgColor} onChange={(e)=>setBgColor(e.target.value)} style={{ width:'100%', height:40, border:'1px solid var(--border)', borderRadius:8 }} />
            </div>
            <div>
              <label className="form-label">Text Color</label>
              <input type="color" value={textColor} onChange={(e)=>setTextColor(e.target.value)} style={{ width:'100%', height:40, border:'1px solid var(--border)', borderRadius:8 }} />
            </div>
          </div>

          {(text.trim() || imageUrl.trim()) && (
            <div style={{ marginBottom:16 }}>
              <p style={{ fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:8 }}>Preview</p>
              <MomentCard text={text} imageUrl={imageUrl} backgroundColor={bgColor} textColor={textColor} userName={user?.displayName || 'You'} userPhoto={user?.photoURL} timestamp={new Date()} />
            </div>
          )}

          <div style={{ display:'flex', gap:8 }}>
            <button type="submit" disabled={submitting || (!text.trim() && !imageUrl.trim())} style={{ flex:1, padding:12, background: submitting || (!text.trim() && !imageUrl.trim()) ? 'var(--border)' : 'var(--primary)', color:'#fff', border:'none', borderRadius:8, fontWeight:600 }}>{submitting ? 'Posting...' : 'Post Moment'}</button>
            <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, padding:12, background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:8, fontWeight:600 }}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? (<div style={{ textAlign:'center', padding:40, color:'var(--text-secondary)' }}>Loading moments...</div>) : moments.length === 0 ? (
        <div style={{ textAlign:'center', padding:40, color:'var(--text-secondary)' }}>
          <div style={{ fontSize:40, marginBottom:12 }}>✨</div>
          <p style={{ fontWeight:500, fontSize:16 }}>No moments yet</p>
          <p style={{ fontSize:13 }}>Share your first moment with everyone!</p>
        </div>
      ) : (
        <div>
          {moments.map(moment => (
            <div key={moment.id} style={{ marginBottom:20 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                {moment.userPhoto ? <img src={moment.userPhoto} alt="" style={{ width:40, height:40, borderRadius:'50%', objectFit:'cover' }} onError={(e)=>{ e.currentTarget.onerror=null; e.currentTarget.src='/splash_screen/avatar_fallback.png'; }} /> : <div style={{ width:40, height:40, borderRadius:'50%', background:'linear-gradient(135deg,var(--primary),var(--accent))', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:600 }}>{moment.userName?.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)}</div>}
                <div style={{ flex:1 }}>
                  <p style={{ margin:0, fontWeight:600, fontSize:14 }}>{moment.userName}</p>
                  <p style={{ margin:0, fontSize:12, color:'var(--text-secondary)' }}>{formatTime(moment.createdAt)}</p>
                </div>
                {user?.uid === moment.userId && <button onClick={()=>deleteMoment(moment.id)} style={{ background:'none', border:'none', color:'var(--text-secondary)', fontSize:18, cursor:'pointer' }}>✕</button>}
              </div>

              <MomentCard text={moment.text} imageUrl={moment.imageUrl} backgroundColor={moment.backgroundColor} textColor={moment.textColor} userName={moment.userName} userPhoto={moment.userPhoto} timestamp={moment.createdAt} />
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
};

export default Moments;
