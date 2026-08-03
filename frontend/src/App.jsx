import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import AlertComponent from './components/feedback/AlertComponent';
import { useAlert } from './contexts/AlertContext';
import Login from './pages/Login';
import Main from './pages/Main';
import AdminManager from './pages/AdminManager';
import StreamerManager from './pages/StreamerManager';
import DatabaseManager from './pages/DatabaseManager';
import OverlayManager from './pages/OverlayManager';
import Docs from './pages/Docs';
import TwitchAuthCallback from './pages/TwitchAuthCallback';
import NoAccess from './pages/NoAccess';

function App() {
  const { alerts } = useAlert();

  return (
    <div>
      <Router>
        <Routes>
          {/* Entry point — login */}
          <Route path="/" element={<Login />} />
          <Route path="/auth/callback" element={<TwitchAuthCallback />} />
          <Route path="/no-access" element={<NoAccess />} />

          {/* Authenticated dashboard */}
          <Route path="/main" element={<Main />}>
            <Route path="streamers" element={<StreamerManager />} />
            <Route path="admins" element={<AdminManager />} />
            <Route path="overlay" element={<OverlayManager />} />
            <Route path="db" element={<DatabaseManager />} />
            <Route path="docs" element={<Docs />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
      <AlertComponent alerts={alerts} />
    </div>
  );
}

export default App;
