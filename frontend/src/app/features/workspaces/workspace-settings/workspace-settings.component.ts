import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WorkspaceStoreService } from '../../../core/store/workspace-store.service';
import { AuthStoreService } from '../../../core/store/auth-store.service';
import { WorkspaceMemberResponseDto } from '../../../core/models/workspace.dto';
import { UserSearchSelectComponent } from '../../../shared/components/user-search-select/user-search-select.component';

// PrimeNG Standalone Components (v22+)
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Select } from 'primeng/select';

export interface SelectItem {
  label: string;
  value: string | number;
}

@Component({
  selector: 'app-workspace-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Button,
    Dialog,
    Select,
    UserSearchSelectComponent
  ],
  templateUrl: './workspace-settings.component.html',
  styleUrls: ['./workspace-settings.component.scss']
})
export class WorkspaceSettingsComponent implements OnInit {
  readonly workspaceStore = inject(WorkspaceStoreService);
  private readonly authStore = inject(AuthStoreService);
  private readonly destroyRef = inject(DestroyRef);

  isAdmin = false;
  isPM = false;
  canManageRoles = false;
  activeWorkspaceId: number | null = null;
  addMemberDialogVisible = false;
  editRoleDialogVisible = false;
  selectedMemberToEdit: WorkspaceMemberResponseDto | null = null;
  newRoleValue = '';
  activeEditRoleOptions: SelectItem[] = [];

  newMemberPayload: { userId: number | null; role: string } = {
    userId: null,
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
          this.activeWorkspaceId = ws.id;
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
    // Candidates come from the server-side directory search, which already excludes current members
    this.newMemberPayload = {
      userId: null,
      role: 'ROLE_DEVELOPER'
    };
    this.addMemberDialogVisible = true;
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
