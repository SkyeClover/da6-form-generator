import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import DevelopmentBanner from './DevelopmentBanner';
import './Layout.css';

const Layout = ({ children }) => {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [bannerVisible, setBannerVisible] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    // Check if banner should be visible
    const dismissed = sessionStorage.getItem('developmentBannerDismissed');
    setBannerVisible(dismissed !== 'true');
    
    // Listen for banner dismissal
    const handleBannerDismiss = () => {
      setBannerVisible(false);
    };
    
    window.addEventListener('bannerDismissed', handleBannerDismiss);
    return () => window.removeEventListener('bannerDismissed', handleBannerDismiss);
  }, []);

  const handleSignOut = async () => {
    // Prevent multiple simultaneous sign-out attempts
    if (isSigningOut) {
      return;
    }
    
    setIsSigningOut(true);
    try {
      const { error } = await signOut();
      // Only log errors that aren't about missing sessions (which is fine)
      if (error && error.message && !error.message.includes('session missing')) {
        console.error('Error signing out:', error);
      }
      // Redirect to login page after sign out (regardless of error)
      window.location.href = '/login';
    } catch (error) {
      // If signOut throws, still redirect to login
      if (error.message && !error.message.includes('session missing')) {
        console.error('Error signing out:', error);
      }
      window.location.href = '/login';
    } finally {
      setIsSigningOut(false);
    }
  };

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <div className={`layout ${!bannerVisible ? 'banner-dismissed' : ''}`}>
      <DevelopmentBanner />
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
            <button 
              onClick={toggleTheme} 
              className="theme-toggle"
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <span className="user-email">{user?.email}</span>
            <button 
              onClick={handleSignOut} 
              className="sign-out-button"
              disabled={isSigningOut}
            >
              {isSigningOut ? 'Signing Out...' : 'Sign Out'}
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

