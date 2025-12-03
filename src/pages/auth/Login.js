import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import '../../components/styles/common.css';

const Login = () => {
  const navigate = useNavigate();
  const { signInWithGoogle, onboarded } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      await signInWithGoogle();
      navigate(onboarded ? '/chat' : '/onboarding');
    } catch (err) {
      console.error('Error signing in with Google:', err);
      setError('Failed to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <img 
            src="/splash_screen/logo.png" 
            alt="ZeroLeak" 
            style={{ height: 80, marginBottom: 16 }}
          />
          <h1 className="auth-title">Welcome to ZeroLeak</h1>
          <p className="auth-subtitle">Secure messaging for everyone</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
            End-to-end encrypted chats, moments & calls
          </p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <button 
          onClick={handleGoogleSignIn} 
          disabled={loading} 
          className="btn-secondary" 
          style={{ fontSize: 15, fontWeight: 600 }}
        >
          {loading ? 'Signing in...' : '🔐 Sign in with Google'}
        </button>

        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-secondary)', marginTop: 20, lineHeight: 1.6 }}>
          <p>By signing in, you agree to our<br/>Terms of Service and Privacy Policy</p>
          <p style={{ marginTop: 12, fontSize: 11, opacity: 0.7 }}>
            🔒 Your data is encrypted end-to-end
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
