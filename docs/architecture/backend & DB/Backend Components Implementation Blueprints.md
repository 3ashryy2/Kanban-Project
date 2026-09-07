# Document 5: Spring Boot Backend Architecture & Implementation Specification

---

## 1. Backend Layering & Architectural Flow

The backend employs a **Decoupled Layered Architecture with Event-Driven Auditing**, separating declarative security evaluations, workflow state transitions, and database persistence.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        1. API & Transport Layer                        │
│   (REST Controllers, Request Validation DTOs, Exception Advice)        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Method Invocations
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               2. Declarative Security & ABAC Evaluators                │
│    (JWT Authentication Filter, TaskSecurity, WorkspaceSecurity)        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Authorized Requests
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   3. Business & Workflow Engine Layer                  │
│    (TaskWorkflowService, State Machine Evaluator, Approval Gate)       │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │ Spring Application Events      │ Entity Mutations
                    ▼                                ▼
┌──────────────────────────────────────┐ ┌───────────────────────────────┐
│     4. Event-Driven Audit Layer      │ │  5. Persistence & JPA Layer   │
│ (@Async TransactionalEventListener,  │ │ (Spring Data JPA, @BatchSize, │
│  Non-blocking Audit Log Writer)      │ │  Optimistic Version Locking)  │
└──────────────────────────────────────┘ └───────────────────────────────┘

```

---

## 2. Package & Class Structure

```
com.valeo.kanban
├── config
│   ├── SecurityConfig.java (SecurityFilterChain, Stateless JWT, CORS)
│   ├── AsyncConfig.java (ThreadPoolTaskExecutor for Audit Logging)
│   └── OpenApiConfig.java
├── security
│   ├── JwtAuthenticationFilter.java (Header Extraction & Token Parsing)
│   ├── JwtTokenProvider.java (HMAC-SHA256 Signing & Claims Extraction)
│   ├── CustomUserDetails.java (Tenant & Principal Context)
│   ├── CustomUserDetailsService.java (UserPrincipal Hydration)
│   └── evaluator
│       ├── TaskSecurityEvaluator.java (@taskSecurity ABAC & Lock Rules)
│       ├── WorkspaceSecurityEvaluator.java (@workspaceSecurity RBAC)
│       └── BoardSecurityEvaluator.java (@boardSecurity Access Rules)
├── controller
│   ├── AuthController.java (/api/auth)
│   ├── WorkspaceController.java (/api/workspaces, /members)
│   ├── BoardController.java (/api/boards, /columns)
│   ├── WorkflowController.java (/api/boards/{id}/transitions)
│   ├── TaskController.java (/api/tasks: CRUD, /move, /metadata, /approve, /reject)
│   └── AuditLogController.java (/api/audit-logs, /activity)
├── service
│   ├── AuthService.java (Credential Validation & Token Issuance)
│   ├── WorkspaceService.java (Tenant & Membership Management)
│   ├── BoardService.java (Two-Query Aggregate Assembly & Reordering)
│   ├── ColumnService.java (Lifecycle & Empty/Dependency Constraints)
│   ├── TaskService.java (Task CRUD, Metadata, Assignee Mutation)
│   └── workflow
│       ├── TaskWorkflowService.java (Drag-and-Drop Processing & Gating Engine)
│       └── ApprovalGateService.java (Approve / Reject Logic & Fallback Routing)
├── event
│   ├── model
│   │   ├── CardMovedEvent.java
│   │   ├── GateApprovedEvent.java
│   │   └── GateRejectedEvent.java
│   └── listener
│       └── AuditLogEventListener.java (@TransactionalEventListener + @Async)
├── repository
│   ├── UserRepository.java
│   ├── WorkspaceRepository.java
│   ├── WorkspaceMemberRepository.java
│   ├── BoardRepository.java
│   ├── ColumnRepository.java
│   ├── TaskRepository.java (Targeted Hierarchy & Cartesian-safe Queries)
│   ├── WorkflowTransitionRepository.java
│   └── AuditLogRepository.java
├── model
│   ├── entity (User, Workspace, WorkspaceMember, Board, Column, Task, WorkflowTransition, AuditLog)
│   └── enums (WorkspaceRole, TaskStatus, TaskPriority, AuditActionType)
└── exception
    ├── GlobalExceptionHandler.java (@RestControllerAdvice)
    └── custom
        ├── InvalidStateTransitionException.java
        ├── TaskLockedException.java
        ├── ConflictException.java
        └── ConcurrencyConflictException.java

