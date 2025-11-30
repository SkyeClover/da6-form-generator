import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Layout.css';

const Layout = ({ children }) => {
  const { user, signOut } = useAuth();
  const location = useLocation();

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      console.error('Error signing out:', error);
    }
  };

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <div className="layout">
      <header className="layout-header">
        <div className="header-content">
          <Link to="/dashboard" className="logo">
            <h1>DA6 Form Generator</h1>
          </Link>
          <nav className="main-nav">
            <Link 
              to="/dashboard" 
              className={isActive('/dashboard') ? 'nav-link active' : 'nav-link'}
            >
              Dashboard
            </Link>
            <Link 
              to="/soldiers" 
              className={isActive('/soldiers') ? 'nav-link active' : 'nav-link'}
            >
              Soldiers
            </Link>
            <Link 
              to="/forms" 
              className={isActive('/forms') ? 'nav-link active' : 'nav-link'}
            >
              Forms
            </Link>
            <Link 
              to="/settings" 
              className={isActive('/settings') ? 'nav-link active' : 'nav-link'}
            >
              Settings
            </Link>
          </nav>
          <div className="user-menu">
            <span className="user-email">{user?.email}</span>
            <button onClick={handleSignOut} className="sign-out-button">
              Sign Out
            </button>
          </div>
        </div>
      </header>
      <main className="layout-main">
        {children}
      </main>
    </div>
  );
};

export default Layout;

