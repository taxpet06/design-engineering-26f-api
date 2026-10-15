import { describe, expect, it } from 'vitest';
import type { CourseRule } from '../types';
import { evaluateCourseRule } from './eligibility';
import { ruleText } from '../components/displayText';
import { catalog } from '../data/catalog';
import { getSectionEligibility, recommendThirdCourses } from './recommendations';

const evidence = { source: 'https://dartmouth.smartcatalogiq.com/en/current/orc', retrievedAt: '2026-10-15', verification: 'verified' as const };
const course = (courseId: string): CourseRule => ({ kind: 'course', courseId, evidence });
const waiver: CourseRule = { kind: 'waiver', text: 'Instructor permission may waive the coursework prerequisite.', evidence };

describe('prerequisite permission exceptions', () => {
  it('blocks coursework OR an unconfirmed waiver, even with the coursework planned', () => {
    const rule: CourseRule = { kind: 'any', rules: [course('COSC 10'), waiver], evidence };
    for (const planned of [[], ['COSC 10']]) {
      const result = evaluateCourseRule(rule, [], planned, 'COSC 50');
      expect(result.status).toBe('ineligible');
      expect(result.reasons.some(r => r.code === 'prerequisite-waiver' && r.blocking)).toBe(true);
    }
    expect(evaluateCourseRule(rule, ['COSC 10'], [], 'COSC 50').status).toBe('eligible');
    expect(ruleText(rule)).toContain('prerequisite waiver not confirmed');
  });

  it('requires permission on a special alternative path while accepting the ordinary coursework path', () => {
    const rule: CourseRule = { kind: 'any', evidence, rules: [
      { kind: 'all', evidence, rules: [course('COSC 10'), course('MATH 3')] },
      { kind: 'all', evidence, rules: [course('COSC 1'), course('MATH 3'), waiver] },
    ] };
    expect(evaluateCourseRule(rule, ['COSC 1', 'MATH 3'], [], 'COSC 30').status).toBe('ineligible');
    expect(evaluateCourseRule(rule, ['COSC 10', 'MATH 3'], [], 'COSC 30').status).toBe('eligible');
  });

  it('keeps unknown academic alternatives and ordinary registration permission advisory', () => {
    const unknown: CourseRule = { kind: 'review', text: 'Equivalent preparation has not been verified.', evidence: { ...evidence, verification: 'needsReview' } };
    expect(evaluateCourseRule(unknown, [], [], 'TEST 1').status).toBe('needsReview');
    expect(evaluateCourseRule({ kind: 'any', evidence, rules: [course('COSC 10'), unknown] }, [], [], 'TEST 1').status).toBe('needsReview');
    expect(evaluateCourseRule({ kind: 'review', text: 'Registration permission required.', evidence }, [], [], 'TEST 1').status).toBe('needsReview');
    expect(ruleText({ kind: 'none', evidence: { ...evidence, verification: 'needsReview' } })).toBe('Prerequisites unconfirmed.');
    expect(evaluateCourseRule({ ...waiver, evidence: { ...evidence, verification: 'needsReview' } }, [], [], 'TEST 1').status).toBe('needsReview');
  });
});

