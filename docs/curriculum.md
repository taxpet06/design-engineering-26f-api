# Curriculum evidence and independent profile checks

Edition: 2026–27. Cohort: Class of 2030. Retrieval: 2026-10-15. Rules version: 2026-27.1; identity mapping version: 2026-27.2.

The live ORC navigation identifies **Organization of Dartmouth College 2026-27**; the CS page also explicitly labels its 2026–27 numbering transition. The attempted immutable `/en/2026-2027/orc/` route was unavailable. Source links intentionally identify the retrieved live edition; refresh requires rechecking that edition, not assuming `/current/` remains 2026–27.

Sources:
- [CS ORC](https://dartmouth.smartcatalogiq.com/en/current/orc/departments-programs-undergraduate/computer-science)
- [Engineering ORC](https://dartmouth.smartcatalogiq.com/en/current/orc/departments-programs-undergraduate/engineering-sciences)
- [Fall-2026 engineering department rules](https://engineering.dartmouth.edu/undergraduate/ab/majors/engineering-sciences)
- [Fall-2026 biomedical rules](https://engineering.dartmouth.edu/undergraduate/ab/majors/biomedical-engineering)
- [Fall-2026 engineering physics rules](https://engineering.dartmouth.edu/undergraduate/ab/majors/engineering-physics)
- [Physics ORC](https://dartmouth.smartcatalogiq.com/en/current/orc/departments-programs-undergraduate/physics-and-astronomy)

## Evidence decisions

The ORC controls the matriculation-year curriculum. Department pages supplement gateway discipline grouping, detailed elective lists, and the approved culminating-course list. They explicitly label their effective date fall 2026. There is no silently inferred Class-of-2030 exception. Differences are recorded as review conditions: engineering elective lower boundary (20 versus above 20); biomedical ENGS 30 gateway and ENGS 23 elective; engineering physics PHYS 90/91 and ENGS 80. Disputed cases receive no automatic credit/bonus. Future changes require explicit source evidence and a rule version increment.

CS renumbering is credit identity, unlike the directional ENGS 20 prerequisite substitution. Listing both old and new CS numbers never earns two credits. CS research culminating paths require repeated enrollments in consecutive terms and cannot be established by the present set-of-course-IDs profile. Advanced topics can provide course-based coverage but ordering remains unresolved. This is not degree certification.

## Profiles checked against the sources before executable tests

1. **Computer Science:** COSC 1, MATH 8, COSC 10/30/31/50/15/70 establish two entry units and six core units. Four additional electives (COSC 32, 51, 74, 81) fill four elective units. Two distinct advanced topics (49.01 and 69.01) supply two additional culminating course units; they may not be reused among the four electives. Advisor approval and historical sequencing remain unresolved. COSC 11 plus COSC 30 is one core identity.
2. **Engineering Sciences:** ENGS 31 plus 32 is one gateway discipline, not two. ENGS 31 plus 33 fills two. ENGS 24 consumed in the distributive core cannot simultaneously fill an exclusive elective. ENGS 58 may satisfy both a free elective and the explicitly overlapping culminating requirement. COSC 1 alone does not finish the programming prerequisite; COSC 1 plus COSC 10 does.
3. **Biomedical Engineering Sciences:** CHEM 5 alone does not finish its entry chemistry pathway; adding CHEM 6 does. CHEM 11 is the alternative. CHEM 51 plus CHEM 58 is not an organic sequence; 51+52 or 57+58 is. One ENGS 23 cannot fill the distributive, additional engineering, and elective slots simultaneously. ENGS 23 plus 56 fills two separate core units.
4. **Engineering Physics:** Core ENGS 22/23/24 and PHYS 19/40/43 are six separate core courses. Electives ENGS 25/58 and PHYS 50/72 preserve 2+2 and cover two restricted groups. Three ENGS electives and one PHYS elective cannot fill all four. ENGS 25 and ENGS 33 together cover only one restricted group. A culminating course may overlap the elective set. PHYS 15/16 placement and the PHYS 19 replacement require separate evidence.
5. **Marginal progress:** once an either/or group is filled, its unused alternative earns no bonus unless it independently fits another unfinished group. Existing plan bundles participate in the same exclusive allocation as completed courses. A second section of the same course or a renumbered duplicate never adds progress. An incomplete required pair can increase potential progress while its pathway stays remaining in the displayed count.

## Data and evaluator contract

Each `options` entry is an all-of pathway; `count` is the number of distinct pathways required. Thus a six-course core has six singleton options/count six, while chemistry has two alternative two-course options/count one. Counts are requirement units, not graduation credits. Partial pathways appear in course detail and affect marginal potential, but are not shown as complete or planned pathways. `courseRanges` expands only supplied course identities, never infers offerings. Exact course numbers preserve decimal topics.

Exclusive groups share one course allocation. Nonexclusive culminating groups explicitly permit the documented overlap. Bucket constraints enforce different disciplines; subject quotas enforce engineering physics's even split. Search maximizes completed pathways first, then combined coverage, then partial pathway progress, with stable lexical ties. Rules marked needsReview are visible but do not produce automatic progress or requirement bonuses.

The profile cannot establish grades, NRO choices, transfer status, residency, advisor approval, project deliverables, or past term sequence. Review notes persist even when every supported course unit is covered.

## Review regressions

Verified ORC cross-listings (including PHYS 48/ENGS 32 and PHYS 30/ENGS 30) share a credit identity. Alias expansion retains either subject allocation for engineering physics; the single credit cannot fill two slots. Additional explicit engineering/CS cross-listings are sourced individually in equivalences.ts. Directional substitutions do not merge credit identities.

A CS culminating recommendation earns requirement points only after all six cores are in the completed-before-planning-term profile. Planned cores do not establish prerequisite sequence. Other unresolved culminating timing/approval conditions do not award a culminating bonus; the same course can still contribute to an independently verified elective. Potential coverage remains visible with review status.

Source rules without an upper course-number boundary have no artificial 199 cap. In particular, documented ENGS 262 can be allocated as an elective and an explicitly overlapping culminating experience.

Completion history uses `completionCourses(catalog)` to include explicitly named, verified requirement and equivalence identities that have no offering in the bundled terms, including COSC 98/99. These choices carry their exact evidence source and a catalog-only label; their prerequisites remain unverified. The helper never expands numeric ranges or creates sections/bundles, and preserves existing offering records.
