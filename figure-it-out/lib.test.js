const test = require("node:test");
const assert = require("node:assert");
const { courseTitles, averageGpa, rankClubs } = require("./lib");

test("courseTitles maps ids to names", () => {
  assert.deepStrictEqual(courseTitles([1, 3]), ["Intro to CS", "Design Studio"]);
});

test("averageGpa handles GPAs that arrive as strings", () => {
  assert.strictEqual(averageGpa(["3.5", "3.0", "4.0"]), 3.5);
});

test("rankClubs puts the biggest club first", () => {
  const clubs = [
    { name: "Chess", members: 12 },
    { name: "Outing Club", members: 150 },
    { name: "Ski Patrol", members: 9 },
    { name: "DALI", members: 40 },
  ];
  assert.deepStrictEqual(rankClubs(clubs), ["Outing Club", "DALI", "Chess", "Ski Patrol"]);
});
