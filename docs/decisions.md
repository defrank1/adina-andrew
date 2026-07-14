# decisions.md — Design & Technical Decision Log

This document records the major decisions made during the development of adinaandrew2026.com, including what was tried, what was rejected, and why. It complements CLAUDE.md (the locked spec) by preserving the reasoning behind each choice.

Last updated: July 6, 2026

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

### Decision: Owned RAF loop scrubbing a linear timeline, not autoplay + a state-machine `complete` event (July 6, 2026)

The finished export (`metro-intro.riv`, ~1.2 MB, invitation PNG baked in) turned out to be a **single linear timeline**, not the interactive state machine originally envisioned. The first integration in `js/rive-intro.js` used `autoplay: true` and listened for a state-machine `complete` state to trigger the fade/handoff — the wrong model for this file: under autoplay a linear timeline **loops**, and there is no state machine, so `complete` would never fire. The intro would have looped forever and never handed off.

**Final playback model:** `initRive()` loads with `autoplay: false` and `animations: ANIMATION_NAME` (the linear timeline), and `js/rive-intro.js` owns its own `requestAnimationFrame` loop (`tick`). Each frame accumulates `elapsed` from **RAF timestamp deltas** (not wall-clock — so a backgrounded tab pauses the intro instead of jumping on return), quantizes to a stepped cadence `STEP_HZ = 15` via `Math.floor(elapsed * STEP_HZ) / STEP_HZ`, and calls `riveInstance.scrub(ANIMATION_NAME, clamped)`. **Completion is time-based:** when `clamped` reaches `DURATION_S = 22.14` (the card fully expanded), `completeIntro()` runs the fade + reveal. The `SAFETY_MS` timer (26 s) is now only a backstop. The RAF loop is cancelled in every teardown path (`fadeOutAndRemove`, `removeNow`) so it can't scrub a torn-down instance, and `cleanupRive()` is deferred until **after** the 800 ms fade so the final cream frame stays painted during the cream-on-cream handoff (no one-frame flash).

**15fps stepped cadence** was chosen by Andrew after A/B-ing step rates in a throwaway harness (`rive-quantize-test.html`) — stop-motion "on 4s" (of a 60 Hz base) reads as intentional hand-drawn craft rather than sterile smoothness. It's a named constant (`STEP_HZ`); set `0` for smooth.

**Runtime pinned:** `@rive-app/canvas@2.38.3` (was `@latest`, which can silently pull a breaking runtime).

**Asset naming caveat:** the committed timeline is named **`Timeline 1`** (verified via `animationNames` / `contents.artboards[0].animations`), even though task notes referred to it as "Timeline 19." `scrub()` needs the exact name, so `ANIMATION_NAME = 'Timeline 1'`; if a future export renames the timeline, that one constant is the only change.

**Status:** Implemented and verified on `rsvp.html` — loads, plays stepped, hands off at 22.14 s, Skip and once-per-session gating both work, no console errors. (The original 800 ms cross-fade in this entry was superseded by the hard-cut model below.)

### Decision: Contain + green matte, and a hard cut to a static invitation end-state (July 6, 2026)

Two changes to how the intro fills the screen and how it hands off.

**Fit.Contain + tunnel-green matte (was Fit.Cover).** The Rive artboard is **1920×1080 (16:9)** with the invitation card centered inside it. `Cover` cropped the scene on non-16:9 viewports; `Contain` never crops — the full scene/invitation always fits, and `#rive-container`'s background (`#183a2c`, the tunnel green sampled from the .riv) shows as the letterbox: **top/bottom bars on tall/mobile viewports, left/right bars on wide ones.** The matte matches the tunnel's own background, so the letterbox is invisible during playback.

**Hard cut to a static invitation (was an 800 ms fade to "Coming Soon").** `rsvp.html`'s protected content is now `#invitation-endstate` — a static reproduction of the animation's final frame: the green matte, a 16:9 field (`#dfdeda`) that is the artboard contained + centered, and the invitation card (`images/invitation/invitation.svg`) centered in it. On completion the intro sits on the final frame for `END_HOLD_MS` (500 ms), then `removeNow()` reveals the (already-rendered) static invitation sitting beneath the canvas and removes the canvas instantly — **no fade.** Because the static layer shares the same matte and reproduces the final frame, the swap is (near-)invisible. `#invitation-endstate` starts `.pre-reveal` (display:none) so it doesn't flash before the animation; every teardown path (complete, Skip, reduced-motion/return-visit bail) reveals it. `body.page-rsvp` is matte-green so the brief unlock→first-frame gap never flashes cream. Nav + footer are hidden on this page so the end-state matches the animation's chrome-less final frame; the sequenced RSVP form (next step) grows from this "invitation state."

**The invitation SVG.** Its card rect was transparent (`fill-opacity:0`); enabling the baked-in cream fill makes it a self-contained card (cream + border + text). An inner border rect was added to match the baked frame's **double** border (gap measured from the end frame at ~2% of card width). **Known residual diffs** (the provided SVG isn't pixel-identical to the baked frame, so the cut isn't perfectly invisible): the SVG is ~11% more slender than the baked card (aspect 0.71 vs 0.80 — matched on height, so text rows align but card edges are slightly inset), and the baked field carries faint tunnel "ghost" line-art that the clean static field omits. A truly pixel-perfect cut would need an SVG matching the baked frame exactly, or extracting the final frame as a raster.

