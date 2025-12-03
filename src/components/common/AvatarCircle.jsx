import React from 'react';
import '../styles/common.css';

const AvatarCircle = ({ src, size = 48, alt = 'avatar' }) => (
  <div className="zl-avatar" style={{ width: size, height: size, borderRadius: size / 2 }}>
    {src ? <img src={src} alt={alt} style={{ width: '100%', height: '100%', borderRadius: '50%' }} /> : <div className="zl-avatar-placeholder" />}
  </div>
);

export default AvatarCircle;
