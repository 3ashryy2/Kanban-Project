# Document 5: Backend File-by-File Blueprint & Architectural Dependencies

---

## 1. Backend Package Tree Overview

```
com.valeo.kanban
├── config
│   ├── SecurityConfig.java
│   ├── AsyncConfig.java
│   └── OpenApiConfig.java
├── security
│   ├── JwtAuthenticationFilter.java
│   ├── JwtTokenProvider.java
│   ├── CustomUserDetails.java
│   ├── CustomUserDetailsService.java
│   └── evaluator
│       ├── TaskSecurityEvaluator.java
│       ├── WorkspaceSecurityEvaluator.java
│       └── BoardSecurityEvaluator.java
├── controller
│   ├── AuthController.java
│   ├── WorkspaceController.java
│   ├── BoardController.java
│   ├── ColumnController.java
│   ├── WorkflowController.java
│   ├── TaskController.java
│   └── AuditLogController.java
├── service
│   ├── AuthService.java
│   ├── WorkspaceService.java
│   ├── BoardService.java
│   ├── ColumnService.java
│   ├── TaskService.java
│   └── workflow
│       ├── TaskWorkflowService.java
│       └── ApprovalGateService.java
├── event
│   ├── model
│   │   ├── CardMovedEvent.java
│   │   ├── GateApprovedEvent.java
│   │   └── GateRejectedEvent.java
│   └── listener
│       └── AuditLogEventListener.java
├── repository
│   ├── UserRepository.java
│   ├── WorkspaceRepository.java
│   ├── WorkspaceMemberRepository.java
│   ├── BoardRepository.java
│   ├── ColumnRepository.java
│   ├── TaskRepository.java
│   ├── WorkflowTransitionRepository.java
│   └── AuditLogRepository.java
├── model
│   ├── entity
│   │   ├── User.java
│   │   ├── Workspace.java
│   │   ├── WorkspaceMember.java
│   │   ├── Board.java
│   │   ├── Column.java
│   │   ├── Task.java
│   │   ├── WorkflowTransition.java
│   │   └── AuditLog.java
│   └── enums
│       ├── WorkspaceRole.java
│       ├── TaskStatus.java
│       ├── TaskPriority.java
│       └── AuditActionType.java
├── dto
│   ├── request
│   │   ├── LoginRequest.java
│   │   ├── TaskCreateRequest.java
│   │   ├── TaskMoveRequest.java
│   │   ├── TaskMetadataRequest.java
│   │   ├── TaskAssigneeRequest.java
│   │   ├── TaskApproveRequest.java
│   │   ├── TaskRejectRequest.java
│   │   ├── ColumnCreateRequest.java
│   │   ├── ColumnReorderRequest.java
│   │   └── WorkflowTransitionUpdateRequest.java
│   └── response
│       ├── AuthResponse.java
│       ├── BoardDetailsDto.java
│       ├── ColumnDto.java
│       ├── TaskDto.java
│       ├── AuditLogResponseDto.java
│       └── ApiErrorResponse.java
└── exception
    ├── GlobalExceptionHandler.java
    ├── custom
        ├── ConflictException.java
        ├── TaskLockedException.java
        └── InvalidStateTransitionException.java

```

---

## 2. Configuration Package (`com.valeo.kanban.config`)

### **`SecurityConfig.java`**

* **Responsibility:** Configures Spring Security filter chains, sets stateless session management (`SessionCreationPolicy.STATELESS`), defines CORS rules, disables CSRF for REST APIs, and binds `JwtAuthenticationFilter` before `UsernamePasswordAuthenticationFilter`. Enables declarative SpEL method security via `@EnableMethodSecurity`.


* **Collaborators & Relations:**
* Injects `JwtAuthenticationFilter`.
* Exposes `AuthenticationManager` and `PasswordEncoder` (BCrypt) beans for `AuthService`.



### **`AsyncConfig.java`**

* **Responsibility:** Configures a dedicated `ThreadPoolTaskExecutor` (named `"auditExecutor"`) with customized core pool, max pool, and queue capacities to execute non-blocking audit logging tasks without interfering with HTTP request threads.


* **Collaborators & Relations:**
* Consumed by `@Async("auditExecutor")` inside `AuditLogEventListener`.





### **`OpenApiConfig.java`**

