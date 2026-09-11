import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, CanActivateFn, GuardResult, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { authGuard, guestGuard } from './auth.guard';
import { AuthStoreService } from '../store/auth-store.service';

describe('authGuard and guestGuard', () => {
  let authenticated: boolean;
  let authStore: { isAuthenticated: () => boolean; clearSession: any };

  beforeEach(() => {
    authenticated = false;
    authStore = { isAuthenticated: () => authenticated, clearSession: vi.fn() };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthStoreService, useValue: authStore }]
    });
  });

  const run = (guard: CanActivateFn, url = '/w/1/boards/1'): GuardResult =>
    TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot)) as GuardResult;

  it('lets a live session through', () => {
    authenticated = true;
    expect(run(authGuard)).toBe(true);
  });

  it('sends a missing or expired session to sign-in and remembers the page', () => {
    const result = run(authGuard) as UrlTree;

    expect(TestBed.inject(Router).serializeUrl(result).startsWith('/auth/login')).toBe(true);
    expect(result.queryParams['returnUrl']).toBe('/w/1/boards/1');
    expect(authStore.clearSession).toHaveBeenCalled();
  });

  it('keeps signed-in users off the sign-in page', () => {
    authenticated = true;
    expect(TestBed.inject(Router).serializeUrl(run(guestGuard) as UrlTree)).toBe('/');
  });

  it('shows the sign-in page to guests', () => {
    expect(run(guestGuard)).toBe(true);
  });
});
