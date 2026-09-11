package com.valeo.kanban.service;

import com.valeo.kanban.event.model.TaskGenericAuditEvent;
import com.valeo.kanban.model.entity.Task;
import com.valeo.kanban.model.enums.AuditActionType;
import com.valeo.kanban.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Collection;
import java.util.List;

/**
 * Runs when a user loses access to boards (removed from them, removed from the workspace, or demoted from PM):
 * their tasks there are unassigned so no work stays assigned to someone who can no longer see it.
 */
@Service
@RequiredArgsConstructor
public class BoardAccessRevocationService {

    private final TaskRepository taskRepository;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * Unassigns the user's tasks on the given boards inside the caller's transaction,
     * recording one audit entry per task.
     *
     * @return how many tasks were unassigned
     */
    @Transactional
    public int unassignTasksOnBoards(Long workspaceId, Long userId, Collection<Long> boardIds, Long actorId) {
        if (boardIds == null || boardIds.isEmpty()) {
            return 0;
        }

        List<Task> tasks = taskRepository.findAllAssignedToUserOnBoards(userId, boardIds);
        for (Task task : tasks) {
            String previousAssignee = task.getAssignee().getEmail();
            // Tasks past To-Do end up unassigned; the move rules require an assignee before they move again
            task.setAssignee(null);
            eventPublisher.publishEvent(new TaskGenericAuditEvent(
                    this,
                    workspaceId,
                    task.getBoard().getId(),
                    task.getId(),
                    actorId,
                    AuditActionType.TASK_AUTO_UNASSIGNED.name(),
                    "{\"previousAssignee\":\"" + previousAssignee.replace("\"", "\\\"") + "\",\"reason\":\"BOARD_ACCESS_REVOKED\"}"
            ));
        }
        taskRepository.saveAll(tasks);
        return tasks.size();
    }
}