describe('published CS prerequisite regression', () => {
  const rule = (id: string) => catalog.courses.find(course => course.id === id)!.prerequisite;
  const status = (id: string, completed: string[] = [], planned: string[] = []) => evaluateCourseRule(rule(id), completed, planned, id).status;

  it('excludes verified advanced CS courses from the reported WRIT 2 / COSC 1 plan', () => {
    const preferences = { major: 'Computer Science', interests: [], completedCourseIds: [], term: '26F', timePreference: 'none' as const };
    const pins = ['WRIT 2', 'COSC 1'].map(id => catalog.bundles.find(b => b.term === '26F' && b.course_id === id && b.section_number === '01')!);
    const advanced = catalog.courses.filter(c => c.id.startsWith('COSC ') && c.id !== 'COSC 1' && c.prerequisiteCoverage?.status === 'verified');
    expect(advanced.length).toBeGreaterThan(25);
    for (const course of advanced) expect(status(course.id), course.id).toBe('ineligible');
    const suggestions = recommendThirdCourses(catalog, preferences, pins);
    expect(suggestions.length).toBeGreaterThan(12);
    expect(suggestions.some(s => advanced.some(c => c.id === s.course.id))).toBe(false);
    expect(suggestions.every(s => getSectionEligibility(catalog, preferences, s.section, pins).status !== 'ineligible')).toBe(true);
    expect(suggestions.every(s => s.prerequisitesConfirmed)).toBe(true);
    for (const id of ['COSC 69.17','COSC 89.37','COSC 89.40','COSC 94','COSC 98.01','COSC 99.01','ENGS 50','ENGS 66']) {
      expect(suggestions.some(s => s.course.id === id), id).toBe(false);
    }
    expect(suggestions.some(s => s.course.id === 'ENGS 12')).toBe(true);
    const expanded = recommendThirdCourses(catalog, preferences, pins, [], { includeUnconfirmedPrerequisites: true });
    expect(expanded.some(s => s.course.id === 'COSC 69.17' && !s.prerequisitesConfirmed)).toBe(true);
    expect(expanded.some(s => s.course.id === 'COSC 89.37')).toBe(false);
  });

  it('enforces mandatory same-term enrollment without turning permitted concurrency into a prior-credit ban', () => {
    const required = catalog.courses.find(course => course.id === 'COSC 89.37')!.corequisite!;
    expect(evaluateCourseRule(required, [], [], 'COSC 89.37', true).status).toBe('ineligible');
    expect(evaluateCourseRule(required, ['COSC 94','COSC 73'], [], 'COSC 89.37', true).status).toBe('ineligible');
    expect(evaluateCourseRule(required, ['COSC 94'], ['COSC 73'], 'COSC 89.37', true).status).toBe('ineligible');
    expect(evaluateCourseRule(required, ['COSC 73'], ['COSC 94'], 'COSC 89.37', true).status).toBe('eligible');
    expect(evaluateCourseRule(required, [], ['COSC 94','COSC 73'], 'COSC 89.37', true).status).toBe('eligible');
    expect(ruleText(required)).toContain('must be taken in the same term');
    const permitted: CourseRule = { ...course('COSC 94'), kind:'course', courseId:'COSC 94', concurrent:true };
    expect(evaluateCourseRule(permitted, ['COSC 94'], [], 'TEST 1', true).status).toBe('eligible');
  });

  it('honors exact alternatives without imposing COSC 1 and COSC 10 on every advanced course', () => {
    expect(status('COSC 16', ['PSYC 1'])).toBe('eligible');
    expect(status('COSC 16', [], ['PSYC 1'])).toBe('ineligible');
    expect(status('COSC 15', ['COSC 10'])).toBe('ineligible');
    expect(status('COSC 15', ['COSC 10', 'ENGS 20'])).toBe('eligible');
    expect(status('COSC 15', ['COSC 50'])).toBe('eligible');
    expect(status('COSC 70', ['ENGS 20', 'MATH 3'])).toBe('eligible');
    expect(status('COSC 89.29', ['MUS 8'])).toBe('eligible');
    expect(status('COSC 49.12', ['MATH 38', 'MATH 24'])).toBe('eligible');
    expect(status('COSC 49.12', ['MATH 24'])).toBe('ineligible');
  });

  it('accepts old and new CS numbers but does not require recommended preparation', () => {
    for (const completed of ['COSC 50', 'COSC 14']) expect(status('COSC 57', [completed])).toBe('eligible');
    expect(status('COSC 32', ['COSC 12'])).toBe('eligible');
    expect(status('COSC 3', ['COSC 1'])).toBe('eligible');
    expect(catalog.courses.find(c => c.id === 'COSC 57')!.recommendedPreparation?.length).toBeGreaterThan(0);
    expect(status('COSC 69.17')).toBe('needsReview');
    expect(catalog.courses.find(c => c.id === 'COSC 69.17')!.recommendedPreparation?.length).toBeGreaterThan(0);
  });

  it('uses the official EARS/EAPS crosswalk rather than assuming identical numbers', () => {
    for (const [oldId, newId] of [['EARS 19', 'EAPS 10'], ['EARS 12', 'EAPS 22'], ['EARS 39', 'EAPS 30'], ['EARS 77', 'EAPS 37']]) {
      expect(evaluateCourseRule(course(newId), [oldId], [], 'TEST 1').status).toBe('eligible');
      expect(evaluateCourseRule(course(oldId), [newId], [], 'TEST 1').status).toBe('eligible');
    }
    expect(evaluateCourseRule(course('EAPS 12'), ['EARS 12'], [], 'TEST 1').status).toBe('ineligible');
    expect(evaluateCourseRule(course('EAPS 80.04'), ['EARS 80.04'], [], 'TEST 1').status).toBe('ineligible');
  });

  it('keeps every audited course accounted for and never claims absent fields prove no prerequisites', () => {
    expect(catalog.courses).toHaveLength(1472);
    for (const course of catalog.courses) {
      expect(course.prerequisiteCoverage, course.id).toBeDefined();
      if (course.prerequisiteCoverage?.status === 'verified') {
        expect(course.prerequisiteCoverage.sourceText?.trim(), course.id).toBeTruthy();
        expect(course.prerequisite.evidence.verification, course.id).toBe('verified');
      }
      if (course.prerequisite.kind === 'none') expect(course.prerequisite.evidence.sourceText?.trim(), course.id).toBeTruthy();
    }
  });
});
