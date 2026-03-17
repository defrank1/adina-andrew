# Figma Design System Rules — Adina & Andrew Wedding Website

> Figma-to-code translation guide for Claude Code × Figma integration.
> Stack: Vanilla HTML5 / CSS3 / JavaScript — no frameworks, no build tools.
>
> **This file is a companion to CLAUDE.md, not a replacement.** CLAUDE.md is the single source of truth for all design tokens, component specs, and layout rules. This file provides Figma-specific guidance for translating designs into code. When in doubt, defer to CLAUDE.md.

Last updated: March 15, 2026

---

## 1. Design Tokens — Figma → CSS Mapping

All tokens are CSS custom properties on `:root` in `styles.css`. Registered via `@property` for smooth dark mode transitions (~400ms ease).

### Colors

| Figma Token | CSS Variable | Hex | Notes |
|---|---|---|---|
| Dark green | `var(--color-dark-green)` | `#1a3a2e` | Text, borders, buttons, UI — both modes |
| Dark background | `var(--color-dark-bg)` | `#122a20` | Dark mode body background ONLY — never for text/UI |
| Soft white / cream | `var(--color-soft-white)` | `#F1EDEA` | Light mode body background, dark mode text |
| Accent | `var(--color-accent)` | `#2d5a4a` | Gradient midpoints in button hover states |
| Error red | (no variable) | `#c41e3a` | Form validation only |

**Non-CSS colors (baked into PNG assets):**
| Usage | Light | Dark |
|---|---|---|
| Nav diamond fill | `#EBE7E3` | `#0e2319` |

These are exported from Figma as part of the nav diamond PNGs — not adjustable via CSS. Re-export from Figma if they need to change.

**Figma implementation rule:** Always use `var()` references in code — never hardcode hex values. If a Figma design uses a color not in this table, flag it before implementing.

### Gradients

Buttons use a 300%-wide horizontal gradient that animates on hover:
```css
/* Light mode — .btn-priority default fill */
background: linear-gradient(90deg, var(--color-dark-green) 0%, var(--color-accent) 50%, transparent 100%);
background-size: 300% 100%;
```

Dark mode uses `flashGradientDark` keyframes with cream/light-cream stops. See CLAUDE.md > Button Hover Animation for full spec.

### Opacity & Overlays

| Context | Value |
|---|---|
| Password overlay grain | `linear-gradient` at `rgba(241, 237, 234, 0.75)` (light) / `rgba(18, 42, 32, 0.75)` (dark) |
| Mobile menu dropdown | `rgba(229, 224, 220, 0.95)` (light) / `rgba(14, 35, 25, 0.95)` (dark) |
| Footer info text | `opacity: 0.4` (light) / `0.35` (dark) |
| Placeholder text | `opacity: 0.35` |

---

## 2. Typography — Figma Font → CSS Variable

| Figma Font Name | CSS Variable | Weight | Usage Rule |
|---|---|---|---|
| PP Playground Medium | `var(--font-title)` | 500 | Display text, couple names, page overlay titles |
| PP Watch Bold | `var(--font-heading)` | 700 | Nav, labels, buttons — always `text-transform: uppercase` + `letter-spacing` |
| Sentient Regular | `var(--font-body)` | 400 | Body copy, descriptions, form inputs — **never italic** (`font-style: normal` enforced) |

**Figma-to-code rule:** If a Figma text layer uses PP Watch, it must have `text-transform: uppercase` and `letter-spacing: 0.1–0.25em` in CSS. If it uses Sentient, ensure `font-style: normal` is set.

### Text Effects

See CLAUDE.md > Text Emboss/Shadow Effect for exact values. Key rule: buttons and nav links always set `text-shadow: none`.

---

## 3. Component Patterns

### Buttons — Two Variants Only

| Class | Default State | Hover |
|---|---|---|
| `.btn-priority` | Filled (dark green bg, white text) | Gradient sweep → transparent |
| `.btn-normal` | Outlined (transparent bg, dark green border) | Gradient sweep → filled |

Both share: `border-radius: 25px`, `font-family: var(--font-heading)`, `text-transform: uppercase`, `letter-spacing: 0.1em`, `text-shadow: none`.

**Figma rule:** Any button in a Figma design maps to one of these two classes. There are no other button variants. If a Figma button looks filled → `.btn-priority`. If outlined → `.btn-normal`.

### Navigation

The nav is a **baked PNG diamond** — not an SVG, not a CSS shape.

- **Desktop (>900px):** Floating marquise diamond PNG (`images/nav/nav-diamond-light.png` / `nav-diamond-dark.png`) with inline links (TRAVEL · FAQ · [monogram] · REGISTRY · RSVP) and `filter: drop-shadow()`.
- **Mobile (≤900px):** Diamond hidden. Monogram top-left (47px), filled Menu pill top-right. Dropdown on tap.

**Figma rule:** If modifying the nav diamond's appearance (fill, grain, hairlines), changes must be made in Figma and re-exported as PNG. CSS only controls positioning, shadow, and link styling.

### Footer

Transparent background — inherits body surface. Contains info text + dark mode toggle. No border, no shadow, no separate tint.

**Figma rule:** Do not design the footer as a separate surface/card. It sits directly on the body.

### Password Overlay

Full-screen fixed overlay with the same grain texture as the body, recreated via `::before` pseudo-element. See CLAUDE.md > Password Overlay for implementation.

