// In-memory "database": generated once at startup, mutated in place by the routes.
// ponytail: no real DB. Data resets on restart — fine for a teaching sandbox, add
// Postgres/SQLite if the course later wants persistence across restarts.

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260922);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const pickN = (arr, n) => {
  const pool = [...arr];
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return out;
};
const randInt = (min, max) => min + Math.floor(rand() * (max - min + 1));

const FIRST_NAMES = ["Ava","Liam","Maya","Noah","Zoe","Ethan","Nora","Kai","Priya","Owen","Luna","Mateo","Ivy","Jasper","Anaya","Felix","Sana","Theo","Nadia","Miles","Elena","Oscar","Freya","Amir","Ruby","Diego","Sofia","Leo","Aisha","Hugo"];
const LAST_NAMES = ["Chen","Patel","Okafor","Nguyen","Garcia","Kim","Silva","Novak","Haddad","Reyes","Larsen","Rossi","Kowalski","Abara","Petrov","Suzuki","Mendes","Costa","Fischer","Yilmaz","Dubois","Santos","Ivanov","Osei","Hansen","Moreno","Takahashi","Alvarez","Blake","Romero"];

const DEPARTMENTS = [
  { name: "Computer Science", code: "COSC" },
  { name: "Mathematics", code: "MATH" },
  { name: "Biology", code: "BIOL" },
  { name: "Economics", code: "ECON" },
  { name: "English", code: "ENGL" },
  { name: "Physics", code: "PHYS" },
  { name: "Psychological & Brain Sciences", code: "PBS" },
  { name: "History", code: "HIST" },
  { name: "Studio Art", code: "ART" },
  { name: "Engineering Sciences", code: "ENGS" },
  { name: "Government", code: "GOVT" },
  { name: "Chemistry", code: "CHEM" },
];

const COURSE_TEMPLATES = [
  "Introduction to {d}",
  "{d} I",
  "{d} II",
  "Topics in {d}",
  "Seminar in {d}",
  "{d} Laboratory",
  "Advanced {d}",
  "Foundations of {d}",
];

const MAJORS = DEPARTMENTS.map((d) => d.name);
const YEARS = ["Freshman", "Sophomore", "Junior", "Senior"];
const DAY_PATTERNS = [["Mon", "Wed", "Fri"], ["Tue", "Thu"], ["Mon", "Wed"], ["Wed"], ["Tue", "Thu", "Fri"]];
const TIME_SLOTS = ["08:00-08:50", "09:05-09:55", "10:10-11:00", "11:15-12:05", "13:10-14:00", "14:15-15:05", "15:20-16:10"];
const ROOMS = ["Kemeny 007", "Kemeny 108", "Silsby 028", "Haldeman 041", "Steele 006", "Wilder 104", "Rockefeller 002", "Carson L01"];
const GRADE_POINTS = { "A": 4.0, "A-": 3.67, "B+": 3.33, "B": 3.0, "B-": 2.67, "C+": 2.33, "C": 2.0, "C-": 1.67, "D": 1.0, "E": 0.0 };
const LETTER_GRADES = Object.keys(GRADE_POINTS);
const TERMS = ["25W", "25S", "25F", "26W"];
const CURRENT_TERM = "26F";

function titleCase(s) {
  return s;
}

function buildInstructors(n) {
  const instructors = [];
  for (let i = 1; i <= n; i++) {
    const dept = pick(DEPARTMENTS);
    instructors.push({
      id: i,
      first_name: pick(FIRST_NAMES),
      last_name: pick(LAST_NAMES),
      email: null,
      department: dept.name,
      title: pick(["Professor", "Associate Professor", "Assistant Professor", "Senior Lecturer", "Lecturer"]),
    });
  }
  instructors.forEach((p) => (p.email = `${p.first_name}.${p.last_name}@dartmouth.edu`.toLowerCase()));
  return instructors;
}

function buildStudents(n) {
  const students = [];
  for (let i = 1; i <= n; i++) {
    const first_name = pick(FIRST_NAMES);
    const last_name = pick(LAST_NAMES);
    students.push({
      id: i,
      first_name,
      last_name,
      email: `${first_name}.${last_name}${i}@dartmouth.edu`.toLowerCase(),
      year: pick(YEARS),
      major: pick(MAJORS),
    });
  }
  return students;
}

