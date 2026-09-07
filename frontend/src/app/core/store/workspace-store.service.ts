import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, map, tap } from 'rxjs';
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

  loadWorkspaces(): void {
    this.http.get<WorkspaceResponseDto[]>('/api/workspaces')
      .subscribe({
        next: list => {
          this._workspaces$.next(list);
          // Auto-select first workspace if none active
          if (list.length > 0 && !this._activeWorkspace$.getValue()) {
            this.setActiveWorkspace(list[0]);
          }
        },
        error: () => this.showError('Load Workspaces Failed', 'Could not load workspaces.')
      });
  }

  setActiveWorkspace(workspace: WorkspaceResponseDto): void {
    this._activeWorkspace$.next(workspace);
    this.loadActiveWorkspaceMembers(workspace.id);
  }

  getActiveWorkspace(): WorkspaceResponseDto | null {
    return this._activeWorkspace$.getValue();
  }

  createWorkspace(request: WorkspaceCreateRequest): void {
    this.http.post<WorkspaceResponseDto>('/api/workspaces', request)
      .subscribe({
        next: newWs => {
          const current = this._workspaces$.getValue();
          this._workspaces$.next([...current, newWs]);
          this.setActiveWorkspace(newWs);
          this.messageService.add({
            severity: 'success',
            summary: 'Workspace Created',
            detail: `Workspace "${newWs.name}" was successfully configured.`
          });
        },
        error: err => this.showError('Creation Failed', err.error?.message || 'Could not create workspace.')
      });
  }

  addMemberToActiveWorkspace(request: WorkspaceMemberCreateRequest): void {
    const activeWs = this._activeWorkspace$.getValue();
    if (!activeWs) return;

    this.http.post<WorkspaceMemberResponseDto>(`/api/workspaces/${activeWs.id}/members`, request)
      .subscribe({
        next: newMember => {
          const current = this._activeWorkspaceMembers$.getValue();
          this._activeWorkspaceMembers$.next([...current, newMember]);
          this.messageService.add({
            severity: 'success',
            summary: 'Member Added',
            detail: `User ${newMember.email} added with role ${newMember.role}.`
          });
        },
        error: err => this.showError('Addition Failed', err.error?.message || 'Could not add member.')
      });
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
