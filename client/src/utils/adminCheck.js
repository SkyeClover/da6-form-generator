// Admin email and UID that bypasses limits
const ADMIN_EMAIL = 'jacobwalker852@gmail.com';
const ADMIN_UID = '5834513e-2e93-44b9-b0a1-41c383009b55';

/**
 * Check if a user is an admin (bypasses limits)
 * @param {Object} user - User object from Supabase auth
 * @returns {boolean} - True if user is admin
 */
export const isAdmin = (user) => {
  if (!user) return false;
  
  // Check by user ID first (most reliable)
  if (user.id === ADMIN_UID) {
    return true;
  }
  
  // Check by email (case-insensitive)
  if (user.email && user.email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim()) {
    return true;
  }
  
  return false;
};

