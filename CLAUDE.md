# Wedding Website — CLAUDE.md

Andrew & Adina's wedding website. A static site hosted on GitHub Pages with no build process.

---

## Project Overview

- **Hosting:** GitHub Pages (auto-deploys on push to `main`)
- **Domain:** Custom domain via `CNAME` file
- **Stack:** Vanilla HTML5 / CSS3 / JavaScript — no frameworks, no build tools
- **Backend:** Google Apps Script + Google Sheets (RSVP only)
- **Persistence:** `sessionStorage` (password gate), `localStorage` (registry claims)

---

## File Structure

```
/
├── index.html              # Entry point — password gate, redirects to savethedate
├── savethedate.html        # Save the Date announcement + hotel blocks
├── rsvp.html               # RSVP form (guest lookup → dynamic event form)
├── registry.html           # Registry page — specialty items + claim modal
├── registry-admin.html     # Admin view — confirm/deny registry claims
├── travel.html             # Travel & hotel info
├── styles.css              # Main stylesheet (all shared styles)
├── rsvp-styles.css         # RSVP-specific styles
├── rsvp-script.js          # RSVP form logic & Google Sheets submission
├── google-apps-script.js   # Google Apps Script backend (copy into Apps Script editor)
├── guests.js               # Guest list data (used by RSVP autocomplete)
├── favicon.png             # Site favicon
├── .htaccess               # Apache rewrite rules — removes .html from URLs
├── CNAME                   # Custom domain
└── SETUP-GUIDE.md          # Google Sheets / Apps Script setup walkthrough
```

**Asset folders:**
- `fonts/` — PP Playground, PP Watch, Sentient (WOFF/WOFF2)
- `images/names/` — Couple name lockup PNGs (light + dark variants)
- `images/illustrations/` — Dupont fountain illustration. Others to come.
- `images/registry/` — Retailer logo PNGs (planned; currently served from `vectors/` as SVGs)
- `images/textures/` — Film grain overlays
- `vectors/` — SVG versions of graphics
- `artboards/` — Affinity Designer source files

---

## Design System

### Colors (CSS custom properties in `styles.css`)
| Variable | Value | Use |
|---|---|---|
| `--color-dark-green` | `#1a3a2e` | Primary brand color |
| `--color-soft-white` | `#F1EDEA` | Background & alternate text |
| `--color-accent` | `#2d5a4a` | Darker green accent |

### Typography
| Font | Weight | Use |
|---|---|---|
| PP Playground | Medium | Decorative / display titles |
| PP Watch | Bold | Headings, navigation (uppercase, `letter-spacing: 0.15em`) |
| Sentient | Regular | Body copy |

### Visual Language
- Film grain texture overlay on body and overlays
- Embossed text effect (white/dark box shadows)
- Pill-shaped buttons (border-radius: 25px) with gradient hover animation
- Drop shadows on images
- Dark mode: images swap to `-dark` variants, grain texture inverts

### Responsive Breakpoints
- `max-width: 1024px` — Large screens
- `max-width: 768px` — Tablet
- `max-width: 480px` — Mobile

---

## Key Patterns & Conventions

### CSS
- BEM-like class naming: `.component-element` or `.component-element--modifier`
- Prefix namespacing: `std-` (save the date), `registry-`, `password-`
- Utility classes: `.content-wrapper` (max-width: 800px), `.section-divider`, `.grid`, `.card`
- Media queries at the bottom of `styles.css`
- Page-specific styles (password gate, page layout) live in `<style>` blocks within each HTML file; `styles.css` is for shared/global styles

### JavaScript
- No frameworks — vanilla DOM manipulation only
- Cache DOM refs in variables at top of script
- Event delegation via `addEventListener`
- Defensive null checks before DOM operations
- `console.log` for debug logging (left in intentionally)

### HTML
- Mobile-first responsive meta tag
- Fixed nav bar (`z-index: 1000`)
- Content wrapper max-width: 800px for readability
- Semantic section names: `.intro`, `.the-weekend`, `.rsvp-section`, `.registry-section`

