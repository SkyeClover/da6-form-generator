// Rank ordering utility for DA6 forms
// Ranks are ordered from lowest to highest

const RANK_ORDER = {
  // Enlisted Ranks (lowest to highest)
  'PVT': 1,   // Private
  'PV2': 2,   // Private Second Class
  'PFC': 3,   // Private First Class
  'SPC': 4,   // Specialist
  'CPL': 5,   // Corporal
  'SGT': 6,   // Sergeant
  'SSG': 7,   // Staff Sergeant
  'SFC': 8,   // Sergeant First Class
  'MSG': 9,   // Master Sergeant
  '1SG': 10,  // First Sergeant
  'SGM': 11,  // Sergeant Major
  'CSM': 12,  // Command Sergeant Major
  
  // Warrant Officers
  'WO1': 20,  // Warrant Officer 1
  'CW2': 21,  // Chief Warrant Officer 2
  'CW3': 22,  // Chief Warrant Officer 3
  'CW4': 23,  // Chief Warrant Officer 4
  'CW5': 24,  // Chief Warrant Officer 5
  
  // Officer Ranks
  '2LT': 30,  // Second Lieutenant
  '1LT': 31,  // First Lieutenant
  'CPT': 32,  // Captain
  'MAJ': 33,  // Major
  'LTC': 34,  // Lieutenant Colonel
  'COL': 35,  // Colonel
  'BG': 36,   // Brigadier General
  'MG': 37,   // Major General
  'LTG': 38,  // Lieutenant General
  'GEN': 39,  // General
};

/**
 * Get the numeric order value for a rank
 * @param {string} rank - The rank abbreviation (e.g., 'SGT', 'CPT')
 * @returns {number} - The order value (lower = lower rank)
 */
export const getRankOrder = (rank) => {
  if (!rank) return 999; // Unknown ranks go to the end
  const normalizedRank = rank.toUpperCase().trim();
  return RANK_ORDER[normalizedRank] || 999;
};

/**
 * Sort soldiers by rank (lowest to highest), then alphabetically by last name, then first name
 * @param {Array} soldiers - Array of soldier objects
 * @returns {Array} - Sorted array of soldiers
 */
export const sortSoldiersByRank = (soldiers) => {
  return [...soldiers].sort((a, b) => {
    // First, sort by rank order
    const rankOrderA = getRankOrder(a.rank);
    const rankOrderB = getRankOrder(b.rank);
    
    if (rankOrderA !== rankOrderB) {
      return rankOrderA - rankOrderB;
    }
    
    // If ranks are equal, sort alphabetically by last name
    const lastNameA = (a.last_name || '').toLowerCase();
    const lastNameB = (b.last_name || '').toLowerCase();
    
    if (lastNameA !== lastNameB) {
      return lastNameA.localeCompare(lastNameB);
    }
    
    // If last names are equal, sort by first name
    const firstNameA = (a.first_name || '').toLowerCase();
    const firstNameB = (b.first_name || '').toLowerCase();
    
    return firstNameA.localeCompare(firstNameB);
  });
};

/**
 * Check if a rank is an officer rank
 * @param {string} rank - The rank abbreviation
 * @returns {boolean}
 */
export const isOfficerRank = (rank) => {
  const order = getRankOrder(rank);
  return order >= 30 && order < 40;
};

/**
 * Check if a rank is a warrant officer rank
 * @param {string} rank - The rank abbreviation
 * @returns {boolean}
 */
export const isWarrantOfficerRank = (rank) => {
  const order = getRankOrder(rank);
  return order >= 20 && order < 30;
};

/**
 * Check if a rank is a lower enlisted rank (PVT through SPC)
 * @param {string} rank - The rank abbreviation
 * @returns {boolean}
 */
export const isLowerEnlisted = (rank) => {
  const order = getRankOrder(rank);
  return order >= 1 && order <= 4;
};

/**
 * Check if a rank is an NCO rank (CPL through CSM)
 * @param {string} rank - The rank abbreviation
 * @returns {boolean}
 */
export const isNCORank = (rank) => {
  const order = getRankOrder(rank);
  return order >= 5 && order < 20;
};

/**
 * Get rank category for filtering
 * @param {string} rank - The rank abbreviation
 * @returns {string} - 'lower_enlisted', 'nco', 'warrant', 'officer', or 'unknown'
 */
export const getRankCategory = (rank) => {
  if (isLowerEnlisted(rank)) return 'lower_enlisted';
  if (isNCORank(rank)) return 'nco';
  if (isWarrantOfficerRank(rank)) return 'warrant';
  if (isOfficerRank(rank)) return 'officer';
  return 'unknown';
};

/**
 * Get all available ranks grouped by category
 * @returns {Object} - Object with category keys and arrays of rank objects
 */