* **Responsibility:** Configures Swagger/OpenAPI documentation metadata, specifying Bearer JWT authentication schemes for API exploration.

---

## 3. Security Package (`com.valeo.kanban.security`)

### **`JwtTokenProvider.java`**

* **Responsibility:** Generates, signs, and parses HMAC-SHA256 JWT tokens. Extracts user ID, email, and tenant roles from token claims, and checks token expiration.
* **Collaborators & Relations:**
* Used by `AuthService` to generate tokens upon login.


* Used by `JwtAuthenticationFilter` to validate requests.





### **`JwtAuthenticationFilter.java`**

* **Responsibility:** Intercepts incoming requests (`OncePerRequestFilter`), extracts the `Authorization: Bearer <token>` header, parses claims via `JwtTokenProvider`, and sets the authenticated `CustomUserDetails` in the `SecurityContextHolder`.


* **Collaborators & Relations:**
* Collaborates with `JwtTokenProvider` and `CustomUserDetailsService`.


* Injected into `SecurityConfig`.





### **`CustomUserDetails.java`**

* **Responsibility:** Implements Spring Security's `UserDetails`. Encapsulates `userId`, `email`, password hash, and active tenant roles (`GrantedAuthority`).


* **Collaborators & Relations:**
* Created by `CustomUserDetailsService`.


* Injected as `principal` in controllers, services, and security evaluators.





### **`CustomUserDetailsService.java`**

* **Responsibility:** Implements `UserDetailsService`. Loads a user by email from `UserRepository` and hydrates `CustomUserDetails`.
* **Collaborators & Relations:**
* Injects `UserRepository`.


* Consumed by `AuthenticationManager` and `JwtAuthenticationFilter`.



---

## 4. Security Evaluators Package (`com.valeo.kanban.security.evaluator`)

### **`TaskSecurityEvaluator.java` (`@taskSecurity`)**

* **Responsibility:** Custom Spring Bean providing declarative method-level ABAC checks in `@PreAuthorize` expressions for task operations:


* `canEditCard(taskId, user)`: Checks if card is in `PENDING_APPROVAL` (only Admin/PM can edit; dynamic Assignee bypass is suspended). If unlocked, permits Admin, PM, Task Assignee, Creator, Developer, or QA/Tester.


* `canMoveCard(taskId, user)`: If locked, permits only Admin/PM. If unlocked, permits standard moving roles.


* `canDeleteCard(taskId, user)`: Restricts deletion to Creator, Task Assignee (when unlocked), Admin, or PM.


* `canAssignCard(taskId, user)`: Restricts reassignment to Admin, PM, or the current Task Assignee.




* **Collaborators & Relations:**
* Injects `TaskRepository` to read card metadata, ownership, and approval status.


* Referenced in SpEL annotations on `TaskController` endpoints.



### **`WorkspaceSecurityEvaluator.java` (`@workspaceSecurity`)**

* **Responsibility:** Custom Spring Bean validating workspace tenant boundaries:


* `isAdmin(workspaceId, user)`: Checks if the user holds `ROLE_ADMIN` in the workspace.


* `hasAccess(workspaceId, user)`: Verifies workspace membership.




* **Collaborators & Relations:**
* Injects `WorkspaceMemberRepository`.


* Referenced in SpEL annotations on `WorkspaceController`.



### **`BoardSecurityEvaluator.java` (`@boardSecurity`)**

* **Responsibility:** Custom Spring Bean verifying access to boards and tasks:
* `canReadBoard(boardId, user)`: Verifies board access via workspace membership.
* `canReadTask(taskId, user)`: Verifies task access through parent board/workspace.


* **Collaborators & Relations:**
* Injects `BoardRepository` and `TaskRepository`.


* Referenced in SpEL annotations across `BoardController` and `TaskController`.



---

## 5. Model Package (`com.valeo.kanban.model`)

### **Entities (`model.entity`)**

* **`User.java`:** JPA entity representing global identities (`id`, `email`, `password_hash`, `first_name`, `last_name`, timestamps).


* **`Workspace.java`:** JPA entity for tenant containers (`id`, `name`, `slug`, `description`, `created_by_id`, timestamps).


* **`WorkspaceMember.java`:** JPA join entity mapping users to workspaces with a `WorkspaceRole` enum (`ROLE_ADMIN`, `ROLE_PROJECT_MANAGER`, `ROLE_DEVELOPER`, `ROLE_QA_TESTER`, `ROLE_VIEWER`).


