// Google Apps Script for the Wedding RSVP card flow (rsvp.html + js/rsvp-flow.js)
//
// ============================================================================
// SPREADSHEET LAYOUT (create these two tabs in one Google Sheet)
// ============================================================================
//
// Tab "Guests" — the invitation list, filled in manually by Andrew (one row
// per invitation; one PERSON per column rather than a ";"-separated cell,
// since discrete cells are far less error-prone to hand-enter and audit):
//   Email | Name 1 | Name 2 | Name 3 | Name 4 | Name 5 | Name 6 | Friday | Saturday | Sunday
//   - Email:   the address the invitation was sent to
//   - Name 1..Name 6:  one person per column, left to right; blanks are
//             skipped, so a 2-person invitation just leaves Name 3-6 empty
//   - Friday / Saturday / Sunday:  TRUE/FALSE (checkboxes work) or "yes"/blank
//             for whether that invitation includes the event. These three
//             columns are located by their HEADER TEXT (must be spelled
//             exactly "Friday", "Saturday", "Sunday"), not by fixed index —
//             see findEventColumns / handleLookup. Column ORDER among the
//             name columns and event columns is otherwise flexible.
//   - Any scratch/notes column must go to the RIGHT of Friday/Saturday/Sunday.
//             Everything between Email and the first event column is read as
//             a person's name, so a notes column placed among the names would
//             be picked up as a phantom guest.
//
// Tab "Responses" — written by this script, one row PER PERSON per submission:
//   Timestamp | Email | Name | Friday | Saturday | Sunday | Meal | Kosher | Message
//   - Event columns hold "yes" / "no", or "not invited" for events not on the
//     invitation
//   - Meal: branzino / chicken / cauliflower (blank unless accepting Saturday)
//   - Kosher: "yes" / "" (only meaningful for branzino/chicken)
//   - Message is repeated on each of the party's rows
//   Rows are append-only; resubmissions simply add new rows — reconcile by
//   latest Timestamp per email.
//
// ============================================================================
// DEPLOYMENT
// ============================================================================
// 1. Create the Google Sheet with the two tabs above ("Guests", "Responses")
// 2. Extensions > Apps Script, paste this entire file over the default code
// 3. Deploy > New deployment > type "Web app"
// 4. "Execute as": Me   ·   "Who has access": Anyone
// 5. Deploy, copy the Web App URL, and paste it into APPS_SCRIPT_URL at the
//    top of js/rsvp-flow.js
//
// ACTIONS (GET, ?action=...):
//   lookup   ?q=<term>      exact, case-insensitive match against
//                           Guests.Email — see handleLookup
//   response ?email=<email> the caller's LATEST submission (attendance +
//                           meal, by exact email), for the returning-guest
//                           fast path — see handleLatestResponse
//
// PRIVACY CAVEAT (accepted tradeoff, restated honestly — updated July 2026,
// supersedes the earlier substring-match version of this note): with access
// set to "Anyone", both GET endpoints remain publicly queryable by anyone who
// finds the URL. As of July 2026, ?action=lookup requires an exact email
// match rather than a substring — a caller can no longer enumerate the guest
// list from a partial string like "gmail.com"; ?action=response already
// required an exact match. The residual exposure on both endpoints is
// confirm/deny for a SPECIFIC, already-guessed address: a correct guess
// returns that invitation's names, invited events, and (via ?action=response)
// prior submission. That residual is accepted by Andrew, July 2026, as the
// cost of a web app callable without credentials.
//
// CORS NOTE: Apps Script web apps don't set CORS headers for JSON posts. The
// front end therefore sends Content-Type: text/plain with a JSON string body
// (no preflight — the standard Apps Script pattern) and uses a simple GET for
// lookup. Don't "fix" the client to send application/json; it will break.
// ============================================================================

