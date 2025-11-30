import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../utils/api';
import { EXCEPTION_CODES, getExceptionCodesList } from '../utils/exceptionCodes';
import { sortSoldiersByRank, getRanksInRange, isLowerEnlisted, isNCORank, isWarrantOfficerRank, isOfficerRank, getRankOrder } from '../utils/rankOrder';
import { DUTY_TEMPLATES, getDutyTemplate } from '../utils/dutyTemplates';
import { getFederalHolidaysInRange } from '../utils/federalHolidays';
import Layout from './Layout';
import SoldierProfile from './SoldierProfile';
import './DA6Form.css';

const DA6Form = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(!!id);
  const [soldiers, setSoldiers] = useState([]);
  const [selectedSoldiers, setSelectedSoldiers] = useState(new Set());
  const [exceptions, setExceptions] = useState({}); // { soldierId: { date: exceptionCode } }
  const [selectedProfileSoldier, setSelectedProfileSoldier] = useState(null);
  const [soldierAppointments, setSoldierAppointments] = useState({}); // { soldierId: [appointments] }
  const [holidays, setHolidays] = useState([]); // Array of holiday dates
  const [otherForms, setOtherForms] = useState([]); // For cross-roster checking
  const [crossRosterCheckEnabled, setCrossRosterCheckEnabled] = useState(false);
  const [selectedRostersForCheck, setSelectedRostersForCheck] = useState(new Set());
  const [excludedDates, setExcludedDates] = useState(new Set()); // Dates where no one is needed
  const [formData, setFormData] = useState({
    unit_name: '',
    period_start: '',
    period_end: '',
    status: 'draft',
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
    }
    fetchSoldiers();
    fetchOtherForms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    // Fetch holidays when date range changes
    if (formData.period_start && formData.period_end) {
      fetchHolidays();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.period_start, formData.period_end]);

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
      setFormData({
        unit_name: form.unit_name || '',
        period_start: form.period_start || '',
        period_end: form.period_end || '',
        status: form.status || 'draft',
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
      // Fetch appointments for all soldiers
      fetchAllAppointments(sortedSoldiers);
    } catch (error) {
      console.error('Error fetching soldiers:', error);
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
    } catch (error) {
      console.error('Error fetching other forms:', error);
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
    
    // Pre-populate exceptions from cross-roster conflicts (if enabled)
    if (crossRosterCheckEnabled && selectedRostersForCheck.size > 0) {
      const tempDate2 = new Date(start);
      while (tempDate2 <= end) {
        const dateStr = tempDate2.toISOString().split('T')[0];
        
        // Check each selected roster
        for (const formId of selectedRostersForCheck) {
          const otherForm = otherForms.find(f => f.id === formId);
          if (!otherForm || !otherForm.form_data) continue;
          
          // Generate assignments for the other form to see actual duty assignments
          const otherFormAssignmentsMap = generateAssignmentsForOtherForm(otherForm);
          const otherFormDutyType = otherForm.form_data.duty_config?.nature_of_duty || 'Duty';
          
          // Check each selected soldier
          Array.from(selectedSoldiers).forEach(soldierId => {
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
              
              // Add to exceptions (user-defined exceptions take precedence)
              if (!appointmentExceptions[soldierId]) {
                appointmentExceptions[soldierId] = {};
              }
              // Only set if not already set by user
              if (!appointmentExceptions[soldierId][dateStr]) {
                appointmentExceptions[soldierId][dateStr] = exceptionCode;
              }
            }
          });
        }
        
        tempDate2.setDate(tempDate2.getDate() + 1);
      }
    }
    
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
                // Start with stored days since last duty
                let daysSince = soldier.days_since_last_duty || 0;
                
                // If soldier was assigned duty in this period, calculate from that assignment
                const lastDate = lastAssignmentMap[soldier.id];
                if (lastDate) {
                  const lastDateObj = new Date(lastDate);
                  const daysSinceAssignment = Math.floor((current - lastDateObj) / (1000 * 60 * 60 * 24));
                  // Use the stored days_since_last_duty as baseline, add days since assignment
                  // This accounts for days before the period started
                  daysSince = (soldier.days_since_last_duty || 0) + daysSinceAssignment;
                }
                
                return daysSince;
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
                const lastDate = lastAssignmentMap[soldier.id];
                if (lastDate) {
                  const lastDateObj = new Date(lastDate);
                  const daysSince = Math.floor((current - lastDateObj) / (1000 * 60 * 60 * 24));
                  if (daysSince <= daysOffAfterDuty) {
                    continue; // Skip this soldier, they're still in days-off period
                  }
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
              let daysSince = soldier.days_since_last_duty || 0;
              const lastDate = lastAssignmentMap[soldier.id];
              if (lastDate) {
                const lastDateObj = new Date(lastDate);
                const daysSinceAssignment = Math.floor((current - lastDateObj) / (1000 * 60 * 60 * 24));
                daysSince = (soldier.days_since_last_duty || 0) + daysSinceAssignment;
              }
              return daysSince;
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
              const lastDate = lastAssignmentMap[soldier.id];
              if (lastDate) {
                const lastDateObj = new Date(lastDate);
                const daysSince = Math.floor((current - lastDateObj) / (1000 * 60 * 60 * 24));
                if (daysSince <= daysOffAfterDuty) {
                  continue; // Skip this soldier, they're still in days-off period
                }
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
            for (let i = 1; i <= daysOffAfterDuty; i++) {
              const offDate = new Date(current);
              offDate.setDate(offDate.getDate() + i);
              
              // Only mark if within the period range
              if (offDate <= end) {
                const offDateStr = offDate.toISOString().split('T')[0];
                
                // Only add if there's no existing exception for this date
                const soldierExceptions = exceptions[soldierId] || {};
                if (!soldierExceptions[offDateStr]) {
                  // Check if we already added this days-off exception
                  const alreadyAdded = assignments.some(a => 
                    a.soldier_id === soldierId && a.date === offDateStr && a.exception_code === 'P'
                  );
                  if (!alreadyAdded) {
                    assignments.push({
                      soldier_id: soldierId,
                      date: offDateStr,
                      exception_code: 'P',
                      duty: 'P'
                    });
                  }
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

  // Calculate and update days since last duty for all soldiers in the roster
  // This ensures fairness across all DA6 forms/duties
  const updateSoldiersDaysSinceDuty = async () => {
    if (!formData.period_start || !formData.period_end || selectedSoldiers.size === 0) return;
    
    try {
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
      const totalDetailsMade = detailsMade.size;
      
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
          
          // Calculate days from most recent duty to period end
          // This becomes their new days_since_last_duty (baseline for future rosters)
          const daysSince = Math.floor((periodEnd - mostRecentDutyDate) / (1000 * 60 * 60 * 24)) + 1;
          
          updates.push({
            soldierId: soldierId,
            daysSince: daysSince
          });
        } else {
          // Soldier had no duty assignments in this period
          // They were charged with all details made during this period
          // Increment their days_since_last_duty by the number of details made
          const currentDaysSince = soldier.days_since_last_duty || 0;
          const newDaysSince = currentDaysSince + totalDetailsMade;
          
          updates.push({
            soldierId: soldierId,
            daysSince: newDaysSince
          });
        }
      }
      
      // Update all soldiers
      const updatePromises = updates.map(update => 
        apiClient.put(`/soldiers/${update.soldierId}`, {
          days_since_last_duty: update.daysSince
        }).catch(err => {
          console.error(`Error updating soldier ${update.soldierId}:`, err);
          return null; // Continue with other updates even if one fails
        })
      );
      
      await Promise.all(updatePromises);
      
      // Refresh soldiers list to get updated values
      await fetchSoldiers();
      
      console.log(`Updated days_since_last_duty for ${updates.length} soldiers`);
    } catch (error) {
      console.error('Error updating days since last duty:', error);
      // Don't block form save if this fails, but log it
      alert('Warning: Could not update days since last duty. Form was saved, but soldier profiles may need manual update.');
    }
  };

  const handleSave = async (status = 'draft') => {
    try {
      // Don't generate all assignments - they can be generated on-demand
      // Only store the source data to keep payload size manageable
      const payload = {
        unit_name: formData.unit_name,
        period_start: formData.period_start,
        period_end: formData.period_end,
        status: status,
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

      if (id) {
        await apiClient.put(`/da6-forms/${id}`, payload);
        
        // Update days since last duty when form is completed
        if (status === 'completed') {
          await updateSoldiersDaysSinceDuty();
          navigate(`/forms/${id}/view`);
        } else {
          alert('Form saved successfully!');
          navigate('/forms');
        }
      } else {
        const { data } = await apiClient.post('/da6-forms', payload);
        
        // Update days since last duty when form is completed
        if (status === 'completed') {
          await updateSoldiersDaysSinceDuty();
          navigate(`/forms/${data.form.id}/view`);
        } else {
          navigate(`/forms/${data.form.id}`);
        }
      }
    } catch (error) {
      console.error('Error saving form:', error);
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

  const toggleSelectAll = () => {
    if (selectedSoldiers.size === soldiers.length) {
      // Deselect all
      setSelectedSoldiers(new Set());
      setExceptions({});
    } else {
      // Select all
      const allSelected = new Set(soldiers.map(s => s.id));
      setSelectedSoldiers(allSelected);
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

  const handleProfileUpdate = () => {
    // Refresh appointments when profile is updated
    fetchAllAppointments(soldiers);
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
    return <div className="loading">Loading form...</div>;
  }

  return (
    <Layout>
      <div className="da6-form-container">
      <div className="form-header">
        <h2>{id ? 'Edit DA6 Form' : 'Create New DA6 Form'}</h2>
        <div className="form-actions-header">
          <button className="btn-secondary" onClick={() => navigate('/forms')}>
            Cancel
          </button>
          <button className="btn-secondary" onClick={() => handleSave('draft')}>
            Save Draft
          </button>
          <button className="btn-primary" onClick={() => handleSave('completed')}>
            Save & Complete
          </button>
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
                        <span className="appointments-badge" title={`${appointments.length} appointment(s) scheduled`}>
                          📅 {appointments.length}
                        </span>
                      )}
                      {hasUnavailabilityInRange && (
                        <span className="unavailable-badge" title="Unavailable during this period">
                          ⚠️
                        </span>
                      )}
                      <button
                        className="btn-profile"
                        onClick={() => setSelectedProfileSoldier(soldier)}
                        title="View profile and appointments"
                      >
                        Profile
                      </button>
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
              Enable automatic cross-roster checking. When enabled, the roster generation will automatically skip soldiers who are already assigned duty in the selected rosters and apply appropriate exception codes (CQ, SD, or D).
            </p>
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
                  <label>Select Rosters to Check:</label>
                  {otherForms.map(form => (
                    <label key={form.id}>
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
            )}
            {crossRosterCheckEnabled && selectedRostersForCheck.size > 0 && (
              <button
                type="button"
                className="btn-secondary"
                onClick={performCrossRosterCheck}
                title="Cross-roster checking is automatic during generation. Click to see status."
              >
                Check Status
              </button>
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
                              title={isCrossRosterException ? 'Cross-roster conflict (automatically applied)' : ''}
                            >
                              {shouldShow && (
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

