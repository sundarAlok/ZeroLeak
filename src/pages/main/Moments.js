// Moments.js
import React, { useEffect, useState, useRef } from 'react';
import {
  collection, query, orderBy, limit, onSnapshot,
  addDoc, updateDoc, doc, deleteDoc, serverTimestamp, getDoc
} from 'firebase/firestore';
import { db, auth } from '../../firebase/firebase';
import '../../components/styles/common.css';
import '../../components/styles/Moments.css';

import {
  RiMore2Fill,
  RiGeminiFill,
  RiTimeFill,
  RiEditFill,
  RiDeleteBin6Fill
} from 'react-icons/ri';
import { RxCross2, RxCheckCircled } from "react-icons/rx";

import { getCachedMoments, cacheMoments } from '../../utils/cacheManager';

const SAFE_FONTS = [
  { label: 'System UI (default)', value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Tahoma', value: 'Tahoma, Geneva, sans-serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
  { label: 'Brush Script MT', value: '"Brush Script MT", cursive' }
];

export default function Moments() {
  const [moments, setMoments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [bgColor, setBgColor] = useState('#6366F1');
  const [textColor, setTextColor] = useState('#ffffff');
  const [fontSize, setFontSize] = useState(18);
  const [fontFamily, setFontFamily] = useState(SAFE_FONTS[0].value);

  const [, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [openMenuFor, setOpenMenuFor] = useState(null);
  const user = auth.currentUser;

  // User profile cache + subscriptions
  const [userProfiles, setUserProfiles] = useState({});
  const userProfilesRef = useRef({});

  const outsideClickRef = useRef(null);

  // -----------------------------
  // Load Moments
  // -----------------------------
  useEffect(() => {
    const cached = getCachedMoments();
    if (cached) {
      setMoments(cached);
      setLoading(false);
    }

    const q = query(collection(db, 'moments'), orderBy('createdAt', 'desc'), limit(200));
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMoments(arr);
      cacheMoments(arr);
      setLoading(false);

      const unique = [...new Set(arr.map(m => m.userId))];
      ensureProfileSubscriptions(unique);
    });

    return () => {
      unsub();
      cleanupProfileSubscriptions();
    };
  }, []);

  // -----------------------------
  // Profile Subscriptions
  // -----------------------------
  const ensureProfileSubscriptions = async (uids) => {
    for (const uid of uids) {
      if (userProfilesRef.current[uid]) continue;
      try {
        const userRef = doc(db, 'publicProfiles', uid);
        const unsubUser = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            userProfilesRef.current[uid] = {
              ...userProfilesRef.current[uid],
              ...data,
              unsubscribe: unsubUser
            };
            setUserProfiles(prev => ({ ...prev, [uid]: { name: data.name, photoURL: data.photoURL || null } }));
          }
        });
      } catch (err) {
        console.error('Profile subscription error:', err);
      }
    }

    Object.keys(userProfilesRef.current).forEach(uid => {
      if (!uids.includes(uid)) {
        userProfilesRef.current[uid]?.unsubscribe?.();
        delete userProfilesRef.current[uid];
      }
    });
  };

  const cleanupProfileSubscriptions = () => {
    Object.values(userProfilesRef.current).forEach(p => p?.unsubscribe?.());
    userProfilesRef.current = {};
  };

  // -----------------------------
  // Helpers
  // -----------------------------
  const isVisible = (m) => {
    if (!m.createdAt) return true;
    const created = m.createdAt.toDate ? m.createdAt.toDate() : new Date(m.createdAt);
    const expiryDays = m.expiryDays ?? 1;
    const expireAt = new Date(created.getTime() + expiryDays * 86400000);
    return new Date() <= expireAt;
  };

  const visibleMoments = moments.filter(isVisible);

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    const hrs = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  // -----------------------------
  // Form Submit
  // -----------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return alert('Sign in first');
    if (!text.trim() && !imageUrl.trim()) return alert('Add text or image');

    setSubmitting(true);

    const body = {
      userId: user.uid,
      text: text.trim(),
      imageUrl: imageUrl.trim(),
      backgroundColor: bgColor,
      textColor,
      fontSize: Number(fontSize),
      fontFamily
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'moments', editingId), body);
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'moments'), {
          ...body,
          expiryDays: 1,
          createdAt: serverTimestamp()
        });
      }

      setText('');
      setImageUrl('');
      setBgColor('#6366F1');
      setTextColor('#ffffff');
      setFontSize(18);
      setFontFamily(SAFE_FONTS[0].value);
      setShowForm(false);
    } catch (err) {
      console.error(err);
      alert('Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  // Edit
  const openEdit = async (m) => {
    const snap = await getDoc(doc(db, 'moments', m.id));
    const data = snap.exists() ? snap.data() : m;
    setEditingId(m.id);
    setText(data.text || '');
    setImageUrl(data.imageUrl || '');
    setBgColor(data.backgroundColor || '#6366F1');
    setTextColor(data.textColor || '#ffffff');
    setFontSize(data.fontSize ?? 18);
    setFontFamily(data.fontFamily || SAFE_FONTS[0].value);
    setShowForm(true);
  };

  const addMoreDay = async (m) => {
    const ref = doc(db, 'moments', m.id);
    const next = (m.expiryDays ?? 1) + 1;
    await updateDoc(ref, { expiryDays: next });
    setOpenMenuFor(null);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Remove this?')) {
      await deleteDoc(doc(db, 'moments', id));
      setOpenMenuFor(null);
    }
  };

  // -----------------------------
  // Click Outside to Close Menu
  // -----------------------------
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!outsideClickRef.current) return;
      if (!outsideClickRef.current.contains(e.target)) {
        setOpenMenuFor(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // -----------------------------
  // Rendering
  // -----------------------------
  return (
    <div className="moments-page-root" ref={outsideClickRef}>
      <div className="moments-container">

        {/* HEADER */}
        <div className="moments-header">
          <h1>Moments</h1>
          <button
            className="btn-primary"
            onClick={() => {
              if (!showForm) {
                setEditingId(null);
                setText('');
                setImageUrl('');
                setBgColor('#6366F1');
                setTextColor('#ffffff');
                setFontSize(18);
                setFontFamily(SAFE_FONTS[0].value);
              }
              setShowForm(s => !s);
            }}
          >
            <RiGeminiFill size={20} style={{ marginRight: 7 }} />
            {showForm ? 'Close' : 'Add Moment'}
          </button>
        </div>

        {/* FORM */}
        {showForm && (
          <form className="moment-form-card improved" onSubmit={handleSubmit}>
            
            {/* TEXT */}
            <div className="form-row spaced-row">
              <label className="form-label left">Text</label>
              <textarea className="form-input textarea" value={text} onChange={(e)=>setText(e.target.value)} />
            </div>

            {/* IMAGE */}
            <div className="form-row spaced-row">
              <label className="form-label left">Image URL (optional)</label>
              <input type="url" className="form-input" value={imageUrl} onChange={(e)=>setImageUrl(e.target.value)} />
            </div>

            {/* CONTROL ROW */}
            <div className="form-row controls-row spaced-row">

              <div className="control">
                <label className="form-label small left">Background</label>
                <input type="color" className="color-input" value={bgColor} onChange={e=>setBgColor(e.target.value)} />
              </div>

              <div className="control">
                <label className="form-label small left">Text Color</label>
                <input type="color" className="color-input" value={textColor} onChange={e=>setTextColor(e.target.value)} />
              </div>

              <div className="control control-box">
                <label className="form-label small left">Font Size ({fontSize}px)</label>
                <div className="slider-box">
                  <input type="range" min="10" max="32" value={fontSize} onChange={(e)=>setFontSize(e.target.value)} />
                </div>
              </div>

              <div className="control">
                <label className="form-label small left">Font Family</label>
                <select className="form-input" value={fontFamily} onChange={(e)=>setFontFamily(e.target.value)}>
                  {SAFE_FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>

            </div>

            {/* PREVIEW */}
            <div className="form-row spaced-row">
              <label className="form-label left">Preview</label>

              <div className="preview-wrapper">
                <div className="moment-preview final-size">
                  <div className="moment-content" style={{
                    background: bgColor,
                    color: textColor,
                    fontSize: `${fontSize}px`,
                    fontFamily
                  }}>
                    {imageUrl ? (
                      <div className="content-image-wrap">
                        <img src={imageUrl} alt="" />
                        {text && <div className="content-image-text">{text}</div>}
                      </div>
                    ) : (
                      <div className="content-text-only">{text}</div>
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* ACTIONS */}
            <div className="form-row form-actions spaced-row">
              <button type="submit" className="btn-primary">
                <RxCheckCircled size={18} style={{ marginRight: 6 }} />
                {editingId ? 'Save Changes' : 'Post Moment'}
              </button>

              <button type="button" className="btn-primary" onClick={()=>{ setShowForm(false); setEditingId(null); }}>
                <RxCross2 size={18} style={{ marginRight: 6 }} />
                Close
              </button>
            </div>

          </form>
        )}

        {/* GRID */}
        <div className="moments-grid">
          {loading ? (
            <div className="empty-note">Loading...</div>
          ) : visibleMoments.length === 0 ? (
            <div className="empty-note">No moments yet</div>
          ) : (
            visibleMoments.map(m => {
              const profile = userProfiles[m.userId] || {};
              return (
                <div key={m.id} className="moment-item">
                  <div className="moment-inner">
                    
                    {/* TOP (avatar + name) */}
                    <div className="moment-top">
                      <div className="moment-userinfo-left">
                        {profile.photoURL ? (
                          <img className="moment-avatar" src={profile.photoURL} alt="" />
                        ) : (
                          <div className="moment-avatar-placeholder">
                            {(profile.name || 'U').slice(0,2).toUpperCase()}
                          </div>
                        )}
                        <div className="moment-meta-left">
                          <div className="moment-username">{profile.name || 'Unknown'}</div>
                          <div className="moment-time">
                            {formatTime(m.createdAt)} • {(m.expiryDays ?? 1)}d
                          </div>
                        </div>
                      </div>

                      {/* MENU BUTTON */}
                      {user?.uid === m.userId && (
                        <div className="moment-menu-wrap">
                          <button className="moment-menu-btn" onClick={()=>setOpenMenuFor(openMenuFor === m.id ? null : m.id)}>
                            <RiMore2Fill size={22}/>
                          </button>

                          {openMenuFor === m.id && (
                            <div className="moment-menu animated-menu">
                              
                              <button className="menu-item" onClick={()=>addMoreDay(m)}>
                                <RiTimeFill size={16}/> Extend +1 day
                              </button>

                              <button className="menu-item" onClick={()=>openEdit(m)}>
                                <RiEditFill size={16}/> Edit
                              </button>

                              <button className="menu-item remove" onClick={()=>handleDelete(m.id)}>
                                <RiDeleteBin6Fill size={16}/> Remove
                              </button>

                            </div>
                          )}

                        </div>
                      )}

                    </div>

                    {/* CONTENT AREA */}
                    <div className="moment-body">
                      <div className="moment-content" style={{
                        background: m.backgroundColor,
                        color: m.textColor,
                        fontFamily: m.fontFamily,
                        fontSize: `${m.fontSize}px`
                      }}>
                        {m.imageUrl ? (
                          <div className="content-image-wrap">
                            <img src={m.imageUrl} alt="" />
                            {m.text && <div className="content-image-text">{m.text}</div>}
                          </div>
                        ) : (
                          <div className="content-text-only">{m.text}</div>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}
