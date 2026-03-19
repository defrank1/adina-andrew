# CLAUDE.md — Wedding Website Design Spec

## About This File

This is the design specification for adinaandrew2026.com. Claude Code should read this file before making ANY changes to the site. All design decisions below are locked and final unless Andrew explicitly says otherwise.

Last updated: March 19, 2026

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

- `index.html` — Currently redirects to Save the Date. Will be replaced by homepage.html when the site goes live.
- `homepage.html` — Homepage / invitation landing page. Standalone (no floating nav, no shared footer). Static embossed diamond nav in content flow. `<body class="page-home">`
- `savethedate.html` — Save the Date with travel/hotel info — **NO nav, NO footer** — `<body class="page-savethedate">`
- `registry.html` — Registry with link to Zola (`adinaandandrew2026` — double "and" is correct) — `<body class="page-registry">`
- `faq.html` — Questions & Answers (5 Q&A items, inline RSVP link) — `<body class="page-faq">`
- `schedule.html` — Wedding weekend invitation (Fri/Sat/Sun events, event names lead each block) — `<body class="page-schedule">`
- `travel.html` — Hotels (4 blocks) + transportation directions, D.C. flag illustration — `<body class="page-travel">`
- `rsvp.html` — RSVP form (integrates with Google Sheets via rsvp-workflow/google-apps-script.js)

## Hotel Blocks

| Hotel | Walk from venue | Group code | Book by |
|-------|----------------|------------|---------|
| InterContinental (venue) | — | `AAW` | Sep 16, 2026 |
| Canopy by Hilton | 2-3 min | `908` | Sep 16, 2026 |
| Residence Inn | 15-20 min | `NDF` | Sep 18, 2026 |
| citizenM | 12-15 min | No room block | — |

## Meta

- Meta description on all pages: "Adina and Andrew's wedding website."

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
- Toggle via Unicode symbol with breathing aura glow: `✹` (sun, 42px) in light mode, `⏾` (moon, 28px) in dark mode. Rendered via `background-clip: text` for tinted foil effect. CSS-animated aura (`@keyframes breathe`, 4s cycle). No label text, no SVG, no PNG swap. Located in footer, right-aligned.
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
- Body text left-aligned on content pages (FAQ, Travel, Schedule, Registry). Save the Date remains fully centered — it's a formal invitation card.
- CTA buttons centered

### Background Texture

Background uses **pre-composited texture tiles** — flat PNGs with grain already baked in at the correct opacity and blend. No runtime blend modes.

- **Light mode:** `images/textures/combined-light.png` — warm white `#F1EDEA` with four grain layers pre-composited at soft-light in Figma
- **Dark mode:** `images/textures/combined-dark.png` — dark green `#122a20` with two grain layers pre-composited at soft-light in Figma
- **Tile size:** `background-size: 200px 200px` with `background-repeat: repeat`
- **No blend modes in CSS** — `background-blend-mode` is not used anywhere. The old multi-layer approach with `soft-light` caused cross-browser rendering differences (mobile Chrome vs desktop Safari vs desktop Chrome all composited differently, producing grey/muddy results on mobile).
- **Password overlay** (`#password-overlay::before`) uses the same baked tiles
- **Fallback color** matches tile base: `#F1EDEA` light, `#122a20` dark

Old texture files (`paper-grain-light.png`, `noise-grain-light.png`, `paper-grain-light-two.png`, `noise-grain-light-two.png`, `paper-grain-dark.png`, `noise-grain-dark.png`) are still in the repo but **no longer referenced in CSS**. The `<link rel="preload">` tags in HTML files still reference them — these should be updated to preload the combined tiles instead.

### Password Protection

- Each page has its own password overlay
- Registry password: `beautifulsuperstar`
- Save the Date password: `october17`
- Session storage remembers unlock state within a session
- All pages using `beautifulsuperstar` share a single session storage key: `siteUnlocked`. Entering the password on any page unlocks all of them for that browser session.
- Save the Date remains separate with key `saveTheDateUnlocked` and password `october17`.

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
- **z-index:** `0` — lower than links/monogram (z-index 1) so the opaque fill inside the diamond PNG doesn't cover text elements. No `mix-blend-mode`.
- **Hover:** Color shifts to `var(--color-accent)` (`#2d5a4a`) + `text-shadow` shifts to impressed letterpress state (`--emboss-hover`). In dark mode, text dims to `rgba(241, 237, 234, 0.7)`. No opacity change.
- **Active (tap):** Same color shift and emboss as hover, plus `translateY(0.5px)` press feedback. Provides touch response on mobile.
- **Mobile menu:** Hidden on desktop (`display: none !important` in the `min-width: 901px` media query)

