import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { installHostApi } from './vision/ExternalCamera';
import './styles.css';

// Published before anything renders so a native shell (see android/) can register
// its camera and start pushing frames at any point, even during boot.
installHostApi();

const container = document.getElementById('root');
if (!container) throw new Error('root element missing');

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
