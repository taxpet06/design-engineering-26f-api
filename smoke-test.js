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
