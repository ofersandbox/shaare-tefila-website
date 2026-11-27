# Automatic publishing: setup guide

This sets up the pilot: the **Life at Shaare Tefila** photo grid on the home page is
edited in a Google Drive folder, and the website updates itself from that folder.
The rest of the site works as before.

> **Prototype account:** for this prototype, every account below (Google Drive,
> Google Cloud, GitHub and the optional email notices) uses
> **ofer.sandbox@gmail.com**. When the congregation adopts it, see
> "Moving from the prototype to the congregation's accounts" at the end.

**How it works once it's set up**

1. The section's owner adds, removes or renames photos in a Google Drive folder.
2. Every hour, GitHub (a free service that stores the website's files) runs the
   **Publish website** process: it reads the Drive folder, checks it (Check 1),
   tests the whole site in a browser (Check 2), publishes it, and checks the live
   site (Check 3).
3. If something is wrong, the website keeps showing the previous version and an
   email explains what to fix.

You'll set up three free accounts: **Google Drive** (the photos), **Google Cloud**
(a "robot" account that lets GitHub read the folder, with no password or key file) and **GitHub** (stores and
publishes the site). Allow about an hour the first time.

---

## Part 1: Google Drive (about 10 minutes)

For the prototype, use **ofer.sandbox@gmail.com**.

1. Go to **drive.google.com** and sign in as **ofer.sandbox@gmail.com**. If you're
   already signed in to another Google account, click your profile picture (top
   right) > **Add another account**, or use a separate browser profile, so the
   folders aren't created in the wrong account.
2. Click **+ New > New folder** and name it `Website`. Open it.
3. Inside it, create a folder named `Home`, open it, and inside that create a folder
   named `Life at Shaare Tefila`. Open that folder.
4. Upload the five starter photos from your Mac: drag in everything from the folder
   **Claude > ShaareTefila > drive-starter > Life at Shaare Tefila**.
   They're already named the right way, for example `1 - Our community, all ages together.jpg`.
5. **Copy the folder ID.** Look at the address bar. It ends with something like
   `drive.google.com/drive/folders/1AbC2dEfGhIjKlMnOpQrStUvWxYz`. The part after
   `folders/` is the folder ID. Paste it somewhere; you'll need it in Part 3.
6. **Share with a test "section owner"** (optional): right-click the folder >
   **Share**, add the email of whoever will try editing it, choose **Editor**.

**Rules for the folder** (worth printing for the owner):

- Each photo's name is its **number** (the order), a dash, then its **caption**:
  `3 - Purim carnival.jpg`. Photo 1 is shown large.
- 3 to 8 photos. More than 8 is fine; only the first 8 appear, plus a link to the gallery.
- JPEG or PNG, at least 800 pixels on the long side. iPhone "HEIC" photos must be
  saved as JPEG first.
- To remove a photo, delete it or move it out of the folder.

### The Gallery folder

1. In the `Website` folder (not inside `Home`), drag in the whole folder
   **Claude > ShaareTefila > drive-starter > Gallery** from your Mac. It holds the
   current gallery, already sorted into albums.
2. Open the `Website` folder itself and copy **its** folder ID from the address bar.
   The build finds `Gallery` inside it by name. You'll need this ID in Part 3.

**Rules for the Gallery** (worth printing for photographers):

- Each **album is a folder** inside `Gallery`. Start its name with the date so it
  sorts correctly: `2025-12 Hanukkah`, `2026-05 Religious school picnic`, or just
  `2024 Gala`. The page shows albums newest first, each with its name as a heading.
- Any photo name works, including straight-from-the-phone names like `IMG_4021.HEIC`.
  To add a caption, name the photo after what it shows: `Kids lighting the menorah.jpg`.
  To choose the order, start names with numbers: `1 - Arrival.jpg`. Otherwise photos
  are in the order they were taken.
- iPhone HEIC photos are fine. Videos, documents and folders inside albums are skipped.
- A photo that can't be used (broken, or tiny) is skipped and the office is told which
  one; the rest of the gallery still updates.
- To remove a photo or album, delete it or move it out of `Gallery`.

---

## Part 2: Google Cloud sign-in, without a key file (about 15 minutes)

GitHub needs permission to *read* the Drive folder. It signs in as a Google
**service account** (a "robot" account with its own email address) using
**Workload Identity Federation**: each time the website updates, GitHub proves
which project it is and Google hands it a read-only pass that expires within the
hour. There's no key file to download or protect, and only your one GitHub
repository is allowed in.

**First, decide two names** (the GitHub account itself is created in Part 3):

- your **GitHub username**, for example `ofer-sandbox`
- the **repository name**: use `shaare-tefila-website`

Together they make the repository's full name, for example
`ofer-sandbox/shaare-tefila-website`. Google will only let that exact repository in,
so use exactly these names in Part 3. If you change them later, rerun step 4 below.

1. **Create the project.** Go to **console.cloud.google.com**, signed in as
   **ofer.sandbox@gmail.com** (check the picture at the top right), and accept the
   terms if asked. Click the project picker at the top > **New project**, name it
   `Shaare Tefila Website`, and click **Create**. Select it in the project picker.
   On the dashboard, note the **Project number** (all digits).
2. **Turn on four services.** Go to **APIs & Services > Library**. Search for each of
   these, open it, and click **Enable**:
   - **Google Drive API**
   - **IAM Service Account Credentials API**
   - **Security Token Service API**
   - **Identity and Access Management (IAM) API**
3. **Create the robot.** Go to **IAM & Admin > Service Accounts > + Create service
   account**. Name it `website-builder`, click **Create and continue**, skip the
   optional steps, and click **Done**. Copy its email, which looks like
   `website-builder@YOUR-PROJECT-ID.iam.gserviceaccount.com`.
4. **Create the GitHub sign-in.** Go to **IAM & Admin > Workload Identity Federation**
   and click **Get started** or **Create pool**.
   - Pool **Name**: `github` (this becomes the pool ID). Click **Continue**.
   - **Select a provider**: **OpenID Connect (OIDC)**
   - **Provider name**: `Shaare Tefila website repo`
   - **Provider ID**: `shaare-tefila-site`
   - **Issuer URL**: `https://token.actions.githubusercontent.com` (exactly this, with no slash at the end)
   - **Audiences**: **Default audience**. Click **Continue**.
   - **Attribute mapping**: in the first row, Google `google.subject` = OIDC
     `assertion.sub`. Click **Add mapping** and enter Google `attribute.repository` =
     OIDC `assertion.repository`.
   - **Attribute conditions**: click **Add condition** and enter (with your username):
     `assertion.repository=='YOUR-GITHUB-USERNAME/shaare-tefila-website'`
   - Click **Save**.
5. **Let only your repository act as the robot.** On the `github` pool's page, click
   **Grant access**, then:
   - choose **Grant access using Service Account impersonation**
   - **Service accounts**: `website-builder`
   - choose **Only identities matching the filter**
   - **Attribute name**: `repository`; **Attribute value**:
     `YOUR-GITHUB-USERNAME/shaare-tefila-website`
   - click **Save**. If a "Configure your application" window appears, click
     **Dismiss**; you don't need to download anything.
6. **Write down the two values for GitHub** (Part 3). Neither is a password.
   - `GCP_WORKLOAD_IDENTITY_PROVIDER`: type this, with your project number:
     `projects/YOUR-PROJECT-NUMBER/locations/global/workloadIdentityPools/github/providers/shaare-tefila-site`
   - `GCP_SERVICE_ACCOUNT`: the robot's email from step 3.
7. **Share the Drive folder with the robot.** In Google Drive, right-click the
   `Website` folder > **Share**, paste the robot's email, choose **Viewer**, untick
   "Notify people", and click **Share**.

Changes can take up to 5 minutes to take effect.

**Alternative, if Cloud Shell works for your account:** click the **>_** icon at the
top right of the console and run these instead of steps 2–6, after replacing the
capitalized parts in the first two lines:

   ```
   PROJECT_ID="YOUR-PROJECT-ID"
   GITHUB_REPO="YOUR-GITHUB-USERNAME/shaare-tefila-website"
   gcloud config set project "$PROJECT_ID"
   PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
   gcloud services enable drive.googleapis.com iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com
   gcloud iam service-accounts create website-builder --display-name="Shaare Tefila website builder"
   SA="website-builder@${PROJECT_ID}.iam.gserviceaccount.com"
   gcloud iam workload-identity-pools create github --location=global --display-name="GitHub Actions"
   gcloud iam workload-identity-pools providers create-oidc shaare-tefila-site \
     --location=global --workload-identity-pool=github \
     --display-name="Shaare Tefila website repo" \
     --issuer-uri="https://token.actions.githubusercontent.com" \
     --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
     --attribute-condition="assertion.repository == '${GITHUB_REPO}'"
   gcloud iam service-accounts add-iam-policy-binding "$SA" \
     --role=roles/iam.workloadIdentityUser \
     --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository/${GITHUB_REPO}"
   echo; echo "GCP_WORKLOAD_IDENTITY_PROVIDER = projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/providers/shaare-tefila-site"
   echo "GCP_SERVICE_ACCOUNT = ${SA}"
   ```

   The last two lines it prints are the two values for GitHub. Then do step 7.

If a command says something "already exists", that part was already done; it's
safe to continue.

---

## Part 3: GitHub (about 20 minutes)

1. **Create an account** at **github.com** (free) with **ofer.sandbox@gmail.com**,
   using the **username you chose in Part 2**. GitHub emails a code to that address
   to confirm it.
2. **Install GitHub Desktop** from **desktop.github.com** and sign in with that account.
   If GitHub Desktop is already signed in to another GitHub account, sign out first
   (**GitHub Desktop > Settings > Accounts**).
3. **Put the website on GitHub:** in GitHub Desktop choose **File > Add local repository**,
   pick the folder **Claude > ShaareTefila > website**. It will say it isn't a
   repository yet; click **create a repository**, set the name to
   **`shaare-tefila-website`** (it must match Part 2 exactly), and click
   **Create repository**.
   Then click **Publish repository**, **untick "Keep this code private"**, and publish.

   *Why public?* Free GitHub accounts can only publish public projects to the web.
   Everything in it is already public on the website. There's no Google password
   or key in it at all. This guide is in the project too, so
   anyone can see the address ofer.sandbox@gmail.com written in it.

4. On **github.com**, open the repository and click **Settings**:
   - **Secrets and variables > Actions > Variables tab > New repository variable**
     (add each one separately; paste only the value, without the name and `=`)
     - `GCP_WORKLOAD_IDENTITY_PROVIDER` = the value from Part 2, step 6
       (starts with `projects/` and ends with `providers/shaare-tefila-site`)
     - `GCP_SERVICE_ACCOUNT` = the robot's email from Part 2, step 6
     - `LIFE_AT_FOLDER_ID` = the folder ID from Part 1, step 5
     - `WEBSITE_FOLDER_ID` = the ID of the `Website` folder (see "The Gallery folder" in Part 1)
     - `NOTIFY_TO` = `ofer.sandbox@gmail.com` (who hears about problems during the prototype)
     - `LIFE_AT_OWNER_EMAIL` = the test section owner's email (optional)
   - **Pages**: under "Build and deployment", set **Source** to **GitHub Actions**.
   - **Actions > General**: under "Workflow permissions", choose
     **Read and write permissions** and click **Save**.

---

## Part 4: First publish and a test (about 10 minutes)

1. On github.com, open the repository's **Actions** tab, click **Publish website**
   on the left, then **Run workflow > Run workflow**. This is also your
   **"Publish now"** button from now on.
2. Wait 2–4 minutes. Each step shows a green check when it passes. The run's page
   shows a summary, for example "Updated: Life at Shaare Tefila, 5 photos".
3. Your site is live at **https://YOUR-GITHUB-NAME.github.io/REPOSITORY-NAME/**
   (also shown under **Settings > Pages**).
4. **Try a mistake on purpose:** in Drive, rename one photo to `IMG_1234.jpg` and run
   the workflow again. The summary says **Held back**, explains what to fix, and the
   website does not change. Rename it back and run once more.

After this, it runs by itself every hour and only republishes when something changed.

---

## Part 5 (optional): email notices

Without this step, problems are still shown on each run's summary page in GitHub.
To have them emailed, send them from **ofer.sandbox@gmail.com**:

1. Signed in as ofer.sandbox@gmail.com, turn on **2-Step Verification** at
   **myaccount.google.com/security**.
2. Go to **myaccount.google.com/apppasswords**, create an app password named
   `Shaare Tefila website`, and copy the 16-letter password.
3. In GitHub **Settings > Secrets and variables > Actions > Secrets**, add:
   `SMTP_HOST` = `smtp.gmail.com`, `SMTP_PORT` = `465`,
   `SMTP_USER` = `ofer.sandbox@gmail.com`, `SMTP_PASS` = the app password.

Notices then come from ofer.sandbox@gmail.com and go to the `NOTIFY_TO` address
(and the section owner's, if set).

A repeated problem is emailed at most once a day, not every hour.

---

## Everyday use

| To... | Do this |
|---|---|
| Change the photos | Edit the Drive folder. The site updates within the hour. |
| Add a gallery album | In Drive, make a folder in `Gallery` named like `2026-03 Purim` and put the photos in it. |
| Publish right away | GitHub > Actions > Publish website > Run workflow |
| See what happened | GitHub > Actions > click a run > its summary |
| Change the layout or design | Edit the files in the website folder, then **Commit** and **Push** in GitHub Desktop. That publishes automatically, after the checks pass. |
| Get the robot's latest photos onto your Mac | GitHub Desktop > **Fetch origin**, then **Pull** |

### Restore an earlier version

If a published change ever needs undoing:

1. On github.com, click the repository's **commits** link (the clock icon with a
   number, near the top of the Code tab).
2. Find the last version that was good and click the copy button next to its ID
   (a short code like `3f2a9c1`).
3. Go to **Actions > Publish website > Run workflow**, paste the ID into
   "To restore an earlier version", and run it.

This republishes that version. For a photo problem, also fix the Drive folder,
otherwise the next change there republishes the latest photos.

### Notes

- GitHub pauses hourly runs in public projects after 60 days with no changes to the
  project, and emails a warning first. Any photo update counts as a change; if it
  happens, click **Enable workflow** on the Actions tab.
- To use **shaaretefila.org** instead of the github.io address later, add it under
  **Settings > Pages > Custom domain** and follow GitHub's DNS instructions. Do this
  only when the board is ready to switch over from the old site.

---

## Moving from the prototype to the congregation's accounts

When the pilot works and the board approves, move it off ofer.sandbox@gmail.com:

1. **Drive:** create the same folders in the congregation's Google account
   (for example info@shaaretefila.org) and move the photos there. Or, in Drive, share
   the `Website` folder with that account and use **Share > Transfer ownership**.
2. **Google Cloud:** repeat Part 2 in the congregation's account (with the new
   repository name if it changes), and share the new `Website` folder with the new
   robot. No key file is needed, so Workspace rules that block keys don't apply.
