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

const DORMS = [
  { name: "North Hall", type: "Traditional" },
  { name: "Massachusetts Row", type: "Traditional" },
  { name: "River Cluster", type: "Suite" },
  { name: "Fahey/McLane", type: "Traditional" },
  { name: "East Wheelock", type: "Suite" },
  { name: "Ledyard Apartments", type: "Apartment" },
  { name: "Ravine Lodge Annex", type: "Affinity" },
  { name: "Woodward", type: "Traditional" },
  { name: "New Hampshire Hall", type: "Traditional" },
  { name: "Choates", type: "Traditional" },
];

const CAMPUS_JOBS = [
  { title: "Library Circulation Assistant", department: "Library" },
  { title: "Dining Hall Server", department: "Dining Services" },
  { title: "IT Help Desk Consultant", department: "IT" },
  { title: "Research Assistant (paid)", department: "Academic" },
  { title: "Admissions Tour Guide", department: "Admissions" },
  { title: "Fitness Center Attendant", department: "Recreation" },
  { title: "Peer Tutor", department: "Academic Skills Center" },
  { title: "Mailroom Clerk", department: "Mail Services" },
  { title: "Box Office Assistant", department: "Hopkins Center" },
  { title: "Sustainability Office Intern", department: "Sustainability" },
];

const EVENT_CATALOG = [
  { title: "Fall Concert Series", category: "Concert" },
  { title: "Guest Speaker: Tech Ethics", category: "Speaker" },
  { title: "Homecoming Bonfire", category: "Social" },
  { title: "International Food Festival", category: "Cultural" },
  { title: "Career Fair", category: "Career" },
  { title: "Comedy Night", category: "Social" },
  { title: "Winter Carnival Kickoff", category: "Social" },
  { title: "Alumni Panel: Life After Dartmouth", category: "Speaker" },
  { title: "Poetry Slam", category: "Cultural" },
  { title: "Film Screening: Student Shorts", category: "Cultural" },
  { title: "A Cappella Jam", category: "Concert" },
  { title: "Guest Speaker: Climate Policy", category: "Speaker" },
];

const RESEARCH_TEMPLATES = [
  "Modeling {d} Systems",
  "Computational Approaches to {d}",
  "{d} and Society",
  "Experimental Methods in {d}",
  "Long-Term Trends in {d}",
];
const FUNDING_SOURCES = ["NSF Grant", "Dartmouth Class of 1980s Fund", "Neukom Institute", "Department Seed Grant", "NIH Grant", "Private Foundation Gift"];

const SCHOLARSHIP_CATALOG = [
  { name: "Dean's Merit Scholarship", type: "merit", amount: 5000 },
  { name: "Dartmouth Grant", type: "need-based", amount: 12000 },
  { name: "Presidential Scholars Award", type: "merit", amount: 8000 },
  { name: "STEM Excellence Fellowship", type: "departmental", amount: 3000 },
  { name: "Alumni Legacy Scholarship", type: "merit", amount: 4000 },
  { name: "First-Generation Student Award", type: "need-based", amount: 6000 },
  { name: "Community Impact Scholarship", type: "merit", amount: 2500 },
];

const GYM_FACILITIES = ["Alumni Gym", "Zimmerman Fitness Center", "Bregman Pool", "Boss Tennis Center", "Leverone Field House"];
const GYM_ACTIVITIES = ["cardio", "weights", "swim", "climbing", "yoga", "basketball", "squash"];

const INTRAMURAL_SPORTS = ["Soccer", "Basketball", "Volleyball", "Flag Football", "Dodgeball", "Softball"];
const INTRAMURAL_TEAM_NAMES = ["Kemeny Krushers", "Fahey Ballers", "River Cluster Riptide", "Wheelock Warriors", "Choates Chargers", "McLane Mavericks", "Ravine Raptors", "North Park Ninjas", "Woodward Wolves", "Hitchcock Hawks"];

const MENTOR_PROGRAMS = ["Peer Mentoring", "First-Gen Mentoring", "Women in STEM Mentoring", "International Student Mentoring", "Pre-Health Mentoring"];

