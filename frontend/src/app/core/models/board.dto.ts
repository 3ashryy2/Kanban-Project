import { ColumnDto } from './column.dto';

export interface BoardDetailsDto {
  id: number;
  workspaceId: number;
  title: string;
  description: string;
  columns: ColumnDto[];
}

export interface BoardCreateRequest {
  title: string;
  description?: string;
}
