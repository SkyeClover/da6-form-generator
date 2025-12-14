import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { isAdmin } from '../utils/adminCheck';
import { getFormStatus, formatFormStatus } from '../utils/formStatus';
import Layout from './Layout';
import LoadingScreen from './LoadingScreen';
import './FormsList.css';

const FormsList = () => {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingFormId, setDeletingFormId] = useState(null);
  const [overlappingGroups, setOverlappingGroups] = useState([]); // Groups of forms with the same period
  const navigate = useNavigate();
  const { user } = useAuth();
  const userIsAdmin = isAdmin(user);

  useEffect(() => {
    fetchForms();
  }, []);

  useEffect(() => {
    // Find overlapping form groups (forms with the same period)
    if (forms.length > 0) {
      const groups = findOverlappingGroups(forms);
      setOverlappingGroups(groups);
    }
  }, [forms]);

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

  const findOverlappingGroups = (formsList) => {
    const groups = [];
    const processed = new Set();
    
    formsList.forEach(form => {
      if (processed.has(form.id)) return;
      if (!form.period_start || !form.period_end) return;
      if (form.status === 'cancelled') return;
      
      const start = new Date(form.period_start);
      const end = new Date(form.period_end);
      
      // Find all forms with the same period
      const overlapping = formsList.filter(f => {
        if (processed.has(f.id)) return false;
        if (!f.period_start || !f.period_end) return false;
        if (f.status === 'cancelled') return false;
        
        const fStart = new Date(f.period_start);
        const fEnd = new Date(f.period_end);
        
        return fStart.getTime() === start.getTime() && fEnd.getTime() === end.getTime();
      });
      
      if (overlapping.length > 1) {
        groups.push({
          periodStart: form.period_start,
          periodEnd: form.period_end,
          forms: overlapping
        });
        overlapping.forEach(f => processed.add(f.id));
      }
    });
    
    return groups;
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
    
    setDeletingFormId(id);
    
    try {
      // Before deleting, remove duty appointments created by this form
      // This ensures soldier profiles are cleaned up
      // Use bulk fetch endpoint for faster retrieval
      try {
        const { data } = await apiClient.get(`/appointments/by-form/${id}`);
        const appointments = data.appointments || [];
        
        // Debug: Log breakdown of appointments to be deleted
        const dutyAppts = appointments.filter(apt => apt.exception_code === 'D');
        const passAppts = appointments.filter(apt => apt.exception_code === 'P');
        const otherAppts = appointments.filter(apt => apt.exception_code !== 'D' && apt.exception_code !== 'P');
        console.log(`Found ${appointments.length} appointment(s) to delete for form ${id}:`, {
          duty: dutyAppts.length,
          pass: passAppts.length,
          other: otherAppts.length
        });
        
        if (appointments.length > 0) {
          // Use bulk delete endpoint for faster deletion
          const appointmentIds = appointments.map(apt => apt.id);
          try {
            await apiClient.post('/appointments/bulk-delete', {
              appointmentIds: appointmentIds
            });
            console.log(`Removed ${appointmentIds.length} appointment(s) before deleting form ${id} (${dutyAppts.length} duty, ${passAppts.length} pass, ${otherAppts.length} other)`);
          } catch (bulkErr) {
            // Fallback to individual deletes if bulk delete fails
            console.warn('Bulk delete failed, falling back to individual deletes:', bulkErr);
            const BATCH_SIZE = 10;
            for (let i = 0; i < appointments.length; i += BATCH_SIZE) {
              const batch = appointments.slice(i, i + BATCH_SIZE);
              await Promise.all(
                batch.map(apt =>
                  apiClient.delete(`/soldiers/${apt.soldier_id}/appointments/${apt.id}`).catch(err => {
                    console.error(`Error deleting appointment ${apt.id}:`, err);
                    return null;
                  })
                )
              );
            }
          }
        }
      } catch (err) {
        console.error('Error removing appointments before form deletion:', err);
        // Continue with deletion even if appointment cleanup fails
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
    } finally {
      setDeletingFormId(null);
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

  const formatStatus = (form) => {
    // Calculate status dynamically based on dates
    return formatFormStatus(getFormStatus(form));
  };

  if (loading) {
    return <LoadingScreen message="Loading forms..." />;
  }

  if (deletingFormId) {
    const formBeingDeleted = forms.find(f => f.id === deletingFormId);
    const formName = formBeingDeleted?.unit_name || 'form';
    return (
      <LoadingScreen 
        message={`Deleting ${formName}...`}
        subMessage="Removing duty appointments and cleaning up data. This may take a moment."
      />
    );
  }

  return (
    <Layout>
      <div className="forms-list-container">
      <div className="forms-header">
        <h2>DA6 Forms</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {overlappingGroups.length > 0 && (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {overlappingGroups.map((group, idx) => (
                <button
                  key={idx}
                  className="btn-primary"
                  style={{ backgroundColor: '#28a745', borderColor: '#28a745' }}
                  onClick={() => {
                    const periodStart = encodeURIComponent(group.periodStart);
                    const periodEnd = encodeURIComponent(group.periodEnd);
                    navigate(`/master-roster/${periodStart}/${periodEnd}`);
                  }}
                  title={`View Master Roster for ${group.forms.length} overlapping forms`}
                >
                  📋 Master Roster ({group.forms.length} forms)
                </button>
              ))}
            </div>
          )}
          {!userIsAdmin && forms.length >= 3 && (
            <span style={{ 
              color: '#d32f2f', 
              fontSize: '14px',
              fontWeight: '500'
            }}>
              Form limit reached (3/3)
            </span>
          )}
          <button 
            className="btn-primary" 
            onClick={() => navigate('/forms/new')}
            disabled={!userIsAdmin && forms.length >= 3}
            title={!userIsAdmin && forms.length >= 3 ? 'Form limit reached (3/3)' : 'Create a new DA6 form'}
          >
            + New Form
          </button>
        </div>
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
                <h3>{form.form_data?.duty_config?.nature_of_duty || form.unit_name || 'Duty'}</h3>
                <span className={`status-badge status-${getFormStatus(form)}`}>
                  {formatStatus(form)}
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

