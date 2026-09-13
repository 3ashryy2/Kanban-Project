import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, EMPTY, Observable, catchError, tap } from 'rxjs';
import { WorkflowTransitionUpdateRequest } from '../models/workflow.dto';
import { MessageService } from 'primeng/api';

@Injectable({
  providedIn: 'root'
})
export class WorkflowStoreService {
  private readonly http = inject(HttpClient);
  private readonly messageService = inject(MessageService);

  private readonly _transitions$ = new BehaviorSubject<WorkflowTransitionUpdateRequest[]>([]);
  readonly transitions$ = this._transitions$.asObservable();
  transitionsList: WorkflowTransitionUpdateRequest[] = [];

  clear(): void {
    this._transitions$.next([]);
    this.transitionsList = [];
  }

  loadTransitions(boardId: number): void {
    // Errors are already surfaced as toasts by fetchTransitions
    this.fetchTransitions(boardId).subscribe({ error: () => {} });
  }

  /** Reads the board's rules from the server, keeps them here, and hands them to the caller. */
  fetchTransitions(boardId: number): Observable<WorkflowTransitionUpdateRequest[]> {
    return this.http.get<WorkflowTransitionUpdateRequest[]>(`/api/boards/${boardId}/transitions`).pipe(
      tap({
        next: list => {
          this._transitions$.next(list);
          this.transitionsList = list;
        },
        error: () => this.showError('Load Transitions Failed', 'Could not load state machine transitions.')
      })
    );
  }

  /** Emits the saved rules on success; on failure shows the reason and completes without emitting. */
  updateTransitions(boardId: number, requests: WorkflowTransitionUpdateRequest[]): Observable<WorkflowTransitionUpdateRequest[]> {
    return this.http.put<WorkflowTransitionUpdateRequest[]>(`/api/boards/${boardId}/transitions`, requests).pipe(
      tap(updated => {
        this._transitions$.next(updated);
        this.transitionsList = updated;
        this.messageService.add({
          severity: 'success',
          summary: 'Workflow Updated',
          detail: 'State-machine governance rules successfully written.',
          life: 3000
        });
      }),
      catchError(err => {
        this.showError('Update Failed', err.error?.message || 'Could not save rules matrix.');
        return EMPTY;
      })
    );
  }

  private showError(summary: string, detail: string): void {
    this.messageService.add({
      severity: 'error',
      summary,
      detail,
      life: 4000
    });
  }
}
