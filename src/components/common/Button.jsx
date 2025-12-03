import React from 'react';
import '../styles/common.css';

const Button = ({ children, onClick, className = '', type = 'button' }) => {
  return (
    <button className={`zl-btn ${className}`} onClick={onClick} type={type}>
      {children}
    </button>
  );
};

export default Button;
