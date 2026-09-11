package com.valeo.kanban.security.evaluator;

import com.valeo.kanban.dto.request.TaskAssigneeRequest;
import com.valeo.kanban.model.entity.Column;
import com.valeo.kanban.model.entity.Task;
import com.valeo.kanban.model.enums.TaskStatus;
import com.valeo.kanban.model.enums.WorkspaceRole;
import com.valeo.kanban.repository.ColumnRepository;
import com.valeo.kanban.repository.TaskRepository;
import com.valeo.kanban.security.BoardAccessService;
import com.valeo.kanban.security.CustomUserDetails;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.util.Optional;

@Component("taskSecurity")
@RequiredArgsConstructor
public class TaskSecurityEvaluator {

    private final TaskRepository taskRepository;
    private final ColumnRepository columnRepository;
    private final BoardAccessService boardAccess;

    // The actor's role on the task's board; empty when they may not open that board at all
    // (no longer in the workspace, or not a member of this board). Checked before any ABAC rule.
    private Optional<WorkspaceRole> roleOnTaskBoard(Task task, CustomUserDetails currentUser) {
        return boardAccess.roleOnBoard(task.getBoard().getId(), currentUser.getId());
    }

    private boolean isManager(WorkspaceRole role) {
        return role == WorkspaceRole.ROLE_PROJECT_MANAGER;
    }

    public boolean canEditCard(Long taskId, CustomUserDetails currentUser) {
        if (taskId == null || currentUser == null) return false;
        if (currentUser.isAdmin()) return true;

        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new EntityNotFoundException("Task not found with ID: " + taskId));

        Optional<WorkspaceRole> access = roleOnTaskBoard(task, currentUser);
        if (access.isEmpty()) return false;
        WorkspaceRole role = access.get();

        // 1. Approval Lock Precedence: If locked, ONLY Admin or Project Manager can edit
        if (task.getStatus() == TaskStatus.PENDING_APPROVAL) {
            return isManager(role);
        }

        // 2. Global / Board Elevated Roles
        if (isManager(role)) {
            return true;
        }

        // 3. Dynamic Assignee / Creator ABAC Bypass
        boolean isCreator = task.getCreatedBy().getId().equals(currentUser.getId());
        boolean isAssignee = task.getAssignee() != null && task.getAssignee().getId().equals(currentUser.getId());
        if (isCreator || isAssignee) {
            return true;
        }

        // 4. Base Role Operations (Developers and QA can edit metadata on active tasks)
        return role == WorkspaceRole.ROLE_DEVELOPER || role == WorkspaceRole.ROLE_QA_TESTER;
    }

    public boolean canMoveCard(Long taskId, Long targetColumnId, CustomUserDetails currentUser) {
        if (taskId == null || currentUser == null) return false;
        if (currentUser.isAdmin()) return true;

        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new EntityNotFoundException("Task not found with ID: " + taskId));

        Optional<WorkspaceRole> access = roleOnTaskBoard(task, currentUser);
        if (access.isEmpty()) return false;
        WorkspaceRole role = access.get();

        if (task.getStatus() == TaskStatus.PENDING_APPROVAL) {
            return isManager(role);
        }

        if (role == WorkspaceRole.ROLE_QA_TESTER) {
            Column sourceColumn = task.getColumn();
            if (sourceColumn == null || !sourceColumn.getName().equalsIgnoreCase("Ready for QA")) {
                return false;
            }
            if (targetColumnId == null) return false;
            Column targetColumn = columnRepository.findById(targetColumnId)
                    .orElseThrow(() -> new EntityNotFoundException("Column not found with ID: " + targetColumnId));
            return targetColumn.getName().equalsIgnoreCase("Done") ||
                   targetColumn.getName().equalsIgnoreCase("In Progress");
        }

        return role == WorkspaceRole.ROLE_PROJECT_MANAGER ||
               role == WorkspaceRole.ROLE_DEVELOPER;
    }

    public boolean canAssignCard(Long taskId, TaskAssigneeRequest request, CustomUserDetails currentUser) {
        if (taskId == null || request == null || currentUser == null) return false;
        if (currentUser.isAdmin()) return true;

        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new EntityNotFoundException("Task not found"));

        Optional<WorkspaceRole> access = roleOnTaskBoard(task, currentUser);
        if (access.isEmpty()) return false;
        WorkspaceRole role = access.get();

        if (isManager(role)) {
            return true;
        }

        // Allow self-assignment if the task is currently unassigned and user has Developer/QA role
        if (task.getAssignee() == null && (role == WorkspaceRole.ROLE_DEVELOPER || role == WorkspaceRole.ROLE_QA_TESTER)) {
            return request.getAssigneeId() != null && request.getAssigneeId().equals(currentUser.getId());
        }

        // Otherwise, only the current assignee can reassign or unassign
        return task.getAssignee() != null && task.getAssignee().getId().equals(currentUser.getId());
    }

    public boolean canDeleteCard(Long taskId, CustomUserDetails currentUser) {
        if (taskId == null || currentUser == null) return false;
        if (currentUser.isAdmin()) return true;

        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new EntityNotFoundException("Task not found with ID: " + taskId));

        Optional<WorkspaceRole> access = roleOnTaskBoard(task, currentUser);
        if (access.isEmpty()) return false;
        WorkspaceRole role = access.get();

        if (task.getStatus() == TaskStatus.PENDING_APPROVAL) {
            return isManager(role);
        }

        if (isManager(role)) {
            return true;
        }

        boolean isCreator = task.getCreatedBy().getId().equals(currentUser.getId());
        boolean isAssignee = task.getAssignee() != null && task.getAssignee().getId().equals(currentUser.getId());
        return isCreator || isAssignee;
    }
}
