import React from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import './SetupRequired.css';

const SetupRequired = () => {
  if (isSupabaseConfigured()) {
    return null;
  }

  return (
    <div className="setup-required">
      <div className="setup-card">
        <h1>⚠️ Setup Required</h1>
        <p className="setup-message">
          Supabase is not configured. Please set up your environment variables to continue.
        </p>
        <div className="setup-instructions">
          <h2>Quick Setup:</h2>
          <ol>
            <li>Create a <code>.env</code> file in the <code>client</code> directory</li>
            <li>Add the following variables:
              <pre>
{`REACT_APP_SUPABASE_URL=your_supabase_project_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key`}
              </pre>
            </li>
            <li>Get these values from your Supabase project settings (Settings → API)</li>
            <li>Restart the development server</li>
          </ol>
          <p className="setup-note">
            📖 Create a Supabase project at <a href="https://app.supabase.com" target="_blank" rel="noopener noreferrer">app.supabase.com</a> and run the database schema from <code>database/schema.sql</code>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SetupRequired;

