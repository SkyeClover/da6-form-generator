import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../utils/api';
import { sortSoldiersByRank, isNCORank, rankMatchesRequirement } from '../utils/rankOrder';
import { getFederalHolidaysInRange } from '../utils/federalHolidays';
import { getFormStatus, formatFormStatus } from '../utils/formStatus';
import { getExceptionCodeName } from '../utils/exceptionCodes';
import { calculateDaysSinceLastDuty } from '../utils/daysSinceDuty';
import { getCrossRosterExceptionCode } from '../utils/rosterGenerator';
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  
  // Refresh appointments when form data changes (in case appointments were deleted/updated)
  // Also refresh when form is loaded to ensure we have the latest data
  useEffect(() => {
    if (form && form.id && !loading) {
      console.log('[APPOINTMENTS] Scheduling appointment fetch in 500ms...');
      // Reduced delay to catch issues faster
      const timeoutId = setTimeout(() => {
        console.log('[APPOINTMENTS] Fetching appointments after delay...');
        fetchAllAppointments();
      }, 500);
      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.id, form?.updated_at]);

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
      
      // Deduplicate appointments by ID (in case of any duplicates from API)
      const uniqueAppointments = Array.from(
        new Map(allAppointments.map(apt => [apt.id, apt])).values()
      );
      
      // Debug: Log appointment count to help diagnose ghost appointments
      if (form && form.id) {
        const appointmentsFromThisForm = uniqueAppointments.filter(apt => apt.form_id === form.id);
        const appointmentsNotFromThisForm = uniqueAppointments.filter(apt => !apt.form_id || apt.form_id !== form.id);
        
        // Check for potential ghost appointments (U appointments with 1 day difference)
        const potentialGhostAppointments = uniqueAppointments.filter(apt => {
          if (apt.exception_code !== 'U') return false;
          const startStr = typeof apt.start_date === 'string' ? apt.start_date.split('T')[0] : formatDateLocal(apt.start_date);
          const endStr = typeof apt.end_date === 'string' ? apt.end_date.split('T')[0] : formatDateLocal(apt.end_date);
          if (startStr === endStr) return false;
          const startDate = new Date(startStr + 'T00:00:00');
          const endDate = new Date(endStr + 'T00:00:00');
          const daysDiff = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
          return daysDiff === 1;
        });
        
        if (potentialGhostAppointments.length > 0) {
          console.log(`[APPOINTMENTS] Found ${potentialGhostAppointments.length} potential ghost appointments (U with 1-day diff):`, 
            potentialGhostAppointments.map(apt => ({
              id: apt.id,
              soldier_id: apt.soldier_id,
              start: apt.start_date,
              end: apt.end_date,
              reason: apt.reason
            }))
          );
        }
        
        console.log(`[APPOINTMENTS] Total: ${uniqueAppointments.length}, From this form: ${appointmentsFromThisForm.length}, Not from this form: ${appointmentsNotFromThisForm.length}`);
      }
      
      setAppointments(uniqueAppointments);
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
    const dateStr = formatDateLocal(date);
    
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
    
    // Check appointments for duty on this date (exclude appointments from current form)
    const dutyExceptionCodes = ['CQ', 'SD', 'D'];
    const appointmentOnThisDate = appointments.find(apt => {
      if (apt.soldier_id !== soldier.id) return false;
      if (!dutyExceptionCodes.includes(apt.exception_code)) return false;
      // CRITICAL: Exclude appointments from the current form - they're already in form assignments
      if (form && apt.form_id === form.id) return false;
      
      // Parse appointment dates as local dates to avoid timezone issues
      let aptStart, aptEnd;
      const aptStartStr = typeof apt.start_date === 'string' 
        ? apt.start_date.split('T')[0]
        : formatDateLocal(apt.start_date);
      const aptEndStr = typeof apt.end_date === 'string'
        ? apt.end_date.split('T')[0]
        : formatDateLocal(apt.end_date);
      
      if (aptStartStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = aptStartStr.split('-').map(Number);
        aptStart = new Date(year, month - 1, day, 0, 0, 0, 0);
      } else {
        aptStart = new Date(apt.start_date);
        aptStart.setHours(0, 0, 0, 0);
      }
      
      if (aptEndStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = aptEndStr.split('-').map(Number);
        aptEnd = new Date(year, month - 1, day, 0, 0, 0, 0);
      } else {
        aptEnd = new Date(apt.end_date);
        aptEnd.setHours(0, 0, 0, 0);
      }
      
      // Use string comparison for exact date matching
      const checkDateStr = formatDateLocal(checkDate);
      const aptStartStrFormatted = formatDateLocal(aptStart);
      const aptEndStrFormatted = formatDateLocal(aptEnd);
      
      return checkDateStr >= aptStartStrFormatted && checkDateStr <= aptEndStrFormatted;
    });
    if (appointmentOnThisDate) {
      return 0; // Soldier has duty appointment today
    }
    
    // Find the most recent duty date before or on this date
    let lastDutyDate = null;
    
    // Check appointments for duty assignments (exclude appointments from current form)
    appointments.forEach(apt => {
      if (dutyExceptionCodes.includes(apt.exception_code) && apt.soldier_id === soldier.id) {
        // CRITICAL: Exclude appointments from the current form - they're already in form assignments
        if (form && apt.form_id === form.id) return;
        
        // Parse appointment start date as local date to avoid timezone issues
        let aptStart;
        const aptStartStr = typeof apt.start_date === 'string' 
          ? apt.start_date.split('T')[0]
          : formatDateLocal(apt.start_date);
        
        if (aptStartStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const [year, month, day] = aptStartStr.split('-').map(Number);
          aptStart = new Date(year, month - 1, day, 0, 0, 0, 0);
        } else {
          aptStart = new Date(apt.start_date);
          aptStart.setHours(0, 0, 0, 0);
        }
        
        // Use string comparison for exact date matching
        const aptStartStrFormatted = formatDateLocal(aptStart);
        const checkDateStrFormatted = formatDateLocal(checkDate);
        
        if (aptStartStrFormatted <= checkDateStrFormatted && (!lastDutyDate || aptStart > lastDutyDate)) {
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
          // Parse assignment date as local date to avoid timezone issues
          let dutyDate;
          if (typeof assignment.date === 'string' && assignment.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const [year, month, day] = assignment.date.split('-').map(Number);
            dutyDate = new Date(year, month - 1, day, 0, 0, 0, 0);
          } else {
            dutyDate = new Date(assignment.date);
            dutyDate.setHours(0, 0, 0, 0);
          }
          
          // Use string comparison for exact date matching
          const dutyDateStr = formatDateLocal(dutyDate);
          const checkDateStrFormatted = formatDateLocal(checkDate);
          
          // Only consider duties on or before the check date (not future duties)
          if (dutyDateStr <= checkDateStrFormatted && (!lastDutyDate || dutyDate > lastDutyDate)) {
            lastDutyDate = dutyDate;
          }
        }
      });
    });
    
    // Check current form assignments up to and including this date
    // CRITICAL: Only include duties that are ON OR BEFORE the check date, not future duties
    if (form && form.form_data && form.form_data.assignments) {
      form.form_data.assignments.forEach(assignment => {
        if (assignment.soldier_id === soldier.id && assignment.duty && !assignment.exception_code) {
          // Parse assignment date as local date to avoid timezone issues
          let assignmentDate;
          if (typeof assignment.date === 'string' && assignment.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const [year, month, day] = assignment.date.split('-').map(Number);
            assignmentDate = new Date(year, month - 1, day, 0, 0, 0, 0);
          } else {
            assignmentDate = new Date(assignment.date);
            assignmentDate.setHours(0, 0, 0, 0);
          }
          
          // CRITICAL: Only include duties that are strictly BEFORE or ON the check date
          // Use string comparison to ensure exact date matching
          const assignmentDateStr = formatDateLocal(assignmentDate);
          const checkDateStrFormatted = formatDateLocal(checkDate);
          
          if (assignmentDateStr <= checkDateStrFormatted && (!lastDutyDate || assignmentDate > lastDutyDate)) {
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
    let formStartDate;
    if (form && form.period_start) {
      if (typeof form.period_start === 'string' && form.period_start.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = form.period_start.split('-').map(Number);
        formStartDate = new Date(year, month - 1, day, 0, 0, 0, 0);
      } else {
        formStartDate = new Date(form.period_start);
        formStartDate.setHours(0, 0, 0, 0);
      }
    } else {
      formStartDate = new Date(checkDate);
      formStartDate.setHours(0, 0, 0, 0);
    }
    
    // Calculate initial days at the start of the form period
    // CRITICAL: Exclude appointments from the current form when calculating initial days
    // These appointments are already represented in form assignments
    const appointmentsExcludingCurrent = appointments.filter(apt => !form || apt.form_id !== form.id);
    const calculatedInitialDays = calculateDaysSinceLastDuty(soldier, otherForms, appointmentsExcludingCurrent, formStartDate);
    // Use the calculated value if it's more accurate, otherwise use the soldier's stored value
    const initialDays = calculatedInitialDays > 0 ? calculatedInitialDays : soldierDaysSinceLastDuty;
    
    // Calculate how many days have passed since form start
    const daysPassed = Math.floor((checkDate - formStartDate) / (1000 * 60 * 60 * 24));
    
    // Count how many days the soldier had duty or passes in this form (these don't count toward incrementing)
    let nonCountingDays = 0;
    if (form && form.form_data && form.form_data.assignments) {
      for (let i = 0; i <= daysPassed; i++) {
        const checkDateInRange = new Date(formStartDate);
        checkDateInRange.setDate(checkDateInRange.getDate() + i);
        const checkDateStr = formatDateLocal(checkDateInRange);
        
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

  // Helper function to format date as YYYY-MM-DD in local timezone (not UTC)
  const formatDateLocal = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isHoliday = (date) => {
    const dateStr = formatDateLocal(date);
    return holidays.some(h => {
      const holidayDate = typeof h === 'string' ? h : h.date;
      return holidayDate === dateStr;
    });
  };

  const getDatesInRange = () => {
    if (!form || !form.period_start || !form.period_end) return [];
    
    // Parse dates properly to avoid timezone issues
    // If it's a string in YYYY-MM-DD format, parse it as local date
    let start, end;
    
    if (typeof form.period_start === 'string' && form.period_start.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Parse YYYY-MM-DD string as local date (not UTC)
      const [year, month, day] = form.period_start.split('-').map(Number);
      start = new Date(year, month - 1, day, 0, 0, 0, 0);
    } else {
      start = new Date(form.period_start);
      start.setHours(0, 0, 0, 0);
    }
    
    if (typeof form.period_end === 'string' && form.period_end.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Parse YYYY-MM-DD string as local date (not UTC)
      const [year, month, day] = form.period_end.split('-').map(Number);
      end = new Date(year, month - 1, day, 0, 0, 0, 0);
    } else {
      end = new Date(form.period_end);
      end.setHours(0, 0, 0, 0);
    }
    
    const dates = [];
    const current = new Date(start);
    
    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  };


  const getAssignmentForSoldierDate = (soldierId, dateStr) => {
    // First check form assignments (these take priority)
    // Prioritize duty assignments over exceptions, but passes should still be visible
    if (form && form.form_data && form.form_data.assignments) {
      // Debug: Check if there's a 'U' assignment in form assignments (this shouldn't happen)
      const formUAssignment = form.form_data.assignments.find(
        a => a.soldier_id === soldierId && a.date === dateStr && a.exception_code === 'U'
      );
      if (formUAssignment) {
        console.warn(`[FORM ASSIGNMENT U] Found 'U' assignment in form assignments for soldier ${soldierId} on ${dateStr}:`, formUAssignment);
      }
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
            // Debug logging removed - pass assignments are handled as form assignments
          }
          return { ...formAssignment, isFromThisForm: true };
        }
      }
    }
    
    // Then check appointments (for passes and other exceptions not in form assignments)
    // Only check if we don't already have a form assignment for this date
    // CRITICAL: Also check if this appointment is already represented in form assignments
    // to prevent showing duplicates
    // Filter to find all matching appointments, then pick the most specific one
    const matchingAppointments = appointments.filter(apt => {
      if (apt.soldier_id !== soldierId) return false;
      
      // CRITICAL: Filter out ALL appointments from the current form FIRST
      // These are auto-generated and should ONLY show as form assignments, never as separate appointments
      // The only exception is if the appointment is NOT auto-generated (no DA6_FORM in notes)
      // and is NOT a pass or duty (which are always auto-generated)
      if (form && apt.form_id === form.id) {
        // Always filter out passes and duties from current form (these are always auto-generated)
        if (apt.exception_code === 'P' || apt.exception_code === 'D') {
          return false;
        }
        // Filter out any appointment with DA6_FORM in notes (auto-generated)
        if (apt.notes && apt.notes.includes('DA6_FORM')) {
          return false;
        }
        // CRITICAL: For 'U' appointments from this form, be very strict
        // If it's a 1-day difference appointment, it's likely a ghost/auto-generated one
        // Only allow 'U' appointments from this form if they're explicitly NOT auto-generated
        // and have a valid multi-day range (not 1 day difference)
        if (apt.exception_code === 'U') {
          const aptStartStr = typeof apt.start_date === 'string' ? apt.start_date.split('T')[0] : formatDateLocal(apt.start_date);
          const aptEndStr = typeof apt.end_date === 'string' ? apt.end_date.split('T')[0] : formatDateLocal(apt.end_date);
          if (aptStartStr !== aptEndStr) {
            const startDate = new Date(aptStartStr + 'T00:00:00');
            const endDate = new Date(aptEndStr + 'T00:00:00');
            const daysDiff = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
            // Filter out 1-day difference 'U' appointments from this form (likely ghosts)
            if (daysDiff === 1) {
              console.log(`[FILTER] Filtering out 1-day 'U' appointment from this form for soldier ${soldierId}: ${aptStartStr} to ${aptEndStr}`);
              return false;
            }
          }
        }
      }
      
      // Parse appointment dates properly (handle both string and Date formats)
      // CRITICAL: Always parse as local dates to avoid timezone issues
      let aptStart, aptEnd;
      let aptStartDateStr = typeof apt.start_date === 'string' 
        ? apt.start_date.split('T')[0]  // Extract YYYY-MM-DD from ISO string if present
        : formatDateLocal(apt.start_date);
      let aptEndDateStr = typeof apt.end_date === 'string'
        ? apt.end_date.split('T')[0]  // Extract YYYY-MM-DD from ISO string if present
        : formatDateLocal(apt.end_date);
      
      if (aptStartDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = aptStartDateStr.split('-').map(Number);
        aptStart = new Date(year, month - 1, day, 0, 0, 0, 0);
      } else {
        aptStart = new Date(apt.start_date);
        aptStart.setHours(0, 0, 0, 0);
        aptStartDateStr = formatDateLocal(aptStart);
      }
      
      if (aptEndDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = aptEndDateStr.split('-').map(Number);
        aptEnd = new Date(year, month - 1, day, 0, 0, 0, 0);
      } else {
        aptEnd = new Date(apt.end_date);
        aptEnd.setHours(0, 0, 0, 0);
        aptEndDateStr = formatDateLocal(aptEnd);
      }
      
      // Parse check date properly - dateStr should already be in YYYY-MM-DD format from formatDateLocal
      // Compare as strings to ensure exact date matching and avoid timezone issues
      const checkDateStr = dateStr; // dateStr is already in YYYY-MM-DD format from formatDateLocal
      
      // CRITICAL: For single-day appointments, only match on the start date
      // If start_date and end_date are the same, only match on that exact date
      // This prevents appointments from showing on multiple days when they should be single-day
      if (aptStartDateStr === aptEndDateStr) {
        // Single-day appointment - only match exact date
        return checkDateStr === aptStartDateStr;
      }
      
      // For multi-day appointments, check if the date is within the range
      // BUT: If the appointment is a single-day type (like medical appointments with 'U' exception),
      // and the dates are only 1 day apart, treat it as single-day to prevent ghost appointments
      const isInRange = checkDateStr >= aptStartDateStr && checkDateStr <= aptEndDateStr;
      
      // CRITICAL: For 'U' (Unavailable) appointments, be extra strict about single-day matching
      // Many medical/dental appointments are single-day but might have end_date = start_date + 1 day
      // This applies to ALL 'U' appointments, regardless of form_id
      if (isInRange && apt.exception_code === 'U') {
        // Calculate days difference using string comparison to avoid timezone issues
        const startDate = new Date(aptStartDateStr + 'T00:00:00');
        const endDate = new Date(aptEndDateStr + 'T00:00:00');
        const daysDiff = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
        
        // CRITICAL FIX: If it's only 1 day difference, treat it as single-day for 'U' appointments
        // BUT: Only do this for medical appointments (which are typically single-day)
        // This prevents ghost appointments from showing on the day after
        // The database often stores single-day appointments with end_date = start_date + 1 day
        // For legitimate multi-day 'U' appointments (like extended medical leave), allow them to show on all days
        if (daysDiff === 1) {
          // Check if this is a medical appointment (typically single-day)
          const reason = (apt.reason || '').toLowerCase();
          const isMedicalAppointment = reason.includes('medical') || reason.includes('dental') || 
                                      reason.includes('appointment') || reason.includes('exam') ||
                                      reason.includes('checkup') || reason.includes('visit') ||
                                      reason.includes('physical') || reason.includes('follow-up');
          
          // Only treat as single-day if it's a medical appointment
          // Legitimate multi-day 'U' appointments (like extended medical leave) will show on all days
          if (isMedicalAppointment) {
            const shouldMatch = checkDateStr === aptStartDateStr;
            
            // Debug log to help identify when this filter is applied
            if (!shouldMatch && checkDateStr === aptEndDateStr) {
              console.log(`[GHOST APPT FILTER] Filtering out ghost medical appointment for soldier ${soldierId} on ${checkDateStr} (appointment is ${aptStartDateStr} to ${aptEndDateStr}, reason: ${apt.reason || 'N/A'}, form_id: ${apt.form_id || 'null'}, id: ${apt.id})`);
            }
            
            return shouldMatch;
          }
          // For non-medical 'U' appointments with 1-day difference, allow them to show on both days
          // (in case they're legitimate 2-day appointments)
        }
      }
      
      // Debug: Log all 'U' appointments being checked to help diagnose ghost appointments
      if (apt.exception_code === 'U' && isInRange) {
        const daysDiffCalc = aptStartDateStr !== aptEndDateStr 
          ? Math.floor((new Date(aptEndDateStr + 'T00:00:00') - new Date(aptStartDateStr + 'T00:00:00')) / (1000 * 60 * 60 * 24))
          : 0;
        const willMatch = isInRange && !(daysDiffCalc === 1 && checkDateStr === aptEndDateStr);
        console.log(`[APPT CHECK] U appointment for soldier ${soldierId}: checkDate=${checkDateStr}, start=${aptStartDateStr}, end=${aptEndDateStr}, daysDiff=${daysDiffCalc}, form_id=${apt.form_id || 'null'}, willMatch=${willMatch}, reason=${apt.reason || 'N/A'}`);
        
        // If this is a ghost appointment (1 day diff, checking end date), log it prominently
        if (daysDiffCalc === 1 && checkDateStr === aptEndDateStr) {
          console.error(`[GHOST APPT DETECTED] Ghost appointment detected for soldier ${soldierId} on ${checkDateStr}! Appointment: ${aptStartDateStr} to ${aptEndDateStr}, reason: ${apt.reason || 'N/A'}, form_id: ${apt.form_id || 'null'}, id: ${apt.id}`);
        }
      }
      
      return isInRange;
    });
    
    // If multiple appointments match, prefer the most specific one (shortest date range)
    // or the one that's not from this form (to avoid duplicates)
    let appointment = null;
    if (matchingAppointments.length > 0) {
      // Sort by date range length (shortest first), then by whether it's from this form (non-form appointments first)
      matchingAppointments.sort((a, b) => {
        const aStart = new Date(a.start_date);
        const aEnd = new Date(a.end_date);
        const bStart = new Date(b.start_date);
        const bEnd = new Date(b.end_date);
        const aRange = aEnd - aStart;
        const bRange = bEnd - bStart;
        
        // Prefer shorter date ranges (more specific appointments)
        if (aRange !== bRange) {
          return aRange - bRange;
        }
        
        // If ranges are equal, prefer appointments not from this form (to avoid duplicates with form assignments)
        const aFromThisForm = a.form_id === form?.id;
        const bFromThisForm = b.form_id === form?.id;
        if (aFromThisForm !== bFromThisForm) {
          return aFromThisForm ? 1 : -1;
        }
        
        return 0;
      });
      
      appointment = matchingAppointments[0];
      
      // FINAL CHECK: If we selected an appointment, verify it's not a ghost appointment
      // This is a safety check in case the filter didn't catch it
      if (appointment && appointment.exception_code === 'U') {
        const aptStartStr = typeof appointment.start_date === 'string' ? appointment.start_date.split('T')[0] : formatDateLocal(appointment.start_date);
        const aptEndStr = typeof appointment.end_date === 'string' ? appointment.end_date.split('T')[0] : formatDateLocal(appointment.end_date);
        if (aptStartStr !== aptEndStr) {
          const startDate = new Date(aptStartStr + 'T00:00:00');
          const endDate = new Date(aptEndStr + 'T00:00:00');
          const daysDiff = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
          
          // If it's a 1-day difference 'U' appointment and we're checking the end date, reject it
          if (daysDiff === 1 && dateStr === aptEndStr) {
            console.error(`[GHOST APPT REJECTED] Rejecting ghost appointment for soldier ${soldierId} on ${dateStr}. Appointment should only show on ${aptStartStr}. Appointment details:`, {
              id: appointment.id,
              form_id: appointment.form_id,
              reason: appointment.reason,
              start: aptStartStr,
              end: aptEndStr
            });
            appointment = null; // Reject this appointment - it's a ghost
            return null; // Return null immediately to prevent rendering
          }
        }
      }
    }
    
    if (appointment) {
      // Check if this appointment is from this form (has form_id matching current form)
      const isFromThisForm = appointment.form_id === form?.id;
      
      // ULTRA-SAFE CHECK: For 'U' appointments, verify the date matches before returning
      // This prevents ghost appointments from appearing on wrong dates
      if (appointment.exception_code === 'U' && appointment.isAppointment) {
        const aptStartStr = typeof appointment.start_date === 'string' ? appointment.start_date.split('T')[0] : formatDateLocal(appointment.start_date);
        const aptEndStr = typeof appointment.end_date === 'string' ? appointment.end_date.split('T')[0] : formatDateLocal(appointment.end_date);
        
        // For single-day appointments (same start and end), only show on that exact date
        if (aptStartStr === aptEndStr) {
          if (dateStr !== aptStartStr) {
            console.error(`[ULTRA-SAFE CHECK] Rejecting ghost appointment for soldier ${soldierId} on ${dateStr}. Single-day appointment should only show on ${aptStartStr}.`, appointment);
            return null; // Reject - this is a ghost appointment
          }
        } else {
          // For multi-day appointments, check if we're checking the end date of a 1-day difference appointment
          const startDate = new Date(aptStartStr + 'T00:00:00');
          const endDate = new Date(aptEndStr + 'T00:00:00');
          const daysDiff = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
          
          // If it's a 1-day difference and we're checking the end date, reject it
          if (daysDiff === 1 && dateStr === aptEndStr) {
            console.error(`[ULTRA-SAFE CHECK] Rejecting ghost appointment for soldier ${soldierId} on ${dateStr} (end date). Should only show on ${aptStartStr}.`, appointment);
            return null; // Reject immediately
          }
        }
      }
      
      // CRITICAL: Filter out appointments that are already represented in form assignments
      // This prevents showing duplicates when appointments load after the initial render
      // FIRST: If appointment is from this form and is a pass or duty, ALWAYS filter it out
      // (This is the most important check - these are auto-generated and should only show as form assignments)
      if (isFromThisForm && (appointment.exception_code === 'P' || appointment.exception_code === 'D')) {
        return null;
      }
      
      // SECOND: Check if there's a form assignment on this date that matches
      if (form && form.form_data && form.form_data.assignments) {
        // Check if there's any form assignment on this date for this soldier
        const formAssignmentOnDate = form.form_data.assignments.find(
          a => a.soldier_id === soldierId && a.date === dateStr
        );
        
        if (formAssignmentOnDate) {
          // There's already a form assignment on this date
          // Don't show the appointment if:
          // 1. The appointment is from this form (auto-generated), OR
          // 2. The form assignment has the same exception code as the appointment, OR
          // 3. The form assignment is a duty and the appointment is a duty (exception_code 'D')
          if (isFromThisForm || 
              (formAssignmentOnDate.exception_code && 
               formAssignmentOnDate.exception_code === appointment.exception_code) ||
              (formAssignmentOnDate.duty && appointment.exception_code === 'D')) {
            // This appointment is already represented in form assignments, don't show it again
            return null;
          }
        }
        
        // CRITICAL GHOST APPOINTMENT FIX: Check if there's a 'U' form assignment on the previous day
        // If there is, and this appointment is also 'U' with start_date matching today,
        // it's likely a ghost appointment that was created incorrectly (date off by 1 day)
        // Example: Form assignment 'U' on Dec 15, appointment 'U' on Dec 16 (ghost - wrong date in DB)
        if (appointment.exception_code === 'U' && !isFromThisForm && appointment.isAppointment) {
          // Calculate previous day
          const checkDate = new Date(dateStr + 'T00:00:00');
          checkDate.setDate(checkDate.getDate() - 1);
          const previousDayStr = formatDateLocal(checkDate);
          
          const formAssignmentPreviousDay = form.form_data.assignments.find(
            a => a.soldier_id === soldierId && a.date === previousDayStr && a.exception_code === 'U'
          );
          
          if (formAssignmentPreviousDay) {
            // There's a 'U' form assignment on the previous day
            // If this appointment's start_date matches today's date, it's likely a ghost
            // This happens when appointments are created with wrong dates (off by 1 day)
            const aptStartStr = typeof appointment.start_date === 'string' ? appointment.start_date.split('T')[0] : formatDateLocal(appointment.start_date);
            const aptEndStr = typeof appointment.end_date === 'string' ? appointment.end_date.split('T')[0] : formatDateLocal(appointment.end_date);
            
            // Check if this is a single-day appointment on today, but form assignment is yesterday
            // This indicates the appointment date in DB is wrong (should be yesterday)
            if (aptStartStr === dateStr && aptEndStr === dateStr) {
              // Single-day appointment on today, but there's a form assignment 'U' yesterday
              // This is definitely a ghost appointment - the DB has wrong date
              console.error(`[GHOST APPT FIX] Rejecting ghost appointment for soldier ${soldierId} on ${dateStr}. Form assignment 'U' exists on ${previousDayStr}, appointment 'U' on ${dateStr} has wrong date in DB (should be ${previousDayStr}).`, {
                appointment_id: appointment.id,
                appointment_start: aptStartStr,
                appointment_end: aptEndStr,
                form_assignment_date: previousDayStr,
                reason: appointment.reason
              });
              return null;
            }
          }
        }
      }
      
      // THIRD: Additional safety check - filter out any appointment from this form
      // This catches any edge cases where appointments might have been created but shouldn't be shown
      if (isFromThisForm) {
        // Only allow appointments from this form if they're NOT passes or duties
        // and they're NOT auto-generated (don't have DA6_FORM in notes)
        if (appointment.exception_code === 'P' || appointment.exception_code === 'D') {
          return null;
        }
        if (appointment.notes && appointment.notes.includes('DA6_FORM')) {
          return null;
        }
      }
      
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
    
    // Finally, check for cross-roster duties (duties from other forms)
    // These should be displayed as exception codes to show why days since last duty reset to 0
    // BUT: Only show if there's no form assignment or appointment on this date
    // Form assignments (like passes) take priority over cross-roster duties
    if (otherForms && otherForms.length > 0) {
      const checkDate = new Date(dateStr);
      checkDate.setHours(0, 0, 0, 0);
      const currentDutyName = form?.form_data?.duty_config?.nature_of_duty || '';
      
      for (const otherForm of otherForms) {
        if (!otherForm.form_data) continue;
        
        const dutyName = otherForm.form_data.duty_config?.nature_of_duty || 'Duty';
        if (dutyName === currentDutyName) continue; // Skip same duty
        
        // Check stored assignments for cross-roster duties
        const assignments = otherForm.form_data.assignments || [];
        for (const assignment of assignments) {
          if (assignment.soldier_id === soldierId && assignment.date === dateStr && assignment.duty === true) {
            // Soldier has duty from another form on this date - return as exception code
            // Use the helper function to generate the exception code from duty name
            const exceptionCode = getCrossRosterExceptionCode(dutyName);
            
            return {
              soldier_id: soldierId,
              date: dateStr,
              exception_code: exceptionCode || 'D',
              duty: false, // Not a duty in this form, but a cross-roster exception
              reason: `Duty: ${dutyName}`,
              notes: `Cross-roster duty from ${otherForm.name || 'another form'}`,
              isAppointment: false,
              isFromThisForm: false,
              isCrossRosterDuty: true,
              crossRosterDutyName: dutyName
            };
          }
        }
        
        // Also check appointments for duty assignments from this other form
        for (const apt of appointments) {
          if (apt.soldier_id !== soldierId) continue;
          if (apt.exception_code !== 'D') continue; // Only check duty appointments
          
          // Check if this appointment is linked to the other form
          const aptFormId = apt.form_id || (apt.notes && apt.notes.match(/DA6_FORM:([a-f0-9-]+)/)?.[1]);
          if (aptFormId !== otherForm.id) continue;
          
          const aptStart = new Date(apt.start_date);
          const aptEnd = new Date(apt.end_date);
          aptStart.setHours(0, 0, 0, 0);
          aptEnd.setHours(0, 0, 0, 0);
          
          if (checkDate >= aptStart && checkDate <= aptEnd) {
            // Soldier has duty appointment from another form on this date
            // Use the helper function to generate the exception code from duty name
            const exceptionCode = getCrossRosterExceptionCode(dutyName);
            
            return {
              soldier_id: soldierId,
              date: dateStr,
              exception_code: exceptionCode || 'D',
              duty: false,
              reason: `Duty: ${dutyName}`,
              notes: `Cross-roster duty from ${otherForm.name || 'another form'}`,
              isAppointment: true,
              isFromThisForm: false,
              isCrossRosterDuty: true,
              crossRosterDutyName: dutyName
            };
          }
        }
      }
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
      // 1. Match at least one requirement (even if they have assignments)
      // 2. Soldiers with assignments must still match rank requirements to be shown
      if (requirements.length > 0) {
        eligibleSoldiers = eligibleSoldiers.filter(soldier => {
          // Check if they match any requirement
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
                    // Calculate days since last duty at the START of the period (before any assignments in this form)
                    // Use the day BEFORE the period starts to get the true initial value
                    // CRITICAL: Exclude appointments and forms from the current form to get the true initial value
                    let initialDaysSinceLastDuty;
                    if (dates.length > 0 && form && form.period_start) {
                      // Calculate for the day before the period starts
                      const periodStartDate = dates[0];
                      const dayBeforePeriod = new Date(periodStartDate);
                      dayBeforePeriod.setDate(dayBeforePeriod.getDate() - 1);
                      
                      // Filter out appointments from the current form
                      const appointmentsExcludingCurrent = appointments.filter(apt => apt.form_id !== form?.id);
                      
                      // Make sure otherForms doesn't include the current form
                      const formsExcludingCurrent = otherForms.filter(f => f.id !== form?.id);
                      
                      // Use calculateDaysSinceLastDuty directly to get the value before this form's assignments
                      initialDaysSinceLastDuty = calculateDaysSinceLastDuty(soldier, formsExcludingCurrent, appointmentsExcludingCurrent, dayBeforePeriod);
                      
                      // If calculation returns 0, check if it's because they actually had duty or if we should use stored value
                      // If the stored value is higher, use that instead (it's more accurate)
                      const storedValue = soldier.days_since_last_duty || 0;
                      if (storedValue > initialDaysSinceLastDuty) {
                        initialDaysSinceLastDuty = storedValue;
                      }
                    } else {
                      // Fallback: use soldier's stored value
                      initialDaysSinceLastDuty = soldier.days_since_last_duty || 0;
                    }
                    const daysSinceLastDuty = initialDaysSinceLastDuty;
                    
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
                        const dateStr = formatDateLocal(date);
                        const assignment = getAssignmentForSoldierDate(soldier.id, dateStr);
                        const isWeekendDay = isWeekend(date);
                        const isHolidayDay = isHoliday(date);
                        const cellClassName = isHolidayDay ? 'weekend-cell' : isWeekendDay ? 'weekend-cell' : '';
                        
                        // Calculate days since last duty for this specific date
                        const daysSinceLastDutyForDate = getDaysSinceLastDutyForDate(soldier, date);
                        
                        // Debug: Log when we're rendering a 'U' assignment (this will help identify ghost appointments)
                        if (assignment && assignment.exception_code === 'U') {
                          console.log(`[RENDER U] Rendering U assignment for ${soldier.last_name} on ${dateStr}:`, {
                            isAppointment: assignment.isAppointment,
                            isFromThisForm: assignment.isFromThisForm,
                            form_id: assignment.form_id,
                            start_date: assignment.start_date,
                            end_date: assignment.end_date,
                            reason: assignment.reason,
                            duty: assignment.duty
                          });
                        }
                        
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
                                // Red for cross-roster duties (CQ, COQ, SD, etc.)
                                if (assignment.isCrossRosterDuty) {
                                  cellClass += ' exception-cell cross-roster-duty';
                                } else if (assignment.isAppointment && !assignment.isFromThisForm) {
                                  // Yellow for other appointments (not from this form)
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
                            
                            // Only append exception code name if it's a standard exception code (not a cross-roster duty code)
                            // Cross-roster duty codes (COQ, CQ, SD, etc.) are not the actual reason - they indicate conflicts
                            // Standard exception codes that should be shown: L (Leave), T (Training), TDY, etc.
                            if (assignment.exception_code && assignment.exception_code !== 'A') {
                              const crossRosterDutyCodes = ['COQ', 'CQ', 'SD', 'CD', 'DO', 'OD', 'NCOOD'];
                              const isCrossRosterCode = crossRosterDutyCodes.includes(assignment.exception_code);
                              
                              // Don't append cross-roster duty codes - they're not the actual reason
                              // Only append standard exception codes that provide additional context
                              if (!isCrossRosterCode) {
                                const exceptionName = getExceptionCodeName(assignment.exception_code);
                                // Only append if the exception name doesn't already match the reason (avoid redundancy)
                                if (exceptionName && !assignment.reason.toLowerCase().includes(exceptionName.toLowerCase().split(' ')[0])) {
                                  tooltipText += ` - ${exceptionName}`;
                                }
                              }
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
                            
                            // CRITICAL: Check if this is actually from an appointment but wasn't caught above
                            // This can happen if assignment.isAppointment is not set correctly
                            if (assignment.reason && !assignment.isAppointment) {
                              // This might be an appointment that wasn't properly flagged
                              // Use the reason instead of the duty name
                              tooltipText = assignment.reason;
                              if (assignment.exception_code && assignment.exception_code !== 'A') {
                                const crossRosterDutyCodes = ['COQ', 'CQ', 'SD', 'CD', 'DO', 'OD', 'NCOOD'];
                                const isCrossRosterCode = crossRosterDutyCodes.includes(assignment.exception_code);
                                if (!isCrossRosterCode) {
                                  tooltipText += ` - ${exceptionName}`;
                                }
                              }
                            } else {
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
                              } else if (assignment.isCrossRosterDuty) {
                                // Cross-roster duty - show the duty name and exception code
                                tooltipText = `${assignment.crossRosterDutyName || assignment.reason} - ${assignment.exception_code}`;
                              } else if (assignment.exception_code === 'P') {
                                tooltipText = `${dutyName} - Pass (Days off after duty)`;
                              } else if (assignment.exception_code === 'D' && !assignment.isFromThisForm) {
                                // Duty from another form - try to find the duty name from the appointment
                                tooltipText = `${exceptionName} - Duty from another form`;
                              } else {
                                // For form assignments, use the exception code name
                                // But don't prepend duty name if it's a standard exception code
                                tooltipText = `${exceptionName}`;
                              }
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
                  const dateStr = formatDateLocal(date);
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
