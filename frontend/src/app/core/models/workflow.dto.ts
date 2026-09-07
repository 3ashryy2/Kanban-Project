export interface WorkflowTransitionUpdateRequest {
  fromColumnId: number;
  toColumnId: number;
  fallbackColumnId?: number;
  requiresApproval: boolean;
}
