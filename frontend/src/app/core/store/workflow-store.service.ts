import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
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

  loadTransitions(boardId: number): void {
    this.http.get<WorkflowTransitionUpdateRequest[]>(`/api/boards/${boardId}/transitions`)
      .subscribe({
        next: list => {
          this._transitions$.next(list);
          this.transitionsList = list;
        },
        error: () => this.showError('Load Transitions Failed', 'Could not load state machine transitions.')
      });
  }

  updateTransitions(boardId: number, requests: WorkflowTransitionUpdateRequest[]): void {
    this.http.put<WorkflowTransitionUpdateRequest[]>(`/api/boards/${boardId}/transitions`, requests)
      .subscribe({
        next: updated => {
          this._transitions$.next(updated);
          this.transitionsList = updated;
          this.messageService.add({
            severity: 'success',
            summary: 'Workflow Updated',
            detail: 'State-machine governance rules successfully written.',
            life: 3000
          });
        },
        error: err => this.showError('Update Failed', err.error?.message || 'Could not save rules matrix.')
      });
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
