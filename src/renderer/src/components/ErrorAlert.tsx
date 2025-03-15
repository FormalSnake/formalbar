import React, { useState, useEffect } from 'react';

interface ErrorAlertProps {
  message: string;
  onClose?: () => void;
}

export function ErrorAlert({ message, onClose }: ErrorAlertProps): JSX.Element {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Auto-hide after 10 seconds
    const timer = setTimeout(() => {
      setVisible(false);
      if (onClose) onClose();
    }, 10000);

    return () => clearTimeout(timer);
  }, [onClose]);

  if (!visible) return <></>;

  return (
    <div 
      style={{
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        backgroundColor: 'rgba(220, 38, 38, 0.95)',
        color: 'white',
        padding: '12px 16px',
        zIndex: 9999,
        fontSize: '16px',
        textAlign: 'center',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
        height: 'auto',
        minHeight: '40px'
      }}
    >
      <span style={{ fontWeight: 'bold', maxWidth: '90%', overflow: 'auto' }}>Error: {message}</span>
      <button 
        onClick={() => {
          setVisible(false);
          if (onClose) onClose();
        }}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'white',
          cursor: 'pointer',
          fontSize: '20px',
          fontWeight: 'bold',
          padding: '0 8px'
        }}
      >
        ×
      </button>
    </div>
  );
}
