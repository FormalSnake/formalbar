import './index.css'
import { ThemeProvider } from "@/components/theme-provider"

import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorAlert } from './components/ErrorAlert'

// Global error handler
window.addEventListener('error', (event) => {
  console.error('Uncaught error:', event.error);
  // Store error in localStorage to display it
  localStorage.setItem('lastError', event.error?.message || 'Unknown error');
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled rejection:', event.reason);
  // Store error in localStorage to display it
  localStorage.setItem('lastError', event.reason?.message || 'Unknown promise rejection');
});

// Error boundary component
const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [error, setError] = useState<string | null>(null);
  
  // Check for stored errors on mount
  useEffect(() => {
    const storedError = localStorage.getItem('lastError');
    if (storedError) {
      setError(storedError);
      // Clear the stored error
      localStorage.removeItem('lastError');
    }
    
    // Listen for IPC errors
    const handleIpcError = (_event: any, errorMessage: string) => {
      console.error('IPC error:', errorMessage);
      setError(errorMessage);
    };
    
    window.electron.ipcRenderer.on('error', handleIpcError);
    
    return () => {
      window.electron.ipcRenderer.removeListener('error', handleIpcError);
    };
  }, []);
  
  return (
    <>
      {error && <ErrorAlert message={error} onClose={() => setError(null)} />}
      {children}
    </>
  );
};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </ThemeProvider>
  </React.StrictMode>
)
