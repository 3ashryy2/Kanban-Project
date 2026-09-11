import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, of } from 'rxjs';
import { MessageService } from 'primeng/api';
import { UserSummaryDto } from '../models/user.dto';

export const USER_SEARCH_MIN_LENGTH = 2;

@Injectable({
  providedIn: 'root'
})
export class UserDirectoryStoreService {
  private readonly http = inject(HttpClient);
  private readonly messageService = inject(MessageService);

  // Registered users with no workspace membership yet (admin onboarding queue)
  private readonly _unassignedUsers$ = new BehaviorSubject<UserSummaryDto[]>([]);
  readonly unassignedUsers$ = this._unassignedUsers$.asObservable();

  loadUnassignedUsers(): void {
    this.http.get<UserSummaryDto[]>('/api/admin/users/unassigned')
      .subscribe({
        next: list => this._unassignedUsers$.next(list),
        error: () => this.messageService.add({
          severity: 'error',
          summary: 'Load Users Failed',
          detail: 'Could not load users waiting for access.',
          life: 4000
        })
      });
  }

  markAssigned(userId: number): void {
    this._unassignedUsers$.next(this._unassignedUsers$.getValue().filter(u => u.id !== userId));
  }

  /** Server-side directory search. Callers debounce; short queries resolve to an empty list without a request. */
  searchUsers(query: string, excludeWorkspaceId?: number | null): Observable<UserSummaryDto[]> {
    const q = query.trim();
    if (q.length < USER_SEARCH_MIN_LENGTH) {
      return of([]);
    }

    let params = new HttpParams().set('q', q);
    if (excludeWorkspaceId != null) {
      params = params.set('excludeWorkspaceId', excludeWorkspaceId);
    }

    return this.http.get<UserSummaryDto[]>('/api/users/search', { params }).pipe(
      catchError(() => of([]))
    );
  }

  clear(): void {
    this._unassignedUsers$.next([]);
  }
}
