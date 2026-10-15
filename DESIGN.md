---
name: Third Course
description: An academic term planner with a highlighted third course.
colors:
  green: "#00693E"
  dark-green: "#004F2F"
  surface: "#FFFFFF"
  ink: "#151A17"
  pale: "#F3F6F4"
  border: "#DDE6DF"
  muted: "#526158"
  error: "#9C3528"
  control-border: "#b8c9bc"
  notice: "#E8F1EC"
  success: "#e5f1e9"
  third-support: "#dcf1e5"
typography:
  display:
    fontFamily: "Manrope, sans-serif"
    fontSize: "42px"
    fontWeight: 700
    lineHeight: 1.22
    letterSpacing: "-.025em"
  headline:
    fontFamily: "Manrope, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-.025em"
  title:
    fontFamily: "Manrope, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-.025em"
  body:
    fontFamily: "'Source Sans 3', sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "'Source Sans 3', sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.3
rounded:
  event: "5px"
  control: "6px"
  navigation: "8px"
  notice: "10px"
  panel: "12px"
  dialog: "14px"
  form: "16px"
spacing:
  tight: "8px"
  small: "12px"
  row: "16px"
  panel: "22px"
  section: "24px"
  workspace: "32px"
  gutter: "40px"
components:
  button-primary:
    backgroundColor: "{colors.green}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 15px"
  button-primary-hover:
    backgroundColor: "{colors.dark-green}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.green}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 15px"
  button-secondary-hover:
    backgroundColor: "{colors.pale}"
  search-input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px"
    height: "46px"
  navigation-button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.navigation}"
    padding: "9px 16px"
  subject-chip:
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "9px 10px"
  subject-chip-selected:
    backgroundColor: "{colors.pale}"
    textColor: "{colors.dark-green}"
  plan-slot:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "{spacing.panel}"
  third-slot:
    backgroundColor: "{colors.green}"
    textColor: "{colors.surface}"
    rounded: "{rounded.panel}"
    padding: "{spacing.panel}"
  schedule-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "{spacing.panel}"
  course-dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.dialog}"
    width: "min(620px, calc(100vw - 32px))"
---

# Design System: Third Course

## Overview

**Creative North Star: "The academic term plan"**

Third Course is a green, white and black academic workspace. Three prominent course positions lead the planner; the third position carries the strongest green emphasis. Quiet supporting surfaces keep course comparisons, explanations and the weekly timetable readable. The interface uses plain student-facing language and keeps prototype/demo labeling visible.

This document records the implemented direct-in-code direction. Locally served type, restrained borders and purposeful state feedback support desktop and mobile planning. Imagery, decorative illustration, gradients, hero statistics and unrelated marketing are outside the confirmed direction.

**Key Characteristics:**

- Three visible course positions with a highlighted third.
- White panels, pale page surfaces and green actions.
- Compact comparisons with readable schedule and requirement progress.
- Visible keyboard focus and reduced-motion support.

## Colors

The palette uses one green accent family and quiet neutrals. Frontmatter values are normative; the sidecar carries metadata and extensions.

### Primary

- **Academic Green** (`green`): brand mark, primary actions, course codes, selected controls, third slot and third timetable events.
- **Deep Green** (`dark-green`): primary hover and supporting green text.
- **Soft Green Notice** (`notice`), **Success Tint** (`success`) and **Third-slot Support** (`third-support`): prototype/status notices, completed-plan/rank treatments and secondary text inside the highlighted slot.

### Neutral

- **White Surface** (`surface`) and **Pale Page** (`pale`): panels and page foundation.
- **Near-black Ink** (`ink`) and **Muted Green-gray** (`muted`): primary and supporting information.
- **Quiet Border** (`border`) and **Control Border** (`control-border`): panel/list divisions and stronger field outlines.

Error red (`error`) is reserved for validation, ineligible sections and unmet demo prerequisites. Constraint and storage-warning surfaces have contextual warm tints; these are status treatments, not additional brand accents.

**The Third-position Rule.** Preserve the green third slot in both empty and selected states; its timetable events repeat that emphasis.

## Typography

**Display and heading font:** Manrope, sans-serif fallback, locally served weights 600 and 700.
**Interface and body font:** Source Sans 3, sans-serif fallback, locally served weights 400 and 600.

Manrope gives headings a compact, confident character; Source Sans 3 keeps controls, explanations and course information readable. Headings balance wrapping and use the frontmatter's tight tracking. Body size is contextual rather than a rigid global scale.

- **Display:** profile introduction; desktop frontmatter role, stepping to 34px and then 30px on smaller screens.
- **Headline:** planner title; steps to 27px below the workspace breakpoint.
- **Title:** course titles; section headings use 22px, profile form headings 23px and dialog headings 28px on desktop.
- **Body:** common explanations and course metadata; 14px supporting labels, 16–19px introductory copy and 13px footnotes also occur. Introductory prose is bounded to 42ch; empty-state prose to 60ch.
- **Label:** sentence-case actions and search labels; profile field labels use 16px. Course codes and ranking values remain distinct from headings.

Meeting times, scores and timetable hour labels use tabular numerals. Keep small timetable text accompanied by the readable schedule summary below it.

## Layout

The shell is centered at a maximum width of 1320px, with 40px desktop side padding. Main padding is 38px 40px 56px. The white header, compact navigation and centered prototype strip precede the working surface.

