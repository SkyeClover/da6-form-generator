import React, { useState, useEffect } from 'react';
import './App.css';
import axios from 'axios';

function App() {
  const [apiStatus, setApiStatus] = useState('checking...');

  useEffect(() => {
    // Check API health
    axios.get('/api/health')
      .then(response => {
        setApiStatus('connected');
      })
      .catch(error => {
        setApiStatus('disconnected');
        console.error('API connection error:', error);
      });
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>DA6 Form Generator</h1>
        <p className="subtitle">Army Duty Roster Form Generator</p>
        <div className="status-indicator">
          <span className={`status ${apiStatus}`}>
            API: {apiStatus}
          </span>
        </div>
      </header>
      <main className="App-main">
        <div className="welcome-section">
          <h2>Welcome</h2>
          <p>This application helps you generate Army DA6 forms quickly and accurately.</p>
          <p className="coming-soon">Form generation interface coming soon...</p>
        </div>
      </main>
    </div>
  );
}

export default App;

