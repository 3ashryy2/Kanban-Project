package com.valeo.kanban.service.workflow;

import com.valeo.kanban.dto.request.TaskApproveRequest;
import com.valeo.kanban.dto.request.TaskRejectRequest;
import com.valeo.kanban.dto.response.TaskDto;
import com.valeo.kanban.dto.mapper.TaskMapper;
import com.valeo.kanban.event.model.GateApprovedEvent;
import com.valeo.kanban.event.model.GateRejectedEvent;
import com.valeo.kanban.exception.custom.InvalidStateTransitionException;
import com.valeo.kanban.model.entity.Column;
import com.valeo.kanban.model.entity.Task;
import com.valeo.kanban.model.enums.TaskStatus;
import com.valeo.kanban.repository.TaskRepository;
import com.valeo.kanban.repository.WorkflowTransitionRepository;
import com.valeo.kanban.security.CustomUserDetails;
import jakarta.persistence.EntityNotFoundException;
import jakarta.persistence.OptimisticLockException;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ApprovalGateService {

    private final TaskRepository taskRepository;
    private final WorkflowTransitionRepository transitionRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public TaskDto approveTask(Long taskId, TaskApproveRequest request, CustomUserDetails currentUser) {
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

        Task updatedTask = taskRepository.saveAndFlush(task);

        eventPublisher.publishEvent(new GateApprovedEvent(
                this,
                task.getBoard().getWorkspace().getId(),
                task.getBoard().getId(),
                updatedTask.getId(),
                currentUser.getId(),
                task.getColumn().getId()
        ));

        return TaskMapper.toDto(updatedTask);
    }

    @Transactional
    public TaskDto rejectTask(Long taskId, TaskRejectRequest request, CustomUserDetails currentUser) {
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

        Task updatedTask = taskRepository.saveAndFlush(task);

        eventPublisher.publishEvent(new GateRejectedEvent(
                this,
                task.getBoard().getWorkspace().getId(),
                task.getBoard().getId(),
                updatedTask.getId(),
                currentUser.getId(),
                request.getFallbackColumnId(),
                request.getRejectionReason()
        ));

        return TaskMapper.toDto(updatedTask);
    }
}
