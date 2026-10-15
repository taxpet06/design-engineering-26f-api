# Dalí Design Engineering — GSS Spec

Build spec for a website that recommends clubs, workshops and events to college students based on an interest quiz.

> **Notes from conversion.** These fix typos and gaps in the source PDF. Check them before you build.
> - "Robotico Mono" in the source means **Roboto Mono**.
> - The source says "seven branches" and "eight lines". It lists **8 branches**, so build 8.
> - The source labels branch 8 "Leadership", the same as branch 7. It is assumed to be **Social**, because the spec mentions a Social branch and a Social sub-page.
> - The Social page section says "when the user selects the recreation branch". It means the **Social** branch.
> - The Departments list has no API endpoint, so it is inlined below.
> - The Workshop / Event explore page is not specified in the source (it was left blank).

---

## 1. Purpose

Build a website that pulls data from these endpoints:

- `GET https://api-backend-zeta-five.vercel.app/clubs`
- `GET https://api-backend-zeta-five.vercel.app/events`
- `GET https://api-backend-zeta-five.vercel.app/workshops`

It uses that data to recommend events, workshops and clubs to college students based on how they answer an interest quiz.

**Layout:** a main view panel plus a side panel with three tabs:
1. **Interest Tree**: the skill-tree quiz
2. **Current Stats**: academic and club survey
3. **Identity**: demographics survey

**Quiz flow:**
- Icons for the interest areas branch out from a center point, like a skill tree.
- When the user clicks a branch, the camera moves to it and new branches expand from it. The new branches ask clarifying questions for that interest area.
- After **two rounds** of expansion, the tree lands on a final recommendation: one club, workshop or event. Show its date, meeting time, location and other relevant details.

**Plan / TODO from source:**
- [ ] Write up the plan
- [ ] Page explaining what the app does
- [ ] Identity selection page
- [ ] Skill tree function
- [ ] Use the Impeccable design skill

---

## 2. Global design tokens

| Token | Value |
|---|---|
| Background (dark green) | `#023020` |
| "White" (wherever the spec says white) | `#f2f5f3` |
| Card / box fill (light green) | `#eaf5e4` |
| Input default | `#ffffff` |
| Input saved / hover gray | `#D3D3D3` |
| Clicked / selected circle | dark gray (the icon must stay visible) |
| Icon color | dark green |
| Body font | Roboto |
| Skill-tree font | Roboto Mono |

Keep the color scheme consistent on every page.

---

## 3. Identity tab (demographics survey)

- Start with a short explanation of the survey: its answers are used to suggest activities. Add a disclaimer that the user can edit their answers later.
- A **Next** button opens the survey.
  - Next to it, add a **Skip survey** button. It is meant for older students who only want to enter the clubs they are already in.
- The survey asks for defining characteristics: gender, race, class year and so on.
  - Every sensitive question offers **"Prefer not to answer"**.
  - Answers are used as **hard filters**. For example, a man should not get emails from women's club sports.
- Store the answers in the browser (localStorage). They are combined later with the Current Stats survey to build a user profile.

---

## 4. Current Stats tab (academic and club survey)

**Header** (page-wide): "What are your current academic and extra-curricular interests?"
Use Roboto 18pt in `#eaf5e4`.

**Questions.** Each one sits in its own rounded-rectangle box, in this order, with the exact text shown:
1. `Intended major:`
2. `Minor (optional):`
3. `Other academic interests:`
4. `Current club commitments:`

**Every field is a typeahead search.**
- Major, minor and other academic interests suggest from `departments[].name` (see §8).
- Current club commitments suggests from `clubs[].name`.

**Design details:**
- Page background is `#023020`. Each box is `#eaf5e4` with rounded corners, and the search field sits inside the box.
- The search field starts at `#ffffff`.
- When the user clicks a suggestion or presses Enter:
  - save the value,
  - change the field to `#D3D3D3`,
  - move focus to the next question's field.
- Fonts are all Roboto in black: search text is 12pt, and question labels are 13pt bold.
- When the user moves on, the finished question's box **shrinks**. The current question's box **expands** to fit the search field and 3–4 suggestions.

---

## 5. Interest Tree tab (skill tree)

**Canvas:** background `#023020`.

**Star:** 8 evenly spaced lines radiate from the center. Each line is 549px long, 3px wide and white (`#f2f5f3`), and ends in a circle of radius 147px.

