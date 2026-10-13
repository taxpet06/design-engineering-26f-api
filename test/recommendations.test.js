const test = require("node:test");
const assert = require("node:assert/strict");
const { rankTasks, eligibleTasks, replacementFor } = require("../public/js/recommendations");

const tasks = [
  { id: "club-a", title: "Club A", category: "Clubs", tags: ["clubs"], source: { type: "curated" } },
  { id: "club-b", title: "Club B", category: "Clubs", tags: ["clubs"], source: { type: "curated" } },
  { id: "sport-a", title: "Sport A", category: "Sports", tags: ["athletics"], source: { type: "curated" } },
  { id: "art-a", title: "Art A", category: "Arts", tags: ["arts-culture"], source: { type: "curated" } },
];

function state(overrides = {}) {
  return { interests: [], votes: {}, saved: [], completed: [], dismissed: [], recentCategories: [], explorationSeed: 1, ...overrides };
}

test("upvotes and downvotes change ranking for related categories", () => {
  const ranked = rankTasks(tasks, state({ votes: { "club-a": 1, "sport-a": -1 } }));
  assert.ok(ranked.findIndex((task) => task.id === "club-b") < ranked.findIndex((task) => task.id === "sport-a"));
});

test("explicit interests meaningfully improve matching recommendations", () => {
  const ranked = rankTasks(tasks, state({ interests: ["athletics"] }));
  assert.equal(ranked[0].id, "sport-a");
});

test("dismissed and completed tasks are excluded", () => {
  const eligible = eligibleTasks(tasks, state({ dismissed: ["club-a"], completed: ["sport-a"] }));
  assert.deepEqual(eligible.map((task) => task.id).sort(), ["art-a", "club-b"]);
});

test("replacement differs from current and visible tasks when an option exists", () => {
  const replacement = replacementFor("club-a", tasks, state({ dismissed: ["club-a"] }), ["club-a", "sport-a"]);
  assert.ok(replacement);
  assert.notEqual(replacement.id, "club-a");
  assert.notEqual(replacement.id, "sport-a");
});
