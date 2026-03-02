# CMS Hub Backend

Express + TypeScript backend for the CMS Hub project.

## Tech Stack

- Node.js + Express
- TypeScript
- MongoDB + Mongoose
- JWT authentication
- Cookie-based auth support
- CORS, Helmet, Morgan

## Project Structure

```text
backend/
  config/          # Database config
  controllers/     # Request handlers
  libs/            # Shared libraries/utilities
  middlewares/     # Auth + validation middleware
  models/          # Mongoose models
  routes/          # API route modules
  utils/           # Helper utilities
  index.ts         # App entrypoint
```

## Prerequisites

- Node.js 18+ (recommended)
- npm
- MongoDB connection string

## Installation

```bash
npm install
```

## Environment Variables

1. Copy environment template:

```bash
cp env.example .env
```

2. Fill required values in `.env`.

### Main Variables

- `NODE_ENV` - Application environment (e.g. `development`)
- `PORT` - Server port (default: `8000`)
- `MONGO_URI` - MongoDB connection string
- `CLIENT_URL` - Primary frontend origin for CORS
- `ALLOWED_ORIGINS` - Extra allowed origins (comma-separated)
- `JWT_ACCESS_SECRET` - Access token secret
- `JWT_REFRESH_SECRET` - Refresh token secret
- `ACCESS_TOKEN_TTL` - Access token lifetime (e.g. `15m`)
- `REFRESH_TOKEN_TTL` - Refresh token lifetime (e.g. `14d`)

### Optional Mail/Validation Variables

- `ARCJET_KEY`
- `MAILCHIMP_TX_API_KEY`
- `MAIL_FROM_EMAIL`
- `MAIL_FROM_NAME`
- `MAILCHIMP_TO_IFFA_EMAIL`
- `MC_TEMPLATE_SLUG`

## Available Scripts

- `npm run dev` - Start development server with `nodemon` + `ts-node`
- `npm run build` - Compile TypeScript into `dist/`
- `npm start` - Run compiled app from `dist/index.js`

## Running Locally

Development mode:

```bash
npm run dev
```

Build and run production mode:

```bash
npm run build
npm start
```

Server starts on:

- `http://localhost:8000` (or `PORT` from `.env`)

Health check endpoint:

- `GET /api/v1/health`

## Authentication and Authorization

Protected endpoints require:

- `Authorization: Bearer <accessToken>`

Token flow:

- Access token is returned from `POST /api/v1/auth/register` and `POST /api/v1/auth/login`
- Refresh token is stored in HTTP-only cookie `refreshToken`
- Get a new access token via `POST /api/v1/auth/refresh`

Roles:

- `user` - standard authenticated user
- `staff` - elevated access for review-related APIs
- `admin` - full administrative access

## Data Entities

This section describes the main entities used by the API.

### User

Represents a CMS account.

Key fields:

- `email` (unique, required)
- `password` (hashed, not returned by default)
- `role` (`user | staff | admin`)
- `fullName`, `profilePicture`, `bio`, `phoneNumber`

### Submission

Represents a film submission.

Key fields:

- `creatorId` (`User` reference, required)
- `title`, `synopsis`, `releaseDate` (required)
- `languageId`, `countryId`, `contentTypeId` (required references)
- `genreIds` (`Genre[]`)
- `status` (`SUBMITTED | APPROVED | REJECTED`)
- `isFeatured`
- `productionHouse`, `distributor`, `imdbUrl`, `trailerUrl`
- `crew` (embedded grouped arrays: `actors`, `directors`, `producers`, `other`)

### FilmEnquiry

Represents a public film enquiry form submission.

Key fields:

- Contact: `name`, `email`, `role`
- Film: `title`, `synopsis`, `productionHouse`, `distributor`, `releaseDate`, `trailerUrl`
- Taxonomy refs: `contentType`, `genreIds`, `country`, `language`

### Nomination

Represents a nomination of a submission in an award category.

Key fields:

- `submissionId` (`Submission` reference)
- `awardCategoryId` (`AwardCategory` reference)
- `year`
- `isWinner`
- `crewMemberId` (`CrewMember` reference, optional)

### CrewMember

Represents a person in cast/crew directory.

Key fields:

- `name` (required)
- `biography`, `profilePicture`, `instagramUrl`, `description`

### CrewRole

Represents a role label (for example: Director, Producer, Actor).

Key fields:

- `name` (unique, required)
- `description`

### CrewAssignment

Join entity between submission, crew member, and role.

Key fields:

- `submissionId`
- `crewMemberId`
- `crewRoleId`

Unique index:

- (`submissionId`, `crewMemberId`, `crewRoleId`)

### Lookup Entities

Simple taxonomy/reference entities:

- `Language`
- `Country`
- `Genre`
- `ContentType`
- `AwardCategory`

