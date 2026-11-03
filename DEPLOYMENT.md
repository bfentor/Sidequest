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
                     │    nginx    │  the server's own proxy (HTTPS), shared with other sites
                     └──────┬──────┘
                     ┌──────▼──────┐
                     │   Traefik   │  Coolify's proxy, on 127.0.0.1:8880 only
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

The server's nginx stays where it is: it serves other sites on ports 80 and
443, and passes the Sidequest names on to Coolify's Traefik, which listens only
on `127.0.0.1:8880` (see "4. nginx" below).

1. Check that the ports Coolify uses itself are free: 8000 (its dashboard),
   6001 and 6002 (live updates and the terminal) and 8880 (Traefik):
   `sudo ss -ltnp | grep -E ':(8000|6001|6002|8880) '`.
2. Install Coolify (Docker comes with it):
   ```
   curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
   ```
   Its proxy (Traefik) can't start yet, because nginx has ports 80 and 443.
   That's expected; step 3 moves it.
3. Open `http://<server>:8000` and create the admin account **right away**:
   until then, anyone can. Then Servers › localhost › Proxy: stop the proxy,
   and in its configuration
   - replace the `80:80` and `443:443` port mappings with one,
     `127.0.0.1:8880:80`, so Traefik is reachable only through nginx;
   - add `--entrypoints.http.forwardedHeaders.trustedIPs=127.0.0.1/32,172.16.0.0/12`
     to its command. Traefik then keeps nginx's `X-Forwarded-Proto: https`
     instead of replacing it with `http`; without it, the API would hand out
     `http://` links to pictures, which browsers block on an HTTPS page.

   Start the proxy again.

## 2. DNS in Cloudflare (fentorweb.hu)

`bfentorddns.zapto.org` is a dynamic DNS name, so the server's IP address can
change. Point the records at the name instead of an IP:

| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | `sidequest` | `bfentorddns.zapto.org` | Proxied |
| CNAME | `sidequest-api` | `bfentorddns.zapto.org` | Proxied |
| CNAME | `sidequest-deploy` | `bfentorddns.zapto.org` | Proxied (Coolify's dashboard) |

SSL/TLS mode: **Full (strict)**. Ports 80 and 443 already reach nginx.

For nginx's side of HTTPS, create a **Cloudflare Origin Certificate**: SSL/TLS ›
Origin Server › Create Certificate, for `*.fentorweb.hu` and `fentorweb.hu`
(valid 15 years, nothing to renew; Cloudflare trusts it, browsers only ever see
Cloudflare's certificate). Save the certificate and key on the server, e.g. in
`/etc/ssl/cloudflare/fentorweb.hu.pem` and `.key` (key readable by root only).

## 3. In Coolify

HTTPS ends at nginx, so every domain entered in Coolify starts with `http://`:
with `https://`, Traefik would try to get its own certificates and fail.
Visitors still only ever use HTTPS (Cloudflare and nginx see to it).

1. Settings › Instance's Domain: `http://sidequest-deploy.fentorweb.hu`. Turn
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
- Domain: `http://sidequest-api.fentorweb.hu`.
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
| `API_URL` | `https://sidequest-api.fentorweb.hu` (for unsubscribe links in emails) |
| `CACHE_URL` | `dbcache://django_cache`, so rate limits are shared by all of the API's processes (the table is created on start) |
| `ALLAUTH_TRUSTED_CLIENT_IP_HEADER` | `CF-Connecting-IP` (the visitor's address behind Cloudflare, for sign-in rate limits) |
| `MAILER_BACKEND` | Leave unset (emails go to the log) until an email service is chosen |
| `ACCOUNT_EMAIL_VERIFICATION` | `optional` until an email service is set up: without one, sign-up codes only reach the API's log, so testers couldn't finish signing up. Remove it (back to mandatory) once emails are sent |
| `EXPO_ACCESS_TOKEN` | Optional: needed only if "enhanced push security" is turned on for the Expo project |
| `SENTRY_DSN`, `SENTRY_ENVIRONMENT` | Optional: Sentry's DSN, and `staging` |
| `AWS_STORAGE_BUCKET_NAME`, `AWS_S3_ENDPOINT_URL`, `AWS_S3_REGION_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Optional: object storage for uploads. Without them, uploads are stored in the container, so also add Persistent Storage › Directory Mount `/srv/sidequest/staging/media` → `/app/media` |

Scheduled tasks: the ones in [CRONJOBS.md](CRONJOBS.md).

### c. The web app

\+ New › the same repository:

- Branch `testing`, Build Pack **Dockerfile**, base directory `/`,
  Dockerfile `/apps/web-server/Dockerfile`.
- Ports Exposes `3000`. Domain: `http://sidequest.fentorweb.hu`.
- Healthcheck: path `/healthz`, port `3000`.
- Automatic deploys on push: off.
- Environment variables `EXPO_PUBLIC_API_URL` = `https://sidequest-api.fentorweb.hu`
  and `EXPO_PUBLIC_WEB_URL` = `https://sidequest.fentorweb.hu` (used in shared
  links), both marked as **Build Variable** (they're inlined into the bundle at
  build time).

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

5. Create the `testing` branch once, which `git ship` merges into and staging
   deploys from: `git push origin master:testing`.

Then run **Deploy with Coolify** from the Actions tab once (or `git ship` from
your branch), and create the admin account in the API's Terminal in Coolify:
`python manage.py createsuperuser`.

## 4. nginx

One server block sends all three names to Traefik, which routes them on to the
right app (and keeps deploys without downtime). Save it as
`/etc/nginx/sites-available/sidequest`, link it into `sites-enabled`, then
`sudo nginx -t && sudo systemctl reload nginx`:

```nginx
# Sidequest (staging), deployed with Coolify: nginx handles HTTPS, Coolify's
# Traefik (127.0.0.1:8880) picks the app by name. See DEPLOYMENT.md.
map $http_upgrade $sidequest_connection {
    default upgrade;
    ''      close;
}

server {
    listen 80;
    listen [::]:80;
    server_name sidequest.fentorweb.hu sidequest-api.fentorweb.hu sidequest-deploy.fentorweb.hu;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name sidequest.fentorweb.hu sidequest-api.fentorweb.hu sidequest-deploy.fentorweb.hu;

    ssl_certificate     /etc/ssl/cloudflare/fentorweb.hu.pem;
    ssl_certificate_key /etc/ssl/cloudflare/fentorweb.hu.key;

    # Pictures are uploaded up to 10 MB (nginx allows only 1 MB by default).
    client_max_body_size 12m;

    location / {
        proxy_pass http://127.0.0.1:8880;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        # Coolify's dashboard keeps live connections (websockets) open.
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $sidequest_connection;
        proxy_read_timeout 300s;
    }
}
```

There's no `http2` here on purpose: Cloudflare already speaks HTTP/2 to
visitors, and on nginx before 1.25.1 it's an option of the whole port, so it
would change the server's other sites on 443 too.

### Or with certbot instead of the Origin Certificate

If you'd rather use Let's Encrypt like the server's other sites, save only the
`map` and a single port-80 `server` block with the same `server_name`,
`client_max_body_size` and `location` (no certificate lines), reload nginx,
then run:

```
sudo certbot --nginx -d sidequest.fentorweb.hu -d sidequest-api.fentorweb.hu -d sidequest-deploy.fentorweb.hu
```

Certbot adds the HTTPS part and the redirect itself. Let's Encrypt checks each
name over plain HTTP, though, which Cloudflare's proxy can get in the way of
(e.g. with SSL/TLS › Edge Certificates › **Always Use HTTPS** on), now and at
every renewal (every 60 days or so). If it fails, either switch those three
records to "DNS only" while certbot runs, or use the Origin Certificate, which
never needs renewing.

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

### Google Maps key (Android)

The nearby map uses Apple Maps on iOS (no key needed), OpenStreetMap on the
web, and Google Maps on Android, which needs an API key:

1. In Google Cloud, enable **Maps SDK for Android** and create an API key
   restricted to Android apps, listing each app ID
   (`hu.fentorweb.sidequest`, `.staging`, `.dev`) with its SHA-1 fingerprint
   (`npx eas-cli@latest credentials` shows it).
2. Store it as an EAS environment variable:
   `npx eas-cli@latest env:create --name GOOGLE_MAPS_ANDROID_API_KEY --value <key> --environment preview --environment production --environment development --visibility sensitive`.
3. Make a new build; the key is baked into the native app.

Without it, the map on Android stays blank; the list still works.
