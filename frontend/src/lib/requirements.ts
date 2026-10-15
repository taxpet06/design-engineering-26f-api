import type { Catalog, Course, CourseBundle, MajorRules, Preferences, Progress, RequirementGroup, RequirementProgress } from '../types';
import { getSectionEligibility } from './eligibility';
import { majors } from '../data/requirements';
import { canonicalCourseId, creditIdentity, equivalentCourseIds } from '../data/equivalences';

interface Route { ids: string[]; present: string[]; mask: bigint; complete: boolean; completed: boolean; fraction: number; bucket: string }
interface Choice { routes: Route[]; mask: bigint; completed: number; total: number; partial: number; score: number }
interface Allocation { choices: Choice[]; score: number; potential: number }
const emptyChoice = (): Choice => ({ routes: [], mask: 0n, completed: 0, total: 0, partial: 0, score: 0 });
const subject = (id: string) => id.split(' ')[0];
const number = (id: string) => Number(id.split(' ')[1]);

export function majorRelevance(major: string, course: Course): boolean {
  const subjects = majors.find(m => m.name === major)?.relevantSubjects ?? [];
  return equivalentCourseIds(course.id).some(id => subjects.includes(subject(id)));
}

function availableRoutes(group: RequirementGroup, available: Set<string>, completed: Set<string>, bits: Map<string, bigint>): Route[] {
  if (group.evidence.verification !== 'verified') return [];
  const options = group.options.map((ids, i) => ({ ids: ids.map(canonicalCourseId), bucket: group.optionBuckets?.[i] ?? '' }));
  for (const id of [...available].sort()) {
    if (group.courseRanges?.some(range => subject(id) === range.subject && number(id) >= range.min && number(id) <= range.max && !range.exclude?.includes(number(id)))) options.push({ ids: [id], bucket: '' });
  }
  const unique = new Map<string, Route>();
  for (const option of options) {
    // Repeated enrollment cannot be established from a set of completion IDs.
    if (new Set(option.ids.map(creditIdentity)).size !== option.ids.length) continue;
    const ids = [...option.ids].sort();
    const present = ids.filter(id => available.has(id));
    if (!present.length) continue;
    const key = ids.join('|');
    if (unique.has(key)) continue;
    unique.set(key, { ids, present, mask: present.reduce((mask, id) => mask | bits.get(id)!, 0n), complete: present.length === ids.length, completed: ids.every(id => completed.has(id)), fraction: present.length / ids.length, bucket: option.bucket });
  }
  return [...unique.values()].sort((a, b) => a.ids.join('|').localeCompare(b.ids.join('|')));
}

function choicesFor(group: RequirementGroup, routes: Route[], futureMask: bigint): Choice[] {
  const choices = new Map<bigint, Choice>();
  function visit(start: number, chosen: Route[], mask: bigint) {
    const total = chosen.filter(r => r.complete).length;
    const completed = chosen.filter(r => r.completed).length;
    const partial = chosen.reduce((n, route) => n + (route.complete ? 0 : route.fraction), 0);
    const buckets = new Set(chosen.map(r => r.bucket).filter(Boolean));
    const minBuckets = group.allocation?.minDistinctBuckets ?? 0;
    const remainingSlots = group.count - chosen.length;
    // Even partially filled groups must leave room for the required distinct disciplines.
    if (buckets.size + remainingSlots < minBuckets) return;
    const subjectCounts = group.allocation?.subjectCounts;
    if (subjectCounts) {
      for (const [subjects, maximum] of Object.entries(subjectCounts)) {
        const matching = chosen.flatMap(r => r.present).filter(id => subjects.split('|').includes(subject(id))).length;
        if (matching > maximum) return;
      }
      if (chosen.some(r => r.present.some(id => !Object.keys(subjectCounts).some(key => key.split('|').includes(subject(id)))))) return;
    }
    const minimum = group.allocation?.atLeast;
    if (minimum) {
      const count = chosen.flatMap(r => r.present).filter(id => minimum.courseIds.map(canonicalCourseId).includes(id)).length;
      if (count + remainingSlots < minimum.count) return;
    }
    const score = completed * 1_000_000 + total * 1_000 + partial;
    const choice = { routes: [...chosen], mask, completed, total, partial, score };
    const key = group.exclusive === false ? 0n : mask & futureMask;
    const existing = choices.get(key);
    if (!existing || score > existing.score) choices.set(key, choice);
    if (chosen.length === group.count) return;
    for (let i = start; i < routes.length; i++) {
      const route = routes[i];
      if ((mask & route.mask) !== 0n) continue;
      visit(i + 1, [...chosen, route], mask | route.mask);
    }
  }
  visit(0, [], 0n);
  return [...choices.values()].sort((a, b) => b.score - a.score);
}

