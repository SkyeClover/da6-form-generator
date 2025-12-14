/**
 * Form Status Utility
 * Calculates the status of a DA6 form based on its period dates
 * 
 * States:
 * - "pending": Start date is in the future
 * - "in_progress": Current date is within the start and end dates (inclusive)
 * - "ended": End date has passed
 */

/**
 * Calculate form status based on period dates
 * @param {string|Date} periodStart - Start date of the form period
 * @param {string|Date} periodEnd - End date of the form period
 * @param {Date} referenceDate - Optional reference date (defaults to today)
 * @returns {string} - 'pending', 'in_progress', or 'ended'
 */
export const calculateFormStatus = (periodStart, periodEnd, referenceDate = null) => {
  if (!periodStart || !periodEnd) {
    return 'pending';
  }

  const today = referenceDate || new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(periodStart);
  start.setHours(0, 0, 0, 0);

  const end = new Date(periodEnd);
  end.setHours(23, 59, 59, 999); // Include the entire end date

  if (today < start) {
    return 'pending';
  } else if (today > end) {
    return 'ended';
  } else {
    return 'in_progress';
  }
};

/**
 * Format status for display
 * @param {string} status - Status value
 * @returns {string} - Formatted status string
 */
export const formatFormStatus = (status) => {
  if (!status) return 'Pending';
  
  switch (status.toLowerCase()) {
    case 'pending':
      return 'Pending';
    case 'in_progress':
      return 'In Progress';
    case 'ended':
      return 'Ended';
    default:
      // For backward compatibility with old statuses
      return status.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
  }
};

/**
 * Get status for a form object
 * @param {Object} form - Form object with period_start and period_end
 * @returns {string} - Calculated status
 */
export const getFormStatus = (form) => {
  if (!form) return 'pending';
  
  // If form has a stored status and it's one of the valid states, use it
  // Otherwise calculate it
  const validStatuses = ['pending', 'in_progress', 'ended'];
  if (form.status && validStatuses.includes(form.status.toLowerCase())) {
    // Still calculate to ensure it's current
    return calculateFormStatus(form.period_start, form.period_end);
  }
  
  return calculateFormStatus(form.period_start, form.period_end);
};

