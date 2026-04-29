# decisions.md — Design & Technical Decision Log

This document records the major decisions made during the development of adinaandrew2026.com, including what was tried, what was rejected, and why. It complements CLAUDE.md (the locked spec) by preserving the reasoning behind each choice.

Last updated: April 4, 2026

---

## Platform & Hosting

### Decision: Custom HTML/CSS/JS on GitHub Pages (not Squarespace)

The project began with a plan to use Squarespace for ease of use, with Claude Code writing custom CSS overrides. That approach was abandoned early. Squarespace's templating system fought against the level of customization Andrew wanted — full control over layout, typography, animations, and interactivity. The site was rebuilt as a fully hand-coded static project hosted on GitHub Pages.

**Tradeoff accepted:** More development effort, but complete design control. No platform-imposed constraints on navigation, animation (Rive), or custom registry logic.

**Lesson learned:** GitHub Pages requires a public repo on free plans. Making the repo private kills the deployment, and making it public again does not auto-redeploy — an empty commit (`git commit --allow-empty`) is required to trigger a rebuild.

---

## Typography

### Decision: PP Playground / PP Watch / Sentient (not Canora / Akzidenz-Grotesk / Mrs Eaves)

The original font plan was Canora (titles), Akzidenz-Grotesk (headings), and Mrs Eaves (body). All three were replaced during the design development phase. The new stack is PP Playground Medium (titles), PP Watch Bold (headings/UI), and Sentient Regular (body).

PP Playground provides the same calligraphic expressiveness as Canora but with more visual weight and personality. PP Watch replaced Akzidenz-Grotesk as the structural/UI font — it's bolder and reads better in uppercase at small sizes. Sentient replaced Mrs Eaves as the body face.

**Locked rule:** Sentient is never rendered italic. All `font-style: normal` is enforced globally. The CLAUDE.md spec explicitly warns against reverting to the old font names, because Claude Code sessions that have older context sometimes try to reference them.

---

## Colors

### Decision: Two-green system — `--color-dark-green` (#1a3a2e) and `--color-dark-bg` (#122a20)

Initially there was one green used everywhere. During the dark mode implementation, `#1a3a2e` was found to be too dark for large background surfaces — it made the page feel oppressive rather than rich. A separate, even deeper green (`#122a20`) was introduced specifically for the dark mode body background.

`--color-dark-green` remains the workhorse color for text, borders, buttons, and UI elements across both modes. `--color-dark-bg` is used only for the body surface in dark mode. This separation was intentional and is documented in CLAUDE.md to prevent consolidation.

### Decision: Nav diamond fill colors are baked into PNGs, not CSS

The wider nav diamond (`wide-nav-light.png` / `wide-nav-dark.png`) uses baked fill colors. Light mode fill now matches the body color (`#F1EDEA`) — the drop-shadow alone provides separation, creating a cleaner look. Dark mode fill remains darker than the body (`#0e2319` vs `#122a20`) because shadows are less visible on dark surfaces, so the tint contrast is needed. This asymmetry is intentional — different visual mechanisms achieve the same "floating surface" effect in each mode. If these need to change, the PNGs must be re-exported from Figma.

---

## Dark Mode

### Decision: `@property` transitions instead of `theme-transitioning` class

An earlier implementation used a `theme-transitioning` CSS class toggled by JavaScript to suppress animation flash during mode switches. This was replaced with CSS `@property` declarations that register color custom properties with `<color>` syntax, enabling native CSS transitions on the properties themselves. The result is smoother crossfades (~400ms ease) without JavaScript coordination.

Grain textures and image swaps (PNGs, SVGs) still happen instantly — only color values transition.

### Decision: Dark mode class applied before first paint via inline script

To prevent a flash of light mode on page load when dark mode is saved in `localStorage`, a small inline `<script>` in the `<head>` applies the `dark-mode` class to `<html>` and `<body>` before the browser paints. This is deliberate and should not be moved to an external file or deferred.

---

## Grain Texture

### Decision: CSS `background-blend-mode: soft-light` with opaque PNGs (not transparent PNGs)

This was the single most fought-over technical decision in the project. The original plan was to export transparent grain PNGs from Figma and layer them over CSS `background-color`. Multiple attempts were made:

1. **Figma export with transparency** — Failed. Figma silently adds an opaque background when exporting layers that use non-Normal blend modes (Soft Light, Overlay, etc.). Even exporting individual layers, ungrouped, from empty frames produced opaque RGB files.
2. **Desktop Figma app** — Same result.
3. **Exporting from frames with no fill** — Same result.
4. **Affinity Photo conversion** (brightness-to-alpha method) — Proposed but not executed because it would reinterpret the texture character.
5. **Python conversion** — Built and tested; produced working transparency but the texture looked different from the Figma original.

**What finally worked:** Exporting each noise layer individually at Normal blend mode from Figma (which preserves transparency correctly for Normal-blend layers), then compositing them in CSS using `background-blend-mode: soft-light`. The CSS performs the identical math that Figma's Soft Light blend does. A `linear-gradient` overlay at 0.75 alpha controls intensity — hand-tuned in Chrome DevTools by Andrew.

**Structure:** Light mode uses four texture layers, dark mode uses two. All are opaque PNGs tiled at 400×400px. The `background-color` on each element provides the base tint, and `soft-light` blending lets it show through.

**Key insight:** Grain that uses non-Normal blend modes in Figma *cannot* be exported as transparent PNGs. The blend result is inherently dependent on what's underneath. CSS `background-blend-mode` is the correct mechanism for this — it resolves the blend at render time against whatever `background-color` is set.

### Decision: Grain scrolls with content (not fixed)

The grain is applied directly on `body` as `background-image`, not as a `position: fixed` pseudo-element. This makes it feel like paper texture — it moves with the content as you scroll, rather than sitting stationary behind it. The fixed approach was never seriously considered; it was always meant to feel physically attached to the surface.

### Decision: Password overlay recreates grain via `::before`

Because the password overlay uses a solid `background-color` to block the body's grain, a `::before` pseudo-element on `#password-overlay` recreates the exact same multi-layer grain stack. This means the grain is implemented in two places (body and overlay), which is slightly fragile but functionally correct. A future consolidation could merge these, but it's low priority.

---

## Navigation

### Decision: Baked PNG diamond (not SVG, not CSS clip-path, not 3-slice)

The navigation went through more iterations than any other element. In chronological order:

1. **Transparent bar with hairline border-bottom** — The first implementation. Functional but generic. Felt template-like.
2. **Floating SVG pill frame** — Specified in an early CLAUDE.md version but never implemented. The idea was a pill-shaped SVG (`floating-header-green.svg`) with the Menu button sitting inside it.
3. **Floating marquise shape via CSS `clip-path: polygon()`** — Built and deployed. The tapered diamond ends were approximated with polygon points. Problem: `clip-path` clips everything inside the element, including `::before` pseudo-elements. This made it impossible to add a visible hairline border — the pseudo-element was clipped to the same shape as the fill, making the stroke invisible.
4. **Inline SVG with stroke-only path** — Proposed as the fix for the clip-path problem. The SVG would be just a `<path>` with a stroke and no fill, positioned behind the nav content. Body texture would show through the empty interior.
5. **3-slice approach** — Left diamond SVG (fixed) + middle CSS hairlines (stretchy) + right diamond SVG (fixed). This solved the responsive scaling problem (the whole SVG was shrinking proportionally instead of collapsing the middle). SVGs were programmatically split from the full diamond. The middle section was just `border-top` + `border-bottom`. This worked but introduced visible seam issues at the junction between SVG endpoints and CSS hairlines.
6. **Full-width single SVG** — Attempted at a fixed 680px width. Didn't scale well responsively.
7. **Semi-transparent SVG fill** — Andrew pushed for grain to show through the nav interior. The solution: set the SVG fill to the tinted color at 60-70% opacity so the body's grain bleeds through underneath.
8. **Baked PNG diamond** — The final, locked approach. The diamond shape, fill, grain texture, and hairlines are all composited together in Figma and exported as a single PNG. Current versions: `wide-nav-light.png` and `wide-nav-dark.png` (wider to accommodate 6 links). Old 4-link PNGs (`nav-diamond-light.png`, `nav-diamond-dark.png`) remain in repo but are no longer referenced. The PNG sits behind the nav content (positioned absolutely), and `filter: drop-shadow()` follows the diamond shape for depth. Dark mode swaps the PNG via `data-light`/`data-dark` attributes.

**Why PNG won:** Grain is raster, not vector. Baking fill + grain + hairlines into one image sidesteps all the CSS clipping, blending, and compositing complexity. The nav diamond is a self-contained visual asset — changing its appearance means re-exporting from Figma, not debugging CSS.

**Tradeoff accepted:** The nav fill colors are not CSS-adjustable. If the tint needs to change, the PNGs must be re-exported.

### Decision: Desktop shows 6 inline links, mobile shows Menu pill with dropdown

Desktop (above 900px): TRAVEL · FAQ · DC GUIDE · [monogram] · OUR STORY · REGISTRY · RSVP displayed inside a wider diamond frame (750px `.nav-bar`). Link groups use 1.8rem gap. RSVP has a breathing aura (`.nav-rsvp::after`).

Mobile (900px and below): `.nav-bar` hidden entirely. `.mobile-menu-btn` pill positioned top-right. Dropdown panel (`.mobile-menu-panel`) opens on tap with all 6 links. RSVP separated by a hairline (`.mobile-rsvp`). Panel closes on outside click or link click. Toggle logic in `initMenu()` in `site-init.js`.

### Decision: Drop shadow is `filter: drop-shadow()`, not `box-shadow`

`box-shadow` would cast a rectangular shadow around the nav container, not the diamond shape. `drop-shadow()` follows the alpha contour of the PNG, so the shadow hugs the marquise silhouette. Values were hand-tuned: light mode `0 4px 14px rgba(0, 0, 0, 0.22)`, dark mode `0 4px 14px rgba(0, 0, 0, 0.3)`.

---

## Layout & Responsive Design

### Decision: Single breakpoint at 900px

One structural breakpoint. Above 900px is desktop, below is mobile. This was a deliberate consolidation from an earlier codebase that had breakpoints at 900px, 768px, and 480px. The additional breakpoints contained mostly dead code from deleted page sections. Remaining font-size refinements for very small screens were evaluated and either folded into the 900px breakpoint or removed.

The RSVP page (`rsvp-styles.css`) retains its own 768px breakpoint — separate file, separate scope, intentionally independent.

### Decision: `content-wrapper` at 680px globally, 700px for registry

The registry page needs slightly more horizontal breathing room for its content, so its `.content-wrapper` is overridden to 700px. This is an intentional exception, not drift.

---

## Illustrations

### Decision: 200px desktop, ~175-180px mobile (not 250px)

The original CLAUDE.md spec said ~250px for desktop illustrations. During the registry page design work, 200px was found to be the better proportion — 250px made the rowhouse illustration dominate the page rather than complement it. Andrew confirmed 200px as the locked size.

### Decision: Light/dark variants via `data-light`/`data-dark` attributes

All illustrations that change between modes use custom data attributes on `<img>` tags. The `site-init.js` script handles swapping `src` values on mode toggle. This pattern is consistent across the monogram, illustrations, toggle icon, and nav diamond PNG.

---

## Registry

### Decision: Zola as the single registry hub (not separate Bloomingdale's + C&B links)

The project started with separate links to Bloomingdale's and Crate & Barrel registries. A custom "specialty item" registry was also explored — a self-built system using Google Apps Script + Google Sheets where guests could click "I'm buying this" and Andrew could confirm purchases via an admin interface.

The custom registry was built and functional (with pending/confirmed state management), but ultimately the approach was simplified: Zola serves as the single registry platform, consolidating all items from multiple retailers plus specialty one-offs into one guest-facing link (`zola.com/registry/adinaandandrew2026` — note the double "and," which is correct).

The `registry-admin.html` page was deleted as part of this consolidation.

### Decision: Registry page password is separate from other pages

Registry uses `beautifulsuperstar`, save-the-date uses `october17`. Different passwords for different pages, stored via `sessionStorage` so they persist within a browser session but not across sessions.

---

## Surface Layering Philosophy

### Decision: Two visible surfaces — nav diamond and body (not three)

Inspired by Haley Park's portfolio site, the design uses physically layered surfaces to create depth. The nav diamond is a distinct "sheet of paper" sitting on top of the body, with its own slightly different tint and grain. A `drop-shadow` gives it physical weight.

The footer was briefly considered as a third surface (slightly different tint from the body) but was intentionally simplified to `background: transparent` — it just inherits the body. The old `--color-footer-bg` variables were removed. Two surfaces creates enough depth without making the page feel busy.

---

## Shared Includes System

### Decision: `fetch()`-based HTML injection for nav and footer

Rather than copy-pasting the nav and footer HTML into every page, the markup lives in `includes/nav.html` and `includes/footer.html`. Pages have `<div id="nav-placeholder">` and `<div id="footer-placeholder">` as injection targets. The `includes/site-init.js` script fetches and injects both, then initializes dark mode, menu toggle, and image swapping.

`savethedate.html` is exempt — it has no nav and no footer.

This was implemented during a comprehensive audit that also stripped dead CSS, consolidated duplicate button classes, migrated inline page styles to styles.css, and deleted defunct files.

---

## Animated Intro (Rive)

### Decision: Rive for the metro station animation (not CSS/JS, not Lottie, not GSAP)

The intro concept: a hand-drawn DC Metro station scene → train arrives → doors open → envelope emerges → envelope opens to reveal the RSVP page, styled as a physical invitation.

Rive was chosen because the sequence requires state machine logic (idle → train arrives → doors open → envelope emerges → transition) with timeline-based clips. CSS/JS animation could handle individual transitions but not the coordinated state management. Lottie was considered but Rive's state machine model is a better fit for interactive, sequenced animation.

**Asset requirements:** Five separate SVGs exported from Illustrator — station background, train car body, envelope body, envelope flap (rotates separately), and invitation card. The friend who drew the illustrations separated these into individual layers.

**SVG export rules for Rive:** Outline all strokes before export, use Presentation Attributes styling (not CSS `<style>` blocks), decimal precision 2, release unnecessary clipping masks, use descriptive group/layer names (these become `id` attributes that map to Rive objects).

**Status:** Assets separated and export prep underway. Rive implementation not yet started.

---

## Monogram

### Decision: Optical size variant needed for small sizes