The planner has three equal columns with a 16px gap. Desktop slots have 22px padding and a 222px minimum height. Below them, recommendations and timetable/progress share a 1.12:1 workspace with a 32px gap. Recommendations are ruled rows rather than nested cards. The profile uses a 0.85:1.15 introduction/form split with a 72px gap; its major and term fields share a row.

- At 1050px, planner gaps and panel padding tighten.
- At 950px, the profile gap becomes 32px and its display heading becomes 34px.
- At 800px, the planner workspace becomes one column; the three slots remain alongside each other and the planner title becomes 27px.
- At 700px, the profile becomes one column, the decorative numbered process hides and the main profile action fills its row.
- At 600px, shell gutters become 16px, navigation stacks, course slots stack, the term control fills the width and dialog facts become one column. The planner order remains plan, recommendations, timetable and progress.
- At 380px, major and term fields stack. The page's supported minimum width is 320px.

The timetable has a 390px-high plotting area and a 320px minimum internal width; weekend columns raise that minimum to 520px. Scroll inside the schedule rather than overflowing the page. Course pickers and completed-course lists have bounded internal scrolling.

## Elevation & Depth

The workspace is flat at rest. White/pale tonal separation, light borders and ruled rows provide structure without card shadows. The course-detail dialog alone rises above the workspace with a soft shadow (`0 20px 70px rgb(0 35 20 / 20%)`) and a dark translucent backdrop (`rgb(10 30 19 / 45%)`).

**The Quiet-surface Rule.** Use borders and tonal separation for ordinary panels; reserve elevation for the modal detail surface.

## Shapes

Controls and subject chips have gently rounded corners (6px), navigation buttons slightly softer corners (8px), and plan/timetable panels larger corners (12px). Status banners use 10px, the native detail dialog 14px and the profile form 16px. Timetable events and removable completed-course tags use 5px. Ranking and profile-step markers are circular; schedule legend marks are small squares. Ordinary panel and field borders are 1px.

## Components

### Buttons and navigation

Primary buttons are green with white text; secondary buttons are white with green text and a green border. Planner actions are at least 44px high; profile actions are 46px high with 10px 18px padding. Text actions are underlined and retain clear action labels. Header actions are white with quiet borders; below 600px they stack and reduce to a 36px minimum height.

On hover-capable devices, primary actions darken and secondary actions turn pale. Buttons transition transform and background color over 160ms with ease-out; pressing enabled buttons scales them to .98. Reduced-motion preference removes transitions, animations and press transforms. Disabled buttons reduce opacity to .55 and use a not-allowed cursor.

### Inputs and subject chips

Searches and profile fields are white, 46px-high controls with stronger green-gray outlines and 6px corners. Search placeholders use the muted text color. Native checkboxes keep green accent coloring. Subject chips wrap naturally; selection adds a green border, pale fill and dark-green text, alongside the checked control. Completed-course selections remain removable tags.

### Course plan and recommendations

The first two slots use white surfaces; the third uses Academic Green with white headings/actions and light-green supporting text. Each slot has a position label, inspectable course identity, meeting information and removal/detail actions. Invalid selections remain visible with an error border and explicit explanation; error text inside the third slot stays white.

Ranked recommendations use a circular rank marker, green course code, Manrope title, separate ranking value, meeting metadata, readable reasons and paired detail/add actions. Keep rank values labeled as scores. Constraint and empty states provide specific recovery actions beside their explanations.

### Timetable and requirement progress

The schedule is a white bordered panel. Fine grid lines, compact time labels and pale-green first/second events support the darker third event. Every event opens details; a course/time summary below the grid repeats the information in readable text. Requirement progress uses compact ruled rows, separate Completed/Potential/Remaining/Needs review labels and persistent source and Needs review context.

### Course details and focus

Details use a native modal dialog with a 620px maximum width, viewport margins, internal scrolling and a visible Close action. Facts form two columns on desktop and one on mobile. Escape and backdrop click close the dialog; body scrolling is locked while it is open and focus returns to its opener.

Keyboard focus uses a 3px green outline with a 4px offset. Controls within the green third slot use a white outline so focus remains visible. The skip link appears on focus, and changing profile/planner views moves focus to the main workspace. Preserve native dialog focus behavior and explicit validation/status semantics.

## Do's and Don'ts

### Do:

- **Do** preserve the highlighted third course and its matching timetable emphasis.
- **Do** keep the two selected courses visible during recommendation comparison.
- **Do** keep source dates and unresolved conditions readable beside academic information.
- **Do** preserve visible focus, contrast, readable schedule summaries and reduced-motion behavior.
- **Do** use quiet borders and ruled rows to organize dense information.

### Don't:

- **Don't** add decorative illustration, gradients, hero statistics or unrelated marketing.
- **Don't** give ordinary panels modal-style shadows.
- **Don't** depend on color alone to communicate selection, invalidity or requirement progress.
- **Don't** shrink the timetable to force every label into a narrow mobile column; preserve internal scrolling and its text summary.


### Official course bundles
Every slot represents one course bundle. Display all component meetings and keep X-hours distinct with dashed borders and text labels. Source links, retrieval dates, and effective dates belong near the facts they support. Needs review is a separate, searchable list; unresolved source conditions never become recommendation confidence scores. Missing official pins remain visible with remove/change guidance.
