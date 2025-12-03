import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../../firebase/firebase';
import { doc, setDoc, serverTimestamp, query, collection, where, getDocs } from 'firebase/firestore';
import '../../components/styles/common.css';

const Onboarding = () => {
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    bio: 'I am using ZeroLeak',
    dob: '',
    phone: ''
  });
  const [error, setError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState(null); // null=unchecked, true=available, false=taken
  const [dobError, setDobError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const navigate = useNavigate();

  const validateUsername = async (username) => {
    if (username.length < 3) {
      setUsernameError('Username must be at least 3 characters');
      setUsernameAvailable(false);
      return false;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setUsernameError('Username can only contain letters, numbers, and underscores');
      setUsernameAvailable(false);
      return false;
    }

    try {
      const q = query(collection(db, 'users'), where('username', '==', username.toLowerCase()));
      const snapshot = await getDocs(q);
      if (snapshot.size > 0) {
        setUsernameError('Username already taken');
        setUsernameAvailable(false);
        return false;
      }
    } catch (err) {
      console.error('Error checking username:', err);
      setUsernameError('Error checking username');
      setUsernameAvailable(false);
      return false;
    }

    setUsernameError('');
    setUsernameAvailable(true);
    return true;
  };

  const validateDOB = (dob) => {
    if (!dob) return true; // allow empty for now
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    if (age < 14) {
      setDobError('You must be at least 14 years old');
      return false;
    }
    setDobError('');
    return true;
  };

  const validatePhone = (phone) => {
    if (!phone) return true; // allow empty for now
    const cleaned = phone.replace(/[\s()-]/g, '');
    const indianPhoneRegex = /^(?:\+91|91)?[6-9]\d{9}$/;
    if (!indianPhoneRegex.test(cleaned)) {
      setPhoneError('Enter a valid mobile number');
      return false;
    }
    setPhoneError('');
    return true;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'username') {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (value.length < 3) {
        setUsernameError('Username must be at least 3 characters');
        setUsernameAvailable(false);
      } else {
        debounceRef.current = setTimeout(() => {
          validateUsername(value);
        }, 600);
      }
    }

    if (name === 'dob') {
      validateDOB(value);
    }

    if (name === 'phone') {
      validatePhone(value);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name || !formData.username || !formData.dob || !formData.phone) {
      setError('Please fill in all required fields.');
      return;
    }

    if (!validateDOB(formData.dob)) {
      return;
    }

    if (!validatePhone(formData.phone)) {
      return;
    }

    const isValidUsername = await validateUsername(formData.username);
    if (!isValidUsername) {
      setError('Username is not available');
      return;
    }

    try {
      setLoading(true);
      const user = auth.currentUser;
      if (user) {
        const userDoc = doc(db, 'users', user.uid);
        await setDoc(userDoc, {
          uid: user.uid,
          name: formData.name,
          username: formData.username.toLowerCase(),
          bio: formData.bio,
          dob: formData.dob,
          phone: formData.phone,
          email: user.email,
          photoURL: user.photoURL || null,
          createdAt: serverTimestamp()
        });
        navigate('/chat');
      }
    } catch (err) {
      setError(err.message || 'Error saving profile');
      console.error('Error in onboarding:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Complete Your Profile</h1>
        <p className="auth-subtitle">Let's get you set up</p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" style={{ textAlign: 'left' }}>Full Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Your full name"
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ textAlign: 'left' }}>Username * (min 3 characters)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Choose a unique username"
                className="form-input"
                required
                style={{ flex: 1 }}
              />
              <div style={{ fontSize: '18px', minWidth: '24px', textAlign: 'center' }}>
                {usernameAvailable === true && <span style={{ color: '#10b981' }}>✓</span>}
                {usernameAvailable === false && formData.username && <span style={{ color: '#ef4444' }}>✕</span>}
              </div>
            </div>
            {usernameError && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>{usernameError}</div>}
          </div>

          <div className="form-group">
            <label className="form-label" style={{ textAlign: 'left' }}>Bio</label>
            <input
              type="text"
              name="bio"
              value={formData.bio}
              onChange={handleChange}
              placeholder="Tell us about yourself"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ textAlign: 'left' }}>Date of Birth *</label>
            <input
              type="date"
              name="dob"
              value={formData.dob}
              onChange={handleChange}
              className="form-input"
              required
            />
            {dobError && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>{dobError}</div>}
          </div>

          <div className="form-group">
            <label className="form-label" style={{ textAlign: 'left' }}>Phone Number * (Indian)</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+91 98765 43210"
              className="form-input"
              required
            />
            {phoneError && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>{phoneError}</div>}
          </div>

          <button type="submit" disabled={loading || !!usernameError || !!dobError || !!phoneError} className="btn-primary" style={{ marginTop: 8 }}>
            {loading ? 'Setting up...' : 'Continue to Chat'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Onboarding;
