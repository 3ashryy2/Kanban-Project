import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserDirectoryStoreService } from '../../../core/store/user-directory-store.service';
import { WorkspaceStoreService } from '../../../core/store/workspace-store.service';
import { UserSummaryDto } from '../../../core/models/user.dto';
import { ListPager } from '../../../core/utils/list-pager';

import { Button } from 'primeng/button';
import { Paginator } from 'primeng/paginator';
import { Select } from 'primeng/select';
import { Checkbox } from 'primeng/checkbox';

interface AccessSelection {
  workspaceId: number | null;
  role: string;
}

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, Button, Paginator, Select, Checkbox],
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.scss']
})
export class AdminUsersComponent implements OnInit {
  readonly userDirectory = inject(UserDirectoryStoreService);
  readonly workspaceStore = inject(WorkspaceStoreService);
  private readonly destroyRef = inject(DestroyRef);

  // Workspace + role picked on each row, keyed by user id, so picks survive paging
  selections: Record<number, AccessSelection> = {};
  assigningUserId: number | null = null;
  readonly pager = new ListPager();

  // Bulk Provisioning State
  selectedUsers: UserSummaryDto[] = [];
  bulkWorkspaceId: number | null = null;
  bulkRole = 'ROLE_DEVELOPER';
  bulkAssigning = false;

  readonly roleOptions = [
    { label: 'Project Manager', value: 'ROLE_PROJECT_MANAGER' },
    { label: 'Developer', value: 'ROLE_DEVELOPER' },
    { label: 'QA Tester', value: 'ROLE_QA_TESTER' },
    { label: 'Viewer', value: 'ROLE_VIEWER' }
  ];

  ngOnInit(): void {
    // Subscribed before the template's async pipe, so every row has a selection, and the page
    // still has rows, when the list renders (granting access takes a user off the list)
    this.userDirectory.unassignedUsers$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(users => {
        for (const user of users) {
          this.selections[user.id] ??= { workspaceId: null, role: 'ROLE_DEVELOPER' };
        }
        this.pager.fit(users.length);
      });

    this.userDirectory.loadUnassignedUsers();
  }

  isUserChecked(user: UserSummaryDto): boolean {
    return this.selectedUsers.some(u => u.id === user.id);
  }

  toggleUserChecked(user: UserSummaryDto, checked: boolean): void {
    if (checked) {
      if (!this.selectedUsers.some(u => u.id === user.id)) {
        this.selectedUsers.push(user);
      }
    } else {
      this.selectedUsers = this.selectedUsers.filter(u => u.id !== user.id);
    }
  }

  toggleAllUsersChecked(users: UserSummaryDto[], checked: boolean): void {
    if (checked) {
      this.selectedUsers = [...users];
    } else {
      this.selectedUsers = [];
    }
  }

  grantAccessBulk(): void {
    if (!this.bulkWorkspaceId || this.selectedUsers.length === 0 || this.bulkAssigning) return;
    this.bulkAssigning = true;

    const workspaceId = this.bulkWorkspaceId;
    const role = this.bulkRole;
    const userIds = this.selectedUsers.map(u => u.id);

    this.workspaceStore.addMembersBulk(workspaceId, userIds, role).subscribe({
      next: () => {
        this.bulkAssigning = false;
        // Mark all successfully assigned users as assigned in the directory store
        userIds.forEach(id => {
          this.userDirectory.markAssigned(id);
          delete this.selections[id];
        });
        this.selectedUsers = [];
        this.bulkWorkspaceId = null;
      },
      error: () => this.bulkAssigning = false
    });
  }

  grantAccess(user: UserSummaryDto): void {
    const selection = this.selections[user.id];
    if (!selection?.workspaceId || this.assigningUserId !== null) return;

    this.assigningUserId = user.id;
    this.workspaceStore.addMember(selection.workspaceId, { userId: user.id, role: selection.role })
      .subscribe({
        next: () => {
          this.assigningUserId = null;
          this.userDirectory.markAssigned(user.id);
          delete this.selections[user.id];
        },
        error: () => this.assigningUserId = null
      });
  }

  trackByUserId(index: number, user: UserSummaryDto): number {
    return user.id;
  }
}
