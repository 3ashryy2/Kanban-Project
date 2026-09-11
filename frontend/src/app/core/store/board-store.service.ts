import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, EMPTY, Observable, Subject } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { BoardDetailsDto } from '../models/board.dto';
import { ColumnDto } from '../models/column.dto';
import { TaskDto, TaskMoveRequest, TaskCreateRequest, TaskMetadataRequest, TaskAssigneeRequest, TaskApproveRequest, TaskRejectRequest } from '../models/task.dto';
import { SimpleUserDto } from '../models/user.dto';
import { RANK_CALCULATOR_TOKEN } from '../services/rank-calculator.interface';

@Injectable({
  providedIn: 'root'
})
export class BoardStoreService {
  private readonly http = inject(HttpClient);
  private readonly messageService = inject(MessageService);
  private readonly rankCalculator = inject(RANK_CALCULATOR_TOKEN);

  private readonly _boardState$ = new BehaviorSubject<BoardDetailsDto | null>(null);
  readonly boardState$: Observable<BoardDetailsDto | null> = this._boardState$.asObservable();

  readonly columns$: Observable<ColumnDto[]> = this.boardState$.pipe(
    map(board => board?.columns ?? [])
  );

  // People who may be assigned tasks on the open board (its members plus the workspace's PMs)
  private readonly _boardMembers$ = new BehaviorSubject<SimpleUserDto[]>([]);
  readonly boardMembers$ = this._boardMembers$.asObservable();

  // Emits a board id when the server refuses it (403/404), e.g. access was revoked while it was open
  private readonly _accessLost$ = new Subject<number>();
  readonly accessLost$ = this._accessLost$.asObservable();

  clear(): void {
    this._boardState$.next(null);
    this._boardMembers$.next([]);
  }

  loadBoardMembers(boardId: number): void {
    this.http.get<SimpleUserDto[]>(`/api/boards/${boardId}/members`)
      .subscribe({
        next: members => this._boardMembers$.next(members),
        error: () => this._boardMembers$.next([])
      });
  }

  loadBoard(boardId: number): void {
    this.http.get<BoardDetailsDto>(`/api/boards/${boardId}`)
      .subscribe({
        next: board => this._boardState$.next(board),
        error: err => {
          if (err.status === 403 || err.status === 404) {
            this.clear();
            this._accessLost$.next(boardId);
            return;
          }
          this.messageService.add({
            severity: 'error',
            summary: 'Load Failed',
            detail: 'Could not load board. Please refresh.',
            life: 4000
          });
        }
      });
  }

  moveTaskOptimistically(
    taskId: number,
    sourceColumnId: number,
    targetColumnId: number,
    targetIndex: number,
    currentVersion: number,
    adminBypass = false
  ): void {
    const currentState = this._boardState$.getValue();
    if (!currentState) return;

    // 1. Deep-clone snapshot cache for rollback safety
    const snapshotState: BoardDetailsDto = structuredClone(currentState);

    // 2. Calculate new Lexorank fractional position
    const targetColumn = currentState.columns.find(c => c.id === targetColumnId);
    if (!targetColumn) return;

    // Filter out the moving task if it is already in the target column to prevent index pollution during reordering
    const targetTasksExcludingCurrent = targetColumn.tasks.filter(t => t.id !== taskId);
    const newPosition = this.rankCalculator.calculateNewPosition(targetTasksExcludingCurrent, targetIndex);
    const originalTask = this.findTaskInBoard(currentState, taskId);
    if (!originalTask) return;

    // 3. Optimistic local state update
    const updatedColumns = currentState.columns.map(col => {
      if (col.id === sourceColumnId) {
        return { ...col, tasks: col.tasks.filter(t => t.id !== taskId) };
      }
      return col;
    });

    const movedTask: TaskDto = {
      ...originalTask,
      columnId: targetColumnId,
      position: newPosition,
      status: targetColumn.isGated && !adminBypass ? 'PENDING_APPROVAL' : 'ACTIVE'
    };

    const finalColumns = updatedColumns.map(col => {
      if (col.id === targetColumnId) {
        const newTasks = [...col.tasks];
        newTasks.splice(targetIndex, 0, movedTask);
        return { ...col, tasks: newTasks };
      }
      return col;
    });

    this._boardState$.next({ ...currentState, columns: finalColumns });

    // 4. Dispatch HTTP payload with version token
    const payload: TaskMoveRequest = {
      targetColumnId,
      newPosition,
      adminBypass,
      version: currentVersion
    };

    this.http.patch<TaskDto>(`/api/tasks/${taskId}/move`, payload)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          // 5. Automatic rollback on server rejection or 409 Conflict
          this._boardState$.next(snapshotState);

          const errorMessage = error.status === 409
            ? 'Task was modified concurrently by another user. Board state synchronized.'
            : error.error?.message || 'Invalid workflow transition.';

          this.messageService.add({
            severity: 'error',
            summary: 'Move Rejected',
            detail: errorMessage,
            life: 4000
          });

          return EMPTY;
        })
      )
      .subscribe(persistedTask => {
        // 6. Version Token Sync Rule: Merge server version into active state
        this.syncTaskVersionInStore(persistedTask);
      });
  }

  createTask(request: TaskCreateRequest, boardId: number): Observable<TaskDto> {
    return this.http.post<TaskDto>('/api/tasks', request).pipe(
      tap(() => this.loadBoard(boardId))
    );
  }

  updateTaskMetadata(taskId: number, request: TaskMetadataRequest, boardId: number): Observable<TaskDto> {
    return this.http.patch<TaskDto>(`/api/tasks/${taskId}/metadata`, request).pipe(
      tap(() => this.loadBoard(boardId))
    );
  }

  updateTaskAssignee(taskId: number, request: TaskAssigneeRequest, boardId: number): Observable<TaskDto> {
    return this.http.patch<TaskDto>(`/api/tasks/${taskId}/assignee`, request).pipe(
      tap(() => this.loadBoard(boardId))
    );
  }

  deleteTask(taskId: number, boardId: number): Observable<void> {
    return this.http.delete<void>(`/api/tasks/${taskId}`).pipe(
      tap(() => this.loadBoard(boardId))
    );
  }

  approveTask(taskId: number, request: TaskApproveRequest, boardId: number): Observable<TaskDto> {
    return this.http.post<TaskDto>(`/api/tasks/${taskId}/approve`, request).pipe(
      tap(() => this.loadBoard(boardId))
    );
  }

  rejectTask(taskId: number, request: TaskRejectRequest, boardId: number): Observable<TaskDto> {
    return this.http.post<TaskDto>(`/api/tasks/${taskId}/reject`, request).pipe(
      tap(() => this.loadBoard(boardId))
    );
  }

  private syncTaskVersionInStore(updatedTask: TaskDto): void {
    const currentState = this._boardState$.getValue();
    if (!currentState) return;

    const columns = currentState.columns.map(col => ({
      ...col,
      tasks: col.tasks.map(t => t.id === updatedTask.id ? { ...t, version: updatedTask.version, status: updatedTask.status } : t)
    }));

    this._boardState$.next({ ...currentState, columns });
  }

  private findTaskInBoard(board: BoardDetailsDto, taskId: number): TaskDto | undefined {
    for (const col of board.columns) {
      const task = col.tasks.find(t => t.id === taskId);
      if (task) return task;
    }
    return undefined;
  }
}
