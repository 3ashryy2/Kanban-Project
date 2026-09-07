# Document 2: Domain Entity & Database Schema Specification

---

## 1. Relational Graph & Cascade Boundaries

```
                      ┌──────────────────────┐
                      │        users         │
                      └──────────┬───────────┘
                                 │
           ┌─────────────────────┼─────────────────────┐
           ▼ 1:N (CASCADE)       ▼ 1:N (Audit Ref)     ▼ 1:N (SET NULL)
┌──────────────────────┐ ┌───────────────┐ ┌──────────────────────┐
│  workspace_members   │ │  audit_logs   │ │        tasks         │
│ (RBAC Tenant Join)   │ │ (Decoupled)   │ │   (assignee_id)      │
└──────────┬───────────┘ └───────────────┘ └──────────┬───────────┘
           │ N:1                                      │
┌──────────▼───────────┐                              │
│      workspaces      │                              │
└──────────┬───────────┘                              │
           │ 1:N (DB CASCADE)                         │
┌──────────▼───────────┐                              │
│        boards        │                              │
└──────────┬───────────┘                              │
           │ 1:N (DB CASCADE)                         │
           ├──────────────────────────────────────────┼───────────────────┐
           ▼                                          ▼                   ▼
┌──────────────────────┐                   ┌──────────────────────┐ ┌──────────────────────┐
│       columns        │◄──────────────────┤        tasks         │ │ workflow_transitions │
│ (Visual Container)   │ 1:N (DB CASCADE)  │  (Aggregate Root)    │ │ (Rules & Gating DB)  │
└──────────┬───────────┘                   └──────────────────────┘ └──────────────────────┘
           │                                                                  ▲
           └───────────────────────────(from/to/fallback)─────────────────────┘

```

---

## 2. Relational Schema & Data Definition (PostgreSQL DDL)

### 1. `users` Table

Stores authenticated system identities across all workspaces.

```sql
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

```

### 2. `workspaces` Table

The top-level multi-tenant container representing an organizational division or team.

```sql
CREATE TABLE workspaces (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(150) UNIQUE NOT NULL,
    description TEXT,
    created_by_id BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workspaces_slug ON workspaces(slug);

```

### 3. `workspace_members` Table

Provides tenant-scoped authorization and maps static baseline roles to users per workspace.

```sql
CREATE TABLE workspace_members (
    id BIGSERIAL PRIMARY KEY,
    workspace_id BIGINT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_workspace_member UNIQUE (workspace_id, user_id),
    CONSTRAINT chk_workspace_role CHECK (role IN (
        'ROLE_ADMIN',
        'ROLE_PROJECT_MANAGER',
        'ROLE_DEVELOPER',
        'ROLE_QA_TESTER',
        'ROLE_VIEWER'
    ))
);

CREATE INDEX idx_wm_workspace_user ON workspace_members(workspace_id, user_id);

```

### 4. `boards` Table

Represents a discrete project delivery lifecycle scoped within a parent workspace.

```sql
CREATE TABLE boards (
    id BIGSERIAL PRIMARY KEY,
    workspace_id BIGINT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    created_by_id BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_boards_workspace ON boards(workspace_id);

```

### 5. `columns` Table

Represents an ordered workflow container on a board. The `is_gated` flag acts strictly as a UI indicator, while authoritative gating rules live in `workflow_transitions`.

```sql
CREATE TABLE columns (
    id BIGSERIAL PRIMARY KEY,
    board_id BIGINT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    position DOUBLE PRECISION NOT NULL,
    is_gated BOOLEAN NOT NULL DEFAULT FALSE,
    wip_limit INTEGER DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_columns_board_pos ON columns(board_id, position ASC);

```

### 6. `tasks` Table

The primary domain aggregate root containing metadata, Lexorank ordering, status locks, and optimistic concurrency tokens.

```sql
CREATE TABLE tasks (
    id BIGSERIAL PRIMARY KEY,
    board_id BIGINT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    column_id BIGINT NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    position DOUBLE PRECISION NOT NULL,
    assignee_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_by_id BIGINT NOT NULL REFERENCES users(id),
    due_date TIMESTAMP WITH TIME ZONE,
    tags TEXT,
    rejection_reason TEXT DEFAULT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_task_priority CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    CONSTRAINT chk_task_status CHECK (status IN ('ACTIVE', 'PENDING_APPROVAL'))
);

CREATE INDEX idx_tasks_column_pos ON tasks(column_id, position ASC);
CREATE INDEX idx_tasks_board_status ON tasks(board_id, status);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);

```

### 7. `workflow_transitions` Table

Configurable state machine matrix defining allowed paths, gate enforcement, and default rejection fallback stages per board.

```sql
CREATE TABLE workflow_transitions (
    id BIGSERIAL PRIMARY KEY,
    board_id BIGINT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    from_column_id BIGINT NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
    to_column_id BIGINT NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
    fallback_column_id BIGINT REFERENCES columns(id) ON DELETE SET NULL,
    requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT uk_board_transition UNIQUE (board_id, from_column_id, to_column_id)
);

CREATE INDEX idx_wt_lookup ON workflow_transitions(board_id, from_column_id, to_column_id);

```

### 8. `audit_logs` Table

