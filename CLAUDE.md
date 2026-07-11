# CLAUDE.md — Wedding Website Design Spec

## About This File

This is the design specification for adinaandrew2026.com. Claude Code should read this file before making ANY changes to the site. All design decisions below are locked and final unless Andrew explicitly says otherwise.

Last updated: July 11, 2026

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

- `index.html` — **The homepage, served at the site root (`/`).** Clean landing page using the shared floating nav (via `#nav-placeholder`, same as inner pages). Content: names image as hero, date in PP Watch uppercase, "Washington, D.C." location, Dupont fountain illustration as closing decorative element. No page title `<h1>`, no invitation preamble, no event details, no standalone RSVP button. Entire page fits in one viewport without scrolling via `flex: 1` chain on `.homepage-hero`. `<body class="page-home">`
- `homepage.html` — **Retired.** The homepage now lives at the root (`index.html`); this file is a redirect stub to `/` so old `/homepage` links don't 404. The nav monogram links to `/`, not `/homepage`.
- `savethedate.html` — **Retired.** Replaced by the homepage at the root; this file is a redirect stub to `/`. (Was the Save the Date with travel/hotel info, `<body class="page-savethedate">` — that markup is gone, but the `.page-savethedate` styles remain in `styles.css`, currently unused.)
- `registry.html` — Registry with link to Zola (`adinaandandrew2026` — double "and" is correct) — `<body class="page-registry">`
- `faq.html` — Questions & Answers (7 Q&A items, inline RSVP link) — `<body class="page-faq">`
- `schedule.html` — Wedding weekend invitation (Fri/Sat/Sun events, event names lead each block) — `<body class="page-schedule">`
- `travel.html` — Hotels (4 blocks) + transportation directions, cherry blossom illustration — `<body class="page-travel">`
- `our-story.html` — Narrative-prose page with photo carousels (seven sections separated by `.story-divider`s, several with multi-photo carousels) — `<body class="page-our-story">`
- `dc-guide.html` — DC recommendations (Food + Activities sections), follows Travel page template — `<body class="page-dc-guide">`
- `rsvp.html` — **Metro Rive intro → pixel-registered hard cut → settle into a brand page.** The nav's RSVP link points here (`/rsvp`). Gated behind a **"Coming Soon!"** password overlay (`beautifulsuperstar` / `rsvpUnlocked` — the exclusive RSVP password, not the guest `october17`); after unlock, the hand-drawn DC Metro intro plays: `js/rive-intro.js` owns a `requestAnimationFrame` loop that scrubs the linear timeline (`Timeline 1` in `assets/rive/metro-intro.riv`) at a **15fps stepped cadence** (scrubs deduped to actual step advances), using `Fit.Contain` — the tunnel-green (`#183a2c`) letterbox bars fade to `#F1EDEA` over **21.00→22.22s in sync with the in-Rive cream cover fade**, so the final frame is flat cream + card at any window shape. At `DURATION_S` (**22.22s**) it **hard-cuts in the same frame** (canvas `display:none`, no hold, no dissolve; the node is removed only after the settle) to `#invitation-endstate`: flat `#F1EDEA` + the card `images/invitation/invitation-light-new.png` — **the same PNG baked into the .riv** (pixel-identical; byte-different re-encode), absolutely placed by **measured artboard fractions**: `left 29.11%`, `width 41.67%`, `top -10.47%` (the card parks HIGH, bleeding ~113/1080 past the artboard top — measured, not centered). `body.page-rsvp { overflow: hidden }` is **load-bearing for registration** (no scrollbar ⇒ canvas box = field box). ~150ms later the page **settles** over 450ms (`body.intro-complete` + `var(--settle-ms)`): flat cream fades to the textured tile, nav + footer + replay icon fade in, the card gains the `.registry-illustration` emboss. **Dark mode: the card INVERTS** to `invitation-dark-new.png` (green card, cream text — intentionally tone-on-tone) via the standard `data-light`/`data-dark` swap. Replay icon bottom-left (placeholder DC flag): clears `intro-seen` + reloads; hidden under `prefers-reduced-motion`. Skip / return visits / reduced-motion / load-error land settled **directly**. Plays once per session (`intro-seen`). `invitation.svg` is retired here. `<body class="page-rsvp">`. (See decisions.md, July 6, 2026 — "Pixel-registered handoff".)
  **Dark-mode reset on animation exit:** the animation's final frames are effectively light mode, so `hardCut()` in `js/rive-intro.js` calls `resetThemeToLight()` (class + `localStorage` + image swap + footer sun glyph) **only when the canvas actually played** (natural completion or Skip). Bail paths (return visit / reduced-motion / load-error) preserve the user's theme. (decisions.md, July 11, 2026.)
  **The sequenced card-based RSVP flow lives here.** After the settle, a hairline **RSVP arrow** (`#rsvp-arrow`, PP Watch Bold + inline-SVG arrow) sits to the card's right (below it on ≤900px), positioned by the card's artboard fractions inside `.invitation-field`; it fades in with the settle, has the nav hover glow, and carries an optional breathing glow behind the `.rsvp-arrow-breathe` class (delete the class to kill it). Clicking it slides the invitation off-screen left (`body.rsvp-flow-active` translates `#invitation-endstate`; geometry untouched) and enters `#rsvp-flow`: a horizontal track of one-viewport panels (`transform: translateX(-i·100%)`, 600ms cubic-bezier(0.4,0,0.2,1); instant under reduced-motion), each centering a printed **reply card** whose surface follows the **same logic as the floating nav** — a flat fill distinct from the body (`#EBE7E3` light / `#0e2319` dark, the nav's dark fill) floating on the grainy page plane with a single `box-shadow: 0 4px 14px` drop-shadow for separation (grain lives on the fixed backdrop behind the card, NOT on the card — an earlier grain-on-card experiment was dropped). Inside: a **double-rule frame matching the invitation PNG** (a 2px outer line + a 1px inner line, `::before`/`::after`, square corners; cream in dark mode). Title is "Rsvp" (sentence case, PP Playground); the reply line is a Sentient sentence-case line over an uppercased PP Watch Medium date. The custom radios / kosher checkbox use a **plain standard checkmark** (a two-segment tick, round caps — a curved "ink stroke" and a PP Playground "O" glyph ring were both tried and dropped in favor of a normal check + plain circle ring). The forward CTA (Next / Review) sits to the card's **right**, vertically centered — the same affordance as the RSVP arrow (below the card, centered, on ≤900px). Each event's dress tag is a bordered capsule; Saturday's "Black Tie Preferred" is a **button that deep-links (new tab) to its FAQ answer** (`faq.html#faq-black-tie` — `faq.html`'s `unlockContent()` honors the hash after unlock, and `.faq-item` has `scroll-margin-top` to clear the nav); Friday's "Semi-Formal" and Sunday's "Come as you are" have no FAQ section so they stay plain tags. A `position: fixed` texture backdrop keeps the grain stationary while cards slide/scroll (NOT `background-attachment: fixed` — broken on iOS). Steps: `email` (autocomplete with the "typed past the @" privacy rule; selection advances) → one card per **invited** event in `EVENT_ORDER` (per-person hairline radios, "Accepts with pleasure / Declines with regret"; Saturday adds the afterparty info block, per-person meal radios — Branzino / Chicken / Cauliflower Steak — and a hairline "Kosher?" checkbox active only for the selected kosherable meal) → review-and-send (per-person summary, optional note, `.btn-priority` Send) → thank-you. Validation is inline on the card (no `alert()`); back arrows preserve selections; editing the email resets the step list. `overflow` on the body relaxes to `overflow-x: hidden; overflow-y: auto` only once `.rsvp-flow-active` is set (post-settle, so pre-cut registration is untouched). Logic: `js/rsvp-flow.js` (its `searchInvitations` / `submitRsvp` are the ONLY network seams; `APPS_SCRIPT_URL` empty = placeholder data + no-op submit). Styles: the `/* === Card flow === */` section of `rsvp-styles.css` (now loaded by rsvp.html too). Submission shape: `{ email, people: [{ name, events: {friday:'yes'|'no',…}, meal, mealKosher }], message }`.
- `rsvp-internal.html` — **Internal staging page, now superseded by the card flow on `rsvp.html`** (served at `/rsvp-internal`; still untouched — Andrew will retire it). Gated by the RSVP password (`beautifulsuperstar` / `rsvpUnlocked`). `<body class="page-rsvp-internal">`. Single-page form (styles in `rsvp-styles.css`, logic in `js/rsvp-form.js`) over the same placeholder-data seams. **Structure:** lookup by **email** (live dropdown) → **Part A "The Weekend" reference block** (each invited event's logistics shown ONCE) → **Part B per-person compact decision rows**. The card flow in `js/rsvp-flow.js` lifted this page's data model, autocomplete (incl. the "@" privacy rule), and control language; keep the two in mind together when editing `rsvp-styles.css` (shared file).

### Illustration Assignments

| Page | Illustration | Status |
|------|-------------|--------|
| Travel | Cherry Blossom (`blossom-light.png` / `blossom-dark.png`) | Done |
| FAQ | Joan of Arc (`joan-test-light.png` / `joan-test-dark.png`) | Done |
| DC Guide | D.C. Flag (`flag-light.png` / `flag-dark.png`) | Done |
| Registry | Rowhouse | Stays |
| Our Story | None (removed) | Done |
| RSVP | Metro intro (Rive) → invitation end-state | Done |
| Schedule | TBD | — |
| Homepage | Dupont fountain (closing decorative element, not page illustration) | Done |

## Hotel Blocks

| Hotel | Walk from venue | Group code | Book by |
|-------|----------------|------------|---------|
| InterContinental (venue) | — | `AAW` | Sep 16, 2026 |
| Canopy by Hilton | 2-3 min | `908` | Sep 16, 2026 |
| Residence Inn by Marriott | 15-20 min | `NDF` | Sep 18, 2026 |
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
| Headings / UI | PP Watch — **Bold (700)** and **Medium (500)** | Uppercase, small, structural. See the weight split below. |
| Body text | Sentient Regular | **Never italic.** Always `font-style: normal` |

**PP Watch weight split (`--font-heading`).** PP Watch is loaded at two weights via `@font-face`: **Bold 700** and **Medium 500**. The split is expressed purely through `font-weight` — there is no separate CSS variable.
- **Bold (700) = structural labels:** the default. Nav links, footer labels, buttons, page/section headings, FAQ/schedule headers, form labels, etc. Every `var(--font-heading)` rule that must stay Bold carries an explicit `font-weight: 700` (because once Medium is loaded, an unspecified weight resolves to ~500 and would silently lighten — so the explicit pin prevents regressions).
- **Medium (500) = small supporting caps:** the quieter detail set only. Currently `.schedule-event-detail` (shared with schedule.html) and the RSVP reference/decision classes `.weekend-event-when`, `.weekend-event-dress`, `.weekend-event-note`, `.rsvp-choice-label`.
- When adding a new `--font-heading` element, default to `font-weight: 700` unless it's intentionally part of the supporting-caps set.

Font files are in `/fonts/` (`PPWatch-Bold` + `PPWatch-Medium`). All faces are loaded via `@font-face` in `styles.css`. If `PPWatch-Medium` is ever missing, 500 falls back to the Bold face — nothing breaks, the split just doesn't render until the file is present.

Apply `-webkit-font-smoothing: antialiased` and `text-rendering: optimizeLegibility` to `body`.

**Important:** The project was originally planned with Canora, Akzidenz-Grotesk, and Mrs Eaves. Those are NOT the fonts in use. PP Playground, PP Watch, and Sentient are the actual, final fonts. Do not reference or revert to the old font names.

### Colors

| Name | Variable | Value | Usage |
|------|----------|-------|-------|
| Dark green | `--color-dark-green` | `#1a3a2e` | Primary green — light mode text, borders, buttons, UI elements |
| Dark mode background | `--color-dark-bg` | `#122a20` | Dark mode body + password overlay background only |
| Soft white / cream | `--color-soft-white` | `#F1EDEA` | Light mode body background |
| Accent | `--color-accent` | `#2d5a4a` | Nav link hover color shift + button system accent |
| Nav light fill | — | `#F1EDEA` | Baked into wide nav diamond PNG (light mode) — matches body color; drop-shadow alone provides separation |
| Nav dark fill | — | `#0e2319` | Baked into wide nav diamond PNG (dark mode) — darker than body for contrast since shadows are less visible on dark surfaces |

**Important:** `--color-dark-green` and `--color-dark-bg` are intentionally separate. `--color-dark-green` is the workhorse color for text and UI across both modes. `--color-dark-bg` is used only for the dark mode body surface — it was too dark for text/buttons but reads better as a background.

The nav diamond's fill colors are baked into the PNG assets (not set via CSS), so they don't have CSS custom properties. If the nav fill colors need to change, re-export the PNGs from Figma.

Old variables `--color-nav-bg`, `--color-nav-bg-dark`, `--color-footer-bg`, and `--color-footer-bg-dark` have been removed — the nav uses PNGs and the footer is transparent.

### Dark Mode

- Supported on all pages (except `savethedate.html`, which has a standalone toggle but no nav/footer)
- Toggle via Unicode symbol with breathing aura glow: `☀` (sun, 36px) in light mode, `⏾` (moon, 28px) in dark mode. Rendered via `background-clip: text` for tinted foil effect. CSS-animated aura (`@keyframes breathe`, 4s cycle). No label text, no SVG, no PNG swap. Located in footer, right-aligned.
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
- Body text left-aligned on content pages (FAQ, Travel, Schedule, Registry, Our Story, DC Guide). Save the Date remains fully centered — it's a formal invitation card.
- CTA buttons centered

### Background Texture

Background uses **pre-composited texture tiles** — flat PNGs with grain already baked in at the correct opacity and blend. No runtime blend modes.

- **Light mode:** `images/textures/combined-light.png` — warm white `#F1EDEA` with four grain layers pre-composited at soft-light in Figma
- **Dark mode:** `images/textures/combined-dark.png` — dark green `#122a20` with two grain layers pre-composited at soft-light in Figma
- **Tile size:** `background-size: 200px 200px` with `background-repeat: repeat`
- **No blend modes in CSS** — `background-blend-mode` is not used anywhere. The old multi-layer approach with `soft-light` caused cross-browser rendering differences (mobile Chrome vs desktop Safari vs desktop Chrome all composited differently, producing grey/muddy results on mobile).
- **Password overlay** (`#password-overlay::before`) uses the same baked tiles
- **Fallback color** matches tile base: `#F1EDEA` light, `#122a20` dark

Old texture files (`paper-grain-light.png`, `noise-grain-light.png`, `paper-grain-light-two.png`, `noise-grain-light-two.png`, `paper-grain-dark.png`, `noise-grain-dark.png`) are still in the repo but **no longer referenced in CSS or HTML**.

### Password Protection

The site uses two passwords:

- **Guest password:** `october17` — The main guest-facing password. Used on the homepage (`index.html`) and every content page: `travel.html`, `faq.html`, `schedule.html`, `registry.html`, `our-story.html`, `dc-guide.html`. Session key: `siteUnlocked`. Entering it on any of these pages unlocks all of them for that browser session.
- **RSVP password:** `beautifulsuperstar` — Gates both RSVP pages: `rsvp.html` (the public "Coming Soon!" overlay → Metro intro / invitation end-state) and `rsvp-internal.html` (internal staging for the real RSVP form). Session key: `rsvpUnlocked`. Kept separate so the RSVP stays locked even after the rest of the site is unlocked with the guest password (and unlocking one RSVP page unlocks the other for that session).

Each page has its own password overlay. Session storage remembers unlock state within a session. The two passwords use separate session storage keys (`siteUnlocked` vs `rsvpUnlocked`), so unlocking the main site does not unlock RSVP, and vice versa.

### Surface Layering

The site uses two visual surfaces to create physical depth:

- **Nav diamond:** A floating marquise-shaped PNG with fill, grain texture, and hairlines baked together — sits on top of the body as a distinct surface with a subtle `drop-shadow` filter. Light mode fill matches the body color (`#F1EDEA`) — the drop-shadow alone provides separation. Dark mode fill is darker than the body (`#0e2319` vs `#122a20`) for contrast since shadows are less visible on dark surfaces. This asymmetry is intentional.
- **Body:** Primary surface — `var(--color-soft-white)` (light) / `var(--color-dark-bg)` (dark) — with multi-layer grain texture via CSS backgrounds.

The footer has **no separate surface** — it inherits the body background (transparent). This was a deliberate simplification. The old `--color-footer-bg` / `--color-footer-bg-dark` variables have been removed.

### Navigation

#### Desktop (above 900px)

- **Shape:** Floating marquise diamond frame — inspired by the facets of Andrew's engagement ring
- **Implementation:** Single wider PNG image (`images/nav/wide-nav-light.png` / `wide-nav-dark.png`) containing fill + grain texture + hairlines baked together. Composited in Figma using a diamond mask over the grain texture layers, exported as PNG with transparent background outside the shape. Old PNGs (`nav-diamond-light.png`, `nav-diamond-dark.png`) remain in repo but are no longer referenced.
- **Content inside the diamond:** TRAVEL · FAQ · DC GUIDE · [monogram] · OUR STORY · REGISTRY · RSVP — all in PP Watch uppercase, arranged as a centered flex row. Six links total, three per side.
- **Link order:** "Guest stuff" left of monogram (Travel, FAQ, DC Guide), "us stuff + RSVP" right (Our Story, Registry, RSVP)
- **Links:** `.nav-link-inline` elements in `.nav-links-left` (3 links) and `.nav-links-right` (3 links)
- **RSVP emphasis:** RSVP link (`.nav-rsvp`) is the sole exception to "no glow at rest" — it has a breathing glow via `@keyframes rsvp-glow` / `rsvp-glow-dark` (4s cycle, three-layer `text-shadow` at 6px/14px/28px blur). On hover, glow intensifies beyond the breathing peak (animation pauses). All other links have no glow at rest.
- **Monogram:** Smaller inside the nav bar (~36–40px), centered between the link groups
- **Position:** `position: fixed`, centered horizontally, near the top of the viewport — stays visible on scroll
- **`.nav-bar` width:** 750px (expanded from 550px to accommodate 6 links). Gap: 1.8rem.
- **Drop shadow:** `filter: drop-shadow()` on `.nav-diamond` — follows the diamond shape (not a rectangular box-shadow). Light mode: `drop-shadow(0 4px 14px rgba(0, 0, 0, 0.22))`. Dark mode: `drop-shadow(0 4px 14px rgba(0, 0, 0, 0.3))`. Hand-tuned — do not revert to the original heavier values.
- **z-index:** `0` — lower than links/monogram (z-index 1) so the opaque fill inside the diamond PNG doesn't cover text elements. No `mix-blend-mode`.
- **Hover:** No glow at rest — links have `text-shadow: none` in their default state. On hover, a glow appears (text-shadow at ~75% intensity) + color shifts to `var(--color-accent)`. Light mode glow: accent green `rgba(45, 90, 74, ...)`. Dark mode glow: cream `rgba(241, 237, 234, ...)`. Transition: `text-shadow 0.25s ease, color 0.2s ease`. No `translateY` on hover — only on `:active` (`translateY(0.5px)`).
- **Active (tap):** Same color shift and emboss as hover, plus `translateY(0.5px)` press feedback. Provides touch response on mobile.
- **Mobile menu elements:** Hidden on desktop (`.mobile-menu-btn` and `.mobile-menu-panel` are `display: none`)

#### Mobile (900px and below)

- **Layout:** Menu pill button with dropdown panel. The inline diamond and links are hidden (`display: none` on `.nav-bar`).
- **Menu button:** `.mobile-menu-btn` — a `btn-normal`-styled pill with PP Watch uppercase, grain texture via `::before`, letterpress shadow. Positioned top-right (`position: fixed; top: 4rem; right: 1.5rem`).
- **Dropdown panel:** `.mobile-menu-panel` — rounded rectangle with grain texture, appears below the button on tap. Contains all 6 links as `.mobile-menu-link` elements. Opens/closes via `.open` class toggled by JavaScript in `site-init.js`.
- **RSVP separator:** `.mobile-rsvp` class adds a hairline above RSVP in the dropdown, visually separating it as the primary action. Same breathing glow and hover intensification as desktop `.nav-rsvp`.
- **Close behavior:** Panel closes on outside click or link click (handled by `initMenu()` in `site-init.js`). When open, `<main>` and `.site-footer` receive `.menu-open` class (fades content to 0.4 opacity, disables pointer events). All close paths (button toggle, outside click, link click) remove `.menu-open`.
- **Monogram:** Duplicated in the HTML — once inside `.nav-bar` for desktop, once inside `.mobile-menu-panel` as the first centered item (above the six page links). Each is `display: none` on its non-active breakpoint. The monogram inside the mobile dropdown links to `/homepage`.
- **Dark mode:** Button and panel both switch colors — cream text on dark green background, adjusted border and shadow opacities.

#### Both Modes

- **Dark mode:** Nav diamond PNG swaps via `data-light` / `data-dark` attributes (handled by `site-init.js`). Monogram swaps to white version. Link text color swaps to cream.
- **`savethedate.html` has NO nav**
- **Nav link hover:** No glow at rest — glow appears only on hover with accent color shift. RSVP is the sole exception (breathing glow at rest). Monogram hover: `scale(0.96)` + `drop-shadow` glow matching link glow color. Active: `scale(0.93)`. No rotate, no translateY on hover.

#### Homepage

- **Uses the shared floating nav** — same `#nav-placeholder` injection as all inner pages. No special homepage-only nav.
- **No page title** — the names image is the hero content. Unlike inner pages which have `<h1 class="registry-title">`, the homepage has no text heading.
- **Content fits one viewport** — `.homepage-hero` uses `flex: 1` with `display: flex; flex-direction: column; justify-content: center; align-items: center` to vertically center names + date + location within the available space. The Dupont fountain illustration sits below as a closing flourish.
- **Date typography** — `.homepage-date` uses PP Watch uppercase (`font-family: var(--font-heading); text-transform: uppercase; letter-spacing: 0.12em`).
- **No RSVP button** — RSVP is accessible only via the nav link. The standalone button was removed to keep the page as a title card.
- **Mobile:** Same shared nav (pill Menu button + dropdown). Content still fits one viewport.
- **Dark mode:** Handled by the shared nav/footer system. Names image and Dupont illustration swap via `data-light`/`data-dark`.

#### Implementation History

The nav went through several iterations: transparent bar → SVG pill frame (abandoned) → clip-path polygon (failed — clips pseudo-elements) → 3-slice SVG with CSS hairline middle (worked but PNGs were better for grain) → **final: baked PNG diamond**. The PNG approach won because grain is raster, not vector — baking fill + grain + hairlines into one image avoids all the CSS clipping/blending complexity.

### Mobile Navigation History

The mobile nav went through extensive iteration:
1. Filled pill "Menu" button with dropdown — functional but generic
2. Diamond-shaped marquise PNG button with CSS panel crossfade — shape looked like a football at small size
3. SVG path morph via Flubber.js (marquise → rounded rectangle) — technically worked but SVG hairlines were fuzzy at small sizes
4. Text "MENU" trigger with double hairlines — considered but untested
5. Same diamond nav as desktop, scaled to 340px — all 4 links visible inside. Worked when there were only 4 links.
6. **Final: Menu pill button with dropdown panel** — returned to the menu button approach when nav expanded from 4 to 6 links. Six links don't fit in a 340px diamond. The pill button uses `btn-normal` styling (grain, letterpress shadow) positioned top-right. Dropdown panel contains all 6 links with RSVP separated by a hairline.

Old iteration 5's mobile rules (340px diamond, 0.55rem links, monogram above diamond) have been replaced by the menu button system.

### CTA Buttons

Two button styles exist, both using a **letterpress/deboss interaction model** — buttons are impressed into the paper surface, never raised above it. No outer shadows. Interaction deepens the impression.

**`.btn-priority`** — Reverse-colored debossed button (e.g., homepage RSVP button)
- Pill shape: `border-radius: 25px`
- Dark green fill + white text (light mode); cream fill + dark green text (dark mode)
- Border: `2px solid rgba(0, 0, 0, 0.12)` — subtle, uniform
- Surface texture: `::before` pseudo-element with SVG `feTurbulence` grain at 18% opacity, `mix-blend-mode: soft-light`
- PP Watch font, uppercase, small size
- `text-shadow: none`
- Hover: inset shadow deepens, background darkens slightly
- Active: maximum inset depth, darkest background, `translateY(0.5px)`

**`.btn-normal`** — Background-colored debossed button (e.g., "Visit Our Registry", "Visit Website", "Book Room")
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

### Form Radios (RSVP)

Radios in the RSVP form (`.radio-label input[type="radio"]`, styled in `rsvp-styles.css`) are **custom hairline controls**, not native — `appearance: none` with an 18px circular ring and a `::before` center **checkmark** (a masked SVG, so its color follows the theme). They follow the site's hairline/no-glow-at-rest language:
- **Rest:** hairline ring `rgba(26,58,46,0.45)` (cream `rgba(241,237,234,0.45)` in dark mode), no fill, no glow.
- **Hover:** ring darkens to `…0.8`.
- **Checked:** ring goes full green (cream in dark), and the center checkmark scales in via `transform: scale(0→1)` — a hand-drawn "response" feel rather than a filled dot.
- **Focus-visible:** 2px green (cream in dark) outline, echoing input focus.
- Transitions are fast (**120ms**) — interaction feedback, not the 400ms grain/theme-swap timing.

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

- Desktop: 200px height
- Mobile (≤900px): 150px height
- Centered, `display: block`, `margin: 0 auto`
- `object-fit: contain`
- Light/dark variants via `data-light` / `data-dark` attributes
- Drop-shadow filter: light mode uses white/dark-green shadows, dark mode uses black/white shadows
- Export from Affinity Designer at 600px wide (3x retina at ~200px max display size)
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
  - `.nav-diamond` — the wide PNG image with `data-light` and `data-dark` attributes for mode switching
  - `.nav-links-left` div wrapping Travel, FAQ, DC Guide links
  - `.site-title` with `.nav-monogram` image
  - `.nav-links-right` div wrapping Our Story, Registry, RSVP links (RSVP has `.nav-rsvp` class)
- `.mobile-menu-btn` — pill-shaped menu button (hidden on desktop, visible on mobile)
- `.mobile-menu-panel` — dropdown with all 6 links as `.mobile-menu-link` elements (RSVP has `.mobile-rsvp` class)

#### footer.html Contains

- `.site-footer` wrapper
- Dark mode toggle button with Unicode symbol (`☀` / `⏾`) and breathing aura

---

## IMPLEMENTATION NOTES

### File Structure

```
/
├── CLAUDE.md               (this file — design spec; stays at root)
├── CNAME                   (custom domain config)
├── .htaccess
├── .gitattributes
├── .gitignore
├── css/                    (all stylesheets — url() paths inside are ../-relative to root)
│   ├── styles.css          (global styles — shared across all pages)
│   └── rsvp-styles.css     (RSVP-specific styles; loaded by rsvp.html + rsvp-internal.html)
├── docs/                   (project docs — not served-critical)
│   ├── decisions.md        (design & technical decision log)
│   └── file-structure.txt  (quick-reference file tree)
├── index.html              (currently redirects to save-the-date)
├── homepage.html           (homepage / invitation landing page — standalone)
├── savethedate.html        (NO nav, NO footer)
├── registry.html
├── faq.html                (Questions & Answers)
├── schedule.html           (Wedding weekend schedule)
├── travel.html             (Hotels + directions)
├── our-story.html          (Photo timeline — page-our-story)
├── dc-guide.html           (DC recommendations — page-dc-guide)
├── rsvp.html               (Metro Rive intro → invitation end-state — "Coming Soon!" gate, beautifulsuperstar)
├── rsvp-internal.html      (internal staging for the real RSVP form — beautifulsuperstar)
├── includes/
│   ├── nav.html            (shared nav markup — injected via fetch)
│   ├── footer.html         (shared footer markup — injected via fetch)
│   ├── site-init.js        (dark mode init + toggle + menu toggle + image swap logic)
│   └── carousel.js         (photo carousel logic — loaded only on our-story.html)
├── js/
│   ├── rive-intro.js       (Metro intro playback + hard cut + settle + dark-mode reset — rsvp.html)
│   ├── rsvp-flow.js        (sequenced card flow: steps, cards, validation, backend seams — rsvp.html)
│   └── rsvp-form.js        (staging single-page form — rsvp-internal.html only)
├── assets/
│   └── rive/
│       └── metro-intro.riv (hand-drawn Metro intro — do not touch)
├── fonts/                  (WEB fonts only — .woff/.woff2; the .otf source faces live in _source/fonts/)
│   ├── PPPlayground-Medium.woff / .woff2
│   ├── PPWatch-Bold.woff / .woff2
│   ├── PPWatch-Medium.woff / .woff2
│   ├── PPWatch-Extralight.woff / .woff2
│   └── Sentient-Regular.woff / .woff2
├── images/
│   ├── favicon.png
│   ├── Monogram/           (monogram-green.png, monogram-white.png)
│   ├── names/              (names-image.png, names-image-dark.png)
│   ├── illustrations/      (Dupont, flag, blossom, joan — light/dark PNGs; rowhouse.svg / rowhouse-dark.svg — used by registry.html + schedule.html)
│   ├── invitation/         (invitation-light-new.png, invitation-dark-new.png — the RSVP end-state card; also baked into metro-intro.riv)
│   ├── nav/                (wide-nav-light.png, wide-nav-dark.png — the only active nav PNGs; legacy diamond/mobile PNGs moved to _source/archive/nav/)
│   ├── our-story/          (web-optimized photos: web-blossoms.jpg, web-engagement.jpg, web-copenhagen.jpg, etc. Originals also in folder but not referenced in HTML)
│   └── textures/           (combined-light.png, combined-dark.png — the only active tiles; legacy grains moved to _source/archive/)
├── rsvp-workflow/
│   └── google-apps-script.js  (REWRITTEN July 2026: Guests/Responses two-tab sheet; GET ?action=lookup&q=
│                               returns [{email, invitedTo, people}]; POST appends one Responses row PER PERSON
│                               (Timestamp | Email | Name | Friday | Saturday | Sunday | Meal | Kosher | Message);
│                               guarded confirmation email. Deploy as web app "execute as Me / access Anyone",
│                               paste URL into APPS_SCRIPT_URL in js/rsvp-flow.js. Front end POSTs JSON as
│                               Content-Type: text/plain to dodge CORS preflight — do not "fix" this.
│                               Caveat: "Anyone" access means the lookup URL itself is the privacy boundary.)
│                               (legacy guests.js / rsvp-script.js moved to _source/archive/)
├── _source/                (SOURCE & WORKING FILES — versioned in git but NOT hosted. The leading
│   │                        underscore makes GitHub Pages/Jekyll skip the folder at build time, so nothing
│   │                        here is served on the live site. Do not link to anything in here from a page.)
│   ├── fonts/              (.otf desktop faces — source for the deployed .woff/.woff2)
│   ├── vectors/            (nav shapes.af, names-flat.svg, mobile-nav/ source SVGs; credentials.json — gitignored)
│   ├── sandbox/            (throwaway test pages: rive-quantize-test.html, rsvp-checkmark-demos.html)
│   └── archive/            (retired, unreferenced assets: legacy nav PNGs, old grain textures, invitation.svg,
│                            legacy rsvp-workflow scripts — kept for reference, safe to delete)
└── .claude/
    ├── figma-design-system-rules.md
    └── settings.local.json
```

**All content pages now exist.** `travel.html`, `faq.html`, and `schedule.html` were created following the `registry.html` template pattern.

**No longer exists:** `registry-admin.html` (deleted — registry is through Zola)

### Key CSS Architecture

- **Grain:** Pre-composited texture tiles (`combined-light.png` / `combined-dark.png`) on `body` via `background-image`, tiled at 200px. No `background-blend-mode`. Scrolls with page content.
- **Nav:** `.main-nav` is `position: fixed`. `.nav-bar` (750px wide) contains link groups (`.nav-links-left`, `.nav-links-right`), monogram, and wide diamond PNG at `z-index: 0`. On mobile, `.nav-bar` is hidden; `.mobile-menu-btn` pill and `.mobile-menu-panel` dropdown replace inline links.
- **Footer:** `.site-footer` has `background: transparent` — no separate surface, no hairline, no shadow.
- **Dark mode:** `body.dark-mode` in `styles.css` handles all global dark styles. Page-specific dark overrides scoped with body class (e.g., `body.page-registry .registry-illustration`). Color transitions use `@property` for smooth crossfades; grain/image swaps are instant.
- **No z-index stacking hacks needed** — grain is body background, never overlays content.
- **`#protected-content`** is `display: none` by default; `.unlocked` defaults to `flex` column in styles.css; `body.page-savethedate` overrides to `display: block`.
- **Page body classes** (`page-registry`, `page-savethedate`, `page-faq`, `page-schedule`, `page-travel`, `page-our-story`, `page-dc-guide`, `page-home`) scope page-specific styles in styles.css — no inline `<style>` blocks.
- **Password overlay** recreates grain via `::before` pseudo-element with the same baked texture tiles.
- **Buttons:** Letterpress/deboss model using `--shadow-raised`/`--shadow-lifted`/`--shadow-pressed` CSS custom properties (all inset). Surface texture via `::before` with SVG `feTurbulence`. No outer shadows, no gradient sweep.
- **Dark mode toggle:** Unicode symbol (`☀` / `⏾`) with `background-clip: text` foil effect and CSS breathing aura. No SVG, no PNG swap.
- **Mobile nav:** Menu pill button (`.mobile-menu-btn`) top-right with dropdown panel (`.mobile-menu-panel`). Inline diamond and links hidden. Toggle logic in `initMenu()` in `site-init.js`.
- **No `background-blend-mode` anywhere** — all textures are pre-composited in Figma and exported as flat PNG tiles. Eliminates cross-browser rendering differences.
- **Toggle aura:** Pure CSS animation via `@keyframes breathe` — no JavaScript for the glow effect
- **Footer overflow:** `overflow: visible` on footer elements to prevent aura clipping
- **DAUB UI reference:** `.claude/daub-reference.md` contains the DAUB design system skill file. Used as design reference only — shadow scale philosophy, per-element texture technique. Do NOT import daub.css/daub.js.
- **Content page body text** is left-aligned within centered containers. Hotel blocks and FAQ items take their body text and block spacing from the Save the Date `.std-hotel` pattern (1rem body text, 0.6rem body margin, 2.5rem block margin); their headers use the shared `.label-heading` style (see below). Save the Date's own `.std-hotel-name` keeps the larger 1.1rem / 0.1em label sizing. The Travel page uses a D.C. flag illustration (`flag-light.png`/`flag-dark.png`) instead of the rowhouse, with "Hotels" and "Transportation" section subheads. The Schedule page event hierarchy is: Event Name (PP Playground, 2.8rem) → Date → Address → Description → Dress Code. The FAQ page uses an inline RSVP link instead of a CTA button.
- **`.label-heading`** — the shared small uppercase header (PP Watch 700, 0.82rem, 0.12em tracking, 0.75rem bottom margin), defined globally in the Content Sections block of `styles.css`. Used for FAQ questions, Travel hotel names and Transportation labels, and the DC Guide "Where to Eat" / "What to Do" day labels. On DC Guide the labels sit inline between prose blocks, so `body.page-dc-guide .label-heading` overrides the margin to `1.4rem 0 0.4rem`. This replaced the former per-page `.faq-question`, `.travel-hotel-name`, and `.dc-day-label` rules, which were byte-identical apart from margins.
- **Page intro text** (`.page-intro`) appears below illustrations on content pages. Sentient Regular, 1.05rem, 0.85 opacity, left-aligned. Renamed from `.registry-intro` — the mobile override is unscoped so it applies across all pages.
- **Travel page section titles** ("Hotels", "Transportation") use PP Playground at 3.2rem (mobile: 2.3rem), left-aligned. Hairline divider (`.section-divider`) separates Hotels from Transportation. No hairline between page intro and Hotels.
- **Our Story page** uses `.story-timeline` container (600px max-width) with `.story-moment` blocks. Each section has narrative prose in `.story-prose` (Sentient body, 480px max-width, opacity 0.85, multiple `<p>` children allowed) followed by an optional photo group, then a `.story-caption-label` footer. Photo groups can be: `.story-photo-single` (380px max, mobile: 320px), `.story-photo-pair` (flex row, mobile: stacked column), or `.story-carousel` (multi-photo with arrows + dots — see Carousel below). `.story-divider` hairlines between sections. `.story-closing` as final text after the last divider. Web-optimized JPGs prefixed `web-` in `images/our-story/`. The page does not use `.page-intro` — the Meeting prose is the first content. Old `.story-caption` class still defined but no longer used in HTML (kept available for potential future reuse).
- **Story carousels** (`.story-carousel` family) — used for multi-photo sections on the Our Story page. Container is max-width 480px, centered. Track uses native `scroll-snap-type: x mandatory` over a flex row (`.story-carousel-track` with `tabindex="0"` for keyboard); each slide is `flex: 0 0 100%` with `scroll-snap-align: center`. Photos retain natural aspect ratios. Prev/next arrows (`.story-carousel-arrow-prev` / `-next`) mirror the `.btn-normal` debossed aesthetic at ~38px circular: same `feTurbulence` `::before` grain, same `--shadow-raised`/`--shadow-lifted`/`--shadow-pressed` token transitions, same dark mode overrides. PP Watch chevron glyph. Desktop: arrows positioned `left: -50px` / `right: -50px` (outside photo). Mobile (≤900px): arrows overlay inside photo edges (`left: 8px` / `right: 8px`) with semi-transparent backdrop and `backdrop-filter: blur(2px)`. Dots (`.story-carousel-dot` inside `.story-carousel-dots`) are 6×6px circles, generated by JS from slide count — `dark-green` active, `rgba(26, 58, 46, 0.25)` inactive; dark mode equivalents using `--color-soft-white`. Disabled state: `.disabled` class with `opacity: 0.35` + `aria-disabled="true"`, click handler skips. Pattern uses `data-carousel` on the container and `data-carousel-dots` on the dots placeholder — JS auto-discovers all `[data-carousel]` elements. Logic lives in `includes/carousel.js`, loaded only on `our-story.html` via a separate `<script>` tag after `site-init.js`.
- **`.story-prose-placeholder`** — inline span flagging unfinished narrative copy (e.g., the Section 6 "Together" placeholder). Dotted underline + opacity 0.55 + 0.02em letter-spacing. Italic was rejected because Sentient never renders italic site-wide. Visibly distinct from real copy — do not mistake it for finished text.
- **DC Guide page** reuses the Travel `.travel-section-title` and `.section-divider` classes plus the shared `.label-heading`. Structure: five neighborhood sections (The Wharf, The National Mall, Navy Yard, Eastern Market, Dupont Circle), each a `.travel-section-title` heading + a `.page-intro` blurb, then `.label-heading` "Where to Eat" / "What to Do" labels over `.dc-prose` body text. `.section-divider` hairlines sit after the page intro and between every neighborhood. Uses the D.C. flag illustration.
- **Button labels** on Travel and Save the Date hotel blocks: "Book Room" for hotels with room blocks, "Visit Website" for citizenM.
- **Schedule page dress code:** short labels as `.schedule-event-detail` (PP Watch), explanatory text as `.schedule-event-description` (Sentient). No "Dress Code:" prefix.
- **`.registry-illustration`** uses fixed `height: 200px` (desktop) / `height: 150px` (≤900px) with `object-fit: contain` for consistent vertical rhythm across pages.
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
