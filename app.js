const express = require("express");
const cors = require("cors");
const path = require("node:path");
const { seed } = require("./data");
const { resourceRouter, mountComputedRoutes } = require("./routes");
const RESOURCES = require("./resources");
const { buildOpenApiSpec } = require("./openapi");

const db = seed();
const app = express();
app.set("trust proxy", true); // Vercel terminates TLS upstream; trust X-Forwarded-Proto for req.protocol
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"), { index: false }));

app.get("/api-info", (_req, res) => {
  res.json({
    name: "Design Engineering 26F — student data API",
    resources: Object.keys(db),
    docs: "GET each resource for a list, /:id for one. Joined views: /students/:id/profile (everything about one student), /schedule, /grades, /gpa, /transcript, /history, /workshops, /clubs, /wellness/summary; /sections/:id/roster, /sections/:id/discussion; /workshops/:id/roster; /courses/:id/rating; /events/:id/attendees; /intramural-teams/:id/record.",
    openapi: "/openapi.json — import this into Bruno/Postman/Insomnia to get every endpoint as a ready-made collection",
  });
});

const sendSideQuest = (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html"));
app.get(["/", "/quests", "/leaderboard", "/settings"], sendSideQuest);

app.get("/openapi.json", (req, res) => {
  res.json(buildOpenApiSpec(`${req.protocol}://${req.get("host")}`));
});

for (const resource of RESOURCES) {
  app.use(resource.path, resourceRouter(db, resource.key, { required: resource.required }));
}

mountComputedRoutes(app, db);

app.use((_req, res) => res.status(404).json({ error: "no such route" }));

module.exports = app;