* **`Board.java`:** JPA entity for project boards (`id`, `workspace_id`, `title`, `description`, `created_by_id`, timestamps).


* **`Column.java`:** JPA entity for workflow columns (`id`, `board_id`, `name`, `position`, `is_gated`, `wip_limit`, timestamps).


* **`Task.java`:** JPA Aggregate Root (`id`, `board_id`, `column_id`, `title`, `description`, `priority`, `status`, `position`, `assignee_id`, `created_by_id`, `due_date`, `tags`, `rejection_reason`, `@Version Long version`, timestamps).


* **`WorkflowTransition.java`:** JPA entity defining permitted paths (`id`, `board_id`, `from_column_id`, `to_column_id`, `fallback_column_id`, `requires_approval`).


* **`AuditLog.java`:** JPA entity for decoupled audit records (`id`, `workspace_id`, `board_id`, `task_id`, `actor_id`, `action_type`, `source_column_id`, `target_column_id`, `details`, `timestamp`).



### **Enums (`model.enums`)**

* **`WorkspaceRole.java`:** `ROLE_ADMIN`, `ROLE_PROJECT_MANAGER`, `ROLE_DEVELOPER`, `ROLE_QA_TESTER`, `ROLE_VIEWER`.


* **`TaskStatus.java`:** `ACTIVE`, `PENDING_APPROVAL`.


* **`TaskPriority.java`:** `LOW`, `MEDIUM`, `HIGH`, `URGENT`.


* **`AuditActionType.java`:** `CARD_MOVED`, `GATE_REQUESTED`, `GATE_APPROVED`, `GATE_REJECTED`, `METADATA_UPDATED`, `TASK_ASSIGNED`, `ADMIN_OVERRIDE`.



---

## 6. Repository Package (`com.valeo.kanban.repository`)

### **`TaskRepository.java`**

* **Responsibility:** Spring Data JPA interface for tasks. Contains optimized queries:
* `findByIdWithHierarchy(taskId)`: Uses `JOIN FETCH t.board b JOIN FETCH b.workspace w JOIN FETCH t.column c` to load parent single-valued associations for safe asynchronous event publication.


* `findAllByBoardIdOrderByPositionAsc(boardId)`: Fetches tasks for a board in one query to assemble board aggregates safely.


* `countByColumnId(columnId)`: Fast application-level check used by `ColumnService` before deletion.




* **Collaborators & Relations:** Consumed by `TaskService`, `TaskWorkflowService`, `ApprovalGateService`, `BoardService`, `ColumnService`, and security evaluators.



### **`BoardRepository.java`**

* **Responsibility:** Spring Data JPA interface for boards:
* `findBoardWithColumnsById(boardId)`: Uses `JOIN FETCH b.columns c WHERE b.id = :boardId ORDER BY c.position ASC` (Query 1 of the Two-Query pattern).




* **Collaborators & Relations:** Consumed by `BoardService` and `BoardSecurityEvaluator`.



### **`WorkflowTransitionRepository.java`**

* **Responsibility:** Spring Data JPA interface for workflow rules:
* `findByBoardIdAndFromColumnIdAndToColumnId(...)`: Evaluates path validity and the `requires_approval` gating invariant.


* `existsByFromColumnIdOrToColumnIdOrFallbackColumnId(columnId)`: Guard query used by `ColumnService` to prevent deleting columns referenced in transition or fallback paths.




* **Collaborators & Relations:** Consumed by `TaskWorkflowService`, `ColumnService`, and `WorkflowController`.



### **`ColumnRepository.java`**

* **Responsibility:** Manages physical column entities (`findById`, `delete`, `findByBoardIdOrderByPositionAsc`).


* **Collaborators & Relations:** Consumed by `ColumnService` and `BoardService`.



### **`WorkspaceRepository.java` & `WorkspaceMemberRepository.java**`

* **Responsibility:** Manages workspace tenant entities and user role join mappings.


* **Collaborators & Relations:** Consumed by `WorkspaceService` and `WorkspaceSecurityEvaluator`.



### **`UserRepository.java` & `AuditLogRepository.java**`

