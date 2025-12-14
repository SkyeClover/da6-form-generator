/**
 * Roster Generation Utility
 * Implements the soldier selection and assignment logic for DA6 forms
 */

import { getRankOrder, rankMatchesRequirement, isLowerEnlisted, isNCORank, isWarrantOfficerRank, isOfficerRank } from './rankOrder';
import { getFederalHolidaysInRange } from './federalHolidays';
import { calculateDaysSinceLastDuty } from './daysSinceDuty';

/**
 * Get all dates in a range
 * @param {Date|string} startDate - Start date
 * @param {Date|string} endDate - End date
 * @returns {Array<Date>} Array of dates
 */
export const getDatesInRange = (startDate, endDate) => {
  // Parse dates properly to avoid timezone issues
  // If it's a string in YYYY-MM-DD format, parse it as local date
  let start, end;
  
  if (typeof startDate === 'string' && startDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
    // Parse YYYY-MM-DD string as local date (not UTC)
    const [year, month, day] = startDate.split('-').map(Number);
    start = new Date(year, month - 1, day, 0, 0, 0, 0);
  } else {
    start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
  }
  
  if (typeof endDate === 'string' && endDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
    // Parse YYYY-MM-DD string as local date (not UTC)
    const [year, month, day] = endDate.split('-').map(Number);
    end = new Date(year, month - 1, day, 0, 0, 0, 0);
  } else {
    end = new Date(endDate);
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

/**
 * Check if a date is a weekend
 * @param {Date} date - Date to check
 * @returns {boolean}
 */
export const isWeekend = (date) => {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
};

/**
 * Get exception code for appointment
 * @param {Object} appointment - Appointment object
 * @returns {string|null} Exception code
 */
const getExceptionCodeFromAppointment = (appointment) => {
  // Map appointment reasons to exception codes
  const reason = (appointment.reason || '').toUpperCase();
  const exceptionCode = appointment.exception_code;
  
  if (exceptionCode) return exceptionCode;
  
  // Map common reasons to exception codes
  if (reason.includes('LEAVE') || reason.includes('PASS')) return 'A';
  if (reason.includes('AWOL') || reason.includes('CONFINEMENT') || reason.includes('ARREST')) return 'U';
  if (reason.includes('DUTY') || reason.includes('DETAIL')) return 'D';
  if (reason.includes('TDY') || reason.includes('TRAINING') || reason.includes('MEDICAL')) return 'A';
  
  return 'A'; // Default to authorized absence
};

/**
 * Get exception code for cross-roster duty
 * Creates an abbreviation from the duty name (up to 3-4 characters)
 * @param {string} dutyName - Name of the duty
 * @returns {string} Exception code (abbreviation of duty name)
 */
export const getCrossRosterExceptionCode = (dutyName) => {
  if (!dutyName) return 'D';
  
  // Remove common words and clean up
  let cleaned = dutyName.trim().toUpperCase();
  
  // Remove common words that don't contribute to abbreviation
  const commonWords = ['OF', 'THE', 'AND', 'FOR', 'TO', 'A', 'AN'];
  const words = cleaned.split(/\s+/).filter(w => w.length > 0 && !commonWords.includes(w));
  
  // If it's already short (3 chars or less), use it as-is
  if (cleaned.length <= 3) {
    return cleaned;
  }
  
  // For multiple words, use first letter of each significant word
  if (words.length > 1) {
    // Use first letter of each word, up to 4 characters
    const abbreviation = words.map(w => w[0]).join('').substring(0, 4);
    if (abbreviation.length >= 2) {
      return abbreviation;
    }
  }
  
  // Special cases for common duty names
  const specialCases = {
    'CHANGE OF QUARTERS': 'COQ',
    'CHARGE OF QUARTERS': 'CQ',
    'STAFF DUTY': 'SD',
    'COMMAND DUTY': 'CD',
    'DUTY OFFICER': 'DO',
    'OFFICER OF THE DAY': 'OD',
    'NONCOMMISSIONED OFFICER OF THE DAY': 'NCOOD',
    'NCO OF THE DAY': 'NCOOD'
  };
  
  // Check for special cases (exact match or contains)
  for (const [key, abbrev] of Object.entries(specialCases)) {
    if (cleaned.includes(key) || key.includes(cleaned)) {
      return abbrev;
    }
  }
  
  // If single word or abbreviation didn't work well, use first 3-4 characters
  // Prefer consonants for better readability
  if (cleaned.length <= 4) {
    return cleaned;
  }
  
  // For longer single words, take first 3-4 characters
  // Try to avoid ending on a vowel if possible
  let abbrev = cleaned.substring(0, 3);
  if (cleaned.length > 3 && !/[AEIOU]/.test(cleaned[3])) {
    abbrev = cleaned.substring(0, 4);
  }
  
  return abbrev;
};

/**
 * Check if soldier has exception on date
 * @param {string} soldierId - Soldier ID
 * @param {Date} date - Date to check
 * @param {Array} appointments - Array of appointments
 * @param {Array} otherForms - Array of other forms for cross-roster checking
 * @param {string} currentDutyName - Current duty name
 * @returns {Object|null} { code: string, reason: string } or null
 */
const getExceptionForDate = (soldierId, date, appointments, otherForms, currentDutyName) => {
  const dateStr = date.toISOString().split('T')[0];
  
  // Check appointments
  for (const apt of appointments) {
    if (apt.soldier_id !== soldierId) continue;
    
    const aptStart = new Date(apt.start_date);
    const aptEnd = new Date(apt.end_date);
    aptStart.setHours(0, 0, 0, 0);
    aptEnd.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    
    if (checkDate >= aptStart && checkDate <= aptEnd) {
      return {
        code: getExceptionCodeFromAppointment(apt),
        reason: apt.reason || 'Appointment'
      };
    }
  }
  
  // Check cross-roster duties
  // CRITICAL: This prevents assigning duty to soldiers who already have duty from another form
  for (const form of otherForms) {
    if (!form.form_data) continue;
    
    const dutyName = form.form_data.duty_config?.nature_of_duty || 'Duty';
    if (dutyName === currentDutyName) continue; // Skip same duty
    
    // Check stored assignments for cross-roster duties
    const assignments = form.form_data.assignments || [];
    for (const assignment of assignments) {
      if (assignment.soldier_id === soldierId && assignment.date === dateStr && assignment.duty === true) {
        // Soldier has duty from another form on this date - return exception
        const exceptionCode = getCrossRosterExceptionCode(dutyName);
        return {
          code: exceptionCode,
          reason: `Duty: ${dutyName}`
        };
      }
    }
    
    // Also check appointments for duty assignments from this form
    // This catches cases where duties were stored as appointments
    for (const apt of appointments) {
      if (apt.soldier_id !== soldierId) continue;
      if (apt.exception_code !== 'D') continue; // Only check duty appointments
      
      // Check if this appointment is linked to the other form
      const aptFormId = apt.form_id || (apt.notes && apt.notes.match(/DA6_FORM:([a-f0-9-]+)/)?.[1]);
      if (aptFormId !== form.id) continue;
      
      const aptStart = new Date(apt.start_date);
      const aptEnd = new Date(apt.end_date);
      aptStart.setHours(0, 0, 0, 0);
      aptEnd.setHours(0, 0, 0, 0);
      const checkDate = new Date(date);
      checkDate.setHours(0, 0, 0, 0);
      
      if (checkDate >= aptStart && checkDate <= aptEnd) {
        // Soldier has duty appointment from another form on this date
        const exceptionCode = getCrossRosterExceptionCode(dutyName);
        return {
          code: exceptionCode,
          reason: `Duty: ${dutyName}`
        };
      }
    }
  }
  
  return null;
};

/**
 * Filter soldiers by rank requirement
 * @param {Array} soldiers - Array of soldiers
 * @param {Object} requirement - Rank requirement
 * @param {Object} globalExclusions - Global exclusions
 * @returns {Array} Filtered soldiers
 */
const filterSoldiersByRequirement = (soldiers, requirement, globalExclusions) => {
  return soldiers.filter(soldier => {
    const rank = (soldier.rank || '').toUpperCase().trim();
    
    // Check global exclusions first
    if (globalExclusions.ranks && globalExclusions.ranks.includes(rank)) {
      return false;
    }
    
    if (globalExclusions.groups) {
      if (globalExclusions.groups.includes('lower_enlisted') && isLowerEnlisted(rank)) return false;
      if (globalExclusions.groups.includes('nco') && isNCORank(rank)) return false;
      if (globalExclusions.groups.includes('warrant') && isWarrantOfficerRank(rank)) return false;
      if (globalExclusions.groups.includes('officer') && isOfficerRank(rank)) return false;
    }
    
    // Check if rank matches requirement (this also checks requirement-specific exclusions)
    return rankMatchesRequirement(rank, requirement);
  });
};

/**
 * Check if soldier is available (not in days-off period)
 * @param {string} soldierId - Soldier ID
 * @param {Date} date - Date to check
 * @param {Object} assignments - Map of assignments by soldier and date
 * @param {number} daysOffAfterDuty - Days off after duty
 * @param {Array} appointments - All appointments (to check for passes from other forms)
 * @param {Array} otherForms - Other forms (to check for passes from other forms)
 * @returns {boolean}
 */
const isSoldierAvailable = (soldierId, date, assignments, daysOffAfterDuty, appointments = [], otherForms = []) => {
  const dateStr = date.toISOString().split('T')[0];
  
  // First, check if soldier already has a pass (P) on this date
  // Passes indicate days off after duty, so soldier shouldn't get duty
  if (assignments[soldierId] && assignments[soldierId][dateStr]) {
    const assignment = assignments[soldierId][dateStr];
    if (assignment.exception_code === 'P') {
      return false; // Soldier has a pass (day off) on this date
    }
    // Also check if soldier already has duty on this date
    if (assignment.duty && !assignment.exception_code) {
      return false; // Soldier already has duty on this date
    }
  }
  
  // CRITICAL: Check appointments for passes from OTHER forms
  // This ensures passes from previous duties are respected
  const passAppointment = appointments.find(apt => {
    if (apt.soldier_id !== soldierId) return false;
    if (apt.exception_code !== 'P') return false; // Only check pass appointments
    
    const aptStart = new Date(apt.start_date);
    const aptEnd = new Date(apt.end_date);
    const checkDate = new Date(date);
    aptStart.setHours(0, 0, 0, 0);
    aptEnd.setHours(0, 0, 0, 0);
    checkDate.setHours(0, 0, 0, 0);
    
    return checkDate >= aptStart && checkDate <= aptEnd;
  });
  
  if (passAppointment) {
    return false; // Soldier has a pass from another form on this date
  }
  
  // CRITICAL: Check other forms for passes that extend into the future
  // This catches passes that were created but might not be in appointments yet
  for (const otherForm of otherForms) {
    if (!otherForm.form_data || !otherForm.form_data.assignments) continue;
    
    const otherFormAssignments = otherForm.form_data.assignments || [];
    const hasPassOnDate = otherFormAssignments.some(
      a => a.soldier_id === soldierId && 
           a.date === dateStr && 
           a.exception_code === 'P' && 
           !a.duty
    );
    
    if (hasPassOnDate) {
      // Check if the soldier actually got duty in that form (passes only count if soldier had duty)
      const hasDutyInOtherForm = otherFormAssignments.some(
        a => a.soldier_id === soldierId && a.duty === true
      );
      
      if (hasDutyInOtherForm) {
        return false; // Soldier has a pass from another form on this date
      }
    }
  }
  
  // Check if soldier has duty in the days-off period before this date
  // This prevents assigning duty too soon after a previous duty
  for (let i = 1; i <= daysOffAfterDuty; i++) {
    const checkDate = new Date(date);
    checkDate.setDate(checkDate.getDate() - i);
    const checkDateStr = checkDate.toISOString().split('T')[0];
    
    if (assignments[soldierId] && assignments[soldierId][checkDateStr]) {
      const assignment = assignments[soldierId][checkDateStr];
      // If soldier had duty on this date, they're not available
      if (assignment.duty && !assignment.exception_code) {
        return false; // Soldier is in days-off period
      }
    }
    
    // Also check appointments and other forms for duty in the days-off period
    const dutyAppointment = appointments.find(apt => {
      if (apt.soldier_id !== soldierId) return false;
      if (apt.exception_code !== 'D') return false; // Only check duty appointments
      
      const aptStart = new Date(apt.start_date);
      const aptEnd = new Date(apt.end_date);
      const checkDateObj = new Date(checkDate);
      aptStart.setHours(0, 0, 0, 0);
      aptEnd.setHours(0, 0, 0, 0);
      checkDateObj.setHours(0, 0, 0, 0);
      
      return checkDateObj >= aptStart && checkDateObj <= aptEnd;
    });
    
    if (dutyAppointment) {
      return false; // Soldier had duty from another form in the days-off period
    }
    
    // Check other forms for duty in the days-off period
    for (const otherForm of otherForms) {
      if (!otherForm.form_data || !otherForm.form_data.assignments) continue;
      
      const hasDutyOnCheckDate = otherForm.form_data.assignments.some(
        a => a.soldier_id === soldierId && 
             a.date === checkDateStr && 
             a.duty === true
      );
      
      if (hasDutyOnCheckDate) {
        return false; // Soldier had duty from another form in the days-off period
      }
    }
  }
  
  return true;
};

/**
 * Generate roster assignments for a form
 * @param {Object} formData - Form data
 * @param {Array} soldiers - Array of all soldiers
 * @param {Array} appointments - Array of all appointments
 * @param {Array} otherForms - Array of other forms for cross-roster checking
 * @returns {Object} { assignments: Array, selected_soldiers: Array }
 */
export const generateRoster = (formData, soldiers, appointments, otherForms = []) => {
  const { duty_config, rank_requirements } = formData;
  const { nature_of_duty, period_start, period_end, days_off_after_duty = 1, separate_weekend_holiday_cycle, applies_to_weekends_holidays = true } = duty_config;
  
  console.log('Roster generator called with:', {
    days_off_after_duty,
    applies_to_weekends_holidays,
    period_start,
    period_end,
    duty_config_keys: Object.keys(duty_config || {})
  });
  
  // Ensure days_off_after_duty is a valid number
  const validDaysOff = typeof days_off_after_duty === 'number' && days_off_after_duty > 0 ? days_off_after_duty : 1;
  if (days_off_after_duty !== validDaysOff) {
    console.warn(`Invalid days_off_after_duty value: ${days_off_after_duty}, using default: ${validDaysOff}`);
  }
  
  const assignments = [];
  const selectedSoldiers = new Set();
  const assignmentsBySoldier = {}; // Track assignments for days-off checking
  
  // Get dates in range
  const dates = getDatesInRange(period_start, period_end);
  
  // Get holidays
  const holidays = getFederalHolidaysInRange(period_start, period_end);
  const holidayDates = new Set(holidays.map(h => h.date));
  
  // Track last duty date by cycle for each soldier
  const lastDutyByCycle = {}; // { soldierId: { regular: Date, weekend_holiday: Date } }
  
  // Track days since last duty for each soldier as we process dates
  // This gets updated dynamically as we assign duties
  const daysSinceLastDutyBySoldier = {}; // { soldierId: number }
  
  // Include ALL forms (any status) for days calculation and conflict checking
  // All forms created by the user should be treated as real assignments
  const allRelevantForms = otherForms; // Include all forms regardless of status
  
  // Initialize days since last duty for all soldiers based on period start date
  const periodStartDate = new Date(period_start);
  periodStartDate.setHours(0, 0, 0, 0);
  
  soldiers.forEach(soldier => {
    daysSinceLastDutyBySoldier[soldier.id] = calculateDaysSinceLastDuty(
      soldier,
      allRelevantForms,
      appointments,
      periodStartDate
    );
  });
  
  // Process each date
  for (const date of dates) {
    const dateStr = date.toISOString().split('T')[0];
    const isWeekendDay = isWeekend(date);
    const isHolidayDay = holidayDates.has(dateStr);
    
    // Skip weekends/holidays if duty doesn't apply to them
    if (applies_to_weekends_holidays === false && (isWeekendDay || isHolidayDay)) {
      continue; // Skip this date entirely - no duty assignments
    }
    
    // Determine cycle type
    const isWeekendHoliday = separate_weekend_holiday_cycle && (isWeekendDay || isHolidayDay);
    const cycleType = isWeekendHoliday ? 'weekend_holiday' : 'regular';
    
    // Track which soldiers have exceptions (but don't add to assignments yet)
    // We'll add exception assignments after duty assignments to avoid conflicts
    const soldierExceptions = {}; // { soldierId: { code, reason } }
    
    // CRITICAL: Check for cross-roster duties FIRST before processing any requirements
    // This ensures soldiers with existing duties from other forms are not assigned new duties
    for (const soldier of soldiers) {
      const exception = getExceptionForDate(soldier.id, date, appointments, otherForms, nature_of_duty);
      if (exception) {
        soldierExceptions[soldier.id] = exception;
        // Log cross-roster duty conflicts for debugging
        if (exception.code !== 'P' && exception.code !== 'A' && exception.code !== 'U' && exception.code !== 'L' && exception.code !== 'T' && exception.code !== 'TDY') {
          console.log(`[CROSS-ROSTER] Soldier ${soldier.last_name} has ${exception.code} (${exception.reason}) on ${dateStr} - will not assign duty`);
        }
      }
    }
    
    // If we have rank requirements, process each requirement
    if (rank_requirements && rank_requirements.requirements && rank_requirements.requirements.length > 0) {
      for (const requirement of rank_requirements.requirements) {
        // Filter soldiers by requirement
        let availableSoldiers = filterSoldiersByRequirement(
          soldiers,
          requirement,
          rank_requirements.exclusions || { ranks: [], groups: [] }
        );
        
        // CRITICAL: Filter out soldiers with exceptions on this date (including cross-roster duties)
        // This prevents assigning duty to soldiers who already have duty from another form
        availableSoldiers = availableSoldiers.filter(soldier => {
          if (soldierExceptions[soldier.id]) {
            // Soldier has an exception (including cross-roster duty) - exclude them
            return false;
          }
          return true;
        });
        
        // Filter out soldiers in days-off period
        // CRITICAL: Pass appointments and otherForms to check for passes from other forms
        availableSoldiers = availableSoldiers.filter(soldier => {
          return isSoldierAvailable(soldier.id, date, assignmentsBySoldier, days_off_after_duty, appointments, allRelevantForms);
        });
        
        // Filter out soldiers already assigned on this date
        const assignedOnDate = new Set(
          assignments
            .filter(a => a.date === dateStr && a.duty)
            .map(a => a.soldier_id)
        );
        availableSoldiers = availableSoldiers.filter(soldier => !assignedOnDate.has(soldier.id));
        
        // CRITICAL: Filter out soldiers with 0 days since last duty (unless no other soldiers available)
        // Soldiers with 0 days just had duty and shouldn't be assigned again
        // However, if ALL available soldiers have 0 days, we'll still assign (edge case)
        const soldiersWithDays = availableSoldiers.filter(soldier => {
          const days = daysSinceLastDutyBySoldier[soldier.id];
          if (days === undefined || days === null) {
            // Calculate if not yet tracked
            const calculatedDays = calculateDaysSinceLastDuty(soldier, allRelevantForms, appointments, date) || 0;
            daysSinceLastDutyBySoldier[soldier.id] = calculatedDays;
            return calculatedDays > 0;
          }
          return days > 0;
        });
        
        // Only use soldiers with days > 0 if there are any available
        // Otherwise, fall back to all available soldiers (edge case where all have 0 days)
        if (soldiersWithDays.length > 0) {
          availableSoldiers = soldiersWithDays;
        }
        
        // Sort by priority - use current days since last duty from our tracking
        // CRITICAL: Use daysSinceLastDutyBySoldier which is updated dynamically as we assign duties
        // This ensures soldiers who just got duty have their days reset, and others increment correctly
        availableSoldiers = availableSoldiers.sort((a, b) => {
          // Get days from our dynamic tracking (updated as we assign duties)
          // Fall back to calculated value only if not yet tracked
          let daysA = daysSinceLastDutyBySoldier[a.id];
          if (daysA === undefined || daysA === null) {
            daysA = calculateDaysSinceLastDuty(a, allRelevantForms, appointments, date) || 0;
            daysSinceLastDutyBySoldier[a.id] = daysA; // Cache it
          }
          
          let daysB = daysSinceLastDutyBySoldier[b.id];
          if (daysB === undefined || daysB === null) {
            daysB = calculateDaysSinceLastDuty(b, allRelevantForms, appointments, date) || 0;
            daysSinceLastDutyBySoldier[b.id] = daysB; // Cache it
          }
          
          // Primary: Days since last duty (descending - most days first)
          if (daysA !== daysB) {
            console.log(`[SORTING] ${a.last_name} (${daysA} days) vs ${b.last_name} (${daysB} days) - ${daysB > daysA ? b.last_name : a.last_name} has more days`);
            return daysB - daysA;
          }
          
          // Secondary: Rank (if requirement specified, prefer preferred/fallback ranks)
          if (requirement) {
            const rankA = (a.rank || '').toUpperCase().trim();
            const rankB = (b.rank || '').toUpperCase().trim();
            
            // Check preferred ranks
            if (requirement.preferred_ranks && requirement.preferred_ranks.length > 0) {
              const aIsPreferred = requirement.preferred_ranks.includes(rankA);
              const bIsPreferred = requirement.preferred_ranks.includes(rankB);
              if (aIsPreferred && !bIsPreferred) return -1;
              if (!aIsPreferred && bIsPreferred) return 1;
            }
            
            // Check fallback ranks
            if (requirement.fallback_ranks && requirement.fallback_ranks.length > 0) {
              const aIsFallback = requirement.fallback_ranks.includes(rankA);
              const bIsFallback = requirement.fallback_ranks.includes(rankB);
              if (aIsFallback && !bIsFallback) return -1;
              if (!aIsFallback && bIsFallback) return 1;
            }
          }
          
          // Tertiary: Rank order (lower rank first)
          const rankOrderA = getRankOrder(a.rank);
          const rankOrderB = getRankOrder(b.rank);
          if (rankOrderA !== rankOrderB) {
            return rankOrderA - rankOrderB;
          }
          
          // Quaternary: Alphabetical (last name, then first name)
          const lastNameA = (a.last_name || '').toLowerCase();
          const lastNameB = (b.last_name || '').toLowerCase();
          if (lastNameA !== lastNameB) {
            return lastNameA.localeCompare(lastNameB);
          }
          
          const firstNameA = (a.first_name || '').toLowerCase();
          const firstNameB = (b.first_name || '').toLowerCase();
          return firstNameA.localeCompare(firstNameB);
        });
        
        // CRITICAL: Validate that we have enough eligible soldiers
        // NEVER assign duty to someone who doesn't match the rank requirement
        if (availableSoldiers.length < requirement.quantity) {
          const requirementDesc = requirement.group 
            ? `rank group "${requirement.group}"`
            : requirement.rank_range 
            ? `rank range "${requirement.rank_range}"`
            : requirement.ranks 
            ? `ranks: ${requirement.ranks.join(', ')}`
            : 'specified rank requirement';
          
          throw new Error(
            `Cannot assign duty on ${dateStr}: Not enough eligible soldiers matching ${requirementDesc}. ` +
            `Required: ${requirement.quantity}, Available: ${availableSoldiers.length}. ` +
            `This may be due to soldiers being unavailable (on leave, TDY, or in days-off period) or not matching the rank requirements.`
          );
        }
        
        // CRITICAL: Double-check that each soldier matches the requirement before assigning
        // This is a safety check to ensure we never assign to someone who doesn't match
        const toSelect = requirement.quantity;
        for (let i = 0; i < toSelect; i++) {
          const soldier = availableSoldiers[i];
          if (!soldier) {
            throw new Error(
              `Cannot assign duty on ${dateStr}: Not enough eligible soldiers. ` +
              `Required: ${requirement.quantity}, but only ${i} soldiers were available.`
            );
          }
          
          // CRITICAL: Verify the soldier matches the requirement before assigning
          const rank = (soldier.rank || '').toUpperCase().trim();
          const matchesRequirement = rankMatchesRequirement(rank, requirement);
          
          if (!matchesRequirement) {
            throw new Error(
              `CRITICAL ERROR: Attempted to assign duty to ${soldier.rank} ${soldier.last_name} on ${dateStr}, ` +
              `but they do not match the rank requirement. This should never happen. ` +
              `Requirement: ${JSON.stringify(requirement)}`
            );
          }
          
          // Log selection for debugging
          const soldierDays = daysSinceLastDutyBySoldier[soldier.id] ?? calculateDaysSinceLastDuty(soldier, allRelevantForms, appointments, date) ?? 0;
          console.log(`[DUTY ASSIGNMENT] Assigning duty to ${soldier.rank} ${soldier.last_name} on ${dateStr} (${soldierDays} days since last duty)`);
          
          // Create duty assignment
          assignments.push({
            soldier_id: soldier.id,
            date: dateStr,
            duty: true,
            exception_code: null
          });
          
          selectedSoldiers.add(soldier.id);
          
          if (!assignmentsBySoldier[soldier.id]) {
            assignmentsBySoldier[soldier.id] = {};
          }
          assignmentsBySoldier[soldier.id][dateStr] = {
            duty: true,
            exception_code: null
          };
          
          // Update last duty date for this cycle
          if (!lastDutyByCycle[soldier.id]) {
            lastDutyByCycle[soldier.id] = {};
          }
          lastDutyByCycle[soldier.id][cycleType] = new Date(date);
          
          // Reset days since last duty to 0 for this soldier (they just got duty)
          daysSinceLastDutyBySoldier[soldier.id] = 0;
          
          // Create pass assignments for days off AFTER this specific duty assignment
          // Always start from day 1 (the first day after duty) to ensure it's included
          // If duty doesn't apply to weekends/holidays, skip those days
          console.log(`[PASS CREATION] Starting pass creation for soldier ${soldier.id} after duty on ${dateStr}, days_off_after_duty: ${days_off_after_duty}`);
          let daysCreated = 0;
          let dayOffset = 1;
          
          // Keep creating passes until we've created the required number of days
          // Continue even if we go slightly past the form period to ensure all passes are created
          const validDaysOff = typeof days_off_after_duty === 'number' && days_off_after_duty > 0 ? days_off_after_duty : 1;
          console.log(`[PASS CREATION] Loop condition: daysCreated (${daysCreated}) < validDaysOff (${validDaysOff})`);
          while (daysCreated < validDaysOff) {
            const passDate = new Date(date);
            passDate.setDate(passDate.getDate() + dayOffset);
            passDate.setHours(0, 0, 0, 0);
            const passDateStr = passDate.toISOString().split('T')[0];
            
            // Check if this date is a weekend or holiday
            const isWeekendDay = isWeekend(passDate);
            const isHolidayDay = holidayDates.has(passDateStr);
            
            // If duty doesn't apply to weekends/holidays, skip those days for passes
            if (applies_to_weekends_holidays === false && (isWeekendDay || isHolidayDay)) {
              dayOffset++;
              continue; // Skip this day, don't count it toward days off
            }
            
            // Check if assignment already exists for this soldier on this date
            const existingIndex = assignments.findIndex(
              a => a.soldier_id === soldier.id && a.date === passDateStr
            );
            
            // CRITICAL: Always create pass assignment, even if it's outside the form period
            // Passes need to be in the assignments array for display in the table
            if (existingIndex === -1) {
              // No existing assignment - create new pass
              assignments.push({
                soldier_id: soldier.id,
                date: passDateStr,
                exception_code: 'P',
                duty: false
              });
              
              if (!assignmentsBySoldier[soldier.id]) {
                assignmentsBySoldier[soldier.id] = {};
              }
              assignmentsBySoldier[soldier.id][passDateStr] = {
                exception_code: 'P',
                duty: false
              };
              
              console.log(`Created pass assignment for soldier ${soldier.id} on ${passDateStr} (day ${dayOffset} after duty on ${dateStr})`);
            } else {
              // Existing assignment found - check if we should update it
              const existingAssignment = assignments[existingIndex];
              
              // If existing assignment is a duty, don't overwrite it with a pass
              if (existingAssignment.duty) {
                console.log(`Skipping pass for ${passDateStr} - soldier ${soldier.id} already has duty on this date`);
                dayOffset++;
                continue; // Skip this day, but don't count it toward days off
              }
              
              // Update existing assignment to include pass (but don't overwrite other exceptions)
              if (!existingAssignment.exception_code || existingAssignment.exception_code === 'P') {
                assignments[existingIndex].exception_code = 'P';
                
                if (!assignmentsBySoldier[soldier.id]) {
                  assignmentsBySoldier[soldier.id] = {};
                }
                assignmentsBySoldier[soldier.id][passDateStr] = {
                  exception_code: 'P',
                  duty: false
                };
                
                console.log(`Updated existing assignment to pass for soldier ${soldier.id} on ${passDateStr}`);
              } else {
                // Existing assignment has a different exception code - don't overwrite
                console.log(`Skipping pass for ${passDateStr} - soldier ${soldier.id} already has exception ${existingAssignment.exception_code}`);
                dayOffset++;
                continue; // Skip this day, but don't count it toward days off
              }
            }
            
            daysCreated++;
            dayOffset++;
          }
        }
      }
    }
    
    // After processing all requirements for this date, add exception assignments
    // for soldiers who have exceptions but weren't assigned duty
    for (const [soldierId, exception] of Object.entries(soldierExceptions)) {
      // Only add exception if soldier wasn't assigned duty on this date
      const hasDutyAssignment = assignments.some(
        a => a.soldier_id === soldierId && a.date === dateStr && a.duty === true
      );
      
      // CRITICAL: Also check if soldier has a pass on this date - passes should never be overwritten
      const hasPassAssignment = assignments.some(
        a => a.soldier_id === soldierId && a.date === dateStr && a.exception_code === 'P'
      );
      
      // Check if an assignment already exists for this soldier on this date
      const existingAssignmentIndex = assignments.findIndex(
        a => a.soldier_id === soldierId && a.date === dateStr
      );
      
      if (!hasDutyAssignment && !hasPassAssignment) {
        if (existingAssignmentIndex === -1) {
          // No assignment exists, create new exception assignment
          assignments.push({
            soldier_id: soldierId,
            date: dateStr,
            exception_code: exception.code,
            duty: false
          });
          
          if (!assignmentsBySoldier[soldierId]) {
            assignmentsBySoldier[soldierId] = {};
          }
          assignmentsBySoldier[soldierId][dateStr] = {
            exception_code: exception.code,
            duty: false
          };
        } else {
          // Assignment exists - only update if it's not a pass (passes take priority)
          const existingAssignment = assignments[existingAssignmentIndex];
          if (existingAssignment.exception_code !== 'P' && !existingAssignment.duty) {
            // Update existing assignment with exception (but don't overwrite passes or duties)
            assignments[existingAssignmentIndex].exception_code = exception.code;
            
            if (!assignmentsBySoldier[soldierId]) {
              assignmentsBySoldier[soldierId] = {};
            }
            assignmentsBySoldier[soldierId][dateStr] = {
              exception_code: exception.code,
              duty: false
            };
          }
          // If it's a pass or duty, leave it as is - passes indicate days off after duty
        }
      }
    }
    
    // Increment days since last duty for all soldiers who didn't get duty on this date
    // (and don't have passes - passes are days off, so they don't count as "days since last duty")
    soldiers.forEach(soldier => {
      const hasDutyOnDate = assignments.some(
        a => a.soldier_id === soldier.id && a.date === dateStr && a.duty === true
      );
      
      // Check if soldier has a pass (P) on this date
      // Passes are days off after duty, so they shouldn't count toward "days since last duty"
      const hasPassOnDate = assignments.some(
        a => a.soldier_id === soldier.id && a.date === dateStr && a.exception_code === 'P'
      );
      
      // Only increment if soldier didn't get duty and doesn't have a pass
      // Other exceptions (like U, A, etc.) don't prevent days from incrementing
      if (!hasDutyOnDate && !hasPassOnDate) {
        // Ensure the value is initialized (should already be from the initialization above)
        // But handle edge case where it might not be set
        if (daysSinceLastDutyBySoldier[soldier.id] === undefined || daysSinceLastDutyBySoldier[soldier.id] === null) {
          daysSinceLastDutyBySoldier[soldier.id] = calculateDaysSinceLastDuty(
            soldier,
            allRelevantForms,
            appointments,
            date
          );
        } else {
          // Increment days since last duty
          // Use explicit check to handle 0 correctly (0 is falsy but valid)
          const currentDays = daysSinceLastDutyBySoldier[soldier.id];
          daysSinceLastDutyBySoldier[soldier.id] = currentDays + 1;
        }
      }
    });
  }
  
  // Debug: Log pass assignments before returning
  const finalPassAssignments = assignments.filter(a => a.exception_code === 'P');
  const finalDutyAssignments = assignments.filter(a => a.duty === true);
  console.log('Roster generator returning:', {
    total_assignments: assignments.length,
    duty_assignments: finalDutyAssignments.length,
    pass_assignments: finalPassAssignments.length,
    other_assignments: assignments.length - finalDutyAssignments.length - finalPassAssignments.length
  });
  
  if (finalPassAssignments.length > 0) {
    console.log('Sample pass assignments in final roster:', finalPassAssignments.slice(0, 5));
  } else {
    console.warn('⚠️ WARNING: No pass assignments in final roster!');
  }
  
  return {
    assignments: assignments.sort((a, b) => {
      // Sort by date, then by soldier name
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return a.soldier_id.localeCompare(b.soldier_id);
    }),
    selected_soldiers: Array.from(selectedSoldiers)
  };
};

