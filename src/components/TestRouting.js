import React from 'react';

const TestRouting = () => {
  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#1f2937',
      color: 'white',
      minHeight: '100vh'
    }}>
      <h1>🧪 IFC Loading Test Interface</h1>
      <p>Test routing is working!</p>
      <p>URL: {window.location.href}</p>
      <p>Search params: {window.location.search}</p>
    </div>
  );
};

export default TestRouting; 