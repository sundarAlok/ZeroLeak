import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import '../styles/common.css';

const GroupModal = ({ open, onClose, currentUser }) => {
  const [queryText, setQueryText] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) {
      setQueryText('');
      setResults([]);
      setSelected([]);
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
    const name = window.prompt('Group name');
    if (!name) return;
    setCreating(true);
    try {
      const members = [currentUser.uid, ...selected.map(s => s.id)];
      const groupDoc = await addDoc(collection(db, 'groups'), {
        name,
        ownerId: currentUser.uid,
        members,
        createdAt: serverTimestamp()
      });

      // create a conversation for the group so it appears in chat list
      const convo = await addDoc(collection(db, 'conversations'), {
        participants: members,
        isGroup: true,
        groupId: groupDoc.id,
        groupName: name,
        lastMessage: '',
        lastMessageTime: serverTimestamp(),
        createdAt: serverTimestamp()
      });

      // notify members (best-effort) by creating notification documents
      for (const m of members) {
        if (m === currentUser.uid) continue; // owner doesn't need invite
        await addDoc(collection(db, 'notifications'), {
          to: m,
          type: 'group_invite',
          convoId: convo.id,
          groupId: groupDoc.id,
          groupName: name,
          from: currentUser.uid,
          status: 'pending',
          createdAt: serverTimestamp()
        });
      }

      alert('Group created and invites sent');
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
          <h3 style={{ margin: 0 }}>Create Group</h3>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>

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
                <button onClick={() => toggleSelect(u)} className={selected.find(s=>s.id===u.id) ? 'btn-primary small' : 'btn-secondary small'}>
                  {selected.find(s=>s.id===u.id) ? 'Selected' : 'Add'}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn-primary" onClick={createGroup} disabled={creating}>{creating ? 'Creating...' : 'Create Group'}</button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default GroupModal;