const LOST_ITEMS = ["Blue Hydro Flask water bottle", "TI-84 graphing calculator", "Black North Face jacket", "Pair of AirPods Pro", "Dartmouth ID card", "Textbook: Introduction to Algorithms", "Green umbrella", "Wireless mouse", "Keys with a carabiner", "Prescription glasses in a red case", "Grey beanie", "USB-C charging cable"];
const LOST_LOCATIONS = ["Baker-Berry Library", "Class of 1953 Commons", "Kemeny Hall", "Alumni Gym", "Collis Center", "Novack Cafe", "Hopkins Center"];

const PRINT_LOCATIONS = ["Baker-Berry Library", "Novack Cafe Print Station", "Kemeny Print Lab", "Berry Library Reference Desk"];

const POSITIVE_REVIEW_TEMPLATES = [
  (course) => `${course.code} completely changed how I think about ${course.department.toLowerCase()}. The workload is real but so worth it.`,
  (course) => `One of the best courses I've taken. The professor for ${course.code} clearly cares about teaching, not just research.`,
  (course) => `Loved ${course.code} — dense but fair, and the final project actually felt meaningful.`,
];
const MIXED_REVIEW_TEMPLATES = [
  (course) => `${course.code} is solid if you keep up with the readings. Falls apart fast if you fall behind.`,
  (course) => `Decent intro to the material, but the pacing in ${course.code} felt uneven — slow start, then a brutal last three weeks.`,
  (course) => `${course.code} is worth taking for the topic, though the grading felt inconsistent between sections.`,
];
const NEGATIVE_REVIEW_TEMPLATES = [
  (course) => `Wouldn't recommend ${course.code} unless it's required. Lectures didn't match what showed up on exams.`,
  (course) => `Struggled in ${course.code} — office hours were hard to get into and feedback on assignments was minimal.`,
  (course) => `${course.code} needs a serious syllabus rework. Too much crammed into too little time.`,
];

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

function buildDorms() {
  return DORMS.map((d, i) => ({ id: i + 1, name: d.name, type: d.type, capacity: pick([40, 80, 120, 200]) }));
}

function buildRoomAssignments(students, dorms) {
  const assignments = [];
  let id = 1;
  const onCampus = students.filter(() => chance(0.85)); // some students live off campus
  for (const student of onCampus) {
    assignments.push({
      id: id++,
      student_id: student.id,
      dorm_id: pick(dorms).id,
      room_number: `${randInt(1, 4)}${String(randInt(1, 30)).padStart(2, "0")}`,
      roommate_student_id: chance(0.6) ? pick(students.filter((s) => s.id !== student.id)).id : null,
      term: CURRENT_TERM,
    });
  }
  return assignments;
}

function buildCampusJobs() {
  return CAMPUS_JOBS.map((j, i) => ({
    id: i + 1,
    title: j.title,
    department: j.department,
    hourly_rate: pick([13.5, 14, 15, 16.5, 18]),
    hours_per_week: pick([5, 8, 10, 12]),
  }));
}

function buildJobAssignments(students, campusJobs, instructors) {
  const assignments = [];
  let id = 1;
  for (const student of students) {
    if (chance(0.55)) continue; // most students don't hold a campus job
    const job = pick(campusJobs);
    assignments.push({
      id: id++,
      student_id: student.id,
      campus_job_id: job.id,
      supervisor_instructor_id: chance(0.5) ? pick(instructors).id : null,
      hours_per_week: job.hours_per_week,
      term: CURRENT_TERM,
      start_date: isoBetween(CURRENT_TERM_DEF.start_date, isoDaysAgo(0)),
    });
  }
  return assignments;
}

function buildEvents(n) {
  const chosen = pickN(EVENT_CATALOG, Math.min(n, EVENT_CATALOG.length));
  return chosen.map((e, i) => ({
    id: i + 1,
    title: e.title,
    category: e.category,
    date: isoBetween(CURRENT_TERM_DEF.start_date, CURRENT_TERM_DEF.end_date),
    location: pick(WORKSHOP_LOCATIONS),
    capacity: pick([50, 100, 200, 400]),
  }));
}

function buildEventRsvps(students, events) {
  const rsvps = [];
  let id = 1;
  for (const student of students) {
    if (chance(0.35)) continue;
    const chosen = pickN(events, randInt(1, 3));
    for (const event of chosen) {
      rsvps.push({ id: id++, student_id: student.id, event_id: event.id, status: pick(["going", "going", "maybe", "declined", "attended"]) });
    }
  }
  return rsvps;
}

