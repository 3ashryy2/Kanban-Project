import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { WorkspaceStoreService } from '../../../core/store/workspace-store.service';
import { AuthStoreService } from '../../../core/store/auth-store.service';
import { WorkspaceMemberResponseDto } from '../../../core/models/workspace.dto';
import { UserSearchSelectComponent } from '../../../shared/components/user-search-select/user-search-select.component';

// PrimeNG Standalone Components (v22+)
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Dialog } from 'primeng/dialog';
import { MultiSelect } from 'primeng/multiselect';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';

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
    Checkbox,
    ConfirmDialog,
    Dialog,
    MultiSelect,
    Select,
    Tag,
    UserSearchSelectComponent
  ],
  // One confirmation host for this page's destructive actions
  providers: [ConfirmationService],
  templateUrl: './workspace-settings.component.html',
  styleUrls: ['./workspace-settings.component.scss']
})
export class WorkspaceSettingsComponent implements OnInit {
  readonly workspaceStore = inject(WorkspaceStoreService);
  private readonly authStore = inject(AuthStoreService);
  private readonly confirmationService = inject(ConfirmationService);
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
  showUnassignedOnly = false;

  // Manage-boards dialog
  boardsDialogVisible = false;
  memberForBoards: WorkspaceMemberResponseDto | null = null;
  selectedBoardIds: number[] = [];
  savingBoards = false;

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

  /** In the workspace but on no board: they can sign in, yet have nothing to work on. */
  hasNoBoards(member: WorkspaceMemberResponseDto): boolean {
    return !member.allBoards && member.boards.length === 0;
  }

  visibleMembers(members: WorkspaceMemberResponseDto[]): WorkspaceMemberResponseDto[] {
    return this.showUnassignedOnly ? members.filter(m => this.hasNoBoards(m)) : members;
  }

  countWithoutBoards(members: WorkspaceMemberResponseDto[]): number {
    return members.filter(m => this.hasNoBoards(m)).length;
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

  openBoardsDialog(member: WorkspaceMemberResponseDto): void {
    this.memberForBoards = member;
    this.selectedBoardIds = member.boards.map(b => b.id);
    this.boardsDialogVisible = true;
  }

  saveMemberBoards(): void {
    const member = this.memberForBoards;
    if (!member || this.savingBoards) return;

    const boardIds = [...this.selectedBoardIds];
    const save = () => {
      this.savingBoards = true;
      this.workspaceStore.updateMemberBoards(member.userId, boardIds).subscribe({
        next: () => {
          this.savingBoards = false;
          this.boardsDialogVisible = false;
        },
        error: () => this.savingBoards = false
      });
    };

    // Losing a board unassigns the member's tasks there, so ask first
    const removed = member.boards.filter(b => !boardIds.includes(b.id));
    if (removed.length === 0) {
      save();
      return;
    }
    this.confirmationService.confirm({
      header: 'Remove board access?',
      message: `${member.firstName} will lose access to ${removed.map(b => b.title).join(', ')}. ` +
        'Any of their tasks on those boards will be unassigned.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Remove access',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text p-button-secondary',
      accept: save
    });
  }

  removeMember(member: WorkspaceMemberResponseDto): void {
    this.confirmationService.confirm({
      header: 'Remove member?',
      message: `Remove ${member.firstName} ${member.lastName} from this workspace? ` +
        'Any tasks assigned to them here will be unassigned.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Remove member',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text p-button-secondary',
      accept: () => this.workspaceStore.removeMemberFromActiveWorkspace(member.userId)
    });
  }

  submitRoleUpdate(): void {
    const member = this.selectedMemberToEdit;
    const role = this.newRoleValue;
    if (!member || !role) return;

    const update = () => {
      this.workspaceStore.updateMemberRoleInActiveWorkspace(member.userId, role);
      this.editRoleDialogVisible = false;
      this.selectedMemberToEdit = null;
    };

    // A demoted PM keeps only the boards they are an explicit member of
    if (member.role === 'ROLE_PROJECT_MANAGER' && role !== 'ROLE_PROJECT_MANAGER') {
      const kept = member.boards.map(b => b.title).join(', ') || 'no boards';
      this.confirmationService.confirm({
        header: 'Demote Project Manager?',
        message: `${member.firstName} will keep access only to boards they belong to (${kept}). ` +
          'Their tasks on every other board will be unassigned.',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Change role',
        rejectLabel: 'Cancel',
        acceptButtonStyleClass: 'p-button-danger',
        rejectButtonStyleClass: 'p-button-text p-button-secondary',
        accept: update
      });
      return;
    }
    update();
  }

  trackByMemberId(index: number, member: WorkspaceMemberResponseDto): number {
    return member.userId;
  }
}
