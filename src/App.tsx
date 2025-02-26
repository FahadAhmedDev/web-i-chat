import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import WebinarSettings from './pages/WebinarSettings';
import WebinarView from './pages/WebinarView';
import Contacts from './pages/Contacts';
import Login from './pages/Login';
import Layout from './components/Layout';
import GHLCallback from './pages/GHLCallback';
import { AuthProvider } from './contexts/AuthContext';
import { setupTokenRefreshScheduler } from './lib/ghl';

function App() {
  useEffect(() => {
    // Set up the token refresh scheduler when the app initializes
    const refreshInterval = setupTokenRefreshScheduler();
    
    // Clean up the interval when the component unmounts
    return () => {
      clearInterval(refreshInterval);
    };
  }, []); // Empty dependency array means this runs once on mount

  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<Login />} />
          <Route path="/ghl/callback" element={<GHLCallback />} />
          <Route path="/webinar/:id" element={<WebinarView />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="/webinar/:id/settings" element={<WebinarSettings />} />
            <Route path="/contacts" element={<Contacts />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;