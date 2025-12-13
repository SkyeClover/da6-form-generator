import React from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from './Layout';
import './DA6FormView.css';

const DA6FormView = () => {
  const navigate = useNavigate();

  return (
    <Layout>
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '60vh',
        padding: '2rem',
        textAlign: 'center'
      }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#d32f2f' }}>
          This shit is making me die inside
        </h2>
        <p style={{ fontSize: '1.2rem', marginBottom: '2rem', color: '#666' }}>
          Form viewing logic has been temporarily disabled. Check back later.
        </p>
        <button 
          className="btn-primary"
          onClick={() => navigate('/forms')}
        >
          Back to Forms List
        </button>
      </div>
    </Layout>
  );
};

export default DA6FormView;
