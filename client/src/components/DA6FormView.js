import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../utils/api';
import { getRankOrder, sortSoldiersByRank, isNCORank, rankMatchesRequirement } from '../utils/rankOrder';
import { getFederalHolidaysInRange } from '../utils/federalHolidays';
import { getFormStatus, formatFormStatus } from '../utils/formStatus';
import { getExceptionCodeName } from '../utils/exceptionCodes';
import { calculateDaysSinceLastDuty } from '../utils/daysSinceDuty';
import Layout from './Layout';
import LoadingScreen from './LoadingScreen';
import './DA6FormView.css';

const DA6FormView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [soldiers, setSoldiers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [otherForms, setOtherForms] = useState([]);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'compact'

  useEffect(() => {
    if (id) {
      fetchForm();
      fetchSoldiers();
      fetchAllAppointments();
      fetchOtherForms();
    }
  }, [id]);

  const fetchForm = async () => {
    try {
      const { data } = await apiClient.get(`/da6-forms/${id}`);
      setForm(data.form);
      
      // Debug: Log pass assignments in form data
      if (data.form.form_data?.assignments) {
        const passAssignments = data.form.form_data.assignments.filter(a => a.exception_code === 'P');
        const dutyAssignments = data.form.form_data.assignments.filter(a => a.duty === true);
        console.log('Form loaded - Assignments breakdown:', {
          total: data.form.form_data.assignments.length,
          duty: dutyAssignments.length,
          passes: passAssignments.length,
          other: data.form.form_data.assignments.length - dutyAssignments.length - passAssignments.length
        });
        if (passAssignments.length > 0) {
          console.log('Sample pass assignments from form:', passAssignments.slice(0, 5));
        } else {
          console.warn('⚠️ WARNING: No pass assignments found in form data!');
        }
      }
      
      // Fetch holidays for the form period
      if (data.form.period_start && data.form.period_end) {
        const holidaysList = getFederalHolidaysInRange(
          new Date(data.form.period_start),
          new Date(data.form.period_end)
        );
        setHolidays(holidaysList);
      }
    } catch (error) {
      console.error('Error fetching form:', error);
      alert('Error loading form. Please try again.');
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

  const fetchOtherForms = async () => {
    try {
      const { data } = await apiClient.get('/da6-forms');
      // Exclude the current form
      const other = (data.forms || []).filter(f => f.id !== id);
      setOtherForms(other);
    } catch (error) {
      console.error('Error fetching other forms:', error);
    }
  };

  const getDaysSinceLastDutyForDate = (soldier, date) => {
    // Calculate days since last duty for a specific date
    // This includes assignments from the current form up to and including this date
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    const dateStr = date.toISOString().split('T')[0];
    
    // First, check if soldier has duty ON this date - if so, days since = 0
    if (form && form.form_data && form.form_data.assignments) {
      const dutyOnThisDate = form.form_data.assignments.find(
        a => a.soldier_id === soldier.id && 
             a.date === dateStr && 
             a.duty === true
      );
      if (dutyOnThisDate) {
        return 0; // Soldier has duty today, so days since last duty = 0
      }
    }
    
    // Check appointments for duty on this date
    const dutyExceptionCodes = ['CQ', 'SD', 'D'];
    const appointmentOnThisDate = appointments.find(apt => {
      if (apt.soldier_id !== soldier.id) return false;
      if (!dutyExceptionCodes.includes(apt.exception_code)) return false;
      const aptStart = new Date(apt.start_date);
      const aptEnd = new Date(apt.end_date);
      aptStart.setHours(0, 0, 0, 0);
      aptEnd.setHours(0, 0, 0, 0);
      return checkDate >= aptStart && checkDate <= aptEnd;
    });
    if (appointmentOnThisDate) {
      return 0; // Soldier has duty appointment today
    }
    
    // Find the most recent duty date before or on this date
    let lastDutyDate = null;
    
    // Check appointments for duty assignments
    appointments.forEach(apt => {
      if (dutyExceptionCodes.includes(apt.exception_code) && apt.soldier_id === soldier.id) {
        const aptStart = new Date(apt.start_date);
        aptStart.setHours(0, 0, 0, 0);
        if (aptStart <= checkDate && (!lastDutyDate || aptStart > lastDutyDate)) {
          lastDutyDate = aptStart;
        }
      }
    });
    
    // Check ALL other forms (any status) - all forms should be treated as real assignments
    // This ensures days since last duty accounts for all forms, even pending ones
    // NOTE: otherForms should already exclude the current form, so we don't double-count
    otherForms.forEach(otherForm => {
      if (!otherForm.form_data || !otherForm.form_data.assignments) return;
      if (!otherForm.form_data.selected_soldiers?.includes(soldier.id)) return;
      
      // Only consider duties that are on or before the check date (not future duties)
      otherForm.form_data.assignments.forEach(assignment => {
        if (assignment.soldier_id === soldier.id && assignment.duty && !assignment.exception_code) {
          const dutyDate = new Date(assignment.date);
          dutyDate.setHours(0, 0, 0, 0);
          // Only consider duties on or before the check date (not future duties)
          if (dutyDate <= checkDate && (!lastDutyDate || dutyDate > lastDutyDate)) {
            lastDutyDate = dutyDate;
          }
        }
      });
    });
    
    // Check current form assignments up to and including this date
    if (form && form.form_data && form.form_data.assignments) {
      form.form_data.assignments.forEach(assignment => {
        if (assignment.soldier_id === soldier.id && assignment.duty && !assignment.exception_code) {
          const assignmentDate = new Date(assignment.date);
          assignmentDate.setHours(0, 0, 0, 0);
          if (assignmentDate <= checkDate && (!lastDutyDate || assignmentDate > lastDutyDate)) {
            lastDutyDate = assignmentDate;
          }
        }
      });
    }
    
    // Calculate days since last duty
    if (lastDutyDate) {
      const daysSince = Math.floor((checkDate - lastDutyDate) / (1000 * 60 * 60 * 24));
      return Math.max(0, daysSince);
    }
    
    // If no duty found, calculate from initial state
    // Use the soldier's actual days_since_last_duty from the database as baseline
    // This ensures we're using the most up-to-date value from the database
    const soldierDaysSinceLastDuty = soldier.days_since_last_duty || 0;
    
    // Get the form start date to calculate how many days have passed
    const formStartDate = form && form.period_start ? new Date(form.period_start) : checkDate;
    formStartDate.setHours(0, 0, 0, 0);
    
    // Calculate initial days at the start of the form period
    // Include all forms (any status) for accurate calculation
    // But use the soldier's database value as the baseline if it's more recent
    const calculatedInitialDays = calculateDaysSinceLastDuty(soldier, otherForms, appointments, formStartDate);
    const initialDays = Math.max(soldierDaysSinceLastDuty, calculatedInitialDays);
    
    // Calculate how many days have passed since form start
    const daysPassed = Math.floor((checkDate - formStartDate) / (1000 * 60 * 60 * 24));
    
    // Count how many days the soldier had duty or passes in this form (these don't count toward incrementing)
    let nonCountingDays = 0;
    if (form && form.form_data && form.form_data.assignments) {
      for (let i = 0; i <= daysPassed; i++) {
        const checkDateInRange = new Date(formStartDate);
        checkDateInRange.setDate(checkDateInRange.getDate() + i);
        const checkDateStr = checkDateInRange.toISOString().split('T')[0];
        
        // Check if soldier had duty or pass on this date
        const assignment = form.form_data.assignments.find(
          a => a.soldier_id === soldier.id && a.date === checkDateStr
        );
        if (assignment && (assignment.duty || assignment.exception_code === 'P')) {
          nonCountingDays++;
        }
      }
    }
    
    // Days since last duty = initial days + days passed - non-counting days
    return Math.max(0, initialDays + daysPassed - nonCountingDays);
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

  const getDatesInRange = () => {
    if (!form || !form.period_start || !form.period_end) return [];
    
    // Normalize dates to local midnight to prevent timezone shifts
    const dates = [];
    const start = new Date(form.period_start);
    start.setHours(0, 0, 0, 0);
    const end = new Date(form.period_end);
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

  const getAssignmentForSoldierDate = (soldierId, dateStr) => {
    // First check form assignments (these take priority)
    // Prioritize duty assignments over exceptions, but passes should still be visible
    if (form && form.form_data && form.form_data.assignments) {
      // First, try to find a duty assignment (these take highest priority)
      const dutyAssignment = form.form_data.assignments.find(
        a => a.soldier_id === soldierId && a.date === dateStr && a.duty === true
      );
      if (dutyAssignment) {
        // If there's a duty on this date, don't show a pass on the same date
        return { ...dutyAssignment, isFromThisForm: true };
      }
      
      // If no duty assignment, look for any assignment (exception, including passes)
      // BUT: Only show passes if the soldier was actually assigned duty in this form
      // Check if soldier has any duty assignment in this form (on any date)
      const hasDutyInForm = form.form_data.assignments.some(
        a => a.soldier_id === soldierId && a.duty === true
      );
      
      const formAssignment = form.form_data.assignments.find(
        a => a.soldier_id === soldierId && a.date === dateStr
      );
      
      if (formAssignment) {
        // CRITICAL: Don't show passes on the same date as duty
        // If there's a duty on this date, we already returned it above
        // So if we get here, there's no duty on this date
        
        // Only show passes if the soldier was assigned duty in this form (on some other date)
        if (formAssignment.exception_code === 'P' && !hasDutyInForm) {
          // This is a pass but soldier wasn't assigned duty - don't show it
          // Fall through to check appointments
        } else {
          // Debug: Log if we found a pass assignment
          if (formAssignment.exception_code === 'P') {
            console.log(`Found pass assignment for soldier ${soldierId} on ${dateStr}`);
          }
          return { ...formAssignment, isFromThisForm: true };
        }
      }
    }
    
    // Then check appointments (for passes and other exceptions not in form assignments)
    // Only check if we don't already have a form assignment for this date
    const appointment = appointments.find(apt => {
      if (apt.soldier_id !== soldierId) return false;
      const aptStart = new Date(apt.start_date);
      const aptEnd = new Date(apt.end_date);
      const checkDate = new Date(dateStr);
      aptStart.setHours(0, 0, 0, 0);
      aptEnd.setHours(0, 0, 0, 0);
      checkDate.setHours(0, 0, 0, 0);
      return checkDate >= aptStart && checkDate <= aptEnd;
    });
    
    if (appointment) {
      // Check if this appointment is from this form (has form_id matching current form)
      const isFromThisForm = appointment.form_id === form?.id;
      
      // Don't override form assignments with appointments
      // Only use appointments if there's no form assignment
      // CRITICAL: For duty appointments (exception_code 'D'), we need to check if it's from this form
      // If it's from another form, treat it as an exception code, not a duty
      const isDutyFromThisForm = appointment.exception_code === 'D' && isFromThisForm;
      
      return {
        soldier_id: soldierId,
        date: dateStr,
        exception_code: appointment.exception_code || 'A',
        duty: isDutyFromThisForm, // Only mark as duty if it's from this form
        reason: appointment.reason, // Include the appointment reason
        notes: appointment.notes, // Include notes for additional context
        isAppointment: true, // Flag to indicate this came from an appointment
        isFromThisForm: isFromThisForm, // Flag to indicate if it's from this form
        form_id: appointment.form_id, // Include form_id for checking
        start_date: appointment.start_date, // Include start_date for detailed tooltip
        end_date: appointment.end_date // Include end_date for detailed tooltip
      };
    }
    
    return null;
  };

  const getAllEligibleSoldiers = () => {
    // Get all soldiers, sorted by rank and alphabetically
    // This shows all soldiers that could be selected for this duty
    let eligibleSoldiers = sortSoldiersByRank(soldiers);
    
    // Filter based on rank requirements
    if (form && form.form_data && form.form_data.rank_requirements) {
      const rankReqs = form.form_data.rank_requirements;
      const requirements = rankReqs.requirements || [];
      const exclusions = rankReqs.exclusions || rankReqs.global_exclusions || {};
      
      // Check if NCOs are excluded globally
      let excludeNCOs = exclusions.groups && exclusions.groups.includes('nco');
      
      // Also check individual requirements for NCO exclusion
      if (!excludeNCOs && requirements.length > 0) {
        excludeNCOs = requirements.some(req => 
          req.excluded_groups && req.excluded_groups.includes('nco')
        );
      }
      
      // CRITICAL: If there are requirements, only show soldiers who:
      // 1. Match at least one requirement, OR
      // 2. Have an assignment in this form (so we can see their assignments)
      if (requirements.length > 0) {
        const formAssignments = form.form_data.assignments || [];
        const soldiersWithAssignments = new Set(
          formAssignments.map(a => a.soldier_id)
        );
        
        eligibleSoldiers = eligibleSoldiers.filter(soldier => {
          // If soldier has an assignment in this form, always show them
          if (soldiersWithAssignments.has(soldier.id)) {
            return true;
          }
          
          // Otherwise, check if they match any requirement
          const rank = (soldier.rank || '').toUpperCase().trim();
          const matchesAnyRequirement = requirements.some(req => {
            return rankMatchesRequirement(rank, req);
          });
          
          return matchesAnyRequirement;
        });
      } else if (excludeNCOs) {
        // If no requirements but NCOs are excluded, filter them out
        const beforeCount = eligibleSoldiers.length;
        eligibleSoldiers = eligibleSoldiers.filter(soldier => !isNCORank(soldier.rank));
        const afterCount = eligibleSoldiers.length;
        if (beforeCount !== afterCount) {
          console.log(`Filtered out ${beforeCount - afterCount} NCO(s) from display (NCOs excluded for this duty)`);
        }
      }
    }
    
    return eligibleSoldiers;
  };

  const getDutyAssignmentsByDate = () => {
    if (!form || !form.form_data || !form.form_data.assignments) return {};
    
    const assignmentsByDate = {};
    form.form_data.assignments.forEach(assignment => {
      if (assignment.duty) {
        if (!assignmentsByDate[assignment.date]) {
          assignmentsByDate[assignment.date] = [];
        }
        assignmentsByDate[assignment.date].push(assignment);
      }
    });
    
    return assignmentsByDate;
  };

  if (loading) {
    return <LoadingScreen message="Loading form..." />;
  }

  if (!form) {
    return (
      <Layout>
        <div className="da6-form-view">
          <div className="error">
            <p>Form not found.</p>
            <button className="btn-primary" onClick={() => navigate('/forms')}>
              Back to Forms List
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const dates = getDatesInRange();
  const allSoldiers = getAllEligibleSoldiers();
  const dutyAssignmentsByDate = getDutyAssignmentsByDate();
  const dutyName = form.form_data?.duty_config?.nature_of_duty || 'Duty';

  return (
    <Layout>
      <div className="da6-form-view">
        <div className="form-view-header">
          <div>
            <h1>{form.unit_name}</h1>
            <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '1.1rem' }}>
              {dutyName}
            </p>
          </div>
          <div className="form-actions-header">
            <button
              className={`btn-secondary ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
            >
              Table View
            </button>
            <button
              className={`btn-secondary ${viewMode === 'compact' ? 'active' : ''}`}
              onClick={() => setViewMode('compact')}
            >
              Compact View
            </button>
            <button
              className="btn-secondary"
              onClick={() => navigate(`/forms/${id}`)}
            >
              Edit
            </button>
            <button
              className="btn-secondary"
              onClick={() => navigate('/forms')}
            >
              Back to Forms
            </button>
          </div>
        </div>

        <div className="roster-info">
          <div className="info-row">
            <span><strong>Period:</strong></span>
            <span>
              {new Date(form.period_start).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })} - {new Date(form.period_end).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </span>
          </div>
          <div className="info-row">
            <span><strong>Status:</strong></span>
            <span>{formatFormStatus(getFormStatus(form))}</span>
          </div>
          {form.form_data?.duty_config?.days_off_after_duty && (
            <div className="info-row">
              <span><strong>Days Off After Duty:</strong></span>
              <span>{form.form_data.duty_config.days_off_after_duty}</span>
            </div>
          )}
        </div>

        {viewMode === 'table' ? (
          <div className="roster-container">
            <div className="roster-table-wrapper">
              <table className="roster-table">
                <thead>
                  <tr>
                    <th className="grade-col">Rank</th>
                    <th className="name-col">Name</th>
                    <th className="days-col">Days Since Last Duty</th>
                    {dates.map((date, idx) => {
                      const dateStr = date.toISOString().split('T')[0];
                      const isWeekendDay = isWeekend(date);
                      const isHolidayDay = isHoliday(date);
                      const className = isHolidayDay ? 'weekend-header' : isWeekendDay ? 'weekend-header' : '';
                      
                      return (
                        <th key={idx} className={`date-col ${className}`}>
                          <div className="date-header">
                            <span className="month-label">
                              {date.toLocaleDateString('en-US', { month: 'short' })}
                            </span>
                            <span className="day-number">
                              {date.getDate()}
                            </span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {allSoldiers.map((soldier) => {
                    // Calculate days since last duty for the first date (start of period)
                    // This shows the initial value before any assignments in this form
                    const firstDate = dates.length > 0 ? dates[0] : new Date();
                    const daysSinceLastDuty = getDaysSinceLastDutyForDate(soldier, firstDate);
                    
                    return (
                      <tr key={soldier.id}>
                        <td className="grade-cell">{soldier.rank || '-'}</td>
                        <td className="name-cell">
                          {soldier.last_name}, {soldier.first_name}
                          {soldier.middle_initial ? ` ${soldier.middle_initial}.` : ''}
                        </td>
                        <td className="days-cell">
                          <span className={`days-badge ${
                            daysSinceLastDuty < 7 ? 'low' : 
                            daysSinceLastDuty < 14 ? 'medium' : 'high'
                          }`} title={`Days since last duty at start of period`}>
                            {daysSinceLastDuty}
                          </span>
                        </td>
                        {dates.map((date, idx) => {
                        const dateStr = date.toISOString().split('T')[0];
                        const assignment = getAssignmentForSoldierDate(soldier.id, dateStr);
                        const isWeekendDay = isWeekend(date);
                        const isHolidayDay = isHoliday(date);
                        const cellClassName = isHolidayDay ? 'weekend-cell' : isWeekendDay ? 'weekend-cell' : '';
                        
                        // Calculate days since last duty for this specific date
                        const daysSinceLastDutyForDate = getDaysSinceLastDutyForDate(soldier, date);
                        
                        let cellContent = '';
                        let cellClass = cellClassName;
                        
                        if (assignment) {
                          // CRITICAL: Only show checkmark (✓) for duties from THIS form
                          // Duties from other forms should show their exception code (like "CQ", "D", etc.)
                          if (assignment.duty && assignment.isFromThisForm) {
                            // This is a duty assignment from the current form - show checkmark
                            cellContent = '✓';
                            cellClass += ' duty-cell';
                          } else if (assignment.exception_code) {
                            // This is an exception code - could be a pass, leave, or duty from another form
                            // For duties from other forms (exception_code 'D' but not from this form), show the code
                            if (assignment.exception_code === 'D' && !assignment.isFromThisForm) {
                              // Duty from another form - show "D" as exception code
                              cellContent = 'D';
                              cellClass += ' exception-cell other-appointment';
                            } else {
                              // Display the exception code (P for Pass, L for Leave, etc.)
                              // Use the exception code as-is (it may already be an abbreviation like "CQ")
                              cellContent = assignment.exception_code;
                              cellClass += ' exception-cell';
                              // Add specific class for pass exception codes
                              if (assignment.exception_code === 'P') {
                                // Green for passes from this form, yellow for other appointments/passes
                                if (assignment.isFromThisForm) {
                                  cellClass += ' pass-cell pass-from-this-form';
                                } else {
                                  cellClass += ' pass-cell pass-other-appointment';
                                }
                                // Ensure 'P' is displayed for passes
                                cellContent = 'P';
                              } else {
                                // Yellow for other appointments (not from this form)
                                if (assignment.isAppointment && !assignment.isFromThisForm) {
                                  cellClass += ' other-appointment';
                                }
                              }
                            }
                          }
                        }
                        
                        // Get tooltip text with duty/appointment details
                        let tooltipText = '';
                        if (assignment) {
                          const dutyName = form?.form_data?.duty_config?.nature_of_duty || 'Duty';
                          
                          // CRITICAL: If this is from an appointment, ALWAYS use the appointment's reason
                          // This ensures appointments show their actual reason (e.g., "Leave" not "BN Staff Duty")
                          if (assignment.isAppointment && assignment.reason) {
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
                            
                            if (assignment.exception_code && assignment.exception_code !== 'A') {
                              const exceptionName = getExceptionCodeName(assignment.exception_code);
                              tooltipText += ` - ${exceptionName}`;
                            }
                            // Add notes if available for additional context
                            if (assignment.notes && !assignment.notes.includes('DA6_FORM')) {
                              tooltipText += ` - ${assignment.notes}`;
                            }
                          } else if (assignment.duty && assignment.isFromThisForm) {
                            // This is a duty assignment from the current form
                            tooltipText = `${dutyName} - Duty Assignment`;
                          } else if (assignment.exception_code) {
                            const exceptionName = getExceptionCodeName(assignment.exception_code);
                            
                            // This is a form assignment (not an appointment)
                            // Check if this is a cross-roster duty (exception code is an abbreviation)
                            // Cross-roster duties have codes like "COQ", "SD", etc. that aren't standard exception codes
                            const standardCodes = ['A', 'U', 'S', 'D', 'L', 'T', 'TDY', 'P', 'EX', 'R', 'H', 'CQ', 'COQ', 'SD', 'CD', 'DO', 'OD', 'NCOOD'];
                            if (!standardCodes.includes(assignment.exception_code) && assignment.exception_code.length <= 4) {
                              // This is likely a cross-roster duty abbreviation
                              // Try to find which duty it refers to by checking other forms
                              let crossRosterDutyName = assignment.exception_code;
                              if (otherForms && otherForms.length > 0) {
                                // Look for a form with a duty name that matches this abbreviation
                                for (const otherForm of otherForms) {
                                  const otherDutyName = otherForm.form_data?.duty_config?.nature_of_duty || '';
                                  // Simple check: if the abbreviation could match the duty name
                                  if (otherDutyName && otherDutyName.toUpperCase().includes(assignment.exception_code)) {
                                    crossRosterDutyName = otherDutyName;
                                    break;
                                  }
                                }
                              }
                              tooltipText = `${crossRosterDutyName} - Cross-roster duty conflict (${assignment.exception_code})`;
                            } else if (assignment.exception_code === 'P') {
                              tooltipText = `${dutyName} - Pass (Days off after duty)`;
                            } else if (assignment.exception_code === 'D' && !assignment.isFromThisForm) {
                              // Duty from another form - try to find the duty name from the appointment
                              tooltipText = `${exceptionName} - Duty from another form`;
                            } else {
                              tooltipText = `${dutyName} - ${exceptionName}`;
                            }
                          }
                        }
                        
                        return (
                          <td key={idx} className={`assignment-cell ${cellClass}`} title={tooltipText || undefined}>
                            <div className="cell-content-wrapper">
                              <div className="cell-main-content">{cellContent}</div>
                              <div className="cell-days-indicator">{daysSinceLastDutyForDate}</div>
                            </div>
                          </td>
                        );
                      })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="compact-list-container">
            <table className="compact-list-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Day</th>
                  <th>Soldiers Assigned</th>
                </tr>
              </thead>
              <tbody>
                {dates.map((date, idx) => {
                  const dateStr = date.toISOString().split('T')[0];
                  const assignments = dutyAssignmentsByDate[dateStr] || [];
                  const assignedSoldiers = assignments
                    .map(a => {
                      const soldier = soldiers.find(s => s.id === a.soldier_id);
                      return soldier ? `${soldier.rank} ${soldier.last_name}` : null;
                    })
                    .filter(Boolean)
                    .join(', ');
                  
                  const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                  const isWeekendDay = isWeekend(date);
                  const isHolidayDay = isHoliday(date);
                  
                  return (
                    <tr key={idx}>
                      <td className="compact-date">
                        {date.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </td>
                      <td>
                        {dayName}
                        {isHolidayDay && ' (Holiday)'}
                        {!isHolidayDay && isWeekendDay && ' (Weekend)'}
                      </td>
                      <td className="compact-soldiers">
                        {assignedSoldiers || <em>No assignments</em>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="form-footer" style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '2px solid #eee' }}>
        <button 
          className="btn-primary"
            onClick={() => window.print()}
          >
            Print
          </button>
          <button
            className="btn-secondary"
          onClick={() => navigate('/forms')}
        >
          Back to Forms List
        </button>
        </div>
      </div>
    </Layout>
  );
};

export default DA6FormView;