/** Exact allocation across exclusive groups; completed credit wins before planned credit. */
function allocate(rules: MajorRules, completedIds: string[], plannedIds: string[]): Allocation {
  const completed = new Set(completedIds.flatMap(equivalentCourseIds));
  const available = new Set([...completed, ...plannedIds.flatMap(equivalentCourseIds)]);
  const creditBits = new Map([...new Set([...available].map(creditIdentity))].sort().map((id, index) => [id, 1n << BigInt(index)]));
  const bits = new Map([...available].map(id => [id, creditBits.get(creditIdentity(id))!]));
  const routes = rules.groups.map(g => availableRoutes(g, available, completed, bits));
  const masks = routes.map((r, i) => rules.groups[i].exclusive === false ? 0n : r.reduce((n, option) => n | option.mask, 0n));
  const future = masks.map((_, i) => masks.slice(i + 1).reduce((n, mask) => n | mask, 0n));
  const choices = rules.groups.map((group, i) => choicesFor(group, routes[i], masks.reduce((mask, value, j) => i === j ? mask : mask | value, 0n)));
  const memo = new Map<string, Allocation>();
  function visit(index: number, used: bigint): Allocation {
    if (index === rules.groups.length) return { choices: [], score: 0, potential: 0 };
    const key = `${index}:${used}`;
    const cached = memo.get(key);
    if (cached) return cached;
    let best: Allocation | undefined;
    for (const choice of choices[index]) {
      const exclusive = rules.groups[index].exclusive !== false;
      if (exclusive && (used & choice.mask) !== 0n) continue;
      const nextUsed = (exclusive ? used | choice.mask : used) & future[index];
      const next = visit(index + 1, nextUsed);
      const score = next.score + choice.score;
      if (!best || score > best.score) best = { choices: [choice, ...next.choices], score, potential: next.potential + choice.total + choice.partial };
    }
    const result = best ?? { choices: [emptyChoice(), ...visit(index + 1, used & future[index]).choices], score: 0, potential: 0 };
    memo.set(key, result);
    return result;
  }
  return visit(0, 0n);
}

function plannedCourseIds(catalog: Catalog, prefs: Preferences, bundles: CourseBundle[]): string[] {
  return bundles.filter((bundle, index) => getSectionEligibility(catalog, prefs, bundle, bundles.filter((_, other) => other !== index)).status !== 'ineligible').map(b => b.course_id);
}

export function getMajorProgress(catalog: Catalog, prefs: Preferences, bundles: CourseBundle[]): Progress {
  const rules = majors.find(m => m.name === prefs.major);
  if (!rules) return { groups: [], completed: 0, planned: 0, remaining: 0, needsReview: ['Choose a supported major to see course-based progress.'] };
  const result = allocate(rules, prefs.completedCourseIds, plannedCourseIds(catalog, prefs, bundles));
  const groups: RequirementProgress[] = rules.groups.map((group, index) => {
    const choice = result.choices[index] ?? emptyChoice();
    const notes = [...(group.reviewNotes ?? [])];
    if (group.sequence) notes.push(group.sequence);
    const partial = choice.routes.filter(r => !r.complete);
    for (const route of partial) notes.push(`Partial pathway: ${route.present.join(' + ')}; still needs ${route.ids.filter(id => !route.present.includes(id)).join(' + ')}.`);
    const planned = choice.total - choice.completed;
    const remaining = group.count - choice.total;
    const needsReview = group.evidence.verification !== 'verified' || Boolean(group.sequence && choice.routes.length);
    return { id: group.id, label: group.label, category: group.category, completed: choice.completed, planned, remaining, count: group.count, status: needsReview ? 'needsReview' : remaining === 0 ? planned ? 'planned' : 'completed' : 'remaining', courses: [...new Set(choice.routes.flatMap(r => r.present))], source: group.evidence.source, notes };
  });
  return { groups, completed: groups.reduce((n, g) => n + g.completed, 0), planned: groups.reduce((n, g) => n + g.planned, 0), remaining: groups.reduce((n, g) => n + g.remaining, 0), needsReview: [...rules.reviewNotes, ...groups.filter(g => g.status === 'needsReview').flatMap(g => g.notes)], source: rules.source };
}

export function requirementContribution(catalog: Catalog, prefs: Preferences, pins: CourseBundle[], candidate: CourseBundle): boolean {
  const rules = majors.find(m => m.name === prefs.major);
  if (!rules || rules.evidence.verification !== 'verified' || getSectionEligibility(catalog, prefs, candidate, pins).status === 'ineligible') return false;
  const candidateIds = equivalentCourseIds(candidate.course_id);
  if (!rules.groups.some(group => group.evidence.verification === 'verified' && candidateIds.some(id =>
    group.options.some(option => option.map(canonicalCourseId).includes(id)) ||
    group.courseRanges?.some(range => subject(id) === range.subject && number(id) >= range.min && number(id) <= range.max && !range.exclude?.includes(number(id)))
  ))) return false;
  const existing = plannedCourseIds(catalog, prefs, pins);
  const id = creditIdentity(candidate.course_id);
  if ([...prefs.completedCourseIds, ...existing].map(creditIdentity).includes(id)) return false;
  const completed = new Set(prefs.completedCourseIds.flatMap(equivalentCourseIds));
  const verifiedRules = { ...rules, groups: rules.groups.filter(group => !group.sequence || (group.priorCompletedCourseIds && group.priorCompletedCourseIds.every(course => completed.has(canonicalCourseId(course))))) };
  const before = allocate(verifiedRules, prefs.completedCourseIds, existing);
  const after = allocate(verifiedRules, prefs.completedCourseIds, [...existing, candidate.course_id]);
  return after.potential > before.potential + 1e-9;
}
