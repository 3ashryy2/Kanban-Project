import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { WorkspaceStoreService } from '../../../core/store/workspace-store.service';
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
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  boards: any[] = [];
  activeBoardId: number | null = null;
  selectedWorkspaceId: number | null = null;

  ngOnInit(): void {
    this.workspaceStore.loadWorkspaces();
    
    // Subscribe to active workspace to fetch associated boards
    this.workspaceStore.activeWorkspace$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(ws => {
        if (ws) {
          this.selectedWorkspaceId = ws.id;
          this.loadBoardsForWorkspace(ws.id);
        }
      });
  }

  loadBoardsForWorkspace(workspaceId: number): void {
    this.http.get<any[]>(`/api/workspaces/${workspaceId}/boards`)
      .subscribe({
        next: list => {
          this.boards = list;
          // Auto navigate to the first board of this workspace if active
          if (list.length > 0 && !this.activeBoardId) {
            this.navigateToBoard(list[0].id);
          } else if (list.length === 0) {
            this.activeBoardId = null;
            this.router.navigate([`/workspaces/${workspaceId}/settings`]);
          }
        },
        error: () => {
          this.boards = [];
          this.activeBoardId = null;
        }
      });
  }

  navigateToBoard(boardId: number): void {
    this.activeBoardId = boardId;
    const wsId = this.selectedWorkspaceId ?? 1;
    this.router.navigate([`/workspaces/${wsId}/boards/${boardId}`]);
  }
}
