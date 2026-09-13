package com.valeo.kanban.security.evaluator;

import com.valeo.kanban.dto.request.TaskAssigneeRequest;
import com.valeo.kanban.model.entity.Board;
import com.valeo.kanban.model.entity.Task;
import com.valeo.kanban.model.entity.User;
import com.valeo.kanban.model.enums.TaskStatus;
import com.valeo.kanban.model.enums.WorkspaceRole;
import com.valeo.kanban.repository.ColumnRepository;
import com.valeo.kanban.repository.TaskRepository;
import com.valeo.kanban.security.BoardAccessService;
import com.valeo.kanban.security.CustomUserDetails;
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
            new CustomUserDetails(3L, "dev@valeo.com", "hash", "Mohanad", "Emad", false, List.of());

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

    private static Task taskOwnedByDeveloper() {
        User dev = User.builder().id(3L).email("dev@valeo.com").firstName("Mohanad").lastName("Emad").passwordHash("hash").build();
        return Task.builder()
                .id(7L)
                .board(Board.builder().id(10L).build())
                .createdBy(dev)
                .assignee(dev)
                .status(TaskStatus.ACTIVE)
                .build();
    }
}
