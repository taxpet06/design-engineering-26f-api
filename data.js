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
const chance = (p) => rand() < p;

const REFERENCE_DATE = new Date("2026-09-27T00:00:00Z");
const isoDaysAgo = (daysAgo) => new Date(REFERENCE_DATE.getTime() - daysAgo * 86400000).toISOString().slice(0, 10);
const isoBetween = (startISO, endISO) => {
  const start = new Date(startISO).getTime();
  const end = new Date(endISO).getTime();
  return new Date(start + rand() * (end - start)).toISOString().slice(0, 10);
};

const FIRST_NAMES = ["Ava","Liam","Maya","Noah","Zoe","Ethan","Nora","Kai","Priya","Owen","Luna","Mateo","Ivy","Jasper","Anaya","Felix","Sana","Theo","Nadia","Miles","Elena","Oscar","Freya","Amir","Ruby","Diego","Sofia","Leo","Aisha","Hugo","Jade","Marcus","Wren","Dario","Nia","Callum","Yara","Soren","Talia","Rhys"];
const LAST_NAMES = ["Chen","Patel","Okafor","Nguyen","Garcia","Kim","Silva","Novak","Haddad","Reyes","Larsen","Rossi","Kowalski","Abara","Petrov","Suzuki","Mendes","Costa","Fischer","Yilmaz","Dubois","Santos","Ivanov","Osei","Hansen","Moreno","Takahashi","Alvarez","Blake","Romero","Nakamura","Kessler","Adeyemi","Bianchi","Kowalczyk","Dlamini","Farrell","Okonkwo","Sorensen","Vasquez"];

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

const TERM_DEFS = [
  { code: "25W", label: "Winter 2025", start_date: "2025-01-06", end_date: "2025-03-14" },
  { code: "25S", label: "Spring 2025", start_date: "2025-03-31", end_date: "2025-06-06" },
  { code: "25F", label: "Fall 2025", start_date: "2025-09-15", end_date: "2025-11-21" },
  { code: "26W", label: "Winter 2026", start_date: "2026-01-05", end_date: "2026-03-13" },
  { code: "26F", label: "Fall 2026", start_date: "2026-09-15", end_date: "2026-11-20" },
];
const CURRENT_TERM = "26F";
const CURRENT_TERM_DEF = TERM_DEFS.find((t) => t.code === CURRENT_TERM);
const PAST_TERM_CODES = TERM_DEFS.filter((t) => t.code !== CURRENT_TERM).map((t) => t.code);

const MOODS = ["energized", "content", "tired", "stressed", "anxious", "calm", "overwhelmed", "motivated", "bored", "focused"];

const DINING_LOCATIONS = ["Class of 1953 Commons", "Courtyard Cafe", "Novack Cafe", "Fern's", "King Arthur Flour Cafe", "Late Night Collis"];
const MEALS = ["breakfast", "lunch", "dinner", "late-night"];

const BOOKS = [
  { title: "Structure and Interpretation of Computer Programs", author: "Abelson & Sussman" },
  { title: "Thinking, Fast and Slow", author: "Daniel Kahneman" },
  { title: "The Selfish Gene", author: "Richard Dawkins" },
  { title: "Freakonomics", author: "Levitt & Dubner" },
  { title: "A Brief History of Time", author: "Stephen Hawking" },
  { title: "The Design of Everyday Things", author: "Don Norman" },
  { title: "Gödel, Escher, Bach", author: "Douglas Hofstadter" },
  { title: "Sapiens", author: "Yuval Noah Harari" },
  { title: "The Feynman Lectures on Physics", author: "Richard Feynman" },
  { title: "Introduction to Algorithms", author: "Cormen, Leiserson, Rivest & Stein" },
  { title: "The Elements of Style", author: "Strunk & White" },
  { title: "Guns, Germs, and Steel", author: "Jared Diamond" },
  { title: "The Art of Computer Programming, Vol. 1", author: "Donald Knuth" },
  { title: "Silent Spring", author: "Rachel Carson" },
  { title: "The Structure of Scientific Revolutions", author: "Thomas Kuhn" },
  { title: "Man's Search for Meaning", author: "Viktor Frankl" },
  { title: "The Mythical Man-Month", author: "Fred Brooks" },
  { title: "Zen and the Art of Motorcycle Maintenance", author: "Robert Pirsig" },
];

