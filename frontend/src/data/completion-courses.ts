import type { Catalog, Course, CourseRule, Evidence } from '../types';
import { equivalences } from './equivalences';
import { CS_SOURCE, majors } from './requirements';

export type CompletionCourse = Pick<Course, 'id' | 'code' | 'title' | 'department' | 'source' | 'prerequisite'> & {
  catalogOnly?: boolean;
  identityEvidence?: Evidence;
};

/** Completion choices include explicitly documented identities, independently of published offerings. */
export function completionCourses(catalog: Catalog): CompletionCourse[] {
  const courses = new Map<string, CompletionCourse>(catalog.courses.map(course => [course.id, course]));
  function add(id: string, evidence: Evidence) {
    if (evidence.verification !== 'verified' || courses.has(id)) return;
    courses.set(id, {
      id, code: id, title: 'Catalog requirement — not offered in this snapshot', department: id.split(' ')[0],
      source: evidence.source, catalogOnly: true, identityEvidence: evidence,
      prerequisite: { kind: 'review', text: 'This catalog identity is available for completion history only. Prerequisites and any future offering require separate source verification.', evidence: { ...evidence, verification: 'needsReview' } },
    });
  }
  function addRuleCourses(rule: CourseRule) {
    if (rule.kind === 'course') add(rule.courseId, rule.evidence);
    if (rule.kind === 'all' || rule.kind === 'any') rule.rules.forEach(addRuleCourses);
  }
  for (const course of catalog.courses) {
    addRuleCourses(course.prerequisite);
    if (course.corequisite) addRuleCourses(course.corequisite);
  }
  for (const major of majors) {
    if (major.evidence.verification !== 'verified') continue;
    for (const group of major.groups) for (const id of group.options.flat()) add(id, group.evidence);
  }
  for (const mapping of equivalences) {
    add(mapping.from, mapping.evidence);
    add(mapping.to, mapping.evidence);
  }
  for (const id of ['COSC 98', 'COSC 99']) add(id, { source: CS_SOURCE, retrievedAt: '2026-10-15', verification: 'verified', note: 'Explicit CS research culminating alternatives. Repeated terms and sequence still require transcript review.' });
  return [...courses.values()].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }) || a.id.localeCompare(b.id));
}
