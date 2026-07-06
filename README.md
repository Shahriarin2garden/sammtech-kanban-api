# SammTech Kanban API

RESTful backend for a Kanban board system. Built for the SammTech backend internship take-home.

**Stack:** NestJS 10 · TypeScript · PostgreSQL · Prisma 5 · JWT · Swagger

---

## Quick start

```bash
# 1. install deps
npm install

# 2. copy env and fill in real secrets
cp .env.example .env
# generate strong JWT secrets: `openssl rand -hex 64`

# 3. run migrations (creates schema + tables)
npx prisma migrate dev --name init

# 4. start dev server
npm run start:dev
# → http://localhost:3000
# → Swagger UI at http://localhost:3000/docs
```

Health check: `GET /api/health` → `{ status, db, uptime }`.

---

## Environment variables

| Name                 | Required | Example                                                     | Notes                                    |
| -------------------- | :------: | ----------------------------------------------------------- | ---------------------------------------- |
| `NODE_ENV`           |          | `development`                                               |                                          |
| `PORT`               |          | `3000`                                                      |                                          |
| `API_PREFIX`         |          | `api`                                                       | All routes mount under `/api`            |
| `CORS_ORIGIN`        |          | `http://localhost:3000`                                     |                                          |
| `DATABASE_URL`       |    ✅    | `postgresql://user:pw@localhost:5432/kanban?schema=public` | Prisma connection string                 |
| `JWT_ACCESS_SECRET`  |    ✅    | 64-hex string                                               | ≥ 16 chars enforced at boot              |
| `JWT_ACCESS_TTL`     |          | `15m`                                                       |                                          |
| `JWT_REFRESH_SECRET` |    ✅    | different 64-hex string                                     |                                          |
| `JWT_REFRESH_TTL`    |          | `7d`                                                        |                                          |
| `BCRYPT_ROUNDS`      |          | `12`                                                        |                                          |
| `THROTTLE_TTL_MS`    |          | `60000`                                                     | Global rate-limit window                 |
| `THROTTLE_LIMIT`     |          | `100`                                                       | Requests per window per IP               |
| `AUTH_THROTTLE_LIMIT`|          | `5`                                                         | Reserved for tighter auth-route limits   |

---

## API surface

All endpoints prefixed with `/api`. Full schema in Swagger at `/docs`.

### Auth

| Method | Path              | Auth | Notes                                                       |
| ------ | ----------------- | :--: | ----------------------------------------------------------- |
| POST   | `/auth/register`  |      | Body `{ email, name, password }` → `{ accessToken, refreshToken }` |
| POST   | `/auth/login`     |      | Body `{ email, password }` → tokens                         |
| POST   | `/auth/refresh`   |      | Body `{ refreshToken }` → new pair (old one revoked)        |
| POST   | `/auth/logout`    |  ✅  | Revokes all refresh tokens for the current user             |

### Users

| Method | Path         | Auth | Notes                             |
| ------ | ------------ | :--: | --------------------------------- |
| GET    | `/users/me`  |  ✅  | Returns current user profile      |

### Boards

| Method | Path            | Auth | Notes                                                         |
| ------ | --------------- | :--: | ------------------------------------------------------------- |
| POST   | `/boards`       |  ✅  | Creates board with 5 default columns (Backlog…Done)           |
| GET    | `/boards`       |  ✅  | Lists boards owned by current user                            |
| GET    | `/boards/:id`   |  ✅  | Full board with columns + tasks + labels                      |
| PATCH  | `/boards/:id`   |  ✅  | Update title                                                  |
| DELETE | `/boards/:id`   |  ✅  | Soft delete (`deletedAt` set; row remains for audit / recovery) |

### Columns

| Method | Path                     | Auth | Notes                    |
| ------ | ------------------------ | :--: | ------------------------ |
| POST   | `/boards/:id/columns`    |  ✅  | Appends to end           |
| PATCH  | `/columns/:id`           |  ✅  | Update title or order    |
| DELETE | `/columns/:id`           |  ✅  | Hard delete (cascades tasks — see decisions) |

### Tasks