```

---

## 3. Declarative Security & Custom ABAC Evaluators

Dynamic card interaction security is evaluated via custom Spring Security SpEL expressions:

```java
@Component("taskSecurity")
@RequiredArgsConstructor
public class TaskSecurityEvaluator {

    private final TaskRepository taskRepository;

    public boolean canEditCard(Long taskId, CustomUserDetails currentUser) {
        Task task = taskRepository.findById(taskId)
            .orElseThrow(() -> new EntityNotFoundException("Task not found with ID: " + taskId));

        // 1. Approval Lock Precedence: If locked, ONLY Admin or Project Manager can edit
        if (task.getStatus() == TaskStatus.PENDING_APPROVAL) {
            return currentUser.hasAnyRole("ROLE_ADMIN", "ROLE_PROJECT_MANAGER");
        }

        // 2. Global / Board Elevated Roles
        if (currentUser.hasAnyRole("ROLE_ADMIN", "ROLE_PROJECT_MANAGER")) {
            return true;
        }

        // 3. Dynamic Assignee / Creator ABAC Bypass
        boolean isCreator = task.getCreatedBy().getId().equals(currentUser.getId());
        boolean isAssignee = task.getAssignee() != null && task.getAssignee().getId().equals(currentUser.getId());
        if (isCreator || isAssignee) {
            return true;
        }

        // 4. Base Role Operations (Developers and QA can edit metadata on active tasks)
        return currentUser.hasAnyRole("ROLE_DEVELOPER", "ROLE_QA_TESTER");
    }

    public boolean canMoveCard(Long taskId, CustomUserDetails currentUser) {
        Task task = taskRepository.findById(taskId)
            .orElseThrow(() -> new EntityNotFoundException("Task not found with ID: " + taskId));

        if (task.getStatus() == TaskStatus.PENDING_APPROVAL) {
            return currentUser.hasAnyRole("ROLE_ADMIN", "ROLE_PROJECT_MANAGER");
        }

        return currentUser.hasAnyRole("ROLE_ADMIN", "ROLE_PROJECT_MANAGER", "ROLE_DEVELOPER", "ROLE_QA_TESTER");
    }

    public boolean canAssignCard(Long taskId, CustomUserDetails currentUser) {
        Task task = taskRepository.findById(taskId)
            .orElseThrow(() -> new EntityNotFoundException("Task not found"));

        if (currentUser.hasAnyRole("ROLE_ADMIN", "ROLE_PROJECT_MANAGER")) {
            return true;
        }
        
        // Allow self-assignment if the task is currently unassigned
        if (task.getAssignee() == null && (currentUser.hasRole("ROLE_DEVELOPER") || currentUser.hasRole("ROLE_QA_TESTER"))) {
            return true;
        }
        
        return task.getAssignee() != null && task.getAssignee().getId().equals(currentUser.getId());
    }

    public boolean canDeleteCard(Long taskId, CustomUserDetails currentUser) {
        Task task = taskRepository.findById(taskId)
            .orElseThrow(() -> new EntityNotFoundException("Task not found with ID: " + taskId));

        if (task.getStatus() == TaskStatus.PENDING_APPROVAL) {
            return currentUser.hasAnyRole("ROLE_ADMIN", "ROLE_PROJECT_MANAGER");
        }

        if (currentUser.hasAnyRole("ROLE_ADMIN", "ROLE_PROJECT_MANAGER")) {
            return true;
        }

        boolean isCreator = task.getCreatedBy().getId().equals(currentUser.getId());
        boolean isAssignee = task.getAssignee() != null && task.getAssignee().getId().equals(currentUser.getId());
        return isCreator || isAssignee;
    }
}

