---
name: Wayward
description: European multimodal journey search. Every mode, straight answers.
colors:
  ink: "#0B1630"
  ink-raised: "#16233F"
  ink-line: "#2A3858"
  ink-muted: "#AFC0DA"
  primary: "#C6FF3D"
  lime-press: "#B2EC22"
  lime-wash: "#ECF9C6"
  lime-deep: "#4D7A00"
  paper: "#F6F7F2"
  surface: "#FFFFFF"
  line: "#DCE0DA"
  line-strong: "#B9C0B8"
  text-muted: "#4A5568"
  text-subtle: "#6B7587"
  focus: "#2349B8"
  info-wash: "#EAF0FD"
  ok: "#1D6B43"
  ok-wash: "#E8F5EC"
  warn: "#8A4B00"
  warn-wash: "#FFF3D6"
  danger: "#B42318"
  danger-wash: "#FDECEA"
typography:
  display:
    fontFamily: "Bricolage Grotesque, Inter, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 800
    lineHeight: 1.04
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Bricolage Grotesque, Inter, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  title-lg:
    fontFamily: "Bricolage Grotesque, Inter, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.3
  caption:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.35
  data:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.1
    fontFeature: "tnum"
rounded:
  sm: "6px"
  md: "10px"
  lg: "16px"
  pill: "999px"
spacing:
  "0.5": "4px"
  "1": "8px"
  "2": "16px"
  "3": "24px"
  "4": "32px"
  "6": "48px"
  "8": "64px"
  "12": "96px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.lime-press}"
    textColor: "{colors.ink}"
  button-secondary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
    height: "48px"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
    height: "48px"
  chip-mode:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
    height: "40px"
  chip-mode-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
  card-journey:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "24px"
  panel-trip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "24px"
  badge-price-kind:
    backgroundColor: "{colors.lime-wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  badge-warn:
    backgroundColor: "{colors.warn-wash}"
    textColor: "{colors.warn}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  surface-page:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  card-meta:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-muted}"
  caption-attribution:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-subtle}"
  link-accent:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.lime-deep}"
  divider:
    backgroundColor: "{colors.line}"
    height: "1px"
  input-border:
    backgroundColor: "{colors.line-strong}"
    height: "1px"
  panel-row-on-ink:
    backgroundColor: "{colors.ink-raised}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.md}"
    padding: "16px"
  divider-on-ink:
    backgroundColor: "{colors.ink-line}"
    height: "1px"
  notice-info:
    backgroundColor: "{colors.info-wash}"
    textColor: "{colors.focus}"
    rounded: "{rounded.md}"
    padding: "16px"
  badge-ok:
    backgroundColor: "{colors.ok-wash}"
    textColor: "{colors.ok}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  badge-danger:
    backgroundColor: "{colors.danger-wash}"
    textColor: "{colors.danger}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
---

# Design System: Wayward

## Overview

**Creative North Star: "The Honest Departure Board"**

Wayward reads like the best station departure board you have ever stood under: deep navy, crisp white type, one bright signal colour that tells you where to act. It is a working tool for people mid-decision, so density and scanability beat ornament. Personality lives in the voice, the confident display headings, and the single lime signal, not in decoration.

Every value on screen is either known or labelled as not known. Price kinds, sellers, transfer margins and provider failures are shown as first-class information with their own typographic slots, so uncertainty looks deliberate rather than broken. Modes are peers: they share one icon family and one neutral colour treatment.

**Key Characteristics:**
- Ink navy structure, paper and white work surfaces, lime reserved for the single primary action and current selection.
- Bricolage Grotesque for headings with a point of view; Inter for everything you read or compare, with tabular numerals for times and prices.
- An 8px spacing rhythm, softly rounded containers, quiet ambient shadows.
- Status is colour plus words plus icon, never colour alone.

## Colors

A two-pole palette: ink navy for structure and authority, electric lime as the only signal, warm paper between them.

### Primary
- **Signal Lime** (primary): primary buttons, the active comparison tab marker, selected-state accents on navy. Always carries navy text. Its rarity is the point.
- **Lime Press** (lime-press): hover/active on lime controls.
- **Lime Wash** (lime-wash): quiet highlight behind a recommended pick or a "why this one" reason.
- **Lime Deep** (lime-deep): the only lime-family value allowed as text or icon on light surfaces (5.1:1 on white).

### Secondary
- **Departure Ink** (ink): primary text, navigation bar, trip panel, selected chips.
- **Raised Ink** (ink-raised): cards and inputs that sit on navy panels.
- **Ink Rule** (ink-line): dividers on navy.
- **Ink Mist** (ink-muted): secondary text on navy (9.7:1).

### Neutral
- **Platform Paper** (paper): page background.
- **Ticket White** (surface): cards, inputs, popovers.
- **Rule** (line) and **Rule Strong** (line-strong): hairlines and control borders.
- **Slate** (text-muted): secondary text on light surfaces (7.5:1 on white).
- **Fog** (text-subtle): tertiary metadata only, never body copy (4.65:1 on white).

### Status
- **Route Blue** (focus, info-wash): focus rings and informational notices.
- **Clear Green** (ok, ok-wash): comfortable transfers, confirmed states.
- **Amber Hold** (warn, warn-wash): tight transfers, partial results, stale data, unknowns that matter.
- **Signal Red** (danger, danger-wash): impossible connections, failures, validation errors.

