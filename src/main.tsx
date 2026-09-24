import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { setupFetchInterceptor } from './utils/apiClient.js';

// Ativa interceptação transparente para RBAC e tokens se suportado pelo runtime
try {
  setupFetchInterceptor();
} catch (err) {
  console.warn('Configuração de interceptação de fetch ignorada:', err);
}

// Register Service Worker for PWA compliance (Section 54)
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('ServiceWorker registration failed:', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