```

---

## 4. Query Optimization & Cartesian Product Prevention

To prevent `MultipleBagFetchException` and database memory explosions when loading board hierarchies, data fetching utilizes the **Two-Query Strategy**:

```java
@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {

    // Eagerly loads single-valued parent hierarchy to eliminate N+1 queries in Event Listeners
    @Query("SELECT t FROM Task t " +
           "JOIN FETCH t.board b " +
           "JOIN FETCH b.workspace w " +
           "JOIN FETCH t.column c " +
           "WHERE t.id = :taskId")
    Optional<Task> findByIdWithHierarchy(@Param("taskId") Long taskId);

    // Indexed single query to fetch all tasks for a board
    @Query("SELECT t FROM Task t WHERE t.board.id = :boardId ORDER BY t.position ASC")
    List<Task> findAllByBoardIdOrderByPositionAsc(@Param("boardId") Long boardId);

    long countByColumnId(Long columnId);
}

```

```java
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BoardServiceImpl implements BoardService {

    private final BoardRepository boardRepository;
    private final TaskRepository taskRepository;

    @Override
    public BoardDetailsDto getBoardAggregate(Long boardId) {
        // Query 1: Fetch Board and its ordered Columns
        Board board = boardRepository.findBoardWithColumnsById(boardId)
            .orElseThrow(() -> new EntityNotFoundException("Board not found"));

        // Query 2: Fetch all tasks belonging to the board
        List<Task> tasks = taskRepository.findAllByBoardIdOrderByPositionAsc(boardId);

        // Assembly into aggregate DTO in application memory
        return BoardMapper.toAggregateDto(board, tasks);
    }
}

```

---

## 5. Column Deletion & State Machine Guard

Enforces task emptiness and prevents breaking workflow transitions or fallback routing upon column deletion:

```java
@Service
@RequiredArgsConstructor
@Transactional
public class ColumnServiceImpl implements ColumnService {

    private final ColumnRepository columnRepository;
    private final TaskRepository taskRepository;
    private final WorkflowTransitionRepository transitionRepository;

    @Override
    public void deleteColumn(Long columnId) {
        Column column = columnRepository.findById(columnId)
            .orElseThrow(() -> new EntityNotFoundException("Column not found"));

        // 1. Task Existence Restriction Guard
        long taskCount = taskRepository.countByColumnId(columnId);
        if (taskCount > 0) {
            throw new ConflictException("Cannot delete column: Contains " + taskCount + " active tasks. Move tasks first.");
        }

        // 2. Workflow Transition & Fallback Integrity Guard
        boolean isReferencedInTransitions = transitionRepository
            .existsByFromColumnIdOrToColumnIdOrFallbackColumnId(columnId);

        if (isReferencedInTransitions) {
            throw new ConflictException("Cannot delete column: Active workflow transitions or rejection fallbacks reference this stage.");
        }

        columnRepository.delete(column);
    }
}

```

---

## 6. Workflow Engine & Human-in-the-Loop Gating Service

Enforces the transition matrix as the authoritative gating engine:

```java
@Service
@RequiredArgsConstructor
@Transactional
public class TaskWorkflowServiceImpl implements TaskWorkflowService {

