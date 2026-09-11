import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Observable, catchError, map, of, switchMap } from 'rxjs';
import { AuthStoreService } from '../store/auth-store.service';
import { WorkspaceStoreService } from '../store/workspace-store.service';
import { WorkspaceResponseDto } from '../models/workspace.dto';

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
