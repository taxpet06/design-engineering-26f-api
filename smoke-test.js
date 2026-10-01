// ponytail: one runnable check, not a suite. Boots the real server as a child process
// and hits it over HTTP — catches routing/data-generation breakage, not unit-level detail.
const { spawn } = require("node:child_process");
const assert = require("node:assert");
const test = require("node:test");

const PORT = 3999;
let child;

test.before(async () => {
  child = spawn("node", ["server.js"], { env: { ...process.env, PORT }, stdio: "pipe" });
  await new Promise((resolve, reject) => {
    child.stdout.on("data", (d) => d.toString().includes("listening") && resolve());
    child.on("error", reject);
    setTimeout(() => reject(new Error("server did not start")), 5000);
  });
});

test.after(() => child.kill());

const base = `http://localhost:${PORT}`;

test("lists students with fake data", async () => {
  const res = await fetch(`${base}/students`);
  const students = await res.json();
  assert.strictEqual(res.status, 200);
  assert.ok(students.length >= 50, "expected a bunch of fake students");
  assert.ok(students[0].email.includes("@"));
});

test("404s on a missing resource", async () => {
  const res = await fetch(`${base}/students/999999`);
  assert.strictEqual(res.status, 404);
});

test("computes a student's transcript and gpa", async () => {
  const res = await fetch(`${base}/students/1/transcript`);
  const body = await res.json();
  assert.strictEqual(res.status, 200);
  assert.ok(typeof body.gpa === "number" || body.gpa === null);
  assert.ok(Array.isArray(body.courses));
});

test("rejects a POST missing required fields", async () => {
  const res = await fetch(`${base}/students`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ first_name: "Missing Fields" }),
  });
  assert.strictEqual(res.status, 400);
});

test("threads a section's discussion posts with nested replies", async () => {
  const sections = await fetch(`${base}/sections?term=26F`).then((r) => r.json());
  const withPosts = await Promise.all(
    sections.slice(0, 15).map((s) => fetch(`${base}/sections/${s.id}/discussion`).then((r) => r.json()))
  );
  const found = withPosts.find((posts) => posts.some((p) => p.replies.length > 0));
  assert.ok(found, "expected at least one threaded discussion in the first 15 current-term sections");
});

test("computes a student's wellness summary", async () => {
  const res = await fetch(`${base}/students/1/wellness/summary`);
  const body = await res.json();
  assert.strictEqual(res.status, 200);
  assert.ok(body.entries > 0);
  assert.ok(typeof body.avg_sleep_hours === "number");
});

test("serves a valid OpenAPI spec covering every resource", async () => {
  const res = await fetch(`${base}/openapi.json`);
  const spec = await res.json();
  assert.strictEqual(res.status, 200);
  assert.strictEqual(spec.openapi, "3.0.3");
  assert.ok(spec.paths["/students"].get, "expected /students in the generated spec");
  assert.ok(spec.paths["/students/{id}/profile"].get, "expected computed routes in the generated spec");
  assert.ok(Object.keys(spec.paths).length > 80);
});

test("aggregates a student's full profile", async () => {
  const res = await fetch(`${base}/students/1/profile`);
  const body = await res.json();
  assert.strictEqual(res.status, 200);
  assert.ok(body.student && body.student.id === 1);
  assert.ok(Array.isArray(body.clubs));
  assert.ok(Array.isArray(body.research));
  assert.ok("housing" in body && "campus_job" in body);
});

test("returns today's dining menu grouped by location and meal", async () => {
  const res = await fetch(`${base}/dining/today`);
  const body = await res.json();
  assert.strictEqual(res.status, 200);
  const locations = Object.keys(body.locations);
  assert.ok(locations.length > 0, "expected at least one dining location serving something today");
  const firstMeal = Object.values(body.locations[locations[0]])[0];
  assert.ok(Array.isArray(firstMeal) && firstMeal[0].name, "expected menu items with a dish name");
});

test("full enrollment lifecycle: create, patch, delete", async () => {
  const created = await fetch(`${base}/enrollments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ student_id: 1, section_id: 1, status: "enrolled" }),
  }).then((r) => r.json());
  assert.ok(created.id);

  const patched = await fetch(`${base}/enrollments/${created.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "dropped" }),
  }).then((r) => r.json());
  assert.strictEqual(patched.status, "dropped");

  const del = await fetch(`${base}/enrollments/${created.id}`, { method: "DELETE" });
  assert.strictEqual(del.status, 204);
});
