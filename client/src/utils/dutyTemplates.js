// Default duty templates for DA6 forms

export const DUTY_TEMPLATES = {
  'CQ': {
    name: 'CQ (Charge of Quarters)',
    nature_of_duty: 'CQ',
    soldiers_per_day: 2,
    requirements: {
      nco: 1, // 1 SGT/CPL
      lower_enlisted: 1 // 1 SPC or below
    },
    days_off_after_duty: 1
  },
  'BN_STAFF_DUTY': {
    name: 'BN Staff Duty',
    nature_of_duty: 'BN Staff Duty',
    soldiers_per_day: 2,
    requirements: {
      nco: 1, // 1 SGT/CPL/SSG
      lower_enlisted: 1 // 1 SPC or below
    },
    days_off_after_duty: 1
  },
  'BRIGADE_STAFF_DUTY': {
    name: 'Brigade Staff Duty',
    nature_of_duty: 'Brigade Staff Duty',
    soldiers_per_day: 4,
    requirements: {
      sfc: 1, // 1 SFC
      lower_enlisted: 2, // 2 SPC or below
      officer: 1 // 1 officer or warrant officer of any rank
    },
    days_off_after_duty: 1
  },
  'CORP': {
    name: 'CORP',
    nature_of_duty: 'CORP',
    soldiers_per_day: 3,
    requirements: {
      sfc_msg: 1, // 1 SFC/MSG
      lower_enlisted: 2 // 2 lower enlisted
    },
    days_off_after_duty: 1
  },
  'CUSTOM': {
    name: 'Custom Duty',
    nature_of_duty: '',
    soldiers_per_day: 1,
    requirements: {},
    days_off_after_duty: 1
  }
};

export const getDutyTemplate = (templateKey) => {
  return DUTY_TEMPLATES[templateKey] || DUTY_TEMPLATES.CUSTOM;
};

export const getDutyTemplateList = () => {
  return Object.entries(DUTY_TEMPLATES).map(([key, template]) => ({
    key,
    ...template
  }));
};

