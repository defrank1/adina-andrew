# CLAUDE.md — Wedding Website Design Spec

## About This File

This is the design specification for adinaandrew2026.com. Claude Code should read this file before making ANY changes to the site. All design decisions below are locked and final unless Andrew explicitly says otherwise.

Last updated: March 16, 2026

---

## Site Overview

- **Couple:** Adina Nelson & Andrew DeFrank
- **Date:** October 17, 2026
- **Venue:** InterContinental at The Wharf, Washington, DC
- **Repo:** github.com/defrank1/adina-andrew
- **Hosting:** GitHub Pages
- **Live URL:** adinaandrew2026.com
- **Stack:** HTML, CSS, JavaScript (no frameworks)
- **Local dev path:** ~/Documents/Coding/wedding-website
- **Claude Code alias:** `cc` (opens Claude Code in the project directory)

## Pages

- `index.html` — Homepage (currently minimal, needs redesign as a hub/landing page)
- `savethedate.html` — Save the Date with travel/hotel info — **NO nav, NO footer** — `<body class="page-savethedate">`
- `registry.html` — Registry with link to Zola (`adinaandandrew2026` — double "and" is correct) — `<body class="page-registry">`
- `rsvp.html` — RSVP form (integrates with Google Sheets via rsvp-workflow/google-apps-script.js)

## Hotel Blocks

| Hotel | Walk from venue | Group code | Book by |
|-------|----------------|------------|---------|
| InterContinental (venue) | — | `AAW` | Sep 16, 2026 |
| Canopy by Hilton | 2-3 min | `908` | Sep 16, 2026 |
| Residence Inn | 15-20 min | `NDF` | Sep 18, 2026 |
| citizenM | 12-15 min | No room block | — |

## Meta

- Meta description on all pages: "Adina and Andrew are getting married!"

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

| Name | Variable | Value | Usage |
|------|----------|-------|-------|
| Dark green | `--color-dark-green` | `#1a3a2e` | Primary green — light mode text, borders, buttons, UI elements |
| Dark mode background | `--color-dark-bg` | `#122a20` | Dark mode body + password overlay background only |
| Soft white / cream | `--color-soft-white` | `#F1EDEA` | Light mode body background |
| Accent | `--color-accent` | `#2d5a4a` | Nav link hover color shift + button system accent |
| Nav light fill | — | `#EBE7E3` | Baked into nav diamond PNG (light mode) — between body and old nav tint |
| Nav dark fill | — | `#0e2319` | Baked into nav diamond PNG (dark mode) — darker than body |

**Important:** `--color-dark-green` and `--color-dark-bg` are intentionally separate. `--color-dark-green` is the workhorse color for text and UI across both modes. `--color-dark-bg` is used only for the dark mode body surface — it was too dark for text/buttons but reads better as a background.

The nav diamond's fill colors are baked into the PNG assets (not set via CSS), so they don't have CSS custom properties. If the nav fill colors need to change, re-export the PNGs from Figma.

Old variables `--color-nav-bg`, `--color-nav-bg-dark`, `--color-footer-bg`, and `--color-footer-bg-dark` have been removed — the nav uses PNGs and the footer is transparent.

### Dark Mode

- Supported on all pages (except `savethedate.html`, which has a standalone toggle but no nav/footer)
- Toggle via button with geometric SVG icon in the footer — a circle (sun) that morphs into a crescent (moon) using SMIL path animation. Icon uses `fill="currentColor"` and inherits text color via CSS (no image swap needed). Morph animation is 400ms, matching the color transition timing.
- Icon swaps: `data-light` / `data-dark` attributes on `<img>` tags
- Images that change: monogram, illustrations, nav diamond PNG
- Dark mode preference saved to `localStorage`
- Dark mode body uses `--color-dark-bg` (`#122a20`), NOT `--color-dark-green`
- Dark mode grain overlay gradient uses `rgba(18, 42, 32, 0.75)` (matching `#122a20`)

#### Smooth Transitions

- Color properties transition smoothly via CSS `@property` declarations (~400ms ease)
- Registered properties: `--color-dark-green`, `--color-soft-white`, `--color-dark-bg`, `--color-accent` (and any others used in dark mode switching)
- `:root` has a `transition` rule so all elements using these variables crossfade automatically
- Grain textures and image swaps (PNGs, SVGs) happen **instantly** — no fade on raster/vector assets
- Initial page load does NOT animate — dark mode class is applied before first paint via inline `<script>` in `<head>`
- The old `theme-transitioning` class approach was fully replaced by `@property` — it is no longer used

### Layout — All Pages

