import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initSentry } from './config/sentry';
import { registerPushNotifications } from './utils/pushNotificationActions';

// Initialize Sentry before rendering
initSentry();

// Register service worker and push notifications (non-blocking)
registerPushNotifications().catch(() => {});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);