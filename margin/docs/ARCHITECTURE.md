# Architecture

Three layers, each usable without the one above it.

1. **Data access** (`src/data/`). `mockRecords.js` holds synthetic source records in an assumed shape. `adapter.js` exposes them through a small interface and maps them to normalized entities, keeping source ids (`source: { system, table, id }`). `demoSeed.js` builds the demo scenarios.
2. **Engine** (`src/core/`). Pure functions over a state object. No DOM, no network, no clock reads: every function that needs the time takes `nowMs`. Runs unchanged in Node for tests.
3. **Interface** (`src/ui/`). `app.js` owns interaction state and every action that changes data (each action persists and can be undone). Views (`calendar.js`, `panels.js`, `forms.js`, `flows.js`) render from state and call actions. `main.js` re-renders after each change, keeping scroll and focus.

## State (schema version 2)

One state object per mode, stored under separate keys.

| Field | Contents |
|---|---|
| `settings` | timezone (America/New_York only), date-only cutoff, planning window, fallback travel minutes, buffer, home place, calibration switch |
| `preferences` | study hours per weekday, sleep, daily limit, preferred and minimum session, break, longest session, focus hours, kept-free time, evening start |
| `locations`, `travel` | places with kind, study suitability, equipment; symmetric travel minutes per pair |
| `commitments` | type, start date, start and end minute (end before start means overnight), weekly recurrence with weekdays and until date, per-date exceptions (`skip` or `modify`), location, optional flag |
| `tasks` | category, kind, priority, deadline date and optional time, original estimate, remaining, confidence, focus, location requirement, equipment, status, ordered steps, dependencies, splittable, minimum session, definition of done, finish-late-by date |
| `plan` | version, approval time, strategy, sessions (`blocks`) with status planned, completed, partial, interrupted, or missed, plus lock, actual minutes, and reasons |
| `log` | every progress record: outcome, actual minutes, remaining before and after (step and task) |
| `proposal` | the open set of alternatives, each with a fingerprint of what it was based on |
| `calibration`, `revision`, `checkins` | cleared-at time and dismissals; topics with interval history; energy check-ins by date |

## Minute accounting

Kept separate everywhere, shown in the task dialog:

- **Original estimate**: what you first entered (used for calibration).
- **Remaining**: changes only when you record progress or edit it. Proposals never touch it.
- **Progress credited**: the drop in remaining across progress records.
- **Actual time recorded**: minutes you said you worked. Can differ from progress credited.
- **Approved future sessions** and **new in the open proposal**.

When a task has steps, its effort is the sum of open steps; the task-level fields are ignored.

## Scheduler (`src/core/scheduler.js`)

1. Build a timeline for the window (default 14 days from now, rounded to 5 minutes): commitment occurrences, sleep each night, kept sessions (in progress, locked, or recorded; or every approved session in smallest-change mode), and scenario blocks.
2. Study windows per day are the study hours minus the timeline. A session at place P inside a free gap must start after the previous item plus travel from where you were (sleep means home; virtual and unset places are transparent) and end before the next item minus travel to it. Travel includes the buffer. Sessions next to other sessions also need the break.
3. Daily capacity is the lower of the daily limit minus study already on that day, and free study time minus kept-free time.
4. Work units are open tasks or open steps. Need is remaining minus minutes already held by kept sessions. Units are ordered by deadline (high priority treated as 6 hours sooner, low as 6 hours later), then dependencies (steps are sequential).
5. Each unit is split into roughly equal sessions near the preferred length. Balanced spaces them across the days before the deadline; finish early fills the earliest days; protect evenings removes time after the evening start. Candidate slots are scored on focus-hour fit for deep work, quiet places for deep work, preferred places, travel, and time of day. No leftover shorter than the minimum session is ever created.
6. Anything left is reported with a diagnosis: overdue, waiting on a dependency, too long for one session, no suitable place, not enough capacity, no single window, or taken by work placed first. Work due after the window is deferred, not reported as a problem.

Deterministic: no randomness, explicit tie-breaks, block ids derived from unit and start time.

## Proposals (`src/core/proposal.js`)

A proposal stores new sessions, the ids it would replace, a diff (added, moved, removed, unchanged), unplaced work, decisions, metrics, and a fingerprint of tasks, commitments, preferences, places, settings, plan, and progress. Approval recomputes the fingerprint; any difference, or a proposed session now in the past, refuses approval and names what changed. Cancelling discards the proposal and nothing else.

## Time (`src/core/time.js`)

Instants are epoch milliseconds. Dates are local `YYYY-MM-DD` strings; times of day are minutes after local midnight. Conversion uses `Intl.DateTimeFormat`, so DST comes from the platform's timezone data. Weekly events are converted per occurrence, so a 10:10 AM class stays at 10:10 AM across the change. The repeated fall-back hour resolves to its first occurrence; the skipped spring-forward hour moves forward. Days of 23 and 25 hours are labeled on the calendar.

## Storage (`src/core/storage.js`)

Keys: `margin-planner.active-mode`, `margin-planner.demo.v2`, `margin-planner.personal.v2`, `margin-planner.personal.backup`, and `margin-planner.<mode>.unreadable` for data that could not be parsed (kept, never deleted). Backends tried in order: browser `localStorage`, a host key-value store if the page runs inside a sandboxed preview, then memory with a visible "this tab only" banner. Saves that fail (for example, storage full) show a persistent banner; the app keeps working. Imports are parsed and normalized before anything is touched, previewed, and the current personal data is backed up first. All user text is inserted as text nodes.
