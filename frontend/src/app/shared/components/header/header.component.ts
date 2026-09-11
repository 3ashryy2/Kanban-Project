import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthStoreService } from '../../../core/store/auth-store.service';
import { WorkspaceStoreService } from '../../../core/store/workspace-store.service';
import { UserSearchSelectComponent } from '../user-search-select/user-search-select.component';
import { slugify } from '../../utils/slugify';

import { Select } from 'primeng/select';
import { Button } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { Tooltip } from 'primeng/tooltip';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Select,
    Button,
    Menu,
    Dialog,
    InputText,
    Textarea,
    Tooltip,
    UserSearchSelectComponent
  ],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {
  readonly authStore = inject(AuthStoreService);
  readonly workspaceStore = inject(WorkspaceStoreService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  selectedWorkspace: any = null;
  isAdmin = false;
  createWorkspaceVisible = false;
  creatingWorkspace = false;
  newWorkspace = { name: '', slug: '', description: '', initialManagerId: null as number | null };
  private slugEdited = false;

  profileMenuItems: MenuItem[] = [
    { label: 'My Settings', icon: 'pi pi-cog' },
    { label: 'Log Out', icon: 'pi pi-power-off', command: () => this.onSignOut() }
  ];

  ngOnInit(): void {
    this.authStore.isAdmin$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(isAdmin => {
        this.isAdmin = isAdmin;
      });

    this.workspaceStore.activeWorkspace$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(ws => {
        if (ws) {
          this.selectedWorkspace = ws;
        }
      });
  }

  onWorkspaceChange(ws: any): void {
    if (ws) {
      this.workspaceStore.setActiveWorkspace(ws);
      // Optional: automatically navigate to the workspace settings or first board
      this.router.navigate([`/workspaces/${ws.id}/settings`]);
    }
  }

  openCreateWorkspace(): void {
    this.newWorkspace = { name: '', slug: '', description: '', initialManagerId: null };
    this.slugEdited = false;
    this.createWorkspaceVisible = true;
  }

  onWorkspaceNameChange(name: string): void {
    if (!this.slugEdited) {
      this.newWorkspace.slug = slugify(name);
    }
  }

  onSlugEdited(): void {
    this.slugEdited = true;
  }

  submitCreateWorkspace(): void {
    if (!this.newWorkspace.name || !this.newWorkspace.slug || this.creatingWorkspace) return;
    this.creatingWorkspace = true;

    // Keep the dialog open on failure so the admin can fix the slug or name
    this.workspaceStore.createWorkspace(this.newWorkspace).subscribe({
      next: () => {
        this.creatingWorkspace = false;
        this.createWorkspaceVisible = false;
      },
      error: () => this.creatingWorkspace = false
    });
  }

  onSignOut(): void {
    this.authStore.logout();
  }
}
