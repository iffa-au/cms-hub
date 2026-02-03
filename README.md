## CMS Hub (IFFA)

Production-ready monorepo for the IFFA CMS platform, containing:
- **client**: Next.js 16 application (App Router, TypeScript, Tailwind).
- **backend**: Express + TypeScript API with MongoDB (Mongoose), JWT auth and hardened CORS.

### Tech Stack
- **Frontend**: Next.js, React 19, TypeScript, Tailwind CSS, React Hook Form, Zod, TanStack Query.
- **Backend**: Node.js, Express 5, Mongoose 9, JWT, Helmet, CORS, Zod.
- **Infra/Hosting**: AWS Amplify for the web app. Backend can run on any Node host (e.g. App Runner/EC2/ECS).

### Repository Structure
.
├─ backend/            # Express API (TypeScript)
│  ├─ src (TS files)   # controllers, models, middlewares, routes
│  ├─ dist/            # built JS
│  └─ env.example      # backend env template
├─ client/             # Next.js app (App Router)
│  └─ env.example      # client env template
└─ amplify.yml         # Amplify monorepo config (builds client/)

### Prerequisites
- Node.js 20+ and npm.
- A MongoDB instance (Atlas or self-hosted).

### Configuration
Copy and fill environment files:
- Backend: copy `backend/env.example` to `backend/.env` and set values.
- Client: copy `client/env.example` to `client/.env.local` and set values.

Key variables:
- Backend
  - `MONGO_URI`: MongoDB connection string.
  - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`: strong random strings.
  - `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL`: e.g. `15m`, `14d`.
  - `CLIENT_URL`: primary frontend origin (kept for backward-compat CORS).
  - `ALLOWED_ORIGINS`: comma-separated list of extra origins allowed by CORS (e.g. `https://iffa.com.au,https://admin.example.com`).
- Client
  - `NEXT_PUBLIC_BACKEND_URL`: base URL of the API, without trailing slash (e.g. `https://api.example.com`).

### Run Locally
Backend:
```bash
cd backend
npm ci
npm run dev        # ts-node + nodemon
# build & start:
npm run build && npm start
```

Client:
```bash
cd client
npm ci
npm run dev
# production build:
npm run build && npm start
```

### API Base URL
All routes are served under `/api/v1`. Example:
GET {BACKEND}/api/v1/health
POST {BACKEND}/api/v1/auth/login

Authentication:
- Login returns a short-lived `accessToken` (Bearer) and sets a `refreshToken` HTTP-only cookie.
- For cross-site requests, prefer sending the `accessToken` as a Bearer header. If you choose to use refresh cookies cross-site, ensure client requests use `credentials: 'include'` and consider cookie `sameSite=none; secure` in production.

### CORS
The backend composes an allowlist from:
- Local dev defaults,
- `CLIENT_URL` (if set),
- `ALLOWED_ORIGINS` (comma-separated).

To allow another website (e.g. `https://iffa.com.au`) to call the API, add it to `ALLOWED_ORIGINS` and redeploy the backend.

### Deploy: AWS Amplify (Web App)
This repository includes a root `amplify.yml` configured for a monorepo:
version: 1
applications:
  - appRoot: client
    frontend:
      phases:
        preBuild:
          commands:
            - npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: .next
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*

Notes:
- If you enable Monorepo in the Amplify UI, set Root directory to `client/`. Do not duplicate configuration—prefer the file above as the source of truth.
- If you run the app as static hosting, ensure the root page emits an `index.html` (the app currently uses a client-side redirect at `/` to avoid 404s). For SSR hosting, enable Amplify’s Next.js SSR.

### Common Scripts
- Backend
  - `npm run dev` — start API in watch mode.
  - `npm run build` — TypeScript compile to `dist/`.
  - `npm start` — run compiled server.
- Client
  - `npm run dev` — Next.js dev server.
  - `npm run build` — production build.
  - `npm start` — run production server.
  - `npm run lint` — lint.

### Coding Standards
- TypeScript across client and server.
- Prefer strict typing, early returns, minimal global state.
- Keep comments focused on non-obvious rationale and invariants.

### Troubleshooting
- 404 on Amplify root domain: ensure the root page emits static content or enable SSR. The app includes a client-side redirect at `/`.
- Next.js build error about `useSearchParams()` and Suspense: wrap the page in a `<Suspense>` boundary or mark the route as dynamic as implemented for `/login`.
- CORS blocked: verify `CLIENT_URL`/`ALLOWED_ORIGINS` and redeploy the backend.
