# Design Engineering 26F — student data API

This repository includes **Side Quest**, a responsive activity-discovery app,
alongside the fake REST API full of realistic-looking Dartmouth "student life"
data. Side Quest turns suitable clubs, events, workshops, study groups, and
intramural teams into concrete quests, then combines them with verified
Dartmouth activities and a small curated college bucket list.

The API remains a teaching prototype: it has no real students or database, and
its generated data resets whenever the server starts.

## Quick start

```bash
npm install
npm run dev        # starts the server with auto-restart on save
```

Then open `http://localhost:3000/` for Side Quest.

- `http://localhost:3000/api-info` — API resource overview
- `http://localhost:3000/openapi.json` — generated OpenAPI specification

The app uses meaningful paths: `/`, `/quests`, `/leaderboard`, and `/settings`.

## Side Quest architecture

The frontend is buildless HTML, CSS, and JavaScript served by Express. No UI
framework or client dependency was added.

| Frontend file | Responsibility |
|---|---|
| `public/js/catalog.js` | Curated tasks plus normalization and validation of API records |
| `public/js/recommendations.js` | Weighted ranking, diversity, exclusion, and replacement selection |
| `public/js/storage.js` | Versioned browser-state contract and local persistence |
| `public/js/api.js` | API resource adapter with per-resource error handling |
| `public/js/components.js` | Accessible DOM components for each page |
| `public/js/app.js` | Routing, state transitions, and application coordination |

Repository-generated activities carry a subtle **Prototype** label and an
explanation that they may not represent real opportunities. Verified activities
use official Dartmouth-owned sources. Past dated prototype activities are
filtered out.

Recommendations are ranked rather than shuffled. Explicit interests and tags
from upvoted or saved quests raise related activities; downvotes are a stronger
negative signal; replacements add a smaller category penalty; and recent
categories receive a diversity penalty. A deterministic exploration value keeps
some variety without making results unstable. Completed and dismissed quest IDs
are excluded.

Preferences, votes, saved quests, dismissals, and completion history are stored
in `localStorage`. The storage, API, and ranking layers expose narrow interfaces
so authenticated server-backed implementations can replace them later. The MVP
leaderboard contains only the local user and personal votes are never described
as community scores.

### MVP limitations

- State is limited to one browser and is removed if site data is cleared.
- There is no authentication, shared voting, or multiuser leaderboard yet.
- Prototype API records are synthetic and may change after a server restart.
- Generated API records do not include official external URLs.

## Tests

```bash
npm test
```

The suite covers existing CRUD/computed API behavior, Side Quest page delivery,
ranking changes, exclusion and replacement, normalization, stale records,
persistence, and vote toggling.

## What each file does

| File | What it's for |
|---|---|
| `server.js` | The entry point for running this locally. Starts an HTTP server on `PORT` (default 3000) and loads `app.js`. |
| `app.js` | The Express application: serves Side Quest, CORS/JSON middleware, `/api-info`, `/openapi.json`, and every resource route. |
| `api/index.js` | The entry point Vercel uses instead of `server.js` when this is deployed — Vercel runs `app.js` as a serverless function rather than a long-running server. |
| `vercel.json` | Tells Vercel to send every incoming request to the `api/` serverless function. |
| `resources.js` | One list of every resource this API has (students, courses, clubs, ...), what URL path it lives at, and which fields are required to create one. `app.js` and `openapi.js` both read this list, so a new resource only has to be added here once. |
| `routes.js` | Two things: (1) a generic CRUD router — list, get one, create, update, delete — built once and reused for every resource in `resources.js`; (2) the "computed" routes that join data across resources, like a student's GPA or full profile. |
| `computed-routes.js` | Just a list describing the computed routes from `routes.js` (path + one-line summary), so `openapi.js` can document them without re-reading the route code. |
| `data.js` | The "fake database." On startup, it randomly generates a consistent set of students, courses, enrollments, grades, clubs, etc., and links them together (a student enrolled in a section, a section belonging to a course, and so on). This data lives only in memory — restarting the server resets it. |
| `openapi.js` | Builds the OpenAPI (Swagger) specification for every route, served live at `/openapi.json`. Import that URL into Bruno, Postman, or Insomnia to get a ready-made collection of every request. |
| `smoke-test.js` | Boots a real server and verifies API behavior and Side Quest page delivery. Run it with `npm test`. |
| `package.json` / `package-lock.json` | Lists the two dependencies (`express`, `cors`) and the npm scripts (`start`, `dev`, `test`). |
| `.gitignore` | Keeps `node_modules/` and the local `.vercel/` folder out of git. |
| `.vercel/` | Created automatically when this folder is linked to a Vercel project. Not committed — see `.vercel/README.txt`. |

## Why there's no database

This is a teaching sandbox for learning how to design and call an API, not a
project that needs data to survive a restart. Postgres (or another real
database) is something the course adds deliberately in a later session, once
persistence actually matters.

## Exploring the data

Every resource supports the same pattern:

- `GET /students` — list them all
- `GET /students?year=Senior` — filter by any field
- `GET /students?sort=last_name&order=desc` — sort
- `GET /students?page=2&limit=20` — paginate
- `GET /students/7` — get one by id
- `POST` / `PUT` / `PATCH` / `DELETE` — create, replace, partially update, delete

There are also "computed" endpoints that combine multiple resources into one
useful answer, like `GET /students/7/profile` (everything about one student)
or `GET /sections/3/roster` (who's enrolled). See `/api-info` or `/openapi.json`
for the full list.