#### Mobile (900px and below)

- **Layout:** Same floating diamond as desktop, scaled down to 340px wide × 50px tall. All four links visible inside — no hamburger menu, no dropdown.
- **Nav position:** `position: fixed; top: 4rem; left: 50%; transform: translateX(-50%)`
- **Monogram:** `position: absolute; top: -3rem` on `.site-title`, centered via `left: 50%; transform: translateX(-50%)`. 38px height. Sits above diamond, scrolls with it.
- **Link font size:** 0.55rem
- **Link groups:** `gap: 1.2rem`
- **No Menu button, no dropdown** — deliberate simplification after extensive iteration

#### Both Modes

- **Dark mode:** Nav diamond PNG swaps via `data-light` / `data-dark` attributes (handled by `site-init.js`). Monogram swaps to white version. Link text color swaps to cream.
- **`savethedate.html` has NO nav**
- **Nav link hover:** Color shifts to accent green (light) or dimmed cream (dark) + text-shadow shifts from emboss-rest to emboss-hover. Same behavior on desktop and mobile. Monogram hover: `scale(0.96)` press effect.

#### Homepage (Static Diamond)

- **No floating nav.** The homepage uses a static diamond PNG in the content flow, not the fixed-position `.main-nav`.
- **Embossed, not floating:** Uses the illustration drop-shadow treatment (`drop-shadow(0px 2px 2px rgba(255,255,255,1)) drop-shadow(0px -1px 1px rgba(0,0,0,0.15))`) instead of the floating shadow. Opacity 0.9.
- **No monogram** inside the diamond — only the four nav links (Travel, FAQ, Registry, RSVP), evenly spaced.
- **Wrapped in `.home-nav`** — a flex container that centers the diamond in the content flow.
- **Dark mode toggle:** Standalone `btn-normal` text button at bottom, same pattern as Save the Date.

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

- **No info text** — the "ADINA & ANDREW · OCTOBER 17, 2026 · WASHINGTON, DC" line was removed. Footer contains only the dark mode toggle.
- **Layout:** `.footer-content` uses `justify-content: flex-end` to push the toggle to the right side
- **Padding:** `0.5rem 1.5rem 2rem` — the extra bottom padding prevents the toggle's breathing aura (100px with 8px blur) from being clipped
- **Overflow:** `overflow: visible` on both `.site-footer` and `.footer-content` to allow the aura to extend beyond bounds
- **Mobile:** `flex-direction: row; justify-content: flex-end; padding: 0.5rem 1.5rem`
- **Mobile registry-specific:** `body.page-registry .site-footer { margin-top: 2.4rem }` replaces `margin-top: auto` to position footer naturally after content instead of at viewport bottom

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
- Export from Affinity Designer at 600px wide (3x retina at 200px display size)
- Light and dark variants must have identical canvas bounds to prevent swap size jumps
- Texture/grain should be baked into illustration assets before export, not applied via CSS

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
- Dark mode toggle button with Unicode symbol (`✹` / `⏾`) and breathing aura

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
├── index.html              (currently redirects to save-the-date)
├── homepage.html           (homepage / invitation landing page — standalone)
├── savethedate.html        (NO nav, NO footer)
├── registry.html
├── faq.html                (Questions & Answers)
├── schedule.html           (Wedding weekend schedule)
├── travel.html             (Hotels + directions)
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
│   ├── illustrations/      (Dupont-light.png, Dupont-dark.png, flag-light.png, flag-dark.png)
│   ├── nav/                (nav-diamond-light.png, nav-diamond-dark.png — mobile nav PNGs exist but are unused)
│   └── textures/
│       ├── combined-light.png          (baked texture tile — light mode)
│       ├── combined-dark.png           (baked texture tile — dark mode)
│       └── old/                        (legacy individual grain PNGs — no longer referenced in CSS)
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