The monogram's thin hairline strokes disappear at small sizes (below ~80px). The recommended approach is an optical size variant — a separate file with manually thickened strokes, maintaining the same letterforms. This preserves a master file for large use and a `monogram-small` variant for nav and other small contexts. Stroke weight override via Illustrator (adding a small stroke on top of the fill) was considered but can look slightly off at close inspection.

**Status:** Not yet created. The nav currently uses the standard monogram at 36px (desktop) / 47px (mobile), where hairline disappearance is noticeable but not critical.

---

## Button System

### Decision: Two variants only — `.btn-normal` (background-colored debossed) and `.btn-priority` (reverse-colored debossed)

The codebase at one point had `.btn-normal`, `.btn-priority`, and a save-the-date-specific `.std-hotel-link` that was functionally identical to `.btn-normal`. During the CSS audit, `.std-hotel-link` was identified as dead duplication and consolidated.

Both buttons share the same deboss/letterpress interaction model, pill shape (`border-radius: 25px`), PP Watch uppercase styling, and SVG `feTurbulence` surface grain. They differ in color treatment: normal uses the page background color with contrasting text, priority uses the reverse (dark green fill in light mode, cream fill in dark mode).

## Dark Mode Text Shadow

### Decision: Separate emboss values for light and dark modes

Light mode: `0 2px 3px rgba(255, 255, 255, 0.9), 0 -1px 1px rgba(26, 58, 46, 0.1)` — creates a subtle pressed-into-paper emboss.

Dark mode: `0 1px 2px rgba(241, 237, 234, 0.1), 0 2px 5px rgba(0, 0, 0, 0.5)` — softer, with more shadow depth.

Buttons and nav links explicitly set `text-shadow: none` to stay crisp.

---

## Development Workflow

### Decision: This chat for design direction, Claude Code for implementation

Andrew uses this project chat for design exploration, decisions, and generating detailed instruction files (.md prompts). Implementation happens in Claude Code via the `cc` alias in the terminal. Instructions are delivered as downloadable .md files with explicit DO NOT sections and verification checklists — this pattern emerged because Claude Code would sometimes drift from the intent when given vague prompts.

### Decision: CLAUDE.md as the living spec

CLAUDE.md is the single source of truth. Claude Code reads it before making any changes. It gets updated whenever decisions are locked. The file has been through multiple major rewrites as the design evolved — early versions referenced the floating SVG pill nav (never implemented), the old font stack, and other since-superseded decisions.

### Decision: Clean rewrites over incremental patches

After the site audit revealed significant CSS cruft from earlier iterations (dead selectors, duplicate rules, conflicting breakpoints), Andrew established a preference for clean consolidated rewrites rather than patching. When a section needs rework, the old code is stripped entirely and replaced, rather than layered on top.

---

## Dark Mode Toggle

### Decision: Geometric SVG morph (not hand-drawn PNG)

The original toggle used hand-drawn sun/moon illustrations (`dark-mode-button.png` / `light-mode-button.png`) that swapped via the `data-light`/`data-dark` image system. This was visually incongruous — the organic, illustrated icon clashed with the brutalist PP Watch uppercase text beside it.

The replacement is a single SVG path that morphs between a full circle (representing the sun / light mode) and a crescent (representing the moon / dark mode) using SMIL `<animate>` elements. The icon uses `fill="currentColor"` so it inherits the page text color automatically — green in light mode, cream in dark mode — with no image swapping required. The morph duration is 400ms, matching the site's `@property` color transition timing.

**Path A (geometric) was chosen over Path B (keep illustration, change font pairing).** The geometric approach maintains consistency with the PP Watch UI type and the overall clean/precise feel of the nav and button system. The hand-drawn illustrations (Dupont rowhouse, etc.) remain for content areas where they belong — the toggle is a UI control, not content illustration.

**Technical approach:** SMIL animation with `begin="indefinite"` — JavaScript calls `.beginElement()` on the appropriate `<animate>` element when the toggle is clicked. The initial state is set via `setAttribute('d', ...)` without animation on page load if dark mode is already enabled. The old PNG swap approach remains intact for all other elements (monogram, nav diamond, illustrations) — only the toggle icon changed.

**Why not CSS `clip-path` morph?** Browser support for animating `clip-path` is inconsistent. SMIL `<animate>` with `attributeName="d"` works reliably in all modern browsers and produces smooth interpolation between path shapes with the same number of control points.

---

## Button Interaction Model

### Decision: Letterpress/deboss (not raised/lifted, not gradient sweep)

The button system went through three iterations:

1. **Gradient sweep** — Original approach using `background-size: 300%` and `background-position` animation on hover. Removed because it felt like a generic digital UI effect, incongruous with the physical paper language.

2. **Raised/lifted/pressed with outer shadows** — Inspired by DAUB UI's shadow scale system. Buttons had outer `box-shadow` at rest and lifted via `translateY(-2px)` on hover. Technically sound but felt wrong — chunky 3D objects on a page where everything else reads as flat printed stationery.

3. **Letterpress/deboss (final)** — All shadows are `inset`. Buttons are impressed into the paper surface. Hover deepens the impression (stronger inset + darker background). Active reaches maximum depth. Button never lifts off page.

**Key technical details:**
- Shadow variables use `rgba(0, 0, 0)` not green — dark shadows on dark green buttons were invisible.
- Bevel effect (dark top edge + light bottom edge) via hard 0-blur inset shadows, not multi-color borders (which create miter seams on rounded corners).
- Button surface texture uses SVG `feTurbulence` via `::before` with `mix-blend-mode: soft-light` at 18% opacity — the DAUB approach to per-element grain.
- `translateY` on hover was removed entirely. Only active has `translateY(0.5px)`.

**Design reference:** DAUB UI (daub.dev) informed the shadow scale and texture technique. The raised-button model was rejected in favor of deboss to match the wedding invitation aesthetic.

---

## Dark Mode Toggle

### Decision: Geometric SVG morph (not hand-drawn PNG)

The hand-drawn sun/moon illustrations clashed with the brutalist PP Watch type beside them. Replaced with a single SVG `<path>` that morphs between a full circle (sun) and crescent (moon) using SMIL `<animate>` elements. Uses `fill="currentColor"` — inherits green/cream automatically via CSS. Duration: 400ms matching color transitions.

Path A (geometric) was chosen over Path B (keep illustration, change font pairing). The hand-drawn illustrations remain for content areas — the toggle is a UI control, not content.

**Technical:** SMIL with `begin="indefinite"` triggered by JavaScript `.beginElement()`. Initial state set via `setAttribute('d', ...)` on page load (no animation). Old PNG swap system still used for all other elements.

---

## Mobile Navigation

### Decision: Menu pill button with dropdown (supersedes 340px inline diamond)

The mobile nav went through extensive iteration:

1. **Filled pill "Menu" button** — Original approach. Worked but felt generic.
2. **Diamond-shaped marquise PNG** with CSS crossfade panel — The marquise at mobile size looked like a football or lemon. Shape doesn't work below ~500px width.
3. **SVG path morph via Flubber.js** — Marquise morphing to rounded rectangle. Technically worked but SVG hairlines rendered fuzzy at small sizes.
4. **Text "MENU" + double hairlines** trigger — Considered but bypassed.
5. **Desktop diamond scaled to 340px** — All four links fit inside the diamond at 0.55rem. Worked well when the nav had only 4 links.
6. **Menu pill button with dropdown (final)** — When the nav expanded from 4 to 6 links (adding Our Story and DC Guide), six links no longer fit in a 340px diamond. Returned to the menu button approach with a `btn-normal`-styled pill (`.mobile-menu-btn`) positioned top-right. Dropdown panel (`.mobile-menu-panel`) lists all 6 links with RSVP separated by a hairline. Panel closes on outside click or link click.

