-- 1. Seed Users (Bcrypt hashed password: 'password123')
INSERT INTO users (id, email, password_hash, first_name, last_name) VALUES
(1, 'admin@valeo.com', '$2a$10$/Abmx5sENPk3KlSUviWVwOkiaAYrLf8dclai6wD4wyBCehRLpVRg.', 'Admin', 'User'),
(2, 'pm@valeo.com', '$2a$10$/Abmx5sENPk3KlSUviWVwOkiaAYrLf8dclai6wD4wyBCehRLpVRg.', 'Project', 'Manager'),
(3, 'dev@valeo.com', '$2a$10$/Abmx5sENPk3KlSUviWVwOkiaAYrLf8dclai6wD4wyBCehRLpVRg.', 'Mohanad', 'Emad'),
(4, 'qa@valeo.com', '$2a$10$/Abmx5sENPk3KlSUviWVwOkiaAYrLf8dclai6wD4wyBCehRLpVRg.', 'Sarah', 'Tester'),
(5, 'viewer@valeo.com', '$2a$10$/Abmx5sENPk3KlSUviWVwOkiaAYrLf8dclai6wD4wyBCehRLpVRg.', 'Guest', 'Viewer')
ON CONFLICT (id) DO NOTHING;

-- 2. Seed Workspace & Member Roles
INSERT INTO workspaces (id, name, slug, description, created_by_id) VALUES
(1, 'Driving Assistance Research', 'valeo-dar', 'ADAS & Autonomous Vision Platforms', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
(1, 1, 'ROLE_ADMIN'),
(1, 2, 'ROLE_PROJECT_MANAGER'),
(1, 3, 'ROLE_DEVELOPER'),
(1, 4, 'ROLE_QA_TESTER'),
(1, 5, 'ROLE_VIEWER')
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- 3. Seed Board & Columns
INSERT INTO boards (id, workspace_id, title, description, created_by_id) VALUES
(1, 1, 'Core Platform Roadmap', 'Q3 Engineering Deliverables', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO columns (id, board_id, name, position, is_gated) VALUES
(1, 1, 'To-Do', 1000.0, false),
(2, 1, 'In Progress', 2000.0, false),
(3, 1, 'Code Review', 3000.0, false),
(4, 1, 'Ready for QA', 4000.0, true),
(5, 1, 'Done', 5000.0, false)
ON CONFLICT (id) DO NOTHING;

-- 4. Seed Dynamic Workflow Transitions (with Gating & Fallbacks)
INSERT INTO workflow_transitions (board_id, from_column_id, to_column_id, fallback_column_id, requires_approval) VALUES
(1, 1, 2, NULL, false), -- To-Do -> In Progress
(1, 2, 3, NULL, false), -- In Progress -> Code Review
(1, 3, 4, 2, true),    -- Code Review -> Ready for QA (Gated, Fallback: In Progress)
(1, 4, 5, 2, true),    -- Ready for QA -> Done (Gated, Fallback: In Progress)
(1, 4, 2, NULL, false) -- Ready for QA -> In Progress (Direct QA Rejection)
ON CONFLICT (board_id, from_column_id, to_column_id) DO NOTHING;

-- 5. Synchronize PostgreSQL Primary Key Sequence Counters with Seeded Explicit IDs
SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1));
SELECT setval(pg_get_serial_sequence('workspaces', 'id'), COALESCE((SELECT MAX(id) FROM workspaces), 1));
SELECT setval(pg_get_serial_sequence('workspace_members', 'id'), COALESCE((SELECT MAX(id) FROM workspace_members), 1));
SELECT setval(pg_get_serial_sequence('boards', 'id'), COALESCE((SELECT MAX(id) FROM boards), 1));
SELECT setval(pg_get_serial_sequence('columns', 'id'), COALESCE((SELECT MAX(id) FROM columns), 1));
SELECT setval(pg_get_serial_sequence('tasks', 'id'), COALESCE((SELECT MAX(id) FROM tasks), 1));
SELECT setval(pg_get_serial_sequence('workflow_transitions', 'id'), COALESCE((SELECT MAX(id) FROM workflow_transitions), 1));
SELECT setval(pg_get_serial_sequence('audit_logs', 'id'), COALESCE((SELECT MAX(id) FROM audit_logs), 1));
