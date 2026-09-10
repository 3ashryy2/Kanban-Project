-- 1. Migrate any existing workspace-scoped ADMIN memberships to PROJECT_MANAGER
UPDATE workspace_members SET role = 'ROLE_PROJECT_MANAGER' WHERE role = 'ROLE_ADMIN';

-- 2. Drop the old workspace role check constraint and apply the new constraint (excluding ROLE_ADMIN)
ALTER TABLE workspace_members DROP CONSTRAINT chk_workspace_role;
ALTER TABLE workspace_members ADD CONSTRAINT chk_workspace_role CHECK (role IN (
    'ROLE_PROJECT_MANAGER',
    'ROLE_DEVELOPER',
    'ROLE_QA_TESTER',
    'ROLE_VIEWER'
));

-- 3. Add the global is_admin boolean column to the users table
ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE;
