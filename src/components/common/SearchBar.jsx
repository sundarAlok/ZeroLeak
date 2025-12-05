import React from 'react';
import '../styles/common.css';

const SearchBar = ({ value, onChange, placeholder = 'Search...' }) => (
  <div style={{ padding: 0, paddingTop: 6 }}>
    <input
      className="search-input"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
    />
  </div>
);

export default SearchBar;
