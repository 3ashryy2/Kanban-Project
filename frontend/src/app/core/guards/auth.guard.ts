import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthStoreService } from '../store/auth-store.service';

/** Requires a live session. An expired one is cleared, and sign-in returns the user to where they were going. */
export const authGuard: CanActivateFn = (route, state) => {
  const authStore = inject(AuthStoreService);
  const router = inject(Router);

  if (authStore.isAuthenticated()) {
    return true;
  }

  authStore.clearSession();
  const returnUrl = state.url && state.url !== '/' ? state.url : null;
  return router.createUrlTree(['/auth/login'], returnUrl ? { queryParams: { returnUrl } } : {});
};

/** Keeps signed-in users away from the sign-in and registration pages. */
export const guestGuard: CanActivateFn = () => {
  const authStore = inject(AuthStoreService);
  const router = inject(Router);

  return authStore.isAuthenticated() ? router.createUrlTree(['/']) : true;
};
