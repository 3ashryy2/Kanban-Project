import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { map, switchMap, tap } from 'rxjs';
import { WorkspaceStoreService } from '../../../core/store/workspace-store.service';
import { AuthStoreService } from '../../../core/store/auth-store.service';
import { WorkspaceResponseDto } from '../../../core/models/workspace.dto';
import { lastVisited } from '../../../core/utils/last-visited';

const ROLE_LABELS: Record<string, string> = {
  ROLE_PROJECT_MANAGER: 'Project Manager',
  ROLE_DEVELOPER: 'Developer',
  ROLE_QA_TESTER: 'QA Tester',
  ROLE_VIEWER: 'Viewer'
};

/**
 * /w/:workspaceId: opens the last-used (or first) board this user may open.
 * With no boards to open, explains why instead of showing an empty board.
 */
@Component({
  selector: 'app-workspace-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './workspace-home.component.html',
  styleUrls: ['./workspace-home.component.scss']
})
export class WorkspaceHomeComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly workspaceStore = inject(WorkspaceStoreService);
  readonly authStore = inject(AuthStoreService);

  // The component is reused when only :workspaceId changes, so react to the parameter, not to ngOnInit
  readonly state$ = this.route.parent!.paramMap.pipe(
    map(params => Number(params.get('workspaceId'))),
    switchMap(workspaceId => this.workspaceStore.ensureBoardsLoaded(workspaceId).pipe(
      map(boards => ({ workspaceId, boards }))
    )),
    tap(({ workspaceId, boards }) => {
      if (boards.length > 0) {
        const remembered = lastVisited.boardId(workspaceId);
        const target = boards.find(b => b.id === remembered) ?? boards[0];
        // replaceUrl: the Back button shouldn't return here only to be forwarded again
        this.router.navigate(['/w', workspaceId, 'boards', target.id], { replaceUrl: true });
      }
    })
  );

  canManageBoards(workspace: WorkspaceResponseDto): boolean {
    return this.authStore.isAdmin() || workspace.currentUserRole === 'ROLE_PROJECT_MANAGER';
  }

  roleLabel(role: string | null | undefined): string {
    return (role && ROLE_LABELS[role]) || 'member';
  }
}
