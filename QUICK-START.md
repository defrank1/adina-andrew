# Quick Start Guide - Demo for Laura

Follow these steps to demonstrate the RSVP system to Laura Nelson.

## Before You Meet With Laura

### 1. Set Up Google Sheets (5 minutes)

1. Go to https://sheets.google.com and create a new blank spreadsheet
2. Name it "Wedding RSVPs"
3. Click **Extensions** > **Apps Script**
4. Delete the default code
5. Copy ALL the code from [google-apps-script.js](google-apps-script.js)
6. Paste it into the Apps Script editor and save
7. Click **Deploy** > **New deployment** > Select **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
8. Click **Deploy** and authorize if needed
9. **COPY THE WEB APP URL** (looks like `https://script.google.com/macros/s/AKfycby.../exec`)

### 2. Connect Your Website (2 minutes)

1. Open [rsvp-script.js](rsvp-script.js) in a text editor
2. Find line 235: `const GOOGLE_SCRIPT_URL = 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE';`
3. Replace with your actual URL:
   ```javascript
   const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_ACTUAL_URL/exec';
   ```
4. Save the file

### 3. Deploy to GitHub Pages (3 minutes)

```bash
# In Terminal/Command Prompt:
cd /Users/andrewdefrank/Desktop/wedding-website
git add .
git commit -m "Update Google Sheets URL"
git push origin main
```

Then on GitHub:
1. Go to https://github.com/defrank1/dummy-wedding
2. Click **Settings** > **Pages**
3. Under "Source", select **main** branch
4. Click **Save**
5. Wait 2-3 minutes for deployment

---

## During the Demo With Laura

### Step 1: Show Her the Website

Send her this link (or show it on your screen):
```
https://defrank1.github.io/dummy-wedding/rsvp.html
```

### Step 2: Have Her Fill Out the RSVP

1. **Search for her name**: Type "Laura" in the search box
2. **Select her name**: Click "Laura Nelson" when it appears
3. **Enter email**: She can use her real email address
4. **RSVP to all three events**:
   - Friday Welcome Drinks: Select "Joyfully accepts"
   - Saturday Wedding: Select "Joyfully accepts"
   - Sunday Brunch: Select "Joyfully accepts"
5. **Number of guests**: Select 1 or 2 (she can bring +1)
6. **Optional fields**:
   - Dietary restrictions (e.g., "Vegetarian", "Gluten-free")
   - Song request (e.g., "Dancing Queen - ABBA")
   - Additional message (e.g., "So excited!")
7. **Click "Submit RSVP"**
8. She should see a confirmation message

### Step 3: Show Her the Google Sheet

1. Open your Google Sheet (the one you created in setup)
2. Refresh the page if needed
3. **Point out the columns**:
   - Timestamp - when submitted
   - Guest Name - "Laura Nelson"
   - Email - her email address
   - Friday/Saturday/Sunday responses - "yes" for all three
   - Number of Guests - how many attending
   - Dietary Restrictions - what she entered
   - Song Request - her song choice
   - Additional Message - her message

### Step 4: Explain the System

Tell her:
- "Every guest will search for their name and fill out their RSVP"
- "Responses automatically save to this spreadsheet"
- "We can see RSVPs in real-time as they come in"
- "We can export this to Excel, share it, or use it for planning"
- "Each guest can only RSVP for the events they're invited to"

---

## After the Demo

If you want to clean up:
1. Delete the test row in Google Sheets
2. Laura can submit a real RSVP later if she wants

---

## Troubleshooting

**"Submit doesn't work"**
- Check that you updated the Google Script URL in rsvp-script.js
- Make sure the URL ends with `/exec` not `/dev`
- Verify GitHub Pages is enabled and deployed

**"Can't find Laura's name"**
- Check that you've pushed the latest code to GitHub
- Wait 2-3 minutes for GitHub Pages to update
- Try refreshing the RSVP page

**"Nothing appears in Google Sheets"**
- Check the Apps Script deployment settings (Anyone can access)
- Try running the test function in Apps Script
- Check browser console for errors (F12)

---

## What's Next?

After the demo, you can:
1. Add all your real wedding guests to [guests.js](guests.js)
2. Update the website content (dates, venues, etc.)
3. Send the RSVP link to guests
4. Monitor responses in your Google Sheet!

For detailed instructions, see [SETUP-GUIDE.md](SETUP-GUIDE.md)
