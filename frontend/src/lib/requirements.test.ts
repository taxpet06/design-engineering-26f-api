import { describe, expect, it } from 'vitest';
import type { Catalog, CourseBundle, Preferences } from '../types';
import { canonicalCourseId } from '../data/equivalences';
import { majors } from '../data/requirements';
import { getMajorProgress, requirementContribution } from './requirements';
const catalog = { courses: [], bundles: [], sections: [], terms: [], departments: [], coverage: [], source: 'official', exported_at: '2026-10-15', version: 2 } as Catalog;
const prefs = (major: string, completedCourseIds: string[] = []): Preferences => ({ major, completedCourseIds, interests: [], timePreference: 'none', term: '202609' });
const bundle = (course_id: string): CourseBundle => {
  const id = `202609:${course_id}`;
  const evidence = {source:'official',retrievedAt:'2026-10-15',verification:'verified' as const};
  const b: CourseBundle = {id,course_id,term:'202609',section_number:'01',componentIds:[id],meetings:[],source:'official',verification:'verified',reviewReasons:[]};
  if (!catalog.bundles.some(b=>b.id===id)) {
    catalog.bundles.push(b);
    catalog.sections.push({...b,crn:id,component:'Lecture',instructor:'Test',componentsVerified:true,companionOptions:[]});
    catalog.courses.push({id:course_id,code:course_id,title:course_id,department:course_id.split(' ')[0],credits:1,level:'undergraduate',description:'',source:'official',prerequisite:{kind:'none',evidence}});
  }
  return b;
};
const progress = (major: string, ids: string[], plans: string[] = []) => getMajorProgress(catalog, prefs(major, ids), plans.map(bundle));
const get = (major: string, ids: string[], group: string, plans: string[] = []) => progress(major, ids, plans).groups.find(g => g.id === group)!;

