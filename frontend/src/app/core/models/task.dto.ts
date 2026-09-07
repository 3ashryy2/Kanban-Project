import { SimpleUserDto } from './user.dto';

export interface TaskDto {
  id: number;
  boardId: number;
  columnId: number;
  title: string;
  description: string;
  priority: string; // LOW, MEDIUM, HIGH, URGENT
  status: string; // ACTIVE, PENDING_APPROVAL
  position: number;
  assignee?: SimpleUserDto;
  createdBy: SimpleUserDto;
  dueDate?: string;
  tags?: string[];
  rejectionReason?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskMoveRequest {
  targetColumnId: number;
  newPosition: number;
  adminBypass: boolean;
  version: number;
}

export interface TaskMetadataRequest {
  title: string;
  description?: string;
  priority?: string;
  dueDate?: string;
  tags?: string[]; // Symmetrical array of strings aligned with backend update schema
  version: number;
}

export interface TaskAssigneeRequest {
  assigneeId?: number; // can be null to unassign
  version: number;
}

export interface TaskApproveRequest {
  version: number;
}

export interface TaskRejectRequest {
  fallbackColumnId: number;
  rejectionReason: string;
  version: number;
}

export interface TaskCreateRequest {
  boardId: number;
  columnId: number;
  title: string;
  description?: string;
  priority?: string;
  position: number;
  assigneeId?: number;
  dueDate?: string;
  tags?: string[];
}
