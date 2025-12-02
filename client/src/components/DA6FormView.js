import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../utils/api';
import { sortSoldiersByRank, isLowerEnlisted, isNCORank, isWarrantOfficerRank, isOfficerRank, getRanksInRange, getRankOrder } from '../utils/rankOrder';
import Layout from './Layout';
import './DA6FormView.css';

const DA6FormView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [soldiers, setSoldiers] = useState([]);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'compact'
  const [soldierAppointments, setSoldierAppointments] = useState({}); // { soldierId: [appointments] }
  const [otherForms, setOtherForms] = useState([]); // For cross-roster checking
  const [assignmentsMap, setAssignmentsMap] = useState({}); // { soldierId: { dateStr: assignment } }

  useEffect(() => {
    fetchForm();
    fetchSoldiers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    // Fetch other forms if cross-roster checking was enabled
    if (form?.form_data?.cross_roster_check_enabled && form?.form_data?.selected_rosters_for_check) {
      fetchOtherForms(form.form_data.selected_rosters_for_check);
    }
  }, [form]);

  // Track if we've already synced appointments to prevent re-syncing on every render
  const hasSyncedAppointments = useRef(false);
  
  useEffect(() => {
    if (soldiers.length > 0 && form?.form_data?.selected_soldiers && !hasSyncedAppointments.current) {
      const syncAppointments = async () => {
        const appointmentsMap = await fetchAllAppointments(soldiers.filter(s => form.form_data.selected_soldiers.includes(s.id)));
        // Check if appointments exist for this form, and create them if missing
        await checkAndCreateMissingAppointments(appointmentsMap);
        hasSyncedAppointments.current = true;
      };
      syncAppointments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soldiers, form]);
  
  // Reset sync flag when form ID changes
  useEffect(() => {
    hasSyncedAppointments.current = false;
  }, [id]);

  const fetchForm = async () => {
    try {
      const { data } = await apiClient.get(`/da6-forms/${id}`);
      setForm(data.form);
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
    } catch (error) {
      console.error('Error fetching soldiers:', error);
    }
  };

  const fetchAllAppointments = async (soldiersList) => {
    const appointmentsMap = {};
    for (const soldier of soldiersList) {
      try {
        const { data } = await apiClient.get(`/soldiers/${soldier.id}/appointments`);
        appointmentsMap[soldier.id] = data.appointments || [];
      } catch (error) {
        console.error(`Error fetching appointments for ${soldier.id}:`, error);
        appointmentsMap[soldier.id] = [];
      }
    }
    setSoldierAppointments(appointmentsMap);
    return appointmentsMap;
  };

  // Check if appointments exist for this form and create them if missing
  const checkAndCreateMissingAppointments = async (appointmentsMap) => {
    if (!form || !form.id || !form.form_data || !soldiers.length) return;
    
    try {
      const selectedSoldiers = form.form_data.selected_soldiers || [];
      if (selectedSoldiers.length === 0) return;
      
      // Check if any appointments exist for this form
      let appointmentsExist = false;
      for (const soldierId of selectedSoldiers) {
        const appointments = appointmentsMap[soldierId] || [];
        if (appointments.some(apt => apt.notes && apt.notes.includes(`DA6_FORM:${form.id}`))) {
          appointmentsExist = true;
          break;
        }
      }
      
      // If appointments don't exist, create them
      if (!appointmentsExist) {
        console.log(`[Appointment Sync] No appointments found for form ${form.id}, creating them...`);
        await createAppointmentsFromAssignments();
      }
    } catch (error) {
      console.error('Error checking appointments:', error);
    }
  };

  // Create appointments from stored assignments (not regenerated)
  const createAppointmentsFromAssignments = async () => {
    if (!form || !form.id || !form.form_data) return;
    
    try {
      // Use stored assignments from form data (source of truth)
      const storedAssignments = form.form_data.assignments || [];
      if (storedAssignments.length === 0) {
        console.log('[Appointment Sync] No stored assignments found, skipping appointment creation');
        return;
      }
      
      const dutyType = form.form_data.duty_config?.nature_of_duty || 'Duty';
      const selectedSoldiers = form.form_data.selected_soldiers || [];
      
      // Group duty assignments and days-off by soldier and date ranges
      const soldierDutyRanges = {}; // { soldierId: [{ start_date, end_date, dates: [dateStr] }] }
      const soldierDaysOffRanges = {}; // { soldierId: [{ start_date, end_date, dates: [dateStr] }] }
      
      // Use stored assignments directly
      const assignments = storedAssignments;
      
      assignments.forEach(assignment => {
        if (!assignment.soldier_id) return;
        
        const soldierId = assignment.soldier_id;
        const dateStr = assignment.date;
        
        // Handle duty assignments (actual duty, not exceptions)
        if (assignment.duty && !assignment.exception_code) {
          if (!soldierDutyRanges[soldierId]) {
            soldierDutyRanges[soldierId] = [];
          }
          
          let currentRange = soldierDutyRanges[soldierId].find(range => {
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
      let exceptionCode = 'D';
      if (dutyType === 'CQ' || dutyType === 'Charge of Quarters') {
        exceptionCode = 'CQ';
      } else if (dutyType === 'BN Staff Duty' || dutyType === 'Brigade Staff Duty' || dutyType.includes('Staff Duty')) {
        exceptionCode = 'SD';
      }
      
      const BATCH_DELAY = 200;
      
      // Create duty appointments
      for (const [soldierId, ranges] of Object.entries(soldierDutyRanges)) {
        for (const range of ranges) {
          try {
            await apiClient.post(`/soldiers/${soldierId}/appointments`, {
              start_date: range.start_date,
              end_date: range.end_date,
              reason: `${dutyType} Duty`,
              exception_code: exceptionCode,
              notes: `DA6_FORM:${form.id}`
            });
          } catch (err) {
            console.error(`Error creating duty appointment for soldier ${soldierId}:`, err);
          }
        }
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
      
      // Create days-off (Pass) appointments
      for (const [soldierId, ranges] of Object.entries(soldierDaysOffRanges)) {
        for (const range of ranges) {
          try {
            await apiClient.post(`/soldiers/${soldierId}/appointments`, {
              start_date: range.start_date,
              end_date: range.end_date,
              reason: 'Pass (Days Off After Duty)',
              exception_code: 'P',
              notes: `DA6_FORM:${form.id}`
            });
          } catch (err) {
            console.error(`Error creating days-off appointment for soldier ${soldierId}:`, err);
          }
        }
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
      
      // Refresh appointments after creating
      if (selectedSoldiers.length > 0) {
        const soldiersList = soldiers.filter(s => selectedSoldiers.includes(s.id));
        await fetchAllAppointments(soldiersList);
      }
      
      console.log(`[Appointment Sync] Created appointments for form ${form.id}`);
    } catch (error) {
      console.error('Error creating appointments from assignments:', error);
    }
  };

  const fetchOtherForms = async (formIds) => {
    try {
      const formsPromises = Array.from(formIds).map(formId => 
        apiClient.get(`/da6-forms/${formId}`).then(res => res.data.form)
      );
      const fetchedForms = await Promise.all(formsPromises);
      setOtherForms(fetchedForms);
    } catch (error) {
      console.error('Error fetching other forms for cross-roster checking:', error);
      setOtherForms([]);
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

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getDatesInRange = (startDate, endDate) => {
    const dates = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date(start);

    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  const isWeekend = (date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const isHoliday = (date) => {
    if (!form?.form_data?.holidays) return false;
    const dateStr = date.toISOString().split('T')[0];
    return form.form_data.holidays.some(h => {
      const holidayDate = typeof h === 'string' ? h : h.date;
      return holidayDate === dateStr;
    });
  };

  // eslint-disable-next-line no-unused-vars
  const getDateType = (date) => {
    const isWeekendDay = isWeekend(date);
    const isHolidayDay = isHoliday(date);
    const dutyConfig = form?.form_data?.duty_config || {};
    const separateHolidayCycle = dutyConfig.separate_holiday_cycle || false;
    const separateWeekendCycle = dutyConfig.separate_weekend_cycle || false;
    
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

  const shouldIncludeDate = (date) => {
    if (!form?.form_data) return true;
    
    const dateStr = date.toISOString().split('T')[0];
    const excludedDates = form.form_data.excluded_dates || [];
    
    // Check if date is excluded
    if (excludedDates.includes(dateStr)) {
      return false;
    }
    
    const isWeekendDay = isWeekend(date);
    const dutyConfig = form.form_data.duty_config || {};
    
    // If skipping weekends and it's a weekend, don't include (unless separate weekend cycle)
    if (dutyConfig.skip_weekends && isWeekendDay && !dutyConfig.separate_weekend_cycle) {
      return false;
    }
    
    return true;
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

  // Generate assignments for all dates (memoized)
  const generateAssignmentsMap = () => {
    if (!form?.form_data) {
      console.log('generateAssignmentsMap: No form data');
      return {};
    }
    
    const assignmentsMap = {}; // { soldierId: { dateStr: assignment } }
    const selectedSoldiers = form.form_data.selected_soldiers || [];
    const dutyConfig = form.form_data.duty_config || {};
    const soldiersPerDay = dutyConfig.soldiers_per_day || 2;
    const daysOffAfterDuty = dutyConfig.days_off_after_duty || 1;
    const separateWeekendCycle = dutyConfig.separate_weekend_cycle || false;
    const separateHolidayCycle = dutyConfig.separate_holiday_cycle || false;
    const rankRequirements = dutyConfig.rank_requirements?.requirements || [];
    const globalExclusions = dutyConfig.rank_requirements?.exclusions || { ranks: [], groups: [] };
    const exceptions = form.form_data.exceptions || {};
    
    // Helper function to check if soldier has ANY exception on a given date
    // This checks: user-defined exceptions, appointments, cross-roster conflicts, and assignments in current form
    const hasExceptionOnDate = (soldierId, dateStr) => {
      // Check user-defined exceptions first
      const soldierExceptions = exceptions[soldierId] || {};
      if (soldierExceptions[dateStr]) {
        return true;
      }
      
      // Get appointments once for all checks
      const appointments = getAppointmentsForSoldier(soldierId);
      const currentDate = new Date(dateStr);
      
      // Check if soldier has ANY appointment on this date (duty or pass)
      // This includes checking for duty appointments (CQ, SD, D) and pass appointments (P)
      const hasAppointmentToday = appointments.some(apt => {
        const start = new Date(apt.start_date);
        const end = new Date(apt.end_date);
        const checkDate = new Date(currentDate);
        return checkDate >= start && checkDate <= end;
      });
      
      if (hasAppointmentToday) {
        // Check if it's a pass (P) appointment - if so, they had duty yesterday and should be off today
        const hasPassToday = appointments.some(apt => {
          const start = new Date(apt.start_date);
          const end = new Date(apt.end_date);
          const checkDate = new Date(currentDate);
          if (checkDate >= start && checkDate <= end) {
            return apt.exception_code === 'P';
          }
          return false;
        });
        
        if (hasPassToday) {
          // Soldier has a pass today, meaning they had duty yesterday - they're unavailable
          return true;
        }
        
        // Check if it's a duty appointment (CQ, SD, D) - they're unavailable
        const hasDutyToday = appointments.some(apt => {
          const start = new Date(apt.start_date);
          const end = new Date(apt.end_date);
          const checkDate = new Date(currentDate);
          if (checkDate >= start && checkDate <= end) {
            const dutyCodes = ['CQ', 'SD', 'D'];
            return dutyCodes.includes(apt.exception_code);
          }
          return false;
        });
        
        if (hasDutyToday) {
          // Soldier has duty today - they're unavailable
          return true;
        }
      }
      
      // CRITICAL: Check if soldier had duty in another form on the previous day(s)
      // If they had duty yesterday, they should have a day off today (P exception)
      // This prevents assigning duty when they should be on pass after duty from another form
      // Check if soldier had duty on previous day(s) that would give them a day off today
      for (let i = 1; i <= daysOffAfterDuty; i++) {
        const previousDate = new Date(currentDate);
        previousDate.setDate(previousDate.getDate() - i);
        const previousDateStr = previousDate.toISOString().split('T')[0];
        
        // Check if soldier had a duty appointment (CQ, SD, D) on the previous day
        const hadDutyPreviousDay = appointments.some(apt => {
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
        
        if (hadDutyPreviousDay) {
          // Soldier had duty on previous day, so they should have a day off today
          return true;
        }
      }
      
      // CRITICAL: Check if assigning duty on this date would conflict with future duty in other forms
      // If we assign duty today, the soldier gets the next day(s) off
      // But if they have duty in another form on those days, we can't assign duty today
      
      // Check if soldier has duty on the next day(s) (days-off period) in another form
      for (let i = 1; i <= daysOffAfterDuty; i++) {
        const nextDate = new Date(currentDate);
        nextDate.setDate(nextDate.getDate() + i);
        const nextDateStr = nextDate.toISOString().split('T')[0];
        
        // Check if soldier has a duty appointment (CQ, SD, D) on the next day
        const hasDutyNextDay = appointments.some(apt => {
          const start = new Date(apt.start_date);
          const end = new Date(apt.end_date);
          const checkDate = new Date(nextDateStr);
          
          // Check if the next day falls within the appointment range
          if (checkDate >= start && checkDate <= end) {
            // Check if it's a duty appointment (not a pass)
            const dutyCodes = ['CQ', 'SD', 'D'];
            return dutyCodes.includes(apt.exception_code);
          }
          return false;
        });
        
        if (hasDutyNextDay) {
          // Soldier has duty on a day-off day, so we can't assign duty today
          return true;
        }
      }
      
      // CRITICAL: Check if soldier already has a duty assignment in the current form on this date
      // This prevents assigning duty on consecutive days within the same form
      if (assignmentsMap[soldierId] && assignmentsMap[soldierId][dateStr]) {
        const existingAssignment = assignmentsMap[soldierId][dateStr];
        // If it's a duty assignment (not just a pass/exception), they're unavailable
        if (existingAssignment.duty && !existingAssignment.exception_code) {
          return true;
        }
        // If it's a pass (P exception), they're also unavailable (days off after duty)
        if (existingAssignment.exception_code === 'P') {
          return true;
        }
      }
      
      return false;
    };
    
    console.log('[ASSIGNMENT GEN] Starting generation:', {
      selectedSoldiersCount: selectedSoldiers.length,
      soldiersPerDay,
      daysOffAfterDuty,
      rankRequirementsCount: rankRequirements.length,
      rankRequirements: rankRequirements.map(r => ({
        quantity: r.quantity,
        group: r.group,
        rank_range: r.rank_range
      })),
      periodStart: form.period_start,
      periodEnd: form.period_end,
      soldiersAvailable: soldiers.length,
      globalExclusions: globalExclusions
    });
    
    if (selectedSoldiers.length === 0 || !form.period_start || !form.period_end) {
      console.log('generateAssignmentsMap: Early return - no soldiers or dates');
      return assignmentsMap;
    }
    
    const start = new Date(form.period_start);
    const end = new Date(form.period_end);
    const current = new Date(start);
    
    // Track last assignment dates for rotation
    const lastAssignmentDate = {}; // { soldierId: dateStr }
    const lastWeekendAssignmentDate = {}; // For separate weekend cycle
    const lastHolidayAssignmentDate = {}; // For separate holiday cycle
    
    // Generate all dates in range
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      
      // Check if we should include this date
      const shouldInclude = shouldIncludeDate(current);
      if (shouldInclude) {
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
        
        // Get all selected soldiers (don't filter by exceptions - exceptions only affect display, not selection)
        // Selection should be based on days since last duty only
        const availableSoldiers = selectedSoldiers
          .map(soldierId => soldiers.find(s => s.id === soldierId))
          .filter(s => s);
        
        // Helper to check if soldier is in days-off period (checking ALL cycles)
        // IMPORTANT: Days-off applies across ALL cycles, not just the current one
        const isSoldierInDaysOff = (soldier) => {
          // Check all cycles to find the most recent assignment
          const lastDateWeekday = lastAssignmentDate[soldier.id];
          const lastDateWeekend = lastWeekendAssignmentDate[soldier.id];
          const lastDateHoliday = lastHolidayAssignmentDate[soldier.id];
          
          // Find the most recent assignment across all cycles
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
            // If they worked within the days-off period, they're still off
            // daysSince will be 1 if they worked yesterday, we need daysSince > daysOffAfterDuty
            return daysSince <= daysOffAfterDuty;
          }
          return false;
        };
        
        // Debug logging for first few dates AND every 5th date to track rotation
        const dateIndex = Math.floor((current - start) / (1000 * 60 * 60 * 24));
        const isFirstFewDates = dateStr === start.toISOString().split('T')[0] || dateStr === new Date(start.getTime() + 86400000).toISOString().split('T')[0];
        const isEvery5thDate = dateIndex % 5 === 0;
        
        if (isFirstFewDates || isEvery5thDate) {
          console.log(`[ASSIGNMENT GEN] Date ${dateStr} (day ${dateIndex}):`, {
            availableSoldiersCount: availableSoldiers.length,
            selectedSoldiersCount: selectedSoldiers.length,
            rankRequirementsCount: rankRequirements.length,
            soldiersPerDay,
            daysOffAfterDuty,
            soldiersWithLastAssignment: Object.keys(lastAssignmentMap).length
          });
        }
        
        if (availableSoldiers.length > 0) {
          const selectedForDay = [];
          
          // STEP 1: Select soldiers with most days since last duty (given rank requirements)
          // If rank requirements are specified, fill each requirement
          if (rankRequirements.length > 0) {
            // For each requirement, find matching soldiers
            for (const requirement of rankRequirements) {
              const quantity = requirement.quantity || 1;
              
              // Filter soldiers that match this requirement (don't filter by exceptions - select based on days since duty only)
              let matchingSoldiers = availableSoldiers.filter(soldier => 
                soldierMatchesRequirement(soldier, requirement, globalExclusions) &&
                !selectedForDay.includes(soldier.id)
              );
              
              // Calculate days since last duty for each soldier (must be defined before sorting)
              // IMPORTANT: Check ALL cycles for last assignment, not just the current cycle
              const getDaysSinceLastDuty = (soldier) => {
                // Check all cycles to find the most recent assignment
                const lastDateWeekday = lastAssignmentDate[soldier.id];
                const lastDateWeekend = lastWeekendAssignmentDate[soldier.id];
                const lastDateHoliday = lastHolidayAssignmentDate[soldier.id];
                
                // Find the most recent assignment across all cycles
                let mostRecentDate = lastDateWeekday;
                if (lastDateWeekend && (!mostRecentDate || lastDateWeekend > mostRecentDate)) {
                  mostRecentDate = lastDateWeekend;
                }
                if (lastDateHoliday && (!mostRecentDate || lastDateHoliday > mostRecentDate)) {
                  mostRecentDate = lastDateHoliday;
                }
                
                // If soldier was assigned duty in this period, calculate from that assignment
                if (mostRecentDate) {
                  const lastDateObj = new Date(mostRecentDate);
                  const daysSinceAssignment = Math.floor((current - lastDateObj) / (1000 * 60 * 60 * 24));
                  // Days since last duty is just the days since their last assignment in this period
                  return daysSinceAssignment;
                }
                
                // If no assignment in this period, use stored days since last duty
                return soldier.days_since_last_duty || 0;
              };
              
              // Helper to get the most recent assignment date for logging (consistent with getDaysSinceLastDuty)
              const getLastAssignmentDate = (soldierId) => {
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
                return mostRecentDate || null;
              };
              
              // Filter out soldiers in days-off period BEFORE sorting (more efficient)
              matchingSoldiers = matchingSoldiers.filter(soldier => !isSoldierInDaysOff(soldier));
              
              // Debug logging - show BEFORE sorting (expand arrays)
              if (dateStr === start.toISOString().split('T')[0] || dateStr === new Date(start.getTime() + 86400000).toISOString().split('T')[0]) {
                const beforeSortList = matchingSoldiers.map(s => ({
                  name: `${s.rank} ${s.last_name}`,
                  daysSinceStored: s.days_since_last_duty || 0,
                  daysSinceCalculated: getDaysSinceLastDuty(s),
                  lastAssignment: getLastAssignmentDate(s.id) || 'none',
                  id: s.id
                }));
                console.log(`[ASSIGNMENT GEN] Date ${dateStr} - Requirement BEFORE sorting:`, JSON.stringify({
                  requirement: requirement.group || requirement.rank_range || 'custom',
                  quantity,
                  matchingSoldiersCount: matchingSoldiers.length,
                  top10: beforeSortList.slice(0, 10)
                }, null, 2));
              }
              
              // STEP 1 (continued): Sort by days since last duty (MOST days first - PRIMARY criterion)
              // This ensures we select soldiers who have been off duty the longest
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
              
              // Debug logging - show AFTER sorting (expand arrays so we can see all soldiers)
              if (dateStr === start.toISOString().split('T')[0] || dateStr === new Date(start.getTime() + 86400000).toISOString().split('T')[0]) {
                const sortedList = matchingSoldiers.map(s => ({
                  name: `${s.rank} ${s.last_name}`,
                  daysSince: getDaysSinceLastDuty(s),
                  rankOrder: getRankOrder(s.rank?.toUpperCase().trim()),
                  lastAssignment: getLastAssignmentDate(s.id) || 'none',
                  id: s.id
                }));
                // Log full array by using JSON.stringify to expand it
                console.log(`[ASSIGNMENT GEN] Date ${dateStr} - Requirement AFTER sorting (MOST days first):`, JSON.stringify({
                  requirement: requirement.group || requirement.rank_range || 'custom',
                  quantity,
                  sortedSoldiers: sortedList,
                  top10: sortedList.slice(0, 10)
                }, null, 2));
              }
              
                // Select soldiers for this requirement (respecting days off)
              let selectedForRequirement = 0;
              const skippedSoldiers = [];
              const dateIndex = Math.floor((current - start) / (1000 * 60 * 60 * 24));
              const isFirstFewDates = dateStr === start.toISOString().split('T')[0] || dateStr === new Date(start.getTime() + 86400000).toISOString().split('T')[0];
              const isEvery5thDate = dateIndex % 5 === 0;
              
              for (const soldier of matchingSoldiers) {
                if (selectedForRequirement >= quantity || selectedForDay.length >= soldiersPerDay) break;
                
                // STEP 2: Check for exceptions BEFORE selecting soldier
                // Check if soldier has any exception code on this date (appointments, cross-roster, user-defined)
                if (hasExceptionOnDate(soldier.id, dateStr)) {
                  const soldierExceptions = exceptions[soldier.id] || {};
                  const exceptionCode = soldierExceptions[dateStr];
                  const unavailability = isSoldierUnavailableOnDate(soldier.id, current) ? getUnavailabilityReason(soldier.id, current) : null;
                  const reason = exceptionCode || (unavailability?.exceptionCode) || 'Exception';
                  skippedSoldiers.push({ 
                    soldier: `${soldier.rank} ${soldier.last_name}`, 
                    reason: `Exception code: ${reason}`,
                    exceptionCode: exceptionCode || unavailability?.exceptionCode
                  });
                  continue; // Skip this soldier, they have an exception on this date
                }
                
                // Note: Days-off check is now done BEFORE sorting, so soldiers in days-off period
                // should not reach this point. However, we keep this check as a safety measure
                // in case the filter didn't catch all cases (e.g., if isSoldierInDaysOff logic changes).
                if (isSoldierInDaysOff(soldier)) {
                  const mostRecentDate = getLastAssignmentDate(soldier.id);
                  const daysSince = mostRecentDate ? Math.floor((current - new Date(mostRecentDate)) / (1000 * 60 * 60 * 24)) : 0;
                  skippedSoldiers.push({ 
                    soldier: `${soldier.rank} ${soldier.last_name}`, 
                    reason: `Days off period (last duty: ${mostRecentDate}, days since: ${daysSince}, need: > ${daysOffAfterDuty})`,
                    daysSince: daysSince
                  });
                  continue; // Skip this soldier, they're still in days-off period
                }
                
                // STEP 3: Soldier is available - assign duty
                // Add soldier to selected list for this day
                selectedForDay.push(soldier.id);
                
                // Track assignment date for rotation (used in STEP 4 for days since last duty calculation)
                lastAssignmentMap[soldier.id] = dateStr;
                // Also update the specific cycle maps for isSoldierInDaysOff to work correctly
                if (separateHolidayCycle && isHoliday(current)) {
                  lastHolidayAssignmentDate[soldier.id] = dateStr;
                } else if (separateWeekendCycle && isWeekend(current) && !isHoliday(current)) {
                  lastWeekendAssignmentDate[soldier.id] = dateStr;
                } else {
                  lastAssignmentDate[soldier.id] = dateStr;
                }
                selectedForRequirement++;
              }
              
              // Enhanced debug logging
              if (isFirstFewDates || isEvery5thDate) {
                console.log(`[ASSIGNMENT GEN] Date ${dateStr} (day ${dateIndex}) - Selection details:`, JSON.stringify({
                  requirement: requirement.group || requirement.rank_range || 'custom',
                  quantity,
                  totalMatching: matchingSoldiers.length,
                  selected: selectedForRequirement,
                  skipped: skippedSoldiers.length,
                  skippedDetails: skippedSoldiers.slice(0, 5),
                  selectedSoldiers: selectedForDay.slice(-selectedForRequirement).map(id => {
                    const s = soldiers.find(s => s.id === id);
                    return s ? `${s.rank} ${s.last_name}` : id;
                  })
                }, null, 2));
              }
              
              // Debug logging - show detailed selection info
              if (dateStr === start.toISOString().split('T')[0] || dateStr === new Date(start.getTime() + 86400000).toISOString().split('T')[0]) {
                const selectedNames = selectedForDay.slice(-selectedForRequirement).map(id => {
                  const s = soldiers.find(s => s.id === id);
                  return s ? {
                    name: `${s.rank} ${s.last_name}`,
                    daysSince: s.days_since_last_duty || 0,
                    id: id
                  } : { id: id };
                });
                console.log(`[ASSIGNMENT GEN] Date ${dateStr} - Selected for requirement:`, {
                  requirement: requirement.group || requirement.rank_range || 'custom',
                  selected: selectedNames,
                  skipped: skippedSoldiers.slice(0, 10), // Show first 10 skipped
                  skippedCount: skippedSoldiers.length,
                  selectedCount: selectedForRequirement,
                  totalSelectedForDay: selectedForDay.length,
                  quantityNeeded: quantity
                });
              }
              
              if (selectedForDay.length >= soldiersPerDay) break; // Filled all slots
            }
            
            // If we have rank requirements but haven't filled all slots, fill remaining with any available soldiers
            if (selectedForDay.length < soldiersPerDay) {
              const remainingSoldiers = availableSoldiers.filter(soldier => 
                !selectedForDay.includes(soldier.id)
              );
              
              // Filter out soldiers still in days-off period (checking ALL cycles)
              const availableRemaining = remainingSoldiers.filter(soldier => {
                return !isSoldierInDaysOff(soldier);
              });
              
              // Sort by days since last duty, then rank, then alphabetical
              availableRemaining.sort((a, b) => {
                const getDaysSince = (soldier) => {
                  // Check all cycles to find the most recent assignment
                  const lastDateWeekday = lastAssignmentDate[soldier.id];
                  const lastDateWeekend = lastWeekendAssignmentDate[soldier.id];
                  const lastDateHoliday = lastHolidayAssignmentDate[soldier.id];
                  
                  // Find the most recent assignment across all cycles
                  let mostRecentDate = lastDateWeekday;
                  if (lastDateWeekend && (!mostRecentDate || lastDateWeekend > mostRecentDate)) {
                    mostRecentDate = lastDateWeekend;
                  }
                  if (lastDateHoliday && (!mostRecentDate || lastDateHoliday > mostRecentDate)) {
                    mostRecentDate = lastDateHoliday;
                  }
                  
                  // If soldier was assigned duty in this period, calculate from that assignment
                  if (mostRecentDate) {
                    const lastDateObj = new Date(mostRecentDate);
                    const daysSinceAssignment = Math.floor((current - lastDateObj) / (1000 * 60 * 60 * 24));
                    // Days since last duty is just the days since their last assignment in this period
                    return daysSinceAssignment;
                  }
                  
                  // If no assignment in this period, use stored days since last duty
                  return soldier.days_since_last_duty || 0;
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
                const aLastName = (a.last_name || '').toLowerCase();
                const bLastName = (b.last_name || '').toLowerCase();
                if (aLastName !== bLastName) {
                  return aLastName.localeCompare(bLastName);
                }
                const aFirstName = (a.first_name || '').toLowerCase();
                const bFirstName = (b.first_name || '').toLowerCase();
                return aFirstName.localeCompare(bFirstName);
              });
              
              for (const soldier of availableRemaining) {
                if (selectedForDay.length >= soldiersPerDay) break;
                selectedForDay.push(soldier.id);
                // Update the cycle-specific map based on date type
                lastAssignmentMap[soldier.id] = dateStr;
                // Also update the specific cycle maps for isSoldierInDaysOff to work correctly
                if (separateHolidayCycle && isHoliday(current)) {
                  lastHolidayAssignmentDate[soldier.id] = dateStr;
                } else if (separateWeekendCycle && isWeekend(current) && !isHoliday(current)) {
                  lastWeekendAssignmentDate[soldier.id] = dateStr;
                } else {
                  lastAssignmentDate[soldier.id] = dateStr;
                }
              }
            }
          } else {
            // No rank requirements - use simple rotation
            const soldiersWithLastDate = availableSoldiers.map(soldier => ({
              soldier,
              lastDate: lastAssignmentMap[soldier.id] || null
            }));
            
            // Calculate days since last duty for each soldier (checking ALL cycles)
            const getDaysSinceLastDuty = (soldier) => {
              // Check all cycles to find the most recent assignment
              const lastDateWeekday = lastAssignmentDate[soldier.id];
              const lastDateWeekend = lastWeekendAssignmentDate[soldier.id];
              const lastDateHoliday = lastHolidayAssignmentDate[soldier.id];
              
              // Find the most recent assignment across all cycles
              let mostRecentDate = lastDateWeekday;
              if (lastDateWeekend && (!mostRecentDate || lastDateWeekend > mostRecentDate)) {
                mostRecentDate = lastDateWeekend;
              }
              if (lastDateHoliday && (!mostRecentDate || lastDateHoliday > mostRecentDate)) {
                mostRecentDate = lastDateHoliday;
              }
              
              // If soldier was assigned duty in this period, calculate from that assignment
              if (mostRecentDate) {
                const lastDateObj = new Date(mostRecentDate);
                const daysSinceAssignment = Math.floor((current - lastDateObj) / (1000 * 60 * 60 * 24));
                // Days since last duty is just the days since their last assignment in this period
                return daysSinceAssignment;
              }
              
              // If no assignment in this period, use stored days since last duty
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
              
              // Check if soldier is still in days-off period (checking ALL cycles)
              if (isSoldierInDaysOff(soldier)) {
                continue; // Skip this soldier, they're still in days-off period
              }
              
              selectedForDay.push(soldier.id);
              // Update the cycle-specific map based on date type
              lastAssignmentMap[soldier.id] = dateStr;
              // Also update the specific cycle maps for isSoldierInDaysOff to work correctly
              if (separateHolidayCycle && isHoliday(current)) {
                lastHolidayAssignmentDate[soldier.id] = dateStr;
              } else if (separateWeekendCycle && isWeekend(current) && !isHoliday(current)) {
                lastWeekendAssignmentDate[soldier.id] = dateStr;
              } else {
                lastAssignmentDate[soldier.id] = dateStr;
              }
            }
          }
          
          // Add assignments for selected soldiers and mark days off after duty
          if (selectedForDay.length > 0) {
            // Debug logging for first few dates - show detailed final selection
            if (dateStr === start.toISOString().split('T')[0] || dateStr === new Date(start.getTime() + 86400000).toISOString().split('T')[0]) {
              const finalSelection = selectedForDay.map(id => {
                const s = soldiers.find(s => s.id === id);
                const lastDate = lastAssignmentMap[id];
                return s ? {
                  name: `${s.rank} ${s.last_name}`,
                  daysSinceStored: s.days_since_last_duty || 0,
                  lastAssignment: lastDate || 'none',
                  id: id
                } : { id: id };
              });
              console.log(`[ASSIGNMENT GEN] Date ${dateStr} - Final selection:`, {
                selectedCount: selectedForDay.length,
                selectedSoldiers: finalSelection,
                soldiersPerDay,
                willMarkDaysOff: daysOffAfterDuty,
                availableSoldiersCount: availableSoldiers.length
              });
            }
            
            // STEP 3 (continued): Assign duty and mark next day(s) as 'P' (Pass)
            selectedForDay.forEach(soldierId => {
              if (!assignmentsMap[soldierId]) {
                assignmentsMap[soldierId] = {};
              }
              // Create duty assignment (will display as checkmark ✓)
              assignmentsMap[soldierId][dateStr] = {
                soldier_id: soldierId,
                date: dateStr,
                duty: dutyConfig.nature_of_duty || 'CQ'
                // Note: days since last duty will reset to 0 on this date (handled in display logic)
              };
            
            // STEP 3 (continued): Mark days off after duty with exception code 'P' (Pass)
            // This applies regardless of whether it's a weekend or holiday
            // IMPORTANT: Always assign pass for the next day(s) after duty, even if it's after the period end
            for (let i = 1; i <= daysOffAfterDuty; i++) {
              const offDate = new Date(current);
              offDate.setDate(offDate.getDate() + i);
              const offDateStr = offDate.toISOString().split('T')[0];
              
              // Check if there's an existing user-defined exception (don't override those)
              const soldierExceptions = exceptions[soldierId] || {};
              const existingException = soldierExceptions[offDateStr];
              
              // Only add 'P' if there's no user-defined exception
              if (!existingException) {
                if (!assignmentsMap[soldierId]) {
                  assignmentsMap[soldierId] = {};
                }
                // Always set 'P' for days off after duty (overwrite any auto-generated ones)
                // Note: We assign pass even if it's after the period end, as soldiers need their day off
                assignmentsMap[soldierId][offDateStr] = {
                  soldier_id: soldierId,
                  date: offDateStr,
                  exception_code: 'P',
                  duty: 'P'
                };
              }
            }
            });
          }
        }
      }
      
      // Handle exceptions (user-defined exceptions take precedence over days-off)
      selectedSoldiers.forEach(soldierId => {
        const soldierExceptions = exceptions[soldierId] || {};
        const exceptionCode = soldierExceptions[dateStr];
        if (exceptionCode) {
          if (!assignmentsMap[soldierId]) {
            assignmentsMap[soldierId] = {};
          }
          // User-defined exceptions override days-off exceptions
          assignmentsMap[soldierId][dateStr] = {
            soldier_id: soldierId,
            date: dateStr,
            exception_code: exceptionCode,
            duty: exceptionCode
          };
        }
      });
      
      current.setDate(current.getDate() + 1);
    }
    
    // Debug: count assignments created
    const totalAssignments = Object.values(assignmentsMap).reduce((sum, soldierAssignments) => {
      return sum + Object.keys(soldierAssignments).length;
    }, 0);
    const dutyAssignments = Object.values(assignmentsMap).reduce((sum, soldierAssignments) => {
      return sum + Object.values(soldierAssignments).filter(a => a.duty && !a.exception_code).length;
    }, 0);
    const pExceptions = Object.values(assignmentsMap).reduce((sum, soldierAssignments) => {
      return sum + Object.values(soldierAssignments).filter(a => a.exception_code === 'P').length;
    }, 0);
    
    // Count how many unique soldiers got duty assignments
    const soldiersWithDuty = Object.entries(assignmentsMap).filter(([id, dates]) => 
      Object.values(dates).some(a => a.duty && !a.exception_code)
    ).map(([id]) => {
      const s = soldiers.find(s => s.id === id);
      return s ? `${s.rank} ${s.last_name}` : id;
    });
    
    console.log('[ASSIGNMENT GEN] Generation completed:', JSON.stringify({
      soldiersWithAssignments: Object.keys(assignmentsMap).length,
      soldiersWithDuty: soldiersWithDuty.length,
      soldiersWithDutyList: soldiersWithDuty,
      totalAssignments: totalAssignments,
      dutyAssignments: dutyAssignments,
      pExceptions: pExceptions,
      daysInPeriod: Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1,
      expectedDutyAssignments: (Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1) * soldiersPerDay,
      sampleAssignments: Object.entries(assignmentsMap).slice(0, 5).map(([id, dates]) => {
        const s = soldiers.find(s => s.id === id);
        const dutyDates = Object.entries(dates).filter(([d, a]) => a.duty && !a.exception_code).map(([d]) => d);
        return {
          soldier: s ? `${s.rank} ${s.last_name}` : id,
          dutyCount: dutyDates.length,
          dutyDates: dutyDates.slice(0, 10)
        };
      })
    }, null, 2));
    
    return assignmentsMap;
  };

  // Build assignments map from stored assignments when form loads
  // Use state instead of ref so it triggers re-render when updated
  useEffect(() => {
    if (!form) {
      setAssignmentsMap({});
      return;
    }
    
    // Build assignments map from stored assignments (source of truth)
    const buildAssignmentsMapFromStored = () => {
      if (!form?.form_data?.assignments) return {};
      
      const map = {};
      const storedAssignments = form.form_data.assignments || [];
      
      storedAssignments.forEach(assignment => {
        if (!assignment.soldier_id || !assignment.date) return;
        
        if (!map[assignment.soldier_id]) {
          map[assignment.soldier_id] = {};
        }
        
        map[assignment.soldier_id][assignment.date] = {
          duty: assignment.duty || false,
          exception_code: assignment.exception_code || null
        };
      });
      
      return map;
    };
    
    // First try to use stored assignments (source of truth)
    const storedMap = buildAssignmentsMapFromStored();
    
    if (Object.keys(storedMap).length > 0) {
      // Use stored assignments
      setAssignmentsMap(storedMap);
      console.log('[Assignments Map] Using stored assignments from form data', {
        assignmentsCount: Object.keys(storedMap).length,
        totalAssignments: Object.values(storedMap).reduce((sum, dates) => sum + Object.keys(dates).length, 0)
      });
    } else if (soldiers.length > 0) {
      // Fallback: regenerate if no stored assignments exist
      const generatedMap = generateAssignmentsMap();
      setAssignmentsMap(generatedMap);
      console.log('[Assignments Map] Generated assignments (no stored assignments found)');
    } else {
      setAssignmentsMap({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.id, form?.updated_at, form?.created_at, form?.form_data?.assignments?.length, soldiers.length]);

  // Helper function to generate assignments for another form (for cross-roster checking)
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

  // Memoize other form assignments to avoid recalculating on every render
  const otherFormAssignmentsRef = useRef({});
  const otherFormsKey = otherForms.length > 0 
    ? otherForms.map(f => `${f.id}-${f.updated_at || ''}`).sort().join(',')
    : '';
  
  // Pre-generate assignments for all other forms once
  if (form?.form_data?.cross_roster_check_enabled && otherForms.length > 0) {
    const selectedRostersForCheck = form.form_data.selected_rosters_for_check || [];
    const cacheKey = `${otherFormsKey}-${selectedRostersForCheck.sort().join(',')}`;
    
    if (!otherFormAssignmentsRef.current[cacheKey]) {
      const otherFormAssignmentsMap = {};
      const otherFormDutyTypes = {};
      
      selectedRostersForCheck.forEach(formId => {
        const otherForm = otherForms.find(f => f.id === formId);
        if (otherForm) {
          otherFormAssignmentsMap[formId] = generateAssignmentsForOtherForm(otherForm);
          otherFormDutyTypes[formId] = otherForm.form_data.duty_config?.nature_of_duty || 'Duty';
        }
      });
      
      otherFormAssignmentsRef.current[cacheKey] = {
        assignments: otherFormAssignmentsMap,
        dutyTypes: otherFormDutyTypes
      };
    }
  }
  
  const cachedOtherFormData = form?.form_data?.cross_roster_check_enabled && otherForms.length > 0
    ? otherFormAssignmentsRef.current[`${otherFormsKey}-${(form.form_data.selected_rosters_for_check || []).sort().join(',')}`]
    : null;

  const getAssignmentForDate = (soldierId, date) => {
    if (!form?.form_data) return null;
    
    const dateStr = date.toISOString().split('T')[0];
    
    // Check if date should be included
    if (!shouldIncludeDate(date)) {
      return null;
    }
    
    // PRIORITY 1: Check assignments map (stored assignments from form) - this is the source of truth
    if (assignmentsMap[soldierId] && assignmentsMap[soldierId][dateStr]) {
      return assignmentsMap[soldierId][dateStr];
    }
    
    // PRIORITY 2: Check for cross-roster conflicts if cross-roster checking was enabled
    // Use cached assignments instead of regenerating on every call
    if (cachedOtherFormData) {
      const selectedRostersForCheck = form.form_data.selected_rosters_for_check || [];
      
      for (const formId of selectedRostersForCheck) {
        const otherFormAssignmentsMap = cachedOtherFormData.assignments[formId];
        if (!otherFormAssignmentsMap) continue;
        
        // Check if soldier is assigned duty on this date in the other roster
        const hasDutyAssignment = otherFormAssignmentsMap[soldierId]?.[dateStr]?.duty === true;
        
        if (hasDutyAssignment) {
          // Determine appropriate exception code based on other form's duty type
          const otherFormDutyType = cachedOtherFormData.dutyTypes[formId] || 'Duty';
          let exceptionCode = 'D'; // Default to 'D' for Detail
          
          if (otherFormDutyType === 'CQ' || otherFormDutyType === 'Charge of Quarters') {
            exceptionCode = 'CQ';
          } else if (otherFormDutyType === 'BN Staff Duty' || otherFormDutyType === 'Brigade Staff Duty' || otherFormDutyType.includes('Staff Duty')) {
            exceptionCode = 'SD';
          }
          
          // Return cross-roster exception code
          return {
            exception_code: exceptionCode,
            duty: false,
            crossRoster: true
          };
        }
      }
    }
    
    // PRIORITY 3: Check appointments - only if no stored assignment exists
    // This is for appointments that might exist but aren't in the stored assignments
    if (isSoldierUnavailableOnDate(soldierId, date)) {
      const unavailability = getUnavailabilityReason(soldierId, date);
      if (unavailability && unavailability.exceptionCode) {
        return {
          exception_code: unavailability.exceptionCode,
          duty: false
        };
      }
    }
    
    return null;
  };

  // Calculate days since last duty for each date according to doctrine
  // Returns: { display: string, daysSince: number, isDuty: boolean }
  const getDaysSinceForDate = (soldierId, date, dates) => {
    const soldier = soldiers.find(s => s.id === soldierId);
    if (!soldier) return { display: '', daysSince: 0, isDuty: false };
    
    const dateStr = date.toISOString().split('T')[0];
    
    // Check if date should be included
    if (!shouldIncludeDate(date)) {
      return { display: '', daysSince: 0, isDuty: false };
    }
    
    // Check assignment for THIS date first - exception codes override everything
    const assignment = getAssignmentForDate(soldierId, date);
    
    // Calculate days since up to this date
    const dateIndex = dates.findIndex(d => d.toISOString().split('T')[0] === dateStr);
    let daysSince = soldier.days_since_last_duty || 0;
    let lastNumberBeforeA = null;
    let inAStatus = false;
    const selectedSoldiers = form.form_data.selected_soldiers || [];
    
    // Track through dates up to current date
    for (let i = 0; i <= dateIndex; i++) {
      const checkDate = dates[i];
      
      if (!shouldIncludeDate(checkDate)) continue;
      
      // Check if ANYONE was assigned duty on this date (detail was made)
      let detailMade = false;
      for (const otherId of selectedSoldiers) {
        const otherAss = getAssignmentForDate(otherId, checkDate);
        if (otherAss && otherAss.duty && !otherAss.exception_code) {
          detailMade = true;
          break;
        }
      }
      
      const checkAss = getAssignmentForDate(soldierId, checkDate);
      
      if (checkAss) {
        const checkExc = checkAss.exception_code;
        const checkIsDuty = checkAss.duty && !checkExc;
        
        if (checkIsDuty) {
          // Soldier performed duty - reset counter to 0
          daysSince = 0;
          lastNumberBeforeA = null;
          inAStatus = false;
          // After resetting, we don't increment on the same day
          // The increment will happen on the next day when detailMade is true
          // Note: We don't increment here because this is the duty day itself
        } else if (checkExc === 'A') {
          // "A" interrupts numbering - store number before entering "A"
          // First increment if detail was made and not already in A status
          if (!inAStatus && detailMade) {
            daysSince++;
            lastNumberBeforeA = daysSince;
          } else if (!inAStatus) {
            // Even if no detail made, store current value
            lastNumberBeforeA = daysSince;
          }
          inAStatus = true;
          // Don't increment while in "A" status
        } else if (checkExc === 'P') {
          // "P" (Pass/days off) interrupts numbering like "A" - don't increment
          // First increment if detail was made and not already in P status
          if (!inAStatus && detailMade) {
            daysSince++;
            lastNumberBeforeA = daysSince;
          } else if (!inAStatus) {
            // Even if no detail made, store current value
            lastNumberBeforeA = daysSince;
          }
          inAStatus = true; // Treat like "A" - non-chargeable
          // Don't increment while in "P" status
        } else if (checkExc === 'D' || checkExc === 'U') {
          // "D" or "U" continue numbering
          if (inAStatus && lastNumberBeforeA !== null) {
            daysSince = lastNumberBeforeA;
          }
          inAStatus = false;
          if (detailMade) {
            daysSince++;
          }
        } else if (checkExc) {
          // Other exception codes continue numbering
          if (inAStatus && lastNumberBeforeA !== null) {
            daysSince = lastNumberBeforeA;
          }
          inAStatus = false;
          if (detailMade) {
            daysSince++;
          }
        } else {
          // Has assignment but no exception code - this shouldn't happen for duty assignments
          // But if it does, charge normally
          if (inAStatus && lastNumberBeforeA !== null) {
            daysSince = lastNumberBeforeA;
          }
          inAStatus = false;
          if (detailMade) {
            daysSince++;
          }
        }
      } else {
        // No assignment - check if we should exit 'P' or 'A' status
        // If we were in 'P' or 'A' status but now there's no exception, exit that status
        if (inAStatus) {
          // Exit 'P' or 'A' status - restore from stored value if available
          if (lastNumberBeforeA !== null) {
            daysSince = lastNumberBeforeA;
            // Clear lastNumberBeforeA after restoring so we don't restore again
            lastNumberBeforeA = null;
          }
          inAStatus = false;
          // After exiting 'P' or 'A' status, increment if detail was made
          if (detailMade) {
            daysSince++;
          }
        } else {
          // Not in 'P' or 'A' status - if detail was made, charge normally
          if (detailMade) {
            daysSince++;
          }
        }
      }
    }
    
    // STEP 4: Determine what to display for THIS date
    // Days since last duty resets to 0 when duty is performed, then increments day by day (1, 2, 3, ...)
    if (assignment) {
      const exceptionCode = assignment.exception_code;
      const isDuty = assignment.duty && !exceptionCode;
      
      if (isDuty) {
        // Soldier performed duty - show checkmark
        // Days since last duty resets to 0 on this date (calculated above in the loop)
        return { display: '✓', daysSince: 0, isDuty: true };
      } else if (exceptionCode === 'A') {
        // "A" with number before entering status
        const displayNum = lastNumberBeforeA !== null ? lastNumberBeforeA : daysSince;
        return { display: displayNum > 0 ? `A${displayNum}` : 'A', daysSince: displayNum, isDuty: false };
      } else if (exceptionCode === 'P') {
        // "P" (Pass/days off) - show with number before entering status (like "A")
        const displayNum = lastNumberBeforeA !== null ? lastNumberBeforeA : daysSince;
        return { display: displayNum > 0 ? `P${displayNum}` : 'P', daysSince: displayNum, isDuty: false };
      } else if (exceptionCode === 'D' || exceptionCode === 'U') {
        // "D" or "U" with current number
        return { display: `${exceptionCode}${daysSince}`, daysSince: daysSince, isDuty: false };
      } else if (exceptionCode) {
        // Other exception codes - show code only
        return { display: exceptionCode, daysSince: daysSince, isDuty: false };
      }
    }
    
    // No assignment - show days since last duty number
    return { display: daysSince.toString(), daysSince: daysSince, isDuty: false };
  };

  const getExceptionCodeName = (code) => {
    const codes = {
      'A': 'Absent',
      'U': 'Unavailable',
      'S': 'Sick',
      'D': 'Detail',
      'L': 'Leave',
      'T': 'Training',
      'TDY': 'TDY',
      'CQ': 'CQ',
      'SD': 'Staff Duty',
      'P': 'Pass',
      'EX': 'Exempt',
      'R': 'Restricted',
      'H': 'Holiday',
    };
    return codes[code] || code;
  };

  // eslint-disable-next-line no-unused-vars
  const getSoldierName = (soldierId) => {
    const soldier = soldiers.find(s => s.id === soldierId);
    if (!soldier) return 'Unknown';
    return `${soldier.rank} ${soldier.first_name} ${soldier.middle_initial ? soldier.middle_initial + '. ' : ''}${soldier.last_name}`.trim();
  };

  if (loading) {
    return (
      <Layout>
        <div className="loading">Loading form...</div>
      </Layout>
    );
  }

  if (!form) {
    return (
      <Layout>
        <div className="error">Form not found</div>
      </Layout>
    );
  }

  const dates = getDatesInRange(form.period_start, form.period_end);
  
  // Get assigned soldiers from assignments or selected_soldiers
  let assignedSoldierIds = new Set();
  if (form.form_data?.selected_soldiers) {
    assignedSoldierIds = new Set(form.form_data.selected_soldiers);
  } else if (form.form_data?.assignments) {
    assignedSoldierIds = new Set(form.form_data.assignments.map(a => a.soldier_id));
  }
  
  const assignedSoldiers = soldiers.filter(s => assignedSoldierIds.has(s.id));
  
  // Filter to only show soldiers who match at least one rank requirement
  const dutyConfig = form.form_data?.duty_config || {};
  const rankRequirements = dutyConfig.rank_requirements?.requirements || [];
  const globalExclusions = dutyConfig.rank_requirements?.exclusions || { ranks: [], groups: [] };
  
  let filteredSoldiers = assignedSoldiers;
  
  // If rank requirements are specified, only show soldiers matching those requirements
  if (rankRequirements.length > 0) {
    filteredSoldiers = assignedSoldiers.filter(soldier => {
      // Check if soldier matches at least one requirement
      return rankRequirements.some(requirement => 
        soldierMatchesRequirement(soldier, requirement, globalExclusions)
      );
    });
  } else {
    // No rank requirements - filter out globally excluded ranks
    const excludedRanks = globalExclusions.ranks || [];
    const excludedGroups = globalExclusions.groups || [];
    
    filteredSoldiers = assignedSoldiers.filter(soldier => {
      const soldierRank = soldier.rank?.toUpperCase().trim();
      if (!soldierRank) return false;
      
      // Check if rank is excluded
      if (excludedRanks.includes(soldierRank)) {
        return false;
      }
      
      // Check if rank group is excluded
      if (excludedGroups.includes('lower_enlisted') && isLowerEnlisted(soldierRank)) return false;
      if (excludedGroups.includes('nco') && isNCORank(soldierRank)) return false;
      if (excludedGroups.includes('warrant') && isWarrantOfficerRank(soldierRank)) return false;
      if (excludedGroups.includes('officer') && isOfficerRank(soldierRank)) return false;
      
      return true;
    });
  }

  // Group soldiers by rank for better organization (already sorted by rankOrder utility)
  const soldiersByRank = filteredSoldiers.reduce((acc, soldier) => {
    const rank = soldier.rank || 'UNKNOWN';
    if (!acc[rank]) acc[rank] = [];
    acc[rank].push(soldier);
    return acc;
  }, {});
  
  // Sort within each rank group alphabetically
  Object.keys(soldiersByRank).forEach(rank => {
    soldiersByRank[rank].sort((a, b) => {
      const lastNameA = (a.last_name || '').toLowerCase();
      const lastNameB = (b.last_name || '').toLowerCase();
      if (lastNameA !== lastNameB) {
        return lastNameA.localeCompare(lastNameB);
      }
      const firstNameA = (a.first_name || '').toLowerCase();
      const firstNameB = (b.first_name || '').toLowerCase();
      return firstNameA.localeCompare(firstNameB);
    });
  });

  return (
    <Layout>
      <div className="da6-form-view">
        <div className="form-view-header">
          <h1>DUTY ROSTER</h1>
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
              Compact List
            </button>
            <button className="btn-secondary" onClick={() => navigate('/forms')}>
              Back to Forms
            </button>
            <button className="btn-secondary" onClick={() => window.print()}>
              Print
            </button>
            <button className="btn-primary" onClick={() => navigate(`/forms/${id}`)}>
              Edit Form
            </button>
          </div>
        </div>

        <div className="roster-info">
          <div className="info-row">
            <span><strong>NATURE OF DUTY:</strong> {form.form_data?.duty_config?.nature_of_duty || 'Charge of Quarters'}</span>
            <span><strong>ORGANIZATION:</strong> {form.unit_name}</span>
          </div>
          <div className="info-row">
            <span><strong>FROM (DATE):</strong> {formatDate(form.period_start)}</span>
            <span><strong>TO (DATE):</strong> {formatDate(form.period_end)}</span>
          </div>
          {form.form_data?.duty_config && (
            <div className="info-row">
              <span><strong>SOLDIERS PER DAY:</strong> {form.form_data.duty_config.soldiers_per_day || 2}</span>
              <span><strong>DAYS OFF AFTER DUTY:</strong> {form.form_data.duty_config.days_off_after_duty || 1}</span>
            </div>
          )}
        </div>

        {viewMode === 'table' ? (
          <div className="roster-container">
            <div className="roster-table-wrapper">
              <table className="roster-table">
              <thead>
                <tr>
                  <th className="grade-col">GRADE</th>
                  <th className="name-col">NAME</th>
                  <th className="days-col">DAYS SINCE LAST DUTY</th>
                  {dates.map((date, idx) => {
                    const month = date.toLocaleDateString('en-US', { month: 'short' });
                    const day = date.getDate();
                    const isNewMonth = idx === 0 || date.getDate() === 1;
                    
                    return (
                      <th key={idx} className="date-col">
                        <div className="date-header">
                          {isNewMonth && <div className="month-label">{month}</div>}
                          <div className="day-number">{day}</div>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {Object.entries(soldiersByRank).map(([rank, rankSoldiers]) => 
                  rankSoldiers.map((soldier, idx) => (
                    <tr key={soldier.id}>
                      {idx === 0 && (
                        <td rowSpan={rankSoldiers.length} className="grade-cell">
                          {rank}
                        </td>
                      )}
                      <td className="name-cell">
                        {soldier.first_name} {soldier.middle_initial} {soldier.last_name}
                      </td>
                      <td className="days-cell">
                        {(() => {
                          // Display days since last duty (stored value represents days as of period start)
                          const daysSince = soldier.days_since_last_duty || 0;
                          
                          return (
                            <span className={`days-badge ${daysSince > 14 ? 'high' : daysSince > 7 ? 'medium' : 'low'}`}>
                              {daysSince}
                            </span>
                          );
                        })()}
                      </td>
                      {dates.map((date, dateIdx) => {
                        const isWeekendDay = isWeekend(date);
                        const isHolidayDay = isHoliday(date);
                        
                        // Only show if date should be included
                        if (!shouldIncludeDate(date)) {
                          return (
                            <td 
                              key={dateIdx} 
                              className={`assignment-cell ${isWeekendDay ? 'weekend' : ''} ${isHolidayDay ? 'holiday' : ''}`}
                            />
                          );
                        }
                        
                        // Check assignment first - exception codes override days since
                        const assignment = getAssignmentForDate(soldier.id, date);
                        const isException = assignment?.exception_code;
                        const isAssigned = assignment && assignment.duty && !assignment.exception_code;
                        
                        // Calculate days since for display (only if no exception code or for tooltip)
                        const daysInfo = getDaysSinceForDate(soldier.id, date, dates);
                        
                        // Determine what to display
                        let displayText = '';
                        if (isAssigned) {
                          // Soldier performed duty - show checkmark
                          displayText = '✓';
                        } else if (isException) {
                          // Exception code - show the code
                          // For cross-roster exceptions (CQ, SD, D), show just the code
                          // For other exceptions, use the formatted display from daysInfo
                          if (assignment.exception_code === 'CQ' || assignment.exception_code === 'SD' || assignment.exception_code === 'D') {
                            displayText = assignment.exception_code;
                          } else {
                            displayText = daysInfo.display; // This will have the exception code formatted
                          }
                        } else {
                          // No assignment - show days since last duty number
                          displayText = daysInfo.display;
                        }
                        
                        return (
                          <td 
                            key={dateIdx} 
                            className={`assignment-cell ${isAssigned ? 'assigned' : ''} ${isException ? 'exception' : ''} ${isWeekendDay ? 'weekend' : ''} ${isHolidayDay ? 'holiday' : ''}`}
                            title={isException ? getExceptionCodeName(assignment.exception_code) : (isHolidayDay ? 'Holiday' : `Days since last duty: ${daysInfo.daysSince}`)}
                          >
                            <span className="assignment-mark">
                              {displayText}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
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
                  <th>Duty Type</th>
                  <th>Assigned Soldiers</th>
                </tr>
              </thead>
              <tbody>
                {dates.map((date, dateIdx) => {
                  if (!shouldIncludeDate(date)) return null;
                  
                  const dateStr = date.toISOString().split('T')[0];
                  const dutyType = form.form_data?.duty_config?.nature_of_duty || 'CQ';
                  
                  // Find all soldiers assigned to this date
                  const assignedSoldiersForDate = [];
                  Object.entries(assignmentsMap).forEach(([soldierId, soldierAssignments]) => {
                    const assignment = soldierAssignments[dateStr];
                    if (assignment && assignment.duty && !assignment.exception_code) {
                      const soldier = soldiers.find(s => s.id === soldierId);
                      if (soldier) {
                        assignedSoldiersForDate.push(soldier);
                      }
                    }
                  });
                  
                  // Sort assigned soldiers by rank, then name
                  assignedSoldiersForDate.sort((a, b) => {
                    const aRankOrder = getRankOrder(a.rank?.toUpperCase().trim());
                    const bRankOrder = getRankOrder(b.rank?.toUpperCase().trim());
                    if (aRankOrder !== bRankOrder) {
                      return aRankOrder - bRankOrder;
                    }
                    const aLastName = (a.last_name || '').toLowerCase();
                    const bLastName = (b.last_name || '').toLowerCase();
                    if (aLastName !== bLastName) {
                      return aLastName.localeCompare(bLastName);
                    }
                    const aFirstName = (a.first_name || '').toLowerCase();
                    const bFirstName = (b.first_name || '').toLowerCase();
                    return aFirstName.localeCompare(bFirstName);
                  });
                  
                  if (assignedSoldiersForDate.length === 0) return null;
                  
                  const formattedDate = date.toLocaleDateString('en-US', { 
                    weekday: 'short',
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric'
                  });
                  
                  return (
                    <tr key={dateIdx}>
                      <td className="compact-date">{formattedDate}</td>
                      <td className="compact-duty">{dutyType}</td>
                      <td className="compact-soldiers">
                        {assignedSoldiersForDate.map((soldier, idx) => (
                          <span key={soldier.id}>
                            {soldier.rank} {soldier.last_name}
                            {idx < assignedSoldiersForDate.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="form-footer">
          <div className={`status-badge-large status-${form.status}`}>
            Status: {form.status.toUpperCase()}
          </div>
          <div className="form-meta">
            <span>Created: {formatDate(form.created_at)}</span>
            {form.updated_at !== form.created_at && (
              <span>Updated: {formatDate(form.updated_at)}</span>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DA6FormView;

