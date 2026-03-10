# CLAUDE.md — Wedding Website Design Spec

## About This File

This is the design specification for adinaandrew2026.com. Claude Code should read this file before making ANY changes to the site. All design decisions below are locked and final unless Andrew explicitly says otherwise.

Last updated: March 9, 2026

---

## Site Overview

- **Couple:** Adina Nelson & Andrew DeFrank
- **Date:** October 17, 2026
- **Venue:** InterContinental at The Wharf, Washington, DC
- **Repo:** github.com/defrank1/adina-andrew
- **Hosting:** GitHub Pages
- **Live URL:** adinaandrew2026.com
- **Stack:** HTML, CSS, JavaScript (no frameworks)
- **Local dev path:** ~/Desktop/wedding-website
- **Claude Code alias:** `cc` (opens Claude Code in the project directory)

## Pages

- `index.html` — Homepage (currently minimal, needs redesign as a hub/landing page)
- `savethedate.html` — Save the Date with travel/hotel info — **NO nav, NO footer** — `<body class="page-savethedate">`
- `registry.html` — Registry with link to Zola (`adinaandandrew2026` — double "and" is correct) — `<body class="page-registry">`
- `rsvp.html` — RSVP form (integrates with Google Sheets via rsvp-workflow/google-apps-script.js)

---

## LOCKED DESIGN DECISIONS

These are final. Do not change these without explicit instruction from Andrew.

### Typography

| Role | Font | Notes |
|------|------|-------|
| Titles | PP Playground Medium | Large, expressive, calligraphic |
| Headings / UI | PP Watch Bold | Uppercase, small, structural |
| Body text | Sentient Regular | **Never italic.** Always `font-style: normal` |

Font files are in `/fonts/`. All three are loaded via `@font-face` in `styles.css`.

Apply `-webkit-font-smoothing: antialiased` and `text-rendering: optimizeLegibility` to `body`.

**Important:** The project was originally planned with Canora, Akzidenz-Grotesk, and Mrs Eaves. Those are NOT the fonts in use. PP Playground, PP Watch, and Sentient are the actual, final fonts. Do not reference or revert to the old font names.

### Colors

| Name | Value | Usage |
|------|-------|-------|
| Dark green | `#1a3a2e` | Primary color, dark mode background |
| Soft white / cream | `#F1EDEA` | Light mode background |
| Accent | `#2d5a4a` | Hover gradients, subtle variation |

CSS custom properties: `--color-dark-green`, `--color-soft-white`, `--color-accent`

### Dark Mode

- Supported on all pages (except `savethedate.html`, which has a standalone toggle but no nav/footer)
- Toggle via button with hand-drawn sun/moon icon (PNG swap)
- Icon swaps: `data-light` / `data-dark` attributes on `<img>` tags
- Images that change: monogram, illustrations, toggle icon
- Dark mode preference saved to `localStorage`
- Theme switching disables transitions momentarily (`theme-transitioning` class on body)

### Layout — All Pages

- Centered, vertically stacked content
- `content-wrapper` constrains content width (~680px globally; registry page overrides to 700px)
- Illustrations centered, not floated
- Body text centered
- CTA buttons centered

### Grain Texture

- Grain scrolls with page content (feels like paper)
- Implementation: `background-image` directly on `body` — NOT a pseudo-element, NOT fixed
- `background-size: 400px 400px; background-repeat: repeat`
- Dark mode swaps to `grain-dark.png`
- Grain is consistent across entire page — no seams, no z-index interference
- Password overlay uses solid `background-color` + `::before` pseudo-element to recreate grain over the opaque overlay

### Password Protection

- Each page has its own password overlay
- Registry password: `beautifulsuperstar`
- Save the Date password: `october17`
- Session storage remembers unlock state within a session

### Navigation

- **Style:** Fixed transparent nav bar with hairline `border-bottom`
- **Desktop (above 900px):** Monogram (left) · Menu button (right)
- **Mobile (below 900px):** Monogram (left) · Menu button (right) — same as desktop, no reordering
- **Monogram:** Large, 72px tall (desktop), 56px tall (mobile) — links to homepage (`/`)
- **Menu button:** Bordered pill button — PP Watch, uppercase, `border: 2px solid`, `border-radius: 25px`, transparent background — fills on hover with gradient sweep animation
- **`savethedate.html` has NO nav**

**Note:** An earlier version of this spec described a floating SVG pill frame (`vectors/floating-header-green.svg` / `floating-header-white.svg`) with a borderless Menu label. That was never implemented. The current bordered-pill-button approach is the locked design. The SVG pill assets may still exist in `/vectors/` but are not referenced by any page.

### Menu Dropdown

- Grows from Menu button with scale animation
- `transform-origin: top left`
- Cubic-bezier easing: `(0.34, 1.56, 0.64, 1)` for slight overshoot
- `border-radius: 12px` on the dropdown card
- Semi-transparent background: light mode `rgba(241, 237, 234, 0.95)`, dark mode `rgba(26, 58, 46, 0.95)`
- Page content and footer fade to `opacity: 0.4` when menu is open
- Clicking outside or pressing a link closes the menu
- Links: Save the Date, Registry, RSVP

### CTA Buttons

Two button styles exist:

**`.btn-priority`** — Filled by default (e.g., "Visit Our Registry")
- Pill shape: `border-radius: 25px`
- Dark green fill + white text (light mode); cream fill + dark green text (dark mode)
- Hover: gradient sweep reveals transparent background
- PP Watch font, uppercase, small size
- `text-shadow: none`

**`.btn-normal`** — Outlined by default (e.g., "Visit Website" on save-the-date hotels)
- Same pill shape and font
- Transparent background, dark green border + text (light mode); cream border + text (dark mode)
- Hover: gradient sweep fills with solid color
- `text-shadow: none`


### Footer

- **Style:** No border, no background — transparent, floating text
- **Content:** Info text ("Adina & Andrew · October 17, 2026 · Washington, DC") · Dark/light toggle
- Info text: PP Watch, very small (`0.55rem`), low opacity (`0.4` light / `0.35` dark)
- Toggle: hand-drawn icon + label ("Dark Mode" / "Light Mode")
- **Desktop (above 900px):** Info text left, toggle right (flex row, `space-between`)
- **Mobile (below 900px):** Everything stacks vertically and centers — info text wraps to three lines (separators hidden), toggle below, all centered
- **`savethedate.html` has NO footer** (but has a standalone dark mode toggle at page bottom)

### Text Emboss/Shadow Effect

- `text-shadow` with light and dark offsets on body
- Light mode: `0 2px 3px rgba(255, 255, 255, 0.9), 0 -1px 1px rgba(26, 58, 46, 0.1)`
- Dark mode: `0 1px 2px rgba(255, 255, 255, 0.2), 0 2px 5px rgba(0, 0, 0, 0.5)`
- Buttons and nav links have `text-shadow: none`

### Button Hover Animation

- Gradient sweep effect using `background-size: 300% 100%` and `background-position` shift
- Light mode: `flashGradient` keyframes (sweeps green → accent → transparent)
- Dark mode: `flashGradientDark` keyframes (sweeps cream → light cream → transparent)

### Illustration Sizing

- Desktop: ~200px max-width
- Mobile: ~175–180px max-width
- Centered, `display: block`, `margin: 0 auto`
- `object-fit: contain`
- Light/dark variants via `data-light` / `data-dark` attributes
- Drop-shadow filter: light mode uses white/dark-green shadows, dark mode uses black/white shadows

### Responsive Breakpoint

- Single breakpoint at `900px` — no other media queries in styles.css
- Above 900px: desktop layout
- Below 900px: mobile layout, including all font-size scaling and spacing adjustments
- `flex-wrap: nowrap` on nav — elements NEVER stack vertically
- Note: `rsvp-styles.css` retains its own 768px breakpoint (separate file, separate scope)

### Shared Nav/Footer

- All pages (except `savethedate.html`) use the same nav and footer HTML
- Nav and footer are loaded via `fetch()` from `includes/nav.html` and `includes/footer.html`
- `includes/site-init.js` injects the includes and initializes dark mode + menu toggle
- Pages use `<div id="nav-placeholder">` and `<div id="footer-placeholder">` as injection targets
- Shared styles in `styles.css`; page-specific styles scoped with body class (e.g., `body.page-registry`)

---

## IMPLEMENTATION NOTES

### File Structure

```
/
├── styles.css              (global styles — shared across all pages)
├── rsvp-styles.css         (RSVP-specific styles)
├── registry.html
├── savethedate.html        (NO nav, NO footer)
├── rsvp.html
├── index.html
├── CLAUDE.md               (this file — design spec)
├── includes/
│   ├── nav.html            (shared nav markup — injected via fetch)
│   ├── footer.html         (shared footer markup — injected via fetch)
│   └── site-init.js        (dark mode init + toggle + menu toggle logic)
├── fonts/                  (PP Playground, PP Watch, Sentient)
├── images/
│   ├── favicon.png
│   ├── textures/           (grain.png, grain-dark.png)
│   ├── illustrations/      (Dupont, dark-mode-button, light-mode-button)
│   ├── Monogram/           (monogram-green.png, monogram-white.png)
│   └── names/              (names-image.png, names-image-dark.png)
├── vectors/                (rowhouse.svg, rowhouse-dark.svg, floating-header-*.svg [unused], etc.)
└── rsvp-workflow/          (google-apps-script.js)
```

### Key CSS Architecture

- Grain: `background-image` on `body` directly (scrolls with page)
- Nav: `.main-nav` is `position: fixed`, transparent background, hairline `border-bottom`
- Dark mode: `body.dark-mode` in `styles.css` handles all global dark styles; page-specific dark overrides scoped with body class (e.g., `body.page-registry .registry-illustration`)
- No z-index stacking hacks needed — grain is body background, never overlays content
- `#protected-content` is `display: none` by default; `.unlocked` defaults to `flex` column in styles.css; `body.page-savethedate` overrides to `display: block`
- Page body classes (`page-registry`, `page-savethedate`) scope page-specific styles in styles.css — no inline `<style>` blocks needed


---

## GUIDING PRINCIPLES

- **"Does this feel personally crafted, or template-like?"** — the test for every page
- **"Emotionally coherent" over "visually impressive"** — warmth and intentionality matter more than flashiness
- Describe visual/structural changes before implementing them
- Flag technical tradeoffs clearly
- Do not make changes to styles.css without considering impact on ALL pages that use it
- Read existing file state before proposing changes — never assume
