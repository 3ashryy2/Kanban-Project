import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Observable, catchError, map, of, switchMap } from 'rxjs';
import { AuthStoreService } from '../store/auth-store.service';
import { WorkspaceStoreService } from '../store/workspace-store.service';
import { WorkspaceResponseDto } from '../models/workspace.dto';
import { findRouteParam } from '../utils/route-params';

/** On "/": opens the last-used workspace (the store already prefers it), or the first one. */
export const homeRedirectGuard: CanActivateFn = () => {
  const workspaceStore = inject(WorkspaceStoreService);
  const router = inject(Router);

  return workspaceStore.ensureWorkspacesLoaded().pipe(
    map(workspaces => {
      if (workspaces.length === 0) return router.createUrlTree(['/onboarding']);
      const target = workspaceStore.getActiveWorkspace() ?? workspaces[0];
      return router.createUrlTree(['/w', target.id]);
    }),
    catchError(() => of(false))
  );
};

/** On /w/:workspaceId: the workspace must be one of the user's; it becomes the active workspace. */
export const workspaceGuard: CanActivateFn = route => {
  const workspaceStore = inject(WorkspaceStoreService);
  const messageService = inject(MessageService);
  const router = inject(Router);
  const workspaceId = Number(route.paramMap.get('workspaceId'));

  return workspaceStore.ensureWorkspacesLoaded().pipe(
    map(workspaces => {
      const workspace = workspaces.find(w => w.id === workspaceId);
      if (!workspace) {
        messageService.add({
          severity: 'warn',
          summary: 'Workspace unavailable',
          detail: 'That workspace does not exist or you are not a member of it.',
          life: 4000
        });
        return router.createUrlTree(['/']);
      }
      if (workspaceStore.getActiveWorkspace()?.id !== workspace.id) {
        workspaceStore.setActiveWorkspace(workspace);
      }
      return true;
    }),
    catchError(() => of(false))
  );
};

/**
 * On /w/:workspaceId/boards/:boardId: only boards this user may open.
 * The server enforces the same rule (403); this spares the user a broken page.
 */
export const boardAccessGuard: CanActivateFn = route => {
  const workspaceStore = inject(WorkspaceStoreService);
  const messageService = inject(MessageService);
  const router = inject(Router);
  const workspaceId = Number(findRouteParam(route, 'workspaceId'));
  const boardId = Number(route.paramMap.get('boardId'));

  return workspaceStore.ensureBoardsLoaded(workspaceId).pipe(
    map(boards => {
      if (boards.some(b => b.id === boardId)) return true;
      messageService.add({
        severity: 'warn',
        summary: 'Board unavailable',
        detail: "You don't have access to that board.",
        life: 4000
      });
      return router.createUrlTree(['/w', workspaceId]);
    }),
    catchError(() => of(router.createUrlTree(['/w', workspaceId])))
  );
};

/**
 * Refreshes the session, then loads the user's workspaces.
 * Emits null when the session ended during the refresh (the interceptor is already redirecting to sign-in).
 */
function workspacesForLiveSession(): Observable<WorkspaceResponseDto[] | null> {
  const authStore = inject(AuthStoreService);
  const workspaceStore = inject(WorkspaceStoreService);

  return authStore.ensureFreshSession().pipe(
    switchMap(() => authStore.isAuthenticated() ? workspaceStore.ensureWorkspacesLoaded() : of(null))
  );
}

/** Sends signed-in users who belong to no workspace yet to the onboarding page. */
export const hasWorkspaceGuard: CanActivateFn = () => {
  const router = inject(Router);

  // Unauthenticated sessions are authGuard's job
  if (!inject(AuthStoreService).isAuthenticated()) {
    return true;
  }

  return workspacesForLiveSession().pipe(
    map(workspaces => {
      if (workspaces === null) return false;
      return workspaces.length > 0 ? true : router.createUrlTree(['/onboarding']);
    }),
    // On a load failure stay in the app, where the store already surfaces the error
    catchError(() => of(true))
  );
};

/** Keeps users who already have a workspace away from the onboarding page. */
export const noWorkspaceGuard: CanActivateFn = () => {
  const router = inject(Router);

  if (!inject(AuthStoreService).isAuthenticated()) {
    return true;
  }

  return workspacesForLiveSession().pipe(
    map(workspaces => {
      if (workspaces === null) return false;
      return workspaces.length === 0 ? true : router.createUrlTree(['/']);
    }),
    catchError(() => of(true))
  );
};
