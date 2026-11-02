# Sidequest

An event dashboard for students. One codebase ships to the **App Store**, **Google Play** and the **web**, backed by a Django API.

The app has three feeds:

| Feed | What it shows | Ordering |
|---|---|---|
| **Upcoming** | Ongoing and future events | Soonest first |
| **Nearby** | Ongoing and future events within a radius | Nearest first (PostGIS) |
| **Following** | Posts and events from people and organizations you follow | Newest first |

## Repository layout

```
apps/app/          Expo (React Native) app: iOS, Android and web
apps/web-server/   Node server for the exported web build (production only)
packages/api/      Typed API client, generated from the backend's OpenAPI schema
backend/           Django + Django REST Framework + PostGIS
docker-compose.yml PostGIS and the API for local development
```

### Backend (`backend/`)

Each Django app has a single responsibility:

| App | Contents |
|---|---|
| `accounts` | `User`, a login account identified by email. Nothing public lives here. |
| `profiles` | `Profile`, the public identity that posts and gets followed. Every user has a *person* profile. *Organization* profiles are run by users through `Membership`. Also `Follow`. |
| `events` | `Event`, with an optional geographic `location`. Publishing an event also creates an announcement `Post`, so followers see it. |
| `posts` | `Post`: a text update, a linked event, or both. |
| `feeds` | The three feed endpoints. No models. |

Authorship and following always point at a `Profile`, so people and organizations behave the same everywhere. Clients choose which profile to act as with `organizer_handle` / `author_handle`, which defaults to your own profile. They may use any profile they manage.

Authentication uses [django-allauth's headless API](https://docs.allauth.org/en/latest/headless/). Signing in returns a session token, which every client sends as the `X-Session-Token` header.

### Shared API client (`packages/api/`)

`src/generated/` is produced by [Hey API](https://heyapi.dev) from `backend/openapi.yaml`. It contains TypeScript types, one function per endpoint, and TanStack Query helpers. Don't edit it by hand. Code written by hand lives next to it:

- `auth.ts`: sign up, sign in and sign out through allauth.
- `feeds.ts`: infinite-scrolling hooks for the three feeds.
- `config.ts`: `configureApi()`, which sets the base URL and session token.

Any future frontend (an admin dashboard, a Next.js site) can reuse this package.

### App (`apps/app/`)

Expo SDK 58 with Expo Router. Routes live in `src/app/`. Everything else lives in `src/` (`components/`, `auth/`, `hooks/`, `lib/`, `navigation/`).

Code that differs by platform uses Expo's file extensions instead of runtime checks:

- `navigation/app-tabs.tsx`: the native tab bar on iOS and Android.
- `navigation/app-tabs.web.tsx`: a sidebar on desktop and a bottom bar on phones. The switch is a CSS media query, so server-rendered and client-rendered markup match.
- `auth/token-storage.ts` / `.web.ts`: the session token is kept in the Keychain / Keystore on mobile and in `localStorage` on the web.

## Getting started

**Prerequisites:** Node 22+, [uv](https://docs.astral.sh/uv/), and Docker. If you'd rather not use Docker, you need PostgreSQL with PostGIS and GDAL installed locally.

```sh
npm install                                 # JS dependencies for all workspaces

# Backend
docker compose up -d db                     # PostGIS on localhost:5433
cd backend
cp .env.example .env
uv sync
uv run python manage.py migrate
uv run python manage.py seed_demo           # optional: demo@sidequest.test / sidequest-demo
uv run python manage.py createsuperuser     # optional: for /admin/
uv run python manage.py runserver
cd ..

# App
cp apps/app/.env.example apps/app/.env.local
npm run app                                 # w = web, i = iOS simulator, a = Android emulator
```

The app opens in a development build by default (`expo-dev-client`); press `s` in the terminal to switch to Expo Go. A development build for your phone: `cd apps/app && npx eas-cli build --profile development`.

You can also run `docker compose up` to start both PostGIS and the API in containers.

**Without Docker:** you can use a locally installed PostgreSQL with the PostGIS extension instead of the `db` container. Create the role and database once:

```sh
psql -U postgres -c "create role sidequest login superuser password 'sidequest';" -c "create database sidequest owner sidequest;"
```

Then set the port in `backend/.env`'s `DATABASE_URL` to `5432`. The role is a superuser only so Django can enable PostGIS and the tests can create their own database. That's fine for a local development database, but never do it in production.

Useful URLs while the backend runs:

- http://localhost:8000/api/docs/: interactive API docs (Swagger)
- http://localhost:8000/_allauth/openapi.html: auth API docs
- http://localhost:8000/admin/: Django admin

## Changing the API

1. Change models, serializers and views in `backend/`, then run `uv run python manage.py makemigrations`.
2. Regenerate the schema: `uv run python manage.py spectacular --file openapi.yaml --validate` (from `backend/`).
3. Regenerate the client: `npm run api:generate` (from the repo root).
4. Run `npm run typecheck`. TypeScript then points to every place in the app that needs updating.

CI fails if `openapi.yaml` or the generated client is out of date.

## Checks

```sh
cd backend && uv run pytest && uv run ruff check . && uv run ruff format --check .
npm run typecheck && npm run lint
```

## Releasing

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org): `feat(events): add RSVP buttons`, `fix: crash on sign out`, `docs: …`. `scripts/git-ship` (set up once with `git config alias.ship '!scripts/git-ship'`) asks for the type, scope and description, commits, and ships your branch to `testing`:

1. CI runs on `testing`. When it passes, staging is deployed (`.github/workflows/deploy.yml`, see [DEPLOYMENT.md](DEPLOYMENT.md)).
2. release-please keeps a pull request open titled `chore: release X.Y.Z`. It bumps the version in every file that holds it and adds the changes to `CHANGELOG.md`. `fix` bumps the patch version, `feat` the minor version, and a breaking change (`feat!: …`) the major version. Before 1.0.0, breaking changes bump the minor version instead.
3. Merging that pull request tags `vX.Y.Z` and creates a GitHub Release.

Pull requests are squash-merged, so their title is the commit message; CI checks that it follows the format.

## Shipping

- **iOS and Android:** built with [EAS](https://docs.expo.dev/eas/). `apps/app/eas.json` has three profiles, `development`, `staging` and `production`; `app.config.ts` gives each its own name and app ID (`hu.fentorweb.sidequest[.dev|.staging]`). Link the project once with `cd apps/app && npx eas-cli init`. After CI passes on `testing`, `.github/workflows/eas-update.yml` publishes the JavaScript to the `staging` update channel; when native code changes, make a new build with `npx eas-cli build --profile staging`.
- **API and web app:** deployed to staging with Coolify; see [DEPLOYMENT.md](DEPLOYMENT.md). Scheduled jobs are listed in [CRONJOBS.md](CRONJOBS.md).

## Next steps

See [TODO.md](TODO.md).
