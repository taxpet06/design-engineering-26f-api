import type { Catalog, CourseBundle, Preferences, Recommendation } from '../types';
import { creditIdentity } from '../data/equivalences';
import { matchesInterest } from '../data/interests';
import { majorRelevance, requirementContribution } from './requirements';
import { getAcademicEligibility, getSectionEligibility, validatePinnedSections, validMeeting } from './eligibility';
export { evaluateCourseRule, getSectionEligibility, meetingsConflict, sectionsConflict, validMeeting, validatePinnedSections } from './eligibility';
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
function ranked(catalog: Catalog, prefs: Preferences, pins: CourseBundle[], excludedCourseIds: string[], includeUnconfirmedPrerequisites: boolean): Recommendation[] {
  const candidates: Recommendation[] = [];
  const requirementPoints = new Map<string, number>();
  for (const bundle of catalog.bundles) {
    if (bundle.term !== prefs.term || excludedCourseIds.some(id => creditIdentity(id) === creditIdentity(bundle.course_id))) continue;
    const eligibility = getSectionEligibility(catalog, prefs, bundle, pins);
    if (eligibility.status === 'ineligible') continue;
    if (pins.some((pin, index) => getSectionEligibility(catalog, prefs, pin, [...pins.filter((_, other) => other !== index), bundle]).status === 'ineligible')) continue;
    const prerequisitesConfirmed = getAcademicEligibility(catalog, prefs, bundle, pins).status === 'eligible';
    if (!prerequisitesConfirmed && !includeUnconfirmedPrerequisites) continue;
    const course = catalog.courses.find(item => item.id === bundle.course_id)!;
    const matchesTime = prefs.timePreference === 'none' || (bundle.meetings.length > 0 && bundle.meetings.every(meeting => validMeeting(meeting) && (prefs.timePreference === 'morning' ? meeting.start < 720 : meeting.start >= 720)));
    if (!requirementPoints.has(course.id)) requirementPoints.set(course.id, requirementContribution(catalog, prefs, pins, bundle) ? 25 : 0);
    const breakdown = { interest: matchesInterest(course, prefs.interests) ? 40 : 0, major: majorRelevance(prefs.major, course) ? 25 : 0, requirement: requirementPoints.get(course.id)!, time: matchesTime ? 10 : 0 };
    candidates.push({ eligibility, prerequisitesConfirmed, course, section: bundle, alternatives: [], breakdown, score: Object.values(breakdown).reduce((a,b) => a+b,0), reasons: [ ...(breakdown.interest ? [`Matches your interests`] : []), ...(breakdown.major ? [`Relevant to ${prefs.major}`] : []), ...(breakdown.requirement ? ['Adds potential requirement progress'] : []), ...(breakdown.time && prefs.timePreference !== 'none' ? [`Matches your ${prefs.timePreference} preference`] : []), 'No confirmed schedule conflicts' ] });
  }
  candidates.sort((a,b) => Number(b.prerequisitesConfirmed)-Number(a.prerequisitesConfirmed) || b.score-a.score || compare(a.course.code,b.course.code) || compare(a.course.id,b.course.id) || compare(a.section.componentIds.slice().sort().join('|'),b.section.componentIds.slice().sort().join('|')));
  const best = new Map<string, Recommendation>();
  for (const candidate of candidates) { const existing = best.get(creditIdentity(candidate.course.id)); if (existing) existing.alternatives.push(candidate.section); else best.set(creditIdentity(candidate.course.id), candidate); }
  return [...best.values()];
}
export function recommendThirdCourses(catalog: Catalog, prefs: Preferences, pins: CourseBundle[], excludedCourseIds: string[] = [], options: { includeUnconfirmedPrerequisites?: boolean } = {}): Recommendation[] {
  if (validatePinnedSections(catalog, prefs, pins, true).status === 'ineligible') return [];
  return ranked(catalog, prefs, pins, excludedCourseIds, options.includeUnconfirmedPrerequisites ?? false);
}