### Named Rules
**The One Signal Rule.** Lime marks the next action or the current selection, nothing else. If two lime elements compete on one screen, one of them is wrong.

**The No Lime Text Rule.** Lime never appears as text or as a thin icon on a light surface (1.2:1). On light surfaces use Lime Deep or put navy text on a lime fill.

**The Words Too Rule.** Every status colour ships with a word and an icon. A red border alone is not an error message.

## Typography

**Display Font:** Bricolage Grotesque (fallback Inter, system-ui)
**Body Font:** Inter (fallback system-ui)

**Character:** Bricolage brings a slightly eccentric, confident grotesque voice to headings and hero prices; Inter does the quiet, precise work of times, labels and conditions.

### Hierarchy
- **Display** (800, 3rem, 1.04): one per page at most, the page's main statement.
- **Headline** (700, 2rem, 1.1): section heads, order and trip totals.
- **Title Large** (700, 1.5rem, 1.2): card prices, step headings.
- **Title** (600, 1.125rem, 1.35): journey card route lines, panel headings.
- **Body** (400, 1rem, 1.5): explanations, conditions, empty states. Max 70ch.
- **Body Small** (400, 0.875rem, 1.45): secondary card details, helper text.
- **Label** (600, 0.8125rem, 1.3): form labels, chips, tabs, badges. Sentence case.
- **Caption** (500, 0.75rem, 1.35): attribution, freshness, fine print.
- **Data** (700, 1.25rem, tabular numerals): departure/arrival times and durations.

### Named Rules
**The Tabular Time Rule.** Times, durations and money always use tabular numerals so columns of departures align.

**The Sentence Case Rule.** No all-caps tracking labels. Labels are sentence case at Label weight.

## Layout

Content sits in a centred container (max 1200px) with 16px gutters on mobile, 24px from 640px and 32px from 1024px. The results screen is a two-column grid from 1024px: results (fluid) and a sticky trip panel (360px). Below 1024px the trip panel becomes a route in the bottom navigation. All spacing comes from the 8px scale (4px only for icon-to-text gaps). Groups inside a card use 8–16px; separate sections use 48–64px. Primary navigation is a top bar from 768px and a fixed bottom bar below it, which reserves 72px of page padding.

## Elevation & Depth

Mostly flat with tonal layering: paper page, white cards, navy panels. Shadows are soft and ambient, used to lift interactive or floating things.

### Shadow Vocabulary
- **Rest** (`0 1px 2px rgba(11,22,48,0.06), 0 1px 1px rgba(11,22,48,0.04)`): cards at rest.
- **Lift** (`0 8px 24px -8px rgba(11,22,48,0.18)`): hovered cards, the search panel.
- **Float** (`0 16px 40px -12px rgba(11,22,48,0.28)`): popovers, combobox listboxes, toasts.

### Named Rules
**The Earned Lift Rule.** A shadow means "this is above the page or can be picked up". Static information does not float.

## Shapes

Softly rounded rectangles: 6px for badges, 10px for controls, 16px for cards and panels, pill only for mode chips and segmented toggles. Borders are 1px hairlines; there are no one-sided accent bars. Journey timelines use a 2px vertical rail with 12px station dots.

## Components

### Buttons
- **Shape:** gently rounded (10px), 48px tall for primary actions, 40px for secondary.
- **Primary:** Signal Lime fill, Departure Ink text, 600 weight. One per view.
- **Secondary:** Departure Ink fill, white text.
- **Ghost:** white fill, 1px Rule Strong border, ink text.
- **Hover / Focus:** 150ms background shift; 2px Route Blue focus ring at 2px offset (lime ring on navy surfaces).
- **Disabled:** 50% opacity with not-allowed cursor and an adjacent reason in words.

### Chips
- **Mode chips:** pill, white with Rule Strong border and a mode icon; selected flips to Departure Ink with white text and a check icon.

### Cards / Containers
- **Journey card:** white, 16px radius, Rest shadow, 24px padding; Lift on hover. Route line in Title, times in Data, price in Title Large with its price-kind badge underneath.
- **Trip panel:** Departure Ink with Raised Ink inner rows, lime only on the checkout action.

### Inputs / Fields
- **Style:** white, 1px Rule Strong border, 10px radius, 48px tall, Label above.
- **Focus:** border becomes Departure Ink plus the Route Blue ring.
- **Error:** Signal Red border, an icon and a message below linked with aria-describedby.

### Navigation
- **Desktop:** navy top bar, white Label links, lime underline for the current route.
- **Mobile:** fixed navy bottom bar with four icon+label items; current item gets a lime pill behind its icon.

### Journey Timeline (signature)
A vertical rail of legs: station dots, times in Data, mode icon and operator per leg, and transfer rows between legs carrying a tight/ok/comfortable badge with a one-line plain-language reason.

## Do's and Don'ts

### Do:
- **Do** pair every price with its kind (live offer, test offer, indicative, historical, tariff range, unknown).
- **Do** write "Unknown" where data is unknown, never a dash that could read as zero.
- **Do** use the lime fill for the one primary action per view, with navy text.
- **Do** keep times and money in tabular numerals.

### Don't:
- **Don't** put lime text or thin lime icons on paper or white.
- **Don't** colour-code transport modes; modes are peers and share one neutral treatment.
- **Don't** use hard offset shadows, gradient text or eyebrow labels above headings.
- **Don't** use emoji or unicode glyphs as icons; use the shared SVG icon set.
