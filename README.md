# Kanban Project Management Tool

A multi-tenant Kanban project management tool for driving-assistance perception and platform engineering teams. The **Spring Boot 3 (Java 21)** backend has decoupled, event-driven audit logging, a workflow state machine with approval gates, and a layered access model. The **Angular 21** standalone frontend (PrimeNG) syncs board changes optimistically and rolls them back if the server rejects them.

## 🔐 Access Model

| Level | Who | Can see |
|---|---|---|
| **Global admin** | Users with `users.is_admin = true` | Every workspace and every board, without memberships |
| **Workspace role** | `ROLE_PROJECT_MANAGER`, `ROLE_DEVELOPER`, `ROLE_QA_TESTER`, `ROLE_VIEWER` | The workspaces they are members of |
| **Board membership** | Developers, QA testers and viewers | Only the boards a PM or the admin added them to. PMs see every board in their workspace |

- New users register, then wait on the **onboarding** page until an admin (from `/admin/users`) or a PM (from the members page) adds them to a workspace.
- Losing access to a board (removed from it, removed from the workspace, or demoted from PM) automatically unassigns that user's tasks on it. Each unassignment is recorded in the audit log.

## 📁 Repository Structure

```
Kanban-Project/
├── docker-compose.yml       # Local PostgreSQL 15 container (mapped to port 5433)
├── backend/                 # Spring Boot backend
│   ├── pom.xml
│   └── src/main/
│       ├── java/...         # Controllers, services, security evaluators, events, entities, repositories
│       └── resources/       # application.yml, db/migration (Flyway V1–V3), data.sql seed data
├── frontend/                # Angular standalone frontend
│   ├── e2e/                 # Playwright end-to-end tests
│   └── src/app/
│       ├── core/            # Guards, interceptor, models, stores, utilities
│       ├── features/        # Pages: boards, workspaces, onboarding, admin, profile, errors
│       └── shared/          # Header, sidebar, reusable components
└── docs/                    # Requirements and architecture documents
```

---

## 🚀 Getting Started (Windows)

**Prerequisites:** Docker Desktop, a JDK (21 recommended; newer JDKs also work), Maven 3.9+, Node.js 20+ with npm.

### 1. Start the database
From the repository root:
```powershell
docker compose up -d
docker ps          # kanban-postgres should be listed on port 5433
```

### 2. Run the backend
```powershell
cd backend
mvn spring-boot:run
```
On startup, Flyway applies the migrations in `src/main/resources/db/migration` (V1 schema, V2 global admin, V3 board membership). Then `data.sql` seeds the demo users, workspace, board and memberships. The API listens on **http://localhost:8080**.

### 3. Run the frontend
```powershell
cd frontend
npm ci --legacy-peer-deps   # resolves peer version differences between Angular packages
npm start                   # serves http://localhost:4200 and proxies /api to port 8080
```

---

## 🧪 Running the Tests

| Suite | Command | Notes |
|---|---|---|
| Backend unit tests | `cd backend` then `mvn test` | Surefire passes `-Dnet.bytebuddy.experimental=true`, so Mockito can mock classes on JDKs newer than 21 |
| Frontend unit tests | `cd frontend` then `npx ng test --watch=false` | Vitest with Angular's TestBed |
| End-to-end tests | `cd frontend` then `npx playwright test` | Needs the backend running. Run `npx playwright install chromium` once first. Starts the dev server by itself |

End-to-end tests register users and create boards in your database; that data stays afterwards.

---

## 🔑 Seeded Accounts

All passwords are `password123`.

| Account | Access |
|---|---|
| `admin@valeo.com` | Global admin: every workspace and board, user onboarding, global audit log |
| `pm@valeo.com` | Project Manager of *Driving Assistance Research*: every board in it, manages members, boards and workflow |
| `dev@valeo.com` | Developer on the *Core Platform Roadmap* board |
| `qa@valeo.com` | QA tester on the *Core Platform Roadmap* board |
| `viewer@valeo.com` | Read-only viewer on the *Core Platform Roadmap* board |

## 🧭 Main Pages

| Address | Page |
|---|---|
| `/auth/login`, `/auth/register` | Sign in, create an account |
| `/onboarding` | Waiting room for users who belong to no workspace yet |
| `/w/:workspaceId` | Opens your last-used board in the workspace, or explains why there is none |
| `/w/:workspaceId/boards/:boardId` | A board |
| `/w/:workspaceId/members` | Members, roles and board access |
| `/profile` | Your account and workspaces |
| `/admin/users` | Admin: users waiting for their first workspace |
| `/admin/audit-logs` | Admin: audit log across all workspaces |

## 📚 Documentation

- `docs/requirements/specs.md`: requirements and user stories
- `docs/architecture/backend & DB/REST API Architecture & Tree.md`: every endpoint and who may call it
- `docs/architecture/frontend/`: frontend architecture and sequence diagrams
