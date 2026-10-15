import { describe, expect, it } from 'vitest';
import type { Catalog, Course } from '../types';
import { completionCourses } from './completion-courses';
const course: Course = { id: 'COSC 1', code: 'COSC 001', title: 'Introduction to Programming and Computation', department: 'COSC', credits: 1, level: 'undergraduate', description: 'Official offering description.', source: 'https://courses.dartmouth.edu/', prerequisite: { kind: 'review', text: 'Confirm source.', evidence: { source: 'https://courses.dartmouth.edu/', retrievedAt: '2026-10-15', verification: 'needsReview' } } };
const catalog: Catalog = { version: 2, source: 'https://courses.dartmouth.edu/', exported_at: '2026-10-15', courses: [course], sections: [], bundles: [], terms: [], departments: [], coverage: [] };

describe('official completion choices', () => {
  it('adds only source-backed identities from nested prerequisites and corequisites', () => {
    const evidence = { source: 'https://dartmouth.smartcatalogiq.com/en/current/orc', retrievedAt: '2026-10-15', verification: 'verified' as const };
    const sourceCatalog: Catalog = { ...catalog, courses: [{ ...course,
      prerequisite: { kind: 'any', evidence, rules: [
        { kind: 'course', courseId: 'LAT 2', evidence },
        { kind: 'all', evidence, rules: [
          { kind: 'course', courseId: 'LAT 3', evidence },
          { kind: 'course', courseId: 'LAT 999', evidence: { ...evidence, verification: 'needsReview' } },
        ] },
      ] },
      corequisite: { kind: 'course', courseId: 'LAT 4', concurrent: true, evidence },
    }] };
    const choices = completionCourses(sourceCatalog);
    for (const id of ['LAT 2', 'LAT 3', 'LAT 4']) expect(choices.find(c => c.id === id)?.identityEvidence).toEqual(evidence);
    expect(choices.some(c => c.id === 'LAT 999')).toBe(false);
    expect(sourceCatalog.sections).toHaveLength(0);
  });
  it('includes documented unoffered requirements and aliases without creating offerings', () => {
    const before = JSON.stringify(catalog);
    const choices = completionCourses(catalog);
    for (const id of ['COSC 11', 'COSC 12', 'COSC 14', 'COSC 17', 'COSC 98', 'COSC 99', 'ENGS 262', 'PHYS 48']) {
      const choice = choices.find(c => c.id === id)!;
      expect(choice).toBeDefined();
      expect(choice.title).toBe('Catalog requirement — not offered in this snapshot');
      expect(choice.catalogOnly).toBe(true);
      expect(choice.identityEvidence?.verification).toBe('verified');
      expect(choice.source).toMatch(/^https:\/\/(dartmouth.smartcatalogiq.com|engineering.dartmouth.edu)\//);
      expect(choice.prerequisite.kind).toBe('review');
    }
    expect(catalog.bundles).toHaveLength(0);
    expect(catalog.sections).toHaveLength(0);
    expect(JSON.stringify(catalog)).toBe(before);
  });
  it('retains original offering records and never expands ranges into invented identities', () => {
    const choices = completionCourses(catalog);
    expect(choices.find(c => c.id === 'COSC 1')).toBe(course);
    expect(choices.filter(c => c.id === 'COSC 1')).toHaveLength(1);
    expect(choices.some(c => c.id === 'COSC 88.88')).toBe(false);
    expect(choices.some(c => c.id === 'ENGS 999')).toBe(false);
    expect(new Set(choices.map(c => c.id)).size).toBe(choices.length);
  });
});
