import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import EmbedPlayerPage from './pages/EmbedPlayerPage';
import './embed.css';

/** Lightweight entry for /embed — no admin shell or Tailwind bundle. */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/embed" element={<EmbedPlayerPage />} />
        <Route path="*" element={<EmbedPlayerPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
