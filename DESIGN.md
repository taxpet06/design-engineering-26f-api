---
name: Club Finder (The Marked-Up Catalog)
description: A fair-day club catalog you annotate by hand: green masthead, cool newsprint, ballpoint pen marks, highlighter on matches, red stamp for deadlines.
colors:
  green: "#00693e"
  green-deep: "#0b3a29"
  on-green: "#eef5ef"
  paper: "#e9ede8"
  sheet: "#f6f8f4"
  ink: "#14201a"
  soft: "#566359"
  rule: "#c4cdc5"
  pen: "#1b3fae"
  highlighter: "#f3df4a"
  stamp: "#b3261e"
  good: "#14683f"
  green-dark: "#46b985"
  green-deep-dark: "#0a251b"
  on-green-dark: "#e8f2ea"
  paper-dark: "#0e1512"
  sheet-dark: "#131b17"
  ink-dark: "#e5ece6"
  soft-dark: "#9aab9f"
  rule-dark: "#28382f"
  pen-dark: "#92a9ff"
  highlighter-dark: "#6c6310"
  stamp-dark: "#ff8f84"
  good-dark: "#6fd6a2"
typography:
  headline:
    fontFamily: "Bitter, Rockwell, Roboto Slab, Georgia, serif"
    fontSize: "1.9rem"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.015em"
  masthead:
    fontFamily: "Bitter, Rockwell, Roboto Slab, Georgia, serif"
    fontSize: "1.7rem"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Bitter, Rockwell, Roboto Slab, Georgia, serif"
    fontSize: "1.2rem"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 600
  facts:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.88rem"
    fontWeight: 400
    fontFeature: "tnum"
rounded:
  sm: "3px"
  md: "6px"
  tab: "8px"
  sheet: "14px"
  pill: "99px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "18px"
  lg: "36px"
components:
  button-primary:
    backgroundColor: "{colors.green}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 18px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.green-deep}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 18px"
    height: "44px"
  input:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
    height: "44px"
  chip:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "2px 14px"
    height: "36px"
  chip-selected:
    backgroundColor: "{colors.green}"
    textColor: "#ffffff"
  nav-tab-current:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tab}"
    padding: "10px 16px 13px"
  catalog-mark:
    textColor: "{colors.pen}"
    rounded: "{rounded.pill}"
    size: "52px"
  stamp:
    textColor: "{colors.stamp}"
    rounded: "{rounded.sm}"
    padding: "0 6px"
  panel:
    backgroundColor: "{colors.sheet}"
    rounded: "{rounded.md}"
    padding: "0 14px"
---

# Design System: Club Finder (The Marked-Up Catalog)

## Overview

**Creative North Star: "The Marked-Up Catalog"**

The app is the fair-day catalog you annotate by hand, not a card-grid directory. A deep Dartmouth-green masthead with index tabs sits over cool newsprint; every club is a dense ruled entry, and the student's choices are pen marks: a ballpoint circle around the catalog number to save, a strike-through on the name for "Not for me", highlighter behind terms that explain a match, a red stamp for deadlines and conflicts.

Density is catalog-like: one ruled column of unequal, information-rich entries (number, name, description, flags, facts), never equal-weight cards. Calm and legible for a nervous first-year on a phone; color is spent on meaning (pen = yours, highlighter = why, stamp = urgent), not decoration. Not an official Dartmouth product; the green is a collegiate reference only.

**Key Characteristics:**
- Green masthead with a folder-tab index; the active tab merges into the page.
- Ruled entries under a 2px ink rule; circled catalog number at left, facts column at right on wide screens.
- Slab serif (Bitter) for names and headings, grotesque (Archivo) for UI and facts, tabular numerals for numbers.
- Flat: depth from rules and tonal sheet-on-paper, shadows only on overlays.
- Full light and dark themes through `prefers-color-scheme`, same roles, retuned values.

## Colors

Cool, green-tinted newsprint with green-black ink; four semantic mark colors, each with one job.

