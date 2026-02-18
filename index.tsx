import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Safety: Unregister any existing service workers that might be caching 404s
if ('serviceWorker' in navigator) {
  // Use a self-executing async function to handle promises without top-level await
  (async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for(let registration of registrations) {
        try {
          await registration.unregister();
        } catch (err) {
          // Ignore individual unregister errors
        }
      }
    } catch (e) {
      // Completely silence errors if the document is in an invalid state (e.g. iframe restrictions)
    }
  })();
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);