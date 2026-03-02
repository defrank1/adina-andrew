# Figma Design System Rules — Adina & Andrew Wedding Website

> Generated for Claude Code × Figma integration.
> Stack: Vanilla HTML5 / CSS3 / JavaScript — no frameworks, no build tools.

---

## 1. Design Tokens

All tokens are CSS custom properties defined in `:root` in `styles.css`.

### Colors

| Token | Value | Usage |
|---|---|---|
| `--color-dark-green` | `#1a3a2e` | Primary brand color — text, borders, buttons, nav |
| `--color-soft-white` | `#F1EDEA` | Background & alternate text (inverted in dark mode) |
| `--color-accent` | `#2d5a4a` | Gradient endpoint for button/hover states |
| Error red | `#c41e3a` | Form validation errors only |

**Dark mode** swaps the two primaries: `--color-soft-white` becomes the background, `--color-dark-green` becomes the text color. Applied via `body.dark-mode` class.

### Gradients

Buttons use a 300%-wide horizontal gradient that animates on hover:
```css
background: linear-gradient(90deg, #1a3a2e 0%, #2d5a4a 50%, #1a3a2e 100%);
background-size: 300% 100%;
/* animates: background-position 0% → 100% over 0.5s */
```

### Opacity & Overlays
- Hero overlay: `rgba(250, 249, 246, 0.7)` — light scrim
- Modal backdrop: `rgba(26, 58, 46, 0.45)`
- Secondary text / meta: `opacity: 0.7–0.8` on base color
- Placeholder text: `opacity: 0.35`
- Thin divider lines: `rgba(26, 58, 46, 0.15)` (light) / `rgba(241, 237, 234, 0.15)` (dark)

---

## 2. Typography

### Font Families

| Variable | Family | Weight | Use case |
|---|---|---|---|
| `--font-title` | PP Playground | 500 (Medium) | Decorative/display: couple names, section headings, page overlays |
| `--font-heading` | PP Watch | 700 (Bold) | Nav links, labels, buttons, meta — always uppercase + letter-spacing |
| `--font-body` | Sentient | 400 (Regular) | Body copy, descriptions, form inputs |

Fallbacks: PP Playground → `Brush Script MT, cursive` / PP Watch → `Helvetica Neue, Arial, sans-serif` / Sentient → `Baskerville, Georgia, serif`

### Type Scale

| Role | Font | Size | Transform | Letter-spacing | Line-height |
|---|---|---|---|---|---|
| Password/page overlay title | PP Playground | 5.2rem | — | — | — |
| Section title (display) | PP Playground | 3–4.5rem | — | — | — |
| Couple names (hero) | PP Playground | 3.5–4rem | — | — | 1.1 |
| Heading label | PP Watch | 0.85–1.5rem | uppercase | 0.15–0.25em | — |
| Nav links | PP Watch | 0.9rem | uppercase | 0.1em | — |
| Button text | PP Watch | 0.65–1rem | uppercase | 0.1–0.15em | — |
| Item name chip | PP Watch | 0.8rem | uppercase | 0.12em | — |
| Body / descriptions | Sentient | 1–1.1rem | — | — | 1.7 |
| Small meta text | Sentient | 0.85–0.95rem | — | — | 1.6 |
| Footer / copyright | PP Watch | 0.8rem | uppercase | 0.1em | — |

### Text Effects
- **Emboss (light mode):** `text-shadow: 0 2px 3px rgba(255,255,255,0.9), 0 -1px 1px rgba(26,58,46,0.1)`
- **Emboss (dark mode):** `text-shadow: 0 1px 2px rgba(255,255,255,0.2), 0 2px 5px rgba(0,0,0,0.5)`
- **Buttons & labels:** `text-shadow: none` (explicit override)

---

## 3. Spacing & Layout

### Content Width Constraints
| Container | Max-width |
|---|---|
| `.content-wrapper` | 800px |
| `.nav-content` | 1200px |
| `.specialty-grid` | 860px |
| `.faq-list` | 700px |
| `.attractions-list` | 700px |
| `.std-announcement` / `.std-travel` | 700px |
| `.claim-modal` | 400px |
| `.password-container` | 400px |

