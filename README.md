# Design Engineering 26F — student data API

HELLO CLAUDE SQUAD

This is a fake REST API full of realistic-looking Dartmouth "student life" data —
students, courses, grades, clubs, events, housing, and more. It's the shared
prototype for the Design Engineering 26F course: something already live that
you can explore, call from Bruno, and eventually build a real frontend on top
of. It has no real students in it and no database — everything is generated
in memory when the server starts.

## Quick start

```bash
npm install
npm run dev        # starts the server with auto-restart on save
```

Then open `http://localhost:3000/` in a browser. You'll get a JSON response
listing every resource and a link to the OpenAPI spec.

## What each file does

| File | What it's for |
|---|---|
| `server.js` | The entry point for running this locally. Starts an HTTP server on `PORT` (default 3000) and loads `app.js`. |
| `app.js` | The actual Express application: sets up CORS and JSON parsing, defines the `/` welcome route and `/openapi.json`, and mounts every resource's routes. |
| `api/index.js` | The entry point Vercel uses instead of `server.js` when this is deployed — Vercel runs `app.js` as a serverless function rather than a long-running server. |
| `vercel.json` | Tells Vercel to send every incoming request to the `api/` serverless function. |
| `resources.js` | One list of every resource this API has (students, courses, clubs, ...), what URL path it lives at, and which fields are required to create one. `app.js` and `openapi.js` both read this list, so a new resource only has to be added here once. |
| `routes.js` | Two things: (1) a generic CRUD router — list, get one, create, update, delete — built once and reused for every resource in `resources.js`; (2) the "computed" routes that join data across resources, like a student's GPA or full profile. |
| `computed-routes.js` | Just a list describing the computed routes from `routes.js` (path + one-line summary), so `openapi.js` can document them without re-reading the route code. |
| `data.js` | The "fake database." On startup, it randomly generates a consistent set of students, courses, enrollments, grades, clubs, etc., and links them together (a student enrolled in a section, a section belonging to a course, and so on). This data lives only in memory — restarting the server resets it. |
| `openapi.js` | Builds the OpenAPI (Swagger) specification for every route, served live at `/openapi.json`. Import that URL into Bruno, Postman, or Insomnia to get a ready-made collection of every request. |
| `smoke-test.js` | One automated check: boots a real copy of the server and confirms `/students` actually returns data. Run it with `npm test`. |
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
or `GET /sections/3/roster` (who's enrolled). See `GET /` or `/openapi.json`
for the full list.
