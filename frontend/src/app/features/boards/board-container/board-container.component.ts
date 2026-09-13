import { Component, OnInit, OnDestroy, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, combineLatest, debounceTime, distinctUntilChanged, map, BehaviorSubject, Observable } from 'rxjs';
import { ConfirmationService, MessageService } from 'primeng/api';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { findRouteParam } from '../../../core/utils/route-params';
import { lastVisited } from '../../../core/utils/last-visited';
import { ROLE_LABELS } from '../../../core/utils/role-labels';

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
import { WorkspaceMemberResponseDto } from '../../../core/models/workspace.dto';
import { SimpleUserDto } from '../../../core/models/user.dto';
import { ParseDetailsPipe } from '../../../shared/pipes/parse-details.pipe';
import { WorkflowRulesDialogComponent } from '../workflow-rules-dialog/workflow-rules-dialog.component';

// PrimeNG Standalone Components (v22+)
import { Dialog } from 'primeng/dialog';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { Select } from 'primeng/select';
import { Drawer } from 'primeng/drawer';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';

@Component({
  selector: 'app-board-container',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    Dialog,
    Button,
    InputText,
    Textarea,
    Select,
    Drawer,
    ConfirmDialog,
    Tag,
    Tooltip,
    ParseDetailsPipe,
    DragDropModule,
    WorkflowRulesDialogComponent
  ],
  // One confirmation host for deleting the board and taking people off it
  providers: [ConfirmationService],
  templateUrl: './board-container.component.html',
  styleUrls: ['./board-container.component.scss']
})
export class BoardContainerComponent implements OnInit, OnDestroy {
  readonly boardStore = inject(BoardStoreService);
  readonly authStore = inject(AuthStoreService);
  readonly workspaceStore = inject(WorkspaceStoreService);
  readonly workflowStore = inject(WorkflowStoreService);
  readonly activityStore = inject(ActivityStoreService);
  readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  activeBoardId: number | null = null;
  activeBoardTitle = '';
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

  // Who can open this board, for the Members dialog: its explicit members plus the workspace's PMs, PMs first
  readonly peopleOnBoard$: Observable<WorkspaceMemberResponseDto[]> = combineLatest([
    this.workspaceStore.activeWorkspaceMembers$,
    this.boardStore.boardState$
  ]).pipe(
    map(([members, board]) => !board ? [] : members
      .filter(m => m.allBoards || m.boards.some(b => b.id === board.id))
      .sort((a, b) => Number(b.allBoards) - Number(a.allBoards) || a.firstName.localeCompare(b.firstName)))
  );

  // Dialog & Sidebar visibility states
  createTaskDialogVisible = false;
  taskDetailsDialogVisible = false;
  workflowDialogVisible = false;
  activitySidebarVisible = false;
  rejectDialogVisible = false;
  boardMembersVisible = false;

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
  rejectFallbackOptions: { label: string; value: number }[] = [];

  // Assignee choices: people who can open this board (its members plus the workspace's PMs)
  assignableMembers: SimpleUserDto[] = [];
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

