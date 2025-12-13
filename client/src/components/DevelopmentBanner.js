import React from 'react';
import './DevelopmentBanner.css';

const DevelopmentBanner = () => {
  return (
    <div className="development-banner">
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
      </div>
    </div>
  );
};

export default DevelopmentBanner;

