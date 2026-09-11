import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, EMPTY, Observable, map, shareReplay, tap } from 'rxjs';
import {
  WorkspaceResponseDto,
  WorkspaceMemberResponseDto,
  WorkspaceCreateRequest,
  WorkspaceMemberCreateRequest,
  MembershipChangeResponseDto
} from '../models/workspace.dto';
import { BoardDetailsDto } from '../models/board.dto';
import { lastVisited } from '../utils/last-visited';
import { MessageService } from 'primeng/api';

@Injectable({
  providedIn: 'root'
})
export class WorkspaceStoreService {
  private readonly http = inject(HttpClient);
  private readonly messageService = inject(MessageService);

  private readonly _workspaces$ = new BehaviorSubject<WorkspaceResponseDto[]>([]);
  readonly workspaces$ = this._workspaces$.asObservable();

  private readonly _activeWorkspace$ = new BehaviorSubject<WorkspaceResponseDto | null>(null);
  readonly activeWorkspace$ = this._activeWorkspace$.asObservable();

  private readonly _activeWorkspaceMembers$ = new BehaviorSubject<WorkspaceMemberResponseDto[]>([]);
  readonly activeWorkspaceMembers$ = this._activeWorkspaceMembers$.asObservable();

  // Boards of the active workspace that this user may open (the server filters by board membership)
  private readonly _boards$ = new BehaviorSubject<BoardDetailsDto[]>([]);
  readonly boards$ = this._boards$.asObservable();

  // Last workspaces request, shared so guards and the layout never trigger duplicate calls
  private workspacesRequest$: Observable<WorkspaceResponseDto[]> | null = null;

  // Last boards request and the workspace it belongs to, shared the same way
  private boardsRequest: { workspaceId: number; request$: Observable<BoardDetailsDto[]> } | null = null;

  loadWorkspaces(defaultWorkspaceId?: number): Observable<WorkspaceResponseDto[]> {
    const request$ = this.http.get<WorkspaceResponseDto[]>('/api/users/me/workspaces').pipe(
      tap(list => this.applyWorkspaces(list, defaultWorkspaceId)),
      shareReplay(1)
    );
    this.workspacesRequest$ = request$;

    request$.subscribe({
      error: () => {
        if (this.workspacesRequest$ === request$) {
          this.workspacesRequest$ = null;
        }
        this.showError('Load Workspaces Failed', 'Could not load workspaces.');
      }
    });
    return request$;
  }

  /** Waits for the first workspaces load, then emits the current list (including later additions). */
  ensureWorkspacesLoaded(): Observable<WorkspaceResponseDto[]> {
    const request$ = this.workspacesRequest$ ?? this.loadWorkspaces();
    return request$.pipe(map(() => this._workspaces$.getValue()));
  }

  private applyWorkspaces(list: WorkspaceResponseDto[], defaultWorkspaceId?: number): void {
    this._workspaces$.next(list);
    if (list.length === 0) {
      this._activeWorkspace$.next(null);
      this._activeWorkspaceMembers$.next([]);
      this._boards$.next([]);
      return;
    }

    // Keep the current workspace if still listed, else the requested one, else the last one used
    const preferredId = this._activeWorkspace$.getValue()?.id ?? defaultWorkspaceId ?? lastVisited.workspaceId();
    this.setActiveWorkspace(list.find(w => w.id === preferredId) ?? list[0]);
  }

  setActiveWorkspace(workspace: WorkspaceResponseDto): void {
    const switching = this._activeWorkspace$.getValue()?.id !== workspace.id;
    this._activeWorkspace$.next(workspace);
    lastVisited.rememberWorkspace(workspace.id);
    this.loadActiveWorkspaceMembers(workspace.id);
    if (switching) {
      this.loadBoards(workspace.id);
    }
  }

  getActiveWorkspace(): WorkspaceResponseDto | null {
    return this._activeWorkspace$.getValue();
  }

  /** Loads the boards of a workspace that this user may open, sharing the request with every caller. */
  loadBoards(workspaceId: number): Observable<BoardDetailsDto[]> {
    const request$ = this.http.get<BoardDetailsDto[]>(`/api/workspaces/${workspaceId}/boards`).pipe(
      tap(boards => {
        // A late answer for a workspace the user already left must not overwrite the current list
        if (this.boardsRequest?.workspaceId === workspaceId) {
          this._boards$.next(boards);
        }
      }),
      shareReplay(1)
    );
    this.boardsRequest = { workspaceId, request$ };
    this._boards$.next([]); // never show the previous workspace's boards while this one loads

    request$.subscribe({
      error: () => {
        if (this.boardsRequest?.request$ === request$) {
          this.boardsRequest = null;
        }
        this.showError('Load Boards Failed', 'Could not load boards.');
      }
    });
    return request$;
  }

  /**
   * Boards of the given workspace, loaded once; emits the current list (including new boards).
   * A caller still waiting on a workspace the user has since left gets an empty list, never another workspace's boards.
   */
  ensureBoardsLoaded(workspaceId: number): Observable<BoardDetailsDto[]> {
    const request$ = this.boardsRequest?.workspaceId === workspaceId
      ? this.boardsRequest.request$
      : this.loadBoards(workspaceId);
    return request$.pipe(
      map(() => this.boardsRequest?.workspaceId === workspaceId ? this._boards$.getValue() : [])
    );
  }

  /** A board just created in the active workspace joins the list without a reload. */
  addBoard(board: BoardDetailsDto): void {
    this._boards$.next([...this._boards$.getValue(), board]);
  }

