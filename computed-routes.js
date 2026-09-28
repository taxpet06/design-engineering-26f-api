// Mirrors the read-only joined endpoints mounted by mountComputedRoutes in routes.js —
// listed here so openapi.js can document them without re-parsing route handlers.
module.exports = [
  { path: "/students/{id}/schedule", summary: "A student's sections for a term (default: current)" },
  { path: "/students/{id}/grades", summary: "A student's completed enrollments with final grades" },
  { path: "/students/{id}/gpa", summary: "A student's computed GPA" },
  { path: "/students/{id}/transcript", summary: "A student's full transcript: GPA, credits earned, graded courses" },
  { path: "/students/{id}/history", summary: "A student's enrollments grouped by term" },
  { path: "/students/{id}/workshops", summary: "Workshops a student has registered for" },
  { path: "/students/{id}/clubs", summary: "Clubs a student belongs to" },
  { path: "/students/{id}/wellness/summary", summary: "Average sleep/stress and mood distribution for a student" },
  { path: "/students/{id}/profile", summary: "Full student dashboard: housing, job, research, scholarships, clubs, workshops, teams" },
  { path: "/sections/{id}/roster", summary: "Students enrolled in a section" },
  { path: "/sections/{id}/discussion", summary: "A section's discussion board, threaded" },
  { path: "/workshops/{id}/roster", summary: "Students registered for a workshop" },
  { path: "/courses/{id}/rating", summary: "A course's average review rating" },
  { path: "/events/{id}/attendees", summary: "Students RSVP'd to an event" },
  { path: "/intramural-teams/{id}/record", summary: "An intramural team's win/loss/tie record" },
];
