# Document 1: System Requirements & User Story Catalog

---

## 1. System Security & Actor Blueprint

The system governs all interactions using a hybrid model: static Workspace Role-Based Access Control (RBAC) combined with dynamic, task-level Attribute-Based Access Control (ABAC).

| Actor Category | Scope & Key Privileges | Security Evaluation Rule |
| --- | --- | --- |
| **ADMIN** | Full global workspace control, user role provisioning, entity deletion cascades, state machine bypass, and access to system-wide audit logs.

 | `hasRole('ROLE_ADMIN')`<br> |
| **PROJECT MANAGER** | Board-level administrative control, dynamic workflow rule configuration, and sole approver authority for gated columns.

 | `hasRole('ROLE_PROJECT_MANAGER')`<br> |
| **DEVELOPER** | Create tasks, edit unlocked tasks, and drag cards strictly through development stages (e.g., To-Do $\rightarrow$ In Progress $\rightarrow$ Code Review).

 | `hasRole('ROLE_DEVELOPER')`<br> |
| **QA / TESTER** | Interact with cards in "Ready for QA", edit test tags/metadata, and approve tasks to "Done" or reject them with feedback.

 | `hasRole('ROLE_QA_TESTER')`<br> |
| **VIEWER** | Strictly read-only access to workspaces, boards, card details, and contextual activity streams.

 | `hasRole('ROLE_VIEWER')`<br> |
| TASK ASSIGNEE<br>

<br>*(Dynamic Modifier)* | Grants full edit and delete privileges on an assigned card, **provided the card is not locked** in `PENDING_APPROVAL`.

 | `@taskSecurity.isAssigneeOrOwner(#taskId, principal)`<br> |

---

## 2. Authentication & Multi-Tenant Isolation

### F10: JWT Authentication & Workspace Session Selection

* **Functional Scope:** Provide stateless authentication using JSON Web Tokens (JWT) containing user identity and active tenant context, enabling access control and secure API communication.


* **Admin / PM / Developer / QA / Viewer:**
* **Story:** As an Authenticated User, I want to authenticate via my credentials and receive a signed JWT so that all subsequent API calls are authorized and scoped to my tenant workspace.


* **Sequence:**
1. User submits email and password credentials to `POST /api/auth/login`.


2. Spring Security `AuthenticationManager` authenticates credentials and returns a signed JWT containing user ID, username, and workspace authorizations.


3. Angular stores the token in local storage and an `HttpInterceptor` attaches `Authorization: Bearer <token>` to all subsequent requests.


4. Angular loads the workspace and board hierarchies accessible to the user.







### F15: Workspace Membership & Role Provisioning

* **Functional Scope:** Manage multi-tenant workspace memberships, map registered users to specific workspaces, and assign static baseline authorization roles (`ADMIN`, `PROJECT_MANAGER`, `DEVELOPER`, `QA_TESTER`, `VIEWER`).


* **Admin:**
* **Story:** As a Workspace Admin, I want to invite registered users to my workspace and assign baseline roles so that operational privileges are distributed strictly according to policy.


* **Sequence:**
1. Admin opens the Workspace Members management panel.


2. Admin enters a user ID/email and selects an assigned role.


3. Angular dispatches `POST /api/workspaces/{workspaceId}/members`.


4. Spring Boot verifies Admin authority via `@PreAuthorize("@workspaceSecurity.isAdmin(#workspaceId, principal)")`.


5. Persistence layer inserts a record into the `workspace_members` join table.


6. Member roster updates in the UI with assigned permission badges.






* **Non-Admin (PM, Developer, QA/Tester, Viewer):**
* **Story:** As a Non-Admin user, I want to view active workspace members in read-only mode so that I cannot alter team membership or escalate privileges.


* **Sequence:**
1. User navigates to the workspace directory.


2. Member roster renders in read-only format.


3. Member addition and role alteration controls are omitted from the DOM.


4. Direct API attempts to modify workspace roles return `HTTP 403 Forbidden`.







### F1: Workspace & Board Administration

* **Functional Scope:** Create, configure, update, and delete workspaces and project boards with relational cascade boundaries.


* **Admin:**
* **Story:** As an Admin, I want to create, configure, or delete workspaces and boards so that organizational teams have structured project spaces.


* **Sequence:**
1. Admin opens the Workspace/Board administration settings.


2. Admin submits board parameters or issues a deletion request with explicit cascade confirmation.


