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
