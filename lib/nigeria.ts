export type NgZone =
  | 'North Central'
  | 'North East'
  | 'North West'
  | 'South East'
  | 'South South'
  | 'South West';

export type NgState = { code: string; name: string; zone: NgZone };

export const zones: NgZone[] = [
  'North Central',
  'North East',
  'North West',
  'South East',
  'South South',
  'South West',
];

// Codes follow ISO 3166-2:NG (for example RI is Rivers and LA is Lagos).
export const states: NgState[] = [
  { code: 'BE', name: 'Benue', zone: 'North Central' },
  { code: 'FC', name: 'Abuja (FCT)', zone: 'North Central' },
  { code: 'KO', name: 'Kogi', zone: 'North Central' },
  { code: 'KW', name: 'Kwara', zone: 'North Central' },
  { code: 'NA', name: 'Nasarawa', zone: 'North Central' },
  { code: 'NI', name: 'Niger', zone: 'North Central' },
  { code: 'PL', name: 'Plateau', zone: 'North Central' },

  { code: 'AD', name: 'Adamawa', zone: 'North East' },
  { code: 'BA', name: 'Bauchi', zone: 'North East' },
  { code: 'BO', name: 'Borno', zone: 'North East' },
  { code: 'GO', name: 'Gombe', zone: 'North East' },
  { code: 'TA', name: 'Taraba', zone: 'North East' },
  { code: 'YO', name: 'Yobe', zone: 'North East' },

  { code: 'JI', name: 'Jigawa', zone: 'North West' },
  { code: 'KD', name: 'Kaduna', zone: 'North West' },
  { code: 'KN', name: 'Kano', zone: 'North West' },
  { code: 'KT', name: 'Katsina', zone: 'North West' },
  { code: 'KE', name: 'Kebbi', zone: 'North West' },
  { code: 'SO', name: 'Sokoto', zone: 'North West' },
  { code: 'ZA', name: 'Zamfara', zone: 'North West' },

  { code: 'AB', name: 'Abia', zone: 'South East' },
  { code: 'AN', name: 'Anambra', zone: 'South East' },
  { code: 'EB', name: 'Ebonyi', zone: 'South East' },
  { code: 'EN', name: 'Enugu', zone: 'South East' },
  { code: 'IM', name: 'Imo', zone: 'South East' },

  { code: 'AK', name: 'Akwa Ibom', zone: 'South South' },
  { code: 'BY', name: 'Bayelsa', zone: 'South South' },
  { code: 'CR', name: 'Cross River', zone: 'South South' },
  { code: 'DE', name: 'Delta', zone: 'South South' },
  { code: 'ED', name: 'Edo', zone: 'South South' },
  { code: 'RI', name: 'Rivers', zone: 'South South' },

  { code: 'EK', name: 'Ekiti', zone: 'South West' },
  { code: 'LA', name: 'Lagos', zone: 'South West' },
  { code: 'OG', name: 'Ogun', zone: 'South West' },
  { code: 'ON', name: 'Ondo', zone: 'South West' },
  { code: 'OS', name: 'Osun', zone: 'South West' },
  { code: 'OY', name: 'Oyo', zone: 'South West' },
];

export const statesInZone = (zone: NgZone): NgState[] => states.filter((s) => s.zone === zone);

export const stateName = (code: string): string =>
  states.find((s) => s.code === code)?.name ?? code;
