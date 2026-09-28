const express = require("express");
const { GRADE_POINTS, CURRENT_TERM } = require("./data");

// Generic CRUD for one resource collection, backed by db[key] (an array of objects with `id`).
// Every resource gets the same shape: GET list (+ ?field=value filters, ?sort, ?order, ?page, ?limit),
// GET one, POST, PUT, PATCH, DELETE. ponytail: one router factory instead of rewriting this 9 times.
function resourceRouter(db, key, { required = [] } = {}) {
  const router = express.Router();
  const collection = () => db[key];

  router.get("/", (req, res) => {
    const { sort, order, page, limit, ...filters } = req.query;
    let items = collection().filter((item) =>
      Object.entries(filters).every(([field, value]) => String(item[field]) === String(value))
    );
    if (sort) {
      const dir = order === "desc" ? -1 : 1;
      items = [...items].sort((a, b) => (a[sort] > b[sort] ? dir : a[sort] < b[sort] ? -dir : 0));
    }
    const total = items.length;
    if (page || limit) {
      const l = Math.max(1, parseInt(limit, 10) || 20);
      const p = Math.max(1, parseInt(page, 10) || 1);
      items = items.slice((p - 1) * l, p * l);
      return res.json({ data: items, total, page: p, limit: l });
    }
    res.json(items);
  });

  router.get("/:id", (req, res) => {
    const item = collection().find((i) => i.id === Number(req.params.id));
    if (!item) return res.status(404).json({ error: `${key} ${req.params.id} not found` });
    res.json(item);
  });

  router.post("/", (req, res) => {
    const missing = required.filter((f) => req.body[f] === undefined);
    if (missing.length) return res.status(400).json({ error: `missing required field(s): ${missing.join(", ")}` });
    const id = collection().reduce((max, i) => Math.max(max, i.id), 0) + 1;
    const item = { id, ...req.body };
    collection().push(item);
    res.status(201).json(item);
  });

  router.put("/:id", (req, res) => {
    const idx = collection().findIndex((i) => i.id === Number(req.params.id));
    if (idx === -1) return res.status(404).json({ error: `${key} ${req.params.id} not found` });
    const missing = required.filter((f) => req.body[f] === undefined);
    if (missing.length) return res.status(400).json({ error: `missing required field(s): ${missing.join(", ")}` });
    collection()[idx] = { ...req.body, id: Number(req.params.id) };
    res.json(collection()[idx]);
  });

  router.patch("/:id", (req, res) => {
    const idx = collection().findIndex((i) => i.id === Number(req.params.id));
    if (idx === -1) return res.status(404).json({ error: `${key} ${req.params.id} not found` });
    collection()[idx] = { ...collection()[idx], ...req.body, id: Number(req.params.id) };
    res.json(collection()[idx]);
  });

  router.delete("/:id", (req, res) => {
    const idx = collection().findIndex((i) => i.id === Number(req.params.id));
    if (idx === -1) return res.status(404).json({ error: `${key} ${req.params.id} not found` });
    collection().splice(idx, 1);
    res.status(204).end();
  });

  return router;
}

function gpaFor(db, studentId) {
  const graded = db.enrollments.filter((e) => e.student_id === studentId && e.final_grade);
  if (!graded.length) return null;
  const totalPoints = graded.reduce((sum, e) => {
    const section = db.sections.find((s) => s.id === e.section_id);
    const course = section && db.courses.find((c) => c.id === section.course_id);
    const credits = course ? course.credits : 1;
    return sum + GRADE_POINTS[e.final_grade] * credits;
  }, 0);
  const totalCredits = graded.reduce((sum, e) => {
    const section = db.sections.find((s) => s.id === e.section_id);
    const course = section && db.courses.find((c) => c.id === section.course_id);
    return sum + (course ? course.credits : 1);
  }, 0);
  return Math.round((totalPoints / totalCredits) * 100) / 100;
}

function enrollmentDetail(db, enrollment) {
  const section = db.sections.find((s) => s.id === enrollment.section_id);
  const course = section && db.courses.find((c) => c.id === section.course_id);
  const instructor = section && db.instructors.find((i) => i.id === section.instructor_id);
  return { ...enrollment, section, course, instructor };
}

// Computed/joined endpoints a flat CRUD filter can't express: schedule, grades, gpa,
// transcript, and a section roster. These are read-only by design.
function mountComputedRoutes(app, db) {
  app.get("/students/:id/schedule", (req, res) => {
    const studentId = Number(req.params.id);
    const student = db.students.find((s) => s.id === studentId);
    if (!student) return res.status(404).json({ error: `student ${studentId} not found` });
    const term = req.query.term || CURRENT_TERM;
    const schedule = db.enrollments
      .filter((e) => e.student_id === studentId && e.status !== "dropped")
      .map((e) => enrollmentDetail(db, e))
      .filter((e) => e.section && e.section.term === term);
    res.json(schedule);
  });

  app.get("/students/:id/grades", (req, res) => {
    const studentId = Number(req.params.id);
    const student = db.students.find((s) => s.id === studentId);
    if (!student) return res.status(404).json({ error: `student ${studentId} not found` });
    const grades = db.enrollments
      .filter((e) => e.student_id === studentId && e.final_grade)
      .map((e) => enrollmentDetail(db, e));
    res.json(grades);
  });

  app.get("/students/:id/gpa", (req, res) => {
    const studentId = Number(req.params.id);
    const student = db.students.find((s) => s.id === studentId);
    if (!student) return res.status(404).json({ error: `student ${studentId} not found` });
    res.json({ student_id: studentId, gpa: gpaFor(db, studentId) });
  });

  app.get("/students/:id/transcript", (req, res) => {
    const studentId = Number(req.params.id);
    const student = db.students.find((s) => s.id === studentId);
    if (!student) return res.status(404).json({ error: `student ${studentId} not found` });
    const grades = db.enrollments
      .filter((e) => e.student_id === studentId && e.final_grade)
      .map((e) => enrollmentDetail(db, e));
    res.json({
      student,
      gpa: gpaFor(db, studentId),
      credits_earned: grades.reduce((sum, e) => sum + (e.course ? e.course.credits : 0), 0),
      courses: grades,
    });
  });

  app.get("/sections/:id/roster", (req, res) => {
    const sectionId = Number(req.params.id);
    const section = db.sections.find((s) => s.id === sectionId);
    if (!section) return res.status(404).json({ error: `section ${sectionId} not found` });
    const roster = db.enrollments
      .filter((e) => e.section_id === sectionId)
      .map((e) => ({ ...db.students.find((s) => s.id === e.student_id), status: e.status, final_grade: e.final_grade }));
    res.json(roster);
  });
}

module.exports = { resourceRouter, mountComputedRoutes };
