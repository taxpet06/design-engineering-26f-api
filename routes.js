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

  // What classes a student took, grouped by term — answers "what did they take when".
  app.get("/students/:id/history", (req, res) => {
    const studentId = Number(req.params.id);
    const student = db.students.find((s) => s.id === studentId);
    if (!student) return res.status(404).json({ error: `student ${studentId} not found` });
    const byTerm = {};
    db.enrollments
      .filter((e) => e.student_id === studentId)
      .map((e) => enrollmentDetail(db, e))
      .forEach((e) => {
        const term = e.section ? e.section.term : "unknown";
        (byTerm[term] ||= []).push(e);
      });
    res.json(byTerm);
  });

  app.get("/students/:id/workshops", (req, res) => {
    const studentId = Number(req.params.id);
    const student = db.students.find((s) => s.id === studentId);
    if (!student) return res.status(404).json({ error: `student ${studentId} not found` });
    const registrations = db.workshop_registrations
      .filter((r) => r.student_id === studentId)
      .map((r) => ({ ...r, workshop: db.workshops.find((w) => w.id === r.workshop_id) }));
    res.json(registrations);
  });

  app.get("/students/:id/clubs", (req, res) => {
    const studentId = Number(req.params.id);
    const student = db.students.find((s) => s.id === studentId);
    if (!student) return res.status(404).json({ error: `student ${studentId} not found` });
    const memberships = db.club_memberships
      .filter((m) => m.student_id === studentId)
      .map((m) => ({ ...m, club: db.clubs.find((c) => c.id === m.club_id) }));
    res.json(memberships);
  });

  app.get("/students/:id/wellness/summary", (req, res) => {
    const studentId = Number(req.params.id);
    const student = db.students.find((s) => s.id === studentId);
    if (!student) return res.status(404).json({ error: `student ${studentId} not found` });
    const logs = db.wellness_logs.filter((l) => l.student_id === studentId);
    if (!logs.length) return res.json({ student_id: studentId, entries: 0, avg_sleep_hours: null, avg_stress_level: null, mood_counts: {} });
    const avg = (nums) => Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
    const mood_counts = logs.reduce((acc, l) => ((acc[l.mood] = (acc[l.mood] || 0) + 1), acc), {});
    res.json({
      student_id: studentId,
      entries: logs.length,
      avg_sleep_hours: avg(logs.map((l) => l.sleep_hours)),
      avg_stress_level: avg(logs.map((l) => l.stress_level)),
      mood_counts,
    });
  });

  // Threaded view of a section's discussion board — top-level posts with replies nested.
  app.get("/sections/:id/discussion", (req, res) => {
    const sectionId = Number(req.params.id);
    const section = db.sections.find((s) => s.id === sectionId);
    if (!section) return res.status(404).json({ error: `section ${sectionId} not found` });
    const all = db.discussion_posts.filter((p) => p.section_id === sectionId);
    const topLevel = all.filter((p) => !p.parent_id);
    const withReplies = topLevel.map((p) => ({ ...p, replies: all.filter((r) => r.parent_id === p.id) }));
    res.json(withReplies);
  });

  app.get("/workshops/:id/roster", (req, res) => {
    const workshopId = Number(req.params.id);
    const workshop = db.workshops.find((w) => w.id === workshopId);
    if (!workshop) return res.status(404).json({ error: `workshop ${workshopId} not found` });
    const roster = db.workshop_registrations
      .filter((r) => r.workshop_id === workshopId)
      .map((r) => ({ ...db.students.find((s) => s.id === r.student_id), status: r.status }));
    res.json(roster);
  });

  app.get("/courses/:id/rating", (req, res) => {
    const courseId = Number(req.params.id);
    const course = db.courses.find((c) => c.id === courseId);
    if (!course) return res.status(404).json({ error: `course ${courseId} not found` });
    const reviews = db.course_reviews.filter((r) => r.course_id === courseId);
    const avg_rating = reviews.length ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 100) / 100 : null;
    res.json({ course_id: courseId, review_count: reviews.length, avg_rating });
  });

  app.get("/events/:id/attendees", (req, res) => {
    const eventId = Number(req.params.id);
    const event = db.events.find((e) => e.id === eventId);
    if (!event) return res.status(404).json({ error: `event ${eventId} not found` });
    const attendees = db.event_rsvps
      .filter((r) => r.event_id === eventId)
      .map((r) => ({ ...db.students.find((s) => s.id === r.student_id), status: r.status }));
    res.json(attendees);
  });

  app.get("/intramural-teams/:id/record", (req, res) => {
    const teamId = Number(req.params.id);
    const team = db.intramural_teams.find((t) => t.id === teamId);
    if (!team) return res.status(404).json({ error: `intramural team ${teamId} not found` });
    const matches = db.intramural_matches.filter((m) => m.team_a_id === teamId || m.team_b_id === teamId);
    const record = matches.reduce(
      (acc, m) => {
        const [own, opp] = m.team_a_id === teamId ? [m.score_a, m.score_b] : [m.score_b, m.score_a];
        if (own > opp) acc.wins++;
        else if (own < opp) acc.losses++;
        else acc.ties++;
        return acc;
      },
      { wins: 0, losses: 0, ties: 0 }
    );
    res.json({ team_id: teamId, games_played: matches.length, ...record });
  });

  // Everything the app knows about one student, in a single call — a realistic
  // "student dashboard" endpoint for designing a flow around rather than 15 requests.
  app.get("/students/:id/profile", (req, res) => {
    const studentId = Number(req.params.id);
    const student = db.students.find((s) => s.id === studentId);
    if (!student) return res.status(404).json({ error: `student ${studentId} not found` });

    const room = db.room_assignments.find((r) => r.student_id === studentId && r.term === CURRENT_TERM);
    const job = db.job_assignments.find((j) => j.student_id === studentId && j.term === CURRENT_TERM);
    const research = db.research_assistants
      .filter((r) => r.student_id === studentId)
      .map((r) => ({ ...r, project: db.research_projects.find((p) => p.id === r.research_project_id) }));
    const scholarshipAwards = db.scholarship_awards
      .filter((a) => a.student_id === studentId)
      .map((a) => ({ ...a, scholarship: db.scholarships.find((s) => s.id === a.scholarship_id) }));
    const clubs = db.club_memberships
      .filter((m) => m.student_id === studentId)
      .map((m) => ({ ...m, club: db.clubs.find((c) => c.id === m.club_id) }));
    const workshops = db.workshop_registrations
      .filter((r) => r.student_id === studentId)
      .map((r) => ({ ...r, workshop: db.workshops.find((w) => w.id === r.workshop_id) }));
    const intramuralTeams = db.intramural_team_members
      .filter((m) => m.student_id === studentId)
      .map((m) => db.intramural_teams.find((t) => t.id === m.team_id));

    res.json({
      student,
      gpa: gpaFor(db, studentId),
      housing: room ? { ...room, dorm: db.dorms.find((d) => d.id === room.dorm_id) } : null,
      campus_job: job ? { ...job, job: db.campus_jobs.find((j) => j.id === job.campus_job_id) } : null,
      research,
      scholarships: scholarshipAwards,
      clubs,
      workshops,
      intramural_teams: intramuralTeams,
    });
  });
}

module.exports = { resourceRouter, mountComputedRoutes };
