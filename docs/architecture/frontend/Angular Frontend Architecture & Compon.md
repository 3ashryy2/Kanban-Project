# Document 4: Frontend Angular Architecture & Component Specification

---

## 1. Client-Side Layering & State Flow

The Angular client utilizes a **Unidirectional Data Flow Architecture** powered by Angular Signals, RxJS Reactive State Stores, PrimeNG UI components, and an isolated domain math engine for fractional indexing.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        1. Presentation Layer                           │
│   (Smart Container Views ──► Dumb / Presentational Components)         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ User Actions / Directives / Inputs / Outputs
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      2. Reactive State Stores                          │
│   (BoardStoreService, AuthStoreService, WorkspaceStoreService)         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Optimistic Deep-Clones / Immutable Snapshots
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    3. Domain Logic & Calculations                      │
│        (LexorankService, Auth Route Guards, State Machine Map)         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP Request Dispatch with Version Tokens
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    4. Infrastructure & Network                         │
│     (TaskApiService, BoardApiService, JwtInterceptor, ToastService)    │
└────────────────────────────────────────────────────────────────────────┘

```

---

## 2. Complete Component Hierarchy Tree

```
AppComponent (Root Shell, Toast Host & Dynamic Dialog Container)
├── AuthLayoutComponent
│   └── LoginComponent (F10 - Authentication)
└── MainLayoutComponent (App Shell with Top Nav & Tenant Switcher)
    ├── SidebarNavComponent (Workspace Tree & Board Selector - F1, F10)
    ├── WorkspaceSettingsComponent (Member Provisioning & RBAC Matrix - F15)
    ├── AuditLogDashboardComponent (Admin-Only Global Audit Table - F9)
    └── BoardContainerComponent (Smart View Coordinator)
        ├── BoardHeaderComponent (Title, Quick Filter Chips, PM Config Trigger - F1, F12)
        ├── WorkflowSettingsModalComponent (State Machine Matrix Config - F2)
        ├── KanbanBoardComponent (Interactive Drag-and-Drop Canvas - F5)
        │   └── KanbanColumnComponent (Column Container & Drop Target - F5, F11)
        │       ├── ColumnHeaderComponent (WIP Limit, Title, Action Menu - F11)
        │       └── TaskCardComponent (Draggable Card Item - F3, F5, F6, F13)
        ├── TaskDetailsDialogComponent (Debounced Metadata Editor & CRUD - F3, F4, F16)
        │   ├── TaskApprovalControlsComponent (Approve / Reject Action Bar - F7)
        │   └── TaskRejectionModalComponent (Reason Prompt & Fallback Dropdown - F7)
        └── ActivityStreamSidebarComponent (Contextual Board Event Feed - F9)

