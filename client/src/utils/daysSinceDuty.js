/**
 * Utility functions for calculating days since last duty dynamically
 * This calculates based on actual dates from completed forms and appointments,
 * rather than relying on stored values that can become stale.
 */

/**
 * Calculate days since last duty for a soldier based on all forms and appointments
 * @param {Object} soldier - Soldier object
 * @param {Array} allForms - Array of all DA6 forms (any status - pending, in_progress, ended)
 * @param {Array} appointments - Array of soldier appointments (including duties)
 * @param {Date} referenceDate - Date to calculate from (defaults to today)
 * @returns {number} Days since last duty
 */
export const calculateDaysSinceLastDuty = (soldier, allForms = [], appointments = [], referenceDate = null) => {
  const today = referenceDate || new Date();
  today.setHours(0, 0, 0, 0);
  
  let lastDutyDate = null;
  
  // Check appointments for duty assignments (CQ, SD, D exception codes)
  const dutyExceptionCodes = ['CQ', 'SD', 'D'];
  appointments.forEach(apt => {
    if (dutyExceptionCodes.includes(apt.exception_code)) {
      const aptStart = new Date(apt.start_date);
      aptStart.setHours(0, 0, 0, 0);
      
      // Use the start date of the appointment as the duty date
      if (aptStart <= today && (!lastDutyDate || aptStart > lastDutyDate)) {
        lastDutyDate = aptStart;
      }
    }
  });
  
  // Check all forms for duty assignments (any status - all forms are treated as real)
  allForms.forEach(form => {
    if (!form.form_data || !form.form_data.selected_soldiers) return;
    
    // Check if soldier was in this form
    if (!form.form_data.selected_soldiers.includes(soldier.id)) return;
    
    // Generate assignments for this form (simplified - just check form_data.assignments if available)
    // Or we could generate them, but for now let's check stored assignments
    const assignments = form.form_data.assignments || [];
    
    assignments.forEach(assignment => {
      if (assignment.soldier_id === soldier.id && 
          assignment.duty && 
          !assignment.exception_code) {
        const dutyDate = new Date(assignment.date);
        dutyDate.setHours(0, 0, 0, 0);
        
        if (dutyDate <= today && (!lastDutyDate || dutyDate > lastDutyDate)) {
          lastDutyDate = dutyDate;
        }
      }
    });
  });
  
  // Calculate days since last duty
  if (lastDutyDate) {
    const daysSince = Math.floor((today - lastDutyDate) / (1000 * 60 * 60 * 24));
    return Math.max(0, daysSince);
  }
  
  // If no duty found, return stored value or 0
  // This handles cases where soldier had duty before the oldest form in the system
  return soldier.days_since_last_duty || 0;
};

/**
 * Generate assignments for a form (helper function for calculating days)
 * This is a simplified version that extracts assignments from form data
 */
export const getAssignmentsFromForm = (form) => {
  if (!form.form_data) return [];
  
  // If assignments are already stored, use them
  if (form.form_data.assignments && Array.isArray(form.form_data.assignments)) {
    return form.form_data.assignments;
  }
  
  // Otherwise, we'd need to generate them, but for now return empty
  // The calling code should handle generating assignments if needed
  return [];
};

