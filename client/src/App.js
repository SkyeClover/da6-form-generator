import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { isSupabaseConfigured } from './lib/supabase';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Soldiers from './components/Soldiers';
import FormsList from './components/FormsList';
import DA6Form from './components/DA6Form';
import DA6FormView from './components/DA6FormView';
import MasterRoster from './components/MasterRoster';
import Settings from './components/Settings';
import SetupRequired from './components/SetupRequired';
import './App.css';

// Protected Route component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" />;
};

// Public Route component (redirects to dashboard if already logged in)
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  return user ? <Navigate to="/dashboard" /> : children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/soldiers" element={<ProtectedRoute><Soldiers /></ProtectedRoute>} />
      <Route path="/forms" element={<ProtectedRoute><FormsList /></ProtectedRoute>} />
      <Route path="/forms/new" element={<ProtectedRoute><DA6Form /></ProtectedRoute>} />
      <Route path="/forms/:id/view" element={<ProtectedRoute><DA6FormView /></ProtectedRoute>} />
      <Route path="/forms/:id" element={<ProtectedRoute><DA6Form /></ProtectedRoute>} />
      <Route path="/master-roster/:periodStart/:periodEnd" element={<ProtectedRoute><MasterRoster /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  // Check if Supabase is configured
  if (!isSupabaseConfigured()) {
    return <SetupRequired />;
  }

  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;