* **Responsibility:** Manages user credentials and paginated audit log queries (`findByBoardIdOrderByTimestampDesc`, `findAllByOrderByTimestampDesc`).


* **Collaborators & Relations:** Consumed by `AuthService`, `AuditLogEventListener`, and `AuditLogController`.



---

## 7. Service Layer (`com.valeo.kanban.service`)

### **`TaskWorkflowService.java` (`service.workflow`)**

* **Responsibility:** Central state machine engine for card movement:
* Validates `@Version` token against payload.


* Enforces the Approval Lock invariant: blocks moves if `status == PENDING_APPROVAL` unless caller is Admin/PM.


* Evaluates transition matrix in `WorkflowTransitionRepository` using `requires_approval` as the single source of truth.


* If gated and user is not an approver, transitions status to `PENDING_APPROVAL`.


* Updates `column_id` and Lexorank `position` in a single-row write.


* Publishes `CardMovedEvent` via Spring `ApplicationEventPublisher`.




* **Collaborators & Relations:**
* Injects `TaskRepository`, `WorkflowTransitionRepository`, and `ApplicationEventPublisher`.


* Consumed by `TaskController`.



### **`ApprovalGateService.java` (`service.workflow`)**

* **Responsibility:** Manages gate reviews:
* `approveTask(taskId, request, user)`: Validates version, sets `status = ACTIVE`, clears rejection reason, increments version, and emits `GateApprovedEvent`.


* `rejectTask(taskId, request, user)`: Validates version, moves card to `fallbackColumnId`, sets `status = ACTIVE`, records rejection notes, increments version, and emits `GateRejectedEvent`.




* **Collaborators & Relations:**
* Injects `TaskRepository` and `ApplicationEventPublisher`.


* Consumed by `TaskController`.



### **`ColumnService.java`**

* **Responsibility:** Handles column physical lifecycle:
* `createColumn(...)` and `reorderColumns(...)`.
* `deleteColumn(columnId)`: Enforces integrity guards:
1. Rejects with `HTTP 409 Conflict` if `taskRepository.countByColumnId(columnId) > 0`.


2. Rejects with `HTTP 409 Conflict` if `transitionRepository.existsByFromColumnIdOrToColumnIdOrFallbackColumnId(columnId)` returns true.






* **Collaborators & Relations:**
* Injects `ColumnRepository`, `TaskRepository`, and `WorkflowTransitionRepository`.


* Consumed by `ColumnController` and `BoardController`.



### **`BoardService.java`**

* **Responsibility:** Implements the Two-Query strategy to load `BoardDetailsDto` safely:
1. Calls `boardRepository.findBoardWithColumnsById(boardId)`.


2. Calls `taskRepository.findAllByBoardIdOrderByPositionAsc(boardId)`.


3. Maps results into a hierarchical DTO in memory without Cartesian products.




* **Collaborators & Relations:**
* Injects `BoardRepository` and `TaskRepository`.


* Consumed by `BoardController`.



### **`TaskService.java`**

* **Responsibility:** Standard Task CRUD, debounced metadata updates, and assignee changes:
* Checks optimistic `@Version` on all mutation methods.
* Emits `METADATA_UPDATED` or `TASK_ASSIGNED` domain events.


* **Collaborators & Relations:**
* Injects `TaskRepository` and `ApplicationEventPublisher`.


* Consumed by `TaskController`.



### **`WorkspaceService.java` & `AuthService.java**`

* **Responsibility:** Workspace creation, cascade deletions, member role provisioning, credential verification, and JWT generation.


* **Collaborators & Relations:** Consumed by `WorkspaceController` and `AuthController`.



---

## 8. Event & Asynchronous Audit Layer (`com.valeo.kanban.event`)

### **Event Models (`event.model`)**

* **`CardMovedEvent.java`:** Carries `workspaceId`, `boardId`, `taskId`, `actorId`, `sourceColumnId`, `targetColumnId`, `status`, and `timestamp`.


* **`GateApprovedEvent.java`:** Carries task ID, actor ID, column ID, and timestamp.


* **`GateRejectedEvent.java`:** Carries task ID, actor ID, fallback column ID, rejection reason, and timestamp.



### **`AuditLogEventListener.java` (`event.listener`)**

* **Responsibility:** Decoupled audit consumer:
* Uses `@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)` to ensure audit records are created only when the primary business transaction commits.


