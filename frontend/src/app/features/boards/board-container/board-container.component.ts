import { Component, OnInit, OnDestroy, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject, Subscription, combineLatest, debounceTime, distinctUntilChanged, map, BehaviorSubject, Observable } from 'rxjs';
import { MessageService } from 'primeng/api';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';

// Stores & Services
import { BoardStoreService } from '../../../core/store/board-store.service';
import { AuthStoreService } from '../../../core/store/auth-store.service';
import { WorkspaceStoreService } from '../../../core/store/workspace-store.service';
import { WorkflowStoreService } from '../../../core/store/workflow-store.service';
import { ActivityStoreService } from '../../../core/store/activity-store.service';

// Models
import { BoardDetailsDto } from '../../../core/models/board.dto';
import { ColumnDto, ColumnCreateRequest } from '../../../core/models/column.dto';
import { TaskDto, TaskCreateRequest, TaskMetadataRequest, TaskAssigneeRequest, TaskApproveRequest, TaskRejectRequest } from '../../../core/models/task.dto';
import { WorkflowTransitionUpdateRequest } from '../../../core/models/workflow.dto';
import { SimpleUserDto } from '../../../core/models/user.dto';
import { ParseDetailsPipe } from '../../../shared/pipes/parse-details.pipe';

// PrimeNG Standalone Components (v22+)
import { Dialog } from 'primeng/dialog';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { Select } from 'primeng/select';
import { Drawer } from 'primeng/drawer';
import { Checkbox } from 'primeng/checkbox';
import { Tooltip } from 'primeng/tooltip';

@Component({
  selector: 'app-board-container',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Dialog,
    Button,
    InputText,
    Textarea,
    Select,
    Drawer,
    Checkbox,
    Tooltip,
    ParseDetailsPipe,
    DragDropModule
  ],
  templateUrl: './board-container.component.html',
  styleUrls: ['./board-container.component.scss']
})
export class BoardContainerComponent implements OnInit, OnDestroy {
  readonly http = inject(HttpClient);
  readonly boardStore = inject(BoardStoreService);
  readonly authStore = inject(AuthStoreService);
  readonly workspaceStore = inject(WorkspaceStoreService);
  readonly workflowStore = inject(WorkflowStoreService);
  readonly activityStore = inject(ActivityStoreService);
  readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  activeBoardId: number | null = null;
  activeWorkspaceId: number | null = null;
  currentUserRole = 'ROLE_VIEWER';
  isAdmin = false;
  currentUserId: number | null = null;

  // Selected task assignee ID for PrimeNG dropdown binding
  selectedTaskAssigneeId: number | null = null;

  // Search & Filtering States (F12) represented as BehaviorSubjects for reactive filtering
  searchQuery = '';
  selectedPriorityFilter = 'ALL';
  selectedStatusFilter = 'ALL';

  private readonly searchSubject$ = new BehaviorSubject<string>('');
  private readonly priorityFilterSubject$ = new BehaviorSubject<string>('ALL');
  private readonly statusFilterSubject$ = new BehaviorSubject<string>('ALL');

  // We keep a non-filtered list of columns for drop-down lists or other local operations
  allColumns: ColumnDto[] = [];

  // 100% reactive, memory-leak-safe, performance-optimized filtered columns stream (F12)
  readonly filteredColumns$: Observable<ColumnDto[]> = combineLatest([
    this.boardStore.columns$,
    this.searchSubject$,
    this.priorityFilterSubject$,
    this.statusFilterSubject$
  ]).pipe(
    map(([cols, search, priority, status]) => {
      const query = search.trim().toLowerCase();
      return cols.map(col => {
        const matchedTasks = col.tasks.filter(t => {
          const matchesSearch = !query ||
            t.title.toLowerCase().includes(query) ||
            t.description?.toLowerCase().includes(query) ||
            t.tags?.some(tag => tag.toLowerCase().includes(query));

          const matchesPriority = priority === 'ALL' || t.priority === priority;
          const matchesStatus = status === 'ALL' || t.status === status;

          return matchesSearch && matchesPriority && matchesStatus;
        });

        return { ...col, tasks: matchedTasks };
      });
    })
  );

