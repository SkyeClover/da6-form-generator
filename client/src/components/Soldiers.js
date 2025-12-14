import React, { useState, useEffect } from 'react';
import apiClient from '../utils/api';
import { sortSoldiersByRank } from '../utils/rankOrder';
import { useAuth } from '../contexts/AuthContext';
import { isAdmin } from '../utils/adminCheck';
import Layout from './Layout';
import BulkUpdateDays from './BulkUpdateDays';
import BulkUpdateProfile from './BulkUpdateProfile';
import BulkAddAppointment from './BulkAddAppointment';
import BulkCreateSoldiers from './BulkCreateSoldiers';
import SoldierProfile from './SoldierProfile';
import LoadingScreen from './LoadingScreen';
import './Soldiers.css';

const Soldiers = () => {
  const [soldiers, setSoldiers] = useState([]);
  const [filteredSoldiers, setFilteredSoldiers] = useState([]);
  const [selectedSoldiers, setSelectedSoldiers] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSoldier, setEditingSoldier] = useState(null);
  const [selectedProfileSoldier, setSelectedProfileSoldier] = useState(null);
  const [bulkDaysValue, setBulkDaysValue] = useState('');
  const [showBulkDaysModal, setShowBulkDaysModal] = useState(false);
  const [showBulkProfileModal, setShowBulkProfileModal] = useState(false);
  const [showBulkAppointmentModal, setShowBulkAppointmentModal] = useState(false);
  const [showBulkCreateModal, setShowBulkCreateModal] = useState(false);
  const { user } = useAuth();
  const userIsAdmin = isAdmin(user);
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
      setFilteredSoldiers(sortedSoldiers);
      setSelectedSoldiers(new Set()); // Clear selections on refresh
    } catch (error) {
      console.error('Error fetching soldiers:', error);
      alert('Error loading soldiers. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  // Filter soldiers based on search query (name or EDIPI)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredSoldiers(soldiers);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = soldiers.filter(soldier => {
      const fullName = `${soldier.first_name} ${soldier.middle_initial || ''} ${soldier.last_name}`.toLowerCase();
      const edipi = (soldier.edipi || '').toLowerCase();
      const rank = (soldier.rank || '').toLowerCase();
      
      return fullName.includes(query) || 
             edipi.includes(query) ||
             rank.includes(query) ||
             `${soldier.first_name} ${soldier.last_name}`.toLowerCase().includes(query);
    });
    
    setFilteredSoldiers(filtered);
  }, [searchQuery, soldiers]);

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
      
      // Check if it's a limit error (403)
      if (error.response?.status === 403 && error.response?.data?.error) {
        alert(error.response.data.error);
      } else {
        alert('Error saving soldier. Please try again.');
      }
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

  // Selection handlers
  const handleSelectAll = () => {
    if (selectedSoldiers.size === filteredSoldiers.length) {
      setSelectedSoldiers(new Set());
    } else {
      setSelectedSoldiers(new Set(filteredSoldiers.map(s => s.id)));
    }
  };

  const handleSelectSoldier = (id) => {
    const newSelected = new Set(selectedSoldiers);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedSoldiers(newSelected);
  };

  // Bulk actions
  const handleBulkDelete = async () => {
    if (selectedSoldiers.size === 0) return;
    
    const count = selectedSoldiers.size;
    if (!window.confirm(`Are you sure you want to delete ${count} soldier(s)? This action cannot be undone.`)) return;
    
    try {
      await apiClient.post('/soldiers/bulk-delete', {
        soldierIds: Array.from(selectedSoldiers)
      });
      setSelectedSoldiers(new Set());
      fetchSoldiers();
      alert(`Successfully deleted ${count} soldier(s).`);
    } catch (error) {
      console.error('Error bulk deleting soldiers:', error);
      alert('Error deleting soldiers. Please try again.');
    }
  };

  const handleBulkUpdateDays = async () => {
    if (selectedSoldiers.size === 0 || !bulkDaysValue) return;
    
    const days = parseInt(bulkDaysValue);
    if (isNaN(days) || days < 0) {
      alert('Please enter a valid number of days (0 or greater).');
      return;
    }

    const count = selectedSoldiers.size;
    if (!window.confirm(`Set days since last duty to ${days} for ${count} selected soldier(s)?`)) return;
    
    try {
      const updates = {};
      selectedSoldiers.forEach(id => {
        updates[id] = days;
      });
      
      await apiClient.post('/soldiers/bulk-update-days', { updates });
      setSelectedSoldiers(new Set());
      setBulkDaysValue('');
      setShowBulkDaysModal(false);
      fetchSoldiers();
      alert(`Successfully updated ${count} soldier(s).`);
    } catch (error) {
      console.error('Error bulk updating days:', error);
      alert('Error updating soldiers. Please try again.');
    }
  };

  const selectedCount = selectedSoldiers.size;
  const allSelected = filteredSoldiers.length > 0 && selectedSoldiers.size === filteredSoldiers.length;
  const someSelected = selectedSoldiers.size > 0 && selectedSoldiers.size < filteredSoldiers.length;

  if (loading) {
    return <LoadingScreen message="Loading soldiers..." />;
  }

  return (
    <Layout>
      <div className="soldiers-container">
        <div className="soldiers-header">
          <div className="header-title-section">
            <h2>Manage Soldiers</h2>
            {soldiers.length > 0 && (
              <span className="soldier-count-badge">
                {soldiers.length} {soldiers.length === 1 ? 'soldier' : 'soldiers'}
              </span>
            )}
          </div>
          <div className="header-actions">
            <div className="search-container">
              <input
                type="text"
                placeholder="Search by name, rank, or EDIPI..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              {searchQuery && (
                <button
                  className="search-clear"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                >
                  ×
                </button>
              )}
            </div>
            {soldiers.length > 0 && (
              <BulkUpdateDays 
                soldiers={soldiers} 
                onUpdate={fetchSoldiers}
              />
            )}
            {!userIsAdmin && soldiers.length >= 10 && (
              <span className="limit-warning">
                Soldier limit reached (10/10)
              </span>
            )}
            <button 
              className="btn-secondary" 
              onClick={() => setShowBulkCreateModal(true)}
              disabled={!userIsAdmin && soldiers.length >= 10}
              title={!userIsAdmin && soldiers.length >= 10 ? 'You have reached the maximum of 10 soldiers. Please delete an existing soldier to add a new one.' : 'Bulk create multiple soldiers'}
            >
              + Bulk Create
            </button>
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
              disabled={!userIsAdmin && soldiers.length >= 10}
              title={!userIsAdmin && soldiers.length >= 10 ? 'You have reached the maximum of 10 soldiers. Please delete an existing soldier to add a new one.' : 'Add a single soldier'}
            >
              + Add Soldier
            </button>
          </div>
        </div>

        {/* Bulk Actions Toolbar */}
        {selectedCount > 0 && (
          <div className="bulk-actions-toolbar">
            <div className="bulk-actions-info">
              <span className="selected-count">{selectedCount}</span>
              <span>soldier{selectedCount !== 1 ? 's' : ''} selected</span>
            </div>
            <div className="bulk-actions-buttons">
              <button
                className="btn-bulk-action btn-bulk-days"
                onClick={() => setShowBulkDaysModal(true)}
              >
                Set Days Since Last Duty
              </button>
              <button
                className="btn-bulk-action btn-bulk-profile"
                onClick={() => setShowBulkProfileModal(true)}
              >
                Update Profile
              </button>
              <button
                className="btn-bulk-action btn-bulk-appointment"
                onClick={() => setShowBulkAppointmentModal(true)}
              >
                Add Appointment
              </button>
              <button
                className="btn-bulk-action btn-bulk-delete"
                onClick={handleBulkDelete}
              >
                Delete Selected
              </button>
              <button
                className="btn-bulk-action btn-bulk-clear"
                onClick={() => setSelectedSoldiers(new Set())}
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        {/* Bulk Update Days Modal */}
        {showBulkDaysModal && (
          <div className="bulk-days-modal">
            <div className="bulk-days-content">
              <h3>Set Days Since Last Duty</h3>
              <p>Set days since last duty for {selectedCount} selected soldier(s)</p>
              <div className="bulk-days-input-group">
                <label>Days Since Last Duty:</label>
                <input
                  type="number"
                  min="0"
                  value={bulkDaysValue}
                  onChange={(e) => setBulkDaysValue(e.target.value)}
                  placeholder="0"
                  className="bulk-days-input"
                  autoFocus
                />
              </div>
              <div className="bulk-days-actions">
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setShowBulkDaysModal(false);
                    setBulkDaysValue('');
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={handleBulkUpdateDays}
                  disabled={!bulkDaysValue}
                >
                  Update {selectedCount} Soldier{selectedCount !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        )}

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
          ) : filteredSoldiers.length === 0 ? (
            <div className="empty-state">
              <p>No soldiers found matching "{searchQuery}".</p>
              <button 
                className="btn-secondary"
                onClick={() => setSearchQuery('')}
              >
                Clear Search
              </button>
            </div>
          ) : (
            <>
              {searchQuery && (
                <div className="search-results-info">
                  Showing {filteredSoldiers.length} of {soldiers.length} soldier(s)
                </div>
              )}
              <div className="table-wrapper">
                <table className="soldiers-table">
                  <thead>
                    <tr>
                      <th className="checkbox-column">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={input => {
                            if (input) input.indeterminate = someSelected;
                          }}
                          onChange={handleSelectAll}
                          className="checkbox-input"
                          title={allSelected ? 'Deselect all' : 'Select all'}
                        />
                      </th>
                      <th>Name</th>
                      <th>Rank</th>
                      <th>MOS</th>
                      <th>EDIPI</th>
                      <th>Unit</th>
                      <th>Days Since Last Duty</th>
                      <th className="actions-column">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSoldiers.map((soldier) => {
                      const isSelected = selectedSoldiers.has(soldier.id);
                      return (
                        <tr key={soldier.id} className={isSelected ? 'row-selected' : ''}>
                          <td className="checkbox-column">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleSelectSoldier(soldier.id)}
                              className="checkbox-input"
                            />
                          </td>
                          <td className="name-cell">
                            <div className="soldier-name">
                              <button
                                className="soldier-name-link soldier-rank-link"
                                onClick={() => setSelectedProfileSoldier(soldier)}
                                title="View soldier profile"
                              >
                                {soldier.rank}
                              </button>
                              <button
                                className="soldier-name-link"
                                onClick={() => setSelectedProfileSoldier(soldier)}
                                title="View soldier profile"
                              >
                                {soldier.first_name} {soldier.middle_initial ? `${soldier.middle_initial}. ` : ''}{soldier.last_name}
                              </button>
                            </div>
                          </td>
                          <td>{soldier.rank}</td>
                          <td>{soldier.mos || <span className="empty-field">-</span>}</td>
                          <td>{soldier.edipi || <span className="empty-field">-</span>}</td>
                          <td>{soldier.unit || <span className="empty-field">-</span>}</td>
                          <td>
                            <span className={`days-badge ${(soldier.days_since_last_duty || 0) > 14 ? 'high' : (soldier.days_since_last_duty || 0) > 7 ? 'medium' : 'low'}`}>
                              {soldier.days_since_last_duty || 0} days
                            </span>
                          </td>
                          <td className="actions-column">
                            <div className="action-buttons-group">
                              <button 
                                className="btn-action btn-edit"
                                onClick={() => setSelectedProfileSoldier(soldier)}
                                title="Edit soldier and manage profile"
                              >
                                Edit
                              </button>
                              <button 
                                className="btn-action btn-delete"
                                onClick={() => handleDelete(soldier.id)}
                                title="Delete soldier"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
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
          onEditDetails={() => {
            handleEdit(selectedProfileSoldier);
            setSelectedProfileSoldier(null);
          }}
        />
      )}

      {showBulkProfileModal && (
        <BulkUpdateProfile
          selectedSoldiers={selectedSoldiers}
          soldiers={soldiers}
          onUpdate={fetchSoldiers}
          onClose={() => {
            setShowBulkProfileModal(false);
            setSelectedSoldiers(new Set());
          }}
        />
      )}

      {showBulkAppointmentModal && (
        <BulkAddAppointment
          selectedSoldiers={selectedSoldiers}
          soldiers={soldiers}
          onUpdate={fetchSoldiers}
          onClose={() => {
            setShowBulkAppointmentModal(false);
            setSelectedSoldiers(new Set());
          }}
        />
      )}

      {showBulkCreateModal && (
        <BulkCreateSoldiers
          onUpdate={fetchSoldiers}
          onClose={() => setShowBulkCreateModal(false)}
          userIsAdmin={userIsAdmin}
          currentSoldierCount={soldiers.length}
        />
      )}
    </Layout>
  );
};

export default Soldiers;
