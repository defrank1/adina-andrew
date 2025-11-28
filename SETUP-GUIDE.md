# Wedding Website RSVP Setup Guide

This guide will walk you through setting up your wedding website with a working RSVP form that saves responses to Google Sheets.

## What You'll Need
- A Google account
- A GitHub account (you already have the repo set up)
- GitHub Pages (free hosting)

---

## Step 1: Set Up Google Sheets

1. **Create a new Google Sheet**
   - Go to [Google Sheets](https://sheets.google.com)
   - Click "Blank" to create a new spreadsheet
   - Name it something like "Wedding RSVPs"
   - You can leave it empty - the script will automatically create headers

2. **Open Apps Script**
   - In your Google Sheet, click **Extensions** > **Apps Script**
   - You'll see a code editor with some default code

3. **Add the Script**
   - Delete any default code in the editor
   - Open the file `google-apps-script.js` from your wedding-website folder
   - Copy ALL the code from that file
   - Paste it into the Apps Script editor
   - Click the save icon (💾) or press Ctrl+S (Cmd+S on Mac)
   - Name your project something like "Wedding RSVP Handler"

4. **Deploy the Script**
   - Click **Deploy** > **New deployment**
   - Click the gear icon (⚙️) next to "Select type"
   - Choose **Web app**
   - Fill in the settings:
     - **Description**: "Wedding RSVP Form Handler"
     - **Execute as**: Me (your email)
     - **Who has access**: Anyone
   - Click **Deploy**
   - You may need to authorize the script:
     - Click **Authorize access**
     - Choose your Google account
     - Click **Advanced** > **Go to [project name] (unsafe)**
     - Click **Allow**
   - **IMPORTANT**: Copy the **Web app URL** that appears
     - It will look like: `https://script.google.com/macros/s/AKfycby.../exec`
     - Save this URL - you'll need it in the next step!

---

## Step 2: Connect Your Website to Google Sheets

1. **Update the RSVP Script**
   - Open `rsvp-script.js` in your wedding-website folder
   - Find line 235 where it says:
     ```javascript
     const GOOGLE_SCRIPT_URL = 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE';
     ```
   - Replace `'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE'` with your actual Web App URL from Step 1
   - Example:
     ```javascript
     const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby.../exec';
     ```
   - Save the file

---

## Step 3: Deploy Your Website to GitHub Pages

1. **Commit and Push Your Changes**
   - Open Terminal/Command Prompt
   - Navigate to your wedding-website folder:
     ```bash
     cd /Users/andrewdefrank/Desktop/wedding-website
     ```
   - Run these commands:
     ```bash
     git add .
     git commit -m "Connect RSVP form to Google Sheets"
     git push origin main
     ```

2. **Enable GitHub Pages**
   - Go to your GitHub repository: https://github.com/defrank1/dummy-wedding
   - Click **Settings** (top right)
   - Click **Pages** (left sidebar)
   - Under "Source", select **main** branch
   - Click **Save**
   - Wait a minute, then refresh the page
   - You'll see a message: "Your site is live at https://defrank1.github.io/dummy-wedding/"

---

## Step 4: Test the RSVP Form

1. **Visit Your Website**
   - Go to: https://defrank1.github.io/dummy-wedding/rsvp.html

2. **Test as Laura Nelson**
   - In the search box, type "Laura"
   - Click "Laura Nelson" when it appears
   - Fill in an email address
   - Select responses for all three events:
     - Friday Welcome Drinks: Joyfully accepts
     - Saturday Wedding: Joyfully accepts
     - Sunday Brunch: Joyfully accepts
   - Fill in "Number of Guests" (she can bring up to 2)
   - Optionally add dietary restrictions, song request, or message
   - Click **Submit RSVP**

3. **Check Google Sheets**
   - Go back to your Google Sheet
   - Refresh the page
   - You should see Laura's RSVP data in a new row!

---

## Step 5: Share the Link

**Send this link to Laura:**
```
https://defrank1.github.io/dummy-wedding/rsvp.html
```

She should:
1. Type her name "Laura Nelson" in the search box
2. Click her name when it appears
3. Fill out the form for all three events
4. Submit

You can then show her the Google Sheet with her responses!

---

## Adding More Guests

To add more guests to the RSVP list:

1. Open `guests.js`
2. Add new guest objects following this format:
   ```javascript
   {
       id: 8,
       name: "Guest Name",
       email: "", // Optional pre-filled email
       invitedTo: ["friday", "saturday", "sunday"], // or just some events
       maxGuests: 2, // How many can they bring
       notes: "" // Internal notes (not shown to guest)
   }
   ```
3. Save, commit, and push to GitHub
4. GitHub Pages will automatically update in a few minutes

---

## Viewing Your RSVP Responses

Your Google Sheet will show all RSVPs with these columns:
- Timestamp
- Guest Name
- Email
- Friday Welcome Drinks (yes/no/not invited)
- Saturday Wedding (yes/no/not invited)
- Sunday Brunch (yes/no/not invited)
- Number of Guests
- Dietary Restrictions
- Song Request
- Additional Message

You can sort, filter, and analyze the data just like any spreadsheet!

---

## Troubleshooting

**If RSVPs aren't showing up in Google Sheets:**

1. Check that you copied the correct Web App URL
2. Make sure the URL ends with `/exec` (not `/dev`)
3. Verify the script is deployed with "Who has access: Anyone"
4. Check the browser console for errors (F12 > Console tab)
5. Try the test function in Apps Script:
   - Go to Apps Script editor
   - Select `testDoPost` from the function dropdown
   - Click Run (▶️)
   - Check your sheet for a test entry

**If guests can't find their name:**

1. Make sure they're added to `guests.js`
2. Check spelling matches exactly
3. Verify you've pushed changes to GitHub
4. Wait a few minutes for GitHub Pages to update

---

## Next Steps

After testing with Laura:

1. Remove test entries from your Google Sheet
2. Add all your real guests to `guests.js`
3. Update placeholder text (venue addresses, dates, etc.)
4. Add your own domain (optional) in GitHub Pages settings
5. Send RSVP links to your guests!

---

## Support

If you run into issues, check:
- GitHub repository: https://github.com/defrank1/dummy-wedding
- Google Apps Script documentation: https://developers.google.com/apps-script
- GitHub Pages documentation: https://docs.github.com/pages
