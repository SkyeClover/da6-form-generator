import React, { useState, useEffect } from 'react';
import './DevelopmentBanner.css';

const DevelopmentBanner = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  useEffect(() => {
    // Check if banner was dismissed in this session
    const dismissed = sessionStorage.getItem('developmentBannerDismissed');
    if (dismissed !== 'true') {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissing(true);
    sessionStorage.setItem('developmentBannerDismissed', 'true');
    // Dispatch event to notify layout
    window.dispatchEvent(new CustomEvent('bannerDismissed'));
    // Wait for animation to complete before hiding
    setTimeout(() => {
      setIsVisible(false);
    }, 300); // Match animation duration
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className={`development-banner ${isDismissing ? 'dismissing' : ''}`}>
      <div className="development-banner-content">
        <span className="development-banner-icon">⚠️</span>
        <div className="development-banner-text">
          <strong>Under Development:</strong> This application is still under active development and major bugs may exist. 
          Please report any issues on{' '}
          <a 
            href="https://github.com/SkyeClover/da6-form-generator" 
            target="_blank" 
            rel="noopener noreferrer"
            className="development-banner-link"
          >
            GitHub
          </a>
          . This project is being developed in my spare time while serving on active duty.
        </div>
        <button 
          className="development-banner-close"
          onClick={handleDismiss}
          aria-label="Dismiss banner"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default DevelopmentBanner;

