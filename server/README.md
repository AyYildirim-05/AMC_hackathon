# Backend server

Express 5 + MongoDB (Mongoose) API server written in TypeScript (ESM).

## Routes

| Method | Path                     | Description                                                                 |
| ------ | ------------------------ | --------------------------------------------------------------------------- |
| `GET`  | `/api/health`            | `{ status: "ok", mongo: "ok" }`, or `503` if MongoDB is down                |
| `POST` | `/api/uploads/signature` | Return a signed Cloudinary upload payload (`folder`: `issues` \| `avatars`) |

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
in `.env` (on a physical device use your machine's LAN IP; on the Android emulator use `10.0.2.2`).

## Environment variables

| Variable                   | Default                         | Purpose                                                        |
| -------------------------- | ------------------------------- | -------------------------------------------------------------- |
| `PORT`                     | `4000`                          | HTTP port                                                      |
| `CORS_ORIGIN`              | `http://localhost:8081`         | Comma-separated allowed origins                                |
| `MONGODB_URI`              | `mongodb://localhost:27017/app` | MongoDB connection string (falls back to `DATABASE_URL`)       |
| `TRUST_PROXY`              | `0`                             | Proxy hops in front of the server                              |
| `CLOUDINARY_CLOUD_NAME`    | _(optional)_                    | Cloudinary cloud name for signed image uploads                 |
| `CLOUDINARY_API_KEY`       | _(optional)_                    | Cloudinary API key                                             |
| `CLOUDINARY_API_SECRET`    | _(optional)_                    | Cloudinary API secret (kept server-side only in `server/.env`) |
| `CLOUDINARY_UPLOAD_FOLDER` | `issues`                        | Default Cloudinary folder for uploaded images                  |

## Scripts (in `server/`)

| Command             | Description                         |
| ------------------- | ----------------------------------- |
| `npm run dev`       | Start dev server with `tsx watch`   |
| `npm run build`     | Compile TypeScript to `dist/`       |
| `npm start`         | Run compiled `dist/index.js`        |
| `npm test`          | Run tests (`node:test` + supertest) |
| `npm run typecheck` | Type-check with `tsc --noEmit`      |
