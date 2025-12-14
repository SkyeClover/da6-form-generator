import React, { useState } from 'react';
import apiClient from '../utils/api';
import { getExceptionCodesList } from '../utils/exceptionCodes';
import './BulkAddAppointment.css';

const BulkAddAppointment = ({ selectedSoldiers, soldiers, onUpdate, onClose }) => {
  const [formData, setFormData] = useState({
    start_date: '',
    end_date: '',
    reason: '',
    exception_code: '',
    notes: ''
  });

  const selectedSoldiersList = soldiers.filter(s => selectedSoldiers.has(s.id));
  const exceptionCodes = getExceptionCodesList();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.start_date || !formData.end_date) {
      alert('Please provide both start and end dates.');
      return;
    }

    if (!formData.reason.trim()) {
      alert('Please provide a reason for the appointment.');
      return;
    }

    if (!window.confirm(`Add this appointment to ${selectedSoldiersList.length} selected soldier(s)?`)) {
      return;
    }

    try {
      const appointmentPromises = selectedSoldiersList.map(soldier => {
        return apiClient.post(`/soldiers/${soldier.id}/appointments`, formData);
      });

      await Promise.all(appointmentPromises);
      onUpdate();
      onClose();
      alert(`Successfully added appointment to ${selectedSoldiersList.length} soldier(s).`);
    } catch (error) {
      console.error('Error bulk adding appointments:', error);
      alert('Error adding appointments. Please try again.');
    }
  };

  return (
    <div className="bulk-add-appointment-modal">
      <div className="bulk-add-appointment-content">
        <div className="bulk-add-appointment-header">
          <h3>Bulk Add Appointment</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="bulk-add-appointment-info">
          <p>Adding appointment to <strong>{selectedSoldiersList.length}</strong> selected soldier(s)</p>
          <div className="selected-soldiers-preview">
            {selectedSoldiersList.slice(0, 5).map(soldier => (
              <span key={soldier.id} className="soldier-preview-badge">
                {soldier.rank} {soldier.last_name}
              </span>
            ))}
            {selectedSoldiersList.length > 5 && (
              <span className="soldier-preview-badge">
                +{selectedSoldiersList.length - 5} more
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bulk-add-appointment-form">
          <div className="form-group">
            <label>
              Start Date <span className="required">*</span>
            </label>
            <input
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>
              End Date <span className="required">*</span>
            </label>
            <input
              type="date"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>
              Reason <span className="required">*</span>
            </label>
            <input
              type="text"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="e.g., Leave, TDY, Training"
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Exception Code</label>
            <select
              value={formData.exception_code}
              onChange={(e) => setFormData({ ...formData, exception_code: e.target.value })}
              className="form-input"
            >
              <option value="">None</option>
              {exceptionCodes.map(code => (
                <option key={code.code} value={code.code}>
                  {code.code} - {code.description}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes..."
              className="form-textarea"
              rows="3"
            />
          </div>

          <div className="bulk-add-appointment-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
            >
              Add to {selectedSoldiersList.length} Soldier{selectedSoldiersList.length !== 1 ? 's' : ''}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BulkAddAppointment;