describe('reviewed Class of 2030 curricula', () => {
  it('records the cohort, edition and source evidence for every group', () => {
    expect(majors).toHaveLength(4);
    for (const major of majors) {
      expect(major.cohort).toBe('2030'); expect(major.catalogEdition).toBe('2026-27');
      expect(major.groups.every(g => g.evidence.source.startsWith('https://'))).toBe(true);
    }
  });
  it('counts all six CS core identities including four old numbers without duplicates', () => {
    const ids = ['COSC 10', 'COSC 30', 'COSC 11', 'COSC 31', 'COSC 50', 'COSC 15', 'COSC 70'];
    expect(get('Computer Science', ids, 'cs-core').completed).toBe(6);
    expect(get('Computer Science', ids, 'cs-electives').completed).toBe(0);
    expect(canonicalCourseId('COSC 30')).toBe('COSC 11');
    expect(canonicalCourseId('COSC 49.01')).toBe('COSC 49.01');
  });
  it('checks the independently specified full CS course profile without sharing CE electives', () => {
    const ids = ['COSC 1', 'MATH 8', 'COSC 10', 'COSC 30', 'COSC 31', 'COSC 50', 'COSC 15', 'COSC 70', 'COSC 32', 'COSC 51', 'COSC 74', 'COSC 81', 'COSC 49.01', 'COSC 69.01'];
    const result = progress('Computer Science', ids);
    expect(result.remaining).toBe(0);
    expect(result.completed).toBe(14);
    expect(result.needsReview.join(' ')).toMatch(/Advisor|advisor/);
    expect(result.needsReview.join(' ')).toMatch(/ordering/);
    const elective = result.groups.find(g => g.id === 'cs-electives')!;
    const ce = result.groups.find(g => g.id === 'cs-ce')!;
    expect(elective.courses.some(c => ce.courses.includes(c))).toBe(false);
  });
  it('does not mistake repeated research IDs for consecutive-term CE credit', () => {
    expect(get('Computer Science', ['COSC 98', 'COSC 98', 'COSC 99'], 'cs-ce').completed).toBe(0);
    expect(progress('Computer Science', ['COSC 98']).needsReview.join(' ')).toMatch(/consecutive/);
  });
  it('covers independently checked engineering, biomedical, and physics profiles while retaining external review', () => {
    const entry = ['MATH 3', 'MATH 8', 'MATH 13', 'PHYS 13', 'PHYS 14', 'CHEM 5', 'ENGS 20'];
    const engineering = progress('Engineering Sciences', [...entry, 'ENGS 21', 'ENGS 22', 'ENGS 23', 'ENGS 24', 'ENGS 25', 'ENGS 31', 'ENGS 33', 'ENGS 58', 'ENGS 62']);
    const biomedical = progress('Biomedical Engineering Sciences', [...entry, 'CHEM 6', 'ENGS 21', 'ENGS 22', 'ENGS 23', 'ENGS 31', 'ENGS 56', 'BIOL 12', 'BIOL 13', 'CHEM 51', 'CHEM 52', 'ENGS 58']);
    const physics = progress('Engineering Physics', [...entry, 'MATH 23', 'ENGS 22', 'ENGS 23', 'ENGS 24', 'PHYS 19', 'PHYS 40', 'PHYS 43', 'ENGS 25', 'ENGS 58', 'PHYS 50', 'PHYS 72']);
    for (const result of [engineering, biomedical, physics]) {
      expect(result.remaining).toBe(0);
      expect(result.needsReview.length).toBeGreaterThan(0);
    }
    expect(engineering.completed).toBe(17);
    expect(biomedical.completed).toBe(17);
    expect(physics.completed).toBe(19);
  });
  it('counts documented astronomy electives on the physics side without weakening restricted groups', () => {
    expect(get('Engineering Physics', ['ENGS 25', 'ENGS 58', 'PHYS 50', 'ASTR 61'], 'ep-electives').completed).toBe(4);
  });
  it('requires two distinct engineering gateway disciplines', () => {
    expect(get('Engineering Sciences', ['ENGS 31', 'ENGS 32'], 'eng-gateway').completed).toBe(1);
    expect(get('Engineering Sciences', ['ENGS 31', 'ENGS 33'], 'eng-gateway').completed).toBe(2);
  });
  it('requires both CS courses in the engineering programming alternative', () => {
    expect(get('Engineering Sciences', ['COSC 1'], 'eng-programming').completed).toBe(0);
    expect(get('Engineering Sciences', ['COSC 1'], 'eng-programming').notes.join(' ')).toMatch(/still needs COSC 10/);
    expect(get('Engineering Sciences', ['COSC 1', 'COSC 10'], 'eng-programming').completed).toBe(1);
    expect(get('Engineering Sciences', ['ENGS 20'], 'eng-programming').completed).toBe(1);
  });
  it('allocates engineering electives exclusively, with explicitly permitted CE overlap', () => {
    const result = progress('Engineering Sciences', ['ENGS 21', 'ENGS 22', 'ENGS 23', 'ENGS 24', 'ENGS 25', 'ENGS 31', 'ENGS 33', 'ENGS 58', 'ENGS 62']);
    const groups = result.groups.filter(g => g.category !== 'entry' && g.category !== 'culminating');
    const courses = groups.flatMap(g => g.courses);
    expect(new Set(courses).size).toBe(courses.length);
    expect(groups.reduce((n, g) => n + g.completed, 0)).toBe(9);
    expect(result.groups.find(g => g.id === 'eng-ce')!.completed).toBe(1);
  });
  it('supports biomedical chemistry alternatives and enforces matching organic sequences', () => {
    expect(get('Biomedical Engineering Sciences', ['CHEM 5'], 'bio-chemistry').completed).toBe(0);
    expect(get('Biomedical Engineering Sciences', ['CHEM 5', 'CHEM 6'], 'bio-chemistry').completed).toBe(1);
    expect(get('Biomedical Engineering Sciences', ['CHEM 11'], 'bio-chemistry').completed).toBe(1);
    expect(get('Biomedical Engineering Sciences', ['CHEM 51', 'CHEM 58'], 'bio-organic').completed).toBe(0);
    expect(get('Biomedical Engineering Sciences', ['CHEM 57', 'CHEM 58'], 'bio-organic').completed).toBe(1);
  });
  it('does not reuse a biomedical course across three overlapping exclusive groups', () => {
    const result = progress('Biomedical Engineering Sciences', ['ENGS 23']);
    expect(result.groups.filter(g => g.category !== 'entry').reduce((n, g) => n + g.completed, 0)).toBe(1);
    const two = progress('Biomedical Engineering Sciences', ['ENGS 23', 'ENGS 56']);
    expect(two.groups.filter(g => g.category === 'core').reduce((n, g) => n + g.completed, 0)).toBe(2);
  });
  it('preserves the engineering physics 2+2 elective split and restricted groups', () => {
    expect(get('Engineering Physics', ['ENGS 25', 'ENGS 58', 'PHYS 50', 'PHYS 72'], 'ep-electives').completed).toBe(4);
    expect(get('Engineering Physics', ['ENGS 25', 'ENGS 58', 'ENGS 62', 'PHYS 50'], 'ep-electives').completed).toBe(3);
    expect(get('Engineering Physics', ['ENGS 25', 'ENGS 33', 'PHYS 41', 'PHYS 72'], 'ep-electives').completed).toBe(3);
  });
  it('shares a credit identity across confirmed cross-listings while allowing either subject allocation', () => {
    expect(get('Engineering Physics', ['ENGS 25', 'ENGS 32', 'PHYS 48', 'PHYS 50'], 'ep-electives').completed).toBe(3);
    expect(get('Engineering Physics', ['ENGS 25', 'ENGS 58', 'ENGS 32', 'PHYS 50'], 'ep-electives').completed).toBe(4);
    expect(get('Engineering Sciences', ['PHYS 30', 'ENGS 30'], 'eng-gateway').completed).toBe(1);
    expect(get('Computer Science', ['COSC 30', 'ENGS 66'], 'cs-core').completed).toBe(1);
    expect(get('Computer Science', ['ENGS 31', 'COSC 56'], 'cs-electives').completed).toBe(1);
  });
  it('does not silently cap source-permitted engineering electives at course 199', () => {
    const result = progress('Engineering Sciences', ['ENGS 262']);
    expect(result.groups.filter(g => g.category === 'elective').reduce((n, g) => n + g.completed, 0)).toBe(1);
    expect(result.groups.find(g => g.id === 'eng-ce')!.completed).toBe(1);
  });
  it('has six physics core courses and leaves placement/grade conditions unresolved', () => {
    const result = progress('Engineering Physics', ['ENGS 22', 'ENGS 23', 'ENGS 24', 'PHYS 19', 'PHYS 40', 'PHYS 43']);
    expect(result.groups.filter(g => g.category === 'core').reduce((n, g) => n + g.completed, 0)).toBe(6);
    expect(result.needsReview.join(' ')).toMatch(/GPA/);
    expect(result.needsReview.join(' ')).toMatch(/PHYS 15/);
  });
});