3. Spring Boot validates Admin authority via `@PreAuthorize("hasRole('ROLE_ADMIN')")`.


4. Persistence layer executes the schema modification and cascades child entity cleanup.


5. Angular updates active state and broadcasts navigation routes.






* **Project Manager:**
* **Story:** As a Project Manager, I want to view assigned boards and modify board metadata without deleting top-level workspaces so that board configuration matches project requirements.


* **Sequence:**
1. PM opens board configuration dialog.


2. Backend verifies PM assignment via workspace security evaluator.


3. PM updates board title or metadata; workspace deletion options are hidden/disabled.


4. Backend persists board configurations.






* **Developer / QA / Viewer:**
* **Story:** As a Base Role Collaborator or Viewer, I want to view permitted workspaces and boards so that I can access active tasks without altering project structure.


* **Sequence:**
1. User selects a board from the workspace navigation menu.


2. Spring Security verifies read access for the active session.


3. UI renders the board in collaboration mode with administrative controls omitted.







---

## 3. Board Layout & Workflow Configuration

### F11: Column Physical Lifecycle & Layout Management

* **Functional Scope:** Add, rename, reorder, and delete physical column containers on a board under explicit empty-column constraints.


* **Admin & Project Manager:**
* **Story:** As an Admin or PM, I want to create, rename, reorder, or delete columns so that the board layout mirrors team workflow stages.


* **Sequence:**
1. PM/Admin clicks "Add Column" or drags a column header to reorder.


2. UI calculates fractional order index and sends `POST /api/boards/{id}/columns` or `PATCH /api/columns/{id}/reorder`.


3. Spring Boot validates role authority and persists column position indices.


4. When deleting a column, the backend checks for active tasks and workflow transition dependencies; if referenced, it rejects with `HTTP 409 Conflict`.






* **Developer / QA / Viewer:**
* **Story:** As a Standard Collaborator or Viewer, I want column layouts to be immutable so that team stages remain structurally intact.


* **Sequence:**
1. User views board columns.


2. Column creation, modification, and deletion buttons are hidden.


3. Direct API requests to column lifecycle endpoints return `HTTP 403 Forbidden`.







### F2: Dynamic Workflow State Machine Rules

* **Functional Scope:** Configure allowed state transition paths between columns, designate approval gates, and define default fallback columns.


* **Admin & Project Manager:**
* **Story:** As an Admin or PM, I want to configure valid column transition rules and mark stages as approval gates so that team movement adheres to workflow governance.


* **Sequence:**
1. PM/Admin opens the Board Workflow Settings panel.


2. PM defines allowed transition paths (e.g., "To-Do" $\rightarrow$ "In Progress" $\rightarrow$ "Code Review"), flags gated stages (`requires_approval = true`), and sets default rejection fallback targets.


3. Spring Boot validates permissions and persists definitions to the `workflow_transitions` table.


4. Board state updates to enforce the transition matrix.






* **Developer / QA / Viewer:**
* **Story:** As a Standard Collaborator or Viewer, I want workflow rules to be strictly enforced on my actions so that tasks follow validated stage sequences.


* **Sequence:**
1. User interacts with board cards.


2. Workflow rule configuration panel is hidden.


3. Direct API attempts to alter workflow definitions return `HTTP 403 Forbidden`.







---

## 4. Task Management & Attribution

### F3: Task Lifecycle Management (CRUD)

* **Functional Scope:** Create, update, read, and delete task cards within columns with strict lock precedence enforcement.


* **Admin & Project Manager:**
* **Story:** As an Admin or PM, I want to create, edit, or delete any task across any column so that project backlog hygiene is maintained.


* **Sequence:**
1. User opens task modal or selects "Delete Task".


2. Operation submits to `POST/PATCH/DELETE /api/tasks/{id}`.


3. Spring Security validates role permissions.


4. Database executes the operation and updates board state.






* **Developer & QA / Tester:**
* **Story:** As a Developer or QA/Tester, I want to create new tasks and edit details on unlocked tasks so that implementation specifications remain accurate.


* **Sequence:**
1. User submits task creation form.


2. Spring Boot sets `created_by = currentUser` and persists the record.


3. For edits, backend checks that the task is not in `PENDING_APPROVAL` and updates fields.


4. Deletion requests from non-owners/non-admins return `HTTP 403 Forbidden`.






* **Task Assignee (Dynamic ABAC Modifier):**
* **Story:** As a Task Assignee, I want full edit and deletion privileges on my assigned card when unlocked so that I can maintain my task autonomously.