**Branches.** Each circle has a centered dark-green icon. On hover, the circle turns `#D3D3D3` and shows its label centered, in white Roboto Mono. The label must fit inside the circle, so shrink the font if needed.

| # | Icon | Label | Label size |
|---|---|---|---|
| 1 | Cartoon gears | Tech | 18pt |
| 2 | Open book silhouette | Academic | 15pt |
| 3 | Cartoon briefcase | Career | 18pt |
| 4 | Running man facing right | Recreation | 15pt |
| 5 | Paintbrush tilted 10° right, layered over a comedy/tragedy mask | Arts | 18pt |
| 6 | Two hands shaking | Service | 18pt |
| 7 | Megaphone outline | Leadership | 15pt |
| 8 | Outline of a group of three people | Social *(assumed)* | 15pt |

**Click:** the circle turns dark gray and the icon stays visible.
**Recreation** and **Social** each open their own sub-page (see §6).
**Done button:** sits below the figure. It is a white, rounded button with the text "Done" in dark-green Roboto Mono 18pt.

### Category mapping (for building recommendations)

The branch names line up with the `category` values in the API data:

| Branch | Clubs | Events | Workshops |
|---|---|---|---|
| Tech | — | — | Technical |
| Academic | Academic | — | — |
| Career | — | Career | Career |
| Recreation | Recreation | — | Wellness *(Wellness sub-branch)* |
| Arts | Arts | — | Creative |
| Service | Service | — | — |
| Leadership | — | — | Leadership |
| Social | — | Social, Concert, Cultural, Speaker | — |

---

## 6. Sub-pages

Both sub-pages share these rules:
- Background `#023020`.
- An invisible **"Back"** button sits in the top-left corner, in white Roboto Mono 15pt. It returns to the skill tree.
- Every circle is white with radius 300px and a centered dark-green icon.
- On hover, the circle turns `#D3D3D3` and shows its label in white Roboto Mono 18pt. Shrink the label to fit if needed.
- On click, the circle turns dark gray and the icon stays visible.

### Recreation page — 2 circles side by side

| Position | Icon | Label |
|---|---|---|
| Left | Heart | Wellness |
| Right | Basketball, volleyball and football, overlapping | Sports |

### Social page — 4 circles in a 2×2 grid

| Position | Icon | Label |
|---|---|---|
| Top-left | Dartmouth "D" | Social |
| Top-right | Microphone | Concert |
| Bottom-left | Outline of a person speaking | Speaker |
| Bottom-right | Outline of the globe | Cultural |

---

## 7. Dashboard (main page and other tabs)

The style matches the rest of the site.

- **Main page:** lists the user's current club commitments. Clicking one expands it to show its description and meeting times.
- **Club explore:**
  - Lists suggested clubs, based on the user's current clubs and their quiz interests.
  - A search bar above the list filters clubs by name (substring match).
  - Keyword/category chips filter the list to one category.
- **Workshop / Event explore:** *not specified in source.*
- **Change survey results:** lists each survey question with the user's previous answer, and lets them edit it.

---

## 8. Data

### Departments (no endpoint, so use this inline data)

```json
[
  {"id": 1,  "name": "Computer Science",               "code": "COSC"},
  {"id": 2,  "name": "Mathematics",                    "code": "MATH"},
  {"id": 3,  "name": "Biology",                        "code": "BIOL"},
  {"id": 4,  "name": "Economics",                      "code": "ECON"},
  {"id": 5,  "name": "English",                        "code": "ENGL"},
  {"id": 6,  "name": "Physics",                        "code": "PHYS"},
  {"id": 7,  "name": "Psychological & Brain Sciences", "code": "PBS"},
  {"id": 8,  "name": "History",                        "code": "HIST"},
  {"id": 9,  "name": "Studio Art",                     "code": "ART"},
  {"id": 10, "name": "Engineering Sciences",           "code": "ENGS"},
  {"id": 11, "name": "Government",                     "code": "GOVT"},
  {"id": 12, "name": "Chemistry",                      "code": "CHEM"}
]
```

### Clubs — `GET /clubs`

Schema: `{ id: number, name: string, category: "Academic"|"Recreation"|"Arts"|"Service", meeting_day: string, meeting_time: "HH:MM-HH:MM" }`

