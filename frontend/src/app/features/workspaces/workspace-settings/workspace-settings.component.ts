import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { WorkspaceStoreService } from '../../../core/store/workspace-store.service';
import { AuthStoreService } from '../../../core/store/auth-store.service';
import { WorkspaceMemberResponseDto, WorkspaceMemberCreateRequest } from '../../../core/models/workspace.dto';

// PrimeNG Standalone Components (v22+)
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Select } from 'primeng/select';
import { InputText } from 'primeng/inputtext';

export interface SelectItem {
  label: string;
  value: string | number;
  email?: string;
}

@Component({
  selector: 'app-workspace-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Button,
    Dialog,
    Select
  ],
  templateUrl: './workspace-settings.component.html',
  styleUrls: ['./workspace-settings.component.scss']
})
export class WorkspaceSettingsComponent implements OnInit {
  readonly workspaceStore = inject(WorkspaceStoreService);
  private readonly authStore = inject(AuthStoreService);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  isAdmin = false;
  isPM = false;
  canManageRoles = false;
  addMemberDialogVisible = false;
  editRoleDialogVisible = false;
  selectedMemberToEdit: WorkspaceMemberResponseDto | null = null;
  newRoleValue = '';
  userOptions: SelectItem[] = [];
  activeEditRoleOptions: SelectItem[] = [];

  newMemberPayload: Partial<WorkspaceMemberCreateRequest> = {
    userId: undefined,
    role: 'ROLE_DEVELOPER'
  };

  roleOptions: SelectItem[] = [
    { label: 'Project Manager', value: 'ROLE_PROJECT_MANAGER' },
    { label: 'Developer', value: 'ROLE_DEVELOPER' },
    { label: 'QA Tester', value: 'ROLE_QA_TESTER' },
    { label: 'Viewer', value: 'ROLE_VIEWER' }
  ];

  ngOnInit(): void {
    this.authStore.isAdmin$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(isAdmin => {
        this.isAdmin = isAdmin;
        this.canManageRoles = isAdmin || this.isPM;
      });

    this.workspaceStore.activeWorkspace$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(ws => {
        if (ws) {
          this.isPM = ws.currentUserRole === 'ROLE_PROJECT_MANAGER';
          this.canManageRoles = this.isAdmin || this.isPM;
        }
      });
  }

  openEditRoleDialog(member: WorkspaceMemberResponseDto): void {
    this.selectedMemberToEdit = member;
    this.newRoleValue = member.role;
    this.activeEditRoleOptions = this.roleOptions;
    this.editRoleDialogVisible = true;
  }

  isRoleEditDisabled(member: WorkspaceMemberResponseDto): boolean {
    // Prevents self de-escalation of role to prevent accidental locking out of settings
    const currentUserId = this.authStore.getCurrentUserId();
    if (member.userId === currentUserId) {
      return true;
    }

    return false;
  }

  openAddMemberDialog(): void {
    this.newMemberPayload = {
      userId: undefined,
      role: 'ROLE_DEVELOPER'
    };
    
    // Fetch all system users and filter out existing members
    this.http.get<any[]>('/api/users').subscribe({
      next: usersList => {
        let currentMemberIds: number[] = [];
        const subscription = this.workspaceStore.activeWorkspaceMembers$.subscribe(members => {
          currentMemberIds = members.map(m => m.userId);
        });
        subscription.unsubscribe(); // clean up immediately to prevent memory leak

        this.userOptions = usersList
          .filter(u => !currentMemberIds.includes(u.id))
          .map(u => ({
            label: `${u.firstName} ${u.lastName} (${u.email})`,
            email: u.email,
            value: u.id
          }));
          
        this.addMemberDialogVisible = true;
      },
      error: () => {
        this.userOptions = [];
        this.addMemberDialogVisible = true;
      }
    });
  }

  addMember(): void {
    if (!this.newMemberPayload.userId || !this.newMemberPayload.role) return;

    this.workspaceStore.addMemberToActiveWorkspace({
      userId: this.newMemberPayload.userId,
      role: this.newMemberPayload.role
    });
    this.addMemberDialogVisible = false;
  }

  removeMember(userId: number): void {
    if (confirm('Are you sure you want to revoke workspace privileges for this user?')) {
      this.workspaceStore.removeMemberFromActiveWorkspace(userId);
    }
  }

  submitRoleUpdate(): void {
    if (!this.selectedMemberToEdit || !this.newRoleValue) return;
    this.workspaceStore.updateMemberRoleInActiveWorkspace(this.selectedMemberToEdit.userId, this.newRoleValue);
    this.editRoleDialogVisible = false;
    this.selectedMemberToEdit = null;
  }

  trackByMemberId(index: number, member: WorkspaceMemberResponseDto): number {
    return member.userId;
  }
}
