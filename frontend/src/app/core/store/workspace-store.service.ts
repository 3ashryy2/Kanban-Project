import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, EMPTY, Observable, map, shareReplay, tap, forkJoin, of, catchError } from 'rxjs';
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

  /** Takes a member off one board, keeping their other boards; their tasks there are unassigned. */
  removeMemberFromBoard(boardId: number, userId: number): Observable<MembershipChangeResponseDto> {
    return this.http.delete<MembershipChangeResponseDto>(`/api/boards/${boardId}/members/${userId}`).pipe(
      tap({
        next: change => {
          if (change.member) {
            this.replaceMember(change.member);
          }
          const name = change.member ? `${change.member.firstName} ${change.member.lastName}` : 'The member';
          this.messageService.add({
            severity: 'warn',
            summary: 'Removed from Board',
            detail: `${name} no longer has access to this board.${unassignedNote(change.unassignedTaskCount)}`
          });
        },
        error: err => this.showError('Removal Failed', err.error?.message || 'Could not remove the member from this board.')
      })
    );
  }

  /** Adds multiple members to a workspace in bulk. */
  addMembersBulk(workspaceId: number, userIds: number[], role: string): Observable<any> {
    if (userIds.length === 0) return of([]);

    const requests = userIds.map(userId => 
      this.http.post<WorkspaceMemberResponseDto>(`/api/workspaces/${workspaceId}/members`, { userId, role }).pipe(
        catchError(err => {
          this.showError('Addition Failed', `Could not add user ID ${userId}: ${err.error?.message || 'Error'}`);
          return of(null);
        })
      )
    );

    return forkJoin(requests).pipe(
      tap(results => {
        const added = results.filter(r => r !== null) as WorkspaceMemberResponseDto[];
        if (added.length > 0) {
          if (this._activeWorkspace$.getValue()?.id === workspaceId) {
            this._activeWorkspaceMembers$.next([...this._activeWorkspaceMembers$.getValue(), ...added]);
          }
          this.messageService.add({
            severity: 'success',
            summary: 'Bulk Members Added',
            detail: `${added.length} users successfully added with role ${role.replace('ROLE_', '')}.`
          });
        }
      })
    );
  }

  /** Removes multiple members from the active workspace in bulk. */
  removeMembersBulk(userIds: number[]): Observable<any> {
    const activeWs = this._activeWorkspace$.getValue();
    if (!activeWs || userIds.length === 0) return of([]);

    const requests = userIds.map(userId => 
      this.http.delete<MembershipChangeResponseDto>(`/api/workspaces/${activeWs.id}/members/${userId}`).pipe(
        map(change => ({ userId, change })),
        catchError(err => {
          this.showError('Removal Failed', `Could not remove user ID ${userId}: ${err.error?.message || 'Error'}`);
          return of(null);
        })
      )
    );

    return forkJoin(requests).pipe(
      tap(results => {
        const removed = results.filter(r => r !== null) as { userId: number, change: MembershipChangeResponseDto }[];
        if (removed.length > 0) {
          const removedIds = removed.map(r => r.userId);
          const current = this._activeWorkspaceMembers$.getValue();
          this._activeWorkspaceMembers$.next(current.filter(m => !removedIds.includes(m.userId)));

          const totalUnassigned = removed.reduce((sum, r) => sum + r.change.unassignedTaskCount, 0);
          this.messageService.add({
            severity: 'warn',
            summary: 'Bulk Members Removed',
            detail: `${removed.length} users removed from the workspace.${unassignedNote(totalUnassigned)}`
          });
        }
      })
    );
  }

  /** Adds multiple members to a board in bulk. */
  addMembersToBoardBulk(boardId: number, membersToAdd: any[]): Observable<any> {
    const activeWs = this._activeWorkspace$.getValue();
    if (!activeWs || membersToAdd.length === 0) return of([]);

    const requests = membersToAdd.map(m => {
      const currentBoardIds = m.boards ? m.boards.map((b: any) => b.id) : [];
      const newBoardIds = Array.from(new Set([...currentBoardIds, boardId]));
      return this.http.put<MembershipChangeResponseDto>(`/api/workspaces/${activeWs.id}/members/${m.userId}/boards`, { boardIds: newBoardIds }).pipe(
        tap(change => {
          if (change.member) {
            this.replaceMember(change.member);
          }
        }),
        catchError(err => {
          this.showError('Update Failed', `Could not add ${m.firstName} to board: ${err.error?.message || 'Error'}`);
          return of(null);
        })
      );
    });

    return forkJoin(requests).pipe(
      tap(results => {
        const successes = results.filter(r => r !== null);
        if (successes.length > 0) {
          this.messageService.add({
            severity: 'success',
            summary: 'Bulk Board Access Granted',
            detail: `Successfully granted board access to ${successes.length} members.`
          });
        }
      })
    );
  }

  /** Removes multiple members from a board in bulk. */
  removeMembersFromBoardBulk(boardId: number, membersToRemove: any[]): Observable<any> {
    const activeWs = this._activeWorkspace$.getValue();
    if (!activeWs || membersToRemove.length === 0) return of([]);

    const requests = membersToRemove.map(m => {
      return this.http.delete<MembershipChangeResponseDto>(`/api/boards/${boardId}/members/${m.userId}`).pipe(
        tap(change => {
          if (change.member) {
            this.replaceMember(change.member);
          }
        }),
        catchError(err => {
          this.showError('Removal Failed', `Could not remove ${m.firstName} from board: ${err.error?.message || 'Error'}`);
          return of(null);
        })
      );
    });

    return forkJoin(requests).pipe(
      tap(results => {
        const successes = results.filter(r => r !== null) as MembershipChangeResponseDto[];
        if (successes.length > 0) {
          const totalUnassigned = successes.reduce((sum, s) => sum + s.unassignedTaskCount, 0);
          this.messageService.add({
            severity: 'warn',
            summary: 'Bulk Board Access Revoked',
            detail: `Successfully removed ${successes.length} members from the board.${unassignedNote(totalUnassigned)}`
          });
        }
      })
    );
  }

  /** Deletes a board of the active workspace with its columns, cards and workflow rules. */
  deleteBoard(boardId: number): Observable<void> {
    return this.http.delete<void>(`/api/boards/${boardId}`).pipe(
      tap({
        next: () => {
          const board = this._boards$.getValue().find(b => b.id === boardId);
          this._boards$.next(this._boards$.getValue().filter(b => b.id !== boardId));
          this.messageService.add({
            severity: 'warn',
            summary: 'Board Deleted',
            detail: board ? `"${board.title}" and its cards were deleted.` : 'The board was deleted.'
          });
        },
        error: err => this.showError('Delete Failed', err.error?.message || 'Could not delete the board.')
      })
    );
  }

  /** Deletes a workspace with its boards, cards and member list (global admin only). */
  deleteWorkspace(workspaceId: number): Observable<void> {
    return this.http.delete<void>(`/api/workspaces/${workspaceId}`).pipe(
      tap({
        next: () => {
          const workspace = this._workspaces$.getValue().find(w => w.id === workspaceId);
          this.forgetWorkspace(workspaceId);
          this.messageService.add({
            severity: 'warn',
            summary: 'Workspace Deleted',
            detail: workspace ? `"${workspace.name}" and everything in it were deleted.` : 'The workspace was deleted.'
          });
        },
        error: err => this.showError('Delete Failed', err.error?.message || 'Could not delete the workspace.')
      })
    );
  }

  // Drops a deleted workspace from the lists; the "/" redirect then picks another one, or onboarding
  private forgetWorkspace(workspaceId: number): void {
    if (this._activeWorkspace$.getValue()?.id === workspaceId) {
      this._activeWorkspace$.next(null);
      this._activeWorkspaceMembers$.next([]);
      this._boards$.next([]);
      this.boardsRequest = null;
    }
    this._workspaces$.next(this._workspaces$.getValue().filter(w => w.id !== workspaceId));
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
