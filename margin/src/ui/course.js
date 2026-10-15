// Course data stays in demo mode; personal work is never replaced by API refresh.
import { h } from './dom.js';
import { openDialog, toast } from './dialog.js';
import { app, applyCourseImport, newCommitmentId } from './app.js';
import { openCommitmentForm } from './forms.js';
import { bundledCourseData, fetchCourseData, buildCourseImport, enrollmentCount, COURSE_SNAPSHOT_DATE } from '../data/courseApi.js';

export function openCourseReport() {
  const c = app.state.meta.course;
  if (!c) { openCourseImport(); return; }
  const content = h('div', { class: 'stack' },
    h('p', null, `${c.studentName} (fictional), ${c.termLabel}. Demo date ${c.asOf}. Source captured ${c.fetchedAt.slice(0, 10)}.`),
    h('h3', null, 'Assumptions and limits'),
    h('ul', { class: 'bullets' }, c.warnings.map((w) => h('li', null, w))),
    h('h3', null, `Needs scheduling details (${c.pending.length})`),
    h('p', { class: 'muted' }, 'These records are not calendar events yet. Add a commitment with the real day, start, end, and location. The source note stays here for reference; adding a commitment does not automatically match or remove it.'),
    c.pending.length ? h('ul', { class: 'plain-list' }, c.pending.map((p) => h('li', { class: 'list-row' }, h('div', null,
      h('strong', null, p.title), h('p', { class: 'muted' }, `${p.date ? p.date + '. ' : ''}${p.location ? p.location + '. ' : ''}${p.detail}`)),
      h('button', { type: 'button', class: 'btn btn-sm', onclick: () => { api.close(); openCommitmentForm({ id: newCommitmentId(), title: p.title, type: p.table === 'job-assignments' ? 'work' : 'personal', startDate: p.date || c.asOf, start: 9 * 60, end: 10 * 60, recurrence: { freq: 'none' }, locationId: null, optional: false, notes: `${p.detail} ${p.location ? 'Source location: ' + p.location + '. ' : ''}Fill in the actual time before saving; 9-10 AM is an editable form default, not a source time.`, exceptions: [], source: { system: 'user', table: p.table, id: p.id } }); } }, 'Add commitment')))) : h('p', null, 'No additional records with missing times.'));
  const api = openDialog({ title: 'Course data details', size: 'md', content,
    actions: [{ label: 'Choose another student', onClick: () => { api.close(); openCourseImport(); } }, { label: 'Close', primary: true, onClick: () => api.close() }] });
}

