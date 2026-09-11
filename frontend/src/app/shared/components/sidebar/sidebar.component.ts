import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthStoreService } from '../../../core/store/auth-store.service';
import { WorkspaceStoreService } from '../../../core/store/workspace-store.service';
import { UserDirectoryStoreService } from '../../../core/store/user-directory-store.service';
import { WorkspaceResponseDto } from '../../../core/models/workspace.dto';
import { BoardDetailsDto } from '../../../core/models/board.dto';
import { HttpClient } from '@angular/common/http';
import { distinctUntilChanged, filter } from 'rxjs';
import { MessageService } from 'primeng/api';

import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { Tooltip } from 'primeng/tooltip';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    Button,
    Dialog,
    InputText,
    Textarea,
    Tooltip
  ],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit {
  readonly authStore = inject(AuthStoreService);
  readonly workspaceStore = inject(WorkspaceStoreService);
  readonly userDirectory = inject(UserDirectoryStoreService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  selectedWorkspace: WorkspaceResponseDto | null = null;
  isAdmin = false;
  isPM = false;

  createBoardVisible = false;
  creatingBoard = false;
  newBoard = { title: '', description: '' };

  ngOnInit(): void {
    this.authStore.isAdmin$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(isAdmin => {
        this.isAdmin = isAdmin;
      });

    // The admin's onboarding link shows how many registered users still wait for access
    this.authStore.isAdmin$
      .pipe(distinctUntilChanged(), filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.userDirectory.loadUnassignedUsers());

    this.workspaceStore.activeWorkspace$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(ws => {
        this.selectedWorkspace = ws;
        this.isPM = ws?.currentUserRole === 'ROLE_PROJECT_MANAGER';
      });
  }

  openCreateBoard(): void {
    this.newBoard = { title: '', description: '' };
    this.createBoardVisible = true;
  }

  submitCreateBoard(): void {
    const workspace = this.selectedWorkspace;
    if (!this.newBoard.title || !workspace || this.creatingBoard) return;
    this.creatingBoard = true;

    this.http.post<BoardDetailsDto>(`/api/workspaces/${workspace.id}/boards`, this.newBoard)
      .subscribe({
        next: createdBoard => {
          this.creatingBoard = false;
          this.createBoardVisible = false;
          this.workspaceStore.addBoard(createdBoard);
          this.messageService.add({ severity: 'success', summary: 'Board Created', detail: 'New board initialized with default workflow stages.' });
          this.router.navigate(['/w', workspace.id, 'boards', createdBoard.id]);
        },
        error: err => {
          this.creatingBoard = false;
          this.messageService.add({ severity: 'error', summary: 'Creation Failed', detail: err.error?.message || 'Could not create board.' });
        }
      });
  }

  trackByBoardId(index: number, board: BoardDetailsDto): number {
    return board.id;
  }

  onSignOut(): void {
    this.authStore.logout();
  }
}
