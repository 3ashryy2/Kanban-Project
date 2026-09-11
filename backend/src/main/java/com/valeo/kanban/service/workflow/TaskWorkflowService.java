package com.valeo.kanban.service.workflow;

import com.valeo.kanban.dto.request.TaskMoveRequest;
import com.valeo.kanban.dto.response.TaskDto;
import com.valeo.kanban.dto.mapper.TaskMapper;
import com.valeo.kanban.event.model.CardMovedEvent;
import com.valeo.kanban.event.model.TaskGenericAuditEvent;
import com.valeo.kanban.exception.custom.InvalidStateTransitionException;
import com.valeo.kanban.exception.custom.TaskLockedException;
import com.valeo.kanban.model.entity.Task;
import com.valeo.kanban.model.entity.WorkflowTransition;
import com.valeo.kanban.model.enums.TaskStatus;
import com.valeo.kanban.model.enums.WorkspaceRole;
import com.valeo.kanban.repository.ColumnRepository;
import com.valeo.kanban.repository.TaskRepository;
import com.valeo.kanban.repository.WorkflowTransitionRepository;
import com.valeo.kanban.repository.WorkspaceMemberRepository;
import com.valeo.kanban.security.CustomUserDetails;
import jakarta.persistence.EntityNotFoundException;
import jakarta.persistence.OptimisticLockException;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TaskWorkflowService {

    private final TaskRepository taskRepository;
    private final WorkflowTransitionRepository transitionRepository;
    private final ColumnRepository columnRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public TaskDto moveTask(Long taskId, TaskMoveRequest request, CustomUserDetails currentUser) {
        Task task = taskRepository.findByIdWithHierarchy(taskId)
                .orElseThrow(() -> new EntityNotFoundException("Task not found"));

        // 1. Optimistic Locking Version Verification
        if (!task.getVersion().equals(request.getVersion())) {
            throw new OptimisticLockException("Task was modified concurrently by another transaction.");
        }

        Long sourceColumnId = task.getColumn().getId();
        Long targetColumnId = request.getTargetColumnId();

        // A task never leaves its board, not even through the admin override
        if (columnRepository.findByIdAndBoardId(targetColumnId, task.getBoard().getId()).isEmpty()) {
            throw new InvalidStateTransitionException("The target column does not belong to this task's board.");
        }

        WorkspaceRole actorRole = workspaceMemberRepository
                .findByWorkspaceIdAndUserId(task.getBoard().getWorkspace().getId(), currentUser.getId())
                .map(com.valeo.kanban.model.entity.WorkspaceMember::getRole)
                .orElse(WorkspaceRole.ROLE_VIEWER);
        boolean isWorkspaceAdminOrPM = currentUser.isAdmin() || actorRole == WorkspaceRole.ROLE_PROJECT_MANAGER;
        boolean isAdminOverride = currentUser.isAdmin();

        // 2. Approval Lock Invariant
        if (task.getStatus() == TaskStatus.PENDING_APPROVAL && !isWorkspaceAdminOrPM) {
            throw new TaskLockedException("Task is locked pending approval.");
        }

        // 3. Assignee Requirement Rule
        if (!sourceColumnId.equals(targetColumnId)) {
            com.valeo.kanban.model.entity.Column startingColumn = task.getBoard().getColumns().stream()
                    .min(java.util.Comparator.comparingDouble(com.valeo.kanban.model.entity.Column::getPosition))
                    .orElse(task.getColumn());

            if (!targetColumnId.equals(startingColumn.getId()) && task.getAssignee() == null) {
                throw new InvalidStateTransitionException("A task must have an assignee before it can be moved to another stage.");
            }
        }

        // 4. Workflow State Machine Rule Evaluation
        if (!sourceColumnId.equals(targetColumnId)) {
            if (!isAdminOverride) {
                WorkflowTransition transition = transitionRepository
                        .findByBoardIdAndFromColumnIdAndToColumnId(task.getBoard().getId(), sourceColumnId, targetColumnId)
                        .orElseThrow(() -> new InvalidStateTransitionException("Invalid column transition path."));

                // Single Source of Truth: requires_approval dictates gate enforcement
                if (transition.isRequiresApproval()) {
                    if (!isWorkspaceAdminOrPM) {
                        task.setStatus(TaskStatus.PENDING_APPROVAL);
                    }
                }
            }
        }

        // 4. Update Position and Container
        task.setColumn(columnRepository.getReferenceById(targetColumnId));
        task.setPosition(request.getNewPosition());

        Task savedTask = taskRepository.saveAndFlush(task);

        // 5. Asynchronous Audit Event Dispatch (Mutually Exclusive Event Dispatch)
        Long workspaceId = task.getBoard().getWorkspace().getId();
        Long boardId = task.getBoard().getId();

        if (isAdminOverride) {
            eventPublisher.publishEvent(new TaskGenericAuditEvent(
                    this, workspaceId, boardId, savedTask.getId(), currentUser.getId(),
                    "ADMIN_OVERRIDE", "{\"from\":\"" + sourceColumnId + "\",\"to\":\"" + targetColumnId + "\"}"
            ));
        } else if (savedTask.getStatus() == TaskStatus.PENDING_APPROVAL) {
            eventPublisher.publishEvent(new TaskGenericAuditEvent(
                    this, workspaceId, boardId, savedTask.getId(), currentUser.getId(),
                    "GATE_REQUESTED", "{\"targetColumn\":\"" + targetColumnId + "\"}"
            ));
        } else {
            eventPublisher.publishEvent(new CardMovedEvent(
                    this, workspaceId, boardId, savedTask.getId(), currentUser.getId(),
                    sourceColumnId, targetColumnId, savedTask.getStatus().name()
            ));
        }

        return TaskMapper.toDto(savedTask);
    }
}
