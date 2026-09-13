import { Component, DestroyRef, HostListener, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { AuthStoreService } from '../../core/store/auth-store.service';
import { WorkspaceStoreService } from '../../core/store/workspace-store.service';
import { slugify } from '../../shared/utils/slugify';

import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';

// Minimum gap between automatic re-checks when the tab regains focus
const FOCUS_RECHECK_MS = 10_000;

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, FormsModule, Button, InputText, Textarea],
  templateUrl: './onboarding.component.html',
  styleUrls: ['./onboarding.component.scss']
})
export class OnboardingComponent implements OnInit {
  readonly authStore = inject(AuthStoreService);
  private readonly workspaceStore = inject(WorkspaceStoreService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  checking = false;
  creating = false;
  newWorkspace = { name: '', slug: '', description: '' };

  private lastCheckAt = Date.now();
  private slugEdited = false;

  ngOnInit(): void {
    this.authStore.ensureFreshSession()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }

  // Quietly re-check access when the user comes back to this tab
  @HostListener('window:focus')
  onWindowFocus(): void {
    if (!this.authStore.isAdmin() && Date.now() - this.lastCheckAt > FOCUS_RECHECK_MS) {
      this.checkAccess(true);
    }
  }

  checkAccess(quiet = false): void {
    if (this.checking) return;
    this.checking = true;
    this.lastCheckAt = Date.now();

    this.workspaceStore.loadWorkspaces().subscribe({
      next: workspaces => {
        this.checking = false;
        if (workspaces.length > 0) {
          this.router.navigate(['/']);
        } else if (!quiet) {
          this.messageService.add({
            severity: 'info',
            summary: 'No access yet',
            detail: 'You have not been added to a workspace yet.',
            life: 3000
          });
        }
      },
      error: () => this.checking = false
    });
  }

  onWorkspaceNameChange(name: string): void {
    if (!this.slugEdited) {
      this.newWorkspace.slug = slugify(name);
    }
  }

  onSlugEdited(): void {
    this.slugEdited = true;
  }

  createWorkspace(): void {
    if (!this.newWorkspace.name || !this.newWorkspace.slug || this.creating) return;
    this.creating = true;

    this.workspaceStore.createWorkspace(this.newWorkspace).subscribe({
      next: () => {
        this.creating = false;
        this.router.navigate(['/']);
      },
      error: () => this.creating = false
    });
  }

  signOut(): void {
    this.authStore.logout();
  }
}