* **Sequence:**
1. Assignee opens the assigned card dialog.


2. Assignee edits metadata or triggers card deletion.


3. Backend verifies that the card is not locked in `PENDING_APPROVAL` (if locked, returns `HTTP 423 Locked`).


4. `@PreAuthorize("@taskSecurity.isAssigneeOrOwner(#taskId, principal)")` evaluates to true, granting execution privileges.


5. Persistence layer updates or removes the record.






* **Viewer:**
* **Story:** As a Viewer, I want to view task details in a read-only dialog so that I can inspect specifications without modifying data.


* **Sequence:**
1. Viewer selects a task card.


2. PrimeNG `p-dialog` renders all inputs as disabled/read-only.


3. Mutation buttons are omitted from the view.







### F16: Task Metadata & Tagging Management

* **Functional Scope:** Manage detailed task attributes including priority levels, due dates, and descriptive tags.


* **Developer & QA / Tester (Base Roles) + Task Assignee (Dynamic Context):**
* **Story:** As a Developer, QA/Tester, or Task Assignee, I want to set priority levels, pick due dates, and apply tags (e.g., "Bug", "Tech Debt") to an unlocked task so that cards are properly categorized.


* **Sequence:**
1. User opens task details dialog.


2. User sets priority (`LOW`, `MEDIUM`, `HIGH`, `URGENT`), selects date via `p-calendar`, or adds tags via `p-chips`.


3. Angular emits a debounced `PATCH /api/tasks/{id}/metadata` payload containing the entity version.


4. Backend verifies authorization via `@PreAuthorize("@taskSecurity.canEditCard(#id, principal)")` and confirms lock status.


5. Persistence layer updates metadata fields and publishes an audit event.


6. Board view updates card badges locally via RxJS.






* **Viewer:**
* **Story:** As a Viewer, I want to see priority indicators, tags, and due dates in read-only format.


* **Sequence:**
1. Viewer opens the task details dialog.


2. Priority tags and calendar inputs render in disabled states.







### F4: Task Assignment & Ownership Delegation

* **Functional Scope:** Assign and reassign task ownership across workspace members.


* **Admin & Project Manager:**
* **Story:** As an Admin or PM, I want to assign or reassign any task to any team member so that team workload is balanced.


* **Sequence:**
1. User opens assignee dropdown in task modal.


2. Full member list is loaded from workspace context.


3. User selects a target assignee and saves.


4. Backend updates `assignee_id` and records the assignment in audit logs.






* **Developer & QA / Tester:**
* **Story:** As a Developer or QA/Tester, I want to assign unassigned tasks to myself so that my active sprint commitments are visible.


* **Sequence:**
1. User clicks "Assign to Me" on an unassigned card.


2. Backend validates that the user is an active workspace collaborator.


3. Card `assignee_id` updates to the active user.






* **Task Assignee (Dynamic ABAC Modifier):**
* **Story:** As a Task Assignee, I want to reassign my unlocked card to a peer so that handoffs are clear.


* **Sequence:**
1. Assignee opens the assigned card modal.


2. Assignee selects a new assignee from the workspace directory.


3. Security evaluator verifies ownership, checks lock state, and updates `assignee_id`.


4. Dynamic ownership privileges transfer to the new assignee upon commit.






* **Viewer:**
* **Story:** As a Viewer, I want to see assigned avatars on cards without having permission to alter assignments.


* **Sequence:**
1. Viewer views board cards.


2. Assignee avatar renders in read-only mode with selection disabled.







### F12: Board Search, Filtering & View Modes

* **Functional Scope:** Filter and search board cards by assignee, priority, tag, or approval status using client-side reactive state streams.


* **All Roles (Admin, PM, Developer, QA / Tester, Viewer):**
* **Story:** As a Board Member, I want to filter cards by "My Tasks", Priority, Tags, or "Needs Approval" status so that I can isolate relevant work without server round-trips.


* **Sequence:**
1. User types in search bar or toggles filter chips.


2. Angular pipes the active task list through an RxJS filtering stream based on applied criteria.


3. Board renders matching cards instantly.


4. Drag-and-drop operations on filtered cards continue to calculate fractional indices accurately against visible sibling cards.







---

## 5. Movement, State Sync & Governance

### F5: Drag-and-Drop Task Movement & Optimistic State Sync

