import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const SplashScreen = () => {
  const navigate = useNavigate();
  const { user, loading, onboarded } = useAuth();

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        if (user && onboarded) {
          navigate('/chat', { replace: true });
        } else if (user) {
          navigate('/onboarding', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      }, 2000); // Show splash for 2 seconds
      return () => clearTimeout(timer);
    }
  }, [user, loading, onboarded, navigate]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      textAlign: 'center'
    }}>
      <h1 style={{ fontSize: '48px', marginBottom: '10px' }}>ZeroLeak</h1>
      <p>Privacy-First Messaging</p>
      <div style={{ marginTop: '20px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid rgba(255,255,255,0.3)',
          borderRadius: '50%',
          borderTop: '4px solid white',
          animation: 'spin 1s linear infinite',
          margin: '0 auto'
        }} />
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default SplashScreen;
