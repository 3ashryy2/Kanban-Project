import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, catchError, map, of, shareReplay, tap } from 'rxjs';
import { AuthResponse, SimpleUserDto } from '../models/user.dto';
import { WorkspaceStoreService } from './workspace-store.service';
import { BoardStoreService } from './board-store.service';
import { WorkflowStoreService } from './workflow-store.service';
import { ActivityStoreService } from './activity-store.service';
import { UserDirectoryStoreService } from './user-directory-store.service';

@Injectable({
  providedIn: 'root'
})
export class AuthStoreService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly workspaceStore = inject(WorkspaceStoreService);
  private readonly boardStore = inject(BoardStoreService);
  private readonly workflowStore = inject(WorkflowStoreService);
  private readonly activityStore = inject(ActivityStoreService);
  private readonly userDirectoryStore = inject(UserDirectoryStoreService);

  private readonly _currentUser$ = new BehaviorSubject<any | null>(null);
  readonly currentUser$ = this._currentUser$.asObservable();

  readonly isAdmin$ = this.currentUser$.pipe(
    map(user => user?.isAdmin ?? false)
  );

  private readonly _token$ = new BehaviorSubject<string | null>(null);
  readonly token$ = this._token$.asObservable();

  // Shared once-per-load refresh of the cached user; reset whenever the session changes
  private sessionRefresh$: Observable<SimpleUserDto | null> | null = null;

  constructor() {
    this.hydrateSession();
  }

  login(credentials: { email: string; password: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/login', credentials).pipe(
      tap(response => this.startSession(response))
    );
  }

  register(payload: any): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/register', payload).pipe(
      tap(response => this.startSession(response))
    );
  }

  logout(returnUrl?: string): void {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('current_user');
    this._token$.next(null);
    this._currentUser$.next(null);
    this.sessionRefresh$ = null;

    // Clear all stores to prevent cross-session state leakage
    this.workspaceStore.clear();
    this.boardStore.clear();
    this.workflowStore.clear();
    this.activityStore.clear();
    this.userDirectoryStore.clear();

    this.router.navigate(['/auth/login'], returnUrl ? { queryParams: { returnUrl } } : {});
  }

  isAuthenticated(): boolean {
    return !!this._token$.getValue();
  }

  isAdmin(): boolean {
    return this._currentUser$.getValue()?.isAdmin ?? false;
  }

  getCurrentUserId(): number | null {
    const user = this._currentUser$.getValue();
    return user ? user.id : null;
  }

  refreshMe(): Observable<SimpleUserDto> {
    return this.http.get<SimpleUserDto>('/api/users/me').pipe(
      tap(user => {
        localStorage.setItem('current_user', JSON.stringify(user));
        this._currentUser$.next(user);
      })
    );
  }

  /**
   * Re-reads the signed-in user once per app load, so flags cached in localStorage
   * (such as isAdmin) are never stale when guards evaluate them.
   */
  ensureFreshSession(): Observable<SimpleUserDto | null> {
    if (!this.isAuthenticated()) {
      return of(null);
    }
    if (!this.sessionRefresh$) {
      this.sessionRefresh$ = this.refreshMe().pipe(
        catchError(() => of(this._currentUser$.getValue())),
        shareReplay(1)
      );
    }
    return this.sessionRefresh$;
  }

  private startSession(response: AuthResponse): void {
    localStorage.setItem('jwt_token', response.token);
    localStorage.setItem('current_user', JSON.stringify(response.user));
    this._token$.next(response.token);
    this._currentUser$.next(response.user);
    // The auth response is already fresh; no need to refetch it for this session
    this.sessionRefresh$ = of(response.user);
  }

  private hydrateSession(): void {
    const token = localStorage.getItem('jwt_token');
    const userString = localStorage.getItem('current_user');
    if (token && userString) {
      this._token$.next(token);
      this._currentUser$.next(JSON.parse(userString));
    }
  }
}
