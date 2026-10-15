import { useEffect, useMemo, useState } from 'react';
import { catalog as officialCatalog } from './data/catalog';
import { Profile } from './components/Profile';
import { Planner } from './components/Planner';
import { getSectionEligibility, recommendThirdCourses, validatePinnedSections } from './lib/recommendations';
import { reasonText } from './components/displayText';
import { initialState, loadState, persistState } from './storage';
import type { Catalog, Eligibility, Plan, Preferences, CourseBundle } from './types';
import styles from './App.module.css';

export default function App({ catalog = officialCatalog }: { catalog?: Catalog } = {}) {
  const [loaded] = useState(() => loadState(catalog));
  const [state, setState] = useState(loaded.state);
  const [view, setView] = useState<'profile' | 'planner'>(loaded.state.saved ? 'planner' : 'profile');
  const [notice, setNotice] = useState('');
  const [storageWarning, setStorageWarning] = useState(loaded.warning);
  const [replacing, setReplacing] = useState(false);
  const [includeUnconfirmed, setIncludeUnconfirmed] = useState(false);
  const [profileGeneration, setProfileGeneration] = useState(0);
  const { preferences, plan } = state;
  useEffect(() => { if (!persistState(state)) setStorageWarning('Browser storage is unavailable. You can still plan during this session.'); }, [state]);
  useEffect(() => { document.querySelector<HTMLElement>('main')?.focus(); }, [view]);
  const selected = useMemo(() => plan.map(id => catalog.bundles.find(s => s.id === id)), [catalog, plan]);
  const pins = useMemo(() => selected.slice(0, 2).filter((s): s is CourseBundle => Boolean(s)), [selected]);
  const validation = useMemo<Eligibility>(() => {
    const results = selected.flatMap((bundle, index) => bundle ? [getSectionEligibility(catalog, preferences, bundle, selected.filter((s, i): s is CourseBundle => Boolean(s) && i !== index))] : []);
    const missing = plan.filter(id => id !== null && !catalog.bundles.some(b => b.id === id));
    const reasons = [...results.flatMap(r => r.reasons), ...missing.map(id => ({code:'missing-bundle',message:"Saved bundle " + id + " is no longer in this snapshot. Remove or replace this selection."}))];
    if (reasons.length) return { status: missing.length || results.some(r => r.status === 'ineligible') ? 'ineligible' : 'needsReview', reasons: [...new Map(reasons.map(r => [r.code + r.message, r])).values()] };
    return { status: pins.length === 2 ? 'eligible' : 'ineligible', reasons: [] };
  }, [catalog, plan, selected, pins, preferences]);
  const third = selected[2];
  const recommendations = useMemo(() => recommendThirdCourses(catalog, preferences, pins, third ? [third.course_id] : [], { includeUnconfirmedPrerequisites: includeUnconfirmed }), [catalog, preferences, pins, third, includeUnconfirmed]);
  if (!catalog.courses.length || !catalog.terms.length || !catalog.bundles.length) return <main className={styles.missing}><h1>The official catalog is unavailable</h1><p>Reload the page to try again.</p><button onClick={() => location.reload()}>Reload catalog</button></main>;
  function savePreferences(next: Preferences) {
    setState(current => ({ ...current, saved: true, preferences: next, plan: current.preferences.term === next.term ? current.plan : [null, null, null] }));
    setNotice(next.term !== preferences.term ? 'Term changed. Choose two courses for your new term.' : 'Preferences saved. Your selections have been checked again.');
    setReplacing(false); setIncludeUnconfirmed(false); setView('planner');
  }
  function select(slot: number, bundle: CourseBundle): boolean {
    const others = selected.filter((s, i): s is CourseBundle => Boolean(s) && i !== slot && (slot === 2 || i < 2));
    const eligibility = getSectionEligibility(catalog, preferences, bundle, others, slot < 2);
    if (eligibility.status === 'ineligible') { setNotice(reasonText(eligibility.reasons)); return false; }
    if (slot === 2 && (validatePinnedSections(catalog, preferences, pins, true).status === 'ineligible' || pins.some((pin, index) => getSectionEligibility(catalog, preferences, pin, [...pins.filter((_, other) => other !== index), bundle]).status === 'ineligible'))) { setNotice('Choose a third course that satisfies the selected courses’ concurrent requirements, or change the affected selection.'); return false; }
    const next: Plan = [...plan]; next[slot] = bundle.id;
    setState(current => ({ ...current, plan: next }));
    setNotice(slot === 2 ? '' : `${catalog.courses.find(c => c.id === bundle.course_id)?.code} added to your plan.`);
    setReplacing(false); return true;
  }
  function reset() { setIncludeUnconfirmed(false); setState(initialState(catalog)); setView('profile'); setProfileGeneration(n => n + 1); setReplacing(false); setNotice('Your local profile and plan have been reset.'); setStorageWarning(''); }
  return <div>
    <a className={styles.skip} href="#workspace">Skip to planner</a>
    <header className={styles.header}><div className={styles.headerInner}>
      <a className={styles.brand} href="#workspace" aria-label="Third Course home"><svg width="29" height="29" viewBox="0 0 29 29" aria-hidden="true"><rect x="1" y="2" width="7" height="25" rx="2" fill="#00693E"/><rect x="11" y="2" width="7" height="25" rx="2" fill="#00693E"/><rect x="21" y="2" width="7" height="25" rx="2" fill="none" stroke="#00693E" strokeWidth="2"/></svg>Third Course</a>
      <nav aria-label="Planner navigation">{state.saved && <button onClick={() => setView(view === 'profile' ? 'planner' : 'profile')}>{view === 'profile' ? 'Back to plan' : 'Preferences'}</button>}<button onClick={reset}>Reset plan</button></nav>
    </div></header>
    <div className={styles.prototype}>Class of 2030 · 2026–27 catalog · Official published offerings, retrieved {catalog.exported_at.slice(0,10)}</div>
    <main id="workspace" tabIndex={-1} className={styles.main}>
      {storageWarning && <p role="status" className={styles.warning}>{storageWarning}</p>}
      {view === 'profile' ? <>{notice && <p className={styles.status} role="status">{notice}</p>}<Profile key={profileGeneration} catalog={catalog} preferences={preferences} onSave={savePreferences} onCancel={state.saved ? () => setView('planner') : undefined}/></> : <Planner catalog={catalog} preferences={preferences} plan={plan} recommendations={recommendations} includeUnconfirmed={includeUnconfirmed} onIncludeUnconfirmedChange={setIncludeUnconfirmed} validation={validation} notice={notice} replacing={replacing} onSelect={select} onRemove={slot => { const next: Plan = [...plan]; next[slot] = null; setState(current => ({...current,plan:next})); setReplacing(false); setNotice('Course removed. Your preferences are saved.'); }} onEditProfile={() => setView('profile')} onMajorChange={major => setState(current => ({...current,preferences:{...current.preferences,major}}))} onTermChange={term => { setIncludeUnconfirmed(false); setState(current => ({...current,preferences:{...current.preferences,term},plan:[null,null,null]})); setReplacing(false); setNotice('Term changed. Choose two courses for your new term.'); }} onReplaceThird={() => {setReplacing(true);setNotice('Compare another third course. Your current plan stays saved until you choose one.');}} onCancelReplace={() => {setReplacing(false);setNotice('Your current third course is still selected.');}} />}
    </main>
    <footer className={styles.footer}><span>A little room for your next interest.</span><span><a href={catalog.source} target="_blank" rel="noreferrer">Official course source</a> · Snapshot, not live registration</span></footer>
  </div>;
}
