import React, { useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../../components/styles/common.css';
import '../../components/styles/MainLayout.css';
import { ThemeContext } from '../../context/ThemeContext';
import { GoStack } from 'react-icons/go';
import { DiSenchatouch } from 'react-icons/di';
import { FaRegUser } from 'react-icons/fa';
import { BsBookmarkHeart } from 'react-icons/bs';
import { MdOutlineLightMode, MdDarkMode } from 'react-icons/md';

const Tab = ({ to, label, active, icon }) => (
  <Link to={to} className={`zl-tab-item ${active ? 'active' : ''}`}>
    <div className="zl-tab-icon">{icon}</div>
    <div className="zl-tab-label">{label}</div>
  </Link>
);

const MainLayout = ({ children }) => {
  const location = useLocation();
  const { theme, toggleTheme } = useContext(ThemeContext);

  return (
    <div className="layout-container">
      <div className="layout-content">{children}</div>

      <nav className="bottom-nav">
        <div className="bottom-nav-inner">

          {/* Left Spacer */}
          <div className="nav-spacer" />

          {/* Primary Tabs */}
          <div className="nav-center">
            <Tab to="/chat" label="Chats" active={location.pathname.includes('/chat')} icon={<DiSenchatouch size={22} />} />
            <Tab to="/moments" label="Moments" active={location.pathname.includes('/moments')} icon={<GoStack size={21} />} />
            <Tab to="/profile" label="Profile" active={location.pathname.includes('/profile')} icon={<FaRegUser size={20} />} />
          </div>

          {/* Favorites + Theme */}
          <div className="nav-actions">

            {/* Favorites */}
            <button
              className="zl-tab-item"
              onClick={() => {
                try {
                  const prev = localStorage.getItem('zl_show_favorites') === 'true';
                  const next = !prev;
                  localStorage.setItem('zl_show_favorites', next ? 'true' : 'false');
                  window.dispatchEvent(new CustomEvent('zl:toggleFavorites', { detail: { show: next } }));
                } catch {
                  window.dispatchEvent(new CustomEvent('zl:toggleFavorites', { detail: { show: true } }));
                }
              }}
            >
              <div className="zl-tab-icon"><BsBookmarkHeart size={18} /></div>
              <div className="zl-tab-label">Favorites</div>
            </button>

            {/* Theme Switch */}
            <button className="zl-tab-item" onClick={toggleTheme}>
              <div className="zl-tab-icon">
                {theme === 'dark' ? <MdDarkMode size={18} /> : <MdOutlineLightMode size={18} />}
              </div>
              <div className="zl-tab-label">Theme</div>
            </button>

          </div>
        </div>
      </nav>
    </div>
  );
};

export default MainLayout;
