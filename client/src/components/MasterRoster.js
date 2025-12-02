import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../utils/api';
import { getRankOrder } from '../utils/rankOrder';
import { getFederalHolidaysInRange } from '../utils/federalHolidays';
import Layout from './Layout';
import LoadingScreen from './LoadingScreen';
import './MasterRoster.css';

const MasterRoster = () => {
  const { periodStart, periodEnd } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState([]);
  const [soldiers, setSoldiers] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'compact'
  
  // Decode URL parameters
  const decodedPeriodStart = periodStart ? decodeURIComponent(periodStart) : null;
  const decodedPeriodEnd = periodEnd ? decodeURIComponent(periodEnd) : null;

  useEffect(() => {
    if (decodedPeriodStart && decodedPeriodEnd) {
      fetchForms();
      fetchSoldiers();
      fetchHolidays();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decodedPeriodStart, decodedPeriodEnd]);

  const fetchForms = async () => {
    try {
      const { data } = await apiClient.get('/da6-forms');
      const allForms = data.forms || [];
      
      // Filter forms that match the period and are not cancelled
      const matchingForms = allForms.filter(f => {
        if (!f.period_start || !f.period_end) return false;
        if (f.status === 'cancelled') return false;
        
        const fStart = new Date(f.period_start);
        const fEnd = new Date(f.period_end);
        const targetStart = new Date(decodedPeriodStart);
        const targetEnd = new Date(decodedPeriodEnd);
        
        return fStart.getTime() === targetStart.getTime() && 
               fEnd.getTime() === targetEnd.getTime();
      });
      
      // Sort by duty name for consistent display
      matchingForms.sort((a, b) => {
        const aDuty = a.form_data?.duty_config?.nature_of_duty || 'Duty';
        const bDuty = b.form_data?.duty_config?.nature_of_duty || 'Duty';
        return aDuty.localeCompare(bDuty);
      });
      
      setForms(matchingForms);
    } catch (error) {
      console.error('Error fetching forms:', error);
      alert('Error loading forms. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSoldiers = async () => {
    try {
      const { data } = await apiClient.get('/soldiers');
      setSoldiers(data.soldiers || []);
    } catch (error) {
      console.error('Error fetching soldiers:', error);
    }
  };

  const fetchHolidays = async () => {
    if (!decodedPeriodStart || !decodedPeriodEnd) return;
    
    try {
      const holidaysList = getFederalHolidaysInRange(
        new Date(decodedPeriodStart),
        new Date(decodedPeriodEnd)
      );
      setHolidays(holidaysList);
    } catch (error) {
      console.error('Error fetching holidays:', error);
    }
  };

  const isWeekend = (date) => {
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  };

  const isHoliday = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return holidays.some(h => {
      const holidayDate = typeof h === 'string' ? h : h.date;
      return holidayDate === dateStr;
    });
  };

  const shouldIncludeDate = (date) => {
    // Include all dates in the period
    return true;
  };

  const getDatesInRange = () => {
    if (!decodedPeriodStart || !decodedPeriodEnd) return [];
    
    const dates = [];
    const start = new Date(decodedPeriodStart);
    const end = new Date(decodedPeriodEnd);
    const current = new Date(start);
    
    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  };

  const formatDateShort = (date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Build consolidated assignments map from all forms
  const buildConsolidatedAssignments = () => {
    const consolidated = {}; // { soldierId: { dateStr: { assignments: [{ formId, dutyName, duty, exception_code }] } } }
    
    forms.forEach(form => {
      const formAssignments = form.form_data?.assignments || [];
      const dutyName = form.form_data?.duty_config?.nature_of_duty || 'Duty';
      const formId = form.id;
      
      formAssignments.forEach(assignment => {
        if (!assignment.soldier_id || !assignment.date) return;
        
        const soldierId = assignment.soldier_id;
        const dateStr = assignment.date;
        
        if (!consolidated[soldierId]) {
          consolidated[soldierId] = {};
        }
        
        if (!consolidated[soldierId][dateStr]) {
          consolidated[soldierId][dateStr] = {
            assignments: []
          };
        }
        
        consolidated[soldierId][dateStr].assignments.push({
          formId,
          dutyName,
          duty: assignment.duty,
          exception_code: assignment.exception_code,
          nature_of_duty: dutyName
        });
      });
    });
    
    return consolidated;
  };

  const consolidatedAssignments = buildConsolidatedAssignments();

  // Get all unique soldiers from all forms
  const getAllSoldiers = () => {
    const soldierIds = new Set();
    forms.forEach(form => {
      const formSoldiers = form.form_data?.selected_soldiers || [];
      formSoldiers.forEach(id => soldierIds.add(id));
    });
    
    return Array.from(soldierIds)
      .map(id => soldiers.find(s => s.id === id))
      .filter(s => s)
      .sort((a, b) => {
        const aRankOrder = getRankOrder(a.rank?.toUpperCase().trim());
        const bRankOrder = getRankOrder(b.rank?.toUpperCase().trim());
        if (aRankOrder !== bRankOrder) {
          return aRankOrder - bRankOrder;
        }
        return (a.last_name || '').localeCompare(b.last_name || '');
      });
  };

  const allSoldiers = getAllSoldiers();

  if (loading) {
    return <LoadingScreen message="Loading master roster..." />;
  }

  if (!decodedPeriodStart || !decodedPeriodEnd) {
    return (
      <Layout>
        <div className="master-roster">
          <h1>Master Roster</h1>
          <p>Invalid period parameters. Please navigate from a form view.</p>
          <button onClick={() => navigate('/forms')}>Back to Forms</button>
        </div>
      </Layout>
    );
  }

  if (forms.length === 0) {
    return (
      <Layout>
        <div className="master-roster">
          <h1>Master Roster</h1>
          <p>No overlapping forms found for this period.</p>
          <button onClick={() => navigate('/forms')}>Back to Forms</button>
        </div>
      </Layout>
    );
  }

  const dates = getDatesInRange();
  const periodStartDate = new Date(decodedPeriodStart);
  const periodEndDate = new Date(decodedPeriodEnd);

  return (
    <Layout>
      <div className="master-roster">
        <div className="master-roster-header">
          <h1>Master Roster</h1>
          <div className="master-roster-actions">
            <button
              className={`btn-view-mode ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
            >
              Table View
            </button>
            <button
              className={`btn-view-mode ${viewMode === 'compact' ? 'active' : ''}`}
              onClick={() => setViewMode('compact')}
            >
              Compact List
            </button>
            <button className="btn-secondary" onClick={() => navigate('/forms')}>
              Back to Forms
            </button>
            <button className="btn-secondary" onClick={() => window.print()}>
              Print
            </button>
          </div>
        </div>

        <div className="master-roster-info">
          <div className="period-info">
            <p><strong>PERIOD:</strong> {periodStartDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - {periodEndDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
            <p><strong>OVERLAPPING FORMS:</strong> {forms.length}</p>
          </div>
          <div className="forms-list">
            <h3>Forms in this Master Roster:</h3>
            <ul>
              {forms.map(form => {
                const dutyName = form.form_data?.duty_config?.nature_of_duty || 'Duty';
                return (
                  <li key={form.id}>
                    <strong>{dutyName}</strong> ({form.unit_name || form.id})
                    <button 
                      className="btn-link"
                      onClick={() => navigate(`/forms/${form.id}/view`)}
                    >
                      View
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {viewMode === 'table' ? (
          <div className="master-roster-table-container">
            <table className="master-roster-table">
              <thead>
                <tr>
                  <th>GRADE</th>
                  <th>NAME</th>
                  {dates.map((date, idx) => {
                    if (!shouldIncludeDate(date)) return null;
                    return (
                      <th key={idx} className={isWeekend(date) ? 'weekend-header' : isHoliday(date) ? 'holiday-header' : ''}>
                        {formatDateShort(date)}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {allSoldiers.map(soldier => {
                  const soldierAssignments = consolidatedAssignments[soldier.id] || {};
                  
                  return (
                    <tr key={soldier.id}>
                      <td className="grade-cell">{soldier.rank}</td>
                      <td className="name-cell">
                        {soldier.first_name} {soldier.middle_initial} {soldier.last_name}
                      </td>
                      {dates.map((date, dateIdx) => {
                        if (!shouldIncludeDate(date)) return null;
                        
                        const dateStr = date.toISOString().split('T')[0];
                        const assignments = soldierAssignments[dateStr]?.assignments || [];
                        const isWeekendDay = isWeekend(date);
                        const isHolidayDay = isHoliday(date);
                        
                        return (
                          <td
                            key={dateIdx}
                            className={`duty-cell ${isWeekendDay ? 'weekend-cell' : ''} ${isHolidayDay ? 'holiday-cell' : ''}`}
                          >
                            {assignments.length > 0 ? (
                              <div className="master-duty-assignments">
                                {assignments.map((assignment, idx) => {
                                  const isDuty = assignment.duty && !assignment.exception_code;
                                  const exceptionCode = assignment.exception_code;
                                  
                                  return (
                                    <div
                                      key={idx}
                                      className={`master-duty-item ${isDuty ? 'duty' : 'exception'} ${exceptionCode ? `exception-${exceptionCode.toLowerCase()}` : ''}`}
                                      title={`${assignment.dutyName || assignment.nature_of_duty || 'Duty'}`}
                                    >
                                      {isDuty ? (
                                        <span className="duty-checkmark">✓</span>
                                      ) : exceptionCode ? (
                                        <span className="exception-code">{exceptionCode}</span>
                                      ) : null}
                                      <span className="form-indicator">{assignment.dutyName || assignment.nature_of_duty || 'Duty'}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="no-duty">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="master-roster-compact">
            {allSoldiers.map(soldier => {
              const soldierAssignments = consolidatedAssignments[soldier.id] || {};
              const assignmentDates = Object.keys(soldierAssignments).sort();
              
              if (assignmentDates.length === 0) return null;
              
              return (
                <div key={soldier.id} className="compact-soldier-entry">
                  <div className="compact-soldier-header">
                    <strong>{soldier.rank} {soldier.first_name} {soldier.last_name}</strong>
                  </div>
                  <div className="compact-assignments">
                    {assignmentDates.map(dateStr => {
                      const assignments = soldierAssignments[dateStr].assignments;
                      const date = new Date(dateStr);
                      
                      return (
                        <div key={dateStr} className="compact-date-entry">
                          <span className="compact-date">{formatDateShort(date)}:</span>
                          {assignments.map((assignment, idx) => (
                            <span key={idx} className="compact-assignment">
                              {assignment.dutyName || assignment.nature_of_duty || 'Duty'} - {assignment.duty && !assignment.exception_code ? '✓' : assignment.exception_code || '—'}
                            </span>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default MasterRoster;