    private final TaskRepository taskRepository;
    private final WorkflowTransitionRepository transitionRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Override
    public TaskResponseDto moveTask(Long taskId, TaskMoveRequest request, CustomUserDetails currentUser) {
        Task task = taskRepository.findByIdWithHierarchy(taskId)
            .orElseThrow(() -> new EntityNotFoundException("Task not found"));

        // 1. Optimistic Locking Version Verification
        if (!task.getVersion().equals(request.getVersion())) {
            throw new OptimisticLockException("Task was modified concurrently by another transaction.");
        }

        Long sourceColumnId = task.getColumn().getId();
        Long targetColumnId = request.getTargetColumnId();

        // 2. Approval Lock Invariant
        if (task.getStatus() == TaskStatus.PENDING_APPROVAL && 
            !currentUser.hasAnyRole("ROLE_ADMIN", "ROLE_PROJECT_MANAGER")) {
            throw new TaskLockedException("Task is locked pending approval.");
        }

        // 3. Workflow State Machine Rule Evaluation
        if (!sourceColumnId.equals(targetColumnId)) {
            boolean isAdminOverride = request.isAdminBypass() && currentUser.hasRole("ROLE_ADMIN");

            if (!isAdminOverride) {
                WorkflowTransition transition = transitionRepository
                    .findByBoardIdAndFromColumnIdAndToColumnId(task.getBoard().getId(), sourceColumnId, targetColumnId)
                    .orElseThrow(() -> new InvalidStateTransitionException("Invalid column transition path."));

                // Single Source of Truth: requires_approval dictates gate enforcement
                if (transition.isRequiresApproval()) {
                    boolean isAuthorizedApprover = currentUser.hasAnyRole("ROLE_ADMIN", "ROLE_PROJECT_MANAGER") ||
                        (currentUser.hasRole("ROLE_QA_TESTER") && "Ready for QA".equalsIgnoreCase(task.getColumn().getName()));

                    if (!isAuthorizedApprover) {
                        task.setStatus(TaskStatus.PENDING_APPROVAL);
                    }
                }
            }
        }

        // 4. Update Position and Container
        task.setColumn(new Column(targetColumnId));
        task.setPosition(request.getNewPosition());

        Task savedTask = taskRepository.save(task);

        // 5. Asynchronous Audit Event Dispatch
        eventPublisher.publishEvent(new CardMovedEvent(
            this,
            task.getBoard().getWorkspace().getId(),
            task.getBoard().getId(),
            savedTask.getId(),
            currentUser.getId(),
            sourceColumnId,
            targetColumnId,
            savedTask.getStatus().name()
        ));

        return TaskMapper.toDto(savedTask);
    }
}

```

```java
@Service
@RequiredArgsConstructor
@Transactional
public class ApprovalGateServiceImpl implements ApprovalGateService {

    private final TaskRepository taskRepository;
    private final WorkflowTransitionRepository transitionRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Override
    public TaskResponseDto approveTask(Long taskId, TaskApproveRequest request, CustomUserDetails currentUser) {
        Task task = taskRepository.findByIdWithHierarchy(taskId)
            .orElseThrow(() -> new EntityNotFoundException("Task not found"));

        if (!task.getVersion().equals(request.getVersion())) {
            throw new OptimisticLockException("Task was modified concurrently by another transaction.");
        }

        if (task.getStatus() != TaskStatus.PENDING_APPROVAL) {
            throw new IllegalStateException("Task is not in PENDING_APPROVAL status.");
        }

        task.setStatus(TaskStatus.ACTIVE);
        task.setRejectionReason(null);

        Task updatedTask = taskRepository.save(task);

        eventPublisher.publishEvent(new GateApprovedEvent(
            this, task.getBoard().getWorkspace().getId(), task.getBoard().getId(),
            updatedTask.getId(), currentUser.getId(), task.getColumn().getId()
        ));

        return TaskMapper.toDto(updatedTask);
    }

