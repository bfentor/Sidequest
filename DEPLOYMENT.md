# Deployment

Sidequest runs on a server with [Coolify](https://coolify.io), an open source
platform installed on the server itself. Its dashboard is where releases are
deployed, rolled back and watched: logs, environment variables, scheduled
tasks and backups. For now there is only a **staging** environment, deployed
from the `testing` branch.

```
                         internet
                            │ HTTPS
                     ┌──────▼──────┐
                     │ Cloudflare  │  DNS and proxy for fentorweb.hu
                     └──────┬──────┘
                     ┌──────▼──────┐
                     │   Traefik   │  Coolify's proxy (Let's Encrypt certificates)
                     └──┬───────┬──┘
     sidequest.fentorweb.hu   sidequest-api.fentorweb.hu
          ┌─────▼─────┐       ┌─────▼─────┐
          │    web    │       │    api    │──── PostGIS
          │ (Node.js) │       │ (Django)  │
          └───────────┘       └───────────┘
```

| | Address | Image |
|---|---|---|
| Web app | `https://sidequest.fentorweb.hu` | `apps/web-server/Dockerfile` (build context: repository root) |
| API | `https://sidequest-api.fentorweb.hu` | `backend/Dockerfile` (build context: `backend/`) |

The API has its own one-level name (`sidequest-api`, not `api.sidequest`)
because Cloudflare's free certificate covers `*.fentorweb.hu` but not deeper
names like `api.sidequest.fentorweb.hu`.

The iOS and Android apps are not deployed here: they are built and updated with
EAS (see "Mobile apps" below).

## How a deploy works

1. `git ship` merges your branch into `testing` and pushes it.
2. CI runs (`.github/workflows/ci.yml`). Only if it passes does
   `.github/workflows/deploy.yml` ask Coolify to deploy the API and the web app.
3. Coolify builds each image on the server, starts the new release next to the
   old one, and moves traffic once its health check (`/healthz`) passes. The
   API migrates the database when it starts (`backend/entrypoint.sh`).
4. If a build, a migration or a health check fails, the previous release keeps
   serving, and the workflow fails.

### Migrations

For a moment, the previous release serves with the migrated database, so a
migration must not break it:

- Adding a table, or a column that may be empty or has a default: fine.
- Removing or renaming a column or table: in two releases. Stop using it first;
  remove it in a later release.
- Making a column required: fill it in and write it everywhere first, then make
  it required in a later release.

## 1. Prepare the server (bfentorddns.zapto.org)

The server still has LUT Kyyti's old, stopped app and its database, kept as a
fallback. Leave both alone.

1. Check that nothing listens on ports 80, 443 and 8000, which Coolify needs:
   `sudo ss -ltnp | grep -E ':(80|443|8000) '`. If the old Kyyti nginx still
   runs, stop and disable it: `sudo systemctl disable --now nginx`.
2. Install Coolify (Docker comes with it):
   ```
   curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
   ```
3. Open `http://<server>:8000` and create the admin account **right away**:
   until then, anyone can.

## 2. DNS in Cloudflare (fentorweb.hu)

`bfentorddns.zapto.org` is a dynamic DNS name, so the server's IP address can
change. Point the records at the name instead of an IP:

| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | `sidequest` | `bfentorddns.zapto.org` | Proxied |
| CNAME | `sidequest-api` | `bfentorddns.zapto.org` | Proxied |
| CNAME | `sidequest-deploy` | `bfentorddns.zapto.org` | Proxied (Coolify's dashboard) |

SSL/TLS mode: **Full (strict)**. Ports 80 and 443 must reach the server.

If the server is behind a home router and you'd rather not forward ports, use a
**Cloudflare Tunnel** instead: Zero Trust › Networks › Tunnels, install
`cloudflared` on the server, and route the three names to
`http://localhost:80` (Traefik). Then no DNS records or open ports are needed.

## 3. In Coolify

1. Settings › Instance's Domain: `https://sidequest-deploy.fentorweb.hu`. Turn
   on two-factor authentication in your profile.
2. Settings › Notifications: at least failed deployments and backups.
3. Storages (S3) › Add: an S3-compatible bucket in the EU for backups.
4. Projects › Add: `Sidequest`, environment `staging`.

### a. The database

\+ New › Databases › PostgreSQL › **PostGIS** (18). Initial database:
`sidequest`. Start it and copy its **Postgres URL (internal)**. Backups › Add:
`0 3 * * *`, keep 14, with the S3 storage.

### b. The API

\+ New › Public Repository (or Private, with the GitHub App) › this repository:

- Branch `testing`, Build Pack **Dockerfile**, base directory `/backend`,
  Dockerfile `/Dockerfile`.
- Ports Exposes `8000`; leave Ports Mappings empty (needed for zero-downtime deploys).
- Domain: `https://sidequest-api.fentorweb.hu`.
- Healthcheck: on, path `/healthz`, port `8000`, start period `120` seconds.
- Turn **off** automatic deploys on push: the GitHub Action deploys once CI passes.

Environment variables:

| Variable | Value |
|---|---|
| `DJANGO_SECRET_KEY` | `python -c "import secrets; print(secrets.token_urlsafe(50))"` |
| `DATABASE_URL` | The database's internal URL, with `postgis://` instead of `postgres://` |
| `DJANGO_ALLOWED_HOSTS` | `sidequest-api.fentorweb.hu,localhost` (`localhost` for the health check) |
| `CSRF_TRUSTED_ORIGINS` | `https://sidequest-api.fentorweb.hu` (for the admin) |
| `CORS_ALLOWED_ORIGINS` | `https://sidequest.fentorweb.hu` |
| `FRONTEND_URL` | `https://sidequest.fentorweb.hu` |
| `CACHE_URL` | `dbcache://django_cache`, so rate limits are shared by all of the API's processes (the table is created on start) |
| `ALLAUTH_TRUSTED_CLIENT_IP_HEADER` | `CF-Connecting-IP` (the visitor's address behind Cloudflare, for sign-in rate limits) |
| `ACCOUNT_EMAIL_VERIFICATION` | `optional` on staging |
| `MAILER_BACKEND` | Leave unset (emails go to the log) until an email service is chosen |
| `SENTRY_DSN`, `SENTRY_ENVIRONMENT` | Optional: Sentry's DSN, and `staging` |
| `AWS_STORAGE_BUCKET_NAME`, `AWS_S3_ENDPOINT_URL`, `AWS_S3_REGION_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Optional: object storage for uploads. Without them, uploads are stored in the container, so also add Persistent Storage › Directory Mount `/srv/sidequest/staging/media` → `/app/media` |

Scheduled tasks: the ones in [CRONJOBS.md](CRONJOBS.md).

### c. The web app

\+ New › the same repository:

- Branch `testing`, Build Pack **Dockerfile**, base directory `/`,
  Dockerfile `/apps/web-server/Dockerfile`.
- Ports Exposes `3000`. Domain: `https://sidequest.fentorweb.hu`.
- Healthcheck: path `/healthz`, port `3000`.
- Automatic deploys on push: off.
- Environment variable `EXPO_PUBLIC_API_URL` = `https://sidequest-api.fentorweb.hu`,
  marked as **Build Variable** (it's inlined into the bundle at build time).

### d. GitHub

1. Coolify › Keys & Tokens › API Tokens: a token named `github-actions` with
   the **deploy** and **read** permissions.
2. GitHub › the repository's Settings › Secrets and variables › Actions:
   - Secret `COOLIFY_TOKEN`: the token.
   - Variables `COOLIFY_URL` (`https://sidequest-deploy.fentorweb.hu`),
     `COOLIFY_STAGING_API_UUID` and `COOLIFY_STAGING_WEB_UUID` (each app's UUID
     is in its URL in Coolify).
3. Settings › Branches: protect `testing` and `main`, requiring the CI checks.
4. Settings › General › Pull Requests: allow only **squash merging**, so a pull
   request's title becomes its commit message (release-please reads it).

Then run **Deploy with Coolify** from the Actions tab once, and create the admin
account in the API's Terminal in Coolify: `python manage.py createsuperuser`.

## Running a command in the API

Coolify › Sidequest › staging › the API › **Terminal**, then e.g.
`python manage.py changepassword <email>` or `python manage.py shell`.

## Rolling back

The app's **Rollback** lists earlier images; one click switches back the same
way a deploy does. Migrations are not undone (see "Migrations").

## Mobile apps

The iOS and Android apps are built with [EAS](https://docs.expo.dev/eas/) (see
`apps/app/eas.json`), not Coolify. A staging build points at
`https://sidequest-api.fentorweb.hu` and receives over-the-air updates from the
`staging` channel. Store releases come later.