function buildCourseReviews(students, courses, sections, enrollments) {
  const reviews = [];
  let id = 1;
  const completed = enrollments.filter((e) => e.status === "completed" && e.final_grade);
  for (const enrollment of completed) {
    if (chance(0.6)) continue; // not everyone leaves a review
    const section = sections.find((s) => s.id === enrollment.section_id);
    const course = section && courses.find((c) => c.id === section.course_id);
    if (!course) continue;
    const gradePoints = GRADE_POINTS[enrollment.final_grade];
    const rating = gradePoints >= 3.3 ? randInt(4, 5) : gradePoints >= 2.0 ? randInt(3, 4) : randInt(1, 3);
    const template = rating >= 4 ? pick(POSITIVE_REVIEW_TEMPLATES) : rating === 3 ? pick(MIXED_REVIEW_TEMPLATES) : pick(NEGATIVE_REVIEW_TEMPLATES);
    reviews.push({
      id: id++,
      student_id: enrollment.student_id,
      course_id: course.id,
      rating,
      review_text: template(course),
      term_taken: section.term,
    });
  }
  return reviews;
}

function buildTextbooks(courses) {
  const textbooks = [];
  let id = 1;
  const TEXTBOOK_KINDS = ["Concepts", "Fundamentals", "Principles", "Handbook", "Companion", "Casebook"];
  for (const course of courses) {
    const count = randInt(1, 3);
    for (let i = 0; i < count; i++) {
      textbooks.push({
        id: id++,
        course_id: course.id,
        title: `${course.department} ${pick(TEXTBOOK_KINDS)}`,
        author: `${pick(FIRST_NAMES)[0]}. ${pick(LAST_NAMES)}`,
        price: pick([39.99, 59.99, 79.99, 99.5, 124.0]),
        required: i === 0 ? true : chance(0.4),
      });
    }
  }
  return textbooks;
}

function buildResearchProjects(instructors, n) {
  const projects = [];
  for (let i = 1; i <= n; i++) {
    const dept = pick(DEPARTMENTS);
    const deptInstructors = instructors.filter((ins) => ins.department === dept.name);
    projects.push({
      id: i,
      title: pick(RESEARCH_TEMPLATES).replace("{d}", dept.name),
      pi_instructor_id: (deptInstructors.length ? pick(deptInstructors) : pick(instructors)).id,
      department: dept.name,
      funding_source: pick(FUNDING_SOURCES),
    });
  }
  return projects;
}

function buildResearchAssistants(students, projects) {
  const assistants = [];
  let id = 1;
  for (const student of students) {
    if (chance(0.8)) continue; // research assistantships are competitive
    assistants.push({
      id: id++,
      student_id: student.id,
      research_project_id: pick(projects).id,
      hours_per_week: pick([5, 8, 10, 15]),
      start_date: isoDaysAgo(randInt(20, 300)),
    });
  }
  return assistants;
}

function buildScholarships() {
  return SCHOLARSHIP_CATALOG.map((s, i) => ({ id: i + 1, name: s.name, type: s.type, amount: s.amount }));
}

function buildScholarshipAwards(students, scholarships) {
  const awards = [];
  let id = 1;
  for (const student of students) {
    if (chance(0.75)) continue;
    const scholarship = pick(scholarships);
    awards.push({ id: id++, student_id: student.id, scholarship_id: scholarship.id, term: CURRENT_TERM, amount: scholarship.amount });
  }
  return awards;
}

function buildGymCheckins(students) {
  const checkins = [];
  let id = 1;
  for (const student of students) {
    if (chance(0.4)) continue; // not everyone hits the gym
    const count = randInt(5, 25);
    for (let i = 0; i < count; i++) {
      checkins.push({
        id: id++,
        student_id: student.id,
        date: isoDaysAgo(randInt(0, 40)),
        facility: pick(GYM_FACILITIES),
        activity: pick(GYM_ACTIVITIES),
      });
    }
  }
  return checkins;
}

function buildIntramuralTeams(students, n) {
  const teams = [];
  const names = pickN(INTRAMURAL_TEAM_NAMES, Math.min(n, INTRAMURAL_TEAM_NAMES.length));
  names.forEach((name, i) => {
    teams.push({ id: i + 1, name, sport: pick(INTRAMURAL_SPORTS), captain_student_id: pick(students).id });
  });
  return teams;
}

