# CLAUDE.md — Wedding Website Design Spec

## About This File

This is the design specification for adinaandrew2026.com. Claude Code should read this file before making ANY changes to the site. All design decisions below are locked and final.

---

## Site Overview

- **Couple:** Adina Nelson & Andrew DeFrank
- **Date:** October 17, 2026
- **Venue:** InterContinental at The Wharf, Washington, DC
- **Repo:** github.com/defrank1/adina-andrew
- **Hosting:** GitHub Pages
- **Live URL:** adinaandrew2026.com
- **Stack:** HTML, CSS, JavaScript (no frameworks)

## Pages

- `index.html` — Homepage (currently minimal, needs redesign as a hub/landing page)
- `savethedate.html` — Save the Date with travel/hotel info — **NO nav, NO footer**
- `registry.html` — Registry with link to Zola
- `rsvp.html` — RSVP form (integrates with Google Sheets via rsvp-workflow/google-apps-script.js)
- `registry-admin.html` — Admin interface for registry tracking

---

## LOCKED DESIGN DECISIONS

These are final. Do not change these without explicit instruction from Andrew.

### Typography

| Role | Font | Notes |
|------|------|-------|
| Titles | PP Playground Medium | Large, expressive, calligraphic |
| Headings / UI | PP Watch Bold | Uppercase, small, structural |
| Body text | Sentient Regular | Never italic. Always `font-style: normal` |

Font files are in `/fonts/`. All three are loaded via `@font-face` in `styles.css`.

Apply `-webkit-font-smoothing: antialiased` and `text-rendering: optimizeLegibility` to `body`.

### Colors

| Name | Value | Usage |
|------|-------|-------|
| Dark green | `#1a3a2e` | Primary color, dark mode background |
| Soft white / cream | `#F1EDEA` | Light mode background |
| Accent | `#2d5a4a` | Hover gradients, subtle variation |

CSS custom properties: `--color-dark-green`, `--color-soft-white`, `--color-accent`

### Dark Mode

- Supported on all pages (except `savethedate.html`)
- Toggle via button with hand-drawn sun/moon icon (PNG swap)
- Icon swaps: `data-light` / `data-dark` attributes on `<img>` tags
- Images that change: monogram, illustrations, toggle icon
- Dark mode preference saved to `localStorage`
- Theme switching disables transitions momentarily (`theme-transitioning` class on body)

### Layout — All Pages

- Centered, vertically stacked content
- `content-wrapper` constrains content width (~680–700px)
- Illustrations centered, not floated
- Body text centered
- CTA buttons centered

### Grain Texture

- Grain scrolls with page content (feels like paper)
- Implementation: `background-image` directly on `body` — NOT a pseudo-element, NOT fixed
- `background-size: 400px 400px; background-repeat: repeat`
- Dark mode swaps to `grain-dark.png`
- Grain is consistent across entire page — no seams, no z-index interference

### Password Protection

- Each page has its own password overlay
- Registry password: `beautifulsuperstar`
- Save the Date password: `october17`
- Session storage remembers unlock state within a session

### Navigation

- **Style:** Floating SVG pill frame — `vectors/floating-header-green.svg` (light) / `vectors/floating-header-white.svg` (dark)
- **Desktop (above 900px):** Monogram (left) · Menu button (right)
- **Mobile (below 900px):** Monogram (left) · Menu button (right) — same as desktop, no reordering
- **Monogram:** Large, 72px tall (desktop), 56px tall (mobile) — links to homepage (`/`)
- **Menu button:** Plain text ("Menu" / "Close"), no border, no background — styled in PP Watch, uppercase — sits inside the SVG pill visually
- **`savethedate.html` has NO nav**

### Menu Dropdown

- Grows from Menu button with scale animation
- `transform-origin: top left`
- Cubic-bezier easing: `(0.34, 1.56, 0.64, 1)` for slight overshoot
- `border-radius: 12px` on the dropdown card
- Page content and footer fade to `opacity: 0.4` when menu is open
- Clicking outside or pressing a link closes the menu
- Links: Save the Date, Registry, RSVP

### CTA Buttons (e.g., "Visit Our Registry", "Visit Website")

- Pill shape: `border-radius: 25px`
- Filled style: dark green background + white text (light mode), reversed in dark mode
- Hover: gradient sweep to inverse color (`flashGradient` / `flashGradientDark` keyframes)
- `:active` state: `transform: translateY(0)` (presses flat)
- PP Watch font, uppercase, small size
- `text-shadow: none` on buttons

### Footer

- **Style:** No border, no background — transparent, floating text
- **Content:** Info text ("Adina & Andrew · October 17, 2026 · Washington, DC") left · Dark/light toggle right
- Info text: PP Watch, very small, low opacity
- Toggle: icon + label ("Dark Mode" / "Light Mode")
- **Below 900px:** Info text stacks to three centered lines (separators hidden, each line on its own), toggle remains right-aligned
- **`savethedate.html` has NO footer**

### Dark/Light Toggle

- Located in footer, right-aligned
- Hand-drawn PNG icon (sun/moon), swaps on toggle
- Label text swaps: "Dark Mode" ↔ "Light Mode"

### Text Emboss/Shadow Effect

- Keep the emboss: `text-shadow` with light and dark offsets on body
- Light mode: `0 2px 3px rgba(255, 255, 255, 0.9), 0 -1px 1px rgba(26, 58, 46, 0.1)`
- Dark mode: `0 1px 2px rgba(255, 255, 255, 0.2), 0 2px 5px rgba(0, 0, 0, 0.5)`
- Buttons have `text-shadow: none`

### Button Hover Animation

- Gradient sweep to inverse color
- Light mode buttons: `flashGradient` (sweeps green → green gradient → white fill)
- Dark mode buttons: `flashGradientDark` (sweeps white → cream gradient → dark green fill)

### Illustration Sizing

- Desktop: ~250px wide
- Mobile: ~175–180px wide
- Centered, `display: block`, `margin: 0 auto`

### Responsive Breakpoint

- Single meaningful breakpoint at `900px`
- Above 900px: desktop layout
- Below 900px: mobile layout
- `flex-wrap: nowrap` on nav — elements NEVER stack vertically

### Shared Nav/Footer

- All pages (except `savethedate.html`) use the same nav and footer HTML/styles
- Shared styles in `styles.css`
- Page-specific overrides in each page's `<style>` block

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
├── fonts/                  (PP Playground, PP Watch, Sentient)
├── images/
│   ├── textures/           (grain.png, grain-dark.png)
│   ├── illustrations/      (Dupont, dark-mode-button, light-mode-button)
│   ├── Monogram/           (monogram-green.png, monogram-white.png)
│   └── names/              (names-image.png, names-image-dark.png)
└── vectors/                (floating-header-green.svg, floating-header-white.svg, rowhouse.svg, etc.)
```

### Key CSS Architecture

- Grain: `background-image` on `body` directly (scrolls with page)
- Nav: `.main-nav` is `pointer-events: none` (full width, transparent); `.nav-content` is `pointer-events: all` (pill area only)
- Dark mode: `body.dark-mode` in `styles.css` handles all global dark styles; page-specific dark overrides in inline `<style>` blocks
- No z-index stacking hacks needed — grain is body background, never overlays content
