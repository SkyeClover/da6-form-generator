// US Federal Holidays utility
// Calculates federal holidays for a given year

/**
 * Get the date for a specific occurrence of a day in a month
 * @param {number} year - The year
 * @param {number} month - The month (0-11, where 0 = January)
 * @param {number} dayOfWeek - The day of week (0 = Sunday, 6 = Saturday)
 * @param {number} occurrence - Which occurrence (1 = first, 2 = second, etc., -1 = last)
 * @returns {Date}
 */
const getNthDayOfMonth = (year, month, dayOfWeek, occurrence) => {
  const firstDay = new Date(year, month, 1);
  const firstDayOfWeek = firstDay.getDay();
  
  let date;
  if (occurrence > 0) {
    // Find the nth occurrence
    const daysToAdd = (dayOfWeek - firstDayOfWeek + 7) % 7 + (occurrence - 1) * 7;
    date = new Date(year, month, 1 + daysToAdd);
  } else {
    // Find the last occurrence
    const lastDay = new Date(year, month + 1, 0);
    const lastDayOfWeek = lastDay.getDay();
    const daysToSubtract = (lastDayOfWeek - dayOfWeek + 7) % 7;
    date = new Date(year, month, lastDay.getDate() - daysToSubtract);
  }
  
  return date;
};

/**
 * Get all US Federal Holidays for a given year
 * @param {number} year - The year
 * @returns {Array} Array of {date: string (YYYY-MM-DD), name: string}
 */
export const getFederalHolidays = (year) => {
  const holidays = [];
  
  // New Year's Day - January 1
  holidays.push({
    date: `${year}-01-01`,
    name: "New Year's Day"
  });
  
  // Martin Luther King Jr. Day - Third Monday in January
  const mlkDay = getNthDayOfMonth(year, 0, 1, 3); // January (0), Monday (1), 3rd occurrence
  holidays.push({
    date: mlkDay.toISOString().split('T')[0],
    name: "Martin Luther King Jr. Day"
  });
  
  // Presidents' Day - Third Monday in February
  const presidentsDay = getNthDayOfMonth(year, 1, 1, 3); // February (1), Monday (1), 3rd occurrence
  holidays.push({
    date: presidentsDay.toISOString().split('T')[0],
    name: "Presidents' Day"
  });
  
  // Memorial Day - Last Monday in May
  const memorialDay = getNthDayOfMonth(year, 4, 1, -1); // May (4), Monday (1), last occurrence
  holidays.push({
    date: memorialDay.toISOString().split('T')[0],
    name: "Memorial Day"
  });
  
  // Juneteenth - June 19
  holidays.push({
    date: `${year}-06-19`,
    name: "Juneteenth"
  });
  
  // Independence Day - July 4
  holidays.push({
    date: `${year}-07-04`,
    name: "Independence Day"
  });
  
  // Labor Day - First Monday in September
  const laborDay = getNthDayOfMonth(year, 8, 1, 1); // September (8), Monday (1), 1st occurrence
  holidays.push({
    date: laborDay.toISOString().split('T')[0],
    name: "Labor Day"
  });
  
  // Columbus Day - Second Monday in October
  const columbusDay = getNthDayOfMonth(year, 9, 1, 2); // October (9), Monday (1), 2nd occurrence
  holidays.push({
    date: columbusDay.toISOString().split('T')[0],
    name: "Columbus Day"
  });
  
  // Veterans Day - November 11
  holidays.push({
    date: `${year}-11-11`,
    name: "Veterans Day"
  });
  
  // Thanksgiving - Fourth Thursday in November
  const thanksgiving = getNthDayOfMonth(year, 10, 4, 4); // November (10), Thursday (4), 4th occurrence
  holidays.push({
    date: thanksgiving.toISOString().split('T')[0],
    name: "Thanksgiving"
  });
  
  // Christmas - December 25
  holidays.push({
    date: `${year}-12-25`,
    name: "Christmas"
  });
  
  return holidays;
};

/**
 * Get federal holidays for a date range
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Array} Array of holidays within the range
 */
export const getFederalHolidaysInRange = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  
  const allHolidays = [];
  
  // Get holidays for all years in range
  for (let year = startYear; year <= endYear; year++) {
    allHolidays.push(...getFederalHolidays(year));
  }
  
  // Filter to only holidays within the date range
  return allHolidays.filter(holiday => {
    const holidayDate = new Date(holiday.date);
    return holidayDate >= start && holidayDate <= end;
  });
};

/**
 * Check if a date is a federal holiday
 * @param {Date|string} date - The date to check
 * @returns {Object|null} Holiday object or null
 */
export const isFederalHoliday = (date) => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const year = dateObj.getFullYear();
  const dateStr = dateObj.toISOString().split('T')[0];
  
  const holidays = getFederalHolidays(year);
  return holidays.find(h => h.date === dateStr) || null;
};