var GUESTS_SHEET = 'Guests';
var RESPONSES_SHEET = 'Responses';
var EVENT_KEYS = ['friday', 'saturday', 'sunday'];
var EVENT_NAMES = {
  friday: 'Welcome Party (Friday)',
  saturday: 'Ceremony and Reception (Saturday)',
  sunday: 'Farewell Brunch (Sunday)'
};
// Full display names (radio-equivalent) and short forms — mirrors
// MEAL_OPTIONS in js/rsvp-flow.js. Keys are the values actually stored in
// the Responses sheet (person.meal) and never change; only these display
// strings do.
var MEAL_NAMES = {
  branzino: 'Pan-Seared Herb Branzino',
  chicken: 'Lemon Thyme-Marinated Chicken',
  cauliflower: 'Cauliflower Steak'
};
var MEAL_SHORT_NAMES = {
  branzino: 'Branzino',
  chicken: 'Chicken',
  cauliflower: 'Cauliflower Steak'
};
// Event labels for the confirmation email ONLY — these include the date,
// which EVENT_NAMES (used elsewhere) does not. Kept as a separate constant
// rather than changing EVENT_NAMES's format.
var EMAIL_EVENT_LABELS = {
  friday: 'Welcome Party · Friday, October 16',
  saturday: 'Ceremony & Reception · Saturday, October 17',
  sunday: 'Farewell Brunch · Sunday, October 18'
};
// Dress codes shown in the confirmation email for events the guest is
// ATTENDING only (never a declined event). Duplicated from the `dress` field
// of EVENT_DETAILS in js/rsvp-flow.js — keep these two in sync if the site
// copy ever changes. Deliberately NOT on the public FAQ: Friday/Sunday dress
// codes would reveal those events exist to guests not invited to them; the
// email is per-guest and already lists only accepted events, so it has no
// such disclosure problem.
var EMAIL_EVENT_DRESS = {
  friday: 'Semi-Formal',
  saturday: 'Black Tie Preferred',
  sunday: 'Come as you are'
};

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// GET  ?action=lookup&q=<term>          -> handleLookup
// GET  ?action=response&email=<email>   -> handleLatestResponse
// doGet is just the dispatcher; each action has its own handler below.
// ============================================================================
function doGet(e) {
  try {
    var action = e && e.parameter && e.parameter.action;
    if (action === 'lookup') { return handleLookup(e); }
    if (action === 'response') { return handleLatestResponse(e); }
    return jsonResponse({ status: 'error', message: 'Unknown action' });
  } catch (error) {
    return jsonResponse({ status: 'error', message: error.toString() });
  }
}

// Locates the Friday/Saturday/Sunday columns by HEADER TEXT in row 1 rather
// than by fixed index (July 2026 schema change). With one column per person,
// the number of name columns can change; deriving the event columns from the
// headers means inserting or removing a name column can never silently shift
// which cell is read as "Saturday". Returns a { friday, saturday, sunday } map
// of 0-based column indices, or null if any header is missing.
function findEventColumns(headerRow) {
  var map = {};
  for (var c = 0; c < headerRow.length; c++) {
    var label = (headerRow[c] + '').trim().toLowerCase();
    for (var k = 0; k < EVENT_KEYS.length; k++) {
      if (label === EVENT_KEYS[k]) { map[EVENT_KEYS[k]] = c; }
    }
  }
  for (var j = 0; j < EVENT_KEYS.length; j++) {
    if (typeof map[EVENT_KEYS[j]] !== 'number') { return null; }
  }
  return map;
}

// Exact, case-insensitive match against Guests.Email (July 2026 — was a
// substring match; see the PRIVACY CAVEAT above for why). Returns zero or one
// invitation: [{ email, invitedTo: ['friday', ...], people: ['Name', ...] }].
// The client now gates on a complete-address shape before ever calling this
// (see EMAIL_SHAPE in js/rsvp-flow.js), so in practice q already looks like a
// full email — the server enforces the exact match regardless.
function handleLookup(e) {
  var q = ((e.parameter.q || '') + '').trim().toLowerCase();
  if (!q) { return jsonResponse([]); }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GUESTS_SHEET);
  if (!sheet) {
    return jsonResponse({ status: 'error', message: 'Guests sheet not found' });
  }

  var rows = sheet.getDataRange().getValues();
  if (rows.length < 2) { return jsonResponse([]); }

  var eventCols = findEventColumns(rows[0]);
  if (!eventCols) {
    return jsonResponse({
      status: 'error',
      message: 'Guests sheet header row must contain columns named Friday, Saturday, and Sunday'
    });
  }

  // Name columns are every column between Email (0) and the first event
  // column. Derived, not hardcoded — with the July 2026 layout that is B..G
  // (Name 1..Name 6), but adding a Name 7 requires no code change.
  var firstEventCol = Math.min(
    eventCols.friday, eventCols.saturday, eventCols.sunday
  );

  var results = [];

  // Row 0 is the header.
  for (var i = 1; i < rows.length; i++) {
    var email = (rows[i][0] + '').trim();
    if (!email || email.toLowerCase() !== q) { continue; }

    var people = [];
    for (var n = 1; n < firstEventCol; n++) {
      var name = (rows[i][n] + '').trim();
      if (name) { people.push(name); }
    }

    var invitedTo = [];
    for (var c = 0; c < EVENT_KEYS.length; c++) {
      if (isInvited(rows[i][eventCols[EVENT_KEYS[c]]])) {
        invitedTo.push(EVENT_KEYS[c]);
      }
    }

    results.push({ email: email, invitedTo: invitedTo, people: people });
  }

  return jsonResponse(results);
}