**All content pages now exist.** `travel.html`, `faq.html`, and `schedule.html` were created following the `registry.html` template pattern.

**No longer exists:** `registry-admin.html` (deleted — registry is through Zola)

### Key CSS Architecture

- **Grain:** Pre-composited texture tiles (`combined-light.png` / `combined-dark.png`) on `body` via `background-image`, tiled at 200px. No `background-blend-mode`. Scrolls with page content.
- **Nav:** `.main-nav` is `position: fixed`. `.nav-bar` contains link groups (`.nav-links-left`, `.nav-links-right`), monogram, and diamond PNG at `z-index: 0`. On mobile, same diamond at 340px width with monogram positioned above via absolute. No hamburger menu.
- **Footer:** `.site-footer` has `background: transparent` — no separate surface, no hairline, no shadow.
- **Dark mode:** `body.dark-mode` in `styles.css` handles all global dark styles. Page-specific dark overrides scoped with body class (e.g., `body.page-registry .registry-illustration`). Color transitions use `@property` for smooth crossfades; grain/image swaps are instant.
- **No z-index stacking hacks needed** — grain is body background, never overlays content.
- **`#protected-content`** is `display: none` by default; `.unlocked` defaults to `flex` column in styles.css; `body.page-savethedate` overrides to `display: block`.
- **Page body classes** (`page-registry`, `page-savethedate`, `page-faq`, `page-schedule`, `page-travel`) scope page-specific styles in styles.css — no inline `<style>` blocks.
- **Password overlay** recreates grain via `::before` pseudo-element with the same baked texture tiles.
- **Buttons:** Letterpress/deboss model using `--shadow-raised`/`--shadow-lifted`/`--shadow-pressed` CSS custom properties (all inset). Surface texture via `::before` with SVG `feTurbulence`. No outer shadows, no gradient sweep.
- **Dark mode toggle:** Unicode symbol (`✹` / `⏾`) with `background-clip: text` foil effect and CSS breathing aura. No SVG, no PNG swap.
- **Mobile nav:** Same diamond as desktop at 340px width. Monogram positioned above via absolute positioning. No hamburger menu or dropdown.
- **No `background-blend-mode` anywhere** — all textures are pre-composited in Figma and exported as flat PNG tiles. Eliminates cross-browser rendering differences.
- **Toggle aura:** Pure CSS animation via `@keyframes breathe` — no JavaScript for the glow effect
- **Footer overflow:** `overflow: visible` on footer elements to prevent aura clipping
- **DAUB UI reference:** `.claude/daub-reference.md` contains the DAUB design system skill file. Used as design reference only — shadow scale philosophy, per-element texture technique. Do NOT import daub.css/daub.js.
- **Content page body text** is left-aligned within centered containers. Hotel blocks, FAQ items, and schedule events share consistent sizing derived from the Save the Date `.std-hotel` pattern (1.1rem name, 0.1em letter-spacing, 0.75rem name margin, 1rem body text, 0.6rem body margin, 2.5rem block margin). The Travel page uses a D.C. flag illustration (`flag-light.png`/`flag-dark.png`) instead of the rowhouse, with "Hotels" and "Transportation" section subheads. The Schedule page event hierarchy is: Event Name (PP Playground, 2.8rem) → Date → Address → Description → Dress Code. The FAQ page uses an inline RSVP link instead of a CTA button.
- **Travel page section titles** ("Hotels", "Transportation") use PP Playground at 2.8rem (mobile: 2rem), left-aligned. Hairline dividers (`.section-divider`) separate the illustration from Hotels, and Hotels from Transportation.
- **Button labels** on Travel and Save the Date hotel blocks: "Book Room" for hotels with room blocks, "Visit Website" for citizenM.
- **Schedule page dress code:** short labels as `.schedule-event-detail` (PP Watch), explanatory text as `.schedule-event-description` (Sentient). No "Dress Code:" prefix.
- **`.registry-illustration`** uses fixed `height: 200px` (mobile: 180px) with `object-fit: contain` for consistent vertical rhythm across pages.
- **FAQ password overlay** uses `white-space: nowrap` with widened container (`max-width: 600px`) to keep title on one line.


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
