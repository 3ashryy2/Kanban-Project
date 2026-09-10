import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap, map } from 'rxjs';
import { AuthResponse } from '../models/user.dto';
import { WorkspaceStoreService } from './workspace-store.service';
import { BoardStoreService } from './board-store.service';
import { WorkflowStoreService } from './workflow-store.service';
import { ActivityStoreService } from './activity-store.service';

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

  private readonly _currentUser$ = new BehaviorSubject<any | null>(null);
  readonly currentUser$ = this._currentUser$.asObservable();

  readonly isAdmin$ = this.currentUser$.pipe(
    map(user => user?.isAdmin ?? false)
  );

  private readonly _token$ = new BehaviorSubject<string | null>(null);
  readonly token$ = this._token$.asObservable();

  constructor() {
    this.hydrateSession();
  }

  login(credentials: { email: string; password: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/login', credentials).pipe(
      tap(response => {
        localStorage.setItem('jwt_token', response.token);
        localStorage.setItem('current_user', JSON.stringify(response.user));
        this._token$.next(response.token);
        this._currentUser$.next(response.user);
      })
    );
  }

  register(payload: any): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/register', payload).pipe(
      tap(response => {
        localStorage.setItem('jwt_token', response.token);
        localStorage.setItem('current_user', JSON.stringify(response.user));
        this._token$.next(response.token);
        this._currentUser$.next(response.user);
      })
    );
  }

  logout(): void {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('current_user');
    this._token$.next(null);
    this._currentUser$.next(null);
    
    // Clear all stores to prevent cross-session state leakage
    this.workspaceStore.clear();
    this.boardStore.clear();
    this.workflowStore.clear();
    this.activityStore.clear();

    this.router.navigate(['/auth/login']);
  }

  isAuthenticated(): boolean {
    return !!this._token$.getValue();
  }

  getCurrentUserId(): number | null {
    const user = this._currentUser$.getValue();
    return user ? user.id : null;
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
