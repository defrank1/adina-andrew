# Demo Checklist for Laura Nelson

Print this out or keep it open during your demo!

## ☐ Pre-Demo Setup (Do This First!)

### Google Sheets Setup
- [ ] Create new Google Sheet at sheets.google.com
- [ ] Name it "Wedding RSVPs"
- [ ] Go to Extensions > Apps Script
- [ ] Copy code from `google-apps-script.js` file
- [ ] Paste into Apps Script editor and save
- [ ] Deploy as Web App (Execute as: Me, Access: Anyone)
- [ ] Copy the Web App URL

### Website Setup
- [ ] Open `rsvp-script.js` in text editor
- [ ] Find line 235 with `GOOGLE_SCRIPT_URL`
- [ ] Replace with your actual Web App URL
- [ ] Save the file

### GitHub Deployment
- [ ] Run: `git add .`
- [ ] Run: `git commit -m "Update Google Sheets URL"`
- [ ] Run: `git push origin main`
- [ ] Go to GitHub repo settings
- [ ] Enable GitHub Pages (Settings > Pages > main branch)
- [ ] Wait 2-3 minutes for deployment
- [ ] Test the URL: https://defrank1.github.io/dummy-wedding/rsvp.html

---

## ☐ During Demo With Laura

### Show the Website
- [ ] Send her the link: https://defrank1.github.io/dummy-wedding/rsvp.html
- [ ] Or share your screen

### Walk Her Through RSVP
- [ ] Type "Laura" in search box
- [ ] Click "Laura Nelson"
- [ ] Enter email address
- [ ] RSVP to Friday event: "Joyfully accepts"
- [ ] RSVP to Saturday event: "Joyfully accepts"
- [ ] RSVP to Sunday event: "Joyfully accepts"
- [ ] Select number of guests (1 or 2)
- [ ] (Optional) Add dietary restrictions
- [ ] (Optional) Add song request
- [ ] (Optional) Add message
- [ ] Click "Submit RSVP"
- [ ] Confirm "Thank You" message appears

### Show the Google Sheet
- [ ] Open your Google Sheet
- [ ] Refresh the page
- [ ] Point out her RSVP data in the row
- [ ] Show all the columns (timestamp, name, email, events, etc.)

### Explain the System
- [ ] Each guest searches their name
- [ ] Only invited events show up for each guest
- [ ] Responses save automatically to this sheet
- [ ] You can see all RSVPs in real-time
- [ ] Easy to export, filter, and use for planning

---

## ☐ After Demo

### Optional Cleanup
- [ ] Delete test row from Google Sheet
- [ ] Laura can submit real RSVP later if needed

### Next Steps
- [ ] Add all wedding guests to `guests.js`
- [ ] Update website content (dates, venues, etc.)
- [ ] Send RSVP links to guests
- [ ] Monitor responses!

---

## 🆘 Emergency Troubleshooting

**Nothing happens when clicking Submit:**
- Check: Did you update the Google Script URL?
- Check: Is GitHub Pages enabled?
- Try: Opening browser console (F12) to see errors

**Laura's name doesn't appear:**
- Check: Did you push latest code to GitHub?
- Try: Wait 2-3 minutes and refresh page
- Check: guests.js has "Laura Nelson" entry

**Data not in Google Sheets:**
- Check: Apps Script deployed with "Anyone" access
- Try: Run test function in Apps Script editor
- Check: URL ends with `/exec` not `/dev`

---

## 📱 Share This Link With Laura

```
https://defrank1.github.io/dummy-wedding/rsvp.html
```

---

Good luck with the demo! 🎉