    @Override
    public TaskResponseDto rejectTask(Long taskId, TaskRejectRequest request, CustomUserDetails currentUser) {
        Task task = taskRepository.findByIdWithHierarchy(taskId)
            .orElseThrow(() -> new EntityNotFoundException("Task not found"));

        if (!task.getVersion().equals(request.getVersion())) {
            throw new OptimisticLockException("Task was modified concurrently by another transaction.");
        }

        if (task.getStatus() != TaskStatus.PENDING_APPROVAL) {
            throw new IllegalStateException("Task is not in PENDING_APPROVAL status.");
        }

        // Validate that the requested fallback column is configured as a valid fallback for this transition
        boolean isValidFallback = transitionRepository.existsByBoardIdAndToColumnIdAndFallbackColumnId(
            task.getBoard().getId(), task.getColumn().getId(), request.getFallbackColumnId()
        );

        if (!isValidFallback) {
             throw new InvalidStateTransitionException("The requested fallback column is not a valid rejection path.");
        }

        // Move to specified backward/default fallback column
        task.setColumn(new Column(request.getFallbackColumnId()));
        task.setStatus(TaskStatus.ACTIVE);
        task.setRejectionReason(request.getRejectionReason());

        Task updatedTask = taskRepository.save(task);

        eventPublisher.publishEvent(new GateRejectedEvent(
            this, task.getBoard().getWorkspace().getId(), task.getBoard().getId(),
            updatedTask.getId(), currentUser.getId(), request.getFallbackColumnId(), request.getRejectionReason()
        ));

        return TaskMapper.toDto(updatedTask);
    }
}

```

---

## 7. Decoupled Asynchronous Audit Logging Sink

Uses Spring's transactional event listener to persist audit logs post-commit on an isolated thread pool:

```java
@Component
@RequiredArgsConstructor
@Slf4j
public class AuditLogEventListener {

    private final AuditLogRepository auditLogRepository;

    @Async("auditExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleCardMovedEvent(CardMovedEvent event) {
        try {
            AuditLog auditLog = AuditLog.builder()
                .workspaceId(event.getWorkspaceId())
                .boardId(event.getBoardId())
                .taskId(event.getTaskId())
                .actorId(event.getActorId())
                .actionType("CARD_MOVED")
                .sourceColumnId(event.getSourceColumnId())
                .targetColumnId(event.getTargetColumnId())
                .details("{\"status\":\"" + event.getStatus() + "\"}")
                .timestamp(Instant.now())
                .build();

            auditLogRepository.save(auditLog);
        } catch (Exception ex) {
            log.error("Failed to persist async audit log for task: {}", event.getTaskId(), ex);
        }
    }
}

```

---

## 8. Global Exception Handling (`GlobalExceptionHandler`)

Maps domain exceptions directly to standard HTTP status codes:

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(OptimisticLockException.class)
    public ResponseEntity<ApiErrorResponse> handleOptimisticLock(OptimisticLockException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(new ApiErrorResponse("OPTIMISTIC_LOCK_FAILURE", "Task was modified concurrently. Please sync."));
    }

    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<ApiErrorResponse> handleConflict(ConflictException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(new ApiErrorResponse("CONFLICT", ex.getMessage()));
    }

    @ExceptionHandler(InvalidStateTransitionException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidTransition(InvalidStateTransitionException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(new ApiErrorResponse("INVALID_TRANSITION", ex.getMessage()));
    }

    @ExceptionHandler(TaskLockedException.class)
    public ResponseEntity<ApiErrorResponse> handleTaskLocked(TaskLockedException ex) {
        return ResponseEntity.status(HttpStatus.LOCKED)
            .body(new ApiErrorResponse("TASK_LOCKED", ex.getMessage()));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiErrorResponse> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(new ApiErrorResponse("FORBIDDEN", "Insufficient privileges to perform this action."));
    }

    @ExceptionHandler(EntityNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleNotFound(EntityNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(new ApiErrorResponse("NOT_FOUND", ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleNotFound(MethodArgumentNotValidException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(new ApiErrorResponse("VALIDATION_FAILED", ex.getMessage()));
    }
}

```