  clear(): void {
    this._workspaces$.next([]);
    this._activeWorkspace$.next(null);
    this._activeWorkspaceMembers$.next([]);
    this._boards$.next([]);
    this.workspacesRequest$ = null;
    this.boardsRequest = null;
    lastVisited.forgetAll();
  }

  createWorkspace(request: WorkspaceCreateRequest): Observable<WorkspaceResponseDto> {
    return this.http.post<WorkspaceResponseDto>('/api/workspaces', request).pipe(
      tap({
        next: newWs => {
          const current = this._workspaces$.getValue();
          this._workspaces$.next([...current, newWs].sort((a, b) => a.name.localeCompare(b.name)));
          this.setActiveWorkspace(newWs);
          this.messageService.add({
            severity: 'success',
            summary: 'Workspace Created',
            detail: `Workspace "${newWs.name}" was successfully configured.`
          });
        },
        error: err => this.showError('Creation Failed', err.error?.message || 'Could not create workspace.')
      })
    );
  }

  addMember(workspaceId: number, request: WorkspaceMemberCreateRequest): Observable<WorkspaceMemberResponseDto> {
    return this.http.post<WorkspaceMemberResponseDto>(`/api/workspaces/${workspaceId}/members`, request).pipe(
      tap({
        next: newMember => {
          if (this._activeWorkspace$.getValue()?.id === workspaceId) {
            this._activeWorkspaceMembers$.next([...this._activeWorkspaceMembers$.getValue(), newMember]);
          }
          this.messageService.add({
            severity: 'success',
            summary: 'Member Added',
            detail: `User ${newMember.email} added with role ${newMember.role}.`
          });
        },
        error: err => this.showError('Addition Failed', err.error?.message || 'Could not add member.')
      })
    );
  }

  addMemberToActiveWorkspace(request: WorkspaceMemberCreateRequest): void {
    const activeWs = this._activeWorkspace$.getValue();
    if (!activeWs) return;

    // Errors are already surfaced as toasts by addMember
    this.addMember(activeWs.id, request).subscribe({ error: () => {} });
  }

  updateMemberRoleInActiveWorkspace(userId: number, role: string): void {
    const activeWs = this._activeWorkspace$.getValue();
    if (!activeWs) return;

    this.http.put<MembershipChangeResponseDto>(`/api/workspaces/${activeWs.id}/members/${userId}`, { role })
      .subscribe({
        next: change => {
          if (change.member) {
            this.replaceMember(change.member);
          }
          this.messageService.add({
            severity: 'success',
            summary: 'Role Updated',
            detail: `Role updated to ${role.replace('ROLE_', '')}.${unassignedNote(change.unassignedTaskCount)}`
          });
        },
        error: err => this.showError('Update Failed', err.error?.message || 'Could not update role.')
      });
  }

  /** Sets exactly which boards a member belongs to; their tasks on removed boards are unassigned. */
  updateMemberBoards(userId: number, boardIds: number[]): Observable<MembershipChangeResponseDto> {
    const activeWs = this._activeWorkspace$.getValue();
    if (!activeWs) return EMPTY;

    return this.http.put<MembershipChangeResponseDto>(`/api/workspaces/${activeWs.id}/members/${userId}/boards`, { boardIds }).pipe(
      tap({
        next: change => {
          if (change.member) {
            this.replaceMember(change.member);
          }
          this.messageService.add({
            severity: 'success',
            summary: 'Boards Updated',
            detail: `Board access saved.${unassignedNote(change.unassignedTaskCount)}`
          });
        },
        error: err => this.showError('Update Failed', err.error?.message || 'Could not update board access.')
      })
    );
  }

  removeMemberFromActiveWorkspace(userId: number): void {
    const activeWs = this._activeWorkspace$.getValue();
    if (!activeWs) return;

    this.http.delete<MembershipChangeResponseDto>(`/api/workspaces/${activeWs.id}/members/${userId}`)
      .subscribe({
        next: change => {
          const current = this._activeWorkspaceMembers$.getValue();
          this._activeWorkspaceMembers$.next(current.filter(m => m.userId !== userId));
          this.messageService.add({
            severity: 'warn',
            summary: 'Member Removed',
            detail: `User was removed from the workspace.${unassignedNote(change.unassignedTaskCount)}`
          });
        },
        error: err => this.showError('Removal Failed', err.error?.message || 'Could not remove member.')
      });
  }

  private replaceMember(updated: WorkspaceMemberResponseDto): void {
    const current = this._activeWorkspaceMembers$.getValue();
    this._activeWorkspaceMembers$.next(current.map(m => m.userId === updated.userId ? updated : m));
  }

  private loadActiveWorkspaceMembers(workspaceId: number): void {
    this.http.get<WorkspaceMemberResponseDto[]>(`/api/workspaces/${workspaceId}/members`)
      .subscribe({
        next: list => this._activeWorkspaceMembers$.next(list),
        error: () => this.showError('Load Members Failed', 'Could not load workspace members.')
      });
  }

  private showError(summary: string, detail: string): void {
    this.messageService.add({
      severity: 'error',
      summary,
      detail,
      life: 4000
    });
  }
}

// " 2 tasks were unassigned." appended to a toast, or nothing when no task was affected
function unassignedNote(count: number): string {
  if (!count) return '';
  return count === 1 ? ' 1 task was unassigned.' : ` ${count} tasks were unassigned.`;
}
