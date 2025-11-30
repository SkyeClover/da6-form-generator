// DA6 Duty Roster Exception Codes
// Standard codes used in Army duty rosters

export const EXCEPTION_CODES = {
  'A': 'Absent / Absence',
  'U': 'Unavailable',
  'S': 'Sick',
  'D': 'Detail (On another detail/assignment)',
  'L': 'Leave',
  'T': 'Training',
  'TDY': 'Temporary Duty',
  'CQ': 'Charge of Quarters (Already assigned)',
  'SD': 'Staff Duty (Already assigned)',
  'P': 'Pass',
  'EX': 'Exempt',
  'R': 'Restricted',
  'H': 'Holiday',
};

export const getExceptionCodeName = (code) => {
  return EXCEPTION_CODES[code] || code;
};

export const getExceptionCodesList = () => {
  return Object.entries(EXCEPTION_CODES).map(([code, name]) => ({
    code,
    name: `${code} - ${name}`
  }));
};

