# Session 3 cheatsheet: working with an agent

Everything from today you might want to copy. Claude Code is already installed from
Session 1. Nothing here asks you to change your setup.

---

## 1. Start a safe session

Run these in the `api-backend` folder, in your terminal (not inside Claude).

```bash
git status                          # clean? if not, commit or stash first
git switch -c session-3-yourname    # work on your own branch, never on master
claude                              # start the agent
```

Before every agent run:

```bash
git add -A && git commit -m "checkpoint before agent run"
```

After every agent run:

```bash
git diff                # read what it changed
git diff --stat         # which files, how many lines
```

Undo, from least to most destructive:

```bash
git restore path/to/file     # throw away uncommitted changes to one file
git restore .                # throw away all uncommitted changes
git reset --hard HEAD~1      # delete the last commit and its changes (careful)
```

---

## 2. Inside Claude Code

| Do this | What it does |
|---|---|
| `Shift+Tab` | Cycle permission modes: ask for everything, accept edits, plan mode |
| `Esc` | Interrupt the agent mid-run |
| `Esc` `Esc` | Rewind to an earlier point in the conversation |
| `/clear` | Wipe the context, start fresh (use between unrelated tasks) |
| `/compact` | Summarize the conversation to free up context |
| `/context` | See what is filling up the context window |
| `/resume` | Pick up an earlier session |
| `/permissions` | See and change what the agent is allowed to run |
| `/help` | The full list |
| `@routes.js` | Point at a specific file so the agent reads it |
| `!npm test` | Run a shell command yourself and put its output in the conversation |

Start in plan mode from the command line:

```bash
claude --permission-mode plan
```

---

## 3. Prompt templates

### A task spec (copy, fill in the brackets)

```text
Goal: [one sentence, what should exist when this is done]

Where: [files to look at first, e.g. @routes.js @computed-routes.js]

Follow the pattern of: [an existing thing that already does something similar]

Done when:
- [a request I can run and what it should return]
- [a test that passes, `npm test`]

Don't:
- add new dependencies
- change anything outside [files]

Make a plan first. Don't write code until I approve it.
```

### The worked example from the live demo

```text
Goal: add GET /clubs/popular that returns clubs ranked by number of members.

Where: @routes.js (see how /dining/today is built), @computed-routes.js, @smoke-test.js

Follow the pattern of: /dining/today for the route, the existing smoke tests for the test.

Done when:
- GET /clubs/popular?limit=3 returns 3 clubs, each with a member_count, biggest first
- limit defaults to 5, and a nonsense limit like "abc" falls back to the default
- the route is listed in computed-routes.js so it shows up in /openapi.json
- a new smoke test covers it and `npm test` passes

Don't add dependencies or touch data.js.

Make a plan first. Don't write code until I approve it.
```

### Review the diff yourself first, then ask an agent

```text
Review my uncommitted changes (git diff). Look for: new dependencies I didn't ask for,
dead code, errors that get swallowed, tests that can't fail, and anything outside the
scope of "[the task]". List problems only. Don't fix anything.
```

### Explain, don't fix

```text
Here is the failing test output:
[paste it]

Explain why it fails, in plain words. Point at the exact line. Don't change any files yet.
```

---

## 4. A good `CLAUDE.md` (what the agent reads at the start of every session)

You do not need to create this today, and this repo does not have one. This is what one looks like for this repo, so you
can see what "context engineering" means in practice.

```markdown
# api-backend

Fake Dartmouth student-data REST API. Express, in-memory data, deployed on Vercel.

## Commands
- `npm run dev`: run locally on :3000 with auto-restart
- `npm test`: run the smoke test (boots the real server)

## Layout
- `resources.js`: list of CRUD resources. Add a new resource here once.
- `routes.js`: generic CRUD router + computed (joined) routes
- `computed-routes.js`: docs for computed routes. Update it whenever you add one.
- `data.js`: generates the fake data at startup

## Rules
- No new dependencies without asking.
- Every new route gets a smoke test in `smoke-test.js`.
- 404 responses look like `{ "error": "<resource> <id> not found" }`.
```

---

## 5. What a skill looks like (an example only, not a file in this repo)

A skill is a folder with a `SKILL.md`. The description is what the agent reads to decide
whether the skill applies. The body is only loaded when it does.

```markdown
---
name: api-route
description: Use when adding or changing an endpoint in this API. Covers where routes
  live, how to document them, and how to test them.
---

# Adding an API route

1. Add the handler in `routes.js`, next to the closest existing route.
2. If it is a joined/computed route, add a line to `computed-routes.js`.
3. Add a test to `smoke-test.js`.
4. Run `npm test`. Don't report done until it passes.
```

Where they live: `.claude/skills/<name>/SKILL.md` in a project, or `~/.claude/skills/`
for all your projects.

---

## 6. Figure it out: the checklist

When something breaks, go down this list in order. Don't skip to "ask the agent".

1. **Read the error message, all of it.** The first line says what, the next few lines say
   where. Find the first line that is in *your* code, not in `node_modules`.
2. **Reproduce it.** What exact input or command makes it fail? Can you make it fail every time?
3. **Shrink it.** Remove things until it still fails with the smallest possible input.
4. **Look at the real values.** `console.log` the thing right before the failure. Is it what
   you assumed it was?
5. **Say what you expected vs. what you got**, out loud or in writing. The gap is the bug.
6. **Read the docs for the one function involved** (MDN for JavaScript, the library's docs).
7. **Now ask the agent, with evidence:** the error, the input, what you expected, what you
   already tried. Ask it to *explain*, then decide what to change.
8. **Still stuck after 5 minutes?** Change the approach, not the wording: new session, smaller
   problem, different tool.

### Useful commands for it

```bash
npm run figure-it-out                       # today's challenge
node --test figure-it-out/lib.test.js       # the same thing, no npm
node -e 'console.log(["10","9","100"].sort())'     # try a tiny experiment, no file needed
git diff                                    # what did I (or the agent) change?
git stash                                   # park changes to see if the bug was already there
git stash pop                               # bring them back
```

---

## 7. Rules of thumb

- Commit before every agent run. Read the diff after every one.
- Plan mode for anything touching more than one file.
- One task per session. `/clear` between unrelated tasks.
- Give the agent a way to check its own work (a test, a command with expected output).
- Never put secrets (`.env`, API keys) in a prompt or a commit.
- Never point an agent at real production data.
- If you can't explain what the agent's change does, you're not done.
