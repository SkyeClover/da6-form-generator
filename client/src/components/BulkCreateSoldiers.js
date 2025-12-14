import React, { useState } from 'react';
import apiClient from '../utils/api';
import './BulkCreateSoldiers.css';

const BulkCreateSoldiers = ({ onUpdate, onClose, userIsAdmin, currentSoldierCount }) => {
  const [commonFields, setCommonFields] = useState({
    unit: '',
    rank: '',
    mos: '',
    days_since_last_duty: 0
  });
  
  const [soldiers, setSoldiers] = useState([
    {
      first_name: '',
      last_name: '',
      middle_initial: '',
      edipi: '',
      phone: '',
      email: '',
      notes: ''
    }
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const handleCommonFieldChange = (field, value) => {
    setCommonFields(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSoldierChange = (index, field, value) => {
    const updated = [...soldiers];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setSoldiers(updated);
    
    // Clear error for this field
    if (errors[`${index}-${field}`]) {
      const newErrors = { ...errors };
      delete newErrors[`${index}-${field}`];
      setErrors(newErrors);
    }
  };

  const addSoldierRow = () => {
    setSoldiers([...soldiers, {
      first_name: '',
      last_name: '',
      middle_initial: '',
      edipi: '',
      phone: '',
      email: '',
      notes: ''
    }]);
  };

  const removeSoldierRow = (index) => {
    if (soldiers.length === 1) {
      alert('You must have at least one soldier row.');
      return;
    }
    const updated = soldiers.filter((_, i) => i !== index);
    setSoldiers(updated);
    
    // Clear errors for removed row
    const newErrors = { ...errors };
    Object.keys(newErrors).forEach(key => {
      if (key.startsWith(`${index}-`)) {
        delete newErrors[key];
      }
    });
    setErrors(newErrors);
  };

  const applyCommonToAll = () => {
    // This is handled by using commonFields in the submit
    alert('Common fields will be applied to all soldiers when you submit.');
  };

  const validateForm = () => {
    const newErrors = {};
    
    soldiers.forEach((soldier, index) => {
      if (!soldier.first_name.trim()) {
        newErrors[`${index}-first_name`] = 'First name is required';
      }
      if (!soldier.last_name.trim()) {
        newErrors[`${index}-last_name`] = 'Last name is required';
      }
      if (!commonFields.rank.trim()) {
        newErrors[`common-rank`] = 'Rank is required for all soldiers';
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      alert('Please fix the errors before submitting.');
      return;
    }

    // Check limit for non-admin users
    if (!userIsAdmin && currentSoldierCount + soldiers.length > 10) {
      alert(`You can only have a maximum of 10 soldiers. You currently have ${currentSoldierCount} and are trying to add ${soldiers.length}. Please remove some existing soldiers first.`);
      return;
    }

    if (!window.confirm(`Create ${soldiers.length} soldier(s)?`)) {
      return;
    }

    setSubmitting(true);

    try {
      // Prepare soldiers data with common fields applied
      const soldiersToCreate = soldiers.map(soldier => ({
        ...soldier,
        rank: commonFields.rank,
        unit: commonFields.unit || null,
        mos: commonFields.mos || null,
        days_since_last_duty: parseInt(commonFields.days_since_last_duty) || 0,
        edipi: soldier.edipi || null,
        phone: soldier.phone || null,
        email: soldier.email || null,
        notes: soldier.notes || null,
        middle_initial: soldier.middle_initial ? soldier.middle_initial.toUpperCase() : null
      }));

      // Create all soldiers in parallel
      const createPromises = soldiersToCreate.map(soldier => 
        apiClient.post('/soldiers', soldier)
      );

      await Promise.all(createPromises);
      
      onUpdate();
      onClose();
      alert(`Successfully created ${soldiers.length} soldier(s).`);
    } catch (error) {
      console.error('Error creating soldiers:', error);
      
      if (error.response?.status === 403 && error.response?.data?.error) {
        alert(error.response.data.error);
      } else {
        alert('Error creating soldiers. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bulk-create-soldiers-modal">
      <div className="bulk-create-soldiers-content">
        <div className="bulk-create-header">
          <h3>Bulk Create Soldiers</h3>
          <button 
            className="close-button"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="bulk-create-form">
          {/* Common Fields Section */}
          <div className="common-fields-section">
            <h4>Common Fields (Applied to All Soldiers)</h4>
            <div className="common-fields-grid">
              <div className="form-group">
                <label>Rank *</label>
                <input
                  type="text"
                  required
                  value={commonFields.rank}
                  onChange={(e) => handleCommonFieldChange('rank', e.target.value)}
                  placeholder="e.g., PVT, SGT, SSG"
                  className={errors['common-rank'] ? 'error' : ''}
                />
                {errors['common-rank'] && (
                  <span className="error-message">{errors['common-rank']}</span>
                )}
              </div>
              <div className="form-group">
                <label>Unit</label>
                <input
                  type="text"
                  value={commonFields.unit}
                  onChange={(e) => handleCommonFieldChange('unit', e.target.value)}
                  placeholder="e.g., 1st Battalion"
                />
              </div>
              <div className="form-group">
                <label>MOS</label>
                <input
                  type="text"
                  value={commonFields.mos}
                  onChange={(e) => handleCommonFieldChange('mos', e.target.value)}
                  placeholder="e.g., 11B, 25B"
                />
              </div>
              <div className="form-group">
                <label>Days Since Last Duty</label>
                <input
                  type="number"
                  min="0"
                  value={commonFields.days_since_last_duty}
                  onChange={(e) => handleCommonFieldChange('days_since_last_duty', e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Individual Soldiers Section */}
          <div className="soldiers-section">
            <div className="soldiers-section-header">
              <h4>Individual Soldiers ({soldiers.length})</h4>
              <button
                type="button"
                className="btn-add-row"
                onClick={addSoldierRow}
              >
                + Add Row
              </button>
            </div>

            <div className="soldiers-table-wrapper">
              <table className="bulk-create-table">
                <thead>
                  <tr>
                    <th>First Name *</th>
                    <th>Last Name *</th>
                    <th>M.I.</th>
                    <th>EDIPI</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Notes</th>
                    <th className="actions-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {soldiers.map((soldier, index) => (
                    <tr key={index} className={Object.keys(errors).some(k => k.startsWith(`${index}-`)) ? 'row-error' : ''}>
                      <td>
                        <input
                          type="text"
                          required
                          value={soldier.first_name}
                          onChange={(e) => handleSoldierChange(index, 'first_name', e.target.value)}
                          className={errors[`${index}-first_name`] ? 'error' : ''}
                          placeholder="John"
                        />
                        {errors[`${index}-first_name`] && (
                          <span className="error-message-inline">{errors[`${index}-first_name`]}</span>
                        )}
                      </td>
                      <td>
                        <input
                          type="text"
                          required
                          value={soldier.last_name}
                          onChange={(e) => handleSoldierChange(index, 'last_name', e.target.value)}
                          className={errors[`${index}-last_name`] ? 'error' : ''}
                          placeholder="Doe"
                        />
                        {errors[`${index}-last_name`] && (
                          <span className="error-message-inline">{errors[`${index}-last_name`]}</span>
                        )}
                      </td>
                      <td>
                        <input
                          type="text"
                          maxLength="1"
                          value={soldier.middle_initial}
                          onChange={(e) => handleSoldierChange(index, 'middle_initial', e.target.value.toUpperCase())}
                          placeholder="M"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={soldier.edipi}
                          onChange={(e) => handleSoldierChange(index, 'edipi', e.target.value)}
                          placeholder="1234567890"
                        />
                      </td>
                      <td>
                        <input
                          type="tel"
                          value={soldier.phone}
                          onChange={(e) => handleSoldierChange(index, 'phone', e.target.value)}
                          placeholder="(555) 123-4567"
                        />
                      </td>
                      <td>
                        <input
                          type="email"
                          value={soldier.email}
                          onChange={(e) => handleSoldierChange(index, 'email', e.target.value)}
                          placeholder="john.doe@email.com"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={soldier.notes}
                          onChange={(e) => handleSoldierChange(index, 'notes', e.target.value)}
                          placeholder="Optional notes"
                        />
                      </td>
                      <td className="actions-col">
                        <button
                          type="button"
                          className="btn-remove-row"
                          onClick={() => removeSoldierRow(index)}
                          disabled={soldiers.length === 1}
                          title={soldiers.length === 1 ? 'Cannot remove last row' : 'Remove row'}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="form-actions">
            <button 
              type="button" 
              className="btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Creating...' : `Create ${soldiers.length} Soldier${soldiers.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BulkCreateSoldiers;

