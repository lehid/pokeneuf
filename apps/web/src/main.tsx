import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// The service worker only exists in a production build. It keeps the app shell available offline
// and updates itself; the grids always come from the network (see `pwaOptions`).
if (import.meta.env.PROD) registerSW({ immediate: true });