const WORKSHOP_CATALOG = [
  { title: "Resume Review Night", category: "Career" },
  { title: "Intro to Networking (the human kind)", category: "Career" },
  { title: "Mindfulness & Finals Week", category: "Wellness" },
  { title: "Figma for Non-Designers", category: "Technical" },
  { title: "Public Speaking Bootcamp", category: "Career" },
  { title: "Resilience & Time Management", category: "Wellness" },
  { title: "Intro to Investing", category: "Career" },
  { title: "LinkedIn Headshots + Branding", category: "Career" },
  { title: "Pottery & Stress Relief", category: "Creative" },
  { title: "Intro to Woodworking", category: "Creative" },
  { title: "Hackathon Prep: Git & Teams", category: "Technical" },
  { title: "Negotiating Your First Offer", category: "Career" },
  { title: "Sleep Hygiene for Students", category: "Wellness" },
  { title: "Podcasting 101", category: "Creative" },
  { title: "Leading Without a Title", category: "Leadership" },
  { title: "Conflict Resolution for Group Projects", category: "Leadership" },
  { title: "Intro to Watercolor", category: "Creative" },
  { title: "Building a Personal Website", category: "Technical" },
];
const WORKSHOP_LOCATIONS = ["Alumni Hall", "Hopkins Center Room 201", "Fahey Lounge", "Class of 1930 Room", "Top of the Hop", "Faulkner Recital Hall"];

const CLUB_CATALOG = [
  { name: "Design Engineering Club", category: "Academic" },
  { name: "Robotics Team", category: "Academic" },
  { name: "Debate Society", category: "Academic" },
  { name: "Outing Club", category: "Recreation" },
  { name: "A Cappella Group", category: "Arts" },
  { name: "Investment Club", category: "Academic" },
  { name: "Effective Altruism", category: "Service" },
  { name: "Climbing Club", category: "Recreation" },
  { name: "Film Society", category: "Arts" },
  { name: "Data Science Club", category: "Academic" },
  { name: "Community Tutoring Corps", category: "Service" },
  { name: "Ceramics Guild", category: "Arts" },
  { name: "Ultimate Frisbee", category: "Recreation" },
  { name: "Model UN", category: "Academic" },
];
const CLUB_MEETING_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sun"];

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
    const term = pick([...PAST_TERM_CODES, CURRENT_TERM, CURRENT_TERM]); // weight toward current term
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
    const takenSections = pickN(sections, randInt(4, 8));
    for (const section of takenSections) {
      const isPast = section.term !== CURRENT_TERM;
      const status = isPast ? "completed" : pick(["enrolled", "enrolled", "enrolled", "waitlisted"]);
      const term = TERM_DEFS.find((t) => t.code === section.term);
      enrollments.push({
        id: id++,
        student_id: student.id,
        section_id: section.id,
        status,
        final_grade: status === "completed" ? pick(LETTER_GRADES) : null,
        enrolled_at: isoBetween(term.start_date, isPast ? term.end_date : isoDaysAgo(0)),
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
        due_date: isoBetween(CURRENT_TERM_DEF.start_date, CURRENT_TERM_DEF.end_date),
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
      if (chance(0.15)) continue; // some students haven't submitted yet
      const score = Math.round(assignment.points_possible * (0.6 + rand() * 0.4));
      submissions.push({
        id: id++,
        assignment_id: assignment.id,
        student_id: enrollment.student_id,
        score,
        late: chance(0.1),
        submitted_at: isoBetween(CURRENT_TERM_DEF.start_date, assignment.due_date),
      });
    }
  }
  return submissions;
}

