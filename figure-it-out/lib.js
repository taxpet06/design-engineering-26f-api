// Three small helpers for a campus-life app. Each one has a different kind of bug.
// Your job: make `npm run figure-it-out` go green. Read figure-it-out/README.md first.

const courses = [
  { id: 1, name: "Intro to CS" },
  { id: 2, name: "Data Structures" },
  { id: 3, name: "Design Studio" },
];

// Turns a list of course ids into course names.
function courseTitles(courseIds) {
  return courseIds.map((id) => courses[id].name);
}

// GPAs arrive from an API as JSON, e.g. ["3.5", "3.0", "4.0"]. Returns the average.
function averageGpa(gpas) {
  return gpas.reduce((sum, g) => sum + g, 0) / gpas.length;
}

// Returns club names, biggest club first.
function rankClubs(clubs) {
  return [...clubs].sort((a, b) => b.members > a.members).map((c) => c.name);
}

module.exports = { courseTitles, averageGpa, rankClubs };
