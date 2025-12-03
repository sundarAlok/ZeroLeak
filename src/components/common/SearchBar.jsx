import React from 'react';
import '../styles/common.css';

const SearchBar = ({ value, onChange, placeholder = 'Search...' }) => (
  <div style={{ padding: 8 }}>
    <input value={value} onChange={onChange} placeholder={placeholder} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }} />
  </div>
);

export default SearchBar;