```

---

## 3. Component Responsibilities & State Boundaries

### **1. Shell & Navigation Components**

#### **`MainLayoutComponent` (Smart Container)**

* **Role & Scope:** Serves as the primary application shell after authentication. Hosts the global header, workspace tenant switcher, user profile badge, and responsive sidebar container.


* **Injected Services:** `AuthStoreService`, `WorkspaceStoreService`.
* **State Management:** Subscribes to `WorkspaceStoreService.activeWorkspace$`, dispatching routing state changes upon tenant switching.



#### **`SidebarNavComponent` (Presentational / Navigational)**

* **Role & Scope:** Displays hierarchical workspaces and associated boards permitted for the active session (F1, F10).


* **Inputs:** `workspaces: WorkspaceSummaryDto[]`, `activeBoardId: number`.
* **Outputs:** `onSelectBoard: EventEmitter<number>`, `onCreateBoard: EventEmitter<void>`.

---

### **2. Board & Workflow Configuration Components**

#### **`BoardContainerComponent` (Smart View Coordinator)**

* **Role & Scope:** Central coordinator for active board data loading, modal dialog lifecycle, and global optimistic error recovery.


* **Injected Services:** `BoardStoreService`, `WorkflowStoreService`, `MessageService`.
* **Core Responsibilities:**
* Subscribes to route parameter `:boardId` to hydrate the board store.


* Manages visibility states for the workflow settings modal and task creation dialogs.


* Listens to store error states to coordinate PrimeNG Toast alerts and UI rollbacks (F5, F14).





#### **`BoardHeaderComponent` (Presentational)**

* **Role & Scope:** Renders the board title, interactive filter chips (e.g., "My Tasks", "Needs Approval", Priority tags - F12), and role-gated action buttons (F1, F2).


* **Inputs:** `boardTitle: string`, `currentUserRole: string`, `activeFilters: BoardFilterCriteria`.
* **Outputs:** `filterChange: EventEmitter<BoardFilterCriteria>`, `openWorkflowModal: EventEmitter<void>`.

#### **`WorkflowSettingsModalComponent` (Smart Dialog - PrimeNG `p-dialog`)**

* **Role & Scope:** Allows Project Managers and Admins to edit allowed transitions between columns, configure default rejection fallback targets, and toggle gated flags (`requires_approval = true`) (F2).


* **Injected Services:** `WorkflowStoreService`.
* **Security Access:** Guarded by `@if (currentUserRole === 'ROLE_ADMIN' || currentUserRole === 'ROLE_PROJECT_MANAGER')`.



---

### **3. Kanban Canvas & Drag-and-Drop Components**

#### **`KanbanBoardComponent` (Canvas Coordinator)**

* **Role & Scope:** Manages the horizontal multi-column canvas layout, coordinates drag payload tracking, and delegates Lexorank index calculations (F5).


* **Injected Services:** `LexorankService`, `BoardStoreService`.
* **Inputs:** `columns: ColumnWithTasksDto[]`.
* **Outputs:** `onCardDrop: EventEmitter<CardMoveEvent>`.

#### **`KanbanColumnComponent` (Presentational / Drop Boundary)**

* **Role & Scope:** Encapsulates PrimeNG `pDroppable="tasks"` drop boundaries, visual WIP limits, column edit menus (F11), and the vertical task card list (F5).


* **Inputs:** `column: ColumnDto`, `tasks: TaskDto[]`, `isGated: boolean`.


* **Outputs:** `onTaskMoved: EventEmitter<TaskDropPayload>`, `onEditColumn: EventEmitter<ColumnDto>`.

#### **`TaskCardComponent` (Presentational Card Item)**

* **Role & Scope:** Renders an individual task card with dynamic styling, priority indicators (F16), assignee avatar (F4), and approval lock indicators (F6).


* **Directive Behavior:** Binds PrimeNG `pDraggable="tasks"`. Evaluates `[pDraggableDisabled]` to prevent dragging if the user holds `ROLE_VIEWER` or if the task has `status === 'PENDING_APPROVAL'` for non-managers (F6, F13).


* **Inputs:** `task: TaskDto`, `userPermissions: TaskPermissionSet`.
* **Outputs:** `onCardClick: EventEmitter<number>`, `onDragStart: EventEmitter<TaskDragPayload>`.

---

### **4. Dialogs, Gating & Activity Stream Components**

#### **`TaskDetailsDialogComponent` (Smart Dialog - PrimeNG `p-dialog`)**

* **Role & Scope:** Comprehensive card inspector and editor (F3, F16). Handles title, rich description, priority tags, due dates via `p-calendar`, and assignee changes (F4).


* **Debounced Mutation Stream:** Captures user input into an internal `Subject<TaskMetadataUpdatePayload>`, piping through `debounceTime(300)` and `distinctUntilChanged()` before calling `BoardStoreService` to avoid HTTP flooding.


* **Dynamic Control Locking:** Automatically disables all mutation inputs if the active user is a `VIEWER` or if the card is in `PENDING_APPROVAL` (unless the user holds Admin/PM roles) (F13).



#### **`TaskApprovalControlsComponent` (Presentational Action Bar)**

* **Role & Scope:** Displayed inside the task dialog exclusively when `task.status === 'PENDING_APPROVAL'`.


* **Security Access:** Rendered only for `ADMIN`, `PROJECT_MANAGER`, or `QA_TESTER` (for QA stages) (F7).


* **Outputs:** `onApprove: EventEmitter<void>`, `onRequestReject: EventEmitter<void>`.

#### **`TaskRejectionModalComponent` (Presentational Dialog)**

* **Role & Scope:** Rejection prompt modal requiring the reviewer to input a rejection reason and pick a valid backward fallback column from the transition matrix (F7).


* **Inputs:** `fallbackColumns: ColumnSummaryDto[]`.
* **Outputs:** `onConfirmRejection: EventEmitter<RejectionPayload>`.

#### **`ActivityStreamSidebarComponent` (Presentational Sidebar - PrimeNG `p-sidebar`)**

* **Role & Scope:** Renders chronological card movement and gate approval history for the active board (F9). Read-only for all roles including Viewers.


* **Inputs:** `events: BoardActivityEventDto[]`.

#### **`AuditLogDashboardComponent` (Smart View Container - PrimeNG `p-table`)**

* **Role & Scope:** Global administration page displaying paginated, searchable system audit logs across all tenant workspaces (F9).


* **Security Access:** Restricted by Angular route guard to `ROLE_ADMIN`.



---

## 4. Domain Engine: `LexorankService`

Isolated injectable service dedicated to fractional index calculation without UI coupling:

```typescript
@Injectable({ providedIn: 'root' })
export class LexorankService {
  private readonly DEFAULT_STEP = 1000.0;

  calculateNewPosition(targetColumnCards: TaskDto[], targetIndex: number): number {
    const count = targetColumnCards.length;

    // 1. Column is empty or dropped at the top
    if (count === 0) {
      return this.DEFAULT_STEP;
    }
    if (targetIndex === 0) {
      return targetColumnCards[0].position / 2.0;
    }

    // 2. Dropped at the bottom
    if (targetIndex >= count) {
      return targetColumnCards[count - 1].position + this.DEFAULT_STEP;
    }

    // 3. Dropped between two cards
    const prevPos = targetColumnCards[targetIndex - 1].position;
    const nextPos = targetColumnCards[targetIndex].position;
    return (prevPos + nextPos) / 2.0;
  }
}

