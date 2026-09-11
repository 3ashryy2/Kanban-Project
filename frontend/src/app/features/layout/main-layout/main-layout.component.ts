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
    // Usually already loaded by hasWorkspaceGuard; the request is shared, not repeated
    this.workspaceStore.ensureWorkspacesLoaded().subscribe({ error: () => {} });

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
            // Select without navigating, so loading boards never pulls the user off another page
            this.selectBoard(activeBoardExists ? this.activeBoardId()! : list[0].id);
          } else {
            this.activeBoardId.set(null);
            this.boardStore.clear();
            if (this.router.url.startsWith('/dashboard')) {
              this.router.navigate(['/settings']);
            }
          }
        },
        error: () => {
          this.boards.set([]);
          this.activeBoardId.set(null);
          this.boardStore.clear();
        }
      });
  }

  // Explicit board choice from the sidebar: select it and show the board canvas
  navigateToBoard(boardId: number): void {
    this.selectBoard(boardId);
    if (this.router.url !== '/dashboard') {
      this.router.navigate(['/dashboard']);
    }
  }

  private selectBoard(boardId: number): void {
    this.activeBoardId.set(boardId);
    this.boardStore.loadBoard(boardId);
    this.workflowStore.loadTransitions(boardId);
  }
}
