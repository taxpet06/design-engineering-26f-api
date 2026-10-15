# Current release: Minimal dark 1.6

Open `dist/margin.html`. Two areas, a charcoal background, subtle grid and rounded category-coloured blocks. See `docs/DESIGN.md` for current interface details.

# Margin

A local-first study planner for a Dartmouth student. It plans study time around classes, shifts, meals, sleep, and travel, shows why every session landed where it did, and helps recover when a day goes sideways. The name comes from its central idea: a realistic week keeps margin, and the calendar shows where that margin is.

Built for the Design Engineering class project. No account or AI API key required. Works offline with bundled synthetic data; optional live refresh reads the public course API.

## Launch

**Quickest:** open `dist/margin.html` in a browser. It is a single self-contained file.

**From source** (ES modules need a local server):

```
python3 -m http.server 8080      # or: npm run serve
# then open http://localhost:8080
```

**Tests** (Node 20 or newer, no dependencies):

```
npm test                         # deterministic engine and API-integration tests
```

**Rebuild the single file** after editing source:

```
npm run build                    # writes dist/margin.html
```

**Browser smoke test** (optional, needs Playwright with Chromium):

```
npm i -D playwright && npx playwright install chromium
npm run build && npm run smoke   # desktop/mobile navigation and planner checks
```

## Reference edition 04

This edition follows the supplied calendar reference: a navy application window, violet controls, a left navigation rail, full weekly calendar, right-side mini-calendar and upcoming events, and a self-contained SVG twilight mountain background.

The app opens to **Calendar**. **Week**, **Day**, and **Agenda** are working calendar modes. The mini-calendar selects dates and navigates months. **Search** (or Ctrl/Cmd+K) finds tasks and commitments. **Add event** opens the commitment form; **Plan my week** retains proposal review and approval.

**Overview** contains the next-action recommendation and today's agenda. **Tasks** retains quick three-field task entry and the detailed editor. Sidebar **Settings** contains workspace switching, preferences, places and walking, course imports, backups, and help. Workload and recovery are available from the sidebar. On smaller screens the right rail is hidden and the calendar uses day chips.

The original reference was used for visual direction, not embedded as a screenshot. The wallpaper is original SVG included in assets/twilight.svg and inlined into the standalone build. No external fonts, images or UI dependencies are required.

## Try the course data

1. Open **Settings > Course data**.
2. Use the bundled API snapshot, or choose **Refresh from live API**.
3. Select a fictional student and term. Students are ordered by their number of enrolled classes.
4. Set a demo date inside the term and your default assignment-effort estimate.
5. Choose **Preview course import**, review the limitations, then **Replace demo with course data**.
6. Review missing timing details, set places/travel and task estimates, then **Plan my week** and approve a proposal.

Only the demo is replaced. Your personal workspace is never overwritten by the course importer. Reimport is an explicit whole-demo replacement, not a merge; it does not duplicate records and it discards demo edits only after you approve. Use Undo immediately or export before replacing a demo you want to retain.

The source records are fictional, including students and assignments. Walking durations, assignment effort, and exact deadline times are not supplied by the API. Jobs with weekly hours and date-only events appear in a missing-details checklist, not as fabricated calendar events. That work is not counted as occupied time until you enter shifts or event times. The checklist stays as source reference even after you manually add an event.

You can also use **Personal** for your own real schedule without importing fictional records. Use **Data > Export** to back up your work. Keep the same file location/browser or serve on a consistent localhost address for predictable local-storage continuity; moving the file or changing the origin may show a different workspace.

## The workflow

1. Enter commitments, study hours, places, and tasks (or explore the demo).
2. **Plan my week** produces proposals. Nothing changes until you approve one.
3. Compare options side by side, read the reasons, approve or cancel.
4. **What now** suggests a task that fits the time before your next commitment, with travel counted.
5. Record what actually happened. Only recorded progress changes remaining effort.
6. When sessions are missed, **Recover** records outcomes and compares the smallest fixes first.

Demo mode uses a fixed, labeled clock (Tue, Oct 27, 2026, 1:00 PM) and synthetic data. Personal mode uses real time. The two never share storage. Switch between them in Settings.

## Feature checklist

Legend: **Tested** means covered by the Node suite or the browser smoke test. **Verified in browser** means exercised by the smoke test or by manual screenshots, without a dedicated unit test.