// Returning-guest fast path (Section G3, July 2026): the guest's LATEST
// submission for an exact (case-insensitive, NOT substring — unlike lookup)
// email match against Responses. Groups by the most recent Timestamp for
// that email (a submission writes one row per person, all sharing one
// timestamp) and returns { people, message } in submission shape, or
// { none: true } if the email has never submitted.
//
// PRIVACY NOTE: this exposes attendance + meal per email behind the same
// URL/password tradeoff as ?action=lookup — accepted by Andrew, July 2026.
// The deployed copy of this file must be redeployed once APPS_SCRIPT_URL
// goes live to pick this action up (see js/rsvp-flow.js).
function handleLatestResponse(e) {
  var email = ((e.parameter.email || '') + '').trim().toLowerCase();
  if (!email) { return jsonResponse({ none: true }); }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(RESPONSES_SHEET);
  if (!sheet || sheet.getLastRow() < 2) { return jsonResponse({ none: true }); }

  var rows = sheet.getDataRange().getValues();
  var latestMs = null;
  var latestRows = [];

  // Row 0 is the header (Timestamp | Email | Name | Friday | Saturday |
  // Sunday | Meal | Kosher | Message).
  for (var i = 1; i < rows.length; i++) {
    if ((rows[i][1] + '').trim().toLowerCase() !== email) { continue; }
    var ts = rows[i][0];
    var ms = ts instanceof Date ? ts.getTime() : new Date(ts).getTime();
    if (latestMs === null || ms > latestMs) {
      latestMs = ms;
      latestRows = [rows[i]];
    } else if (ms === latestMs) {
      latestRows.push(rows[i]);
    }
  }

  if (!latestRows.length) { return jsonResponse({ none: true }); }

  var people = latestRows.map(function (row) {
    return {
      name: row[2] || '',
      events: {
        friday: normalizeEventCell(row[3]),
        saturday: normalizeEventCell(row[4]),
        sunday: normalizeEventCell(row[5])
      },
      meal: row[6] || '',
      mealKosher: (row[7] + '').trim().toLowerCase() === 'yes'
    };
  });

  return jsonResponse({ people: people, message: latestRows[0][8] || '' });
}

// Responses stores "not invited" for events outside that invitation — the
// front end's events map only expects 'yes'/'no'/'' (see EVENT_DETAILS
// usage in js/rsvp-flow.js), so anything else collapses to ''.
function normalizeEventCell(value) {
  var s = (value + '').trim().toLowerCase();
  return (s === 'yes' || s === 'no') ? s : '';
}

// TRUE (checkbox), "TRUE", "yes", "x", "1" all count as invited; blank/FALSE don't.
function isInvited(cell) {
  if (cell === true) { return true; }
  var s = (cell + '').trim().toLowerCase();
  return s === 'true' || s === 'yes' || s === 'x' || s === '1';
}

