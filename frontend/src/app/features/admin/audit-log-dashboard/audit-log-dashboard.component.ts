import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivityStoreService } from '../../../core/store/activity-store.service';
import { ParseDetailsPipe } from '../../../shared/pipes/parse-details.pipe';

// PrimeNG Standalone Components (v22+)
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';

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

  selectedActionType = 'ALL';
  currentPage = 0;

  actionTypeOptions = [
    { label: 'All Compliance Actions', value: 'ALL' },
    { label: 'Card Moves', value: 'CARD_MOVED' },
    { label: 'Gate Requests', value: 'GATE_REQUESTED' },
    { label: 'Gate Approvals', value: 'GATE_APPROVED' },
    { label: 'Gate Rejections', value: 'GATE_REJECTED' },
    { label: 'Metadata Edits', value: 'METADATA_UPDATED' },
    { label: 'Card Assignments', value: 'TASK_ASSIGNED' },
    { label: 'Admin Bypasses', value: 'ADMIN_OVERRIDE' }
  ];

  ngOnInit(): void {
    this.loadLogs();
  }

  loadLogs(): void {
    const action = this.selectedActionType === 'ALL' ? undefined : this.selectedActionType;
    this.activityStore.loadGlobalAuditLogs(action, this.currentPage, 50);
  }

  onActionTypeChange(): void {
    this.currentPage = 0;
    this.loadLogs();
  }

  goToPage(pageNum: number): void {
    this.currentPage = pageNum;
    this.loadLogs();
  }
}
