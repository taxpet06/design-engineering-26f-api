import { useEffect, useRef } from 'react';
import type { Catalog, Preferences, CourseBundle, CourseRule, Evidence } from '../types';
import { getSectionEligibility, validMeeting } from '../lib/recommendations';
import { bundleText, displayText, groupMeetings, meetingText, ruleText } from './displayText';
import s from './Planner.module.css';
export function CourseDetails({ catalog, preferences, section, otherSections, onClose }: { catalog: Catalog; preferences: Preferences; section: CourseBundle; otherSections: CourseBundle[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const course = catalog.courses.find(c => c.id === section.course_id)!;
  const components = section.componentIds.map(id => catalog.sections.find(c => c.id === id)).filter(c => c !== undefined);
  const eligibility = getSectionEligibility(catalog, preferences, section, otherSections);
  const prerequisiteSource = course.prerequisiteCoverage?.source ?? course.prerequisite.evidence.source;
  const prerequisiteText = course.prerequisiteCoverage?.sourceText || course.prerequisite.evidence.sourceText;
  const supportingEvidence = new Map<string, Evidence>();
  function collectEvidence(rule: CourseRule) {
    if (rule.evidence.source !== prerequisiteSource) supportingEvidence.set(rule.evidence.source, rule.evidence);
    if (rule.kind === 'all' || rule.kind === 'any') rule.rules.forEach(collectEvidence);
  }
  collectEvidence(course.prerequisite);
  if (course.prerequisiteIdentityEvidence) supportingEvidence.set(course.prerequisiteIdentityEvidence.source, course.prerequisiteIdentityEvidence);
  const alternatives = catalog.bundles.filter(b => b.course_id === section.course_id && b.term === section.term && b.id !== section.id);
  useEffect(() => {
    const target = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    target?.showModal(); document.body.style.overflow = 'hidden';
    return () => { target?.close(); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={dialog} className={s.dialog} aria-labelledby="course-detail-title" onCancel={event => {event.preventDefault();onClose();}} onClick={event => {if(event.target === dialog.current) onClose();}}><div className={s.dialogContent}>
    <div className={s.dialogTop}><span className={s.courseCode}>{course.code}</span><button className={s.secondary} onClick={onClose}>Close</button></div><h2 id="course-detail-title">{displayText(course.title)}</h2><p className={s.description}>{displayText(course.description) || 'The published snapshot does not include a description.'}</p>
    <dl className={s.facts}><div><dt>Term</dt><dd>{section.term}{catalog.terms.find(t => t.code === section.term)?.historical ? ' · Historical reference' : ''}</dd></div><div><dt>Credits</dt><dd>{course.credits}</dd></div><div><dt>Eligibility</dt><dd>{eligibility.status === 'eligible' ? 'Verified eligible' : eligibility.status === 'needsReview' ? 'Needs review' : 'Ineligible for this plan'}</dd></div><div><dt>Source retrieved</dt><dd>{catalog.exported_at.slice(0,10)}</dd></div></dl>
    <section className={s.detailRules}><h3>Required components and meetings</h3>{components.map(component => <div key={component.id}><h4>{component.component} · Section {component.section_number} · CRN {component.crn}</h4><p>{component.instructor || 'Instructor not listed'}</p>{component.meetings.length > 0 && component.meetings.every(validMeeting) ? <ul>{groupMeetings(component.meetings).map((m,i) => <li key={i}>{meetingText(m)}<span>{m.startDate} through {m.endDate}{m.room ? ` · ${m.room}` : ''}</span></li>)}</ul> : <p>Times unconfirmed</p>}<a href={component.source} target="_blank" rel="noreferrer">Check course details</a></div>)}<p className={s.small}>All published required meetings reserve time, including X-hours. Back-to-back meetings are allowed.</p></section>
    <section className={s.detailRules}><h3>Prerequisites</h3><p>{ruleText(course.prerequisite)}</p>{course.prerequisiteCoverage && <p className={s.small}>{course.prerequisiteCoverage.status === 'verified' ? 'Published prerequisite rule verified' : 'Prerequisites unconfirmed'} · {course.prerequisiteCoverage.catalogEdition} · Checked {course.prerequisiteCoverage.retrievedAt.slice(0,10)}<br />{course.prerequisiteCoverage.reason}</p>}{prerequisiteText && <details className={s.provenance}><summary>Published prerequisite text</summary><p>{prerequisiteText}</p></details>}<a href={prerequisiteSource} target="_blank" rel="noreferrer">Prerequisite source</a>{supportingEvidence.size > 0 && <details className={s.provenance}><summary>Additional prerequisite sources</summary>{[...supportingEvidence.values()].map(item => <p key={item.source}>{item.sourceText || item.note} <a href={item.source} target="_blank" rel="noreferrer">Official rule source</a></p>)}</details>}{course.corequisite && <><h3>Corequisites</h3><p>{ruleText(course.corequisite)}</p></>}{Boolean(course.recommendedPreparation?.length) && <><h3>Recommended preparation</h3><p className={s.small}>Suggested preparation does not block selection.</p><ul>{course.recommendedPreparation!.map((item, i) => <li key={i}>{item.text} <a href={item.evidence.source} target="_blank" rel="noreferrer">Preparation source</a></li>)}</ul></>}<p className={s.small}>Only completed courses satisfy prerequisites. Concurrent enrollment counts for a corequisite only when the published rule permits it.</p></section>
    {[true, false].map(blocking => {
      const reasons = eligibility.reasons.filter(r => Boolean(r.blocking) === blocking);
      return reasons.length > 0 && <div key={String(blocking)} className={blocking ? s.constraint : s.advisory}><strong>{blocking ? 'This bundle needs a change.' : 'Some course details need confirmation.'}</strong><ul>{reasons.map((r,i) => <li key={i}>{r.message}{r.source && <> <a href={r.source} target="_blank" rel="noreferrer">Official source</a></>}</li>)}</ul></div>;
    })}
    {alternatives.length > 0 && <details className={s.provenance}><summary>{alternatives.length} other published bundles</summary>{alternatives.map(b => <p key={b.id}>{b.componentIds.join(', ')} · {bundleText(b)} · {getSectionEligibility(catalog,preferences,b,otherSections).status}</p>)}</details>}
    <p className={s.small}><a href={course.source} target="_blank" rel="noreferrer">Official course source</a> · Snapshot planning support. Check registration restrictions and remaining approvals with Dartmouth.</p>
  </div></dialog>;
}
