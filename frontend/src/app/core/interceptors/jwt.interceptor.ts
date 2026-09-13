import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthStoreService } from '../store/auth-store.service';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const authStore = inject(AuthStoreService);
  const router = inject(Router);
  const token = localStorage.getItem('jwt_token');

  // Automatically attach Bearer token to all outgoing backend API calls
  const outgoing = token && req.url.startsWith('/api')
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(outgoing).pipe(
    catchError((error: HttpErrorResponse) => {
      // 401 means the session itself is dead (expired/invalid token): end it once and return to sign-in.
      // hasStoredSession() is true until the first logout, so parallel failures log out only once.
      // Login failures are 401 too, so auth endpoints are excluded.
      if (error.status === 401 && authStore.hasStoredSession() && !req.url.startsWith('/api/auth/')) {
        authStore.logout(router.url);
      }
      return throwError(() => error);
    })
  );
};
