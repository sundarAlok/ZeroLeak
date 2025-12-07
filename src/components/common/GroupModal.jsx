import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import '../styles/common.css';
import '../styles/modal.css';

const GroupModal = ({ open, onClose, currentUser, onGroupCreated }) => {
  const [step, setStep] = useState(1);
  const [queryText, setQueryText] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [groupPhotoURL, setGroupPhotoURL] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setQueryText('');
      setResults([]);
      setSelected([]);
      setGroupName('');
      setGroupPhotoURL('');
    }
  }, [open]);

  const handleSearch = async (q) => {
    setQueryText(q);
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }
    // simple client-side search: fetch first 50 users then filter
    try {
      const snap = await getDocs(collection(db, 'users'));
      const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const filtered = users
        .filter(u => u.id !== currentUser?.uid)
        .filter(u => (u.name || '').toLowerCase().includes(q.toLowerCase()) || (u.username || '').toLowerCase().includes(q.toLowerCase()))
        .slice(0, 20);
      setResults(filtered);
    } catch (err) {
      console.error('Group search error', err);
    }
  };

  const toggleSelect = (u) => {
    if (selected.find(s => s.id === u.id)) {
      setSelected(selected.filter(s => s.id !== u.id));
    } else {
      setSelected([...selected, u]);
    }
  };

  const createGroup = async () => {
    if (!currentUser) return alert('Sign in first');
    if (selected.length < 1) return alert('Select at least one member');
    if (!groupName.trim()) return alert('Enter a group name');
    setCreating(true);
    try {
      const members = [currentUser.uid, ...selected.map(s => s.id)];
      const groupDoc = await addDoc(collection(db, 'groups'), {
        name: groupName,
        photoURL: groupPhotoURL,
        ownerId: currentUser.uid,
        members,
        createdAt: serverTimestamp()
      });

      // create a conversation for the group so it appears in chat list
      await addDoc(collection(db, 'conversations'), {
        participants: members,
        isGroup: true,
        groupId: groupDoc.id,
        groupName: groupName,
        groupPhotoURL: groupPhotoURL,
        lastMessage: '',
        lastMessageTime: serverTimestamp(),
        createdAt: serverTimestamp()
      });

      alert('Group created successfully');
      if (onGroupCreated) onGroupCreated();
      onClose();
    } catch (err) {
      console.error('Create group error', err);
      alert('Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>{step === 1 ? 'Select Members' : 'Create Group'}</h3>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>

        {step === 1 && (
          <>
            <input
              placeholder="Search users by name or username"
              value={queryText}
              onChange={(e) => handleSearch(e.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', marginBottom: 12 }}
            />

            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
              {results.map(u => (
                <div key={u.id} className="user-card small" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 6px' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {u.photoURL ? (
                      <img src={u.photoURL} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: 'linear-gradient(135deg,var(--primary),var(--accent))', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        { (u.name||'').split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2) }
                      </div>
                    )}
                    <div>
                      <div style={{ fontWeight: 700 }}>{u.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>@{u.username}</div>
                    </div>
                  </div>
                  <div>
                    <input
                      type="checkbox"
                      checked={selected.some(s => s.id === u.id)}
                      onChange={() => toggleSelect(u)}
                      style={{ width: 20, height: 20, borderRadius: 4 }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn-primary" onClick={() => setStep(2)} disabled={selected.length === 0}>Create Group</button>
              <button className="btn-secondary" onClick={onClose}>Cancel</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
              {groupPhotoURL ? (
                <img src={groupPhotoURL} alt="Group" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', marginBottom: 8 }} />
              ) : (
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg,var(--primary),var(--accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                  <span style={{ color: 'white', fontSize: 24 }}>G</span>
                </div>
              )}
              <input
                placeholder="Group image URL"
                value={groupPhotoURL}
                onChange={(e) => setGroupPhotoURL(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid var(--border)' }}
              />
            </div>

            <input
              placeholder="Group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', marginBottom: 12 }}
            />

            <h4 style={{ margin: '12px 0' }}>Group members</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
              {selected.map(u => (
                <div key={u.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 8, border: '1px solid var(--border)', borderRadius: 8 }}>
                  {u.photoURL ? (
                    <img src={u.photoURL} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', marginBottom: 4 }} />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: 'linear-gradient(135deg,var(--primary),var(--accent))', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                      { (u.name||'').split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2) }
                    </div>
                  )}
                  <div style={{ fontWeight: 700, fontSize: 12, textAlign: 'center' }}>{u.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', textAlign: 'center' }}>@{u.username}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" onClick={createGroup} disabled={creating || !groupName.trim()}>{creating ? 'Creating...' : 'Create Group'}</button>
              <button className="btn-secondary" onClick={() => setStep(1)}>Back</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default GroupModal;
