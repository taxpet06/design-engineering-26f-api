# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML/CSS/JS in one file (`app.html`), served by the existing Express app at `/app`. No build step, no framework.

## Users

Dartmouth students looking for clubs, workshops and events that fit their interests. Older students may only want to record the clubs they are already in.

## Product Purpose

Dalí GSS recommends one club, workshop or event from a short interest quiz (a skill tree), using answers from an identity survey and an academic/club survey. Right now it is a course demo (Design Engineering 26F / DALI) built on the fake lists from the student data API. It is meant to grow to real and larger lists later, so categories, mappings and eligibility rules live in data tables, not in code tied to specific items.

## Constraints

- Build spec: `dali-gss-spec.md` (design tokens, tree geometry, icons, copy).
- Data: `GET /clubs`, `/events`, `/workshops` from the spec's API; departments are inlined.
- Survey answers stay in the browser (localStorage) until a real profile store exists.
- Sensitive questions are optional with "Prefer not to answer", which never excludes anything.
- Hard eligibility filters apply only through explicit rules; none exist in the current data.
