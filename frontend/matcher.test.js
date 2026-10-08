// Run: node --test frontend/matcher.test.js
const test = require("node:test");
const assert = require("node:assert");
global.window = {};
require("./clubs.js");
const A = require("./app.js");
const club = (name) => A.CLUBS.find((c) => c.name === name);
const run = (profile) => { Object.assign(A.S.profile, { clubs: [], interests: [], ...profile }); return A.buildProfile(); };

test("whole-word matching: 'skills' is not ski", () => {
  const m = A.match(club("Mountaineering & Ski Patrol"), run({ bio: "public speaking skills" }));
  assert.equal(m.score, 0);
  assert.ok(A.match(club("Debate Society"), run({ bio: "public speaking skills" })).score > 0);
});
test("tags and bio normalize the same way (hiking/hike, boats)", () => {
  assert.ok(A.match(club("Dartmouth Outing Club"), run({ bio: "I like to hike" })).score > 0);
  assert.ok(A.match(club("Dartmouth Outing Club"), run({ bio: "hiking" })).score > 0);
  assert.ok(A.match(club("Sailing Club"), run({ bio: "I love boats" })).score > 0);
});
test("course codes expand and explain themselves", () => {
  const m = A.match(club("Data Science Club"), run({ classes: "COSC 10, BIOL 11" }));
  assert.ok(m.reasons.some((r) => r.src.includes("COSC 10")));
});
test("schedule conflicts", () => {
  const busy = A.parseBusy("COSC 10: Mon Wed Fri 10:10-11:15\nECON 1: Tue Thu 18:30-19:30");
  assert.equal(busy.length, 5);
  assert.deepEqual(A.conflicts({ day: "Tue", time: "19:00-21:00" }, busy), ["ECON 1"]);
  assert.deepEqual(A.conflicts({ day: "Tue", time: "19:30-21:00" }, busy), []);
});
