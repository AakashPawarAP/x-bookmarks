# x-bookmarks

All my X (Twitter) bookmarks, pulled every 6 hours by GitHub Actions and served by GitHub Pages.

- `fetch.py` calls the same internal GraphQL endpoint the x.com web app uses and writes `bookmarks.json`.
- `index.html` renders `bookmarks.json` with a search box.
- `.github/workflows/sync.yml` runs the fetch on a cron and commits the result.

## One-time setup

1. Repo → Settings → Secrets and variables → Actions → add two repository secrets, copied from
   x.com's cookies (DevTools → Application → Cookies → https://x.com):
   - `AUTH_TOKEN` = value of the `auth_token` cookie
   - `CT0` = value of the `ct0` cookie
2. Repo → Settings → Pages → Source: *Deploy from a branch*, branch `main`, folder `/ (root)`.
3. Actions → *sync bookmarks* → *Run workflow* to do the first pull.

The cookies are your X login. Keep them as secrets only. If X logs you out (or you change
password), the workflow starts failing: refresh both secrets.

## Run locally

```bash
AUTH_TOKEN=... CT0=... python3 fetch.py && python3 -m http.server
```
