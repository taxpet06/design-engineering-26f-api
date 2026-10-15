import type { Catalog, CourseBundle, CourseRule, Eligibility, EligibilityReason, Meeting, Preferences } from '../types';
import { creditIdentity, equivalences } from '../data/equivalences';

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const reason = (code: string, message: string, source?: string): EligibilityReason => ({ code, message, source });
const result = (status: Eligibility['status'], reasons: EligibilityReason[] = []): Eligibility => ({ status, reasons: reasons.map(r => ({ ...r, blocking: status === 'ineligible' })) });
const unique = (reasons: EligibilityReason[]) => [...new Map(reasons.map(r => [`${r.code}:${r.message}`, r])).values()];
function combine(items: Eligibility[]): Eligibility {
  return { status: items.some(i => i.status === 'ineligible') ? 'ineligible' : items.some(i => i.status === 'needsReview') ? 'needsReview' : 'eligible', reasons: unique(items.flatMap(i => i.reasons)) };
}
const validISODate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
export function validMeeting(meeting: Meeting): boolean {
  return meeting.days.length > 0 && meeting.days.every(day => weekdays.includes(day)) && Number.isInteger(meeting.start) && Number.isInteger(meeting.end) && meeting.start >= 0 && meeting.start < meeting.end && meeting.end <= 1440 && validISODate(meeting.startDate) && validISODate(meeting.endDate) && meeting.startDate <= meeting.endDate;
}
export function meetingsConflict(a: Meeting, b: Meeting): boolean {
  if (!validMeeting(a) || !validMeeting(b) || a.start >= b.end || b.start >= a.end) return false;
  const start = a.startDate > b.startDate ? a.startDate : b.startDate;
  const end = a.endDate < b.endDate ? a.endDate : b.endDate;
  if (start > end) return false;
  const days = a.days.filter(day => b.days.includes(day));
  if (!days.length) return false;
  // Date ranges shorter than a week may overlap without sharing an actual meeting day.
  const first = new Date(`${start}T00:00:00Z`), last = new Date(`${end}T00:00:00Z`);
  for (let offset = 0; offset < 7; offset++) {
    const date = new Date(first.getTime() + offset * 86400000);
    if (date > last) break;
    if (days.includes(weekdays[(date.getUTCDay() + 6) % 7])) return true;
  }
  return false;
}
export function sectionsConflict(a: Pick<CourseBundle, 'meetings'>, b: Pick<CourseBundle, 'meetings'>): boolean { return a.meetings.some(first => b.meetings.some(second => meetingsConflict(first, second))); }
function hasCourse(ids: string[], required: string, owner: string): boolean {
  return ids.some(id => creditIdentity(id) === creditIdentity(required) || (owner.startsWith('COSC ') && equivalences.some(e => e.kind === 'substitution' && e.evidence.verification === 'verified' && e.from === id && e.to === required && e.scope?.includes('prerequisite'))));
}
export function evaluateCourseRule(rule: CourseRule, completed: string[], concurrent: string[], owner: string, corequisite = false): Eligibility {
  const source = rule.evidence.source;
  if (rule.kind === 'review' || rule.evidence.verification !== 'verified') return result('needsReview', [reason('rule-review', rule.kind === 'review' ? owner + ': ' + rule.text : owner + ': This admission rule has not been verified.', source)]);
  if (rule.kind === 'waiver') return result('ineligible', [reason('prerequisite-waiver', `${owner}: ${rule.text} This prerequisite exception has not been confirmed. Complete a published coursework path before adding this course.`, source)]);
  if (rule.kind === 'none') return result('eligible');
  if (rule.kind === 'course') {
    if (rule.concurrentOnly) return corequisite && hasCourse(concurrent, rule.courseId, owner)
      ? result('eligible')
      : result('ineligible', [reason('corequisite', `Add ${rule.courseId} in the same term as ${owner}. Previously completed credit does not satisfy this concurrent requirement.`, source)]);
    if (hasCourse(completed, rule.courseId, owner) || (corequisite && rule.concurrent && hasCourse(concurrent, rule.courseId, owner))) return result('eligible');
    if (corequisite && rule.concurrent) return result('ineligible', [reason('corequisite', `Complete ${rule.courseId} or add it concurrently as the published rule permits.`, source)]);
    return result('ineligible', [reason('prerequisite', `Complete ${rule.courseId} before taking ${owner}. Courses in this plan do not satisfy prerequisites.`, source)]);
  }
  const children = rule.rules.map(child => evaluateCourseRule(child, completed, concurrent, owner, corequisite));
  if (!children.length) return result('needsReview', [reason('empty-rule', 'The published rule is incomplete.', source)]);
  if (rule.kind === 'all') return combine(children);
  if (children.some(child => child.status === 'eligible')) return result('eligible');
  return result(children.some(child => child.status === 'needsReview') ? 'needsReview' : 'ineligible', unique(children.flatMap(child => child.reasons)));
}
export function getAcademicEligibility(catalog: Catalog, prefs: Preferences, bundle: CourseBundle, others: CourseBundle[]): Eligibility {
  const course = catalog.courses.find(item => item.id === bundle.course_id);
  if (!course) return result('ineligible', [reason('missing-course', 'This course is not part of the official snapshot.')]);
  return combine([
    evaluateCourseRule(course.prerequisite, prefs.completedCourseIds, [], course.id),
    ...(course.corequisite ? [evaluateCourseRule(course.corequisite, prefs.completedCourseIds, others.map(item => item.course_id), course.id, true)] : []),
  ]);
}
export function getSectionEligibility(catalog: Catalog, prefs: Preferences, bundle: CourseBundle, others: CourseBundle[], allowPendingCorequisites = false): Eligibility {
  const course = catalog.courses.find(item => item.id === bundle.course_id);
  const stored = catalog.bundles.find(item => item.id === bundle.id);
  if (!course || !stored || stored.course_id !== bundle.course_id || stored.componentIds.join('|') !== bundle.componentIds.join('|')) return result('ineligible', [reason('missing-bundle', 'This course bundle is not part of the official snapshot.')]);
  const checks: Eligibility[] = [];
  const fail = (code: string, message: string) => checks.push(result('ineligible', [reason(code, message, bundle.source)]));
  if (bundle.term !== prefs.term) fail('term', `${course.code} is not offered in the selected term.`);
  if (prefs.completedCourseIds.some(id => creditIdentity(id) === creditIdentity(course.id))) fail('completed', `You have already completed ${course.code} or its confirmed equivalent.`);
  if (others.some(item => creditIdentity(item.course_id) === creditIdentity(course.id) || (catalog.equivalences ?? []).some(e => e.kind === 'cross-listing' && e.evidence.verification === 'verified' && e.scope?.split('|').some(id => stored.componentIds.includes(id)) && e.scope?.split('|').some(id => item.componentIds.includes(id))))) fail('duplicate', `${course.code} or its confirmed equivalent is already in your plan.`);
  checks.push(getAcademicEligibility(catalog, prefs, bundle, others));
  const components = stored.componentIds.map(id => catalog.sections.find(section => section.id === id));
  if (components.some(section => !section)) fail('missing-component', 'A required component is missing from this bundle.');
  for (const component of components) {
    if (!component) continue;
    if (component.companionOptions.length && !component.companionOptions.some(option => option.every(id => stored.componentIds.includes(id)))) fail('required-component', `Required companion sections for ${component.id} are missing.`);
    if (!component.componentsVerified || component.verification === 'needsReview') checks.push(result('needsReview', component.reviewReasons.length ? component.reviewReasons.map(message => reason('component-review', [course.code, component.component + ' ' + component.crn, message].join(' · '), component.source)) : [reason('component-review', 'Required components have not been verified.', component.source)]));
    if (!component.meetings.length || component.meetings.some(meeting => !validMeeting(meeting))) checks.push(result('needsReview', [reason('unknown-time', `Meeting times for ${component.id} need review.`, component.source)]));
  }
  if (stored.verification === 'needsReview') {
    const componentReasons = new Set(components.flatMap(component => component?.reviewReasons ?? []));
    const additionalReasons = stored.reviewReasons.filter(message => !componentReasons.has(message));
    if (additionalReasons.length) checks.push(result('needsReview', additionalReasons.map(message => reason('bundle-review', `${course.code}: ${message}`, stored.source))));
    else if (components.every(component => component?.verification === 'verified' && component.componentsVerified)) checks.push(result('needsReview', [reason('bundle-review', `${course.code}: This bundle still requires source verification.`, stored.source)]));
  }
  for (let a = 0; a < components.length; a++) for (let b = a + 1; b < components.length; b++) if (components[a] && components[b] && sectionsConflict(components[a]!, components[b]!)) fail('internal-conflict', 'The lecture and a required companion overlap. Choose another combination.');
  for (const other of others) if (sectionsConflict(stored, other)) fail('conflict', `${course.code} overlaps ${catalog.courses.find(c => c.id === other.course_id)?.code ?? other.course_id}, including reserved X-hours.`);
  const eligibility = combine(checks);
  if (!allowPendingCorequisites) return eligibility;
  const reasons = eligibility.reasons.map(item => item.code === 'corequisite' ? { ...item, blocking: false } : item);
  return { status: reasons.some(item => item.blocking) ? 'ineligible' : reasons.length ? 'needsReview' : 'eligible', reasons };
}
export function validatePinnedSections(catalog: Catalog, prefs: Preferences, bundles: CourseBundle[], allowPendingCorequisites = false): Eligibility {
  if (bundles.length !== 2) return result('ineligible', [reason('selection-count', 'Choose two courses before finding your third.')]);
  return combine(bundles.map((bundle, index) => getSectionEligibility(catalog, prefs, bundle, bundles.filter((_, other) => other !== index), allowPendingCorequisites)));
}
