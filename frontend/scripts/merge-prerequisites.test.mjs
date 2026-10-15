import test from 'node:test';
import assert from 'node:assert/strict';
import { mergePrerequisites } from './merge-prerequisites.mjs';

const unknown = { prerequisite: { kind: 'review' }, coverage: { status: 'unresolved' } };
test('requires a disjoint, complete course audit before publishing', () => {
  const courses = [{ id: 'COSC 1' }, { id: 'MATH 3' }];
  assert.throws(() => mergePrerequisites(courses, [{ 'COSC 1': unknown }]), /missing for 1/);
  assert.throws(() => mergePrerequisites(courses, [{ 'COSC 1': unknown }, { 'COSC 1': unknown }]), /Overlapping/);
  assert.throws(() => mergePrerequisites(courses, [{ 'TEST 1': unknown }]), /Unexpected course/);
  const merged = mergePrerequisites(courses, [{ 'COSC 1': unknown }, { 'MATH 3': unknown }]);
  assert.equal(merged.report.total, 2);
  assert.equal(merged.report.counts.unresolved, 2);
});
test('absence of evidence cannot become verified no prerequisites', () => {
  const courses = [{ id: 'COSC 1' }];
  assert.throws(() => mergePrerequisites(courses, [{ 'COSC 1': { prerequisite: { kind: 'none', evidence: { verification: 'verified' } }, coverage: { status: 'verified' } } }]), /Unsupported verification/);
});
