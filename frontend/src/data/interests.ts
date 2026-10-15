import type { Catalog, Course } from '../types';
export const interestPresets = [
  { id: 'technology-engineering', label: 'Technology & Engineering', subjects: ['COSC', 'ENGS'] },
  { id: 'math-science', label: 'Math & Science', subjects: ['MATH', 'PHYS', 'ASTR', 'CHEM', 'EAPS', 'EARS', 'ENVS'] },
  { id: 'health-psychology', label: 'Health & Psychology', subjects: ['BIOL', 'PSYC', 'COGS'] },
  { id: 'business-economics', label: 'Business & Economics', subjects: ['ECON', 'TUCK'] },
  { id: 'politics-society', label: 'Politics & Society', subjects: ['GOVT', 'PBPL', 'SOCY', 'ANTH', 'GEOG', 'QSS', 'EDUC', 'INTS'] },
  { id: 'arts-media', label: 'Arts & Media', subjects: ['ARTH', 'SART', 'MUS', 'THEA', 'FILM', 'CSDA'] },
  { id: 'languages-culture', label: 'Languages & Culture', subjects: ['AAAS', 'ARAB', 'ASCL', 'CHIN', 'EEER', 'FREN', 'GERM', 'GRK', 'HEBR', 'ITAL', 'JAPN', 'JWST', 'KOR', 'LACS', 'LAT', 'LING', 'MES', 'NAIS', 'PORT', 'RUSS', 'SPAN', 'UKRA', 'WGSS'] },
  { id: 'writing-humanities', label: 'Writing & Humanities', subjects: ['WRIT', 'ENGL', 'CRWT', 'COLT', 'CLST', 'HIST', 'HUM', 'PHIL', 'REL', 'SPEE', 'COCO'] },
];
export function matchesInterest(course: Course, ids: string[]): boolean {
  return interestPresets.some(p => ids.includes(p.id) && p.subjects.includes(course.code.split(' ')[0]));
}
export function migrateInterests(values: unknown[], catalog: Catalog): string[] {
  const subjects = values.flatMap(value => typeof value === 'string' ? [value, ...catalog.departments.filter(d => d.name === value).map(d => d.code)] : []);
  return interestPresets.filter(p => subjects.includes(p.id) || p.subjects.some(s => subjects.includes(s))).map(p => p.id);
}
