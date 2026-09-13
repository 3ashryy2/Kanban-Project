package com.valeo.kanban.security.evaluator;

import com.valeo.kanban.model.entity.Column;
import com.valeo.kanban.model.enums.WorkspaceRole;
import com.valeo.kanban.repository.BoardRepository;
import com.valeo.kanban.repository.ColumnRepository;
import com.valeo.kanban.repository.TaskRepository;
import com.valeo.kanban.repository.WorkspaceMemberRepository;
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
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BoardSecurityEvaluatorTest {

    @Mock private BoardRepository boardRepository;
    @Mock private TaskRepository taskRepository;
    @Mock private ColumnRepository columnRepository;
    @Mock private WorkspaceMemberRepository workspaceMemberRepository;
    @Mock private WorkspaceSecurityEvaluator workspaceSecurity;
    @Mock private BoardAccessService boardAccess;

    @InjectMocks private BoardSecurityEvaluator boardSecurity;

    private final CustomUserDetails developer = user(3L, "dev@valeo.com");
    private final CustomUserDetails projectManager = user(2L, "pm@valeo.com");
    private final CustomUserDetails viewer = user(5L, "viewer@valeo.com");

    @Test
    void developersCreateCardsOnlyInTheFirstColumn() {
        when(boardAccess.roleOnBoard(10L, 3L)).thenReturn(Optional.of(WorkspaceRole.ROLE_DEVELOPER));
        when(columnRepository.findFirstByBoardIdOrderByPositionAsc(10L))
                .thenReturn(Optional.of(Column.builder().id(1L).name("To-Do").build()));

        assertThat(boardSecurity.canCreateTaskInColumn(10L, 1L, developer)).isTrue();
        // e.g. straight into "Ready for QA", which would skip the approval gate
        assertThat(boardSecurity.canCreateTaskInColumn(10L, 4L, developer)).isFalse();
    }

    @Test
    void projectManagersCreateCardsInAnyColumn() {
        when(boardAccess.roleOnBoard(10L, 2L)).thenReturn(Optional.of(WorkspaceRole.ROLE_PROJECT_MANAGER));

        assertThat(boardSecurity.canCreateTaskInColumn(10L, 4L, projectManager)).isTrue();
        verifyNoInteractions(columnRepository);
    }

    @Test
    void viewersCannotCreateCardsAnywhere() {
        when(boardAccess.roleOnBoard(10L, 5L)).thenReturn(Optional.of(WorkspaceRole.ROLE_VIEWER));

        assertThat(boardSecurity.canCreateTaskInColumn(10L, 1L, viewer)).isFalse();
    }

    private static CustomUserDetails user(long id, String email) {
        return new CustomUserDetails(id, email, "hash", "First", "Last", false, List.of());
    }
}