**Why iteration 5 was superseded:** The 340px diamond worked perfectly for 4 short link words but couldn't accommodate 6 (especially "Our Story" and "DC Guide" which are longer). Rather than shrinking type further or truncating labels, the menu button provides a cleaner mobile experience.

**What was removed from iteration 5:** The mobile `.nav-bar` rules (340px width, 0.55rem links, monogram absolute positioning above diamond) were replaced by `display: none`. New `.mobile-menu-btn` and `.mobile-menu-panel` elements and styles were added.

---

## Nav Link Hover

### Decision: Accent color shift + letterpress emboss + draw-in underline (not opacity)

Original: `opacity: 0.6` on hover. Too subtle — barely perceptible, especially inside the diamond.

Current: Color shifts from `--color-dark-green` to `--color-accent` (`#2d5a4a`), `text-shadow` shifts from `--emboss-rest` to `--emboss-hover`, and a 1px underline draws in from center (`width: 0` → `100%`, `0.25s ease`). In dark mode, text dims to `rgba(241, 237, 234, 0.7)` and underline uses the same dimmed cream. The draw-in underline does NOT apply to `.nav-rsvp` (which has its own static double underline emphasis).

Monogram hover: `transform: scale(0.96) rotate(-3deg)` with reduced `drop-shadow` intensity — a press-and-tilt effect. Active: `scale(0.93)`. The rotation adds personality without being distracting.

The same draw-in underline applies to `.mobile-menu-link` elements in the dropdown panel (excluding `.mobile-rsvp`).

---

## Baked Texture Tiles

### Decision: Pre-composited PNGs (not runtime blend modes)

The original approach used 4 PNG texture layers (light) / 2 PNG layers (dark) stacked on `body` with `background-blend-mode: soft-light` and a `linear-gradient` overlay controlling opacity. This worked on desktop Chrome but failed on mobile:

1. **Mobile Chrome** rendered the grain much heavier than desktop, producing a grey/muddy appearance instead of warm white
2. **Desktop Safari** showed a slightly different composite than desktop Chrome due to P3 color management
3. **High-DPI screens** (3x mobile) made the 400px texture tiles coarser since each CSS pixel = 3 physical pixels
4. Attempted fix: high-DPI media query with larger tiles (800px) and higher overlay opacity (0.92) — improved but didn't match desktop exactly
5. Attempted fix: reducing to 2 layers with 600px tiles — still didn't match

**Root cause:** `background-blend-mode: soft-light` is computed by the GPU at runtime, and different browsers/devices composite differently. There's no CSS override that forces identical rendering.

**Solution:** Composited the final texture in Figma (800×800 frame, `#F1EDEA` fill, 4 grain layers at soft-light, exported as PNG at 1x). CSS is now trivially simple: `background-image: url(...)` + `background-repeat: repeat` + `background-size: 200px 200px`. No blend modes, no runtime compositing. Every device renders the flat tile identically.

Dark mode tile created the same way with `#122a20` base + 2 grain layers.

Note: Figma's "Flatten" command destroys blend mode results — just export the frame directly as PNG (right-click → Export → PNG 1x).

---

## Dark Mode Toggle — Unicode Symbols with Breathing Aura

### Decision: ☀ / ⏾ symbols with CSS aura (not SVG morph, not cursor shimmer)

The toggle went through extensive iteration:

