import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../utils/api';
import Layout from './Layout';
import LoadingScreen from './LoadingScreen';
import './FormsList.css';

const FormsList = () => {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchForms();
  }, []);

  const fetchForms = async () => {
    try {
      const { data } = await apiClient.get('/da6-forms');
      setForms(data.forms || []);
    } catch (error) {
      console.error('Error fetching forms:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this form? This will recalculate days since last duty for all soldiers.')) return;
    
    try {
      await apiClient.delete(`/da6-forms/${id}`);
      
      // Trigger recalculation on the server after deletion
      await apiClient.post('/api/recalculate-days-since-duty');
      
      fetchForms();
      alert('Form deleted successfully. Days since last duty have been recalculated.');
    } catch (error) {
      console.error('Error deleting form:', error);
      alert('Error deleting form. Please try again.');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  if (loading) {
    return <LoadingScreen message="Loading forms..." />;
  }

  return (
    <Layout>
      <div className="forms-list-container">
      <div className="forms-header">
        <h2>DA6 Forms</h2>
        <button 
          className="btn-primary" 
          onClick={() => navigate('/forms/new')}
        >
          + New Form
        </button>
      </div>

      {forms.length === 0 ? (
        <div className="empty-state">
          <p>No forms created yet. Click "New Form" to get started.</p>
        </div>
      ) : (
        <div className="forms-grid">
          {forms.map((form) => (
            <div key={form.id} className="form-card">
              <div className="form-card-header">
                <h3>{form.unit_name}</h3>
                <span className={`status-badge status-${form.status}`}>
                  {form.status}
                </span>
              </div>
              <div className="form-card-body">
                <p><strong>Period:</strong> {formatDate(form.period_start)} - {formatDate(form.period_end)}</p>
                <p><strong>Created:</strong> {formatDate(form.created_at)}</p>
              </div>
              <div className="form-card-actions">
                <button 
                  className="btn-edit"
                  onClick={() => navigate(`/forms/${form.id}/view`)}
                >
                  View
                </button>
                <button 
                  className="btn-edit"
                  onClick={() => navigate(`/forms/${form.id}`)}
                >
                  Edit
                </button>
                <button 
                  className="btn-delete"
                  onClick={() => handleDelete(form.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </Layout>
  );
};

export default FormsList;