  // Dialog & Sidebar visibility states
  createTaskDialogVisible = false;
  taskDetailsDialogVisible = false;
  workflowDialogVisible = false;
  activitySidebarVisible = false;
  rejectDialogVisible = false;

  // New Task Payload
  newTask: Partial<TaskCreateRequest> = {
    title: '',
    description: '',
    priority: 'MEDIUM',
    position: 1000.0,
    tags: []
  };
  newTaskTagsString = '';
  selectedColumnIdForNewTask: number | null = null;

  // Selected Task Inspector Payload (F3)
  selectedTask: TaskDto | null = null;
  originalTask: TaskDto | null = null;
  selectedTaskTagsString = '';
  rejectionReasonPrompt = '';
  selectedRejectFallbackColumnId: number | null = null;

  // Workflow Governance Rules Matrix State (F2)
  transitionsList: WorkflowTransitionUpdateRequest[] = [];

  // Roster lists for dropdown selections
  workspaceMembers: SimpleUserDto[] = [];
  priorityOptions = [
    { label: 'Low', value: 'LOW' },
    { label: 'Medium', value: 'MEDIUM' },
    { label: 'High', value: 'HIGH' },
    { label: 'Urgent', value: 'URGENT' }
  ];

  ngOnInit(): void {
    this.currentUserId = this.authStore.getCurrentUserId();

    this.authStore.isAdmin$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(isAdmin => {
        this.isAdmin = isAdmin;
      });

    // Subscribe to workspace memberships to resolve current user's role (leak-safe)
    this.workspaceStore.activeWorkspace$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(ws => {
        if (ws) {
          this.currentUserRole = ws.currentUserRole || 'ROLE_VIEWER';
          this.activeWorkspaceId = ws.id;
        }
      });

    // Subscribes to the active workspace members list for assignee dropdowns (F4, leak-safe)
    this.workspaceStore.activeWorkspaceMembers$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(members => {
        this.workspaceMembers = members.map(m => ({
          id: m.userId,
          email: m.email,
          firstName: m.firstName,
          lastName: m.lastName
        }));
      });

    // Subscribe to columns to keep our un-filtered list updated for dropdown utilities
    this.boardStore.columns$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(cols => {
        this.allColumns = cols;
      });

    // Reactive Board State Synchronization
    this.boardStore.boardState$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(board => {
        if (board) {
          this.activeBoardId = board.id;
        } else {
          this.activeBoardId = null;
        }
      });
  }

  ngOnDestroy(): void {
    // Left empty since takeUntilDestroyed completely automates the cleanup lifecycle
  }

  // --- Angular CDK Drag-and-Drop Implementation (F5) ---

  onCdkDrop(event: CdkDragDrop<any[]>): void {
    const task = event.item.data;
    const sourceColumnId = Number(event.previousContainer.id);
    const targetColumnId = Number(event.container.id);
    const targetIndex = event.currentIndex;

    this.boardStore.moveTaskOptimistically(
      task.id,
      sourceColumnId,
      targetColumnId,
      targetIndex,
      task.version,
      false // standard non-admin bypass
    );
  }

  // --- Live Reactive Filter Trigger (No DB hit, extremely fast) ---
  onFilterChange(): void {
    this.searchSubject$.next(this.searchQuery);
    this.priorityFilterSubject$.next(this.selectedPriorityFilter);
    this.statusFilterSubject$.next(this.selectedStatusFilter);
  }

  // --- Task CRUD Management (F3, completely encapsulated in boardStore) ---

  openCreateTaskDialog(columnId: number): void {
    this.selectedColumnIdForNewTask = columnId;
    this.newTask = {
      title: '',
      description: '',
      priority: 'MEDIUM',
      position: 1000.0,
      tags: []
    };
    this.newTaskTagsString = '';
    this.createTaskDialogVisible = true;
  }

