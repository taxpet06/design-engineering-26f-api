import { useState, type FormEvent } from 'react';
import type { Catalog, Preferences } from '../types';
import s from './Profile.module.css';
import { displayText } from './displayText';
import { interestPresets } from '../data/interests';
import { majors } from '../data/requirements';
import { completionCourses } from '../data/completion-courses';

export interface ProfileProps { catalog: Catalog; preferences: Preferences; onSave: (preferences: Preferences) => void; onCancel?: () => void }

export function Profile({ catalog, preferences, onSave, onCancel }: ProfileProps) {
  const [draft, setDraft] = useState<Preferences>(() => ({ ...preferences, interests: [...preferences.interests], completedCourseIds: [...preferences.completedCourseIds] }));
  const [search, setSearch] = useState('');
  const courses = completionCourses(catalog);
  const visibleCourses = courses.filter(course => `${course.id} ${course.code} ${displayText(course.title)}`.toLowerCase().includes(search.toLowerCase()));
  function submit(event: FormEvent) {
    event.preventDefault();
    onSave(draft);
  }
  function toggleInterest(name: string) {
    setDraft(current => ({ ...current, interests: current.interests.includes(name) ? current.interests.filter(item => item !== name) : [...current.interests, name] }));
  }
  function toggleCourse(id: string) { setDraft(current => ({ ...current, completedCourseIds: current.completedCourseIds.includes(id) ? current.completedCourseIds.filter(item => item !== id) : [...current.completedCourseIds, id] })); }
  return <div className={s.layout}>
    <div className={s.intro}>
      <h1>Two courses chosen.<br /><span>One good fit to find.</span></h1>
      <p>Tell us what you enjoy and what you’ve already studied. We’ll help you find a third course that fits your interests and your week.</p>
      <div className={s.process}><div><b>1</b><span>Make it yours</span></div><div><b>2</b><span>Choose your first two</span></div><div><b>3</b><span>Find your third course</span></div></div>
      <p className={s.privacy}>For Class of 2030 · 2026–27 catalog. Your preferences stay in this browser. You can edit or reset them at any time.</p>
    </div>
    <form className={s.form} onSubmit={submit}>
      <h2>{onCancel ? 'Edit your preferences' : 'Start with your preferences'}</h2>
      <div className={s.row}><label className={s.field}>Major<select value={draft.major} onChange={event => setDraft({ ...draft, major: event.target.value })}><option value="Undeclared">Undeclared</option>{majors.map(major => <option key={major.name} value={major.name}>{major.name}</option>)}</select></label>
      <label className={s.field}>Term<select value={draft.term} onChange={event => setDraft({ ...draft, term: event.target.value })}>{catalog.terms.map(term => <option key={term.id} value={term.code}>{term.code} · {term.label}{term.historical ? ' · Historical reference' : ''}</option>)}</select></label></div>
      <fieldset className={s.subjects}><legend>Interests <span>Optional</span></legend><div className={s.chips} aria-label="Subjects">{interestPresets.map(department => <label key={department.id} className={`${s.chip} ${draft.interests.includes(department.id) ? s.selected : ''}`}><input type="checkbox" checked={draft.interests.includes(department.id)} onChange={() => toggleInterest(department.id)} /><span>{department.label}</span></label>)}</div></fieldset>
      <fieldset className={s.completed}><legend>Completed courses <span>Completed before the planning term · prerequisites use these courses</span></legend><label className={s.field}><span className={s.visuallyHidden}>Search completed courses</span><input type="search" placeholder="Search by course code or title" value={search} onChange={event => setSearch(event.target.value)} /></label>
        {draft.completedCourseIds.length > 0 && <div className={s.selectedCourses} aria-label="Selected completed courses">{courses.filter(course => draft.completedCourseIds.includes(course.id)).map(course => <button key={course.id} type="button" onClick={() => toggleCourse(course.id)} aria-label={`Remove completed ${course.code}`}>{course.code}<span aria-hidden="true">×</span></button>)}</div>}
        <div className={s.courseList}>{visibleCourses.length ? visibleCourses.map(course => <label key={course.id} className={s.course}><input type="checkbox" checked={draft.completedCourseIds.includes(course.id)} onChange={() => toggleCourse(course.id)} /><span><strong>{course.code}</strong> {displayText(course.title)}</span></label>) : <p className={s.empty}>No courses match “{search}”. Try a course code.</p>}</div>
      </fieldset>
      <label className={s.field}>Preferred class time<select value={draft.timePreference} onChange={event => setDraft({ ...draft, timePreference: event.target.value as Preferences['timePreference'] })}><option value="none">No preference</option><option value="morning">Morning · starts before noon</option><option value="afternoon">Afternoon · starts at noon or later</option></select></label>
      <div className={s.actions}>{onCancel && <button className={s.secondary} type="button" onClick={onCancel}>Cancel</button>}<button className={s.primary} type="submit">{onCancel ? 'Save preferences' : 'Continue to planner'}<span aria-hidden="true">→</span></button></div>
    </form>
  </div>;
}
