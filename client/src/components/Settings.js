import React, { useState, useEffect } from 'react';
import apiClient from '../utils/api';
import { getFederalHolidays } from '../utils/federalHolidays';
import Layout from './Layout';
import './Settings.css';

const Settings = () => {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '' });
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [autoPopulateYear, setAutoPopulateYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchHolidays();
  }, []);

  const fetchHolidays = async () => {
    try {
      const { data } = await apiClient.get('/holidays');
      setHolidays(data.holidays || []);
    } catch (error) {
      console.error('Error fetching holidays:', error);
      // If holidays table doesn't exist yet, just use empty array
      setHolidays([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/holidays', newHoliday);
      setNewHoliday({ date: '', name: '' });
      setShowAddForm(false);
      fetchHolidays();
    } catch (error) {
      console.error('Error adding holiday:', error);
      alert('Error adding holiday. Please try again.');
    }
  };

  const handleUpdateHoliday = async (e) => {
    e.preventDefault();
    try {
      await apiClient.put(`/holidays/${editingHoliday.id}`, {
        date: editingHoliday.date,
        name: editingHoliday.name
      });
      setEditingHoliday(null);
      fetchHolidays();
    } catch (error) {
      console.error('Error updating holiday:', error);
      alert('Error updating holiday. Please try again.');
    }
  };

  const handleDeleteHoliday = async (id) => {
    if (!window.confirm('Are you sure you want to delete this holiday?')) return;
    
    try {
      await apiClient.delete(`/holidays/${id}`);
      fetchHolidays();
    } catch (error) {
      console.error('Error deleting holiday:', error);
      alert('Error deleting holiday. Please try again.');
    }
  };

  const handleAutoPopulateFederal = async () => {
    try {
      const federalHolidays = getFederalHolidays(autoPopulateYear);
      
      // Check which holidays already exist
      const existingDates = new Set(holidays.map(h => h.date));
      const holidaysToAdd = federalHolidays.filter(h => !existingDates.has(h.date));
      
      if (holidaysToAdd.length === 0) {
        alert('All federal holidays for this year are already added.');
        return;
      }
      
      // Add all federal holidays
      for (const holiday of holidaysToAdd) {
        try {
          await apiClient.post('/holidays', holiday);
        } catch (error) {
          // If holiday already exists, skip it
          if (error.response?.status !== 409) {
            console.error('Error adding holiday:', holiday, error);
          }
        }
      }
      
      alert(`Added ${holidaysToAdd.length} federal holiday(s) for ${autoPopulateYear}.`);
      fetchHolidays();
    } catch (error) {
      console.error('Error auto-populating federal holidays:', error);
      alert('Error adding federal holidays. Please try again.');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  if (loading) {
    return <div className="loading">Loading settings...</div>;
  }

  return (
    <Layout>
      <div className="settings-container">
        <div className="settings-header">
          <h2>Settings</h2>
        </div>

        <div className="settings-section">
          <div className="section-header">
            <h3>Holidays</h3>
            <button
              className="btn-primary"
              onClick={() => setShowAddForm(true)}
            >
              + Add Holiday
            </button>
          </div>

          <div className="federal-holidays-section">
            <h4>US Federal Holidays</h4>
            <p className="section-description">
              Automatically add US Federal Holidays for a specific year.
            </p>
            <div className="form-row">
              <div className="form-group">
                <label>Year</label>
                <input
                  type="number"
                  min="2020"
                  max="2100"
                  value={autoPopulateYear}
                  onChange={(e) => setAutoPopulateYear(parseInt(e.target.value) || new Date().getFullYear())}
                />
              </div>
              <button
                className="btn-secondary"
                onClick={handleAutoPopulateFederal}
              >
                Add Federal Holidays for {autoPopulateYear}
              </button>
            </div>
          </div>

          {showAddForm && (
            <div className="holiday-form">
              <h4>Add New Holiday</h4>
              <form onSubmit={handleAddHoliday}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Date *</label>
                    <input
                      type="date"
                      required
                      value={newHoliday.date}
                      onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Name *</label>
                    <input
                      type="text"
                      required
                      value={newHoliday.name}
                      onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                      placeholder="e.g., Unit Training Day"
                    />
                  </div>
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn-primary">
                    Add Holiday
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setShowAddForm(false);
                      setNewHoliday({ date: '', name: '' });
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="holidays-list">
            {holidays.length === 0 ? (
              <div className="empty-state">
                <p>No holidays added yet. Add federal holidays or create custom holidays.</p>
              </div>
            ) : (
              <table className="holidays-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Name</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {holidays
                    .sort((a, b) => new Date(a.date) - new Date(b.date))
                    .map((holiday) => (
                      <tr key={holiday.id}>
                        {editingHoliday?.id === holiday.id ? (
                          <>
                            <td>
                              <input
                                type="date"
                                value={editingHoliday.date}
                                onChange={(e) =>
                                  setEditingHoliday({ ...editingHoliday, date: e.target.value })
                                }
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                value={editingHoliday.name}
                                onChange={(e) =>
                                  setEditingHoliday({ ...editingHoliday, name: e.target.value })
                                }
                              />
                            </td>
                            <td>
                              <button
                                className="btn-edit"
                                onClick={handleUpdateHoliday}
                              >
                                Save
                              </button>
                              <button
                                className="btn-secondary"
                                onClick={() => setEditingHoliday(null)}
                              >
                                Cancel
                              </button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td>{formatDate(holiday.date)}</td>
                            <td>{holiday.name}</td>
                            <td>
                              <button
                                className="btn-edit"
                                onClick={() => setEditingHoliday(holiday)}
                              >
                                Edit
                              </button>
                              <button
                                className="btn-delete"
                                onClick={() => handleDeleteHoliday(holiday.id)}
                              >
                                Delete
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Settings;

