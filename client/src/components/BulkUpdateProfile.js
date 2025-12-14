import React, { useState } from 'react';
import apiClient from '../utils/api';
import './BulkUpdateProfile.css';

const BulkUpdateProfile = ({ selectedSoldiers, soldiers, onUpdate, onClose }) => {
  const [formData, setFormData] = useState({
    rank: '',
    unit: '',
    mos: '',
    phone: '',
    email: '',
    notes: ''
  });
  const [fieldsToUpdate, setFieldsToUpdate] = useState({
    rank: false,
    unit: false,
    mos: false,
    phone: false,
    email: false,
    notes: false
  });

  const selectedSoldiersList = soldiers.filter(s => selectedSoldiers.has(s.id));

  const handleFieldToggle = (field) => {
    setFieldsToUpdate(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const fieldsSelected = Object.values(fieldsToUpdate).some(v => v);
    if (!fieldsSelected) {
      alert('Please select at least one field to update.');
      return;
    }

    // Build update object with only selected fields
    const updateData = {};
    Object.keys(fieldsToUpdate).forEach(field => {
      if (fieldsToUpdate[field]) {
        updateData[field] = formData[field] || null;
      }
    });

    if (!window.confirm(`Update selected fields for ${selectedSoldiersList.length} soldier(s)?`)) {
      return;
    }

    try {
      const updatePromises = selectedSoldiersList.map(soldier => {
        return apiClient.put(`/soldiers/${soldier.id}`, updateData);
      });

      await Promise.all(updatePromises);
      onUpdate();
      onClose();
      alert(`Successfully updated ${selectedSoldiersList.length} soldier(s).`);
    } catch (error) {
      console.error('Error bulk updating profiles:', error);
      alert('Error updating soldiers. Please try again.');
    }
  };

  return (
    <div className="bulk-update-profile-modal">
      <div className="bulk-update-profile-content">
        <div className="bulk-update-profile-header">
          <h3>Bulk Update Profile</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="bulk-update-profile-info">
          <p>Updating <strong>{selectedSoldiersList.length}</strong> selected soldier(s)</p>
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

        <form onSubmit={handleSubmit} className="bulk-update-profile-form">
          <div className="bulk-update-instructions">
            <p>Select the fields you want to update. Only selected fields will be changed for all selected soldiers.</p>
          </div>

          <div className="bulk-update-fields">
            <div className="bulk-update-field-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={fieldsToUpdate.rank}
                  onChange={() => handleFieldToggle('rank')}
                />
                <span>Rank</span>
              </label>
              {fieldsToUpdate.rank && (
                <input
                  type="text"
                  value={formData.rank}
                  onChange={(e) => setFormData({ ...formData, rank: e.target.value })}
                  placeholder="e.g., SGT, SSG, SPC"
                  className="bulk-update-input"
                />
              )}
            </div>

            <div className="bulk-update-field-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={fieldsToUpdate.unit}
                  onChange={() => handleFieldToggle('unit')}
                />
                <span>Unit</span>
              </label>
              {fieldsToUpdate.unit && (
                <input
                  type="text"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  placeholder="e.g., Alpha Company, 1st Platoon"
                  className="bulk-update-input"
                />
              )}
            </div>

            <div className="bulk-update-field-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={fieldsToUpdate.mos}
                  onChange={() => handleFieldToggle('mos')}
                />
                <span>MOS</span>
              </label>
              {fieldsToUpdate.mos && (
                <input
                  type="text"
                  value={formData.mos}
                  onChange={(e) => setFormData({ ...formData, mos: e.target.value })}
                  placeholder="e.g., 11B, 19D, 25B"
                  className="bulk-update-input"
                />
              )}
            </div>

            <div className="bulk-update-field-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={fieldsToUpdate.phone}
                  onChange={() => handleFieldToggle('phone')}
                />
                <span>Phone</span>
              </label>
              {fieldsToUpdate.phone && (
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g., (555) 123-4567"
                  className="bulk-update-input"
                />
              )}
            </div>

            <div className="bulk-update-field-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={fieldsToUpdate.email}
                  onChange={() => handleFieldToggle('email')}
                />
                <span>Email</span>
              </label>
              {fieldsToUpdate.email && (
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g., soldier@army.mil"
                  className="bulk-update-input"
                />
              )}
            </div>

            <div className="bulk-update-field-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={fieldsToUpdate.notes}
                  onChange={() => handleFieldToggle('notes')}
                />
                <span>Notes</span>
              </label>
              {fieldsToUpdate.notes && (
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes..."
                  className="bulk-update-textarea"
                  rows="3"
                />
              )}
            </div>
          </div>

          <div className="bulk-update-profile-actions">
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
              disabled={!Object.values(fieldsToUpdate).some(v => v)}
            >
              Update {selectedSoldiersList.length} Soldier{selectedSoldiersList.length !== 1 ? 's' : ''}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BulkUpdateProfile;