3. **GitHub:** transfer the repository to a congregation-owned account
   (**Settings > General > Danger Zone > Transfer ownership**), or create a GitHub
   organization for the congregation and transfer it there.
4. **Update the settings** in the repository: replace the `GCP_WORKLOAD_IDENTITY_PROVIDER`,
   `GCP_SERVICE_ACCOUNT`, `LIFE_AT_FOLDER_ID` and `NOTIFY_TO` variables and the
   `SMTP_*` secrets with the congregation's.
5. **Remove the old access:** delete the sandbox Google Cloud project (or its
   `github` identity pool), and remove ofer.sandbox@gmail.com from anything it no
   longer needs.

---

## For whoever maintains the code

| File | What it does |
|---|---|
| `sections/home/04-life-at-shaare-tefila.njk` | The section's layout template |
| `sections/home/04-life-at-shaare-tefila.html` | **Generated** from the template and Drive. Don't edit. |
| `sections/home/life-at/` | **Generated** photos (two sizes) and `photos.json` |
| `css/style.css` (search "mosaic") | The arrangements for 3 to 8 photos |
| `build/sync-life-at.mjs` | Reads Drive, runs Check 1, writes the generated files |
| `build/lib/drive.mjs`, `build/lib/notify.mjs` | Shared helpers: reading Drive, sending notices |
| `tests/site.spec.mjs` | Check 2: browser tests at laptop and phone sizes |
| `tests/live-check.mjs` | Check 3: checks the live site after publishing |
| `build/sync-gallery.mjs` | Reads the Gallery folder (albums = sub-folders), resizes new photos, writes `sections/gallery/albums.json` |
| `sections/gallery/albums.json` | **Generated** list of albums and photos (saved in GitHub) |
| `sections/gallery/built/` | **Generated** resized gallery photos. Not saved in GitHub: rebuilt from Drive and kept in a GitHub Actions cache between runs |
| `.github/workflows/publish.yml` | The hourly / Publish-now process |

**Testing on a Mac** (needs Node.js 22 or newer from nodejs.org), in Terminal:

```
cd ~/Claude/ShaareTefila/shaare-tefila-website
npm install
npm run sync:local          # build Life-at and the Gallery from ../drive-starter instead of Drive
npm run serve               # then open http://localhost:8000
npx playwright install chromium
npm test                    # run Check 2
```
