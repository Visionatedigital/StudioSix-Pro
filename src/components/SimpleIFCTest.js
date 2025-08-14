import React from 'react';

const SimpleIFCTest = () => {
  return (
    <div style={{
      padding: '20px',
      maxWidth: '800px',
      margin: '0 auto',
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#1f2937',
      color: 'white',
      minHeight: '100vh'
    }}>
      <h2 style={{ color: '#333', marginBottom: '20px' }}>
        🧪 Simple IFC Test Interface
      </h2>
      
      <p>This is a minimal test interface to verify routing works.</p>
      
      <button
        onClick={() => {
          console.log('Test button clicked');
          alert('Test interface is working!');
        }}
        style={{
          padding: '8px 16px',
          backgroundColor: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px'
        }}
      >
        Test Button
      </button>
    </div>
  );
};

export default SimpleIFCTest; 