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
    docs: "GET each resource for a list, /:id for one. Joined views: /students/:id/profile (everything about one student), /schedule, /grades, /gpa, /transcript, /history, /workshops, /clubs, /wellness/summary; /sections/:id/roster, /sections/:id/discussion; /workshops/:id/roster; /courses/:id/rating; /events/:id/attendees; /intramural-teams/:id/record.",
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
app.use("/dorms", resourceRouter(db, "dorms", { required: ["name", "type"] }));
app.use("/room-assignments", resourceRouter(db, "room_assignments", { required: ["student_id", "dorm_id", "room_number"] }));
app.use("/campus-jobs", resourceRouter(db, "campus_jobs", { required: ["title", "department"] }));
app.use("/job-assignments", resourceRouter(db, "job_assignments", { required: ["student_id", "campus_job_id"] }));
app.use("/events", resourceRouter(db, "events", { required: ["title", "category", "date"] }));
app.use("/event-rsvps", resourceRouter(db, "event_rsvps", { required: ["student_id", "event_id"] }));
app.use("/course-reviews", resourceRouter(db, "course_reviews", { required: ["student_id", "course_id", "rating"] }));
app.use("/textbooks", resourceRouter(db, "textbooks", { required: ["course_id", "title", "author"] }));
app.use("/research-projects", resourceRouter(db, "research_projects", { required: ["title", "pi_instructor_id"] }));
app.use("/research-assistants", resourceRouter(db, "research_assistants", { required: ["student_id", "research_project_id"] }));
app.use("/scholarships", resourceRouter(db, "scholarships", { required: ["name", "type", "amount"] }));
app.use("/scholarship-awards", resourceRouter(db, "scholarship_awards", { required: ["student_id", "scholarship_id"] }));
app.use("/gym-checkins", resourceRouter(db, "gym_checkins", { required: ["student_id", "date", "facility"] }));
app.use("/intramural-teams", resourceRouter(db, "intramural_teams", { required: ["name", "sport"] }));
app.use("/intramural-team-members", resourceRouter(db, "intramural_team_members", { required: ["team_id", "student_id"] }));
app.use("/intramural-matches", resourceRouter(db, "intramural_matches", { required: ["team_a_id", "team_b_id", "sport"] }));
app.use("/mentor-matches", resourceRouter(db, "mentor_matches", { required: ["mentor_student_id", "mentee_student_id"] }));
app.use("/lost-and-found", resourceRouter(db, "lost_and_found_items", { required: ["item_description", "location_found"] }));
app.use("/printing-jobs", resourceRouter(db, "printing_jobs", { required: ["student_id", "date", "pages"] }));

mountComputedRoutes(app, db);

app.use((_req, res) => res.status(404).json({ error: "no such route" }));

module.exports = app;
