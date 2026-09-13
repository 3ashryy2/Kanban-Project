-- A column's is_gated flag now mirrors the workflow rules: it is true exactly when at least one rule
-- into the column requires approval, and only the backend sets it (WorkflowTransitionService).
-- Until now the flag was set by hand and could disagree with the rules, so recompute it once for
-- existing columns. Nothing else changes: rules, tasks and columns stay as they are.
UPDATE columns c
SET is_gated = EXISTS (
    SELECT 1
    FROM workflow_transitions wt
    WHERE wt.to_column_id = c.id
      AND wt.requires_approval
);
