import { TaskDto } from './task.dto';

export interface ColumnDto {
  id: number;
  name: string;
  position: number;
  isGated: boolean;
  wipLimit?: number;
  tasks: TaskDto[];
}

export interface ColumnCreateRequest {
  name: string;
  position: number;
  isGated: boolean;
  wipLimit?: number;
}

export interface ColumnReorderRequest {
  columnId: number;
  newPosition: number;
}
