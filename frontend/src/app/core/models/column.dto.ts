import { TaskDto } from './task.dto';

export interface ColumnDto {
  id: number;
  name: string;
  position: number;
  /** Set by the server: true when a workflow rule into this column requires approval. */
  isGated: boolean;
  wipLimit?: number;
  tasks: TaskDto[];
}

export interface ColumnCreateRequest {
  name: string;
  position: number;
  wipLimit?: number;
}

export interface ColumnReorderRequest {
  columnId: number;
  newPosition: number;
}