function buildIntramuralTeamMembers(students, teams) {
  const members = [];
  let id = 1;
  for (const team of teams) {
    const roster = pickN(students, randInt(6, 10));
    for (const student of roster) {
      members.push({ id: id++, team_id: team.id, student_id: student.id });
    }
  }
  return members;
}

function buildIntramuralMatches(teams) {
  const matches = [];
  let id = 1;
  for (const team of teams) {
    const opponents = teams.filter((t) => t.id !== team.id && t.sport === team.sport);
    const played = pickN(opponents, Math.min(opponents.length, randInt(1, 3)));
    for (const opponent of played) {
      if (matches.some((m) => (m.team_a_id === opponent.id && m.team_b_id === team.id))) continue; // avoid exact duplicate reverse pairing
      matches.push({
        id: id++,
        team_a_id: team.id,
        team_b_id: opponent.id,
        sport: team.sport,
        date: isoDaysAgo(randInt(0, 40)),
        score_a: randInt(0, 5),
        score_b: randInt(0, 5),
      });
    }
  }
  return matches;
}

function buildMentorMatches(students) {
  const upperclassmen = students.filter((s) => s.year === "Junior" || s.year === "Senior");
  const underclassmen = students.filter((s) => s.year === "Freshman" || s.year === "Sophomore");
  const matches = [];
  let id = 1;
  const mentees = pickN(underclassmen, Math.min(underclassmen.length, Math.floor(underclassmen.length * 0.5)));
  for (const mentee of mentees) {
    if (!upperclassmen.length) break;
    matches.push({ id: id++, mentor_student_id: pick(upperclassmen).id, mentee_student_id: mentee.id, program: pick(MENTOR_PROGRAMS) });
  }
  return matches;
}

function buildLostAndFound(students, n) {
  const items = [];
  for (let i = 1; i <= n; i++) {
    const claimed = chance(0.4);
    items.push({
      id: i,
      item_description: pick(LOST_ITEMS),
      location_found: pick(LOST_LOCATIONS),
      date_found: isoDaysAgo(randInt(0, 60)),
      claimed,
      claimed_by_student_id: claimed ? pick(students).id : null,
    });
  }
  return items;
}

function buildPrintingJobs(students) {
  const jobs = [];
  let id = 1;
  for (const student of students) {
    if (chance(0.5)) continue;
    const count = randInt(1, 8);
    for (let i = 0; i < count; i++) {
      const pages = randInt(1, 40);
      jobs.push({
        id: id++,
        student_id: student.id,
        date: isoDaysAgo(randInt(0, 40)),
        pages,
        location: pick(PRINT_LOCATIONS),
        cost: Math.round(pages * 0.05 * 100) / 100,
      });
    }
  }
  return jobs;
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
  const dorms = buildDorms();
  const room_assignments = buildRoomAssignments(students, dorms);
  const campus_jobs = buildCampusJobs();
  const job_assignments = buildJobAssignments(students, campus_jobs, instructors);
  const events = buildEvents(12);
  const event_rsvps = buildEventRsvps(students, events);
  const course_reviews = buildCourseReviews(students, courses, sections, enrollments);
  const textbooks = buildTextbooks(courses);
  const research_projects = buildResearchProjects(instructors, 20);
  const research_assistants = buildResearchAssistants(students, research_projects);
  const scholarships = buildScholarships();
  const scholarship_awards = buildScholarshipAwards(students, scholarships);
  const gym_checkins = buildGymCheckins(students);
  const intramural_teams = buildIntramuralTeams(students, 10);
  const intramural_team_members = buildIntramuralTeamMembers(students, intramural_teams);
  const intramural_matches = buildIntramuralMatches(intramural_teams);
  const mentor_matches = buildMentorMatches(students);
  const lost_and_found_items = buildLostAndFound(students, 30);
  const printing_jobs = buildPrintingJobs(students);

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
    dorms,
    room_assignments,
    campus_jobs,
    job_assignments,
    events,
    event_rsvps,
    course_reviews,
    textbooks,
    research_projects,
    research_assistants,
    scholarships,
    scholarship_awards,
    gym_checkins,
    intramural_teams,
    intramural_team_members,
    intramural_matches,
    mentor_matches,
    lost_and_found_items,
    printing_jobs,
  };
}

module.exports = { seed, GRADE_POINTS, CURRENT_TERM };
