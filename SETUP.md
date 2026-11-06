# Set up MindReps

This app uses one Supabase account for private cloud progress and GitHub Pages for its public frontend. No accounts, hosted projects, or deployed site have been created by the implementation.

## 1. Create the Supabase project and owner

1. Create your project in [Supabase](https://supabase.com/dashboard). Keep its database password outside this repository.
2. Open the SQL editor and execute all of [supabase/schema.sql](supabase/schema.sql). It is safe to run again on this app's schema.
3. Under **Authentication → Users**, create your intended user with your own email and confirm that email. If the dashboard requires a password, choose it privately; MindReps signs in through email links, with optional email-code support.
4. Copy the user's UUID. In the SQL editor, run this separately, replacing the placeholder:

   ```sql
   insert into app_private.owner (user_id)
   values ('YOUR-USER-UUID');
   ```

   Only one owner is supported. A duplicate-key error when repeating this insert means an owner already exists; inspect the existing entry in the SQL editor before changing it. The browser cannot edit this allowlist.

5. In **Authentication → Sign In / Providers**, disable **Allow new users to sign up** and leave anonymous sign-ins disabled. Keep the email provider enabled. The client also sets `shouldCreateUser: false`; the allowlist and RLS independently enforce access to progress. See [Supabase general configuration](https://supabase.com/docs/guides/auth/general-configuration).

## 2. Configure email sign-in and delivery

For initial personal testing, use Supabase's default **magic-link email**. Leave the email template unchanged: no additional email provider is needed when your sign-in address belongs to the Supabase project's team. The built-in mail service currently allows two messages per hour and is best-effort. Check the current restrictions in [Supabase SMTP guidance](https://supabase.com/docs/guides/auth/auth-smtp).

In **Authentication → URL Configuration**:

- For local testing, set Site URL to `http://127.0.0.1:3000/` and add that exact URL to Redirect URLs.
- When deployed, set Site URL to the real Pages URL, including the repository path, such as `https://YOUR-USER.github.io/MindReps/`. Add that exact URL to Redirect URLs too.

MindReps requests a link back to the page where you started sign-in. Open the emailed link in the browser where you want to use MindReps. The Supabase client reads the returned session automatically; no callback route is needed. Existing users, the owner allowlist, and RLS still control access. See [Supabase passwordless sign-in](https://supabase.com/docs/guides/auth/auth-email-passwordless).

### Optional: use typed email codes later

The Free dashboard currently disables template editing until custom SMTP is configured; Pro also offers template customization using Supabase's mail service. You can skip this section when using the default link.

For dependable ongoing delivery, a different recipient address, or a custom code template, configure an SMTP provider privately in Supabase. Then open **Authentication → Emails → Templates → Magic link or OTP** and include:

```html
<h2>Your MindReps sign-in code</h2>
<p>Enter this code in MindReps: {{ .Token }}</p>
```

After requesting the email in MindReps, choose **My email includes a code** and enter it. The resend control enforces a one-minute wait; the provider can impose additional limits. SMTP credentials belong in Supabase settings, never in Vite configuration.

## 3. Connect the local app

Find your project's URL and **publishable** key in the Supabase project's Connect/API settings. A legacy **anon** key is also supported.

```powershell
Copy-Item .env.example .env.local
```

Edit `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR-PUBLISHABLE-KEY
```

These two values are public browser configuration. Never use a service-role key, `sb_secret_` key, database password, SMTP password, or sign-in code here. Configuration validation rejects privileged key types, placeholders, and invalid URLs. `.env.local` is ignored by Git.

```powershell
npm ci
npm test
npm run build
npm run dev -- --port 3000
```

Restart Vite after changing environment files. Open [MindReps locally](http://127.0.0.1:3000/), request an email for the authorized address, and open its sign-in link. The setup preview disappears once valid configuration is present.

## 4. Create the GitHub repository and deploy

1. Create an empty public GitHub repository. Avoid creating a starter README in the remote because this folder already contains one.
2. Under repository **Settings → Secrets and variables → Actions → Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` using the same public values.
3. Under **Settings → Pages → Build and deployment**, choose **GitHub Actions** as the source. The workflow already exists in this project. See [GitHub's custom Pages workflow guide](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
4. If this folder has not yet been initialized as a Git repository, run:

   ```powershell
   git init -b main
   git add .
   git commit -m "Implement MindReps personal learning app"
   git remote add origin https://github.com/YOUR-USER/YOUR-REPOSITORY.git
   git push -u origin main
   ```

   If Git is already initialized or a remote exists, inspect `git status` and `git remote -v` and use that repository rather than repeating initialization. Review staged files before committing; `.env.local`, dependencies, build output, and QA artifacts are excluded.

5. Watch **Actions → Deploy MindReps**. It installs locked dependencies, runs tests, validates the two repository variables, builds, and deploys `dist/`. Missing or invalid public configuration fails deployment instead of publishing an unsaved preview.
6. Open the URL returned by Pages. Vite uses relative asset paths, so repository-path hosting works. Set this exact URL in Supabase's URL configuration, then perform the checks below.

Environment values are baked into the build. Changing repository variables requires a new workflow run. The CLI `npm run check:config` checks variables already set in its process environment; Vite itself loads `.env.local` when building/running locally.

## 5. Live acceptance checks

Use your real Supabase project and deployed URL for these checks:

- Sign in as the allowlisted owner; confirm a non-owner account cannot load or save progress.
- Start topic and mixed sessions. Select an answer, reopen the app on another device, and confirm the same selection resumes. Submit, reopen, and confirm feedback resumes without adding a second answer or XP award.
- Give an incorrect answer, finish/end the session, and recover it in Review. Confirm the item clears, the first-attempt accuracy stays unchanged, and the recovery bonus is awarded once.
- Complete a session, change the daily goal in Progress, and confirm the next session uses that goal. Export a JSON snapshot and inspect it.
- With two tabs open, answer in the first, then try a change from the stale second tab. Confirm a conflict appears and **Reload cloud progress** restores the newer state. The discarded tab's failed change is not merged automatically.
- Disconnect the network before selecting or submitting. Confirm a save error appears, further changes pause, and **Retry save** succeeds after reconnecting. A response lost after a successful commit is recognized by its mutation ID. **Reload cloud progress** explicitly discards an unconfirmed local change in favor of the database state.
- Sign out from another tab or let authentication expire. Confirm the workspace closes and the next sign-in loads fresh cloud state. A cached confirmed workspace can remain visible while a token refresh waits for network recovery; database calls still require valid authorization.
- On your actual phone, check code scrolling, all answer explanations, multi-select choices, navigation, and sign-out. Browser rendering checks do not establish installation/offline support.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Setup screen keeps appearing | Both `VITE_` values must be valid; restart Vite or redeploy after editing them. |
| No email / address not authorized | Team-email restriction, SMTP sender verification, rate limits, spam folder, and the Auth email logs. |
| A magic link arrives | This is the supported default. Open the link to sign in; no template edit is required. |
| Template editing is disabled | Use the default link, or configure custom SMTP / an eligible plan before customizing the template. |
| Code rejected | Use the newest code and exact email; check configured expiry and provider rate limits. |
| Account is not authorized | The authenticated user's UUID must match `app_private.owner.user_id`. |
| Function missing / permission denied | Run the complete schema in the intended Supabase project. |
| Another-device conflict | Reload cloud progress before continuing. Newer cloud data is preserved. |
| Local port access error | Use port 3000; port 5173 was unavailable in the original environment. |
| Pages workflow fails | Check public repository variables, Pages source, workflow logs, and Actions permissions. |

The schema stores a personal-scale JSON snapshot with a revision. Owner-authenticated clients can read their row; all writes go through revision-checked RPCs. Static source and answers remain public. Supabase may persist an auth session token in browser storage, while learning progress lives in the database. Export progress periodically and manage database backups in Supabase.