* **Functional Scope:** Move cards across columns via drag-and-drop, using frontend fractional indexing (Lexorank) and RxJS optimistic updates with server-side range validation and rollback.


* **Admin & Project Manager:**
* **Story:** As an Admin or PM, I want to drag cards across columns with instant UI sync, bypassing standard state constraints.


* **Sequence:**
1. User drags card from Column A to Column B.


2. UI calculates proposed `newPosition` and optimistically moves the card.


3. Angular sends `PATCH /api/tasks/{id}/move` containing `{ targetColumnId, newPosition, version, adminBypass }`.


4. Backend validates authority, bypasses standard transition rules, verifies index bounds, and commits update.


5. HTTP 200 returned; UI confirms state and updates local entity version.






* **Developer:**
* **Story:** As a Developer, I want to drag cards through standard stages (To-Do $\rightarrow$ In Progress $\rightarrow$ Code Review) with instant UI response, rolling back if rejected.


* **Sequence:**
1. Developer drags card to a valid subsequent column.


2. PrimeNG UI updates card position optimistically and creates a deep-cloned snapshot of board state.


3. Angular sends `PATCH /api/tasks/{id}/move` with proposed `newPosition` and `version`.


4. Backend State Machine validates transition and index bounds:
* **Valid Transition:** Updates `column_id` and `position` via single-row update; returns `HTTP 200` with incremented `version`.


* **Invalid Transition (e.g., To-Do $\rightarrow$ Done):** Backend returns `HTTP 400 Bad Request`. RxJS `catchError` catches response, shows PrimeNG Toast, and reverts card to snapshot position without a page reload.








* **QA / Tester:**
* **Story:** As a QA/Tester, I want to drag cards from "Ready for QA" to "Done" or kick them back to "In Progress" with a rejection note.


* **Sequence:**
1. QA drags card from "Ready for QA" back to "In Progress".


2. Rejection dialog prompts for feedback.


3. QA submits feedback; backend verifies QA role, updates column/position, and appends rejection note.


4. If QA attempts invalid moves between early dev stages, backend returns `HTTP 403 Forbidden` and UI rolls back.






* **Viewer:**
* **Story:** As a Viewer, I want drag handles to be disabled so that board positions cannot be altered.


* **Sequence:**
1. Viewer attempts to drag a card.


2. PrimeNG `pDraggable` evaluates `[pDraggableDisabled]="true"`.


3. Drag action is blocked at the DOM level; no HTTP request is dispatched.







### F6: Approval Gate Enforcement (`PENDING_APPROVAL`)

* **Functional Scope:** Automatically lock cards in a `PENDING_APPROVAL` state when moved into designated gated columns by non-manager roles.


* **Developer & QA / Tester:**
* **Story:** As a Developer or QA/Tester, I want moving a card into a gated column (e.g., "QA Complete" or "Production Ready") to lock it in `PENDING_APPROVAL` until approved.


* **Sequence:**
1. Developer or QA/Tester drags card to gated column.


2. UI places card in column and applies `PENDING_APPROVAL` status badge.


3. Backend verifies `workflow_transitions.requires_approval == true` and evaluates role permissions.


4. Card status updates to `PENDING_APPROVAL`, locking movement and ABAC edits.


5. Asynchronous audit event is dispatched.






* **Admin & Project Manager:**
* **Story:** As an Admin or PM, I want moving cards into gated columns to auto-approve and bypass the lock state.


* **Sequence:**
1. Admin/PM moves card to gated column.


2. Backend validates elevated authority, sets status to `APPROVED`/`ACTIVE`, and bypasses lock.







### F7: Approval Gate Decision (Approve / Reject)

* **Functional Scope:** Allow authorized roles to review cards locked in `PENDING_APPROVAL` and approve or reject them using deterministic fallback rules.


* **Project Manager & Admin:**
* **Story:** As a Project Manager or Admin, I want to review cards in `PENDING_APPROVAL` to either approve the transition or reject it with feedback.


* **Sequence:**
1. PM/Admin opens locked card dialog or gated review list.


2. **If Approved:** Dispatches `POST /api/tasks/{id}/approve` with `version`. Backend updates status to `ACTIVE`, unlocks card, increments version, and logs approval.


3. **If Rejected:** Dispatches `POST /api/tasks/{id}/reject` with reason payload, `fallbackColumnId`, and `version`. Backend moves card back to default fallback column (or PM-specified predecessor), clears lock, increments version, and logs rejection feedback.


4. Board updates state in real time.