// ============================================================================
// POST — one submission from js/rsvp-flow.js:
//   { email,
//     people: [{ name, events: { friday: 'yes'|'no', ... },
//                meal: 'branzino'|'chicken'|'cauliflower'|'',
//                mealKosher: boolean }],
//     message }
// Appends one Responses row per person, then sends a confirmation email
// (guarded — a mail failure never fails the submission).
// ============================================================================
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var email = (data.email || '') + '';
    var people = data.people || [];
    var message = (data.message || '') + '';

    if (!email || !people.length) {
      return jsonResponse({ status: 'error', message: 'Missing email or people' });
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(RESPONSES_SHEET);
    if (!sheet) { sheet = ss.insertSheet(RESPONSES_SHEET); }

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Timestamp', 'Email', 'Name', 'Friday', 'Saturday', 'Sunday', 'Meal', 'Kosher', 'Message']);
      sheet.getRange(1, 1, 1, 9).setFontWeight('bold');
    }

    var timestamp = new Date();
    people.forEach(function (person) {
      var events = person.events || {};
      sheet.appendRow([
        timestamp,
        email,
        person.name || '',
        eventCell(events.friday),
        eventCell(events.saturday),
        eventCell(events.sunday),
        person.meal || '',
        person.mealKosher ? 'yes' : '',
        message
      ]);
    });

    // Confirmation email — best-effort only. Never let a send failure turn a
    // logged submission into a user-facing error.
    try {
      sendConfirmationEmail(email, people, message);
    } catch (mailError) {
      console.error('Confirmation email failed: ' + mailError);
    }

    return jsonResponse({ status: 'success', message: 'RSVP received' });
  } catch (error) {
    return jsonResponse({ status: 'error', message: error.toString() });
  }
}

// Events not present on the invitation arrive absent/empty -> "not invited".
function eventCell(value) {
  return value === 'yes' || value === 'no' ? value : 'not invited';
}

// ============================================================================
// Confirmation email — per-person event lines; meal + kosher for Saturday
// acceptances. Rewritten July 2026 after a real Gmail render turned up two
// failures: (1) Gmail overrides a `font-family` set on `body`, so the
// intended serif copy rendered in Gmail's own sans-serif — every element
// below sets its OWN font-family instead; (2) Outlook desktop strips a
// <style> block entirely, which would leave the whole email unstyled — so
// every LIGHT-MODE color here is still set via an inline style="" attribute
// as the single source of truth, and Outlook (which doesn't support email
// dark mode at all) just renders that fallback, unaffected by anything else
// in this file. A third constraint: flexbox/grid do not render in email
// clients, so the label/status event rows use bulletproof two-cell
// <table>s (buildEmailEventRowHtml) instead. rgba() is avoided throughout in
// favor of pre-flattened hex, since rgba() support is inconsistent across
// clients.
//
// DARK MODE (July 2026, revised): client support for email dark mode is
// split, and this only targets the clients that can actually be targeted —
// Apple Mail and other prefers-color-scheme-honoring clients (Outlook 2019+,
// Samsung Mail, Thunderbird) get an authored dark palette; Outlook desktop
// (strips <style> entirely) falls back to the light design, correctly;
// Gmail's own apps (web, Android, iOS) ignore prefers-color-scheme and apply
// their own algorithmic darkening/inversion regardless of anything here —
// that is accepted, not fought (no [data-ogsc], background-image swatch
// tricks, background-clip:text, or mix-blend-mode; all explicitly rejected
// as fragile and unpredictable across account types).
//
// The split is strict: every inline style="" attribute above remains the
// single source of truth for the light design, completely untouched by this
// section. The <style> block added to a new <head> contains NOTHING but the
// `:root{color-scheme:light dark;}` declaration and the
// `@media(prefers-color-scheme:dark)` rules — no base styles ever move into
// it. Elements that need a different color in dark mode carry a `dm-*` class
// (see the per-role list on each element below) that the media query
// overrides with `!important` — the only place in this file `!important` is
// used, since it's what lets a rule in an embedded stylesheet beat a plain
// inline style. The monogram swaps files entirely in dark mode (two stacked
// <img>s, toggled by a display/width/max-height/overflow combination more
// reliable than display:none alone across clients) — except in Gmail's own
// apps, where the media query never runs and the green monogram (transparent
// PNG) stays on Gmail's own darkened field; that is expected.
// ============================================================================

