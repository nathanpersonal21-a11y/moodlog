# Moodlog

A private mood journal that lives on your phone. Every entry carries your mood (tactile dial), written or voice, plus a per-day to-do list with confetti,
tags, search and filters, habits, trends, themes, phone reminders, and an automatic backup to your own Google Sheet.

No accounts, no servers, no cost. Everything is stored on your device; the Google backup is optional and goes to *your* Google account.

## Install on iPhone
1. Open the site in **Safari**.
2. Tap **Share → Add to Home Screen**.
3. Open it from the Home Screen icon (it works offline after the first load).

The passcode is set in `js/lock.js` (stored as a hash). It is a convenience lock, not encryption — your phone's own passcode is the real protection.

## Backup to Google Sheets + phone reminders (Apps Script)
Do this once. It takes about five minutes.

1. Make (or open) the Google Sheet you want your journal saved into. Name it anything.
2. In the Sheet: **Extensions → Apps Script**.
3. Delete everything in the editor, paste in all of [`apps-script/Code.gs`](apps-script/Code.gs), and press the 💾 save icon.
4. In the function dropdown at the top choose **authorize**, press **▶ Run**, then **Review permissions → your account → Advanced → Go to project (unsafe) → Allow**.
   (Google shows the warning because *you* wrote the script. It asks for Sheets, Drive and Calendar access so it can save entries, photos/audio and reminders.)
5. **Deploy → New deployment → ⚙ Web app**: *Execute as* **Me**, *Who has access* **Anyone** → **Deploy**. Copy the **Web app URL**.
   *Already have a deployment from the old Moodlog?* Use **Deploy → Manage deployments → ✏ Edit → Version: New version → Deploy** instead — your URL stays the same.
6. In Moodlog: **Settings → Backup to Google Sheets**, paste the URL, tap **Save & test connection**. You should see “✓ Connected (script v2)”. Your existing entries start backing up straight away.

Your existing sheet keeps working: the script matches columns by name and adds `tags`, `updatedAt` and `deleted` if they're missing.
Deleted entries are marked `DELETED` in the sheet rather than removed, so the sheet is always a full backup.

### Reminders
In Moodlog: **Settings → Reminders**, switch it on, choose a time (or a different time per day), and tap **Save reminders to my calendar**.
Then tap **Send a test reminder** — a notification should pop up on your phone within about two minutes.
Reminders are repeating Google Calendar events with a popup alert, so your iPhone needs Google Calendar notifications:
either the **Google Calendar app** (allow notifications) or your Google account added under *Settings → Calendar → Accounts*.
Change times any day — just tap Save again. Moodlog also refreshes them about once a week so clock changes don't shift them.

### Optional secret
If you don't want anyone who finds your script URL to be able to write to your sheet, set `SECRET` at the top of the script, redeploy, and put the same text in *Settings → Secret*.

## Better voice transcription (optional)
By default voice notes use your iPhone's built-in speech recognition, exactly like before. You can always fix words in the transcript before saving.
If you want a stronger model when you're online, add an API key in **Settings → Voice transcription** (Groq has a free tier). Each new recording is then re-transcribed in the cloud — nothing to download. The key stays on your device.

## Updating the app
Edit the files and push to `main`. A GitHub Action bumps the cache version in `sw.js` automatically; the app picks up changes the next time it opens online.

## Files
| | |
|---|---|
| `index.html`, `css/app.css` | the app shell and styles |
| `js/` | one file per feature: `store` (data), `journal`, `checkin` + `dial`, `voice`, `habits`, `trends`, `sync`, `reminders`, `settings`, `theme`, `lock` |
| `apps-script/Code.gs` | the Google Sheets / Drive / Calendar backend |
| `sw.js`, `manifest.webmanifest`, `icons/` | offline support and install info |