```

---

## 5. Reactive State Store: `BoardStoreService`

Manages client state, immutable snapshot rollback caches via `structuredClone()`, and version token synchronization:

```typescript
@Injectable({ providedIn: 'root' })
export class BoardStoreService {
  private readonly http = inject(HttpClient);
  private readonly messageService = inject(MessageService);
  private readonly lexorankService = inject(LexorankService);

  private readonly _boardState$ = new BehaviorSubject<BoardDetailsDto | null>(null);
  readonly boardState$ = this._boardState$.asObservable();

  readonly columns$ = this.boardState$.pipe(
    map(board => board?.columns ?? [])
  );

  loadBoard(boardId: number): void {
    this.http.get<BoardDetailsDto>(`/api/boards/${boardId}`)
      .subscribe(board => this._boardState$.next(board));
  }

  moveTaskOptimistically(
    taskId: number,
    sourceColumnId: number,
    targetColumnId: number,
    targetIndex: number,
    currentVersion: number,
    adminBypass = false
  ): void {
    const currentState = this._boardState$.getValue();
    if (!currentState) return;

    // 1. Deep-clone snapshot cache for rollback safety
    const snapshotState: BoardDetailsDto = structuredClone(currentState);

    // 2. Calculate new Lexorank fractional position
    const targetColumn = currentState.columns.find(c => c.id === targetColumnId);
    if (!targetColumn) return;

    const newPosition = this.lexorankService.calculateNewPosition(targetColumn.tasks, targetIndex);
    const originalTask = this.findTaskInBoard(currentState, taskId);
    if (!originalTask) return;

    // 3. Optimistic local state update
    const updatedColumns = currentState.columns.map(col => {
      if (col.id === sourceColumnId) {
        return { ...col, tasks: col.tasks.filter(t => t.id !== taskId) };
      }
      return col;
    });

    const movedTask: TaskDto = {
      ...originalTask,
      columnId: targetColumnId,
      position: newPosition,
      status: targetColumn.isGated && !adminBypass ? 'PENDING_APPROVAL' : 'ACTIVE'
    };

    const finalColumns = updatedColumns.map(col => {
      if (col.id === targetColumnId) {
        const newTasks = [...col.tasks];
        newTasks.splice(targetIndex, 0, movedTask);
        return { ...col, tasks: newTasks };
      }
      return col;
    });

    this._boardState$.next({ ...currentState, columns: finalColumns });

    // 4. Dispatch HTTP payload with version token
    const payload: TaskMoveRequest = {
      targetColumnId,
      newPosition,
      adminBypass,
      version: currentVersion
    };

    this.http.patch<TaskDto>(`/api/tasks/${taskId}/move`, payload)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          // 5. Automatic rollback on server rejection or 409 Conflict
          this._boardState$.next(snapshotState);

          const errorMessage = error.status === 409
            ? 'Task was modified concurrently by another user. Board state synchronized.'
            : error.error?.message || 'Invalid workflow transition.';

          this.messageService.add({
            severity: 'error',
            summary: 'Move Rejected',
            detail: errorMessage,
            life: 4000
          });

          return EMPTY;
        })
      )
      .subscribe(persistedTask => {
        // 6. Version Token Sync Rule: Merge server version into active state
        this.syncTaskVersionInStore(persistedTask);
      });
  }

  private syncTaskVersionInStore(updatedTask: TaskDto): void {
    const currentState = this._boardState$.getValue();
    if (!currentState) return;

    const columns = currentState.columns.map(col => ({
      ...col,
      tasks: col.tasks.map(t => t.id === updatedTask.id ? { ...t, version: updatedTask.version, status: updatedTask.status } : t)
    }));

    this._boardState$.next({ ...currentState, columns });
  }

  private findTaskInBoard(board: BoardDetailsDto, taskId: number): TaskDto | undefined {
    for (const col of board.columns) {
      const task = col.tasks.find(t => t.id === taskId);
      if (task) return task;
    }
    return undefined;
  }
}

```

---

## 6. Store Services Summary

| Store Service | Core Domain Responsibilities |
| --- | --- |
| **`AuthStoreService`** | Manages JWT token storage, user profile hydration, workspace permissions, and session invalidation (F10).

 |
| **`BoardStoreService`** | Coordinates board aggregate state, structuredClone rollback cache, Lexorank delegation, and **version token synchronization** (F5, F14).

 |
| **`WorkspaceStoreService`** | Holds active tenant context, workspace roster, and member role assignments (F1, F15).

 |
| **`WorkflowStoreService`** | Holds allowed state transitions, fallback targets, and gated status per board (F2).

 |
| **`ActivityStoreService`** | Handles board-level activity feeds and admin system audit log pagination (F9).

 |