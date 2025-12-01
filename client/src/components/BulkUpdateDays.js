import React, { useState } from 'react';
import apiClient from '../utils/api';
import './BulkUpdateDays.css';

const BulkUpdateDays = ({ soldiers, onUpdate }) => {
  const [showModal, setShowModal] = useState(false);
  const [updates, setUpdates] = useState({});
  const [showImport, setShowImport] = useState(false);
  const [csvData, setCsvData] = useState('');

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
      alert('Days since last duty updated successfully!');
    } catch (error) {
      console.error('Error updating days:', error);
      alert('Error updating days since last duty. Please try again.');
    }
  };

  const handleExportCSV = () => {
    // Create CSV content
    const headers = ['Rank', 'First Name', 'Last Name', 'EDIPI', 'Days Since Last Duty'];
    const rows = soldiers.map(soldier => [
      soldier.rank || '',
      soldier.first_name || '',
      soldier.last_name || '',
      soldier.edipi || '',
      soldier.days_since_last_duty || 0
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `soldiers-days-since-duty-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleImportCSV = () => {
    try {
      const lines = csvData.trim().split('\n');
      if (lines.length < 2) {
        alert('CSV must have at least a header row and one data row.');
        return;
      }
      
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const edipiIndex = headers.findIndex(h => h.toLowerCase().includes('edipi'));
      const daysIndex = headers.findIndex(h => h.toLowerCase().includes('days'));
      
      if (edipiIndex === -1 || daysIndex === -1) {
        alert('CSV must include EDIPI and Days Since Last Duty columns.');
        return;
      }
      
      const newUpdates = { ...updates };
      let importedCount = 0;
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const edipi = values[edipiIndex];
        const days = parseInt(values[daysIndex]);
        
        if (edipi && !isNaN(days)) {
          const soldier = soldiers.find(s => s.edipi === edipi);
          if (soldier) {
            newUpdates[soldier.id] = days;
            importedCount++;
          }
        }
      }
      
      setUpdates(newUpdates);
      setShowImport(false);
      setCsvData('');
      alert(`Successfully imported ${importedCount} soldier(s) from CSV. Review and click "Update All" to save.`);
    } catch (error) {
      console.error('Error importing CSV:', error);
      alert('Error importing CSV. Please check the format and try again.');
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
            <div className="bulk-update-header">
              <div>
                <h3>Bulk Update: Days Since Last Duty</h3>
                <p className="bulk-update-description">
                  Update days since last duty for multiple soldiers at once. Perfect for migrating units from manual tracking.
                </p>
              </div>
              <button className="close-button" onClick={() => {
                setShowModal(false);
                setUpdates({});
                setShowImport(false);
              }}>×</button>
            </div>
            
            <div className="bulk-update-actions-header">
              <div className="action-buttons-group">
                <button 
                  className="btn-secondary"
                  onClick={handleExportCSV}
                  title="Export current data to CSV"
                >
                  📥 Export CSV
                </button>
                <button 
                  className="btn-secondary"
                  onClick={() => setShowImport(!showImport)}
                  title="Import from CSV file"
                >
                  📤 Import CSV
                </button>
              </div>
            </div>

            {showImport && (
              <div className="csv-import-section">
                <h4>Import from CSV</h4>
                <p className="csv-help-text">
                  Paste CSV data below. Required columns: EDIPI, Days Since Last Duty (or similar names).
                  <br />
                  <strong>Tip:</strong> Export first to see the correct format, then modify and import.
                </p>
                <textarea
                  className="csv-textarea"
                  value={csvData}
                  onChange={(e) => setCsvData(e.target.value)}
                  placeholder="Paste CSV data here..."
                  rows="6"
                />
                <div className="csv-import-actions">
                  <button 
                    className="btn-primary"
                    onClick={handleImportCSV}
                  >
                    Import Data
                  </button>
                  <button 
                    className="btn-secondary"
                    onClick={() => {
                      setCsvData('');
                      setShowImport(false);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            
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
                    <tr key={soldier.id} className={updates[soldier.id] !== undefined && updates[soldier.id] !== (soldier.days_since_last_duty || 0) ? 'row-changed' : ''}>
                      <td>
                        <strong>{soldier.rank}</strong> {soldier.first_name} {soldier.last_name}
                        {soldier.edipi && <span className="edipi-hint"> ({soldier.edipi})</span>}
                      </td>
                      <td className="current-days">
                        <span className={`days-badge ${(soldier.days_since_last_duty || 0) > 14 ? 'high' : (soldier.days_since_last_duty || 0) > 7 ? 'medium' : 'low'}`}>
                          {soldier.days_since_last_duty || 0}
                        </span>
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
              <div className="update-summary">
                {Object.keys(updates).length > 0 && (
                  <span className="summary-text">
                    {Object.keys(updates).length} soldier(s) will be updated
                  </span>
                )}
              </div>
              <div className="action-buttons">
                <button 
                  className="btn-secondary"
                  onClick={() => {
                    setShowModal(false);
                    setUpdates({});
                    setShowImport(false);
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="btn-primary"
                  onClick={handleUpdate}
                  disabled={Object.keys(updates).length === 0}
                >
                  Update All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BulkUpdateDays;