* Uses `@Async("auditExecutor")` to execute writes asynchronously on a dedicated thread pool.


* Persists records directly into `AuditLogRepository` using unconstrained IDs (`workspace_id`, `board_id`, `task_id`) to prevent table lock contention.




* **Collaborators & Relations:**
* Injects `AuditLogRepository`.


* Consumes events dispatched by `TaskWorkflowService`, `ApprovalGateService`, and `TaskService`.



---

## 9. Controller Layer (`com.valeo.kanban.controller`)

| Controller File | Base Path | Endpoints & Operations | Method Security (`@PreAuthorize`) |
| --- | --- | --- | --- |
| **`AuthController.java`** | `/api/auth` | `POST /login` | `permitAll()` |
| **`WorkspaceController.java`** | `/api/workspaces` | `GET /`, `POST /`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}`, `GET/POST/DELETE /{id}/members`, `POST /{id}/boards` | `@workspaceSecurity.hasAccess(...)`, `@workspaceSecurity.isAdmin(...)`, `hasRole('ROLE_ADMIN')`<br> |
| **`BoardController.java`** | `/api/boards` | `GET /{id}`, `PUT /{id}`, `DELETE /{id}`, `GET /{id}/activity`, `POST /{id}/columns`, `PATCH /{id}/columns/reorder` | `@boardSecurity.canReadBoard(...)`, `@boardSecurity.isAdmin(...)`, `hasAnyRole('ROLE_ADMIN', 'ROLE_PROJECT_MANAGER')`<br> |
| **`ColumnController.java`** | `/api/columns` | `PUT /{id}`, `DELETE /{id}` | `@boardSecurity.isAdmin(...)`, `hasAnyRole('ROLE_ADMIN', 'ROLE_PROJECT_MANAGER')`<br> |
| **`WorkflowController.java`** | `/api/boards/{id}/transitions` | `GET /`, `PUT /` (full matrix update) | `@boardSecurity.canReadBoard(...)`, `hasAnyRole('ADMIN', 'PROJECT_MANAGER')`<br> |
| **`TaskController.java`** | `/api/tasks` | `POST /`, `GET /{id}`, `PATCH /{id}/move`, `PATCH /{id}/metadata`, `PATCH /{id}/assignee`, `POST /{id}/approve`, `POST /{id}/reject`, `DELETE /{id}` | `@taskSecurity.canMoveCard(...)`, `@taskSecurity.canEditCard(...)`, `@taskSecurity.canAssignCard(...)`, `@taskSecurity.canDeleteCard(...)`, `hasAnyRole('ADMIN', 'PROJECT_MANAGER', 'QA_TESTER')`<br> |
| **`AuditLogController.java`** | `/api/audit-logs` | `GET /` (paginated system log table) | `hasRole('ROLE_ADMIN')`<br> |

---

## 10. Exception Handling (`com.valeo.kanban.exception`)

### **`GlobalExceptionHandler.java` (`@RestControllerAdvice`)**

* **Responsibility:** Translates domain exceptions into structured `ApiErrorResponse` JSON objects with appropriate HTTP status codes:



| Intercepted Exception | HTTP Status Code | Response Body `error` Code | Description / Trigger Condition |
| --- | --- | --- | --- |
| `OptimisticLockException` / `ConcurrencyConflictException` | `409 Conflict` | `OPTIMISTIC_LOCK_FAILURE` | Task was modified concurrently by another transaction.

 |
| `ConflictException` | `409 Conflict` | `CONFLICT` | Column deletion blocked due to active tasks or transition references.

 |
| `InvalidStateTransitionException` | `400 Bad Request` | `INVALID_TRANSITION` | Transition path is not registered in the workflow matrix.

 |
| `TaskLockedException` | `423 Locked` | `TASK_LOCKED` | Attempted edit/move on a task currently in `PENDING_APPROVAL`.

 |
| `AccessDeniedException` | `403 Forbidden` | `FORBIDDEN` | Caller lacks static role or dynamic ABAC ownership permissions.

 |
| `EntityNotFoundException` | `404 Not Found` | `NOT_FOUND` | Resource identifier does not exist.

 |
| `MethodArgumentNotValidException` | `400 Bad Request` | `VALIDATION_FAILED` | Bean Validation (`@NotNull`, `@Size`) failed on request DTO. |