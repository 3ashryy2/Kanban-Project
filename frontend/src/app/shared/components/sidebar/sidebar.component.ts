import { Component, OnInit, Input, Output, EventEmitter, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthStoreService } from '../../../core/store/auth-store.service';
import { WorkspaceStoreService } from '../../../core/store/workspace-store.service';
import { HttpClient } from '@angular/common/http';
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
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  @Input() boards: any[] = [];
  @Input() activeBoardId: number | null = null;
  @Output() loadBoards = new EventEmitter<number>();
  @Output() navBoard = new EventEmitter<number>();

  selectedWorkspace: any = null;
  isAdmin = false;
  isPM = false;

  createBoardVisible = false;
  newBoard = { title: '', description: '' };

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
          this.isPM = ws.currentUserRole === 'ROLE_PROJECT_MANAGER';
        }
      });
  }

  navigateToBoard(boardId: number): void {
    this.navBoard.emit(boardId);
  }

  navigateToWorkspaceSettings(): void {
    this.router.navigate(['/settings']);
  }

  openCreateBoard(): void {
    this.newBoard = { title: '', description: '' };
    this.createBoardVisible = true;
  }

  submitCreateBoard(): void {
    if (!this.newBoard.title || !this.selectedWorkspace) return;
    
    this.http.post<any>(`/api/workspaces/${this.selectedWorkspace.id}/boards`, this.newBoard)
      .subscribe({
        next: (createdBoard) => {
          this.createBoardVisible = false;
          this.messageService.add({ severity: 'success', summary: 'Board Created', detail: 'New board initialized with default workflow stages.' });
          // Notify parent to refresh boards and navigate
          this.loadBoards.emit(this.selectedWorkspace.id);
          this.navBoard.emit(createdBoard.id);
        },
        error: (err) => {
          this.messageService.add({ severity: 'error', summary: 'Creation Failed', detail: err.error?.message || 'Could not create board.' });
        }
      });
  }

  onSignOut(): void {
    this.authStore.logout();
  }
}