  createTask(): void {
    if (!this.newTask.title || !this.selectedColumnIdForNewTask) return;

    const tags = this.newTaskTagsString.split(',')
      .map(t => t.trim())
      .filter(t => t !== '');

    const request: TaskCreateRequest = {
      boardId: this.activeBoardId!,
      columnId: this.selectedColumnIdForNewTask,
      title: this.newTask.title,
      description: this.newTask.description,
      priority: this.newTask.priority,
      position: this.newTask.position || 1000.0,
      tags
    };

    this.boardStore.createTask(request, this.activeBoardId!)
      .subscribe({
        next: () => {
          this.createTaskDialogVisible = false;
          this.messageService.add({
            severity: 'success',
            summary: 'Task Created',
            detail: 'New Kanban card added successfully.'
          });
        },
        error: err => {
          this.messageService.add({
            severity: 'error',
            summary: 'Creation Failed',
            detail: err.error?.message || 'Could not create card.'
          });
        }
      });
  }

  openTaskDetails(task: TaskDto): void {
    this.selectedTask = { ...task };
    this.originalTask = { ...task };
    this.selectedTaskTagsString = task.tags ? task.tags.join(', ') : '';
    this.selectedTaskAssigneeId = task.assignee ? task.assignee.id : null;
    this.taskDetailsDialogVisible = true;
  }

  saveTaskChanges(): void {
    const task = this.selectedTask;
    const original = this.originalTask;
    if (!task || !original) return;

    const tags = this.selectedTaskTagsString.split(',')
      .map(t => t.trim())
      .filter(t => t !== '');

    // Check if metadata changed
    const metadataChanged = 
      task.title !== original.title ||
      task.description !== original.description ||
      task.priority !== original.priority ||
      JSON.stringify(tags) !== JSON.stringify(original.tags || []);

    // Check if assignee changed
    const originalAssigneeId = original.assignee ? original.assignee.id : null;
    const assigneeChanged = this.selectedTaskAssigneeId !== originalAssigneeId;

    if (!metadataChanged && !assigneeChanged) {
      this.taskDetailsDialogVisible = false;
      return;
    }

    if (metadataChanged && assigneeChanged) {
      // Sequential saving to prevent concurrent modification exceptions and maintain version order
      const metadataReq: TaskMetadataRequest = {
        title: task.title,
        description: task.description,
        priority: task.priority,
        dueDate: task.dueDate,
        tags,
        version: task.version
      };

      this.boardStore.updateTaskMetadata(task.id, metadataReq, this.activeBoardId!)
        .subscribe({
          next: updatedTask => {
            const assigneeReq: TaskAssigneeRequest = {
              assigneeId: this.selectedTaskAssigneeId || undefined,
              version: updatedTask.version
            };

            this.boardStore.updateTaskAssignee(task.id, assigneeReq, this.activeBoardId!)
              .subscribe({
                next: () => {
                  this.taskDetailsDialogVisible = false;
                  this.messageService.add({
                    severity: 'success',
                    summary: 'Task Saved',
                    detail: 'Task metadata and assignee updated successfully.'
                  });
                },
                error: err => {
                  this.messageService.add({
                    severity: 'error',
                    summary: 'Assignee Save Failed',
                    detail: err.error?.message || 'Could not update assignee.'
                  });
                }
              });
          },
          error: err => {
            this.messageService.add({
              severity: 'error',
              summary: 'Save Failed',
              detail: err.error?.message || 'Could not save task metadata.'
            });
          }
        });
    } else if (metadataChanged) {
      const metadataReq: TaskMetadataRequest = {
        title: task.title,
        description: task.description,
        priority: task.priority,
        dueDate: task.dueDate,
        tags,
        version: task.version
      };

      this.boardStore.updateTaskMetadata(task.id, metadataReq, this.activeBoardId!)
        .subscribe({
          next: () => {
            this.taskDetailsDialogVisible = false;
            this.messageService.add({
              severity: 'success',
              summary: 'Task Saved',
              detail: 'Task metadata updated successfully.'
            });
          },
          error: err => {
            this.messageService.add({
              severity: 'error',
              summary: 'Save Failed',
              detail: err.error?.message || 'Could not save task metadata.'
            });
          }
        });
    } else if (assigneeChanged) {
      const assigneeReq: TaskAssigneeRequest = {
        assigneeId: this.selectedTaskAssigneeId || undefined,
        version: task.version
      };

      this.boardStore.updateTaskAssignee(task.id, assigneeReq, this.activeBoardId!)
        .subscribe({
          next: () => {
            this.taskDetailsDialogVisible = false;
            this.messageService.add({
              severity: 'success',
              summary: 'Task Saved',
              detail: 'Task assignee updated successfully.'
            });
          },
          error: err => {
            this.messageService.add({
              severity: 'error',
              summary: 'Save Failed',
              detail: err.error?.message || 'Could not save task assignee.'
            });
          }
        });
    }
  }

