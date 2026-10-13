const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeResources } = require("../public/js/catalog");

test("normalization ignores invalid records and preserves stable source ids", () => {
  const result = normalizeResources({ clubs: [{ id: 7, name: "Chess Club", category: "Academic" }, { id: 8 }, null] });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "prototype:club:7");
  assert.equal(result[0].source.type, "prototype");
});

test("normalization removes duplicate records", () => {
  const record = { id: 3, name: "Outing Club", category: "Recreation" };
  const result = normalizeResources({ clubs: [record, { ...record }] });
  assert.equal(result.length, 1);
});

test("normalization filters dated activities that have passed", () => {
  const result = normalizeResources({ events: [
    { id: 1, title: "Past", category: "Social", date: "2026-01-01" },
    { id: 2, title: "Future", category: "Social", date: "2026-11-01" },
  ] }, { now: new Date("2026-10-13T12:00:00") });
  assert.deepEqual(result.map((task) => task.id), ["prototype:event:2"]);
});
