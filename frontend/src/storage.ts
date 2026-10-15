import type { Catalog, Plan, Preferences } from './types';
import { interestPresets, migrateInterests } from './data/interests';
import { majors } from './data/requirements';
import { completionCourses } from './data/completion-courses';
export const STORAGE_KEY = 'third-course:official:v3';
export const PREVIOUS_KEY = 'third-course:official:v2';
export const LEGACY_KEY = 'third-course:v1';
export interface SavedState { version: 3; preferences: Preferences; plan: Plan; saved: boolean }
export function initialState(catalog: Catalog): SavedState {
  return { version: 3, preferences: { major: 'Undeclared', interests: [], completedCourseIds: [], term: catalog.terms.find(t => t.is_current)?.code ?? catalog.terms[0]?.code ?? '', timePreference: 'none' }, plan: [null, null, null], saved: false };
}
export function loadState(catalog: Catalog): { state: SavedState; warning: string } {
  const fallback = initialState(catalog);
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    const previous = current === null ? localStorage.getItem(PREVIOUS_KEY) : null;
    const legacy = current === null && previous === null ? localStorage.getItem(LEGACY_KEY) : null;
    const raw = current ?? previous ?? legacy;
    if (!raw) return { state: fallback, warning: '' };
    try {
      const parsed = JSON.parse(raw);
      const p = parsed?.preferences;
      const migrating = current === null && previous === null && parsed?.version === 1;
      const migratingInterests = current === null && parsed?.version === 2;
      if ((!migrating && !migratingInterests && parsed?.version !== 3) || !p || !Array.isArray(p.interests) || !Array.isArray(p.completedCourseIds) || !Array.isArray(parsed.plan) || parsed.plan.length !== 3) throw new Error('Invalid state');
      const presetIds = new Set(interestPresets.map(p => p.id));
      const courses = new Set(completionCourses(catalog).map(c => c.id));
      const bundles = new Set(catalog.bundles.map(b => b.id));
      const validTerm = catalog.terms.some(t => t.code === p.term);
      const preferences: Preferences = {
        major: majors.some(m => m.name === p.major) ? p.major : 'Undeclared',
        interests: migrating || migratingInterests ? migrateInterests(p.interests, catalog) : [...new Set<string>(p.interests.filter((v: unknown) => typeof v === 'string' && presetIds.has(v)))],
        completedCourseIds: migrating ? [] : [...new Set<string>(p.completedCourseIds.filter((v: unknown) => typeof v === 'string' && courses.has(v)))],
        term: validTerm ? p.term : fallback.preferences.term,
        timePreference: ['none', 'morning', 'afternoon'].includes(p.timePreference) ? p.timePreference : 'none',
      };
      const plan: Plan = migrating || !validTerm ? [null, null, null] : parsed.plan.map((v: unknown) => typeof v === 'string' && v.length > 0 && v.length < 500 ? v : null);
      const state: SavedState = { version: 3, preferences, plan, saved: parsed.saved === true };
      const missingBundles = plan.some(id => id !== null && !bundles.has(id));
      const recovered = missingBundles || JSON.stringify(plan) !== JSON.stringify(parsed.plan) || JSON.stringify(preferences) !== JSON.stringify(p);
      return { state, warning: migrating ? 'Official Dartmouth data is now available. Your recognized preferences were preserved; sample completed courses and selections were reset. Add your real completed courses before planning.' : recovered ? 'Your saved profile was updated for the official snapshot. Please check your selections.' : '' };
    } catch { return { state: fallback, warning: 'Your saved plan could not be read. Start a new profile below.' }; }
  } catch { return { state: fallback, warning: 'Browser storage is unavailable. You can still plan during this session.' }; }
}
export function persistState(state: SavedState): boolean {
  try {
    if (state.saved) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    else localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PREVIOUS_KEY);
    localStorage.removeItem(LEGACY_KEY);
    return true;
  } catch { return false; }
}
