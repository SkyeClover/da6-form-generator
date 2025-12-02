import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../utils/api';
import { EXCEPTION_CODES, getExceptionCodesList } from '../utils/exceptionCodes';
import { sortSoldiersByRank, getRanksInRange, isLowerEnlisted, isNCORank, isWarrantOfficerRank, isOfficerRank, getRankOrder } from '../utils/rankOrder';
import { DUTY_TEMPLATES, getDutyTemplate } from '../utils/dutyTemplates';
import { getFederalHolidaysInRange } from '../utils/federalHolidays';
import Layout from './Layout';
import SoldierProfile from './SoldierProfile';
import Tooltip from './Tooltip';
import LoadingScreen from './LoadingScreen';
import './DA6Form.css';

const DA6Form = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [updatingSoldiers, setUpdatingSoldiers] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [soldiers, setSoldiers] = useState([]);
  const [selectedSoldiers, setSelectedSoldiers] = useState(new Set());
  const [exceptions, setExceptions] = useState({}); // { soldierId: { date: exceptionCode } }
  const [selectedProfileSoldier, setSelectedProfileSoldier] = useState(null);
  const [soldierAppointments, setSoldierAppointments] = useState({}); // { soldierId: [appointments] }
  const [holidays, setHolidays] = useState([]); // Array of holiday dates
  const [otherForms, setOtherForms] = useState([]); // For cross-roster checking
  const [crossRosterCheckEnabled, setCrossRosterCheckEnabled] = useState(true); // Auto-enabled by default
  const [selectedRostersForCheck, setSelectedRostersForCheck] = useState(new Set());
  const [excludedDates, setExcludedDates] = useState(new Set()); // Dates where no one is needed
  const [formData, setFormData] = useState({
    unit_name: '',
    period_start: '',
    period_end: '',
    status: 'draft',
    cancelled_date: null,
    assignments: [],
    duty_config: {
      nature_of_duty: 'CQ',
      soldiers_per_day: 2,
      days_off_after_duty: 1,
      skip_weekends: true,
      separate_weekend_cycle: false,
      separate_holiday_cycle: false,
      rank_requirements: {
        // Array of requirement groups: [{ quantity: 1, group: 'nco', rank_range: 'SGT-SFC', preferred_ranks: ['SSG'], fallback_ranks: ['SGT'] }]
        requirements: [],
        // Exclusions: { ranks: ['PVT'], groups: ['officer'] }
        exclusions: {
          ranks: [],
          groups: []
        }
      }
    }
  });
  const [selectedTemplate, setSelectedTemplate] = useState('CQ');

  useEffect(() => {
    if (id) {
      fetchForm();
    } else {
      fetchSoldiers();
      fetchHolidays();
    }
    fetchOtherForms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  
  // Fetch appointments for selected soldiers when they change
  useEffect(() => {
    if (selectedSoldiers.size > 0 && formData.period_start && formData.period_end) {
      const selectedSoldiersList = Array.from(selectedSoldiers)
        .map(id => soldiers.find(s => s.id === id))
        .filter(Boolean);
      
      // Only fetch appointments for soldiers we don't have yet
      const soldiersToFetch = selectedSoldiersList.filter(
        s => !soldierAppointments[s.id]
      );
      
      if (soldiersToFetch.length > 0) {
        fetchAllAppointments(soldiersToFetch);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSoldiers, formData.period_start, formData.period_end]);
  
  // Fetch appointments when a profile is opened
  useEffect(() => {
    if (selectedProfileSoldier && !soldierAppointments[selectedProfileSoldier.id]) {
      fetchSoldierAppointments(selectedProfileSoldier.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProfileSoldier]);
  
  // Disable auto-recalculation on mount to prevent rate limiting
  // Recalculation will happen when forms are saved/deleted instead
  // useEffect(() => {
  //   // Only recalculate if we have soldiers loaded and there are completed forms
  //   if (soldiers.length > 0) {
  //     const triggerRecalculation = async () => {
  //       try {
  //         const { data: formsData } = await apiClient.get('/da6-forms');
  //         const completedForms = (formsData.forms || []).filter(f => f.status === 'completed');
  //         if (completedForms.length > 0) {
  //           // Recalculate to ensure accuracy after any roster changes
  //           await recalculateAllDaysSinceDuty();
  //         }
  //       } catch (error) {
  //         console.error('Error triggering recalculation on mount:', error);
  //       }
  //     };
  //     
  //     // Use a delay to ensure everything is loaded
  //     const timeoutId = setTimeout(triggerRecalculation, 2000);
  //     return () => clearTimeout(timeoutId);
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [soldiers.length]); // Only run when soldiers are loaded

  useEffect(() => {
    // Fetch holidays when date range changes
    if (formData.period_start && formData.period_end) {
      fetchHolidays();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.period_start, formData.period_end]);

  // Automatically populate exceptions from cross-roster conflicts
  // This runs whenever relevant data changes to ensure exceptions are always up-to-date
  const selectedRostersForCheckKey = Array.from(selectedRostersForCheck).sort().join(',');
  
  useEffect(() => {
    if (
      crossRosterCheckEnabled &&
      selectedRostersForCheck.size > 0 &&
      otherForms.length > 0 &&
      formData.period_start &&
      formData.period_end &&
      selectedSoldiers.size > 0
    ) {
      // Run immediately to populate exceptions before assignments are generated
      // The assignments key includes exceptions, so when exceptions update, assignments will regenerate
      autoPopulateExceptionsFromCrossRoster();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    crossRosterCheckEnabled,
    selectedRostersForCheck.size,
    selectedRostersForCheckKey,
    otherForms.length,
    formData.period_start,
    formData.period_end,
    selectedSoldiers.size
  ]);

  const fetchForm = async () => {
    try {
      const { data } = await apiClient.get(`/da6-forms/${id}`);
      const form = data.form;
      
      // Extract selected soldiers and exceptions
      let selected = new Set();
      let exclusions = {};
      
      // Try new structure first (selected_soldiers and exceptions)
      if (form.form_data?.selected_soldiers) {
        selected = new Set(form.form_data.selected_soldiers);
        exclusions = form.form_data.exceptions || {};
      } else if (form.form_data?.assignments) {
        // Fallback to old structure - extract from assignments
        form.form_data.assignments.forEach(assignment => {
          if (assignment.soldier_id) {
            selected.add(assignment.soldier_id);
            
            // If it's an exception (has exception_code), store it
            if (assignment.exception_code) {
              if (!exclusions[assignment.soldier_id]) {
                exclusions[assignment.soldier_id] = {};
              }
              exclusions[assignment.soldier_id][assignment.date] = assignment.exception_code;
            }
          }
        });
      }
      
      setSelectedSoldiers(selected);
      setExceptions(exclusions);
      
      // Auto-detect status based on current date and period dates
      let formStatus = form.status || 'draft';
      if (formStatus !== 'cancelled' && form.period_start && form.period_end) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const periodStart = new Date(form.period_start);
        periodStart.setHours(0, 0, 0, 0);
        const periodEnd = new Date(form.period_end);
        periodEnd.setHours(0, 0, 0, 0);
        const dayAfterPeriodEnd = new Date(periodEnd);
        dayAfterPeriodEnd.setDate(dayAfterPeriodEnd.getDate() + 1);
        dayAfterPeriodEnd.setHours(0, 0, 0, 0);
        
        // If current date is on or after the day after period_end, set to complete
        if (today >= dayAfterPeriodEnd) {
          formStatus = 'complete';
        }
        // If current date is within the duty period, set to in_progress
        else if (today >= periodStart && today <= periodEnd) {
          formStatus = 'in_progress';
        }
        // Otherwise keep as draft (or existing status if not draft)
      }
      
      setFormData({
        unit_name: form.unit_name || '',
        period_start: form.period_start || '',
        period_end: form.period_end || '',
        status: formStatus,
        cancelled_date: form.cancelled_date || null,
        assignments: form.form_data?.assignments || [],
        duty_config: form.form_data?.duty_config || {
          nature_of_duty: 'CQ',
          soldiers_per_day: 2,
          days_off_after_duty: 1,
          skip_weekends: true,
          separate_weekend_cycle: false,
          separate_holiday_cycle: false,
          rank_requirements: {
            requirements: [],
            exclusions: { ranks: [], groups: [] }
          }
        }
      });
      // Load excluded dates and holidays from form data
      if (form.form_data?.excluded_dates) {
        setExcludedDates(new Set(form.form_data.excluded_dates));
      }
      if (form.form_data?.holidays) {
        setHolidays(form.form_data.holidays);
      }
      // Load cross-roster checking settings, or auto-enable if not set
      if (form.form_data?.cross_roster_check_enabled !== undefined) {
        setCrossRosterCheckEnabled(form.form_data.cross_roster_check_enabled);
      } else {
        // Auto-enable for existing forms that don't have this setting
        setCrossRosterCheckEnabled(true);
      }
      if (form.form_data?.selected_rosters_for_check && form.form_data.selected_rosters_for_check.length > 0) {
        setSelectedRostersForCheck(new Set(form.form_data.selected_rosters_for_check));
      }
      // Note: If no rosters are selected, fetchOtherForms will auto-select all forms
    } catch (error) {
      console.error('Error fetching form:', error);
      alert('Error loading form');
    } finally {
      setLoading(false);
    }
  };

  const fetchSoldiers = async () => {
    try {
      const { data } = await apiClient.get('/soldiers');
      const sortedSoldiers = sortSoldiersByRank(data.soldiers || []);
      setSoldiers(sortedSoldiers);
      // Don't fetch appointments for all soldiers - fetch lazily when needed
      // This prevents rate limiting issues
    } catch (error) {
      console.error('Error fetching soldiers:', error);
      // If it's an auth error, the interceptor will handle it
      if (error.response?.status === 401) {
        return; // Don't continue if unauthorized
      }
    }
  };

  const fetchHolidays = async () => {
    try {
      const { data } = await apiClient.get('/holidays');
      // Convert holidays to format expected by component
      const holidaysList = (data.holidays || []).map(h => ({
        date: h.date,
        name: h.name || 'Holiday'
      }));
      setHolidays(holidaysList);
      
      // Also check for federal holidays if date range is set
      if (formData.period_start && formData.period_end) {
        const federalHolidays = getFederalHolidaysInRange(formData.period_start, formData.period_end);
        // Merge with existing holidays, avoiding duplicates
        const existingDates = new Set(holidaysList.map(h => h.date));
        const newFederalHolidays = federalHolidays.filter(h => !existingDates.has(h.date));
        if (newFederalHolidays.length > 0) {
          setHolidays([...holidaysList, ...newFederalHolidays]);
        }
      }
    } catch (error) {
      console.error('Error fetching holidays:', error);
      // If holidays table doesn't exist yet, just use empty array
      setHolidays([]);
    }
  };

  const fetchOtherForms = async () => {
    try {
      const { data } = await apiClient.get('/da6-forms');
      // Exclude current form if editing
      const otherForms = id 
        ? (data.forms || []).filter(f => f.id !== id)
        : (data.forms || []);
      setOtherForms(otherForms);
      
      // Automatically enable cross-roster checking and select all other forms
      // Only auto-select if no rosters are currently selected (to avoid overriding user choices)
      if (otherForms.length > 0) {
        setCrossRosterCheckEnabled(prev => {
          // Only enable if not already explicitly disabled
          return prev !== false ? true : false;
        });
        
        // Only auto-select all if none are currently selected
        // Only auto-select 'in_progress' and 'complete' forms for conflict checking
        setSelectedRostersForCheck(prev => {
          if (prev.size === 0 && otherForms.length > 0) {
            const activeForms = otherForms.filter(f => 
              f.status === 'in_progress' || f.status === 'complete'
            );
            const newSet = new Set(activeForms.map(f => f.id));
            console.log(`[Auto Cross-Roster] Auto-selected ${newSet.size} active roster(s) for cross-checking`);
            return newSet;
          }
          return prev;
        });
      }
    } catch (error) {
      console.error('Error fetching other forms:', error);
    }
  };

  const fetchAllAppointments = async (soldiersList) => {
    if (!soldiersList || soldiersList.length === 0) return;
    
    const appointmentsMap = { ...soldierAppointments };
    const authErrorRef = { value: false };
    
    // Batch requests with delays to prevent rate limiting
    for (let i = 0; i < soldiersList.length; i++) {
      const soldier = soldiersList[i];
      
      // Skip if we already have appointments for this soldier
      if (appointmentsMap[soldier.id]) continue;
      
      try {
        const { data } = await apiClient.get(`/soldiers/${soldier.id}/appointments`);
        appointmentsMap[soldier.id] = data.appointments || [];
        
        // Add a small delay between requests to prevent rate limiting (every 5 requests)
        if ((i + 1) % 5 === 0 && i < soldiersList.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        // If it's an auth error, stop fetching and let the interceptor handle it
        if (error.response?.status === 401) {
          authErrorRef.value = true;
          break;
        }
        console.error(`Error fetching appointments for ${soldier.id}:`, error);
        appointmentsMap[soldier.id] = [];
      }
    }
    
    // Only update state if we didn't hit an auth error
    if (!authErrorRef.value) {
      setSoldierAppointments(appointmentsMap);
    }
  };
  
  // Fetch appointments for a single soldier (lazy loading)
  const fetchSoldierAppointments = async (soldierId) => {
    // Skip if we already have appointments for this soldier
    if (soldierAppointments[soldierId]) return;
    
    try {
      const { data } = await apiClient.get(`/soldiers/${soldierId}/appointments`);
      setSoldierAppointments(prev => ({
        ...prev,
        [soldierId]: data.appointments || []
      }));
    } catch (error) {
      // If it's an auth error, the interceptor will handle it
      if (error.response?.status === 401) {
        return;
      }
      console.error(`Error fetching appointments for ${soldierId}:`, error);
      setSoldierAppointments(prev => ({
        ...prev,
        [soldierId]: []
      }));
    }
  };

  const getAppointmentsForSoldier = (soldierId) => {
    return soldierAppointments[soldierId] || [];
  };

  const isSoldierUnavailableOnDate = (soldierId, date) => {
    const appointments = getAppointmentsForSoldier(soldierId);
    const dateStr = date.toISOString().split('T')[0];
    
    return appointments.some(apt => {
      const start = new Date(apt.start_date);
      const end = new Date(apt.end_date);
      const checkDate = new Date(dateStr);
      return checkDate >= start && checkDate <= end;
    });
  };

  const getUnavailabilityReason = (soldierId, date) => {
    const appointments = getAppointmentsForSoldier(soldierId);
    const dateStr = date.toISOString().split('T')[0];
    
    const appointment = appointments.find(apt => {
      const start = new Date(apt.start_date);
      const end = new Date(apt.end_date);
      const checkDate = new Date(dateStr);
      return checkDate >= start && checkDate <= end;
    });
    
    return appointment ? {
      reason: appointment.reason,
      exceptionCode: appointment.exception_code
    } : null;
  };

  const isWeekend = (date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const isHoliday = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return holidays.some(h => {
      const holidayDate = typeof h === 'string' ? h : h.date;
      return holidayDate === dateStr;
    });
  };

  const shouldIncludeDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    
    // Check if date is excluded
    if (excludedDates.has(dateStr)) {
      return false;
    }
    
    const isWeekendDay = isWeekend(date);
    
    // If skipping weekends and it's a weekend, don't include
    if (formData.duty_config.skip_weekends && isWeekendDay && !formData.duty_config.separate_weekend_cycle) {
      return false;
    }
    
    // If separate weekend/holiday cycles are enabled, we still include them
    // but they'll be handled separately in the assignment logic
    
    return true;
  };

  // eslint-disable-next-line no-unused-vars
  const getDateType = (date) => {
    const isWeekendDay = isWeekend(date);
    const isHolidayDay = isHoliday(date);
    const separateHolidayCycle = formData.duty_config.separate_holiday_cycle || false;
    const separateWeekendCycle = formData.duty_config.separate_weekend_cycle || false;
    
    // If separate holiday cycle is enabled and it's a holiday, holidays are their own type
    if (separateHolidayCycle && isHolidayDay) {
      return 'holiday';
    }
    // If separate weekend cycle is enabled and it's a weekend (but not a holiday), weekends are their own type
    if (separateWeekendCycle && isWeekendDay && !isHolidayDay) {
      return 'weekend';
    }
    // If both cycles are enabled and it's a holiday that falls on a weekend, treat as holiday
    if (separateHolidayCycle && separateWeekendCycle && isHolidayDay) {
      return 'holiday';
    }
    return 'weekday';
  };

  // Helper function to check if a soldier matches a rank requirement
  const soldierMatchesRequirement = (soldier, requirement, globalExclusions) => {
    const soldierRank = soldier.rank?.toUpperCase().trim();
    if (!soldierRank) return false;
    
    // Check global exclusions first
    if (globalExclusions?.ranks && globalExclusions.ranks.includes(soldierRank)) {
      return false;
    }
    if (globalExclusions?.groups) {
      if (globalExclusions.groups.includes('lower_enlisted') && isLowerEnlisted(soldierRank)) return false;
      if (globalExclusions.groups.includes('nco') && isNCORank(soldierRank)) return false;
      if (globalExclusions.groups.includes('warrant') && isWarrantOfficerRank(soldierRank)) return false;
      if (globalExclusions.groups.includes('officer') && isOfficerRank(soldierRank)) return false;
    }
    
    // Check requirement-specific exclusions
    if (requirement.excluded_ranks && requirement.excluded_ranks.includes(soldierRank)) {
      return false;
    }
    if (requirement.excluded_groups) {
      if (requirement.excluded_groups.includes('lower_enlisted') && isLowerEnlisted(soldierRank)) return false;
      if (requirement.excluded_groups.includes('nco') && isNCORank(soldierRank)) return false;
      if (requirement.excluded_groups.includes('warrant') && isWarrantOfficerRank(soldierRank)) return false;
      if (requirement.excluded_groups.includes('officer') && isOfficerRank(soldierRank)) return false;
    }
    
    // Check group match
    if (requirement.group) {
      switch (requirement.group) {
        case 'lower_enlisted':
          if (!isLowerEnlisted(soldierRank)) return false;
          break;
        case 'nco':
          if (!isNCORank(soldierRank)) return false;
          break;
        case 'warrant':
          if (!isWarrantOfficerRank(soldierRank)) return false;
          break;
        case 'officer':
          if (!isOfficerRank(soldierRank)) return false;
          break;
        default:
          return false;
      }
    }
    
    // Check rank range if specified
    if (requirement.rank_range) {
      const [startRank, endRank] = requirement.rank_range.split('-').map(r => r.trim().toUpperCase());
      const ranksInRange = getRanksInRange(startRank, endRank);
      if (!ranksInRange.includes(soldierRank)) return false;
    }
    
    return true;
  };

  const generateAssignments = () => {
    if (!formData.period_start || !formData.period_end || selectedSoldiers.size === 0) return [];
    
    const assignments = [];
    const start = new Date(formData.period_start);
    const end = new Date(formData.period_end);
    const current = new Date(start);
    
    const soldiersPerDay = formData.duty_config.soldiers_per_day || 2;
    const daysOffAfterDuty = formData.duty_config.days_off_after_duty || 1;
    const separateWeekendCycle = formData.duty_config.separate_weekend_cycle || false;
    const separateHolidayCycle = formData.duty_config.separate_holiday_cycle || false;
    const rankRequirements = formData.duty_config.rank_requirements?.requirements || [];
    const globalExclusions = formData.duty_config.rank_requirements?.exclusions || { ranks: [], groups: [] };
    
    // Build a map of the most recent duty date for each soldier from completed forms
    // This is used to properly calculate days since last duty and check days off
    const lastDutyDateFromCompletedForms = {}; // { soldierId: dateStr }
    const completedForms = otherForms.filter(f => f.status === 'complete');
    completedForms.forEach(form => {
      if (!form.form_data) return;
      const formAssignments = form.form_data.assignments || [];
      formAssignments.forEach(assignment => {
        if (assignment.soldier_id && assignment.duty && !assignment.exception_code) {
          const soldierId = assignment.soldier_id;
          const dutyDate = assignment.date;
          if (!lastDutyDateFromCompletedForms[soldierId] || dutyDate > lastDutyDateFromCompletedForms[soldierId]) {
            lastDutyDateFromCompletedForms[soldierId] = dutyDate;
          }
        }
      });
    });
    
    // Collect appointment-based exceptions and cross-roster exceptions (don't modify state directly)
    const appointmentExceptions = { ...exceptions };
    
    // Pre-populate exceptions from appointments
    const tempDate = new Date(start);
    while (tempDate <= end) {
      const dateStr = tempDate.toISOString().split('T')[0];
      Array.from(selectedSoldiers).forEach(soldierId => {
        if (isSoldierUnavailableOnDate(soldierId, tempDate)) {
          const unavailability = getUnavailabilityReason(soldierId, tempDate);
          if (unavailability && unavailability.exceptionCode) {
            if (!appointmentExceptions[soldierId]) {
              appointmentExceptions[soldierId] = {};
            }
            // Only set if not already set by user
            if (!appointmentExceptions[soldierId][dateStr]) {
              appointmentExceptions[soldierId][dateStr] = unavailability.exceptionCode;
            }
          }
        }
      });
      tempDate.setDate(tempDate.getDate() + 1);
    }
    
    // Cross-roster exceptions should already be in the exceptions state
    // (populated by autoPopulateExceptionsFromCrossRoster via useEffect)
    // We don't recalculate them here to avoid race conditions and ensure consistency
    
    // Get available soldiers (filter out those with exceptions, including appointment and cross-roster exceptions)
    const getAvailableSoldiers = (dateStr) => {
      return Array.from(selectedSoldiers).filter(soldierId => {
        const soldierExceptions = appointmentExceptions[soldierId] || {};
        const exceptionCode = soldierExceptions[dateStr];
        return !exceptionCode; // Only include soldiers without exceptions for this date
      }).map(soldierId => soldiers.find(s => s.id === soldierId)).filter(s => s);
    };
    
    // Track last assignment dates for rotation
    const lastAssignmentDate = {}; // { soldierId: dateStr }
    const lastWeekendAssignmentDate = {}; // For separate weekend cycle
    const lastHolidayAssignmentDate = {}; // For separate holiday cycle
    
    // Generate all dates in range
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      
      // Check if we should include this date
      if (shouldIncludeDate(current)) {
        // Determine which cycle to use
        let lastAssignmentMap = lastAssignmentDate;
        
        // If separate holiday cycle is enabled and it's a holiday, use holiday cycle
        if (separateHolidayCycle && isHoliday(current)) {
          lastAssignmentMap = lastHolidayAssignmentDate;
        } 
        // If separate weekend cycle is enabled and it's a weekend (but not a holiday), use weekend cycle
        else if (separateWeekendCycle && isWeekend(current) && !isHoliday(current)) {
          lastAssignmentMap = lastWeekendAssignmentDate;
        }
        
        // Get available soldiers for this date (without exceptions)
        const availableSoldiers = getAvailableSoldiers(dateStr);
        
        if (availableSoldiers.length > 0) {
          const selectedForDay = [];
          
          // If rank requirements are specified, fill each requirement
          if (rankRequirements.length > 0) {
            // For each requirement, find matching soldiers
            for (const requirement of rankRequirements) {
              const quantity = requirement.quantity || 1;
              
              // Filter soldiers that match this requirement
              let matchingSoldiers = availableSoldiers.filter(soldier => 
                soldierMatchesRequirement(soldier, requirement, globalExclusions) &&
                !selectedForDay.includes(soldier.id) &&
                !appointmentExceptions[soldier.id]?.[dateStr]
              );
              
              // Calculate days since last duty for each soldier
              const getDaysSinceLastDuty = (soldier) => {
                // Check if soldier was assigned duty in this period (current form being generated)
                const lastDateInPeriod = lastAssignmentMap[soldier.id];
                if (lastDateInPeriod) {
                  const lastDateObj = new Date(lastDateInPeriod);
                  const daysSinceAssignment = Math.floor((current - lastDateObj) / (1000 * 60 * 60 * 24));
                  return daysSinceAssignment;
                }
                
                // Check completed forms for most recent duty date
                const lastDutyDateFromForms = lastDutyDateFromCompletedForms[soldier.id];
                if (lastDutyDateFromForms) {
                  const lastDutyDateObj = new Date(lastDutyDateFromForms);
                  lastDutyDateObj.setHours(0, 0, 0, 0);
                  const currentDate = new Date(current);
                  currentDate.setHours(0, 0, 0, 0);
                  const daysSince = Math.floor((currentDate - lastDutyDateObj) / (1000 * 60 * 60 * 24));
                  return daysSince;
                }
                
                // Fall back to stored days since last duty
                return soldier.days_since_last_duty || 0;
              };
              
              // Sort by days since last duty (MOST days first - PRIMARY criterion), then preferred ranks, fallback ranks, rank order, alphabetical
              matchingSoldiers.sort((a, b) => {
                // PRIMARY: Days since last duty (most days first)
                const aDaysSince = getDaysSinceLastDuty(a);
                const bDaysSince = getDaysSinceLastDuty(b);
                if (aDaysSince !== bDaysSince) {
                  return bDaysSince - aDaysSince; // Descending (most days first)
                }
                
                const aRank = a.rank?.toUpperCase().trim();
                const bRank = b.rank?.toUpperCase().trim();
                
                // SECONDARY: Preferred ranks
                const aPreferred = requirement.preferred_ranks?.includes(aRank);
                const bPreferred = requirement.preferred_ranks?.includes(bRank);
                if (aPreferred && !bPreferred) return -1;
                if (!aPreferred && bPreferred) return 1;
                
                // TERTIARY: Fallback ranks
                const aFallback = requirement.fallback_ranks?.includes(aRank);
                const bFallback = requirement.fallback_ranks?.includes(bRank);
                if (aFallback && !bFallback) return -1;
                if (!aFallback && bFallback) return 1;
                
                // QUATERNARY: Rank order (lower rank first)
                const aRankOrder = getRankOrder(aRank);
                const bRankOrder = getRankOrder(bRank);
                if (aRankOrder !== bRankOrder) {
                  return aRankOrder - bRankOrder;
                }
                
                // QUINARY: Alphabetical by last name, then first name
                const aLastName = (a.last_name || '').toLowerCase();
                const bLastName = (b.last_name || '').toLowerCase();
                if (aLastName !== bLastName) {
                  return aLastName.localeCompare(bLastName);
                }
                const aFirstName = (a.first_name || '').toLowerCase();
                const bFirstName = (b.first_name || '').toLowerCase();
                return aFirstName.localeCompare(bFirstName);
              });
              
              // Select soldiers for this requirement (respecting days off and appointments)
              let selectedForRequirement = 0;
              for (const soldier of matchingSoldiers) {
                if (selectedForRequirement >= quantity) break;
                
                // Check if soldier is still in days-off period
                // First check if they had duty in this period
                const lastDateInPeriod = lastAssignmentMap[soldier.id];
                if (lastDateInPeriod) {
                  const lastDateObj = new Date(lastDateInPeriod);
                  const daysSince = Math.floor((current - lastDateObj) / (1000 * 60 * 60 * 24));
                  if (daysSince <= daysOffAfterDuty) {
                    continue; // Skip this soldier, they're still in days-off period
                  }
                } else {
                  // Check completed forms for most recent duty date
                  const lastDutyDateFromForms = lastDutyDateFromCompletedForms[soldier.id];
                  if (lastDutyDateFromForms) {
                    const lastDutyDateObj = new Date(lastDutyDateFromForms);
                    lastDutyDateObj.setHours(0, 0, 0, 0);
                    const currentDate = new Date(current);
                    currentDate.setHours(0, 0, 0, 0);
                    const daysSince = Math.floor((currentDate - lastDutyDateObj) / (1000 * 60 * 60 * 24));
                    if (daysSince <= daysOffAfterDuty) {
                      continue; // Skip this soldier, they're still in days-off period
                    }
                  }
                }
                
                // CRITICAL: Check if soldier already has a duty assignment in the current form on this date
                // This prevents assigning duty on consecutive days within the same form
                const existingAssignment = assignments.find(a => 
                  a.soldier_id === soldier.id && a.date === dateStr && a.duty && !a.exception_code
                );
                if (existingAssignment) {
                  continue; // Skip this soldier, they already have duty on this date in the current form
                }
                
                // Check if soldier has a pass (P exception) on this date (days off after duty)
                const existingPass = assignments.find(a => 
                  a.soldier_id === soldier.id && a.date === dateStr && a.exception_code === 'P'
                );
                if (existingPass) {
                  continue; // Skip this soldier, they have a pass on this date (days off after duty)
                }
                
                // CRITICAL: Check if soldier had duty in another form on the previous day(s)
                // If they had duty yesterday, they should have a day off today (P exception)
                // This prevents assigning duty when they should be on pass after duty from another form
                const appointments = getAppointmentsForSoldier(soldier.id);
                let hadDutyPreviousDay = false;
                
                for (let i = 1; i <= daysOffAfterDuty; i++) {
                  const previousDate = new Date(current);
                  previousDate.setDate(previousDate.getDate() - i);
                  const previousDateStr = previousDate.toISOString().split('T')[0];
                  
                  // Check if soldier had a duty appointment (CQ, SD, D) on the previous day
                  const hadDuty = appointments.some(apt => {
                    const start = new Date(apt.start_date);
                    const end = new Date(apt.end_date);
                    const checkDate = new Date(previousDateStr);
                    
                    // Check if the previous day falls within the appointment range
                    if (checkDate >= start && checkDate <= end) {
                      // Check if it's a duty appointment (not a pass)
                      const dutyCodes = ['CQ', 'SD', 'D'];
                      return dutyCodes.includes(apt.exception_code);
                    }
                    return false;
                  });
                  
                  if (hadDuty) {
                    hadDutyPreviousDay = true;
                    break;
                  }
                }
                
                if (hadDutyPreviousDay) {
                  continue; // Skip this soldier, they had duty on previous day and should have a day off today
                }
                
                // Check if soldier has an appointment/unavailability on this date
                if (isSoldierUnavailableOnDate(soldier.id, current)) {
                  continue; // Skip this soldier, they have an appointment (already handled in appointmentExceptions)
                }
                
                selectedForDay.push(soldier.id);
                lastAssignmentMap[soldier.id] = dateStr;
                selectedForRequirement++;
              }
            }
          } else {
            // No rank requirements - use simple rotation
            const soldiersWithLastDate = availableSoldiers.map(soldier => ({
              soldier,
              lastDate: lastAssignmentMap[soldier.id] || null
            }));
            
            // Calculate days since last duty for each soldier
            const getDaysSinceLastDuty = (soldier) => {
              // Check if soldier was assigned duty in this period (current form being generated)
              const lastDateInPeriod = lastAssignmentMap[soldier.id];
              if (lastDateInPeriod) {
                const lastDateObj = new Date(lastDateInPeriod);
                const daysSinceAssignment = Math.floor((current - lastDateObj) / (1000 * 60 * 60 * 24));
                return daysSinceAssignment;
              }
              
              // Check completed forms for most recent duty date
              const lastDutyDateFromForms = lastDutyDateFromCompletedForms[soldier.id];
              if (lastDutyDateFromForms) {
                const lastDutyDateObj = new Date(lastDutyDateFromForms);
                lastDutyDateObj.setHours(0, 0, 0, 0);
                const currentDate = new Date(current);
                currentDate.setHours(0, 0, 0, 0);
                const daysSince = Math.floor((currentDate - lastDutyDateObj) / (1000 * 60 * 60 * 24));
                return daysSince;
              }
              
              // Fall back to stored days since last duty
              return soldier.days_since_last_duty || 0;
            };
            
            // Sort by days since last duty (MOST days first - PRIMARY), then rank order, then alphabetical
            soldiersWithLastDate.sort((a, b) => {
              // PRIMARY: Days since last duty (most days first)
              const aDaysSince = getDaysSinceLastDuty(a.soldier);
              const bDaysSince = getDaysSinceLastDuty(b.soldier);
              if (aDaysSince !== bDaysSince) {
                return bDaysSince - aDaysSince; // Descending (most days first)
              }
              
              // SECONDARY: Rank order (lower rank first)
              const aRank = a.soldier.rank?.toUpperCase().trim();
              const bRank = b.soldier.rank?.toUpperCase().trim();
              const aRankOrder = getRankOrder(aRank);
              const bRankOrder = getRankOrder(bRank);
              if (aRankOrder !== bRankOrder) {
                return aRankOrder - bRankOrder;
              }
              
              // TERTIARY: Alphabetical by last name, then first name
              const aLastName = (a.soldier.last_name || '').toLowerCase();
              const bLastName = (b.soldier.last_name || '').toLowerCase();
              if (aLastName !== bLastName) {
                return aLastName.localeCompare(bLastName);
              }
              const aFirstName = (a.soldier.first_name || '').toLowerCase();
              const bFirstName = (b.soldier.first_name || '').toLowerCase();
              return aFirstName.localeCompare(bFirstName);
            });
            
            // Select soldiers for this day
            for (const { soldier } of soldiersWithLastDate) {
              if (selectedForDay.length >= soldiersPerDay) break;
              
              // Check if soldier is still in days-off period
              // First check if they had duty in this period
              const lastDateInPeriod = lastAssignmentMap[soldier.id];
              if (lastDateInPeriod) {
                const lastDateObj = new Date(lastDateInPeriod);
                const daysSince = Math.floor((current - lastDateObj) / (1000 * 60 * 60 * 24));
                if (daysSince <= daysOffAfterDuty) {
                  continue; // Skip this soldier, they're still in days-off period
                }
              } else {
                // Check completed forms for most recent duty date
                const lastDutyDateFromForms = lastDutyDateFromCompletedForms[soldier.id];
                if (lastDutyDateFromForms) {
                  const lastDutyDateObj = new Date(lastDutyDateFromForms);
                  lastDutyDateObj.setHours(0, 0, 0, 0);
                  const currentDate = new Date(current);
                  currentDate.setHours(0, 0, 0, 0);
                  const daysSince = Math.floor((currentDate - lastDutyDateObj) / (1000 * 60 * 60 * 24));
                  if (daysSince <= daysOffAfterDuty) {
                    continue; // Skip this soldier, they're still in days-off period
                  }
                }
              }
              
              // CRITICAL: Check if soldier already has a duty assignment in the current form on this date
              // This prevents assigning duty on consecutive days within the same form
              const existingAssignment = assignments.find(a => 
                a.soldier_id === soldier.id && a.date === dateStr && a.duty && !a.exception_code
              );
              if (existingAssignment) {
                continue; // Skip this soldier, they already have duty on this date in the current form
              }
              
              // Check if soldier has a pass (P exception) on this date (days off after duty)
              const existingPass = assignments.find(a => 
                a.soldier_id === soldier.id && a.date === dateStr && a.exception_code === 'P'
              );
              if (existingPass) {
                continue; // Skip this soldier, they have a pass on this date (days off after duty)
              }
              
              // CRITICAL: Check if soldier had duty in another form on the previous day(s)
              // If they had duty yesterday, they should have a day off today (P exception)
              // This prevents assigning duty when they should be on pass after duty from another form
              const appointments = getAppointmentsForSoldier(soldier.id);
              let hadDutyPreviousDay = false;
              
              for (let i = 1; i <= daysOffAfterDuty; i++) {
                const previousDate = new Date(current);
                previousDate.setDate(previousDate.getDate() - i);
                const previousDateStr = previousDate.toISOString().split('T')[0];
                
                // Check if soldier had a duty appointment (CQ, SD, D) on the previous day
                const hadDuty = appointments.some(apt => {
                  const start = new Date(apt.start_date);
                  const end = new Date(apt.end_date);
                  const checkDate = new Date(previousDateStr);
                  
                  // Check if the previous day falls within the appointment range
                  if (checkDate >= start && checkDate <= end) {
                    // Check if it's a duty appointment (not a pass)
                    const dutyCodes = ['CQ', 'SD', 'D'];
                    return dutyCodes.includes(apt.exception_code);
                  }
                  return false;
                });
                
                if (hadDuty) {
                  hadDutyPreviousDay = true;
                  break;
                }
              }
              
              if (hadDutyPreviousDay) {
                continue; // Skip this soldier, they had duty on previous day and should have a day off today
              }
              
              // Check if soldier has an appointment/unavailability on this date
              if (isSoldierUnavailableOnDate(soldier.id, current)) {
                continue; // Skip this soldier, they have an appointment (already handled in appointmentExceptions)
              }
              
              selectedForDay.push(soldier.id);
              lastAssignmentMap[soldier.id] = dateStr;
            }
          }
          
          // Add assignments for selected soldiers and mark days off after duty
          selectedForDay.forEach(soldierId => {
            assignments.push({
              soldier_id: soldierId,
              date: dateStr,
              duty: formData.duty_config.nature_of_duty || 'CQ'
            });
            
            // Mark days off after duty with exception code 'P' (Pass)
            // This applies regardless of whether it's a weekend or holiday
            // IMPORTANT: Always assign pass for the next day(s) after duty, even if it's after the period end
            for (let i = 1; i <= daysOffAfterDuty; i++) {
              const offDate = new Date(current);
              offDate.setDate(offDate.getDate() + i);
              const offDateStr = offDate.toISOString().split('T')[0];
              
              // Only add if there's no existing exception for this date
              const soldierExceptions = exceptions[soldierId] || {};
              if (!soldierExceptions[offDateStr]) {
                // Check if we already added this days-off exception
                const alreadyAdded = assignments.some(a => 
                  a.soldier_id === soldierId && a.date === offDateStr && a.exception_code === 'P'
                );
                if (!alreadyAdded) {
                  // Note: We assign pass even if it's after the period end, as soldiers need their day off
                  assignments.push({
                    soldier_id: soldierId,
                    date: offDateStr,
                    exception_code: 'P',
                    duty: 'P'
                  });
                }
              }
            }
          });
        }
      }
      
      // Handle exceptions for all dates (user-defined exceptions take precedence over appointment exceptions)
      Array.from(selectedSoldiers).forEach(soldierId => {
        const soldierExceptions = appointmentExceptions[soldierId] || {};
        const exceptionCode = soldierExceptions[dateStr];
        if (exceptionCode) {
          // Check if we already added this exception
          const alreadyAdded = assignments.some(a => 
            a.soldier_id === soldierId && a.date === dateStr
          );
          if (!alreadyAdded) {
            assignments.push({
              soldier_id: soldierId,
              date: dateStr,
              exception_code: exceptionCode,
              duty: exceptionCode
            });
          } else {
            // Update existing assignment if it was a days-off exception (P) and user has a different exception
            const existingIndex = assignments.findIndex(a => 
              a.soldier_id === soldierId && a.date === dateStr
            );
            if (existingIndex >= 0 && assignments[existingIndex].exception_code === 'P') {
              assignments[existingIndex].exception_code = exceptionCode;
              assignments[existingIndex].duty = exceptionCode;
            }
          }
        }
      });
      
      current.setDate(current.getDate() + 1);
    }
    
    return assignments;
  };

  // Create duty and days-off appointments in soldier profiles when form is saved
  // This enables automatic cross-roster checking
  const createDutyAndDaysOffAppointments = async (formId) => {
    if (!formData.period_start || !formData.period_end || selectedSoldiers.size === 0) return;
    
    try {
      const assignments = generateAssignments();
      const dutyType = formData.duty_config?.nature_of_duty || 'Duty';
      
      // Group duty assignments and days-off by soldier and date ranges
      const soldierDutyRanges = {}; // { soldierId: [{ start_date, end_date, dates: [dateStr] }] }
      const soldierDaysOffRanges = {}; // { soldierId: [{ start_date, end_date, dates: [dateStr] }] }
      
      assignments.forEach(assignment => {
        if (!assignment.soldier_id) return;
        
        const soldierId = assignment.soldier_id;
        const dateStr = assignment.date;
        
        // Handle duty assignments (actual duty, not exceptions)
        if (assignment.duty && !assignment.exception_code) {
          if (!soldierDutyRanges[soldierId]) {
            soldierDutyRanges[soldierId] = [];
          }
          
          // Find or create a date range for this soldier
          let currentRange = soldierDutyRanges[soldierId].find(range => {
            const lastDate = range.dates[range.dates.length - 1];
            const date = new Date(dateStr);
            const lastDateObj = new Date(lastDate);
            const daysDiff = Math.floor((date - lastDateObj) / (1000 * 60 * 60 * 24));
            return daysDiff <= 1; // Same day or next day
          });
          
          if (!currentRange) {
            currentRange = {
              start_date: dateStr,
              end_date: dateStr,
              dates: [dateStr]
            };
            soldierDutyRanges[soldierId].push(currentRange);
          } else {
            currentRange.dates.push(dateStr);
            if (dateStr > currentRange.end_date) {
              currentRange.end_date = dateStr;
            }
            if (dateStr < currentRange.start_date) {
              currentRange.start_date = dateStr;
            }
          }
        }
        
        // Handle days-off assignments (P exception code)
        if (assignment.exception_code === 'P') {
          if (!soldierDaysOffRanges[soldierId]) {
            soldierDaysOffRanges[soldierId] = [];
          }
          
          let currentRange = soldierDaysOffRanges[soldierId].find(range => {
            const lastDate = range.dates[range.dates.length - 1];
            const date = new Date(dateStr);
            const lastDateObj = new Date(lastDate);
            const daysDiff = Math.floor((date - lastDateObj) / (1000 * 60 * 60 * 24));
            return daysDiff <= 1;
          });
          
          if (!currentRange) {
            currentRange = {
              start_date: dateStr,
              end_date: dateStr,
              dates: [dateStr]
            };
            soldierDaysOffRanges[soldierId].push(currentRange);
          } else {
            currentRange.dates.push(dateStr);
            if (dateStr > currentRange.end_date) {
              currentRange.end_date = dateStr;
            }
            if (dateStr < currentRange.start_date) {
              currentRange.start_date = dateStr;
            }
          }
        }
      });
      
      // Determine exception code based on duty type
      let exceptionCode = 'D'; // Default to 'D' for Detail
      if (dutyType === 'CQ' || dutyType === 'Charge of Quarters') {
        exceptionCode = 'CQ';
      } else if (dutyType === 'BN Staff Duty' || dutyType === 'Brigade Staff Duty' || dutyType.includes('Staff Duty')) {
        exceptionCode = 'SD';
      }
      
      // Remove existing appointments for this form first (to avoid duplicates on re-save)
      await removeDutyAppointments(formId, null);
      
      const BATCH_DELAY = 200;
      const authErrorRef = { value: false };
      
      // Create duty appointments
      for (const [soldierId, ranges] of Object.entries(soldierDutyRanges)) {
        if (authErrorRef.value) break;
        
        for (const range of ranges) {
          try {
            await apiClient.post(`/soldiers/${soldierId}/appointments`, {
              start_date: range.start_date,
              end_date: range.end_date,
              reason: `${dutyType} Duty`,
              exception_code: exceptionCode,
              notes: `DA6_FORM:${formId}` // Track which form created this appointment
            });
          } catch (err) {
            if (err.response?.status === 401) {
              authErrorRef.value = true;
              break;
            }
            console.error(`Error creating duty appointment for soldier ${soldierId}:`, err);
          }
        }
        
        if (!authErrorRef.value) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
      }
      
      // Create days-off (Pass) appointments
      for (const [soldierId, ranges] of Object.entries(soldierDaysOffRanges)) {
        if (authErrorRef.value) break;
        
        for (const range of ranges) {
          try {
            await apiClient.post(`/soldiers/${soldierId}/appointments`, {
              start_date: range.start_date,
              end_date: range.end_date,
              reason: 'Pass (Days Off After Duty)',
              exception_code: 'P',
              notes: `DA6_FORM:${formId}` // Track which form created this appointment
            });
          } catch (err) {
            if (err.response?.status === 401) {
              authErrorRef.value = true;
              break;
            }
            console.error(`Error creating days-off appointment for soldier ${soldierId}:`, err);
          }
        }
        
        if (!authErrorRef.value) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
      }
      
      if (!authErrorRef.value) {
        console.log(`Created duty and days-off appointments for ${Object.keys(soldierDutyRanges).length} soldiers from form ${formId}`);
      }
    } catch (error) {
      console.error('Error creating duty and days-off appointments:', error);
      // Don't block form save if this fails
    }
  };

  // Remove duty and days-off appointments created by a form
  // If cancelledDate is provided, only removes appointments after that date (uncompleted duties)
  // If cancelledDate is null, removes all appointments for this form (used when re-saving)
  const removeDutyAppointments = async (formId, cancelledDate) => {
    if (!formId) return;
    
    try {
      const cancelledDateObj = cancelledDate ? new Date(cancelledDate) : null;
      if (cancelledDateObj) {
        cancelledDateObj.setHours(0, 0, 0, 0);
      }
      
      // Get all appointments for selected soldiers
      const appointmentsToRemove = [];
      
      for (const soldierId of Array.from(selectedSoldiers)) {
        try {
          const { data } = await apiClient.get(`/soldiers/${soldierId}/appointments`);
          const appointments = data.appointments || [];
          
          // Find appointments created by this form
          const formAppointments = appointments.filter(apt => 
            apt.notes && apt.notes.includes(`DA6_FORM:${formId}`)
          );
          
          for (const apt of formAppointments) {
            // If cancelledDate is provided, only remove uncompleted appointments
            // If cancelledDate is null, remove all (for re-saving)
            if (cancelledDateObj) {
              const appointmentStart = new Date(apt.start_date);
              appointmentStart.setHours(0, 0, 0, 0);
              
              if (appointmentStart >= cancelledDateObj) {
                appointmentsToRemove.push({ ...apt, soldierId });
              } else {
                // Duty was already completed before cancellation - keep it
                console.log(`Keeping completed appointment for soldier ${soldierId} on ${apt.start_date} (completed before cancellation)`);
              }
            } else {
              // Remove all appointments for this form (re-saving)
              appointmentsToRemove.push({ ...apt, soldierId });
            }
          }
        } catch (err) {
          if (err.response?.status === 401) {
            return; // Stop if unauthorized
          }
          console.error(`Error fetching appointments for soldier ${soldierId}:`, err);
        }
      }
      
      if (appointmentsToRemove.length === 0) {
        return;
      }
      
      // Delete appointments in batches
      const BATCH_SIZE = 5;
      const BATCH_DELAY = 200;
      const authErrorRef = { value: false };
      
      for (let i = 0; i < appointmentsToRemove.length; i += BATCH_SIZE) {
        if (authErrorRef.value) break;
        
        const batch = appointmentsToRemove.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(apt =>
          apiClient.delete(`/soldiers/${apt.soldierId}/appointments/${apt.id}`).catch(err => {
            if (err.response?.status === 401) {
              authErrorRef.value = true;
              return null;
            }
            console.error(`Error deleting appointment ${apt.id}:`, err);
            return null;
          })
        );
        
        await Promise.all(batchPromises);
        
        if (i + BATCH_SIZE < appointmentsToRemove.length && !authErrorRef.value) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
      }
      
      if (!authErrorRef.value) {
        console.log(`Removed ${appointmentsToRemove.length} appointment(s) for form ${formId}`);
      }
    } catch (error) {
      console.error('Error removing appointments:', error);
      // Don't block save if this fails
    }
  };

  // Calculate and update days since last duty for all soldiers in the roster
  // This ensures fairness across all DA6 forms/duties
  // Note: Currently not used - days since last duty is calculated from appointments
  // eslint-disable-next-line no-unused-vars
  const updateSoldiersDaysSinceDuty = async () => {
    if (!formData.period_start || !formData.period_end || selectedSoldiers.size === 0) return;
    
    try {
      setUpdatingSoldiers(true);
      const assignments = generateAssignments();
      const periodEnd = new Date(formData.period_end);
      const selectedSoldiersList = Array.from(selectedSoldiers);
      
      // Count how many details were made during this period (for soldiers who weren't assigned)
      const detailsMade = new Set(); // Dates when details were made
      assignments.forEach(a => {
        if (a.duty && !a.exception_code) {
          detailsMade.add(a.date);
        }
      });
      
      // Get global exclusions and rank requirements
      const dutyConfig = formData.duty_config || {};
      const globalExclusions = dutyConfig.rank_requirements?.exclusions || { ranks: [], groups: [] };
      const rankRequirements = dutyConfig.rank_requirements?.requirements || [];
      const excludedRanks = globalExclusions.ranks || [];
      const excludedGroups = globalExclusions.groups || [];
      
      // Helper to check if soldier is excluded
      const isSoldierExcluded = (soldier) => {
        const soldierRank = soldier.rank?.toUpperCase().trim();
        if (!soldierRank) return true;
        
        if (excludedRanks.includes(soldierRank)) return true;
        if (excludedGroups.includes('lower_enlisted') && isLowerEnlisted(soldierRank)) return true;
        if (excludedGroups.includes('nco') && isNCORank(soldierRank)) return true;
        if (excludedGroups.includes('warrant') && isWarrantOfficerRank(soldierRank)) return true;
        if (excludedGroups.includes('officer') && isOfficerRank(soldierRank)) return true;
        
        return false;
      };
      
      // Helper to check if soldier matches any requirement (same logic as soldierMatchesRequirement)
      const soldierMatchesAnyRequirement = (soldier) => {
        const soldierRank = soldier.rank?.toUpperCase().trim();
        if (!soldierRank) return false;
        
        // If no requirements specified, all non-excluded soldiers are eligible
        if (rankRequirements.length === 0) {
          return !isSoldierExcluded(soldier);
        }
        
        // Check if soldier matches at least one requirement
        for (const requirement of rankRequirements) {
          // Check global exclusions first
          if (globalExclusions?.ranks && globalExclusions.ranks.includes(soldierRank)) {
            continue; // Skip this requirement, soldier is globally excluded
          }
          if (globalExclusions?.groups) {
            if (globalExclusions.groups.includes('lower_enlisted') && isLowerEnlisted(soldierRank)) continue;
            if (globalExclusions.groups.includes('nco') && isNCORank(soldierRank)) continue;
            if (globalExclusions.groups.includes('warrant') && isWarrantOfficerRank(soldierRank)) continue;
            if (globalExclusions.groups.includes('officer') && isOfficerRank(soldierRank)) continue;
          }
          
          // Check requirement-specific exclusions
          if (requirement.excluded_ranks && requirement.excluded_ranks.includes(soldierRank)) {
            continue; // Skip this requirement
          }
          if (requirement.excluded_groups) {
            if (requirement.excluded_groups.includes('lower_enlisted') && isLowerEnlisted(soldierRank)) continue;
            if (requirement.excluded_groups.includes('nco') && isNCORank(soldierRank)) continue;
            if (requirement.excluded_groups.includes('warrant') && isWarrantOfficerRank(soldierRank)) continue;
            if (requirement.excluded_groups.includes('officer') && isOfficerRank(soldierRank)) continue;
          }
          
          // Check group match
          if (requirement.group) {
            switch (requirement.group) {
              case 'lower_enlisted':
                if (!isLowerEnlisted(soldierRank)) continue;
                break;
              case 'nco':
                if (!isNCORank(soldierRank)) continue;
                break;
              case 'warrant':
                if (!isWarrantOfficerRank(soldierRank)) continue;
                break;
              case 'officer':
                if (!isOfficerRank(soldierRank)) continue;
                break;
              default:
                continue;
            }
          }
          
          // Check rank range if specified
          if (requirement.rank_range) {
            const [startRank, endRank] = requirement.rank_range.split('-').map(r => r.trim().toUpperCase());
            const ranksInRange = getRanksInRange(startRank, endRank);
            if (!ranksInRange.includes(soldierRank)) continue;
          }
          
          // Soldier matches this requirement
          return true;
        }
        
        // Soldier doesn't match any requirement
        return false;
      };
      
      // Calculate final days since last duty for each soldier
      const updates = [];
      
      for (const soldierId of selectedSoldiersList) {
        const soldier = soldiers.find(s => s.id === soldierId);
        if (!soldier) continue;
        
        // Skip excluded soldiers - don't update their days_since_last_duty
        if (isSoldierExcluded(soldier)) {
          continue;
        }
        
        // Only update soldiers who could potentially match at least one requirement
        // This prevents updating soldiers like CSM who could never be selected
        if (!soldierMatchesAnyRequirement(soldier)) {
          continue;
        }
        
        // Find the most recent duty assignment for this soldier in this period
        const soldierAssignments = assignments.filter(a => 
          a.soldier_id === soldierId && 
          a.duty && 
          !a.exception_code // Actual duty, not exception
        );
        
        if (soldierAssignments.length > 0) {
          // Soldier had duty assignments - find most recent
          soldierAssignments.sort((a, b) => new Date(b.date) - new Date(a.date));
          const mostRecentDutyDate = new Date(soldierAssignments[0].date);
          
          // Calculate days from most recent duty date to TODAY
          // If duty was today, daysSince = 0
          // If duty was yesterday, daysSince = 1
          // etc.
          const today = new Date();
          today.setHours(0, 0, 0, 0); // Normalize to start of day
          mostRecentDutyDate.setHours(0, 0, 0, 0);
          
          // Calculate days: difference in days (0 if same day, 1 if yesterday, etc.)
          const daysSince = Math.floor((today - mostRecentDutyDate) / (1000 * 60 * 60 * 24));
          
          updates.push({
            soldierId: soldierId,
            daysSince: Math.max(0, daysSince) // Ensure non-negative
          });
        } else {
          // Soldier had no duty assignments in this period
          // Increment their current days_since_last_duty by the number of days in the period
          // This accounts for each day they didn't have duty
          const currentDaysSince = soldier.days_since_last_duty || 0;
          const periodStart = new Date(formData.period_start);
          periodStart.setHours(0, 0, 0, 0);
          const periodEndDate = new Date(periodEnd);
          periodEndDate.setHours(0, 0, 0, 0);
          const daysInPeriod = Math.floor((periodEndDate - periodStart) / (1000 * 60 * 60 * 24)) + 1;
          const newDaysSince = currentDaysSince + daysInPeriod;
          
          updates.push({
            soldierId: soldierId,
            daysSince: newDaysSince
          });
        }
      }
      
      // Update soldiers in batches to prevent rate limiting
      const BATCH_SIZE = 5;
      const BATCH_DELAY = 200; // 200ms delay between batches
      const authErrorRef = { value: false };
      
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        // Stop if we hit an auth error
        if (authErrorRef.value) break;
        
        const batch = updates.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(update => 
          apiClient.put(`/soldiers/${update.soldierId}`, {
            days_since_last_duty: update.daysSince
          }).catch(err => {
            // Stop processing if auth error
            if (err.response?.status === 401) {
              authErrorRef.value = true;
              return null;
            }
            console.error(`Error updating soldier ${update.soldierId}:`, err);
            return null; // Continue with other updates even if one fails
          })
        );
        
        await Promise.all(batchPromises);
        
        // Add delay between batches (except for the last batch)
        if (i + BATCH_SIZE < updates.length && !authErrorRef.value) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
      }
      
      if (!authErrorRef.value) {
        // Refresh soldiers list to get updated values
        await fetchSoldiers();
        console.log(`Updated days_since_last_duty for ${updates.length} soldiers`);
      }
    } catch (error) {
      console.error('Error updating days since last duty:', error);
      // Don't block form save if this fails, but log it
      alert('Warning: Could not update days since last duty. Form was saved, but soldier profiles may need manual update.');
    } finally {
      setUpdatingSoldiers(false);
    }
  };

  // Roll back days since last duty for a cancelled form
  // Note: Currently not used - days since last duty is calculated from appointments
  // eslint-disable-next-line no-unused-vars
  const rollbackDaysSinceDutyForCancelledForm = async (cancelledDate) => {
    if (!formData.period_start || !formData.period_end || selectedSoldiers.size === 0 || !cancelledDate) return;
    
    try {
      const assignments = generateAssignments();
      const cancelledDateObj = new Date(cancelledDate);
      cancelledDateObj.setHours(0, 0, 0, 0);
      
      // Get all other complete forms to recalculate properly
      const { data: formsData } = await apiClient.get('/da6-forms');
      const otherCompleteForms = (formsData.forms || []).filter(f => 
        f.id !== id && f.status === 'complete'
      );
      
      // Find the most recent duty date for each soldier from other complete forms
      const soldierLastDutyDate = {}; // { soldierId: Date }
      
      for (const form of otherCompleteForms) {
        const formAssignments = generateAssignmentsForOtherForm(form);
        Object.entries(formAssignments).forEach(([soldierId, dateAssignments]) => {
          Object.entries(dateAssignments).forEach(([dateStr, assignment]) => {
            if (assignment.duty && !assignment.exception_code) {
              const dutyDate = new Date(dateStr);
              dutyDate.setHours(0, 0, 0, 0);
              if (!soldierLastDutyDate[soldierId] || dutyDate > soldierLastDutyDate[soldierId]) {
                soldierLastDutyDate[soldierId] = dutyDate;
              }
            }
          });
        });
      }
      
      // For each soldier in this cancelled form, roll back their days
      const updates = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      for (const soldierId of Array.from(selectedSoldiers)) {
        const soldier = soldiers.find(s => s.id === soldierId);
        if (!soldier) continue;
        
        // Find their last duty date from this cancelled form (before cancellation date)
        const soldierAssignments = assignments.filter(a => 
          a.soldier_id === soldierId && 
          a.duty && 
          !a.exception_code
        );
        
        let lastDutyFromThisForm = null;
        for (const assignment of soldierAssignments) {
          const dutyDate = new Date(assignment.date);
          dutyDate.setHours(0, 0, 0, 0);
          if (dutyDate <= cancelledDateObj && (!lastDutyFromThisForm || dutyDate > lastDutyFromThisForm)) {
            lastDutyFromThisForm = dutyDate;
          }
        }
        
        // Determine the most recent duty date (from other forms or from this form before cancellation)
        let mostRecentDutyDate = soldierLastDutyDate[soldierId] || null;
        if (lastDutyFromThisForm && (!mostRecentDutyDate || lastDutyFromThisForm > mostRecentDutyDate)) {
          mostRecentDutyDate = lastDutyFromThisForm;
        }
        
        // Calculate days since last duty
        if (mostRecentDutyDate) {
          const daysSince = Math.floor((today - mostRecentDutyDate) / (1000 * 60 * 60 * 24));
          updates.push({
            soldierId: soldierId,
            daysSince: Math.max(0, daysSince)
          });
        } else {
          // No duty found - keep current value or set to 0
          updates.push({
            soldierId: soldierId,
            daysSince: soldier.days_since_last_duty || 0
          });
        }
      }
      
      // Update soldiers in batches
      const BATCH_SIZE = 5;
      const BATCH_DELAY = 200;
      const authErrorRef = { value: false };
      
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        if (authErrorRef.value) break;
        
        const batch = updates.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(update =>
          apiClient.put(`/soldiers/${update.soldierId}`, {
            days_since_last_duty: update.daysSince
          }).catch(err => {
            if (err.response?.status === 401) {
              authErrorRef.value = true;
              return null;
            }
            console.error(`Error updating soldier ${update.soldierId}:`, err);
            return null;
          })
        );
        
        await Promise.all(batchPromises);
        
        if (i + BATCH_SIZE < updates.length && !authErrorRef.value) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
      }
      
      if (!authErrorRef.value) {
        await fetchSoldiers();
        console.log(`Rolled back days_since_last_duty for ${updates.length} soldiers after form cancellation`);
      }
    } catch (error) {
      console.error('Error rolling back days since last duty:', error);
      alert('Warning: Could not roll back days since last duty. Please update manually.');
    }
  };

  // Recalculate days since last duty for all soldiers based on ALL completed rosters
  // Note: This function is kept for potential future use but is currently not called
  // when completing forms to prevent unnecessary recalculations and preserve existing days
  // eslint-disable-next-line no-unused-vars
  const recalculateAllDaysSinceDuty = async () => {
    try {
      console.log('[Recalculate] Starting recalculation of days since last duty from all completed rosters...');
      
      // Fetch all completed rosters (only 'complete' status, not 'cancelled' or 'in_progress')
      const { data: formsData } = await apiClient.get('/da6-forms');
      const completedForms = (formsData.forms || []).filter(f => f.status === 'complete');
      
      if (completedForms.length === 0) {
        console.log('[Recalculate] No completed rosters found. Resetting all soldiers to 0 days.');
        // Reset all soldiers to 0 if no completed rosters
        const { data: soldiersData } = await apiClient.get('/soldiers');
        const allSoldiers = soldiersData.soldiers || [];
        
        // Update in batches to prevent rate limiting
        const BATCH_SIZE = 5;
        const BATCH_DELAY = 200;
        const authErrorRef = { value: false };
        
        for (let i = 0; i < allSoldiers.length; i += BATCH_SIZE) {
          if (authErrorRef.value) break;
          
          const batch = allSoldiers.slice(i, i + BATCH_SIZE);
          const batchPromises = batch.map(soldier =>
            apiClient.put(`/soldiers/${soldier.id}`, {
              days_since_last_duty: 0
            }).catch(err => {
              if (err.response?.status === 401) {
                authErrorRef.value = true;
                return null;
              }
              console.error(`Error updating soldier ${soldier.id}:`, err);
              return null;
            })
          );
          
          await Promise.all(batchPromises);
          
          if (i + BATCH_SIZE < allSoldiers.length && !authErrorRef.value) {
            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
          }
        }
        
        if (!authErrorRef.value) {
          await fetchSoldiers();
          console.log('[Recalculate] Reset all soldiers to 0 days since last duty.');
        }
        return;
      }
      
      // Find the most recent period end date across all completed rosters
      let mostRecentPeriodEnd = null;
      completedForms.forEach(form => {
        const periodEnd = new Date(form.period_end);
        if (!mostRecentPeriodEnd || periodEnd > mostRecentPeriodEnd) {
          mostRecentPeriodEnd = periodEnd;
        }
      });
      
      // Get all soldiers BEFORE processing to preserve their existing days
      const { data: soldiersData } = await apiClient.get('/soldiers');
      const allSoldiers = soldiersData.soldiers || [];
      
      // Track the most recent duty assignment for each soldier across all rosters
      const soldierLastDutyDate = {}; // { soldierId: Date }
      
      // Process each completed roster
      for (const form of completedForms) {
        const assignmentsMap = generateAssignmentsForOtherForm(form);
        
        // Extract duty assignments for each soldier
        Object.entries(assignmentsMap).forEach(([soldierId, dateAssignments]) => {
          Object.entries(dateAssignments).forEach(([dateStr, assignment]) => {
            if (assignment.duty && !assignment.exception_code) {
              // This is an actual duty assignment
              const dutyDate = new Date(dateStr);
              if (!soldierLastDutyDate[soldierId] || dutyDate > soldierLastDutyDate[soldierId]) {
                soldierLastDutyDate[soldierId] = dutyDate;
              }
            }
          });
        });
      }
      
      // Calculate days since last duty for each soldier
      // Use TODAY as the reference date, not the period end
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normalize to start of day
      const updates = [];
      
      for (const soldier of allSoldiers) {
        const lastDutyDate = soldierLastDutyDate[soldier.id];
        
        if (lastDutyDate) {
          // Soldier had duty - calculate days from last duty to TODAY
          // Add +1 for each day after their last duty (including today)
          const dutyDate = new Date(lastDutyDate);
          dutyDate.setHours(0, 0, 0, 0);
          const daysSince = Math.floor((today - dutyDate) / (1000 * 60 * 60 * 24));
          updates.push({
            soldierId: soldier.id,
            daysSince: Math.max(0, daysSince) // Ensure non-negative
          });
        } else {
          // Soldier had no duty in any completed roster
          // Don't update their days - preserve their existing value
          // They may have had duty before the oldest roster, or they may be new
          // Only update if they have no value set (null/undefined)
          if (soldier.days_since_last_duty === null || soldier.days_since_last_duty === undefined) {
            // No value set - calculate from oldest roster start or set to 0
            const oldestRosterStart = completedForms.reduce((oldest, form) => {
              const start = new Date(form.period_start);
              start.setHours(0, 0, 0, 0);
              return !oldest || start < oldest ? start : oldest;
            }, null);
            
            if (oldestRosterStart) {
              const daysSince = Math.floor((today - oldestRosterStart) / (1000 * 60 * 60 * 24));
              updates.push({
                soldierId: soldier.id,
                daysSince: Math.max(0, daysSince)
              });
            } else {
              updates.push({
                soldierId: soldier.id,
                daysSince: 0
              });
            }
          }
          // Otherwise, preserve their existing value (don't update)
        }
      }
      
      // Update soldiers in batches to prevent rate limiting
      const BATCH_SIZE = 5;
      const BATCH_DELAY = 200; // 200ms delay between batches
      const authErrorRef = { value: false };
      
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        // Stop if we hit an auth error
        if (authErrorRef.value) break;
        
        const batch = updates.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(update =>
          apiClient.put(`/soldiers/${update.soldierId}`, {
            days_since_last_duty: update.daysSince
          }).catch(err => {
            // Stop processing if auth error
            if (err.response?.status === 401) {
              authErrorRef.value = true;
              return null;
            }
            console.error(`Error updating soldier ${update.soldierId}:`, err);
            return null;
          })
        );
        
        await Promise.all(batchPromises);
        
        // Add delay between batches (except for the last batch)
        if (i + BATCH_SIZE < updates.length && !authErrorRef.value) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
      }
      
      if (!authErrorRef.value) {
        await fetchSoldiers();
        console.log(`[Recalculate] Updated days_since_last_duty for ${updates.length} soldiers based on ${completedForms.length} completed roster(s).`);
      } else {
        console.error('[Recalculate] Stopped due to authentication error');
      }
    } catch (error) {
      console.error('[Recalculate] Error recalculating days since last duty:', error);
      alert('Warning: Could not recalculate days since last duty. Please try again or update manually.');
    } finally {
      setRecalculating(false);
    }
  };

  const handleCancel = async () => {
    // Prompt for cancellation date
    const cancelledDateStr = prompt('Enter the cancellation date (YYYY-MM-DD):\n\nThis date will be used to accurately roll back "days since last duty" for affected soldiers.', 
      formData.period_start || new Date().toISOString().split('T')[0]);
    
    if (!cancelledDateStr) {
      return; // User cancelled
    }
    
    // Validate date format
    const cancelledDate = new Date(cancelledDateStr);
    if (isNaN(cancelledDate.getTime())) {
      alert('Invalid date format. Please use YYYY-MM-DD format.');
      return;
    }
    
    // Save with cancelled status
    await handleSave('cancelled', cancelledDateStr);
  };

  const handleSave = async (status = 'draft', cancelledDate = null) => {
    try {
      setSaving(true);
      const wasCancelled = id && formData.status === 'cancelled';
      const isCancelling = status === 'cancelled';
      
      // Auto-determine status based on dates (unless cancelling)
      let finalStatus = status;
      if (!isCancelling && formData.period_start && formData.period_end) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const periodStart = new Date(formData.period_start);
        periodStart.setHours(0, 0, 0, 0);
        const periodEnd = new Date(formData.period_end);
        periodEnd.setHours(0, 0, 0, 0);
        const dayAfterPeriodEnd = new Date(periodEnd);
        dayAfterPeriodEnd.setDate(dayAfterPeriodEnd.getDate() + 1);
        dayAfterPeriodEnd.setHours(0, 0, 0, 0);
        
        // If current date is on or after the day after period_end, set to complete
        if (today >= dayAfterPeriodEnd) {
          finalStatus = 'complete';
        }
        // If current date is within the duty period, set to in_progress
        else if (today >= periodStart && today <= periodEnd) {
          finalStatus = 'in_progress';
        }
        // Otherwise keep as draft
        else {
          finalStatus = 'draft';
        }
      }
      
      // Don't generate all assignments - they can be generated on-demand
      // Only store the source data to keep payload size manageable
      const payload = {
        unit_name: formData.unit_name,
        period_start: formData.period_start,
        period_end: formData.period_end,
        status: finalStatus,
        form_data: {
          // Store only essential data, not generated assignments
          selected_soldiers: Array.from(selectedSoldiers),
          exceptions: exceptions,
          duty_config: formData.duty_config,
          holidays: holidays.map(h => typeof h === 'string' ? h : h.date),
          excluded_dates: Array.from(excludedDates),
          cross_roster_check_enabled: crossRosterCheckEnabled,
          selected_rosters_for_check: Array.from(selectedRostersForCheck)
        }
      };
      
      // Add cancelled_date if cancelling
      if (isCancelling && cancelledDate) {
        payload.cancelled_date = cancelledDate;
      }

      if (id) {
        await apiClient.put(`/da6-forms/${id}`, payload);
        
        // Create/update duty and days-off appointments whenever form is saved
        // This enables automatic cross-roster checking
        setUpdatingSoldiers(true);
        await createDutyAndDaysOffAppointments(id);
        setUpdatingSoldiers(false);
        
        if (isCancelling || wasCancelled) {
          // Handle cancellation - remove uncompleted appointments
          setUpdatingSoldiers(true);
          await removeDutyAppointments(id, cancelledDate);
          setUpdatingSoldiers(false);
          alert('Form cancelled. Uncompleted duty appointments have been removed.');
          navigate('/forms');
        } else {
          setSaving(false);
          alert('Form saved successfully! Duty appointments have been updated in soldier profiles.');
          navigate(`/forms/${id}/view`);
        }
      } else {
        const { data } = await apiClient.post('/da6-forms', payload);
        const newFormId = data.form.id;
        
        // Create duty and days-off appointments for new form
        setUpdatingSoldiers(true);
        await createDutyAndDaysOffAppointments(newFormId);
        setUpdatingSoldiers(false);
        
        if (isCancelling) {
          // Handle cancellation for new form (shouldn't happen, but handle it)
          setUpdatingSoldiers(true);
          await removeDutyAppointments(newFormId, cancelledDate);
          setUpdatingSoldiers(false);
          alert('Form cancelled. Uncompleted duty appointments have been removed.');
          navigate('/forms');
        } else {
          setSaving(false);
          navigate(`/forms/${newFormId}/view`);
        }
      }
    } catch (error) {
      console.error('Error saving form:', error);
      setSaving(false);
      setUpdatingSoldiers(false);
      setRecalculating(false);
      alert('Error saving form. Please try again.');
    }
  };

  const toggleSoldierSelection = (soldierId, event) => {
    // If clicking on the label/name, open profile instead
    if (event && event.target.type !== 'checkbox') {
      setSelectedProfileSoldier(soldiers.find(s => s.id === soldierId));
      return;
    }
    
    const newSelected = new Set(selectedSoldiers);
    if (newSelected.has(soldierId)) {
      newSelected.delete(soldierId);
      // Remove exceptions for this soldier
      const newExceptions = { ...exceptions };
      delete newExceptions[soldierId];
      setExceptions(newExceptions);
    } else {
      newSelected.add(soldierId);
      // Auto-populate exceptions from appointments if date range is set
      if (formData.period_start && formData.period_end) {
        autoPopulateExceptionsFromAppointments(soldierId, newSelected);
      }
    }
    setSelectedSoldiers(newSelected);
  };

  const toggleSelectAll = async () => {
    if (selectedSoldiers.size === soldiers.length) {
      // Deselect all
      setSelectedSoldiers(new Set());
      setExceptions({});
    } else {
      // Select all
      const allSelected = new Set(soldiers.map(s => s.id));
      setSelectedSoldiers(allSelected);
      
      // Fetch appointments for all soldiers (with batching to prevent rate limiting)
      const soldiersToFetch = soldiers.filter(
        s => !soldierAppointments[s.id]
      );
      if (soldiersToFetch.length > 0) {
        await fetchAllAppointments(soldiersToFetch);
      }
      
      // Auto-populate exceptions from appointments
      if (formData.period_start && formData.period_end) {
        autoPopulateExceptionsFromAppointments(null, allSelected);
      }
    }
  };

  const autoPopulateExceptionsFromAppointments = (soldierId, selectedSet) => {
    const newExceptions = { ...exceptions };
    const dates = getDatesInRange();
    
    const soldiersToProcess = soldierId 
      ? [soldiers.find(s => s.id === soldierId)]
      : soldiers.filter(s => selectedSet.has(s.id));
    
    soldiersToProcess.forEach(soldier => {
      if (!soldier) return;
      
      dates.forEach(date => {
        // Only check dates that should be included (respects weekend/holiday settings)
        if (shouldIncludeDate(date)) {
          const unavailability = getUnavailabilityReason(soldier.id, date);
          if (unavailability && unavailability.exceptionCode) {
            const dateStr = date.toISOString().split('T')[0];
            if (!newExceptions[soldier.id]) {
              newExceptions[soldier.id] = {};
            }
            newExceptions[soldier.id][dateStr] = unavailability.exceptionCode;
          }
        }
      });
    });
    
    setExceptions(newExceptions);
  };

  // Automatically populate exceptions from cross-roster conflicts
  // This checks both other forms AND soldier appointments (which include duties from completed forms)
  const autoPopulateExceptionsFromCrossRoster = () => {
    if (!formData.period_start || !formData.period_end || selectedSoldiers.size === 0) {
      return;
    }

    if (!crossRosterCheckEnabled || (selectedRostersForCheck.size === 0 && otherForms.length === 0)) {
      return;
    }

    // Use functional update to ensure we have the latest exceptions state
    setExceptions(prevExceptions => {
      const newExceptions = { ...prevExceptions };
      const start = new Date(formData.period_start);
      const end = new Date(formData.period_end);
      const current = new Date(start);
      let conflictsFound = 0;
      let hasChanges = false;

      // Iterate through all dates in the current form's period
      while (current <= end) {
        const dateStr = current.toISOString().split('T')[0];
        
        // Check each selected soldier
        const selectedSoldiersArray = Array.from(selectedSoldiers);
        for (let i = 0; i < selectedSoldiersArray.length; i++) {
          const soldierId = selectedSoldiersArray[i];
          
          // First, check soldier appointments for duty conflicts (duties from completed forms)
          if (isSoldierUnavailableOnDate(soldierId, current)) {
            const unavailability = getUnavailabilityReason(soldierId, current);
            if (unavailability && unavailability.exceptionCode) {
              // Check if this is a duty appointment (CQ, SD, or D exception codes)
              const dutyExceptionCodes = ['CQ', 'SD', 'D'];
              if (dutyExceptionCodes.includes(unavailability.exceptionCode)) {
                // This is a duty conflict from an appointment
                if (!newExceptions[soldierId]) {
                  newExceptions[soldierId] = {};
                }
                const currentException = newExceptions[soldierId][dateStr];
                if (!currentException || currentException !== unavailability.exceptionCode) {
                  // Only update if not already set by user
                  if (!prevExceptions[soldierId]?.[dateStr] || 
                      (prevExceptions[soldierId]?.[dateStr] && 
                       dutyExceptionCodes.includes(prevExceptions[soldierId][dateStr]))) {
                    newExceptions[soldierId][dateStr] = unavailability.exceptionCode;
                    conflictsFound++;
                    hasChanges = true;
                    console.log(`[Auto Cross-Roster] Found duty conflict from appointment: Soldier ${soldierId} on ${dateStr} - applying ${unavailability.exceptionCode}`);
                  }
                }
              }
            }
          }
          
          // Then, check each selected roster for conflicts
          for (const formId of selectedRostersForCheck) {
            const otherForm = otherForms.find(f => f.id === formId);
            if (!otherForm || !otherForm.form_data) continue;
            
            // Generate assignments for the other form to see actual duty assignments
            const otherFormAssignmentsMap = generateAssignmentsForOtherForm(otherForm);
            const otherFormDutyType = otherForm.form_data.duty_config?.nature_of_duty || 'Duty';
            
            // Check if soldier is assigned duty on this date in the other roster
            const hasDutyAssignment = otherFormAssignmentsMap[soldierId]?.[dateStr]?.duty === true;
            
            if (hasDutyAssignment) {
              // Determine appropriate exception code based on other form's duty type
              let exceptionCode = 'D'; // Default to 'D' for Detail
              
              if (otherFormDutyType === 'CQ' || otherFormDutyType === 'Charge of Quarters') {
                exceptionCode = 'CQ';
              } else if (otherFormDutyType === 'BN Staff Duty' || otherFormDutyType === 'Brigade Staff Duty' || otherFormDutyType.includes('Staff Duty')) {
                exceptionCode = 'SD';
              }
              
              // Only add if not already set by user (user-defined exceptions take precedence)
              if (!newExceptions[soldierId]) {
                newExceptions[soldierId] = {};
              }
              // Only set if not already set by user or if it's different
              const currentException = newExceptions[soldierId][dateStr];
              if (!currentException || currentException !== exceptionCode) {
                // Only update if it's not a user-defined exception (user exceptions take precedence)
                // If there's no current exception, or if the current one is also auto-generated, update it
                if (!prevExceptions[soldierId]?.[dateStr] || 
                    (prevExceptions[soldierId]?.[dateStr] && 
                     (prevExceptions[soldierId][dateStr] === 'CQ' || 
                      prevExceptions[soldierId][dateStr] === 'SD' || 
                      prevExceptions[soldierId][dateStr] === 'D'))) {
                  newExceptions[soldierId][dateStr] = exceptionCode;
                  conflictsFound++;
                  hasChanges = true;
                  console.log(`[Auto Cross-Roster] Found conflict: Soldier ${soldierId} on ${dateStr} - applying ${exceptionCode} from ${otherForm.unit_name}`);
                }
              }
            }
          }
        }
        
        current.setDate(current.getDate() + 1);
      }

      if (conflictsFound > 0 && hasChanges) {
        console.log(`[Auto Cross-Roster] Automatically applied ${conflictsFound} exception(s) from cross-roster conflicts and duty appointments`);
        return newExceptions;
      }
      
      // Return previous state if no changes
      return prevExceptions;
    });
  };

  const handleProfileUpdate = (soldierId) => {
    // Refresh appointments for the specific soldier when profile is updated
    if (soldierId) {
      fetchSoldierAppointments(soldierId);
    } else if (selectedSoldiers.size > 0) {
      // If no specific soldier, refresh for selected soldiers only
      const selectedSoldiersList = Array.from(selectedSoldiers)
        .map(id => soldiers.find(s => s.id === id))
        .filter(Boolean);
      fetchAllAppointments(selectedSoldiersList);
    }
  };

  const addException = (soldierId, date, exceptionCode) => {
    const newExceptions = { ...exceptions };
    if (!newExceptions[soldierId]) {
      newExceptions[soldierId] = {};
    }
    if (exceptionCode) {
      newExceptions[soldierId][date] = exceptionCode;
    } else {
      delete newExceptions[soldierId][date];
    }
    setExceptions(newExceptions);
  };

  // Helper function to generate assignments for another form (for cross-roster checking)
  // Must be defined before it's used in memoization
  // This generates assignments dynamically using the other form's form_data
  const generateAssignmentsForOtherForm = (otherForm) => {
    if (!otherForm?.form_data || !otherForm.period_start || !otherForm.period_end) return {};
    
    const assignmentsMap = {}; // { soldierId: { dateStr: assignment } }
    const start = new Date(otherForm.period_start);
    const end = new Date(otherForm.period_end);
    const current = new Date(start);
    
    const formSelectedSoldiers = otherForm.form_data.selected_soldiers || [];
    const formDutyConfig = otherForm.form_data.duty_config || {};
    const formExceptions = otherForm.form_data.exceptions || {};
    const soldiersPerDay = formDutyConfig.soldiers_per_day || 2;
    const daysOffAfterDuty = formDutyConfig.days_off_after_duty || 1;
    const rankRequirements = formDutyConfig.rank_requirements?.requirements || [];
    const globalExclusions = formDutyConfig.rank_requirements?.exclusions || { ranks: [], groups: [] };
    
    // Track last assignment dates for rotation
    const lastAssignmentDate = {};
    const lastWeekendAssignmentDate = {};
    const lastHolidayAssignmentDate = {};
    
    // Helper to check if date should be included
    const shouldIncludeDate = (date) => {
      const dateStr = date.toISOString().split('T')[0];
      const excludedDates = otherForm.form_data.excluded_dates || [];
      if (excludedDates.includes(dateStr)) return false;
      
      const isWeekendDay = date.getDay() === 0 || date.getDay() === 6;
      if (formDutyConfig.skip_weekends && isWeekendDay && !formDutyConfig.separate_weekend_cycle) {
        return false;
      }
      return true;
    };
    
    // Helper to check if soldier matches requirement
    const soldierMatchesRequirement = (soldier, requirement) => {
      const soldierRank = soldier.rank?.toUpperCase().trim();
      if (!soldierRank) return false;
      
      // Check global exclusions
      if (globalExclusions?.ranks && globalExclusions.ranks.includes(soldierRank)) return false;
      if (globalExclusions?.groups) {
        if (globalExclusions.groups.includes('lower_enlisted') && isLowerEnlisted(soldierRank)) return false;
        if (globalExclusions.groups.includes('nco') && isNCORank(soldierRank)) return false;
        if (globalExclusions.groups.includes('warrant') && isWarrantOfficerRank(soldierRank)) return false;
        if (globalExclusions.groups.includes('officer') && isOfficerRank(soldierRank)) return false;
      }
      
      // Check requirement-specific exclusions
      if (requirement.excluded_ranks && requirement.excluded_ranks.includes(soldierRank)) return false;
      
      // Check group requirement
      if (requirement.group) {
        switch (requirement.group) {
          case 'lower_enlisted':
            if (!isLowerEnlisted(soldierRank)) return false;
            break;
          case 'nco':
            if (!isNCORank(soldierRank)) return false;
            break;
          case 'warrant':
            if (!isWarrantOfficerRank(soldierRank)) return false;
            break;
          case 'officer':
            if (!isOfficerRank(soldierRank)) return false;
            break;
          default:
            return false;
        }
      }
      
      // Check rank range
      if (requirement.rank_range) {
        const [startRank, endRank] = requirement.rank_range.split('-').map(r => r.trim().toUpperCase());
        const ranksInRange = getRanksInRange(startRank, endRank);
        if (!ranksInRange.includes(soldierRank)) return false;
      }
      
      return true;
    };
    
    // Helper to check if soldier is in days-off period
    const isSoldierInDaysOff = (soldierId) => {
      const lastDateWeekday = lastAssignmentDate[soldierId];
      const lastDateWeekend = lastWeekendAssignmentDate[soldierId];
      const lastDateHoliday = lastHolidayAssignmentDate[soldierId];
      
      let mostRecentDate = lastDateWeekday;
      if (lastDateWeekend && (!mostRecentDate || lastDateWeekend > mostRecentDate)) {
        mostRecentDate = lastDateWeekend;
      }
      if (lastDateHoliday && (!mostRecentDate || lastDateHoliday > mostRecentDate)) {
        mostRecentDate = lastDateHoliday;
      }
      
      if (mostRecentDate) {
        const lastDateObj = new Date(mostRecentDate);
        const daysSince = Math.floor((current - lastDateObj) / (1000 * 60 * 60 * 24));
        return daysSince <= daysOffAfterDuty;
      }
      return false;
    };
    
    // Generate assignments for all dates
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      
      if (shouldIncludeDate(current)) {
        const selectedForDay = [];
        const availableSoldiers = formSelectedSoldiers
          .map(soldierId => soldiers.find(s => s.id === soldierId))
          .filter(s => s);
        
        // If rank requirements are specified, fill each requirement
        if (rankRequirements.length > 0) {
          for (const requirement of rankRequirements) {
            const quantity = requirement.quantity || 1;
            
            let matchingSoldiers = availableSoldiers.filter(soldier => 
              soldierMatchesRequirement(soldier, requirement) &&
              !selectedForDay.includes(soldier.id)
            );
            
            // Sort by days since last duty (most days first)
            matchingSoldiers.sort((a, b) => {
              const getDaysSince = (s) => {
                const lastDateWeekday = lastAssignmentDate[s.id];
                const lastDateWeekend = lastWeekendAssignmentDate[s.id];
                const lastDateHoliday = lastHolidayAssignmentDate[s.id];
                
                let mostRecentDate = lastDateWeekday;
                if (lastDateWeekend && (!mostRecentDate || lastDateWeekend > mostRecentDate)) {
                  mostRecentDate = lastDateWeekend;
                }
                if (lastDateHoliday && (!mostRecentDate || lastDateHoliday > mostRecentDate)) {
                  mostRecentDate = lastDateHoliday;
                }
                
                if (mostRecentDate) {
                  const lastDateObj = new Date(mostRecentDate);
                  return Math.floor((current - lastDateObj) / (1000 * 60 * 60 * 24));
                }
                return s.days_since_last_duty || 0;
              };
              
              const aDaysSince = getDaysSince(a);
              const bDaysSince = getDaysSince(b);
              if (aDaysSince !== bDaysSince) {
                return bDaysSince - aDaysSince;
              }
              
              const aRankOrder = getRankOrder(a.rank?.toUpperCase().trim());
              const bRankOrder = getRankOrder(b.rank?.toUpperCase().trim());
              if (aRankOrder !== bRankOrder) {
                return aRankOrder - bRankOrder;
              }
              
              return (a.last_name || '').localeCompare(b.last_name || '');
            });
            
            // Select soldiers for this requirement
            let selectedForRequirement = 0;
            for (const soldier of matchingSoldiers) {
              if (selectedForRequirement >= quantity || selectedForDay.length >= soldiersPerDay) break;
              
              // Check exceptions
              const soldierExceptions = formExceptions[soldier.id] || {};
              if (soldierExceptions[dateStr]) continue;
              
              // Check days off
              if (isSoldierInDaysOff(soldier.id)) continue;
              
              selectedForDay.push(soldier.id);
              lastAssignmentDate[soldier.id] = dateStr;
              selectedForRequirement++;
            }
            
            if (selectedForDay.length >= soldiersPerDay) break;
          }
        } else {
          // No rank requirements - select any available soldiers
          const availableRemaining = availableSoldiers.filter(soldier => {
            const soldierExceptions = formExceptions[soldier.id] || {};
            if (soldierExceptions[dateStr]) return false;
            if (isSoldierInDaysOff(soldier.id)) return false;
            return true;
          });
          
          availableRemaining.sort((a, b) => {
            const getDaysSince = (s) => {
              const lastDate = lastAssignmentDate[s.id];
              if (lastDate) {
                const lastDateObj = new Date(lastDate);
                return Math.floor((current - lastDateObj) / (1000 * 60 * 60 * 24));
              }
              return s.days_since_last_duty || 0;
            };
            
            const aDaysSince = getDaysSince(a);
            const bDaysSince = getDaysSince(b);
            if (aDaysSince !== bDaysSince) {
              return bDaysSince - aDaysSince;
            }
            
            const aRankOrder = getRankOrder(a.rank?.toUpperCase().trim());
            const bRankOrder = getRankOrder(b.rank?.toUpperCase().trim());
            if (aRankOrder !== bRankOrder) {
              return aRankOrder - bRankOrder;
            }
            
            return (a.last_name || '').localeCompare(b.last_name || '');
          });
          
          for (const soldier of availableRemaining) {
            if (selectedForDay.length >= soldiersPerDay) break;
            selectedForDay.push(soldier.id);
            lastAssignmentDate[soldier.id] = dateStr;
          }
        }
        
        // Add assignments to map
        selectedForDay.forEach(soldierId => {
          if (!assignmentsMap[soldierId]) {
            assignmentsMap[soldierId] = {};
          }
          assignmentsMap[soldierId][dateStr] = { duty: true, exception_code: null };
        });
      }
      
      current.setDate(current.getDate() + 1);
    }
    
    return assignmentsMap;
  };

  // Generate assignments once and memoize for days-off checking
  const generatedAssignmentsRef = useRef(null);
  const assignmentsKey = `${formData.period_start}-${formData.period_end}-${Array.from(selectedSoldiers).join(',')}-${JSON.stringify(formData.duty_config)}-${JSON.stringify(exceptions)}`;
  
  if (!generatedAssignmentsRef.current || generatedAssignmentsRef.current.key !== assignmentsKey) {
    generatedAssignmentsRef.current = {
      key: assignmentsKey,
      assignments: generateAssignments()
    };
  }
  const generatedAssignments = generatedAssignmentsRef.current.assignments;

  // Memoize other form assignments for cross-roster checking
  const otherFormAssignmentsRef = useRef({});
  const otherFormsKey = otherForms.length > 0 
    ? otherForms.map(f => `${f.id}-${f.updated_at || ''}`).sort().join(',')
    : '';
  const crossRosterKey = crossRosterCheckEnabled && selectedRostersForCheck.size > 0
    ? `${otherFormsKey}-${Array.from(selectedRostersForCheck).sort().join(',')}`
    : '';
  
  // Pre-generate assignments for all other forms once
  // Force regeneration when cross-roster checking is enabled or rosters change
  if (crossRosterCheckEnabled && selectedRostersForCheck.size > 0 && otherForms.length > 0) {
    // Always regenerate to ensure we have the latest data
    const otherFormAssignmentsMap = {};
    const otherFormDutyTypes = {};
    
    console.log(`[Cross-Roster] Generating assignments for ${selectedRostersForCheck.size} selected roster(s)`);
    
    selectedRostersForCheck.forEach(formId => {
      const otherForm = otherForms.find(f => f.id === formId);
      if (otherForm) {
        console.log(`[Cross-Roster] Processing form ${formId}: ${otherForm.unit_name}`);
        console.log(`[Cross-Roster] Form has ${otherForm.form_data?.assignments?.length || 0} stored assignments`);
        
        const assignments = generateAssignmentsForOtherForm(otherForm);
        otherFormAssignmentsMap[formId] = assignments;
        otherFormDutyTypes[formId] = otherForm.form_data.duty_config?.nature_of_duty || 'Duty';
        
        // Debug logging
        const assignmentCount = Object.values(assignments).reduce((sum, soldierDates) => {
          return sum + Object.keys(soldierDates).length;
        }, 0);
        console.log(`[Cross-Roster] Form ${formId} (${otherForm.unit_name}): ${assignmentCount} duty assignments found`);
        
        // Log sample assignments
        if (assignmentCount > 0) {
          const sampleEntries = Object.entries(assignments).slice(0, 3);
          sampleEntries.forEach(([soldierId, dates]) => {
            const dateStrs = Object.keys(dates).slice(0, 5);
            console.log(`[Cross-Roster]   Soldier ${soldierId}: ${dateStrs.join(', ')}`);
          });
        }
      } else {
        console.warn(`[Cross-Roster] Form ${formId} not found in otherForms`);
      }
    });
    
    otherFormAssignmentsRef.current[crossRosterKey] = {
      assignments: otherFormAssignmentsMap,
      dutyTypes: otherFormDutyTypes
    };
    
    console.log(`[Cross-Roster] Cache updated with key: ${crossRosterKey}`);
  } else {
    console.log(`[Cross-Roster] Skipping generation - enabled: ${crossRosterCheckEnabled}, rosters: ${selectedRostersForCheck.size}, forms: ${otherForms.length}`);
  }
  
  const cachedOtherFormData = crossRosterCheckEnabled && selectedRostersForCheck.size > 0 && otherForms.length > 0
    ? otherFormAssignmentsRef.current[crossRosterKey]
    : null;

  const getExceptionForDate = (soldierId, date) => {
    // First check user-defined exceptions (these take precedence)
    const userException = exceptions[soldierId]?.[date];
    if (userException) {
      return userException;
    }
    
    // Check for cross-roster conflicts if cross-roster checking is enabled
    // Use cached assignments instead of regenerating on every call
    if (cachedOtherFormData) {
      const dateStr = date;
      const selectedRostersForCheckArray = Array.from(selectedRostersForCheck);
      
      for (const formId of selectedRostersForCheckArray) {
        const otherFormAssignmentsMap = cachedOtherFormData.assignments[formId];
        if (!otherFormAssignmentsMap) {
          console.log(`[Cross-Roster] No assignments map for form ${formId}`);
          continue;
        }
        
        // Check if soldier is assigned duty on this date in the other roster
        const soldierAssignments = otherFormAssignmentsMap[soldierId];
        const hasDutyAssignment = soldierAssignments?.[dateStr]?.duty === true;
        
        if (hasDutyAssignment) {
          // Determine appropriate exception code based on other form's duty type
          const otherFormDutyType = cachedOtherFormData.dutyTypes[formId] || 'Duty';
          let exceptionCode = 'D'; // Default to 'D' for Detail
          
          if (otherFormDutyType === 'CQ' || otherFormDutyType === 'Charge of Quarters') {
            exceptionCode = 'CQ';
          } else if (otherFormDutyType === 'BN Staff Duty' || otherFormDutyType === 'Brigade Staff Duty' || otherFormDutyType.includes('Staff Duty')) {
            exceptionCode = 'SD';
          }
          
          console.log(`[Cross-Roster] Found conflict: Soldier ${soldierId} on ${dateStr} - applying ${exceptionCode}`);
          return exceptionCode;
        }
      }
    }
    
    // Then check generated assignments for days-off after duty (exception code 'P')
    const assignment = generatedAssignments.find(a => 
      a.soldier_id === soldierId && 
      a.date === date
    );
    
    if (assignment && assignment.exception_code === 'P') {
      return 'P'; // Days off after duty
    }
    
    return '';
  };

  const getDatesInRange = () => {
    if (!formData.period_start || !formData.period_end) return [];
    
    const dates = [];
    const start = new Date(formData.period_start);
    const end = new Date(formData.period_end);
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

  const performCrossRosterCheck = async () => {
    // Cross-roster checking is now automatic during generation
    // This function shows info about automatic checking
    const enabledCount = selectedRostersForCheck.size;
    if (enabledCount === 0) {
      alert('No rosters selected for cross-roster checking. Enable cross-roster checking and select rosters to automatically skip soldiers already assigned duty in those rosters.');
    } else {
      alert(`Cross-roster checking is enabled for ${enabledCount} roster(s). The roster will automatically skip soldiers who are already assigned duty in the selected rosters and apply appropriate exception codes (CQ, SD, or D).`);
    }
  };

  if (loading) {
    return <LoadingScreen message="Loading form..." />;
  }
  
  if (saving) {
    return <LoadingScreen message="Saving form..." subMessage="Please wait while we save your changes." />;
  }
  
  if (updatingSoldiers) {
    return <LoadingScreen message="Updating soldier records..." subMessage="Calculating days since last duty for all soldiers." />;
  }
  
  if (recalculating) {
    return <LoadingScreen message="Recalculating duty history..." subMessage="This may take a moment for large rosters." />;
  }

  return (
    <Layout>
      <div className="da6-form-container">
      <div className="form-header">
        <h2>{id ? 'Edit DA6 Form' : 'Create New DA6 Form'}</h2>
        <div className="form-actions-header">
          <button className="btn-secondary" onClick={() => navigate('/forms')}>
            Back
          </button>
          <button className="btn-primary" onClick={() => handleSave('draft')}>
            Submit Form
          </button>
          {formData.status !== 'cancelled' && (
            <button 
              className="btn-danger" 
              onClick={handleCancel}
              style={{ backgroundColor: '#dc3545', color: 'white' }}
            >
              Cancel Form
            </button>
          )}
        </div>
      </div>

      <div className="form-content">
        <div className="form-section">
          <h3>Form Information</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Unit Name *</label>
              <input
                type="text"
                required
                value={formData.unit_name}
                onChange={(e) => setFormData({ ...formData, unit_name: e.target.value })}
                placeholder="e.g., 1st Battalion, 123rd Infantry"
              />
            </div>
            <div className="form-group">
              <label>Period Start *</label>
              <input
                type="date"
                required
                value={formData.period_start}
                onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Period End *</label>
              <input
                type="date"
                required
                value={formData.period_end}
                onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>Duty Configuration</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Duty Template</label>
              <select
                value={selectedTemplate}
                onChange={(e) => {
                  const templateKey = e.target.value;
                  const template = getDutyTemplate(templateKey);
                  setSelectedTemplate(templateKey);
                  
                  // Convert template requirements to new rank_requirements format
                  const requirements = [];
                  if (template.requirements?.lower_enlisted) {
                    requirements.push({
                      quantity: template.requirements.lower_enlisted,
                      group: 'lower_enlisted'
                    });
                  }
                  if (template.requirements?.nco) {
                    requirements.push({
                      quantity: template.requirements.nco,
                      group: 'nco',
                      rank_range: 'SGT-SSG' // Default range for NCO
                    });
                  }
                  if (template.requirements?.sfc_msg || template.requirements?.sfc) {
                    requirements.push({
                      quantity: template.requirements.sfc_msg || template.requirements.sfc,
                      group: 'nco',
                      rank_range: 'SFC-MSG'
                    });
                  }
                  if (template.requirements?.officer) {
                    requirements.push({
                      quantity: template.requirements.officer,
                      group: 'officer'
                    });
                  }
                  if (template.requirements?.warrant) {
                    requirements.push({
                      quantity: template.requirements.warrant,
                      group: 'warrant'
                    });
                  }
                  
                  setFormData({
                    ...formData,
                    duty_config: {
                      ...formData.duty_config,
                      nature_of_duty: template.nature_of_duty || '',
                      soldiers_per_day: template.soldiers_per_day || formData.duty_config.soldiers_per_day,
                      days_off_after_duty: template.days_off_after_duty || formData.duty_config.days_off_after_duty,
                      rank_requirements: {
                        requirements: requirements,
                        exclusions: formData.duty_config.rank_requirements?.exclusions || { ranks: [], groups: [] }
                      }
                    }
                  });
                }}
              >
                {Object.entries(DUTY_TEMPLATES).map(([key, template]) => (
                  <option key={key} value={key}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Nature of Duty *</label>
              <input
                type="text"
                required
                value={formData.duty_config.nature_of_duty}
                onChange={(e) => setFormData({
                  ...formData,
                  duty_config: { ...formData.duty_config, nature_of_duty: e.target.value }
                })}
                placeholder="e.g., CQ, BN Staff Duty"
              />
            </div>
            <div className="form-group">
              <label>Soldiers Per Day *</label>
              <input
                type="number"
                required
                min="1"
                value={formData.duty_config.soldiers_per_day}
                onChange={(e) => setFormData({
                  ...formData,
                  duty_config: { ...formData.duty_config, soldiers_per_day: parseInt(e.target.value) || 1 }
                })}
              />
            </div>
            <div className="form-group">
              <label>Days Off After Duty *</label>
              <input
                type="number"
                required
                min="0"
                value={formData.duty_config.days_off_after_duty}
                onChange={(e) => setFormData({
                  ...formData,
                  duty_config: { ...formData.duty_config, days_off_after_duty: parseInt(e.target.value) || 0 }
                })}
              />
            </div>
          </div>
          <div className="form-section-subsection">
            <h4>Rank Requirements Per Day</h4>
            <p className="section-description">
              Specify rank requirements using groups and ranges. You can set preferences and exclusions.
            </p>
            
            {/* Requirements List */}
            <div className="rank-requirements-list">
              <h5>Requirements</h5>
              {(formData.duty_config.rank_requirements?.requirements || []).map((req, idx) => (
                <div key={idx} className="rank-requirement-item">
                  <div className="requirement-main">
                    <input
                      type="number"
                      min="1"
                      value={req.quantity || 1}
                      onChange={(e) => {
                        const newReqs = [...(formData.duty_config.rank_requirements?.requirements || [])];
                        newReqs[idx].quantity = parseInt(e.target.value) || 1;
                        setFormData({
                          ...formData,
                          duty_config: {
                            ...formData.duty_config,
                            rank_requirements: {
                              ...formData.duty_config.rank_requirements,
                              requirements: newReqs
                            }
                          }
                        });
                      }}
                      className="requirement-quantity"
                    />
                    <span className="requirement-label">x</span>
                    <select
                      value={req.group || ''}
                      onChange={(e) => {
                        const newReqs = [...(formData.duty_config.rank_requirements?.requirements || [])];
                        newReqs[idx].group = e.target.value;
                        delete newReqs[idx].rank_range; // Clear range when group changes
                        setFormData({
                          ...formData,
                          duty_config: {
                            ...formData.duty_config,
                            rank_requirements: {
                              ...formData.duty_config.rank_requirements,
                              requirements: newReqs
                            }
                          }
                        });
                      }}
                      className="requirement-group-select"
                    >
                      <option value="lower_enlisted">Lower Enlisted (PVT-SPC)</option>
                      <option value="nco">NCO (CPL-CSM)</option>
                      <option value="warrant">Warrant Officer</option>
                      <option value="officer">Officer</option>
                    </select>
                    {req.group === 'nco' && (
                      <>
                        <span className="requirement-label">Rank Range:</span>
                        <select
                          value={req.rank_range || ''}
                          onChange={(e) => {
                            const newReqs = [...(formData.duty_config.rank_requirements?.requirements || [])];
                            newReqs[idx].rank_range = e.target.value || undefined;
                            setFormData({
                              ...formData,
                              duty_config: {
                                ...formData.duty_config,
                                rank_requirements: {
                                  ...formData.duty_config.rank_requirements,
                                  requirements: newReqs
                                }
                              }
                            });
                          }}
                          className="requirement-range-select"
                        >
                          <option value="">Any NCO</option>
                          <option value="CPL-SGT">CPL - SGT</option>
                          <option value="SGT-SSG">SGT - SSG</option>
                          <option value="SSG-SFC">SSG - SFC</option>
                          <option value="SFC-MSG">SFC - MSG</option>
                          <option value="MSG-CSM">MSG - CSM</option>
                        </select>
                      </>
                    )}
                    <button
                      type="button"
                      className="btn-delete-small"
                      onClick={() => {
                        const newReqs = [...(formData.duty_config.rank_requirements?.requirements || [])];
                        newReqs.splice(idx, 1);
                        setFormData({
                          ...formData,
                          duty_config: {
                            ...formData.duty_config,
                            rank_requirements: {
                              ...formData.duty_config.rank_requirements,
                              requirements: newReqs
                            }
                          }
                        });
                      }}
                    >
                      Remove
                    </button>
                  </div>
                  <div className="requirement-preferences">
                    <label>
                      Preferred Ranks (comma-separated, e.g., SSG, SFC):
                      <input
                        type="text"
                        value={req.preferred_ranks_raw !== undefined ? req.preferred_ranks_raw : (req.preferred_ranks || []).join(', ')}
                        onChange={(e) => {
                          const newReqs = [...(formData.duty_config.rank_requirements?.requirements || [])];
                          const rawValue = e.target.value;
                          newReqs[idx].preferred_ranks_raw = rawValue;
                          newReqs[idx].preferred_ranks = rawValue.split(',').map(r => r.trim().toUpperCase()).filter(r => r);
                          setFormData({
                            ...formData,
                            duty_config: {
                              ...formData.duty_config,
                              rank_requirements: {
                                ...formData.duty_config.rank_requirements,
                                requirements: newReqs
                              }
                            }
                          });
                        }}
                        onBlur={(e) => {
                          // Clean up trailing commas on blur
                          const newReqs = [...(formData.duty_config.rank_requirements?.requirements || [])];
                          const cleanedValue = e.target.value.trim().replace(/,\s*$/, '');
                          if (cleanedValue !== e.target.value) {
                            newReqs[idx].preferred_ranks_raw = cleanedValue;
                            newReqs[idx].preferred_ranks = cleanedValue.split(',').map(r => r.trim().toUpperCase()).filter(r => r);
                            setFormData({
                              ...formData,
                              duty_config: {
                                ...formData.duty_config,
                                rank_requirements: {
                                  ...formData.duty_config.rank_requirements,
                                  requirements: newReqs
                                }
                              }
                            });
                          }
                        }}
                        placeholder="SSG, SFC"
                        className="preferred-ranks-input"
                      />
                    </label>
                    <label>
                      Fallback Ranks (if preferred not available):
                      <input
                        type="text"
                        value={req.fallback_ranks_raw !== undefined ? req.fallback_ranks_raw : (req.fallback_ranks || []).join(', ')}
                        onChange={(e) => {
                          const newReqs = [...(formData.duty_config.rank_requirements?.requirements || [])];
                          const rawValue = e.target.value;
                          newReqs[idx].fallback_ranks_raw = rawValue;
                          newReqs[idx].fallback_ranks = rawValue.split(',').map(r => r.trim().toUpperCase()).filter(r => r);
                          setFormData({
                            ...formData,
                            duty_config: {
                              ...formData.duty_config,
                              rank_requirements: {
                                ...formData.duty_config.rank_requirements,
                                requirements: newReqs
                              }
                            }
                          });
                        }}
                        onBlur={(e) => {
                          // Clean up trailing commas on blur
                          const newReqs = [...(formData.duty_config.rank_requirements?.requirements || [])];
                          const cleanedValue = e.target.value.trim().replace(/,\s*$/, '');
                          if (cleanedValue !== e.target.value) {
                            newReqs[idx].fallback_ranks_raw = cleanedValue;
                            newReqs[idx].fallback_ranks = cleanedValue.split(',').map(r => r.trim().toUpperCase()).filter(r => r);
                            setFormData({
                              ...formData,
                              duty_config: {
                                ...formData.duty_config,
                                rank_requirements: {
                                  ...formData.duty_config.rank_requirements,
                                  requirements: newReqs
                                }
                              }
                            });
                          }
                        }}
                        placeholder="SGT, CPL"
                        className="fallback-ranks-input"
                      />
                    </label>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  const newReqs = [...(formData.duty_config.rank_requirements?.requirements || []), {
                    quantity: 1,
                    group: 'lower_enlisted'
                  }];
                  setFormData({
                    ...formData,
                    duty_config: {
                      ...formData.duty_config,
                      rank_requirements: {
                        ...formData.duty_config.rank_requirements,
                        requirements: newReqs
                      }
                    }
                  });
                }}
              >
                + Add Requirement
              </button>
            </div>

            {/* Exclusions */}
            <div className="rank-exclusions">
              <h5>Exclusions</h5>
              <p className="section-description">
                Ranks or groups that cannot be assigned to this duty.
              </p>
              <div className="exclusions-section">
                <div className="exclusion-groups">
                  <label>Exclude Groups:</label>
                  {['lower_enlisted', 'nco', 'warrant', 'officer'].map(group => (
                    <label key={group} className="exclusion-checkbox">
                      <input
                        type="checkbox"
                        checked={(formData.duty_config.rank_requirements?.exclusions?.groups || []).includes(group)}
                        onChange={(e) => {
                          const currentGroups = formData.duty_config.rank_requirements?.exclusions?.groups || [];
                          const newGroups = e.target.checked
                            ? [...currentGroups, group]
                            : currentGroups.filter(g => g !== group);
                          setFormData({
                            ...formData,
                            duty_config: {
                              ...formData.duty_config,
                              rank_requirements: {
                                ...formData.duty_config.rank_requirements,
                                exclusions: {
                                  ...formData.duty_config.rank_requirements.exclusions,
                                  groups: newGroups
                                }
                              }
                            }
                          });
                        }}
                      />
                      {group === 'lower_enlisted' ? 'Lower Enlisted' :
                       group === 'nco' ? 'NCO' :
                       group === 'warrant' ? 'Warrant Officer' : 'Officer'}
                    </label>
                  ))}
                </div>
                <div className="exclusion-ranks">
                  <label>
                    Exclude Specific Ranks (comma-separated):
                    <input
                      type="text"
                      value={formData.duty_config.rank_requirements?.exclusions?.ranks_raw !== undefined 
                        ? formData.duty_config.rank_requirements.exclusions.ranks_raw 
                        : (formData.duty_config.rank_requirements?.exclusions?.ranks || []).join(', ')}
                      onChange={(e) => {
                        const rawValue = e.target.value;
                        const ranks = rawValue.split(',').map(r => r.trim().toUpperCase()).filter(r => r);
                        setFormData({
                          ...formData,
                          duty_config: {
                            ...formData.duty_config,
                            rank_requirements: {
                              ...formData.duty_config.rank_requirements,
                              exclusions: {
                                ...formData.duty_config.rank_requirements.exclusions,
                                ranks: ranks,
                                ranks_raw: rawValue
                              }
                            }
                          }
                        });
                      }}
                      onBlur={(e) => {
                        // Clean up trailing commas on blur
                        const cleanedValue = e.target.value.trim().replace(/,\s*$/, '');
                        if (cleanedValue !== e.target.value) {
                          const ranks = cleanedValue.split(',').map(r => r.trim().toUpperCase()).filter(r => r);
                          setFormData({
                            ...formData,
                            duty_config: {
                              ...formData.duty_config,
                              rank_requirements: {
                                ...formData.duty_config.rank_requirements,
                                exclusions: {
                                  ...formData.duty_config.rank_requirements.exclusions,
                                  ranks: ranks,
                                  ranks_raw: cleanedValue
                                }
                              }
                            }
                          });
                        }
                      }}
                      placeholder="PVT, PV2"
                      className="excluded-ranks-input"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.duty_config.skip_weekends}
                  onChange={(e) => setFormData({
                    ...formData,
                    duty_config: { ...formData.duty_config, skip_weekends: e.target.checked }
                  })}
                />
                Skip Weekends
              </label>
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.duty_config.separate_weekend_cycle}
                  onChange={(e) => setFormData({
                    ...formData,
                    duty_config: { ...formData.duty_config, separate_weekend_cycle: e.target.checked }
                  })}
                />
                Separate Weekend Cycle (treat weekends and holidays as separate roster from weekdays)
              </label>
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.duty_config.separate_holiday_cycle}
                  onChange={(e) => setFormData({
                    ...formData,
                    duty_config: { ...formData.duty_config, separate_holiday_cycle: e.target.checked }
                  })}
                />
                Separate Holiday Cycle (treat holidays as separate roster)
              </label>
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="section-header">
            <div>
              <h3>Select Soldiers for Duty Roster</h3>
              <p className="section-description">
                Select which soldiers will be on this duty roster. Click a soldier's name to view their profile and appointments.
              </p>
            </div>
            {soldiers.length > 0 && (
              <label className="select-all-checkbox">
                <input
                  type="checkbox"
                  checked={selectedSoldiers.size === soldiers.length && soldiers.length > 0}
                  onChange={toggleSelectAll}
                />
                <span>Select All ({selectedSoldiers.size}/{soldiers.length})</span>
              </label>
            )}
          </div>
          
          {soldiers.length === 0 ? (
            <div className="empty-state">
              <p>No soldiers available. <a href="/soldiers">Add soldiers</a> first.</p>
            </div>
          ) : (
            <div className="soldiers-selection-grid">
              {soldiers.map(soldier => {
                const appointments = getAppointmentsForSoldier(soldier.id);
                const hasAppointments = appointments.length > 0;
                const hasUnavailabilityInRange = formData.period_start && formData.period_end && 
                  getDatesInRange().some(date => isSoldierUnavailableOnDate(soldier.id, date));
                
                return (
                  <div key={soldier.id} className="soldier-selection-item">
                    <label className="soldier-checkbox-item">
                      <input
                        type="checkbox"
                        checked={selectedSoldiers.has(soldier.id)}
                        onChange={(e) => toggleSoldierSelection(soldier.id, e)}
                      />
                      <span className="soldier-label">
                        <strong>{soldier.rank}</strong> {soldier.first_name} {soldier.middle_initial} {soldier.last_name}
                      </span>
                    </label>
                    <div className="soldier-item-actions">
                      {hasAppointments && (
                        <Tooltip text={`${appointments.length} appointment(s) scheduled for this soldier. Click Profile to view details.`}>
                          <span className="appointments-badge">
                            📅 {appointments.length}
                          </span>
                        </Tooltip>
                      )}
                      {hasUnavailabilityInRange && (
                        <Tooltip text={`This soldier has appointments or unavailability during the selected period. Click Profile to view details.`}>
                          <span className="unavailable-badge">
                            ⚠️
                          </span>
                        </Tooltip>
                      )}
                      <Tooltip text="View soldier profile, manage appointments, and edit days since last duty">
                        <button
                          className="btn-profile"
                          onClick={() => setSelectedProfileSoldier(soldier)}
                        >
                          Profile
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {formData.period_start && formData.period_end && (
          <div className="form-section">
            <h3>Holidays & Excluded Dates</h3>
            <p className="section-description">
              Manage holidays and mark dates where no one is needed from this roster.
            </p>
            <div className="form-row">
            <div className="form-group">
              <p className="section-description">
                Holidays are managed in the <a href="/settings" target="_blank">Settings</a> page. 
                Federal holidays are automatically included based on the US calendar.
              </p>
            </div>
          </div>
          {holidays.length > 0 && (
            <div className="holidays-list">
              <h4>Holidays in Period:</h4>
              <ul>
                {holidays
                  .filter(h => {
                    const holidayDate = typeof h === 'string' ? h : h.date;
                    if (!formData.period_start || !formData.period_end) return false;
                    const date = new Date(holidayDate);
                    const start = new Date(formData.period_start);
                    const end = new Date(formData.period_end);
                    return date >= start && date <= end;
                  })
                  .map((holiday, idx) => {
                    const holidayDate = typeof holiday === 'string' ? holiday : holiday.date;
                    const holidayName = typeof holiday === 'string' ? 'Holiday' : (holiday.name || 'Holiday');
                    return (
                      <li key={idx}>
                        {holidayName} - {new Date(holidayDate).toLocaleDateString()}
                      </li>
                    );
                  })}
              </ul>
            </div>
          )}
            <div className="form-row">
              <div className="form-group">
                <label>Exclude Date (no one needed)</label>
                <input
                  type="date"
                  id="exclude-date"
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    const dateInput = document.getElementById('exclude-date');
                    if (dateInput.value) {
                      setExcludedDates(new Set([...excludedDates, dateInput.value]));
                      dateInput.value = '';
                    }
                  }}
                >
                  Exclude Date
                </button>
              </div>
            </div>
            {excludedDates.size > 0 && (
              <div className="excluded-dates-list">
                <h4>Excluded Dates:</h4>
                <ul>
                  {Array.from(excludedDates).map((date, idx) => (
                    <li key={idx}>
                      {new Date(date).toLocaleDateString()}
                      <button
                        type="button"
                        className="btn-delete-small"
                        onClick={() => {
                          const newExcluded = new Set(excludedDates);
                          newExcluded.delete(date);
                          setExcludedDates(newExcluded);
                        }}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {selectedSoldiers.size > 0 && formData.period_start && formData.period_end && (
          <div className="form-section">
            <h3>Cross-Roster Checking</h3>
            <p className="section-description">
              <strong>Automatic cross-roster checking is enabled by default.</strong> The system automatically checks all other DA6 forms in your account and applies appropriate exception codes (CQ, SD, or D) to prevent scheduling conflicts. Exception codes are automatically added before generating assignments to ensure soldiers' previous commitments are respected.
            </p>
            {otherForms.length > 0 ? (
              <p className="section-description" style={{ color: '#28a745', fontWeight: 'bold' }}>
                ✓ Automatically checking {otherForms.length} other roster(s) for conflicts
              </p>
            ) : (
              <p className="section-description" style={{ color: '#6c757d' }}>
                No other rosters found. Cross-roster checking will activate when other rosters are created.
              </p>
            )}
            <div className="form-row">
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={crossRosterCheckEnabled}
                    onChange={(e) => {
                      setCrossRosterCheckEnabled(e.target.checked);
                      // Clear cache to force regeneration
                      if (e.target.checked) {
                        otherFormAssignmentsRef.current = {};
                      }
                    }}
                  />
                  Enable Cross-Roster Checking
                </label>
              </div>
            </div>
            {crossRosterCheckEnabled && otherForms.length > 0 && (
              <div className="form-row">
                <div className="form-group">
                  <label>Select Rosters to Check (all selected by default):</label>
                  <div style={{ marginTop: '8px' }}>
                    <label style={{ display: 'block', marginBottom: '8px' }}>
                      <input
                        type="checkbox"
                        checked={selectedRostersForCheck.size === otherForms.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            // Select all
                            setSelectedRostersForCheck(new Set(otherForms.map(f => f.id)));
                          } else {
                            // Deselect all
                            setSelectedRostersForCheck(new Set());
                          }
                        }}
                      />
                      <strong>Select/Deselect All</strong>
                    </label>
                    {otherForms.map(form => (
                      <label key={form.id} style={{ display: 'block', marginLeft: '20px', marginBottom: '4px' }}>
                        <input
                          type="checkbox"
                          checked={selectedRostersForCheck.has(form.id)}
                          onChange={(e) => {
                            const newSet = new Set(selectedRostersForCheck);
                            if (e.target.checked) {
                              newSet.add(form.id);
                            } else {
                              newSet.delete(form.id);
                            }
                            setSelectedRostersForCheck(newSet);
                          }}
                        />
                        {form.unit_name} ({new Date(form.period_start).toLocaleDateString()} - {new Date(form.period_end).toLocaleDateString()})
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {crossRosterCheckEnabled && selectedRostersForCheck.size > 0 && (
              <Tooltip text="Cross-roster checking automatically prevents double-booking by applying exception codes (CQ, SD, D) when soldiers are already assigned duty in other rosters. This happens automatically during roster generation.">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={performCrossRosterCheck}
                >
                  Check Status
                </button>
              </Tooltip>
            )}
          </div>
        )}

        {selectedSoldiers.size > 0 && formData.period_start && formData.period_end && (
          <div className="form-section">
            <h3>Date Exceptions</h3>
            <p className="section-description">
              Add exceptions for dates when soldiers cannot perform duty. Use the exception codes below.
            </p>
            
            <div className="exception-codes-reference">
              <h4>Exception Codes:</h4>
              <div className="exception-codes-grid">
                {getExceptionCodesList().map(({ code, name }) => (
                  <div key={code} className="exception-code-item">
                    <strong>{code}:</strong> {name.split(' - ')[1]}
                  </div>
                ))}
              </div>
            </div>

            <div className="exceptions-table-container">
              <table className="exceptions-table">
                <thead>
                  <tr>
                    <th>Soldier</th>
                    {getDatesInRange().map((date, idx) => {
                      const isWeekendDay = isWeekend(date);
                      const isHolidayDay = isHoliday(date);
                      const dateStr = date.toISOString().split('T')[0];
                      const isExcluded = excludedDates.has(dateStr);
                      return (
                        <th 
                          key={idx} 
                          className={`${isWeekendDay ? 'weekend-header' : ''} ${isHolidayDay ? 'holiday-header' : ''} ${isExcluded ? 'excluded-header' : ''}`}
                          title={formatDateShort(date)}
                        >
                          {date.getDate()}
                          {isHolidayDay && ' 🎉'}
                          {isExcluded && ' ✗'}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {Array.from(selectedSoldiers).map(soldierId => {
                    const soldier = soldiers.find(s => s.id === soldierId);
                    if (!soldier) return null;
                    
                    return (
                      <tr key={soldierId}>
                        <td className="soldier-name-cell">
                          {soldier.rank} {soldier.first_name} {soldier.last_name}
                        </td>
                        {getDatesInRange().map((date, dateIdx) => {
                          const dateStr = date.toISOString().split('T')[0];
                          const isWeekendDay = isWeekend(date);
                          const isHolidayDay = isHoliday(date);
                          const isExcluded = excludedDates.has(dateStr);
                          const shouldShow = shouldIncludeDate(date);
                          const currentException = getExceptionForDate(soldierId, dateStr);
                          // Check if this is a cross-roster exception (not user-defined)
                          const isCrossRosterException = crossRosterCheckEnabled && 
                            selectedRostersForCheck.size > 0 && 
                            !exceptions[soldierId]?.[dateStr] &&
                            (currentException === 'CQ' || currentException === 'SD' || currentException === 'D');
                          
                          return (
                            <td 
                              key={dateIdx} 
                              className={`${isWeekendDay ? 'weekend-cell' : ''} ${isHolidayDay ? 'holiday-cell' : ''} ${isExcluded ? 'excluded-cell' : ''} ${isCrossRosterException ? 'cross-roster-exception' : ''}`}
                            >
                              {shouldShow && (
                                <Tooltip text={isCrossRosterException ? 'Cross-roster conflict: This soldier is already assigned duty in another roster on this date. Exception code automatically applied.' : 'Select an exception code for this date, or leave blank for normal duty assignment.'}>
                                  <select
                                    value={currentException}
                                    onChange={(e) => addException(soldierId, dateStr, e.target.value)}
                                    className={`exception-select ${isCrossRosterException ? 'cross-roster' : ''}`}
                                  >
                                    <option value="">-</option>
                                    {Object.entries(EXCEPTION_CODES).map(([code, name]) => (
                                      <option key={code} value={code}>
                                        {code}
                                      </option>
                                    ))}
                                  </select>
                                </Tooltip>
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
          </div>
        )}
      </div>
      </div>

      {selectedProfileSoldier && (
        <SoldierProfile
          soldier={selectedProfileSoldier}
          onClose={() => setSelectedProfileSoldier(null)}
          onUpdate={handleProfileUpdate}
        />
      )}
    </Layout>
  );
};

export default DA6Form;

