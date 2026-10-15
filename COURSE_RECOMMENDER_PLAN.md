# Third Course — implementation and review record

The reviewed implementation plan supplied in this task supersedes the original synthetic prototype plan. PRODUCT.md describes the current behavior; docs/curriculum.md records official requirement evidence and unresolved source differences; frontend/scripts/README.md describes the importer.

## Implemented scope
- Published undergraduate offerings across all subjects for Fall 2026 and historical Spring/Summer 2026, with term/CRN identities, decimal codes, provenance and coverage.
- Outside-browser acquisition, validated publication, retained last-good snapshot on validation or acquisition failure, and an offline replay command.
- Explicit course bundles containing required component alternatives; multiple meetings, X-hours, effective dates and unknown-time review states.
- Tri-state eligibility, completed-only prerequisites, explicit concurrent corequisites, preserved unresolved/invalid pins, and a separate Needs review browser.
- Deterministic best-bundle ranking using 40/25/25/10 points; alternatives are inspectable. Requirement points use marginal verified progress beyond completed courses and current pins.
- Four Class of 2030 major rule sets, alternatives, exclusive allocation, reviewed course identities, counting restrictions, and separate external-review conditions.
- Versioned official-data browser storage, explanatory migration, reload and reset support.
- Existing visual identity, keyboard operation, mobile layout, Express API, and root hosting configuration preserved.

## Validation and evidence
Run the commands in frontend/README.md. Real snapshot browser tests capture desktop/mobile, a detail dialog, Needs review, and a missing-pin constraint under .impeccable/review-official. Playwright traces are retained in frontend/test-results; the report is in frontend/playwright-report.

The separate browser fixture is marked TEST FIXTURE and served only by the test dev server. It verifies successful third-course selection, replacement, completed-course changes, progress, persistence, and invalid-pin handling without suppressing any production restriction. It is not evidence of a verified real Dartmouth plan.

## Release limitation and approval gate
Official IP restrictions require instructor override. The acquired Fall data has only two non-IP primary lecture records, cross-listed with one another. Unknown prerequisites or component absence also remain unresolved where the public sources do not establish them. No approved three-course real-data plan can honestly be demonstrated from this capture alone.

Preview review is required before committing, pushing to BND, or deploying. No release action is authorized by successful automated checks alone. An approval-evidence workflow or a subsequent source snapshot that supports a real verified plan requires a separate, concrete decision; never silently waive the checks.