function buildAnnouncements(sections) {
  const announcements = [];
  let id = 1;
  const currentSections = sections.filter((s) => s.term === CURRENT_TERM);
  for (const section of currentSections) {
    if (chance(0.4)) continue; // not every section has one
    announcements.push({
      id: id++,
      section_id: section.id,
      posted_by: section.instructor_id,
      title: pick(["Office hours moved", "Reading updated", "No class Friday", "Project groups posted", "Exam room change"]),
      body: "See the course page for details.",
      posted_at: isoBetween(CURRENT_TERM_DEF.start_date, isoDaysAgo(0)),
    });
  }
  return announcements;
}

// ---- Discussion board: real-ish threaded text, tied to actual assignments/courses ----

const ASSIGNMENT_QUESTION_TEMPLATES = [
  (course, a) => `Quick question about ${a.title} for ${course.code} — is the ${a.points_possible} pts split evenly across parts, or weighted toward the last one?`,
  (course, a) => `Anyone else stuck on ${a.title}? My test cases pass locally but I keep second-guessing the edge cases.`,
  (course, a) => `Is there a review session before ${a.title} is due (${a.due_date})? Could use a refresher on this week's material.`,
  (course, a) => `Just submitted ${a.title} — that one took way longer than I expected. Anyone want to compare approaches after class?`,
  (course, a) => `Reminder that ${a.title} is due ${a.due_date}, right? Just want to make sure I'm not misreading the syllabus for ${course.code}.`,
  (course, a) => `Does ${a.title} need to be submitted as a single file, or can we zip everything for ${course.code}?`,
  (course, a) => `Is late work accepted for ${a.title}, or is it a hard deadline this time?`,
];
const GENERAL_QUESTION_TEMPLATES = [
  (course) => `Anyone have a good spot to study for ${course.code}? Looking for something quieter than the library atrium.`,
  (course) => `Is anyone forming a study group for ${course.code} before the next exam?`,
  (course) => `Does anyone have notes from Tuesday's ${course.code} lecture? Had to miss it for an appointment.`,
  (course) => `How's everyone finding the pace of ${course.code} so far? Feels like it picked up this week.`,
  (course) => `Are the ${course.code} textbook readings actually required, or more of a supplement to lecture?`,
];
const STUDENT_REPLY_TEMPLATES = [
  () => `Yeah, I had the same issue — turned out I needed to handle the empty-input case explicitly.`,
  () => `+1, also stuck here. Following this thread.`,
  () => `I think it's weighted, the rubric under "Grading breakdown" spells it out.`,
  () => `Same, budgeted like 2 hours for this and it took closer to 5, lol.`,
  () => `I'm down to compare notes — free after class today?`,
  () => `Pretty sure it's per the syllabus, no review session was mentioned though.`,
  () => `I asked in office hours and TA said single file is fine, no zip needed.`,
  () => `Bumping this, still waiting on an answer too.`,
];
const INSTRUCTOR_REPLY_TEMPLATES = [
  () => `Good question — I'll clarify this in the next announcement, but yes, it's weighted toward the final part.`,
  () => `Office hours this week are unchanged; happy to walk through the edge cases there.`,
  () => `No review session planned, but the section notes cover this. Come by office hours if it's still unclear after that.`,
  () => `Late work loses 10% per day unless you've already used an extension — email me if something's come up.`,
  () => `Single file is fine. If you're using multiple modules, a small zip is also acceptable.`,
];

