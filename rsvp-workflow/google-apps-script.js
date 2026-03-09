// Google Apps Script for Wedding RSVP Form
//
// SETUP INSTRUCTIONS:
// 1. Create a new Google Sheet (this will store your RSVP responses)
// 2. Go to Extensions > Apps Script
// 3. Delete any default code and paste this entire file
// 4. Click "Deploy" > "New deployment"
// 5. Select type: "Web app"
// 6. Set "Execute as": Me
// 7. Set "Who has access": Anyone
// 8. Click "Deploy" and copy the Web App URL
// 9. Paste that URL into rsvp-script.js where it says 'YOUR_GOOGLE_APPS_SCRIPT_URL'

function doPost(e) {
  try {
    // Parse the incoming JSON data
    const data = JSON.parse(e.postData.contents);

    // Get the active spreadsheet
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // If this is the first submission, add headers
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Timestamp',
        'Guest Name',
        'Email',
        'Friday Welcome Drinks',
        'Saturday Wedding',
        'Sunday Brunch',
        'Number of Guests',
        'Dietary Restrictions',
        'Song Request',
        'Additional Message'
      ]);

      // Format header row
      const headerRange = sheet.getRange(1, 1, 1, 10);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#4a5568');
      headerRange.setFontColor('#ffffff');
    }

    // Prepare the row data
    const timestamp = new Date();
    const guestName = data.guestName || '';
    const email = data.email || '';
    const fridayResponse = data.events?.friday || 'not invited';
    const saturdayResponse = data.events?.saturday || 'not invited';
    const sundayResponse = data.events?.sunday || 'not invited';
    const guestCount = data.guestCount || '';
    const dietary = data.dietary || '';
    const songRequest = data.songRequest || '';
    const message = data.message || '';

    // Append the new row
    sheet.appendRow([
      timestamp,
      guestName,
      email,
      fridayResponse,
      saturdayResponse,
      sundayResponse,
      guestCount,
      dietary,
      songRequest,
      message
    ]);

    // Auto-resize columns for better readability
    sheet.autoResizeColumns(1, 10);

    // Send confirmation email if email address provided
    if (email) {
      sendConfirmationEmail(guestName, email, data.events, guestCount, dietary, songRequest, message);
    }

    // Return success response
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'success',
        message: 'RSVP received successfully'
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    // Return error response
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'error',
        message: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Send confirmation email to guest
