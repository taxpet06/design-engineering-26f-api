import type { Evidence, MajorRules, RequirementGroup } from '../types';
export const curriculumVersion = '2026-27.1';
export const CS_SOURCE = 'https://dartmouth.smartcatalogiq.com/en/current/orc/departments-programs-undergraduate/computer-science';
export const ENGS_SOURCE = 'https://dartmouth.smartcatalogiq.com/en/current/orc/departments-programs-undergraduate/engineering-sciences';
export const THAYER_SOURCE = 'https://engineering.dartmouth.edu/undergraduate/ab/majors/engineering-sciences';
export const BIOMED_SOURCE = 'https://engineering.dartmouth.edu/undergraduate/ab/majors/biomedical-engineering';
export const PHYSICS_SOURCE = 'https://engineering.dartmouth.edu/undergraduate/ab/majors/engineering-physics';
const evidence = (source: string): Evidence => ({ source, retrievedAt: '2026-10-15', verification: 'verified' });
const ids = (subject: string, numbers: number[]) => numbers.map(n => `${subject} ${n}`);
const singles = (courses: string[]) => courses.map(c => [c]);
const group = (id: string, label: string, category: RequirementGroup['category'], count: number, options: string[][], source: string, extra: Partial<RequirementGroup> = {}): RequirementGroup => ({ id, label, category, count, options, evidence: evidence(source), exclusive: true, ...extra });
const engEntry = (prefix: string, chemistry: string[][] = [['CHEM 5']]): RequirementGroup[] => [
  group(`${prefix}-calculus`, 'Calculus: MATH 3 and MATH 8', 'entry', 2, singles(ids('MATH', [3, 8])), ENGS_SOURCE),
  group(`${prefix}-multivariable`, 'Multivariable calculus: MATH 11 or 13', 'entry', 1, singles(ids('MATH', [11, 13])), ENGS_SOURCE),
  group(`${prefix}-physics-entry`, 'Introductory physics: PHYS 13 and 14', 'entry', 2, singles(ids('PHYS', [13, 14])), ENGS_SOURCE),
  group(`${prefix}-chemistry`, 'Chemistry prerequisite pathway', 'entry', 1, chemistry, ENGS_SOURCE),
  group(`${prefix}-programming`, 'Programming: ENGS 20 or both COSC 1 and 10', 'entry', 1, [['ENGS 20'], ['COSC 1', 'COSC 10']], ENGS_SOURCE),
];
const engineeringReview = ['Confirm major GPA of at least 2.0, grading/NRO eligibility, approved transfer credit (maximum two major courses), and advisor approval; course IDs do not establish these conditions.', 'Placement and advanced-standing credit need an official record; a higher course alone does not waive MATH 3, MATH 8, CHEM 5, or introductory physics.'];
export const engineeringCE = ids('ENGS', [58, 61, 62, 67, 71, 73, 75, 76, 86, 88, 112, 115, 124, 125, 126, 128, 129, 130, 132, 133, 134, 135, 138, 145, 146, 147, 150, 157, 158, 160, 161, 162, 163, 164, 165, 167, 169, 170, 171, 172, 173, 174, 175, 262]);
const ce = (prefix: string, physics = false) => group(`${prefix}-ce`, 'Culminating experience pathway', 'culminating', 1, [...singles(engineeringCE), ['ENGS 89', 'ENGS 90'], ...(physics ? singles(ids('PHYS', [68, 72, 73, 74, 76, 82, 87])) : [])], THAYER_SOURCE, { exclusive: false, sequence: 'Confirm senior-year timing and project/thesis completion. ENGS 89 must follow ENGS 21 plus five qualifying engineering courses, then ENGS 90; completion IDs do not establish sequence.', reviewNotes: ['A culminating course may also fulfill an elective when allowed.'] });
const engineeringRange = { subject: 'ENGS', min: 21, max: Number.POSITIVE_INFINITY, exclude: [87] };
const scienceRanges = [
  { subject: 'ASTR', min: 15, max: Number.POSITIVE_INFINITY }, { subject: 'BIOL', min: 12, max: Number.POSITIVE_INFINITY, exclude: [52] },
  { subject: 'CHEM', min: 11, max: Number.POSITIVE_INFINITY, exclude: [63] }, { subject: 'EAPS', min: 40, max: 52.99 },
  { subject: 'EAPS', min: 66, max: 75.99 }, { subject: 'EAPS', min: 79, max: Number.POSITIVE_INFINITY },
  { subject: 'MATH', min: 17, max: 29.99 }, { subject: 'MATH', min: 50, max: Number.POSITIVE_INFINITY },
  { subject: 'PHYS', min: 40, max: Number.POSITIVE_INFINITY },
];
const scienceOptions = [...ids('CHEM', [6]), ...ids('EAPS', [31, 33, 35, 37, 59, 62, 64, 77]), ...ids('ENVS', [30, 79]), ...ids('MATH', [31, 32, 35, 38, 39, 40, 42, 43]), 'PHYS 19', ...ids('COSC', [30, 31, 39, 49, 71, 74])];
const physicsRestricted = [ids('ENGS', [25, 33, 34]), ids('PHYS', [50, 68, 90]), ['PHYS 73', 'ENGS 131'], ['PHYS 66', 'ENGS 64', 'ENGS 120'], ['PHYS 44', 'ENGS 72']];
// Conservative explicitly documented straight-physics electives; individually approved additions remain reviewable.
const physicsElectives = [...ids('PHYS', [30, 31, 41, 44, 47, 48, 50]), ...ids('ASTR', [15, 19, 25])];
export const majors: MajorRules[] = [
  { name: 'Computer Science', catalogEdition: '2026-27', cohort: '2030', source: CS_SOURCE, evidence: evidence(CS_SOURCE), relevantSubjects: ['COSC'], reviewNotes: ['Departmental Undergraduate Advisor approval and official placement/transfer records remain to be checked.', 'Repeated COSC 98 or 99 requires two consecutive terms (and a written thesis for 99). This profile stores course IDs, so those alternatives require transcript review.'], groups: [
    group('cs-programming', 'Programming: COSC 1 or ENGS 20', 'entry', 1, [['COSC 1'], ['ENGS 20']], CS_SOURCE),
    group('cs-math', 'Mathematics: MATH 8, 9, 11, or 13', 'entry', 1, singles(ids('MATH', [8, 9, 11, 13])), CS_SOURCE),
    group('cs-core', 'Six computer science core courses', 'core', 6, singles(ids('COSC', [10, 11, 12, 14, 15, 17])), CS_SOURCE),
    group('cs-electives', 'Four additional computer science electives', 'elective', 4, [], CS_SOURCE, { courseRanges: [{ subject: 'COSC', min: 30, max: 89.99 }], reviewNotes: ['Graduate lecture courses and at most one COSC 94 may substitute only with advisor approval; they are not counted automatically.'] }),
    group('cs-ce', 'Two advanced topics courses, or approved research sequence', 'culminating', 2, [], CS_SOURCE, { courseRanges: [49, 69, 89].map(n => ({ subject: 'COSC', min: n + .01, max: n + .99 })), priorCompletedCourseIds: ids('COSC', [10, 11, 12, 14, 15, 17]), sequence: 'Advanced topics must follow all six core courses unless the major advisor approves an exception. Course completion IDs do not establish past ordering.', reviewNotes: ['Two consecutive terms of COSC 98 or COSC 99 are alternative pathways requiring transcript review. Culminating courses cannot also count as electives.'] }),
  ] },
  { name: 'Engineering Sciences', catalogEdition: '2026-27', cohort: '2030', source: ENGS_SOURCE, evidence: evidence(ENGS_SOURCE), relevantSubjects: ['ENGS'], reviewNotes: [...engineeringReview, '2026-27 ORC controls the cohort. The fall-2026 Thayer page says electives start at ENGS 20; ORC says above 20. ENGS 20 is not automatically counted as an elective.'], groups: [
    ...engEntry('eng'),
    group('eng-core', 'Common core: ENGS 21, 22, and 23', 'core', 3, singles(ids('ENGS', [21, 22, 23])), ENGS_SOURCE),
    group('eng-distributive', 'Two distributive core courses', 'core', 2, singles(ids('ENGS', [24, 25, 26, 27, 28])), ENGS_SOURCE),
    group('eng-gateway', 'Two gateway courses in different disciplines', 'core', 2, singles(ids('ENGS', [31, 32, 33, 34, 30, 35, 36, 37])), THAYER_SOURCE, { optionBuckets: ['electrical', 'electrical', 'mechanical', 'mechanical', 'chemical', 'chemical', 'chemical', 'environmental'], allocation: { minDistinctBuckets: 2 } }),
    group('eng-elective', 'One additional engineering elective', 'elective', 1, [], ENGS_SOURCE, { courseRanges: [engineeringRange] }),
    group('eng-science-elective', 'One additional engineering, science, or mathematics elective', 'elective', 1, singles(scienceOptions), THAYER_SOURCE, { courseRanges: [engineeringRange, ...scienceRanges] }), ce('eng'),
  ] },
  { name: 'Biomedical Engineering Sciences', catalogEdition: '2026-27', cohort: '2030', source: ENGS_SOURCE, evidence: evidence(ENGS_SOURCE), relevantSubjects: ['ENGS', 'BIOL', 'CHEM'], reviewNotes: [...engineeringReview, 'ORC and the fall-2026 department page differ on ENGS 30 as a gateway and ENGS 23 as an elective. These disputed cases require advisor review; automatic progress uses their common supported subset.'], groups: [
    ...engEntry('bio', [['CHEM 5', 'CHEM 6'], ['CHEM 11']]),
    group('bio-core', 'Common core: ENGS 21 and 22', 'core', 2, singles(ids('ENGS', [21, 22])), ENGS_SOURCE),
    group('bio-distributive', 'One distributive core course', 'core', 1, singles(ids('ENGS', [23, 24, 25, 26, 27, 28])), BIOMED_SOURCE),
    group('bio-gateway', 'One gateway course', 'core', 1, singles(ids('ENGS', [31, 32, 33, 34, 35, 36])), ENGS_SOURCE),
    group('bio-engineering', 'Biomedical engineering or an additional core course', 'core', 1, singles(ids('ENGS', [56, 23, 24, 25, 26])), BIOMED_SOURCE),
    group('bio-biology', 'Two biology foundation courses', 'core', 2, singles(ids('BIOL', [12, 13, 14])), BIOMED_SOURCE),
    group('bio-organic', 'Organic chemistry sequence: 51 + 52 or 57 + 58', 'core', 1, [['CHEM 51', 'CHEM 52'], ['CHEM 57', 'CHEM 58']], BIOMED_SOURCE),
    group('bio-elective', 'One additional biochemistry or engineering elective', 'elective', 1, [['BIOL 40'], ['CHEM 41']], BIOMED_SOURCE, { courseRanges: [{ subject: 'ENGS', min: 24, max: Number.POSITIVE_INFINITY, exclude: [87] }] }), ce('bio'),
  ] },
  { name: 'Engineering Physics', catalogEdition: '2026-27', cohort: '2030', source: ENGS_SOURCE, evidence: evidence(ENGS_SOURCE), relevantSubjects: ['ENGS', 'PHYS', 'ASTR'], reviewNotes: [...engineeringReview, 'PHYS 15 and 16 can replace the introductory route only with placement verification; the PHYS 19 replacement then requires a third physics elective. This conditional pathway needs advisor review.', 'ORC lists PHYS 90 and excludes ENGS 80; the department page lists PHYS 91 and does not exclude ENGS 80. Those disputed elective cases require review.'], groups: [
    ...engEntry('ep'), group('ep-differential', 'Differential equations: MATH 23', 'entry', 1, [['MATH 23']], ENGS_SOURCE),
    group('ep-eng-core', 'Engineering core: ENGS 22, 23, and 24', 'core', 3, singles(ids('ENGS', [22, 23, 24])), ENGS_SOURCE),
    group('ep-phys-core', 'Physics core: PHYS 19, 40, and 43', 'core', 3, singles(ids('PHYS', [19, 40, 43])), ENGS_SOURCE),
    group('ep-electives', 'Four electives: two engineering, two physics; two different restricted groups', 'elective', 4, singles([...physicsRestricted.flat().filter(id => id !== 'PHYS 90'), ...physicsElectives.filter(id => id !== 'PHYS 90')]), ENGS_SOURCE, { courseRanges: [{ subject: 'ENGS', min: 21, max: Number.POSITIVE_INFINITY, exclude: [80, 87] }, { subject: 'PHYS', min: 60, max: Number.POSITIVE_INFINITY, exclude: [90, 91] }, { subject: 'ASTR', min: 60, max: Number.POSITIVE_INFINITY }], optionBuckets: [...physicsRestricted.flat().filter(id => id !== 'PHYS 90').map(id => String(physicsRestricted.findIndex(g => g.includes(id)))), ...physicsElectives.filter(id => id !== 'PHYS 90').map(id => { const bucket = physicsRestricted.findIndex(g => g.includes(id)); return bucket < 0 ? '' : String(bucket); })], allocation: { subjectCounts: { ENGS: 2, 'PHYS|ASTR': 2 }, minDistinctBuckets: 2 }, reviewNotes: ['Two electives must come from different restricted groups; all four preserve the five-engineering/five-physics major split. Physics/astronomy electives follow the straight-physics ORC list; ASTR counts on the physics side. Other substitutions require approval.'] }), ce('ep', true),
  ] },
];