- Centered, vertically stacked content
- `content-wrapper` constrains content width (~680px globally; registry page overrides to 700px)
- Illustrations centered, not floated
- Body text centered
- CTA buttons centered

### Grain Texture

- Grain scrolls with page content (feels like paper) — applied directly on `body` via `background-image`
- NOT a pseudo-element, NOT fixed, NOT a single image

#### Implementation

The grain is built from multiple opaque PNG layers composited in Figma using soft-light blend mode. CSS `background-blend-mode: soft-light` replicates this exactly. A `linear-gradient` overlay at `0.75` opacity sits on top of the texture stack to control intensity (texture shows through at ~25% strength). The `background-color` on each element provides the base tint.

**Light mode — 4 layers** (listed bottom to top; CSS `background-image` lists them top to bottom):
1. `paper-grain-light.png` (bottom)
2. `noise-grain-light.png`
3. `paper-grain-light-two.png`
4. `noise-grain-light-two.png` (top)

**Dark mode — 2 layers** (listed bottom to top):
1. `paper-grain-dark.png` (bottom)
2. `noise-grain-dark.png` (top)

All texture files are located in `images/textures/`.

#### CSS Pattern

```css
/* Light mode (on body) */
background-color: var(--color-soft-white);
background-image:
    linear-gradient(rgba(241, 237, 234, 0.75), rgba(241, 237, 234, 0.75)),
    url('images/textures/paper-grain-light.png'),
    url('images/textures/noise-grain-light.png'),
    url('images/textures/paper-grain-light-two.png'),
    url('images/textures/noise-grain-light-two.png');
background-size: 100% 100%, 400px 400px, 400px 400px, 400px 400px, 400px 400px;
background-repeat: no-repeat, repeat, repeat, repeat, repeat;
background-blend-mode: normal, soft-light, soft-light, soft-light, soft-light;

/* Dark mode (on body.dark-mode) */
background-color: var(--color-dark-bg);
background-image:
    linear-gradient(rgba(18, 42, 32, 0.75), rgba(18, 42, 32, 0.75)),
    url('images/textures/paper-grain-dark.png'),
    url('images/textures/noise-grain-dark.png');
background-size: 100% 100%, 400px 400px, 400px 400px;
background-repeat: no-repeat, repeat, repeat;
background-blend-mode: normal, soft-light, soft-light;
```

#### Password Overlay

The password overlay uses a solid `background-color` on `#password-overlay` and a `::before` pseudo-element with the same multi-layer grain stack to recreate the textured surface over the opaque overlay.

#### Key Learnings

- Figma cannot export transparent PNGs from noise layers that use non-Normal blend modes — it silently adds an opaque background
- The solution was exporting each noise layer individually at Normal blend mode, then compositing in CSS
- `background-blend-mode: soft-light` does the exact same math as Figma's soft-light blend
- The `linear-gradient` overlay alpha (0.75) was tuned by hand in Chrome dev tools — changing from 0.3 to 0.75 was confirmed visually by Andrew
- Old `grain.png` and `grain-dark.png` files are no longer used

### Password Protection

- Each page has its own password overlay
- Registry password: `beautifulsuperstar`
- Save the Date password: `october17`
- Session storage remembers unlock state within a session

### Surface Layering

The site uses two visual surfaces to create physical depth:

- **Nav diamond:** A floating marquise-shaped PNG with fill, grain texture, and hairlines baked together — sits on top of the body as a distinct surface with a subtle `drop-shadow` filter. The fill color is slightly different from the body (`#EBE7E3` light / `#0e2319` dark) to create the "different paper stock" effect.
- **Body:** Primary surface — `var(--color-soft-white)` (light) / `var(--color-dark-bg)` (dark) — with multi-layer grain texture via CSS backgrounds.

The footer has **no separate surface** — it inherits the body background (transparent). This was a deliberate simplification. The old `--color-footer-bg` / `--color-footer-bg-dark` variables have been removed.

### Navigation

#### Desktop (above 900px)

