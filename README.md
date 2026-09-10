# Kanban Project Management Tool

This is a professional-grade multi-tenant Kanban Project Management Tool built for driving assistance perception and platform engineering. It features a **Spring Boot (Java 21)** backend with decoupled event-driven audit logging and a state-machine gating engine, and an **Angular (v19/v21)** standalone frontend featuring optimistic state sync with automatic transactional rollbacks.

## 📁 Repository Structure

```
PM-tool/
├── docker-compose.yml       # Local PostgreSQL 15 Container definition (mapped to port 5433)
├── backend/                 # Spring Boot Backend Source Code
│   ├── pom.xml              # Maven dependencies
│   └── src/main/
│       ├── java/...         # Controller, Service, Security ABAC Evaluators, Events, Model/Entity, Repo layers
│       └── resources/       # application.yml, db/migration/ schema versions, and seed data.sql
└── frontend/                # Angular Standalone Frontend Project
    ├── package.json         # Client-side dependencies (PrimeNG, PrimeIcons)
    └── src/app/
        └── core/            # Models, Lexorank mathematical indexing, and BoardStoreState managers
```

---

## 🚀 Getting Started (Step-by-Step)

### 1. Spin Up the PostgreSQL Database
We have mapped the database to port **`5433`** to avoid port collisions with any existing local PostgreSQL installations on your machine.
Since you run Docker on WSL, open your WSL terminal and execute:
```bash
docker compose up -d
```
Verify that the container is healthy and running on port `5433` with:
```bash
docker ps
```

---

### 2. Run the Spring Boot Backend
The backend utilizes **Flyway** for automatic database migrations, executing `V1__init_schema.sql` (located in `src/main/resources/db/migration/`) to build the initial schema. It utilizes Spring Boot's SQL initialization to execute `data.sql` (to seed default users, workspace member roles, the default board, columns, and workflow transition rules) upon startup.

To start the backend inside your WSL terminal (where Java 21 is configured):
```bash
cd backend
chmod +x mvnw
./mvnw spring-boot:run
```
Once started, the server will connect to PostgreSQL on port `5433` and expose the REST endpoints on **`http://localhost:8080`**.

---

### 3. Run the Angular Frontend
The frontend features integrated PrimeNG and PrimeIcons components, RxJS deep-cloned state rollbacks, and a fractional index allocator.

To build and start the frontend client on your Windows host:
```bash
cd frontend
npm install --legacy-peer-deps  # resolves peer Angular version dependencies
npm start                       # compiles and serves client on http://localhost:4200
```
Open **`http://localhost:4200`** in your browser to access the interactive Kanban application.

---

## 🔒 Default Credentials & Roles (Seeded in `data.sql`)
You can log in to test different workspace memberships, permissions, and workflow gates:

*   **Admin User:** `admin@valeo.com` / `password123` (Holds `ROLE_ADMIN` - Global administration, audit logs)
*   **Project Manager:** `pm@valeo.com` / `password123` (Holds `ROLE_PROJECT_MANAGER` - Board workflow gating, approvals)
*   **Developer:** `dev@valeo.com` / `password123` (Holds `ROLE_DEVELOPER` - Task movement, creation)
*   **QA Tester:** `qa@valeo.com` / `password123` (Holds `ROLE_QA_TESTER` - Approves ready cards to "Done")
*   **Viewer:** `viewer@valeo.com` / `password123` (Holds `ROLE_VIEWER` - Read-only board access)