function buildDiscussionPosts(sections, courses, assignments, enrollments, instructors) {
  const posts = [];
  let id = 1;
  const currentSections = sections.filter((s) => s.term === CURRENT_TERM);

  for (const section of currentSections) {
    const course = courses.find((c) => c.id === section.course_id);
    const enrolledStudentIds = enrollments
      .filter((e) => e.section_id === section.id && e.status === "enrolled")
      .map((e) => e.student_id);
    if (!enrolledStudentIds.length) continue;
    const sectionAssignments = assignments.filter((a) => a.section_id === section.id);

    const addReplies = (parent) => {
      const replyCount = randInt(0, 3);
      for (let r = 0; r < replyCount; r++) {
        const fromInstructor = chance(0.3);
        posts.push({
          id: id++,
          section_id: section.id,
          assignment_id: parent.assignment_id,
          parent_id: parent.id,
          author_type: fromInstructor ? "instructor" : "student",
          author_id: fromInstructor ? section.instructor_id : pick(enrolledStudentIds),
          body: (fromInstructor ? pick(INSTRUCTOR_REPLY_TEMPLATES) : pick(STUDENT_REPLY_TEMPLATES))(),
          posted_at: isoBetween(CURRENT_TERM_DEF.start_date, isoDaysAgo(0)),
          upvotes: randInt(0, 12),
        });
      }
    };

    for (const assignment of sectionAssignments) {
      if (chance(0.5)) continue;
      const postCount = randInt(1, 2);
      for (let p = 0; p < postCount; p++) {
        const post = {
          id: id++,
          section_id: section.id,
          assignment_id: assignment.id,
          parent_id: null,
          author_type: "student",
          author_id: pick(enrolledStudentIds),
          body: pick(ASSIGNMENT_QUESTION_TEMPLATES)(course, assignment),
          posted_at: isoBetween(CURRENT_TERM_DEF.start_date, isoDaysAgo(0)),
          upvotes: randInt(0, 12),
        };
        posts.push(post);
        addReplies(post);
      }
    }

    if (chance(0.35)) {
      const post = {
        id: id++,
        section_id: section.id,
        assignment_id: null,
        parent_id: null,
        author_type: "student",
        author_id: pick(enrolledStudentIds),
        body: pick(GENERAL_QUESTION_TEMPLATES)(course),
        posted_at: isoBetween(CURRENT_TERM_DEF.start_date, isoDaysAgo(0)),
        upvotes: randInt(0, 12),
      };
      posts.push(post);
      addReplies(post);
    }
  }
  return posts;
}

function buildWorkshops(n) {
  const chosen = pickN(WORKSHOP_CATALOG, Math.min(n, WORKSHOP_CATALOG.length));
  return chosen.map((w, i) => ({
    id: i + 1,
    title: w.title,
    category: w.category,
    facilitator: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
    date: isoBetween(CURRENT_TERM_DEF.start_date, CURRENT_TERM_DEF.end_date),
    location: pick(WORKSHOP_LOCATIONS),
    capacity: pick([15, 20, 30, 40]),
    description: `A hands-on session on ${w.title.toLowerCase()}, open to all students.`,
  }));
}

function buildWorkshopRegistrations(students, workshops) {
  const registrations = [];
  let id = 1;
  for (const student of students) {
    if (chance(0.4)) continue; // not everyone signs up for a workshop
    const chosen = pickN(workshops, randInt(1, 3));
    for (const workshop of chosen) {
      registrations.push({
        id: id++,
        student_id: student.id,
        workshop_id: workshop.id,
        status: pick(["registered", "registered", "waitlisted", "attended"]),
      });
    }
  }
  return registrations;
}

function buildWellnessLogs(students) {
  const logs = [];
  let id = 1;
  for (const student of students) {
    const days = randInt(15, 35);
    const sampledDays = pickN(Array.from({ length: 45 }, (_, i) => i), days);
    for (const daysAgo of sampledDays) {
      logs.push({
        id: id++,
        student_id: student.id,
        date: isoDaysAgo(daysAgo),
        sleep_hours: Math.round((4.5 + rand() * 5) * 10) / 10,
        mood: pick(MOODS),
        stress_level: randInt(1, 5),
      });
    }
  }
  return logs;
}

function buildClubs() {
  return CLUB_CATALOG.map((c, i) => ({
    id: i + 1,
    name: c.name,
    category: c.category,
    meeting_day: pick(CLUB_MEETING_DAYS),
    meeting_time: pick(TIME_SLOTS),
  }));
}

function buildClubMemberships(students, clubs) {
  const memberships = [];
  let id = 1;
  for (const student of students) {
    if (chance(0.3)) continue; // not everyone's in a club
    const joined = pickN(clubs, randInt(1, 3));
    joined.forEach((club, i) => {
      memberships.push({
        id: id++,
        student_id: student.id,
        club_id: club.id,
        role: i === 0 && chance(0.15) ? pick(["officer", "president"]) : "member",
        joined_at: isoDaysAgo(randInt(30, 700)),
      });
    });
  }
  return memberships;
}