- **Shape:** Floating marquise diamond frame — inspired by the facets of Andrew's engagement ring
- **Implementation:** Single PNG image (`images/nav/nav-diamond-light.png` / `nav-diamond-dark.png`) containing fill + grain texture + hairlines baked together. Composited in Figma using a diamond mask over the grain texture layers, exported as PNG with transparent background outside the shape.
- **Content inside the diamond:** TRAVEL · FAQ · [monogram] · REGISTRY · RSVP — all in PP Watch uppercase, arranged as a centered flex row
- **Links:** `.nav-link-inline` elements — TRAVEL and FAQ on the left of the monogram, REGISTRY and RSVP on the right
- **Monogram:** Smaller inside the nav bar (~36–40px), centered between the link groups
- **Position:** `position: fixed`, centered horizontally, near the top of the viewport — stays visible on scroll
- **Drop shadow:** `filter: drop-shadow()` on `.nav-diamond` — follows the diamond shape (not a rectangular box-shadow). Light mode: `drop-shadow(0 4px 14px rgba(0, 0, 0, 0.22))`. Dark mode: `drop-shadow(0 4px 14px rgba(0, 0, 0, 0.3))`. Hand-tuned — do not revert to the original heavier values.
- **Hover:** Color shifts to `var(--color-accent)` (`#2d5a4a`) + `text-shadow` shifts to impressed letterpress state (`--emboss-hover`). In dark mode, text dims to `rgba(241, 237, 234, 0.7)`. No opacity change.
- **Mobile menu:** Hidden on desktop (`display: none !important` in the `min-width: 901px` media query)

#### Mobile (900px and below)

- **Layout:** Same floating diamond as desktop, scaled down to 340px wide × 50px tall. All four links (TRAVEL, FAQ, REGISTRY, RSVP) visible inside the diamond — no hamburger menu, no dropdown.
- **Monogram:** Positioned above the diamond via `position: absolute; top: -2.5rem` on `.site-title`, centered horizontally. 30px height. Not inside the diamond.
- **Nav position:** `position: fixed; top: 3rem; left: 50%; transform: translateX(-50%)`
- **Link font size:** 0.55rem (smaller than desktop 0.7rem to fit four words in 340px)
- **Link groups:** `.nav-links-left` and `.nav-links-right` each use `gap: 1.2rem`
- **Diamond frame:** Same PNG as desktop, scaled to fit 340px width
- **No Menu button, no dropdown, no mobile-specific menu system** — this was a deliberate simplification after extensive iteration

#### Both Modes

- **Dark mode:** Nav diamond PNG swaps via `data-light` / `data-dark` attributes (handled by `site-init.js`). Monogram swaps to white version. Link text color swaps to cream.
- **`savethedate.html` has NO nav**
- **Nav link hover:** Color shifts to accent green (light) or dimmed cream (dark) + text-shadow shifts from emboss-rest to emboss-hover. Same behavior on desktop and mobile. Monogram hover: `scale(0.96)` press effect.

#### Implementation History

The nav went through several iterations: transparent bar → SVG pill frame (abandoned) → clip-path polygon (failed — clips pseudo-elements) → 3-slice SVG with CSS hairline middle (worked but PNGs were better for grain) → **final: baked PNG diamond**. The PNG approach won because grain is raster, not vector — baking fill + grain + hairlines into one image avoids all the CSS clipping/blending complexity.

### Mobile Navigation History

The mobile nav went through extensive iteration:
1. Filled pill "Menu" button with dropdown — functional but generic
2. Diamond-shaped marquise PNG button with CSS panel crossfade — shape looked like a football at small size
3. SVG path morph via Flubber.js (marquise → rounded rectangle) — technically worked but SVG hairlines were fuzzy at small sizes
4. Text "MENU" trigger with double hairlines — considered but untested
5. **Final: same diamond nav as desktop, scaled to 340px** — all links visible inside the diamond, monogram above. No menu button needed.

The old `.mobile-menu`, `.mobile-menu-trigger`, `.mobile-menu-panel`, `.mobile-menu-links`, and `.mobile-menu-close-btn` elements and styles have been removed. The `.menu-toggle` and `.nav-links` (dropdown) elements are also gone.

### CTA Buttons

Two button styles exist, both using a **letterpress/deboss interaction model** — buttons are impressed into the paper surface, never raised above it. No outer shadows. Interaction deepens the impression.

**`.btn-priority`** — Reverse-colored debossed button (e.g., "Visit Our Registry")
- Pill shape: `border-radius: 25px`
- Dark green fill + white text (light mode); cream fill + dark green text (dark mode)
- Border: `2px solid rgba(0, 0, 0, 0.12)` — subtle, uniform
- Surface texture: `::before` pseudo-element with SVG `feTurbulence` grain at 18% opacity, `mix-blend-mode: soft-light`
- PP Watch font, uppercase, small size
- `text-shadow: none`
- Hover: inset shadow deepens, background darkens slightly
- Active: maximum inset depth, darkest background, `translateY(0.5px)`

**`.btn-normal`** — Background-colored debossed button (e.g., "Visit Website")
- Same pill shape, font, and texture
- Background matches page surface: `var(--color-soft-white)` light / `var(--color-dark-bg)` dark
- Border: `2px solid rgba(26, 58, 46, 0.2)` light / `rgba(241, 237, 234, 0.12)` dark
- Hover/active: same deepening behavior as priority buttons

