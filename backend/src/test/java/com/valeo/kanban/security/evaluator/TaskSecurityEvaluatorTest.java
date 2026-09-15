package com.example.kanban.security.evaluator;

import com.example.kanban.dto.request.TaskAssigneeRequest;
import com.example.kanban.model.entity.Board;
import com.example.kanban.model.entity.Task;
import com.example.kanban.model.entity.User;
import com.example.kanban.model.enums.TaskStatus;
import com.example.kanban.model.enums.WorkspaceRole;
import com.example.kanban.repository.ColumnRepository;
import com.example.kanban.repository.TaskRepository;
import com.example.kanban.security.BoardAccessService;
import com.example.kanban.security.CustomUserDetails;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskSecurityEvaluatorTest {

    @Mock private TaskRepository taskRepository;
    @Mock private ColumnRepository columnRepository;
    @Mock private BoardAccessService boardAccess;

    @InjectMocks private TaskSecurityEvaluator taskSecurity;

    private final CustomUserDetails developer =
            new CustomUserDetails(3L, "dev@example.com", "hash", "Mohanad", "Emad", false, List.of());
    private final CustomUserDetails projectManager =
            new CustomUserDetails(2L, "pm@example.com", "hash", "Project", "Manager", false, List.of());

    @Test
    void theCreatorAndAssigneeLosesEveryRightOnceTheyCannotOpenTheBoard() {
        // Phase 1 bug: a user removed from the workspace could still edit and delete tasks they created
        when(taskRepository.findById(7L)).thenReturn(Optional.of(taskOwnedByDeveloper()));
        when(boardAccess.roleOnBoard(10L, 3L)).thenReturn(Optional.empty());

        assertThat(taskSecurity.canEditCard(7L, developer)).isFalse();
        assertThat(taskSecurity.canDeleteCard(7L, developer)).isFalse();
        assertThat(taskSecurity.canAssignCard(7L, new TaskAssigneeRequest(null, 0L), developer)).isFalse();
    }

    @Test
    void theCreatorKeepsEditRightsWhileTheyCanOpenTheBoard() {
        when(taskRepository.findById(7L)).thenReturn(Optional.of(taskOwnedByDeveloper()));
        when(boardAccess.roleOnBoard(10L, 3L)).thenReturn(Optional.of(WorkspaceRole.ROLE_DEVELOPER));

        assertThat(taskSecurity.canEditCard(7L, developer)).isTrue();
    }

    @Test
    void onlyManagersReassignACardLockedForApproval() {
        // Before: the assignee could still hand a locked card on through the API, though the UI hid the option
        Task locked = taskOwnedByDeveloper();
        locked.setStatus(TaskStatus.PENDING_APPROVAL);
        when(taskRepository.findById(7L)).thenReturn(Optional.of(locked));
        when(boardAccess.roleOnBoard(10L, 3L)).thenReturn(Optional.of(WorkspaceRole.ROLE_DEVELOPER));
        when(boardAccess.roleOnBoard(10L, 2L)).thenReturn(Optional.of(WorkspaceRole.ROLE_PROJECT_MANAGER));

        assertThat(taskSecurity.canAssignCard(7L, new TaskAssigneeRequest(4L, 0L), developer)).isFalse();
        assertThat(taskSecurity.canAssignCard(7L, new TaskAssigneeRequest(null, 0L), developer)).isFalse();
        assertThat(taskSecurity.canAssignCard(7L, new TaskAssigneeRequest(4L, 0L), projectManager)).isTrue();
    }

    private static Task taskOwnedByDeveloper() {
        User dev = User.builder().id(3L).email("dev@example.com").firstName("Mohanad").lastName("Emad").passwordHash("hash").build();
        return Task.builder()
                .id(7L)
                .board(Board.builder().id(10L).build())
                .createdBy(dev)
                .assignee(dev)
                .status(TaskStatus.ACTIVE)
                .build();
    }
}
