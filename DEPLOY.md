# Veyru Keyolhu — deploy with GitHub + Cloudflare Pages

**Live site:** https://veyrukeyolhu.com · **Admin:** https://veyrukeyolhu.com/admin

```
public/              the website (served as-is, no build step)
  index.html, about.html, contact.html, 404.html
  content.json       default content — used until the first save in /admin
  admin/             the admin editor
  photos/            all images (logo, tours, gallery)
  hero.mp4           home page video
  _headers, _redirects, robots.txt, sitemap.xml
functions/           server code: login, save, photo upload, video streaming
```

Once connected, **every push to GitHub redeploys the site automatically.**
Content edited in `/admin` is stored in Cloudflare (not in GitHub), so pushes never overwrite it.

---

## 1. Put the code on GitHub

The folder is already a git repository with everything committed.

**Option A — GitHub Desktop (easiest):** File → Add Local Repository → choose this
`veyrukeyolhu` folder → **Publish repository** → keep **"Keep this code private"** ticked.

**Option B — Terminal:** create an empty **private** repo on github.com named `veyrukeyolhu`
(no README), then:
```
git remote add origin https://github.com/<your-username>/veyrukeyolhu.git
git push -u origin main
```

## 2. Create the Cloudflare Pages project

Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
→ pick the `veyrukeyolhu` repo, then:

| Setting | Value |
|---|---|
| Production branch | `main` |
| Framework preset | **None** |
| Build command | *(leave empty)* |
| Build output directory | `public` |

Click **Save and Deploy**. The first deploy gives you a `veyrukeyolhu.pages.dev` address.

## 3. Add storage + admin password

1. **Workers & Pages → KV → Create a namespace** → name it `veyrukeyolhu-site`.
2. Open your Pages project → **Settings → Bindings → Add → KV namespace**:
   variable name **`SITE`**, namespace `veyrukeyolhu-site`. Do this for **Production** (and Preview if shown).
3. **Settings → Variables and Secrets → Add** (type **Secret**, Production):
   - `ADMIN_PASSWORD` — a strong password only you know
   - `SESSION_SECRET` — any long random text (e.g. mash the keyboard, 40+ characters)
4. **Deployments → latest → ⋯ → Retry deployment** so the new settings take effect.

Test: open `https://veyrukeyolhu.pages.dev/admin`, sign in, change something, **Save changes**.

## 4. Connect veyrukeyolhu.com

1. If the domain isn't on Cloudflare yet: dashboard → **Add a domain** → `veyrukeyolhu.com` → Free plan,
   then at your domain registrar change the **nameservers** to the two Cloudflare gives you
   (can take a few minutes to a few hours).
2. Pages project → **Custom domains → Set up a custom domain** → `veyrukeyolhu.com` → Activate.
3. Repeat for `www.veyrukeyolhu.com`.
4. Send `www` to the main address: domain `veyrukeyolhu.com` → **Rules → Redirect Rules → Create rule** →
   template **"Redirect from WWW to root"** → Deploy.
5. **SSL/TLS → Edge Certificates → Always Use HTTPS: On.**

Old Adobe Portfolio links (`/home`, `/tours`, the tour pages) redirect to the new site automatically.
After switching the domain, you can close the Adobe Portfolio site.

## 5. After launch

- **Google:** add the site in [Google Search Console](https://search.google.com/search-console) and
  submit `https://veyrukeyolhu.com/sitemap.xml`.
- **Extra admin protection (optional):** Zero Trust → Access → add an application for
  `veyrukeyolhu.com/admin*` so only your email can even open the admin page.

---

## Everyday use

- **Edit content:** `veyrukeyolhu.com/admin` → edit → **Save changes**. Live immediately.
- **Change code/design:** edit files, commit, push to GitHub → Cloudflare redeploys in ~1 minute.
- **Backup:** the previous content version is kept in KV under the key `content:backup`.
- **Photos:** uploaded photos are shrunk automatically. iPhone HEIC photos work from Safari;
  on other browsers export them as JPG first.

## Run it on your Mac

```
npm install
npm run dev
```
Open http://localhost:8788 — the local admin password is in `.dev.vars` (never uploaded).
