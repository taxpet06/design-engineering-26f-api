const RESOURCES = require("./resources");
const COMPUTED_ROUTES = require("./computed-routes");

function humanize(key) {
  return key.replace(/_/g, " ");
}

function exampleFor(field) {
  if (field === "email") return "student@dartmouth.edu";
  if (field.endsWith("_id") || field === "id") return 1;
  if (field.endsWith("_date") || field === "date") return "2026-10-01";
  if (field === "credits" || field === "score" || field === "rating" || field === "amount") return 1;
  return "example";
}

function pathParams(path) {
  const ids = [...path.matchAll(/{([^}]+)}/g)].map((m) => m[1]);
  return ids.map((name) => ({ name, in: "path", required: true, schema: { type: "integer" }, description: `${name} of the resource` }));
}

function crudPathsFor(resource) {
  const { path, key, required } = resource;
  const exampleBody = Object.fromEntries(required.map((f) => [f, exampleFor(f)]));
  const paths = {};

  paths[path] = {
    get: {
      tags: [key],
      summary: `List ${humanize(key)}`,
      description: "Supports exact-match filtering by any field as a query param, plus ?sort=, ?order=asc|desc, ?page=, ?limit=.",
      responses: { 200: { description: "A list of matching records", content: { "application/json": { schema: { type: "array", items: { type: "object" } } } } } },
    },
    post: {
      tags: [key],
      summary: `Create a ${humanize(key)} record`,
      requestBody: {
        required: true,
        content: { "application/json": { schema: { type: "object", required, properties: Object.fromEntries(required.map((f) => [f, {}])) }, example: exampleBody } },
      },
      responses: {
        201: { description: "Created", content: { "application/json": { schema: { type: "object" } } } },
        400: { description: "Missing required field(s)" },
      },
    },
  };

  paths[`${path}/{id}`] = {
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
    get: { tags: [key], summary: `Get one ${humanize(key)} record`, responses: { 200: { description: "Found" }, 404: { description: "Not found" } } },
    put: {
      tags: [key],
      summary: `Replace a ${humanize(key)} record`,
      requestBody: { required: true, content: { "application/json": { schema: { type: "object", required }, example: exampleBody } } },
      responses: { 200: { description: "Replaced" }, 400: { description: "Missing required field(s)" }, 404: { description: "Not found" } },
    },
    patch: {
      tags: [key],
      summary: `Partially update a ${humanize(key)} record`,
      requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
      responses: { 200: { description: "Updated" }, 404: { description: "Not found" } },
    },
    delete: { tags: [key], summary: `Delete a ${humanize(key)} record`, responses: { 204: { description: "Deleted" }, 404: { description: "Not found" } } },
  };

  return paths;
}

function computedPathFor(route) {
  return {
    [route.path]: {
      parameters: pathParams(route.path),
      get: {
        tags: ["computed"],
        summary: route.summary,
        responses: { 200: { description: route.summary }, 404: { description: "Not found" } },
      },
    },
  };
}

function buildOpenApiSpec(baseUrl) {
  const paths = {};
  for (const resource of RESOURCES) Object.assign(paths, crudPathsFor(resource));
  for (const route of COMPUTED_ROUTES) Object.assign(paths, computedPathFor(route));

  return {
    openapi: "3.0.3",
    info: {
      title: "Design Engineering 26F — student data API",
      version: "1.0.0",
      description:
        "Fake, seeded student-data REST API for the Design Engineering 26F workshop. Every resource supports full CRUD; " +
        "computed endpoints (tag `computed`) return joined/aggregated views for designing multi-step flows. Data resets on restart.",
    },
    servers: [{ url: baseUrl }],
    paths,
  };
}

module.exports = { buildOpenApiSpec };
