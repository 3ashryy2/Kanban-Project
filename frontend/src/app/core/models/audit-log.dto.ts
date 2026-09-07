import { SimpleUserDto } from './user.dto';

export interface AuditLogResponseDto {
  id: number;
  workspaceId: number;
  boardId: number;
  taskId: number;
  actor: SimpleUserDto;
  actionType: string;
  sourceColumnId?: number;
  targetColumnId?: number;
  details?: string;
  timestamp: string;
}

export interface ApiErrorResponse {
  error: string;
  message: string;
}