### Section Padding
- Standard section: `padding: 3rem 0`
- Registry/specialty section: `padding: 4rem 0 3rem` / `3rem 0 4rem`
- Page header (subpages with nav): `padding: 6rem 2rem 2rem`
- Content wrapper horizontal: `padding: 0 2rem` (reduces to `0 1.5rem` on mobile)
- Hero: `padding: 4rem 2rem 3rem`, `margin-top: 80px` (nav offset)
- Footer: `padding: 0 0 60px 0`

### Grid Patterns
- Specialty items: `grid-template-columns: repeat(2, 1fr)` → `1fr` on mobile
- Story/photo gallery: `grid-template-columns: repeat(2, 1fr)` → `1fr` on mobile
- Registry cards (logos): `flex-direction: column`, centered, `gap: 1.25rem`

---

## 4. Component Patterns

### Buttons (Pill Shape)
All interactive buttons share this base shape:
```
border-radius: 25px
border: 2px solid currentColor
font-family: PP Watch
text-transform: uppercase
letter-spacing: 0.1em
text-shadow: none
transition: all 0.5s ease
```

**Variants:**
- **Primary filled** (`.password-submit`, `.claim-submit-btn`): dark-green fill, soft-white text
- **Ghost/outline** (`.std-hotel-link`, `.item-link`, `.item-claim-btn`, `.dark-mode-btn`): transparent fill, dark-green border & text → inverts on hover
- **Registry card** (`.registry-card`): logo container, 240×56px pill, gradient fill from default

**Hover state** on all ghost buttons: gradient sweep left-to-right, text inverts, optional `translateY(-1px)` lift.

**Disabled/pending state** (`.item-claim-btn.pending`): `opacity: 0.5`, `cursor: default`

### Navigation (`.main-nav`)
- Fixed, `top: 0`, `z-index: 1000`
- `background-color: --color-soft-white` (inverts in dark mode)
- `border-bottom: 1px solid rgba(26,58,46,0.1)`
- Height implied by padding: `1.5rem 2rem`
- Site title: PP Playground 1.8rem
- Nav links: PP Watch 0.9rem, uppercase, `letter-spacing: 0.1em`

### Password Overlay
- Full-screen fixed, `z-index: 9999`
- Same background as page (`--color-soft-white` / `--color-dark-green`)
- Film grain texture overlaid at `z-index: 1`
- Title: PP Playground 5.2rem → 3.5rem on mobile
- Form: horizontal flex (input + button) → stacks vertically on mobile

### Marquee Banner
- Full-width, `background-color: --color-dark-green`, `color: --color-soft-white`
- PP Watch, uppercase, `letter-spacing: 0.2em`
- Two sizes: standard (1.1rem) and large (2rem, `padding: 1.5rem 0`)
- Infinite horizontal scroll animation (`translateX 0 → -50%`, 20s linear)

### Section Divider
- `font-family: PP Watch`, `letter-spacing: 0.8rem` — decorative text divider
- Also used as `<hr>` with `border-top: 1px solid rgba(26,58,46,0.15)`

### Specialty Item Card
```
.specialty-item
  .item-image-wrap (4:3 aspect ratio, border 1px, overflow hidden)
    img or .item-image-placeholder
  .item-name (PP Watch, 0.8rem, uppercase)
  .item-meta (Sentient, 0.9rem, opacity 0.7)
  .item-actions
    .item-link (ghost pill button → external link)
    .item-claim-btn (ghost pill button → opens modal)
```

### Claim Modal
- Fixed overlay backdrop: `rgba(26,58,46,0.45)`
- Modal card: `border-radius: 4px` (not pill — intentionally square-ish), `border: 2px solid --color-dark-green`, `padding: 2.5rem 2rem`
- Inputs: pill-shaped (`border-radius: 25px`), transparent bg
- Two action buttons side-by-side: filled submit + ghost cancel

---

## 5. Texture & Visual Effects