| Method | Path                        | Auth | Notes                                                          |
| ------ | --------------------------- | :--: | -------------------------------------------------------------- |
| POST   | `/columns/:id/tasks`        |  ✅  | Create task in column                                          |
| GET    | `/tasks?q=&priority=&dueBefore=&dueAfter=&boardId=&take=&skip=` | ✅ | Search + filter across the user's boards           |
| PATCH  | `/tasks/:id`                |  ✅  | Update any field, incl. moving via `columnId` (appends to dest) |
| PATCH  | `/tasks/:id/position`       |  ✅  | Precise reorder: `{ targetColumnId, beforeTaskId?, afterTaskId? }` |
| DELETE | `/tasks/:id`                |  ✅  | Soft delete                                                    |

---

## Architecture

```
src/
  auth/            register / login / refresh / logout + JWT strategy + guards
  boards/          CRUD, ownership, soft delete, default columns on create
  columns/         column CRUD scoped to owning board
  tasks/           task CRUD, search/filter, position algo, activity log
  users/           profile lookup, hash-safe (passwordHash never leaks)
  common/          exception filter, response interceptor, decorators
  config/          typed env loader with fail-fast validation
  health/          /health endpoint (DB ping)
  prisma/          global Prisma module + service
  main.ts          bootstrap (helmet, CORS, validation, Swagger)
  app.module.ts    root module: throttler, global guards, filter, interceptor
```

Each feature module owns a controller (HTTP surface), service (business rules) and repository (data access) — nothing crosses layers except through the service.

---

## Key technical decisions (mandatory section)

### 1. NestJS + Prisma + Postgres
Matches the "preferred" stack in the brief. Prisma's migration model + typed client removes a lot of hand-written boilerplate without hiding the schema (unlike TypeORM's decorator-heavy models).

### 2. Layered per-module structure
`controller → service → repository`. Controllers do HTTP only (parse, delegate, respond). Services own transactions, authorization, and business logic. Repositories are the *only* place Prisma is imported outside `prisma.module.ts`. This directly addresses the "no separation of concerns" red flag in the brief.

### 3. Rotating hashed refresh tokens
Access tokens live 15 min; refresh tokens 7 days. Refresh JWTs are **bcrypt-hashed** before storage (`refresh_tokens.tokenHash`). On use the token is revoked (`revokedAt` stamped) and a new pair issued. This defeats replay of a stolen refresh token and lets `/auth/logout` invalidate every session for the user with one `updateMany`. Direct answer to the red-flag "storing tokens in DB without hashing".

### 4. Guards + global auth policy
`JwtAuthGuard` is applied globally in `AppModule` via `APP_GUARD`. Public routes opt out with `@Public()`. This prevents the common bug of forgetting `@UseGuards` on a new controller.

### 5. Authorization is board-owner-based
Every mutation on a board, column or task checks that the acting user owns the parent board. No RBAC roles yet — the brief specifies owner-only. Shared/collaborator access is called out under "improvements".

### 6. Soft delete for boards + tasks
`deletedAt` timestamp, filtered at repository level. Columns are hard-deleted because they cascade tasks and don't carry standalone value (a column with no board is meaningless). Rationale documented at the model.

### 7. Position algorithm (the "intentionally tricky" bit)
Positions are `Float`. Reorder computes the **midpoint between the two neighbors** of the destination slot: O(1) writes for the moved task, zero writes for siblings.

Float precision is finite, so `positionBetween` is paired with `needsRebalance` — when the gap between neighbors falls below `1e-4` we **rebalance the whole column** to evenly-spaced integer positions (`STEP = 1000`) inside a single transaction. In steady state, rebalance is rare (needs ~40+ consecutive inserts at the same spot).

Alternatives considered and rejected:
- **Integer positions with cascade shifts** — O(n) writes per move, blocks the column.
- **LexoRank strings** (Jira) — richer, no rebalance ever, but heavier than a take-home warrants.
- **Doubly-linked list (prev/next FK)** — needs a 3-row transaction per move; more places to break.

Move API takes `beforeTaskId` OR `afterTaskId` (mutually exclusive) rather than a numeric index. This is what a real Kanban frontend has after a drag-drop: the IDs of the neighbors, not their positions — so the API never leaks the internal ordering scheme.

See `src/tasks/position.ts` for the algorithm + `src/tasks/position.spec.ts` for unit tests.