1. **Hand-drawn PNG sun/moon + text label** — original approach. Felt inconsistent with the brutalist PP Watch type beside the illustration.
2. **Geometric SVG morph** (SMIL animate, circle ↔ crescent) — technically sound, used `fill="currentColor"` for theme inheritance. But the toggle as a whole didn't feel refined enough.
3. **Unicode symbols with foil shimmer** (cursor-tracking radial gradient) — ✹ sun and ⏾ moon rendered via `background-clip: text`. Hover effect tracked cursor position with `mousemove`. Felt too gimmicky/interactive — "like a laser pointer."
4. **Unicode symbols with breathing aura** — ✹ symbol, but hover shimmer replaced with a static CSS-animated glow. Felt good but ✹ read as abstract — didn't immediately say "sun."
5. **☀ symbol with breathing aura (final)** — ✹ replaced with ☀ (U+2600, "Black Sun with Rays"). More recognizable as a sun. Renders at 36px (down from ✹'s 42px — ☀ has more visual weight at smaller size). Moon symbol ⏾ unchanged at 28px.

**Symbol choice:** ☀ (U+2600, "Black Sun with Rays") for sun, ⏾ (U+23FE, "Power Sleep Symbol" — renders as crescent) for moon. ☀ renders at 36px, ⏾ at 28px — different sizes needed because the glyphs have very different visual weights at the same font-size.

**Color:** Deep olive green `rgba(48, 78, 62, 0.75)` for sun (barely green, good contrast on cream), accent green `rgba(45, 90, 74, 0.5)` for moon (greener, visible on dark background). Both use `background-clip: text` + `-webkit-text-fill-color: transparent` for the tinted foil effect.

**Centering fix:** ☀ and ⏾ have different glyph bounding boxes, causing positional shift when toggling. Fixed with a 48×48px flex container with `align-items: center; justify-content: center` on `.toggle-sym`.

---

## Nav Diamond z-index

### Decision: z-index 0 (not 1)

The nav diamond PNG contains an opaque texture fill inside the diamond shape (baked grain matching the page background). When both the diamond and the nav links/monogram shared `z-index: 1`, the diamond's opaque fill covered the text elements — they were invisible.

Previously masked by `mix-blend-mode: multiply` which made near-white areas effectively transparent. But `multiply` was removed because the diamond PNG already has a transparent background outside the shape — `multiply` was actually darkening the transparent areas and creating artifacts.

Fix: diamond at `z-index: 0`, all text/link elements at `z-index: 1`.

---

## Footer Simplification

### Decision: Toggle only, no info text

The "ADINA & ANDREW · OCTOBER 17, 2026 · WASHINGTON, DC" text was removed from the footer. It felt corporate and redundant — guests already know whose wedding it is. The footer now contains only the dark mode toggle, right-aligned.

---

## Mobile Registry Page Spacing

### Decision: Disable flex stretch on short pages

The registry page content is short enough to fit on one screen, but `#protected-content.unlocked` has `min-height: 100vh` + `flex-direction: column` and `.site-footer` has `margin-top: auto`. This pushes the footer to the absolute bottom of the viewport, creating a large dead zone between the "Visit Our Registry" button and the toggle.

Fix (mobile only, registry-specific):
- `body.page-registry .registry-page { flex: none }` — stops the main content from stretching
- `body.page-registry #protected-content.unlocked { min-height: auto }` — lets content determine height
- `body.page-registry .site-footer { margin-top: 2.4rem }` — explicit spacing instead of auto-push

This doesn't affect other pages (travel, FAQ) which will have enough content to fill the viewport naturally.

---

## Content Pages — FAQ, Schedule, Travel

### Decision: All pages follow the registry.html template pattern

Three new content pages were created (`faq.html`, `schedule.html`, `travel.html`) using `registry.html` as the exact structural template: password overlay → nav placeholder → protected content with `.registry-page` main element → footer placeholder → dark mode flash script → site-init.js.

**Shared classes across all pages:**
- `.registry-page` for the main element (controls flex layout)
- `.registry-title` for page headlines (PP Playground)
- `.registry-illustration` for illustrations (rowhouse SVG placeholder)
- `.registry-cta` + `.btn-priority` for CTA buttons
- `.registry-section` + `.content-wrapper` for content containment

**Page-specific body classes** (`page-faq`, `page-schedule`, `page-travel`, `page-our-story`, `page-dc-guide`) scope padding, flex, and footer overrides in styles.css. All pages sharing `beautifulsuperstar` use the shared `siteUnlocked` session storage key.

**Schedule page** is titled "Invitation" (not "Schedule") — the schedule is the invitation content. The existing `rsvp.html` with Google Sheets integration remains untouched. Times for some events are marked with `<!-- TODO: Add times -->` comments.

**Travel page** reuses hotel content from `savethedate.html` with new class names (`.travel-hotel`, `.travel-hotel-name`, `.travel-hotel-description`). Adds transit directions section with Metro/car/bus instructions.

**Link styles** (`.schedule-link`, `.travel-link`) use subtle underlines (`text-decoration-color` at 30% opacity) that darken to accent color on hover — same pattern, namespaced per page.

---

## Content Page Styling Pass — Left-Alignment and Consistent Sizing

### Decision: Body text left-aligned on content pages (not centered)

Body text on the content pages (FAQ, Travel, Schedule, Registry) was changed from `text-align: center` to `text-align: left`. This applies to paragraph-level body text only — page titles (PP Playground), section headings (PP Watch), illustrations, and CTA buttons remain centered. The Save the Date page remains fully centered — it's a formal invitation card with a different design intent.

This matches the precedent set by the Save the Date's travel section, where `.std-hotel` and `.std-travel-intro` were already left-aligned. Body text reads more naturally as left-aligned paragraphs than as centered blocks.

Affected selectors: `.faq-answer`, `.travel-hotel-description`, `.travel-direction-item`, `.schedule-event-description`, `.registry-intro`. Container-level alignment changed to left on `.travel-hotel`, `.faq-item`, `.schedule-event`.

`.std-intro` and `.std-details` were accidentally changed to left-aligned during the pass and then reverted — the Save the Date page must stay centered.

### Decision: Consistent block sizing across content pages

Hotel blocks on the Travel page, FAQ items, and schedule events were resized to match the Save the Date's `.std-hotel` proportions — the established "block pattern" is: 1.1rem name, 0.1em letter-spacing, 0.75rem name margin-bottom, 1rem body text, 0.6rem body margin-bottom, 2.5rem block margin-bottom.

---

## Travel Page — D.C. Flag Illustration and Section Organization

### Decision: D.C. flag illustration (not rowhouse)

The Travel page illustration was swapped from the rowhouse SVG to a hand-drawn D.C. flag PNG (`flag-light.png` / `flag-dark.png`). The flag is exported from Affinity Designer at 600px wide (3x retina coverage at 200px display size) with transparent background.

### Decision: Hotels and Transportation section subheads

A "Hotels" subhead (`<h2 class="travel-section-title">`) was added above the hotel blocks. "Getting There" was renamed to "Transportation". These section titles use the existing `.travel-section-title` class (PP Watch, centered, 0.85rem uppercase).

---

## Schedule Page Restructure

### Decision: Event name leads each block (not date)

The schedule page event blocks were restructured. The original hierarchy was: Date heading → Event Name → Address → Body → Dress Code, with dates in their own separate `.schedule-day` wrappers above each event.

The new hierarchy is: Event Name → Date (inline as `.schedule-event-detail`) → Address → Body → Dress Code. Event names (PP Playground) now lead each block, with the date as a supporting detail line below. This reads more naturally — the event identity comes first, then the when/where.

Other schedule changes: Dress code switched from PP Watch (`.schedule-event-detail`) to Sentient (`.schedule-event-description`) for readability. After Party date/time combined into one line with a middle dot separator. Farewell Brunch now has a date line. Event name size increased from 2.2rem to 2.8rem (desktop).

---

## FAQ Page — RSVP Button Removed, Inline Link Added

### Decision: Inline RSVP link (not CTA button)

The FAQ page's bottom "RSVP Now" button (`.btn-priority`) was removed. The RSVP question answer now contains an inline link using the `.schedule-link` class instead. Various Q&A copy was tightened.

---

## Illustration Grain Overlay — Tested and Rejected

### Decision: No CSS grain overlay on illustrations

A CSS grain overlay was tested on the Travel page flag illustration. The approach: wrap the `<img>` in a `.illustration-wrapper` div, apply SVG `feTurbulence` noise via `::after` with `mix-blend-mode: soft-light` (same technique as button grain). The problem: `::after` covers the full rectangular bounds of the wrapper, so the noise pattern is visible as a rectangle against the transparent PNG areas. This approach doesn't work for irregular-shaped transparent illustrations.

Texture on illustrations should be baked into the asset at the design tool level (Affinity Designer / Figma) before export, not applied via CSS.

---

## Illustration Export from Affinity Designer

### Decision: 600px wide export for 3x retina coverage

PNG illustrations are exported from Affinity Designer at 600px wide (height scales proportionally with Lock Aspect Ratio). This provides clean 3x retina coverage at the 200px CSS display size. Resample: Bilinear. Matte: transparent. Light and dark variants must have identical artboard/canvas bounds to prevent size jumps on the `data-light`/`data-dark` swap.

---

## Save the Date — Dupont Illustration Renamed

### Decision: `Dupont-light.png` naming convention

The Dupont illustration was renamed from `Dupont.png` to `Dupont-light.png` for consistency with the `data-light`/`data-dark` naming convention used across all other illustrations. Both the HTML `src` and the JavaScript `updateImages()` function in `savethedate.html` were updated. The dark variant remains `Dupont-dark.png`.

---

## Homepage — Standalone Invitation Page with Embossed Diamond Nav

### Decision: Standalone page with static embossed diamond nav

`homepage.html` was created as the primary landing page for the wedding website. It uses no floating nav but does use the shared footer (with the Unicode symbol dark mode toggle). The standalone `btn-normal` text toggle was initially used but replaced with the shared footer for consistency.

The content flow from top to bottom: invitation intro text ("You are cordially invited...") → names image (same PNG as Save the Date) → date and city → static diamond nav → RSVP button → hairline divider → two event summary blocks (Ceremony and Reception, After Party) → Dupont illustration as closing element.

**Static embossed diamond nav:** The floating marquise nav used on all other content pages is replaced on the homepage with a static diamond that sits in the content flow. The diamond uses the letterpress/emboss drop-shadow treatment (same as illustrations: white highlight below, dark shadow above) instead of the floating shadow used on the fixed nav. This makes it feel printed on the page rather than hovering above it. The monogram was removed from inside the diamond — only the four nav links remain (Travel, FAQ, Registry, RSVP), evenly spaced across the shape. Opacity set to 0.9 to match illustration treatment.

**Why Option B (static diamond) over other approaches:**

- Option A (no nav, no footer, just inline text links) was considered but the diamond provides visual structure and brand identity.
- Option C (keep floating nav, remove inline links) was considered but the floating nav felt too heavy on a page intended to read as a formal invitation.
- Option B (static diamond in content flow) won because it provides navigation while feeling like part of the printed invitation rather than website chrome.

**Event summaries** below the hairline are left-aligned within a 600px container, matching the Schedule/Invitation page layout — not centered. The top section (invitation text, names, diamond nav, RSVP button) remains centered. This creates a clear shift: formal centered invitation above the hairline, practical left-aligned information below it. The Dupont illustration at the bottom stays centered as a closing element.

Event blocks are condensed versions of the Schedule page content — just event name (PP Playground), date, venue, and dress code as PP Watch metadata lines. No body text descriptions except for the After Party. Only Ceremony and Reception and After Party appear on the homepage — Welcome Party is excluded.

The homepage is currently at `/homepage` (file: `homepage.html`) while `index.html` continues to redirect to Save the Date. When the site goes live with the real homepage, the file will be renamed to `index.html`.

---

## Travel Page — PP Playground Section Titles and Hairline Dividers

### Decision: PP Playground section titles (not PP Watch)

The Travel page section titles ("Hotels" and "Transportation") were changed from PP Watch 0.85rem uppercase to PP Playground 2.8rem. This makes them feel like section openers rather than structural labels, matching how the Save the Date uses PP Playground for its "Travel" section title.

Hairline dividers (`.section-divider`) were added before both section titles — between the flag illustration and "Hotels", and between the last hotel block and "Transportation". The divider uses `var(--border-hairline)` with dark mode support, spaced at `margin: 3rem auto 2.5rem` to match the Save the Date's rhythm.

A mobile override reduces section title size to 2rem.

---

## Unified Password Session Storage

### Decision: Shared `siteUnlocked` key (not per-page keys)

All pages sharing the `beautifulsuperstar` password now use a single shared `sessionStorage` key: `siteUnlocked`. Entering the password on any page (FAQ, Travel, Schedule, Registry, Homepage) unlocks all of them for the rest of the browser session. Previously each page used its own key (`faqUnlocked`, `travelUnlocked`, etc.), requiring guests to re-enter the password on every page.

Save the Date remains separate with its own key (`saveTheDateUnlocked`) since it uses a different password (`october17`).

---

## Monogram Link

### Decision: Monogram links to `/homepage`

The monogram in the shared nav (`includes/nav.html`) now links to `/homepage` instead of `/`. This will be changed back to `/` when the homepage moves to `index.html`.

---

## Button Labels — "Book Room"

### Decision: "Book Room" for hotel booking buttons

Hotel booking buttons on both the Travel page and Save the Date page were changed to "Book Room" (from "Book Now" and "Visit Website" respectively). citizenM buttons remain "Visit Website" since there's no room block to book.

---

## Meta Descriptions Standardized

### Decision: Uniform meta description across all pages

All pages now use the same meta description: "Adina and Andrew's wedding website."

---

## Schedule Page — Dress Code Formatting

### Decision: Dress code labels as PP Watch metadata

Short dress code labels (Black Tie Preferred, Semi-Formal) were moved from Sentient body text (`.schedule-event-description`) to PP Watch metadata lines (`.schedule-event-detail`). The "Dress Code:" prefix was removed — context makes it clear. Explanatory text (e.g., "Sport coats and trousers, or dresses, jumpsuits, and blouses") stays as a Sentient `.schedule-event-description` paragraph below the label. Breathing room (`margin-top: 2rem`) was added above the RSVP button at the bottom of the Schedule page.

---

## Consistent Illustration Vertical Rhythm

### Decision: Fixed height for `.registry-illustration`

`.registry-illustration` was changed from `max-height: 250px` to a fixed `height: 200px` (mobile: `height: 180px`) with `object-fit: contain`. This ensures the distance from title to first content block is consistent across all pages regardless of illustration proportions.

---

## FAQ Password Overlay — Title Centering

### Decision: Nowrap title with widened container

`white-space: nowrap` was added to `body.page-faq .password-container h2` to keep "Questions & Answers" on one line. The FAQ password container was widened to `max-width: 600px` to prevent the nowrap text from overflowing off-center.

---

## Nav Expansion — 4 Links to 6

### Decision: 6-link nav with wider diamond and reordered groupings

The nav expanded from 4 links (Travel, FAQ, Registry, RSVP) to 6 (Travel, FAQ, DC Guide, Our Story, Registry, RSVP) to accommodate two new pages. The wider diamond PNG (`wide-nav-light.png` / `wide-nav-dark.png`) was exported from Figma. `.nav-bar` width increased from 550px to 750px, gaps tightened from 2rem to 1.8rem.

**Link grouping:** "Guest stuff" (Travel, FAQ, DC Guide) sits left of the monogram; "us stuff + RSVP" (Our Story, Registry, RSVP) sits right. This groups practical travel/logistics info on one side and personal/action items on the other.

**RSVP emphasis:** The RSVP link (`.nav-rsvp`) has a `::after` pseudo-element with a static double hairline underline (two 1px lines separated by ~2px gap). Color matches link text at 0.4 opacity. Originally a breathing aura (radial gradient with `@keyframes breathe`) — replaced because the animated glow competed with the toggle aura and felt too busy. The static double underline is quieter but still distinguishes RSVP from other links. Same treatment on `.mobile-rsvp` in the dropdown.

**Homepage static diamond** also updated to 6 links with wider PNG and 1.8rem gaps. On mobile, the homepage diamond hides and links reflow into stacked centered rows (no menu button on homepage — it already has a dedicated RSVP button below the nav).

---

## Page Intro Text — `.page-intro`

### Decision: Rename `.registry-intro` to `.page-intro` and add to all content pages

The `.registry-intro` class was renamed to `.page-intro` to reflect its use across all content pages, not just the registry. The mobile override was de-scoped from `body.page-registry .registry-intro` to just `.page-intro` so it applies universally.

Intro paragraphs added below illustrations on Travel, FAQ, and Schedule pages. All text is placeholder — Andrew will workshop final copy.

---

## Our Story Page

### Decision: Photo timeline with captions (superseded — see "Our Story Rebuild")

`our-story.html` was originally created as a photo timeline page. Uses `.story-timeline` (600px max-width) containing `.story-moment` blocks with photos (`.story-photo-single` for one image, `.story-photo-pair` for two side-by-side), captions (`.story-caption` with `.story-caption-label`), and hairline dividers (`.story-divider`). Closes with `.story-closing` text.

Photos are web-optimized JPGs (prefixed `web-`) stored in `images/our-story/`. Originals (from camera) are also in the folder but not referenced in HTML. Uses the rowhouse illustration. All caption text is placeholder.

On mobile, photo pairs stack vertically and singles narrow to 320px max-width. All styles are in `styles.css` — no inline `<style>` block.

### Decision: Our Story Rebuild — narrative prose with carousels (April 26, 2026)

The page was rebuilt from a chronological grid of nine labeled photo moments (label → photo → caption → divider) into seven narrative sections of continuous prose, punctuated by photo groups. Reasons:

- **The labeled-moments structure read like a slideshow caption sheet**, not a story. Each `.story-caption-label` and brief caption felt redundant when the photos themselves carried the moment.
- **Real prose lets the relationship speak first.** The new structure puts paragraphs of narrative ahead of the visuals — the photos illustrate the writing, not the other way around.
- **Some moments don't need photos** (e.g., the meeting paragraph, the long-hard-conversation paragraph). The grid layout couldn't support that — every moment needed its photo. Prose-first does.
- **Multi-photo moments belong in carousels, not pairs of frames.** First Dates, Long Distance, Together, and The Proposal each span 3–5 photos that read as a sequence. A flat grid of 4 thumbnails dilutes the moment; a swipeable sequence preserves it.

**New conventions:**
- `.story-prose` — narrative paragraph blocks. Sentient body type, max-width 480px (matches `.story-caption`), centered, opacity 0.85, dark mode override. Multiple `<p>` children allowed.
- `.story-prose-placeholder` — inline span flagging unfinished copy. Dotted underline + 0.55 opacity + light letter-spacing. Italic was rejected because of the site-wide no-italic rule for Sentient — dotted underline carries the "draft" signal without breaking that rule.
- `.story-caption-label` is now used as a section *footer* below photo groups (where captions used to sit) rather than a label inside `.story-caption`.
- `.story-carousel` family — see below.

The page's `.page-intro` line ("How a group chat turned into a life together.") was removed. The narrative structure makes a separate intro paragraph redundant.

### Decision: Carousel architecture — scroll-snap + arrows + dots (April 26, 2026)

The four photo carousels (First Dates, Long Distance, Together, The Proposal) use native `scroll-snap-type: x mandatory` on a flex track, with absolutely-positioned arrow buttons and click-to-scroll dot indicators below. No external libraries.

**Why scroll-snap and not transform-based slides:**
- Native scroll-snap supports touch swipe, mouse wheel scrub, and trackpad gestures for free
- Browser handles the smooth scroll animation
- Keyboard navigation just needs to call `track.scrollTo()` — no manual transform math
- Works without JS (the scroll itself does); JS only enhances with arrows and dot sync

**Class family** (all under `.story-carousel`):
- `.story-carousel` — relative container, max-width 480px
- `.story-carousel-track` — `overflow-x: auto`, scroll-snap, hidden scrollbar, `tabindex="0"` for keyboard
- `.story-carousel-slide` — `flex: 0 0 100%`, scroll-snap-align center
- `.story-carousel-arrow` (with `-prev` / `-next` modifiers) — small circular buttons mirroring `.btn-normal`'s debossed aesthetic: same `feTurbulence` `::before` grain, same `--shadow-raised`/`--shadow-lifted`/`--shadow-pressed` token transitions, same dark mode treatment. PP Watch chevron glyph (`‹` / `›`).
- `.story-carousel-arrow.disabled` — at first/last slide, `opacity: 0.35`, `aria-disabled="true"`, click handler skips
- `.story-carousel-dots` / `.story-carousel-dot` (with `.active` modifier) — 6×6px circles, 8px gap, click jumps to that slide

**Attribute pattern:** `data-carousel` on the container, `data-carousel-dots` on the dots placeholder. JS queries these and builds dots dynamically, so adding more carousels in the future requires only the HTML — no JS changes.

**Desktop arrow position:** `left: -50px` / `right: -50px` (outside the photo). **Mobile (≤900px):** arrows move inside the photo edges (`left: 8px` / `right: 8px`) with a semi-transparent backdrop (`rgba(241, 237, 234, 0.85)` light, `rgba(18, 42, 32, 0.85)` dark) plus `backdrop-filter: blur(2px)` for legibility on light photos.

**Photos retain natural aspect ratios** — the spec explicitly didn't want forced uniform aspect. Arrows recenter to the current photo's height via `position: absolute; top: 50%` against the carousel container, so per-slide height differences are handled.

### Decision: Carousel JS in new file `includes/carousel.js` (April 26, 2026)

Carousel logic lives in a new file, not appended to `site-init.js`. Reasons:
- `site-init.js` is currently single-purpose (nav include, theme toggle, mobile menu) and runs on every page
- Carousels only exist on `our-story.html`
- Bundling carousel JS into `site-init.js` would ship ~80 unused lines to every other page
- A separate file keeps each script's intent clear

`includes/carousel.js` is loaded via `<script src="includes/carousel.js">` after the existing `<script src="includes/site-init.js">` tag, only on `our-story.html`. Vanilla JS, function-scoped, matches the existing `site-init.js` style. Throttles scroll listener with `requestAnimationFrame` for the active-dot sync.

### Decision: Per-photo captions on Our Story (April 29, 2026)

Replaced the single section-level `.story-caption-label` per Our Story section with per-photo captions that swap (180ms crossfade) as the active carousel slide changes. Each `.story-carousel-slide` carries a `data-caption` attribute; a `<p class="story-photo-caption" data-photo-caption>` after the carousel is populated by `includes/carousel.js`. Sections 4 (Malcolm X Park, single photo) uses a static caption with the same `.story-photo-caption` class — no `data-photo-caption` attribute. Section 7 (The Proposal) intentionally retains the old `.story-caption-label` pattern for now. The Family section converted from `.story-photo-pair` to a 2-slide carousel; the Together section's placeholder prose was replaced with final copy. The existing `.story-caption-label` rules remain in styles.css since Section 7 still uses them.

---

## DC Guide Page

### Decision: Follows Travel page template exactly

`dc-guide.html` was created using the Travel page as an exact structural template. It reuses all Travel page classes: `.travel-section-title`, `.travel-hotel`, `.travel-hotel-name`, `.travel-hotel-description`, `.section-divider`, `.travel-directions`, `.travel-direction-item`. No new CSS classes needed.

Two sections: "Food" (4 placeholder restaurant blocks) and "Activities" (5 placeholder items). Uses the Dupont illustration. All copy is lorem ipsum placeholder.

---

## Travel Section Title Sizing

### Decision: Increase from 2.8rem to 3.2rem

`.travel-section-title` ("Hotels", "Transportation", and DC Guide sections) increased from 2.8rem to 3.2rem desktop, 2rem to 2.3rem mobile. The previous size felt too close to body text weight — the new size reads as a stronger section anchor while remaining clearly subordinate to the page title (`.registry-title` at `clamp(4rem, 8vw, 5.5rem)`).

---

## FAQ Additions

### Decision: Two new Q&A items added

"When should I RSVP by?" (September 1, 2026 — placeholder date) and "How do I get to the venue?" (brief answer encouraging Metro, links to Travel page) were added before the existing "How do I RSVP?" item, which remains last. FAQ now has 7 items total.

---

## Registry Button Change

### Decision: Registry CTA changed from `btn-priority` to `btn-normal`

The "Visit Our Registry" button on the registry page was changed from `.btn-priority` (reverse-colored) to `.btn-normal` (background-colored). The priority button style is being reserved for the most important action (RSVP).

---

## DC Guide — Hairline Consistency

### Decision: No divider between page intro and first section

The DC Guide page had a `<hr class="section-divider">` between the `.page-intro` text and the "Food" section title. The Travel page does NOT have a divider before its first section ("Hotels") — the divider only separates Hotels from Transportation. Removed the extra divider from DC Guide to match the Travel page pattern. Divider between "Food" and "Activities" remains.

---

## Mobile Menu — Backdrop Fade

### Decision: Wire up existing `.menu-open` CSS

The CSS for `main.menu-open` / `.site-footer.menu-open` (opacity 0.4, pointer-events none) already existed in `styles.css` but the JavaScript in `initMenu()` never added the class. Fixed by adding `setBackdropFade()` calls to all three close paths (button toggle, outside click, link click) in `site-init.js`. This dims the page content when the mobile menu is open, focusing attention on the dropdown.

---

## Mobile Content Spacing

### Decision: Increase top padding from 90px to 120px on content pages

On mobile, the menu button sits at `top: 4rem` (~64px) and is ~36px tall, so its bottom edge is at ~100px. Content pages (FAQ, Schedule, Travel, Our Story, DC Guide) had `padding-top: 90px`, causing titles to overlap the button zone. Increased to 120px. Registry already at 125px — unchanged. Homepage has no menu button — unchanged (scoped via body class exclusion).

---

## Rejected / Abandoned Ideas

- **Squarespace** — Abandoned for lack of customization control
- **Custom self-hosted registry** with Google Apps Script + Sheets — Built and working, but consolidated to Zola for simplicity
- **CSS `clip-path` for nav shape** — Clips pseudo-elements, making hairline borders impossible
- **3-slice SVG nav** (left point + stretchy middle + right point) — Worked but had visible seam issues at SVG/CSS junctions
- **Transparent grain PNGs from Figma** — Figma cannot export transparent PNGs from layers using non-Normal blend modes; it silently adds opaque backgrounds
- **`theme-transitioning` JavaScript class for dark mode** — Replaced by CSS `@property` transitions
- **Footer as a separate tinted surface** — Simplified to transparent/inherited
- **Separate Bloomingdale's and Crate & Barrel registry links** — Consolidated to single Zola link
- **registry-admin.html** — Deleted after moving to Zola
- **Inline links in 340px mobile diamond** — Worked for 4 links but couldn't accommodate 6; replaced with menu pill button + dropdown
- **Original pill-shaped mobile menu button** (iteration 1) — Felt generic; later returned to a refined version when 6 links required it
- **CSS clip-path diamond menu button** — Abandoned because clip-path clips pseudo-elements and inset shadows ignore it
- **SVG path morph mobile menu (Flubber.js)** — Technically worked but SVG hairlines rendered fuzzy at small sizes
- **CSS clip-path morph dropdown** — Abandoned in favor of eliminating the dropdown entirely
- **Hand-drawn sun/moon toggle PNGs** — Replaced with geometric SVG morph, then Unicode symbols
- **Geometric SVG morph toggle** (SMIL animate) — Replaced with Unicode symbols + breathing aura
- **Cursor-tracking foil shimmer** on toggle — Replaced with static CSS breathing aura
- **Runtime `background-blend-mode: soft-light`** for grain — Replaced with pre-composited PNG tiles due to cross-browser rendering differences
- **High-DPI media query for textures** — Attempted 600px/800px tiles with higher overlay opacity; didn't solve the fundamental blend-mode inconsistency
- **`mix-blend-mode: multiply` on nav diamond** — Removed; was darkening transparent areas. Diamond already has transparent background outside shape.
- **Footer info text** ("Adina & Andrew · October 17, 2026 · Washington, DC") — Removed as redundant
- **Gradient sweep button hover** — Replaced with letterpress/deboss system
- **Raised/lifted button shadows** — Replaced with all-inset deboss model
- **CSS grain overlay on illustrations** (`.illustration-wrapper::after` with SVG feTurbulence) — Rejected because the rectangular pseudo-element is visible against transparent PNG areas. Texture should be baked into assets at the design tool level.
- **Affinity Designer Inner Shadow for letterpress effect on illustrations** — Tested but only affects edges, doesn't add texture to flat fill areas
- **Affinity Designer pixel layer noise overlay for illustration texture** — Explored but complex workflow; Figma noise plugins are simpler for this use case
- **`.std-intro` and `.std-details` left-alignment** — Accidentally applied during content page left-alignment pass, then reverted. Save the Date must remain centered.
- **Homepage with floating nav** (Option C) — Felt too heavy on a formal invitation page. Static embossed diamond chosen instead.
- **Homepage with no diamond, just text links** (Option A) — Too minimal; diamond provides visual structure and brand identity.
- **Monogram inside homepage static diamond** — Removed because with only four links the spacing was uneven; the diamond reads cleaner without it.
- **RSVP breathing aura** (`.nav-rsvp::after` radial gradient + `@keyframes breathe`) — Replaced with static double hairline underline. The animated glow competed with the toggle aura and felt too busy.
- **✹ (U+2739) toggle glyph** — Replaced with ☀ (U+2600). ✹ read as abstract; ☀ is immediately recognizable as a sun.

### Homepage → Landing Page Layout (Approach 1)
**Date:** March 29, 2026
**Decision:** Moved the shared floating nav to the top of the homepage (consistent with all inner pages). Removed invitation preamble text ("You are cordially invited..."), ceremony/reception details, after party details, and Dupont fountain illustration. Homepage is now a clean landing page: nav → names → date → RSVP button. The names image serves as hero content rather than an invitation header.
**Rationale:** The homepage needed to function as a landing page, not a semi-invitation. The nav should be consistently positioned across all pages. Event details belong on the Schedule page. The ceremonial feel comes from the typography and design, not from invitation language.

---

## Homepage Redesigned to Clean Landing Page

### Decision: Strip homepage to title card with shared nav (Approach 1)

**Date:** March 30, 2026

The homepage was converted from a "semi-invitation" layout (with preamble text, ceremony/reception details, after party details, static embossed diamond nav, and RSVP button) to a clean landing page. Changes:

- Shared floating nav moved to the top (via `#nav-placeholder`, consistent with all inner pages)
- Removed "You are cordially invited..." preamble
- Removed ceremony and after party event blocks
- Removed the static embossed diamond nav (`.home-nav`) — homepage now uses the same fixed nav as inner pages
- Removed standalone RSVP button (RSVP accessible via nav link only)
- Added Dupont fountain illustration as closing decorative element
- Date changed to PP Watch uppercase with letter-spacing
- All content fits in one viewport via `flex: 1` chain on `.homepage-hero`

**Rationale:** The homepage needed to function as a landing page, not a semi-invitation. The nav should be consistently positioned across all pages. Event details belong on the Schedule page. The ceremonial feel comes from the typography and design, not from invitation language.

---

## Nav Link Hover — No Glow at Rest

### Decision: Glow on hover only, RSVP breathing glow as sole exception

**Date:** March 29, 2026

Nav links no longer have any `text-shadow` glow at rest. Glow appears only on hover at ~75% intensity with accent color shift. The earlier "unified glow system" (where all links glowed subtly at rest) was removed — it made the nav feel busy and reduced the contrast between resting and hovered states.

RSVP retains its breathing glow (`@keyframes rsvp-glow`, 4s cycle) as the sole exception. This gives it persistent visual emphasis without requiring all other links to glow too.

---

## Illustration Size Reduction

### Decision: 120px height across all breakpoints (60% of original 200px)

**Date:** March 30, 2026

Page illustrations were reduced from `height: 200px` to `height: 120px` on `.registry-illustration`. The mobile-specific override at 180px was removed — 120px applies universally. Registry had an extra `padding: 1.5rem 0 2rem` on `.registry-section` that no other page had — this was removed for consistency.

---

## .htaccess Removed

### Decision: Delete .htaccess

`.htaccess` is an Apache server configuration file. GitHub Pages does not run Apache — it uses its own CDN infrastructure. The file had no effect and was removed.
