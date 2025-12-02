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

  const checkAffectedForms = (formToDelete) => {
    if (!formToDelete || !formToDelete.form_data) return [];
    
    const affectedForms = [];
    const formToDeleteSoldiers = new Set(formToDelete.form_data.selected_soldiers || []);
    const formToDeletePeriod = {
      start: new Date(formToDelete.period_start),
      end: new Date(formToDelete.period_end)
    };
    
    // Check all other forms to see if they share soldiers
    forms.forEach(otherForm => {
      if (otherForm.id === formToDelete.id) return; // Skip the form being deleted
      
      const otherFormSoldiers = new Set(otherForm.form_data?.selected_soldiers || []);
      
      // Check if there's any overlap in soldiers
      const hasOverlap = Array.from(formToDeleteSoldiers).some(soldierId => 
        otherFormSoldiers.has(soldierId)
      );
      
      if (hasOverlap) {
        // Check if the periods overlap
        const otherFormPeriod = {
          start: new Date(otherForm.period_start),
          end: new Date(otherForm.period_end)
        };
        
        const periodsOverlap = 
          (formToDeletePeriod.start <= otherFormPeriod.end && 
           formToDeletePeriod.end >= otherFormPeriod.start);
        
        if (periodsOverlap) {
          affectedForms.push({
            id: otherForm.id,
            unit_name: otherForm.unit_name,
            period_start: otherForm.period_start,
            period_end: otherForm.period_end,
            status: otherForm.status
          });
        }
      }
    });
    
    return affectedForms;
  };

  const handleDelete = async (id) => {
    const formToDelete = forms.find(f => f.id === id);
    if (!formToDelete) return;
    
    // Check if deleting this form will affect other forms
    const affectedForms = checkAffectedForms(formToDelete);
    
    // Check if form is before end date (will affect days since last duty)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const periodEnd = new Date(formToDelete.period_end);
    periodEnd.setHours(0, 0, 0, 0);
    const isBeforeEndDate = today < periodEnd;
    
    let confirmMessage = 'Are you sure you want to delete this form?';
    
    if (isBeforeEndDate) {
      confirmMessage += `\n\n⚠️ WARNING: This form's duty period hasn't ended yet (ends ${periodEnd.toLocaleDateString()}). Deleting it will remove duty appointments from soldier profiles and may affect "days since last duty" calculations for other forms.`;
    }
    
    if (affectedForms.length > 0) {
      const affectedFormNames = affectedForms.map(f => 
        `${f.unit_name} (${new Date(f.period_start).toLocaleDateString()} - ${new Date(f.period_end).toLocaleDateString()})`
      ).join('\n  - ');
      
      confirmMessage += `\n\n⚠️ WARNING: Deleting this form will affect ${affectedForms.length} other form(s) that share soldiers:\n  - ${affectedFormNames}`;
    }
    
    if (!window.confirm(confirmMessage)) return;
    
    try {
      // Before deleting, remove duty appointments created by this form
      // This ensures soldier profiles are cleaned up
      if (formToDelete.form_data?.selected_soldiers) {
        try {
          // Remove appointments for all soldiers in this form
          const selectedSoldiers = formToDelete.form_data.selected_soldiers || [];
          for (const soldierId of selectedSoldiers) {
            try {
              const { data } = await apiClient.get(`/soldiers/${soldierId}/appointments`);
              const appointments = data.appointments || [];
              
              // Find and delete appointments created by this form
              const formAppointments = appointments.filter(apt => 
                apt.notes && apt.notes.includes(`DA6_FORM:${id}`)
              );
              
              for (const apt of formAppointments) {
                await apiClient.delete(`/soldiers/${soldierId}/appointments/${apt.id}`);
              }
            } catch (err) {
              // Continue even if one soldier's appointments fail to delete
              console.error(`Error removing appointments for soldier ${soldierId}:`, err);
            }
          }
        } catch (err) {
          console.error('Error removing appointments before form deletion:', err);
          // Continue with deletion even if appointment cleanup fails
        }
      }
      
      await apiClient.delete(`/da6-forms/${id}`);
      
      fetchForms();
      
      let alertMessage = 'Form deleted successfully.';
      if (isBeforeEndDate) {
        alertMessage += ' Duty appointments have been removed from soldier profiles.';
      }
      if (affectedForms.length > 0) {
        alertMessage += ` ${affectedForms.length} other form(s) may need to be reviewed as they share soldiers with the deleted form.`;
      }
      
      alert(alertMessage);
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

  const formatStatus = (status) => {
    if (!status) return 'Draft';
    // Convert snake_case to Title Case
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
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
                  {formatStatus(form.status)}
                </span>
              </div>
              <div className="form-card-body">
                <p><strong>Period:</strong> {formatDate(form.period_start)} - {formatDate(form.period_end)}</p>
                <p><strong>Created:</strong> {formatDate(form.created_at)}</p>
                {form.status === 'cancelled' && form.cancelled_date && (
                  <p><strong>Cancelled:</strong> {formatDate(form.cancelled_date)}</p>
                )}
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

