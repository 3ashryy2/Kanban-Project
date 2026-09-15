package com.example.kanban.service;

import com.example.kanban.dto.request.TaskCreateRequest;
import com.example.kanban.dto.request.TaskMetadataRequest;
import com.example.kanban.dto.request.TaskAssigneeRequest;
import com.example.kanban.dto.response.TaskDto;
import com.example.kanban.dto.mapper.TaskMapper;
import com.example.kanban.event.model.TaskGenericAuditEvent;
import com.example.kanban.model.entity.Board;
import com.example.kanban.model.entity.Column;
import com.example.kanban.model.entity.Task;
import com.example.kanban.model.entity.User;
import com.example.kanban.model.enums.TaskPriority;
import com.example.kanban.model.enums.TaskStatus;
import com.example.kanban.model.enums.WorkspaceRole;
import com.example.kanban.repository.BoardRepository;
import com.example.kanban.repository.ColumnRepository;
import com.example.kanban.repository.TaskRepository;
import com.example.kanban.repository.UserRepository;
import com.example.kanban.security.BoardAccessService;
import com.example.kanban.security.CustomUserDetails;
import jakarta.persistence.EntityNotFoundException;
import jakarta.persistence.OptimisticLockException;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.ArrayList;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class TaskService {

    private final TaskRepository taskRepository;
    private final BoardRepository boardRepository;
    private final ColumnRepository columnRepository;
    private final UserRepository userRepository;
    private final BoardAccessService boardAccessService;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional(readOnly = true)
    public TaskDto getTaskById(Long taskId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new EntityNotFoundException("Task not found with ID: " + taskId));
        return TaskMapper.toDto(task);
    }

    @Transactional
    public TaskDto createTask(TaskCreateRequest request, CustomUserDetails currentUser) {
        Board board = boardRepository.findById(request.getBoardId())
                .orElseThrow(() -> new EntityNotFoundException("Board not found"));

        Column column = columnRepository.findByIdAndBoardId(request.getColumnId(), board.getId())
                .orElseThrow(() -> new IllegalArgumentException("Column " + request.getColumnId() + " does not belong to this board."));

        User creator = userRepository.getReferenceById(currentUser.getId());
        User assignee = null;
        if (request.getAssigneeId() != null) {
            requireBoardAccess(request.getAssigneeId(), board.getId());
            assignee = userRepository.getReferenceById(request.getAssigneeId());
        }

        TaskPriority priority = TaskPriority.MEDIUM;
        if (request.getPriority() != null) {
            priority = TaskPriority.valueOf(request.getPriority().toUpperCase());
        }

        List<String> tags = request.getTags() != null ? request.getTags() : new ArrayList<>();

        Task task = Task.builder()
                .board(board)
                .column(column)
                .title(request.getTitle())
                .description(request.getDescription())
                .priority(priority)
                .status(TaskStatus.ACTIVE)
                .position(request.getPosition())
                .assignee(assignee)
                .createdBy(creator)
                .dueDate(request.getDueDate())
                .tags(tags)
                .build();

        Task savedTask = taskRepository.saveAndFlush(task);

        // Publish creation audit event
        eventPublisher.publishEvent(new TaskGenericAuditEvent(
                this,
                board.getWorkspace().getId(),
                board.getId(),
                savedTask.getId(),
                currentUser.getId(),
                "TASK_CREATED",
                "{\"title\":\"" + savedTask.getTitle().replace("\"", "\\\"") + "\"}"
        ));

        return TaskMapper.toDto(savedTask);
    }

    @Transactional
    public TaskDto updateMetadata(Long taskId, TaskMetadataRequest request, CustomUserDetails currentUser) {
        Task task = taskRepository.findByIdWithHierarchy(taskId)
                .orElseThrow(() -> new EntityNotFoundException("Task not found"));

        // Optimistic Locking validation
        if (!task.getVersion().equals(request.getVersion())) {
            throw new OptimisticLockException("Task was modified concurrently by another transaction.");
        }

        task.setTitle(request.getTitle());
        task.setDescription(request.getDescription());
        if (request.getPriority() != null) {
            task.setPriority(TaskPriority.valueOf(request.getPriority().toUpperCase()));
        }
        task.setDueDate(request.getDueDate());

        List<String> tags = request.getTags() != null ? request.getTags() : new ArrayList<>();
        task.setTags(tags);

        Task savedTask = taskRepository.saveAndFlush(task);

        // Publish update audit event
        eventPublisher.publishEvent(new TaskGenericAuditEvent(
                this,
                task.getBoard().getWorkspace().getId(),
                task.getBoard().getId(),
                savedTask.getId(),
                currentUser.getId(),
                "METADATA_UPDATED",
                "{\"title\":\"" + savedTask.getTitle().replace("\"", "\\\"") + "\"}"
        ));

        return TaskMapper.toDto(savedTask);
    }

    @Transactional
    public TaskDto updateAssignee(Long taskId, TaskAssigneeRequest request, CustomUserDetails currentUser) {
        Task task = taskRepository.findByIdWithHierarchy(taskId)
                .orElseThrow(() -> new EntityNotFoundException("Task not found"));

        // Optimistic Locking validation
        if (!task.getVersion().equals(request.getVersion())) {
            throw new OptimisticLockException("Task was modified concurrently by another transaction.");
        }

        User newAssignee = null;
        if (request.getAssigneeId() != null) {
            requireBoardAccess(request.getAssigneeId(), task.getBoard().getId());
            newAssignee = userRepository.getReferenceById(request.getAssigneeId());
        }

        // Assignee Requirement Rule:
        // If unassigning, and the task is in a stage other than the starting column, block it.
        if (newAssignee == null) {
            com.example.kanban.model.entity.Column startingColumn = task.getBoard().getColumns().stream()
                    .min(java.util.Comparator.comparingDouble(com.example.kanban.model.entity.Column::getPosition))
                    .orElse(task.getColumn());
            if (!task.getColumn().getId().equals(startingColumn.getId())) {
                throw new IllegalArgumentException("A task must remain assigned while in a stage other than To-Do.");
            }
        }

        task.setAssignee(newAssignee);
        Task savedTask = taskRepository.saveAndFlush(task);

        // Publish assignee change audit event
        String assigneeEmail = newAssignee != null ? newAssignee.getEmail() : "unassigned";
        eventPublisher.publishEvent(new TaskGenericAuditEvent(
                this,
                task.getBoard().getWorkspace().getId(),
                task.getBoard().getId(),
                savedTask.getId(),
                currentUser.getId(),
                "TASK_ASSIGNED",
                "{\"assignee\":\"" + assigneeEmail + "\"}"
        ));

        return TaskMapper.toDto(savedTask);
    }

    @Transactional
    public void deleteTask(Long taskId, CustomUserDetails currentUser) {
        Task task = taskRepository.findByIdWithHierarchy(taskId)
                .orElseThrow(() -> new EntityNotFoundException("Task not found with ID: " + taskId));

        // Publish delete audit event before deleting
        eventPublisher.publishEvent(new TaskGenericAuditEvent(
                this,
                task.getBoard().getWorkspace().getId(),
                task.getBoard().getId(),
                taskId,
                currentUser.getId(),
                "TASK_DELETED",
                "{\"title\":\"" + task.getTitle().replace("\"", "\\\"") + "\"}"
        ));

        taskRepository.delete(task);
    }

    // A task may only be assigned to someone who can open its board and is NOT a viewer
    private void requireBoardAccess(Long assigneeId, Long boardId) {
        boolean isAdmin = userRepository.findById(assigneeId).map(User::isAdmin).orElse(false);
        if (isAdmin) {
            return; // Admins can always be assigned
        }

        Optional<WorkspaceRole> role = boardAccessService.roleOnBoard(boardId, assigneeId);
        if (role.isEmpty()) {
            throw new IllegalArgumentException("The assignee must be a member of this board.");
        }
        if (role.get() == WorkspaceRole.ROLE_VIEWER) {
            throw new IllegalArgumentException("A task cannot be assigned to a viewer.");
        }
    }
}
