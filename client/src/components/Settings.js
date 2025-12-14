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

        {/* Project Information Section */}
        <div className="settings-section project-info-section">
          <div className="section-header">
            <h3>About DA6 Form Generator</h3>
          </div>
          
          <div className="project-info-content">
            <div className="project-status">
              <div className="status-badge live">✅ Live & Deployed</div>
              <p className="project-description">
                A modern web application that automates and streamlines the entire DA6 Duty Roster creation process. 
                Built specifically for Army personnel who need to generate compliant, properly formatted duty rosters quickly and accurately.
              </p>
            </div>

            <div className="project-details-grid">
              <div className="project-detail-card">
                <h4>🌐 Live Application</h4>
                <p><strong>Production URL:</strong></p>
                <a 
                  href="https://da6-form-generator.vercel.app" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="project-link"
                >
                  da6-form-generator.vercel.app
                </a>
              </div>

              <div className="project-detail-card">
                <h4>🛠️ Tech Stack</h4>
                <ul className="tech-list">
                  <li><strong>Frontend:</strong> React 18 + React Router</li>
                  <li><strong>Backend:</strong> Node.js + Express (Vercel Serverless)</li>
                  <li><strong>Database:</strong> Supabase (PostgreSQL)</li>
                  <li><strong>Auth:</strong> Google OAuth</li>
                  <li><strong>Hosting:</strong> Vercel</li>
                </ul>
              </div>

              <div className="project-detail-card">
                <h4>✨ Recent Updates</h4>
                <ul className="updates-list">
                  <li>🌓 Dark mode / Light mode support</li>
                  <li>🎨 Modern UI with smooth animations</li>
                  <li>⚡ Enhanced user experience</li>
                  <li>🎯 Improved visual feedback</li>
                </ul>
              </div>

              <div className="project-detail-card">
                <h4>📊 Current Features</h4>
                <ul className="features-list">
                  <li>✅ Intelligent duty assignment</li>
                  <li>✅ Cross-roster conflict detection</li>
                  <li>✅ Soldier management & profiles</li>
                  <li>✅ Holiday & appointment tracking</li>
                  <li>✅ Duty templates (CQ, SD, CORP)</li>
                  <li>✅ Rank-aware sorting</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Help & Support Section */}
        <div className="settings-section help-section">
          <div className="section-header">
            <h3>Help & Support</h3>
          </div>
          
          <div className="help-content">
            <div className="help-intro">
              <p className="help-intro-text">
                Welcome to the DA6 Form Generator! This guide will help you get started and make the most of the system.
              </p>
            </div>

            <div className="help-sections">
              <div className="help-subsection">
                <h4>📋 Getting Started</h4>
                <ol className="help-list">
                  <li><strong>Add Soldiers:</strong> Go to the "Soldiers" page and add all personnel in your unit. Include their rank, name, EDIPI, and current days since last duty.</li>
                  <li><strong>Migrate from Manual Tracking:</strong> Use the "Bulk Update Days Since Last Duty" feature to import your existing data via CSV or manually update values.</li>
                  <li><strong>Set Up Holidays:</strong> In Settings, add federal holidays or custom unit holidays that should be excluded from duty assignments.</li>
                  <li><strong>Create Your First Roster:</strong> Go to "Forms" and create a new DA6 form. Select soldiers, set the date range, and configure duty requirements.</li>
                </ol>
              </div>

              <div className="help-subsection">
                <h4>🔄 Cross-Roster Checking</h4>
                <p>The system automatically checks for conflicts across all your rosters. When creating a new roster:</p>
                <ul className="help-list">
                  <li>Cross-roster checking is <strong>enabled by default</strong></li>
                  <li>All other rosters are automatically selected for checking</li>
                  <li>Exception codes (CQ, SD, D) are automatically applied to prevent double-booking</li>
                  <li>You can manually adjust which rosters to check or disable the feature if needed</li>
                </ul>
              </div>

              <div className="help-subsection">
                <h4>👥 Managing Soldiers</h4>
                <ul className="help-list">
                  <li><strong>Soldier Profiles:</strong> Click "Profile" on any soldier to view and manage appointments, unavailability, and days since last duty</li>
                  <li><strong>Appointments:</strong> Add leave, training, TDY, or other commitments that should prevent duty assignment</li>
                  <li><strong>Days Since Last Duty:</strong> Automatically tracked, but can be manually adjusted for unit migration or corrections</li>
                </ul>
              </div>

              <div className="help-subsection">
                <h4>📊 Creating Rosters</h4>
                <ul className="help-list">
                  <li><strong>Duty Templates:</strong> Choose from pre-configured templates (CQ, Staff Duty, etc.) or create custom configurations</li>
                  <li><strong>Rank Requirements:</strong> Specify how many soldiers of each rank/group are needed per day</li>
                  <li><strong>Exceptions:</strong> Manually add exception codes for specific dates when soldiers cannot perform duty</li>
                  <li><strong>Date Exclusions:</strong> Mark dates where no duty is needed (e.g., unit training days)</li>
                </ul>
              </div>

              <div className="help-subsection">
                <h4>📤 Migration from Manual Tracking</h4>
                <p>If you're moving from manual tracking to this system:</p>
                <ol className="help-list">
                  <li>Export your current roster data to CSV (if available)</li>
                  <li>Add all soldiers to the system</li>
                  <li>Use "Bulk Update Days Since Last Duty" to import or manually enter current days since last duty for each soldier</li>
                  <li>Create your first roster - the system will automatically track days going forward</li>
                </ol>
              </div>

              <div className="help-subsection">
                <h4>❓ Need Help?</h4>
                <div className="help-contact">
                  <p>If you have questions, encounter issues, or have suggestions for improvement:</p>
                  <div className="contact-links">
                    <a 
                      href="https://github.com/SkyeClover/da6-form-generator" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="contact-link"
                    >
                      <span className="contact-icon">🔗</span>
                      <div>
                        <strong>GitHub Repository</strong>
                        <span className="contact-detail">View documentation, report issues, or contribute</span>
                      </div>
                    </a>
                    <a 
                      href="mailto:jacobwalker852@gmail.com" 
                      className="contact-link"
                    >
                      <span className="contact-icon">✉️</span>
                      <div>
                        <strong>Email Support</strong>
                        <span className="contact-detail">jacobwalker852@gmail.com</span>
                      </div>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
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

