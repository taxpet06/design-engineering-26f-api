# Third Course frontend

React/TypeScript planner for Dartmouth Class of 2030. Official offerings are bundled snapshots; there are no browser calls to Dartmouth and no registration actions.

From this directory:

```powershell
npm install
npm run dev
npm run typecheck
npm test
npm run build
npm run test:browser
node --test scripts/refresh-catalog.test.mjs
```

From the repository root, `npm test` runs the unchanged Express smoke tests. Root `vercel.json`, the API entrypoint, and backend files are preserved.

Refresh official offerings from the repository root:

```powershell
node frontend/scripts/refresh-catalog.mjs
node frontend/scripts/refresh-catalog.mjs --offline
```

See [import acquisition and validation](scripts/README.md) and [curriculum evidence](../docs/curriculum.md). Published Fall 2026 is the initial planning term. Spring and Summer 2026 are labeled historical references; their registration restrictions reflect retrieval, not what was open at original registration.

## Evidence and limitations

Real-data browser screenshots are in `../.impeccable/third-course-verification/`; traces are in `test-results/`, with an HTML report in `playwright-report/`. Tests use the production preview on port 4173. A separate test-only fixture on port 4174 is conspicuously labeled and is never imported by the production entrypoint.

The real Fall 2026 WRIT 2 section 01 / COSC 1 section 01 flow supports choosing, replacing, and reloading a third course. Unresolved permissions, times, and source details remain advisory, with their evidence in course details. Confirmed conflicts, prerequisites, duplicate credit, wrong terms, and explicitly missing required components still block selections. A saved plan does not establish registration permission.

Suggestions show six courses at a time and default to confirmed academic requirements the student satisfies. An explicit option includes courses with unconfirmed prerequisites after confirmed matches. Registration and meeting-time uncertainty remain advisory. Eight optional interest presets award 40 points once for any matching subject. The planner's major selector immediately updates ranking and potential progress without clearing courses. Detailed requirement notes are collapsed under Requirement details.

Requirement tracking is course-based support. Grades, placement, transfer credit, residency, repeated-term sequence, senior timing, and advisor permissions remain unresolved when the profile lacks evidence. Selectable planned courses count as potential coverage; completed credit stays separate. Catalog/department discrepancies and approval caveats are available under Requirement details.

Local storage key third-course:official:v3 migrates official v2 department interests to stable preset IDs while preserving official selections and completed courses. The older synthetic v1 migration still resets sample completions and selections. Interests are optional. Missing official bundle IDs remain visible for correction. No accounts or API keys are used.

Stop at preview approval before any commit, push to BND, or deployment.
