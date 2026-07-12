# Complete Site Audit — Revised March 9, 2026

Read this entire document before making any changes. Then implement ALL fixes in a single pass. Do not make partial changes.

---

## DESIGN DECISIONS (locked by Andrew)

### Nav Style — NO pill, NO SVG frame

Go back to simple corner layout: monogram on the left, Menu button on the right. Full-width transparent nav with a hairline bottom border. `max-width: 1100px` on `.nav-content` with `margin: 0 auto` so elements don't get lost on ultrawide screens.

Remove ALL references to:
- `floating-header-green.svg` and `floating-header-white.svg`
- Any `background-image` on `.nav-content`
- Any `border-radius: 50px` on nav elements
- Any `pointer-events: none` on `.main-nav`

The nav is simple:

```css
.main-nav {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    background: transparent;
    border-bottom: var(--border-hairline);
    padding: 0.75rem 0;
}

body.dark-mode .main-nav {
    border-bottom: var(--border-hairline-dark);
}

.nav-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: nowrap;
    max-width: 1100px;
    margin: 0 auto;
    padding: 0 2rem;
}
```

Desktop and mobile: monogram left, Menu right. Same layout at all sizes. Monogram links to `/`. Below 900px, monogram gets smaller (56px → 40px).

### Button System — Two Variants

There are exactly two button styles. BOTH use the same base shape: `border-radius: 25px`, `border: 2px solid`, PP Watch font, uppercase, small size.

**"Normal" button** — empty/outline. Background matches the page (transparent). Border and text are the page's foreground color. Used for: Menu button, hotel "Visit Website" links, "Dark Mode"/"Light Mode" toggle button on Save the Date.

```css
.btn-normal {
    display: inline-block;
    font-family: var(--font-heading);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--color-dark-green);
    background-color: transparent;
    padding: 0.5rem 1.2rem;
    border-radius: 25px;
    border: 2px solid var(--color-dark-green);
    text-decoration: none;
    text-shadow: none;
    cursor: pointer;
    transition: all 0.5s ease;
    background-size: 300% 100%;
    background-position: 0% 0%;
}

/* Hover: gradient flash into opposite color (fills up) */
.btn-normal:hover {
    background: linear-gradient(90deg, var(--color-dark-green) 0%, #2d5a4a 50%, var(--color-dark-green) 100%);
    background-size: 300% 100%;
    background-position: 100% 0%;
    color: var(--color-soft-white);
    animation: flashGradient 0.5s ease forwards;
}

body.dark-mode .btn-normal {
    color: var(--color-soft-white);
    border-color: var(--color-soft-white);
    background-color: transparent;
}

body.dark-mode .btn-normal:hover {
    background: linear-gradient(90deg, var(--color-soft-white) 0%, #d4cfc8 50%, var(--color-soft-white) 100%);
    background-size: 300% 100%;
    background-position: 100% 0%;
    color: var(--color-dark-green);
    animation: flashGradientDark 0.5s ease forwards;
}
```

**"Priority" button** — filled with opposite color. Used for: "Visit Our Registry" CTA.

```css
.btn-priority {
    display: inline-block;
    font-family: var(--font-heading);
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    padding: 0.7rem 2rem;
    border-radius: 25px;
    border: 2px solid var(--color-dark-green);
    text-decoration: none;
    text-shadow: none;
    cursor: pointer;
    transition: all 0.5s ease;
    /* Filled: dark green bg, white text */
    background: linear-gradient(90deg, var(--color-dark-green) 0%, var(--color-dark-green) 33%, rgba(26, 58, 46, 0) 67%, rgba(26, 58, 46, 0) 100%);
    background-size: 300% 100%;
    background-position: 0% 0%;
    color: var(--color-soft-white);
}

/* Hover: gradient flash until it becomes empty */
.btn-priority:hover {
    background-position: 100% 0%;
    color: var(--color-dark-green);
    animation: flashGradient 0.5s ease forwards;
}

body.dark-mode .btn-priority {
    border-color: var(--color-soft-white);
    background: linear-gradient(90deg, var(--color-soft-white) 0%, var(--color-soft-white) 33%, rgba(241, 237, 234, 0) 67%, rgba(241, 237, 234, 0) 100%);
    background-size: 300% 100%;
    background-position: 0% 0%;
    color: var(--color-dark-green);
}

body.dark-mode .btn-priority:hover {
    background-position: 100% 0%;
    color: var(--color-soft-white);
    animation: flashGradientDark 0.5s ease forwards;
}
```

**Migration:** Replace all existing button classes:
- `.menu-toggle` → style like `.btn-normal` (but as a `<button>`, not `<a>`)
- `.std-hotel-link` → `.btn-normal`
- `.registry-cta .std-hotel-link` → `.btn-priority`
- `.dark-mode-btn` (on Save the Date) → `.btn-normal`

