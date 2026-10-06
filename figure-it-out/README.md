# Figure it out

`figure-it-out/lib.js` has three bugs, each a different kind. `npm run figure-it-out`
runs three tests; all three fail right now. Make them pass.

```bash
npm run figure-it-out
```

## Rules

1. **Ask the agent to explain before it fixes.** Your first message for each bug is
   "explain why this fails, don't change anything yet". Then you decide what to change.
2. **Don't edit `lib.test.js`.** The tests are right.
3. **Stuck for more than 5 minutes? Switch tools.** Print the values, read the docs
   (MDN), shrink the input, or start a fresh session with a better description.
4. **Commit after each bug that turns green.**

## When you finish all three

Write one line per bug in a file `figure-it-out/NOTES.md`: what the symptom was, and what
actually told you the cause (the error message, a printed value, the docs).

## Stretch (no tests given, you write them)

Add `formatTerm("26F")` to `lib.js`, returning `"Fall 2026"`. Handle `W`, `S`, `X` terms too
(Winter, Spring, Summer). Decide what it does with garbage input like `"hello"`, and write
the test for that decision first.