describe('marginal requirement progress', () => {
  it('does not reward alternatives after an entry group is already covered', () => {
    const p = prefs('Computer Science', ['MATH 8']);
    expect(requirementContribution(catalog, p, [], bundle('MATH 9'))).toBe(false);
    expect(requirementContribution(catalog, prefs('Computer Science'), [bundle('MATH 8')], bundle('MATH 9'))).toBe(false);
  });
  it('rewards required pair progress without claiming the pair is complete', () => {
    const p = prefs('Engineering Sciences');
    expect(requirementContribution(catalog, p, [], bundle('COSC 1'))).toBe(true);
    expect(get('Engineering Sciences', [], 'eng-programming', ['COSC 1']).planned).toBe(0);
    expect(get('Engineering Sciences', ['COSC 1'], 'eng-programming', ['COSC 10']).planned).toBe(1);
  });
  it('does not reward duplicate course sections or old/new identities', () => {
    expect(requirementContribution(catalog, prefs('Computer Science', ['COSC 30']), [], bundle('COSC 11'))).toBe(false);
    expect(requirementContribution(catalog, prefs('Computer Science'), [bundle('COSC 10')], bundle('COSC 10'))).toBe(false);
  });
  it('withholds CS culminating bonus until all cores are completed before the planning term', () => {
    const electives = ['COSC 32', 'COSC 51', 'COSC 74', 'COSC 81'];
    const cores = ['COSC 10', 'COSC 30', 'COSC 31', 'COSC 50', 'COSC 15', 'COSC 70'];
    expect(requirementContribution(catalog, prefs('Computer Science', electives), [], bundle('COSC 49.01'))).toBe(false);
    expect(requirementContribution(catalog, prefs('Computer Science', electives), cores.map(bundle), bundle('COSC 49.01'))).toBe(false);
    expect(requirementContribution(catalog, prefs('Computer Science', [...electives, ...cores]), [], bundle('COSC 49.01'))).toBe(true);
    expect(get('Computer Science', electives, 'cs-ce', ['COSC 49.01']).status).toBe('needsReview');
  });
  it('does not reward a second cross-listed identity as new requirement progress', () => {
    expect(requirementContribution(catalog, prefs('Engineering Physics', ['ENGS 32']), [], bundle('PHYS 48'))).toBe(false);
    expect(requirementContribution(catalog, prefs('Engineering Sciences'), [bundle('PHYS 30')], bundle('ENGS 30'))).toBe(false);
  });
  it('distinguishes completed credit from potential coverage including advisory bundles', () => {
    const p = prefs('Computer Science', ['COSC 10']);
    const result = getMajorProgress(catalog, p, [bundle('COSC 11'), { ...bundle('COSC 12'), verification: 'needsReview' }]);
    const core = result.groups.find(g => g.id === 'cs-core')!;
    expect([core.completed, core.planned, core.remaining]).toEqual([1, 2, 3]);
    expect(requirementContribution(catalog, p, [], { ...bundle('COSC 12'), verification: 'needsReview' })).toBe(true);
  });
});
