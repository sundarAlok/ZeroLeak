import React from 'react';
import '../styles/common.css';

const Card = ({ children, className = '', style = {} }) => {
  return (
    <div className={`zl-card ${className}`} style={style}>
      {children}
    </div>
  );
};

export default Card;