  deleteTask(): void {
    if (!this.selectedTask) return;

    this.boardStore.deleteTask(this.selectedTask.id, this.activeBoardId!)
      .subscribe({
        next: () => {
          this.taskDetailsDialogVisible = false;
          this.messageService.add({
            severity: 'warn',
            summary: 'Card Deleted',
            detail: 'Kanban card successfully destroyed.'
          });
        },
        error: err => {
          this.messageService.add({
            severity: 'error',
            summary: 'Delete Rejected',
            detail: err.error?.message || 'Access Denied.'
          });
        }
      });
  }

  // --- Approval Gates Human-In-The-Loop Controls (F7) ---

  approveTask(): void {
    if (!this.selectedTask) return;

    const req: TaskApproveRequest = {
      version: this.selectedTask.version
    };

    this.boardStore.approveTask(this.selectedTask.id, req, this.activeBoardId!)
      .subscribe({
        next: updated => {
          this.selectedTask = updated;
          this.messageService.add({
            severity: 'success',
            summary: 'Gate Approved',
            detail: 'Task successfully unlocked and set to active.'
          });
        },
        error: err => {
          this.messageService.add({
            severity: 'error',
            summary: 'Approval Rejected',
            detail: err.error?.message || 'Gate action failed.'
          });
        }
      });
  }

  openRejectDialog(): void {
    this.rejectionReasonPrompt = '';
    this.selectedRejectFallbackColumnId = null;
    this.rejectDialogVisible = true;
  }

  getFallbackColumnOptions(): any[] {
    if (!this.selectedTask || !this.allColumns) return [];
    
    const currentColumnId = this.selectedTask.columnId;

    return this.allColumns
      .filter(col => col.id !== currentColumnId)
      .map(col => ({ label: col.name, value: col.id }));
  }

  rejectTask(): void {
    if (!this.selectedTask || !this.selectedRejectFallbackColumnId || !this.rejectionReasonPrompt) return;

    const req: TaskRejectRequest = {
      fallbackColumnId: this.selectedRejectFallbackColumnId,
      rejectionReason: this.rejectionReasonPrompt,
      version: this.selectedTask.version
    };

    this.boardStore.rejectTask(this.selectedTask.id, req, this.activeBoardId!)
      .subscribe({
        next: updated => {
          this.rejectDialogVisible = false;
          this.selectedTask = updated;
          this.messageService.add({
            severity: 'warn',
            summary: 'Gate Rejected',
            detail: `Task pushed back with fallback status.`
          });
        },
        error: err => {
          this.messageService.add({
            severity: 'error',
            summary: 'Rejection Failed',
            detail: err.error?.message || 'Invalid fallback transition.'
          });
        }
      });
  }

  // --- Dynamic State Machine Settings Matrix (F2) ---

  openWorkflowDialog(): void {
    this.transitionsList = [];
    this.http.get<WorkflowTransitionUpdateRequest[]>(`/api/boards/${this.activeBoardId}/transitions`)
      .subscribe(list => {
        this.transitionsList = list;
        this.workflowDialogVisible = true;
      });
  }