### Primary
- **Dartmouth Green** (#00693e light, #46b985 dark): filled buttons, selected chips and segments, links, checkbox accents, text caret, masthead underline.
- **Masthead Deep Green** (#0b3a29 light, #0a251b dark): masthead ground and button hover. On-green text is #eef5ef / #e8f2ea.

### Secondary
- **Ballpoint Pen** (#1b3fae light, #92a9ff dark): the student's own marks. Circled catalog number, strike-through, saved button state, focus ring, input focus border, link hover.

### Tertiary
- **Highlighter** (#f3df4a light, #6c6310 dark): background wash behind matched terms and text selection. Dark value is a muted olive so ink text stays readable.
- **Stamp Red** (#b3261e light, #ff8f84 dark): deadlines (rotated -1.2deg bordered stamp) and over-capacity load segments.
- **Good Green** (#14683f light, #6fd6a2 dark): positive flags such as "open to all" text.

### Neutral
- **Newsprint** (#e9ede8 / #0e1512): page ground (`paper`).
- **Sheet** (#f6f8f4 / #131b17): inputs, panels, dialog, chips; a lighter sheet on the paper.
- **Green-Black Ink** (#14201a / #e5ece6): body and heading text, catalog top rule, toast ground.
- **Soft Ink** (#566359 / #9aab9f): secondary text, labels, fact terms.
- **Rule** (#c4cdc5 / #28382f): hairlines, input borders, entry dividers.

### Named Rules
**The Four Marks Rule.** Pen is the student's action, highlighter is a reason for a match, stamp is a deadline or conflict, green is the system. A color never takes another's job.
**The Cool Paper Rule.** The ground is green-tinted newsprint, never cream or warm white.

## Typography

**Display / Heading Font:** Bitter (Rockwell, Roboto Slab, Georgia, serif), weights 400/600/800 loaded from Google Fonts.
**Body / UI Font:** Archivo (Helvetica Neue, Arial, sans-serif), weights 400-700.

**Character:** A sturdy collegiate slab for names against a plain working grotesque for facts. Numbers are always tabular.

### Hierarchy
- **Masthead** (800, 1.7rem, 1.1; 1.45rem at <=480px): site title, with the school name at weight 400 and 0.8 opacity.
- **Headline** (800, 1.9rem, 1.15, -0.015em, balanced; 1.6rem at <=480px): page section titles. Dialog title 1.6rem.
- **Title** (700, 1.1rem; 1.2rem for catalog entry names; 1.35rem for band headings): club names, band headings.
- **Body** (400, 16px, 1.5): descriptions capped at 70ch. Reasons ("why") 0.9rem.
- **Label** (600, 0.85rem, soft ink): field labels, fact terms (0.78rem), flags (0.85rem). Fieldset legends use Bitter 700 at 1rem. No uppercase, no letterspaced labels.
- **Facts** (400, 0.88rem, tabular numerals): meets, hours, cost, how to join.

### Named Rules
**The Slab Names Rule.** Club names and headings are Bitter; everything operational is Archivo.
**The Tabular Rule.** Catalog numbers, counts, hours and costs use tabular numerals.

## Layout

Single centered column, max-width 1080px, 20px side padding (16px at <=480px). Browse is a two-column grid at >=860px: sticky 250px filter rail (top 16px) and a flexible catalog column, 36px gap. Below 860px the rail collapses into a Filters disclosure under search. Entries are a grid: 44px mark and body on phones with facts stacked below in two columns; at >=720px a 52px mark, body, and 190px facts column separated by a left hairline. Vertical rhythm: 18px entry padding, 36px main top padding, 34px above band headings, 14px toolbar margins. Forms cap at 700px. Tap targets are 44px (36px for checks and chips). Print shows only the saved list: no masthead or controls, 30px square checkbox in place of the number.

## Elevation & Depth

Flat by default. Depth comes from tonal sheets on newsprint, hairline rules, and a heavier 2px ink rule heading each catalog. Shadows exist only on overlays that sit above the page.

### Shadow Vocabulary
- **Detail sheet** (`box-shadow: -12px 0 32px rgba(10,30,20,.22)`; phone bottom sheet `0 -8px 30px rgba(10,30,20,.25)`): the club dialog, over a `rgba(10,25,18,.5)` backdrop.
- **Toast** (`box-shadow: 0 6px 20px rgba(0,0,0,.28)`): transient undo message.

### Named Rules
**The Flat Page Rule.** Nothing on the page itself casts a shadow; only the dialog and toast do.

## Shapes

Modest, paper-like geometry. Controls, inputs, panels and the segmented control use a 6px radius; small stamps 3px; folder tabs round only their top corners (8px 8px 0 0); the phone sheet rounds its top corners 14px; chips and counts are full pills; the catalog mark is a circle. Separation is by 1px rules, not boxes. The kind marker in flags is a small filled green square (Serious) or hollow square (Fun).

## Components

### Buttons
- **Shape:** 6px radius, 44px min height, 8px 18px padding, weight 600 at 0.95rem.
- **Primary:** Dartmouth Green fill, white text (dark theme: #07140d text on the lighter green). Hover darkens to Masthead Deep Green; active nudges down 1px; 150ms color transition.
- **Secondary:** transparent, ink text, rule border; hover fills with sheet.
- **Text / link:** no box; green underlined text, hover turns pen blue. Saved state of the save button is transparent with pen text and border.

### Chips and segmented control
- Pill chips on sheet with rule border; checked fills green. Removable pills carry a 28px circular close button. The segmented control is a 6px-radius joined bar with a green checked segment. Focus uses the 3px pen outline.

### Inputs / Fields
- Sheet fill, 1px rule border, 6px radius, 10px 12px padding, 44px min height for search and select. Focus shifts the border to pen and adds the 3px pen outline (offset 2px). Disabled: 0.5 opacity.

### Navigation
- Masthead tab index in Archivo 500 (700 when current), on-green text at 0.85 opacity; hover adds a white 10% wash. The current tab takes the paper color and overlaps the masthead's 4px green underline so it joins the page. Saved tab carries a tabular count pill. Scrolls horizontally on narrow screens.

### Catalog Entry (signature)
- Ruled row: circled-number mark, Bitter name (underline sweeps in on hover), description, reason line with highlighter on matched terms, flags row, facts. The mark is a 44-52px circle button holding the soft tabular number and a hand-drawn SVG ring; hover draws the ring partway (stroke offset .7, opacity .45), pressed draws it fully in pen blue over 400ms. "Not for me" strikes the name through in pen and fades the entry to 0.45 opacity (350ms).

### Stamp, Load Bar, Panels
- Stamp: stamp-red bold text with a 1.5px border, 3px radius, rotated -1.2deg. Load bar: row of 14px segments, green when used, stamp red when over. Panels and banners: sheet fill, rule border, 6px radius.

### Detail Dialog and Toast
- Right-edge sheet 520px wide on desktop sliding in 250ms; bottom sheet on phones (<=640px). Toast: ink ground, paper text, 6px radius, undo link in highlighter (dark theme: deep green). Reduced motion collapses all transitions to ~0.

## Do's and Don'ts

### Do:
- **Do** keep the page on newsprint (#e9ede8 / #0e1512) with sheet fills (#f6f8f4 / #131b17) for inputs and panels.
- **Do** use pen blue for anything the student did, highlighter only behind explanation, stamp red only for deadlines and conflicts.
- **Do** build lists as ruled entries under a 2px ink rule, with tabular numerals for numbers and facts.
- **Do** keep targets at 44px (36px minimum for dense checks) and the 3px pen focus outline.
- **Do** respect `prefers-color-scheme` and `prefers-reduced-motion`; verify AA contrast in both themes.

### Don't:
- **Don't** render clubs as equal-size cards or a gray screen with a single accent.
- **Don't** use cream or warm grounds; the paper stays cool and green-tinted.
- **Don't** use stamp red for decoration or non-urgent states.
- **Don't** add shadows to on-page elements; only overlays lift.

### Not canonized (defects/drift the build carries)
- The Saved tab count pill uses highlighter yellow as a plain badge, contradicting the Four Marks Rule; treat it as drift, not precedent.
