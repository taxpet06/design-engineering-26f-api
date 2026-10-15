# Course API integration

Implemented in `src/data/courseApi.js`; UI in `src/ui/course.js`.

Repository: https://github.com/taxpet06/design-engineering-26f-api (master).
Public API: https://api-backend-zeta-five.vercel.app

The live source was fetched and its array responses verified during this integration. `fixtures/course-snapshot.json` contains that capture; `src/data/courseSnapshot.js` bundles the same records for offline use. Capture time is retained in the snapshot and import report. No Dartmouth Chat credentials are used.

## Mapping

- `students` and `terms`: selector choices. The chosen term supplies recurrence boundaries.
- `enrollments`: include only `enrolled` sections; waitlists do not become fixed commitments.
- `sections` + `courses`: weekly class commitments using days, time, room, course code and title. Historical completed enrollments are not imported as current classes.
- `assignments`: selected sections only, exact source due_date, null deadline time. The user's date-only cutoff applies. Possible points are notes, not priority or time estimates.
- `submissions`: source details in notes. Only records dated on/before demo date are considered; user explicitly opts into marking these done. No study-time logs or mastery are fabricated.
- `club-memberships` + `clubs`: recurring optional club meetings; location unknown. Membership term boundaries are unavailable, so the selected term is explicitly assumed.
- `job-assignments` + `campus-jobs`: missing-details checklist, since weekly hours are not shifts.
- `study-group-members` + `study-groups`: checklist, because meeting_time lacks a weekday.
- `event-rsvps` + `events`: going/maybe only, checklist because no start/end time.
- `workshop-registrations` + `workshops`: registered only, checklist because no start/end time.

All imports retain `{ system: 'course-api', table, id }`. Missing/invalid meeting data is reported instead of guessed. All source dates remain unchanged.

## Isolation and refresh

Import is a previewed, atomic replacement of DEMO only. It never merges fictional records into personal data. The previous demo is available through session Undo. Reimport does not duplicate records; personal edits in the demo are intentionally discarded only when replacement is approved. This simpler policy avoids destructive source reconciliation. Export first for a durable backup.

Live reads have a timeout and limited concurrency, use GET and `credentials: omit`, and reject HTTP failures or unexpected non-array shapes. A failed refresh does not silently masquerade as fresh data: the old snapshot remains selected and the error is shown. The bundled snapshot can be chosen explicitly.

The snapshot is small enough to ship in the standalone HTML. Neither refresh nor import writes to the teaching server. No student record represents a real person.

## Extending

`createApiAdapter()` exposes `fetch` and `normalize` methods. It intentionally does not pretend that the course source implements the invented mock-record schema. Consumers use `buildCourseImport` to produce the engine's validated entities. More API endpoints can be added without changing the scheduling engine.

Use recorded fixtures in tests, never live requests, for repeatable scheduling validation. Keep the raw snapshot and bundled JS synchronized if deliberately recapturing data.
