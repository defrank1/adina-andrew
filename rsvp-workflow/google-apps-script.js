// Google Apps Script for the Wedding RSVP card flow (rsvp.html + js/rsvp-flow.js)
//
// ============================================================================
// SPREADSHEET LAYOUT (create these two tabs in one Google Sheet)
// ============================================================================
//
// Tab "Guests" — the invitation list, filled in manually by Andrew:
//   Email | Names | Friday | Saturday | Sunday
//   - Email:  the address the invitation was sent to (one row per invitation)
//   - Names:  ";"-separated names covered by that invitation (1–2 people),
//             e.g.  "Robert Johnson; Patricia Johnson"
//   - Friday / Saturday / Sunday:  TRUE/FALSE (checkboxes work) or "yes"/blank
//             for whether that invitation includes the event
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
// PRIVACY CAVEAT (accepted tradeoff, restated honestly): with access set to
// "Anyone", the lookup endpoint can technically be queried by anyone who finds
// the URL — so guest emails/names are only as private as that URL plus the
// RSVP password gate on the site. The client only queries after the guest has
// typed past the "@" of their own email, but the server itself does a plain
// substring match. This is the same tradeoff as the original design.
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
var MEAL_NAMES = {
  branzino: 'Branzino',
  chicken: 'Chicken',
  cauliflower: 'Cauliflower Steak'
};

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// GET  ?action=lookup&q=<term>
// Case-insensitive substring match against Guests.Email. Returns
// [{ email, invitedTo: ['friday', ...], people: ['Name', ...] }]
// (The client already enforces "typed past the @" before querying; the server
// just matches.)
// ============================================================================
function doGet(e) {
  try {
    var action = e && e.parameter && e.parameter.action;
    if (action !== 'lookup') {
      return jsonResponse({ status: 'error', message: 'Unknown action' });
    }

    var q = ((e.parameter.q || '') + '').trim().toLowerCase();
    if (!q) { return jsonResponse([]); }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GUESTS_SHEET);
    if (!sheet) {
      return jsonResponse({ status: 'error', message: 'Guests sheet not found' });
    }

    var rows = sheet.getDataRange().getValues();
    var results = [];

    // Row 0 is the header (Email | Names | Friday | Saturday | Sunday).
    for (var i = 1; i < rows.length; i++) {
      var email = (rows[i][0] + '').trim();
      if (!email || email.toLowerCase().indexOf(q) === -1) { continue; }

      var people = (rows[i][1] + '').split(';')
        .map(function (name) { return name.trim(); })
        .filter(function (name) { return name.length > 0; });

      var invitedTo = [];
      for (var c = 0; c < EVENT_KEYS.length; c++) {
        if (isInvited(rows[i][2 + c])) { invitedTo.push(EVENT_KEYS[c]); }
      }

      results.push({ email: email, invitedTo: invitedTo, people: people });
    }

    return jsonResponse(results);
  } catch (error) {
    return jsonResponse({ status: 'error', message: error.toString() });
  }
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
// acceptances.
// ============================================================================
function sendConfirmationEmail(email, people, message) {
  var htmlBody = '<html><head><style>' +
    "body { font-family: 'Sentient', Georgia, 'Baskerville', serif; color: #1a3a2e; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; }" +
    '.header { text-align: center; padding: 30px 0; border-bottom: 2px solid #1a3a2e; }' +
    ".header h1 { font-family: 'PP Playground', 'Brush Script MT', cursive; font-size: 32px; margin: 0; color: #1a3a2e; }" +
    '.content { background-color: #faf9f6; padding: 25px; border-left: 4px solid #1a3a2e; margin: 20px 0; }' +
    ".person-name { font-family: 'PP Watch', 'Helvetica Neue', Arial, sans-serif; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; font-size: 13px; margin: 18px 0 8px; color: #1a3a2e; }" +
    '.person-name:first-child { margin-top: 0; }' +
    '.event-item { padding: 5px 0; }' +
    '.attending { color: #2d5a4a; font-weight: bold; }' +
    '.not-attending { color: #888; }' +
    '.meal { color: #1a3a2e; }' +
    '.footer { margin-top: 30px; padding-top: 20px; border-top: 2px solid #1a3a2e; text-align: center; color: #666; font-size: 14px; }' +
    '</style></head><body>' +
    '<div class="header"><h1>Adina &amp; Andrew</h1>' +
    "<p style=\"margin: 10px 0 0; font-size: 14px; letter-spacing: 2px; font-family: 'PP Watch', 'Helvetica Neue', Arial, sans-serif;\">October 17, 2026 &bull; Washington, DC</p></div>" +
    '<p style="margin: 30px 0 20px; font-size: 18px;">Dear ' + escapeHtml(peopleNames(people)) + ',</p>' +
    "<p>Thank you for submitting your RSVP! We're so excited to celebrate with you.</p>" +
    '<div class="content">';

  var plainBody = 'Dear ' + peopleNames(people) + ',\n\n' +
    "Thank you for submitting your RSVP for Adina & Andrew's wedding on October 17, 2026 in Washington, DC!\n\n" +
    "Here's a summary of your response:\n";

  people.forEach(function (person) {
    var events = person.events || {};
    htmlBody += '<div class="person-name">' + escapeHtml(person.name || '') + '</div>';
    plainBody += '\n' + (person.name || '') + '\n';

    EVENT_KEYS.forEach(function (key) {
      if (events[key] !== 'yes' && events[key] !== 'no') { return; } // not invited
      var attending = events[key] === 'yes';
      htmlBody += '<div class="event-item">' + EVENT_NAMES[key] + ': ' +
        '<span class="' + (attending ? 'attending' : 'not-attending') + '">' +
        (attending ? '&#10003; Attending' : 'Not attending') + '</span></div>';
      plainBody += '  ' + EVENT_NAMES[key] + ': ' + (attending ? 'Attending' : 'Not attending') + '\n';

      if (key === 'saturday' && attending && person.meal) {
        // "Kosher " prefix, not "(Kosher)" suffix — matches the front end's
        // plain-text "Kosher Branzino" style (js/rsvp-flow.js buildSummaryInto,
        // July 2026). NOT deployed yet (APPS_SCRIPT_URL is empty in
        // js/rsvp-flow.js) — the live copy must be manually redeployed to
        // pick this up once it goes live.
        var mealText = (person.mealKosher ? 'Kosher ' : '') + (MEAL_NAMES[person.meal] || person.meal);
        htmlBody += '<div class="event-item meal">Dinner: ' + escapeHtml(mealText) + '</div>';
        plainBody += '  Dinner: ' + mealText + '\n';
      }
    });
  });

  if (message) {
    htmlBody += '<div style="margin-top: 20px;"><strong>Your note:</strong>' +
      '<div style="margin-top: 8px;">' + escapeHtml(message) + '</div></div>';
    plainBody += '\nYour note: ' + message + '\n';
  }

  htmlBody += '</div>' +
    '<p>If you need to make any changes to your RSVP, just submit it again — or contact us directly.</p>' +
    "<p style=\"margin-top: 30px;\">We can't wait to celebrate with you!<br><br>Love,<br>Adina &amp; Andrew</p>" +
    '<div class="footer">This is an automated confirmation email for your RSVP.</div>' +
    '</body></html>';

  plainBody += '\nIf you need to make any changes to your RSVP, just submit it again — or contact us directly.\n\n' +
    "We can't wait to celebrate with you!\n\nLove,\nAdina & Andrew";

  MailApp.sendEmail({
    to: email,
    subject: "RSVP Confirmation - Adina & Andrew's Wedding",
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
