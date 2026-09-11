import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, map, shareReplay, tap } from 'rxjs';
import { WorkspaceResponseDto, WorkspaceMemberResponseDto, WorkspaceCreateRequest, WorkspaceMemberCreateRequest } from '../models/workspace.dto';
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

  // Last workspaces request, shared so guards and the layout never trigger duplicate calls
  private workspacesRequest$: Observable<WorkspaceResponseDto[]> | null = null;

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
    const currentActive = this._activeWorkspace$.getValue();
    if (list.length > 0) {
      const activeInList = currentActive ? list.find(w => w.id === currentActive.id) : null;
      if (activeInList) {
        this.setActiveWorkspace(activeInList);
      } else {
        const matchedDefault = defaultWorkspaceId ? list.find(w => w.id === defaultWorkspaceId) : null;
        if (matchedDefault) {
          this.setActiveWorkspace(matchedDefault);
        } else {
          this.setActiveWorkspace(list[0]);
        }
      }
    } else {
      this._activeWorkspace$.next(null);
      this._activeWorkspaceMembers$.next([]);
    }
  }

  setActiveWorkspace(workspace: WorkspaceResponseDto): void {
    this._activeWorkspace$.next(workspace);
    this.loadActiveWorkspaceMembers(workspace.id);
  }

  getActiveWorkspace(): WorkspaceResponseDto | null {
    return this._activeWorkspace$.getValue();
  }

  clear(): void {
    this._workspaces$.next([]);
    this._activeWorkspace$.next(null);
    this._activeWorkspaceMembers$.next([]);
    this.workspacesRequest$ = null;
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

    this.http.put<WorkspaceMemberResponseDto>(`/api/workspaces/${activeWs.id}/members/${userId}`, { role })
      .subscribe({
        next: updatedMember => {
          const current = this._activeWorkspaceMembers$.getValue();
          this._activeWorkspaceMembers$.next(
            current.map(m => m.userId === userId ? updatedMember : m)
          );
          this.messageService.add({
            severity: 'success',
            summary: 'Role Updated',
            detail: `Role updated successfully to ${updatedMember.role.replace('ROLE_', '')}.`
          });
        },
        error: err => this.showError('Update Failed', err.error?.message || 'Could not update role.')
      });
  }

  removeMemberFromActiveWorkspace(userId: number): void {
    const activeWs = this._activeWorkspace$.getValue();
    if (!activeWs) return;

    this.http.delete<void>(`/api/workspaces/${activeWs.id}/members/${userId}`)
      .subscribe({
        next: () => {
          const current = this._activeWorkspaceMembers$.getValue();
          this._activeWorkspaceMembers$.next(current.filter(m => m.userId !== userId));
          this.messageService.add({
            severity: 'warn',
            summary: 'Member Removed',
            detail: 'User was removed from workspace.'
          });
        },
        error: err => this.showError('Removal Failed', err.error?.message || 'Could not remove member.')
      });
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
