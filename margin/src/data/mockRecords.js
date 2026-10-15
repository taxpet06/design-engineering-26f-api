// Synthetic records for the demo. Every person, assignment, and number is invented.
//
// The record shapes below (snake_case fields, day codes, 'YYYY-MM-DDTHH:MM' due
// strings) are ASSUMPTIONS made for this prototype. They are not the verified schema
// of the class API at github.com/taxpet06/design-engineering-26f-api. The adapter in
// adapter.js is the only code that knows these shapes; see docs/API-INTEGRATION.md.

export const MOCK_RECORDS = {
  student: { id: 'stu_demo_01', name: 'Demo Student', class_year: 2030, synthetic: true },
  term: { id: 'term_26f', start: '2026-09-14', end: '2026-11-24' },

  locations: [
    { id: 'loc_dorm', name: 'Dorm room', kind: 'home', study_ok: true, equipment: ['monitor'] },
    { id: 'loc_baker', name: 'Baker-Berry Library', kind: 'study', study_ok: true, equipment: ['quiet', 'monitor', 'printer', 'whiteboard'] },
    { id: 'loc_kemeny', name: 'Kemeny Hall', kind: 'class', study_ok: true, equipment: ['whiteboard'] },
    { id: 'loc_silsby', name: 'Silsby Hall', kind: 'class', study_ok: false, equipment: [] },
    { id: 'loc_ecsc', name: 'ECSC', kind: 'class', study_ok: true, equipment: ['workshop', 'whiteboard', 'monitor'] },
    { id: 'loc_collis', name: 'Collis Center', kind: 'other', study_ok: true, equipment: [] },
    { id: 'loc_foco', name: 'Class of 1953 Commons', kind: 'dining', study_ok: false, equipment: [] },
    { id: 'loc_parkhurst', name: 'Parkhurst Hall', kind: 'other', study_ok: false, equipment: [] },
    { id: 'loc_ccd', name: 'Center for Career Design', kind: 'other', study_ok: false, equipment: [] },
    { id: 'loc_online', name: 'Online', kind: 'virtual', study_ok: false, equipment: [] },
  ],

  // Hand-entered demo estimates in minutes. Not measured walking times.
  // Some pairs are intentionally missing so the fallback estimate is exercised.
  routes: [
    ['loc_dorm', 'loc_baker', 8], ['loc_dorm', 'loc_kemeny', 9], ['loc_dorm', 'loc_silsby', 7], ['loc_dorm', 'loc_ecsc', 12],
    ['loc_dorm', 'loc_collis', 6], ['loc_dorm', 'loc_foco', 5], ['loc_baker', 'loc_kemeny', 4], ['loc_baker', 'loc_silsby', 4],
    ['loc_baker', 'loc_ecsc', 9], ['loc_baker', 'loc_collis', 3], ['loc_baker', 'loc_foco', 4], ['loc_baker', 'loc_parkhurst', 5],
    ['loc_kemeny', 'loc_silsby', 5], ['loc_kemeny', 'loc_ecsc', 7], ['loc_kemeny', 'loc_foco', 6], ['loc_kemeny', 'loc_collis', 5],
    ['loc_silsby', 'loc_foco', 5], ['loc_silsby', 'loc_ecsc', 12], ['loc_silsby', 'loc_collis', 4], ['loc_ecsc', 'loc_foco', 10],
    ['loc_ecsc', 'loc_collis', 9], ['loc_collis', 'loc_foco', 3],
  ].map(([from, to, minutes]) => ({ from, to, minutes })),

  sections: [
    { id: 'sec_cosc10', course: 'COSC 10', title: 'COSC 10 lecture', meets: [{ days: ['MO', 'WE', 'FR'], start: '10:10', end: '11:15' }], location_id: 'loc_kemeny' },
    { id: 'sec_math13', course: 'MATH 13', title: 'MATH 13 lecture', meets: [{ days: ['MO', 'WE', 'FR'], start: '11:30', end: '12:35' }], location_id: 'loc_kemeny', canceled_dates: ['2026-10-30'] },
    { id: 'sec_econ1', course: 'ECON 1', title: 'ECON 1 lecture', meets: [{ days: ['TU', 'TH'], start: '10:10', end: '12:00' }], location_id: 'loc_silsby' },
    { id: 'sec_engs12', course: 'ENGS 12', title: 'ENGS 12 studio', meets: [{ days: ['TU', 'TH'], start: '14:25', end: '16:15' }], location_id: 'loc_ecsc' },
  ],

  jobs: [
    { id: 'job_library', title: 'Library desk shift', shifts: [{ days: ['MO', 'WE'], start: '15:00', end: '17:00' }], location_id: 'loc_baker' },
  ],

  clubs: [
    { id: 'club_debate', title: 'Debate society', meets: [{ days: ['TH'], start: '19:15', end: '20:45' }], location_id: 'loc_collis', optional: true,
      changes: [{ date: '2026-10-29', start: '19:45', end: '21:15' }] },
  ],

  events: [
    { id: 'evt_advising', title: 'Advising meeting', kind: 'appointment', date: '2026-10-29', start: '13:30', end: '14:00', location_id: 'loc_parkhurst' },
    { id: 'evt_cosc_oh', title: 'COSC 10 office hours', kind: 'appointment', date: '2026-10-29', start: '12:05', end: '12:35', location_id: 'loc_ecsc' },
    { id: 'evt_ccd_session', title: 'Career Design info session', kind: 'workshop', date: '2026-10-28', start: '17:15', end: '18:00', location_id: 'loc_ccd' },
  ],

  assignments: [
    { id: 'asg_math13_ps7', course: 'MATH 13', title: 'MATH 13 problem set 7', type: 'assignment', due: '2026-10-28T17:00', estimate_min: 150, priority: 'high', focus: 'deep', confidence: 'medium', min_session_min: 40 },
    { id: 'asg_cosc10_ps5', course: 'COSC 10', title: 'COSC 10 problem set 5', type: 'assignment', due: '2026-10-30T23:59', priority: 'high', focus: 'deep', confidence: 'low', min_session_min: 45,
      equipment: ['monitor'], preferred_locations: ['loc_baker', 'loc_dorm'],
      steps: [['Read the spec and starter code', 30, true], ['Implement the graph class', 120], ['Breadth-first search and tests', 90], ['Write-up', 30]],
      done_when: 'All provided tests pass and the write-up answers each question.' },
    { id: 'asg_econ1_reading', course: 'ECON 1', title: 'ECON 1 reading, chapters 9 and 10', type: 'reading', due: '2026-10-29T10:10', estimate_min: 60, priority: 'medium', focus: 'light', confidence: 'high', min_session_min: 20 },
    { id: 'asg_engs12_synth', course: 'ENGS 12', title: 'Synthesize user interviews', type: 'project', due: '2026-10-30', estimate_min: 90, priority: 'medium', focus: 'normal', confidence: 'medium', splittable: false },
    { id: 'asg_engs12_proto', course: 'ENGS 12', title: 'Prototype v2', type: 'project', due: '2026-11-03T14:25', estimate_min: 240, priority: 'high', focus: 'normal', confidence: 'low', min_session_min: 60,
      required_locations: ['loc_ecsc'], depends_on: ['asg_engs12_synth'], done_when: 'A working prototype ready for the studio critique.' },
    { id: 'asg_econ1_midterm', course: 'ECON 1', title: 'ECON 1 midterm prep', type: 'exam', due: '2026-11-05T10:10', estimate_min: 360, priority: 'high', focus: 'deep', confidence: 'medium', min_session_min: 50 },
  ],

  // Finished work with logged sessions, used to demonstrate duration calibration.
  completed: [
    { id: 'asg_cosc10_ps1', course: 'COSC 10', title: 'COSC 10 problem set 1', type: 'assignment', due: '2026-09-25T23:59', estimate_min: 180, sessions: [['2026-09-23', 120], ['2026-09-24', 110]] },
    { id: 'asg_cosc10_ps2', course: 'COSC 10', title: 'COSC 10 problem set 2', type: 'assignment', due: '2026-10-02T23:59', estimate_min: 200, sessions: [['2026-09-30', 150], ['2026-10-01', 125]] },
    { id: 'asg_cosc10_ps3', course: 'COSC 10', title: 'COSC 10 problem set 3', type: 'assignment', due: '2026-10-09T23:59', estimate_min: 240, sessions: [['2026-10-07', 160], ['2026-10-08', 150]] },
    { id: 'asg_cosc10_ps4', course: 'COSC 10', title: 'COSC 10 problem set 4', type: 'assignment', due: '2026-10-16T23:59', estimate_min: 240, sessions: [['2026-10-14', 140], ['2026-10-15', 120, 'interrupted'], ['2026-10-16', 60]] },
    { id: 'asg_math13_ps4', course: 'MATH 13', title: 'MATH 13 problem set 4', type: 'assignment', due: '2026-10-07T17:00', estimate_min: 120, sessions: [['2026-10-06', 125]] },
    { id: 'asg_math13_ps5', course: 'MATH 13', title: 'MATH 13 problem set 5', type: 'assignment', due: '2026-10-14T17:00', estimate_min: 120, sessions: [['2026-10-13', 70], ['2026-10-14', 45]] },
    { id: 'asg_math13_ps6', course: 'MATH 13', title: 'MATH 13 problem set 6', type: 'assignment', due: '2026-10-21T17:00', estimate_min: 120, sessions: [['2026-10-20', 130]] },
    { id: 'asg_econ1_r1', course: 'ECON 1', title: 'ECON 1 reading, chapters 5 and 6', type: 'reading', due: '2026-10-08T10:10', estimate_min: 60, sessions: [['2026-10-07', 55]] },
    { id: 'asg_econ1_r2', course: 'ECON 1', title: 'ECON 1 reading, chapters 7 and 8', type: 'reading', due: '2026-10-20T10:10', estimate_min: 60, sessions: [['2026-10-19', 70]] },
  ],

  revision_topics: [
    { id: 'top_lagrange', title: 'Lagrange multipliers', course: 'MATH 13', confidence: 2, interval_days: 1, last_reviewed: '2026-10-27', next_due: '2026-10-28', review_min: 20 },
    { id: 'top_elasticity', title: 'Price elasticity', course: 'ECON 1', confidence: 4, interval_days: 5, last_reviewed: '2026-10-24', next_due: '2026-10-29', review_min: 20 },
    { id: 'top_bfs', title: 'BFS versus DFS', course: 'COSC 10', confidence: 3, interval_days: 2, last_reviewed: '2026-10-26', next_due: '2026-10-28', review_min: 15 },
  ],
};