function sendConfirmationEmail(guestName, email, events, guestCount, dietary, songRequest, message) {
  // Build HTML email body
  let htmlBody = `
    <html>
      <head>
        <style>
          body {
            font-family: 'Sentient', 'Georgia', 'Baskerville', serif;
            color: #1a3a2e;
            line-height: 1.6;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            text-align: center;
            padding: 30px 0;
            border-bottom: 2px solid #1a3a2e;
          }
          .header h1 {
            font-family: 'PP Playground', 'Brush Script MT', cursive;
            font-size: 32px;
            margin: 0;
            color: #1a3a2e;
          }
          .greeting {
            margin: 30px 0 20px;
            font-size: 18px;
          }
          .content {
            background-color: #faf9f6;
            padding: 25px;
            border-left: 4px solid #1a3a2e;
            margin: 20px 0;
          }
          .section-title {
            font-family: 'PP Watch', 'Helvetica Neue', Arial, sans-serif;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-size: 14px;
            margin-bottom: 15px;
            color: #1a3a2e;
          }
          .event-item {
            padding: 10px 0;
            border-bottom: 1px solid #e0e0e0;
          }
          .event-item:last-child {
            border-bottom: none;
          }
          .event-name {
            font-weight: 500;
            margin-right: 10px;
          }
          .attending {
            color: #2d5a4a;
            font-weight: bold;
          }
          .not-attending {
            color: #888;
          }
          .detail-row {
            padding: 8px 0;
          }
          .detail-label {
            font-weight: 500;
            margin-right: 8px;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #1a3a2e;
            text-align: center;
            color: #666;
            font-size: 14px;
          }
          .signature {
            margin-top: 30px;
            font-style: italic;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Adina & Andrew</h1>
          <p style="margin: 10px 0 0; font-size: 14px; letter-spacing: 2px; font-family: 'PP Watch', 'Helvetica Neue', Arial, sans-serif;">October 17, 2026 • Washington, DC</p>
        </div>

        <p class="greeting">Dear ${guestName},</p>

        <p>Thank you for submitting your RSVP! We're so excited to celebrate with you.</p>

        <div class="content">
          <div class="section-title">Your RSVP Summary</div>`;

  // Event attendance
  if (events.friday) {
    const isAttending = events.friday === 'yes';
    htmlBody += `
          <div class="event-item">
            <span class="event-name">Friday Welcome Drinks:</span>
            <span class="${isAttending ? 'attending' : 'not-attending'}">
              ${isAttending ? '✓ Attending' : 'Not attending'}
            </span>
          </div>`;
  }

  if (events.saturday) {
    const isAttending = events.saturday === 'yes';
    htmlBody += `
          <div class="event-item">
            <span class="event-name">Saturday Wedding:</span>
            <span class="${isAttending ? 'attending' : 'not-attending'}">
              ${isAttending ? '✓ Attending' : 'Not attending'}
            </span>
          </div>`;
  }

  if (events.sunday) {
    const isAttending = events.sunday === 'yes';
    htmlBody += `
          <div class="event-item">
            <span class="event-name">Sunday Brunch:</span>
            <span class="${isAttending ? 'attending' : 'not-attending'}">
              ${isAttending ? '✓ Attending' : 'Not attending'}
            </span>
          </div>`;
  }

  // Additional details
  const attendingAny = Object.values(events).includes('yes');
  if (attendingAny && guestCount) {
    htmlBody += `
          <div class="detail-row" style="margin-top: 20px;">
            <span class="detail-label">Number of guests:</span>
            <span>${guestCount}</span>
          </div>`;

    if (dietary) {
      htmlBody += `
          <div class="detail-row">
            <span class="detail-label">Dietary restrictions:</span>
            <span>${dietary}</span>
          </div>`;
    }

    if (songRequest) {
      htmlBody += `
          <div class="detail-row">
            <span class="detail-label">Song request:</span>
            <span>${songRequest}</span>
          </div>`;
    }
  }

  if (message) {
    htmlBody += `
          <div class="detail-row" style="margin-top: 20px;">
            <span class="detail-label">Your message:</span>
            <div style="margin-top: 8px; font-style: italic;">${message}</div>
          </div>`;
  }

  htmlBody += `
        </div>

        <p>If you need to make any changes to your RSVP, please contact us directly.</p>

        <p class="signature">We can't wait to celebrate with you!<br><br>Love,<br>Adina & Andrew</p>

        <div class="footer">
          This is an automated confirmation email for your RSVP.
        </div>
      </body>
    </html>`;

  // Plain text version for email clients that don't support HTML
  let plainTextBody = `Dear ${guestName},\n\n`;
  plainTextBody += `Thank you for submitting your RSVP for Adina & Andrew's wedding on October 17, 2026 in Washington, DC!\n\n`;
  plainTextBody += `Here's a summary of your response:\n\n`;

  if (events.friday) {
    const status = events.friday === 'yes' ? '✓ Attending' : '✗ Not attending';
    plainTextBody += `Friday Welcome Drinks: ${status}\n`;
  }
  if (events.saturday) {
    const status = events.saturday === 'yes' ? '✓ Attending' : '✗ Not attending';
    plainTextBody += `Saturday Wedding: ${status}\n`;
  }
  if (events.sunday) {
    const status = events.sunday === 'yes' ? '✓ Attending' : '✗ Not attending';
    plainTextBody += `Sunday Brunch: ${status}\n`;
  }

  if (attendingAny && guestCount) {
    plainTextBody += `\nNumber of guests: ${guestCount}\n`;
    if (dietary) plainTextBody += `Dietary restrictions: ${dietary}\n`;
    if (songRequest) plainTextBody += `Song request: ${songRequest}\n`;
  }

  if (message) plainTextBody += `\nYour message: ${message}\n`;

  plainTextBody += `\nIf you need to make any changes to your RSVP, please contact us directly.\n\n`;
  plainTextBody += `We can't wait to celebrate with you!\n\nLove,\nAdina & Andrew`;

  // Send the email with both HTML and plain text
  MailApp.sendEmail({
    to: email,
    subject: 'RSVP Confirmation - Adina & Andrew\'s Wedding',
    body: plainTextBody,
    htmlBody: htmlBody
  });
}

// Test function to verify the script works
function testDoPost() {
  const testData = {
    guestName: "Test Guest",
    email: "test@example.com",
    events: {
      friday: "yes",
      saturday: "yes",
      sunday: "no"
    },
    guestCount: "2",
    dietary: "Vegetarian",
    songRequest: "Happy by Pharrell Williams",
    message: "Can't wait!"
  };

  const e = {
    postData: {
      contents: JSON.stringify(testData)
    }
  };

  const result = doPost(e);
  Logger.log(result.getContent());
}
