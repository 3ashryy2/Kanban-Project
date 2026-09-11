import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserDirectoryStoreService } from '../../../core/store/user-directory-store.service';
import { WorkspaceStoreService } from '../../../core/store/workspace-store.service';
import { UserSummaryDto } from '../../../core/models/user.dto';

import { Button } from 'primeng/button';
import { Select } from 'primeng/select';

interface AccessSelection {
  workspaceId: number | null;
  role: string;
}

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, Button, Select],
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.scss']
})
export class AdminUsersComponent implements OnInit {
  readonly userDirectory = inject(UserDirectoryStoreService);
  readonly workspaceStore = inject(WorkspaceStoreService);
  private readonly destroyRef = inject(DestroyRef);

  // Workspace + role picked on each row, keyed by user id
  selections: Record<number, AccessSelection> = {};
  assigningUserId: number | null = null;

  readonly roleOptions = [
    { label: 'Project Manager', value: 'ROLE_PROJECT_MANAGER' },
    { label: 'Developer', value: 'ROLE_DEVELOPER' },
    { label: 'QA Tester', value: 'ROLE_QA_TESTER' },
    { label: 'Viewer', value: 'ROLE_VIEWER' }
  ];

  ngOnInit(): void {
    // Subscribed before the template's async pipe, so every row has a selection when it renders
    this.userDirectory.unassignedUsers$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(users => {
        for (const user of users) {
          this.selections[user.id] ??= { workspaceId: null, role: 'ROLE_DEVELOPER' };
        }
      });

    this.userDirectory.loadUnassignedUsers();
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
