# Ramadan Genius 🌙 — রমজান জিনিয়াস

**Quiz Competition Platform — ফুলকুঁড়ি আশার ঝিঙ্গেফুল**

A free, static-site quiz competition for 800–1,000 students over 2 days, using Google Sheets as the backend.

---

## Features
- **Two categories**: Category A (Class 3–5) and Category B (Class 6–10)
- **Bilingual**: Bangla + English for every question and option
- **60 MCQs** per category with **20-second timer** per question
- **Opening countdown page** before quiz entry
- **Contest window lock**: only active between **7 Mar 2026, 10:00 AM** and **8 Mar 2026, 10:00 AM** (Asia/Dhaka)
- **Submission grace window**: 30 minutes (for participants who started before end time)
- **Auto submit retry**: exponential backoff + jitter
- Auto-advances when timer expires; also has a Next button
- Registration: Name, Class, School, Phone, Address, Father's Name, Mother's Name
- Resumes quiz on page refresh (localStorage)
- Retry button if submission fails
- Server-side scoring (answer key hidden from students)
- Suspicious entry flagging

---

## File Structure

```
Ramadan Genius/
├── index.html         ← Main quiz page (host this)
├── script.js          ← Quiz logic (host this)
├── questions.json     ← Questions for both categories (host this)
├── Code.gs            ← Google Apps Script backend (paste into Apps Script)
└── README.md          ← This file
```

---

## Setup Guide

### Step 1: Create the Google Sheet

1. Go to [Google Sheets](https://sheets.google.com) → **New Spreadsheet**
2. Name it: `Ramadan Genius Results`
3. Rename the first tab to: `Responses`
4. In **Row 1**, paste these headers:

```
serverReceivedAt | name | class | phone | school | address | father | mother | category | sessionId | startedAtClient | finishedAtClient | durationSecClient | score | answersJson | userAgent | flag
```

(Each header in its own column — A through Q)

---

### Step 2: Add the Apps Script Backend

1. In the Sheet: **Extensions → Apps Script**
2. Delete any default code
3. Copy the entire contents of `Code.gs` and paste it
4. Answer keys are already included for all 60 questions per category
5. **Change the SECRET** to a long random string (must match `script.js`)
6. Contest window is already set in code to:
   - Start: `2026-03-07T10:00:00+06:00`
   - End: `2026-03-08T10:00:00+06:00`
   - Grace submit end: `2026-03-08T10:30:00+06:00`

---

### Step 3: Deploy as Web App

1. In Apps Script editor → **Deploy → New deployment**
2. Type: **Web app**
3. Set:
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click **Deploy**, authorize permissions
5. **Copy the Web app URL**

---

### Step 4: Configure the Frontend

Open `script.js` and update these two lines:

```js
const APPS_SCRIPT_URL = "PASTE_YOUR_WEB_APP_URL_HERE";
const SECRET          = "CHANGE_THIS_TO_A_LONG_RANDOM_STRING";
```

Make sure `SECRET` matches exactly what you put in `Code.gs`.

---

### Step 5: Add Your 60 Questions Per Category

Edit `questions.json`. The format is:

```json
{
  "A": [
    {
      "id": "a01",
      "q_bn": "বাংলায় প্রশ্ন",
      "q_en": "Question in English",
      "options": [
        { "id": "A", "text_bn": "বিকল্প ১", "text_en": "Option 1" },
        { "id": "B", "text_bn": "বিকল্প ২", "text_en": "Option 2" },
        { "id": "C", "text_bn": "বিকল্প ৩", "text_en": "Option 3" },
        { "id": "D", "text_bn": "বিকল্প ৪", "text_en": "Option 4" }
      ]
    }
  ],
  "B": [ ... ]
}
```

- Category A: IDs `a01` through `a60`
- Category B: IDs `b01` through `b60`
- **Do NOT include correct answers here** (students can view source!)
- Correct answers go only in `Code.gs` (ANSWER_KEY_A / ANSWER_KEY_B)

---

### Step 6: Host the Site (Free)

#### Option A: GitHub Pages
1. Create a GitHub repo (e.g., `ramadan-genius`)
2. Upload `index.html`, `script.js`, `questions.json`
3. Go to **Settings → Pages → Branch: main → Save**
4. Your site will be live at: `https://yourname.github.io/ramadan-genius/`

#### Option B: Vercel
1. Create a [Vercel](https://vercel.com) account
2. Import your GitHub repo
3. Deploy — instant live URL

---

### Step 7: Test Before Going Live

- [ ] Open on phone + laptop
- [ ] Complete a full quiz
- [ ] Check Google Sheet has a new row with correct score
- [ ] Test refresh mid-quiz (should resume)
- [ ] Test with 10–20 simultaneous users
- [ ] Do one burst test near end-time and confirm grace submit works
- [ ] Verify category restriction (Class 4 can't pick Category B)

---

### Step 8: Run the Competition

**Share the link** with students. Tell them:
- Use Chrome browser
- Don't open multiple tabs
- Keep internet stable
- If submission fails, press **Retry** (don't close the page)

**After competition**:
1. Open Google Sheet
2. Sort by `score` (descending), then `serverReceivedAt` (ascending) for tie-breaking
3. Check `flag` column for suspicious entries

---

## Timing Math

- 60 questions × 20 seconds = **1,200 seconds = 20 minutes** total per student

---

## Google Sheet Column Reference

| Column | Description |
|--------|-------------|
| serverReceivedAt | Server timestamp (ISO) |
| name | Student name |
| class | Class/Grade |
| phone | Phone number |
| school | School name |
| address | Address |
| father | Father's name |
| mother | Mother's name |
| category | A or B |
| sessionId | Unique session ID |
| startedAtClient | Client start time (ISO) |
| finishedAtClient | Client finish time (ISO) |
| durationSecClient | Total seconds on client |
| score | Auto-scored by server |
| answersJson | Raw answers JSON |
| userAgent | Browser info |
| flag | Suspicion flags |

---

## Limits & Notes

- Google Apps Script: ~30 simultaneous executions per user, 6 min max runtime per execution
- Keep `doPost` lightweight (it is — just one `appendRow`)
- The retry button handles transient failures
- localStorage resumes quiz on refresh/disconnect
- Questions and options are shuffled per student

---

## Host Now (Fastest)

If you want it live immediately:

1. Deploy `Code.gs` as Web App and copy URL.
2. Update `APPS_SCRIPT_URL` + `SECRET` in `script.js`.
3. Push `index.html`, `script.js`, `questions.json` to GitHub.
4. Enable **GitHub Pages** from `main` branch.
5. Open the Pages URL in an incognito window and do one full test submission.

**Built for Ramadan Genius — ফুলকুঁড়ি আশার ঝিঙ্গেফুল** 🌙