```json
[
  {"id": 1,  "name": "Design Engineering Club",  "category": "Academic",   "meeting_day": "Tue", "meeting_time": "15:20-16:10"},
  {"id": 2,  "name": "Robotics Team",            "category": "Academic",   "meeting_day": "Wed", "meeting_time": "09:05-09:55"},
  {"id": 3,  "name": "Debate Society",           "category": "Academic",   "meeting_day": "Fri", "meeting_time": "13:10-14:00"},
  {"id": 4,  "name": "Outing Club",              "category": "Recreation", "meeting_day": "Fri", "meeting_time": "15:20-16:10"},
  {"id": 5,  "name": "A Cappella Group",         "category": "Arts",       "meeting_day": "Thu", "meeting_time": "15:20-16:10"},
  {"id": 6,  "name": "Investment Club",          "category": "Academic",   "meeting_day": "Thu", "meeting_time": "15:20-16:10"},
  {"id": 7,  "name": "Effective Altruism",       "category": "Service",    "meeting_day": "Wed", "meeting_time": "15:20-16:10"},
  {"id": 8,  "name": "Climbing Club",            "category": "Recreation", "meeting_day": "Tue", "meeting_time": "10:10-11:00"},
  {"id": 9,  "name": "Film Society",             "category": "Arts",       "meeting_day": "Sun", "meeting_time": "08:00-08:50"},
  {"id": 10, "name": "Data Science Club",        "category": "Academic",   "meeting_day": "Sun", "meeting_time": "15:20-16:10"},
  {"id": 11, "name": "Community Tutoring Corps", "category": "Service",    "meeting_day": "Sun", "meeting_time": "08:00-08:50"},
  {"id": 12, "name": "Ceramics Guild",           "category": "Arts",       "meeting_day": "Sun", "meeting_time": "08:00-08:50"},
  {"id": 13, "name": "Ultimate Frisbee",         "category": "Recreation", "meeting_day": "Fri", "meeting_time": "13:10-14:00"},
  {"id": 14, "name": "Model UN",                 "category": "Academic",   "meeting_day": "Thu", "meeting_time": "11:15-12:05"}
]
```

### Events — `GET /events`

Schema: `{ id: number, title: string, category: "Speaker"|"Social"|"Cultural"|"Concert"|"Career", date: "YYYY-MM-DD", location: string, capacity: number }`

```json
[
  {"id": 1,  "title": "Alumni Panel: Life After Dartmouth", "category": "Speaker",  "date": "2026-10-16", "location": "Top of the Hop",        "capacity": 100},
  {"id": 2,  "title": "Winter Carnival Kickoff",            "category": "Social",   "date": "2026-09-19", "location": "Alumni Hall",           "capacity": 400},
  {"id": 3,  "title": "Homecoming Bonfire",                 "category": "Social",   "date": "2026-09-15", "location": "Alumni Hall",           "capacity": 400},
  {"id": 4,  "title": "Comedy Night",                       "category": "Social",   "date": "2026-11-09", "location": "Alumni Hall",           "capacity": 50},
  {"id": 5,  "title": "Film Screening: Student Shorts",     "category": "Cultural", "date": "2026-09-18", "location": "Top of the Hop",        "capacity": 400},
  {"id": 6,  "title": "Fall Concert Series",                "category": "Concert",  "date": "2026-10-11", "location": "Top of the Hop",        "capacity": 50},
  {"id": 7,  "title": "Poetry Slam",                        "category": "Cultural", "date": "2026-10-02", "location": "Alumni Hall",           "capacity": 100},
  {"id": 8,  "title": "Guest Speaker: Tech Ethics",         "category": "Speaker",  "date": "2026-10-10", "location": "Fahey Lounge",          "capacity": 200},
  {"id": 9,  "title": "Career Fair",                        "category": "Career",   "date": "2026-10-23", "location": "Class of 1930 Room",    "capacity": 50},
  {"id": 10, "title": "Guest Speaker: Climate Policy",      "category": "Speaker",  "date": "2026-10-31", "location": "Class of 1930 Room",    "capacity": 50},
  {"id": 11, "title": "International Food Festival",        "category": "Cultural", "date": "2026-09-23", "location": "Class of 1930 Room",    "capacity": 50},
  {"id": 12, "title": "A Cappella Jam",                     "category": "Concert",  "date": "2026-10-27", "location": "Faulkner Recital Hall", "capacity": 100}
]
```

