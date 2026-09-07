import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuditLogResponseDto } from '../models/audit-log.dto';
import { MessageService } from 'primeng/api';
import { WorkspaceStoreService } from './workspace-store.service';

@Injectable({
  providedIn: 'root'
})
export class ActivityStoreService {
  private readonly http = inject(HttpClient);
  private readonly messageService = inject(MessageService);
  private readonly workspaceStore = inject(WorkspaceStoreService);

  private readonly _boardActivity$ = new BehaviorSubject<AuditLogResponseDto[]>([]);
  readonly boardActivity$ = this._boardActivity$.asObservable();

  private readonly _globalAuditPage$ = new BehaviorSubject<any | null>(null);
  readonly globalAuditPage$ = this._globalAuditPage$.asObservable();

  loadBoardActivity(boardId: number, limit = 20): void {
    this.http.get<AuditLogResponseDto[]>(`/api/boards/${boardId}/activity`, {
      params: new HttpParams().set('limit', limit.toString())
    })
      .subscribe({
        next: list => this._boardActivity$.next(list),
        error: () => this.showError('Load Activity Failed', 'Could not load board activity history.')
      });
  }

  loadGlobalAuditLogs(actionType?: string, page = 0, size = 50): void {
    const activeWs = this.workspaceStore.getActiveWorkspace();
    if (!activeWs) {
      this.showError('Workspace Not Selected', 'An active workspace is required to load compliance audit logs.');
      return;
    }

    let params = new HttpParams()
      .set('workspaceId', activeWs.id.toString())
      .set('page', page.toString())
      .set('size', size.toString());

    if (actionType && actionType.trim() !== '') {
      params = params.set('actionType', actionType);
    }

    this.http.get<any>('/api/audit-logs', { params })
      .subscribe({
        next: pageData => this._globalAuditPage$.next(pageData),
        error: () => this.showError('Load Audit Logs Failed', 'Only administrators have access to view global logs.')
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