Decoupled, immutable store capturing all domain mutations and movements. Foreign keys to workspaces and boards are intentionally omitted to avoid table lock contention during high-throughput writes.

```sql
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    board_id BIGINT NOT NULL,
    task_id BIGINT NOT NULL,
    actor_id BIGINT NOT NULL REFERENCES users(id),
    action_type VARCHAR(50) NOT NULL,
    source_column_id BIGINT,
    target_column_id BIGINT,
    details TEXT,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_task_time ON audit_logs(task_id, timestamp DESC);
CREATE INDEX idx_audit_board_time ON audit_logs(board_id, timestamp DESC);
CREATE INDEX idx_audit_action_time ON audit_logs(action_type, timestamp DESC);

```

---

## 3. Database Invariants & Deletion Strategy

| Relational Node | Foreign Key Policy | Application-Level Guard & Concurrency Rule |
| --- | --- | --- |
| `Workspace` $\rightarrow$ `Board` | `ON DELETE CASCADE`<br> | Deleting a workspace purges all child boards and tasks; restricted to `ROLE_ADMIN`.

 |
| `Board` $\rightarrow$ `Column` / `Task` | `ON DELETE CASCADE`<br> | Deleting a board purges all columns, tasks, and workflow transition rules cleanly without orphan records.

 |
| `Column` $\rightarrow$ `Task` | `ON DELETE CASCADE` (DB-level) | **Application-Level Guard:** Single column deletion requires `taskRepository.countByColumnId(id) == 0` and zero references in `workflow_transitions` (returns `HTTP 409 Conflict` if violated). Database-level cascade is preserved exclusively to support top-down Board cascades without foreign key collision. |
| `User` $\rightarrow$ `Task` (Assignee) | `ON DELETE SET NULL` | Deleting or removing a user clears their assigned card references without destroying the card entity. |
| `Task` Concurrency | N/A (`@Version`) | Optimistic locking token prevents dirty writes; mismatched versions raise `OptimisticLockException` (`HTTP 409 Conflict`). |

---

## 4. Default Seed Data Matrix (`data.sql`)

To facilitate local demonstration and instant execution, the database is initialized with default users, workspaces, and standard workflow stages:

```sql
-- 1. Seed Users (Bcrypt hashed password: 'password123')
INSERT INTO users (id, email, password_hash, first_name, last_name) VALUES
(1, 'admin@valeo.com', '$2a$10$wN1QeY9rVzG6G3bI6G3bIeX3aO6wN1QeY9rVzG6G3bI6G3bIeX3aO', 'Admin', 'User'),
(2, 'pm@valeo.com', '$2a$10$wN1QeY9rVzG6G3bI6G3bIeX3aO6wN1QeY9rVzG6G3bI6G3bIeX3aO', 'Project', 'Manager'),
(3, 'dev@valeo.com', '$2a$10$wN1QeY9rVzG6G3bI6G3bIeX3aO6wN1QeY9rVzG6G3bI6G3bIeX3aO', 'Mohanad', 'Emad'),
(4, 'qa@valeo.com', '$2a$10$wN1QeY9rVzG6G3bI6G3bIeX3aO6wN1QeY9rVzG6G3bI6G3bIeX3aO', 'Sarah', 'Tester'),
(5, 'viewer@valeo.com', '$2a$10$wN1QeY9rVzG6G3bI6G3bIeX3aO6wN1QeY9rVzG6G3bI6G3bIeX3aO', 'Guest', 'Viewer');

-- 2. Seed Workspace & Member Roles
INSERT INTO workspaces (id, name, slug, description, created_by_id) VALUES
(1, 'Driving Assistance Research', 'valeo-dar', 'ADAS & Autonomous Vision Platforms', 1);

INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
(1, 1, 'ROLE_ADMIN'),
(1, 2, 'ROLE_PROJECT_MANAGER'),
(1, 3, 'ROLE_DEVELOPER'),
(1, 4, 'ROLE_QA_TESTER'),
(1, 5, 'ROLE_VIEWER');

-- 3. Seed Board & Columns
INSERT INTO boards (id, workspace_id, title, description, created_by_id) VALUES
(1, 1, 'Core Platform Roadmap', 'Q3 Engineering Deliverables', 1);

INSERT INTO columns (id, board_id, name, position, is_gated) VALUES
(1, 1, 'To-Do', 1000.0, false),
(2, 1, 'In Progress', 2000.0, false),
(3, 1, 'Code Review', 3000.0, false),
(4, 1, 'Ready for QA', 4000.0, true),
(5, 1, 'Done', 5000.0, false);

-- 4. Seed Dynamic Workflow Transitions (with Gating & Fallbacks)
INSERT INTO workflow_transitions (board_id, from_column_id, to_column_id, fallback_column_id, requires_approval) VALUES
(1, 1, 2, NULL, false), -- To-Do -> In Progress
(1, 2, 3, NULL, false), -- In Progress -> Code Review
(1, 3, 4, 2, true),    -- Code Review -> Ready for QA (Gated, Fallback: In Progress)
(1, 4, 5, 2, true),    -- Ready for QA -> Done (Gated, Fallback: In Progress)
(1, 4, 2, NULL, false); -- Ready for QA -> In Progress (Direct QA Rejection)

```