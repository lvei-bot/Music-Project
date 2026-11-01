import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register service worker for offline capability
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('[PWA] New content available.');
  },
  onOfflineReady() {
    console.log('[PWA] Application ready to work offline.');
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