### Workshops — `GET /workshops`

Schema: `{ id: number, title: string, category: "Career"|"Leadership"|"Creative"|"Technical"|"Wellness", facilitator: string, date: "YYYY-MM-DD", location: string, capacity: number, description: string }`

Every description follows the pattern `"A hands-on session on <title lowercased>, open to all students."`, so descriptions are left out below.

```json
[
  {"id": 1,  "title": "Resume Review Night",                    "category": "Career",     "facilitator": "Elena Dubois",    "date": "2026-11-17", "location": "Fahey Lounge",          "capacity": 30},
  {"id": 2,  "title": "Conflict Resolution for Group Projects", "category": "Leadership", "facilitator": "Freya Moreno",    "date": "2026-11-06", "location": "Faulkner Recital Hall", "capacity": 15},
  {"id": 3,  "title": "Intro to Watercolor",                    "category": "Creative",   "facilitator": "Aisha Chen",      "date": "2026-10-15", "location": "Top of the Hop",        "capacity": 20},
  {"id": 4,  "title": "Figma for Non-Designers",                "category": "Technical",  "facilitator": "Owen Rossi",      "date": "2026-09-23", "location": "Class of 1930 Room",    "capacity": 40},
  {"id": 5,  "title": "Podcasting 101",                         "category": "Creative",   "facilitator": "Marcus Haddad",   "date": "2026-11-11", "location": "Fahey Lounge",          "capacity": 20},
  {"id": 6,  "title": "Negotiating Your First Offer",           "category": "Career",     "facilitator": "Zoe Nguyen",      "date": "2026-10-30", "location": "Alumni Hall",           "capacity": 40},
  {"id": 7,  "title": "Intro to Woodworking",                   "category": "Creative",   "facilitator": "Theo Petrov",     "date": "2026-11-09", "location": "Class of 1930 Room",    "capacity": 20},
  {"id": 8,  "title": "Mindfulness & Finals Week",              "category": "Wellness",   "facilitator": "Wren Bianchi",    "date": "2026-11-03", "location": "Top of the Hop",        "capacity": 40},
  {"id": 9,  "title": "Resilience & Time Management",           "category": "Wellness",   "facilitator": "Wren Sorensen",   "date": "2026-09-22", "location": "Alumni Hall",           "capacity": 20},
  {"id": 10, "title": "Sleep Hygiene for Students",             "category": "Wellness",   "facilitator": "Maya Okonkwo",    "date": "2026-11-15", "location": "Alumni Hall",           "capacity": 40},
  {"id": 11, "title": "Intro to Networking (the human kind)",   "category": "Career",     "facilitator": "Anaya Takahashi", "date": "2026-09-24", "location": "Faulkner Recital Hall", "capacity": 20},
  {"id": 12, "title": "Hackathon Prep: Git & Teams",            "category": "Technical",  "facilitator": "Yara Kessler",    "date": "2026-11-10", "location": "Class of 1930 Room",    "capacity": 30},
  {"id": 13, "title": "LinkedIn Headshots + Branding",          "category": "Career",     "facilitator": "Elena Dlamini",   "date": "2026-10-20", "location": "Faulkner Recital Hall", "capacity": 20},
  {"id": 14, "title": "Leading Without a Title",                "category": "Leadership", "facilitator": "Freya Romero",    "date": "2026-09-19", "location": "Faulkner Recital Hall", "capacity": 20},
  {"id": 15, "title": "Building a Personal Website",            "category": "Technical",  "facilitator": "Ethan Petrov",    "date": "2026-10-29", "location": "Top of the Hop",        "capacity": 40},
  {"id": 16, "title": "Public Speaking Bootcamp",               "category": "Career",     "facilitator": "Yara Santos",     "date": "2026-09-22", "location": "Faulkner Recital Hall", "capacity": 20},
  {"id": 17, "title": "Intro to Investing",                     "category": "Career",     "facilitator": "Miles Sorensen",  "date": "2026-09-21", "location": "Faulkner Recital Hall", "capacity": 15},
  {"id": 18, "title": "Pottery & Stress Relief",                "category": "Creative",   "facilitator": "Sofia Kessler",   "date": "2026-10-10", "location": "Top of the Hop",        "capacity": 40}
]
```
