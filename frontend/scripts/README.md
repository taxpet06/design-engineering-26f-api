# Official Dartmouth catalog snapshots

Run from the repository root with Node 18+:

```powershell
node frontend/scripts/refresh-catalog.mjs
node --test frontend/scripts/refresh-catalog.test.mjs
```

Rebuild deterministically from retained evidence without network access:

```powershell
node frontend/scripts/refresh-catalog.mjs --offline
```

The importer calls the public Courses@Dartmouth FOSE API outside the browser. It checks each requested term is actually published on the source home page, searches with the official `session=U` (UG Arts & Sciences School) filter across all subjects, checks returned count against the full result set, then fetches every section detail. Terms are fixed: Fall 2026 (`202609`, planning), Summer 2026 (`202606`, historical), Spring 2026 (`202603`, historical). It never creates future offerings. Thayer graduate-session offerings are outside this undergraduate inventory.

`../src/data/snapshot.json` records retrieval time, source URL, terms, and coverage. Compressed search/detail evidence is retained in `raw/`, with `provenance.json`. Search responses already omit hidden administrative ZZ sections; detail `allInGroup` contains some hidden rows, which are never merged into the public inventory. The importer also rejects hidden/canceled search records. Current coverage: 1,013 Fall sections / 61 subjects, 320 Summer / 53 subjects, 1,040 Spring / 60 subjects. Zero returned public search rows were excluded; hidden rows present only in detail inventories are outside `sourceCount`.

Validation checks counts, unique term/CRN identities, source URLs/retrieval dates, all effective dates, course references, component references and bundle identities. A greater than 20% term count decrease blocks replacement for investigation. Acquisition and validation finish before writing. The validated snapshot is written to a sibling `.pending` file then renamed. Acquisition/parsing/validation errors preserve the last good snapshot. Keep compressed evidence in version control alongside the snapshot.

`companionChoices` reads explicit `linked_crns` identities and official `required_sections` explanations: "one of" creates alternatives; "the following" requires all. Linked identities must match the actual required-section links and public inventory. Lecture bundles carry required labs/discussions with sorted component identities, and companion back-links must agree. Blank fields never establish absent components: unverified absence remains Needs review. Arranged/absent meeting times also remain unresolved.

All source meeting intervals/effective dates are preserved, including lab sub-intervals and published X-hours. Exact X-hour matches are labeled using the [Registrar schedule](https://registrar.dartmouth.edu/sites/registrar/files/2025-07/class_schedule.pdf). Every interval remains reserved even if its block cannot be labeled. Source text is converted to plain text and never injected as HTML. Explicit cross-listings from source `xlist` links are stored with term and section scope; these prevent duplicate simultaneous selections and do not assert unrestricted equivalent credit.

`prerequisites.json` contains a coverage entry for every offering-course identity. The parallel research shards and original source text, URLs, catalog editions, retrieval dates, and compressed source responses live in `prerequisite-research/`. `coverage-report.json` reports verified, unresolved, unmatched, and failed-source counts separately. Verified means the published academic expression was represented; it does not certify registration permission or the student's eligibility. Missing fields, unrecognized identities, and ambiguous statements never imply no prerequisites.

Merge disjoint research shards, then rebuild only from preserved offering evidence:

```powershell
node frontend/scripts/merge-prerequisites.mjs
node frontend/scripts/refresh-catalog.mjs --offline
node --test frontend/scripts/refresh-catalog.test.mjs frontend/scripts/merge-prerequisites.test.mjs
```

Mandatory coursework uses course, all-of, and any-of rules. A `waiver` is a published prerequisite exception whose approval has not been confirmed: coursework OR waiver stays blocked when the coursework is unmet. Ordinary registration permission and genuinely unresolved academic requirements remain advisory. Recommended preparation is stored separately and never blocks selection. Explicit prior/concurrent enrollment is represented as a corequisite; planned courses never satisfy ordinary prerequisites. A `concurrentOnly` course must be selected in the same term and cannot be satisfied by previously completed credit. Incomplete pins may await a corequisite, but a suggested third course must satisfy the requirements of the full plan. Unsupported range/count and placement conditions retain source-backed review explanations. Confirmed credit mappings and renumbering remain in `../src/data/equivalences.ts`; `prerequisite-equivalences.json` adds only the 53 explicit EARS/EAPS old/new pairs from the official September 2026 crosswalk. Newly referenced verified course identities are also available in completed-course history without inventing offerings.

The offline rebuild preserves sections, bundles, meetings, terms, and source retrieval dates. `preservation-baseline.json` records their hashes and the unchanged backend hashes. Existing saved selections are retained even when newly verified rules make them invalid; the planner explains the correction.

The retrieved official `special_approval` field says `Instructor Permission Needed` for 968 Fall, 301 Summer and 1,002 Spring sections. This is a dated section-level registration condition, never a permanent academic prerequisite. It remains Needs review because this app has no permission evidence. The official UI conditionally renders this field as "Permission Required". Fall's only non-IP primary offerings are GERM 44.06 and JWST 34.03 immersion courses; their prerequisites/components remain unresolved. Actual-data tests verify advisory selection, verified prerequisite exclusions, and desktop/mobile add–replace–reload flows. Engine tests also use clearly labeled fixtures.

The browser loads bundled data only. Refresh does not alter Express/root hosting, enroll students, or contact instructors.

Section source links follow the public site's own deep-link generator: `?details&srcdb=202609&crn=91925`. The bare `details` flag is parsed as true and triggers `restoreDeepLink`; without it, the site restores search criteria instead of opening section detail. Verified against the official `fose.js` generator and URL parser on 2026-10-15.