    // The board to show comes from the URL; the component is reused when only :boardId changes
    this.route.paramMap
      .pipe(
        map(params => Number(params.get('boardId'))),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(boardId => {
        this.boardStore.clear(); // show the loading state, never the previous board
        this.boardStore.loadBoard(boardId);
        this.workflowStore.loadTransitions(boardId);
        this.boardStore.loadBoardMembers(boardId);
        lastVisited.rememberBoard(this.currentWorkspaceId(), boardId);
      });

    // The server refused the board (e.g. access revoked while it was open): back to the workspace
    this.boardStore.accessLost$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const workspaceId = this.currentWorkspaceId();
        this.messageService.add({
          severity: 'warn',
          summary: 'Board unavailable',
          detail: 'You no longer have access to this board.',
          life: 4000
        });
        this.workspaceStore.loadBoards(workspaceId); // refresh the list, so it can't send us straight back
        this.router.navigate(['/w', workspaceId]);
      });

    // Assignee dropdown (F4, leak-safe)
    this.boardStore.boardMembers$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(members => {
        this.assignableMembers = members;
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
        this.activeBoardId = board?.id ?? null;
        this.activeBoardTitle = board?.title ?? '';
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

    // Same rule the server applies: a gated rule locks the card unless an admin or PM moves it
    const rule = this.workflowStore.transitionsList
      .find(t => t.fromColumnId === sourceColumnId && t.toColumnId === targetColumnId);
    const awaitsApproval = sourceColumnId !== targetColumnId && !!rule?.requiresApproval && !this.canEditAndConfigure;

    this.boardStore.moveTaskOptimistically(
      task.id,
      sourceColumnId,
      targetColumnId,
      targetIndex,
      task.version,
      awaitsApproval
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
    this.rejectFallbackOptions = this.fallbackOptionsFor(this.selectedTask);
    // Usually a gate has exactly one fallback, so there is nothing to choose
    this.selectedRejectFallbackColumnId =
      this.rejectFallbackOptions.length === 1 ? this.rejectFallbackOptions[0].value : null;
    this.rejectDialogVisible = true;
  }

  // The server only accepts a fallback configured on a gated rule into the card's current column
  private fallbackOptionsFor(task: TaskDto | null): { label: string; value: number }[] {
    if (!task) return [];

    const fallbackIds = new Set(this.workflowStore.transitionsList
      .filter(t => t.toColumnId === task.columnId && t.requiresApproval && t.fallbackColumnId != null)
      .map(t => t.fallbackColumnId));

    return this.allColumns
      .filter(col => fallbackIds.has(col.id))
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

  // --- Workflow rules (F2): WorkflowRulesDialogComponent reads, edits and saves them ---

  openWorkflowDialog(): void {
    this.workflowDialogVisible = true;
  }

  // --- Contextual Activity Side panel (F9) ---

  openActivitySidebar(): void {
    this.activityStore.loadBoardActivity(this.activeBoardId!);
    this.activitySidebarVisible = true;
  }

  // --- Board members and deleting the board (Admins and PMs) ---

  confirmRemoveFromBoard(member: WorkspaceMemberResponseDto): void {
    const boardId = this.activeBoardId;
    if (!boardId) return;

    this.confirmationService.confirm({
      header: 'Remove from board?',
      message: `${member.firstName} ${member.lastName} will lose access to ${this.activeBoardTitle}. ` +
        'Any of their tasks on it will be unassigned.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Remove from board',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text p-button-secondary',
      accept: () => this.workspaceStore.removeMemberFromBoard(boardId, member.userId).subscribe({
        next: () => {
          // Their cards here are now unassigned, and they leave the assignee list
          this.boardStore.loadBoard(boardId);
          this.boardStore.loadBoardMembers(boardId);
        },
        error: () => {} // the store already shows the reason
      })
    });
  }

  confirmDeleteBoard(): void {
    const boardId = this.activeBoardId;
    if (!boardId) return;
    const cardCount = this.allColumns.reduce((total, col) => total + col.tasks.length, 0);

    this.confirmationService.confirm({
      header: 'Delete this board?',
      message: `"${this.activeBoardTitle}" will be deleted for good, with its ${this.allColumns.length} columns, ` +
        `${cardCount} ${cardCount === 1 ? 'card' : 'cards'} and workflow rules. This can't be undone.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete board',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text p-button-secondary',
      accept: () => {
        const workspaceId = this.currentWorkspaceId();
        this.workspaceStore.deleteBoard(boardId).subscribe({
          // The workspace home opens another board, or explains that none are left
          next: () => this.router.navigate(['/w', workspaceId]),
          error: () => {} // the store already shows the reason
        });
      }
    });
  }

  roleLabel(role: string): string {
    return ROLE_LABELS[role] ?? role;
  }

  trackByUserId(index: number, member: WorkspaceMemberResponseDto): number {
    return member.userId;
  }

  // --- Security Helpers ---

  get canEditAndConfigure(): boolean {
    return this.isAdmin || this.currentUserRole === 'ROLE_PROJECT_MANAGER';
  }

  /** Admins and PMs add cards anywhere; developers and QA start them in the first column; viewers never. */
  canAddCardTo(columnId: number): boolean {
    if (this.canEditAndConfigure) return true;
    if (this.currentUserRole === 'ROLE_VIEWER') return false;
    return columnId === this.firstColumnId;
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

  get assigneeOptions(): SimpleUserDto[] {
    if (this.isAdmin || this.currentUserRole === 'ROLE_PROJECT_MANAGER') {
      return this.assignableMembers;
    }
    // Base roles (Developer / QA) can only assign to themselves (or unassign themselves)
    if (this.currentUserId) {
      return this.assignableMembers.filter(m => m.id === this.currentUserId);
    }
    return [];
  }

  // Columns arrive sorted by position; unassigned cards anywhere else are flagged "Needs assignee"
  get firstColumnId(): number | null {
    return this.allColumns.length > 0 ? this.allColumns[0].id : null;
  }

  private currentWorkspaceId(): number {
    return Number(findRouteParam(this.route.snapshot, 'workspaceId'));
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
