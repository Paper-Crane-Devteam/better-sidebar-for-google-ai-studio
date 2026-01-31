import React from 'react';
import ReactDOM from 'react-dom/client';
import { SidePanel } from './SidePanel';
// import '../../../theme.css'; // Import AI Studio theme variables for standalone pages
import '@/index.css';
import '@/locale/i18n';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SidePanel />
  </React.StrictMode>
);