export function openCourseImport() {
  let data = bundledCourseData();
  let preview = null;
  let busy = false;
  const student = h('select', { 'aria-label': 'Demo student' });
  const term = h('select', { 'aria-label': 'Academic term' });
  const date = h('input', { type: 'date', 'aria-label': 'Course demo date', value: '2026-09-27' });
  const effort = h('input', { type: 'number', min: 5, max: 6000, step: 5, value: 90, 'aria-label': 'Default assignment effort in minutes' });
  const submitted = h('input', { type: 'checkbox', 'aria-label': 'Mark recorded submissions done' });
  const status = h('p', { class: 'muted', role: 'status' }, `Bundled API snapshot, captured ${COURSE_SNAPSHOT_DATE.slice(0, 10)}. Available offline.`);
  const output = h('div', { 'aria-live': 'polite' });
  const refresh = h('button', { type: 'button', class: 'btn', onclick: loadLive }, 'Refresh from live API');
  const makePreview = h('button', { type: 'button', class: 'btn', onclick: showPreview }, 'Preview course import');
  const apply = h('button', { type: 'button', class: 'btn btn-primary', disabled: true, onclick: async () => {
    if (!preview || busy) return;
    const result = preview;
    apply.disabled = true;
    try { await applyCourseImport(result.state); api.close(); openCourseReport(); }
    catch (e) { status.textContent = `Import failed: ${e.message}`; apply.disabled = false; }
  } }, 'Replace demo with course data');
  const label = (text, control, help = '') => h('label', { class: 'field' }, h('span', { class: 'field-label' }, text), control, help ? h('span', { class: 'field-hint' }, help) : null);
  const body = h('div', { class: 'stack' },
    h('p', { class: 'callout callout-warn' }, 'All course records are fictional. Applying replaces only your demo, including its edits and plan. Your personal workspace stays untouched. Undo can restore the previous demo during this session.'),
    status, h('div', { class: 'row gap wrap' }, refresh, h('button', { type: 'button', class: 'btn btn-quiet', onclick: () => { if (busy) return; data = bundledCourseData(); populate(); invalidate(); status.textContent = `Using bundled snapshot from ${data.fetchedAt.slice(0, 10)}.`; } }, 'Use bundled snapshot')),
    label('Academic term', term), label('Demo student', student, 'Only enrolled classes are included. The count helps you choose a populated schedule.'),
    label('Demo date', date, 'Source dates stay unchanged. Choose a date inside the term; the demo clock starts at 8:00 AM.'),
    label('Default assignment effort (minutes)', effort, 'Your estimate, not an API fact. Edit individual tasks after import.'),
    h('label', { class: 'row gap' }, submitted, 'Mark submissions recorded by the demo date as done'),
    h('p', { class: 'muted' }, 'Unchecked: assignments remain open with submission details in their notes. No study time or mastery is inferred.'),
    makePreview, output);
  function invalidate() { preview = null; apply.disabled = true; output.replaceChildren(); }
  function fillStudents() {
    const old = student.value;
    const list = data.records.students.map((s) => ({ s, n: enrollmentCount(data, s.id, term.value) })).sort((a, b) => b.n - a.n || a.s.id - b.s.id);
    student.replaceChildren(...list.map(({ s, n }) => h('option', { value: String(s.id) }, `${s.first_name} ${s.last_name} - ${n} classes - ${s.major}`)));
    if (list.some(({ s }) => String(s.id) === old)) student.value = old;
  }
  function populate() {
    const old = term.value;
    term.replaceChildren(...data.records.terms.map((t) => h('option', { value: t.code }, t.label)));
    term.value = data.records.terms.some((t) => t.code === old) ? old : (data.records.terms.find((t) => t.is_current) || data.records.terms[0]).code;
    fillStudents(); updateDates();
  }
  function updateDates() {
    const t = data.records.terms.find((t) => t.code === term.value);
    date.min = t.start_date; date.max = t.end_date;
    if (date.value < date.min || date.value > date.max) date.value = t.is_current && '2026-09-27' >= date.min && '2026-09-27' <= date.max ? '2026-09-27' : date.min;
  }
  async function loadLive() {
    if (busy) return;
    busy = true; refresh.disabled = true; makePreview.disabled = true; invalidate();
    status.textContent = 'Reading public course records. No Dartmouth Chat API key is used.';
    try { const fresh = await fetchCourseData(); data = fresh; populate(); status.textContent = `Live API records loaded ${fresh.fetchedAt}. Review before applying.`; }
    catch (e) { status.textContent = `Live refresh failed: ${e.message}. The previously selected snapshot is unchanged and can still be previewed. You can use the bundled snapshot offline.`; }
    finally { busy = false; refresh.disabled = false; makePreview.disabled = false; }
  }
  function showPreview() {
    try {
      preview = buildCourseImport(data, { studentId: student.value, termCode: term.value, asOf: date.value, estimateMin: Number(effort.value), markSubmitted: submitted.checked });
      output.replaceChildren(h('section', { class: 'stack callout' },
        h('h3', null, `${preview.student.first_name} ${preview.student.last_name}: ${preview.term.label}`),
        h('p', null, `${preview.state.commitments.filter((c) => c.type === 'class').length} classes, ${preview.state.commitments.filter((c) => c.type === 'club').length} club meetings, ${preview.state.tasks.length} assignments (${preview.state.tasks.filter((t) => t.status === 'done').length} marked done), ${preview.pending.length} records needing scheduling details.`),
        h('ul', { class: 'bullets' }, preview.warnings.map((w) => h('li', null, w))),
        h('p', null, 'No plan is generated automatically. After import, review effort, set places and travel, and select Plan my week.')));
      apply.disabled = false;
    } catch (e) { invalidate(); output.append(h('p', { class: 'field-error' }, e.message)); }
  }
  populate();
  term.addEventListener('change', () => { fillStudents(); updateDates(); invalidate(); });
  for (const control of [student, date, effort, submitted]) { control.addEventListener('input', invalidate); control.addEventListener('change', invalidate); }
  const api = openDialog({ title: 'Import course data', size: 'md', content: body,
    actions: [{ label: 'Cancel', quiet: true, onClick: () => api.close() }, apply] });
}
