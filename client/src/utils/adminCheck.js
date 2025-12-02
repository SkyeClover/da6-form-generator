// Admin email and UID that bypasses limits
const ADMIN_EMAIL = 'jacobwalker852@gmail.com';
const ADMIN_UID = 'a7acf98d-04bc-47f2-bf0d-8d061a2dc67e';

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

