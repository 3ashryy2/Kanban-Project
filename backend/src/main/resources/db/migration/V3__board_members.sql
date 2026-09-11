-- Board membership: which workspace members may open which boards.
-- Global admins and workspace Project Managers see every board without a row here.

-- 1. Lets board_members reference (board, workspace) as a pair, so a membership can never
--    point at a board from another workspace
ALTER TABLE boards ADD CONSTRAINT uk_boards_id_workspace UNIQUE (id, workspace_id);

-- 2. The membership table. Both composite foreign keys cascade:
--    deleting the board, or the user's workspace membership, removes the row automatically
CREATE TABLE board_members (
    id BIGSERIAL PRIMARY KEY,
    board_id BIGINT NOT NULL,
    workspace_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    added_by_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_board_member UNIQUE (board_id, user_id),
    CONSTRAINT fk_bm_board FOREIGN KEY (board_id, workspace_id)
        REFERENCES boards (id, workspace_id) ON DELETE CASCADE,
    CONSTRAINT fk_bm_workspace_member FOREIGN KEY (workspace_id, user_id)
        REFERENCES workspace_members (workspace_id, user_id) ON DELETE CASCADE
);

CREATE INDEX idx_bm_workspace_user ON board_members(workspace_id, user_id);

-- 3. Keep today's access on existing databases: every non-PM member keeps every board of their workspace
INSERT INTO board_members (board_id, workspace_id, user_id)
SELECT b.id, b.workspace_id, wm.user_id
FROM boards b
JOIN workspace_members wm ON wm.workspace_id = b.workspace_id
WHERE wm.role <> 'ROLE_PROJECT_MANAGER'
ON CONFLICT (board_id, user_id) DO NOTHING;
