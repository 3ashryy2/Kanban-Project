import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthStoreService } from '../store/auth-store.service';

/**
 * Restricts a route to the global admin, using the refreshed user rather than the localStorage copy.
 * Anyone else sees the Forbidden page, so a bookmarked admin link explains itself instead of silently bouncing.
 */
export const adminGuard: CanActivateFn = () => {
  const authStore = inject(AuthStoreService);
  const router = inject(Router);

  return authStore.ensureFreshSession().pipe(
    map(user => user?.isAdmin ? true : router.createUrlTree(['/forbidden']))
  );
};
