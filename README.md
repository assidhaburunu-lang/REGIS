# FREMYS — web version (GitHub + Vercel + Postgres)

FREMYS is the HRCM complaint registration application. This version runs as a normal website: static pages served by Vercel, one serverless API function, and a Postgres database (Neon, added from the Vercel Marketplace).

```
public/          the app (HTML, CSS, JavaScript, fonts, images); served as static files
api/[route].js   the API: /api/state, /api/login, /api/sync, /api/write, /api/upload, …
lib/core.js      API logic: sign-in, sessions, permissions, data storage
vercel.json      Vercel settings and security headers
```

## Deploy it: about 15 minutes, no coding needed

### 1. Put the code on GitHub
1. Sign in to https://github.com and click **New repository**. Name it, for example `fremys`, and choose **Private**. Click **Create repository**.
2. On the new repository page, click **uploading an existing file**. Drag in **everything inside this folder**: `api`, `lib`, `public`, `package.json`, `package-lock.json`, `vercel.json`, `.gitignore`, `.env.example`, `README.md`. Do not upload `node_modules` if you have one. Click **Commit changes**.

   If you use git instead:
   ```
   git init && git add . && git commit -m "FREMYS web"
   git branch -M main
   git remote add origin https://github.com/<you>/fremys.git
   git push -u origin main
   ```

### 2. Create the Vercel project
1. Sign in to https://vercel.com with your GitHub account and click **Add New… → Project**.
2. Pick the `fremys` repository and click **Import**. Leave every build setting as it is; `vercel.json` already sets them.
3. Before deploying, open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `SESSION_SECRET` | 40+ random characters. Generate them at https://1password.com/password-generator or run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
   | `SETUP_KEY` | A private phrase. It is needed once, to create the first administrator, and stops anyone else who finds the site from setting it up first. |

4. Click **Deploy**. The site loads, but it cannot work until the database is added in the next step.

### 3. Add the database
1. In the Vercel project, open **Storage → Create Database** (or **Browse Marketplace**), choose **Neon** (Serverless Postgres), and pick the region closest to the Maldives, for example Singapore.
2. Connect it to the `fremys` project for **Production** (and Preview if you want). Leave the variable prefix **empty**. Vercel then adds `DATABASE_URL` automatically.
3. Go to **Deployments**, open the menu on the latest deployment, and click **Redeploy**, so the new variables take effect.

FREMYS creates its tables itself on the first request.

### 4. First sign-in
Open your site, for example `https://fremys.vercel.app`. You will see **Set up FREMYS**. Enter the `SETUP_KEY`, your name, a username and a password. You are now the System Administrator. Add staff and roles under **Administration**, exactly as in the hosted version.

To bring across cases from the claude.ai version or the local version, use **Administration → Data tools → Download backup** there, then **Restore from backup…** here. Staff accounts come across without passwords, so reset each one under Staff.

### Optional settings (Vercel → Settings → Environment Variables, then Redeploy)

| Name | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Turns on **Suggest with AI** for classification, using your own Anthropic API account. |
| `ANTHROPIC_MODEL` | Model for the suggestion. Default: `claude-haiku-5-5`. |
| `RECOVERY_KEY` | 16+ characters. Lets you reset a forgotten administrator password (see below). |

**Forgotten administrator password:** set `RECOVERY_KEY` and redeploy, then run this from any computer:
```
curl -X POST https://<your-site>/api/recover -H "Content-Type: application/json" -H "X-Fremys: 1" \
  -d '{"key":"<RECOVERY_KEY>","username":"<admin username>","password":"NewTemp123"}'
```
Sign in with the new password; you will be asked to change it. Remove `RECOVERY_KEY` again afterwards.

## Security: how it is protected
- **Data access:** nothing is sent to a browser until a staff member signs in. Before that, the API only tells the browser whether FREMYS has been set up.
- **Passwords:** checked on the server (PBKDF2-SHA256, 210,000 rounds). Hashes are kept in a separate table that the browser can never read.
- **Lockout:** 5 wrong passwords lock the account for 15 minutes.
- **Sessions:** signed, HttpOnly, SameSite=Strict cookies that expire after 12 hours. FREMYS also signs people out after the idle time set in Settings. Resetting someone's password ends their sessions.
- **Permissions:** only System Administrators can change staff accounts and settings or read the audit trail. The audit trail cannot be deleted through the app.
- **Security headers:** a strict Content-Security-Policy, HSTS and no framing (see `vercel.json`).
- **Finer permissions:** the role rules for case work (who may decide, assign and so on) are applied in the app's screens, as in the hosted version. The server separately enforces sign-in, staff/settings changes and audit access.

Before entering real complainant data, get approval from HRCM for:
- the hosting, which is Vercel plus Neon in the region you choose;
- a custom domain;
- a backup routine. Neon keeps only a short restore history on the free plan, so also download a FREMYS backup regularly.

## Limits of the free plans
- **Attachments:** files are stored in the database and must be 4 MB or smaller.
- **Live updates:** screens refresh every 5 seconds while open, which keeps the database awake during working hours. For an office using FREMYS all day, Neon's paid Launch plan is safer than the free plan's monthly compute allowance.
- **Vercel plan:** Vercel's Hobby plan is for non-commercial use. An organisation should use Vercel Pro.

## Running it on your own computer (optional)
Install the Vercel CLI (`npm i -g vercel`), run `vercel link`, then `vercel env pull .env.local`, then `vercel dev`. This uses the same database as the website.
