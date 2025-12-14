import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../utils/api';
import { getRankOrder } from '../utils/rankOrder';
import { getFederalHolidaysInRange } from '../utils/federalHolidays';
import { getExceptionCodeName } from '../utils/exceptionCodes';
import Layout from './Layout';
import LoadingScreen from './LoadingScreen';
import './MasterRoster.css';

const MasterRoster = () => {
  const { periodStart, periodEnd } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState([]);
  const [soldiers, setSoldiers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'compact'
  
  // Decode URL parameters
  const decodedPeriodStart = periodStart ? decodeURIComponent(periodStart) : null;
  const decodedPeriodEnd = periodEnd ? decodeURIComponent(periodEnd) : null;

  useEffect(() => {
    if (decodedPeriodStart && decodedPeriodEnd) {
      fetchForms();
      fetchSoldiers();
      fetchAllAppointments();
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

  const fetchAllAppointments = async () => {
    try {
      // Fetch appointments for all soldiers
      const { data: soldiersData } = await apiClient.get('/soldiers');
      const allSoldiers = soldiersData.soldiers || [];
      
      const appointmentPromises = allSoldiers.map(soldier =>
        apiClient.get(`/soldiers/${soldier.id}/appointments`)
          .then(response => response.data.appointments || [])
          .catch(error => {
            console.error(`Error fetching appointments for soldier ${soldier.id}:`, error);
            return [];
          })
      );

      const appointmentArrays = await Promise.all(appointmentPromises);
      const allAppointments = appointmentArrays.flat();
      setAppointments(allAppointments);
    } catch (error) {
      console.error('Error fetching appointments:', error);
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
    
    // Normalize dates to local midnight to prevent timezone shifts
    const dates = [];
    const start = new Date(decodedPeriodStart);
    start.setHours(0, 0, 0, 0);
    const end = new Date(decodedPeriodEnd);
    end.setHours(0, 0, 0, 0);
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

  // Build consolidated assignments map from all forms and appointments
  const buildConsolidatedAssignments = () => {
    const consolidated = {}; // { soldierId: { dateStr: { assignments: [{ formId, dutyName, duty, exception_code, reason, isAppointment }] } } }
    
    // Track which soldiers got duty in each form (to only show passes for those soldiers)
    const soldiersWithDutyByForm = {}; // { formId: Set<soldierId> }
    
    // First, add form assignments and track which soldiers got duty
    forms.forEach(form => {
      const formAssignments = form.form_data?.assignments || [];
      const dutyName = form.form_data?.duty_config?.nature_of_duty || 'Duty';
      const formId = form.id;
      
      // Track soldiers who got duty in this form
      if (!soldiersWithDutyByForm[formId]) {
        soldiersWithDutyByForm[formId] = new Set();
      }
      
      formAssignments.forEach(assignment => {
        if (!assignment.soldier_id || !assignment.date) return;
        
        const soldierId = assignment.soldier_id;
        const dateStr = assignment.date;
        
        // Track if this soldier got duty in this form
        if (assignment.duty) {
          soldiersWithDutyByForm[formId].add(soldierId);
        }
        
        if (!consolidated[soldierId]) {
          consolidated[soldierId] = {};
        }
        
        if (!consolidated[soldierId][dateStr]) {
          consolidated[soldierId][dateStr] = {
            assignments: []
          };
        }
        
        // Only add passes if the soldier was assigned duty in this form
        if (assignment.exception_code === 'P' && !assignment.duty) {
          // This is a pass - only add it if the soldier got duty in this form
          if (!soldiersWithDutyByForm[formId].has(soldierId)) {
            // Soldier didn't get duty in this form, skip this pass
            return;
          }
        }
        
        consolidated[soldierId][dateStr].assignments.push({
          formId,
          dutyName,
          duty: assignment.duty,
          exception_code: assignment.exception_code,
          nature_of_duty: dutyName,
          isAppointment: false
        });
      });
    });
    
    // Then, add actual appointments (like TDY, Leave, etc.)
    // These should replace or be shown instead of form exceptions
    appointments.forEach(appointment => {
      if (!appointment.soldier_id || !appointment.start_date || !appointment.end_date) return;
      
      const soldierId = appointment.soldier_id;
      const aptStart = new Date(appointment.start_date);
      const aptEnd = new Date(appointment.end_date);
      aptStart.setHours(0, 0, 0, 0);
      aptEnd.setHours(0, 0, 0, 0);
      
      // Skip auto-generated appointments (they're already in form assignments)
      if (appointment.notes && appointment.notes.includes('DA6_FORM')) {
        return;
      }
      
      // Get all dates in the appointment range
      const periodStart = new Date(decodedPeriodStart);
      const periodEnd = new Date(decodedPeriodEnd);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd.setHours(0, 0, 0, 0);
      
      const currentDate = new Date(Math.max(aptStart, periodStart));
      const endDate = new Date(Math.min(aptEnd, periodEnd));
      
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        
        if (!consolidated[soldierId]) {
          consolidated[soldierId] = {};
        }
        
        if (!consolidated[soldierId][dateStr]) {
          consolidated[soldierId][dateStr] = {
            assignments: []
          };
        }
        
        // Check if this appointment already exists for this date (prevent duplicates)
        const existingAppointment = consolidated[soldierId][dateStr].assignments.find(
          a => a.isAppointment && a.appointmentId === appointment.id
        );
        
        if (!existingAppointment) {
          // Check if there's already a duty assignment for this date - if so, don't add the appointment
          // (duties take priority, but we still want to show the appointment if there's no duty)
          const hasDutyOnDate = consolidated[soldierId][dateStr].assignments.some(a => a.duty);
          
          // CRITICAL: For TDY/Leave appointments, remove ALL form exceptions (not just matching ones)
          // This prevents showing "TDY BN Staff Duty" and "TDY Change Of Quarters" - just show one "TDY"
          if (appointment.exception_code === 'TDY' || appointment.exception_code === 'L') {
            // Remove all form exceptions (but keep duty assignments)
            consolidated[soldierId][dateStr].assignments = consolidated[soldierId][dateStr].assignments.filter(
              a => a.duty || a.isAppointment
            );
          } else {
            // For other appointments, only remove form exceptions that match the appointment's exception code
            consolidated[soldierId][dateStr].assignments = consolidated[soldierId][dateStr].assignments.filter(
              a => a.duty || !(a.exception_code === appointment.exception_code && !a.duty && !a.isAppointment)
            );
          }
          
          // Only add the appointment if there's no duty on this date
          // OR if the appointment is TDY/Leave which should be shown even with duty (as a conflict)
          if (!hasDutyOnDate || appointment.exception_code === 'TDY' || appointment.exception_code === 'L') {
            // Add the actual appointment
            consolidated[soldierId][dateStr].assignments.push({
              appointmentId: appointment.id,
              dutyName: appointment.reason || 'Appointment',
              duty: false,
              exception_code: appointment.exception_code || 'A',
              nature_of_duty: appointment.reason || 'Appointment',
              reason: appointment.reason,
              notes: appointment.notes,
              isAppointment: true,
              start_date: appointment.start_date, // Include start_date for detailed tooltip
              end_date: appointment.end_date // Include end_date for detailed tooltip
            });
          }
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });
    
    return consolidated;
  };

  const consolidatedAssignments = buildConsolidatedAssignments();

  // Generate color scheme for each form/duty
  // Each duty gets a distinct color to make it easier to distinguish
  const getDutyColorScheme = (dutyName, index) => {
    // Predefined color palettes for different duties
    const colorPalettes = [
      { bg: 'rgba(59, 130, 246, 0.25)', border: '#3b82f6', text: '#1e40af', name: 'Blue' },      // Blue
      { bg: 'rgba(16, 185, 129, 0.25)', border: '#10b981', text: '#047857', name: 'Green' },     // Green
      { bg: 'rgba(245, 158, 11, 0.25)', border: '#f59e0b', text: '#b45309', name: 'Orange' },    // Orange
      { bg: 'rgba(139, 92, 246, 0.25)', border: '#8b5cf6', text: '#6d28d9', name: 'Purple' },    // Purple
      { bg: 'rgba(236, 72, 153, 0.25)', border: '#ec4899', text: '#be185d', name: 'Pink' },      // Pink
      { bg: 'rgba(14, 165, 233, 0.25)', border: '#0ea5e9', text: '#0369a1', name: 'Cyan' },      // Cyan
      { bg: 'rgba(251, 146, 60, 0.25)', border: '#fb923c', text: '#c2410c', name: 'Amber' },     // Amber
      { bg: 'rgba(34, 197, 94, 0.25)', border: '#22c55e', text: '#15803d', name: 'Emerald' },    // Emerald
    ];
    
    // Use modulo to cycle through colors if there are more duties than colors
    return colorPalettes[index % colorPalettes.length];
  };

  // Build duty color map
  const dutyColorMap = {};
  forms.forEach((form, index) => {
    const dutyName = form.form_data?.duty_config?.nature_of_duty || 'Duty';
    if (!dutyColorMap[dutyName]) {
      dutyColorMap[dutyName] = getDutyColorScheme(dutyName, index);
    }
  });

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
              {forms.map((form, index) => {
                const dutyName = form.form_data?.duty_config?.nature_of_duty || 'Duty';
                const colorScheme = dutyColorMap[dutyName] || getDutyColorScheme(dutyName, index);
                return (
                  <li key={form.id} className="form-list-item">
                    <div className="form-list-item-content">
                      <span 
                        className="duty-color-indicator" 
                        style={{ 
                          backgroundColor: colorScheme.bg,
                          borderColor: colorScheme.border,
                          color: colorScheme.text
                        }}
                      >
                        {colorScheme.name}
                      </span>
                      <strong>{dutyName}</strong> ({form.unit_name || form.id})
                    </div>
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
                                {assignments
                                  .filter((assignment, idx, arr) => {
                                    // CRITICAL: Don't show passes on the same date as duty
                                    // If there's a duty assignment on this date, filter out passes
                                    const hasDutyOnDate = arr.some(a => a.duty && !a.exception_code);
                                    if (hasDutyOnDate && assignment.exception_code === 'P' && !assignment.duty) {
                                      return false; // Don't show pass if there's duty on this date
                                    }
                                    return true;
                                  })
                                  .map((assignment, idx) => {
                                    const isDuty = assignment.duty && !assignment.exception_code;
                                    const exceptionCode = assignment.exception_code;
                                    const dutyName = assignment.dutyName || assignment.nature_of_duty || 'Duty';
                                    const colorScheme = dutyColorMap[dutyName] || getDutyColorScheme(dutyName, 0);
                                    
                                    // Build tooltip text
                                    let tooltipText = dutyName;
                                    if (assignment.isAppointment && assignment.reason) {
                                      // For appointments, show the reason and exception code
                                      tooltipText = assignment.reason;
                                      
                                      // Add date range for detailed view (especially important for TDY and multi-day appointments)
                                      if (assignment.start_date && assignment.end_date) {
                                        const startDate = new Date(assignment.start_date);
                                        const endDate = new Date(assignment.end_date);
                                        const startStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                        const endStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                        
                                        // Only show date range if it spans multiple days
                                        if (assignment.start_date !== assignment.end_date) {
                                          tooltipText += ` (${startStr} - ${endStr})`;
                                        } else {
                                          tooltipText += ` (${startStr})`;
                                        }
                                      }
                                      
                                      if (exceptionCode && exceptionCode !== 'A') {
                                        let exceptionName = getExceptionCodeName(exceptionCode);
                                        // Remove "(Already assigned)" from exception names in master roster view
                                        exceptionName = exceptionName.replace(/\s*\(Already assigned\)/gi, '');
                                        tooltipText += ` - ${exceptionName}`;
                                      }
                                      if (assignment.notes && !assignment.notes.includes('DA6_FORM')) {
                                        tooltipText += ` - ${assignment.notes}`;
                                      }
                                    } else if (isDuty) {
                                      tooltipText = `${dutyName} - Duty Assignment`;
                                    } else if (exceptionCode) {
                                      let exceptionName = getExceptionCodeName(exceptionCode);
                                      // Remove "(Already assigned)" from exception names in master roster view
                                      // We only want to show the duty/exception type, not the cross-roster checking message
                                      exceptionName = exceptionName.replace(/\s*\(Already assigned\)/gi, '');
                                      
                                      if (exceptionCode === 'P') {
                                        tooltipText = `${dutyName} - Pass (Days off after duty)`;
                                      } else {
                                        tooltipText = `${dutyName} - ${exceptionName}`;
                                      }
                                    }
                                    
                                    // Determine if this is a pass from this form or another appointment
                                    const isPassFromForm = exceptionCode === 'P' && !assignment.isAppointment;
                                    const isOtherAppointment = assignment.isAppointment && exceptionCode === 'P';
                                    
                                    return (
                                      <div
                                        key={idx}
                                        className={`master-duty-item ${isDuty ? 'duty' : 'exception'} ${exceptionCode ? `exception-${exceptionCode.toLowerCase()}` : ''}`}
                                        data-tooltip={tooltipText || ''}
                                        style={{
                                          backgroundColor: isDuty ? colorScheme.bg : 
                                            (isPassFromForm ? 'rgba(16, 185, 129, 0.2)' : 
                                            (isOtherAppointment ? 'rgba(234, 179, 8, 0.2)' : 'rgba(245, 158, 11, 0.2)')),
                                          borderColor: isDuty ? colorScheme.border : 
                                            (isPassFromForm ? '#10b981' : 
                                            (isOtherAppointment ? '#eab308' : '#f59e0b')),
                                          color: isDuty ? colorScheme.text : 
                                            (isPassFromForm ? '#047857' : 
                                            (isOtherAppointment ? '#a16207' : '#b45309'))
                                        }}
                                      >
                                        {isDuty ? (
                                          <span className="duty-checkmark" style={{ color: colorScheme.text }}>✓</span>
                                        ) : exceptionCode ? (
                                          <span className="exception-code">{exceptionCode}</span>
                                        ) : null}
                                        <span className="form-indicator">{dutyName}</span>
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
                          {assignments.map((assignment, idx) => {
                            const dutyName = assignment.dutyName || assignment.nature_of_duty || 'Duty';
                            const colorScheme = dutyColorMap[dutyName] || getDutyColorScheme(dutyName, 0);
                            const isDuty = assignment.duty && !assignment.exception_code;
                            
                            return (
                              <span 
                                key={idx} 
                                className="compact-assignment"
                                style={{
                                  backgroundColor: isDuty ? colorScheme.bg : 'rgba(245, 158, 11, 0.2)',
                                  borderColor: isDuty ? colorScheme.border : '#f59e0b',
                                  color: isDuty ? colorScheme.text : '#b45309'
                                }}
                              >
                                {dutyName} - {assignment.duty && !assignment.exception_code ? '✓' : assignment.exception_code || '—'}
                              </span>
                            );
                          })}
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

