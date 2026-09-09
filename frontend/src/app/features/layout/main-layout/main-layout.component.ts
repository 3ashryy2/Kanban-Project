import { Component, OnInit, inject, DestroyRef, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { WorkspaceStoreService } from '../../../core/store/workspace-store.service';
import { BoardStoreService } from '../../../core/store/board-store.service';
import { WorkflowStoreService } from '../../../core/store/workflow-store.service';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { HeaderComponent } from '../../../shared/components/header/header.component';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar.component';

import { Toast } from 'primeng/toast';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    Toast,
    HeaderComponent,
    SidebarComponent
  ],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.scss']
})
export class MainLayoutComponent implements OnInit {
  readonly workspaceStore = inject(WorkspaceStoreService);
  readonly boardStore = inject(BoardStoreService);
  readonly workflowStore = inject(WorkflowStoreService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  boards = signal<any[]>([]);
  activeBoardId = signal<number | null>(null);
  selectedWorkspaceId = signal<number | null>(null);

  ngOnInit(): void {
    this.workspaceStore.loadWorkspaces();
    
    // Subscribe to active workspace to fetch associated boards
    this.workspaceStore.activeWorkspace$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(ws => {
        if (ws) {
          this.selectedWorkspaceId.set(ws.id);
          this.loadBoardsForWorkspace(ws.id);
        }
      });
  }

  loadBoardsForWorkspace(workspaceId: number): void {
    this.http.get<any[]>(`/api/workspaces/${workspaceId}/boards`)
      .subscribe({
        next: list => {
          this.boards.set(list);
          const activeBoardExists = this.activeBoardId() && list.some(b => b.id === this.activeBoardId());
          if (list.length > 0) {
            if (activeBoardExists) {
              this.navigateToBoard(this.activeBoardId()!);
            } else {
              this.navigateToBoard(list[0].id);
            }
          } else {
            this.activeBoardId.set(null);
            this.boardStore.clear();
            this.router.navigate(['/settings']);
          }
        },
        error: () => {
          this.boards.set([]);
          this.activeBoardId.set(null);
          this.boardStore.clear();
        }
      });
  }

  navigateToBoard(boardId: number): void {
    this.activeBoardId.set(boardId);
    this.boardStore.loadBoard(boardId);
    this.workflowStore.loadTransitions(boardId);
    
    // Ensure we are showing the board canvas (dashboard route)
    if (this.router.url !== '/dashboard') {
      this.router.navigate(['/dashboard']);
    }
  }
}
