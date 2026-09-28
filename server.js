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
    docs: "GET each resource for a list, /:id for one. See /students/:id/schedule, /grades, /gpa, /transcript, and /sections/:id/roster for joined views.",
  });
});

app.use("/departments", resourceRouter(db, "departments", { required: ["name", "code"] }));
app.use("/instructors", resourceRouter(db, "instructors", { required: ["first_name", "last_name", "department"] }));
app.use("/students", resourceRouter(db, "students", { required: ["first_name", "last_name", "email"] }));
app.use("/courses", resourceRouter(db, "courses", { required: ["code", "title", "department", "credits"] }));
app.use("/sections", resourceRouter(db, "sections", { required: ["course_id", "instructor_id", "term"] }));
app.use("/enrollments", resourceRouter(db, "enrollments", { required: ["student_id", "section_id"] }));
app.use("/assignments", resourceRouter(db, "assignments", { required: ["section_id", "title", "points_possible"] }));
app.use("/submissions", resourceRouter(db, "submissions", { required: ["assignment_id", "student_id", "score"] }));
app.use("/announcements", resourceRouter(db, "announcements", { required: ["section_id", "title", "body"] }));

mountComputedRoutes(app, db);

app.use((_req, res) => res.status(404).json({ error: "no such route" }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`listening on ${port}`));
