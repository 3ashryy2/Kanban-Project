import { Component, OnInit, inject, DestroyRef, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute, NavigationEnd } from '@angular/router';
import { WorkspaceStoreService } from '../../../core/store/workspace-store.service';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { filter } from 'rxjs';

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
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  boards = signal<any[]>([]);
  activeBoardId = signal<number | null>(null);
  selectedWorkspaceId = signal<number | null>(null);

  ngOnInit(): void {
    this.syncActiveRouteParams();

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.syncActiveRouteParams();
    });

    this.workspaceStore.loadWorkspaces(this.selectedWorkspaceId() ?? undefined);
    
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

  private syncActiveRouteParams(): void {
    let currentRoute = this.route.root;
    while (currentRoute.firstChild) {
      currentRoute = currentRoute.firstChild;
    }
    const params = currentRoute.snapshot.params;
    const wsId = params['workspaceId'] ? Number(params['workspaceId']) : null;
    const bId = params['boardId'] ? Number(params['boardId']) : null;

    if (wsId) {
      this.selectedWorkspaceId.set(wsId);
    }
    if (bId) {
      this.activeBoardId.set(bId);
    }
  }

  loadBoardsForWorkspace(workspaceId: number): void {
    this.http.get<any[]>(`/api/workspaces/${workspaceId}/boards`)
      .subscribe({
        next: list => {
          this.boards.set(list);
          // Auto navigate to the first board of this workspace if active board is not in the loaded list
          const activeBoardExists = this.activeBoardId() && list.some(b => b.id === this.activeBoardId());
          if (list.length > 0 && !activeBoardExists) {
            this.navigateToBoard(list[0].id);
          } else if (list.length === 0) {
            this.activeBoardId.set(null);
            this.router.navigate([`/workspaces/${workspaceId}/settings`]);
          }
        },
        error: () => {
          this.boards.set([]);
          this.activeBoardId.set(null);
        }
      });
  }

  navigateToBoard(boardId: number): void {
    this.activeBoardId.set(boardId);
    const wsId = this.selectedWorkspaceId() ?? 1;
    this.router.navigate([`/workspaces/${wsId}/boards/${boardId}`]);
  }
}