---

## 4. Grain & Texture — Figma Export → CSS

The grain system is the most technically nuanced part of this project. See CLAUDE.md > Grain Texture for the full CSS pattern and decisions.md for the export history.

### Key Rules for Figma Export

1. **Export each noise/paper layer individually at Normal blend mode** — Figma cannot export transparent PNGs from layers using non-Normal blend modes (it silently adds opaque backgrounds)
2. **CSS handles the blending** — `background-blend-mode: soft-light` replicates Figma's Soft Light exactly
3. **Tile size:** 400×400px for all texture PNGs
4. **Overlay intensity:** Controlled by a `linear-gradient` at 0.75 alpha on top of the texture stack

### Current Texture Files (in `images/textures/`)

**Light mode (4 layers):** `paper-grain-light.png`, `noise-grain-light.png`, `paper-grain-light-two.png`, `noise-grain-light-two.png`

**Dark mode (2 layers):** `paper-grain-dark.png`, `noise-grain-dark.png`

**Figma rule:** If new textures are added, they must follow this same export-at-Normal-blend-mode pattern and be added to both the body and password overlay grain stacks.

---

## 5. Dark Mode — What Needs Dual Variants

### Image Swaps (instant, no transition)

All handled via `data-light` / `data-dark` attributes on `<img>` tags, swapped by `site-init.js`:

| Asset | Light | Dark |
|---|---|---|
| Nav diamond | `nav-diamond-light.png` | `nav-diamond-dark.png` |
| Monogram | `monogram-green.png` | `monogram-white.png` |
| Names lockup | `names-image.png` | `names-image-dark.png` |
| Illustrations | `Dupont.png` | `Dupont-dark.png` |
| Dark mode toggle icon | `light-mode-button.png` | `dark-mode-button.png` |

### Color Transitions (smooth, ~400ms via `@property`)

CSS custom properties crossfade automatically. No JavaScript class toggling needed.

**Figma rule:** Every new component must have `body.dark-mode .component` overrides in `styles.css`. Every new image that changes between modes needs `data-light` / `data-dark` attributes.

---

## 6. Layout & Responsive

### Single Breakpoint: 900px

| Viewport | Layout |
|---|---|
| >900px | Desktop — diamond nav, side-by-side footer |
| ≤900px | Mobile — monogram + Menu pill, stacked footer, reduced font sizes |

No other breakpoints in `styles.css`. (`rsvp-styles.css` has its own 768px — separate scope.)

### Content Width

| Container | Max-width |
|---|---|
| `.content-wrapper` | 680px (global) |
| `.content-wrapper` (registry) | 700px (override) |

### Surface Layering

Two visual surfaces create physical depth:
1. **Body** — primary surface with multi-layer grain
2. **Nav diamond** — floating PNG with its own grain/fill baked in, offset by `drop-shadow`

The footer is NOT a separate surface.

**Figma rule:** New sections sit on the body surface. Do not introduce new elevated surfaces without explicit approval.

---

## 7. Asset Export Conventions

### File Naming

| Type | Pattern | Location |
|---|---|---|
| Illustrations | `Name.png` + `Name-dark.png` | `images/illustrations/` |
| Monogram | `monogram-green.png` / `monogram-white.png` | `images/Monogram/` |
| Names lockup | `names-image.png` / `names-image-dark.png` | `images/names/` |
| Nav diamond | `nav-diamond-light.png` / `nav-diamond-dark.png` | `images/nav/` |
| Textures | `paper-grain-*.png` / `noise-grain-*.png` | `images/textures/` |
| SVG sources | `*.svg` | `vectors/` |
| Affinity sources | `*.af` / `*.afdesign` | `vectors/` |

### SVG Export Rules (for Rive or other vector use)

- Outline all strokes before export
- Use Presentation Attributes styling (not CSS `<style>` blocks)
- Decimal precision: 2
- Release unnecessary clipping masks
- Use descriptive group/layer names (map to `id` attributes)

---

## 8. CSS Methodology

- **Global styles:** `styles.css` — shared components, typography, layout, breakpoints
- **Page-specific styles:** Scoped with body class in `styles.css` (e.g., `body.page-registry .component`) — NOT inline `<style>` blocks
- **RSVP styles:** Separate file `rsvp-styles.css`
- **No build step** — edits go directly into `.html` or `.css` files; deployed via `git push origin main`
- **Naming:** BEM-inspired — `.component-element` or `.component-element--modifier`

---

## 9. Figma Implementation Checklist

When implementing any design from Figma into this codebase:

1. **Read CLAUDE.md first** — it contains all locked design decisions
2. **Colors** — use `var()` custom properties, never hardcode hex
3. **Fonts** — use `var(--font-title)`, `var(--font-heading)`, `var(--font-body)`
4. **Buttons** — map to `.btn-normal` or `.btn-priority` — no other variants
5. **Dark mode** — add `body.dark-mode` overrides; use `data-light`/`data-dark` for image swaps
6. **Page styles** — scope with body class in `styles.css`, not inline `<style>` blocks
7. **Grain** — body and password overlay already handle it; new surfaces should NOT add their own grain
8. **Breakpoint** — single breakpoint at 900px; mobile adjustments go in the existing `@media (max-width: 900px)` block
9. **Check all pages** — changes to `styles.css` affect every page; verify no regressions
