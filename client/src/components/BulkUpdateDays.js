import React, { useState } from 'react';
import apiClient from '../utils/api';
import './BulkUpdateDays.css';

const BulkUpdateDays = ({ soldiers, onUpdate }) => {
  const [showModal, setShowModal] = useState(false);
  const [updates, setUpdates] = useState({});

  const handleUpdate = async () => {
    try {
      // Update each soldier
      const updatePromises = Object.entries(updates).map(([soldierId, days]) => {
        if (days !== null && days !== undefined && days !== '') {
          return apiClient.put(`/soldiers/${soldierId}`, {
            days_since_last_duty: parseInt(days) || 0
          });
        }
        return Promise.resolve();
      });

      await Promise.all(updatePromises);
      setShowModal(false);
      setUpdates({});
      onUpdate();
    } catch (error) {
      console.error('Error updating days:', error);
      alert('Error updating days since last duty. Please try again.');
    }
  };

  return (
    <>
      <button 
        className="btn-secondary"
        onClick={() => setShowModal(true)}
      >
        Bulk Update Days Since Last Duty
      </button>

      {showModal && (
        <div className="bulk-update-modal">
          <div className="bulk-update-content">
            <h3>Bulk Update: Days Since Last Duty</h3>
            <p className="bulk-update-description">
              Update days since last duty for multiple soldiers at once. This is useful when migrating units to the system.
            </p>
            
            <div className="bulk-update-table-container">
              <table className="bulk-update-table">
                <thead>
                  <tr>
                    <th>Soldier</th>
                    <th>Current Days</th>
                    <th>New Days</th>
                  </tr>
                </thead>
                <tbody>
                  {soldiers.map(soldier => (
                    <tr key={soldier.id}>
                      <td>
                        {soldier.rank} {soldier.first_name} {soldier.last_name}
                      </td>
                      <td className="current-days">
                        {soldier.days_since_last_duty || 0}
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          value={updates[soldier.id] !== undefined ? updates[soldier.id] : (soldier.days_since_last_duty || 0)}
                          onChange={(e) => setUpdates({
                            ...updates,
                            [soldier.id]: e.target.value
                          })}
                          className="days-input"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bulk-update-actions">
              <button 
                className="btn-secondary"
                onClick={() => {
                  setShowModal(false);
                  setUpdates({});
                }}
              >
                Cancel
              </button>
              <button 
                className="btn-primary"
                onClick={handleUpdate}
              >
                Update All
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BulkUpdateDays;