### Film Grain
- Applied to `body::before` and `#password-overlay::before`
- `background-image: url('images/textures/grain.png')`
- Dark mode: `url('images/textures/grain-dark.png')` (inverted)
- `z-index: -1` on body, `z-index: 1` on overlay (pointer-events: none on both)

### Footer Texture
- `background-image: url('images/textures/footer.png')` — repeating-x illustration at bottom
- `background-position: center bottom 5px`, `background-size: auto 30%`

### Embossed Images (Drop Shadow)
- Names image & Dupont illustration use `filter: drop-shadow()` for embossed look
- Light: `drop-shadow(0px 2px 2px rgba(255,255,255,1)) drop-shadow(0px -1px 1px rgba(0,0,0,0.15))`
- Dark: `drop-shadow(0px 2px 2px rgba(0,0,0,0.5)) drop-shadow(0px -1px 1px rgba(255,255,255,0.1))`

---

## 6. Dark Mode

Toggle via `body.dark-mode` class (persisted in `localStorage('darkMode')`).

**Color inversions:**
- Background: `--color-soft-white` → `--color-dark-green`
- Text: `--color-dark-green` → `--color-soft-white`
- Borders: dark-green → soft-white
- Button gradients: swap color stops

**Image swapping:**
- Name lockup PNG: `names-image.png` → `names-image-dark.png`
- Illustrations: `Dupont.png` → `Dupont-dark.png`
- Registry logos: `data-light` / `data-dark` attributes swapped via JS
- Grain texture: `grain.png` → `grain-dark.png`
- Footer: `footer.png` → `footer-dark.png` + `filter: brightness(1.5)`

---

## 7. Responsive Breakpoints

| Breakpoint | Width | Key changes |
|---|---|---|
| Large | `max-width: 1024px` | Nav gap reduces |
| Tablet | `max-width: 768px` | Nav stacks, grids go 1-col, font sizes reduce, password form stacks |
| Mobile | `max-width: 480px` | Body font 16px, display text further reduced, padding tightens |

---

## 8. Asset Conventions

### Image Naming
- Name lockups: `images/names/names-image.png` + `images/names/names-image-dark.png`
- Illustrations: `images/illustrations/Dupont.png` + `images/illustrations/Dupont-dark.png`
- Registry item photos: `images/registry/[item-name].jpg` or `.png`
- Textures: `images/textures/grain.png`, `grain-dark.png`, `footer.png`, `footer-dark.png`

### SVG / Vector Logos
- Stored in `vectors/`
- Naming: `[brand]-dark.svg` (inverted/light version for use on dark backgrounds) + `[brand].svg` (light/standard)
- Used via `data-light` / `data-dark` HTML attributes for JS-driven dark mode swap

### Source Files
- `artboards/` — Affinity Designer `.afdesign` source files

---

## 9. CSS Methodology

- **No framework** — plain CSS in `styles.css` + page-level `<style>` blocks in each HTML file
- **Global styles:** `styles.css` (shared components, typography, layout, breakpoints)
- **Page-specific styles:** `<style>` tag within each HTML file (password overlay, page layout, dark mode overrides)
- **Naming:** BEM-inspired: `.component-element` or `.component-element--modifier`
- **Namespace prefixes:** `std-` (save the date page), `registry-`, `password-`
- **Utility classes:** `.content-wrapper`, `.section-divider`, `.grid`, `.card`
- **Media queries:** at the bottom of `styles.css`; also duplicated inline for page-specific rules

---

## 10. Figma Implementation Notes

When implementing designs from Figma into this codebase:

1. **Colors** — always use `var(--color-dark-green)`, `var(--color-soft-white)`, `var(--color-accent)` — never hardcode hex values
2. **Fonts** — use `var(--font-title)`, `var(--font-heading)`, `var(--font-body)` variables
3. **Buttons** — all interactive elements must follow the pill-shaped ghost/filled pattern with the gradient hover animation
4. **Dark mode** — every new component needs `body.dark-mode .component` overrides
5. **No build step** — edits go directly into `.html` or `.css` files; deployed by `git push origin main`
6. **Page styles** — add page-specific styles in the HTML `<style>` block, not in `styles.css`