// One event row inside the reply card: label left, status right, as a
// two-cell table (see the function-level comment above for why a table and
// not flex). EMAIL_EVENT_LABELS (not EVENT_NAMES) supplies the label text —
// it includes the date, which EVENT_NAMES does not.
function buildEmailEventRowHtml(key, attending) {
  var statusColor = attending ? '#2d5a4a' : '#97A29B';
  var statusWeight = attending ? 'bold' : '500';
  var statusClass = attending ? 'dm-yes' : 'dm-no';
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">' +
    '<tr>' +
    '<td class="dm-event" style="padding:5px 0;font-size:14px;color:#415A50;font-family:Georgia,\'Times New Roman\',serif;text-align:left;vertical-align:top;">' +
    EMAIL_EVENT_LABELS[key] + '</td>' +
    '<td class="' + statusClass + '" style="padding:5px 0;font-size:12px;letter-spacing:.06em;font-weight:' + statusWeight + ';' +
    'font-family:\'Helvetica Neue\',Helvetica,Arial,sans-serif;text-align:right;white-space:nowrap;vertical-align:top;color:' + statusColor + ';">' +
    (attending ? 'Attending' : 'Not attending') + '</td>' +
    '</tr></table>';
}

// One person's block inside the reply card: uppercase name header, one
// two-cell row per INVITED event (events absent from `events` — value
// neither 'yes' nor 'no' — are skipped entirely, matching the sheet's "not
// invited" convention), then for each ATTENDING event an italic dress-code
// line (EMAIL_EVENT_DRESS — never shown for a declined event) followed, on
// Saturday acceptances only, by the italic dinner line — dress before
// dinner, per the Design spec. `isFirst` drops the divider/spacing (and the
// dm-divider dark-mode class) the 2nd-and-later people get — see the Design
// spec's per-person divider rule.
function buildEmailPersonHtml(person, isFirst) {
  var events = person.events || {};
  var wrapClass = isFirst ? '' : 'dm-divider';
  var wrapStyle = isFirst ? '' : 'border-top:1px solid #CFD0CC;padding-top:18px;margin-top:18px;';
  var html = '<div class="' + wrapClass + '" style="' + wrapStyle + '">' +
    '<div class="dm-label" style="font-size:12px;text-transform:uppercase;letter-spacing:.14em;font-weight:bold;color:#1a3a2e;' +
    'font-family:\'Helvetica Neue\',Helvetica,Arial,sans-serif;margin:0 0 10px;">' +
    escapeHtml(person.name || '') + '</div>';

  EVENT_KEYS.forEach(function (key) {
    if (events[key] !== 'yes' && events[key] !== 'no') { return; } // not invited
    var attending = events[key] === 'yes';
    html += buildEmailEventRowHtml(key, attending);

    if (attending) {
      html += '<div class="dm-meal" style="font-size:13px;font-style:italic;color:#708279;margin:0 0 4px;' +
        'font-family:Georgia,\'Times New Roman\',serif;">Dress: ' + EMAIL_EVENT_DRESS[key] + '</div>';
    }

    if (key === 'saturday' && attending && person.meal) {
      // "Kosher " + SHORT name, not the full menu description — matches the
      // front end's kosher-summary rule (js/rsvp-flow.js, mealShortLabelFor,
      // Section F, July 2026): "Kosher Branzino," never "Kosher Pan-Seared
      // Herb Branzino." Non-kosher selections get the full name. MEAL_NAMES
      // and MEAL_SHORT_NAMES are unchanged by this rewrite.
      var mealText = person.mealKosher
        ? ('Kosher ' + (MEAL_SHORT_NAMES[person.meal] || person.meal))
        : (MEAL_NAMES[person.meal] || person.meal);
      html += '<div class="dm-meal" style="font-size:13px;font-style:italic;color:#708279;margin:0 0 4px;' +
        'font-family:Georgia,\'Times New Roman\',serif;">Dinner Choice: ' + escapeHtml(mealText) + '</div>';
    }
  });

  return html + '</div>';
}