| Area | Status |
|---|---|
| Commitments: create, edit, delete; one-time and weekly with start and end dates | Tested |
| Recurrence exceptions: skip or change one date, restore it | Tested |
| Conflicts between commitments reported, facts preserved | Tested |
| Impossible and tight transitions flagged | Tested |
| Study hours, sleep, daily limit, session lengths, breaks, focus hours, kept-free time | Tested |
| Tasks with steps, dependencies, splitting, minimum session, location and equipment | Tested |
| Steps not double-counted against the parent task | Tested |
| Date-only deadlines with a disclosed, editable cutoff | Tested |
| Overdue work shown honestly; optional finish-late-by date | Tested |
| Places and travel times; labeled fallback for unknown routes; buffer | Tested |
| Travel before and after sessions; none for same place or virtual | Tested |
| Deterministic scheduler with documented 14-day window | Tested |
| Unplaced work reported per task with a reason | Tested |
| Proposal diff (added, moved, removed), approve, cancel, lock | Tested |
| Stale proposal detection before approval | Tested |
| Progress recording: done, partial, interrupted, missed, actual time | Tested |
| Session completion never marks a task done | Tested |
| What now recommendation, alternatives with fit reasons, no-window break | Tested |
| Workload indicators per day | Verified in browser |
| Duration calibration with sample sizes, disable, clear, dismiss | Tested |
| Revision topics, interval rule, one review task per topic | Tested |
| Local persistence, export, validated import with preview and backup | Tested |
| Demo and personal separation; demo reset leaves personal intact | Tested |
| Storage full or unavailable handled without crashing | Tested |
| Malformed and outdated data handled; migration from schema 1 | Tested |
| User text rendered as text, never HTML | Tested |
| America/New_York with DST; 12-hour clock | Tested |
| Mobile day view, keyboard shortcuts, visible focus, dialogs, validation | Verified in browser |
| Tech Forward graphite theme, responsive navigation | Verified in browser |
| Undo for recent changes | Verified in browser (in memory, last 30, cleared on refresh) |
| Availability and focus hours editing | Partial: engine supports several windows per day, the form edits one |
| Drag-and-drop editing | Not done (form editing covers every action) |
| Creating a study session by hand without a proposal | Not done |
| Locking a proposed session before approval | Not done (lock after approving) |
| Timezones other than America/New_York | Not supported |
| Class API connection | Student/term selection, preview, offline snapshot, optional live refresh, source details; demo only |

## Innovations

Details, failure modes, and controls are in [docs/INNOVATIONS.md](docs/INNOVATIONS.md).

- **Margin tails.** Every future session shows how far it could overrun its estimate before colliding with the next thing in the day. A faint tail means room; a thin amber line means none.
- **Option comparison.** Each plan request yields smallest change, balanced, finish early, and protect evenings, compared on planned time, unplaced work, evening study, busiest day, least buffer, and number of changes. A relaxed-limits option appears only when nothing else fits, labeled as needing your approval.
- **Robustness check.** Re-runs the real scheduler with estimates running long (scaled by how sure you were) and with each upcoming session lost, then flags fragile tasks and critical sessions.
- **Recovery first.** Missed work is re-placed without moving any approved session when possible.
- **Session brief.** Objective, time, place, next step, and a definition of done, plus a "less time than planned" fallback.
- **What-if workspace.** Try evening protection, a different daily limit, a longer estimate, or skipping an optional commitment. Fact changes are applied only if you approve the resulting proposal.
- **Typed explanations.** Every reason is tagged Rule, Preference, Estimate, Heuristic, or Relaxed limit.

## Verification

See `docs/COMPLETION.md` for checks rerun on the integrated build. Earlier screenshots were not retained as delivery artifacts.

## Limitations

- The scheduler is a deterministic heuristic. When it cannot place work, a different schedule might still exist; the interface says "not placed by this planning attempt."
- Robustness results are scenario checks, not probabilities.
- Calibration uses small personal samples (minimum 3 per group) and says so.
- Travel times in the demo are invented. There is no map integration.
- Undo history lives in memory and is lost on refresh. Exports are the durable backup.
- Local storage is per browser and per device. There is no cloud sync.
- Fonts: the stack prefers Space Grotesk and Inter if installed, then falls back to system fonts. No web fonts are downloaded.

## Project layout

```
dist/margin.html         single-file build
index.html               development entry (loads src/ui/main.js)
styles/app.css           design system
src/core/                engine: time, model, recurrence, travel, scheduler, proposals,
                         progress, analysis, robustness, recommendation, calibration,
                         revision, storage
src/data/                mock records, adapter seam, demo scenarios
src/ui/                  store and actions, calendar, panels, forms, flows
tests/                   node:test suite
tools/build.mjs          zero-dependency bundler
tools/smoke.mjs          Playwright browser test
docs/                    architecture, innovations, API integration, screenshots
```