Each has:

- `name` (unique, required)
- `description` (optional)

## API Documentation

### Base URL

- `http://localhost:8000/api/v1`

### Health Check

- `GET /health` - server health endpoint

### Auth Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/auth/register` | Public | Register account, returns access token + refresh cookie |
| POST | `/auth/login` | Public | Login, returns access token + refresh cookie |
| POST | `/auth/refresh` | Public (refresh cookie) | Rotate refresh token, return new access token |
| POST | `/auth/logout` | Public | Clear refresh token cookie |

### User Profile Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/users/me` | Bearer token | Get current user profile |
| PUT | `/users/me` | Bearer token | Update current user profile |

### Submission Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/submissions/public` | Public | Public film submission |
| GET | `/submissions/:id/overview` | Public | Public-friendly submission overview |
| GET | `/submissions/:id` | Public | Get submission detail by id |
| GET | `/submissions/my/list` | Bearer token | List current user's submissions |
| PUT | `/submissions/:id` | Bearer token | Update submission |
| POST | `/submissions` | Admin/Staff | Create submission via admin/staff panel |
| GET | `/submissions` | Admin/Staff | Admin/staff list submissions |
| PATCH | `/submissions/:id/approve` | Admin/Staff | Approve a submission |
| PATCH | `/submissions/:id/reject` | Admin/Staff | Reject a submission |
| DELETE | `/submissions/:id` | Admin/Staff | Delete a submission |

### Film Enquiry Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/film-enquiries` | Public | Submit film enquiry form |
| GET | `/film-enquiries` | Admin | List film enquiries |
| GET | `/film-enquiries/:id` | Admin | Get film enquiry by id |
| PUT | `/film-enquiries/:id` | Admin | Update film enquiry |
| DELETE | `/film-enquiries/:id` | Admin | Delete film enquiry |
| GET | `/getfilmenquiry/:id` | Admin | Alternate admin endpoint to fetch enquiry by id |

### Nomination Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/nominations` | Admin/Staff | List nominations |
| GET | `/nominations/:id` | Public | Get nomination by id |
| POST | `/nominations` | Admin | Create nomination |
| PUT | `/nominations/:id` | Admin | Update nomination |
| DELETE | `/nominations/:id` | Admin | Delete nomination |

### Crew Member/Role/Assignment Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/crew-members` | Public | List crew members |
| GET | `/crew-members/:id` | Public | Get crew member by id |
| POST | `/crew-members` | Bearer token | Create crew member |
| PUT | `/crew-members/:id` | Bearer token | Update crew member |
| DELETE | `/crew-members/:id` | Bearer token | Delete crew member |
| GET | `/crew-roles` | Public | List crew roles |
| GET | `/crew-roles/:id` | Public | Get crew role by id |
| POST | `/crew-roles` | Admin | Create crew role |
| PUT | `/crew-roles/:id` | Admin | Update crew role |
| DELETE | `/crew-roles/:id` | Admin | Delete crew role |
| GET | `/crew-assignments` | Public | List crew assignments |
| GET | `/crew-assignments/:id` | Public | Get crew assignment by id |
| POST | `/crew-assignments` | Admin | Create crew assignment |
| PUT | `/crew-assignments/:id` | Admin | Update crew assignment |
| DELETE | `/crew-assignments/:id` | Admin | Delete crew assignment |

### Lookup Endpoints

The following resources share the same CRUD pattern:

- `/languages`
- `/content-types`
- `/countries`
- `/genres`
- `/award-categories`

For each resource:

| Method | Path | Description |
| --- | --- | --- |
| GET | `/<resource>` | List all |
| GET | `/<resource>/:id` | Get one |
| POST | `/<resource>` | Create |
| PUT | `/<resource>/:id` | Update |
| DELETE | `/<resource>/:id` | Delete |

Note: Some lookup write routes currently have auth checks temporarily disabled for integration testing.

## Example Requests

### Register

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "fullName": "Jane Doe",
  "email": "jane@example.com",
  "password": "password123"
}
```

### Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "jane@example.com",
  "password": "password123"
}
```

### Public Submission (minimal payload)

```http
POST /api/v1/submissions/public
Content-Type: application/json

{
  "title": "My Film",
  "synopsis": "Film synopsis",
  "releaseDate": "2026-01-01",
  "languageId": "<languageId>",
  "countryId": "<countryId>",
  "contentTypeId": "<contentTypeId>",
  "genreIds": ["<genreId>"]
}
```

## Notes

- Make sure MongoDB is reachable before starting the server.
- Keep `.env` out of version control.
- CORS allowlist is composed from built-in local URLs, `CLIENT_URL`, and `ALLOWED_ORIGINS`.
- API responses are not fully standardized yet across all controllers.
