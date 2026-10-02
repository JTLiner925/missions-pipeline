# Missions Pipeline app

Phone-first web app for The Well Missions team. It writes New Contacts, Disco
meetings, and Follow-up meetings into the **MISSIONS PIPELINE** page in Notion.
Notion is the source of truth: edit, delete, or duplicate anything there and the
app shows the change.

## How it fits together

| Piece | Where | What it does |
| --- | --- | --- |
| `index.html`, `app.js`, `styles.css` | GitHub Pages (static) | The screens. Holds no data and no secrets. |
| `supabase/functions/pipeline/index.ts` | Supabase Edge Function | The only thing that talks to Notion. Holds the Notion secret. |
| People, Meetings, Involvement, Team | Notion | All the data. |

With `API_URL` empty in `config.js` the app runs in **demo mode** with made-up
people, so you can click through it before anything is connected.

## Who can see what

- **Missions Team** (Role in the Team database): everyone, all notes, team numbers.
- **Volunteer Leader**: only people they own. Find a Person still shows them
  whether someone else's person has had a disco, when, and with whom, and nothing more.
- Access is checked against the Team database on every request. Untick **Active**
  on a Team row and that person is out immediately.

## Adding someone to the team

Add a row in the **Team** database in Notion: name, role, tick Active, and give
them a 6-digit **App Code**. They pick their name in the app and enter the code once.

## Going live (one time)

The Notion integration exists and is connected to MISSIONS PIPELINE, and the app is
published on GitHub Pages. What remains is the Supabase function, which only the
Supabase account holder can do. It uses the same Supabase project as Gospel Tracker
(`zohiurezsbstkztxklbs`); the two do not share any data.

### Supabase steps (about five minutes)

1. Sign in at [supabase.com/dashboard](https://supabase.com/dashboard) and open the
   Gospel Tracker project.
2. **Add the secret first.** In the left sidebar choose **Edge Functions**, then
   **Secrets**. Add a new secret:
   - Name: `NOTION_TOKEN`
   - Value: the Notion secret that starts with `ntn_`
   Save. (Menu labels move around; if you do not see Secrets under Edge Functions,
   look under Project Settings → Edge Functions.)
3. **Create the function.** Edge Functions → **Deploy a new function** → **Via Editor**.
   - Name it exactly `pipeline`.
   - Delete the sample code in the editor.
   - Open `supabase/functions/pipeline/index.ts` from this repo, copy all of it, and
     paste it in.
   - Click **Deploy function**.
4. **Turn off JWT verification.** Open the `pipeline` function → **Details** (or
   Settings) → switch **Verify JWT** off → Save. The app has its own sign-in codes;
   with this left on, every request is rejected before it reaches the function.
5. **Check the address.** The function's URL should be
   `https://zohiurezsbstkztxklbs.supabase.co/functions/v1/pipeline`.
   That is what `config.js` points at. If yours differs, change `API_URL` there and push.
6. **Test.** Open the app, sign in with your name and your code from the Team database,
   add a test contact, check it appears in People in Notion, then delete it there.

### If something goes wrong

- *"The app is not connected to Notion yet"*: the `NOTION_TOKEN` secret is missing or
  misspelled. Add it, then redeploy the function so it picks the secret up.
- *Sign-in screen never loads names, or "Something went wrong"*: Verify JWT is still on,
  or the function name is not exactly `pipeline`.
- *"That name and code do not match"*: check the App Code and the Active box on that
  person's Team row.
- Anything else: Edge Functions → `pipeline` → **Logs** shows the error from Notion.

### Updating the function later

Edit `index.ts` here, then paste the new version over the old one in the Supabase
editor and deploy again. Pushing to GitHub updates the screens but not the function.

## Things to know

- The Notion secret also signs the app's sign-in sessions. Replacing it signs everyone out.
- Sign-in lasts 90 days per phone.
- Every read the function makes was checked against the live workspace on 2026-10-01.
  Saving (new contact, new meeting) has not been run against it yet; step 6 is that test.
- Database IDs are constants at the top of `index.ts`. If a database is ever
  recreated (not just renamed), update the ID there.
- Property names in Notion are used by the function. Renaming **Stage**, **Owner**,
  **Next Step**, **Follow Up By**, **Disco Date**, **Type**, **Date**, **Person**,
  **Met By**, or **Meeting Notes** will break saving until `index.ts` is updated to match.

## Preview locally

```bash
python3 -m http.server 8765 --directory missions-pipeline
```