function sendConfirmationEmail(email, people, message) {
  var cardHtml = people.map(function (person, idx) {
    return buildEmailPersonHtml(person, idx === 0);
  }).join('');

  if (message) {
    cardHtml += '<div class="dm-divider" style="border-top:1px solid #CFD0CC;padding-top:16px;margin-top:20px;">' +
      '<div class="dm-label" style="font-size:9px;text-transform:uppercase;letter-spacing:.18em;font-weight:bold;color:#86948C;' +
      'font-family:\'Helvetica Neue\',Helvetica,Arial,sans-serif;margin:0 0 6px;">Your note</div>' +
      '<div class="dm-note" style="font-size:14px;color:#3A554A;font-family:Georgia,\'Times New Roman\',serif;line-height:1.6;">' +
      escapeHtml(message) + '</div></div>';
  }

  // Dark-mode overrides ONLY — no base styles live here (see the
  // function-level comment above). Every selector also has an inline
  // fallback value on its element above, so a client that strips this block
  // (Outlook desktop) or doesn't honor prefers-color-scheme (Gmail's own
  // apps) just keeps the light design, unaffected. Palette matches the
  // site's own dark surface: page/panel background #122a20, card background
  // #0e2319 (darker than the page, same "card sits on a darker surface than
  // the body" convention the site's nav diamond uses), primary ink #F1EDEA.
  // The accent green (#2d5a4a in light mode) becomes #8FC4AC for dark-mode
  // status text and the link — the site's literal accent hex has too little
  // contrast against #122a20 to read reliably as standalone always-visible
  // text (unlike its brief use as a nav-hover color on the site).
  var darkModeCss = ':root{color-scheme:light dark;}' +
    '@media (prefers-color-scheme: dark) {' +
    '.dm-body{background-color:#122a20!important;}' +
    '.dm-panel{background-color:#122a20!important;}' +
    '.dm-card{background-color:#0e2319!important;border-color:#3C5A4C!important;}' +
    '.dm-rule{border-color:#3C5A4C!important;}' +
    '.dm-divider{border-color:#2A4436!important;}' +
    '.dm-ink{color:#F1EDEA!important;}' +
    '.dm-body-copy{color:#D6DED8!important;}' +
    '.dm-label{color:#9DAFA4!important;}' +
    '.dm-event{color:#C6D2CA!important;}' +
    '.dm-yes{color:#8FC4AC!important;}' +
    '.dm-no{color:#7C8B83!important;}' +
    '.dm-meal{color:#9DAFA4!important;}' +
    '.dm-note{color:#D6DED8!important;}' +
    '.dm-link{color:#8FC4AC!important;}' +
    '.dm-mono-light{display:none!important;width:0!important;max-height:0!important;overflow:hidden!important;}' +
    '.dm-mono-dark{display:block!important;width:74px!important;max-height:none!important;overflow:visible!important;}' +
    '}';

  var htmlBody = '<html><head>' +
    '<meta name="color-scheme" content="light dark">' +
    '<meta name="supported-color-schemes" content="light dark">' +
    '<style>' + darkModeCss + '</style>' +
    '</head><body class="dm-body" style="margin:0;padding:0;background-color:#F1EDEA;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="dm-body" style="background-color:#F1EDEA;">' +
    '<tr><td align="center">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="dm-panel" style="width:600px;max-width:600px;">' +
    '<tr><td style="padding:40px 42px 34px;">' +

    '<img class="dm-mono-light" src="https://www.adinaandrew2026.com/assets/monogram/monogram-green.png" alt="Adina &amp; Andrew" width="74" ' +
    'style="display:block;margin:0 auto;width:74px;height:auto;border:0;">' +
    '<img class="dm-mono-dark" src="https://www.adinaandrew2026.com/assets/monogram/monogram-white.png" alt="Adina &amp; Andrew" width="74" ' +
    'style="display:none;width:0;max-height:0;overflow:hidden;mso-hide:all;margin:0 auto;height:auto;border:0;">' +
    '<div class="dm-rule" style="border-top:1px solid #B5BBB5;margin-top:26px;font-size:0;line-height:0;">&nbsp;</div>' +

    '<p class="dm-ink" style="margin:30px 0 0;font-size:17px;color:#1a3a2e;font-family:Georgia,\'Times New Roman\',serif;">' +
    'Dear ' + escapeHtml(peopleNames(people)) + ',</p>' +
    '<p class="dm-body-copy" style="margin:12px 0 0;font-size:15px;color:#385348;font-family:Georgia,\'Times New Roman\',serif;line-height:1.65;">' +
    'Your RSVP is in — thank you. Here are your responses:</p>' +

    '<div class="dm-card" style="margin-top:24px;background-color:#F1EDEA;border:1px solid #909C95;padding:24px 24px 20px;">' +
    cardHtml + '</div>' +

    '<p class="dm-body-copy" style="margin:26px 0 0;font-size:14px;color:#385348;font-family:Georgia,\'Times New Roman\',serif;line-height:1.7;">' +
    'If you need to change or update anything, just go back to the ' +
    '<a class="dm-link" href="https://www.adinaandrew2026.com/rsvp" style="color:#2d5a4a;text-decoration:underline;">RSVP page</a>, ' +
    'enter your email, and press &ldquo;Edit Your RSVP&rdquo; at the bottom of the page.</p>' +

    '<p class="dm-ink" style="margin:18px 0 0;font-size:15px;color:#1a3a2e;font-family:Georgia,\'Times New Roman\',serif;">' +
    'We can&rsquo;t wait to celebrate with you!</p>' +
    '<p class="dm-ink" style="margin:20px 0 0;font-size:15px;color:#1a3a2e;font-family:Georgia,\'Times New Roman\',serif;line-height:1.7;">' +
    'With love,<br>Adina &amp; Andrew</p>' +

    '</td></tr></table>' +
    '</td></tr></table>' +
    '</body></html>';

  var plainBody = 'Dear ' + peopleNames(people) + ',\n' +
    'Your RSVP is in — thank you. Here are your responses:\n';

  people.forEach(function (person) {
    var events = person.events || {};
    plainBody += '\n' + (person.name || '') + '\n';
    EVENT_KEYS.forEach(function (key) {
      if (events[key] !== 'yes' && events[key] !== 'no') { return; } // not invited
      var attending = events[key] === 'yes';
      plainBody += '  ' + EMAIL_EVENT_LABELS[key] + ': ' + (attending ? 'Attending' : 'Not attending') + '\n';
      if (attending) {
        plainBody += '    Dress: ' + EMAIL_EVENT_DRESS[key] + '\n';
      }
      if (key === 'saturday' && attending && person.meal) {
        var mealText = person.mealKosher
          ? ('Kosher ' + (MEAL_SHORT_NAMES[person.meal] || person.meal))
          : (MEAL_NAMES[person.meal] || person.meal);
        plainBody += '    Dinner Choice: ' + mealText + '\n';
      }
    });
  });

  if (message) {
    plainBody += '\nYour note: ' + message + '\n';
  }

  plainBody += '\nIf you need to change or update anything, just go back to the RSVP page\n' +
    '(https://www.adinaandrew2026.com/rsvp), enter your email, and press "Edit\n' +
    'Your RSVP" at the bottom of the page.\n\n' +
    "We can't wait to celebrate with you!\n\n" +
    'With love,\nAdina & Andrew';

  MailApp.sendEmail({
    to: email,
    name: 'Adina & Andrew',
    subject: 'Your RSVP — Adina & Andrew',
    body: plainBody,
    htmlBody: htmlBody
  });
}

function peopleNames(people) {
  var names = people.map(function (p) { return p.name || ''; }).filter(String);
  if (names.length <= 1) { return names[0] || 'friend'; }
  return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
}

function escapeHtml(s) {
  return (s + '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================================================================
// Test helpers — run from the Apps Script editor
// ============================================================================
function testLookup() {
  var result = doGet({ parameter: { action: 'lookup', q: 'smith@' } });
  Logger.log(result.getContent());
}

function testDoPost() {
  var testData = {
    email: 'test@example.com',
    people: [
      {
        name: 'Test Guest',
        events: { friday: 'yes', saturday: 'yes', sunday: 'no' },
        meal: 'branzino',
        mealKosher: true
      },
      {
        name: 'Plus One',
        events: { friday: 'no', saturday: 'yes', sunday: 'no' },
        meal: 'cauliflower',
        mealKosher: false
      }
    ],
    message: "Can't wait!"
  };
  var result = doPost({ postData: { contents: JSON.stringify(testData) } });
  Logger.log(result.getContent());
}
