# Backend server

Express 5 + MongoDB (Mongoose) API server written in TypeScript (ESM).

## Routes

| Method | Path          | Description                                                  |
| ------ | ------------- | ------------------------------------------------------------ |
| `GET`  | `/api/health` | `{ status: "ok", mongo: "ok" }`, or `503` if MongoDB is down |

Errors are returned as JSON: `{ "error": "message", "details"?: ... }`.

## Local setup

```bash
# 1. Start MongoDB (or use MongoDB Atlas via MONGODB_URI / DATABASE_URL in server/.env)
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
