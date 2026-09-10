-- 1. users Table
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

-- 2. workspaces Table
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

-- 3. workspace_members Table
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

-- 4. boards Table
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

-- 5. columns Table
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

-- 6. tasks Table
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
    rejection_reason TEXT DEFAULT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_task_priority CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    CONSTRAINT chk_task_status CHECK (status IN ('ACTIVE', 'PENDING_APPROVAL'))
);

-- 6.5. task_tags Table (ElementCollection for Task.tags)
CREATE TABLE task_tags (
    task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    tag VARCHAR(255) NOT NULL,
    PRIMARY KEY (task_id, tag)
);

CREATE INDEX idx_tasks_column_pos ON tasks(column_id, position ASC);
CREATE INDEX idx_tasks_board_status ON tasks(board_id, status);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);

-- 7. workflow_transitions Table
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

-- 8. audit_logs Table
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
