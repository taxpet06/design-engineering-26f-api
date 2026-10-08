# Graph Report - design-engineering-26f-api  (2026-10-08)

## Corpus Check
- Corpus is ~8,796 words - fits in a single context window. You may not need a graph.

## Summary
- 159 nodes · 320 edges · 10 communities (9 shown, 1 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Seed Data Constants
- Express App & Routing
- README & Architecture Docs
- Package Config
- Entity Builders A
- Entity Builders B
- Relationship Builders
- Review & Log Builders
- Submission Builders

## God Nodes (most connected - your core abstractions)
1. `seed()` - 38 edges
2. `pick()` - 33 edges
3. `randInt()` - 23 edges
4. `chance()` - 18 edges
5. `pickN()` - 15 edges
6. `isoDaysAgo()` - 14 edges
7. `isoBetween()` - 10 edges
8. `rand` - 8 edges
9. `buildEnrollments()` - 7 edges
10. `buildDiscussionPosts()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Design Engineering 26F Session 1 slides` --conceptually_related_to--> `Design Engineering 26F student data API`  [INFERRED]
  slides/session-1-slides.pdf → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Resource registry drives routes, app and OpenAPI spec** — readme_resources_js, readme_routes_js, readme_app_js, readme_openapi_js [EXTRACTED 0.95]

## Communities (10 total, 1 thin omitted)

### Community 0 - "Seed Data Constants"
Cohesion: 0.04
Nodes (44): ASSIGNMENT_QUESTION_TEMPLATES, BOOKS, buildScholarships(), CAMPUS_JOBS, CLUB_CATALOG, CLUB_MEETING_DAYS, COURSE_TEMPLATES, CURRENT_TERM_DEF (+36 more)

### Community 1 - "Express App & Routing"
Cohesion: 0.10
Nodes (23): app, { buildOpenApiSpec }, cors, db, express, { resourceRouter, mountComputedRoutes }, RESOURCES, { seed } (+15 more)

### Community 2 - "README & Architecture Docs"
Cohesion: 0.09
Nodes (16): api/index.js (Vercel entry point), app.js (Express application), Bruno API client, data.js (in-memory fake database), Design Engineering 26F student data API, Exploring the data (filter, sort, paginate, computed endpoints), openapi.js (OpenAPI spec at /openapi.json), Quick start (npm install, npm run dev) (+8 more)

### Community 3 - "Package Config"
Cohesion: 0.12
Nodes (16): dependencies, cors, express, description, engines, node, main, name (+8 more)

### Community 4 - "Entity Builders A"
Cohesion: 0.29
Nodes (15): buildAnnouncements(), buildAssignments(), buildCampusJobs(), buildClubs(), buildDorms(), buildEnrollments(), buildEvents(), buildInstructors() (+7 more)

### Community 5 - "Entity Builders B"
Cohesion: 0.24
Nodes (12): buildClubMemberships(), buildCourses(), buildDiningVisits(), buildDiscussionPosts(), buildIntramuralTeamMembers(), buildLostAndFound(), buildPrintingJobs(), buildResearchAssistants() (+4 more)

### Community 6 - "Relationship Builders"
Cohesion: 0.29
Nodes (7): buildEventRsvps(), buildIntramuralMatches(), buildIntramuralTeams(), buildLibraryCheckouts(), buildMentorMatches(), buildWorkshopRegistrations(), pickN()

### Community 7 - "Review & Log Builders"
Cohesion: 0.33
Nodes (6): buildCourseReviews(), buildGymCheckins(), buildRoomAssignments(), buildScholarshipAwards(), buildTextbooks(), chance()

### Community 8 - "Submission Builders"
Cohesion: 0.67
Nodes (3): buildSubmissions(), buildWellnessLogs(), rand

## Knowledge Gaps
- **75 isolated node(s):** `express`, `cors`, `{ seed }`, `{ resourceRouter, mountComputedRoutes }`, `RESOURCES` (+70 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 82 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `express` connect `Package Config` to `Express App & Routing`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._
- **What connects `express`, `cors`, `{ seed }` to the rest of the system?**
  _75 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Seed Data Constants` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._
- **Why does `seed()` connect `Entity Builders A` to `Seed Data Constants`, `Express App & Routing`, `Entity Builders B`, `Relationship Builders`, `Review & Log Builders`, `Submission Builders`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **Should `Express App & Routing` be split into smaller, more focused modules?**
  _Cohesion score 0.10052910052910052 - nodes in this community are weakly interconnected._
- **Why does `cors` connect `Package Config` to `Express App & Routing`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Should `README & Architecture Docs` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._