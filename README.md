# Costaff ATS

Applicant tracking system for a staffing company. Next.js 15 (App Router), React 19, TypeScript, Prisma 7, PostgreSQL.

## Run locally

1. Copy `.env.example` to `.env` and set `DATABASE_URL` and `SESSION_SECRET`.
2. Install dependencies: `npm install`
3. Apply migrations: `npx prisma migrate deploy`
4. Generate the client: `npx prisma generate`
5. Start the app: `npm run dev`

Master data seeds (demand categories, phases, locations, demand types, interview statuses, skill classifications) are inserted by `prisma/migrations/20261107120000_master_data_management` and do not wipe existing rows.

## Checks

- `npx tsc --noEmit`
- `npm test`

## Deploy with Docker Compose

This stack is self-contained and named `costaff-ats` (app image `costaff-ats`, containers `costaff-ats-app` and `costaff-ats-db`). It is the isolated test deploy for this project.

1. Copy `.env.example` to `.env`.
2. Set `POSTGRES_PASSWORD` to a URL-safe password (letters and numbers). Compose builds `DATABASE_URL` from `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB`, using the hostname `costaff-ats-db`. A `DATABASE_URL` line in `.env` is not what the app container receives.
3. Set `SESSION_SECRET` to a new value from `openssl rand -base64 48`. Leave SMTP blank unless you want real mail. Leave `COOKIE_SECURE` unset: the session cookie is Secure only on HTTPS (including `x-forwarded-proto: https`). An HTTP test host stores it without that flag. Set `COOKIE_SECURE=true` or `COOKIE_SECURE=false` only when that detection is wrong.
4. Build and start:

```bash
docker compose up --build
```

The image build command on its own is `docker compose build` (or `docker build -t costaff-ats .`). The runtime image includes `public/` and `scripts/`, so onboarding uploads and `npm run create-super-admin` are available inside the container.

On every start, `docker/costaff-ats-entrypoint.sh` runs `npx prisma migrate deploy` and then `next start` on `0.0.0.0:3000`. Postgres data is the volume `costaff-ats-postgres-data`. Onboarding files written under `public/uploads` are the volume `costaff-ats-uploads`. The app is healthy when `GET /api/health` can reach Postgres.

Create the existing test super admin after the app is up (the script is unchanged):

```bash
docker compose exec costaff-ats-app npm run create-super-admin
```

SMTP is optional. With `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` empty, outgoing mail is written to the container log instead of sent.

Demo records for clicking through the demand stages:

```bash
npm run seed:dummy
npm run seed:dummy:clear
```

`seed:dummy` is safe to run again. It writes demands `CSF-DUMMY-*`, users `@costaff-demo.in`, and candidates `@dummymail.in`. Those users share the password in `scripts/seedDummyData.ts`. `seed:dummy:clear` deletes only that set. It does not change `superadmin@gmail.com`.
