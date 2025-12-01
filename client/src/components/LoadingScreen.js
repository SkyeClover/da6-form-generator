import React from 'react';
import './LoadingScreen.css';

const LoadingScreen = ({ message = 'Loading...', subMessage = null }) => {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="spinner"></div>
        <h2 className="loading-message">{message}</h2>
        {subMessage && <p className="loading-submessage">{subMessage}</p>}
      </div>
    </div>
  );
};

export default LoadingScreen;