**Shadow scale (CSS custom properties in `:root`):**
- `--shadow-raised`: subtle inset + dark top edge + light bottom edge — rest state
- `--shadow-lifted`: deeper inset + stronger edges — hover state
- `--shadow-pressed`: maximum inset depth — active state
- Shadows use `rgba(0, 0, 0, ...)` (not green) so they're visible on dark surfaces
- Dark mode overrides in `body.dark-mode` adjust opacities

**Interaction model:** rest (subtle impression) → hover (deeper, darker) → active (deepest, darkest, 0.5px down). Button never lifts off page. No gradient sweep. No outer shadow.

### Footer

- **Style:** Transparent background — no border, no shadow, no separate tint. Inherits body surface.
- **Content:** Info text ("Adina & Andrew · October 17, 2026 · Washington, DC") · Dark/light mode toggle
- Info text: PP Watch, very small (`0.55rem`), low opacity (`0.4` light / `0.35` dark)
- Toggle: geometric SVG morph icon (circle ↔ crescent) + PP Watch label ("Dark Mode" / "Light Mode"). SVG uses `currentColor` fill — no PNG swap needed for the icon.
- **Desktop (above 900px):** Info text left, toggle right (flex row, `space-between`)
- **Mobile (below 900px):** Everything stacks vertically and centers — info text wraps to three lines (separators hidden), toggle below, all centered
- **`savethedate.html` has NO footer** (but has a standalone dark mode toggle at page bottom)

### Text Emboss/Shadow Effect

- `text-shadow` with light and dark offsets on body
- Light mode: `0 2px 3px rgba(255, 255, 255, 0.9), 0 -1px 1px rgba(26, 58, 46, 0.1)`
- Dark mode: `0 1px 2px rgba(241, 237, 234, 0.1), 0 2px 5px rgba(0, 0, 0, 0.5)`
- Buttons and nav links have `text-shadow: none`

### Button Hover Animation

- **No gradient sweep.** The old `flashGradient` / `flashGradientDark` keyframes have been fully removed.
- Buttons use a letterpress/deboss interaction: inset shadows deepen and background-color darkens on hover and active.
- Button surface texture via `::before` pseudo-element using inline SVG `feTurbulence` filter with `mix-blend-mode: soft-light` at 18% opacity. Inspired by DAUB UI's per-element texture approach (see `.claude/daub-reference.md`).
- Transitions: `0.2s ease` for shadow/transform, `400ms ease` for color/theme changes.
- The `#2d5a4a` accent color is used for nav link hover color shift, NOT for button hover gradients.

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
- `includes/site-init.js` injects the includes and initializes dark mode + menu toggle + image swapping
- Pages use `<div id="nav-placeholder">` and `<div id="footer-placeholder">` as injection targets
- Shared styles in `styles.css`; page-specific styles scoped with body class (e.g., `body.page-registry`)

#### nav.html Contains

- `.main-nav` wrapper (fixed position)
- `.nav-bar` inner container with the diamond frame and content:
  - `.nav-diamond` — the PNG image with `data-light` and `data-dark` attributes for mode switching
  - `.nav-links-left` div wrapping TRAVEL and FAQ links
  - `.site-title` with `.nav-monogram` image — visible in both layouts, positioned above diamond on mobile
  - `.nav-links-right` div wrapping REGISTRY and RSVP links

#### footer.html Contains

- `.site-footer` wrapper
- Info text with separator spans (hidden on mobile)
- Dark mode toggle button with inline SVG morph icon (circle ↔ crescent)

---

## IMPLEMENTATION NOTES

### File Structure

```
/
├── CLAUDE.md               (this file — design spec)
├── CNAME                   (custom domain config)
├── .htaccess
├── .gitattributes
├── .gitignore
├── styles.css              (global styles — shared across all pages)
├── rsvp-styles.css         (RSVP-specific styles)
├── index.html              (homepage — currently redirects to save-the-date)
├── savethedate.html        (NO nav, NO footer)
├── registry.html
├── rsvp.html
├── includes/
│   ├── nav.html            (shared nav markup — injected via fetch)
│   ├── footer.html         (shared footer markup — injected via fetch)
│   └── site-init.js        (dark mode init + toggle + menu toggle + image swap logic)
├── fonts/
│   ├── PPPlayground-Medium.woff / .woff2
│   ├── PPWatch-Bold.woff / .woff2
│   └── Sentient-Regular.woff / .woff2
├── images/
│   ├── favicon.png
│   ├── Monogram/           (monogram-green.png, monogram-white.png)
│   ├── names/              (names-image.png, names-image-dark.png)
│   ├── illustrations/      (Dupont.png, Dupont-dark.png, dark-mode-button.png, light-mode-button.png)
│   ├── nav/                (nav-diamond-light.png, nav-diamond-dark.png — mobile nav PNGs exist but are unused)
│   └── textures/           (6 active grain PNGs + old/ subfolder with previous versions)
├── vectors/
│   ├── rowhouse.svg / rowhouse-dark.svg
│   ├── nav-diamond-light.svg / nav-diamond-dark.svg  (source SVGs — PNGs are used in production)
│   ├── names-flat.svg
│   ├── nav shapes.af       (Affinity source file)
│   └── mobile-nav/         (source SVGs from Affinity — not used in production)
├── rsvp-workflow/
│   ├── google-apps-script.js
│   ├── guests.js
│   └── rsvp-script.js
└── .claude/
    ├── figma-design-system-rules.md
    └── settings.local.json
```

