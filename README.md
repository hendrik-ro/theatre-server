[![CI](https://github.com/hendrik-ro/theatre-server/actions/workflows/ci.yml/badge.svg)](https://github.com/hendrik-ro/theatre-server/actions/workflows/ci.yml)
[![Release](https://github.com/hendrik-ro/theatre-server/actions/workflows/release.yml/badge.svg)](https://github.com/hendrik-ro/theatre-server/actions/workflows/release.yml)

Theatre Server
==============

The backend of Theatre, a movie-tracking app — built as a portfolio
project to showcase backend engineering: a well-layered REST API over
PostgreSQL with full CRUD, cookie-based JWT authentication, role-based
authorization, integration-tested against a real database, and automated
versioning and releases.

The Express API serves JSON at `/api/*` and pairs with the React SPA in
the [theatre-client](https://github.com/hendrik-ro/theatre-client)
repository; the backend is the focus of this project.

## API Overview

REST endpoints, versioned through semantic-release and JSON errors
throughout: `{ "message": string }`.

| Method | Route                      | Auth           | Description                                               |
| ------ | -------------------------- | -------------- | --------------------------------------------------------- |
| POST   | `/api/users/register`      | —              | Create an account and log in                              |
| POST   | `/api/users/login`         | —              | Log in                                                    |
| POST   | `/api/users/logout`        | session        | Revoke the refresh token, clear cookies                   |
| POST   | `/api/users/refresh`       | refresh cookie | Rotate the token pair                                     |
| GET    | `/api/users/me`            | session        | Current user profile                                      |
| DELETE | `/api/users/:id`           | self/admin     | Delete an account                                         |
| GET    | `/api/movies`              | —              | List all movies with community rating averages            |
| GET    | `/api/movies/meta`         | —              | Movie counts per year and genre                           |
| GET    | `/api/movies/:id`          | —              | Fetch one movie with community rating averages            |
| POST   | `/api/movies`              | session        | Create a movie                                            |
| PUT    | `/api/movies/:id`          | session        | Update a movie                                            |
| GET    | `/api/watchlists`          | session        | List the current user's watchlist                         |
| POST   | `/api/watchlists/:movieId` | session        | Add a movie to the watchlist                              |
| DELETE | `/api/watchlists/:movieId` | session        | Remove a movie from the watchlist                         |
| GET    | `/api/ratings`             | session        | List all ratings for the current user (sorted by movieId) |
| GET    | `/api/ratings/:movieId`    | session        | Get the user's rating for a movie                         |
| POST   | `/api/ratings/:movieId`    | session        | Rate or re-rate a movie (integer 0-10)                    |
| DELETE | `/api/ratings/:movieId`    | session        | Remove the user's rating                                  |
| GET    | `/api/admin/users`         | admin          | List all users                                            |
| DELETE | `/api/admin/users/:id`     | admin          | Delete a user                                             |
| DELETE | `/api/admin/movies/:id`    | admin          | Delete a movie                                            |
| GET    | `/api/health`              | —              | Liveness check                                            |

Here "session" in the Auth column means a valid JWT access-token cookie
(`theatre.jwt`) issued by registration, login, or refresh — the API
keeps no server-side session state.

Movie list and detail responses include two community rating fields:
`averageRating` — the mean of all users' ratings for the movie, rounded
to one decimal (e.g. `8.7`), or `null` when nobody has rated it yet — and
`ratingCount`, the number of ratings behind that average. Averages are
computed on read from the ratings table, so they are always current and
never stored.

## Architecture

Layered structure with one responsibility per directory — routes stay
thin, controllers hold no SQL, and every layer is independently
testable:

```
src/
├── server.ts          # app wiring: helmet, JSON limit, auth, routers, 404, error handler
├── config.ts          # env parsed and validated with Zod at startup
├── routes/            # URL → middleware + controller mapping only
├── middleware/        # authenticateJWT, requireAuth, requireAdmin(OrSelf), central error handler
├── controllers/      # request/response handling; no SQL
├── db/queries/        # data access; transactions live here
├── db/schema/         # Drizzle table definitions
├── db/migrations/     # generated, reviewable SQL migrations
├── models/            # Zod input schemas and domain types
├── auth/              # password hashing, token signing, cookie handling
├── utils/             # asyncHandler wrapper, HttpError
└── test/              # integration and unit tests (Vitest + supertest)
```

Request flow: `route → middleware → controller → Zod validation → query
layer → PostgreSQL`, with a single central error handler mapping every
failure mode to a consistent JSON response:

- Zod validation failures → `400`
- malformed or oversized JSON → `400` / `413`
- unique-constraint violations → `409` with a user-facing message per
  constraint
- JWT failures → `401` with a generic message
- unknown `/api` routes → JSON `404` instead of an HTML page
- anything else → `500`, with the real message hidden in production

## Authentication & Security

Not a library call — the whole scheme is implemented deliberately:

- **Argon2** password hashing
- **JWT pair** in HTTP-only cookies: a 15-minute access token and a
  7-day refresh token, each signed with its own secret and carrying an
  enforced `tokenType` claim, so an access token can never be replayed
  as a refresh token and one leaked key cannot forge the other type
- **Refresh rotation** on every login and refresh; tokens are stored
  server-side only as hashes, one active token per user (upsert), and
  `/api/users/refresh` verifies the presented token against the database
  row before reissuing
- **Cookie hardening**: `httpOnly`, `sameSite=lax`, `secure` in
  production
- **RBAC** (`user` / `admin`) via `requireAuth`, `requireAdmin`, and
  `requireAdminOrSelf` middleware; self-service account deletion for
  regular users, admin module mounted behind one router-level guard
- **First-admin bootstrap**: the first registration atomically claims the
  admin role inside the same transaction as the user insert — if the
  insert fails, the claim rolls back
- **helmet** security headers, 16kb JSON body limit, identical
  `Invalid credentials` response for unknown username and wrong password
  to avoid leaking registered usernames

## Database

PostgreSQL with Drizzle ORM — schema-as-code, typed queries, and
generated, reviewable SQL migrations (drizzle-kit) applied with
`npm run migrate`. Unique constraints on `movies.name`,
`users.username`, and `users.email`, and the `watchlists` composite
primary key, are mapped to `409` responses by the error handler. UUID
primary keys, and timestamps maintained by the database.

Movie ratings live in their own table keyed by `(user_id, movie_id)` —
one rating per user and movie, enforced by a composite primary key that
also backs the re-rating upsert. Ratings are integers constrained to
`0-10` by both a Zod schema and a database CHECK. The `GET /api/ratings`
endpoint returns all ratings for the authenticated user, ordered by
`movieId` for efficient client-side injection into movie tables. The
community averages in the movie list and detail responses are computed
on read — `ROUND(AVG(rating), 1)` grouped per movie and joined into the
movie queries — rather than denormalized into storage.

## Testing

Over 140 integration and unit tests (Vitest + supertest) run against a
real PostgreSQL database — a service container in CI, and a local
database in development. The suite covers the API surface end to end:
auth flows and refresh rotation, RBAC on every guarded route, CRUD on
movies and users, per-user watchlist and rating isolation, rating
validation, the first-admin bootstrap race, and error-handler mapping. A shared global setup creates and migrates the test database
once per run instead of once per file.

## Tech Stack

- **Runtime**: [express.js](https://expressjs.com/) on Node.js, TypeScript
  with project references (`tsc -b`)
- **Database**: [PostgreSQL](https://www.postgresql.org/) with [Drizzle
  ORM](https://orm.drizzle.team/) and drizzle-kit migrations
- **Validation**: [Zod](https://zod.dev/) for both env config and request
  bodies
- **Auth**: [argon2](https://github.com/ranisalt/node-argon2),
  [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken)
- **Tooling**: [oxlint](https://oxc.rs/docs/guide/usage/linter),
  [Prettier](https://prettier.io/), [Vitest](https://vitest.dev/)

## CI/CD

- **CI** (GitHub Actions): commitlint on PRs, format check, lint,
  typecheck, and the full test suite against a `postgres:18` service
  container
- **Releases**: [husky](https://husky.com/) + [commitlint](https://commitlint.js.org/)
  enforce Conventional Commits on every commit; [semantic-release](https://semantic-release.gitbook.io/)
  cuts versions, updates the changelog, and publishes GitHub releases from
  commit messages — no manual version bumps

## Getting Started

Prerequisites: Node.js and a PostgreSQL instance — either one you run
yourself, or the compose database (see [Run with Docker](#run-with-docker)).

1. Install dependencies:

   ```sh
   npm install
   ```

2. Configure the environment:

   ```sh
   cp .env.example .env
   ```

   Then edit `.env`: set `JWT_SECRET` and `REFRESH_SECRET` to different
   random strings of at least 32 characters each (e.g. the output of
   `openssl rand -base64 32`). The remaining defaults match the compose
   database — override the `POSTGRES_*` parts for your own instance.

3. Generate and apply database migrations:

   ```sh
   npm run generate
   npm run migrate
   ```

4. Start the dev server:

   ```sh
   npm run dev
   ```

The API listens on `SERVER_PORT` (default 3000). For the full app, run the
[theatre-client](https://github.com/hendrik-ro/theatre-client) dev server
alongside it; its Vite dev server proxies `/api` requests here.

## Run with Docker

The same stack also runs in containers — API and database together, no
local PostgreSQL required:

```sh
docker compose up -d --build
```

Compose starts a `postgres:18` container (health-checked), a one-shot
`migrate` container that applies migrations before the app starts, and
the app container, which serves the API at http://localhost:3000 — the
same port as the dev server, so stop `npm run dev` first if it is
running.

- Configuration comes from your `.env` (credentials and secrets); inside
  the container network `POSTGRES_HOST` and `POSTGRES_PORT` are
  overridden to route at the compose `db` service, so no per-container
  connection setup is needed
- `NODE_ENV=production` is set in the container, so auth cookies are
  `secure` — browsers still accept them on `localhost`
- The database is published on the host port from `POSTGRES_PORT`
  (default 5432); the server and `npm test` connect from the host at
  `localhost`, so the suite runs against the containerized database. If
  another local PostgreSQL already owns that port, change
  `POSTGRES_PORT` in `.env`
- Database files persist in a named `pgdata` volume: `docker compose down`
  keeps it, `docker compose down -v` wipes it
- Podman works as a drop-in: `podman-compose up -d --build`. One caveat:
  podman-compose waits for the `migrate` container to stop but does not
  check its exit code, so a failed migration surfaces as query errors in
  the API instead of a blocked startup — check the migrate container's
  logs if the API misbehaves

## Scripts

All commands are run from the repository root.

| Command                | Description                                      |
| ---------------------- | ------------------------------------------------ |
| `npm run dev`          | Start the Express server with tsx watch          |
| `npm run build`        | Compile to `dist/`                               |
| `npm run start`        | Run the compiled server                          |
| `npm run typecheck`    | Type-check all tsconfigs                         |
| `npm run generate`     | Generate Drizzle migrations                      |
| `npm run migrate`      | Apply Drizzle migrations                         |
| `npm test`             | Run tests (Vitest)                               |
| `npm run test:watch`   | Run tests in watch mode                          |
| `npm run lint`         | Lint with oxlint                                 |
| `npm run format`       | Format with Prettier                             |
| `npm run format:check` | Check formatting without writing                 |
| `npm run ci`           | Commitlint, format check, lint, typecheck, tests |

## Roadmap

- **CORS middleware** — enable cross-origin requests in production; currently missing, which will block browser clients
- **CSRF protection** — add CSRF tokens or use `sameSite=strict` for auth cookies to prevent cross-site request forgery
- **Rate limiting** — protect authentication endpoints (`/api/users/login`, `/api/users/register`, `/api/users/refresh`) from brute-force attacks
- **Refresh token security** — enhance server-side refresh token storage with revocation lists for compromised tokens
- **Pagination** — implement `GET /api/movies` pagination to handle growing movie collections efficiently
- **Caching layer** — add Redis for caching rating averages, reducing repeated aggregation queries
- **Database index** — create index on `movie_ratings(movie_id)` to optimize rating aggregation queries
- **Request logging** — add structured logging middleware for debugging and monitoring production traffic
- **Deployment** — deployment of app plus database as containers on a single VPS

## Contributing

Contributions are welcome! If you find a bug or have a feature request, please open an issue or submit a pull request on the GitHub repository.

## License

AGPL-3.0 License - See [LICENSE.md](LICENSE.md) for details.