function buildDiningVisits(students) {
  const visits = [];
  let id = 1;
  for (const student of students) {
    const count = randInt(10, 30);
    for (let i = 0; i < count; i++) {
      visits.push({
        id: id++,
        student_id: student.id,
        date: isoDaysAgo(randInt(0, 40)),
        meal: pick(MEALS),
        location: pick(DINING_LOCATIONS),
      });
    }
  }
  return visits;
}

function buildLibraryCheckouts(students) {
  const checkouts = [];
  let id = 1;
  for (const student of students) {
    if (chance(0.5)) continue; // not everyone checks out books
    const books = pickN(BOOKS, randInt(1, 3));
    for (const book of books) {
      const checkedOutDaysAgo = randInt(1, 60);
      const returned = checkedOutDaysAgo > 14 ? chance(0.7) : chance(0.2);
      checkouts.push({
        id: id++,
        student_id: student.id,
        book_title: book.title,
        author: book.author,
        checked_out_at: isoDaysAgo(checkedOutDaysAgo),
        due_at: isoDaysAgo(checkedOutDaysAgo - 14),
        returned_at: returned ? isoDaysAgo(randInt(0, checkedOutDaysAgo)) : null,
      });
    }
  }
  return checkouts;
}

function buildStudyGroups(sections, enrollments) {
  const groups = [];
  const members = [];
  let groupId = 1;
  let memberId = 1;
  const currentSections = sections.filter((s) => s.term === CURRENT_TERM);
  for (const section of currentSections) {
    const enrolledStudentIds = enrollments
      .filter((e) => e.section_id === section.id && e.status === "enrolled")
      .map((e) => e.student_id);
    if (enrolledStudentIds.length < 3) continue;
    const groupCount = randInt(0, 2);
    for (let g = 0; g < groupCount; g++) {
      const group = {
        id: groupId++,
        section_id: section.id,
        name: pick(["Study Group", "Review Session", "Problem Set Crew", "Exam Prep"]) + ` ${g + 1}`,
        meeting_location: pick(["Baker-Berry Library", "Novack Cafe", "Kemeny Atrium", "Zoom", "Fahey Lounge"]),
        meeting_time: pick(TIME_SLOTS),
      };
      groups.push(group);
      const groupMembers = pickN(enrolledStudentIds, Math.min(enrolledStudentIds.length, randInt(3, 6)));
      for (const studentId of groupMembers) {
        members.push({ id: memberId++, study_group_id: group.id, student_id: studentId });
      }
    }
  }
  return { groups, members };
}

function seed() {
  const instructors = buildInstructors(24);
  const students = buildStudents(90);
  const courses = buildCourses(55);
  const sections = buildSections(courses, instructors, 110);
  const enrollments = buildEnrollments(students, sections);
  const assignments = buildAssignments(sections);
  const submissions = buildSubmissions(assignments, enrollments);
  const announcements = buildAnnouncements(sections);
  const discussion_posts = buildDiscussionPosts(sections, courses, assignments, enrollments, instructors);
  const workshops = buildWorkshops(18);
  const workshop_registrations = buildWorkshopRegistrations(students, workshops);
  const wellness_logs = buildWellnessLogs(students);
  const clubs = buildClubs();
  const club_memberships = buildClubMemberships(students, clubs);
  const dining_visits = buildDiningVisits(students);
  const library_checkouts = buildLibraryCheckouts(students);
  const { groups: study_groups, members: study_group_members } = buildStudyGroups(sections, enrollments);

  return {
    terms: TERM_DEFS.map((t, i) => ({ id: i + 1, ...t, is_current: t.code === CURRENT_TERM })),
    departments: DEPARTMENTS.map((d, i) => ({ id: i + 1, name: d.name, code: d.code })),
    instructors,
    students,
    courses,
    sections,
    enrollments,
    assignments,
    submissions,
    announcements,
    discussion_posts,
    workshops,
    workshop_registrations,
    wellness_logs,
    clubs,
    club_memberships,
    dining_visits,
    library_checkouts,
    study_groups,
    study_group_members,
  };
}

module.exports = { seed, GRADE_POINTS, CURRENT_TERM };