export const getAllRanks = () => {
  return {
    enlisted: [
      { code: 'PVT', name: 'Private' },
      { code: 'PV2', name: 'Private Second Class' },
      { code: 'PFC', name: 'Private First Class' },
      { code: 'SPC', name: 'Specialist' },
      { code: 'CPL', name: 'Corporal' },
      { code: 'SGT', name: 'Sergeant' },
      { code: 'SSG', name: 'Staff Sergeant' },
      { code: 'SFC', name: 'Sergeant First Class' },
      { code: 'MSG', name: 'Master Sergeant' },
      { code: '1SG', name: 'First Sergeant' },
      { code: 'SGM', name: 'Sergeant Major' },
      { code: 'CSM', name: 'Command Sergeant Major' }
    ],
    warrant: [
      { code: 'WO1', name: 'Warrant Officer 1' },
      { code: 'CW2', name: 'Chief Warrant Officer 2' },
      { code: 'CW3', name: 'Chief Warrant Officer 3' },
      { code: 'CW4', name: 'Chief Warrant Officer 4' },
      { code: 'CW5', name: 'Chief Warrant Officer 5' }
    ],
    officer: [
      { code: '2LT', name: 'Second Lieutenant' },
      { code: '1LT', name: 'First Lieutenant' },
      { code: 'CPT', name: 'Captain' },
      { code: 'MAJ', name: 'Major' },
      { code: 'LTC', name: 'Lieutenant Colonel' },
      { code: 'COL', name: 'Colonel' },
      { code: 'BG', name: 'Brigadier General' },
      { code: 'MG', name: 'Major General' },
      { code: 'LTG', name: 'Lieutenant General' },
      { code: 'GEN', name: 'General' }
    ]
  };
};

/**
 * Get rank name from code
 * @param {string} code - The rank code
 * @returns {string} - The rank name
 */
export const getRankName = (code) => {
  const allRanks = getAllRanks();
  for (const category of Object.values(allRanks)) {
    const rank = category.find(r => r.code === code);
    if (rank) return rank.name;
  }
  return code;
};

/**
 * Get all ranks in a range (inclusive)
 * @param {string} startRank - Starting rank code
 * @param {string} endRank - Ending rank code
 * @returns {Array} - Array of rank codes in the range
 */
export const getRanksInRange = (startRank, endRank) => {
  const startOrder = getRankOrder(startRank);
  const endOrder = getRankOrder(endRank);
  const allRanks = getAllRanks();
  const allRankCodes = [
    ...allRanks.enlisted.map(r => r.code),
    ...allRanks.warrant.map(r => r.code),
    ...allRanks.officer.map(r => r.code)
  ];
  
  return allRankCodes.filter(code => {
    const order = getRankOrder(code);
    return order >= startOrder && order <= endOrder;
  });
};

/**
 * Check if a rank matches a requirement
 * @param {string} rank - The rank to check
 * @param {Object} requirement - Requirement object with type, min, max, or specific ranks
 * @returns {boolean}
 */
export const rankMatchesRequirement = (rank, requirement) => {
  if (!requirement) return false;
  
  const rankOrder = getRankOrder(rank);
  
  // Check exclusions first
  if (requirement.excluded_ranks && requirement.excluded_ranks.includes(rank)) {
    return false;
  }
  
  // Check if rank is in excluded groups
  if (requirement.excluded_groups) {
    if (requirement.excluded_groups.includes('lower_enlisted') && isLowerEnlisted(rank)) {
      return false;
    }
    if (requirement.excluded_groups.includes('nco') && isNCORank(rank)) {
      return false;
    }
    if (requirement.excluded_groups.includes('warrant') && isWarrantOfficerRank(rank)) {
      return false;
    }
    if (requirement.excluded_groups.includes('officer') && isOfficerRank(rank)) {
      return false;
    }
  }
  
  // Check specific ranks
  if (requirement.ranks && requirement.ranks.includes(rank)) {
    return true;
  }
  
  // Check rank range
  if (requirement.rank_range) {
    const [startRank, endRank] = requirement.rank_range.split('-');
    const ranksInRange = getRanksInRange(startRank.trim(), endRank.trim());
    if (ranksInRange.includes(rank)) {
      return true;
    }
  }
  
  // Check group
  if (requirement.group) {
    switch (requirement.group) {
      case 'lower_enlisted':
        return isLowerEnlisted(rank);
      case 'nco':
        return isNCORank(rank);
      case 'warrant':
        return isWarrantOfficerRank(rank);
      case 'officer':
        return isOfficerRank(rank);
      default:
        return false;
    }
  }
  
  // Check min/max rank order
  if (requirement.min_rank) {
    const minOrder = getRankOrder(requirement.min_rank);
    if (rankOrder < minOrder) return false;
  }
  if (requirement.max_rank) {
    const maxOrder = getRankOrder(requirement.max_rank);
    if (rankOrder > maxOrder) return false;
  }
  
  return false;
};

