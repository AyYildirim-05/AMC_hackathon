# Backend server

Express 5 + MongoDB (Mongoose) API server written in TypeScript (ESM).

## Routes

| Method   | Path                               | Description                                                                                                                                               |
| -------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/health`                      | `{ status: "ok", mongo: "ok" }`, or `503` if MongoDB is down                                                                                              |
| `POST`   | `/api/issues`                      | Report an issue                                                                                                                                           |
| `GET`    | `/api/issues`                      | All issues, newest first                                                                                                                                  |
| `GET`    | `/api/issues/:id`                  | One issue                                                                                                                                                 |
| `GET`    | `/api/issues/district/:districtId` | Issues in a district, newest first                                                                                                                        |
| `PATCH`  | `/api/issues/:id`                  | Edit details: the district manager, or the creator while `not_started`                                                                                    |
| `PATCH`  | `/api/issues/:id/status`           | Change status: the district manager only; `completed` and `cancelled` are final                                                                           |
| `GET`    | `/api/districts`                   | All districts, in French alphabetical order                                                                                                               |
| `POST`   | `/api/districts`                   | Create a district: admin only; may assign a manager                                                                                                       |
| `GET`    | `/api/districts/:id`               | One district                                                                                                                                              |
| `GET`    | `/api/districts/name/:name`        | District whose French or English name matches, ignoring case and accents                                                                                  |
| `PATCH`  | `/api/districts/:id`               | Details: its manager, or an admin while it has none. `managerId` (assign, reassign, `null` to remove): admin only. A manager manages at most one district |
| `DELETE` | `/api/districts/:id`               | Delete: its manager, or an admin while it has none; `409` while issues or residents reference it                                                          |

District writes take an `actorId` in the body: the person acting (no auth yet).

Request bodies and rules live in `src/services/issue.service.ts` and `src/services/district.service.ts`.

Errors are returned as JSON: `{ "error": "message", "details"?: ... }`.

## Local setup

```bash
# 1. Start MongoDB (or use MongoDB Atlas via MONGODB_URI / DATABASE_URL in the root .env)
npm run server:db

# 2. Install and run the Express server
cd server
npm install
npm run dev
```

Point the Expo app at `http://localhost:4000` by setting `EXPO_PUBLIC_API_URL=http://localhost:4000`
in `.env.local` (on a physical device use your machine's LAN IP; on the Android emulator use `10.0.2.2`).

## Environment variables

| Variable      | Default                         | Purpose                                                  |
| ------------- | ------------------------------- | -------------------------------------------------------- |
| `PORT`        | `4000`                          | HTTP port                                                |
| `CORS_ORIGIN` | `http://localhost:8081`         | Comma-separated allowed origins                          |
| `MONGODB_URI` | `mongodb://localhost:27017/app` | MongoDB connection string (falls back to `DATABASE_URL`) |
| `TRUST_PROXY` | `0`                             | Proxy hops in front of the server                        |

## Scripts (in `server/`)

| Command             | Description                         |
| ------------------- | ----------------------------------- |
| `npm run dev`       | Start dev server with `tsx watch`   |
| `npm run build`     | Compile TypeScript to `dist/`       |
| `npm start`         | Run compiled `dist/index.js`        |
| `npm test`          | Run tests (`node:test` + supertest) |
| `npm run typecheck` | Type-check with `tsc --noEmit`      |

`npm test` needs no database; the MongoDB-backed `test/*.db.test.ts` files are skipped unless
`TEST_MONGODB_URI` points at a MongoDB server. Each file creates and drops its own `<name>_test`
database there (see `test/test-db.ts`):

```bash
TEST_MONGODB_URI=mongodb://localhost:27017 npm test
```
