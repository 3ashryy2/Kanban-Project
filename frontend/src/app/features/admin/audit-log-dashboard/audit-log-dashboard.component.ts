import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivityStoreService } from '../../../core/store/activity-store.service';
import { WorkspaceStoreService } from '../../../core/store/workspace-store.service';
import { ParseDetailsPipe } from '../../../shared/pipes/parse-details.pipe';

// PrimeNG Standalone Components (v22+)
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';

// A select can't show a label for a null value, so "all workspaces" is the id 0 here
const ALL_WORKSPACES = 0;

@Component({
  selector: 'app-audit-log-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Button,
    Select,
    ParseDetailsPipe
  ],
  templateUrl: './audit-log-dashboard.component.html',
  styleUrls: ['./audit-log-dashboard.component.scss']
})
export class AuditLogDashboardComponent implements OnInit {
  readonly activityStore = inject(ActivityStoreService);
  private readonly workspaceStore = inject(WorkspaceStoreService);
  private readonly destroyRef = inject(DestroyRef);

  selectedActionType = 'ALL';
  selectedWorkspaceId = ALL_WORKSPACES;
  currentPage = 0;

  // The admin's workspace list contains every workspace, so it doubles as the id → name lookup
  workspaceOptions: { label: string; value: number }[] = [{ label: 'All workspaces', value: ALL_WORKSPACES }];
  workspaceNames: Record<number, string> = {};

  actionTypeOptions = [
    { label: 'All Compliance Actions', value: 'ALL' },
    { label: 'Card Moves', value: 'CARD_MOVED' },
    { label: 'Gate Requests', value: 'GATE_REQUESTED' },
    { label: 'Gate Approvals', value: 'GATE_APPROVED' },
    { label: 'Gate Rejections', value: 'GATE_REJECTED' },
    { label: 'Cards Created', value: 'TASK_CREATED' },
    { label: 'Cards Deleted', value: 'TASK_DELETED' },
    { label: 'Metadata Edits', value: 'METADATA_UPDATED' },
    { label: 'Card Assignments', value: 'TASK_ASSIGNED' },
    { label: 'Automatic Unassignments', value: 'TASK_AUTO_UNASSIGNED' },
    { label: 'Admin Bypasses', value: 'ADMIN_OVERRIDE' }
  ];

  ngOnInit(): void {
    this.workspaceStore.workspaces$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(workspaces => {
        this.workspaceOptions = [
          { label: 'All workspaces', value: ALL_WORKSPACES },
          ...workspaces.map(w => ({ label: w.name, value: w.id }))
        ];
        this.workspaceNames = Object.fromEntries(workspaces.map(w => [w.id, w.name]));
      });

    this.loadLogs();
  }

  loadLogs(): void {
    this.activityStore.loadGlobalAuditLogs({
      workspaceId: this.selectedWorkspaceId === ALL_WORKSPACES ? null : this.selectedWorkspaceId,
      actionType: this.selectedActionType === 'ALL' ? undefined : this.selectedActionType,
      page: this.currentPage,
      size: 50
    });
  }

  onFilterChange(): void {
    this.currentPage = 0;
    this.loadLogs();
  }

  goToPage(pageNum: number): void {
    this.currentPage = pageNum;
    this.loadLogs();
  }

  workspaceLabel(workspaceId: number): string {
    return this.workspaceNames[workspaceId] ?? `Workspace #${workspaceId}`;
  }
}
