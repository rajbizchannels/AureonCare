import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

console.log('AureonCare: Starting application...');

// Add global error handler
window.addEventListener('error', (event) => {
  console.error('Global error caught:', event.error);
  console.error('Error message:', event.message);
  console.error('Error filename:', event.filename);
  console.error('Error line:', event.lineno);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

try {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  console.log('AureonCare: Root created successfully');

  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );

  console.log('AureonCare: App rendered successfully');
} catch (error) {
  console.error('AureonCare: Fatal error during initialization:', error);
  document.body.innerHTML = `
    <div style="padding: 20px; margin: 20px; background: #fee; border: 2px solid #f00; border-radius: 8px;">
      <h1 style="color: #d00;">Failed to start AureonCare</h1>
      <p><strong>Error:</strong> ${error.message}</p>
      <pre>${error.stack}</pre>
    </div>
  `;
}