  getTransitionCheckboxValue(fromColId: number, toColId: number): boolean {
    return this.transitionsList.some(t => t.fromColumnId === fromColId && t.toColumnId === toColId);
  }

  toggleTransition(fromColId: number, toColId: number): void {
    const idx = this.transitionsList.findIndex(t => t.fromColumnId === fromColId && t.toColumnId === toColId);
    if (idx > -1) {
      this.transitionsList.splice(idx, 1);
    } else {
      this.transitionsList.push({
        fromColumnId: fromColId,
        toColumnId: toColId,
        requiresApproval: false
      });
    }
  }

  getTransitionApprovalValue(fromColId: number, toColId: number): boolean {
    return this.transitionsList.some(t => t.fromColumnId === fromColId && t.toColumnId === toColId && t.requiresApproval);
  }

  toggleTransitionApproval(fromColId: number, toColId: number): void {
    const t = this.transitionsList.find(x => x.fromColumnId === fromColId && x.toColumnId === toColId);
    if (t) {
      t.requiresApproval = !t.requiresApproval;
    }
  }

  getTransitionFallbackValue(fromColId: number, toColId: number): number | null {
    const t = this.transitionsList.find(x => x.fromColumnId === fromColId && x.toColumnId === toColId);
    return t ? t.fallbackColumnId || null : null;
  }

  setTransitionFallback(fromColId: number, toColId: number, fallbackColId: any): void {
    const t = this.transitionsList.find(x => x.fromColumnId === fromColId && x.toColumnId === toColId);
    if (t) {
      t.fallbackColumnId = fallbackColId ? Number(fallbackColId) : undefined;
    }
  }

  saveWorkflowTransitions(): void {
    this.workflowStore.updateTransitions(this.activeBoardId!, this.transitionsList);
    this.workflowDialogVisible = false;
  }

  // --- Contextual Activity Side panel (F9) ---

  openActivitySidebar(): void {
    this.activityStore.loadBoardActivity(this.activeBoardId!);
    this.activitySidebarVisible = true;
  }

  // --- Security Helpers ---

  get canEditAndConfigure(): boolean {
    return this.isAdmin || this.currentUserRole === 'ROLE_PROJECT_MANAGER';
  }

  get canAssignTask(): boolean {
    if (!this.selectedTask) return false;

    // Locked pending approval tasks can only be assigned by Managers/Admins
    if (this.selectedTask.status === 'PENDING_APPROVAL') {
      return this.isAdmin || this.currentUserRole === 'ROLE_PROJECT_MANAGER';
    }

    // Admins and PMs can always assign
    if (this.isAdmin || this.currentUserRole === 'ROLE_PROJECT_MANAGER') {
      return true;
    }

    // Unassigned tasks can be assigned by Developers and QA/Testers (they can self-assign)
    if (!this.selectedTask.assignee) {
      return this.currentUserRole === 'ROLE_DEVELOPER' || this.currentUserRole === 'ROLE_QA_TESTER';
    }

    // Already assigned: only the current assignee can change/reassign/unassign it
    return this.selectedTask.assignee.id === this.currentUserId;
  }

  get filteredWorkspaceMembers(): SimpleUserDto[] {
    if (this.isAdmin || this.currentUserRole === 'ROLE_PROJECT_MANAGER') {
      return this.workspaceMembers;
    }
    // Base roles (Developer / QA) can only assign to themselves (or unassign themselves)
    if (this.currentUserId) {
      return this.workspaceMembers.filter(m => m.id === this.currentUserId);
    }
    return [];
  }

  get isTaskLocked(): boolean {
    if (!this.selectedTask) return false;
    return this.selectedTask.status === 'PENDING_APPROVAL' && !this.canEditAndConfigure;
  }

  trackByColumnId(index: number, col: ColumnDto): number {
    return col.id;
  }

  trackByTaskId(index: number, task: TaskDto): number {
    return task.id;
  }
}