**Mobile note:** containing a 16:9 landscape scene into a portrait phone leaves the invitation small between large green bars. That is faithful to the animation's framing but may warrant a mobile-specific treatment when the form is built.

**Status:** Implemented and verified — Contain letterboxes green on tall/wide/mobile viewports, matte blends with the tunnel, animation → 500 ms hold → hard cut → static invitation, Skip and return-visit bail both land on the invitation, no console errors. Files changed: `js/rive-intro.js`, `styles.css`, `rsvp.html`, `images/invitation/invitation.svg` (new).

### Decision: Two-stage landing — matched cut, then a settle into the brand page (July 6, 2026)

The hard cut alone left `rsvp.html` stranded in the animation's flat, chrome-less end frame. It now lands in **two stages**: **Stage 1** (unchanged) — the hard cut reveals `#invitation-endstate` in its Rive-matched state (green matte `#183a2c`, flat `#dfdeda` 16:9 field, no chrome). **Stage 2** — after `SETTLE_DELAY_MS` (150 ms), JS adds `intro-complete` to `<body>`; CSS transitions (all keyed to `var(--settle-ms)`, set from `SETTLE_MS = 450` in `js/rive-intro.js`, so the JS constants stay the single source of truth) convert that frame into a normal site page: the matte and field fade to transparent revealing the standard textured cream beneath (green stays only via `body.page-rsvp:not(.intro-complete)`, so once settled the **global** body rules — including dark mode — take over untouched), the endstate layer drops to `z-index: 1` so nav/footer float over it like on any page, nav + footer fade from `opacity: 0` (present-but-hidden during the intro, `pointer-events: none` until visible — no more `display: none`), and the card gains the `.registry-illustration` emboss drop-shadow pair (dark variant included; the card fill stays cream in dark mode — it reads as a physical card on the dark surface). The footer pins to the viewport bottom via `min-height: 100vh` on `#protected-content.unlocked` + `margin-top: auto` on the placeholder.

**Grain is intentionally NOT in the .riv** — the animation stays flat; the paper texture arrives with the settle, as the moment the animation "becomes" the site.

**Bail paths land settled instantly.** Return visit (`intro-seen`), reduced-motion, and missing-asset all call `settleInstant()`: `--settle-ms` is zeroed and `intro-complete` added immediately — the page appears as a normal brand page with no green flash and no transition. Skip = the same hard cut + the same settle as natural completion.

