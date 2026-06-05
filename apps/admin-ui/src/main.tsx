import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';

import Layout from './components/Layout';
import { AuthProvider } from './auth/AuthContext';
import RequireAuth from './components/RequireAuth';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import RequestAccessPage from './pages/RequestAccessPage';
import InputsPage from './pages/InputsPage';
import ApplicationDetailPage from './pages/ApplicationDetailPage';
import RestreamingPage from './pages/RestreamingPage';
import DomainBlocksPage from './pages/DomainBlocksPage';
import RecordingsPage from './pages/RecordingsPage';
import LiveSessionsPage from './pages/LiveSessionsPage';
import LiveSessionDetailPage from './pages/LiveSessionDetailPage';
import StreamKeySettingsPage from './pages/StreamKeySettingsPage';
import RecordingSettingsPage from './pages/RecordingSettingsPage';
import RestreamSettingsPage from './pages/RestreamSettingsPage';
import StorageLocationSettingsPage from './pages/StorageLocationSettingsPage';
import DomainBlockSettingsPage from './pages/DomainBlockSettingsPage';
import RecordingPoliciesPage from './pages/RecordingPoliciesPage';
import RecordingPolicySettingsPage from './pages/RecordingPolicySettingsPage';
import StreamProfilesPage from './pages/StreamProfilesPage';
import StreamProfileSettingsPage from './pages/StreamProfileSettingsPage';
import AudioFeedProfilesPage from './pages/AudioFeedProfilesPage';
import StoragePage from './pages/StoragePage';
import SystemStatusPage from './pages/SystemStatusPage';
import UsersPage from './pages/UsersPage';
import ProfilePage from './pages/ProfilePage';
import RequireAdmin from './components/RequireAdmin';
import VodRoutesPage from './pages/VodRoutesPage';
import VodRouteSettingsPage from './pages/VodRouteSettingsPage';

const DevEmbedPlayerPage = import.meta.env.DEV
  ? React.lazy(() => import('./pages/EmbedPlayerPage'))
  : null;

const App: React.FC = () => {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/request-access" element={<RequestAccessPage />} />
          {DevEmbedPlayerPage ? (
            <Route
              path="/embed"
              element={
                <React.Suspense fallback={null}>
                  <DevEmbedPlayerPage />
                </React.Suspense>
              }
            />
          ) : null}
          <Route
            path="/*"
            element={
              <RequireAuth>
                <Layout>
                  <Routes>
          <Route path="/" element={<Navigate to="/system-status" replace />} />
          <Route path="/inputs" element={<InputsPage />} />
          <Route path="/inputs/applications/:applicationId" element={<ApplicationDetailPage />} />
          <Route path="/restreaming" element={<RestreamingPage />} />
          <Route path="/outputs" element={<Navigate to="/restreaming" replace />} />
          <Route path="/routes" element={<Navigate to="/restreaming" replace />} />
          <Route path="/domain-blocks" element={<DomainBlocksPage />} />
          <Route path="/recordings" element={<RecordingsPage />} />
          <Route path="/recordings/:recordingId" element={<RecordingSettingsPage />} />
          <Route path="/live-sessions" element={<LiveSessionsPage />} />
          <Route path="/live-sessions/:sessionId" element={<LiveSessionDetailPage />} />
          <Route path="/stream-keys/:inputId" element={<StreamKeySettingsPage />} />
          <Route path="/restreams/:destinationId" element={<RestreamSettingsPage />} />
          <Route path="/storage" element={<StoragePage />} />
          <Route path="/storage/:locationId" element={<StorageLocationSettingsPage />} />
          <Route path="/vod-routes" element={<VodRoutesPage />} />
          <Route path="/vod-routes/:vodRouteId" element={<VodRouteSettingsPage />} />
          <Route path="/recording-policies" element={<RecordingPoliciesPage />} />
          <Route path="/recording-policies/:policyId" element={<RecordingPolicySettingsPage />} />
          <Route path="/stream-profiles" element={<StreamProfilesPage />} />
          <Route path="/stream-profiles/:profileId" element={<StreamProfileSettingsPage />} />
          <Route path="/audio-feed-profiles" element={<AudioFeedProfilesPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route
            path="/users"
            element={
              <RequireAdmin>
                <UsersPage />
              </RequireAdmin>
            }
          />
          <Route path="/domain-blocks/:blockId" element={<DomainBlockSettingsPage />} />
          <Route path="/system-status" element={<SystemStatusPage />} />
                </Routes>
              </Layout>
            </RequireAuth>
          }
        />
      </Routes>
    </AuthProvider>
  </Router>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
