# Innovations

Each entry: the problem, how it works, why it beats the baseline, its data and logic, how it can mislead, how to inspect or override it, and how it was verified.

## 1. Margin tails

- **Problem.** A full calendar looks feasible until one session runs long and everything after it slips. Students cannot see which sessions have room.
- **How it works.** Below each future study session the calendar draws a tail. Its length is the overrun this estimate could plausibly need (50% of the session for rough guesses, 25% for fairly sure, 10% for confident). If the free time before the next item, minus travel and buffer, covers that overrun, the tail is a faint fade. If not, it collapses to a thin amber line, and the session's accessible label says how many minutes remain before the next commitment.
- **Why it is better.** It turns an invisible property (slack) into something scannable without adding a chart.
- **Data and logic.** Session length, the task's estimate confidence, the next item in that day, entered or fallback travel time. `src/ui/calendar.js`, `marginTail`.
- **Can mislead.** The margins are fixed rules of thumb, not measured variance. A missing location makes travel look free.
- **Control.** Change a task's "How sure is the estimate?" to change its margin. The legend explains both tail styles.
- **Verified.** Smoke test confirms tails render; screenshots reviewed in light and dark themes.

## 2. Option comparison with explicit trade-offs

- **Problem.** One generated plan hides the choice between finishing early, keeping evenings, and minimizing disruption.
- **How it works.** Each plan request runs the scheduler under up to four strategies (smallest change when an approved plan exists, balanced, finish early, protect evenings). Cards compare planned time, unplaced time, evening study, busiest day, least buffer to a deadline, and number of changes. Only when every option leaves capacity-limited work unplaced does a fifth option appear that adds up to one hour per day and uses kept-free time. It is labeled "Relaxes your limits" and its decisions are tagged Relaxed limit.
- **Why it is better.** The student chooses the trade-off rather than accepting a hidden one, and hard limits are never relaxed silently.
- **Data and logic.** `makeAlternatives` in `src/core/proposal.js`; metrics from `computeMetrics` in `src/core/scheduler.js`.
- **Can mislead.** Each option is a heuristic result, not an optimum; small metric differences may not matter.
- **Control.** Pick any option, regenerate, or cancel. The approved plan is untouched until approval.
- **Verified.** Unit test for when the relaxed option appears; smoke test for compare, select, cancel, approve.

## 3. Robustness check

- **Problem.** A plan that fits on paper can break from one long session or one missed evening.
- **How it works.** Re-runs the real scheduler in smallest-change mode under two scenario families: every open task's estimate scaled by its confidence margin, and each of the next ten unlocked sessions (within 72 hours) removed one at a time with its slot blocked. Tasks are labeled Holds, Tight (last session within 12 hours of the deadline), Fragile, or Not covered. Critical sessions are outlined on the calendar.
- **Why it is better.** It finds the specific session whose loss breaks a deadline, which is actionable (lock it, start earlier, add buffer).
- **Data and logic.** `src/core/fragility.js`. Deterministic; same inputs, same answer.
- **Can mislead.** It tests single disruptions, not combinations, and scenario margins are assumptions. The panel says these are scenarios, not probabilities.
- **Control.** Runs only when requested; re-run after changes. Assumptions are listed in the panel.
- **Verified.** Unit test constructs a plan where one lost session breaks a deadline; smoke test runs it on the demo.

## 4. Recovery-first replanning

- **Problem.** After a missed session, regenerating the whole week moves many things and feels like starting over.
- **How it works.** Recover walks through three steps: record what happened (one tap per past session), see what still fits today, then compare recovery options. The smallest-change option keeps every approved session in place and only places the work that lost its session. It is preselected when it fits everything.
- **Why it is better.** Minimal disruption first; the full rebalance is one click away if needed.
- **Data and logic.** `keepExistingFuture` in the scheduler; recovery flow in `src/ui/flows.js`.
- **Can mislead.** Smallest change can leave work unplaced when free time is fragmented; the comparison shows that explicitly.
- **Control.** Choose any option or cancel. Nothing is recorded or moved without an explicit action.
- **Verified.** Unit tests for replanning after progress and preserved sessions; smoke test opens the recovery flow.

## 5. Session launch brief with a short-on-time fallback

- **Problem.** Starting is costly when you have to reconstruct what you were doing; plans assume the full window exists.
- **How it works.** Starting a recommended or planned session opens a brief: the step, time available and end time, place, equipment, what is left, the deadline, the next step, and an editable definition of done. "Less time than planned?" asks how many minutes you actually have and finds what still fits, preferring a smaller piece of the same task.
- **Why it is better.** Resuming and shrinking a session become one step instead of a replanning exercise.
- **Data and logic.** `openLaunchBrief` and `fallbackFor` (recommendation engine with a capped window).
- **Can mislead.** It knows only what you entered about the task; it never infers assignment content.
- **Control.** Close it, switch tasks, or stop the session without recording.
- **Verified.** Smoke test opens the brief, runs the fallback, starts a session.

## 6. What-if workspace

- **Problem.** "What if I keep evenings free, or this takes longer?" usually means editing real data to find out.
- **How it works.** Set evening protection, a temporary daily limit, a scaled estimate for one task, or skip optional commitments in the next week. Run compares the result with a balanced plan of current data. Preview as proposal sends it to the normal review; estimate changes and skipped dates are shown as pending fact changes and applied only on approval.
- **Why it is better.** Exploration without side effects, and a clear line between assumptions and facts.
- **Data and logic.** `runWhatIf` and `whatIfToProposal` in `src/ui/flows.js`; fact changes in `approveProposal`.
- **Can mislead.** A temporary daily limit is not saved; days above your saved limit are flagged afterwards, and the panel says so.
- **Control.** Nothing changes until approval; undo is available after.
- **Verified.** Unit test that fact changes apply only on approval; smoke test runs the comparison.

## 7. Typed explanations

- **Problem.** Unexplained automation erodes trust; explained automation that mixes rules and guesses misleads.
- **How it works.** Every placement reason and planning decision carries a type: Rule (hard constraint), Preference (soft), Estimate (uncertain input such as fallback travel), Heuristic (a planner choice another method might make differently), or Relaxed limit.
- **Verified.** Unit tests check reasons for travel and fallback estimates; smoke test checks session details list reasons.