---

## Password Gate

- **Main site password (`index.html`):** `october17`
- **Registry password (`registry.html`):** `beautifulsuperstar`
- **Registry admin password (`registry-admin.html`):** `registry-admin-2026`
- Session storage keys: `saveTheDateUnlocked` (main gate), `registryUnlocked` (registry page)
- On success (main gate): sets `saveTheDateUnlocked` + redirects to `/savethedate`
- On success (registry): sets `registryUnlocked` + shows protected content in place
- On failure: shows error, clears input, refocuses field
- Overlay: `z-index: 9999`, `overflow: hidden` on body
- **Security note:** Client-side only — password is visible in HTML source. This is intentional for a low-stakes wedding invite.

---

## RSVP System

**Flow:**
1. Guest types name → autocomplete searches `guests.js`
2. On selection, form renders only the events that guest is invited to
3. Each event gets an individual yes/no/maybe response
4. Conditional fields (guest count, dietary, song request) appear only when attending
5. Submission → `fetch()` POST to Google Apps Script URL → data written to Google Sheet
6. Confirmation screen shown; email sent to guest

**Planned events (keys TBD when guest list is finalized):**
| Day | Event |
|---|---|
| Friday | Welcome Party |
| Saturday | Reception |
| Saturday | After Party |
| Sunday | Brunch |

Note: current `invitedTo` keys in `guests.js` use `friday`/`saturday`/`sunday`. These will be updated to specific event keys (e.g. `welcome-party`, `reception`, `after-party`, `brunch`) when the RSVP form is built out.

**Google Apps Script URL** is hardcoded in `rsvp-script.js` (line ~235). Update this if the Apps Script is redeployed (generates a new URL).

**Guest data structure (`guests.js`):**
```javascript
{
  id: 1,
  name: "Full Name",
  email: "optional@email.com",
  invitedTo: ["friday", "saturday", "sunday"], // subset of weekend events — keys will eventually map to specific events below
  maxGuests: 2, // including the guest themselves
  notes: "" // internal only, not shown to guest
}
```

See `SETUP-GUIDE.md` for full Google Sheets setup instructions.

---

## Registry System

**Specialty items** are defined as a `SPECIALTY_ITEMS` array in `registry.html`:
```javascript
{
  id: "unique-string-id",
  name: "Item Name",
  retailer: "Store Name",
  price: "$00",
  purchaseUrl: "https://...", // or "#" if not yet set
  image: "images/registry/image.png" // null to show placeholder
}
```

**Claim flow:** Guest clicks item → modal opens → fills name + email → stored in `localStorage` under key `registryPendingItems`.

**LocalStorage schema (`registryPendingItems`):**
```javascript
{
  "item-id": {
    name: "Guest Name",
    email: "guest@email.com",
    timestamp: "ISO string",
    confirmed: false
  }
}
```

**Admin (`registry-admin.html`):** Reads same localStorage, shows pending claims, allows confirm/deny. Protected by `registry-admin-2026`.

---

## Deployment

```bash
git add .
git commit -m "message"
git push origin main
```

GitHub Pages auto-deploys. No build step required — edits to HTML/CSS/JS go live on push.

`.htaccess` handles clean URLs (strips `.html` extension) for Apache servers; GitHub Pages uses a different mechanism so this mainly matters if self-hosting.

---

## Dark Mode

- Toggle button in footer on every page
- Preference persisted in `localStorage` (`darkMode: 'enabled'`)
- Image swapping (names): `names-image.png` → `names-image-dark.png` filename pattern
- Image swapping (registry logos): `data-light`/`data-dark` attributes on `<img>` tags, swapped via JS on toggle
- CSS class `dark-mode` applied to `<body>`

---

## What Does NOT Exist Here

- No package.json / npm / bundler
- No TypeScript
- No React / Vue / Svelte
- No server-side rendering
- No database (Google Sheets is the only backend)
- No automated tests
- No CI/CD pipeline (GitHub Pages is the pipeline)
