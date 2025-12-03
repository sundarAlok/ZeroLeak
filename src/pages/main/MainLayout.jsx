import React, { useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../../components/styles/common.css';
import { ThemeContext } from '../../context/ThemeContext';
import { GoStack } from 'react-icons/go';
import { DiSenchatouch } from 'react-icons/di';
import { FaRegUser } from 'react-icons/fa';
import { BsBookmarkHeart } from 'react-icons/bs';
import { MdOutlineLightMode, MdDarkMode } from 'react-icons/md';

const Tab = ({ to, label, active, icon }) => (
  <Link to={to} className={`zl-tab ${active ? 'active' : ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
    <div style={{ padding: '8px 10px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ fontSize: 18 }}>{icon}</div>
      <div style={{ fontSize: 12 }}>{label}</div>
    </div>
  </Link>
);

const MainLayout = ({ children }) => {
  const location = useLocation();
  const { theme, toggleTheme } = useContext(ThemeContext);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div style={{ flex: 1 }}>{children}</div>

      <nav style={{ borderTop: '1px solid var(--border)', background: 'var(--bg)', padding: '8px 10px', position: 'sticky', bottom: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ flex: 0 }} />
          <div style={{ display: 'flex', gap: 0, justifyContent: 'center', alignItems: 'center', flex: 1, maxWidth: 480 }}>
            <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
              <Tab to="/chat" label="Chats" active={location.pathname.includes('/chat')} icon={<DiSenchatouch size={20} />} />
              <Tab to="/moments" label="Moments" active={location.pathname.includes('/moments')} icon={<GoStack size={20} />} />
              <Tab to="/profile" label="Profile" active={location.pathname.includes('/profile')} icon={<FaRegUser size={20} />} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button aria-label="Favorites" title="Favorites" className="zl-tab" onClick={() => {
              try {
                const prev = localStorage.getItem('zl_show_favorites') === 'true';
                const next = !prev;
                localStorage.setItem('zl_show_favorites', next ? 'true' : 'false');
                window.dispatchEvent(new CustomEvent('zl:toggleFavorites', { detail: { show: next } }));
              } catch (e) { window.dispatchEvent(new CustomEvent('zl:toggleFavorites', { detail: { show: true } })); }
            }} style={{ textDecoration: 'none', color: 'inherit', background: 'none', border: 'none', padding: 0 }}>
              <div style={{ padding: '8px 10px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <div style={{ fontSize: 18 }}><BsBookmarkHeart size={18} /></div>
                <div style={{ fontSize: 12 }}>Favorites</div>
              </div>
            </button>

            <button onClick={toggleTheme} aria-label="Toggle theme" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} className="btn-ghost" style={{ padding: '8px 10px', borderRadius: 10, background: 'transparent', border: 'none' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: 18 }}>{theme === 'dark' ? <MdDarkMode size={18} /> : <MdOutlineLightMode size={18} />}</div>
                <div style={{ fontSize: 12 }}>{'Theme'}</div>
              </div>
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
};

export default MainLayout;
