import React, { useState, useEffect } from 'react';
import apiClient from '../utils/api';
import { getExceptionCodesList } from '../utils/exceptionCodes';
import Tooltip from './Tooltip';
import './SoldierProfile.css';

const SoldierProfile = ({ soldier, onClose, onUpdate }) => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [editingDaysSinceDuty, setEditingDaysSinceDuty] = useState(false);
  const [daysSinceDuty, setDaysSinceDuty] = useState(soldier?.days_since_last_duty || 0);
  const [appointmentForm, setAppointmentForm] = useState({
    start_date: '',
    end_date: '',
    reason: '',
    exception_code: '',
    notes: ''
  });

  useEffect(() => {
    if (soldier) {
      setDaysSinceDuty(soldier.days_since_last_duty || 0);
      fetchAppointments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soldier]);

  const fetchAppointments = async () => {
    try {
      const { data } = await apiClient.get(`/soldiers/${soldier.id}/appointments`);
      setAppointments(data.appointments || []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAppointment = async (e) => {
    e.preventDefault();
    try {
      if (editingAppointment) {
        await apiClient.put(`/soldiers/${soldier.id}/appointments/${editingAppointment.id}`, appointmentForm);
      } else {
        await apiClient.post(`/soldiers/${soldier.id}/appointments`, appointmentForm);
      }
      setShowAppointmentForm(false);
      setEditingAppointment(null);
      setAppointmentForm({
        start_date: '',
        end_date: '',
        reason: '',
        exception_code: '',
        notes: ''
      });
      fetchAppointments();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error saving appointment:', error);
      alert('Error saving appointment. Please try again.');
    }
  };

  const handleEditAppointment = (appointment) => {
    setEditingAppointment(appointment);
    setAppointmentForm({
      start_date: appointment.start_date,
      end_date: appointment.end_date,
      reason: appointment.reason,
      exception_code: appointment.exception_code || '',
      notes: appointment.notes || ''
    });
    setShowAppointmentForm(true);
  };

  const handleDeleteAppointment = async (id) => {
    if (!window.confirm('Are you sure you want to delete this appointment?')) return;
    
    try {
      await apiClient.delete(`/soldiers/${soldier.id}/appointments/${id}`);
      fetchAppointments();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error deleting appointment:', error);
      alert('Error deleting appointment. Please try again.');
    }
  };

  const handleSaveDaysSinceDuty = async () => {
    try {
      await apiClient.put(`/soldiers/${soldier.id}`, {
        days_since_last_duty: parseInt(daysSinceDuty) || 0
      });
      setEditingDaysSinceDuty(false);
      if (onUpdate) onUpdate();
      // Update the soldier object locally
      soldier.days_since_last_duty = parseInt(daysSinceDuty) || 0;
    } catch (error) {
      console.error('Error updating days since last duty:', error);
      alert('Error updating days since last duty. Please try again.');
    }
  };

  const handleCancelDaysSinceDuty = () => {
    setDaysSinceDuty(soldier.days_since_last_duty || 0);
    setEditingDaysSinceDuty(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // eslint-disable-next-line no-unused-vars
  const isDateInRange = (date, startDate, endDate) => {
    const checkDate = new Date(date);
    const start = new Date(startDate);
    const end = new Date(endDate);
    return checkDate >= start && checkDate <= end;
  };

  if (!soldier) return null;

  return (
    <div className="soldier-profile-modal">
      <div className="soldier-profile-content">
        <div className="profile-header">
          <h2>
            {soldier.rank} {soldier.first_name} {soldier.middle_initial} {soldier.last_name}
          </h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="profile-sections">
          <div className="profile-section">
            <h3>Soldier Information</h3>
            <div className="info-grid">
              <div className="info-item">
                <strong>Rank:</strong> {soldier.rank}
              </div>
              <div className="info-item">
                <strong>MOS:</strong> {soldier.mos || 'N/A'}
              </div>
              <div className="info-item">
                <strong>EDIPI:</strong> {soldier.edipi || 'N/A'}
              </div>
              <div className="info-item">
                <strong>Unit:</strong> {soldier.unit || 'N/A'}
              </div>
              <div className="info-item days-since-duty-item">
                <strong>Days Since Last Duty:</strong>
                {editingDaysSinceDuty ? (
                  <div className="days-edit-controls">
                    <input
                      type="number"
                      min="0"
                      value={daysSinceDuty}
                      onChange={(e) => setDaysSinceDuty(e.target.value)}
                      className="days-input-inline"
                      autoFocus
                    />
                    <button 
                      className="btn-save-small"
                      onClick={handleSaveDaysSinceDuty}
                    >
                      Save
                    </button>
                    <button 
                      className="btn-cancel-small"
                      onClick={handleCancelDaysSinceDuty}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="days-display">
                    <span className={`days-badge ${(soldier.days_since_last_duty || 0) > 14 ? 'high' : (soldier.days_since_last_duty || 0) > 7 ? 'medium' : 'low'}`}>
                      {soldier.days_since_last_duty || 0} days
                    </span>
                    <Tooltip text="Edit days since last duty. Important for unit migration - enter the current number of days since this soldier's last duty assignment.">
                      <button 
                        className="btn-edit-inline"
                        onClick={() => setEditingDaysSinceDuty(true)}
                      >
                        ✏️
                      </button>
                    </Tooltip>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="profile-section">
            <div className="section-header">
              <h3>Appointments & Unavailability</h3>
              <button 
                className="btn-primary-small"
                onClick={() => {
                  setShowAppointmentForm(true);
                  setEditingAppointment(null);
                  setAppointmentForm({
                    start_date: '',
                    end_date: '',
                    reason: '',
                    exception_code: '',
                    notes: ''
                  });
                }}
              >
                + Add Appointment
              </button>
            </div>

            {showAppointmentForm && (
              <div className="appointment-form-card">
                <h4>{editingAppointment ? 'Edit Appointment' : 'New Appointment'}</h4>
                <form onSubmit={handleSaveAppointment}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Start Date *</label>
                      <input
                        type="date"
                        required
                        value={appointmentForm.start_date}
                        onChange={(e) => setAppointmentForm({ ...appointmentForm, start_date: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>End Date *</label>
                      <input
                        type="date"
                        required
                        value={appointmentForm.end_date}
                        onChange={(e) => setAppointmentForm({ ...appointmentForm, end_date: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Reason *</label>
                      <input
                        type="text"
                        required
                        value={appointmentForm.reason}
                        onChange={(e) => setAppointmentForm({ ...appointmentForm, reason: e.target.value })}
                        placeholder="e.g., Leave, Training, Medical, TDY"
                      />
                    </div>
                    <div className="form-group">
                      <label>Exception Code</label>
                      <select
                        value={appointmentForm.exception_code}
                        onChange={(e) => setAppointmentForm({ ...appointmentForm, exception_code: e.target.value })}
                      >
                        <option value="">None</option>
                        {getExceptionCodesList().map(({ code, name }) => (
                          <option key={code} value={code}>
                            {code} - {name.split(' - ')[1]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Notes</label>
                    <textarea
                      value={appointmentForm.notes}
                      onChange={(e) => setAppointmentForm({ ...appointmentForm, notes: e.target.value })}
                      rows="2"
                      placeholder="Additional details..."
                    />
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="btn-primary-small">
                      {editingAppointment ? 'Update' : 'Add'} Appointment
                    </button>
                    <button 
                      type="button" 
                      className="btn-secondary-small"
                      onClick={() => {
                        setShowAppointmentForm(false);
                        setEditingAppointment(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {loading ? (
              <div className="loading">Loading appointments...</div>
            ) : appointments.length === 0 ? (
              <div className="empty-state">
                <p>No appointments scheduled. Click "Add Appointment" to add one.</p>
              </div>
            ) : (
              <div className="appointments-list">
                {appointments.map(appointment => (
                  <div key={appointment.id} className="appointment-card">
                    <div className="appointment-header">
                      <div>
                        <strong>{appointment.reason}</strong>
                        {appointment.exception_code && (
                          <span className="exception-badge">
                            {appointment.exception_code}
                          </span>
                        )}
                      </div>
                      <div className="appointment-actions">
                        <button 
                          className="btn-edit-small"
                          onClick={() => handleEditAppointment(appointment)}
                        >
                          Edit
                        </button>
                        <button 
                          className="btn-delete-small"
                          onClick={() => handleDeleteAppointment(appointment.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className="appointment-dates">
                      {formatDate(appointment.start_date)} - {formatDate(appointment.end_date)}
                    </div>
                    {appointment.notes && (
                      <div className="appointment-notes">
                        {appointment.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SoldierProfile;

