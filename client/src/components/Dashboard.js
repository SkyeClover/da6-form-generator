import React from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from './Layout';
import './Dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="dashboard">
        <div className="dashboard-main">
        <div className="welcome-section">
          <h2>Welcome back!</h2>
          <p>Your DA6 form management dashboard is ready.</p>
          <div className="feature-cards">
            <div className="feature-card">
              <h3>Create DA6 Form</h3>
              <p>Generate a new duty roster form</p>
              <button 
                className="card-button"
                onClick={() => navigate('/forms/new')}
              >
                New Form
              </button>
            </div>
            <div className="feature-card">
              <h3>Manage Soldiers</h3>
              <p>Add and manage personnel information</p>
              <button 
                className="card-button"
                onClick={() => navigate('/soldiers')}
              >
                Manage
              </button>
            </div>
            <div className="feature-card">
              <h3>View Forms</h3>
              <p>View and edit your saved forms</p>
              <button 
                className="card-button"
                onClick={() => navigate('/forms')}
              >
                View All
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;