**Planned but not yet created:** `travel.html`, `faq.html`

**No longer exists:** `registry-admin.html` (deleted — registry is through Zola)

### Key CSS Architecture

- **Grain:** Multi-layer `background-image` on `body` with `background-blend-mode: soft-light` — four light-mode layers, two dark-mode layers, plus a `linear-gradient` overlay at 0.75 alpha. Scrolls with page content. See Grain Texture section for full CSS pattern.
- **Nav:** `.main-nav` is `position: fixed`. `.nav-bar` contains the diamond PNG (`.nav-diamond`) positioned behind nav content, plus link groups (`.nav-links-left`, `.nav-links-right`) and monogram. Diamond PNG has `filter: drop-shadow()` for depth. On mobile, same diamond at 340px width with all links visible — monogram positioned above via absolute positioning.
- **Footer:** `.site-footer` has `background: transparent` — no separate surface, no hairline, no shadow.
- **Dark mode:** `body.dark-mode` in `styles.css` handles all global dark styles. Page-specific dark overrides scoped with body class (e.g., `body.page-registry .registry-illustration`). Color transitions use `@property` for smooth crossfades; grain/image swaps are instant.
- **No z-index stacking hacks needed** — grain is body background, never overlays content.
- **`#protected-content`** is `display: none` by default; `.unlocked` defaults to `flex` column in styles.css; `body.page-savethedate` overrides to `display: block`.
- **Page body classes** (`page-registry`, `page-savethedate`) scope page-specific styles in styles.css — no inline `<style>` blocks.
- **Password overlay** recreates grain via `::before` pseudo-element with the same multi-layer background stack.
- **Buttons:** Letterpress/deboss model using `--shadow-raised`/`--shadow-lifted`/`--shadow-pressed` CSS custom properties (all inset). Surface texture via `::before` with SVG `feTurbulence`. No outer shadows, no gradient sweep.
- **Dark mode toggle:** Inline SVG with SMIL `<animate>` path morph between circle (sun) and crescent (moon). Uses `fill="currentColor"`. No PNG swap.
- **Mobile nav:** Same diamond as desktop at 340px width. Monogram positioned above via absolute positioning. No hamburger menu or dropdown.
- **DAUB UI reference:** `.claude/daub-reference.md` contains the DAUB design system skill file. Used as design reference only — shadow scale philosophy, per-element texture technique. Do NOT import daub.css/daub.js.


---

## GUIDING PRINCIPLES

- **"Does this feel personally crafted, or template-like?"** — the test for every page
- **"Emotionally coherent" over "visually impressive"** — warmth and intentionality matter more than flashiness
- Describe visual/structural changes before implementing them
- Flag technical tradeoffs clearly
- Do not make changes to styles.css without considering impact on ALL pages that use it
- Read existing file state before proposing changes — never assume

---

## Reference: DAUB UI Design System

`.claude/daub-reference.md` contains the DAUB UI component library's skill file. This is used as a **design reference only** — do NOT import daub.css or daub.js. Do NOT add DAUB classes to any HTML.

We draw from DAUB's approach to:
- Layered shadow scale (`--shadow-raised`, `--shadow-lifted`, `--shadow-pressed`)
- Surface materiality (warm-tinted shadows, not pure black)
- Text emboss / letterpress via `text-shadow`
- Three-state interaction model: raised → lifted → pressed
- Transition timing (150-200ms ease for interactions, 400ms ease for color/theme changes)

All implementations should use our own CSS custom properties and selectors, not DAUB's `db-` prefix classes.
```

**4. Verify Claude Code sees it**

Open Claude Code (`cc`) and ask it something like:
```
What's in .claude/daub-reference.md? Summarize the shadow and surface approach.
