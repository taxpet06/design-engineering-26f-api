const test = require("node:test");
const assert = require("node:assert/strict");
const { createStateStore, applyVote, toggleInList } = require("../public/js/storage");

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
}

test("preferences and completed tasks persist through the storage adapter", () => {
  const adapter = memoryStorage();
  const first = createStateStore(adapter);
  first.save({ interests: ["outdoors"], completed: ["quest-1"] });
  const restored = createStateStore(adapter).load();
  assert.deepEqual(restored.interests, ["outdoors"]);
  assert.deepEqual(restored.completed, ["quest-1"]);
});

test("vote toggling changes or removes one vote without duplicates", () => {
  let state = applyVote({}, "quest-1", 1);
  state = applyVote(state, "quest-1", -1);
  assert.deepEqual(state.votes, { "quest-1": -1 });
  state = applyVote(state, "quest-1", -1);
  assert.deepEqual(state.votes, {});
});

test("saved and completed lists do not accumulate duplicate ids", () => {
  let state = toggleInList({}, "saved", "quest-1");
  state = toggleInList(state, "saved", "quest-1");
  state = toggleInList(state, "saved", "quest-1");
  assert.deepEqual(state.saved, ["quest-1"]);
});

test("resetting recommendations preserves completion history", () => {
  const store = createStateStore(memoryStorage());
  const reset = store.clearPreferences({ completed: ["quest-1"], saved: ["quest-2"], votes: { "quest-2": 1 }, dismissed: ["quest-3"] });
  assert.deepEqual(reset.completed, ["quest-1"]);
  assert.deepEqual(reset.saved, []);
  assert.deepEqual(reset.votes, {});
  assert.deepEqual(reset.dismissed, []);
});
