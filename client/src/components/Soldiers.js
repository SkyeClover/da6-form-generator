import React, { useState, useEffect } from 'react';
import apiClient from '../utils/api';
import { sortSoldiersByRank } from '../utils/rankOrder';
import Layout from './Layout';
import BulkUpdateDays from './BulkUpdateDays';
import SoldierProfile from './SoldierProfile';
import Tooltip from './Tooltip';
import './Soldiers.css';

const Soldiers = () => {
  const [soldiers, setSoldiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSoldier, setEditingSoldier] = useState(null);
  const [selectedProfileSoldier, setSelectedProfileSoldier] = useState(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    middle_initial: '',
    rank: '',
    mos: '',
    edipi: '',
    unit: '',
    phone: '',
    email: '',
    notes: '',
    days_since_last_duty: 0
  });

  useEffect(() => {
    fetchSoldiers();
  }, []);

  const fetchSoldiers = async () => {
    try {
      const { data } = await apiClient.get('/soldiers');
      const sortedSoldiers = sortSoldiersByRank(data.soldiers || []);
      setSoldiers(sortedSoldiers);
    } catch (error) {
      console.error('Error fetching soldiers:', error);
      alert('Error loading soldiers. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingSoldier) {
        await apiClient.put(`/soldiers/${editingSoldier.id}`, formData);
      } else {
        await apiClient.post('/soldiers', formData);
      }
      
      setShowForm(false);
      setEditingSoldier(null);
      setFormData({
        first_name: '',
        last_name: '',
        middle_initial: '',
        rank: '',
        mos: '',
        edipi: '',
        unit: '',
        phone: '',
        email: '',
        notes: '',
        days_since_last_duty: 0
      });
      fetchSoldiers();
    } catch (error) {
      console.error('Error saving soldier:', error);
      alert('Error saving soldier. Please try again.');
    }
  };

  const handleEdit = (soldier) => {
    setEditingSoldier(soldier);
    setFormData({
      ...soldier,
      days_since_last_duty: soldier.days_since_last_duty || 0
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this soldier?')) return;
    
    try {
      await apiClient.delete(`/soldiers/${id}`);
      fetchSoldiers();
    } catch (error) {
      console.error('Error deleting soldier:', error);
      alert('Error deleting soldier. Please try again.');
    }
  };

  if (loading) {
    return <div className="loading">Loading soldiers...</div>;
  }

  return (
    <Layout>
      <div className="soldiers-container">
      <div className="soldiers-header">
        <h2>Manage Soldiers</h2>
        <div className="header-actions">
          {soldiers.length > 0 && (
            <BulkUpdateDays 
              soldiers={soldiers} 
              onUpdate={fetchSoldiers}
            />
          )}
          <button 
            className="btn-primary" 
            onClick={() => {
              setShowForm(true);
              setEditingSoldier(null);
              setFormData({
                first_name: '',
                last_name: '',
                middle_initial: '',
                rank: '',
                mos: '',
                edipi: '',
                unit: '',
                phone: '',
                email: '',
                notes: '',
                days_since_last_duty: 0
              });
            }}
          >
            + Add Soldier
          </button>
        </div>
      </div>

      {showForm && (
        <div className="soldier-form-modal">
          <div className="soldier-form-content">
            <h3>{editingSoldier ? 'Edit Soldier' : 'Add New Soldier'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Last Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Middle Initial</label>
                  <input
                    type="text"
                    maxLength="1"
                    value={formData.middle_initial}
                    onChange={(e) => setFormData({ ...formData, middle_initial: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Rank *</label>
                  <input
                    type="text"
                    required
                    value={formData.rank}
                    onChange={(e) => setFormData({ ...formData, rank: e.target.value })}
                    placeholder="e.g., SGT, SSG, CPT"
                  />
                </div>
                <div className="form-group">
                  <label>MOS</label>
                  <input
                    type="text"
                    value={formData.mos}
                    onChange={(e) => setFormData({ ...formData, mos: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>EDIPI</label>
                  <input
                    type="text"
                    value={formData.edipi}
                    onChange={(e) => setFormData({ ...formData, edipi: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Unit</label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label>Days Since Last Duty</label>
                <input
                  type="number"
                  min="0"
                  value={formData.days_since_last_duty || 0}
                  onChange={(e) => setFormData({ ...formData, days_since_last_duty: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
                <small className="field-help">
                  Important for unit migration: Enter current days since last duty to maintain accurate tracking
                </small>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  {editingSoldier ? 'Update' : 'Add'} Soldier
                </button>
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={() => {
                    setShowForm(false);
                    setEditingSoldier(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="soldiers-list">
        {soldiers.length === 0 ? (
          <div className="empty-state">
            <p>No soldiers added yet. Click "Add Soldier" to get started.</p>
          </div>
        ) : (
          <table className="soldiers-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Rank</th>
                <th>MOS</th>
                <th>EDIPI</th>
                <th>Unit</th>
                <th>Days Since Last Duty</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {soldiers.map((soldier) => (
                <tr key={soldier.id}>
                  <td>
                    {soldier.rank} {soldier.first_name} {soldier.middle_initial} {soldier.last_name}
                  </td>
                  <td>{soldier.rank}</td>
                  <td>{soldier.mos || '-'}</td>
                  <td>{soldier.edipi || '-'}</td>
                  <td>{soldier.unit || '-'}</td>
                  <td>
                    <span className={`days-badge ${(soldier.days_since_last_duty || 0) > 14 ? 'high' : (soldier.days_since_last_duty || 0) > 7 ? 'medium' : 'low'}`}>
                      {soldier.days_since_last_duty || 0} days
                    </span>
                  </td>
                  <td>
                    <button 
                      className="btn-edit"
                      onClick={() => handleEdit(soldier)}
                    >
                      Edit
                    </button>
                    <Tooltip text="View soldier profile, manage appointments, unavailability, and edit days since last duty">
                      <button 
                        className="btn-profile"
                        onClick={() => setSelectedProfileSoldier(soldier)}
                      >
                        Profile
                      </button>
                    </Tooltip>
                    <button 
                      className="btn-delete"
                      onClick={() => handleDelete(soldier.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      </div>
      
      {selectedProfileSoldier && (
        <SoldierProfile
          soldier={selectedProfileSoldier}
          onClose={() => setSelectedProfileSoldier(null)}
          onUpdate={() => {
            fetchSoldiers();
            setSelectedProfileSoldier(null);
          }}
        />
      )}
    </Layout>
  );
};

export default Soldiers;