function buildCourses(n) {
  const courses = [];
  const usedCodes = new Set();
  for (let i = 1; i <= n; i++) {
    const dept = pick(DEPARTMENTS);
    let code;
    do {
      code = `${dept.code} ${randInt(1, 89)}`;
    } while (usedCodes.has(code));
    usedCodes.add(code);
    const template = pick(COURSE_TEMPLATES);
    courses.push({
      id: i,
      code,
      title: template.replace("{d}", dept.name),
      department: dept.name,
      credits: pick([1, 1, 1, 2]),
      level: template.includes("Advanced") || template.includes("Topics") ? "Advanced" : template.includes("Introduction") || template.includes("Foundations") ? "Intro" : "Intermediate",
      description: `A study of core concepts in ${dept.name.toLowerCase()}, building on prerequisite coursework where applicable.`,
    });
  }
  return courses;
}

function buildSections(courses, instructors, n) {
  const sections = [];
  for (let i = 1; i <= n; i++) {
    const course = pick(courses);
    const term = pick([...TERMS, CURRENT_TERM, CURRENT_TERM]); // weight toward current term
    sections.push({
      id: i,
      course_id: course.id,
      instructor_id: pick(instructors).id,
      term,
      section_number: randInt(1, 3),
      days: pick(DAY_PATTERNS),
      time: pick(TIME_SLOTS),
      room: pick(ROOMS),
      capacity: pick([12, 20, 30, 45, 60]),
    });
  }
  return sections;
}

function buildEnrollments(students, sections) {
  const enrollments = [];
  let id = 1;
  for (const student of students) {
    const takenSections = pickN(sections, randInt(3, 6));
    for (const section of takenSections) {
      const isPast = section.term !== CURRENT_TERM;
      const status = isPast ? "completed" : pick(["enrolled", "enrolled", "enrolled", "waitlisted"]);
      enrollments.push({
        id: id++,
        student_id: student.id,
        section_id: section.id,
        status,
        final_grade: status === "completed" ? pick(LETTER_GRADES) : null,
        enrolled_at: `20${section.term.slice(0, 2)}-${section.term.endsWith("W") ? "01" : section.term.endsWith("S") ? "04" : "09"}-05`,
      });
    }
  }
  return enrollments;
}

function buildAssignments(sections) {
  const assignments = [];
  let id = 1;
  const currentSections = sections.filter((s) => s.term === CURRENT_TERM);
  for (const section of currentSections) {
    const count = randInt(2, 4);
    for (let i = 1; i <= count; i++) {
      assignments.push({
        id: id++,
        section_id: section.id,
        title: pick(["Problem Set", "Homework", "Midterm", "Project Milestone", "Lab Report"]) + ` ${i}`,
        type: pick(["homework", "exam", "project"]),
        points_possible: pick([10, 20, 50, 100]),
        due_date: `2026-${randInt(9, 12)}-${String(randInt(1, 28)).padStart(2, "0")}`,
      });
    }
  }
  return assignments;
}

function buildSubmissions(assignments, enrollments) {
  const submissions = [];
  let id = 1;
  for (const assignment of assignments) {
    const enrolledHere = enrollments.filter((e) => e.section_id === assignment.section_id && e.status !== "waitlisted");
    for (const enrollment of enrolledHere) {
      if (rand() < 0.15) continue; // some students haven't submitted yet
      const score = Math.round(assignment.points_possible * (0.6 + rand() * 0.4));
      submissions.push({
        id: id++,
        assignment_id: assignment.id,
        student_id: enrollment.student_id,
        score,
        late: rand() < 0.1,
        submitted_at: `2026-${randInt(9, 12)}-${String(randInt(1, 28)).padStart(2, "0")}`,
      });
    }
  }
  return submissions;
}

function buildAnnouncements(sections, instructors) {
  const announcements = [];
  let id = 1;
  const currentSections = sections.filter((s) => s.term === CURRENT_TERM);
  for (const section of currentSections) {
    if (rand() < 0.4) continue; // not every section has one
    announcements.push({
      id: id++,
      section_id: section.id,
      posted_by: section.instructor_id,
      title: pick(["Office hours moved", "Reading updated", "No class Friday", "Project groups posted", "Exam room change"]),
      body: "See the course page for details.",
      posted_at: `2026-${randInt(9, 12)}-${String(randInt(1, 28)).padStart(2, "0")}`,
    });
  }
  return announcements;
}

function seed() {
  const instructors = buildInstructors(18);
  const students = buildStudents(60);
  const courses = buildCourses(40);
  const sections = buildSections(courses, instructors, 70);
  const enrollments = buildEnrollments(students, sections);
  const assignments = buildAssignments(sections);
  const submissions = buildSubmissions(assignments, enrollments);
  const announcements = buildAnnouncements(sections, instructors);

  return {
    departments: DEPARTMENTS.map((d, i) => ({ id: i + 1, name: d.name, code: d.code })),
    instructors,
    students,
    courses,
    sections,
    enrollments,
    assignments,
    submissions,
    announcements,
  };
}

module.exports = { seed, GRADE_POINTS, CURRENT_TERM };