### 8. Global response envelope + exception filter
Successful responses → `{ success: true, data: … }` via a global interceptor. All errors → `{ statusCode, message, error, path, timestamp }` via a global filter that also translates known Prisma errors (P2002 → 409, P2025 → 404, P2003 → 400) into meaningful HTTP status codes.

### 9. Input validation
Every DTO uses `class-validator` + `class-transformer`. A global `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, `transform` rejects unknown fields. Password requires letter + digit + min length 8. Direct answer to "missing validation" red flag.

### 10. Security defaults
- `helmet()` for standard headers.
- CORS whitelist via env.
- Rate limit via `@nestjs/throttler` (global window + tighter auth-route limits via `@Throttle` decorator on `register`, `login`, `refresh`).
- Bcrypt rounds configurable, default 12.
- Constant-time compare on login even for unknown emails (dummy hash) to reduce timing side-channel.
- No secrets in source — env only, validated at boot.

### 11. Activity log (bonus)
Every task create / update / move / delete writes a row to `activity_logs` with the acting user, action type, and JSON metadata (e.g. `from`/`to` position on moves). Enables "who moved what" without complicating the task table.

### 12. Iterative commit history
Work is split into ~9 focused commits (config → prisma → common → users → auth → boards → columns → tasks → app-bootstrap). Direct answer to the "one giant commit at the end" red flag.

---

## Assumptions

1. **A user's boards are private to them.** No sharing/collaborator model; owner is the only principal. This matches the brief exactly and is called out because it also means "assignee" on a task can currently be any user ID — sharing is where that gets useful.
2. **Column deletion cascades tasks.** A column with no board makes no sense; a task without a column is orphaned. Prefer cascade over soft-delete-with-orphans.
3. **Task move across *boards* is disallowed.** Only within a board (across columns). Cross-board moves would require reassigning ownership, which we didn't want to hide behind a PATCH.
4. **Refresh tokens are session-bound.** `/auth/logout` revokes every active refresh token for the user (single-session-at-a-time semantics for simplicity). Multi-device sessions are a straight extension.
5. **Position API takes neighbor IDs, not numeric positions.** Clients don't need to know the ordering scheme.

---

## Challenges + solutions

- **Making the position algorithm robust without over-engineering.** First cut used pure midpoints which broke after ~40 same-spot inserts (float underflow). Added `needsRebalance` + a single-transaction rebalance instead of jumping to LexoRank strings, which would have doubled the code complexity for a symmetric problem.
- **Preventing timing leaks on login.** A missing user shortcut-returns fast, which a timing attacker can distinguish from a wrong password. Ran `bcrypt.compare` against a dummy hash on the no-user path to smooth it out.
- **Modeling refresh tokens.** Storing the raw JWT would be a security regression; storing the JWT ID could leak session info. Settled on bcrypt-hashing the refresh JWT itself with rotation on use.
- **Prisma cascade rules on soft delete.** `deletedAt` on parent doesn't automatically hide children in queries — every repository read filters `deletedAt: null` explicitly. Chose explicitness over a Prisma middleware because middleware makes queries surprising during debugging.

---

## What I'd improve with more time

- **E2E tests** covering register → create board → drag task across columns (only unit test on the position algo right now).
- **Board sharing / collaborators** (many-to-many User↔Board with a role enum) — the schema is one join table away.
- **File attachments** via Multer + Cloudinary (bonus item).
- **Real-time updates** via Socket.io — task moves are the natural push event.
- **LexoRank fallback for pathological workloads** if a single column ever sees millions of inserts.
- **Distinguish refresh sessions by device** (device fingerprint on the RefreshToken row) so logout can be per-device.
- **CI pipeline** — GitHub Actions running lint, `prisma migrate deploy` against an ephemeral Postgres, and `pytest`-equivalent test suite.

---

## Deployment notes

Deploy target: Railway / Render / Fly.io (free tier).

Steps:
1. Provision Postgres, note the `DATABASE_URL`.
2. Set env vars from `.env.example` (real 64-hex secrets, not the examples).
3. Build: `npm ci && npm run build && npx prisma migrate deploy`.
4. Start: `node dist/main.js`.
5. Verify: `GET /api/health` returns `{ status: "ok" }`.