You can either rename the classes in HTML or just restyle the existing class names to match. The simplest path: keep `.std-hotel-link` as the normal button and add `.btn-priority` or `.filled` as a modifier class for the filled variant.

### Save the Date Page — Restore Original Toggle

Restore the centered "Dark Mode" / "Light Mode" button at the bottom of the Save the Date page exactly as it was before the recent rewrite. It's a `.btn-normal` style button, centered in a simple footer area:

```html
<footer>
    <div class="dark-mode-toggle" style="text-align: center; padding: 1rem 0;">
        <button id="dark-mode-btn" class="btn-normal">Dark Mode</button>
    </div>
</footer>
```

The button text changes to "Light Mode" when dark mode is active. No icon. No label span. Just the button. The Save the Date page has NO nav and NO standard footer — just its content and this toggle.

Also remove the stale rule from savethedate.html:
```css
/* DELETE THIS */
body.dark-mode footer {
    background-image: url('images/textures/footer-dark.png');
    filter: brightness(1.5);
}
```

---

## CRITICAL FIXES

### 1. Move Shared Styles to `styles.css`

The following CSS is duplicated across `registry.html`, `savethedate.html`, `rsvp.html`, and `index.html`. Move ALL of it to `styles.css`:

- Password overlay styles (`.password-container`, `.password-input`, `.password-submit`, `.password-error`, dark mode variants)
- Password overlay grain (`#password-overlay::before`)
- `@keyframes flashGradient` and `@keyframes flashGradientDark`
- Button styles (`.btn-normal`, `.btn-priority`, `.std-hotel-link`)
- Body locked state (`body.locked { overflow: hidden }`)
- `#password-overlay` base styles

After moving these, each page's inline `<style>` should contain ONLY page-specific overrides — registry title sizing, illustration styling, page-specific layout. Target: under 50 lines per page.

### 2. Fix Save the Date Password Overlay Grain

In `savethedate.html`, the password overlay grain uses `background-size: cover; background-repeat: no-repeat`. Change to:

```css
#password-overlay::before {
    background-size: 400px 400px;
    background-repeat: repeat;
}
```

This should be handled automatically by moving the shared password overlay styles to `styles.css`.

### 3. Fix `rsvp.html` Password Heading

The RSVP page shows "Save the Date" as the password heading. If this page redirects to Save the Date, the heading should say "RSVP" or whatever is appropriate. Andrew should confirm, but at minimum the `<h2>` text is wrong.

### 4. Grain Texture — Scrolling

Ensure `body` has the grain as `background-image` directly (NOT a pseudo-element). This is currently correct in `styles.css` but verify no page overrides it:

```css
body {
    background-color: var(--color-soft-white);
    background-image: url('images/textures/grain.png');
    background-size: 400px 400px;
    background-repeat: repeat;
}

body.dark-mode {
    background-color: var(--color-dark-green);
    background-image: url('images/textures/grain-dark.png');
}
```

Delete any remaining `body::before` grain rules anywhere in the codebase.

### 5. Mobile Footer Layout

Below 900px, the footer content should stack vertically and center:

```css
@media (max-width: 900px) {
    .footer-content {
        flex-direction: column;
        align-items: center;
        gap: 1rem;
    }
}
```

### 6. Menu Dropdown Position

With the simple nav layout (not the pill), the dropdown should position relative to `.nav-content`:

```css
.nav-content {
    position: relative;
}

.nav-links {
    position: absolute;
    top: calc(100% + 12px);
    left: 0;
}
```

---

## IMPLEMENTATION ORDER

1. Add shared password overlay, button, and keyframe styles to `styles.css`
2. Add `.btn-normal` and `.btn-priority` button system to `styles.css`
3. Replace `.main-nav` / `.nav-content` with the simple corner layout (remove SVG/pill)
4. Add `position: relative` to `.nav-content` for dropdown positioning
5. Fix `.nav-links` position (`left: 0`, `top: calc(100% + 12px)`)
6. Update monogram to always use theme-appropriate image (dark mode swap stays)
7. Fix mobile footer stacking
8. Restore Save the Date dark mode toggle button (centered `.btn-normal`)
9. Remove stale footer pattern reference from `savethedate.html`
10. Fix Save the Date password overlay grain (tiled, not cover)
11. Strip inline `<style>` blocks down to page-specific overrides only
12. Remove all SVG nav frame references from CSS and JS
13. Test every page: light mode + dark mode × desktop + mobile = 8 combinations minimum

## DO NOT:
- Change the Save the Date page content or layout (only restore its toggle)
- Change illustration sizes or positions
- Change the grain texture files
- Change the password protection logic
- Add any new visual features not described here
- Change the footer on registry page (it works, just fix mobile stacking)