**Replay icon.** Fixed bottom-left button (44px, icon-only, `aria-label`), placeholder DC-flag asset with the standard `data-light`/`data-dark` swap (picked up by `site-init.js`'s generic `[data-light][data-dark]` selector — no extension needed). Rest opacity 0.7, full on hover/focus; hidden until `intro-complete`; `z-index: 1600` (above content, below the Rive canvas at 2000). **One playback pipeline:** clicking clears `sessionStorage['intro-seen']` and reloads — no second in-place replay path. Hidden entirely under `prefers-reduced-motion: reduce` (their setting says no animation, and the bail path would no-op it anyway).

**Status:** Verified — fresh play → cut → settle (450 ms) with nav/footer/replay fading in; return visit lands settled instantly (`--settle-ms: 0ms`); Skip = cut + settle; dark-mode toggle on the settled page swaps surface/tile/card-shadow/replay-icon correctly; replay click replays the full pipeline; nav menu opens (6 links). No `background-blend-mode` anywhere; `.riv` and the playback core untouched.

### Decision: Pixel-registered handoff — baked PNG card, measured placement, synced letterbox fade, no stall (July 6, 2026)

Supersedes the SVG card and several values in the two entries above (old card size/scale, `#dfdeda` field, green matte at the cut, END_HOLD_MS). The .riv was re-exported with the final card and an in-Rive cream cover rect that fades `#F1EDEA` 0→100% over **21.00→22.22s**, ending the animation on flat cream + card. `DURATION_S = 22.22`.

**Same-PNG identity (the core trick).** The end-state card is `images/invitation/invitation-light-new.png` (1069×1496, text+border+grain baked in) — the same file imported into the .riv. Checksum result: **byte-different** (Rive re-encodes on import: 2,639,436 vs 2,587,036 bytes) but **pixel-identical** — decoded and compared all 6,396,896 channels, zero deltas. Identical rasterization on both sides of the cut is what makes it invisible; if either file is ever regenerated, re-run this comparison.

**Measured registration.** `.invitation-field` is a Contain replica of the canvas box (`width: min(100vw, calc(100dvh × 16/9))`, `aspect-ratio: 16/9`, centered). The card is absolutely positioned by artboard fractions of 1920×1080: `left: 29.11%` (x=559), `width: 41.67%` (800px), `aspect-ratio: 1069/1496` (→ 800×1120). **Vertical (measured, corrects the spec's "centered ±20px bleed" derivation): `top: -10.47%`** — the animation parks the card HIGH, bleeding ~113 artboard px past the top and ending ~73px above the bottom. Solved two ways: printed double-border feature match at two viewports (−10.34%, four features agreeing within ~0.5px) and pixel cross-correlation/SAD (−10.60%); the shipped value splits them (±0.5px at typical sizes; final ±1px is an eyeball call on a frame-stepped recording). Verified horizontal: DOM vs canvas final frame within **0.4px**. The artboard does NOT clip (the bleed really renders), so neither does the field. **`body.page-rsvp { overflow: hidden }` is load-bearing for registration**: no scrollbars ⇒ layout width = `innerWidth` ⇒ the canvas box and the field are the same box in classic-scrollbar browsers too (a 15px scrollbar was shifting the field 7.5px off the canvas center).

**Dark mode inverts the card.** `invitation-dark-new.png` (green card, cream text) via the standard `data-light`/`data-dark` swap — NOT kept cream (Andrew confirmed; intentionally low-contrast tone-on-tone on the dark surface). Emboss = the `.registry-illustration` drop-shadow pair (light + dark variants) on the img; text is baked in, so the filter presses text and border together. `invitation.svg` is retired on this page (file kept in repo).

**Synced letterbox fade.** The in-Rive cover only fills the 16:9 artboard; on non-16:9 viewports the letterbox bars are `#rive-container`'s background. The rAF loop fires once at `elapsed ≥ FADE_SYNC_START (21.0)`: inline transition green→`COVER_CREAM` over `FADE_SYNC_MS (1220ms)` ease-in-out. By 22.22s the whole viewport is flat #F1EDEA at any window shape. (The fade check precedes the completion check in `tick`, so it provably fires before every cut.) The cover rect and the page cream are both **#F1EDEA** — the off-cream reading in the recording was video compression.

**Transition shape (fixes measured 3.6s stall → 0.8s dissolve → glitch).** Completion fires in the loop the moment `clamped ≥ DURATION_S`; the stacked `END_HOLD_MS` timeout is removed. `hardCut()` reveals the end-state and hides the canvas (`display: none`) in the SAME frame — no opacity fade, no double-image dissolve. The canvas NODE is removed only after the settle completes (`SETTLE_DELAY_MS + SETTLE_MS + 100`); mid-transition removal caused the one-frame glitch flash. Cut frame = flat cream + card; settle (150ms → 450ms) fades the flat layer out to the textured tile and fades chrome in — nothing moves. Skip / return-visit / reduced-motion / load-error land DIRECTLY on the settled state (no transition).

**Flicker diagnosis (~5Hz pre-fade in the recording).** (1) The rAF loop provably stops at completion — instrumented `requestAnimationFrame` count frozen across visibility windows after the cut; no continued scrubbing. (2) Found and fixed a renderer-side contributor: the loop called `scrub()` every 60Hz frame even when the quantized 15fps time hadn't advanced — 4 redundant identical redraws per step; now deduped (`lastScrubT`), scrub fires only when the step advances. (3) Remaining hypothesis if flicker persists in a new recording: 15Hz stepping (and hand-drawn frame boil) aliasing against the ~30fps screen recording — an artwork/capture interaction, not the pipeline.

**Status:** Verified headlessly — horizontal registration <0.5px; vertical within ~1px (bracketed by two methods); full run → cut → settle with no stall and no dissolve; skip/return direct-settled; dark inversion + emboss + replay swap correct; rAF stops; no blend modes. Real-time visual checks (letterbox fade sync, cut frame-step on a recording, 15fps feel) are Andrew's to confirm on device.

---

## Monogram

### Decision: Optical size variant needed for small sizes

The monogram's thin hairline strokes disappear at small sizes (below ~80px). The recommended approach is an optical size variant — a separate file with manually thickened strokes, maintaining the same letterforms. This preserves a master file for large use and a `monogram-small` variant for nav and other small contexts. Stroke weight override via Illustrator (adding a small stroke on top of the fill) was considered but can look slightly off at close inspection.

**Status:** Not yet created. The nav currently uses the standard monogram at 36px (desktop) / 48px (mobile), where hairline disappearance is noticeable but not critical.

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

**Link styles** (`.schedule-link`, `.travel-link`) use subtle underlines (`text-decoration-color` at 55% opacity) that darken to accent color on hover — same pattern, namespaced per page.

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

### Decision: Restructure neighborhood sections from time-based to type-based (April 29, 2026)

Each neighborhood section was reorganized from `Friday Night` / `The Weekend` prose paragraphs into `Where to Eat` / `What to Do` indented item lists. The existing `.dc-day-label` class is reused for the new sub-headings. A new `.dc-list` pattern (no marker, 2rem indent, 0.7rem rhythm between items) is the first list pattern on the site — list color inherits from the body so dark mode flips automatically. Final guest copy from Adina replaces all prior placeholder/draft notes.

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

### Decision: Resize illustrations to 200px desktop / 150px mobile (April 29, 2026)

`.registry-illustration` resized from 120px (universal) to **200px desktop / 150px mobile (≤900px)**. This supersedes the March 30 decision above. The desktop size returns near the original pre-reduction value but the mobile override is now smaller (150px) than desktop, instead of matching it. CLAUDE.md illustration-sizing notes were updated to match.

---

## Style Consistency Pass — Our Story + DC Guide

### Decision: Six small consistency fixes (April 29, 2026)

Tightened cross-page consistency now that Our Story and DC Guide are both populated:

- **Photo captions:** Two over-long Our Story captions shortened (kite festival slide; bike Halloween slide) so they fit a single line on desktop.
- **Mobile caption height:** Added `@media (max-width: 900px) { .story-photo-caption { min-height: 3em; } }` to reserve 2 lines and prevent layout shift between short and long captions on narrow viewports. Desktop keeps the base `min-height: 1.5em`.
- **Carousel fade race fix:** `updateCaption` in `includes/carousel.js` now stores its `setTimeout` handle and `clearTimeout`s any pending fade before starting a new one. Prevents stale captions from sticking when arrows are rapid-clicked. Each `initCarousel` invocation has its own closure-scoped `captionFadeTimeout`, so multiple carousels on the same page don't share state.
- **`.dc-day-label` cleanup:** Replaced `color: var(--text-color)` with `color: inherit`. `--text-color` is undefined site-wide; the rule worked only because `var()` with no fallback already inherits. Cosmetic source-only change, no visual diff.
- **`.section-divider` symmetry:** `margin: 3rem auto 2.5rem` → `margin: 3rem auto`. Equal vertical space above and below the hairline.
- **`.story-closing` size:** `font-size: 1.8rem` → `2.4rem` to better balance against the page title above.

---

## DC Guide — Lists to Prose

### Decision: Convert `.dc-list` blocks to `.dc-prose` paragraphs (April 29, 2026)

Every "Where to Eat" / "What to Do" `<ul class="dc-list">` on the DC Guide became a single `<p class="dc-prose">` — bullet text preserved verbatim, items joined by spaces. Reads as a recommendation from a friend rather than a checklist. Trimmed "actually" from the National Mall What-to-Do prose and a trailing space in the page intro. Removed the now-unused `.dc-list` rules from `styles.css`, plus the `.story-prose-placeholder` rules left over from the Together-section placeholder span.

---

## .htaccess Removed

### Decision: Delete .htaccess

`.htaccess` is an Apache server configuration file. GitHub Pages does not run Apache — it uses its own CDN infrastructure. The file had no effect and was removed.

---

## Copy Conventions and Heading Hierarchy

### Decision: Lock copy conventions and fix skipped heading levels (June 4, 2026)

A review pass across the content pages established three copy conventions and corrected the semantic heading hierarchy. These are recorded here so future edits hold the line.

**Copy conventions:**
- **"metro"** is written lowercase — it's treated as a generic noun (like "subway"), not a proper name. Applies wherever the system is referenced in body or alt text (Travel, FAQ, Our Story).
- **"DC"**, not "D.C.", in display and body text — no periods. Applies to location lines, alt text, and prose.
- The **venue** is written with an em-dash everywhere it appears: "InterContinental Washington, DC — The Wharf" (not a hyphen).

**Heading hierarchy:** Content pages follow `h1` (page title) → `h2` (first subsection) → `h3` (sub-subsection). This pass fixed skipped levels: FAQ questions and Schedule event names moved `h3` → `h2`; DC Guide "Where to Eat / What to Do" labels moved `h4` → `h3`. Every subheading is styled by **class** (`.faq-question`, `.schedule-event-name`, `.dc-day-label`), not by element tag — the only element-level heading rule is `.password-container h2`, scoped to the overlay. So these are accessibility/semantic changes with **no visual effect** and no CSS change. The `.dc-day-label` class name was intentionally left as-is despite the tag change — renaming it across HTML + CSS has no visual or functional benefit.

**Minor copy fixes:** Our Story Copenhagen image alt corrected to "brewery" (matching its caption, which already read "brewery"); DC Guide "The Wharf" capitalized in the National Mall intro; "farmers market" with no apostrophe (matching the Eastern Market usage); "Bistrot du Coin" with lowercase *du* (matching the venue's own styling); the seven Our Story proposal images given descriptive alt text ("Andrew's proposal to Adina at Malcolm X Park") in place of the placeholder "Proposal moment N" — the same text on all seven is intentional for now and may be refined per-photo later. A stale TODO comment on the Family section was removed.

---

## RSVP Form Redesign and PP Watch Weight Split

### Decision: PP Watch two-weight split — Bold 700 (structural) + Medium 500 (supporting caps) (June 4, 2026)

PP Watch was previously loaded at a single weight (Bold 700), so every uppercase label — including small supporting-caps lines like the schedule date/venue details — rendered heavy. Small caps at Bold read as bulky. We registered a second `@font-face` for **PP Watch Medium (500)** and split usage: Bold stays the default for structural labels (nav, buttons, page/section headings, form labels); Medium is reserved for the quieter small-caps set (`.schedule-event-detail` and the RSVP `.weekend-event-when` / `-dress` / `-note` / `.rsvp-choice-label`).

The split is expressed purely via `font-weight`, with **no new CSS variable** — `--font-heading` stays the single family token. **Regression guard:** because 400/unspecified now resolves to ~500 once Medium is loaded, every `--font-heading` rule that must stay Bold received an explicit `font-weight: 700`. Without that pin, elements would have silently lightened the moment the Medium file landed. (`.homepage-date` had a latent `font-weight: 400` that only ever rendered Bold; it was pinned to 700 to preserve its current appearance.) Until `PPWatch-Medium.woff2/.woff` are added to `/fonts`, 500 falls back to Bold — the split simply doesn't show yet, and nothing breaks.

### Decision: RSVP form — logistics once, decisions compact (June 4, 2026)

The first RSVP build reprinted every event's full logistics (date/venue/dress/description) inside each person's block, so a couple invited to the whole weekend saw the same four event cards twice. We restructured into two parts: **Part A — "The Weekend"** reference block renders each invited event's logistics exactly **once**; **Part B** collapses each person to **compact decision rows** (event-name label + accept/decline), plus a meal-choice row shown only when Saturday (the reception dinner) is invited. The Saturday afterparty lives only in the reference block as info (no RSVP). This cuts repetition, shortens the form, and separates "here's what's happening" from "here's your response." The backend seams (`searchInvitations` / `submitRsvp` over placeholder data) were untouched.

### Decision: Hairline custom radios over native `accent-color` (June 4, 2026)

Native radios (`accent-color`) read as a generic OS control inside a form whose every other surface uses the site's hairline/letterpress language. We replaced them with `appearance: none` custom radios: a hairline ring (muted at rest, no glow — consistent with the nav's "no glow at rest" rule), darkening on hover, a solid green/cream center dot on select, and a green/cream focus-visible outline echoing input focus. Transitions are 120ms (interaction feedback), deliberately faster than the 400ms grain/theme-swap timing.

### Decision: Shorten RSVP dress strings; full definitions move to FAQ (June 4, 2026)

In the reference block, dress codes render as small bordered **tags**, so the Welcome Party's parenthetical ("sport coats and trousers, or dresses, jumpsuits, and blouses") was trimmed to just **"Semi-Formal"**. The fuller definition is assumed to live on the FAQ (a separate task), keeping the RSVP form scannable. Also in this pass: the italic `.form-hint` was de-italicized to honor the locked "Sentient is never italic" rule, and the now-dead carded RSVP CSS (`.event-group` family, `.radio-group`, `.event-label`, the `.schedule-event-name` form override) was removed.

### Decision: Scope the dress-code definitions (June 5, 2026)

The **semi-formal** explanation lives on the Welcome Party (Friday) — **not** in the FAQ. On RSVP it's folded into the Friday event's description sentence ("…It'll be semi-formal – sport coats, trousers, dresses, jumpsuits, and blouses."), so the separate `.weekend-event-dress-note` line was dropped; `schedule.html` keeps its own "Semi-Formal" tag + description (the two pages phrase it differently by choice). The reference-block event order is **title → date/time → dress tag → address → description**. **Black tie preferred** is defined once in the FAQ ("What is Black Tie Preferred?") and left a bare tag everywhere else; "Come as you are" likewise stays a bare tag. The FAQ carries no Friday/semi-formal reference by design.

### Decision: RSVP visual congruity with the site (June 5, 2026)

The RSVP form was conformed to the site's existing vocabulary. **Form fields** adopt the standard **25px rounding** and go **flat** — the inset gloss (`box-shadow: inset …`) was removed; focus is just border-color → green. The **email input + autocomplete dropdown** read as one continuous **capsule**: the dropdown rounds its bottom corners (`0 0 25px 25px`) and, while open, JS toggles a `.suggestions-open` class that flattens the input's bottom corners and matches the border color (green / cream by mode). The dropdown stays a flush static-position `absolute` element (not `top: 100%`, since it shares `.form-group` with the form hint). The **dress tag** was rounded from `3px` to a `100px` capsule to match. **Acronym page titles get periods** to read better in the display script — **R.S.V.P.** (RSVP page `<h1>`/overlay; tab + nav link stay "RSVP") and **D.C. Guide** (DC Guide page title/overlay/`<h1>`; the shared nav link and all standalone "DC" stay unchanged). Also: meal options stack vertically (`.rsvp-choice-row--stacked`); the Saturday decision-row label is shortened via `shortName: 'Ceremony and Reception'` (the reference block keeps the full name).

---

## Sequenced Card-Based RSVP Flow (rsvp.html)

### Decision: Card-flow architecture + floating-plane implementation (July 11, 2026)

The real RSVP grew out of the settled invitation page as a **left-shifting sequence of floating reply cards** rather than the single long form staged on `rsvp-internal.html`. After the settle, a hairline **RSVP arrow** (`#rsvp-arrow` — PP Watch Bold label + 1.5px-stroke inline SVG, positioned by the invitation card's artboard fractions inside `.invitation-field` so it tracks any future card re-placement; below the card on ≤900px) fades in with the settle. Clicking it adds `body.rsvp-flow-active`, translates `#invitation-endstate` off-screen left (translated only — never re-parented or restyled, since its geometry is registration-critical pre-cut; `visibility: hidden` after its transition ends) while the card track slides in from the right in the same 600ms `cubic-bezier(0.4, 0, 0.2, 1)` motion — one continuous leftward shift.

**Track mechanics:** `#rsvp-flow` holds a flex row of one-viewport panels; JS moves it with `transform: translateX(-i·100%)`. Steps = `['email', ...invitedEvents (EVENT_ORDER), 'review', 'thanks']` — cards for non-invited events are never built; changing the email selection tears down and rebuilds everything after the email panel. Inactive panels are clipped to `max-height: 100vh` + `inert`/`aria-hidden`, so the page's scroll length always belongs to the active card. `prefers-reduced-motion` gets `transition: none` (instant swaps). Scroll resets to top on every step change; back arrows (top-left of each card, mirroring the forward styling) preserve selections because the panels and their controls persist in the DOM.

**Floating plane:** cards use the printed-enclosure language — flat `#F1EDEA` surface (grain stays on the page plane, not the card), a single 1px hairline inner frame inset 12px, 3px corners, and the nav diamond's raised shadow (`0 4px 14px rgba(0,0,0,0.22)` + a tight contact shadow). The stationary-texture effect comes from a `position: fixed; inset: 0; z-index: 0` backdrop div carrying the baked tile behind the track — NOT `background-attachment: fixed`, which is broken on iOS Safari. The footer gets `position: relative; z-index: 3` during the flow so the fixed backdrop can't paint over the dark-mode toggle (found in browser testing). `body.page-rsvp`'s load-bearing `overflow: hidden` is untouched pre-cut; `.rsvp-flow-active` (only reachable post-settle) relaxes it to `overflow-x: hidden; overflow-y: auto`.

**Copy notes for Andrew to veto:** the cards use the classic "Accepts with pleasure / Declines with regret" (the staging form said "Joyfully accepts / Regretfully declines" — the printed-card register won); the email card's reply-by line reads "the first of September" — placeholder-adjacent, confirm the real deadline.

Logic lives in `js/rsvp-flow.js` (loaded by rsvp.html only); styles in the `/* === Card flow === */` section of `rsvp-styles.css` (rsvp.html now loads that stylesheet too — all new selectors are scoped so nothing leaks into rsvp-internal.html). `searchInvitations()` / `submitRsvp()` remain the ONLY functions that touch the network, exactly like the staging form. `rsvp-internal.html` is superseded but untouched until Andrew retires it.

### Decision: Dark-mode reset on animation exit (July 11, 2026)

The Metro intro's final frames are effectively light mode (cream cover + light card), so a user in dark mode got an awkward light-to-dark snap at the settle. Now `hardCut()` in `js/rive-intro.js` calls `resetThemeToLight()` — remove `dark-mode` from `<html>`/`<body>`, `localStorage.darkMode = 'disabled'`, swap all `[data-light][data-dark]` images to light (reusing site-init.js's global `updateImages(false)` when reachable), and set the footer toggle to the ☀ glyph — **while the canvas still covers the page**, so nothing visibly flips. **The user's dark-mode preference is intentionally overridden by the animation handoff, once per animation viewing.** Scope guard: the reset fires only when the canvas actually played (`#rive-container` was revealed — natural completion, Skip, or a post-reveal Rive error). Bail paths (return visit with `intro-seen`, reduced-motion, missing asset) never reveal the canvas and land settled with the theme intact — verified: a dark-mode return visit stays dark. The footer toggle keeps working normally after the reset.

### Decision: Meal lineup + kosher checkbox model (July 11, 2026)

The reception dinner is **Branzino / Chicken / Cauliflower Steak** (replacing the staging form's placeholder beef/salmon/risotto), rendered as stacked hairline radios on the Saturday card, per person, enabled/required only when that person accepts Saturday (declining collapses/disables the section). **Branzino and Chicken carry a small hairline "Kosher?" checkbox** (custom `appearance: none` square in the same control language as the radios — hairline ring at rest, masked hand-drawn check on select, 120ms timing). Each person's kosher checkbox is only interactive for the meal that person currently has selected; picking the other meal or Cauliflower Steak clears and disables it. Data: `meal: 'branzino' | 'chicken' | 'cauliflower'`, `mealKosher: boolean` (always false for cauliflower). Two-person invitations track meal/kosher state independently (verified).

### Decision: Backend rewrite — lookup endpoint + per-person rows (July 11, 2026)

`rsvp-workflow/google-apps-script.js` was rewritten; the old script predated the per-person model, had no lookup endpoint, and knew nothing about meals/kosher. New layout: a **Guests** tab (`Email | Names | Friday | Saturday | Sunday`, names `;`-separated, event cells TRUE/yes) that Andrew fills manually, and a **Responses** tab written append-only by the script — **one row per person per submission** (`Timestamp | Email | Name | Friday | Saturday | Sunday | Meal | Kosher | Message`, `not invited` for events not on the invitation, the message repeated on each of the party's rows; reconcile resubmissions by latest timestamp). `doGet ?action=lookup&q=` does a case-insensitive substring match on `Guests.Email` and returns `[{ email, invitedTo, people }]` (the client already refuses to query until the guest types past the "@"). `doPost` parses the flow's submission shape and appends the rows; the brand-styled confirmation email was adapted to per-person event lines (meal + kosher on Saturday acceptances) and is guarded so a mail failure never fails the submission. **CORS:** the front end sends `Content-Type: text/plain` with a JSON string body (no preflight — the standard Apps Script pattern) and plain GET for lookup. **Privacy caveat (accepted, restated):** with web-app access "Anyone", the lookup endpoint is queryable by anyone who finds the URL, so guest emails/names are only as private as that URL plus the RSVP password gate — same tradeoff as the original design. Wiring: `APPS_SCRIPT_URL` at the top of `js/rsvp-flow.js`; empty = placeholder invitations + no-op submit (fully testable now), set = live.

### Decision: Card-flow visual refinements — paper cards, ink check, "Rsvp" title (July 11, 2026)

A feedback pass on the card flow (Andrew, against the printed reply-card reference):

- **Cards are made of the same paper as the invitation.** The baked grain tile (`combined-light.png` / `combined-dark.png`, 200px) now lives ON `.rsvp-card` itself, not just the fixed page-plane backdrop behind it — so each successive card reads as a physical piece of the same stock and carries its grain with it as it slides. Frame tightened to a single 1px hairline inset 14px with square corners (was 12px / 3px radius) to match the invitation PNG's border.
- **Ink check, not a rough pencil.** The custom radios + the kosher checkbox dropped the `feTurbulence` displacement filter (which read as pencil scribble) for a clean curved single-stroke tick with round caps/joins, its vertex/divet centered on the ring (Andrew's note: the divet should be what's centered). Candidates were workshopped in a throwaway `rsvp-checkmark-demos.html` (each mark shown in the real ring, enlarged with a center crosshair, light + dark); #4 "curved ink" won — a subtle bow that echoes PP Playground's hand while staying clean ink. The mask is shared, so `rsvp-internal.html`'s radios update too. Demo file is disposable — delete once settled.
- **"Rsvp", sentence case, no periods** (was "R.s.v.p.") — matches the printed reply card. The reply line became two lines like the card: "The favor of a reply is requested" (Sentient sentence case) over "BY THE FIRST OF SEPTEMBER" (uppercased PP Watch Medium).

Still open for Andrew: the reply-by date ("the first of September") is placeholder-adjacent; and whether to push further and shape the rings themselves after PP Playground's oval `O` (raised as reference inspiration, not yet done).

### Decision: Card-flow polish round 2 — right-side Next, double-rule frame, dress deep-links (July 11, 2026)

A second feedback pass on the card flow:

- **Ring stays a circle.** The PP Playground "O"/"o" glyphs were tried as the response ring (the reference's rings derive from that font) but are too swashy/illegible at 18px — the glyph reads as noise, not a ring. Kept the clean circle; the hand-drawn character lives in the ink check instead. (Throwaway demo since relocated to `_source/sandbox/` by the repo reorg.)
- **Reply-by confirmed:** September 1, 2026 — still rendered spelled-out as "by the first of September" to match the invitation's register. Placeholder caveat removed from `REPLY_BY`.
- **Forward CTA moved to the card's right.** Next / Review is now `position: absolute` to the right of the card, vertically centered (`top: 50%`), mirroring the RSVP arrow beside the invitation on the settled page; on ≤900px it drops below the card, centered. Was a bottom-centered button inside the card.
- **Double-rule frame to match the invitation PNG.** The reply-card frame was a single hairline; the invitation PNG has a **double rule** (thicker outer + thinner inner line with a small gap). Reproduced with `.rsvp-card::before` (outer, 2px, inset 12px) + `::after` (inner, 1px, inset 18px); both go cream in dark mode; mobile insets tighten to 10/15px. (This intentionally supersedes the original "single hairline, don't fake a double-rule" guidance now that matching the printed card is the goal.)
- **Dress tag → FAQ deep-link.** The dress capsule is now a button where a FAQ answer exists: Saturday's "Black Tie Preferred" links to `faq.html#faq-black-tie` in a **new tab** (so an in-progress RSVP isn't lost). `faq.html` gained `id="faq-black-tie"` and its `unlockContent()` now scrolls to the URL hash after the gate opens (the content is `display:none` until unlock, so the browser's own on-load scroll can't land it); `.faq-item` got `scroll-margin-top: 110px` to clear the fixed nav. Friday's "Semi-Formal" (defined in its own copy) and Sunday's "Come as you are" have no FAQ section, so they remain plain tags — if Andrew wants those linkable too, add FAQ entries + `faqAnchor` keys in `EVENT_DETAILS`.

### Decision: Reply cards use the floating-nav surface logic; plain checkmark (July 11, 2026)

Two more adjustments from Andrew:

- **Card surface = nav logic, not paper grain.** The grain-on-card experiment (baked `combined-*.png` tile living on the card) was dropped. Reply cards now use a flat fill distinct from the body — **`#EBE7E3` light / `#0e2319` dark** (the nav diamond's dark fill) — floating on the grainy page plane with a single **`box-shadow: 0 4px 14px rgba(0,0,0,0.22)`** (`0.3` dark), exactly the floating-nav treatment (Andrew supplied these `.content-card` values). The opaque tile couldn't recolor to `#EBE7E3` anyway, so the texture was removed rather than layered. The page's grain still sits on the fixed backdrop behind the cards, so the flat card reads as a distinct plane — same figure/ground as the nav over the body. Applied to `.rsvp-card` / `body.dark-mode .rsvp-card`. The double-rule frame stays.
- **Plain checkmark.** The curved "ink stroke" tick read as weird; replaced with a bog-standard two-segment checkmark (`M5 12.5 L10 17.5 L19 7`, round caps) in the shared radio + kosher-checkbox mask. So the RSVP response mark is now just a normal check in a plain circle — both the calligraphic-check and PP-Playground-glyph-ring explorations are retired.

### Decision: Dress codes explained via on-card popover, not an FAQ jump (July 11, 2026)

The dress-code capsule became a **popover trigger** instead of a link to the FAQ. Andrew wanted Semi-Formal explained too, and rather than add FAQ items + deep-links (a jump that would abandon the in-progress RSVP, and only worked for Black Tie), the definition now lives on the card: each dress tag is a `<button>` that, on hover/focus (desktop) or click/tap (touch), shows a small popover with the dress-code text. All three codes carry a `dressInfo` string in `EVENT_DETAILS` (Semi-Formal → "Sport coats and trousers, or dresses, jumpsuits, and blouses."; Black Tie Preferred → the FAQ's tux/gown language; Come as you are → "Wear whatever feels comfortable — no need to dress up."). The popover uses the reply-card surface language (flat `#EBE7E3` / `#0e2319`, hairline border, `0 4px 14px` shadow, upward caret); CSS handles hover/focus, a JS `.open` class handles click-persistence for touch, and an outside click or Escape closes it (`closeAllDressPopovers`). `faq.html` keeps its "What is Black Tie Preferred?" answer and the now-unused `#faq-black-tie` anchor + post-unlock hash-scroll (left in as harmless/reusable). Supersedes the July 11 "dress tag → FAQ deep-link" decision.

### Decision: Registration policy inverted — CSS is now the source of truth (July 13, 2026)

The invitation card's placement used to be *measured* off the `.riv`'s final frame (border-line/cross-correlation solves, ±1px eyeball calls). That's now backwards: the CSS card rect — `left: 33.854%; width: 32.292%; top: 13.426%`, aspect ratio `1500 / 2100`, against the 1920×1080 artboard — is the source of truth, and the `.riv`'s final keyframes get nudged in the Rive editor to match it. `js/rive-intro.js` gained a `?debug-registration` mode for this: it scrubs to the final frame, pauses (no hard cut, no settle), and overlays the DOM card at 50% opacity above the paused canvas so the two can be compared directly in-browser. Verified: the ghost lands exactly on the Rive card at the current values.

### Decision: Grain lives on one side of the cut only (July 13, 2026)

The `.riv` must end on a perfectly flat field — no grain baked into its final frame. Its "Noise - 8" full-artboard overlay (which faded in near the end of Timeline 1) had to be pulled to 0% opacity / have its end fade removed for this reason. Reasoning: Rive-baked noise scales with the artboard, while the DOM's grain is a fixed 200px CSS tile — even if both used the "same" texture asset, they're different noise fields at almost any window size, so pixel-matching the two across the hard cut is not achievable. All paper texture therefore materializes in the DOM at the settle (`.paper-card`'s `--card-grain-opacity` fading 0→1, see below) — never in the `.riv`. Do not add grain back into the `.riv` to try to close this gap.

### Decision: Paper Card System — shared component, invitation refactored onto it (July 13, 2026)

The invitation end-state's flat, pre-composited PNG (`invitation-light-new.png`/`invitation-dark-new.png`) was replaced with a shared `.paper-card` component: CSS-tiled grain (`::before`, opacity driven by `--card-grain-opacity`) + a baked transparent ink PNG (`invitation-ink-light.png`/`-dark.png`) + a sheet `box-shadow`. This is a **deliberate reopening** of the "grain-on-card" question the July 11 reply-card decision closed the other way (`.rsvp-card` stays flat-fill, no grain — that decision was about *opaque, alpha-free rectangles the same shape as the nav's dark-fill treatment*, not a blanket rule): CSS grain tiled on an opaque rectangle is exactly what the body already does safely; the "no CSS grain" caution only ever applied to the nav diamond's alpha-shaped PNG. Light mode separates from the page by shadow alone (paper fill matches body `#F1EDEA`); dark mode separates by both shadow and a darker `#0e2319` fill against the `#122a20` body — the same asymmetry as the floating nav, for the same reason (shadows read weaker on dark surfaces). The card is pixel-flat (`--card-grain-opacity: 0`, `box-shadow: none`) at the hard cut and gains grain + shadow + the illustration emboss together at the settle. `invitation-dark-new.png` is deleted (orphaned — nothing referenced it once the ink layer took over); `invitation-light-new.png` stays, since it's the source baked into the `.riv`. `.rsvp-card` (the RSVP form flow) was deliberately **not** migrated onto `.paper-card` — a `.paper-card--page` shell exists in `styles.css` for future use, but the shipped card flow keeps its own grain-free surface.
