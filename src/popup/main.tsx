import React from 'react';
import ReactDOM from 'react-dom/client';
import '../index.css';
import App from './App';
import { usePrefsStore } from '../store/prefs-store';

// Hydrate preferences from chrome.storage.sync before rendering
const hydrate = usePrefsStore.getState().hydrate;

hydrate().finally(() => {
  const rootEl = document.getElementById('root');
  if (!rootEl) throw new Error('Root element #root not found in index.html');

  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
