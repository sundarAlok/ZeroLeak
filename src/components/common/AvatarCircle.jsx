import React, { useEffect, useState } from 'react';
import { FiUser } from 'react-icons/fi';
import '../styles/common.css';

const AvatarCircle = ({ src, size = 48, alt = 'avatar', style = {} }) => {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [src]);

  return (
    <div
      className="zl-avatar"
      role="img"
      aria-label={alt}
      style={{ width: size, height: size, borderRadius: '50%', display: 'flex', flexShrink: 0, ...style }}
    >
      {src && !imageFailed
        ? <img src={src} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} onError={() => setImageFailed(true)} />
        : <FiUser size={size * 0.52} aria-hidden="true" />}
    </div>
  );
};

export default AvatarCircle;
