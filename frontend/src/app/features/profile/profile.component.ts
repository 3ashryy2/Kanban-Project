import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthStoreService } from '../../core/store/auth-store.service';
import { WorkspaceStoreService } from '../../core/store/workspace-store.service';

import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';

const ROLE_LABELS: Record<string, string> = {
  ROLE_PROJECT_MANAGER: 'Project Manager',
  ROLE_DEVELOPER: 'Developer',
  ROLE_QA_TESTER: 'QA Tester',
  ROLE_VIEWER: 'Viewer'
};

/** /profile ("My Profile"): who you are signed in as and where you have access. Read-only. */
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, Button, Tag],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent {
  readonly authStore = inject(AuthStoreService);
  readonly workspaceStore = inject(WorkspaceStoreService);

  roleLabel(role: string | null | undefined, isAdmin: boolean): string {
    if (role && ROLE_LABELS[role]) return ROLE_LABELS[role];
    // The global admin can open workspaces it isn't a member of
    return isAdmin ? 'Admin (not a member)' : '—';
  }

  signOut(): void {
    this.authStore.logout();
  }
}
