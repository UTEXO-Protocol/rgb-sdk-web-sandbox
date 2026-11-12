import React from 'react';
import ReactDOM from 'react-dom/client';
import { configureLogging, LogLevel } from '@utexo/rgb-sdk-core';
import App from './App';
import './index.css';

// Show SDK diagnostics in this development playground.
configureLogging(LogLevel.DEBUG);


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
