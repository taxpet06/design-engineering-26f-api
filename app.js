const express = require("express");
const cors = require("cors");
const { seed } = require("./data");
const { resourceRouter, mountComputedRoutes } = require("./routes");

const db = seed();
const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    name: "Design Engineering 26F — student data API",
    resources: Object.keys(db),
    docs: "GET each resource for a list, /:id for one. Joined views: /students/:id/schedule, /grades, /gpa, /transcript, /history, /workshops, /clubs, /wellness/summary; /sections/:id/roster, /sections/:id/discussion; /workshops/:id/roster.",
  });
});

app.use("/terms", resourceRouter(db, "terms", { required: ["code", "label", "start_date", "end_date"] }));
app.use("/departments", resourceRouter(db, "departments", { required: ["name", "code"] }));
app.use("/instructors", resourceRouter(db, "instructors", { required: ["first_name", "last_name", "department"] }));
app.use("/students", resourceRouter(db, "students", { required: ["first_name", "last_name", "email"] }));
app.use("/courses", resourceRouter(db, "courses", { required: ["code", "title", "department", "credits"] }));
app.use("/sections", resourceRouter(db, "sections", { required: ["course_id", "instructor_id", "term"] }));
app.use("/enrollments", resourceRouter(db, "enrollments", { required: ["student_id", "section_id"] }));
app.use("/assignments", resourceRouter(db, "assignments", { required: ["section_id", "title", "points_possible"] }));
app.use("/submissions", resourceRouter(db, "submissions", { required: ["assignment_id", "student_id", "score"] }));
app.use("/announcements", resourceRouter(db, "announcements", { required: ["section_id", "title", "body"] }));
app.use("/discussion-posts", resourceRouter(db, "discussion_posts", { required: ["section_id", "author_type", "author_id", "body"] }));
app.use("/workshops", resourceRouter(db, "workshops", { required: ["title", "category", "date"] }));
app.use("/workshop-registrations", resourceRouter(db, "workshop_registrations", { required: ["student_id", "workshop_id"] }));
app.use("/wellness-logs", resourceRouter(db, "wellness_logs", { required: ["student_id", "date", "sleep_hours", "mood"] }));
app.use("/clubs", resourceRouter(db, "clubs", { required: ["name", "category"] }));
app.use("/club-memberships", resourceRouter(db, "club_memberships", { required: ["student_id", "club_id"] }));
app.use("/dining-visits", resourceRouter(db, "dining_visits", { required: ["student_id", "date", "meal", "location"] }));
app.use("/library-checkouts", resourceRouter(db, "library_checkouts", { required: ["student_id", "book_title", "checked_out_at"] }));
app.use("/study-groups", resourceRouter(db, "study_groups", { required: ["section_id", "name"] }));
app.use("/study-group-members", resourceRouter(db, "study_group_members", { required: ["study_group_id", "student_id"] }));

mountComputedRoutes(app, db);

app.use((_req, res) => res.status(404).json({ error: "no such route" }));

module.exports = app;
