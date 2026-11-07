import React from 'react';
import { FiPlus, FiX } from 'react-icons/fi';

const UrlFields = ({ urls = [], onChange, maxUrls = 3, label = 'URLs' }) => {
  const values = urls.length ? urls : [''];

  const updateUrl = (index, value) => {
    onChange(values.map((url, urlIndex) => urlIndex === index ? value : url));
  };

  const removeUrl = (index) => {
    const remaining = values.filter((_, urlIndex) => urlIndex !== index);
    onChange(remaining.length ? remaining : ['']);
  };

  return (
    <div style={{ marginBottom:12 }}>
      <label className="form-label">{label}</label>
      {values.map((url, index) => (
        <div key={index} style={{ display:'flex', alignItems:'center', gap:8, marginTop:8 }}>
          <input
            className="form-input"
            type="url"
            placeholder="https://example.com"
            value={url}
            onChange={event => updateUrl(index, event.target.value)}
          />
          {values.length > 1 && (
            <button type="button" className="btn-secondary" aria-label="Remove URL" onClick={() => removeUrl(index)}>
              <FiX />
            </button>
          )}
        </div>
      ))}
      {values.length < maxUrls && (
        <button
          type="button"
          className="btn-secondary"
          onClick={() => onChange([...values, ''])}
          style={{ display:'inline-flex', alignItems:'center', gap:6, marginTop:8 }}
        >
          <FiPlus /> Add URL
        </button>
      )}
    </div>
  );
};

export default UrlFields;