* **Developer / QA / Tester / Viewer:**
* **Story:** As an Unauthorized Role, I want approval buttons hidden so that I cannot resolve approval gates.


* **Sequence:**
1. User opens a locked card dialog.


2. UI evaluates user role; "Approve" and "Reject" buttons are excluded from the DOM.


3. Direct API requests to approval endpoints return `HTTP 403 Forbidden`.







### F8: Admin State Machine Bypass

* **Functional Scope:** Allow Admins to override workflow rules and move tasks to any column to resolve operational blocks.


* **Admin:**
* **Story:** As an Admin, I want an explicit bypass option to force-move any card to any stage to resolve blocked states.


* **Sequence:**
1. Admin drags card across non-sequential stages or toggles "Admin Override".


2. Angular dispatches move payload with `adminBypass = true` and `version`.


3. Backend `@PreAuthorize("hasRole('ROLE_ADMIN')")` accepts payload and bypasses state machine validation.


4. Database updates record; audit log records `ADMIN_OVERRIDE_MOVE`.






* **All Other Roles:**
* **Story:** As a Non-Admin, I want system bypass mechanisms blocked so that workflow governance remains strict.


* **Sequence:**
1. User attempts an out-of-sequence move.


2. Backend validates transition against workflow matrix and returns `HTTP 400/403`.


3. Angular triggers optimistic rollback.







### F13: Locked Task Interaction Constraints

* **Functional Scope:** Enforce interaction and edit constraints on cards locked in `PENDING_APPROVAL`, overriding standard ABAC privileges.


* **Developer & QA / Tester (Base Roles) + Task Assignee (Dynamic Context):**
* **Story:** As a Developer, QA/Tester, or Assignee, I want cards locked in `PENDING_APPROVAL` to be disabled for movement and core edits so that unapproved changes cannot proceed down the pipeline.


* **Sequence:**
1. User views a card in `PENDING_APPROVAL` status.


2. Card drag handle is disabled (`pDraggableDisabled = true`).


3. Direct API edit attempts by assignees or developers return `HTTP 423 Locked`.


4. User can inspect details and submit contextual review notes.






* **Admin & Project Manager:**
* **Story:** As an Admin or PM, I want full edit capability on locked cards so that I can make adjustments prior to approving them.


* **Sequence:**
1. PM/Admin opens the locked card dialog.


2. Edit controls and decision action buttons remain active.


3. Submitted updates are applied by the backend.







### F14: Concurrent State Conflict & Optimistic Rollback

* **Functional Scope:** Prevent dirty writes and resolve concurrency conflicts during simultaneous card operations using JPA entity versioning.


* **All Active Roles (Admin, PM, Developer, QA / Tester):**
* **Story:** As a Collaborative User, I want the UI to alert me and reset the board state if another user updates a task before my changes sync.


* **Sequence:**
1. User A drags Task 10 to a new column.


2. Angular sends `PATCH /api/tasks/10/move` with current entity `version`.


3. Backend JPA detects `OptimisticLockException` because User B updated Task 10 concurrently.


4. Backend returns `HTTP 409 Conflict` with the latest persisted state.


5. Angular RxJS pipeline triggers a PrimeNG Toast notification ("Card was modified concurrently. Synchronizing...").


6. Local state updates to server truth without requiring a full page refresh.







---

## 6. Compliance & Observability

### F9: Decoupled Audit Logging & Activity Streams

* **Functional Scope:** Capture card lifecycle events via Spring AOP or JPA Entity Listeners and provide contextual board activity streams and system audit tables.


* **Admin:**
* **Story:** As an Admin, I want to review the full system audit log across all boards to maintain operational and security compliance.


* **Sequence:**
1. Admin navigates to the System Audit Log view.


2. Angular renders `p-table` populated from `GET /api/audit-logs`.


3. Table displays `actor_id`, `timestamp`, `source_column`, `target_column`, and `action_type`.


4. Spring AOP / JPA Listeners capture all state transitions asynchronously via `@TransactionalEventListener`.






* **Project Manager, Developer, QA / Tester & Viewer:**
* **Story:** As a Board Collaborator or Viewer, I want to view the contextual activity stream on a task/board to understand its history.


* **Sequence:**
1. User opens board sidebar or task activity tab.


2. Backend returns card-specific or board-specific movement events.


3. Stream displays chronological entries in read-only mode.


4. Global system audit log endpoints return `HTTP 403 Forbidden` for non-admin accounts.







---

